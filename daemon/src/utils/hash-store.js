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

    -- Policy coverage tracking
    CREATE TABLE IF NOT EXISTS policy_coverage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id TEXT UNIQUE NOT NULL,
      payer_id TEXT NOT NULL,
      policy_name TEXT,
      url TEXT NOT NULL,
      content_type TEXT,
      policy_type TEXT,
      content_hash TEXT,
      content_snippet TEXT,
      coverage_position TEXT,
      tests_mentioned TEXT,
      effective_date TEXT,
      policy_number TEXT,
      analysis_confidence TEXT,
      raw_analysis TEXT,
      last_fetched TEXT,
      last_changed TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_policy_payer ON policy_coverage(payer_id);
    CREATE INDEX IF NOT EXISTS idx_policy_type ON policy_coverage(policy_type);
    CREATE INDEX IF NOT EXISTS idx_policy_coverage ON policy_coverage(coverage_position);

    -- Discovered policies staging table (for automated discovery)
    CREATE TABLE IF NOT EXISTS discovered_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      discovery_id TEXT UNIQUE NOT NULL,
      payer_id TEXT NOT NULL,
      payer_name TEXT,
      url TEXT NOT NULL,
      link_text TEXT,
      link_context TEXT,
      content_type TEXT,
      policy_type TEXT,
      classification_confidence REAL,
      classification_reason TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_at TEXT,
      reviewed_by TEXT,
      notes TEXT,
      source_page_url TEXT,
      discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_discovered_payer ON discovered_policies(payer_id);
    CREATE INDEX IF NOT EXISTS idx_discovered_status ON discovered_policies(status);
    CREATE INDEX IF NOT EXISTS idx_discovered_url ON discovered_policies(url);
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

// ============================================================================
// Policy Coverage Tracking
// ============================================================================

/**
 * Upsert a policy coverage record
 * @param {Object} policy - Policy data
 */
