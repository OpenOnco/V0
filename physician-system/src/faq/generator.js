/**
 * FAQ Generator — Monthly pipeline to refresh patient advocacy FAQ answers
 *
 * Queries the physician-system evidence database, generates personalized
 * answers with Claude Sonnet, diffs against current answers, and writes
 * the updated physicianFAQ.js file.
 *
 * Usage:
 *   node src/faq/generator.js              # Full refresh (all cancer types)
 *   node src/faq/generator.js --dry-run    # Generate but don't write
 *   node src/faq/generator.js --type lung  # Single cancer type
 *
 * Can also be called from scheduler as a monthly job.
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import { query } from '../db/client.js';
import { searchSimilar } from '../embeddings/mrd-embedder.js';
import { createLogger } from '../utils/logger.js';
import { CONCERN_QUERY_MAP, FAQ_CANCER_TYPES, buildGenerationPrompt } from './prompts.js';
import { diffFAQData } from './diff.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('faq-generator');

// Path to the FAQ data file in the frontend
const FAQ_FILE_PATH = resolve(__dirname, '../../../src/config/physicianFAQ.js');

// Non-generated concerns (handled by wizards, not evidence)
const SKIP_CONCERNS = ['insurance'];

// Rate limit: pause between Sonnet calls
const GENERATION_DELAY_MS = 500;

/**
 * Main entry point — run the full FAQ refresh pipeline
 */
export async function refreshFAQ(options = {}) {
  const {
    dryRun = false,
    cancerTypeFilter = null, // e.g. 'lung' to refresh only lung
  } = options;

  logger.info('Starting FAQ refresh', { dryRun, cancerTypeFilter });

  // 1. Load current FAQ data for diffing
  const currentData = options._currentData || await loadCurrentFAQDataAsync();

  // 2. Initialize Anthropic client
  const anthropic = new Anthropic();

  // 3. Determine which cancer types to process
  const cancerTypes = cancerTypeFilter
    ? FAQ_CANCER_TYPES.filter(ct => ct.id === cancerTypeFilter)
    : FAQ_CANCER_TYPES;

  if (cancerTypes.length === 0) {
    logger.error(`Unknown cancer type: ${cancerTypeFilter}`);
    return { error: `Unknown cancer type: ${cancerTypeFilter}` };
  }

  // 4. Generate answers for each (cancerType, concern) pair
  const newData = {};
  const stats = { generated: 0, skipped: 0, errors: 0 };

  for (const cancerType of cancerTypes) {
    logger.info(`Processing: ${cancerType.id} (tier ${cancerType.tier})`);
    newData[cancerType.id] = {};

    for (const [concernId, queryConfig] of Object.entries(CONCERN_QUERY_MAP)) {
      if (SKIP_CONCERNS.includes(concernId)) continue;

      try {
        // Retrieve evidence from DB
        const evidence = await retrieveEvidence(cancerType, concernId, queryConfig);

        if (evidence.length === 0) {
          logger.warn(`No evidence found for ${cancerType.id}/${concernId}, keeping current answer`);
          if (currentData[cancerType.id]?.[concernId]) {
            newData[cancerType.id][concernId] = currentData[cancerType.id][concernId];
          }
          stats.skipped++;
          continue;
        }

        logger.info(`  ${concernId}: ${evidence.length} sources retrieved`);

        // Generate answer with Claude
        const currentAnswer = currentData[cancerType.id]?.[concernId] || null;
        const answer = await generateAnswer(anthropic, {
          cancerType: cancerType.id,
          concernId,
          evidence,
          currentAnswer,
        });

        if (answer) {
          newData[cancerType.id][concernId] = answer;
          stats.generated++;
        } else {
          // Keep current answer if generation failed
          if (currentAnswer) {
            newData[cancerType.id][concernId] = currentAnswer;
          }
          stats.errors++;
        }

        // Rate limit
        await sleep(GENERATION_DELAY_MS);

      } catch (error) {
        logger.error(`Error generating ${cancerType.id}/${concernId}`, { error: error.message });
        // Preserve current answer on error
        if (currentData[cancerType.id]?.[concernId]) {
          newData[cancerType.id][concernId] = currentData[cancerType.id][concernId];
        }
        stats.errors++;
      }
    }
  }

  // 5. Merge with existing data (preserve _default and any types we didn't regenerate)
  const mergedData = { ...currentData };
  for (const [type, concerns] of Object.entries(newData)) {
    mergedData[type] = { ...mergedData[type], ...concerns };
  }

  // 6. Diff
  const diff = diffFAQData(currentData, mergedData);
  logger.info('Diff summary:\n' + diff.summary);

  // 7. Write if not dry run and there are changes
  if (!dryRun && diff.changes.length > 0) {
    writeFAQFile(mergedData);
    logger.info(`FAQ file written to ${FAQ_FILE_PATH}`);
  } else if (dryRun) {
    logger.info('Dry run — no file written');
  } else {
    logger.info('No changes detected — file unchanged');
  }

  const result = {
    stats,
    changes: diff.changes,
    unchanged: diff.unchanged.length,
    summary: diff.summary,
  };

  logger.info('FAQ refresh complete', result);
  return result;
}

