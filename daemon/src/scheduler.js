/**
 * Cron job scheduler for the daemon
 * Manages all scheduled tasks with proper error handling
 *
 * v2: Added discovery job for automatic policy discovery
 */

import cron from 'node-cron';
import { createLogger } from './utils/logger.js';
import { config, SOURCES } from './config.js';
import { runCrawler, getCrawlerStatuses } from './crawlers/index.js';
import { cleanupOldDiscoveries } from './queue/index.js';
import { sendCrawlCompleteEmail } from './email/crawl-complete.js';

// v2: Import discovery crawler
import { runDiscovery, createDocumentCandidateProposal } from './crawlers/discovery.js';
import { initHashStore, getPendingDiscoveries } from './utils/hash-store.js';
import { createProposal } from './proposals/queue.js';
import { PROPOSAL_TYPES } from './proposals/schema.js';

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
    const errors = [];

    try {
      const result = await runCrawler(source);
      logger.info(`Scheduled crawl completed: ${crawlerConfig.name}`, {
        success: result.success,
        discoveries: result.discoveries?.length || 0,
        duration: result.duration,
      });

      // Send crawl complete email with proposals and skipped details
      await sendCrawlCompleteEmail({
        source,
        success: result.success,
        duration: result.duration,
        proposals: result.proposals || [],
        skippedDiscoveries: result.skippedDiscoveries || [],
        errors: result.errors || [],
      });
    } catch (error) {
      logger.error(`Scheduled crawl failed: ${crawlerConfig.name}`, { error });
      errors.push(error.message);

      // Still send email on failure
      await sendCrawlCompleteEmail({
        source,
        success: false,
        proposals: [],
        skippedDiscoveries: [],
        errors,
      });
    }
  });

  jobs.set(`crawler:${source}`, job);
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
 * v2: Schedule discovery job (runs weekly on Sunday at 10 PM)
 */
function scheduleDiscovery() {
  const schedule = config.schedules.discovery || '0 22 * * 0'; // Sunday 10:00 PM
  logger.info('Scheduling discovery job', { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info('Running scheduled policy discovery');

    try {
      await initHashStore();
      const result = await runDiscovery();

      logger.info('Discovery completed', {
        candidates: result.candidates.length,
        errors: result.errors.length,
      });

      // Create proposals for high-relevance discoveries
      let proposalsCreated = 0;
      for (const candidate of result.candidates) {
        if (candidate.relevanceScore >= 0.5) {
          try {
            const proposalData = createDocumentCandidateProposal(candidate);
            await createProposal(PROPOSAL_TYPES.DOCUMENT_CANDIDATE, proposalData);
            proposalsCreated++;
          } catch (error) {
            logger.warn('Failed to create discovery proposal', { error: error.message });
          }
        }
      }

      logger.info('Discovery proposals created', { count: proposalsCreated });

    } catch (error) {
      logger.error('Discovery job failed', { error });
    }
  });

  jobs.set('discovery', job);
  return job;
}

/**
 * v2: Run discovery manually
 */
export async function triggerDiscovery(options = {}) {
  logger.info('Manually triggering discovery');

  await initHashStore();
  const result = await runDiscovery(options);

  // Create proposals for high-relevance discoveries
  let proposalsCreated = 0;
  for (const candidate of result.candidates) {
    if (candidate.relevanceScore >= 0.5) {
      try {
        const proposalData = createDocumentCandidateProposal(candidate);
        await createProposal(PROPOSAL_TYPES.DOCUMENT_CANDIDATE, proposalData);
        proposalsCreated++;
      } catch (error) {
        logger.warn('Failed to create discovery proposal', { error: error.message });
      }
    }
  }

  return {
    ...result,
    proposalsCreated,
  };
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

  // Schedule cleanup
  scheduleCleanup();

  // v2: Schedule discovery
  scheduleDiscovery();

  logger.info('Scheduler started', {
    jobs: Array.from(jobs.keys()),
    schedules: {
      cms: config.schedules.cms,
      vendor: config.schedules.vendor,
      payers: config.schedules.payers,
      discovery: config.schedules.discovery || '0 22 * * 0',
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
  const result = await runCrawler(source);

  // Send crawl complete email with proposals and skipped details
  await sendCrawlCompleteEmail({
    source,
    success: result.success,
    duration: result.duration,
    proposals: result.proposals || [],
    skippedDiscoveries: result.skippedDiscoveries || [],
    errors: result.errors || [],
  });

  return result;
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
  triggerDiscovery,
  runAllCrawlersNow,
};
