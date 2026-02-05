/**
 * Tests for source discovery audit tool
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

// Mock dependencies before importing
vi.mock('../../../../src/utils/http.js', () => ({
  createHttpClient: vi.fn(() => ({
    get: mockGet,
    getText: vi.fn(),
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

// Import after mocks
import { discoverNewSources } from '../../../../src/crawlers/mrd/source-discovery.js';
import { query } from '../../../../src/db/mrd-client.js';

describe('discoverNewSources', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    mockGet.mockResolvedValue({ status: 200 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Run an async function with fake timers, advancing all timers to completion */
  async function runWithTimers(fn) {
    const promise = fn();
    await vi.runAllTimersAsync();
    return promise;
  }

  it('returns stale sources that exceed threshold', async () => {
    // Mock: getSourcesWithStaleness
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            source_key: 'rss-jco',
            display_name: 'JCO RSS',
            base_url: 'https://example.com/rss',
            source_type: 'literature',
            access_method: 'rss',
            last_checked_at: new Date('2025-01-01'),
            stale_threshold_days: 7,
            days_since_check: 400,
          },
          {
            id: 2,
            source_key: 'pubmed',
            display_name: 'PubMed',
            base_url: 'https://eutils.ncbi.nlm.nih.gov',
            source_type: 'literature',
            access_method: 'api',
            last_checked_at: new Date('2026-02-04'),
            stale_threshold_days: 2,
            days_since_check: 1,
          },
        ],
      })
      // Mock: getRegisteredSourceUrls
      .mockResolvedValueOnce({
        rows: [
          { base_url: 'https://example.com/rss', source_key: 'rss-jco' },
          { base_url: 'https://eutils.ncbi.nlm.nih.gov', source_key: 'pubmed' },
        ],
      })
      // Mock: PubMed affiliations
      .mockResolvedValueOnce({ rows: [] });

    const result = await runWithTimers(() => discoverNewSources());

    expect(result.stale).toHaveLength(1);
    expect(result.stale[0].sourceKey).toBe('rss-jco');
    expect(result.stale[0].daysSinceCheck).toBe(400);
    expect(result.stale[0].overdueDays).toBe(393);
  });

  it('flags never-checked sources as stale', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: 3,
          source_key: 'new-source',
          display_name: 'New Source',
          base_url: 'https://newsource.com',
          source_type: 'literature',
          access_method: 'rss',
          last_checked_at: null,
          stale_threshold_days: 7,
          days_since_check: null,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ base_url: 'https://newsource.com', source_key: 'new-source' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runWithTimers(() => discoverNewSources());

    expect(result.stale).toHaveLength(1);
    expect(result.stale[0].neverChecked).toBe(true);
  });

  it('detects broken URLs', async () => {
    // Source with inaccessible URL
    mockGet.mockRejectedValue(new Error('ECONNREFUSED'));

    query
      .mockResolvedValueOnce({
        rows: [{
          id: 4,
          source_key: 'broken-source',
          display_name: 'Broken Source',
          base_url: 'https://broken.example.com',
          source_type: 'literature',
          access_method: 'api',
          last_checked_at: new Date('2026-02-04'),
          stale_threshold_days: 7,
          days_since_check: 1,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ base_url: 'https://broken.example.com', source_key: 'broken-source' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runWithTimers(() => discoverNewSources());

    expect(result.broken).toHaveLength(1);
    expect(result.broken[0].sourceKey).toBe('broken-source');
    expect(result.broken[0].error).toContain('ECONNREFUSED');
  });

  it('skips health check for manual access methods', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: 5,
          source_key: 'nccn-colorectal',
          display_name: 'NCCN Colorectal',
          base_url: 'https://nccn.org/guidelines',
          source_type: 'guideline',
          access_method: 'manual',
          last_checked_at: new Date('2026-02-04'),
          stale_threshold_days: 120,
          days_since_check: 1,
        }],
      })
      .mockResolvedValueOnce({ rows: [{ base_url: 'https://nccn.org/guidelines', source_key: 'nccn-colorectal' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runWithTimers(() => discoverNewSources());

    // Manual sources should not appear in broken list even if URL fails
    expect(result.broken).toHaveLength(0);
    // Health check should not have been called with the manual source's URL
    // (vendor scanning does call mockGet for other URLs, so we check specifically)
    expect(mockGet).not.toHaveBeenCalledWith('https://nccn.org/guidelines', expect.anything());
  });

  it('discovers new vendor evidence pages', async () => {
    // Return accessible for the first vendor path, 404 for others
    mockGet
      .mockResolvedValueOnce({ status: 200 })  // First vendor URL works
      .mockRejectedValue(new Error('Not found'));

    query
      // getSourcesWithStaleness - no sources (empty DB)
      .mockResolvedValueOnce({ rows: [] })
      // getRegisteredSourceUrls - nothing registered
      .mockResolvedValueOnce({ rows: [] })
      // PubMed affiliations
      .mockResolvedValueOnce({ rows: [] });

    const result = await runWithTimers(() => discoverNewSources());

    // Should find at least 1 candidate (first vendor's first path worked)
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0]).toHaveProperty('vendor');
    expect(result.candidates[0]).toHaveProperty('url');
    expect(result.candidates[0]).toHaveProperty('suggestedSourceKey');
    expect(result.candidates[0]).toHaveProperty('suggestedSourceType');
  });

  it('skips vendor URLs already registered', async () => {
    mockGet.mockResolvedValue({ status: 200 });

    query
      .mockResolvedValueOnce({ rows: [] })
      // All vendor URLs are already registered
      .mockResolvedValueOnce({
        rows: [
          { base_url: 'https://www.natera.com/oncology/signatera/publications', source_key: 'natera_pubs' },
          { base_url: 'https://www.natera.com/oncology/publications', source_key: 'natera_pubs2' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const result = await runWithTimers(() => discoverNewSources());

    // Natera URLs should be excluded since they're registered
    const nateraCandidates = result.candidates.filter(c => c.vendor === 'Natera');
    // Either empty (all registered) or only non-registered paths
    for (const c of nateraCandidates) {
      expect(c.url).not.toBe('https://www.natera.com/oncology/signatera/publications');
      expect(c.url).not.toBe('https://www.natera.com/oncology/publications');
    }
  });

  it('staleOnly mode skips vendor scanning and PubMed affiliation check', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          source_key: 'stale-source',
          display_name: 'Stale Source',
          base_url: 'https://stale.example.com',
          source_type: 'literature',
          access_method: 'api',
          last_checked_at: new Date('2025-01-01'),
          stale_threshold_days: 7,
          days_since_check: 400,
        }],
      });

    const result = await runWithTimers(() => discoverNewSources({ staleOnly: true }));

    // Should have stale results
    expect(result.stale).toHaveLength(1);
    // But no candidates or affiliations (those scans were skipped)
    expect(result.candidates).toHaveLength(0);
    expect(result.affiliations).toHaveLength(0);
  });

  it('extracts PubMed affiliations from recent publications', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // getSourcesWithStaleness
      .mockResolvedValueOnce({ rows: [] }) // getRegisteredSourceUrls
      .mockResolvedValueOnce({ // PubMed affiliations
        rows: [
          { authors: null, vendor_name: 'Natera', title: 'Study 1', journal: 'JCO' },
          { authors: null, vendor_name: 'Natera', title: 'Study 2', journal: 'JCO' },
          { authors: null, vendor_name: 'Natera', title: 'Study 3', journal: 'NEJM' },
          { authors: null, vendor_name: 'Guardant', title: 'Study 4', journal: 'JCO' },
          { authors: null, vendor_name: 'Guardant', title: 'Study 5', journal: 'NEJM' },
          { authors: null, vendor_name: 'RareVendor', title: 'Study 6', journal: 'BMC' }, // Only 1 pub
        ],
      });

    // All vendor URLs fail
    mockGet.mockRejectedValue(new Error('Not found'));

    const result = await runWithTimers(() => discoverNewSources());

    // Should find Natera (3 pubs) and Guardant (2 pubs), but not RareVendor (only 1)
    expect(result.affiliations.length).toBeGreaterThanOrEqual(2);
    const vendorNames = result.affiliations.map(a => a.vendor);
    expect(vendorNames).toContain('natera');
    expect(vendorNames).toContain('guardant');
    expect(vendorNames).not.toContain('rarevendor');
  });

  it('returns correct summary structure', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockGet.mockRejectedValue(new Error('Not found'));

    const result = await runWithTimers(() => discoverNewSources());

    expect(result).toHaveProperty('candidates');
    expect(result).toHaveProperty('stale');
    expect(result).toHaveProperty('broken');
    expect(result).toHaveProperty('affiliations');
    expect(Array.isArray(result.candidates)).toBe(true);
    expect(Array.isArray(result.stale)).toBe(true);
    expect(Array.isArray(result.broken)).toBe(true);
    expect(Array.isArray(result.affiliations)).toBe(true);
  });
});
