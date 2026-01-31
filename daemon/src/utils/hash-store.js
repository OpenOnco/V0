/**
 * SQLite-based Hash Storage for Payer Content
 *
 * Provides durable, atomic storage for content hashes with:
 * - Atomic writes (no corruption on crash)
 * - Query by URL, payer, date
 * - Automatic migration from JSON
 * - Content snapshots for diffing
 */

import Database from 'better-sqlite3';
import { readFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';
import { logger } from './logger.js';

// Database path
const DB_PATH = resolve(process.cwd(), 'data', 'payer-hashes.db');
const LEGACY_JSON_PATH = resolve(process.cwd(), 'data', 'payer-hashes.json');

// Maximum content size to store (50KB)
const MAX_CONTENT_SIZE = 50000;

let db = null;

/**
 * Initialize the database connection and schema
 */
export async function initHashStore() {
  if (db) return db;

  // Ensure data directory exists
  await mkdir(dirname(DB_PATH), { recursive: true });

  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');

  // Create schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_hashes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash_key TEXT UNIQUE NOT NULL,
      payer_id TEXT,
      page_type TEXT,
      url TEXT NOT NULL,
      hash TEXT NOT NULL,
      content TEXT,
      fetched_at TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_payer_id ON page_hashes(payer_id);
    CREATE INDEX IF NOT EXISTS idx_url ON page_hashes(url);
    CREATE INDEX IF NOT EXISTS idx_fetched_at ON page_hashes(fetched_at);

    CREATE TABLE IF NOT EXISTS url_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      payer_id TEXT,
      consecutive_failures INTEGER DEFAULT 0,
      last_success TEXT,
      last_failure TEXT,
      last_error TEXT,
      total_successes INTEGER DEFAULT 0,
      total_failures INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_health_payer ON url_health(payer_id);
    CREATE INDEX IF NOT EXISTS idx_health_failures ON url_health(consecutive_failures);
  `);

  // Migrate from JSON if exists
  await migrateFromJson();

  logger.info('Hash store initialized', { path: DB_PATH });
  return db;
}

/**
 * Migrate existing JSON data to SQLite
 */
async function migrateFromJson() {
  if (!existsSync(LEGACY_JSON_PATH)) {
    return;
  }

  try {
    const data = await readFile(LEGACY_JSON_PATH, 'utf-8');
    const hashes = JSON.parse(data);

    const count = Object.keys(hashes).length;
    if (count === 0) return;

    // Check if we already have data
    const existing = db.prepare('SELECT COUNT(*) as count FROM page_hashes').get();
    if (existing.count > 0) {
      logger.debug('Hash store already has data, skipping migration');
      return;
    }

    logger.info(`Migrating ${count} entries from JSON to SQLite`);

    const insert = db.prepare(`
      INSERT OR REPLACE INTO page_hashes
      (hash_key, payer_id, page_type, url, hash, content, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const migrate = db.transaction((entries) => {
      for (const [hashKey, data] of entries) {
        // Parse hash key: "payerId:pageType:url"
        const parts = hashKey.split(':');
        const payerId = parts[0] || null;
        const pageType = parts[1] || null;
        const url = parts.slice(2).join(':') || hashKey;

        insert.run(
          hashKey,
          payerId,
          pageType,
          url,
          data.hash,
          data.content?.slice(0, MAX_CONTENT_SIZE) || null,
          data.fetchedAt || new Date().toISOString()
        );
      }
    });

    migrate(Object.entries(hashes));
    logger.info(`Migrated ${count} entries to SQLite`);

  } catch (error) {
    logger.warn('Failed to migrate from JSON', { error: error.message });
  }
}

/**
 * Get a hash entry by key
 * @param {string} hashKey - The hash key (e.g., "uhc:policy:https://...")
 * @returns {Object|null} Hash data or null if not found
 */
export function getHash(hashKey) {
  if (!db) throw new Error('Hash store not initialized');

  const row = db.prepare(`
    SELECT hash_key, payer_id, page_type, url, hash, content, fetched_at
    FROM page_hashes WHERE hash_key = ?
  `).get(hashKey);

  if (!row) return null;

  return {
    hash: row.hash,
    content: row.content,
    fetchedAt: row.fetched_at,
  };
}

/**
 * Set a hash entry
 * @param {string} hashKey - The hash key
 * @param {Object} data - Hash data { hash, content, fetchedAt }
 */
export function setHash(hashKey, data) {
  if (!db) throw new Error('Hash store not initialized');

  // Parse hash key: "payerId:pageType:url"
  const parts = hashKey.split(':');
  const payerId = parts[0] || null;
  const pageType = parts[1] || null;
  const url = parts.slice(2).join(':') || hashKey;

  db.prepare(`
    INSERT INTO page_hashes (hash_key, payer_id, page_type, url, hash, content, fetched_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(hash_key) DO UPDATE SET
      hash = excluded.hash,
      content = excluded.content,
      fetched_at = excluded.fetched_at,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    hashKey,
    payerId,
    pageType,
    url,
    data.hash,
    data.content?.slice(0, MAX_CONTENT_SIZE) || null,
    data.fetchedAt || new Date().toISOString()
  );
}

/**
 * Get all hashes as an object (for backwards compatibility)
 * @returns {Object} All hashes keyed by hash_key
 */
export function getAllHashes() {
  if (!db) throw new Error('Hash store not initialized');

  const rows = db.prepare(`
    SELECT hash_key, hash, content, fetched_at
    FROM page_hashes
  `).all();

  const result = {};
  for (const row of rows) {
    result[row.hash_key] = {
      hash: row.hash,
      content: row.content,
      fetchedAt: row.fetched_at,
    };
  }
  return result;
}

/**
 * Save all hashes from an object (for backwards compatibility during transition)
 * @param {Object} hashes - Hashes object
 */
export function saveAllHashes(hashes) {
  if (!db) throw new Error('Hash store not initialized');

  const insert = db.prepare(`
    INSERT INTO page_hashes (hash_key, payer_id, page_type, url, hash, content, fetched_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(hash_key) DO UPDATE SET
      hash = excluded.hash,
      content = excluded.content,
      fetched_at = excluded.fetched_at,
      updated_at = CURRENT_TIMESTAMP
  `);

  const save = db.transaction((entries) => {
    for (const [hashKey, data] of entries) {
      const parts = hashKey.split(':');
      const payerId = parts[0] || null;
      const pageType = parts[1] || null;
      const url = parts.slice(2).join(':') || hashKey;

      insert.run(
        hashKey,
        payerId,
        pageType,
        url,
        data.hash,
        data.content?.slice(0, MAX_CONTENT_SIZE) || null,
        data.fetchedAt || new Date().toISOString()
      );
    }
  });

  save(Object.entries(hashes));
}

// ============================================================================
// URL Health Tracking
// ============================================================================

/**
 * Record a successful fetch for a URL
 * @param {string} url - The URL
 * @param {string} payerId - Payer ID
 */
export function recordSuccess(url, payerId = null) {
  if (!db) throw new Error('Hash store not initialized');

  db.prepare(`
    INSERT INTO url_health (url, payer_id, consecutive_failures, last_success, total_successes, updated_at)
    VALUES (?, ?, 0, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(url) DO UPDATE SET
      consecutive_failures = 0,
      last_success = CURRENT_TIMESTAMP,
      total_successes = total_successes + 1,
      updated_at = CURRENT_TIMESTAMP
  `).run(url, payerId);
}

/**
 * Record a failed fetch for a URL
 * @param {string} url - The URL
 * @param {string} payerId - Payer ID
 * @param {string} error - Error message
 */
export function recordFailure(url, payerId = null, error = null) {
  if (!db) throw new Error('Hash store not initialized');

  db.prepare(`
    INSERT INTO url_health (url, payer_id, consecutive_failures, last_failure, last_error, total_failures, updated_at)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(url) DO UPDATE SET
      consecutive_failures = consecutive_failures + 1,
      last_failure = CURRENT_TIMESTAMP,
      last_error = ?,
      total_failures = total_failures + 1,
      updated_at = CURRENT_TIMESTAMP
  `).run(url, payerId, error, error);
}

/**
 * Get health status for a URL
 * @param {string} url - The URL
 * @returns {Object|null} Health status or null
 */
export function getUrlHealth(url) {
  if (!db) throw new Error('Hash store not initialized');

  return db.prepare(`
    SELECT url, payer_id, consecutive_failures, last_success, last_failure,
           last_error, total_successes, total_failures
    FROM url_health WHERE url = ?
  `).get(url);
}

/**
 * Get all URLs that have failed consecutively N or more times
 * @param {number} threshold - Failure threshold
 * @returns {Object[]} Array of unhealthy URLs
 */
export function getUnhealthyUrls(threshold = 3) {
  if (!db) throw new Error('Hash store not initialized');

  return db.prepare(`
    SELECT url, payer_id, consecutive_failures, last_success, last_failure, last_error
    FROM url_health
    WHERE consecutive_failures >= ?
    ORDER BY consecutive_failures DESC
  `).all(threshold);
}

/**
 * Check if a URL should be skipped due to consecutive failures
 * @param {string} url - The URL
 * @param {number} threshold - Failure threshold (default: 5)
 * @returns {boolean} True if URL should be skipped
 */
export function shouldSkipUrl(url, threshold = 5) {
  const health = getUrlHealth(url);
  return health && health.consecutive_failures >= threshold;
}

/**
 * Get health summary for all URLs
 * @returns {Object} Health summary stats
 */
export function getHealthSummary() {
  if (!db) throw new Error('Hash store not initialized');

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_urls,
      SUM(CASE WHEN consecutive_failures = 0 THEN 1 ELSE 0 END) as healthy,
      SUM(CASE WHEN consecutive_failures > 0 AND consecutive_failures < 3 THEN 1 ELSE 0 END) as degraded,
      SUM(CASE WHEN consecutive_failures >= 3 THEN 1 ELSE 0 END) as unhealthy,
      SUM(total_successes) as total_successes,
      SUM(total_failures) as total_failures
    FROM url_health
  `).get();

  return stats;
}

/**
 * Close the database connection
 */
export function closeHashStore() {
  if (db) {
    db.close();
    db = null;
    logger.debug('Hash store closed');
  }
}

export default {
  initHashStore,
  getHash,
  setHash,
  getAllHashes,
  saveAllHashes,
  recordSuccess,
  recordFailure,
  getUrlHealth,
  getUnhealthyUrls,
  shouldSkipUrl,
  getHealthSummary,
  closeHashStore,
};
