/**
 * Coverage Bridge Crawler
 *
 * Reads MRD and TDS test coverage data from the OpenOnco public API and
 * creates/updates guidance items in the physician-system database so
 * physicians can ask about insurance coverage and get accurate,
 * test-specific answers via the RAG pipeline.
 *
 * Each test with coverage data produces ONE guidance item that summarizes
 * the full payer landscape (Medicare + commercial). The full_text_excerpt
 * is keyword-rich for vector search so queries like "is Signatera covered
 * by Aetna?" or "Medicare LCD for MRD testing" surface the right item.
 *
 * Usage:
 *   node src/cli.js coverage-bridge
 */

import { query } from '../db/client.js';
import { createLogger } from '../utils/logger.js';
import { embedGuidanceItem } from '../embeddings/mrd-embedder.js';

const logger = createLogger('coverage-bridge');

const OPENONCO_API = 'https://openonco.org/api/v1';

// ─── API helpers ────────────────────────────────────────────────────────────

/**
 * Fetch JSON from the OpenOnco public API.
 * @param {string} path - API path (e.g. '/tests?category=MRD')
 * @returns {Promise<any>}
 */
async function fetchAPI(path) {
  const url = `${OPENONCO_API}${path}`;
  logger.debug('Fetching OpenOnco API', { url });

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`OpenOnco API ${res.status}: ${res.statusText} (${url})`);
  }

  return res.json();
}

/**
 * Fetch MRD and TDS tests that have any coverage data.
 * @returns {Promise<Object[]>} Array of test objects with coverage fields
 */
async function fetchTestsWithCoverage() {
  const [mrdRes, tdsRes] = await Promise.all([
    fetchAPI('/tests?category=MRD'),
    fetchAPI('/tests?category=TDS'),
  ]);

  // The API may return { tests: [...] } or an array directly
  const mrdTests = Array.isArray(mrdRes) ? mrdRes : (mrdRes.tests || []);
  const tdsTests = Array.isArray(tdsRes) ? tdsRes : (tdsRes.tests || []);

  const allTests = [...mrdTests, ...tdsTests];

  // Keep only tests that have meaningful coverage data
  return allTests.filter(t =>
    (t.commercialPayers && t.commercialPayers.length > 0) ||
    (t.coverageCrossReference && Object.keys(t.coverageCrossReference).length > 0)
  );
}

// ─── Content builders ───────────────────────────────────────────────────────

/**
 * Normalise a payer status string to an upper-case canonical form.
 * @param {string} raw
 * @returns {string}
 */
function normalizeStatus(raw) {
  if (!raw) return 'UNKNOWN';
  const s = raw.toUpperCase().trim();
  if (s.includes('COVER') && !s.includes('NOT')) return 'COVERED';
  if (s.includes('PARTIAL')) return 'PARTIAL';
  if (s.includes('EXPERIMENT')) return 'EXPERIMENTAL';
  if (s.includes('NOT_COVER') || s.includes('NOT COVER')) return 'NOT_COVERED';
  return s;
}

/**
 * Build a plain-English summary (2-3 sentences) for the guidance item.
 * @param {Object} test - OpenOnco test object
 * @param {Object} ccr  - coverageCrossReference or {}
 * @param {Object} counts - { covered, partial, experimental, notCovered }
 * @returns {string}
 */
