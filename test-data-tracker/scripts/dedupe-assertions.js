#!/usr/bin/env node

/**
 * Deduplicate coverage_assertions rows before adding UNIQUE constraint.
 *
 * Groups by (payer_id, test_id, layer, source_policy_id).
 * For each group with count > 1: keeps the row with the latest updated_at,
 * deletes the rest.
 *
 * Usage: node scripts/dedupe-assertions.js
 */

import Database from 'better-sqlite3';
import { resolve } from 'path';

const DB_PATH = resolve(process.cwd(), 'data', 'payer-hashes.db');

console.log(`Opening database: ${DB_PATH}`);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Find duplicate groups
const dupes = db.prepare(`
  SELECT payer_id, test_id, layer, source_policy_id, COUNT(*) as cnt
  FROM coverage_assertions
  GROUP BY payer_id, test_id, layer, source_policy_id
  HAVING COUNT(*) > 1
`).all();

if (dupes.length === 0) {
  console.log('No duplicates found.');
} else {
  console.log(`Found ${dupes.length} duplicate group(s).`);

  let totalDeleted = 0;

  const deleteStmt = db.prepare(`
    DELETE FROM coverage_assertions
    WHERE id IN (
      SELECT id FROM coverage_assertions
      WHERE payer_id = ? AND test_id = ? AND layer = ?
        AND (source_policy_id = ? OR (source_policy_id IS NULL AND ? IS NULL))
      ORDER BY updated_at DESC
      LIMIT -1 OFFSET 1
    )
  `);

  const dedupe = db.transaction(() => {
    for (const { payer_id, test_id, layer, source_policy_id, cnt } of dupes) {
      const result = deleteStmt.run(
        payer_id, test_id, layer, source_policy_id, source_policy_id
      );
      totalDeleted += result.changes;
      console.log(
        `  Deduped (${payer_id}, ${test_id}, ${layer}, ${source_policy_id}): ` +
        `${cnt} → 1 (deleted ${result.changes})`
      );
    }
  });

  dedupe();
  console.log(`\nTotal deleted: ${totalDeleted}`);
}

// Now create the unique index (safe to run even if it already exists)
console.log('\nCreating unique index idx_assertions_unique...');
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_assertions_unique
    ON coverage_assertions(payer_id, test_id, layer, source_policy_id);
`);
console.log('Done.');

db.close();
