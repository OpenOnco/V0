/**
 * PostgreSQL client for MRD Guidance Monitor
 * Connects to Railway PostgreSQL with pgvector extension
 */

import pg from 'pg';
import { createLogger } from '../utils/logger.js';

const { Pool } = pg;
const logger = createLogger('mrd-db');

let pool = null;

/**
 * Initialize the PostgreSQL connection pool
 * @returns {pg.Pool}
 */
export function getPool() {
  if (!pool) {
    const connectionString = process.env.MRD_DATABASE_URL || process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('MRD_DATABASE_URL or DATABASE_URL environment variable is required');
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected PostgreSQL pool error', { error: err.message });
    });

    pool.on('connect', () => {
      logger.debug('New PostgreSQL client connected');
    });
  }

  return pool;
}

/**
 * Execute a query with parameters
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const pool = getPool();
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn('Slow query detected', { duration, text: text.substring(0, 100) });
    }

    return result;
  } catch (error) {
    logger.error('Query failed', { error: error.message, text: text.substring(0, 100) });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  const pool = getPool();
  return pool.connect();
}

/**
 * Run a function within a transaction
 * @param {Function} fn - Function to run with client
 * @returns {Promise<any>}
 */
export async function transaction(fn) {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close the connection pool
 */
export async function close() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
}

/**
 * Check database connection health
 * @returns {Promise<{connected: boolean, error?: string}>}
 */
export async function healthCheck() {
  try {
    const result = await query('SELECT NOW() as now, version() as version');
    return {
      connected: true,
      timestamp: result.rows[0].now,
      version: result.rows[0].version,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}

/**
 * Check if pgvector extension is available
 * @returns {Promise<boolean>}
 */
export async function hasPgVector() {
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as has_vector
    `);
    return result.rows[0].has_vector;
  } catch (error) {
    logger.warn('Failed to check pgvector extension', { error: error.message });
    return false;
  }
}

export default {
  getPool,
  query,
  getClient,
  transaction,
  close,
  healthCheck,
  hasPgVector,
};
