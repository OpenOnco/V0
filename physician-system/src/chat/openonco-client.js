/**
 * OpenOnco API Client
 * Fetches MRD test data from the public OpenOnco API and formats it
 * for injection into physician system LLM prompts.
 *
 * In-memory cache with 1-hour TTL. No new dependencies (uses native fetch).
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('openonco-client');

const OPENONCO_API = process.env.OPENONCO_API_URL || 'https://openonco.org/api/v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Module-level cache
let cachedTests = null;
let cacheTimestamp = 0;

/**
 * Fetch all MRD tests from OpenOnco API.
 * Returns cached data if fresh, otherwise fetches and caches.
 * On error, returns stale cache or empty array.
 */
export async function fetchMrdTests() {
  const now = Date.now();
  if (cachedTests && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedTests;
  }

  try {
    const res = await fetch(`${OPENONCO_API}/tests?category=mrd`);
    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }
    const json = await res.json();
    const tests = json.data || json.tests || json;
    cachedTests = Array.isArray(tests) ? tests : [];
    cacheTimestamp = now;
    logger.info('Fetched MRD tests from OpenOnco', { count: cachedTests.length });
    return cachedTests;
  } catch (err) {
    logger.warn('OpenOnco API fetch failed', { error: err.message });
    // Return stale cache if available, otherwise empty array
    return cachedTests || [];
  }
}

/**
 * Known MRD test name aliases for fuzzy matching.
 * Maps common variations → canonical names as they appear in the API.
 */
const TEST_ALIASES = {
  'guardant reveal': 'Reveal MRD',
  'reveal': 'Reveal MRD',
  'signatera': 'Signatera',
  'foundationone tracker': 'FoundationOne Tracker',
  'f1 tracker': 'FoundationOne Tracker',
  'radar': 'RaDaR',
  'navdx': 'NavDx',
  'clonosequence': 'clonoSEQ',
  'clonoseq': 'clonoSEQ',
  'haystack': 'Haystack MRD',
  'mrd-edge': 'MRD-EDGE',
  'phased': 'PhasED-Seq',
  'phased-seq': 'PhasED-Seq',
  'tumornext mrd': 'TumorNext-MRD',
  'resolution ctdx': 'Resolution ctDx Lung MRD',
};

/**
 * Look up tests by name from the cached MRD test list.
 * Uses case-insensitive substring matching with alias expansion.
 * @param {string[]} testNames - Test names from intent extraction
 * @returns {object[]} Matched test objects
 */
export async function lookupTests(testNames) {
  if (!testNames || testNames.length === 0) return [];

  const allTests = await fetchMrdTests();
  if (allTests.length === 0) return [];

  const matched = [];
  const matchedIds = new Set();

  for (const queryName of testNames) {
    const lower = queryName.toLowerCase().trim();

    // Try alias first
    const canonical = TEST_ALIASES[lower];
    const canonicalLower = canonical ? canonical.toLowerCase() : null;

    for (const test of allTests) {
      if (matchedIds.has(test.id)) continue;

      const testNameLower = (test.name || '').toLowerCase();
      const fullNameLower = `${(test.vendor || '')} ${test.name || ''}`.toLowerCase();

      const isMatch =
        // Direct case-insensitive substring match on test name
        testNameLower.includes(lower) ||
        lower.includes(testNameLower) ||
        // Alias match — canonical name substring of test name
        (canonicalLower && testNameLower.includes(canonicalLower)) ||
        // Query matches "vendor + test name" combo (e.g., "guardant reveal" in "guardant health reveal mrd")
        fullNameLower.includes(lower);

      if (isMatch) {
        matched.push(test);
        matchedIds.add(test.id);
      }
    }
  }

  logger.info('Test lookup results', {
    queried: testNames,
    matched: matched.map(t => t.name),
  });

  return matched;
}

/**
 * Format private payer coverage into a compact string.
 */
function formatPrivatePayers(privatePayers) {
  if (!privatePayers || typeof privatePayers !== 'object') return '';

  const parts = [];
  for (const [payerId, info] of Object.entries(privatePayers)) {
    if (!info || !info.status) continue;
    const name = payerId.charAt(0).toUpperCase() + payerId.slice(1);
    let entry = `${name} ${info.status}`;
    if (info.policy) entry += ` (${info.policy})`;
    if (info.coveredIndications?.length > 0) {
      entry += ` — ${info.coveredIndications.join(', ')}`;
    }
    parts.push(entry);
  }
  return parts.join(' | ');
}

/**
 * Format a single test object into a compact, prompt-friendly block.
 * Extracts physician-relevant fields only.
 */
