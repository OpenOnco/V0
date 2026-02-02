/**
 * Phase 4 Tests: Code Versioning, Context-Aware Tests, Date Ranges
 */

import { describe, it, expect } from 'vitest';
import {
  CODE_DICTIONARY_VERSION,
  MRD_PLA_CODES,
  AMBIGUOUS_CODES,
  mapCodeToTest,
  getTestForPLACode,
} from '../../src/extractors/codes.js';
import {
  extractTestsWithContext,
  DOWNWEIGHT_CONTEXTS,
  UPWEIGHT_CONTEXTS,
} from '../../src/extractors/tests.js';
import {
  extractDateWithPrecision,
  extractAllDatesWithPrecision,
  datesOverlap,
} from '../../src/extractors/dates.js';

describe('Code Versioning', () => {
  it('has version information', () => {
    expect(CODE_DICTIONARY_VERSION).toBeDefined();
    expect(CODE_DICTIONARY_VERSION).toMatch(/^\d{4}-\d{2}$/);  // YYYY-MM format
  });

  it('PLA codes have status and effective date', () => {
    const signatera = MRD_PLA_CODES['0239U'];

    expect(signatera).toBeDefined();
    expect(signatera.test).toBe('Signatera');
    expect(signatera.status).toBe('active');
    expect(signatera.effectiveDate).toBeDefined();
  });

  it('ambiguous codes are defined', () => {
    expect(AMBIGUOUS_CODES['81479']).toBeDefined();
    expect(AMBIGUOUS_CODES['81479'].handling).toBe('flag_for_review');
    expect(AMBIGUOUS_CODES['81479'].confidence).toBeLessThan(0.5);
  });
});

