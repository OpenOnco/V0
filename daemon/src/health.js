/**
 * Health tracking for the daemon
 * Tracks crawler status, errors, and uptime
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { createLogger } from './utils/logger.js';
import { config } from './config.js';

const logger = createLogger('health');

// In-memory health data
let healthData = null;

/**
 * Initialize health tracking
 */
function createEmptyHealth() {
  return {
    version: 1,
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    crawlers: {},
    errors: [],
    digestsSent: 0,
    lastDigestSent: null,
  };
}

/**
 * Load health data from file
 */
async function loadHealth() {
  try {
    const dir = dirname(config.healthFile);
    await mkdir(dir, { recursive: true });

    const data = await readFile(config.healthFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.info('Health file not found, initializing');
      return createEmptyHealth();
    }
    logger.error('Failed to load health data', { error });
    return createEmptyHealth();
  }
}

/**
 * Save health data to file
 */
async function saveHealth() {
  if (!healthData) return;

  try {
    const dir = dirname(config.healthFile);
    await mkdir(dir, { recursive: true });

    healthData.lastUpdated = new Date().toISOString();
    await writeFile(config.healthFile, JSON.stringify(healthData, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to save health data', { error });
  }
}

/**
 * Get health data
 */
export async function getHealth() {
  if (!healthData) {
    healthData = await loadHealth();
  }
  return healthData;
}

/**
 * Update crawler health status
 */
export async function updateCrawlerHealth(source, status) {
  const health = await getHealth();

  health.crawlers[source] = {
    ...health.crawlers[source],
    ...status,
    updatedAt: new Date().toISOString(),
  };

  await saveHealth();
  logger.debug(`Updated health for ${source}`, status);
}

/**
 * Record an error
 */
export async function recordCrawlerError(source, error) {
  const health = await getHealth();

  const errorEntry = {
    source,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  };

  health.errors.push(errorEntry);

  // Keep only last 100 errors
  if (health.errors.length > 100) {
    health.errors = health.errors.slice(-100);
  }

  // Update crawler status
  health.crawlers[source] = {
    ...health.crawlers[source],
    lastError: errorEntry,
    status: 'error',
    updatedAt: new Date().toISOString(),
  };

  await saveHealth();
  logger.debug(`Recorded error for ${source}`, { message: error.message });
}

/**
 * Record digest sent
 */
export async function recordDigestSent() {
  const health = await getHealth();
  health.digestsSent++;
  health.lastDigestSent = new Date().toISOString();
  await saveHealth();
}

/**
 * Get health summary for digest
 */
export async function getHealthSummary() {
  const health = await getHealth();

  const uptime = Date.now() - new Date(health.startedAt).getTime();
  const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
  const uptimeDays = Math.floor(uptimeHours / 24);

  const recentErrors = health.errors.filter((e) => {
    const errorTime = new Date(e.timestamp).getTime();
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return errorTime > dayAgo;
  });

  return {
    startedAt: health.startedAt,
    uptime: uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours % 24}h` : `${uptimeHours}h`,
    crawlers: Object.entries(health.crawlers).map(([source, data]) => ({
      source,
      ...data,
    })),
    recentErrorCount: recentErrors.length,
    recentErrors: recentErrors.slice(-5),
    digestsSent: health.digestsSent,
    lastDigestSent: health.lastDigestSent,
  };
}

/**
 * Reset health tracking (for testing)
 */
export async function resetHealth() {
  healthData = createEmptyHealth();
  await saveHealth();
}

export default {
  getHealth,
  updateCrawlerHealth,
  recordCrawlerError,
  recordDigestSent,
  getHealthSummary,
  resetHealth,
};
