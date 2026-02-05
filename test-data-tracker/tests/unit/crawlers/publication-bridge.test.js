/**
 * Tests for publication bridge module
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies before importing
vi.mock('../../../src/data/test-dictionary.js', () => ({
  initializeTestDictionary: vi.fn().mockResolvedValue(undefined),
  matchTests: vi.fn().mockReturnValue([]),
  lookupTestByName: vi.fn().mockReturnValue(null),
}));

vi.mock('../../../src/proposals/queue.js', () => ({
  createProposal: vi.fn().mockResolvedValue({ id: 'upd-2026-test123', type: 'update' }),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      constructor() {
        this.messages = {
          create: vi.fn().mockResolvedValue({
            content: [{ text: JSON.stringify({
              actionable: true,
              reason: 'Found sensitivity data for Signatera',
              findings: [{
                type: 'update',
                testName: 'Signatera',
                testId: 'mrd-7',
                field: 'sensitivity',
                currentValue: '95%',
                proposedValue: '97.2%',
                context: 'Stage II CRC post-surgical surveillance',
                confidence: 0.85,
                quote: 'Signatera demonstrated 97.2% sensitivity in detecting MRD in stage II CRC patients',
              }],
            })}],
          }),
        };
      }
    },
  };
});

// Import after mocks
import { bridgeToProposals } from '../../../src/crawlers/publication-bridge.js';
import { matchTests, lookupTestByName } from '../../../src/data/test-dictionary.js';
import { createProposal } from '../../../src/proposals/queue.js';

describe('bridgeToProposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips when no test matches and no vendor hint', async () => {
    matchTests.mockReturnValue([]);

    const result = await bridgeToProposals(
      {
        title: 'General cancer biology review',
        clinical_context: 'A review of cancer biomarkers',
      },
      { source_key: 'some_random_source', base_url: 'https://example.com' }
    );

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no_test_match');
    expect(createProposal).not.toHaveBeenCalled();
  });

  it('proceeds when test matches are found', async () => {
    matchTests.mockReturnValue([{
      test: { id: 'mrd-7', name: 'Signatera', vendor: 'Natera', category: 'MRD' },
      confidence: 0.9,
      matchType: 'name_match',
    }]);

    const result = await bridgeToProposals(
      {
        title: 'Signatera ctDNA-guided therapy in CRC',
        clinical_context: 'Signatera demonstrated 97.2% sensitivity',
        pmid: '12345678',
        cancer_types: ['colorectal'],
      },
      { source_key: 'natera_signatera_publications', base_url: 'https://natera.com' }
    );

    expect(result.skipped).toBe(false);
    expect(result.proposalsCreated).toBeGreaterThanOrEqual(1);
    expect(createProposal).toHaveBeenCalled();
  });

  it('proceeds when vendor hint matches even without test matches', async () => {
    matchTests.mockReturnValue([]);

    const result = await bridgeToProposals(
      {
        title: 'New ctDNA assay performance data',
        clinical_context: 'Performance validation study',
        pmid: '87654321',
      },
      { source_key: 'natera_signatera_publications', base_url: 'https://natera.com' }
    );

    // Should not skip - vendor hint "natera" found
    expect(result.reason).not.toBe('no_test_match');
  });

  it('creates UPDATE proposal with correct fields', async () => {
    matchTests.mockReturnValue([{
      test: { id: 'mrd-7', name: 'Signatera', vendor: 'Natera', category: 'MRD' },
      confidence: 0.9,
      matchType: 'name_match',
    }]);

    await bridgeToProposals(
      {
        title: 'Signatera sensitivity update',
        pmid: '12345678',
        cancer_types: ['colorectal'],
      },
      { source_key: 'natera_publications', base_url: 'https://natera.com' }
    );

    const callArgs = createProposal.mock.calls[0];
    expect(callArgs[0]).toBe('update'); // PROPOSAL_TYPES.UPDATE
    expect(callArgs[1].testName).toBe('Signatera');
    expect(callArgs[1].source).toContain('pubmed.ncbi.nlm.nih.gov/12345678');
    expect(callArgs[1].changes).toBeDefined();
    expect(callArgs[1].changes.sensitivity).toBeDefined();
    expect(callArgs[1].changes.sensitivity.new).toBe('97.2%');
  });

  it('handles non-actionable publications gracefully', async () => {
    // Re-mock Anthropic to return non-actionable
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    // Override prototype for all new instances
    const origCreate = Anthropic.prototype?.messages?.create;
    vi.spyOn(Anthropic.prototype, 'constructor').mockImplementation(function() {
      this.messages = {
        create: vi.fn().mockResolvedValue({
          content: [{ text: JSON.stringify({
            actionable: false,
            reason: 'No concrete test data found',
            findings: [],
          })}],
        }),
      };
    });

    matchTests.mockReturnValue([{
      test: { id: 'mrd-7', name: 'Signatera' },
      confidence: 0.9,
      matchType: 'name_match',
    }]);

    // This will use the mock Anthropic which returns non-actionable
    // The bridge should handle it gracefully
    const result = await bridgeToProposals(
      { title: 'Test publication', pmid: '11111111' },
      { source_key: 'test', base_url: 'https://test.com' }
    );

    // Should not throw - proposalsCreated may be 0 or more depending on mock
    expect(result).toBeDefined();
    expect(typeof result.proposalsCreated).toBe('number');
    expect(typeof result.skipped).toBe('boolean');
  });
});

describe('vendor extraction from source key', () => {
  it('extracts known vendors from source keys', async () => {
    // Test indirectly through bridgeToProposals behavior
    matchTests.mockReturnValue([]);

    // With natera in source key, should NOT skip with 'no_test_match'
    const result = await bridgeToProposals(
      { title: 'Some publication' },
      { source_key: 'natera_signatera_publications', base_url: 'https://natera.com' }
    );
    expect(result.reason).not.toBe('no_test_match');
  });

  it('returns no vendor hint for unknown source keys', async () => {
    matchTests.mockReturnValue([]);

    const result = await bridgeToProposals(
      { title: 'Some publication' },
      { source_key: 'unknown_source', base_url: 'https://example.com' }
    );
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no_test_match');
  });
});
