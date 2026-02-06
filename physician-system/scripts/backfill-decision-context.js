/**
 * backfill-decision-context.js — Generate decision_context JSON for guidance items missing it
 *
 * Uses Claude Haiku in batch to classify evidence items for clinical decision support.
 *
 * Usage:
 *   node physician-system/scripts/backfill-decision-context.js                # full run
 *   node physician-system/scripts/backfill-decision-context.js --dry-run      # preview only
 *   node physician-system/scripts/backfill-decision-context.js --limit=5      # process 5 items
 *   node physician-system/scripts/backfill-decision-context.js --dry-run --limit=10
 *
 * Requires: MRD_DATABASE_URL and ANTHROPIC_API_KEY in environment (or .env in physician-system/)
 */

import 'dotenv/config';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';

const { Pool } = pg;

const MODEL = 'claude-3-5-haiku-20241022';
const MAX_TOKENS = 500;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 100;

const VALID_QUESTIONS = [
  'when_to_test',
  'which_test',
  'positive_result_action',
  'negative_result_action',
  'test_frequency',
  'de_escalation',
  'escalation',
  'prognosis',
  'clinical_trial_eligibility',
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const arg = process.argv.find((a) => a.startsWith('--limit='));
  return arg ? parseInt(arg.split('=')[1], 10) : null;
})();

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

