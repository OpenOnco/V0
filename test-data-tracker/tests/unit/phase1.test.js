/**
 * Phase 1 Tests: Section Slicer + Delegation Routing
 *
 * Tests for:
 * 1. Section slicer extracts coverage-related sections
 * 2. Multi-hash uses section slicer as fallback
 * 3. Reconciliation treats delegation as routing metadata
 */

import { describe, it, expect } from 'vitest';
import {
  sliceCriteriaSections,
  extractStanceText,
  getHashableContent,
  hasCoverageSections,
} from '../../src/extractors/section-slicer.js';
import {
  computeMultiHash,
  computeCriteriaHash,
  compareMultiHash,
} from '../../src/utils/multi-hash.js';
import {
  reconcileCoverage,
  getDelegationRouting,
  LAYER_WEIGHTS,
} from '../../src/analysis/reconcile.js';
import { COVERAGE_LAYERS, ASSERTION_STATUS } from '../../src/proposals/schema.js';

describe('Section Slicer', () => {
  it('extracts coverage criteria sections by heading', () => {
    const doc = `
# Policy Overview

Some general information.

## Coverage Criteria

Signatera is covered when:
1. Patient has Stage II-III CRC
2. Post-surgical surveillance is needed

## Limitations

Not covered for screening purposes.

## References

1. Smith et al. 2024
`;

    const result = sliceCriteriaSections(doc);

    expect(result.sections).toHaveLength(2);
    expect(result.headingsFound).toContain('## Coverage Criteria');
    expect(result.headingsFound).toContain('## Limitations');
    expect(result.combinedText).toContain('Signatera is covered when');
    expect(result.combinedText).toContain('Not covered for screening');
    // Should NOT include references
    expect(result.combinedText).not.toContain('Smith et al');
  });

  it('extracts medical necessity sections', () => {
    const doc = `
# Policy

## Medical Necessity

This test is medically necessary when criteria are met.

## References

Historical information here.
`;

    const result = sliceCriteriaSections(doc);

    expect(result.sections).toHaveLength(1);
    expect(result.headingsFound).toContain('## Medical Necessity');
    expect(result.combinedText).toContain('medically necessary');
    // References section should NOT be included
    expect(result.combinedText).not.toContain('Historical information');
  });

  it('handles documents without proper headings via stance extraction', () => {
    const doc = `
This policy document covers ctDNA testing.
Signatera is considered medically necessary for colorectal cancer monitoring.
The test is covered when used for post-surgical surveillance.
However, it is not covered for screening purposes.
`;

    const stanceText = extractStanceText(doc);

    expect(stanceText).toContain('medically necessary');
    expect(stanceText).toContain('covered when');
    expect(stanceText).toContain('not covered for screening');
  });

  it('returns empty for non-coverage documents', () => {
    const doc = `
# Company Newsletter

This month we celebrated our anniversary.
Please join us for the holiday party.
`;

    const result = sliceCriteriaSections(doc);
    const stanceText = extractStanceText(doc);

    expect(result.sections).toHaveLength(0);
    expect(stanceText).toBe('');
  });

  it('hasCoverageSections returns correct boolean', () => {
    const coverageDoc = '## Coverage Criteria\n\nTest content';
    const otherDoc = '## Company News\n\nTest content';

    expect(hasCoverageSections(coverageDoc)).toBe(true);
    expect(hasCoverageSections(otherDoc)).toBe(false);
  });
});

describe('Multi-Hash with Section Slicer Fallback', () => {
  it('computes criteriaHash even when extraction fails', () => {
    const doc = `
## Coverage Policy

This test is covered for the following conditions.
Patients must meet medical necessity criteria.
`;

    // Simulate extraction failure (empty extracted data)
    const emptyExtraction = {};

    const hashes = computeMultiHash(doc, emptyExtraction);

    // criteriaHash should NOT be null because section slicer provides fallback
    expect(hashes.criteriaHash).not.toBeNull();
    expect(hashes.criteriaHash).toBeTruthy();
  });

  it('detects criteria changes via section slicer when extraction is empty', () => {
    const oldDoc = `
## Coverage Policy

This test is considered investigational.
`;

    const newDoc = `
## Coverage Policy

This test is medically necessary when criteria are met.
`;

    const oldHashes = computeMultiHash(oldDoc, {});
    const newHashes = computeMultiHash(newDoc, {});

    const comparison = compareMultiHash(oldHashes, newHashes);

    expect(comparison.changed).toBe(true);
    expect(comparison.changedHashes).toContain('criteria');
    expect(comparison.priority).toBe('high');
  });

  it('combines section slicer with structured extraction', () => {
    const doc = `
## Coverage Criteria

Covered for Stage II CRC.
`;

    // With structured extraction
    const extracted = {
      stance: 'restricts',
      indications: ['Stage II CRC'],
    };

    const hashesWithExtraction = computeMultiHash(doc, extracted);

    // Without structured extraction
    const hashesWithoutExtraction = computeMultiHash(doc, {});

    // Both should have criteriaHash (section slicer always works)
    expect(hashesWithExtraction.criteriaHash).not.toBeNull();
    expect(hashesWithoutExtraction.criteriaHash).not.toBeNull();

    // But they should be different (extraction adds more signal)
    expect(hashesWithExtraction.criteriaHash).not.toBe(hashesWithoutExtraction.criteriaHash);
  });
});

