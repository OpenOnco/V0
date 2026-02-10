/**
 * Cron job scheduler for the daemon
 * Manages all scheduled tasks with proper error handling
 *
 * v2: Added discovery job for automatic policy discovery
 * v3: Added publication-index integration
 */

import cron from 'node-cron';
import { createLogger } from './utils/logger.js';
import { config, SOURCES } from './config.js';
import { runCrawler, getCrawlerStatuses } from './crawlers/index.js';
import { cleanupOldDiscoveries } from './queue/index.js';
// Per-crawler emails removed in v5 — replaced by single weekly summary via aggregation job

// v2: Import discovery crawler
import { runDiscovery, createDocumentCandidateProposal } from './crawlers/discovery.js';
import { initHashStore, getPendingDiscoveries } from './utils/hash-store.js';
import { createProposal } from './proposals/queue.js';
import { PROPOSAL_TYPES } from './proposals/schema.js';

// v4: Physician digest integration
import { generateDraft, autoSendIfPending } from './digest/send-weekly.js';

// v5: Weekly submissions aggregation
import { buildWeeklySubmissions, cleanupStagingFiles } from './submissions/writer.js';
import { sendWeeklySummaryEmail } from './email/weekly-summary.js';

// v3: Publication index integration (optional)
let publicationIndexModule = null;
try {
  publicationIndexModule = await import('../../publication-index/src/scheduler.js');
} catch (e) {
  // publication-index not available, skip
}

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

      // v5: per-crawler emails removed — weekly summary sent by aggregation job
    } catch (error) {
      logger.error(`Scheduled crawl failed: ${crawlerConfig.name}`, { error });
      errors.push(error.message);
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
 * v3: Schedule publication-index job (runs Sunday 9 PM, before other crawlers)
 */
function schedulePublicationIndex() {
  if (!publicationIndexModule) {
    logger.debug('Publication index module not available, skipping');
    return null;
  }

  const schedule = process.env.PUBINDEX_SCHEDULE || '0 21 * * 0'; // Sunday 9 PM
  logger.info('Scheduling publication-index job', { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info('Running scheduled publication-index crawl');
    try {
      await publicationIndexModule.runWithNotification();
    } catch (error) {
      logger.error('Publication-index crawl failed', { error: error.message });
    }
  });

  jobs.set('publication-index', job);
  return job;
}

/**
 * v5: Schedule weekly submissions aggregation (Monday 12:30 AM)
 * Reads all staging files from crawler results, builds a single weekly
 * submissions file, sends summary email, and cleans up staging.
 */
function scheduleAggregation() {
  const schedule = config.schedules.aggregation || '30 0 * * 1';
  logger.info('Scheduling weekly aggregation', { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info('Running weekly submissions aggregation');

    try {
      const { path: filePath, weeklyFile } = await buildWeeklySubmissions();

      logger.info('Weekly submissions file built', {
        path: filePath,
        total: weeklyFile.stats.total,
        bySource: weeklyFile.stats.bySource,
      });

      // Send single weekly summary email
      await sendWeeklySummaryEmail(weeklyFile);

      // Clean up staging files
      const removed = cleanupStagingFiles();
      logger.info('Staging files cleaned up', { removed });

    } catch (error) {
      logger.error('Weekly aggregation failed', { error: error.message });
    }
  });

  jobs.set('aggregation', job);
  return job;
}

/**
 * v4: Schedule physician digest draft generation (Monday 5 AM)
 */
function schedulePhysicianDigestDraft() {
  const schedule = config.schedules.physicianDigestDraft || '0 5 * * 1';
  logger.info('Scheduling physician digest draft', { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info('Generating physician digest draft');
    try {
      const result = await generateDraft();
      logger.info('Physician digest draft result', result);
    } catch (error) {
      logger.error('Physician digest draft failed', { error: error.message });
    }
  });

  jobs.set('physician-digest-draft', job);
  return job;
}

/**
 * v4: Schedule physician digest auto-send cutoff (Monday 10 AM)
 */
function schedulePhysicianDigestSend() {
  const schedule = config.schedules.physicianDigestSend || '0 10 * * 1';
  logger.info('Scheduling physician digest auto-send', { schedule });

  const job = cron.schedule(schedule, async () => {
    logger.info('Checking physician digest for auto-send');
    try {
      const result = await autoSendIfPending();
      logger.info('Physician digest auto-send result', result);
    } catch (error) {
      logger.error('Physician digest auto-send failed', { error: error.message });
    }
  });

  jobs.set('physician-digest-send', job);
  return job;
}

/**
 * Start all scheduled jobs
 */
export function startScheduler() {
  logger.info('Starting scheduler');

  // v3: Schedule publication-index (runs first)
  schedulePublicationIndex();

  // Schedule crawlers
  scheduleCrawler(SOURCES.CMS, config.schedules.cms);
  scheduleCrawler(SOURCES.VENDOR, config.schedules.vendor);
  scheduleCrawler(SOURCES.PAYERS, config.schedules.payers);
  scheduleCrawler(SOURCES.NIH, config.schedules.nih);

  // Schedule cleanup
  scheduleCleanup();

  // v2: Schedule discovery
  scheduleDiscovery();

  // v5: Schedule weekly aggregation
  scheduleAggregation();

  // v4: Schedule physician digest
  schedulePhysicianDigestDraft();
  schedulePhysicianDigestSend();

  logger.info('Scheduler started', {
    jobs: Array.from(jobs.keys()),
    schedules: {
      publicationIndex: process.env.PUBINDEX_SCHEDULE || '0 21 * * 0',
      cms: config.schedules.cms,
      vendor: config.schedules.vendor,
      payers: config.schedules.payers,
      nih: config.schedules.nih || '0 23 * * 0',
      discovery: config.schedules.discovery || '0 22 * * 0',
      aggregation: config.schedules.aggregation || '30 0 * * 1',
      physicianDigestDraft: config.schedules.physicianDigestDraft || '0 5 * * 1',
      physicianDigestSend: config.schedules.physicianDigestSend || '0 10 * * 1',
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
  // v5: per-crawler emails removed — run aggregation after all crawlers finish
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
