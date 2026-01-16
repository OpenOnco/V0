import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CMSCrawler, SEARCH_KEYWORDS, ONCOLOGY_KEYWORDS } from '../../../src/crawlers/cms.js';
import { DISCOVERY_TYPES, SOURCES } from '../../../src/config.js';

// Mock the dependencies
vi.mock('../../../src/utils/http.js', () => ({
  createHttpClient: vi.fn(() => ({
    getJson: vi.fn(),
    getStats: vi.fn(() => ({})),
  })),
}));

vi.mock('../../../src/utils/logger.js', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../src/queue/index.js', () => ({
  addDiscoveries: vi.fn(() => []),
}));

vi.mock('../../../src/health.js', () => ({
  updateCrawlerHealth: vi.fn(),
  recordCrawlerError: vi.fn(),
}));

describe('CMSCrawler', () => {
  let crawler;

  beforeEach(() => {
    crawler = new CMSCrawler();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with correct properties', () => {
      expect(crawler.baseUrl).toBe('https://api.coverage.cms.gov');
      expect(crawler.seenDocuments).toBeInstanceOf(Set);
      expect(crawler.seenDocuments.size).toBe(0);
    });
  });

  describe('isOncologyRelevant', () => {
    it('returns true for titles containing MolDX', () => {
      expect(crawler.isOncologyRelevant('MolDX: Molecular Testing')).toBe(true);
      expect(crawler.isOncologyRelevant('moldx testing')).toBe(true);
    });

    it('returns true for titles containing molecular', () => {
      expect(crawler.isOncologyRelevant('Molecular Diagnostics Panel')).toBe(true);
    });

    it('returns true for titles containing tumor', () => {
      expect(crawler.isOncologyRelevant('Tumor Marker Testing')).toBe(true);
    });

    it('returns true for titles containing cancer', () => {
      expect(crawler.isOncologyRelevant('Cancer Screening Panel')).toBe(true);
    });

    it('returns true for titles containing oncology', () => {
      expect(crawler.isOncologyRelevant('Oncology Biomarkers')).toBe(true);
    });

    it('returns true for titles containing biopsy', () => {
      expect(crawler.isOncologyRelevant('Liquid Biopsy Testing')).toBe(true);
    });

    it('returns true for titles containing genomic', () => {
      expect(crawler.isOncologyRelevant('Genomic Profiling')).toBe(true);
    });

    it('returns false for unrelated titles', () => {
      expect(crawler.isOncologyRelevant('Cardiac Rehabilitation')).toBe(false);
      expect(crawler.isOncologyRelevant('Diabetes Management')).toBe(false);
      expect(crawler.isOncologyRelevant('Physical Therapy')).toBe(false);
    });
  });

  describe('getDocumentId', () => {
    it('creates ID from lcdId and version', () => {
      const item = { lcdId: 'L38043', version: 5 };
      expect(crawler.getDocumentId(item)).toBe('L38043:5');
    });

    it('creates ID from ncdId and version', () => {
      const item = { ncdId: 'N12345', version: 3 };
      expect(crawler.getDocumentId(item)).toBe('N12345:3');
    });

    it('creates ID from generic id field', () => {
      const item = { id: 'ABC123', version: 2 };
      expect(crawler.getDocumentId(item)).toBe('ABC123:2');
    });

    it('creates ID from articleId', () => {
      const item = { articleId: 'A999', versionNumber: 1 };
      expect(crawler.getDocumentId(item)).toBe('A999:1');
    });

    it('defaults to version 1 when not provided', () => {
      const item = { lcdId: 'L38043' };
      expect(crawler.getDocumentId(item)).toBe('L38043:1');
    });

    it('handles missing id fields', () => {
      const item = {};
      expect(crawler.getDocumentId(item)).toBe('unknown:1');
    });
  });

  describe('calculateRelevance', () => {
    it('returns high for items mentioning MolDX', () => {
      expect(crawler.calculateRelevance({ title: 'MolDX: Testing Guidelines' })).toBe('high');
    });

    it('returns high for items mentioning Signatera', () => {
      expect(crawler.calculateRelevance({ title: 'Signatera MRD Testing' })).toBe('high');
    });

    it('returns high for items mentioning Guardant', () => {
      expect(crawler.calculateRelevance({ title: 'Guardant360 Coverage' })).toBe('high');
    });

    it('returns high for items mentioning MRD', () => {
      expect(crawler.calculateRelevance({ title: 'Minimal Residual Disease Testing' })).toBe('high');
      expect(crawler.calculateRelevance({ title: 'MRD Monitoring' })).toBe('high');
    });

    it('returns high for items mentioning FoundationOne', () => {
      expect(crawler.calculateRelevance({ title: 'FoundationOne CDx Coverage' })).toBe('high');
    });

    it('returns medium for items mentioning ctDNA', () => {
      expect(crawler.calculateRelevance({ title: 'ctDNA Testing Panel' })).toBe('medium');
    });

    it('returns medium for items mentioning liquid biopsy', () => {
      expect(crawler.calculateRelevance({ title: 'Liquid Biopsy for Cancer Detection' })).toBe('medium');
    });

    it('returns medium for items mentioning circulating tumor', () => {
      expect(crawler.calculateRelevance({ title: 'Circulating Tumor DNA Analysis' })).toBe('medium');
    });

    it('returns medium for items mentioning genomic', () => {
      expect(crawler.calculateRelevance({ title: 'Genomic Testing Guidelines' })).toBe('medium');
    });

    it('returns medium for items mentioning molecular diagnostic', () => {
      expect(crawler.calculateRelevance({ title: 'Molecular Diagnostic Tests' })).toBe('medium');
    });

    it('returns low for generic oncology items', () => {
      expect(crawler.calculateRelevance({ title: 'Cancer Treatment Coverage' })).toBe('low');
    });

    it('checks both title and summary', () => {
      expect(crawler.calculateRelevance({
        title: 'Coverage Update',
        summary: 'Updates to MolDX testing policies',
      })).toBe('high');
    });
  });

  describe('createDiscovery', () => {
    it('creates a properly structured discovery object for LCD', () => {
      const item = {
        title: 'MolDX: Molecular Testing',
        lcdId: 'L38043',
        contractor: 'Palmetto GBA',
        effectiveDate: '2024-01-15',
        version: 5,
      };

      const discovery = crawler.createDiscovery(item, 'LCD');

      expect(discovery).toEqual({
        source: SOURCES.CMS,
        type: DISCOVERY_TYPES.COVERAGE_CHANGE,
        title: 'MolDX: Molecular Testing',
        summary: 'LCD update | Contractor: Palmetto GBA | Effective: 2024-01-15',
        url: 'https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=L38043',
        relevance: 'high',
        metadata: {
          documentId: 'L38043',
          documentType: 'LCD',
          contractor: 'Palmetto GBA',
          effectiveDate: '2024-01-15',
          version: 5,
        },
      });
    });

    it('creates a properly structured discovery object for NCD', () => {
      const item = {
        title: 'Cancer Screening Coverage',
        ncdId: 'N12345',
        contractor: 'CMS',
        effectiveDate: '2024-03-01',
        version: 2,
      };

      const discovery = crawler.createDiscovery(item, 'NCD');

      expect(discovery).toEqual({
        source: SOURCES.CMS,
        type: DISCOVERY_TYPES.COVERAGE_CHANGE,
        title: 'Cancer Screening Coverage',
        summary: 'NCD update | Contractor: CMS | Effective: 2024-03-01',
        url: 'https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=N12345',
        relevance: 'low',
        metadata: {
          documentId: 'N12345',
          documentType: 'NCD',
          contractor: 'CMS',
          effectiveDate: '2024-03-01',
          version: 2,
        },
      });
    });

    it('creates a properly structured discovery object for Article', () => {
      const item = {
        title: 'Genomic Testing Guidelines',
        articleId: 'A999',
        contractorName: 'Novitas',
        publishDate: '2024-02-20',
        versionNumber: 1,
      };

      const discovery = crawler.createDiscovery(item, 'Article');

      expect(discovery).toEqual({
        source: SOURCES.CMS,
        type: DISCOVERY_TYPES.COVERAGE_CHANGE,
        title: 'Genomic Testing Guidelines',
        summary: 'Article update | Contractor: Novitas | Effective: 2024-02-20',
        url: 'https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=A999',
        relevance: 'medium',
        metadata: {
          documentId: 'A999',
          documentType: 'Article',
          contractor: 'Novitas',
          effectiveDate: '2024-02-20',
          version: 1,
        },
      });
    });

    it('returns null for items without title', () => {
      const item = { lcdId: 'L38043' };
      expect(crawler.createDiscovery(item, 'LCD')).toBe(null);
    });

    it('uses name field when title is not present', () => {
      const item = {
        name: 'Tumor Marker Testing',
        lcdId: 'L12345',
        version: 1,
      };

      const discovery = crawler.createDiscovery(item, 'LCD');
      expect(discovery.title).toBe('Tumor Marker Testing');
    });

    it('handles missing optional fields', () => {
      const item = {
        title: 'Molecular Testing',
        id: 'X123',
      };

      const discovery = crawler.createDiscovery(item, 'LCD');

      expect(discovery.metadata.contractor).toBe('');
      expect(discovery.metadata.effectiveDate).toBe('');
      expect(discovery.metadata.version).toBe(1);
    });
  });

  describe('processSearchResults', () => {
    it('filters out non-oncology relevant items', () => {
      const items = [
        { title: 'MolDX: Testing', lcdId: 'L1', version: 1 },
        { title: 'Cardiac Testing', lcdId: 'L2', version: 1 },
        { title: 'Cancer Biomarkers', lcdId: 'L3', version: 1 },
      ];

      const discoveries = crawler.processSearchResults(items, 'LCD');

      expect(discoveries).toHaveLength(2);
      expect(discoveries[0].title).toBe('MolDX: Testing');
      expect(discoveries[1].title).toBe('Cancer Biomarkers');
    });

    it('tracks seen documents to avoid duplicates', () => {
      const items = [
        { title: 'MolDX: Testing', lcdId: 'L1', version: 1 },
        { title: 'MolDX: Testing Updated', lcdId: 'L1', version: 1 },
      ];

      const discoveries = crawler.processSearchResults(items, 'LCD');

      expect(discoveries).toHaveLength(1);
      expect(crawler.seenDocuments.has('L1:1')).toBe(true);
    });

    it('allows same document with different version', () => {
      const items = [
        { title: 'MolDX: Testing v1', lcdId: 'L1', version: 1 },
        { title: 'MolDX: Testing v2', lcdId: 'L1', version: 2 },
      ];

      const discoveries = crawler.processSearchResults(items, 'LCD');

      expect(discoveries).toHaveLength(2);
      expect(crawler.seenDocuments.has('L1:1')).toBe(true);
      expect(crawler.seenDocuments.has('L1:2')).toBe(true);
    });
  });

  describe('crawl with mocked HTTP', () => {
    it('fetches from What\'s New report and keyword searches', async () => {
      const mockWhatsNew = [
        { title: 'MolDX: New Policy', articleId: 'A1', version: 1 },
      ];

      const mockLcdResults = [
        { title: 'Molecular Testing LCD', lcdId: 'L1', version: 1 },
      ];

      const mockNcdResults = [
        { title: 'Cancer NCD', ncdId: 'N1', version: 1 },
      ];

      crawler.http.getJson
        .mockResolvedValueOnce(mockWhatsNew) // What's New
        .mockResolvedValueOnce(mockLcdResults) // LCD search for first keyword
        .mockResolvedValueOnce(mockNcdResults) // NCD search for first keyword
        .mockResolvedValue([]); // All other searches return empty

      const discoveries = await crawler.crawl();

      expect(discoveries.length).toBeGreaterThan(0);
      expect(crawler.http.getJson).toHaveBeenCalled();
    });

    it('handles API errors gracefully', async () => {
      crawler.http.getJson
        .mockRejectedValueOnce(new Error('Network error')) // What's New fails
        .mockRejectedValue(new Error('API unavailable')); // All searches fail

      const discoveries = await crawler.crawl();

      expect(discoveries).toEqual([]);
    });

    it('continues searching after individual keyword failures', async () => {
      const mockLcdResults = [
        { title: 'Genomic Testing LCD', lcdId: 'L1', version: 1 },
      ];

      crawler.http.getJson
        .mockResolvedValueOnce([]) // What's New empty
        .mockRejectedValueOnce(new Error('First keyword fails'))
        .mockRejectedValueOnce(new Error('First keyword fails'))
        .mockResolvedValueOnce(mockLcdResults) // Second keyword LCD succeeds
        .mockResolvedValue([]); // Rest empty

      const discoveries = await crawler.crawl();

      expect(discoveries).toHaveLength(1);
      expect(discoveries[0].title).toBe('Genomic Testing LCD');
    });
  });

  describe('exported constants', () => {
    it('SEARCH_KEYWORDS contains expected keywords', () => {
      expect(SEARCH_KEYWORDS).toContain('molecular');
      expect(SEARCH_KEYWORDS).toContain('ctDNA');
      expect(SEARCH_KEYWORDS).toContain('MRD');
      expect(SEARCH_KEYWORDS).toContain('liquid biopsy');
    });

    it('ONCOLOGY_KEYWORDS contains expected keywords', () => {
      expect(ONCOLOGY_KEYWORDS).toContain('moldx');
      expect(ONCOLOGY_KEYWORDS).toContain('molecular');
      expect(ONCOLOGY_KEYWORDS).toContain('tumor');
      expect(ONCOLOGY_KEYWORDS).toContain('cancer');
      expect(ONCOLOGY_KEYWORDS).toContain('oncology');
      expect(ONCOLOGY_KEYWORDS).toContain('biopsy');
      expect(ONCOLOGY_KEYWORDS).toContain('genomic');
    });
  });
});
