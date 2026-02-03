/**
 * Vercel serverless function utilities
 *
 * Provides a wrapper for Vercel functions that:
 * - Extracts request ID from x-vercel-id header
 * - Creates request-scoped child logger
 * - Logs cold start events
 * - Ensures logs flush before function terminates
 */

import { createLogger } from '../node.js';
import { flushBetterstack } from '../transports/betterstack.js';

// Track cold starts - first invocation of this instance
let isFirstInvocation = true;

/**
 * Generate a random request ID as fallback
 *
 * @returns {string} Random ID in format 'local-xxxxxxxx'
 */
function generateRequestId() {
  return 'local-' + Math.random().toString(36).substring(2, 10);
}

/**
 * Flush all transports
 * Called before serverless function terminates
 *
 * @returns {Promise<void>}
 */
export async function flushAll() {
  await flushBetterstack();
  // File transport doesn't need explicit flush - writes are sync
}

/**
 * Wrap a Vercel serverless handler with logging utilities
 *
 * Features:
 * - Extracts request ID from x-vercel-id header
 * - Creates request-scoped child logger available as req.logger
 * - Logs cold start events on first invocation
 * - Flushes all transports before function terminates
 *
 * @param {function} handler - Vercel request handler (req, res) => Promise<void>
 * @param {object} [options={}] - Wrapper options
 * @param {string} [options.moduleName='api'] - Module name for logger
 * @returns {function} Wrapped handler
 *
 * @example
 * import { withVercelLogging } from '../shared/logger/index.js';
 *
 * export default withVercelLogging(async (req, res) => {
 *   req.logger.info('Processing request', { method: req.method });
 *   res.json({ success: true });
 * });
 */
export function withVercelLogging(handler, options = {}) {
  const moduleName = options.moduleName || 'api';
  const baseLogger = createLogger(moduleName, { project: 'api' });

  return async (req, res) => {
    // Extract or generate request ID
    const requestId = req.headers['x-vercel-id'] || generateRequestId();

    // Create request-scoped child logger
    const logger = baseLogger.child({
      requestId,
      method: req.method,
      url: req.url
    });

    // Attach logger to request for handler access
    req.logger = logger;

    // Log cold start on first invocation
    if (isFirstInvocation) {
      logger.info('Cold start', { runtime: 'vercel' });
      isFirstInvocation = false;
    }

    try {
      // Execute the handler
      return await handler(req, res);
    } catch (error) {
      // Log unhandled errors
      logger.error('Unhandled error in request handler', { error });
      throw error;
    } finally {
      // Flush all transports before function terminates
      await flushAll();
    }
  };
}

/**
 * Check if we're running in a Vercel environment
 *
 * @returns {boolean}
 */
export function isVercelEnvironment() {
  return process.env.VERCEL === '1';
}

/**
 * Get Vercel environment type
 *
 * @returns {'production' | 'preview' | 'development' | null}
 */
export function getVercelEnv() {
  if (!isVercelEnvironment()) {
    return null;
  }
  return process.env.VERCEL_ENV || 'development';
}