function createPool() {
  const connectionString = process.env.MRD_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: MRD_DATABASE_URL or DATABASE_URL environment variable is required');
    process.exit(1);
  }
  return new Pool({
    connectionString,
    ssl: process.env.MRD_DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
}

// ---------------------------------------------------------------------------
// Fetch items with NULL decision_context
// ---------------------------------------------------------------------------

async function fetchNullDecisionContextItems(pool) {
  const { rows: items } = await pool.query(`
    SELECT g.id, g.source_type, g.title, g.evidence_type, g.evidence_level,
           g.summary, g.key_findings, g.full_text_excerpt
    FROM mrd_guidance_items g
    WHERE g.decision_context IS NULL AND g.is_superseded = false
    ORDER BY g.id
  `);

  const { rows: ctRows } = await pool.query(
    `SELECT guidance_id, cancer_type FROM mrd_guidance_cancer_types
     WHERE guidance_id IN (SELECT id FROM mrd_guidance_items WHERE decision_context IS NULL AND is_superseded = false)
     ORDER BY guidance_id`
  );
  const { rows: csRows } = await pool.query(
    `SELECT guidance_id, clinical_setting FROM mrd_guidance_clinical_settings
     WHERE guidance_id IN (SELECT id FROM mrd_guidance_items WHERE decision_context IS NULL AND is_superseded = false)
     ORDER BY guidance_id`
  );
  const { rows: qRows } = await pool.query(
    `SELECT guidance_id, question FROM mrd_guidance_questions
     WHERE guidance_id IN (SELECT id FROM mrd_guidance_items WHERE decision_context IS NULL AND is_superseded = false)
     ORDER BY guidance_id`
  );

  const cancerMap = groupBy(ctRows, 'guidance_id', 'cancer_type');
  const settingMap = groupBy(csRows, 'guidance_id', 'clinical_setting');
  const questionMap = groupBy(qRows, 'guidance_id', 'question');

  return items.map((item) => ({
    ...item,
    cancer_types: cancerMap.get(item.id) || [],
    clinical_settings: settingMap.get(item.id) || [],
    questions: questionMap.get(item.id) || [],
  }));
}

function groupBy(rows, keyCol, valCol) {
  const map = new Map();
  for (const row of rows) {
    const key = row[keyCol];
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row[valCol]);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

function buildPrompt(item) {
  const keyFindingsSummary = summarizeKeyFindings(item.key_findings);

  return `You are a clinical oncology expert classifying evidence items for a physician decision support system focused on MRD (molecular residual disease) and ctDNA testing.

Given this evidence item, generate a structured JSON decision_context object.

ITEM:
- Title: ${item.title || 'Unknown'}
- Source type: ${item.source_type || 'Unknown'}
- Evidence type: ${item.evidence_type || 'Unknown'}
- Evidence level: ${item.evidence_level || 'Unknown'}
- Cancer types: ${(item.cancer_types || []).join(', ') || 'Not specified'}
- Clinical settings: ${(item.clinical_settings || []).join(', ') || 'Not specified'}
- Summary: ${item.summary || 'No summary available'}
- Key findings: ${keyFindingsSummary}

Generate a JSON object with these fields:
- decision_point: one of [mrd_positive_management, mrd_negative_management, treatment_escalation, treatment_de_escalation, testing_timing, test_selection, testing_frequency, prognostic_assessment, trial_eligibility, coverage_access, general_evidence, surveillance_protocol]
- population: { cancer_type, stage (if known, else null), setting (one of: screening, diagnosis, pre_surgery, post_surgery, neoadjuvant, during_adjuvant, post_adjuvant, surveillance, recurrence, metastatic, general) }
- test_context: array of test names mentioned or relevant (lowercase: signatera, guardant_reveal, foundationone_tracker, radar, clonoseq, navdx, guardant360, foundationone_liquid_cdx, or "general_ctdna")
- options_discussed: array of clinical options/decisions discussed in this evidence (e.g., "escalate_adjuvant", "de_escalate_therapy", "serial_monitoring", "change_regimen", "add_immunotherapy", "trial_enrollment")
- limitations_noted: array of evidence limitations mentioned (e.g., "retrospective_only", "small_sample", "short_follow_up", "single_center", "no_overall_survival_data")
- evidence_strength: one of [established, strong, moderate, emerging, limited, very_limited, expert_opinion, insufficient]

Also include a "questions" field: an array of applicable clinical question tags from this list: when_to_test, which_test, positive_result_action, negative_result_action, test_frequency, de_escalation, escalation, prognosis, clinical_trial_eligibility

Return ONLY valid JSON, no markdown fences or explanation.`;
}

function summarizeKeyFindings(keyFindings) {
  if (!keyFindings) return 'None';
  if (!Array.isArray(keyFindings)) return String(keyFindings);
  if (keyFindings.length === 0) return 'None';

  return keyFindings
    .slice(0, 5)
    .map((f) => {
      if (typeof f === 'string') return f;
      const parts = [];
      if (f.finding) parts.push(f.finding);
      if (f.implication) parts.push(`(${f.implication})`);
      return parts.join(' ') || JSON.stringify(f);
    })
    .join('; ');
}

// ---------------------------------------------------------------------------
// Claude API call
// ---------------------------------------------------------------------------

function createAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }
  return new Anthropic();
}

async function callHaiku(client, item) {
  const prompt = buildPrompt(item);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  return parseJsonResponse(text);
}

