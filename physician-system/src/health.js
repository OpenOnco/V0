/**
 * Health tracking for physician-system crawlers
 * DB-backed via mrd_crawler_runs table (replaces ephemeral health.json)
 */

import { query } from './db/client.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger('health');

// Process start time for uptime calculation (in-memory, resets on deploy)
const PROCESS_START = new Date();

/**
 * Get a full health summary from the DB.
 * Replaces the old file-based getHealthSummary().
 */
export async function getHealthSummary() {
  const [
    crawlerStatuses,
    lastSuccesses,
    errorCount,
    recentErrors,
    digestCount,
  ] = await Promise.all([
    // Latest run per crawler
    query(`
      SELECT DISTINCT ON (crawler_name)
             crawler_name, status, started_at, completed_at,
             items_found, items_new, error_message
      FROM mrd_crawler_runs
      ORDER BY crawler_name, started_at DESC
    `),
    // Last successful run per crawler
    query(`
      SELECT DISTINCT ON (crawler_name)
             crawler_name, completed_at
      FROM mrd_crawler_runs
      WHERE status = 'completed'
      ORDER BY crawler_name, completed_at DESC
    `),
    // Error count in last 7 days
    query(`
      SELECT COUNT(*)::int as count
      FROM mrd_crawler_runs
      WHERE status = 'failed'
        AND completed_at > NOW() - INTERVAL '7 days'
    `),
    // Recent errors (last 10)
    query(`
      SELECT crawler_name, error_message, completed_at
      FROM mrd_crawler_runs
      WHERE status = 'failed'
        AND error_message IS NOT NULL
      ORDER BY completed_at DESC
      LIMIT 10
    `),
    // Digest count
    query(`
      SELECT COUNT(*)::int as count
      FROM mrd_crawler_runs
      WHERE crawler_name = 'digest'
        AND status = 'completed'
    `),
  ]);

  // Build a lookup of last success per crawler
  const successMap = new Map(
    lastSuccesses.rows.map(r => [r.crawler_name, r.completed_at])
  );

  const now = new Date();

  return {
    uptime: formatDuration(now - PROCESS_START),
    crawlers: crawlerStatuses.rows.map(r => ({
      name: r.crawler_name,
      status: r.status === 'completed' ? 'success' : r.status === 'failed' ? 'error' : r.status,
      lastSuccess: successMap.get(r.crawler_name) || null,
      lastRun: r.started_at,
      stats: {
        found: r.items_found,
        new: r.items_new,
      },
    })),
    recentErrors: recentErrors.rows.map(r => ({
      source: r.crawler_name,
      message: r.error_message,
      timestamp: r.completed_at,
    })),
    errorCount: errorCount.rows[0].count,
    digestsSent: digestCount.rows[0].count,
    lastDigestSent: null, // not tracked separately anymore
  };
}

function formatDuration(ms) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

// No-ops — tracking is now handled by scheduler.js writing to mrd_crawler_runs
export function updateCrawlerHealth() {}
export function recordCrawlerError() {}
export function recordDigestSent() {}

export default {
  getHealthSummary,
  updateCrawlerHealth,
  recordCrawlerError,
  recordDigestSent,
};
