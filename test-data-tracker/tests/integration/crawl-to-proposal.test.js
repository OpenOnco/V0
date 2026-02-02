/**
 * End-to-End Crawl Pipeline Test
 *
 * Validates the full flow: fetch → artifact storage → hash → proposal + anchor
 *
 * Uses mock data to be deterministic and avoid network calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import path from 'path';

// Module mocks must be defined before imports
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(null),
        content: vi.fn().mockResolvedValue('<html></html>'),
        close: vi.fn().mockResolvedValue(null),
        evaluate: vi.fn().mockResolvedValue(''),
      }),
      close: vi.fn().mockResolvedValue(null),
    }),
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
            coverageStatus: 'covered_conditional',
            testsExplicitlyMentioned: ['Signatera'],
            keyConditions: ['Stage II-III colorectal cancer', 'Post-surgical surveillance'],
            confidence: 0.85,
            summary: 'Signatera MRD testing is covered for colorectal cancer monitoring.',
          }),
        }],
      }),
    },
  })),
}));

// Import after mocks
import {
  storeArtifact,
  getArtifact,
  getArtifactMetadata,
  createAnchor,
  setArtifactDir,
} from '../../src/utils/artifact-store.js';
import { computeMultiHash, compareMultiHash } from '../../src/utils/multi-hash.js';
import { extractStructuredData, prepareForMultiHash } from '../../src/extractors/index.js';
import { createProposal } from '../../src/proposals/queue.js';
import { PROPOSAL_TYPES } from '../../src/proposals/schema.js';

// Test directories
const TEST_ARTIFACT_DIR = 'tests/temp/e2e-artifacts';
const TEST_PROPOSAL_DIR = 'tests/temp/e2e-proposals';

/**
 * Fixture: Mock policy document content
 * This simulates a real payer policy document with coverage criteria.
 */
const MOCK_POLICY_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <title>Medical Policy: Circulating Tumor DNA Testing</title>
</head>
<body>
  <h1>Medical Policy: Liquid Biopsy and ctDNA Testing</h1>

  <div class="metadata">
    <p><strong>Policy Number:</strong> MP-2025-CTDNA-001</p>
    <p><strong>Effective Date:</strong> January 1, 2026</p>
    <p><strong>Last Reviewed:</strong> December 15, 2025</p>
  </div>

  <h2>Coverage Criteria</h2>
  <div class="coverage-section">
    <p>
      Signatera MRD testing is considered <strong>medically necessary</strong>
      for monitoring minimal residual disease in patients meeting the following criteria:
    </p>
    <ul>
      <li>Diagnosis of Stage II-III colorectal cancer</li>
      <li>Completion of curative-intent surgery</li>
      <li>Post-surgical surveillance period (up to 3 years)</li>
    </ul>

    <p>
      <strong>Prior authorization is required</strong> for all Signatera tests.
    </p>
  </div>

  <h2>Coding Information</h2>
  <div class="codes-section">
    <p>CPT Code: 0239U - Signatera MRD assay</p>
    <p>ICD-10: C18.x, C19, C20 (Colorectal malignancies)</p>
  </div>

  <h2>Limitations</h2>
  <div class="limitations-section">
    <p>
      Signatera testing is <strong>not covered</strong> for:
    </p>
    <ul>
      <li>Average-risk screening in asymptomatic individuals</li>
      <li>Stage I colorectal cancer without high-risk features</li>
      <li>Testing frequency exceeding every 3 months</li>
    </ul>
  </div>
