/**
 * Crawler Registry
 * Central management and factory for all crawlers
 */

import { CMSCrawler } from './cms.js';
import { VendorCrawler } from './vendor.js';
import { PayerCrawler } from './payers.js';
import { BaseCrawler } from './base.js';
import { PlaywrightCrawler } from './playwright-base.js';
import { createLogger } from '../utils/logger.js';
import { SOURCES } from '../config.js';

const logger = createLogger('crawlers');

// Initialize all crawlers (singleton instances)
const crawlers = {
  [SOURCES.CMS]: new CMSCrawler(),
  [SOURCES.VENDOR]: new VendorCrawler(),
  [SOURCES.PAYERS]: new PayerCrawler(),
};

/**
 * Factory function to create all crawler instances
 * @param {Object} queue - Queue instance for recording discoveries (optional, for future use)
 * @returns {Object} - Object with crawler instances keyed by source
 */
export function createAllCrawlers(queue = null) {
  const instances = {
    [SOURCES.CMS]: new CMSCrawler(),
    [SOURCES.VENDOR]: new VendorCrawler(),
    [SOURCES.PAYERS]: new PayerCrawler(),
  };

  // If queue is provided, attach it to each crawler for future use
  if (queue) {
    for (const crawler of Object.values(instances)) {
      crawler.queue = queue;
    }
  }

  logger.info('Created all crawler instances', {
    sources: Object.keys(instances),
    count: Object.keys(instances).length,
  });

  return instances;
}

/**
 * Get a crawler by source ID
 * @param {string} source - Source identifier (from SOURCES)
 * @returns {BaseCrawler} - Crawler instance
 */
export function getCrawler(source) {
  const crawler = crawlers[source];
  if (!crawler) {
    throw new Error(`Unknown crawler source: ${source}`);
  }
  return crawler;
}

/**
 * Get all crawlers
 * @returns {BaseCrawler[]} - Array of all crawler instances
 */
export function getAllCrawlers() {
  return Object.values(crawlers);
}

/**
 * Get enabled crawlers
 * @returns {BaseCrawler[]} - Array of enabled crawler instances
 */
export function getEnabledCrawlers() {
  return Object.values(crawlers).filter((crawler) => crawler.enabled);
}

/**
 * Run a specific crawler by source
 * @param {string} source - Source identifier
 * @returns {Promise<Object>} - Crawl result
 */
export async function runCrawler(source) {
  const crawler = getCrawler(source);
  return crawler.run();
}

/**
 * Run all enabled crawlers sequentially
 * @returns {Promise<Object>} - Results and summary
 */
export async function runAllCrawlers() {
  logger.info('Running all enabled crawlers');

  const results = {};
  const enabledCrawlers = getEnabledCrawlers();

  for (const crawler of enabledCrawlers) {
    try {
      results[crawler.source] = await crawler.run();
    } catch (error) {
      logger.error(`Failed to run crawler ${crawler.source}`, { error });
      results[crawler.source] = {
        success: false,
        error: error.message,
      };
    }
  }

  const summary = {
    total: enabledCrawlers.length,
    successful: Object.values(results).filter((r) => r.success).length,
    failed: Object.values(results).filter((r) => !r.success).length,
    totalDiscoveries: Object.values(results).reduce((sum, r) => sum + (r.discoveries?.length || 0), 0),
  };

  logger.info('All crawlers completed', summary);
  return { results, summary };
}

/**
 * Get status of all crawlers
 * @returns {Object[]} - Array of crawler status objects
 */
export function getCrawlerStatuses() {
  return Object.entries(crawlers).map(([source, crawler]) => ({
    source,
    ...crawler.getStatus(),
  }));
}

// Export crawler classes for direct instantiation
export { BaseCrawler, PlaywrightCrawler, CMSCrawler, VendorCrawler, PayerCrawler };

export default {
  // Factory
  createAllCrawlers,

  // Instance access
  getCrawler,
  getAllCrawlers,
  getEnabledCrawlers,

  // Running
  runCrawler,
  runAllCrawlers,

  // Status
  getCrawlerStatuses,

  // Classes
  BaseCrawler,
  PlaywrightCrawler,
  CMSCrawler,
  VendorCrawler,
  PayerCrawler,
};