function buildSummary(test, ccr, counts) {
  const parts = [];

  // Medicare sentence
  if (ccr.medicare) {
    const m = ccr.medicare;
    const status = normalizeStatus(m.status);
    if (status === 'COVERED') {
      const policies = m.policies?.join(', ') || '';
      const indications = m.indications?.join(', ') || '';
      parts.push(
        `${test.name} (${test.vendor}) has Medicare coverage` +
        (policies ? ` through MolDX LCD ${policies}` : '') +
        (indications ? ` for ${indications}` : '') +
        '.'
      );
    } else {
      parts.push(
        `${test.name} (${test.vendor}) Medicare status: ${status.toLowerCase()}.`
      );
    }
  } else {
    parts.push(
      `${test.name} (${test.vendor}) does not have documented Medicare coverage data in OpenOnco.`
    );
  }

  // Commercial sentence
  const totalPayers = counts.covered + counts.partial + counts.experimental + counts.notCovered;
  if (totalPayers > 0) {
    const positiveParts = [];
    if (counts.covered > 0) positiveParts.push(`${counts.covered} covered`);
    if (counts.partial > 0) positiveParts.push(`${counts.partial} partial/conditional`);

    const negativeParts = [];
    if (counts.experimental > 0) negativeParts.push(`${counts.experimental} experimental`);
    if (counts.notCovered > 0) negativeParts.push(`${counts.notCovered} not covered`);

    let sentence = `Commercial coverage is mixed: `;
    const allParts = [];
    if (positiveParts.length > 0) allParts.push(positiveParts.join(' and '));
    if (negativeParts.length > 0) allParts.push(negativeParts.join(' and '));
    sentence += allParts.join('; ') + ` across ${totalPayers} reviewed payers.`;
    parts.push(sentence);
  }

  // Non-coverage mention
  if (test.commercialPayersNonCoverage?.length > 0) {
    parts.push(
      `${test.commercialPayersNonCoverage.join(', ')} explicitly do not cover this test.`
    );
  }

  return parts.join(' ');
}

/**
 * Build the key_findings JSON array.
 * @param {Object} test
 * @param {Object} ccr
 * @returns {Object[]}
 */
function buildKeyFindings(test, ccr) {
  const findings = [];

  // Medicare finding
  if (ccr.medicare) {
    const m = ccr.medicare;
    const status = normalizeStatus(m.status);
    findings.push({
      finding: `Medicare ${status.toLowerCase()}` +
        (m.policies?.length ? ` through LCD ${m.policies.join(', ')}` : '') +
        (m.indications?.length ? ` for ${m.indications.join(', ')}` : ''),
      implication: status === 'COVERED'
        ? `Patients with Medicare may have coverage${m.indications?.length ? ` for ${m.indications[0]}` : ''}`
        : 'Medicare patients should verify coverage with their MAC',
    });
  }

  // Private payer findings
  if (ccr.privatePayers) {
    for (const [payerId, payer] of Object.entries(ccr.privatePayers)) {
      const status = normalizeStatus(payer.status);
      const policyRef = payer.policy ? ` (${payer.policy})` : '';

      let implication;
      switch (status) {
        case 'COVERED':
          implication = `${payerId} patients have coverage` +
            (payer.coveredIndications?.length ? ` for ${payer.coveredIndications.join(', ')}` : '');
          break;
        case 'PARTIAL':
          implication = `${payerId} patients may qualify with prior authorization for specific indications`;
          break;
        case 'EXPERIMENTAL':
          implication = `${payerId} patients unlikely to get routine coverage`;
          break;
        case 'NOT_COVERED':
          implication = `${payerId} patients likely need appeal or alternative payment`;
          break;
        default:
          implication = `Check ${payerId} policy for current status`;
      }

      findings.push({
        finding: `${payerId}: ${status}${policyRef}` +
          (payer.coveredIndications?.length ? ` — ${payer.coveredIndications.join(', ')}` : ''),
        implication,
      });
    }
  }

  // Simple commercial payers (not in detailed model)
  if (test.commercialPayers?.length > 0 && !ccr.privatePayers) {
    findings.push({
      finding: `Commercial payers listing coverage: ${test.commercialPayers.join(', ')}`,
      implication: 'Patients should verify specific conditions with their insurer',
    });
  }

  // Non-coverage findings
  if (test.commercialPayersNonCoverage?.length > 0) {
    for (const payer of test.commercialPayersNonCoverage) {
      findings.push({
        finding: `${payer} does not cover this test`,
        implication: `${payer} patients likely need appeal or alternative payment`,
      });
    }
  }

  return findings;
}

