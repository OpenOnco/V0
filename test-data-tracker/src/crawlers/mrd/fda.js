/**
 * FDA Crawler for MRD Guidance Monitor
 * Monitors FDA approvals, clearances, and guidance documents related to MRD/ctDNA
 *
 * Sources:
 * - FDA Drug@FDA RSS Feed
 * - FDA Device Approvals/Clearances
 * - FDA Guidance Documents
 */

import { createHttpClient } from '../../utils/http.js';
import { createLogger } from '../../utils/logger.js';
import { query } from '../../db/mrd-client.js';
import { parseRSSItems } from '../../utils/rss.js';

const logger = createLogger('mrd-fda');

const http = createHttpClient('fda', { requestsPerMinute: 30 });

// RSS/Atom feeds to monitor
const FDA_FEEDS = {
  drugApprovals: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs-rss-feed/rss.xml',
  deviceApprovals: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medical-devices-rss-feed/rss.xml',
  guidance: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/cdrh-guidance-documents-rss-feed/rss.xml',
};

// Keywords for MRD/ctDNA relevance
const MRD_KEYWORDS = [
  'ctdna',
  'circulating tumor dna',
  'cell-free dna',
  'liquid biopsy',
  'minimal residual disease',
  'molecular residual disease',
  'companion diagnostic',
  'tumor marker',
  'genomic profiling',
  'next generation sequencing',
  'ngs',
];

// Known MRD/ctDNA tests and vendors
const MRD_TESTS_VENDORS = [
  'signatera',
  'guardant',
  'foundationone',
  'tempus',
  'caris',
  'natera',
  'grail',
  'exact sciences',
];

/**
 * Fetch and parse RSS feed
 * @param {string} url - RSS feed URL
 * @returns {Promise<Object[]>}
 */
async function fetchRSSFeed(url) {
  try {
    const xml = await http.getText(url);
    return parseRSSItems(xml);
  } catch (error) {
    logger.warn('Failed to fetch RSS feed', { url, error: error.message });
    return [];
  }
}

// parseRSSItems and cleanHtml imported from ../../utils/rss.js

/**
 * Check if item is MRD/ctDNA relevant
 * @param {Object} item - RSS item
 * @returns {{isRelevant: boolean, matchedTerms: string[]}}
 */
function checkMRDRelevance(item) {
  const text = `${item.title} ${item.description || ''}`.toLowerCase();
  const matchedTerms = [];

  for (const keyword of MRD_KEYWORDS) {
    if (text.includes(keyword)) {
      matchedTerms.push(keyword);
    }
  }

  for (const vendor of MRD_TESTS_VENDORS) {
    if (text.includes(vendor)) {
      matchedTerms.push(vendor);
    }
  }

  return {
    isRelevant: matchedTerms.length > 0,
    matchedTerms,
  };
}

/**
 * Process FDA item into discovery format
 * @param {Object} item - RSS item
 * @param {string} source - Feed source type
 * @returns {Object}
 */
function processItem(item, source, matchedTerms) {
  // Determine evidence type based on source
  let evidenceType = 'regulatory';
  if (source === 'guidance') {
    evidenceType = 'guideline';
  }

  return {
    source_type: 'fda',
    source_id: item.link, // Use link as unique ID
    source_url: item.link,
    title: item.title,
    publication_date: item.pubDate ? item.pubDate.toISOString().split('T')[0] : null,
    evidence_type: evidenceType,
    summary: item.description,
    raw_data: JSON.stringify({
      ...item,
      feedSource: source,
      matchedTerms,
    }),
  };
}

/**
 * Add FDA item to discovery queue
 * @param {Object} item - Processed item
 * @returns {Promise<boolean>}
 */
async function addToQueue(item) {
  try {
    await query(
      `INSERT INTO mrd_discovery_queue (
         source_type, source_id, source_url, raw_data,
         status, priority, discovered_at
       ) VALUES ($1, $2, $3, $4, 'pending', 4, NOW())
       ON CONFLICT (source_type, source_id) DO NOTHING`,
      [item.source_type, item.source_id, item.source_url, item.raw_data]
    );
    return true;
  } catch (error) {
    logger.warn('Failed to add FDA item to queue', { id: item.source_id, error: error.message });
    return false;
  }
}

/**
 * Crawl FDA feeds for MRD-related content
 * @param {Object} options - Crawl options
 * @returns {Promise<Object>}
 */
export async function crawlFDA(options = {}) {
  const { dryRun = false } = options;

  logger.info('Starting FDA crawler', { dryRun });

  const stats = {
    feeds: 0,
    items: 0,
    relevant: 0,
    added: 0,
  };

  for (const [source, url] of Object.entries(FDA_FEEDS)) {
    logger.debug('Fetching FDA feed', { source, url });

    const items = await fetchRSSFeed(url);
    stats.feeds++;
    stats.items += items.length;

    for (const item of items) {
      const { isRelevant, matchedTerms } = checkMRDRelevance(item);

      if (!isRelevant) continue;

      stats.relevant++;

      const processed = processItem(item, source, matchedTerms);

      if (!dryRun) {
        const added = await addToQueue(processed);
        if (added) stats.added++;
      }
    }

    // Rate limiting between feeds
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  logger.info('FDA crawl complete', { stats });
  return { success: true, stats };
}

/**
 * Get recent FDA approvals for a specific test
 * @param {string} testName - Test name to search for
 * @returns {Promise<Object[]>}
 */
export async function getTestApprovals(testName) {
  const result = await query(
    `SELECT * FROM mrd_discovery_queue
     WHERE source_type = 'fda'
       AND (raw_data->>'title' ILIKE $1 OR raw_data->>'description' ILIKE $1)
     ORDER BY discovered_at DESC
     LIMIT 10`,
    [`%${testName}%`]
  );

  return result.rows;
}

export default {
  crawlFDA,
  getTestApprovals,
  FDA_FEEDS,
  MRD_KEYWORDS,
};
