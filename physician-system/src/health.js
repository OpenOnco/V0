/**
 * Health tracking for physician-system crawlers
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from './utils/logger.js';

const logger = createLogger('health');
const HEALTH_FILE = './data/health.json';

const DEFAULT_HEALTH = {
  version: 1,
  startedAt: null,
  lastUpdated: null,
  crawlers: {},
  errors: [],
  digestsSent: 0,
  lastDigestSent: null,
};

let healthData = null;

export function getHealth() {
  if (!healthData) {
    try {
      const dir = path.dirname(HEALTH_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(HEALTH_FILE)) {
        healthData = JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8'));
      } else {
        healthData = { ...DEFAULT_HEALTH, startedAt: new Date().toISOString() };
      }
    } catch (e) {
      logger.warn('Failed to load health data, using defaults', { error: e.message });
      healthData = { ...DEFAULT_HEALTH, startedAt: new Date().toISOString() };
    }
  }
  return healthData;
}

function saveHealth() {
  const health = getHealth();
  health.lastUpdated = new Date().toISOString();
  try {
    const dir = path.dirname(HEALTH_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HEALTH_FILE, JSON.stringify(health, null, 2));
  } catch (e) {
    logger.error('Failed to save health data', { error: e.message });
  }
}

export function updateCrawlerHealth(source, status, stats = {}) {
  const health = getHealth();
  health.crawlers[source] = {
    status,
    lastRun: new Date().toISOString(),
    lastSuccess: status === 'success' ? new Date().toISOString() : health.crawlers[source]?.lastSuccess,
    stats,
  };
  saveHealth();
  logger.info(`Crawler health updated: ${source} = ${status}`);
}

export function recordCrawlerError(source, error) {
  const health = getHealth();
  health.errors.push({
    source,
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    timestamp: new Date().toISOString(),
  });
  // Keep last 100 errors
  if (health.errors.length > 100) {
    health.errors = health.errors.slice(-100);
  }
  saveHealth();
  logger.error(`Crawler error recorded: ${source}`, { error: error.message });
}

export function getHealthSummary() {
  const health = getHealth();
  const now = new Date();
  const recentErrors = health.errors.filter(e =>
    new Date(e.timestamp) > new Date(now - 7 * 24 * 60 * 60 * 1000)
  );

  return {
    uptime: health.startedAt ? formatDuration(now - new Date(health.startedAt)) : 'unknown',
    crawlers: Object.entries(health.crawlers).map(([name, data]) => ({
      name,
      status: data.status,
      lastSuccess: data.lastSuccess,
      lastRun: data.lastRun,
      stats: data.stats,
    })),
    recentErrors: recentErrors.slice(-10),
    errorCount: recentErrors.length,
    digestsSent: health.digestsSent,
    lastDigestSent: health.lastDigestSent,
  };
}

function formatDuration(ms) {
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days}d ${hours}h`;
}

export function recordDigestSent() {
  const health = getHealth();
  health.digestsSent++;
  health.lastDigestSent = new Date().toISOString();
  saveHealth();
}

export default {
  getHealth,
  getHealthSummary,
  updateCrawlerHealth,
  recordCrawlerError,
  recordDigestSent,
};
