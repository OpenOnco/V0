/**
 * Cron job scheduler for physician-system
 */

import cron from 'node-cron';
import { createLogger } from './utils/logger.js';
import { config } from './config.js';
import { runPubMedCrawler } from './crawlers/index.js';
import { crawlClinicalTrials, syncTrialsToGuidance } from './crawlers/clinicaltrials.js';
import { crawlFDA } from './crawlers/fda.js';
import { ingestCMSData } from './crawlers/cms.js';
import { embedAllMissing } from './embeddings/mrd-embedder.js';
import { linkAllTrials } from './embeddings/cross-link.js';
import { sendWeeklyDigest } from './email/weekly-digest.js';
import { sendDailyAIReport } from './email/daily-ai-report.js';
import { monitorRSSFeeds } from './crawlers/society-monitor.js';
import { checkGuidelineVersions } from './crawlers/version-watcher.js';
import { scanForNewGuidelines } from './crawlers/guideline-watcher.js';
import { acquireJobLock, isJobRunning } from './utils/job-lock.js';
import { query } from './db/client.js';

const logger = createLogger('scheduler');
const jobs = new Map();

// Jobs that should use distributed locking (crawlers that hit external APIs)
const LOCKED_JOBS = ['pubmed', 'fda', 'clinicaltrials', 'cms', 'embed', 'link', 'monitor', 'version-watch', 'guideline-scan'];

/**
 * Run a job with health tracking and optional distributed locking
 */
async function runWithHealthTracking(name, fn) {
  const useLock = LOCKED_JOBS.includes(name);

  // For locked jobs, acquire a distributed lock first
  // The lock creates/updates mrd_crawler_runs records automatically
  if (useLock) {
    const lock = await acquireJobLock(name);
    if (!lock) {
      logger.info(`Skipping ${name} - already running (locked)`);
      return { skipped: true, reason: 'already_running' };
    }

    try {
      logger.info(`Starting scheduled job: ${name}`, { runId: lock.runId });
      const result = await fn();
      const stats = result?.stats || {};

      await lock.release('completed', {
        found: stats.found || stats.items || 0,
        new: stats.new || stats.added || 0,
        duplicate: stats.duplicate || stats.skipped || 0,
        highWaterMark: stats.highWaterMark,
      });

      logger.info(`Completed scheduled job: ${name}`, { runId: lock.runId });
      return result;
    } catch (error) {
      await lock.release('failed', {}, error.message);
      logger.error(`Failed scheduled job: ${name}`, { error: error.message, runId: lock.runId });
      return null;
    }
  }

  // For non-locked jobs (email, reports), create DB record directly
  let runId;
  try {
    const run = await query(
      `INSERT INTO mrd_crawler_runs (crawler_name, mode, status, started_at)
       VALUES ($1, 'scheduled', 'running', NOW()) RETURNING id`,
      [name]
    );
    runId = run.rows[0].id;
  } catch (e) {
    logger.error(`Failed to create run record for ${name}`, { error: e.message });
  }

  try {
    logger.info(`Starting scheduled job: ${name}`, { runId });
    const result = await fn();

    if (runId) {
      await query(
        `UPDATE mrd_crawler_runs SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [runId]
      );
    }

    logger.info(`Completed scheduled job: ${name}`, { runId });
    return result;
  } catch (error) {
    if (runId) {
      await query(
        `UPDATE mrd_crawler_runs SET status = 'failed', completed_at = NOW(), error_message = $2 WHERE id = $1`,
        [runId, error.message]
      );
    }
    logger.error(`Failed scheduled job: ${name}`, { error: error.message, runId });
    return null;
  }
}

function scheduleJob(name, schedule, fn) {
  if (!cron.validate(schedule)) {
    logger.error(`Invalid cron schedule for ${name}: ${schedule}`);
    return;
  }

  const job = cron.schedule(schedule, async () => {
    await runWithHealthTracking(name, fn);
  }, { scheduled: true });

  jobs.set(name, job);
  logger.info(`Scheduled job: ${name} at ${schedule}`);
}

export function startScheduler() {
  logger.info('Starting scheduler');

  // Daily crawlers
  scheduleJob('pubmed', config.schedules.pubmed, () =>
    runPubMedCrawler({ mode: 'incremental', maxResults: 200 })
  );

  scheduleJob('fda', config.schedules.fda, () =>
    crawlFDA({})
  );

  // Weekly crawlers
  scheduleJob('clinicaltrials', config.schedules.clinicaltrials, async () => {
    // Crawl new/updated trials
    const result = await crawlClinicalTrials({ maxResults: 500 });
    // Sync to guidance items for RAG search
    await syncTrialsToGuidance();
    return result;
  });

  scheduleJob('cms', config.schedules.cms, () =>
    ingestCMSData({})
  );

  // Daily processing
  scheduleJob('embed', config.schedules.embed, () =>
    embedAllMissing({ limit: 100 })
  );

  // RSS feed monitoring
  scheduleJob('monitor', config.schedules.monitor, () =>
    monitorRSSFeeds()
  );

  // Weekly processing
  scheduleJob('link', config.schedules.link, () =>
    linkAllTrials({ limit: 100 })
  );

  // Weekly digest
  scheduleJob('digest', config.schedules.digest, sendWeeklyDigest);

  // Daily AI report
  scheduleJob('daily-report', config.schedules.dailyReport, sendDailyAIReport);

  // Version watcher for guidelines
  scheduleJob('version-watch', config.schedules.versionWatch, checkGuidelineVersions);

  // Guideline folder scanner
  scheduleJob('guideline-scan', config.schedules.guidelineScan, scanForNewGuidelines);

  logger.info('Scheduler started', { jobs: Array.from(jobs.keys()) });
}

export function stopScheduler() {
  for (const [name, job] of jobs) {
    job.stop();
    logger.info(`Stopped job: ${name}`);
  }
  jobs.clear();
}

export function getScheduledJobs() {
  return Array.from(jobs.keys()).map(name => ({
    name,
    schedule: config.schedules[name],
    running: jobs.get(name)?.options?.scheduled ?? false,
  }));
}

// Manual triggers for testing
export async function runJobNow(name) {
  const jobFns = {
    pubmed: () => runPubMedCrawler({ mode: 'incremental' }),
    fda: () => crawlFDA({}),
    clinicaltrials: async () => {
      const result = await crawlClinicalTrials({ maxResults: 500 });
      await syncTrialsToGuidance();
      return result;
    },
    cms: () => ingestCMSData({}),
    embed: () => embedAllMissing({ limit: 100 }),
    link: () => linkAllTrials({ limit: 100 }),
    monitor: () => monitorRSSFeeds(),
    'version-watch': checkGuidelineVersions,
    'guideline-scan': scanForNewGuidelines,
    digest: sendWeeklyDigest,
    'daily-report': sendDailyAIReport,
  };

  if (!jobFns[name]) {
    throw new Error(`Unknown job: ${name}. Available: ${Object.keys(jobFns).join(', ')}`);
  }

  return runWithHealthTracking(name, jobFns[name]);
}

export default {
  startScheduler,
  stopScheduler,
  getScheduledJobs,
  runJobNow,
};
