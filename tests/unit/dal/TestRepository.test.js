/**
 * Unit tests for DAL TestRepository
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeDAL } from '../../../src/dal/index.js';

describe('TestRepository', () => {
  let dal;

  const testData = {
    mrdTestData: [
      { id: 'mrd-1', name: 'Signatera', vendor: 'Natera', cancerTypes: ['Colorectal', 'Breast'], sensitivity: 95, fdaStatus: 'CLIA LDT' },
      { id: 'mrd-2', name: 'Guardant Reveal', vendor: 'Guardant Health', cancerTypes: ['Colorectal', 'Lung'], sensitivity: 85, fdaStatus: 'FDA Cleared' },
    ],
    ecdTestData: [
      { id: 'ecd-1', name: 'Galleri', vendor: 'GRAIL', cancerTypes: ['Multi-cancer'], sensitivity: 50, fdaStatus: 'CLIA LDT' },
      { id: 'ecd-2', name: 'Shield', vendor: 'Guardant Health', cancerTypes: ['Colorectal'], sensitivity: 83, fdaStatus: 'FDA Approved' },
    ],
    cgpTestData: [
      { id: 'cgp-1', name: 'FoundationOne CDx', vendor: 'Foundation Medicine', cancerTypes: ['Pan-cancer'], genesAnalyzed: 324, fdaStatus: 'FDA Approved' },
    ],
    hctTestData: [
      { id: 'hct-1', name: 'MyRisk', vendor: 'Myriad Genetics', cancerTypes: ['Hereditary'], genesAnalyzed: 35, fdaStatus: 'CLIA LDT' },
    ],
    trmTestData: [],
  };

  beforeEach(() => {
    dal = initializeDAL(testData);
  });

  describe('findAll', () => {
    it('returns all tests', async () => {
      const { data, meta } = await dal.tests.findAll();
      expect(data.length).toBe(6);
      expect(meta.total).toBe(6);
    });

    it('applies where filter', async () => {
      const { data } = await dal.tests.findAll({ where: { category: 'MRD' } });
      expect(data.length).toBe(2);
      expect(data.every(t => t.category === 'MRD')).toBe(true);
    });

    it('applies pagination', async () => {
      const { data, meta } = await dal.tests.findAll({ skip: 2, take: 2 });
      expect(data.length).toBe(2);
      expect(meta.total).toBe(6);
      expect(meta.hasMore).toBe(true);
    });
  });

  describe('findById', () => {
    it('finds test by exact ID', async () => {
      const test = await dal.tests.findById('mrd-1');
      expect(test).not.toBeNull();
      expect(test.name).toBe('Signatera');
    });

    it('returns null for non-existent ID', async () => {
      const test = await dal.tests.findById('nonexistent');
      expect(test).toBeNull();
    });
  });

  describe('findBySlug', () => {
    it('finds test by slug', async () => {
      const test = await dal.tests.findBySlug('signatera');
      expect(test).not.toBeNull();
      expect(test.name).toBe('Signatera');
    });

    it('finds test by slug and category', async () => {
      const test = await dal.tests.findBySlug('signatera', 'MRD');
      expect(test).not.toBeNull();
      expect(test.category).toBe('MRD');
    });
  });

  describe('findByCategory', () => {
    it('finds tests by category', async () => {
      const { data } = await dal.tests.findByCategory('ECD');
      expect(data.length).toBe(2);
      expect(data.every(t => t.category === 'ECD')).toBe(true);
    });

    it('handles lowercase category', async () => {
      const { data } = await dal.tests.findByCategory('mrd');
      expect(data.length).toBe(2);
    });
  });

  describe('findByVendor', () => {
    it('finds tests by vendor (partial match)', async () => {
      const { data } = await dal.tests.findByVendor('Guardant');
      expect(data.length).toBe(2);
      expect(data.every(t => t.vendor.includes('Guardant'))).toBe(true);
    });
  });

  describe('findByCancer', () => {
    it('finds tests by cancer type', async () => {
      const { data } = await dal.tests.findByCancer('Colorectal');
      expect(data.length).toBe(3); // mrd-1, mrd-2, ecd-2
      expect(data.every(t => t.cancerTypes.some(c => c.toLowerCase().includes('colorectal')))).toBe(true);
    });
  });

  describe('search', () => {
    it('searches across multiple fields', async () => {
      const { data } = await dal.tests.search('guardant');
      expect(data.length).toBe(2);
    });

    it('searches specific fields', async () => {
      const { data } = await dal.tests.search('guardant', ['vendor']);
      expect(data.length).toBe(2);
    });

    it('applies pagination to search', async () => {
      const { data, meta } = await dal.tests.search('guardant', undefined, { take: 1 });
      expect(data.length).toBe(1);
      expect(meta.total).toBe(2);
      expect(meta.hasMore).toBe(true);
    });
  });

  describe('getStats', () => {
    it('returns database statistics', async () => {
      const stats = await dal.tests.getStats();
      expect(stats.totals.tests).toBe(6);
      expect(stats.totals.vendors).toBe(5);
      expect(stats.byCategory.MRD.tests).toBe(2);
      expect(stats.byCategory.ECD.tests).toBe(2);
    });
  });

  describe('countByCategory', () => {
    it('counts tests by category', async () => {
      const counts = await dal.tests.countByCategory();
      expect(counts.MRD).toBe(2);
      expect(counts.ECD).toBe(2);
      expect(counts.CGP).toBe(1);
      expect(counts.HCT).toBe(1);
    });
  });

  describe('getDistinctCancerTypes', () => {
    it('returns all unique cancer types', async () => {
      const types = await dal.tests.getDistinctCancerTypes();
      expect(types).toContain('Colorectal');
      expect(types).toContain('Breast');
      expect(types).toContain('Lung');
    });

    it('filters by category', async () => {
      const types = await dal.tests.getDistinctCancerTypes('MRD');
      expect(types).toContain('Colorectal');
      expect(types).toContain('Breast');
      expect(types).toContain('Lung');
      expect(types).not.toContain('Multi-cancer');
    });
  });

  describe('getDistinctVendors', () => {
    it('returns all unique vendors', async () => {
      const vendors = await dal.tests.getDistinctVendors();
      expect(vendors).toContain('Natera');
      expect(vendors).toContain('Guardant Health');
      expect(vendors).toContain('GRAIL');
    });
  });
});
