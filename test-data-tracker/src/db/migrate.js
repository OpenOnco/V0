/**
 * Migration runner for MRD Guidance Monitor
 * Runs SQL migrations in order, tracking applied migrations in database
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, transaction, close } from './mrd-client.js';
import { createLogger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const logger = createLogger('mrd-migrate');

/**
 * Ensure migrations tracking table exists
 */
async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS mrd_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

/**
 * Get list of applied migrations
 * @returns {Promise<string[]>}
 */
async function getAppliedMigrations() {
  const result = await query('SELECT name FROM mrd_migrations ORDER BY name');
  return result.rows.map((row) => row.name);
}

/**
 * Get list of pending migrations
 * @returns {Promise<string[]>}
 */
async function getPendingMigrations() {
  const applied = await getAppliedMigrations();
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.filter((f) => !applied.includes(f));
}

/**
 * Run a single migration
 * @param {string} filename - Migration filename
 */
async function runMigration(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  await transaction(async (client) => {
    // Run the migration SQL
    await client.query(sql);

    // Record the migration
    await client.query(
      'INSERT INTO mrd_migrations (name) VALUES ($1)',
      [filename]
    );
  });

  logger.info(`Applied migration: ${filename}`);
}

/**
 * Run all pending migrations
 */
async function migrate() {
  logger.info('Starting MRD database migration');

  try {
    await ensureMigrationsTable();
    const pending = await getPendingMigrations();

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return { applied: [], pending: [] };
    }

    logger.info(`Found ${pending.length} pending migrations`);

    const applied = [];
    for (const migration of pending) {
      await runMigration(migration);
      applied.push(migration);
    }

    logger.info(`Applied ${applied.length} migrations successfully`);
    return { applied, pending: [] };
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    throw error;
  }
}

/**
 * Show migration status
 */
async function status() {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const pending = await getPendingMigrations();

  console.log('\n=== MRD Migration Status ===\n');

  console.log('Applied migrations:');
  if (applied.length === 0) {
    console.log('  (none)');
  } else {
    applied.forEach((m) => console.log(`  ✓ ${m}`));
  }

  console.log('\nPending migrations:');
  if (pending.length === 0) {
    console.log('  (none)');
  } else {
    pending.forEach((m) => console.log(`  ○ ${m}`));
  }

  console.log('');
  return { applied, pending };
}

/**
 * Rollback last migration (for development only)
 * Note: This requires DOWN migration SQL which we don't include
 */
async function rollback() {
  logger.warn('Rollback not implemented - manual intervention required');
  throw new Error('Rollback not implemented');
}

// CLI interface
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] || 'migrate';

  (async () => {
    try {
      switch (command) {
        case 'migrate':
        case 'up':
          await migrate();
          break;
        case 'status':
          await status();
          break;
        case 'rollback':
        case 'down':
          await rollback();
          break;
        default:
          console.log('Usage: node migrate.js [migrate|status|rollback]');
      }
    } catch (error) {
      console.error('Migration error:', error.message);
      process.exit(1);
    } finally {
      await close();
    }
  })();
}

export { migrate, status, getPendingMigrations, getAppliedMigrations };
