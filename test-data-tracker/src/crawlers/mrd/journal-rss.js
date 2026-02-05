/**
 * Journal RSS Feed Crawler
 *
 * Monitors oncology journal RSS feeds for MRD/ctDNA-relevant publications.
 * Feeds are registered in mrd_sources with access_method='rss' and
 * source_type='literature'.
 *
 * Flow:
 * 1. Query mrd_sources for active RSS literature feeds
 * 2. Fetch and parse each RSS feed
 * 3. Filter items for MRD/ctDNA relevance (keyword + vendor matching)
 * 4. Extract DOI from RSS item metadata
 * 5. Resolve to PubMed via publication-resolver
 * 6. Write to physician DB via physician-db-writer
 * 7. Bridge new publications to proposals
 */

import { createHttpClient } from '../../utils/http.js';
import { createLogger } from '../../utils/logger.js';
import { query } from '../../db/mrd-client.js';
import { parseRSSItems, extractDOI } from '../../utils/rss.js';
import { resolvePublication } from '../publication-resolver.js';
import {
  writePublicationToPhysicianDb,
  writeSourceItemEdge,
  isPhysicianDbConfigured,
} from '../physician-db-writer.js';
import { bridgeToProposals } from '../publication-bridge.js';

const logger = createLogger('journal-rss');

const http = createHttpClient('journal-rss', { rateLimitMs: 3000 }); // ~20 req/min

// Keywords for MRD/ctDNA relevance filtering
const MRD_KEYWORDS = [
  'ctdna',
  'circulating tumor dna',
  'cell-free dna',
  'cfdna',
  'liquid biopsy',
  'minimal residual disease',
  'molecular residual disease',
  'companion diagnostic',
  'tumor-informed',
  'tumor-naive',
  'genomic profiling',
  'next generation sequencing',
  'ngs',
  'methylation',
];

// Known MRD/ctDNA test and vendor names
const MRD_VENDORS = [
  'signatera',
  'guardant',
  'guardant360',
  'guardant reveal',
  'foundationone',
  'foundation medicine',
  'tempus',
  'caris',
  'natera',
  'grail',
  'galleri',
  'exact sciences',
  'oncotype',
  'resolution bioscience',
  'personalis',
  'neogenomics',
  'inivata',
  'biodesix',
  'biovica',
];

/**
 * Get active RSS literature sources from mrd_sources
 * @param {string|null} sourceKey - Optional specific source to fetch
 * @returns {Promise<Object[]>}
 */
