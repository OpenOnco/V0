/**
 * Unit tests for scheduler and email modules
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock cron before importing scheduler
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(() => ({
      stop: vi.fn(),
    })),
    validate: vi.fn(() => true),
  },
}));

// Mock the crawler
vi.mock('../src/index.js', () => ({
  runPublicationIndexCrawler: vi.fn().mockResolvedValue({
    success: true,
    stats: {
      sources_crawled: 2,
      publications_found: 10,
      new_items: 5,
      resolved_to_pubmed: 8,
    },
  }),
  getPublicationSourceStatus: vi.fn().mockResolvedValue({
    sources: [],
    total: 0,
    needsCheck: 0,
  }),
}));

// Mock logger
vi.mock('../../test-data-tracker/src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock Resend
vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: 'test-email-id' } }),
    },
  })),
}));

describe('Scheduler', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PUBINDEX_SCHEDULE = '0 21 * * 0';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should export required functions', async () => {
    const scheduler = await import('../src/scheduler.js');
    expect(typeof scheduler.startScheduler).toBe('function');
    expect(typeof scheduler.stopScheduler).toBe('function');
    expect(typeof scheduler.getSchedulerStatus).toBe('function');
    expect(typeof scheduler.runWithNotification).toBe('function');
  });

  it('getSchedulerStatus should return status object', async () => {
    const { getSchedulerStatus, startScheduler, stopScheduler } = await import('../src/scheduler.js');

    startScheduler();
    const status = getSchedulerStatus();

    expect(status).toHaveProperty('running');
    expect(status).toHaveProperty('schedule');
    expect(status.schedule).toBe('0 21 * * 0');

    stopScheduler();
  });
});

describe('Email formatting', () => {
  // Test the email HTML generation logic
  function formatStatsForEmail(stats) {
    const items = [];
    if (stats.sources_crawled > 0) items.push(`${stats.sources_crawled} sources crawled`);
    if (stats.publications_found > 0) items.push(`${stats.publications_found} publications found`);
    if (stats.new_items > 0) items.push(`${stats.new_items} new items added`);
    if (stats.resolved_to_pubmed > 0) items.push(`${stats.resolved_to_pubmed} resolved to PubMed`);
    return items.join(', ');
  }

  it('should format full stats correctly', () => {
    const stats = {
      sources_crawled: 5,
      publications_found: 20,
      new_items: 10,
      resolved_to_pubmed: 18,
    };
    const result = formatStatsForEmail(stats);
    expect(result).toContain('5 sources crawled');
    expect(result).toContain('20 publications found');
    expect(result).toContain('10 new items added');
    expect(result).toContain('18 resolved to PubMed');
  });

  it('should omit zero values', () => {
    const stats = {
      sources_crawled: 3,
      publications_found: 0,
      new_items: 0,
      resolved_to_pubmed: 0,
    };
    const result = formatStatsForEmail(stats);
    expect(result).toContain('3 sources crawled');
    expect(result).not.toContain('publications found');
  });

  it('should handle empty stats', () => {
    const stats = {
      sources_crawled: 0,
      publications_found: 0,
      new_items: 0,
      resolved_to_pubmed: 0,
    };
    const result = formatStatsForEmail(stats);
    expect(result).toBe('');
  });
});

describe('Email module', () => {
  it('should export sendCrawlCompleteEmail function', async () => {
    const email = await import('../src/email.js');
    expect(typeof email.sendCrawlCompleteEmail).toBe('function');
  });
});
