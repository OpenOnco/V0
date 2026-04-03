/**
 * Unit tests for api/evidence-query.js
 *
 * Tests the deterministic query engine, sorting, keyword fallback,
 * and stats computation. Claude API calls are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// We test the internal functions by importing the module. Since the handler
// is the default export and internal functions aren't exported, we replicate
// the core logic here (same as the actual file) to test in isolation.
// ---------------------------------------------------------------------------

// Replicated from api/evidence-query.js — queryEvidence
function queryEvidence(claims, query) {
  return claims.filter(claim => {
    if (query.cancer && claim.scope.cancer !== query.cancer && claim.scope.cancer !== 'cross-cancer') return false;
    if (query.stages?.length && claim.scope.stages?.length && !query.stages.some(s => claim.scope.stages.includes(s))) return false;
    if (query.test_ids?.length) {
      const isTestSpecific = claim.scope.tests?.some(t => query.test_ids.includes(t.test_id));
      const isTestAgnostic = !claim.scope.tests?.length;
      if (!isTestSpecific && !isTestAgnostic) return false;
    }
    if (query.claim_types?.length && !query.claim_types.includes(claim.type)) return false;
    if (query.keywords?.length) {
      const text = JSON.stringify(claim).toLowerCase();
      if (!query.keywords.some(kw => text.includes(kw.toLowerCase()))) return false;
    }
    return true;
  });
}

// Replicated sortClaims
const TYPE_ORDER = {
  'guideline_recommendation': 0,
  'trial_result': 1,
  'diagnostic_performance': 2,
  'clinical_utility': 3,
  'methodology_note': 4,
};

function sortClaims(claims) {
  return [...claims].sort((a, b) => {
    const typeA = TYPE_ORDER[a.type] ?? 99;
    const typeB = TYPE_ORDER[b.type] ?? 99;
    if (typeA !== typeB) return typeA - typeB;
    if (a.type === 'trial_result' && b.type === 'trial_result') {
      const nA = a.finding?.n ?? 0;
      const nB = b.finding?.n ?? 0;
      if (nA !== nB) return nB - nA;
    }
    const yearA = a.source?.year ?? 0;
    const yearB = b.source?.year ?? 0;
    return yearB - yearA;
  });
}

// Replicated keyword fallback
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'to', 'of', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'and', 'but', 'or',
  'if', 'what', 'which', 'who', 'this', 'that', 'about',
]);

function keywordFallback(claims, question) {
  const words = question.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  if (words.length === 0) return claims;
  return claims.filter(claim => {
    const text = JSON.stringify(claim).toLowerCase();
    return words.some(w => text.includes(w));
  });
}

// Replicated computeStats
function computeStats(claims, query) {
  let testSpecificCount = 0;
  let testAgnosticCount = 0;
  const sourceSet = new Set();
  for (const claim of claims) {
    if (query.test_ids?.length) {
      const isTestSpecific = claim.scope.tests?.some(t => query.test_ids.includes(t.test_id));
      if (isTestSpecific) testSpecificCount++;
      else testAgnosticCount++;
    } else {
      if (claim.scope.tests?.length) testSpecificCount++;
      else testAgnosticCount++;
    }
    if (claim.source?.pmid) sourceSet.add(claim.source.pmid);
    else if (claim.source?.title) sourceSet.add(claim.source.title);
  }
  return { testSpecificCount, testAgnosticCount, totalSources: sourceSet.size };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeClaim(overrides = {}) {
  return {
    id: overrides.id || 'TEST-001',
    type: overrides.type || 'trial_result',
    source: {
      pmid: overrides.pmid || '12345678',
      title: overrides.title || 'Test study',
      year: overrides.year || 2023,
      ...(overrides.source || {}),
    },
    scope: {
      cancer: overrides.cancer || 'colorectal',
      stages: overrides.stages || ['II'],
      tests: overrides.tests || [{ test_id: 'mrd-7', test_name: 'Signatera' }],
      ...(overrides.scope || {}),
    },
    finding: {
      description: overrides.description || 'Test finding',
      n: overrides.n || 100,
      ...(overrides.finding || {}),
    },
  };
}

const SAMPLE_CLAIMS = [
  makeClaim({ id: 'CRC-001', cancer: 'colorectal', stages: ['II'], type: 'trial_result', n: 455, year: 2022, pmid: '111' }),
  makeClaim({ id: 'CRC-002', cancer: 'colorectal', stages: ['III'], type: 'guideline_recommendation', n: 0, year: 2024, pmid: '222' }),
  makeClaim({ id: 'BRE-001', cancer: 'breast', stages: ['I', 'II'], type: 'trial_result', n: 200, year: 2023, pmid: '333', tests: [{ test_id: 'mrd-6', test_name: 'Guardant Reveal' }] }),
  makeClaim({ id: 'CROSS-001', cancer: 'cross-cancer', stages: [], type: 'diagnostic_performance', n: 0, year: 2021, pmid: '444', tests: [] }),
  makeClaim({ id: 'CRC-003', cancer: 'colorectal', stages: ['II'], type: 'trial_result', n: 100, year: 2020, pmid: '555', description: 'adjuvant chemotherapy benefit' }),
  makeClaim({ id: 'LUNG-001', cancer: 'lung', stages: ['III'], type: 'clinical_utility', n: 0, year: 2024, pmid: '666', tests: [{ test_id: 'mrd-8', test_name: 'FoundationOne Tracker' }] }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('queryEvidence', () => {
  it('filters by cancer type', () => {
    const result = queryEvidence(SAMPLE_CLAIMS, { cancer: 'colorectal' });
    // Should include colorectal + cross-cancer
    expect(result.map(c => c.id)).toContain('CRC-001');
    expect(result.map(c => c.id)).toContain('CRC-002');
    expect(result.map(c => c.id)).toContain('CROSS-001');
    expect(result.map(c => c.id)).not.toContain('BRE-001');
    expect(result.map(c => c.id)).not.toContain('LUNG-001');
  });

  it('filters by stage', () => {
    const result = queryEvidence(SAMPLE_CLAIMS, { stages: ['II'] });
    const ids = result.map(c => c.id);
    expect(ids).toContain('CRC-001');
    expect(ids).toContain('BRE-001'); // has stages ['I', 'II']
    expect(ids).toContain('CROSS-001'); // no stages = passes
    expect(ids).not.toContain('CRC-002'); // stage III only
  });

  it('filters by test_ids — includes test-specific and test-agnostic', () => {
    const result = queryEvidence(SAMPLE_CLAIMS, { test_ids: ['mrd-7'] });
    const ids = result.map(c => c.id);
    // mrd-7 claims
    expect(ids).toContain('CRC-001');
    // test-agnostic (no tests array)
    expect(ids).toContain('CROSS-001');
    // mrd-6 claim excluded
    expect(ids).not.toContain('BRE-001');
  });

  it('filters by claim_types', () => {
    const result = queryEvidence(SAMPLE_CLAIMS, { claim_types: ['guideline_recommendation'] });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('CRC-002');
  });

  it('filters by keywords', () => {
    const result = queryEvidence(SAMPLE_CLAIMS, { keywords: ['adjuvant'] });
    const ids = result.map(c => c.id);
    expect(ids).toContain('CRC-003');
  });

  it('returns all claims when query is empty', () => {
    const result = queryEvidence(SAMPLE_CLAIMS, {});
    expect(result).toHaveLength(SAMPLE_CLAIMS.length);
  });

  it('combines multiple filters (AND logic)', () => {
    const result = queryEvidence(SAMPLE_CLAIMS, {
      cancer: 'colorectal',
      stages: ['II'],
      test_ids: ['mrd-7'],
    });
    const ids = result.map(c => c.id);
    expect(ids).toContain('CRC-001');
    expect(ids).toContain('CRC-003');
    expect(ids).toContain('CROSS-001'); // cross-cancer + no stages + test-agnostic
    expect(ids).not.toContain('CRC-002'); // stage III
    expect(ids).not.toContain('BRE-001'); // breast + mrd-6
  });
});

describe('sortClaims', () => {
  it('puts guidelines first', () => {
    const sorted = sortClaims(SAMPLE_CLAIMS);
    expect(sorted[0].type).toBe('guideline_recommendation');
  });

  it('sorts trial_results by sample size descending', () => {
    const trials = sortClaims(SAMPLE_CLAIMS).filter(c => c.type === 'trial_result');
    expect(trials[0].finding.n).toBeGreaterThanOrEqual(trials[1].finding.n);
    if (trials.length > 2) {
      expect(trials[1].finding.n).toBeGreaterThanOrEqual(trials[2].finding.n);
    }
  });

  it('sorts within same type by year descending', () => {
    const claims = [
      makeClaim({ id: 'A', type: 'diagnostic_performance', year: 2020 }),
      makeClaim({ id: 'B', type: 'diagnostic_performance', year: 2024 }),
      makeClaim({ id: 'C', type: 'diagnostic_performance', year: 2022 }),
    ];
    const sorted = sortClaims(claims);
    expect(sorted.map(c => c.id)).toEqual(['B', 'C', 'A']);
  });

  it('follows full type order: guideline > trial > diagnostic > clinical > methodology', () => {
    const claims = [
      makeClaim({ id: 'M', type: 'methodology_note' }),
      makeClaim({ id: 'T', type: 'trial_result' }),
      makeClaim({ id: 'G', type: 'guideline_recommendation' }),
      makeClaim({ id: 'D', type: 'diagnostic_performance' }),
      makeClaim({ id: 'C', type: 'clinical_utility' }),
    ];
    const sorted = sortClaims(claims);
    expect(sorted.map(c => c.id)).toEqual(['G', 'T', 'D', 'C', 'M']);
  });
});

describe('keywordFallback', () => {
  it('matches claims containing keywords', () => {
    const result = keywordFallback(SAMPLE_CLAIMS, 'adjuvant chemotherapy');
    expect(result.some(c => c.id === 'CRC-003')).toBe(true);
  });

  it('ignores stop words', () => {
    // "the" and "is" are stop words; "signatera" should match
    const result = keywordFallback(SAMPLE_CLAIMS, 'the is Signatera');
    expect(result.some(c => c.scope.tests?.some(t => t.test_name === 'Signatera'))).toBe(true);
  });

  it('returns all claims when only stop words', () => {
    const result = keywordFallback(SAMPLE_CLAIMS, 'the is a');
    expect(result).toHaveLength(SAMPLE_CLAIMS.length);
  });

  it('is case insensitive', () => {
    const result = keywordFallback(SAMPLE_CLAIMS, 'ADJUVANT');
    expect(result.some(c => c.id === 'CRC-003')).toBe(true);
  });
});

describe('computeStats', () => {
  it('counts test-specific vs test-agnostic when test_ids given', () => {
    const claims = [
      makeClaim({ id: 'A', tests: [{ test_id: 'mrd-7', test_name: 'Signatera' }], pmid: '1' }),
      makeClaim({ id: 'B', tests: [], pmid: '2' }),
      makeClaim({ id: 'C', tests: [{ test_id: 'mrd-6', test_name: 'Reveal' }], pmid: '3' }),
    ];
    const stats = computeStats(claims, { test_ids: ['mrd-7'] });
    expect(stats.testSpecificCount).toBe(1);
    expect(stats.testAgnosticCount).toBe(2);
  });

  it('counts unique sources by pmid', () => {
    const claims = [
      makeClaim({ pmid: 'AAA' }),
      makeClaim({ pmid: 'AAA' }), // duplicate
      makeClaim({ pmid: 'BBB' }),
    ];
    const stats = computeStats(claims, {});
    expect(stats.totalSources).toBe(2);
  });

  it('falls back to title for source dedup when no pmid', () => {
    const claims = [
      makeClaim({ pmid: null, title: 'Study A', source: { pmid: null, title: 'Study A', year: 2023 } }),
      makeClaim({ pmid: null, title: 'Study A', source: { pmid: null, title: 'Study A', year: 2023 } }),
      makeClaim({ pmid: null, title: 'Study B', source: { pmid: null, title: 'Study B', year: 2023 } }),
    ];
    const stats = computeStats(claims, {});
    expect(stats.totalSources).toBe(2);
  });
});