export function upsertPolicyCoverage(policy) {
  if (!db) throw new Error('Hash store not initialized');

  db.prepare(`
    INSERT INTO policy_coverage (
      policy_id, payer_id, policy_name, url, content_type, policy_type,
      content_hash, content_snippet, coverage_position, tests_mentioned,
      effective_date, policy_number, analysis_confidence, raw_analysis,
      last_fetched, last_changed, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(policy_id) DO UPDATE SET
      policy_name = excluded.policy_name,
      url = excluded.url,
      content_type = excluded.content_type,
      policy_type = excluded.policy_type,
      content_hash = excluded.content_hash,
      content_snippet = excluded.content_snippet,
      coverage_position = excluded.coverage_position,
      tests_mentioned = excluded.tests_mentioned,
      effective_date = excluded.effective_date,
      policy_number = excluded.policy_number,
      analysis_confidence = excluded.analysis_confidence,
      raw_analysis = excluded.raw_analysis,
      last_fetched = excluded.last_fetched,
      last_changed = CASE
        WHEN policy_coverage.content_hash != excluded.content_hash
        THEN excluded.last_fetched
        ELSE policy_coverage.last_changed
      END,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    policy.policyId,
    policy.payerId,
    policy.policyName || null,
    policy.url,
    policy.contentType || null,
    policy.policyType || null,
    policy.contentHash || null,
    policy.contentSnippet?.slice(0, MAX_CONTENT_SIZE) || null,
    policy.coveragePosition || null,
    JSON.stringify(policy.testsMentioned || []),
    policy.effectiveDate || null,
    policy.policyNumber || null,
    policy.analysisConfidence || null,
    policy.rawAnalysis ? JSON.stringify(policy.rawAnalysis) : null,
    policy.lastFetched || new Date().toISOString(),
    policy.lastChanged || null
  );
}

/**
 * Get a policy coverage record by ID
 * @param {string} policyId - Policy ID
 * @returns {Object|null} Policy data
 */
export function getPolicyCoverage(policyId) {
  if (!db) throw new Error('Hash store not initialized');

  const row = db.prepare(`
    SELECT * FROM policy_coverage WHERE policy_id = ?
  `).get(policyId);

  if (!row) return null;

  return {
    policyId: row.policy_id,
    payerId: row.payer_id,
    policyName: row.policy_name,
    url: row.url,
    contentType: row.content_type,
    policyType: row.policy_type,
    contentHash: row.content_hash,
    contentSnippet: row.content_snippet,
    coveragePosition: row.coverage_position,
    testsMentioned: JSON.parse(row.tests_mentioned || '[]'),
    effectiveDate: row.effective_date,
    policyNumber: row.policy_number,
    analysisConfidence: row.analysis_confidence,
    rawAnalysis: row.raw_analysis ? JSON.parse(row.raw_analysis) : null,
    lastFetched: row.last_fetched,
    lastChanged: row.last_changed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get all policy coverage records for a payer
 * @param {string} payerId - Payer ID
 * @returns {Array} Policy records
 */
export function getPoliciesByPayer(payerId) {
  if (!db) throw new Error('Hash store not initialized');

  const rows = db.prepare(`
    SELECT * FROM policy_coverage WHERE payer_id = ?
  `).all(payerId);

  return rows.map(row => ({
    policyId: row.policy_id,
    payerId: row.payer_id,
    policyName: row.policy_name,
    url: row.url,
    coveragePosition: row.coverage_position,
    testsMentioned: JSON.parse(row.tests_mentioned || '[]'),
    lastFetched: row.last_fetched,
    lastChanged: row.last_changed,
  }));
}

/**
 * Get coverage summary across all policies
 * @returns {Object} Coverage statistics
 */
export function getCoverageSummary() {
  if (!db) throw new Error('Hash store not initialized');

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_policies,
      COUNT(DISTINCT payer_id) as total_payers,
      SUM(CASE WHEN coverage_position = 'covered' THEN 1 ELSE 0 END) as covered,
      SUM(CASE WHEN coverage_position = 'not_covered' THEN 1 ELSE 0 END) as not_covered,
      SUM(CASE WHEN coverage_position = 'conditional' THEN 1 ELSE 0 END) as conditional,
      SUM(CASE WHEN coverage_position = 'prior_auth_required' THEN 1 ELSE 0 END) as prior_auth,
      SUM(CASE WHEN coverage_position IS NULL OR coverage_position = 'unknown' THEN 1 ELSE 0 END) as unknown
    FROM policy_coverage
  `).get();

  return stats;
}

/**
 * Get policies that have changed since a given date
 * @param {string} since - ISO date string
 * @returns {Array} Changed policies
 */
export function getChangedPolicies(since) {
  if (!db) throw new Error('Hash store not initialized');

  return db.prepare(`
    SELECT policy_id, payer_id, policy_name, url, coverage_position, last_changed
    FROM policy_coverage
    WHERE last_changed >= ?
    ORDER BY last_changed DESC
  `).all(since);
}

// =============================================================================
// DISCOVERED POLICIES (Staging for automated discovery)
// =============================================================================

/**
 * Generate a discovery ID
 * @param {string} payerId - Payer identifier
 * @param {string} url - Policy URL
 * @returns {string} Unique discovery ID
 */
function generateDiscoveryId(payerId, url) {
  const urlHash = url.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30) || 'unknown';
  const timestamp = Date.now().toString(36);
  return `disc_${payerId}_${urlHash}_${timestamp}`;
}

/**
 * Stage a discovered policy for review
 * @param {Object} discovery - Discovery data
 * @returns {Object} Inserted discovery record
 */
