/**
 * MRD Guidance Monitor - Main Crawler Orchestrator
 *
 * Supports multiple modes:
 * - seed: Manual import of priority items (no crawling)
 * - backfill: Historical crawl with full pipeline
 * - incremental: Daily crawl since last run
 * - catchup: Fill gaps if crawler was down
 */

import { createLogger } from '../../utils/logger.js';
import { query, transaction, getClient, close } from '../../db/mrd-client.js';
import { crawlMRDArticles } from './pubmed.js';
import { batchPrefilter } from '../../triage/mrd-prefilter.js';
import { batchTriage } from '../../triage/mrd-triage.js';
import { batchClassify } from '../../triage/mrd-classifier.js';

const logger = createLogger('mrd-crawler');

// Default date range for backfill
const DEFAULT_BACKFILL_START = '2023-01-01';

/**
 * Get the last high water mark for a crawler
 * @param {string} crawlerName - Crawler name (pubmed, clinicaltrials, etc)
 * @returns {Promise<{lastDate: string, lastId: string} | null>}
 */
async function getHighWaterMark(crawlerName) {
  try {
    const result = await query(
      'SELECT get_crawler_high_water_mark($1) as high_water_mark',
      [crawlerName]
    );
    return result.rows[0]?.high_water_mark || null;
  } catch (error) {
    logger.warn('Failed to get high water mark', { crawlerName, error: error.message });
    return null;
  }
}

/**
 * Create a new crawler run record
 * @param {string} crawlerName - Crawler name
 * @param {string} mode - Run mode
 * @param {Object} config - Run configuration
 * @returns {Promise<number>} - Run ID
 */
async function createCrawlerRun(crawlerName, mode, config = {}) {
  const result = await query(
    `INSERT INTO mrd_crawler_runs (crawler_name, mode, started_at, status, config)
     VALUES ($1, $2, NOW(), 'running', $3)
     RETURNING id`,
    [crawlerName, mode, JSON.stringify(config)]
  );
  return result.rows[0].id;
}

/**
 * Update crawler run with results
 * @param {number} runId - Run ID
 * @param {Object} results - Run results
 */
async function updateCrawlerRun(runId, results) {
  const {
    status = 'completed',
    itemsFound = 0,
    itemsNew = 0,
    itemsDuplicate = 0,
    itemsRejected = 0,
    highWaterMark = null,
    errorMessage = null,
  } = results;

  await query(
    `UPDATE mrd_crawler_runs SET
       completed_at = NOW(),
       status = $2,
       items_found = $3,
       items_new = $4,
       items_duplicate = $5,
       items_rejected = $6,
       high_water_mark = $7,
       error_message = $8,
       duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER
     WHERE id = $1`,
    [runId, status, itemsFound, itemsNew, itemsDuplicate, itemsRejected,
      highWaterMark ? JSON.stringify(highWaterMark) : null, errorMessage]
  );
}

/**
 * Check if an item already exists in the database
 * @param {string} sourceType - Source type
 * @param {string} sourceId - Source ID (e.g., PMID)
 * @returns {Promise<boolean>}
 */
async function itemExists(sourceType, sourceId) {
  const result = await query(
    `SELECT 1 FROM mrd_guidance_items WHERE source_type = $1 AND source_id = $2
     UNION
     SELECT 1 FROM mrd_discovery_queue WHERE source_type = $1 AND source_id = $2`,
    [sourceType, sourceId]
  );
  return result.rows.length > 0;
}

/**
 * Add item to discovery queue
 * @param {Object} article - Article data
 * @param {Object} classification - AI classification
 * @param {number} runId - Crawler run ID
 */
async function addToDiscoveryQueue(article, classification, runId) {
  await query(
    `INSERT INTO mrd_discovery_queue (
       source_type, source_id, source_url, raw_data,
       ai_processed_at, ai_relevance_score, ai_classification, ai_summary, ai_model,
       status, priority, crawler_run_id
     ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, 'ai_triaged', $9, $10)
     ON CONFLICT (source_type, source_id) DO UPDATE SET
       ai_processed_at = NOW(),
       ai_relevance_score = $5,
       ai_classification = $6,
       ai_summary = $7`,
    [
      'pubmed',
      article.pmid,
      article.sourceUrl,
      JSON.stringify(article),
      classification.relevance_score,
      JSON.stringify(classification),
      classification.summary,
      classification.model,
      Math.max(1, 10 - classification.relevance_score), // Higher relevance = lower priority number
      runId,
    ]
  );
}

/**
 * Run PubMed crawler with specified mode
 * @param {Object} options - Crawl options
 * @returns {Promise<Object>} - Crawl results
 */