/**
 * Build the full_text_excerpt. This is the primary text for RAG vector
 * search, so it must be keyword-rich with payer names, policy numbers,
 * status terms, test names, and common physician queries.
 *
 * @param {Object} test
 * @param {Object} ccr
 * @returns {string}
 */
function buildFullTextExcerpt(test, ccr) {
  const lines = [];

  lines.push(`COVERAGE SUMMARY: ${test.name} (${test.vendor}) ${test.category} Test`);
  lines.push('');

  // Medicare block
  if (ccr.medicare) {
    const m = ccr.medicare;
    const status = normalizeStatus(m.status);
    let medicareLine = `MEDICARE: ${status}`;
    if (m.policies?.length) medicareLine += ` — LCD ${m.policies.join(', ')} (MolDX)`;
    medicareLine += '.';
    lines.push(medicareLine);

    if (m.indications?.length) {
      lines.push(`Covered indications: ${m.indications.join('; ')}.`);
    }
    if (m.rate) lines.push(`Reimbursement rate: ${m.rate}.`);
    if (m.codes?.length) lines.push(`CPT/PLA codes: ${m.codes.join(', ')}.`);
    if (m.notes) lines.push(`Notes: ${m.notes}`);
    lines.push('');
  } else {
    lines.push('MEDICARE: No documented coverage data.');
    lines.push('');
  }

  // Commercial payers block
  lines.push('COMMERCIAL PAYERS:');

  // Detailed model payers
  if (ccr.privatePayers) {
    for (const [payerId, payer] of Object.entries(ccr.privatePayers)) {
      const status = normalizeStatus(payer.status);
      let payerLine = `- ${payerId}: ${status}`;
      if (payer.policy) payerLine += `. Policy: ${payer.policy}`;
      if (payer.policyUrl) payerLine += ` (${payer.policyUrl})`;
      payerLine += '.';
      lines.push(payerLine);

      if (payer.coveredIndications?.length) {
        lines.push(`  Covered for: ${payer.coveredIndications.join('; ')}.`);
      }
      if (payer.notes) lines.push(`  Notes: ${payer.notes}`);
      if (payer.lastReviewed) lines.push(`  Last reviewed: ${payer.lastReviewed}.`);
    }
  }

  // Simple model payers (may overlap with detailed; include for keyword coverage)
  if (test.commercialPayers?.length > 0) {
    if (!ccr.privatePayers) {
      lines.push(`Payers with coverage: ${test.commercialPayers.join(', ')}.`);
    }
    if (test.commercialPayersNotes) {
      lines.push(`Coverage notes: ${test.commercialPayersNotes}`);
    }
    if (test.commercialPayersCitations) {
      lines.push(`Sources: ${test.commercialPayersCitations}`);
    }
  }

  // Non-coverage
  if (test.commercialPayersNonCoverage?.length > 0) {
    lines.push('');
    lines.push('NON-COVERAGE:');
    for (const payer of test.commercialPayersNonCoverage) {
      lines.push(`- ${payer}: NOT COVERED.`);
    }
    if (test.commercialPayersNonCoverageNotes) {
      lines.push(`Notes: ${test.commercialPayersNonCoverageNotes}`);
    }
  }

  // Analysis block
  if (ccr.analysis) {
    lines.push('');
    lines.push('COVERAGE ANALYSIS:');
    if (ccr.analysis.vendorClaimAccuracy) {
      lines.push(`Vendor claim accuracy: ${ccr.analysis.vendorClaimAccuracy}`);
    }
    if (ccr.analysis.patientGuidance) {
      lines.push(`Patient guidance: ${ccr.analysis.patientGuidance}`);
    }
    if (ccr.analysis.keyInsight) {
      lines.push(`Key insight: ${ccr.analysis.keyInsight}`);
    }
  }

  // Keyword footer for improved vector search recall
  lines.push('');
  lines.push(
    `Keywords: ${test.name}, ${test.vendor}, insurance coverage, payer policy, ` +
    `prior authorization, medical necessity, reimbursement, ` +
    `liquid biopsy, ctDNA, circulating tumor DNA, ` +
    `${test.category === 'MRD' ? 'MRD, minimal residual disease, molecular residual disease, surveillance, recurrence monitoring' : 'companion diagnostic, treatment selection, targeted therapy'}`
  );

  return lines.join('\n');
}

