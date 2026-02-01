/**
 * Cron job scheduler for the daemon
 * Manages all scheduled tasks with proper error handling
 */

import cron from 'node-cron';
import { createLogger } from './utils/logger.js';
import { config, SOURCES } from './config.js';
import { runCrawler, getCrawlerStatuses } from './crawlers/index.js';
import { sendMondayDigest } from './email/monday-digest.js';
import { cleanupOldDiscoveries } from './queue/index.js';
import { sendProposalNotification } from './email/proposal-notification.js';
import { getStats } from './proposals/queue.js';

const logger = createLogger('scheduler');

// Store active cron jobs
const jobs = new Map();

/**
 * Schedule a crawler job
 */
function scheduleCrawler(source, schedule) {
  const crawlerConfig = config.crawlers[source];

  if (!crawlerConfig?.enabled) {
    logger.info(`Crawler ${source} is disabled, not scheduling`);
    return null;
  }

  logger.info(`Scheduling ${crawlerConfig.name} crawler`, { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info(`Running scheduled crawl: ${crawlerConfig.name}`);

    try {
      const result = await runCrawler(source);
      logger.info(`Scheduled crawl completed: ${crawlerConfig.name}`, {
        success: result.success,
        discoveries: result.discoveries?.length || 0,
        duration: result.duration,
      });

      // After crawl, send notification if there are pending proposals
      await notifyIfPending(source);
    } catch (error) {
      logger.error(`Scheduled crawl failed: ${crawlerConfig.name}`, { error });
    }
  });

  jobs.set(`crawler:${source}`, job);
  return job;
}

/**
 * Schedule the Monday digest email
 */
function scheduleDigest(schedule) {
  logger.info('Scheduling Monday digest', { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info('Sending scheduled Monday digest');

    try {
      const result = await sendMondayDigest();
      logger.info('Monday digest sent', { 
        messageId: result.messageId,
        pendingCount: result.digest?.summary?.totalPending || 0
      });
    } catch (error) {
      logger.error('Failed to send Monday digest', { error });
    }
  });

  jobs.set('digest', job);
  return job;
}

/**
 * Schedule queue cleanup (runs daily at midnight)
 */
function scheduleCleanup() {
  const schedule = '0 0 * * *'; // Midnight daily
  logger.info('Scheduling queue cleanup', { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info('Running scheduled queue cleanup');

    try {
      const result = await cleanupOldDiscoveries();
      logger.info('Queue cleanup completed', { removed: result.removed });
    } catch (error) {
      logger.error('Queue cleanup failed', { error });
    }
  });

  jobs.set('cleanup', job);
  return job;
}

/**
 * Start all scheduled jobs
 */
export function startScheduler() {
  logger.info('Starting scheduler');

  // Schedule crawlers
  scheduleCrawler(SOURCES.CMS, config.schedules.cms);
  scheduleCrawler(SOURCES.VENDOR, config.schedules.vendor);
  scheduleCrawler(SOURCES.PAYERS, config.schedules.payers);

  // Schedule digest
  scheduleDigest(config.schedules.digest);

  // Schedule cleanup
  scheduleCleanup();

  logger.info('Scheduler started', {
    jobs: Array.from(jobs.keys()),
    schedules: {
      cms: config.schedules.cms,
      vendor: config.schedules.vendor,
      payers: config.schedules.payers,
      digest: config.schedules.digest,
    },
  });

  return jobs;
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler() {
  logger.info('Stopping scheduler');

  for (const [name, job] of jobs.entries()) {
    job.stop();
    logger.debug(`Stopped job: ${name}`);
  }

  jobs.clear();
  logger.info('Scheduler stopped');
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  const jobStatuses = {};

  for (const [name, job] of jobs.entries()) {
    jobStatuses[name] = {
      running: job.running || false,
    };
  }

  return {
    activeJobs: jobs.size,
    jobs: jobStatuses,
    schedules: config.schedules,
    crawlerStatuses: getCrawlerStatuses(),
  };
}

/**
 * Send notification if there are pending proposals
 */
async function notifyIfPending(crawlSource) {
  try {
    // Get current stats
    const stats = await getStats();

    // Count proposals by type
    const coverage = stats.byType?.coverage || 0;
    const updates = stats.byType?.update || 0;
    const newTests = stats.byType?.['new-test'] || 0;
    const totalPending = stats.byStatus?.pending || 0;

    // Only send notification if there are pending proposals
    if (totalPending > 0) {
      await sendProposalNotification({
        coverage,
        updates,
        newTests,
        totalPending,
        crawlSource,
      });
    }
  } catch (error) {
    logger.error('notifyIfPending failed', { error: error.message });
  }
}

/**
 * Manually trigger a crawler run
 */
export async function triggerCrawler(source) {
  logger.info(`Manually triggering crawler: ${source}`);
  const result = await runCrawler(source);

  // Also notify for manual triggers
  await notifyIfPending(source);

  return result;
}

/**
 * Manually trigger the digest
 */
export async function triggerDigest() {
  logger.info('Manually triggering Monday digest');
  return sendMondayDigest();
}

/**
 * Run all crawlers immediately (useful for testing)
 */
export async function runAllCrawlersNow() {
  logger.info('Running all crawlers immediately');

  const results = {};
  const sources = [SOURCES.CMS, SOURCES.VENDOR];

  for (const source of sources) {
    try {
      results[source] = await runCrawler(source);
    } catch (error) {
      logger.error(`Crawler ${source} failed`, { error });
      results[source] = { success: false, error: error.message };
    }
  }

  return results;
}

export default {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerCrawler,
  triggerDigest,
  runAllCrawlersNow,
};