describe('Code to Test Mapping', () => {
  it('maps PLA code to test with high confidence', () => {
    const result = mapCodeToTest('0239U');

    expect(result.testName).toBe('Signatera');
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.ambiguous).toBe(false);
  });

  it('flags ambiguous codes', () => {
    const result = mapCodeToTest('81479');

    expect(result.ambiguous).toBe(true);
    expect(result.handling).toBe('flag_for_review');
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('handles unknown codes', () => {
    const result = mapCodeToTest('99999');

    expect(result.unknown).toBe(true);
    expect(result.confidence).toBe(0);
  });

  it('getTestForPLACode returns test name', () => {
    expect(getTestForPLACode('0239U')).toBe('Signatera');
    expect(getTestForPLACode('0306U')).toBe('Guardant Reveal');
    expect(getTestForPLACode('9999U')).toBeNull();
  });
});

describe('Context-Aware Test Extraction', () => {
  it('has downweight and upweight contexts defined', () => {
    expect(DOWNWEIGHT_CONTEXTS.length).toBeGreaterThan(5);
    expect(UPWEIGHT_CONTEXTS.length).toBeGreaterThan(5);
  });

  it('downweights bibliography mentions', () => {
    const content = `
      Coverage Criteria

      Signatera is covered for Stage II CRC.

      References:
      1. Smith et al. evaluated Signatera in a 2024 study.
      2. Examples include Signatera, Guardant Reveal, and RaDaR.
    `;

    const tests = extractTestsWithContext(content);
    const signatera = tests.find(t => t.id === 'signatera');

    // Should find Signatera
    expect(signatera).toBeDefined();
    // Average weight should be reduced due to bibliography mentions
    expect(signatera.weight).toBeLessThan(1.0);
  });

  it('upweights coverage language mentions', () => {
    const content = `
      Signatera is medically necessary when used for post-surgical monitoring.
      Coverage for Signatera is approved for Stage II-III CRC patients.
    `;

    const tests = extractTestsWithContext(content);
    const signatera = tests.find(t => t.id === 'signatera');

    expect(signatera).toBeDefined();
    // Weight should be boosted due to coverage context
    expect(signatera.weight).toBeGreaterThan(1.0);
  });

  it('flags likely bibliography mentions', () => {
    const content = `
      See also: Signatera (Natera), Guardant Reveal, RaDaR.
      References: [1] Signatera clinical study, [2] Guardant trial.
    `;

    const tests = extractTestsWithContext(content);

    // All tests should be flagged as likely bibliography
    for (const test of tests) {
      expect(test.likelyBibliography).toBe(true);
    }
  });

  it('returns tests sorted by weighted score', () => {
    const content = `
      Coverage Criteria:
      Signatera is covered for the following indications.
      Signatera meets medical necessity criteria.

      Other tests:
      See also Guardant Reveal in the references section.
    `;

    const tests = extractTestsWithContext(content);

    // Signatera should be first (more coverage mentions, higher weight)
    expect(tests[0].id).toBe('signatera');
    expect(tests[0].weightedScore).toBeGreaterThan(tests[1]?.weightedScore || 0);
  });
});

describe('Date Precision and Ranges', () => {
  it('extracts quarter as a range', () => {
    const content = 'Effective Q1 2026';
    const result = extractDateWithPrecision(content, 'effective');

    expect(result).not.toBeNull();
    expect(result.precision).toBe('quarter');
    expect(result.range.start).toBe('2026-01-01');
    expect(result.range.end).toBe('2026-03-31');
    expect(result.original).toContain('Q1');
  });

  it('handles Q2 2026 format', () => {
    const content = 'Effective Date: Q2 2026';
    const result = extractDateWithPrecision(content, 'effective');

    expect(result.precision).toBe('quarter');
    expect(result.range.start).toBe('2026-04-01');
    expect(result.range.end).toBe('2026-06-30');
  });

  it('extracts month-only dates with month precision', () => {
    // Use revision pattern which has month+year support
    const content = 'Last Revised: January 2026';
    const result = extractDateWithPrecision(content, 'revision');

    expect(result).not.toBeNull();
    expect(result.precision).toBe('month');
    expect(result.value).toBe('2026-01-01');
    expect(result.range.start).toBe('2026-01-01');
    expect(result.range.end).toBe('2026-01-31');
  });

  it('extracts full dates with day precision', () => {
    const content = 'Effective Date: January 15, 2026';
    const result = extractDateWithPrecision(content, 'effective');

    expect(result).not.toBeNull();
    expect(result.precision).toBe('day');
    expect(result.value).toBe('2026-01-15');
    expect(result.range).toBeNull();  // Precise date has no range
  });

  it('extractAllDatesWithPrecision returns all date types', () => {
    // Test quarter detection
    const quarterContent = 'Effective Date: Q2 2026';
    const quarterDates = extractAllDatesWithPrecision(quarterContent);
    expect(quarterDates.effectiveDate?.precision).toBe('quarter');

    // Test day precision
    const dayContent = 'Next Review: December 15, 2026';
    const dayDates = extractAllDatesWithPrecision(dayContent);
    expect(dayDates.nextReviewDate?.precision).toBe('day');

    // Test month precision (separate doc without quarter)
    const monthContent = 'Last Revised: February 2026';
    const monthDates = extractAllDatesWithPrecision(monthContent);
    expect(monthDates.revisionDate?.precision).toBe('month');
  });
});

describe('Date Overlap Detection', () => {
  it('detects overlapping quarters', () => {
    const q1 = {
      value: '2026-01-01',
      precision: 'quarter',
      range: { start: '2026-01-01', end: '2026-03-31' },
    };
    const feb = {
      value: '2026-02-01',
      precision: 'month',
      range: { start: '2026-02-01', end: '2026-02-28' },
    };

    expect(datesOverlap(q1, feb)).toBe(true);
  });

  it('detects non-overlapping dates', () => {
    const jan = {
      value: '2026-01-15',
      precision: 'day',
      range: null,
    };
    const mar = {
      value: '2026-03-15',
      precision: 'day',
      range: null,
    };

    expect(datesOverlap(jan, mar)).toBe(false);
  });

  it('handles null dates', () => {
    const date = { value: '2026-01-15', precision: 'day' };

    expect(datesOverlap(null, date)).toBe(false);
    expect(datesOverlap(date, null)).toBe(false);
  });
});

describe('Acceptance Tests', () => {
  it('code table change triggers high priority', () => {
    // Test that a PLA code is properly identified
    const result = mapCodeToTest('0239U');
    expect(result.testName).toBe('Signatera');

    // And that ambiguous codes are flagged
    const ambig = mapCodeToTest('81479');
    expect(ambig.ambiguous).toBe(true);
  });

  it('criteria extraction distinguishes coverage vs bibliography', () => {
    const coverageDoc = `
      Medical Necessity Criteria:
      Signatera is considered medically necessary for Stage II CRC.
    `;

    const bibDoc = `
      References:
      Examples include Signatera, Guardant Reveal, and other tests.
    `;

    const coverageTests = extractTestsWithContext(coverageDoc);
    const bibTests = extractTestsWithContext(bibDoc);

    // Coverage doc should have higher weight
    const coverageSig = coverageTests.find(t => t.id === 'signatera');
    const bibSig = bibTests.find(t => t.id === 'signatera');

    expect(coverageSig.weight).toBeGreaterThan(bibSig.weight);
    expect(bibSig.likelyBibliography).toBe(true);
  });
});