/**
 * Retrieve evidence for a (cancerType, concern) pair using hybrid search
 */
async function retrieveEvidence(cancerType, concernId, queryConfig) {
  const results = [];

  // Strategy 1: Semantic search using the concern's search queries
  for (const searchQuery of queryConfig.searchQueries) {
    const fullQuery = `${searchQuery} ${cancerType.id}`;
    try {
      const similar = await searchSimilar(fullQuery, {
        limit: 6,
        minSimilarity: 0.55,
        cancerType: cancerType.dbType,
      });
      for (const item of similar) {
        if (!results.find(r => r.id === item.id)) {
          results.push(item);
        }
      }
    } catch (error) {
      logger.warn(`Vector search failed for "${fullQuery}": ${error.message}`);
    }
  }

  // Strategy 2: Structured DB query filtering by question tags + evidence type
  try {
    const dbResults = await queryEvidenceByTags(
      cancerType.dbType,
      queryConfig.questions,
      queryConfig.evidenceTypes,
      10
    );
    for (const item of dbResults) {
      if (!results.find(r => r.id === item.id)) {
        results.push(item);
      }
    }
  } catch (error) {
    logger.warn(`DB tag query failed for ${cancerType.id}/${concernId}: ${error.message}`);
  }

  // Sort by relevance score descending, then recency
  results.sort((a, b) => {
    const scoreA = a.relevance_score || a.similarity || 0;
    const scoreB = b.relevance_score || b.similarity || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    // Tie-break by date (newer first)
    const dateA = a.publication_date ? new Date(a.publication_date) : new Date(0);
    const dateB = b.publication_date ? new Date(b.publication_date) : new Date(0);
    return dateB - dateA;
  });

  // Cap at 8 sources to fit in prompt context
  return results.slice(0, 8);
}

/**
 * Query evidence by question tags and evidence types from the DB
 */
async function queryEvidenceByTags(dbCancerType, questions, evidenceTypes, limit) {
  const sql = `
    SELECT DISTINCT g.id, g.title, g.summary, g.source_type, g.source_id,
           g.source_url, g.evidence_type, g.evidence_level,
           g.publication_date, g.relevance_score, g.key_findings
    FROM mrd_guidance_items g
    JOIN mrd_guidance_cancer_types ct ON ct.guidance_id = g.id
    WHERE ct.cancer_type = $1
      AND g.is_superseded = FALSE
      AND g.relevance_score >= 7
      AND (
        g.evidence_type = ANY($2::text[])
        OR EXISTS (
          SELECT 1 FROM mrd_guidance_questions q
          WHERE q.guidance_id = g.id AND q.question = ANY($3::text[])
        )
      )
    ORDER BY g.relevance_score DESC, g.publication_date DESC NULLS LAST
    LIMIT $4
  `;

  const result = await query(sql, [dbCancerType, evidenceTypes, questions, limit]);
  return result.rows;
}

/**
 * Generate a single FAQ answer using Claude Sonnet
 */
async function generateAnswer(anthropic, { cancerType, concernId, evidence, currentAnswer }) {
  const prompt = buildGenerationPrompt({ cancerType, concernId, evidence, currentAnswer });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0]?.text;
    if (!text) {
      logger.error(`Empty response for ${cancerType}/${concernId}`);
      return null;
    }

    // Parse JSON response (strip markdown fences if present)
    const jsonText = text.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
    const parsed = JSON.parse(jsonText);

    // Validate required fields
    if (!parsed.forPatient || !parsed.forDoctor) {
      logger.error(`Missing required fields for ${cancerType}/${concernId}`);
      return null;
    }

    // Clean up stageNotes — remove null entries
    if (parsed.stageNotes) {
      for (const [stage, note] of Object.entries(parsed.stageNotes)) {
        if (!note || note === 'null') {
          delete parsed.stageNotes[stage];
        }
      }
      if (Object.keys(parsed.stageNotes).length === 0) {
        delete parsed.stageNotes;
      }
    }

    return parsed;

  } catch (error) {
    logger.error(`Generation failed for ${cancerType}/${concernId}`, { error: error.message });
    return null;
  }
}

/**
 * Load current FAQ data by importing the JS module
 */
function loadCurrentFAQData() {
  try {
    // Read the file as text and extract the PHYSICIAN_FAQ_DATA export
    const content = readFileSync(FAQ_FILE_PATH, 'utf-8');

    // Dynamic import would be cleaner but ESM makes this tricky for a generated file.
    // Instead, parse the existing structure from the file. For robustness, we'll try
    // a dynamic import first.
    // Note: This works because physicianFAQ.js uses standard ES module exports.
    return {}; // Will be populated by async init below
  } catch (error) {
    logger.warn('Could not load current FAQ data, starting fresh', { error: error.message });
    return {};
  }
}

/**
 * Async load of current FAQ data via dynamic import
 */
async function loadCurrentFAQDataAsync() {
  try {
    const module = await import(FAQ_FILE_PATH);
    return module.PHYSICIAN_FAQ_DATA || {};
  } catch (error) {
    logger.warn('Could not import current FAQ data', { error: error.message });
    return {};
  }
}