/**
 * Build the decision_context JSONB payload.
 * @param {Object} test
 * @param {Object} ccr
 * @param {Object} counts
 * @returns {Object}
 */
function buildDecisionContext(test, ccr, counts) {
  const ctx = {
    test_id: test.id,
    test_name: test.name,
    vendor: test.vendor,
    category: test.category,
    import_source: 'coverage-bridge',
    imported_at: new Date().toISOString(),
    payer_count: {
      covered: counts.covered,
      partial: counts.partial,
      experimental: counts.experimental,
      not_covered: counts.notCovered,
    },
    payers: {},
  };

  // Medicare
  if (ccr.medicare) {
    ctx.medicare = {
      status: normalizeStatus(ccr.medicare.status),
      lcd: ccr.medicare.policies?.join(', ') || null,
      indications: ccr.medicare.indications || [],
      rate: ccr.medicare.rate || null,
    };
  }

  // Private payers
  if (ccr.privatePayers) {
    for (const [payerId, payer] of Object.entries(ccr.privatePayers)) {
      ctx.payers[payerId] = {
        status: normalizeStatus(payer.status),
        policy: payer.policy || null,
      };
    }
  }

  return ctx;
}

// ─── Cancer type mapping ────────────────────────────────────────────────────

/**
 * Map OpenOnco cancer type strings to the DB enum values used in
 * mrd_guidance_cancer_types.
 * @param {Object} test
 * @returns {string[]}
 */
function mapCancerTypes(test) {
  const raw = test.cancerTypes || test.cancerType || test.cancers || [];
  const rawList = Array.isArray(raw) ? raw : [raw];

  const mapping = {
    'colorectal': 'colorectal',
    'colon': 'colorectal',
    'rectal': 'colorectal',
    'crc': 'colorectal',
    'breast': 'breast',
    'lung': 'lung_nsclc',
    'nsclc': 'lung_nsclc',
    'bladder': 'bladder',
    'urothelial': 'bladder',
    'melanoma': 'melanoma',
    'pancreatic': 'pancreatic',
    'ovarian': 'ovarian',
    'gastric': 'gastric',
    'esophageal': 'esophageal',
    'head and neck': 'head_neck',
    'hnscc': 'head_neck',
    'myeloma': 'multiple_myeloma',
    'all': 'all',
    'cll': 'cll',
    'merkel': 'merkel_cell',
    'multi-cancer': 'multi_solid',
    'pan-cancer': 'multi_solid',
    'solid tumor': 'multi_solid',
    'multi': 'multi_solid',
  };

  const types = new Set();
  for (const c of rawList) {
    const key = (c || '').toLowerCase().trim();
    if (mapping[key]) {
      types.add(mapping[key]);
    } else {
      // Try substring matching
      for (const [pattern, mapped] of Object.entries(mapping)) {
        if (key.includes(pattern)) {
          types.add(mapped);
        }
      }
    }
  }

  return types.size > 0 ? [...types] : ['multi_solid'];
}

// ─── Payer counting ─────────────────────────────────────────────────────────

/**
 * Count payers by status bucket.
 * @param {Object} test
 * @param {Object} ccr
 * @returns {{ covered: number, partial: number, experimental: number, notCovered: number }}
 */
