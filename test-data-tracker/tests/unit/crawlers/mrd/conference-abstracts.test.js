/**
 * Tests for conference abstract crawler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetText } = vi.hoisted(() => ({
  mockGetText: vi.fn(),
}));

// Mock dependencies before importing
vi.mock('../../../../src/utils/http.js', () => ({
  createHttpClient: vi.fn(() => ({
    getText: mockGetText,
    get: vi.fn(),
    getStats: vi.fn(() => ({})),
  })),
}));

vi.mock('../../../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../../src/db/mrd-client.js', () => ({
  query: vi.fn(),
  close: vi.fn(),
}));

vi.mock('../../../../src/crawlers/publication-resolver.js', () => ({
  resolvePublication: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../../src/crawlers/physician-db-writer.js', () => ({
  writePublicationToPhysicianDb: vi.fn().mockResolvedValue({ id: 1, isNew: true }),
  writeSourceItemEdge: vi.fn().mockResolvedValue({ id: 1, isNew: true }),
  isPhysicianDbConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock('../../../../src/crawlers/publication-bridge.js', () => ({
  bridgeToProposals: vi.fn().mockResolvedValue({ proposalsCreated: 0, skipped: true }),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      constructor() {
        this.messages = {
          create: vi.fn().mockResolvedValue({
            content: [{
              text: JSON.stringify({
                publications: [
                  {
                    title: 'ctDNA-guided adjuvant therapy: CIRCULATE results',
                    authors: 'Smith et al',
                    abstract_number: 'Abstract 3500',
                    presentation_type: 'oral',
                    year: '2025',
                    evidence_type: 'rct_results',
                    cancer_types: ['colorectal'],
                    clinical_context: 'Phase III trial showing ctDNA-guided approach.',
                    test_names: ['Signatera'],
                  },
                  {
                    title: 'Guardant Reveal in bladder cancer MRD',
                    authors: 'Jones et al',
                    abstract_number: 'Poster P-456',
                    presentation_type: 'poster',
                    year: '2025',
                    evidence_type: 'observational',
                    cancer_types: ['bladder'],
                    clinical_context: 'Validation of Guardant Reveal for MRD.',
                    test_names: ['Guardant Reveal'],
                  },
                ],
                extraction_notes: 'Found 2 MRD-related abstracts.',
              }),
            }],
          }),
        };
      }
    },
  };
});

vi.mock('../../../../src/crawlers/publication-prompts.js', () => ({
  getPromptForSourceType: vi.fn().mockReturnValue('Extract conference abstracts...'),
  getDefaultGuardrail: vi.fn().mockReturnValue('Conference abstract; preliminary results'),
  normalizeEvidenceType: vi.fn((t) => t || 'observational'),
  normalizeCancerTypes: vi.fn((t) => t || []),
}));

// Import after mocks
import { crawlConferenceAbstracts } from '../../../../src/crawlers/mrd/conference-abstracts.js';
import { query } from '../../../../src/db/mrd-client.js';
import { writePublicationToPhysicianDb, writeSourceItemEdge } from '../../../../src/crawlers/physician-db-writer.js';
import { resolvePublication } from '../../../../src/crawlers/publication-resolver.js';
import { bridgeToProposals } from '../../../../src/crawlers/publication-bridge.js';

const ASCO_SOURCE = {
  id: 10,
  source_key: 'asco-annual-meeting',
  source_type: 'conference',
  display_name: 'ASCO Annual Meeting Abstracts',
  base_url: 'https://meetings.asco.org/abstracts-presentations/search',
  last_checked_at: null,
  stale_threshold_days: 400,
};

describe('crawlConferenceAbstracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetText.mockResolvedValue('<html><body>Conference results page</body></html>');
  });

  it('returns empty stats when no conference sources exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await crawlConferenceAbstracts();

    expect(result.success).toBe(true);
    expect(result.stats.sources).toBe(0);
    expect(result.stats.abstractsFound).toBe(0);
  });

  it('searches each conference with all search terms', async () => {
    query
      .mockResolvedValueOnce({ rows: [ASCO_SOURCE] })
      .mockResolvedValue({ rows: [] });

    const result = await crawlConferenceAbstracts();

    expect(result.success).toBe(true);
    expect(result.stats.sources).toBe(1);
    // 6 search terms
    expect(result.stats.searchesPerformed).toBe(6);
  }, 30000);

  it('deduplicates abstracts across search terms', async () => {
    query
      .mockResolvedValueOnce({ rows: [ASCO_SOURCE] })
      .mockResolvedValue({ rows: [] });

    const result = await crawlConferenceAbstracts();

    // Claude returns 2 abstracts per search, deduped by abstract_number
    expect(result.stats.relevant).toBe(2);
  }, 30000);

  it('respects dryRun flag', async () => {
    query
      .mockResolvedValueOnce({ rows: [ASCO_SOURCE] })
      .mockResolvedValue({ rows: [] });

    const result = await crawlConferenceAbstracts({ dryRun: true });

    expect(result.success).toBe(true);
    expect(writePublicationToPhysicianDb).not.toHaveBeenCalled();
    expect(writeSourceItemEdge).not.toHaveBeenCalled();
  }, 30000);

  it('filters by sourceKey when provided', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await crawlConferenceAbstracts({ sourceKey: 'esmo-congress' });

    const queryCall = query.mock.calls[0];
    expect(queryCall[0]).toContain('source_key = $');
    expect(queryCall[1]).toContain('esmo-congress');
  });

  it('writes abstracts to physician DB and bridges to proposals', async () => {
    query
      .mockResolvedValueOnce({ rows: [ASCO_SOURCE] })
      .mockResolvedValue({ rows: [] });

    writePublicationToPhysicianDb.mockResolvedValue({ id: 42, isNew: true });

    const result = await crawlConferenceAbstracts();

    expect(writePublicationToPhysicianDb).toHaveBeenCalled();
    expect(bridgeToProposals).toHaveBeenCalled();
    expect(result.stats.written).toBeGreaterThan(0);
  }, 30000);

  it('resolves abstracts to PubMed when possible', async () => {
    resolvePublication.mockResolvedValueOnce([{
      pmid: '39876543',
      title: 'ctDNA-guided adjuvant therapy',
      doi: '10.1200/JCO.2025.published',
      journal: 'JCO',
      publicationDate: '2025-06-15',
      abstract: 'Full abstract...',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/39876543/',
    }]);

    query
      .mockResolvedValueOnce({ rows: [ASCO_SOURCE] })
      .mockResolvedValue({ rows: [] });

    const result = await crawlConferenceAbstracts();

    expect(result.stats.resolved).toBeGreaterThanOrEqual(1);
  }, 30000);
});
