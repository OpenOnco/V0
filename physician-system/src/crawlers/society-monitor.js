/**
 * Society Website/RSS Monitor
 * Checks for new guideline announcements from oncology journals
 */

import axios from 'axios';
import { query } from '../db/client.js';
import { createLogger } from '../utils/logger.js';
import { embedAfterInsert } from '../embeddings/mrd-embedder.js';

const logger = createLogger('society-monitor');

// RSS feeds to monitor
const RSS_FEEDS = {
  jco: {
    url: 'https://ascopubs.org/action/showFeed?type=etoc&feed=rss&jc=jco',
    society: 'asco',
    keywords: ['ctDNA', 'circulating tumor DNA', 'liquid biopsy', 'MRD', 'minimal residual', 'molecular residual'],
  },
  annals_oncology: {
    url: 'https://www.annalsofoncology.org/current.rss',
    society: 'esmo',
    keywords: ['ctDNA', 'circulating tumor DNA', 'liquid biopsy', 'MRD'],
  },
  jitc: {
    url: 'https://jitc.bmj.com/rss/current.xml',
    society: 'sitc',
    keywords: ['ctDNA', 'liquid biopsy', 'biomarker'],
  },
};

// RSS parser supporting both RSS 2.0 and RDF/RSS 1.0 formats
function parseRSS(xml) {
  const items = [];
  // Match <item> with optional attributes (handles RDF format like <item rdf:about="...">)
  const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);

  for (const match of itemMatches) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title') || extractTag(itemXml, 'dc:title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate') || extractTag(itemXml, 'dc:date') || extractTag(itemXml, 'prism:publicationDate');

    if (title && link) {
      items.push({ title, link, description, pubDate });
    }
  }
  return items;
}

function extractTag(xml, tag) {
  // Escape special regex characters in tag name (for namespaced tags like dc:title)
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Handle CDATA
  const cdataMatch = xml.match(new RegExp(`<${escapedTag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${escapedTag}>`, 'i'));
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular content (may contain HTML entities)
  const match = xml.match(new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)</${escapedTag}>`, 'i'));
  if (match) {
    // Clean up any nested tags for description fields
    let content = match[1].trim();
    // Don't strip HTML from description, just return it
    return content;
  }
  return null;
}

function isRelevant(item, keywords) {
  const text = `${item.title} ${item.description || ''}`.toLowerCase();
  return keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
}

export async function monitorRSSFeeds() {
  const results = { checked: 0, relevant: 0, new: 0, feeds: {} };

  for (const [feedName, config] of Object.entries(RSS_FEEDS)) {
    try {
      logger.info(`Checking RSS feed: ${feedName}`);

      const response = await axios.get(config.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'OpenOnco-MRD-Monitor/1.0 (https://openonco.org)',
          'Accept': 'application/rss+xml, application/xml, text/xml',
        },
      });

      const xml = response.data;
      const items = parseRSS(xml);

      const relevantItems = items.filter(item => isRelevant(item, config.keywords));
      results.feeds[feedName] = { total: items.length, relevant: relevantItems.length, new: 0 };
      results.checked += items.length;
      results.relevant += relevantItems.length;

      // Check if items are new (not already in guidance_items)
      for (const item of relevantItems) {
        try {
          const existing = await query(
            'SELECT id FROM mrd_guidance_items WHERE source_url = $1',
            [item.link]
          );

          if (existing.rows.length === 0) {
            // Parse publication date safely
            let pubDate = new Date();
            if (item.pubDate) {
              const parsed = new Date(item.pubDate);
              if (!isNaN(parsed.getTime())) {
                pubDate = parsed;
              }
            }

            // Add directly to guidance_items
            const insertResult = await query(
              `INSERT INTO mrd_guidance_items (
                 source_type, source_id, source_url,
                 title, summary, evidence_type,
                 publication_date, extraction_version
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (source_type, source_id) DO NOTHING
               RETURNING id`,
              [
                `rss-${config.society}`,
                `${feedName}-${Date.now()}`,
                item.link,
                item.title,
                item.description?.substring(0, 1000),
                'review', // Default type for RSS items
                pubDate,
                1,
              ]
            );
            if (insertResult.rows.length > 0) {
              await embedAfterInsert(insertResult.rows[0].id, 'society-rss');
              results.new++;
              results.feeds[feedName].new++;
              logger.info(`Found new RSS item: ${item.title.substring(0, 60)}...`);
            }
          }
        } catch (err) {
          logger.warn(`Failed to process RSS item: ${item.link}`, { error: err.message });
        }
      }

      logger.info(`Feed ${feedName}: ${items.length} items, ${relevantItems.length} relevant`);
    } catch (error) {
      logger.error(`Failed to check RSS feed: ${feedName}`, { error: error.message });
      results.feeds[feedName] = { error: error.message };
    }

    // Rate limit between feeds
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  logger.info('RSS monitoring complete', results);
  return results;
}

export async function checkSingleFeed(feedName) {
  const config = RSS_FEEDS[feedName];
  if (!config) {
    throw new Error(`Unknown feed: ${feedName}. Available: ${Object.keys(RSS_FEEDS).join(', ')}`);
  }

  const response = await axios.get(config.url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'OpenOnco-MRD-Monitor/1.0 (https://openonco.org)',
    },
  });

  const items = parseRSS(response.data);
  const relevant = items.filter(item => isRelevant(item, config.keywords));

  return {
    feed: feedName,
    society: config.society,
    total: items.length,
    relevant: relevant.length,
    items: relevant.slice(0, 10),
  };
}

export default {
  monitorRSSFeeds,
  checkSingleFeed,
  RSS_FEEDS,
};