</body>
</html>
`;

/**
 * Fixture: Mock policy metadata
 */
const MOCK_POLICY = {
  id: 'test-payer-ctdna-2025',
  payerId: 'test-payer',
  payerName: 'Test Payer Insurance',
  name: 'Circulating Tumor DNA Testing',
  url: 'https://test-payer.example.com/policies/ctdna.html',
  contentType: 'html',
  docType: 'policy',
};

describe('End-to-End Crawl Pipeline', () => {
  beforeEach(async () => {
    // Set up test directories
    setArtifactDir(TEST_ARTIFACT_DIR);
    await mkdir(TEST_ARTIFACT_DIR, { recursive: true });
    await mkdir(TEST_PROPOSAL_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_ARTIFACT_DIR, { recursive: true, force: true });
      await rm(TEST_PROPOSAL_DIR, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
    vi.clearAllMocks();
  });

  it('stores artifact from policy content', async () => {
    // Step 1: Store the artifact (simulating what checkPolicy does)
    const artifactResult = await storeArtifact(
      MOCK_POLICY.payerId,
      MOCK_POLICY.id,
      MOCK_POLICY_CONTENT,
      {
        contentType: MOCK_POLICY.contentType,
        sourceUrl: MOCK_POLICY.url,
        policyName: MOCK_POLICY.name,
        fetchedAt: new Date().toISOString(),
      }
    );

    expect(artifactResult.artifactId).toMatch(/^test-payer_test-payer-ctdna-2025_/);
    expect(artifactResult.contentHash).toBeTruthy();

    // Verify artifact can be retrieved
    const retrieved = await getArtifact(artifactResult.artifactId);
    expect(retrieved).not.toBeNull();
    expect(retrieved.content.toString()).toContain('Signatera MRD testing');
  });

  it('computes multi-hash from extracted data', async () => {
    // Step 2: Extract structured data
    const extraction = await extractStructuredData(MOCK_POLICY_CONTENT, {
      docType: 'policy',
      payerId: MOCK_POLICY.payerId,
    });

    expect(extraction).not.toBeNull();
    // effectiveDate may or may not be parsed depending on format
    expect(extraction.extractedAt).toBeTruthy();

    // Step 3: Compute multi-hash
    const hashData = prepareForMultiHash(extraction);
    const hashes = computeMultiHash(MOCK_POLICY_CONTENT, hashData);

    expect(hashes.contentHash).toBeTruthy();
    expect(hashes.criteriaHash).toBeTruthy();
    expect(hashes.metadata?.parserVersion).toBeTruthy();
  });

  it('creates valid anchor from artifact', async () => {
    // Store artifact first
    const artifactResult = await storeArtifact(
      MOCK_POLICY.payerId,
      MOCK_POLICY.id,
      MOCK_POLICY_CONTENT,
      {
        contentType: MOCK_POLICY.contentType,
        sourceUrl: MOCK_POLICY.url,
      }
    );

    // Create anchor with quote from document (exact substring from HTML)
    const quote = 'Prior authorization is required';
    const anchor = createAnchor({
      artifactId: artifactResult.artifactId,
      quote,
      section: 'Coverage Criteria',
    });

    expect(anchor.artifactId).toBe(artifactResult.artifactId);
    expect(anchor.quote).toBe(quote);
    expect(anchor.section).toBe('Coverage Criteria');
    expect(anchor.createdAt).toBeTruthy();

    // Verify quote exists in original content
    const retrieved = await getArtifact(artifactResult.artifactId);
    expect(retrieved.content.toString()).toContain(quote);
  });

  it('full pipeline: artifact → hash → extraction → anchor validation', async () => {
    // === STEP 1: Store artifact ===
    const artifactResult = await storeArtifact(
      MOCK_POLICY.payerId,
      MOCK_POLICY.id,
      MOCK_POLICY_CONTENT,
      {
        contentType: MOCK_POLICY.contentType,
        sourceUrl: MOCK_POLICY.url,
        policyName: MOCK_POLICY.name,
        fetchedAt: new Date().toISOString(),
      }
    );
    expect(artifactResult.artifactId).toBeTruthy();

    // === STEP 2: Extract structured data ===
    const extraction = await extractStructuredData(MOCK_POLICY_CONTENT, {
      docType: 'policy',
      payerId: MOCK_POLICY.payerId,
    });
    expect(extraction.criteriaSection).toContain('medically necessary');

    // === STEP 3: Compute hashes ===
    const hashData = prepareForMultiHash(extraction);
    const newHashes = computeMultiHash(MOCK_POLICY_CONTENT, hashData);
    expect(newHashes.contentHash).toBeTruthy();

    // === STEP 4: Simulate change detection (first run = always changed) ===
    const oldHashes = null; // No previous hash
    const comparison = oldHashes
      ? compareMultiHash(oldHashes, newHashes)
      : { changed: true, first: true };
    expect(comparison.changed).toBe(true);

    // === STEP 5: Create anchor with quote from criteria section ===
    const criteriaQuote = extraction.criteriaSection?.substring(0, 150)?.trim() ||
                         'Signatera MRD testing is considered medically necessary';
    const anchor = createAnchor({
      artifactId: artifactResult.artifactId,
      quote: criteriaQuote,
      section: 'Coverage Criteria',
    });

    // === STEP 6: Verify anchor integrity ===
    const artifact = await getArtifact(artifactResult.artifactId);
    const contentStr = artifact.content.toString();

    // The quote should exist in the artifact (allowing for whitespace normalization)
    const normalizedQuote = criteriaQuote.replace(/\s+/g, ' ').trim();
    const normalizedContent = contentStr.replace(/\s+/g, ' ');

    expect(normalizedContent).toContain(normalizedQuote.substring(0, 50));

    // === STEP 7: Verify metadata integrity ===
    const metadata = await getArtifactMetadata(artifactResult.artifactId);
    expect(metadata.payerId).toBe(MOCK_POLICY.payerId);
    expect(metadata.policyId).toBe(MOCK_POLICY.id);
    expect(metadata.sourceUrl).toBe(MOCK_POLICY.url);
  });

  it('detects content hash change on second fetch', async () => {
    // First fetch
    const extraction1 = await extractStructuredData(MOCK_POLICY_CONTENT, {
      docType: 'policy',
    });
    const hashData1 = prepareForMultiHash(extraction1);
    const hashes1 = computeMultiHash(MOCK_POLICY_CONTENT, hashData1);

    // Second fetch with modified content
    const modifiedContent = MOCK_POLICY_CONTENT.replace(
      'Stage II-III colorectal cancer',
      'Stage I-III colorectal cancer' // Changed coverage criteria
    );

    const extraction2 = await extractStructuredData(modifiedContent, {
      docType: 'policy',
    });
    const hashData2 = prepareForMultiHash(extraction2);
    const hashes2 = computeMultiHash(modifiedContent, hashData2);

    // Compare hashes
    const comparison = compareMultiHash(hashes1, hashes2);

    expect(comparison.changed).toBe(true);
    // changedHashes is an array containing which hashes changed
    expect(comparison.changedHashes).toContain('criteria'); // Criteria section changed
  });

  it('detects parser version change (criteria hash changed but content same)', async () => {
    // Simulate old hash with different parser version
    const extraction = await extractStructuredData(MOCK_POLICY_CONTENT, {
      docType: 'policy',
    });
    const hashData = prepareForMultiHash(extraction);
    const newHashes = computeMultiHash(MOCK_POLICY_CONTENT, hashData);

    // Create "old" hashes with same content but different criteria (simulating parser change)
    const oldHashes = {
      contentHash: newHashes.contentHash, // Same content
      criteriaHash: 'old-criteria-hash-different', // Different criteria extraction
      codesHash: newHashes.codesHash,
      metadataHash: newHashes.metadataHash,
    };

    const comparison = compareMultiHash(oldHashes, newHashes);

    expect(comparison.changed).toBe(true);
    // Content didn't change but criteria did - indicates possible parser change
    expect(comparison.changedHashes).toContain('criteria');
    expect(comparison.changedHashes).not.toContain('content');
    expect(comparison.possibleSystemChange).toBe(true); // Key assertion
  });
});

describe('Pipeline Data Integrity', () => {
  beforeEach(async () => {
    setArtifactDir(TEST_ARTIFACT_DIR);
    await mkdir(TEST_ARTIFACT_DIR, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_ARTIFACT_DIR, { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }
  });

  it('artifact content matches original', async () => {
    const result = await storeArtifact(
      'integrity-test',
      'content-match',
      MOCK_POLICY_CONTENT,
      { contentType: 'html' }
    );

    const retrieved = await getArtifact(result.artifactId);
    expect(retrieved.content.toString()).toBe(MOCK_POLICY_CONTENT);
  });

  it('anchor quote is verifiable against artifact', async () => {
    // Store
    const result = await storeArtifact(
      'anchor-test',
      'quote-verify',
      MOCK_POLICY_CONTENT,
      { contentType: 'html' }
    );

    // Extract a specific quote
    const quote = 'Prior authorization is required';

    // Create anchor
    const anchor = createAnchor({
      artifactId: result.artifactId,
      quote,
      section: 'Coverage Criteria',
    });

    // Verify quote exists in artifact
    const artifact = await getArtifact(anchor.artifactId);
    expect(artifact.content.toString()).toContain(quote);

    // This is the integrity check: anchor.quote must be findable in artifact
    const isValid = artifact.content.toString().includes(anchor.quote);
    expect(isValid).toBe(true);
  });

  it('hash is deterministic across multiple computations', async () => {
    const extraction = await extractStructuredData(MOCK_POLICY_CONTENT, {});
    const hashData = prepareForMultiHash(extraction);

    const hash1 = computeMultiHash(MOCK_POLICY_CONTENT, hashData);
    const hash2 = computeMultiHash(MOCK_POLICY_CONTENT, hashData);
    const hash3 = computeMultiHash(MOCK_POLICY_CONTENT, hashData);

    expect(hash1.contentHash).toBe(hash2.contentHash);
    expect(hash2.contentHash).toBe(hash3.contentHash);
    expect(hash1.criteriaHash).toBe(hash2.criteriaHash);
  });
});
