/**
 * Job Lock Manager
 * Prevents overlapping crawler runs using PostgreSQL advisory locks
 * Detects and terminates stuck runs via heartbeat
 */

import { query } from '../db/client.js';
import { createLogger } from './logger.js';

const logger = createLogger('job-lock');

const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Convert job name to integer for pg_advisory_lock
 */
function hashJobName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Detect and terminate stuck runs
 */
async function terminateStuckRuns(jobName) {
  const stuckRuns = await query(`
    UPDATE mrd_crawler_runs
    SET status = 'failed',
        error_message = 'Stuck run detected and auto-terminated after 30 minutes without heartbeat',
        completed_at = NOW()
    WHERE crawler_name = $1
      AND status = 'running'
      AND (
        heartbeat_at IS NULL AND started_at < NOW() - INTERVAL '30 minutes'
        OR heartbeat_at < NOW() - INTERVAL '30 minutes'
      )
    RETURNING id, started_at
  `, [jobName]);

  if (stuckRuns.rows.length > 0) {
    logger.warn(`Terminated ${stuckRuns.rows.length} stuck runs for ${jobName}`, {
      runIds: stuckRuns.rows.map(r => r.id),
    });
  }

  return stuckRuns.rows.length;
}

/**
 * Acquire a lock for a job
 * Returns null if lock cannot be acquired (job already running)
 * Returns a lock object with release() function if acquired
 */
export async function acquireJobLock(jobName) {
  const lockKey = hashJobName(jobName);

  // First, check for and terminate stuck runs
  await terminateStuckRuns(jobName);

  // Try to acquire advisory lock (non-blocking)
  const lockResult = await query(
    'SELECT pg_try_advisory_lock($1) as acquired',
    [lockKey]
  );

  if (!lockResult.rows[0].acquired) {
    logger.info(`Job ${jobName} already running (lock held), skipping this run`);
    return null;
  }

  // Create run record with heartbeat
  const run = await query(`
    INSERT INTO mrd_crawler_runs (
      crawler_name, status, started_at, heartbeat_at
    )
    VALUES ($1, 'running', NOW(), NOW())
    RETURNING id
  `, [jobName]);

  const runId = run.rows[0].id;
  logger.info(`Acquired lock for ${jobName}`, { runId, lockKey });

  // Start heartbeat interval
  const heartbeatInterval = setInterval(async () => {
    try {
      await query(
        'UPDATE mrd_crawler_runs SET heartbeat_at = NOW() WHERE id = $1 AND status = $2',
        [runId, 'running']
      );
    } catch (e) {
      logger.error('Heartbeat update failed', { runId, error: e.message });
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Return lock object
  return {
    runId,
    lockKey,
    jobName,

    /**
     * Release the lock and update run status
     */
    release: async (status, stats = {}, errorMessage = null) => {
      // Stop heartbeat
      clearInterval(heartbeatInterval);

      try {
        // Update run record
        await query(`
          UPDATE mrd_crawler_runs
          SET status = $2,
              completed_at = NOW(),
              items_found = $3,
              items_new = $4,
              items_duplicate = $5,
              error_message = $6,
              high_water_mark = $7
          WHERE id = $1
        `, [
          runId,
          status,
          stats.found || 0,
          stats.new || 0,
          stats.duplicate || 0,
          errorMessage,
          stats.highWaterMark ? JSON.stringify(stats.highWaterMark) : null,
        ]);

        // Release advisory lock
        await query('SELECT pg_advisory_unlock($1)', [lockKey]);
        logger.info(`Released lock for ${jobName}`, { runId, status });
      } catch (e) {
        logger.error('Failed to release lock cleanly', { runId, error: e.message });
        // Still try to release the advisory lock
        try {
          await query('SELECT pg_advisory_unlock($1)', [lockKey]);
        } catch (e2) {
          logger.error('Failed to release advisory lock', { lockKey, error: e2.message });
        }
      }
    },

    /**
     * Update high water mark during run
     */
    updateHighWaterMark: async (hwm) => {
      await query(
        'UPDATE mrd_crawler_runs SET high_water_mark = $2 WHERE id = $1',
        [runId, JSON.stringify(hwm)]
      );
    },

    /**
     * Update stats during run (for progress tracking)
     */
    updateProgress: async (stats) => {
      await query(`
        UPDATE mrd_crawler_runs
        SET items_found = $2, items_new = $3, heartbeat_at = NOW()
        WHERE id = $1
      `, [runId, stats.found || 0, stats.new || 0]);
    },
  };
}

/**
 * Check if a job is currently running
 */
export async function isJobRunning(jobName) {
  const lockKey = hashJobName(jobName);

  // Check if advisory lock is held
  const result = await query(`
    SELECT NOT pg_try_advisory_lock($1) as is_locked
  `, [lockKey]);

  // If we got the lock, release it immediately
  if (!result.rows[0].is_locked) {
    await query('SELECT pg_advisory_unlock($1)', [lockKey]);
    return false;
  }

  return true;
}

/**
 * Get status of all jobs
 */
export async function getJobStatuses() {
  const result = await query(`
    SELECT
      crawler_name,
      status,
      started_at,
      completed_at,
      heartbeat_at,
      items_found,
      items_new,
      error_message,
      EXTRACT(EPOCH FROM (NOW() - COALESCE(heartbeat_at, started_at))) as seconds_since_heartbeat
    FROM mrd_crawler_runs
    WHERE id IN (
      SELECT MAX(id) FROM mrd_crawler_runs GROUP BY crawler_name
    )
    ORDER BY crawler_name
  `);

  return result.rows.map(row => ({
    name: row.crawler_name,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastHeartbeat: row.heartbeat_at,
    secondsSinceHeartbeat: Math.round(row.seconds_since_heartbeat),
    isStuck: row.status === 'running' && row.seconds_since_heartbeat > STUCK_THRESHOLD_MS / 1000,
    stats: {
      found: row.items_found,
      new: row.items_new,
    },
    error: row.error_message,
  }));
}

/**
 * Wrapper to run a function with job lock
 */
export async function withJobLock(jobName, fn) {
  const lock = await acquireJobLock(jobName);

  if (!lock) {
    return { skipped: true, reason: 'Job already running' };
  }

  try {
    const result = await fn(lock);
    await lock.release('completed', result?.stats || {});
    return { success: true, result };
  } catch (error) {
    await lock.release('failed', {}, error.message);
    throw error;
  }
}

export default {
  acquireJobLock,
  isJobRunning,
  getJobStatuses,
  withJobLock,
};
