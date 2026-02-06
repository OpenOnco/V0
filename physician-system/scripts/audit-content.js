/**
 * audit-content.js — Classify all MRD guidance items for clinical decision support transformation
 *
 * Usage:
 *   node physician-system/scripts/audit-content.js          # human-readable output
 *   node physician-system/scripts/audit-content.js --json   # JSON only (for piping)
 *
 * Requires: MRD_DATABASE_URL in environment (or .env in physician-system/)
 */

import 'dotenv/config';
import pg from 'pg';
import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JSON_ONLY = process.argv.includes('--json');

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
// Fetch all items with joined tags
// ---------------------------------------------------------------------------

async function fetchAllItems(pool) {
  const { rows: items } = await pool.query(`
    SELECT
      g.id, g.source_type, g.source_id, g.source_url, g.title,
      g.authors, g.publication_date, g.journal, g.doi, g.pmid,
      g.evidence_type, g.evidence_level, g.relevance_score,
      g.summary, g.key_findings, g.full_text_excerpt,
      g.decision_context, g.direct_quotes, g.interpretation_guardrail,
      g.is_superseded, g.created_at, g.updated_at
    FROM mrd_guidance_items g
    ORDER BY g.id
  `);

  const { rows: ctRows } = await pool.query(
    `SELECT guidance_id, cancer_type FROM mrd_guidance_cancer_types ORDER BY guidance_id`
  );
  const { rows: csRows } = await pool.query(
    `SELECT guidance_id, clinical_setting FROM mrd_guidance_clinical_settings ORDER BY guidance_id`
  );
  const { rows: qRows } = await pool.query(
    `SELECT guidance_id, question FROM mrd_guidance_questions ORDER BY guidance_id`
  );

  // Index junction rows by guidance_id
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
// Classification
// ---------------------------------------------------------------------------

const KNOWN_TESTS = [
  'Signatera', 'Guardant Reveal', 'FoundationOne Tracker', 'RaDaR',
  'clonoSEQ', 'NavDx', 'Guardant360', 'FoundationOne Liquid CDx',
  'Tempus xF', 'Personalis NeXT', 'Invitae', 'Natera',
];

const QUESTION_TO_DECISION_POINT = {
  positive_result_action: 'mrd_positive_management',
  negative_result_action: 'mrd_negative_management',
  escalation: 'treatment_escalation',
  de_escalation: 'treatment_de_escalation',
  when_to_test: 'testing_timing',
  which_test: 'test_selection',
  test_frequency: 'testing_frequency',
  prognosis: 'prognostic_assessment',
  clinical_trial_eligibility: 'trial_eligibility',
};

function classifyItem(item) {
  const category = determineCategory(item);
  const decisionPoints = deriveDecisionPoints(item);
  const cancerTypeStage = deriveCancerTypeStage(item);
  const testSpecific = extractTestReferences(item);

  return { category, decisionPoints, cancerTypeStage, testSpecific };
}

function determineCategory(item) {
  const et = (item.evidence_type || '').toLowerCase();
  const questions = item.questions || [];

  // Rule 1: guidelines / consensus -> decision_support
  if (et === 'guideline' || et === 'consensus') return 'decision_support';

  // Rule 2: RCT with treatment-action questions -> decision_support
  if (et === 'rct_results') {
    const actionQs = ['positive_result_action', 'escalation', 'de_escalation'];
    if (questions.some((q) => actionQs.includes(q))) return 'decision_support';
  }

  // Rule 3: coverage / regulatory -> policy
  if (et === 'coverage_policy' || et === 'regulatory') return 'policy';

  // Rule 4: observational with performance metrics -> data_point
  if (et === 'observational' && hasPerformanceMetrics(item)) return 'data_point';

  // Rule 5: review / meta_analysis without specific clinical settings -> background
  if (et === 'review' || et === 'meta_analysis') {
    if (!item.clinical_settings || item.clinical_settings.length === 0) return 'background';
  }

  // Fallback: keyword analysis on title + summary
  return keywordClassify(item);
}

function hasPerformanceMetrics(item) {
  const findings = item.key_findings;
  if (!Array.isArray(findings)) return false;
  const perfTerms = /sensitiv|specificit|concordan|ppv|npv|auc|accuracy|ctdna.*detect|detection.*rate/i;
  return findings.some(
    (f) => perfTerms.test(f.finding || '') || perfTerms.test(f.implication || '')
  );
}

function keywordClassify(item) {
  const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();

  const dsTerms = /\b(recommend|should|guideline|consensus|standard of care|treatment.*implication|clinical.*action)\b/;
  const dpTerms = /\b(sensitiv|specificit|concordan|detection rate|ppv|npv|auc|ctdna.*level|assay.*performance)\b/;
  const polTerms = /\b(coverage|payer|cms|reimburs|medicare|medicaid|fda.*approv|clearance)\b/;

  if (dsTerms.test(text)) return 'decision_support';
  if (dpTerms.test(text)) return 'data_point';
  if (polTerms.test(text)) return 'policy';
  return 'background';
}

function deriveDecisionPoints(item) {
  return (item.questions || [])
    .map((q) => QUESTION_TO_DECISION_POINT[q])
    .filter(Boolean);
}

function deriveCancerTypeStage(item) {
  const types = item.cancer_types || [];
  if (types.length === 0) return [];

  // Try to extract stage from decision_context
  const dc = item.decision_context || {};
  const pop = dc.population || {};
  const stage = pop.stage;

  if (stage) {
    return types.map((ct) => `${ct}_stage_${stage}`.toLowerCase().replace(/\s+/g, '_'));
  }

  // Try title/summary for stage mentions
  const text = `${item.title || ''} ${item.summary || ''}`;
  const stageMatch = text.match(/stage\s+(I{1,3}V?|[1-4])/i);
  if (stageMatch) {
    const s = stageMatch[1].toUpperCase();
    return types.map((ct) => `${ct}_stage_${s}`);
  }

  return types.map((ct) => ct);
}

function extractTestReferences(item) {
  const text = `${item.title || ''} ${item.summary || ''} ${item.full_text_excerpt || ''}`;
  return KNOWN_TESTS.filter((test) => text.toLowerCase().includes(test.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Gap analysis
// ---------------------------------------------------------------------------

function buildGapMatrix(classifiedItems) {
  const allCancerTypes = new Set();
  const allDecisionPoints = new Set();
  const matrix = {};

  for (const item of classifiedItems) {
    const cts = item.cancer_types.length > 0 ? item.cancer_types : ['unspecified'];
    const dps = item.classification.decisionPoints.length > 0
      ? item.classification.decisionPoints
      : ['unclassified'];

    for (const ct of cts) {
      allCancerTypes.add(ct);
      for (const dp of dps) {
        allDecisionPoints.add(dp);
        const key = `${ct}|${dp}`;
        matrix[key] = (matrix[key] || 0) + 1;
      }
    }
  }

  const cancerTypes = [...allCancerTypes].sort();
  const decisionPoints = [...allDecisionPoints].sort();
  const gaps = [];

  for (const ct of cancerTypes) {
    for (const dp of decisionPoints) {
      const key = `${ct}|${dp}`;
      if (!matrix[key]) {
        gaps.push({ cancer_type: ct, decision_point: dp });
      }
    }
  }

  return { cancerTypes, decisionPoints, matrix, gaps };
}

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

function countBy(items, fn) {
  const counts = {};
  for (const item of items) {
    const key = fn(item) || 'null';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function printSection(title, content) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(70));
  console.log(content);
}

function printTable(counts, label) {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const maxKey = Math.max(...sorted.map(([k]) => k.length), label.length);
  const lines = sorted.map(([k, v]) => `  ${k.padEnd(maxKey)}  ${String(v).padStart(4)}`);
  return `  ${label.padEnd(maxKey)}  ${'Count'.padStart(4)}\n  ${'-'.repeat(maxKey + 6)}\n${lines.join('\n')}`;
}

function printGapMatrix(gap) {
  const { cancerTypes, decisionPoints, matrix } = gap;
  const colW = 6;
  const rowLabelW = Math.max(...cancerTypes.map((c) => c.length), 15);

  let header = ''.padEnd(rowLabelW) + '  ';
  for (const dp of decisionPoints) {
    header += dp.slice(0, colW).padStart(colW) + ' ';
  }

  const rows = cancerTypes.map((ct) => {
    let row = ct.padEnd(rowLabelW) + '  ';
    for (const dp of decisionPoints) {
      const val = matrix[`${ct}|${dp}`] || 0;
      const cell = val === 0 ? '  --- ' : String(val).padStart(colW) + ' ';
      row += cell;
    }
    return row;
  });

  return `${header}\n  ${'-'.repeat(header.length)}\n${rows.join('\n')}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pool = createPool();

  try {
    // 1. Fetch all items
    const items = await fetchAllItems(pool);

    if (items.length === 0) {
      console.error('No guidance items found in database.');
      process.exit(1);
    }

    // 2. Classify each item
    const classifiedItems = items.map((item) => ({
      ...item,
      classification: classifyItem(item),
    }));

    // 3. Build gap analysis
    const gapData = buildGapMatrix(classifiedItems);

    // 4. Find items with NULL decision_context
    const nullDecisionContext = classifiedItems.filter((i) => !i.decision_context);

    // 5. Build output object
    const output = {
      metadata: {
        total_items: items.length,
        audit_date: new Date().toISOString(),
      },
      summary: {
        by_category: countBy(classifiedItems, (i) => i.classification.category),
        by_source_type: countBy(classifiedItems, (i) => i.source_type),
        by_cancer_type: countBy(
          classifiedItems.flatMap((i) =>
            (i.cancer_types.length > 0 ? i.cancer_types : ['unspecified']).map((ct) => ({ ct }))
          ),
          (x) => x.ct
        ),
        by_evidence_type: countBy(classifiedItems, (i) => i.evidence_type),
      },
      gap_analysis: {
        total_gaps: gapData.gaps.length,
        cancer_types: gapData.cancerTypes,
        decision_points: gapData.decisionPoints,
        gaps: gapData.gaps,
      },
      null_decision_context: {
        count: nullDecisionContext.length,
        items: nullDecisionContext.map((i) => ({
          id: i.id,
          title: i.title,
          evidence_type: i.evidence_type,
          category: i.classification.category,
        })),
      },
      items: classifiedItems.map((i) => ({
        id: i.id,
        title: i.title,
        source_type: i.source_type,
        source_id: i.source_id,
        evidence_type: i.evidence_type,
        is_superseded: i.is_superseded,
        cancer_types: i.cancer_types,
        clinical_settings: i.clinical_settings,
        questions: i.questions,
        classification: i.classification,
        has_decision_context: !!i.decision_context,
        has_direct_quotes: Array.isArray(i.direct_quotes) && i.direct_quotes.length > 0,
        has_guardrail: !!i.interpretation_guardrail,
      })),
    };

    // 6. Write JSON output file
    const outputPath = path.join(__dirname, 'audit-output.json');
    await writeFile(outputPath, JSON.stringify(output, null, 2));

    // 7. Print results
    if (JSON_ONLY) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`\nMRD Guidance Content Audit — ${items.length} items`);

      printSection('By Category', printTable(output.summary.by_category, 'Category'));
      printSection('By Source Type', printTable(output.summary.by_source_type, 'Source Type'));
      printSection('By Evidence Type', printTable(output.summary.by_evidence_type, 'Evidence Type'));
      printSection('By Cancer Type', printTable(output.summary.by_cancer_type, 'Cancer Type'));

      printSection(
        `Gap Matrix (cancer_type x decision_point) — ${gapData.gaps.length} gaps`,
        printGapMatrix(gapData)
      );

      if (gapData.gaps.length > 0) {
        console.log('\n  Gaps (zero coverage):');
        for (const g of gapData.gaps.slice(0, 30)) {
          console.log(`    - ${g.cancer_type} / ${g.decision_point}`);
        }
        if (gapData.gaps.length > 30) {
          console.log(`    ... and ${gapData.gaps.length - 30} more`);
        }
      }

      printSection(
        `NULL decision_context — ${nullDecisionContext.length} items (backfill candidates)`,
        nullDecisionContext
          .slice(0, 20)
          .map((i) => `  [${i.id}] (${i.classification.category}) ${i.title}`)
          .join('\n') +
          (nullDecisionContext.length > 20
            ? `\n  ... and ${nullDecisionContext.length - 20} more`
            : '')
      );

      console.log(`\nDetailed results written to: ${outputPath}\n`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
