/**
 * Evidence Query Engine Tests
 *
 * Tests the deterministic query, sorting, and keyword fallback logic
 * from the evidence-query API. These functions are extracted and tested
 * independently of the serverless handler.
 */

import { describe, test, expect } from 'vitest';

// ─── Replicate query engine logic (same as api/evidence-query.js) ────

const TYPE_ORDER = {
  'guideline_recommendation': 0,
  'trial_result': 1,
  'diagnostic_performance': 2,
  'clinical_utility': 3,
  'methodology_note': 4,
};

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

// ─── Test fixtures ───────────────────────────────────────────

const FIXTURES = [
  {
    id: 'CRC-DYNAMIC-001',
    type: 'trial_result',
    source: { pmid: '35657320', year: 2022 },
    scope: { cancer: 'colorectal', stages: ['II'], setting: 'adjuvant', tests: [{ test_id: 'mrd-7', test_name: 'Signatera' }] },
    finding: { description: 'DYNAMIC trial', n: 455, hr: 0.92 },
  },
  {
    id: 'CRC-NCCN-001',
    type: 'guideline_recommendation',
    source: { year: 2026 },
    scope: { cancer: 'colorectal', stages: ['II', 'III'] },
    finding: { description: 'NCCN recommends ctDNA for stage II' },
  },
  {
    id: 'CRC-GALAXY-001',
    type: 'trial_result',
    source: { pmid: '36646802', year: 2023 },
    scope: { cancer: 'colorectal', stages: ['II', 'III'], tests: [{ test_id: 'mrd-7', test_name: 'Signatera' }] },
    finding: { description: 'GALAXY/VEGA study', n: 2000, hr: 0.39 },
  },
  {
    id: 'BRC-CTRAK-001',
    type: 'trial_result',
    source: { pmid: '36423745', year: 2023 },
    scope: { cancer: 'breast', stages: ['II', 'III'] },
    finding: { description: 'c-TRAK TN trial in TNBC', n: 208 },
  },
  {
    id: 'XCN-METHOD-001',
    type: 'methodology_note',
    source: { year: 2026 },
    scope: { cancer: 'cross-cancer' },
    finding: { description: 'Sensitivity can be ambiguous' },
  },
  {
    id: 'BLD-IMV011-001',
    type: 'trial_result',
    source: { pmid: '41124204', year: 2025 },
    scope: { cancer: 'bladder', tests: [{ test_id: 'mrd-7', test_name: 'Signatera' }] },
    finding: { description: 'IMvigor011 phase III', n: 761, hr: 0.64 },
  },
];

// ─── Query engine tests ──────────────────────────────────────

describe('queryEvidence', () => {
  test('filters by cancer type', () => {
    const results = queryEvidence(FIXTURES, { cancer: 'colorectal' });
    const ids = results.map(c => c.id);
    expect(ids).toContain('CRC-DYNAMIC-001');
    expect(ids).toContain('CRC-NCCN-001');
    expect(ids).toContain('XCN-METHOD-001'); // cross-cancer included
    expect(ids).not.toContain('BRC-CTRAK-001');
    expect(ids).not.toContain('BLD-IMV011-001');
  });

  test('filters by stage', () => {
    const results = queryEvidence(FIXTURES, { cancer: 'colorectal', stages: ['II'] });
    expect(results.map(c => c.id)).toContain('CRC-DYNAMIC-001');
    expect(results.map(c => c.id)).toContain('CRC-GALAXY-001'); // has stage II in array
  });

  test('filters by test_id (includes test-agnostic)', () => {
    const results = queryEvidence(FIXTURES, { test_ids: ['mrd-7'] });
    const ids = results.map(c => c.id);
    // Test-specific: DYNAMIC, GALAXY, IMvigor011
    expect(ids).toContain('CRC-DYNAMIC-001');
    expect(ids).toContain('CRC-GALAXY-001');
    expect(ids).toContain('BLD-IMV011-001');
    // Test-agnostic (no tests array): NCCN, c-TRAK, METHOD
    expect(ids).toContain('CRC-NCCN-001');
    expect(ids).toContain('BRC-CTRAK-001');
    expect(ids).toContain('XCN-METHOD-001');
  });

  test('filters by test_id + cancer (narrows to cancer-specific)', () => {
    const results = queryEvidence(FIXTURES, { cancer: 'colorectal', test_ids: ['mrd-7'] });
    const ids = results.map(c => c.id);
    expect(ids).toContain('CRC-DYNAMIC-001');
    expect(ids).toContain('CRC-NCCN-001');
    expect(ids).toContain('XCN-METHOD-001');
    expect(ids).not.toContain('BLD-IMV011-001'); // bladder, filtered out
  });

  test('filters by claim type', () => {
    const results = queryEvidence(FIXTURES, { claim_types: ['guideline_recommendation'] });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('CRC-NCCN-001');
  });

  test('filters by keyword', () => {
    const results = queryEvidence(FIXTURES, { keywords: ['DYNAMIC'] });
    expect(results.map(c => c.id)).toContain('CRC-DYNAMIC-001');
  });

  test('null query returns all claims', () => {
    const results = queryEvidence(FIXTURES, {});
    expect(results).toHaveLength(FIXTURES.length);
  });

  test('stage filter skips claims without stages', () => {
    const results = queryEvidence(FIXTURES, { stages: ['II'] });
    // BLD-IMV011-001 has no stages — should be included (not filtered out)
    expect(results.map(c => c.id)).toContain('BLD-IMV011-001');
  });
});

// ─── Sorting tests ───────────────────────────────────────────

describe('sortClaims', () => {
  test('guidelines sort before trial results', () => {
    const sorted = sortClaims(FIXTURES);
    const guidelineIdx = sorted.findIndex(c => c.type === 'guideline_recommendation');
    const trialIdx = sorted.findIndex(c => c.type === 'trial_result');
    expect(guidelineIdx).toBeLessThan(trialIdx);
  });

  test('methodology notes sort last', () => {
    const sorted = sortClaims(FIXTURES);
    const lastIdx = sorted.length - 1;
    expect(sorted[lastIdx].type).toBe('methodology_note');
  });

  test('trials sort by sample size descending', () => {
    const sorted = sortClaims(FIXTURES);
    const trials = sorted.filter(c => c.type === 'trial_result');
    for (let i = 1; i < trials.length; i++) {
      const nPrev = trials[i - 1].finding?.n ?? 0;
      const nCurr = trials[i].finding?.n ?? 0;
      // Within same year, larger n first
      if (trials[i - 1].source?.year === trials[i].source?.year) {
        expect(nPrev).toBeGreaterThanOrEqual(nCurr);
      }
    }
  });
});
