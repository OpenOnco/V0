/**
 * Cron job scheduler for the daemon
 * Manages all scheduled tasks with proper error handling
 */

import cron from 'node-cron';
import { createLogger } from './utils/logger.js';
import { config, SOURCES } from './config.js';
import { runCrawler, getCrawlerStatuses } from './crawlers/index.js';
import { sendDailyDigest, sendSummaryDigest } from './email/index.js';
import { cleanupOldDiscoveries } from './queue/index.js';
import { triageDiscoveries } from './triage/index.js';
import { exportToGitHub } from './export/github-export.js';

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
 * Schedule AI triage (runs after crawlers finish)
 */
function scheduleTriage(schedule) {
  const triageConfig = config.crawlers.triage;

  if (!triageConfig?.enabled) {
    logger.info('Triage is disabled, not scheduling');
    return null;
  }

  logger.info('Scheduling AI triage', { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info('Running scheduled AI triage');

    try {
      const result = await triageDiscoveries(null, { loadFromQueue: true, verbose: true });
      logger.info('Scheduled triage completed', {
        highPriority: result.highPriority?.length || 0,
        mediumPriority: result.mediumPriority?.length || 0,
        lowPriority: result.lowPriority?.length || 0,
        cost: result.metadata?.costs?.totalCost || '0',
        duration: result.metadata?.durationMs,
      });
    } catch (error) {
      logger.error('Scheduled triage failed', { error });
    }
  });

  jobs.set('triage', job);
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

  // Schedule triage (runs after crawlers)
  scheduleTriage(config.schedules.triage);

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
      triage: config.schedules.triage,
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
 * Manually trigger AI triage
 */
export async function triggerTriage() {
  logger.info('Manually triggering triage');
  return triageDiscoveries(null, { loadFromQueue: true, verbose: true });
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

/**
 * Manually trigger export: triage → export to GitHub → send summary email
 */
export async function triggerExport() {
  logger.info('Manually triggering export to GitHub');

  // Run triage first to get current results
  const triageResults = await triageDiscoveries(null, { loadFromQueue: true, verbose: true });

  // Export to GitHub
  const exportResult = await exportToGitHub(triageResults);

  // Send summary email
  let emailResult = null;
  try {
    emailResult = await sendSummaryDigest({
      triageResults,
    });
  } catch (error) {
    logger.warn('Summary email failed (export still succeeded)', { error: error.message });
  }

  return {
    success: true,
    url: exportResult.url,
    path: exportResult.path,
    sha: exportResult.sha,
    date: exportResult.date,
    emailSent: emailResult?.success || false,
    emailMessageId: emailResult?.messageId || null,
    triage: {
      high: triageResults.highPriority?.length || 0,
      medium: triageResults.mediumPriority?.length || 0,
      low: triageResults.lowPriority?.length || 0,
    },
  };
}

export default {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  triggerCrawler,
  triggerDigest,
  triggerTriage,
  triggerExport,
  runAllCrawlersNow,
};
