/**
 * Tests for journal RSS feed crawler
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock ref is available inside hoisted vi.mock calls
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

// Import after mocks
import { crawlJournalRSS } from '../../../../src/crawlers/mrd/journal-rss.js';
import { query } from '../../../../src/db/mrd-client.js';
import { writePublicationToPhysicianDb, writeSourceItemEdge } from '../../../../src/crawlers/physician-db-writer.js';
import { bridgeToProposals } from '../../../../src/crawlers/publication-bridge.js';

// Sample RSS feed XML
const SAMPLE_JCO_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Journal of Clinical Oncology</title>
    <item>
      <title>Circulating tumor DNA-guided adjuvant therapy in stage III colon cancer</title>
      <link>https://doi.org/10.1200/JCO.2025.12345</link>
      <description>A phase III trial evaluating ctDNA-guided treatment decisions in stage III CRC patients.</description>
      <pubDate>Mon, 20 Jan 2026 00:00:00 GMT</pubDate>
      <guid>jco-2025-12345</guid>
    </item>
    <item>
      <title>Cardiac safety of anthracyclines in pediatric oncology</title>
      <link>https://doi.org/10.1200/JCO.2025.99999</link>
      <description>Long-term cardiac outcomes in children treated with anthracyclines.</description>
      <pubDate>Mon, 20 Jan 2026 00:00:00 GMT</pubDate>
      <guid>jco-2025-99999</guid>
    </item>
    <item>
      <title>Signatera MRD detection in bladder cancer surveillance</title>
      <link>https://doi.org/10.1200/JCO.2025.67890</link>
      <description>Natera Signatera ctDNA assay for minimal residual disease monitoring.</description>
      <pubDate>Tue, 21 Jan 2026 00:00:00 GMT</pubDate>
      <guid>jco-2025-67890</guid>
    </item>
  </channel>
</rss>`;

const SOURCE_ROW = {
  id: 1,
  source_key: 'rss-jco',
  source_type: 'literature',
  display_name: 'Journal of Clinical Oncology (RSS)',
  base_url: 'https://ascopubs.org/action/showFeed?type=etoc&feed=rss&jc=jco',
  last_checked_at: null,
  stale_threshold_days: 7,
};

describe('crawlJournalRSS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetText.mockResolvedValue(SAMPLE_JCO_RSS);
  });

  it('returns empty stats when no RSS sources exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await crawlJournalRSS();

    expect(result.success).toBe(true);
    expect(result.stats.sources).toBe(0);
    expect(result.stats.items).toBe(0);
  });

  it('fetches and filters RSS feed for MRD relevance', async () => {
    query
      // getActiveRSSSources
      .mockResolvedValueOnce({ rows: [SOURCE_ROW] })
      // isGuidProcessed — return not-processed for all relevant items
      .mockResolvedValue({ rows: [] });

    const result = await crawlJournalRSS();

    expect(result.success).toBe(true);
    expect(result.stats.sources).toBe(1);
    expect(result.stats.items).toBe(3);
    // 2 relevant: ctDNA article + Signatera article. Cardiac is irrelevant.
    expect(result.stats.relevant).toBe(2);
  });

  it('writes relevant publications to physician DB', async () => {
    query
      .mockResolvedValueOnce({ rows: [SOURCE_ROW] })
      .mockResolvedValue({ rows: [] });

    const result = await crawlJournalRSS();

    expect(result.stats.written).toBe(2);
    expect(writePublicationToPhysicianDb).toHaveBeenCalledTimes(2);

    // Verify publication data structure
    const firstCall = writePublicationToPhysicianDb.mock.calls[0];
    expect(firstCall[0]).toHaveProperty('title');
    expect(firstCall[0]).toHaveProperty('doi');
    expect(firstCall[1]).toHaveProperty('discoveredVia');
    expect(firstCall[1].discoveredVia).toContain('journal-rss:rss-jco');
  });

  it('respects dryRun flag — does not write to DB', async () => {
    query
      .mockResolvedValueOnce({ rows: [SOURCE_ROW] })
      .mockResolvedValue({ rows: [] });

    const result = await crawlJournalRSS({ dryRun: true });

    expect(result.success).toBe(true);
    expect(writePublicationToPhysicianDb).not.toHaveBeenCalled();
    expect(writeSourceItemEdge).not.toHaveBeenCalled();
  });

  it('filters by sourceKey when provided', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await crawlJournalRSS({ sourceKey: 'rss-jco' });

    const queryCall = query.mock.calls[0];
    expect(queryCall[0]).toContain('source_key = $');
    expect(queryCall[1]).toContain('rss-jco');
  });

  it('skips already-processed GUIDs', async () => {
    query
      .mockResolvedValueOnce({ rows: [SOURCE_ROW] })
      // First relevant item GUID check: already processed
      .mockResolvedValueOnce({ rows: [{ 1: 1 }] })
      // Second relevant item GUID check: not processed
      .mockResolvedValueOnce({ rows: [] })
      // Remaining queries (record processed, update source)
      .mockResolvedValue({ rows: [] });

    const result = await crawlJournalRSS();

    expect(result.stats.alreadyProcessed).toBe(1);
    expect(result.stats.written).toBe(1);
  });

  it('handles RSS fetch failure gracefully', async () => {
    query.mockResolvedValueOnce({ rows: [SOURCE_ROW] });
    mockGetText.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await crawlJournalRSS();

    expect(result.success).toBe(true);
    expect(result.stats.failed).toBe(1);
    expect(result.stats.items).toBe(0);
  });

  it('bridges new publications to proposals', async () => {
    query
      .mockResolvedValueOnce({ rows: [SOURCE_ROW] })
      .mockResolvedValue({ rows: [] });

    writePublicationToPhysicianDb.mockResolvedValue({ id: 42, isNew: true });

    await crawlJournalRSS();

    expect(bridgeToProposals).toHaveBeenCalled();
  });

  it('extracts DOI from RSS item links', async () => {
    query
      .mockResolvedValueOnce({ rows: [SOURCE_ROW] })
      .mockResolvedValue({ rows: [] });

    await crawlJournalRSS();

    // The ctDNA article link is https://doi.org/10.1200/JCO.2025.12345
    // The DOI should be extracted and passed to the publication
    const pubCalls = writePublicationToPhysicianDb.mock.calls;
    const dois = pubCalls.map(c => c[0].doi).filter(Boolean);
    expect(dois.length).toBeGreaterThan(0);
    expect(dois[0]).toMatch(/^10\./);
  });
});