function countPayerStatuses(test, ccr) {
  const counts = { covered: 0, partial: 0, experimental: 0, notCovered: 0 };

  if (ccr.privatePayers) {
    for (const payer of Object.values(ccr.privatePayers)) {
      const s = normalizeStatus(payer.status);
      if (s === 'COVERED') counts.covered++;
      else if (s === 'PARTIAL') counts.partial++;
      else if (s === 'EXPERIMENTAL') counts.experimental++;
      else if (s === 'NOT_COVERED') counts.notCovered++;
    }
  }

  // Count simple-model non-coverage payers if not already in detailed model
  if (test.commercialPayersNonCoverage?.length > 0 && !ccr.privatePayers) {
    counts.notCovered += test.commercialPayersNonCoverage.length;
  }

  // Count simple-model covered payers if no detailed model
  if (test.commercialPayers?.length > 0 && !ccr.privatePayers) {
    counts.partial += test.commercialPayers.length; // conservative: treat as partial
  }

  return counts;
}

// ─── Database operations ────────────────────────────────────────────────────

/**
 * Upsert a coverage guidance item and populate junction tables.
 * @param {Object} test
 * @returns {Promise<{ id: number, isNew: boolean }>}
 */
async function upsertCoverageItem(test) {
  const ccr = test.coverageCrossReference || {};
  const counts = countPayerStatuses(test, ccr);

  const sourceId = `coverage-${test.id}`;
  const sourceUrl = `${OPENONCO_API}/tests/${test.id}`;
  const title = `${test.name} (${test.vendor}) — Insurance Coverage Summary`;

  const summary = buildSummary(test, ccr, counts);
  const keyFindings = buildKeyFindings(test, ccr);
  const fullTextExcerpt = buildFullTextExcerpt(test, ccr);
  const decisionContext = buildDecisionContext(test, ccr, counts);

  // Upsert guidance item
  const result = await query(
    `INSERT INTO mrd_guidance_items (
      source_type, source_id, source_url, title,
      evidence_type, relevance_score, summary, key_findings,
      full_text_excerpt, decision_context
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (source_type, source_id) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      key_findings = EXCLUDED.key_findings,
      full_text_excerpt = EXCLUDED.full_text_excerpt,
      decision_context = EXCLUDED.decision_context,
      updated_at = NOW()
    RETURNING id, (xmax = 0) as is_new`,
    [
      'coverage_policy',
      sourceId,
      sourceUrl,
      title,
      'coverage_policy',
      7,
      summary,
      JSON.stringify(keyFindings),
      fullTextExcerpt,
      JSON.stringify(decisionContext),
    ]
  );

  const itemId = result.rows[0].id;
  const isNew = result.rows[0].is_new;

  // Populate cancer types
  const cancerTypes = mapCancerTypes(test);
  for (const ct of cancerTypes) {
    await query(
      `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [itemId, ct]
    );
  }

  // Populate clinical settings
  const settings = test.category === 'MRD'
    ? ['surveillance', 'post_surgery']
    : ['treatment_selection'];

  for (const setting of settings) {
    await query(
      `INSERT INTO mrd_guidance_clinical_settings (guidance_id, clinical_setting)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [itemId, setting]
    );
  }

  return { id: itemId, isNew };
}

/**
 * Create a crawler run record in mrd_crawler_runs.
 * @param {string} mode
 * @param {Object} config
 * @returns {Promise<number>} run ID
 */
async function createCrawlerRun(mode, config = {}) {
  const result = await query(
    `INSERT INTO mrd_crawler_runs (crawler_name, mode, started_at, status, config)
     VALUES ($1, $2, NOW(), 'running', $3)
     RETURNING id`,
    ['coverage-bridge', mode, JSON.stringify(config)]
  );
  return result.rows[0].id;
}

/**
 * Finalise a crawler run with results.
 * @param {number} runId
 * @param {Object} results
 */