function parseJsonResponse(text) {
  // Strip markdown fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Process a single item
// ---------------------------------------------------------------------------

async function processItem(client, pool, item, index, total) {
  const prefix = `[${index + 1}/${total}]`;

  try {
    let parsed;
    try {
      parsed = await callHaiku(client, item);
    } catch (firstErr) {
      // Retry once on JSON parse errors
      if (firstErr instanceof SyntaxError) {
        console.warn(`${prefix} JSON parse error for item #${item.id}, retrying...`);
        try {
          parsed = await callHaiku(client, item);
        } catch (retryErr) {
          console.error(`${prefix} Retry failed for item #${item.id}: ${retryErr.message}`);
          return { status: 'failed', id: item.id, error: retryErr.message };
        }
      } else {
        throw firstErr;
      }
    }

    // Extract and validate questions
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const validQuestions = rawQuestions.filter((q) => VALID_QUESTIONS.includes(q));

    // Build the decision_context (without questions — those go in the junction table)
    const decisionContext = {
      decision_point: parsed.decision_point || 'general_evidence',
      population: parsed.population || { cancer_type: 'unknown', stage: null, setting: 'general' },
      test_context: Array.isArray(parsed.test_context) ? parsed.test_context : ['general_ctdna'],
      options_discussed: Array.isArray(parsed.options_discussed) ? parsed.options_discussed : [],
      limitations_noted: Array.isArray(parsed.limitations_noted) ? parsed.limitations_noted : [],
      evidence_strength: parsed.evidence_strength || 'limited',
      backfilled_at: new Date().toISOString(),
      backfill_model: MODEL,
    };

    const shortTitle = (item.title || 'Untitled').slice(0, 60);
    const decisionPoint = decisionContext.decision_point;

    if (DRY_RUN) {
      console.log(`${prefix} Would backfill item #${item.id}: ${shortTitle} → ${decisionPoint}`);
      if (validQuestions.length > 0) {
        console.log(`        Questions: ${validQuestions.join(', ')}`);
      }
      return { status: 'dry_run', id: item.id, decisionPoint };
    }

    // Write to database
    await pool.query(
      `UPDATE mrd_guidance_items SET decision_context = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(decisionContext), item.id]
    );

    // Insert new questions (ON CONFLICT DO NOTHING)
    if (validQuestions.length > 0) {
      // Filter out questions that already exist for this item
      const existingQuestions = new Set(item.questions || []);
      const newQuestions = validQuestions.filter((q) => !existingQuestions.has(q));

      for (const question of newQuestions) {
        await pool.query(
          `INSERT INTO mrd_guidance_questions (guidance_id, question)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [item.id, question]
        );
      }
    }

    console.log(`${prefix} Backfilled item #${item.id}: ${shortTitle} → ${decisionPoint}`);
    return { status: 'success', id: item.id, decisionPoint };
  } catch (err) {
    console.error(`${prefix} Failed item #${item.id}: ${err.message}`);
    return { status: 'failed', id: item.id, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Batch processing with concurrency control
// ---------------------------------------------------------------------------

async function processBatch(client, pool, items, startIndex, total) {
  const promises = items.map((item, i) =>
    processItem(client, pool, item, startIndex + i, total)
  );
  return Promise.all(promises);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nMRD Guidance — Backfill decision_context`);
  console.log(`Model: ${MODEL}`);
  if (DRY_RUN) console.log('Mode: DRY RUN (no database writes)');
  if (LIMIT) console.log(`Limit: ${LIMIT} items`);
  console.log('');

  const pool = createPool();
  const client = createAnthropicClient();

  try {
    // 1. Fetch items
    let items = await fetchNullDecisionContextItems(pool);
    console.log(`Found ${items.length} items with NULL decision_context`);

    if (items.length === 0) {
      console.log('Nothing to backfill. All items have decision_context.');
      return;
    }

    // Apply limit
    if (LIMIT && LIMIT < items.length) {
      items = items.slice(0, LIMIT);
      console.log(`Processing first ${LIMIT} items only`);
    }

    const total = items.length;
    const results = [];

    // 2. Process in batches of BATCH_SIZE
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = await processBatch(client, pool, batch, i, total);
      results.push(...batchResults);

      // Delay between batches (not after the last one)
      if (i + BATCH_SIZE < items.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    // 3. Print summary
    const successful = results.filter((r) => r.status === 'success').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const dryRun = results.filter((r) => r.status === 'dry_run').length;

    console.log(`\n${'='.repeat(50)}`);
    console.log('  Backfill Summary');
    console.log('='.repeat(50));
    console.log(`  Total processed:  ${results.length}`);
    if (DRY_RUN) {
      console.log(`  Would update:     ${dryRun}`);
    } else {
      console.log(`  Successful:       ${successful}`);
    }
    console.log(`  Failed:           ${failed}`);
    console.log(`  Skipped:          ${total - results.length}`);

    if (failed > 0) {
      console.log('\n  Failed items:');
      for (const r of results.filter((r) => r.status === 'failed')) {
        console.log(`    - Item #${r.id}: ${r.error}`);
      }
    }

    console.log('');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