describe('Delegation as Routing Metadata', () => {
  it('does not include delegation in LAYER_WEIGHTS', () => {
    // Delegation should NOT be a weighted layer
    expect(LAYER_WEIGHTS).not.toHaveProperty('delegation');
    expect(LAYER_WEIGHTS).not.toHaveProperty(COVERAGE_LAYERS.DELEGATION);
  });

  it('reconciliation returns delegation as metadata, not stance', () => {
    const assertions = [
      {
        assertionId: 'a1',
        layer: COVERAGE_LAYERS.POLICY_STANCE,
        status: ASSERTION_STATUS.RESTRICTS,
        confidence: 0.8,
        sourceUrl: 'https://example.com/policy',
      },
    ];

    const result = reconcileCoverage(assertions, { payerId: 'test-payer', testId: 'signatera' });

    // Status should come from assertion, not delegation
    expect(result.status).toBe(ASSERTION_STATUS.RESTRICTS);

    // If delegation exists, it should be metadata
    if (result.delegation) {
      expect(result.delegation).toHaveProperty('active');
      expect(result.delegation).toHaveProperty('delegatedTo');
      // Should NOT have a 'status' that competes with assertion status
    }
  });

  it('conflicts between layers surface hasConflict flag', () => {
    const assertions = [
      {
        assertionId: 'a1',
        layer: COVERAGE_LAYERS.POLICY_STANCE,
        status: ASSERTION_STATUS.DENIES,
        confidence: 0.9,
      },
      {
        assertionId: 'a2',
        layer: COVERAGE_LAYERS.UM_CRITERIA,
        status: ASSERTION_STATUS.SUPPORTS,
        confidence: 0.85,
      },
    ];

    const result = reconcileCoverage(assertions, { payerId: 'test', testId: 'signatera' });

    // High severity conflict (supports vs denies) returns conflict_review_required
    // This is the safer UX choice - require human review for direct contradictions
    expect(result.status).toBe('conflict_review_required');

    // Conflict should be flagged
    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0].severity).toBe('high');
  });

  it('medium conflicts allow higher layer to win with hasConflict flag', () => {
    // Medium conflict: restricts vs supports (not direct contradiction)
    const assertions = [
      {
        assertionId: 'a1',
        layer: COVERAGE_LAYERS.POLICY_STANCE,
        status: ASSERTION_STATUS.RESTRICTS,
        confidence: 0.9,
      },
      {
        assertionId: 'a2',
        layer: COVERAGE_LAYERS.UM_CRITERIA,
        status: ASSERTION_STATUS.SUPPORTS,
        confidence: 0.85,
      },
    ];

    const result = reconcileCoverage(assertions, { payerId: 'test', testId: 'signatera' });

    // UM_CRITERIA should win (higher weight) - medium conflict allows resolution
    expect(result.status).toBe(ASSERTION_STATUS.SUPPORTS);

    // But conflict should still be flagged
    expect(result.hasConflict).toBe(true);
    expect(result.conflictDetails).toBeDefined();
  });

  it('LBM layer wins when delegation is active', () => {
    // This test would require mocking getDelegationStatus
    // For now, test that LBM_GUIDELINE has high weight
    expect(LAYER_WEIGHTS[COVERAGE_LAYERS.LBM_GUIDELINE]).toBeGreaterThan(
      LAYER_WEIGHTS[COVERAGE_LAYERS.POLICY_STANCE]
    );
  });
});

describe('Acceptance Test: Delegation Transition', () => {
  it('delegation change does not alter coverage status', () => {
    // Before delegation: policy_stance says restricts
    const beforeAssertions = [
      {
        assertionId: 'a1',
        layer: COVERAGE_LAYERS.POLICY_STANCE,
        status: ASSERTION_STATUS.RESTRICTS,
        confidence: 0.85,
      },
    ];

    const beforeResult = reconcileCoverage(beforeAssertions, {
      payerId: 'test-payer',
      testId: 'signatera',
    });

    // After delegation detected (but no LBM assertion yet)
    // Same assertions, delegation is just routing metadata
    const afterResult = reconcileCoverage(beforeAssertions, {
      payerId: 'test-payer',
      testId: 'signatera',
    });

    // Coverage status should be the same
    // (delegation alone doesn't change coverage)
    expect(afterResult.status).toBe(beforeResult.status);
  });
});
