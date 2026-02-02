/**
 * Phase 2 Tests: Artifact Storage + Evidence-Gated Delegation
 *
 * Tests for:
 * 1. Artifact storage and retrieval
 * 2. Evidence-gated delegation status
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import {
  storeArtifact,
  getArtifact,
  getArtifactMetadata,
  listArtifacts,
  createAnchor,
  addAnchor,
  setArtifactDir,
} from '../../src/utils/artifact-store.js';
import {
  DELEGATION_STATUS,
  getDelegation,
  getDelegationStatus,
  storeDetectedDelegation,
  getDetectedDelegation,
  PAYER_DELEGATIONS,
} from '../../src/data/delegation-map.js';

// Test artifact directory
const TEST_ARTIFACT_DIR = 'tests/temp/artifacts';

describe('Artifact Storage', () => {
  beforeEach(async () => {
    setArtifactDir(TEST_ARTIFACT_DIR);
    await mkdir(TEST_ARTIFACT_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_ARTIFACT_DIR, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  it('stores HTML artifact with metadata', async () => {
    const content = '<html><body>Coverage Policy Content</body></html>';
    const result = await storeArtifact('aetna', 'mol-onc-2025', content, {
      contentType: 'html',
      sourceUrl: 'https://example.com/policy.html',
    });

    expect(result.artifactId).toMatch(/^aetna_mol-onc-2025_\d{4}-\d{2}-\d{2}_[a-f0-9]{12}$/);
    expect(result.contentHash).toBeTruthy();
    expect(result.artifactPath).toContain('aetna');
  });

  it('stores PDF artifact as binary', async () => {
    // Simulate PDF content (buffer)
    const pdfContent = Buffer.from('%PDF-1.4 fake pdf content');
    const result = await storeArtifact('bcbs', 'ctdna-policy', pdfContent, {
      contentType: 'pdf',
      sourceUrl: 'https://example.com/policy.pdf',
    });

    expect(result.artifactId).toContain('bcbs_ctdna-policy');

    // Retrieve and verify
    const retrieved = await getArtifact(result.artifactId);
    expect(retrieved).not.toBeNull();
    expect(retrieved.metadata.contentType).toBe('pdf');
    expect(Buffer.compare(retrieved.content, pdfContent)).toBe(0);
  });

  it('retrieves artifact metadata', async () => {
    const content = 'Test policy content';
    const result = await storeArtifact('uhc', 'test-policy', content, {
      contentType: 'html',
      sourceUrl: 'https://example.com/policy',
      policyTitle: 'UHC Test Policy',
      effectiveDate: '2026-01-01',
    });

    const metadata = await getArtifactMetadata(result.artifactId);

    expect(metadata).not.toBeNull();
    expect(metadata.payerId).toBe('uhc');
    expect(metadata.policyId).toBe('test-policy');
    expect(metadata.policyTitle).toBe('UHC Test Policy');
    expect(metadata.effectiveDate).toBe('2026-01-01');
    expect(metadata.contentHash).toBe(result.contentHash);
  });

  it('lists artifacts for a payer', async () => {
    // Store multiple artifacts
    await storeArtifact('cigna', 'policy-1', 'content 1', { contentType: 'html' });
    await storeArtifact('cigna', 'policy-2', 'content 2', { contentType: 'html' });
    await storeArtifact('cigna', 'policy-1', 'content 1 updated', { contentType: 'html' });

    const artifacts = await listArtifacts('cigna');

    expect(artifacts.length).toBe(3);
    // Should be sorted by fetchedAt descending
    expect(new Date(artifacts[0].fetchedAt) >= new Date(artifacts[1].fetchedAt)).toBe(true);
  });

  it('creates and adds anchors for evidence', async () => {
    const content = 'Policy with important quote about Signatera coverage.';
    const result = await storeArtifact('test-payer', 'test-policy', content, {
      contentType: 'html',
      anchors: [
        createAnchor({
          heading: 'Coverage Criteria',
          quote: 'Signatera is covered for Stage II CRC',
          offset: 100,
        }),
      ],
    });

    // Add another anchor
    await addAnchor(result.artifactId, createAnchor({
      heading: 'Limitations',
      quote: 'Not covered for screening',
      offset: 500,
    }));

    const metadata = await getArtifactMetadata(result.artifactId);

    expect(metadata.anchors).toHaveLength(2);
    expect(metadata.anchors[0].heading).toBe('Coverage Criteria');
    expect(metadata.anchors[1].heading).toBe('Limitations');
  });

  it('returns null for non-existent artifact', async () => {
    const result = await getArtifact('nonexistent_artifact_id');
    expect(result).toBeNull();
  });
});

describe('Evidence-Gated Delegation', () => {
  it('DELEGATION_STATUS constants are defined (legacy)', () => {
    expect(DELEGATION_STATUS.SUSPECTED).toBe('suspected');
    expect(DELEGATION_STATUS.ACTIVE).toBe('active');
    expect(DELEGATION_STATUS.CONFIRMED).toBe('confirmed');
    expect(DELEGATION_STATUS.EXPIRED).toBe('expired');
  });

  it('static delegations have evidenceLevel and effectiveness fields', () => {
    // v2.1.1: All entries should have separated axes
    for (const [key, delegation] of Object.entries(PAYER_DELEGATIONS)) {
      expect(delegation.evidenceLevel).toBeDefined();
      expect(delegation.effectiveness).toBeDefined();
      expect(['suspected', 'confirmed']).toContain(delegation.evidenceLevel);
      expect(['pending', 'effective', 'expired']).toContain(delegation.effectiveness);
    }
  });

  it('delegation with evidence has evidenceLevel=confirmed', () => {
    const bcbsla = PAYER_DELEGATIONS['bcbs-louisiana'];

    // v2.1.1: Use new separated axes
    expect(bcbsla.evidenceLevel).toBe('confirmed');
    expect(bcbsla.effectiveness).toBe('effective');
    expect(bcbsla.evidence).not.toBeNull();
    expect(bcbsla.evidence.sourceUrl).toBeTruthy();
    expect(bcbsla.evidence.quotes).toBeDefined();
  });

  it('delegation without evidence has evidenceLevel=suspected', () => {
    const cigna = PAYER_DELEGATIONS['cigna-internal'];

    // v2.1.1: Use new separated axes
    expect(cigna.evidenceLevel).toBe('suspected');
    expect(cigna.evidence).toBeNull();
  });

  it('getDelegation returns basic info', () => {
    const delegation = getDelegation('bcbsla');

    expect(delegation).not.toBeNull();
    expect(delegation.delegatesTo).toBe('carelon');
    expect(delegation.payerName).toBe('BCBS Louisiana');
  });

  it('getDelegationStatus includes computed status', () => {
    const status = getDelegationStatus('bcbsla');

    expect(status).not.toBeNull();
    expect(status.status).toBe(DELEGATION_STATUS.ACTIVE);
    expect(status.delegatesTo).toBe('carelon');
  });

  it('storeDetectedDelegation updates runtime evidence', () => {
    const testPayerId = 'test-payer-runtime';

    // Store detected delegation
    storeDetectedDelegation(testPayerId, {
      delegatesTo: 'carelon',
      confidence: 0.95,
      sourceUrl: 'https://example.com/policy',
      quotes: ['Now managed by Carelon'],
    });

    const detected = getDetectedDelegation(testPayerId);

    expect(detected).not.toBeNull();
    expect(detected.delegatesTo).toBe('carelon');
    expect(detected.confidence).toBe(0.95);
    expect(detected.detectedAt).toBeTruthy();
  });

  it('getDelegationStatus uses detected evidence to promote status', () => {
    // This test uses a payer in static map with suspected status
    const payerId = 'cigna';

    // Get initial status (should be suspected due to no evidence)
    const initialStatus = getDelegationStatus(payerId);
    expect(initialStatus.status).toBe(DELEGATION_STATUS.SUSPECTED);

    // Store high-confidence detected evidence
    storeDetectedDelegation(payerId, {
      delegatesTo: 'evicore',
      confidence: 0.9,
      sourceUrl: 'https://example.com/cigna-evicore',
      quotes: ['Lab benefits managed by eviCore'],
    });

    // Now status should be active
    const updatedStatus = getDelegationStatus(payerId);
    expect(updatedStatus.status).toBe(DELEGATION_STATUS.ACTIVE);
    expect(updatedStatus.evidence.confidence).toBe(0.9);
  });

  it('returns null for unknown payer', () => {
    const status = getDelegationStatus('unknown-payer-xyz');
    expect(status).toBeNull();
  });
});
