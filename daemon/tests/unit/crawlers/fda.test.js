import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FDACrawler } from '../../../src/crawlers/fda.js';
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

describe('FDACrawler', () => {
  let crawler;

  beforeEach(() => {
    crawler = new FDACrawler();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with correct properties', () => {
      expect(crawler.openFdaUrl).toBe('https://api.fda.gov');
      expect(crawler.name).toBeDefined();
      expect(crawler.source).toBe(SOURCES.FDA);
    });
  });

  describe('isRelevant', () => {
    it('returns true for items from monitored manufacturers', () => {
      expect(crawler.isRelevant({ applicant: 'Natera Inc' })).toBe(true);
      expect(crawler.isRelevant({ applicant: 'Guardant Health' })).toBe(true);
      expect(crawler.isRelevant({ applicant: 'Foundation Medicine' })).toBe(true);
      expect(crawler.isRelevant({ applicant: 'Tempus Labs' })).toBe(true);
      expect(crawler.isRelevant({ applicant: 'GRAIL Inc' })).toBe(true);
    });

    it('returns true for items mentioning liquid biopsy keywords', () => {
      expect(crawler.isRelevant({ device_name: 'Liquid Biopsy Test' })).toBe(true);
      expect(crawler.isRelevant({ device_name: 'ctDNA Analysis Panel' })).toBe(true);
      expect(crawler.isRelevant({ device_name: 'Circulating Tumor DNA Test' })).toBe(true);
    });

    it('returns true for items mentioning minimal residual disease', () => {
      expect(crawler.isRelevant({ statement_or_summary: 'minimal residual disease detection' })).toBe(true);
      expect(crawler.isRelevant({ statement_or_summary: 'molecular residual disease monitoring' })).toBe(true);
    });

    it('returns true for items mentioning next generation sequencing', () => {
      expect(crawler.isRelevant({ device_name: 'Next Generation Sequencing Panel' })).toBe(true);
    });

    it('returns true for items mentioning companion diagnostic', () => {
      expect(crawler.isRelevant({ device_name: 'Companion Diagnostic Test' })).toBe(true);
    });

    it('returns true for items mentioning pan-tumor', () => {
      expect(crawler.isRelevant({ device_name: 'Pan-tumor profiling assay' })).toBe(true);
    });

    it('returns false for unrelated items', () => {
      expect(crawler.isRelevant({ applicant: 'Random Medical Corp', device_name: 'Blood Glucose Monitor' })).toBe(false);
      expect(crawler.isRelevant({ device_name: 'Cardiac Pacemaker' })).toBe(false);
      expect(crawler.isRelevant({ device_name: 'Dental Implant' })).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(crawler.isRelevant({ applicant: 'NATERA' })).toBe(true);
      expect(crawler.isRelevant({ device_name: 'LIQUID BIOPSY' })).toBe(true);
      expect(crawler.isRelevant({ device_name: 'CTDNA' })).toBe(true);
    });
  });

  describe('create510kDiscovery', () => {
    it('creates a properly structured discovery object', () => {
      const device = {
        k_number: 'K123456',
        device_name: 'Signatera MRD Test',
        applicant: 'Natera Inc',
        statement_or_summary: 'Minimal residual disease detection assay',
        decision_date: '2024-01-15',
        product_code: 'PSZ',
      };

      const discovery = crawler.create510kDiscovery(device);

      expect(discovery).toEqual({
        source: SOURCES.FDA,
        type: DISCOVERY_TYPES.FDA_APPROVAL,
        title: 'FDA 510(k) Cleared: Signatera MRD Test',
        summary: 'Natera Inc - Minimal residual disease detection assay',
        url: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K123456',
        relevance: 'high',
        metadata: {
          kNumber: 'K123456',
          deviceName: 'Signatera MRD Test',
          applicant: 'Natera Inc',
          decisionDate: '2024-01-15',
          productCode: 'PSZ',
          clearanceType: '510k',
        },
      });
    });

    it('uses openfda.device_name as fallback', () => {
      const device = {
        k_number: 'K789012',
        openfda: { device_name: 'Test Device' },
        applicant: 'Test Applicant',
        decision_date: '2024-02-01',
      };

      const discovery = crawler.create510kDiscovery(device);

      expect(discovery.title).toBe('FDA 510(k) Cleared: Test Device');
    });

    it('uses default summary when statement_or_summary is missing', () => {
      const device = {
        k_number: 'K789012',
        device_name: 'Test Device',
        applicant: 'Test Applicant',
      };

      const discovery = crawler.create510kDiscovery(device);

      expect(discovery.summary).toBe('Test Applicant - 510(k) clearance');
    });
  });

  describe('createPMADiscovery', () => {
    it('creates a properly structured discovery object', () => {
      const device = {
        pma_number: 'P123456',
        trade_name: 'Guardant360 CDx',
        generic_name: 'Comprehensive Genomic Profiling Test',
        applicant: 'Guardant Health',
        ao_statement: 'Pan-tumor tissue profiling assay',
        decision_date: '2024-03-01',
        advisory_committee: 'Clinical Chemistry',
      };

      const discovery = crawler.createPMADiscovery(device);

      expect(discovery).toEqual({
        source: SOURCES.FDA,
        type: DISCOVERY_TYPES.FDA_APPROVAL,
        title: 'FDA PMA Approved: Guardant360 CDx',
        summary: 'Guardant Health - Pan-tumor tissue profiling assay',
        url: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id=P123456',
        relevance: 'high',
        metadata: {
          pmaNumber: 'P123456',
          tradeName: 'Guardant360 CDx',
          genericName: 'Comprehensive Genomic Profiling Test',
          applicant: 'Guardant Health',
          decisionDate: '2024-03-01',
          advisoryCommittee: 'Clinical Chemistry',
          clearanceType: 'pma',
        },
      });
    });

    it('uses generic_name as fallback when trade_name is missing', () => {
      const device = {
        pma_number: 'P999999',
        generic_name: 'Molecular Test',
        applicant: 'Test Company',
      };

      const discovery = crawler.createPMADiscovery(device);

      expect(discovery.title).toBe('FDA PMA Approved: Molecular Test');
    });

    it('uses default summary when ao_statement is missing', () => {
      const device = {
        pma_number: 'P999999',
        trade_name: 'Test Device',
        applicant: 'Test Company',
      };

      const discovery = crawler.createPMADiscovery(device);

      expect(discovery.summary).toBe('Test Company - PMA approval');
    });
  });

  describe('calculateRelevance', () => {
    it('returns high for Natera products', () => {
      expect(crawler.calculateRelevance({ applicant: 'Natera Inc' })).toBe('high');
    });

    it('returns high for Guardant products', () => {
      expect(crawler.calculateRelevance({ applicant: 'Guardant Health' })).toBe('high');
    });

    it('returns high for Foundation Medicine products', () => {
      expect(crawler.calculateRelevance({ applicant: 'Foundation Medicine' })).toBe('high');
    });

    it('returns high for Signatera-related products', () => {
      expect(crawler.calculateRelevance({ device_name: 'Signatera MRD Test' })).toBe('high');
    });

    it('returns high for Guardant360-related products', () => {
      expect(crawler.calculateRelevance({ device_name: 'Guardant360 CDx' })).toBe('high');
    });

    it('returns high for ctDNA products', () => {
      expect(crawler.calculateRelevance({ device_name: 'ctDNA Analysis Panel' })).toBe('high');
    });

    it('returns high for liquid biopsy products', () => {
      expect(crawler.calculateRelevance({ device_name: 'Liquid Biopsy Test' })).toBe('high');
    });

    it('returns high for MRD products', () => {
      expect(crawler.calculateRelevance({ device_name: 'MRD Detection Assay' })).toBe('high');
      expect(crawler.calculateRelevance({ device_name: 'Minimal Residual Disease Test' })).toBe('high');
    });

    it('returns high for companion diagnostic products', () => {
      expect(crawler.calculateRelevance({ device_name: 'Companion Diagnostic Assay' })).toBe('high');
    });

    it('returns medium for oncology products', () => {
      expect(crawler.calculateRelevance({ device_name: 'Oncology Panel' })).toBe('medium');
    });

    it('returns medium for cancer products', () => {
      expect(crawler.calculateRelevance({ device_name: 'Cancer Screening Test' })).toBe('medium');
    });

    it('returns medium for tumor products', () => {
      expect(crawler.calculateRelevance({ device_name: 'Tumor Marker Analysis' })).toBe('medium');
    });

    it('returns medium for neoplasm products', () => {
      expect(crawler.calculateRelevance({ device_name: 'Neoplasm Detection' })).toBe('medium');
    });

    it('returns low for unrelated products', () => {
      expect(crawler.calculateRelevance({ device_name: 'Blood Glucose Monitor' })).toBe('low');
      expect(crawler.calculateRelevance({ device_name: 'Cardiac Device' })).toBe('low');
    });

    it('is case-insensitive', () => {
      expect(crawler.calculateRelevance({ applicant: 'NATERA' })).toBe('high');
      expect(crawler.calculateRelevance({ device_name: 'LIQUID BIOPSY' })).toBe('high');
      expect(crawler.calculateRelevance({ device_name: 'CANCER test' })).toBe('medium');
    });
  });

  describe('crawl with mocked HTTP', () => {
    it('fetches 510(k) and PMA results for all manufacturers', async () => {
      const mock510kResults = {
        results: [
          {
            k_number: 'K123456',
            device_name: 'Signatera Test',
            applicant: 'Natera Inc',
            decision_date: '2024-01-15',
          },
        ],
      };

      const mockPMAResults = {
        results: [
          {
            pma_number: 'P789012',
            trade_name: 'Guardant360 CDx',
            applicant: 'Guardant Health',
            decision_date: '2024-02-01',
          },
        ],
      };

      // First call returns 510k for Natera, rest return empty
      crawler.http.getJson
        .mockResolvedValueOnce(mock510kResults) // Natera 510k
        .mockResolvedValueOnce({ results: [] }) // Guardant 510k
        .mockResolvedValueOnce({ results: [] }) // Foundation 510k
        .mockResolvedValueOnce({ results: [] }) // Tempus 510k
        .mockResolvedValueOnce({ results: [] }) // Caris 510k
        .mockResolvedValueOnce({ results: [] }) // Exact Sciences 510k
        .mockResolvedValueOnce({ results: [] }) // GRAIL 510k
        .mockResolvedValueOnce({ results: [] }) // Freenome 510k
        .mockResolvedValueOnce({ results: [] }) // Adaptive 510k
        .mockResolvedValueOnce({ results: [] }) // Personalis 510k
        .mockResolvedValueOnce({ results: [] }) // Natera PMA
        .mockResolvedValueOnce(mockPMAResults) // Guardant PMA
        .mockResolvedValue({ results: [] }); // Rest

      const discoveries = await crawler.crawl();

      expect(discoveries).toHaveLength(2);
      expect(discoveries[0].metadata.kNumber).toBe('K123456');
      expect(discoveries[1].metadata.pmaNumber).toBe('P789012');
    });

    it('deduplicates results by k_number', async () => {
      const mockResults = {
        results: [
          {
            k_number: 'K123456',
            device_name: 'Test Device',
            applicant: 'Natera Inc',
          },
          {
            k_number: 'K123456', // Duplicate
            device_name: 'Test Device v2',
            applicant: 'Natera Inc',
          },
        ],
      };

      crawler.http.getJson
        .mockResolvedValueOnce(mockResults)
        .mockResolvedValue({ results: [] });

      const discoveries = await crawler.crawl();

      const kNumbers = discoveries.filter(d => d.metadata.kNumber === 'K123456');
      expect(kNumbers).toHaveLength(1);
    });

    it('deduplicates results by pma_number', async () => {
      const mockResults = {
        results: [
          {
            pma_number: 'P123456',
            trade_name: 'Test Device',
            applicant: 'Guardant Health',
          },
          {
            pma_number: 'P123456', // Duplicate
            trade_name: 'Test Device v2',
            applicant: 'Guardant Health',
          },
        ],
      };

      // Return empty for 510k queries
      crawler.http.getJson
        .mockResolvedValueOnce({ results: [] }) // Natera 510k
        .mockResolvedValueOnce({ results: [] }) // Guardant 510k
        .mockResolvedValueOnce({ results: [] }) // Foundation 510k
        .mockResolvedValueOnce({ results: [] }) // Tempus 510k
        .mockResolvedValueOnce({ results: [] }) // Caris 510k
        .mockResolvedValueOnce({ results: [] }) // Exact Sciences 510k
        .mockResolvedValueOnce({ results: [] }) // GRAIL 510k
        .mockResolvedValueOnce({ results: [] }) // Freenome 510k
        .mockResolvedValueOnce({ results: [] }) // Adaptive 510k
        .mockResolvedValueOnce({ results: [] }) // Personalis 510k
        .mockResolvedValueOnce({ results: [] }) // Natera PMA
        .mockResolvedValueOnce(mockResults) // Guardant PMA with duplicates
        .mockResolvedValue({ results: [] });

      const discoveries = await crawler.crawl();

      const pmaNumbers = discoveries.filter(d => d.metadata.pmaNumber === 'P123456');
      expect(pmaNumbers).toHaveLength(1);
    });

    it('filters out non-relevant results', async () => {
      const mockResults = {
        results: [
          {
            k_number: 'K111111',
            device_name: 'Signatera MRD Test', // Relevant
            applicant: 'Natera Inc',
          },
          {
            k_number: 'K222222',
            device_name: 'Unrelated Blood Glucose Monitor', // Not relevant despite manufacturer match
            applicant: 'Natera Inc',
          },
        ],
      };

      crawler.http.getJson
        .mockResolvedValueOnce(mockResults)
        .mockResolvedValue({ results: [] });

      const discoveries = await crawler.crawl();

      // Both should be included because manufacturer name "Natera" is monitored
      expect(discoveries).toHaveLength(2);
    });

    it('handles API errors gracefully and continues', async () => {
      const mockResults = {
        results: [
          {
            k_number: 'K123456',
            device_name: 'Test Device',
            applicant: 'Guardant Health',
          },
        ],
      };

      crawler.http.getJson
        .mockRejectedValueOnce(new Error('Network error')) // Natera 510k fails
        .mockResolvedValueOnce(mockResults) // Guardant 510k succeeds
        .mockResolvedValue({ results: [] }); // Rest return empty

      const discoveries = await crawler.crawl();

      expect(discoveries.length).toBeGreaterThan(0);
    });

    it('handles empty response gracefully', async () => {
      crawler.http.getJson.mockResolvedValue({ results: [] });

      const discoveries = await crawler.crawl();

      expect(discoveries).toEqual([]);
    });

    it('handles missing results field gracefully', async () => {
      crawler.http.getJson.mockResolvedValue({});

      const discoveries = await crawler.crawl();

      expect(discoveries).toEqual([]);
    });

    it('handles null response gracefully', async () => {
      crawler.http.getJson.mockResolvedValue(null);

      const discoveries = await crawler.crawl();

      expect(discoveries).toEqual([]);
    });

    it('handles all API calls failing', async () => {
      crawler.http.getJson.mockRejectedValue(new Error('API unavailable'));

      const discoveries = await crawler.crawl();

      expect(discoveries).toEqual([]);
    });
  });
});
