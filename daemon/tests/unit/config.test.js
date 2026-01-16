import { describe, it, expect } from 'vitest';
import {
  config,
  MONITORED_TESTS,
  MONITORED_VENDORS,
  ALL_TEST_NAMES,
  DISCOVERY_TYPES,
  SOURCES,
  isMonitoredTest,
  isMonitoredVendor,
  getTestCategory,
} from '../../src/config.js';

describe('config', () => {
  it('loads config object', () => {
    expect(config).toBeDefined();
    expect(typeof config).toBe('object');
  });

  it('has email configuration', () => {
    expect(config.email).toBeDefined();
    expect(config.email.from).toBeDefined();
    expect(config.email.to).toBeDefined();
  });

  it('has schedules configuration', () => {
    expect(config.schedules).toBeDefined();
    expect(config.schedules.pubmed).toBeDefined();
    expect(config.schedules.cms).toBeDefined();
    expect(config.schedules.fda).toBeDefined();
    expect(config.schedules.vendor).toBeDefined();
    expect(config.schedules.digest).toBeDefined();
  });

  it('has crawlers configuration', () => {
    expect(config.crawlers).toBeDefined();
    expect(config.crawlers.pubmed).toBeDefined();
    expect(config.crawlers.cms).toBeDefined();
    expect(config.crawlers.fda).toBeDefined();
    expect(config.crawlers.vendor).toBeDefined();
  });

  it('has queue configuration', () => {
    expect(config.queue).toBeDefined();
    expect(config.queue.filePath).toBeDefined();
    expect(config.queue.maxItemAge).toBeGreaterThan(0);
  });
});

describe('MONITORED_TESTS', () => {
  it('has mrd, tds, and ecd categories', () => {
    expect(MONITORED_TESTS.mrd).toBeInstanceOf(Array);
    expect(MONITORED_TESTS.tds).toBeInstanceOf(Array);
    expect(MONITORED_TESTS.ecd).toBeInstanceOf(Array);
  });

  it('ALL_TEST_NAMES contains all tests', () => {
    expect(ALL_TEST_NAMES.length).toBeGreaterThan(0);
    expect(ALL_TEST_NAMES).toContain('Signatera');
    expect(ALL_TEST_NAMES).toContain('Galleri');
  });
});

describe('MONITORED_VENDORS', () => {
  it('contains expected vendors', () => {
    expect(MONITORED_VENDORS).toBeInstanceOf(Array);
    expect(MONITORED_VENDORS.length).toBeGreaterThan(0);
    expect(MONITORED_VENDORS).toContain('Natera');
    expect(MONITORED_VENDORS).toContain('Guardant Health');
  });
});

describe('DISCOVERY_TYPES', () => {
  it('has expected discovery types', () => {
    expect(DISCOVERY_TYPES.PUBLICATION).toBe('publication');
    expect(DISCOVERY_TYPES.FDA_APPROVAL).toBe('fda_approval');
    expect(DISCOVERY_TYPES.VENDOR_UPDATE).toBe('vendor_update');
  });
});

describe('SOURCES', () => {
  it('has expected sources', () => {
    expect(SOURCES.PUBMED).toBe('pubmed');
    expect(SOURCES.CMS).toBe('cms');
    expect(SOURCES.FDA).toBe('fda');
    expect(SOURCES.VENDOR).toBe('vendor');
  });
});

describe('helper functions', () => {
  describe('isMonitoredTest', () => {
    it('returns true for monitored tests', () => {
      expect(isMonitoredTest('Signatera')).toBe(true);
      expect(isMonitoredTest('signatera')).toBe(true);
      expect(isMonitoredTest('The Signatera test')).toBe(true);
    });

    it('returns false for unknown tests', () => {
      expect(isMonitoredTest('UnknownTest123')).toBe(false);
    });
  });

  describe('isMonitoredVendor', () => {
    it('returns true for monitored vendors', () => {
      expect(isMonitoredVendor('Natera')).toBe(true);
      expect(isMonitoredVendor('natera')).toBe(true);
      expect(isMonitoredVendor('Guardant Health')).toBe(true);
    });

    it('returns false for unknown vendors', () => {
      expect(isMonitoredVendor('UnknownVendor123')).toBe(false);
    });
  });

  describe('getTestCategory', () => {
    it('returns correct category for tests', () => {
      expect(getTestCategory('Signatera')).toBe('mrd');
      expect(getTestCategory('Galleri')).toBe('tds'); // Galleri appears in both tds and ecd, returns first match
      expect(getTestCategory('FoundationOne CDx')).toBe('tds');
    });

    it('returns null for unknown tests', () => {
      expect(getTestCategory('UnknownTest123')).toBe(null);
    });
  });
});
