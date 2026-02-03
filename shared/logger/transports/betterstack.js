/**
 * Betterstack/Logtail transport for Pino
 *
 * Uses @logtail/pino to stream logs to Betterstack.
 * Falls back gracefully if BETTERSTACK_TOKEN is not configured.
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let logtailInstance = null;
let warningLogged = false;

/**
 * Get or create the Logtail instance for flushing
 * Returns null if token/endpoint is not configured or package not available
 *
 * @returns {object | null} Logtail instance or null
 */
function getLogtailInstance() {
  if (logtailInstance !== null) {
    return logtailInstance;
  }

  const token = process.env.BETTERSTACK_TOKEN;
  const endpoint = process.env.BETTERSTACK_ENDPOINT;

  if (!token || !endpoint) {
    return null;
  }

  try {
    // Use @logtail/node for the Logtail class (flush functionality)
    const { Logtail } = require('@logtail/node');
    logtailInstance = new Logtail(token, { endpoint });
    return logtailInstance;
  } catch (error) {
    if (!warningLogged) {
      console.warn('[logger] @logtail/node not available for flush:', error.message);
      warningLogged = true;
    }
    return null;
  }
}

/**
 * Get Betterstack transport configuration for Pino multi-transport
 *
 * Requires environment variables:
 * - BETTERSTACK_TOKEN: Source token from Betterstack
 * - BETTERSTACK_ENDPOINT: Ingesting host URL (e.g., https://s123456.eu-nbg-2.betterstackdata.com)
 *
 * @param {object} [options={}] - Transport options
 * @param {string} [options.level='info'] - Minimum log level for this transport
 * @returns {object | null} Pino transport target configuration, or null if not available
 */
export function getBetterstackTarget(options = {}) {
  const token = process.env.BETTERSTACK_TOKEN;
  const endpoint = process.env.BETTERSTACK_ENDPOINT;

  if (!token) {
    if (!warningLogged) {
      console.warn('[logger] BETTERSTACK_TOKEN not configured, Betterstack transport disabled');
      warningLogged = true;
    }
    return null;
  }

  if (!endpoint) {
    if (!warningLogged) {
      console.warn('[logger] BETTERSTACK_ENDPOINT not configured, Betterstack transport disabled');
      console.warn('[logger] Set BETTERSTACK_ENDPOINT to your ingesting host (e.g., https://s123456.eu-nbg-2.betterstackdata.com)');
      warningLogged = true;
    }
    return null;
  }

  return {
    target: '@logtail/pino',
    level: options.level || 'info',
    options: {
      sourceToken: token,
      options: {
        endpoint: endpoint
      }
    }
  };
}

/**
 * Flush all pending logs to Betterstack
 * Should be called before serverless function terminates
 *
 * @returns {Promise<void>}
 */
export async function flushBetterstack() {
  const instance = getLogtailInstance();
  if (instance && typeof instance.flush === 'function') {
    try {
      await instance.flush();
    } catch (error) {
      // Silently ignore flush errors to avoid breaking serverless functions
      console.warn('[logger] Failed to flush logs to Betterstack:', error.message);
    }
  }
}

/**
 * Check if Betterstack transport is available
 * Requires both BETTERSTACK_TOKEN and BETTERSTACK_ENDPOINT
 *
 * @returns {boolean}
 */
export function isBetterstackAvailable() {
  return !!process.env.BETTERSTACK_TOKEN && !!process.env.BETTERSTACK_ENDPOINT;
}
