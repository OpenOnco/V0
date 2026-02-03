/**
 * Publication Index Scheduler
 *
 * Cron job scheduler for the publication index crawler.
 * Can run standalone or be integrated into test-data-tracker's scheduler.
 *
 * Default schedule: Sunday 9 PM (before test-data-tracker crawlers at 10-11 PM)
 */

import cron from 'node-cron';
import { runPublicationIndexCrawler } from './index.js';
import { sendCrawlCompleteEmail } from './email.js';
import { createLogger } from '../../test-data-tracker/src/utils/logger.js';

const logger = createLogger('pubindex-scheduler');

// Default schedule: Sunday 9 PM PT
const DEFAULT_SCHEDULE = process.env.PUBINDEX_SCHEDULE || '0 21 * * 0';

let job = null;

/**
 * Run the publication index crawler with email notification
 */
export async function runWithNotification(options = {}) {
  logger.info('Starting publication index crawl');

  try {
    const result = await runPublicationIndexCrawler(options);

    logger.info('Publication index crawl complete', {
      success: result.success,
      stats: result.stats,
      duration: result.duration,
    });

    // Send email notification
    await sendCrawlCompleteEmail(result);

    return result;
  } catch (error) {
    logger.error('Publication index crawl failed', { error: error.message });

    // Send error notification
    await sendCrawlCompleteEmail({
      success: false,
      error: error.message,
      stats: {
        sources_crawled: 0,
        sources_skipped: 0,
        sources_failed: 0,
        publications_found: 0,
        new_items: 0,
        updated_items: 0,
        resolved_to_pubmed: 0,
        guardrails_set: 0,
      },
    });

    throw error;
  }
}

/**
 * Start the scheduler
 */
export function startScheduler(schedule = DEFAULT_SCHEDULE) {
  if (job) {
    logger.warn('Scheduler already running');
    return job;
  }

  logger.info('Starting publication index scheduler', { schedule });

  job = cron.schedule(schedule, async () => {
    logger.info('Running scheduled publication index crawl');
    try {
      await runWithNotification();
    } catch (error) {
      logger.error('Scheduled crawl failed', { error: error.message });
    }
  });

  logger.info('Publication index scheduler started', { schedule });
  return job;
}

/**
 * Stop the scheduler
 */
export function stopScheduler() {
  if (job) {
    job.stop();
    job = null;
    logger.info('Publication index scheduler stopped');
  }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    running: job !== null,
    schedule: DEFAULT_SCHEDULE,
  };
}

export default {
  runWithNotification,
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
};
