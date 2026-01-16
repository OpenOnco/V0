/**
 * Queue management for discovered items
 * Wraps store with business logic
 */

import {
  loadDiscoveries,
  saveDiscovery,
  markReviewed,
  getUnreviewed,
  loadHealth,
  saveHealth
} from './store.js';

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

export {
  markReviewed,
  getUnreviewed,
  loadDiscoveries
};

export default {
  // Discovery management
  addDiscovery,
  getPendingCount,
  getDiscoveriesBySource,
  markReviewed,
  getUnreviewed,
  loadDiscoveries,

  // Health tracking
  recordSuccess,
  recordError,
  getHealth
};
