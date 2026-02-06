#!/usr/bin/env node

/**
 * Purge test fixture data from coverage_assertions.
 *
 * Deletes rows where:
 *   - source_policy_id IS NULL (test fixtures lack this)
 *   - payer_id starts with 'test_' or 'mock_'
 *
 * Usage: node scripts/purge-test-data.js
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';

const DB_PATH = resolve(process.cwd(), 'data', 'payer-hashes.db');

console.log(`Opening database: ${DB_PATH}`);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const purge = db.transaction(() => {
  // Delete rows with null source_policy_id
  const nullPolicy = db.prepare(`
    DELETE FROM coverage_assertions WHERE source_policy_id IS NULL
  `).run();
  console.log(`Deleted ${nullPolicy.changes} row(s) with NULL source_policy_id`);

  // Delete rows with test/mock payer IDs
  const testPayers = db.prepare(`
    DELETE FROM coverage_assertions
    WHERE payer_id LIKE 'test_%' OR payer_id LIKE 'mock_%'
  `).run();
  console.log(`Deleted ${testPayers.changes} row(s) with test/mock payer IDs`);

  return nullPolicy.changes + testPayers.changes;
});

const total = purge();
console.log(`\nTotal purged: ${total}`);

db.close();
