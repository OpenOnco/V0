/**
 * Queue management for discovered items
 * Wraps store with business logic
 */

import { writeFileSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  loadDiscoveries,
  saveDiscovery,
  markReviewed,
  getUnreviewed,
  loadHealth,
  saveHealth
} from './store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../../data');
const DISCOVERIES_FILE = join(DATA_DIR, 'discoveries.json');

/**
 * Add a discovery to the queue
 * Deduplication based on source + url combination
 */
export function addDiscovery(source, type, data) {
  const discoveries = loadDiscoveries();

  // Deduplication based on source + url combination
  if (data.url) {
    const exists = discoveries.some(d => d.source === source && d.url === data.url);
    if (exists) {
      return null;
    }
  }

  return saveDiscovery({
    source,
    type,
    title: data.title,
    summary: data.summary,
    url: data.url,
    data: data
  });
}

/**
 * Add multiple discoveries to the queue (batch operation)
 * Used by crawlers to add multiple discoveries at once
 * @param {Array} items - Array of discovery objects with { source, type, ...data }
 * @returns {Array} Results with { added: boolean } for each item
 */
export function addDiscoveries(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(item => {
    const { source, type, ...data } = item;
    const result = addDiscovery(source, type, data);
    return { added: result !== null, discovery: result };
  });
}

/**
 * Get count of pending discoveries
 */
export function getPendingCount() {
  return getUnreviewed().length;
}

/**
 * Get discoveries filtered by source
 */
export function getDiscoveriesBySource(source) {
  const discoveries = loadDiscoveries();
  return discoveries.filter(d => d.source === source);
}

/**
 * Record a successful operation for a source
 */
export function recordSuccess(source) {
  const health = loadHealth();

  if (!health[source]) {
    health[source] = {
      lastSuccess: null,
      lastError: null,
      successCount: 0,
      errorCount: 0,
      lastErrorMessage: null
    };
  }

  health[source].lastSuccess = new Date().toISOString();
  health[source].successCount++;

  saveHealth(health);
  return health[source];
}

/**
 * Record an error for a source
 */
export function recordError(source, error) {
  const health = loadHealth();

  if (!health[source]) {
    health[source] = {
      lastSuccess: null,
      lastError: null,
      successCount: 0,
      errorCount: 0,
      lastErrorMessage: null
    };
  }

  health[source].lastError = new Date().toISOString();
  health[source].errorCount++;
  health[source].lastErrorMessage = error instanceof Error ? error.message : String(error);

  saveHealth(health);
  return health[source];
}

/**
 * Get health status for all sources
 */
export function getHealth() {
  return loadHealth();
}

/**
 * Get overall queue status (pending count, health, etc.)
 * Used by API endpoints and email reports
 */
export function getQueueStatus() {
  const discoveries = loadDiscoveries();
  const health = loadHealth();
  const unreviewed = discoveries.filter(d => d.status === 'pending' && !d.reviewedAt);

  return {
    total: discoveries.length,
    pending: unreviewed.length,
    reviewed: discoveries.length - unreviewed.length,
    health
  };
}

/**
 * Cleanup old discoveries (older than specified days)
 * Used by scheduler for maintenance
 * @param {number} daysOld - Remove discoveries older than this many days (default: 30)
 */
export function cleanupOldDiscoveries(daysOld = 30) {
  const discoveries = loadDiscoveries();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const remaining = discoveries.filter(d => {
    const discoveredDate = new Date(d.discoveredAt);
    return discoveredDate > cutoffDate;
  });

  const removed = discoveries.length - remaining.length;

  if (removed > 0) {
    // Atomic write - write to temp file then rename
    const tempPath = `${DISCOVERIES_FILE}.tmp`;
    writeFileSync(tempPath, JSON.stringify(remaining, null, 2), 'utf-8');
    renameSync(tempPath, DISCOVERIES_FILE);
  }

  return { removed, remaining: remaining.length };
}

export {
  markReviewed,
  getUnreviewed,
  loadDiscoveries
};

export default {
  // Discovery management
  addDiscovery,
  addDiscoveries,
  getPendingCount,
  getDiscoveriesBySource,
  markReviewed,
  getUnreviewed,
  loadDiscoveries,
  cleanupOldDiscoveries,

  // Health tracking
  recordSuccess,
  recordError,
  getHealth,
  getQueueStatus
};