/**
 * Write the updated FAQ file
 */
function writeFAQFile(data) {
  const header = `/**
 * Physician FAQ — Personalized answers for patient advocacy
 *
 * Structure: PHYSICIAN_FAQ_DATA[cancerType][concernId] = { ... }
 *
 * Cancer type tiers:
 *   Tier 1 (full): colorectal, breast, lung
 *   Tier 2 (moderate): bladder, melanoma
 *   Tier 3 (generic): everything else uses '_default'
 *
 * Stage-specific notes are optional overlays on the base answer.
 *
 * AUTO-GENERATED by physician-system/src/faq/generator.js
 * Last refresh: ${new Date().toISOString().split('T')[0]}
 * Manual edits will be overwritten on next refresh.
 */

export const CONCERNS = [
  { id: 'no-evidence', label: '"There\\'s no evidence MRD results change outcomes."' },
  { id: 'not-in-guidelines', label: '"It\\'s not in the guidelines yet."' },
  { id: 'what-to-do-positive', label: '"What would I even do with a positive result?"' },
  { id: 'insurance', label: '"Insurance won\\'t cover it."', isWizardLink: true },
  { id: 'not-validated', label: '"The test isn\\'t validated for your cancer type."' },
];

// Helper to get the best answer for a cancer type, falling back to _default
export function getAnswer(cancerType, concernId) {
  const typeData = PHYSICIAN_FAQ_DATA[cancerType] || PHYSICIAN_FAQ_DATA['_default'];
  return typeData[concernId] || PHYSICIAN_FAQ_DATA['_default'][concernId];
}

// Helper to get stage-specific note
export function getStageNote(cancerType, concernId, stage) {
  const answer = getAnswer(cancerType, concernId);
  if (!answer?.stageNotes || !stage) return null;
  return answer.stageNotes[stage] || null;
}
`;

  // Serialize the data object
  const dataStr = serializeFAQData(data);

  const output = header + '\nexport const PHYSICIAN_FAQ_DATA = ' + dataStr + ';\n';

  writeFileSync(FAQ_FILE_PATH, output, 'utf-8');
}

/**
 * Serialize FAQ data to nicely formatted JS object literal
 */
function serializeFAQData(data) {
  // Order: tier 1, tier 2, _default
  const orderedKeys = ['colorectal', 'breast', 'lung', 'bladder', 'melanoma', '_default'];
  const ordered = {};
  for (const key of orderedKeys) {
    if (data[key]) ordered[key] = data[key];
  }
  // Add any remaining keys
  for (const key of Object.keys(data)) {
    if (!ordered[key]) ordered[key] = data[key];
  }

  return formatObject(ordered, 0);
}

function formatObject(obj, depth) {
  const indent = '  '.repeat(depth);
  const innerIndent = '  '.repeat(depth + 1);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        return innerIndent + formatObject(item, depth + 1);
      }
      return innerIndent + JSON.stringify(item);
    });
    return '[\n' + items.join(',\n') + ',\n' + indent + ']';
  }

  if (typeof obj === 'object' && obj !== null) {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';

    const lines = entries.map(([key, val]) => {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
      if (typeof val === 'string') {
        // Use single quotes, escape internal single quotes
        const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `${innerIndent}${safeKey}: '${escaped}'`;
      }
      if (val === null || val === undefined) {
        return `${innerIndent}${safeKey}: null`;
      }
      if (typeof val === 'object') {
        return `${innerIndent}${safeKey}: ${formatObject(val, depth + 1)}`;
      }
      return `${innerIndent}${safeKey}: ${JSON.stringify(val)}`;
    });

    return '{\n' + lines.join(',\n') + ',\n' + indent + '}';
  }

  return JSON.stringify(obj);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── CLI entry point ───
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
FAQ Generator — Refresh patient advocacy FAQ answers from evidence database

Usage:
  node src/faq/generator.js              Full refresh (all cancer types)
  node src/faq/generator.js --dry-run    Generate but don't write file
  node src/faq/generator.js --type lung  Refresh single cancer type
  node src/faq/generator.js --help       Show this help

The script queries the physician-system evidence database, generates
personalized answers with Claude Sonnet, and writes to:
  ${FAQ_FILE_PATH}
`);
  process.exit(0);
}

// Run if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dryRun = args.includes('--dry-run');
  const typeIdx = args.indexOf('--type');
  const cancerTypeFilter = typeIdx >= 0 ? args[typeIdx + 1] : null;

  (async () => {
    try {
      // Load current data asynchronously
      const currentData = await loadCurrentFAQDataAsync();

      const result = await refreshFAQ({
        dryRun,
        cancerTypeFilter,
        _currentData: currentData, // pass pre-loaded data
      });

      console.log('\n' + result.summary);
      console.log(`\nStats: ${result.stats.generated} generated, ${result.stats.skipped} skipped, ${result.stats.errors} errors`);

      process.exit(result.stats.errors > 0 ? 1 : 0);
    } catch (error) {
      console.error('Fatal error:', error.message);
      process.exit(1);
    }
  })();
}

export default { refreshFAQ };
