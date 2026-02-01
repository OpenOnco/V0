/**
 * Proposal Integration Tests
 *
 * Tests the full pipeline from discovery → proposal creation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VendorCrawler } from '../../src/crawlers/vendor.js';
import { DISCOVERY_TYPES, SOURCES } from '../../src/config.js';
import { listProposals, deleteProposal } from '../../src/proposals/queue.js';
import { PROPOSAL_TYPES, PROPOSAL_STATES } from '../../src/proposals/schema.js';

describe('Proposal Integration', () => {
  let crawler;
  let createdProposalIds = [];

  beforeEach(() => {
    crawler = new VendorCrawler();
  });

  afterEach(async () => {
    // Clean up any proposals created during tests
    for (const id of createdProposalIds) {
      try {
        await deleteProposal(id);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    createdProposalIds = [];
  });

  describe('createProposalsFromDiscoveries', () => {
    it('creates coverage proposal from high-relevance coverage announcement', async () => {
      const discoveries = [
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_COVERAGE_ANNOUNCEMENT,
          title: 'UnitedHealthcare Now Covers Signatera for CRC Monitoring',
          summary: 'UHC announces coverage for Signatera MRD testing in colorectal cancer patients post-surgery.',
          url: 'https://www.natera.com/news/uhc-coverage',
          relevance: 'high',
          metadata: {
            vendorId: 'natera',
            vendorName: 'Natera',
            payerName: 'UnitedHealthcare',
            testName: 'Signatera',
            coverageType: 'commercial',
            effectiveDate: '2025-01-01',
            deterministicMatches: [
              { testId: 'signatera', testName: 'Signatera', confidence: 0.95 }
            ],
          },
        },
      ];

      const proposals = await crawler.createProposalsFromDiscoveries(discoveries);

      expect(proposals).toHaveLength(1);
      expect(proposals[0].type).toBe(PROPOSAL_TYPES.COVERAGE);
      expect(proposals[0].status).toBe(PROPOSAL_STATES.PENDING);
      expect(proposals[0].testName).toBe('Signatera');
      expect(proposals[0].payer).toBe('UnitedHealthcare');
      expect(proposals[0].source).toBe('https://www.natera.com/news/uhc-coverage');

      createdProposalIds.push(proposals[0].id);
    });

    it('creates update proposal from high-relevance performance data', async () => {
      const discoveries = [
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_PERFORMANCE_DATA,
          title: 'Guardant360: 95% Sensitivity in NSCLC',
          summary: 'New data shows 95% sensitivity for detecting actionable mutations in non-small cell lung cancer.',
          url: 'https://guardanthealth.com/news/performance-update',
          relevance: 'high',
          metadata: {
            vendorId: 'guardant',
            vendorName: 'Guardant Health',
            testName: 'Guardant360 CDx',
            metric: 'sensitivity',
            value: '95%',
            cancerType: 'NSCLC',
            stage: 'Stage IV',
            population: 'Treatment-naive patients',
          },
        },
      ];

      const proposals = await crawler.createProposalsFromDiscoveries(discoveries);

      expect(proposals).toHaveLength(1);
      expect(proposals[0].type).toBe(PROPOSAL_TYPES.UPDATE);
      expect(proposals[0].testName).toBe('Guardant360 CDx');
      expect(proposals[0].changes).toHaveProperty('performance');
      expect(proposals[0].changes.performance.sensitivity).toBe('95%');

      createdProposalIds.push(proposals[0].id);
    });

    it('creates new test proposal from high-relevance new test announcement', async () => {
      const discoveries = [
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_NEW_TEST,
          title: 'Foundation Medicine Launches FoundationOne Tracker',
          summary: 'New MRD monitoring test for solid tumors using ctDNA.',
          url: 'https://www.foundationmedicine.com/news/tracker-launch',
          relevance: 'high',
          metadata: {
            vendorId: 'foundation',
            vendorName: 'Foundation Medicine',
            testName: 'FoundationOne Tracker',
            category: 'mrd',
            description: 'MRD monitoring test using ctDNA for solid tumors',
            launchDate: '2025-01-15',
          },
        },
      ];

      const proposals = await crawler.createProposalsFromDiscoveries(discoveries);

      expect(proposals).toHaveLength(1);
      expect(proposals[0].type).toBe(PROPOSAL_TYPES.NEW_TEST);
      expect(proposals[0].testData.name).toBe('FoundationOne Tracker');
      expect(proposals[0].testData.vendor).toBe('Foundation Medicine');
      expect(proposals[0].testData.category).toBe('Molecular Residual Disease');

      createdProposalIds.push(proposals[0].id);
    });

    it('skips low-relevance discoveries', async () => {
      const discoveries = [
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_COVERAGE_ANNOUNCEMENT,
          title: 'Minor Regional Payer Update',
          summary: 'Small regional payer adds coverage.',
          url: 'https://example.com/minor-update',
          relevance: 'low', // Should be skipped
          metadata: {
            vendorId: 'test',
            vendorName: 'Test Vendor',
            testName: 'Test Product',
          },
        },
      ];

      const proposals = await crawler.createProposalsFromDiscoveries(discoveries);

      expect(proposals).toHaveLength(0);
    });

    it('includes medium-relevance discoveries', async () => {
      const discoveries = [
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_COVERAGE_ANNOUNCEMENT,
          title: 'Coverage Update',
          summary: 'Coverage expanded.',
          url: 'https://example.com/update',
          relevance: 'medium', // Now included (high + medium create proposals)
          metadata: {
            vendorId: 'test',
            vendorName: 'Test Vendor',
            testName: 'Test Product',
            payerName: 'Test Payer',
          },
        },
      ];

      const proposals = await crawler.createProposalsFromDiscoveries(discoveries);

      expect(proposals).toHaveLength(1);
    });

    it('skips informational discovery types (PLA codes, price changes)', async () => {
      const discoveries = [
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_PLA_CODE,
          title: 'New PLA Code Assigned',
          summary: 'PLA code 0123U assigned.',
          url: 'https://example.com/pla',
          relevance: 'high',
          metadata: { plaCode: '0123U' },
        },
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_PRICE_CHANGE,
          title: 'Price Update',
          summary: 'Cash price updated.',
          url: 'https://example.com/price',
          relevance: 'high',
          metadata: { cashPrice: { amount: 3500 } },
        },
      ];

      const proposals = await crawler.createProposalsFromDiscoveries(discoveries);

      expect(proposals).toHaveLength(0);
    });

    it('skips coverage proposal when no test name identified', async () => {
      const discoveries = [
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_COVERAGE_ANNOUNCEMENT,
          title: 'General Coverage News',
          summary: 'Some coverage announcement without test name.',
          url: 'https://example.com/news',
          relevance: 'high',
          metadata: {
            vendorId: 'test',
            vendorName: 'Test Vendor',
            // No testName, no deterministicMatches
          },
        },
      ];

      const proposals = await crawler.createProposalsFromDiscoveries(discoveries);

      expect(proposals).toHaveLength(0);
    });

    it('handles multiple discoveries in one batch', async () => {
      const discoveries = [
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_COVERAGE_ANNOUNCEMENT,
          title: 'Coverage 1',
          summary: 'First coverage.',
          url: 'https://example.com/1',
          relevance: 'high',
          metadata: {
            vendorId: 'natera',
            vendorName: 'Natera',
            testName: 'Signatera',
            payerName: 'Aetna',
          },
        },
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_REGULATORY,
          title: 'FDA Approval',
          summary: 'FDA clears test.',
          url: 'https://example.com/2',
          relevance: 'high',
          metadata: {
            vendorId: 'guardant',
            vendorName: 'Guardant',
            testName: 'Shield',
            action: 'FDA approval',
            indication: 'CRC screening',
          },
        },
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_PLA_CODE,
          title: 'PLA Code',
          summary: 'New code.',
          url: 'https://example.com/3',
          relevance: 'high',
          metadata: { plaCode: '0456U' },
        },
      ];

      const proposals = await crawler.createProposalsFromDiscoveries(discoveries);

      // Should create 2 proposals (coverage + regulatory update), skip PLA code
      expect(proposals).toHaveLength(2);
      expect(proposals.map(p => p.type)).toContain(PROPOSAL_TYPES.COVERAGE);
      expect(proposals.map(p => p.type)).toContain(PROPOSAL_TYPES.UPDATE);

      createdProposalIds.push(...proposals.map(p => p.id));
    });
  });

  describe('proposal persists to disk', () => {
    it('can retrieve created proposal from queue', async () => {
      const discoveries = [
        {
          source: SOURCES.VENDOR,
          type: DISCOVERY_TYPES.VENDOR_NEW_TEST,
          title: 'Test Launch',
          summary: 'New test launched.',
          url: 'https://example.com/launch',
          relevance: 'high',
          metadata: {
            vendorId: 'test',
            vendorName: 'Test Vendor',
            testName: 'New Test Product',
            category: 'ecd',
          },
        },
      ];

      const proposals = await crawler.createProposalsFromDiscoveries(discoveries);
      expect(proposals).toHaveLength(1);
      createdProposalIds.push(proposals[0].id);

      // Verify it's in the queue
      const allProposals = await listProposals();
      const found = allProposals.find(p => p.id === proposals[0].id);

      expect(found).toBeDefined();
      expect(found.testData.name).toBe('New Test Product');
      expect(found.status).toBe(PROPOSAL_STATES.PENDING);
    });
  });
});