export function stageDiscoveredPolicy(discovery) {
  if (!db) throw new Error('Hash store not initialized');

  const discoveryId = discovery.discoveryId || generateDiscoveryId(discovery.payerId, discovery.url);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO discovered_policies (
      discovery_id, payer_id, payer_name, url, link_text, link_context,
      content_type, policy_type, classification_confidence, classification_reason,
      status, source_page_url, discovered_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    ON CONFLICT(discovery_id) DO UPDATE SET
      classification_confidence = excluded.classification_confidence,
      classification_reason = excluded.classification_reason,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    discoveryId,
    discovery.payerId,
    discovery.payerName || null,
    discovery.url,
    discovery.linkText || null,
    discovery.linkContext || null,
    discovery.contentType || null,
    discovery.policyType || null,
    discovery.classificationConfidence || null,
    discovery.classificationReason || null,
    discovery.sourcePageUrl || null,
    now,
    now
  );

  return { discoveryId, ...discovery };
}

/**
 * Check if a URL is already discovered or in the registry
 * @param {string} url - Policy URL to check
 * @returns {boolean} True if already known
 */
export function isUrlAlreadyDiscovered(url) {
  if (!db) throw new Error('Hash store not initialized');

  // Check discovered_policies
  const discovered = db.prepare(`
    SELECT 1 FROM discovered_policies WHERE url = ? LIMIT 1
  `).get(url);

  if (discovered) return true;

  // Check policy_coverage (already crawled policies)
  const existing = db.prepare(`
    SELECT 1 FROM policy_coverage WHERE url = ? LIMIT 1
  `).get(url);

  return !!existing;
}

/**
 * Get pending discoveries for review
 * @param {Object} options - { payerId, limit }
 * @returns {Array} Pending discoveries
 */
export function getPendingDiscoveries(options = {}) {
  if (!db) throw new Error('Hash store not initialized');

  const { payerId, limit = 100 } = options;

  if (payerId) {
    return db.prepare(`
      SELECT * FROM discovered_policies
      WHERE status = 'pending' AND payer_id = ?
      ORDER BY classification_confidence DESC, discovered_at DESC
      LIMIT ?
    `).all(payerId, limit);
  }

  return db.prepare(`
    SELECT * FROM discovered_policies
    WHERE status = 'pending'
    ORDER BY classification_confidence DESC, discovered_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Update discovery status
 * @param {string} discoveryId - Discovery ID
 * @param {string} status - New status (pending, approved, rejected, ignored)
 * @param {Object} options - { reviewedBy, notes }
 * @returns {boolean} Success
 */
export function updateDiscoveryStatus(discoveryId, status, options = {}) {
  if (!db) throw new Error('Hash store not initialized');

  const now = new Date().toISOString();
  const { reviewedBy, notes } = options;

  const result = db.prepare(`
    UPDATE discovered_policies
    SET status = ?, reviewed_at = ?, reviewed_by = ?, notes = ?, updated_at = ?
    WHERE discovery_id = ?
  `).run(status, now, reviewedBy || null, notes || null, now, discoveryId);

  return result.changes > 0;
}

/**
 * Get a specific discovery by ID
 * @param {string} discoveryId - Discovery ID
 * @returns {Object|null} Discovery record
 */
export function getDiscovery(discoveryId) {
  if (!db) throw new Error('Hash store not initialized');

  return db.prepare(`
    SELECT * FROM discovered_policies WHERE discovery_id = ?
  `).get(discoveryId);
}

/**
 * Get discovery statistics
 * @returns {Object} Stats by status
 */
export function getDiscoveryStats() {
  if (!db) throw new Error('Hash store not initialized');

  return db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) as ignored
    FROM discovered_policies
  `).get();
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
  upsertPolicyCoverage,
  getPolicyCoverage,
  getPoliciesByPayer,
  getCoverageSummary,
  getChangedPolicies,
  // Discovery functions
  stageDiscoveredPolicy,
  isUrlAlreadyDiscovered,
  getPendingDiscoveries,
  updateDiscoveryStatus,
  getDiscovery,
  getDiscoveryStats,
  closeHashStore,
};
