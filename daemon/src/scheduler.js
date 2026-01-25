/**
 * Cron job scheduler for the daemon
 * Manages all scheduled tasks with proper error handling
 */

import cron from 'node-cron';
import { createLogger } from './utils/logger.js';
import { config, SOURCES } from './config.js';
import { runCrawler, getCrawlerStatuses } from './crawlers/index.js';
import { sendDailyDigest } from './email/index.js';
import { cleanupOldDiscoveries } from './queue/index.js';

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
    } catch (error) {
      logger.error(`Scheduled crawl failed: ${crawlerConfig.name}`, { error });
    }
  });

  jobs.set(`crawler:${source}`, job);
  return job;
}

/**
 * Schedule the daily digest email
 */
function scheduleDigest(schedule) {
  logger.info('Scheduling daily digest', { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info('Sending scheduled daily digest');

    try {
      const result = await sendDailyDigest();
      logger.info('Daily digest sent', { messageId: result.messageId });
    } catch (error) {
      logger.error('Failed to send daily digest', { error });
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
  scheduleCrawler(SOURCES.PUBMED, config.schedules.pubmed);
  scheduleCrawler(SOURCES.CMS, config.schedules.cms);
  scheduleCrawler(SOURCES.FDA, config.schedules.fda);
  scheduleCrawler(SOURCES.VENDOR, config.schedules.vendor);
  scheduleCrawler(SOURCES.PREPRINTS, config.schedules.preprints);
  scheduleCrawler(SOURCES.CITATIONS, config.schedules.citations);
  scheduleCrawler(SOURCES.PAYERS, config.schedules.payers);

  // Schedule digest
  scheduleDigest(config.schedules.digest);

  // Schedule cleanup
  scheduleCleanup();

  logger.info('Scheduler started', {
    jobs: Array.from(jobs.keys()),
    schedules: {
      pubmed: config.schedules.pubmed,
      cms: config.schedules.cms,
      fda: config.schedules.fda,
      vendor: config.schedules.vendor,
      preprints: config.schedules.preprints,
      citations: config.schedules.citations,
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
 * Manually trigger a crawler run
 */
export async function triggerCrawler(source) {
  logger.info(`Manually triggering crawler: ${source}`);
  return runCrawler(source);
}

/**
 * Manually trigger the digest
 */
export async function triggerDigest() {
  logger.info('Manually triggering digest');
  return sendDailyDigest();
}

/**
 * Run all crawlers immediately (useful for testing)
 */
export async function runAllCrawlersNow() {
  logger.info('Running all crawlers immediately');

  const results = {};
  const sources = [SOURCES.PUBMED, SOURCES.CMS, SOURCES.FDA, SOURCES.VENDOR, SOURCES.PREPRINTS, SOURCES.CITATIONS, SOURCES.PAYERS];

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