function formatSingleTest(test) {
  const lines = [];

  // Header
  lines.push(`TEST DATA: ${test.name} (${test.vendor || 'Unknown vendor'})`);

  // Approach & tissue
  const approachParts = [];
  if (test.approach) approachParts.push(test.approach);
  if (test.variantsTracked) approachParts.push(`${test.variantsTracked} variants tracked`);
  if (test.requiresTumorTissue) approachParts.push(`Tissue required: ${test.requiresTumorTissue}`);
  if (approachParts.length > 0) lines.push(`Approach: ${approachParts.join(' | ')}`);

  // Turnaround time
  const tatParts = [];
  if (test.initialTat) tatParts.push(`${test.initialTat}d initial`);
  if (test.followUpTat) tatParts.push(`${test.followUpTat}d monitoring`);
  if (tatParts.length > 0) {
    let tatLine = `TAT: ${tatParts.join(', ')}`;
    if (test.sampleVolumeMl) tatLine += ` | Sample: ${test.sampleVolumeMl}mL blood`;
    if (test.sampleTubeType) tatLine += `, ${test.sampleTubeCount || 2}x ${test.sampleTubeType}`;
    lines.push(tatLine);
  }

  // Performance
  const perfParts = [];
  if (test.lod) perfParts.push(`LOD: ${test.lod}`);
  if (test.sensitivity != null) {
    let sensStr = `Sensitivity: ${test.sensitivity}%`;
    if (test.sensitivityNotes) sensStr += ` (${test.sensitivityNotes.substring(0, 120)})`;
    perfParts.push(sensStr);
  }
  if (test.specificity != null) perfParts.push(`Specificity: ${test.specificity}%`);
  if (perfParts.length > 0) lines.push(perfParts.join(' | '));

  // Landmark vs longitudinal
  if (test.landmarkSensitivity != null || test.longitudinalSensitivity != null) {
    const parts = [];
    if (test.landmarkSensitivity != null) parts.push(`Landmark: ${test.landmarkSensitivity}%`);
    if (test.longitudinalSensitivity != null) parts.push(`Longitudinal: ${test.longitudinalSensitivity}%`);
    lines.push(`Serial monitoring: ${parts.join(' → ')}`);
  }

  // Lead time
  if (test.leadTimeVsImaging) {
    let leadStr = `Lead time vs imaging: ${test.leadTimeVsImaging} days`;
    if (test.leadTimeVsImagingNotes) leadStr += ` (${test.leadTimeVsImagingNotes.substring(0, 80)})`;
    lines.push(leadStr);
  }

  // Regulatory
  if (test.fdaStatus) lines.push(`FDA: ${test.fdaStatus}`);
  if (test.cptCodes) lines.push(`CPT: ${test.cptCodes}${test.codeType ? ` (${test.codeType})` : ''}`);

  // Medicare coverage
  const ccr = test.coverageCrossReference;
  if (ccr?.medicare) {
    const mc = ccr.medicare;
    let mcLine = `Medicare: ${mc.status}`;
    if (mc.policies?.length > 0) mcLine += ` under ${mc.policies.join(', ')}`;
    if (mc.indications?.length > 0) mcLine += ` — ${mc.indications.join('; ')}`;
    if (mc.rate) mcLine += ` (${mc.rate})`;
    lines.push(mcLine);
  } else if (test.medicareStatus) {
    lines.push(`Medicare: ${test.medicareStatus}${test.reimbursementNote ? ` — ${test.reimbursementNote.substring(0, 120)}` : ''}`);
  }

  // Commercial payer coverage
  if (ccr?.privatePayers) {
    const payerStr = formatPrivatePayers(ccr.privatePayers);
    if (payerStr) lines.push(`Commercial: ${payerStr}`);
  } else if (test.commercialPayers?.length > 0) {
    lines.push(`Commercial payers: ${test.commercialPayers.join(', ')}`);
    if (test.commercialPayersNotes) lines.push(`Coverage notes: ${test.commercialPayersNotes.substring(0, 150)}`);
  }

  // Validation & evidence
  const evidParts = [];
  if (test.clinicalTrials) evidParts.push(test.clinicalTrials.substring(0, 120));
  if (test.numPublications) evidParts.push(`${test.numPublications}${test.numPublicationsPlus ? '+' : ''} publications`);
  if (evidParts.length > 0) lines.push(`Validation: ${evidParts.join(' | ')}`);

  // NCCN guidelines
  if (test.nccnNamedInGuidelines && test.nccnGuidelineReference) {
    lines.push(`Guidelines: ${test.nccnGuidelineReference}`);
  }

  // Cancer types
  if (test.cancerTypes?.length > 0) {
    lines.push(`Cancer types: ${test.cancerTypes.join(', ')}`);
  }

  // Clinical settings
  if (test.clinicalSettings?.length > 0) {
    lines.push(`Clinical settings: ${test.clinicalSettings.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Format matched test objects into a compact prompt-friendly string.
 * @param {object[]} tests - Array of test objects from lookupTests()
 * @returns {string} Formatted context string for LLM prompt injection
 */
export function formatTestContext(tests) {
  if (!tests || tests.length === 0) return '';
  return tests.map(formatSingleTest).join('\n\n');
}
