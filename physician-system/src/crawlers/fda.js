/**
 * FDA Crawler for MRD Guidance Monitor
 * Monitors FDA approvals, clearances, and guidance documents related to MRD/ctDNA
 *
 * Sources:
 * - FDA Drug@FDA RSS Feed
 * - FDA Device Approvals/Clearances
 * - FDA Guidance Documents
 */

import { createHttpClient } from '../utils/http.js';
import { createLogger } from '../utils/logger.js';
import { query } from '../db/client.js';
import { embedAfterInsert } from '../embeddings/mrd-embedder.js';

const logger = createLogger('mrd-fda');

const http = createHttpClient('fda', { requestsPerMinute: 30 });

// RSS/Atom feeds to monitor (updated Feb 2026)
const FDA_FEEDS = {
  drugs: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/drugs/rss.xml',
  pressReleases: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml',
  medwatch: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch/rss.xml',
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

/**
 * Parse RSS XML into items
 * Simple regex-based parsing for RSS feeds
 * @param {string} xml - RSS XML content
 * @returns {Object[]}
 */
function parseRSSItems(xml) {
  const items = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const itemXml = match[1];

    const title = extractRSSTag(itemXml, 'title');
    const link = extractRSSTag(itemXml, 'link');
    const description = extractRSSTag(itemXml, 'description');
    const pubDate = extractRSSTag(itemXml, 'pubDate');
    const category = extractRSSTag(itemXml, 'category');

    if (title) {
      items.push({
        title: cleanHtml(title),
        link,
        description: cleanHtml(description),
        pubDate: pubDate ? new Date(pubDate) : null,
        category: cleanHtml(category),
      });
    }
  }

  return items;
}

function extractRSSTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tagName}>`, 'i'));
  return match ? match[1].trim() : null;
}

function cleanHtml(text) {
  if (!text) return null;
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

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
 * Generate a short hash for long source IDs
 * @param {string} str - String to hash
 * @returns {string}
 */
function shortHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
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

  // Use a truncated/hashed ID if URL is too long
  let sourceId = item.link;
  if (sourceId && sourceId.length > 90) {
    sourceId = `fda-${shortHash(item.link)}-${item.link.slice(-50)}`;
  }

  return {
    source_type: 'fda',
    source_id: sourceId,
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
 * Add FDA item directly to guidance_items
 * @param {Object} item - Processed item
 * @returns {Promise<boolean>}
 */
async function addToGuidanceItems(item) {
  try {
    const result = await query(
      `INSERT INTO mrd_guidance_items (
         source_type, source_id, source_url,
         title, summary, evidence_type,
         publication_date, extraction_version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (source_type, source_id) DO NOTHING
       RETURNING id`,
      [
        item.source_type,
        item.source_id,
        item.source_url,
        item.title,
        item.summary,
        item.evidence_type,
        item.publication_date ? new Date(item.publication_date) : new Date(),
        1,
      ]
    );
    if (result.rows.length > 0) {
      await embedAfterInsert(result.rows[0].id, 'fda');
    }
    return result.rows.length > 0;
  } catch (error) {
    logger.warn('Failed to add FDA item', { id: item.source_id, error: error.message });
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
        const added = await addToGuidanceItems(processed);
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
