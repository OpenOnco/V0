/**
 * Shared Logger Module
 *
 * Provides a consistent Pino-based logging API for both Node.js and browser environments.
 * Automatically detects runtime and uses the appropriate implementation.
 *
 * @module @openonco/logger
 *
 * @example
 * import { createLogger } from '../shared/logger/index.js';
 *
 * const logger = createLogger('crawler:fda', { project: 'physician-system' });
 * logger.info('Starting crawl', { url: 'https://example.com' });
 *
 * const requestLogger = logger.child({ requestId: 'abc-123' });
 * requestLogger.debug('Processing request');
 *
 * @example
 * // Vercel serverless function
 * import { withVercelLogging } from '../shared/logger/index.js';
 *
 * export default withVercelLogging(async (req, res) => {
 *   req.logger.info('Processing request', { method: req.method });
 *   res.json({ success: true });
 * });
 */

// Detect runtime environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node;

// Import appropriate implementation
let createLoggerImpl;
let withVercelLoggingImpl;
let flushAllImpl;

if (isBrowser) {
  // Browser environment - use browser implementation
  const browserModule = await import('./browser.js');
  createLoggerImpl = browserModule.createLogger;
  // Vercel utilities not available in browser
  withVercelLoggingImpl = () => {
    throw new Error('withVercelLogging is not available in browser environment');
  };
  flushAllImpl = async () => {
    // Import and flush browser remote transport
    const { flush } = await import('./transports/browser-remote.js');
    await flush();
  };
} else if (isNode) {
  // Node.js environment - use node implementation
  const nodeModule = await import('./node.js');
  createLoggerImpl = nodeModule.createLogger;
  // Import Vercel utilities
  const vercelModule = await import('./utils/vercel.js');
  withVercelLoggingImpl = vercelModule.withVercelLogging;
  flushAllImpl = vercelModule.flushAll;
} else {
  // Fallback to browser implementation for other environments (e.g., Deno)
  const browserModule = await import('./browser.js');
  createLoggerImpl = browserModule.createLogger;
  withVercelLoggingImpl = () => {
    throw new Error('withVercelLogging is not available in this environment');
  };
  flushAllImpl = async () => {};
}

/**
 * Create a logger instance with the specified module name
 *
 * @param {string} moduleName - Component identifier (e.g., 'crawler:fda', 'chat:server')
 * @param {object} [options={}] - Logger options
 * @param {string} [options.project] - Project identifier ('frontend', 'api', 'physician-system', 'test-data-tracker')
 * @returns {Logger} Logger instance with trace, debug, info, warn, error, fatal methods and child()
 *
 * @example
 * // Basic usage
 * const logger = createLogger('my-module');
 * logger.info('Hello world');
 *
 * @example
 * // With project option
 * const logger = createLogger('crawler:fda', { project: 'physician-system' });
 *
 * @example
 * // With child logger for request context
 * const requestLogger = logger.child({ requestId: 'abc-123' });
 * requestLogger.info('Processing request');
 *
 * @example
 * // Logging errors
 * try {
 *   await doSomething();
 * } catch (error) {
 *   logger.error('Operation failed', { error });
 * }
 */
export function createLogger(moduleName, options = {}) {
  return createLoggerImpl(moduleName, options);
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
  return withVercelLoggingImpl(handler, options);
}

/**
 * Flush all pending logs to their transports
 * Call this before process exit or serverless function termination
 *
 * @returns {Promise<void>}
 *
 * @example
 * // Before process exit
 * await flushAll();
 * process.exit(0);
 */
export async function flushAll() {
  return flushAllImpl();
}

// Re-export utilities that might be useful
export {
  getEnvironment,
  getDefaultLogLevel,
  shouldPrettyPrint,
  autoDetectProject
} from './utils/context.js';

export { serializers, errorSerializer } from './utils/serializers.js';