export async function runPubMedCrawler(options = {}) {
  const {
    mode = 'incremental',
    fromDate,
    toDate,
    maxResults = 500,
    skipTriage = false,
    skipClassify = false,
    dryRun = false,
  } = options;

  logger.info('Starting MRD PubMed crawler', { mode, fromDate, toDate, maxResults });

  // Determine date range based on mode
  let effectiveFromDate = fromDate;
  let effectiveToDate = toDate || new Date().toISOString().split('T')[0];

  if (mode === 'incremental' && !fromDate) {
    const hwm = await getHighWaterMark('pubmed');
    effectiveFromDate = hwm?.lastDate || DEFAULT_BACKFILL_START;
    logger.info('Using high water mark', { fromDate: effectiveFromDate });
  } else if (mode === 'backfill' && !fromDate) {
    effectiveFromDate = DEFAULT_BACKFILL_START;
  }

  // Create run record
  let runId = null;
  if (!dryRun) {
    try {
      runId = await createCrawlerRun('pubmed', mode, {
        fromDate: effectiveFromDate,
        toDate: effectiveToDate,
        maxResults,
      });
    } catch (error) {
      logger.warn('Failed to create run record', { error: error.message });
    }
  }

  const stats = {
    found: 0,
    prefiltered: 0,
    triaged: 0,
    classified: 0,
    added: 0,
    duplicate: 0,
    rejected: 0,
  };

  try {
    // Step 1: Crawl PubMed
    logger.info('Step 1: Crawling PubMed', { fromDate: effectiveFromDate, toDate: effectiveToDate });
    const articles = await crawlMRDArticles({
      fromDate: effectiveFromDate,
      toDate: effectiveToDate,
      maxResults,
    });
    stats.found = articles.length;
    logger.info('PubMed crawl complete', { found: stats.found });

    if (articles.length === 0) {
      if (runId) {
        await updateCrawlerRun(runId, {
          status: 'completed',
          itemsFound: 0,
          highWaterMark: { lastDate: effectiveToDate },
        });
      }
      return { success: true, stats };
    }

    // Step 2: Keyword pre-filter
    logger.info('Step 2: Keyword pre-filter');
    const { passed: prefiltered, rejected: prefilteredOut } = batchPrefilter(articles);
    stats.prefiltered = prefiltered.length;
    stats.rejected += prefilteredOut.length;
    logger.info('Pre-filter complete', {
      passed: prefiltered.length,
      rejected: prefilteredOut.length,
    });

    // Step 3: AI Triage (if not skipped)
    let triaged = prefiltered;
    if (!skipTriage && prefiltered.length > 0) {
      logger.info('Step 3: AI Triage with Haiku');
      const triageResult = await batchTriage(prefiltered, { minScore: 6 });
      triaged = triageResult.passed;
      stats.triaged = triaged.length;
      stats.rejected += triageResult.stats.total - triageResult.stats.passed;
      logger.info('Triage complete', {
        passed: triaged.length,
        rejected: triageResult.stats.total - triageResult.stats.passed,
      });
    } else {
      stats.triaged = prefiltered.length;
    }

    // Step 4: Full classification (if not skipped)
    let classified = triaged;
    if (!skipClassify && triaged.length > 0) {
      logger.info('Step 4: Full classification with Sonnet');
      const classifyResult = await batchClassify(triaged);
      classified = classifyResult.results;
      stats.classified = classified.length;
      logger.info('Classification complete', {
        classified: classified.length,
        failed: classifyResult.failed.length,
      });
    } else {
      stats.classified = triaged.length;
    }

    // Step 5: Add to database (if not dry run)
    if (!dryRun && classified.length > 0) {
      logger.info('Step 5: Adding to discovery queue');

      for (const article of classified) {
        try {
          // Check for duplicates
          const exists = await itemExists('pubmed', article.pmid);
          if (exists) {
            stats.duplicate++;
            continue;
          }

          // Add to queue
          await addToDiscoveryQueue(
            article,
            article.classification || article.triageResult || { relevance_score: 5 },
            runId
          );
          stats.added++;
        } catch (error) {
          logger.warn('Failed to add article', { pmid: article.pmid, error: error.message });
        }
      }

      logger.info('Database update complete', { added: stats.added, duplicate: stats.duplicate });
    }

    // Update run record
    if (runId) {
      await updateCrawlerRun(runId, {
        status: 'completed',
        itemsFound: stats.found,
        itemsNew: stats.added,
        itemsDuplicate: stats.duplicate,
        itemsRejected: stats.rejected,
        highWaterMark: { lastDate: effectiveToDate },
      });
    }

    logger.info('MRD PubMed crawler complete', { stats });
    return { success: true, stats, articles: classified };

  } catch (error) {
    logger.error('MRD PubMed crawler failed', { error: error.message });

    if (runId) {
      await updateCrawlerRun(runId, {
        status: 'failed',
        itemsFound: stats.found,
        itemsNew: stats.added,
        errorMessage: error.message,
      });
    }

    return { success: false, error: error.message, stats };
  }
}

/**
 * Detect and fill gaps in crawler runs
 * @param {string} crawlerName - Crawler name
 * @returns {Promise<Object>} - Gap fill results
 */
export async function fillGaps(crawlerName = 'pubmed') {
  logger.info('Checking for crawler gaps', { crawlerName });

  const result = await query(
    'SELECT * FROM detect_crawler_gaps($1, $2)',
    [crawlerName, 2]
  );

  const gaps = result.rows;
  if (gaps.length === 0) {
    logger.info('No gaps detected');
    return { gaps: [], filled: 0 };
  }

  logger.info('Gaps detected', { count: gaps.length });

  let filled = 0;
  for (const gap of gaps) {
    logger.info('Filling gap', {
      from: gap.gap_start,
      to: gap.gap_end,
      days: gap.gap_days,
    });

    await runPubMedCrawler({
      mode: 'catchup',
      fromDate: gap.gap_start.toISOString().split('T')[0],
      toDate: gap.gap_end.toISOString().split('T')[0],
    });

    filled++;
  }

  return { gaps, filled };
}

export default {
  runPubMedCrawler,
  fillGaps,
  getHighWaterMark,
};