async function finishCrawlerRun(runId, results) {
  await query(
    `UPDATE mrd_crawler_runs SET
       completed_at = NOW(),
       status = $2,
       items_found = $3,
       items_new = $4,
       items_duplicate = $5,
       error_message = $6,
       duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
     WHERE id = $1`,
    [
      runId,
      results.status || 'completed',
      results.itemsFound || 0,
      results.itemsNew || 0,
      results.itemsUpdated || 0,
      results.errorMessage || null,
    ]
  );
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Run the coverage bridge crawler.
 *
 * Fetches MRD and TDS tests from the OpenOnco public API, filters to those
 * with coverage data, and upserts coverage summary guidance items into the
 * physician-system database. New or updated items are re-embedded for vector
 * search.
 *
 * @returns {Promise<{
 *   success: boolean,
 *   testsProcessed: number,
 *   itemsCreated: number,
 *   itemsUpdated: number,
 *   payersTotal: number,
 *   errors: string[]
 * }>}
 */
export async function runCoverageBridge() {
  logger.info('Starting coverage bridge crawler');

  const errors = [];
  let runId = null;

  try {
    runId = await createCrawlerRun('sync', { source: 'openonco-api' });
  } catch (err) {
    logger.warn('Failed to create crawler run record', { error: err.message });
  }

  let testsProcessed = 0;
  let itemsCreated = 0;
  let itemsUpdated = 0;
  let payersTotal = 0;

  try {
    // 1. Fetch tests with coverage data
    logger.info('Fetching tests from OpenOnco API');
    const tests = await fetchTestsWithCoverage();
    logger.info('Tests with coverage data', { count: tests.length });

    // 2. Process each test
    for (const test of tests) {
      try {
        const { id: itemId, isNew } = await upsertCoverageItem(test);

        testsProcessed++;
        if (isNew) {
          itemsCreated++;
          logger.info('Created coverage item', { testId: test.id, itemId, name: test.name });
        } else {
          itemsUpdated++;
          logger.debug('Updated coverage item', { testId: test.id, itemId, name: test.name });
        }

        // Count payers for stats
        const ccr = test.coverageCrossReference || {};
        if (ccr.privatePayers) payersTotal += Object.keys(ccr.privatePayers).length;
        if (test.commercialPayers) payersTotal += test.commercialPayers.length;

        // 3. Trigger embedding for new or updated items
        try {
          await embedGuidanceItem(itemId);
          logger.debug('Embedded coverage item', { itemId });
        } catch (embedErr) {
          // Embedding failure is non-fatal; items can be embedded later
          logger.warn('Failed to embed coverage item', {
            itemId,
            error: embedErr.message,
          });
        }
      } catch (testErr) {
        const msg = `Failed to process test ${test.id} (${test.name}): ${testErr.message}`;
        logger.error(msg);
        errors.push(msg);
      }
    }

    // 4. Finalise crawler run
    if (runId) {
      await finishCrawlerRun(runId, {
        status: errors.length > 0 ? 'completed_with_errors' : 'completed',
        itemsFound: tests.length,
        itemsNew: itemsCreated,
        itemsUpdated,
      });
    }

    logger.info('Coverage bridge complete', {
      testsProcessed,
      itemsCreated,
      itemsUpdated,
      payersTotal,
      errors: errors.length,
    });

    return {
      success: errors.length === 0,
      testsProcessed,
      itemsCreated,
      itemsUpdated,
      payersTotal,
      errors,
    };
  } catch (fatalErr) {
    logger.error('Coverage bridge failed', { error: fatalErr.message });

    if (runId) {
      await finishCrawlerRun(runId, {
        status: 'failed',
        itemsFound: testsProcessed,
        itemsNew: itemsCreated,
        errorMessage: fatalErr.message,
      }).catch(() => {});
    }

    return {
      success: false,
      testsProcessed,
      itemsCreated,
      itemsUpdated,
      payersTotal,
      errors: [...errors, fatalErr.message],
    };
  }
}

export default { runCoverageBridge };