async function getActiveRSSSources(sourceKey = null) {
  let sql = `
    SELECT id, source_key, source_type, display_name, base_url,
           last_checked_at, stale_threshold_days
    FROM mrd_sources
    WHERE is_active = true
      AND access_method = 'rss'
      AND source_type = 'literature'
  `;
  const params = [];

  if (sourceKey) {
    sql += ' AND source_key = $1';
    params.push(sourceKey);
  }

  sql += ' ORDER BY last_checked_at ASC NULLS FIRST';

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Check if an RSS item is MRD/ctDNA relevant
 * @param {Object} item - Parsed RSS item
 * @returns {{ isRelevant: boolean, matchedTerms: string[] }}
 */
function checkMRDRelevance(item) {
  const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  const matchedTerms = [];

  for (const keyword of MRD_KEYWORDS) {
    if (text.includes(keyword)) {
      matchedTerms.push(keyword);
    }
  }

  for (const vendor of MRD_VENDORS) {
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
 * Check if a GUID has already been processed for a given source
 * @param {string} sourceKey - Source key
 * @param {string} guid - RSS item GUID
 * @returns {Promise<boolean>}
 */
async function isGuidProcessed(sourceKey, guid) {
  const result = await query(
    `SELECT 1 FROM mrd_discovery_queue
     WHERE source_type = 'journal_rss'
       AND source_id = $1
     LIMIT 1`,
    [`${sourceKey}:${guid}`]
  );
  return result.rows.length > 0;
}

/**
 * Record a processed GUID in the discovery queue for dedup
 * @param {string} sourceKey - Source key
 * @param {Object} item - RSS item
 * @param {Object} metadata - Processing metadata
 */
async function recordProcessedItem(sourceKey, item, metadata) {
  await query(
    `INSERT INTO mrd_discovery_queue (
       source_type, source_id, source_url, raw_data,
       status, priority, discovered_at
     ) VALUES ($1, $2, $3, $4, 'processed', 3, NOW())
     ON CONFLICT (source_type, source_id) DO NOTHING`,
    [
      'journal_rss',
      `${sourceKey}:${item.guid}`,
      item.link,
      JSON.stringify({
        title: item.title,
        pubDate: item.pubDate,
        doi: metadata.doi,
        pmid: metadata.pmid,
        matchedTerms: metadata.matchedTerms,
        sourceKey,
      }),
    ]
  );
}

/**
 * Update source last_checked_at timestamp
 * @param {number} sourceId - Source ID in mrd_sources
 */
async function updateSourceChecked(sourceId) {
  await query(
    'UPDATE mrd_sources SET last_checked_at = NOW() WHERE id = $1',
    [sourceId]
  );
}

/**
 * Process a single RSS item - resolve to PubMed, write to physician DB
 * @param {Object} item - Parsed RSS item
 * @param {string} doi - Extracted DOI
 * @param {Object} source - Source row from mrd_sources
 * @param {Object} options - Processing options
 * @returns {Promise<Object|null>} Write result or null
 */
async function processRSSItem(item, doi, source, options = {}) {
  const { dryRun = false, matchedTerms = [] } = options;

  // Try to resolve to PubMed
  let resolvedPub = null;
  try {
    const resolved = await resolvePublication({
      doi,
      title: item.title,
      journal: source.display_name?.replace(' (RSS)', ''),
      publicationDate: item.pubDate ? item.pubDate.toISOString().split('T')[0] : null,
    });

    if (resolved && resolved.length > 0) {
      resolvedPub = resolved[0];
      logger.debug('Resolved to PubMed', {
        title: item.title?.substring(0, 50),
        pmid: resolvedPub.pmid,
      });
    }
  } catch (error) {
    logger.debug('PubMed resolution failed', {
      title: item.title?.substring(0, 50),
      error: error.message,
    });
  }

  // Build publication object
  const pubToWrite = {
    title: resolvedPub?.title || item.title,
    authors: resolvedPub?.authors || null,
    journal: resolvedPub?.journal || source.display_name?.replace(' (RSS)', ''),
    year: resolvedPub?.publicationDate?.substring(0, 4) || (item.pubDate ? String(item.pubDate.getFullYear()) : null),
    publicationDate: resolvedPub?.publicationDate || (item.pubDate ? item.pubDate.toISOString().split('T')[0] : null),
    doi: resolvedPub?.doi || doi,
    pmid: resolvedPub?.pmid || null,
    abstract: resolvedPub?.abstract || null,
    sourceUrl: resolvedPub?.sourceUrl || item.link,
    evidence_type: 'observational', // Default; bridge will refine if actionable
    cancer_types: [],
    clinical_context: item.description,
  };

  if (dryRun) {
    logger.info('Would write publication (dry run)', {
      title: pubToWrite.title?.substring(0, 60),
      pmid: pubToWrite.pmid,
      doi: pubToWrite.doi,
    });
    return { dryRun: true, pmid: pubToWrite.pmid };
  }

  // Write to physician DB
  try {
    const writeResult = await writePublicationToPhysicianDb(pubToWrite, {
      discoveredVia: `journal-rss:${source.source_key}`,
      sourceUrl: item.link,
    });

    if (writeResult.isNew) {
      // Create provenance edge
      try {
        await writeSourceItemEdge(source.id, writeResult.id, {
          extractionMethod: 'rss-keyword-filter',
          confidence: pubToWrite.pmid ? 0.9 : 0.7,
        });
      } catch (edgeError) {
        logger.debug('Edge creation failed (non-fatal)', { error: edgeError.message });
      }

      // Bridge to proposals for new publications
      try {
        await bridgeToProposals(pubToWrite, source);
      } catch (bridgeError) {
        logger.debug('Publication bridge failed (non-fatal)', { error: bridgeError.message });
      }
    }

    // Record processed GUID for dedup
    await recordProcessedItem(source.source_key, item, {
      doi: pubToWrite.doi,
      pmid: pubToWrite.pmid,
      matchedTerms,
    });

    return writeResult;
  } catch (error) {
    logger.error('Failed to write publication', {
      title: pubToWrite.title?.substring(0, 50),
      error: error.message,
    });
    return null;
  }
}

/**
 * Crawl journal RSS feeds for MRD-relevant publications
 *
 * @param {Object} options - Crawl options
 * @param {boolean} options.dryRun - Extract but don't write
 * @param {string} options.sourceKey - Crawl specific source only
 * @returns {Promise<Object>} { success, stats }
 */
export async function crawlJournalRSS(options = {}) {
  const { dryRun = false, sourceKey = null } = options;

  logger.info('Starting journal RSS crawler', { dryRun, sourceKey });

  const stats = {
    sources: 0,
    items: 0,
    relevant: 0,
    alreadyProcessed: 0,
    resolved: 0,
    written: 0,
    newItems: 0,
    failed: 0,
  };

  // Get active RSS literature sources
  const sources = await getActiveRSSSources(sourceKey);

  if (sources.length === 0) {
    logger.warn('No active RSS literature sources found');
    return { success: true, stats };
  }

  logger.info('Found RSS sources', { count: sources.length });

  if (!isPhysicianDbConfigured() && !dryRun) {
    logger.warn('Physician DB not configured - will extract but not write');
  }

  for (const source of sources) {
    logger.info('Processing RSS source', {
      sourceKey: source.source_key,
      name: source.display_name,
      url: source.base_url,
    });

    stats.sources++;

    // Fetch RSS feed
    let items;
    try {
      const xml = await http.getText(source.base_url);
      items = parseRSSItems(xml);
    } catch (error) {
      logger.warn('Failed to fetch RSS feed', {
        sourceKey: source.source_key,
        error: error.message,
      });
      stats.failed++;
      continue;
    }

    stats.items += items.length;
    logger.info('Fetched RSS items', {
      sourceKey: source.source_key,
      count: items.length,
    });

    // Process each item
    for (const item of items) {
      // Check MRD relevance
      const { isRelevant, matchedTerms } = checkMRDRelevance(item);
      if (!isRelevant) continue;

      stats.relevant++;

      // GUID-based dedup
      if (!dryRun && item.guid) {
        const alreadyProcessed = await isGuidProcessed(source.source_key, item.guid);
        if (alreadyProcessed) {
          stats.alreadyProcessed++;
          continue;
        }
      }

      // Extract DOI
      const doi = extractDOI(item);

      // Process item
      const result = await processRSSItem(item, doi, source, {
        dryRun,
        matchedTerms,
      });

      if (result) {
        stats.written++;
        if (result.isNew) stats.newItems++;
        if (result.pmid || (result.dryRun && result.pmid)) stats.resolved++;
      } else {
        stats.failed++;
      }
    }

    // Update source timestamp
    if (!dryRun) {
      await updateSourceChecked(source.id);
    }

    // Rate limiting between sources
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  logger.info('Journal RSS crawl complete', { stats });
  return { success: true, stats };
}

export default { crawlJournalRSS };
