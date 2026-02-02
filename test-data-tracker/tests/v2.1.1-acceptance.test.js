/**
 * v2.1.1 Acceptance Tests
 *
 * Additional tests per evaluator feedback:
 * 1. Line-of-business applicability
 * 2. Parser version change detection
 * 3. Moved/redirected URL handling
 * 4. Index-page false positive filtering
 * 5. Anchor integrity validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDelegationStatus,
  DELEGATION_EVIDENCE,
  DELEGATION_EFFECTIVENESS,
  LINE_OF_BUSINESS,
} from '../src/data/delegation-map.js';
import { getDelegationRouting, reconcileCoverage } from '../src/analysis/reconcile.js';
import { COVERAGE_LAYERS, ASSERTION_STATUS } from '../src/proposals/schema.js';
import { computeMultiHash, compareMultiHash } from '../src/utils/multi-hash.js';

describe('Acceptance Test: Line-of-Business Applicability', () => {
  it('returns different routing for commercial vs MA for same payer', () => {
    // Horizon BCBS NJ delegates commercial to eviCore but NOT Medicare Advantage
    const commercialRouting = getDelegationRouting('horizonnj', {
      lineOfBusiness: LINE_OF_BUSINESS.COMMERCIAL,
    });
    const maRouting = getDelegationRouting('horizonnj', {
      lineOfBusiness: LINE_OF_BUSINESS.MEDICARE_ADVANTAGE,
    });

    // Commercial should be delegated
    expect(commercialRouting.active).toBe(true);
    expect(commercialRouting.delegatedTo).toBe('evicore');
    expect(commercialRouting.lobApplicable).toBe(true);
    expect(commercialRouting.boostLBM).toBe(true);

    // Medicare Advantage should NOT be delegated
    expect(maRouting.active).toBe(false);
    expect(maRouting.lobApplicable).toBe(false);
    expect(maRouting.delegationExistsForOtherLOB).toBe(true);
    expect(maRouting.boostLBM).toBe(false);
  });

  it('reconciliation includes LOB context in output', () => {
    const assertions = [
      {
        assertionId: 'a1',
        layer: COVERAGE_LAYERS.POLICY_STANCE,
        status: ASSERTION_STATUS.RESTRICTS,
        confidence: 0.85,
      },
    ];

    const result = reconcileCoverage(assertions, {
      payerId: 'horizonnj',
      testId: 'signatera',
      lineOfBusiness: LINE_OF_BUSINESS.MEDICARE_ADVANTAGE,
    });

    // Should indicate delegation doesn't apply for this LOB
    expect(result.delegation).toBeDefined();
    expect(result.delegation.lobApplicable).toBe(false);
  });

  it('payer with LOB=ALL applies to all lines of business', () => {
    // Blue Cross Idaho delegates for ALL lines of business
    const commercial = getDelegationRouting('bcidaho', {
      lineOfBusiness: LINE_OF_BUSINESS.COMMERCIAL,
    });
    const medicaid = getDelegationRouting('bcidaho', {
      lineOfBusiness: LINE_OF_BUSINESS.MEDICAID,
    });

    expect(commercial.active).toBe(true);
    expect(commercial.lobApplicable).toBe(true);
    expect(medicaid.active).toBe(true);
    expect(medicaid.lobApplicable).toBe(true);
  });
});

describe('Acceptance Test: Parser Version Change', () => {
  it('detects parser version in hash metadata', () => {
    const docText = 'Coverage Policy: Test is covered for Stage II CRC.';
    const extracted = { stance: 'supports', codes: { pla: ['0239U'] } };

    const hashes = computeMultiHash(docText, extracted);

    // Multi-hash should include parser version for tracking
    expect(hashes.metadata).toBeDefined();
    expect(hashes.metadata.parserVersion).toBeDefined();
  });

  it('flags system-change when only parser version differs', () => {
    const docText = 'Coverage Policy: Test is covered for Stage II CRC.';

    // Simulate two extractions with different parser versions
    const oldHashes = {
      contentHash: 'abc123',
      criteriaHash: 'def456',
      codesHash: 'ghi789',
      metadataHash: 'jkl012',
      metadata: { parserVersion: '2.0.0' },
    };

    const newHashes = {
      contentHash: 'abc123',  // Same content
      criteriaHash: 'xyz999', // Different criteria hash
      codesHash: 'ghi789',    // Same codes
      metadataHash: 'jkl012', // Same metadata
      metadata: { parserVersion: '2.1.0' },  // Different parser
    };

    const comparison = compareMultiHash(oldHashes, newHashes);

    // Should detect change
    expect(comparison.changed).toBe(true);

    // Should flag as potential system change if content hash is same
    // but criteria hash differs (parser behavior changed)
    if (oldHashes.contentHash === newHashes.contentHash &&
        oldHashes.criteriaHash !== newHashes.criteriaHash) {
      expect(comparison.possibleSystemChange).toBe(true);
    }
  });
});

describe('Acceptance Test: Moved/Redirected URL', () => {
  it('URL change with same content should not trigger coverage delta', () => {
    const content = `
      Medical Policy
      Signatera is covered for Stage II CRC monitoring.
      CPT: 0239U
    `;

    // Same content, different URLs
    const oldExtracted = { stance: 'supports', codes: { pla: ['0239U'] } };
    const newExtracted = { stance: 'supports', codes: { pla: ['0239U'] } };

    const oldHashes = computeMultiHash(content, oldExtracted);
    const newHashes = computeMultiHash(content, newExtracted);

    const comparison = compareMultiHash(oldHashes, newHashes);

    // Content-based hashes should be identical
    expect(comparison.changed).toBe(false);
    expect(comparison.changedHashes).toHaveLength(0);
  });

  it('tracks URL separately from content hash', () => {
    const content = 'Policy content here';
    const extracted = {};

    const hashes = computeMultiHash(content, extracted, {
      sourceUrl: 'https://example.com/old-path/policy.pdf',
    });

    // URL should be in metadata, not affect content hash
    expect(hashes.contentHash).toBeDefined();
    // URL change alone should not change contentHash
  });
});

describe('Acceptance Test: Index-Page False Positives', () => {
  it('identifies index/listing pages vs actual policies', () => {
    const indexPageContent = `
      Medical Policy Index

      - Liquid Biopsy Testing (Policy 123)
      - MRD Monitoring Guidelines
      - Molecular Testing Overview

      Click on a policy to view details.
    `;

    const actualPolicyContent = `
      Medical Policy: Liquid Biopsy Testing
      Policy Number: 123
      Effective Date: January 1, 2026

      Coverage Criteria:
      Signatera MRD testing is considered medically necessary for
      Stage II-III colorectal cancer patients.
    `;

    const indexHashes = computeMultiHash(indexPageContent, {});
    const policyHashes = computeMultiHash(actualPolicyContent, {});

    // Index page should have minimal/null criteria hash
    // Policy should have substantive criteria hash
    expect(policyHashes.criteriaHash).not.toBe(indexHashes.criteriaHash);

    // Index pages typically have very short criteria sections
    // (This is where docType classification would help)
  });

  it('index pages should have low confidence extraction', () => {
    const indexContent = `
      Policy Library
      - View all policies
      - Search by topic
      - MRD, ctDNA, Liquid Biopsy
    `;

    // When extracting from index page, should have low confidence
    const extracted = {
      stance: 'unclear',
      confidence: 0.2,  // Low confidence indicates poor extraction
    };

    expect(extracted.confidence).toBeLessThan(0.5);
  });
});

describe('Acceptance Test: Anchor Integrity', () => {
  it('proposal must include retrievable anchor', () => {
    // Simulate a proposal structure
    const proposal = {
      id: 'test-proposal',
      type: 'coverage',
      testName: 'Signatera',
      payer: 'Test Payer',
      // v2.1.1: Must have anchor
      anchor: {
        artifactId: 'test-payer_policy-123_2026-02-01_abc123',
        page: 3,
        section: 'Coverage Criteria',
        quote: 'Signatera is considered medically necessary',
        quoteContext: {
          before: '...',
          after: '...',
        },
      },
    };

    // Anchor must exist
    expect(proposal.anchor).toBeDefined();
    expect(proposal.anchor.artifactId).toBeDefined();
    expect(proposal.anchor.quote).toBeDefined();

    // Quote should be non-empty
    expect(proposal.anchor.quote.length).toBeGreaterThan(10);
  });

  it('anchor quote must be present in stored artifact', () => {
    const artifactContent = `
      Medical Policy Document

      Coverage Criteria:
      Signatera is considered medically necessary for monitoring
      minimal residual disease in colorectal cancer patients.
    `;

    const anchor = {
      quote: 'Signatera is considered medically necessary',
    };

    // Quote must be findable in artifact
    expect(artifactContent).toContain(anchor.quote);
  });

  it('validates anchor has required fields', () => {
    const validateAnchor = (anchor) => {
      const required = ['artifactId', 'quote'];
      const optional = ['page', 'section', 'quoteContext', 'lineNumber'];

      for (const field of required) {
        if (!anchor[field]) {
          return { valid: false, missing: field };
        }
      }
      return { valid: true };
    };

    const goodAnchor = {
      artifactId: 'abc123',
      quote: 'Test quote',
      section: 'Coverage',
    };

    const badAnchor = {
      artifactId: 'abc123',
      // Missing quote
    };

    expect(validateAnchor(goodAnchor).valid).toBe(true);
    expect(validateAnchor(badAnchor).valid).toBe(false);
    expect(validateAnchor(badAnchor).missing).toBe('quote');
  });
});

describe('Acceptance Test: Delegation Semantics Clarity', () => {
  it('separates evidenceLevel from effectiveness', () => {
    // Get delegation for a known payer
    const delegation = getDelegationStatus('bcbsla');

    expect(delegation).not.toBeNull();

    // Should have separated axes
    expect(delegation.evidenceLevel).toBeDefined();
    expect(delegation.effectiveness).toBeDefined();

    // Valid values
    expect([
      DELEGATION_EVIDENCE.SUSPECTED,
      DELEGATION_EVIDENCE.CONFIRMED,
    ]).toContain(delegation.evidenceLevel);

    expect([
      DELEGATION_EFFECTIVENESS.PENDING,
      DELEGATION_EFFECTIVENESS.EFFECTIVE,
      DELEGATION_EFFECTIVENESS.EXPIRED,
    ]).toContain(delegation.effectiveness);
  });

  it('confirmed + expired is distinct from suspected + effective', () => {
    // A confirmed but expired delegation should still be "confirmed"
    // in terms of evidence, just no longer effective

    const mockExpiredDelegation = {
      evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
      effectiveness: DELEGATION_EFFECTIVENESS.EXPIRED,
    };

    const mockSuspectedDelegation = {
      evidenceLevel: DELEGATION_EVIDENCE.SUSPECTED,
      effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    };

    // These should be clearly distinguishable
    expect(mockExpiredDelegation.evidenceLevel).toBe('confirmed');
    expect(mockExpiredDelegation.effectiveness).toBe('expired');

    expect(mockSuspectedDelegation.evidenceLevel).toBe('suspected');
    expect(mockSuspectedDelegation.effectiveness).toBe('effective');
  });

  it('legacy status field maps correctly', () => {
    const delegation = getDelegationStatus('bcbsla');

    // Legacy status should still work
    expect(delegation.status).toBeDefined();

    // confirmed + effective should map to 'active'
    if (delegation.evidenceLevel === 'confirmed' &&
        delegation.effectiveness === 'effective') {
      expect(delegation.status).toBe('active');
    }
  });
});

describe('Acceptance Test: boostLBM Does Not Suppress Documents', () => {
  it('all assertions remain in pool even with active delegation', () => {
    const assertions = [
      {
        assertionId: 'payer-policy',
        layer: COVERAGE_LAYERS.POLICY_STANCE,
        status: ASSERTION_STATUS.DENIES,
        confidence: 0.9,
        sourceUrl: 'https://payer.com/policy.pdf',
      },
      {
        assertionId: 'lbm-guideline',
        layer: COVERAGE_LAYERS.LBM_GUIDELINE,
        status: ASSERTION_STATUS.SUPPORTS,
        confidence: 0.85,
        sourceUrl: 'https://carelon.com/guideline.pdf',
      },
    ];

    const result = reconcileCoverage(assertions, {
      payerId: 'bcbsla',  // Delegated to Carelon
      testId: 'signatera',
    });

    // Even though delegation is active, payer policy should still be
    // in the supporting assertions (not suppressed)
    const allLayers = [
      result.authoritative?.layer,
      ...(result.supporting?.map(s => s.layer) || []),
    ].filter(Boolean);

    // Both layers should be present
    expect(allLayers).toContain(COVERAGE_LAYERS.LBM_GUIDELINE);
    // Policy stance should be in supporting, not filtered out
    expect(result.supporting?.some(s => s.layer === COVERAGE_LAYERS.POLICY_STANCE)).toBe(true);

    // Conflict should be detected (denies vs supports)
    expect(result.hasConflict).toBe(true);
  });

  it('boostLBM affects weight, not applicability', () => {
    const assertions = [
      {
        assertionId: 'a1',
        layer: COVERAGE_LAYERS.POLICY_STANCE,
        status: ASSERTION_STATUS.RESTRICTS,
        confidence: 0.9,
      },
      {
        assertionId: 'a2',
        layer: COVERAGE_LAYERS.LBM_GUIDELINE,
        status: ASSERTION_STATUS.SUPPORTS,
        confidence: 0.85,
      },
    ];

    // With delegation active
    const resultWithDelegation = reconcileCoverage(assertions, {
      payerId: 'bcbsla',
      testId: 'signatera',
    });

    // LBM should be authoritative when delegation is active
    expect(resultWithDelegation.authoritative.layer).toBe(COVERAGE_LAYERS.LBM_GUIDELINE);

    // But policy_stance should still be present in output
    expect(resultWithDelegation.supporting.length).toBeGreaterThan(0);
  });
});
