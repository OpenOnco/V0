/**
 * Node.js-specific Pino logger implementation
 *
 * Wraps Pino to provide Winston-style API: logger.info('message', { data })
 * instead of Pino's native: logger.info({ data }, 'message')
 *
 * Supports multiple transports:
 * - Console (pretty in dev, JSON in prod)
 * - Betterstack (via @logtail/pino)
 * - Rotating files (via pino-roll)
 */
import pino from 'pino';
import os from 'os';
import {
  getEnvironment,
  getDefaultLogLevel,
  shouldPrettyPrint,
  autoDetectProject,
  setHostname
} from './utils/context.js';
import { errorSerializer } from './utils/serializers.js';
import { getBetterstackTarget, isBetterstackAvailable } from './transports/betterstack.js';
import { getFileTarget, isFileLoggingEnabled } from './transports/file.js';

// Initialize hostname at module load
setHostname(os.hostname());

/**
 * Get the configured transport mode
 *
 * @returns {'console' | 'betterstack' | 'both'}
 */
function getTransportMode() {
  const mode = process.env.LOG_TRANSPORT;

  if (mode === 'betterstack' || mode === 'both') {
    return mode;
  }

  // Default: console in dev, betterstack in prod
  const env = getEnvironment();
  if (env === 'production' && isBetterstackAvailable()) {
    return 'betterstack';
  }

  return 'console';
}

/**
 * Build transport targets array based on configuration
 *
 * @param {string} level - Minimum log level
 * @param {boolean} prettyPrint - Whether to use pretty printing
 * @returns {Array} Array of transport targets
 */
function buildTransportTargets(level, prettyPrint) {
  const targets = [];
  const mode = getTransportMode();

  // Console transport
  if (mode === 'console' || mode === 'both') {
    if (prettyPrint) {
      targets.push({
        target: 'pino-pretty',
        level,
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid'
        }
      });
    } else {
      targets.push({
        target: 'pino/file',
        level,
        options: { destination: 1 }  // stdout
      });
    }
  }

  // Betterstack transport
  if (mode === 'betterstack' || mode === 'both') {
    const betterstackTarget = getBetterstackTarget({ level });
    if (betterstackTarget) {
      targets.push(betterstackTarget);
    } else if (mode === 'betterstack') {
      // Betterstack requested but not available - add console as fallback
      if (prettyPrint) {
        targets.push({
          target: 'pino-pretty',
          level,
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid'
          }
        });
      } else {
        targets.push({
          target: 'pino/file',
          level,
          options: { destination: 1 }
        });
      }
    }
  }

  // File transport (independent of mode)
  if (isFileLoggingEnabled()) {
    const fileTarget = getFileTarget({ level });
    if (fileTarget) {
      targets.push(fileTarget);
    }
  }

  return targets;
}

/**
 * Wrap a Pino logger to provide Winston-style API
 * Converts logger.info('message', { data }) to logger.info({ data }, 'message')
 *
 * @param {import('pino').Logger} pinoLogger - Base Pino logger
 * @returns {object} Wrapped logger with Winston-style API
 */
function wrapLogger(pinoLogger) {
  const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

  const wrapped = {};

  for (const level of levels) {
    wrapped[level] = (message, data = {}) => {
      // Serialize any error objects in the data
      const serializedData = { ...data };
      if (serializedData.error instanceof Error) {
        serializedData.error = errorSerializer(serializedData.error);
      }
      if (serializedData.err instanceof Error) {
        serializedData.err = errorSerializer(serializedData.err);
      }

      // Call Pino with (mergingObject, message) signature
      pinoLogger[level](serializedData, message);
    };
  }

  /**
   * Create a child logger with additional context
   * @param {object} bindings - Additional context to include in all logs
   * @returns {object} Child logger with same API
   */
  wrapped.child = (bindings) => {
    return wrapLogger(pinoLogger.child(bindings));
  };

  // Expose the underlying Pino logger for advanced usage
  wrapped._pino = pinoLogger;

  return wrapped;
}

/**
 * Create a Pino logger configured for Node.js
 *
 * @param {string} moduleName - Component identifier (e.g., 'crawler:fda', 'chat:server')
 * @param {object} [options={}] - Logger options
 * @param {string} [options.project] - Project identifier (auto-detected if not provided)
 * @returns {object} Logger with Winston-style API (message, data)
 */
export function createLogger(moduleName, options = {}) {
  const env = getEnvironment();
  const level = getDefaultLogLevel();
  const prettyPrint = shouldPrettyPrint();
  const project = options.project || autoDetectProject();
  const hostname = os.hostname();

  // Base context included in every log entry
  // Betterstack: _host populates Host column; service is for pattern display only
  const base = {
    service: moduleName,    // For live_tail_pattern {service} display
    _host: hostname,        // Populates Betterstack Host column
    module: moduleName,
    project,
    hostname
  };

  // Build logger configuration
  const config = {
    level,
    base
  };

  // Configure transports
  if (env !== 'test') {
    const targets = buildTransportTargets(level, prettyPrint);

    if (targets.length > 0) {
      config.transport = {
        targets
      };
    } else {
      // No transport targets - use level formatter (only allowed without targets)
      config.formatters = {
        level: (label) => ({ level: label })
      };
    }
  } else {
    // Test mode - use level formatter
    config.formatters = {
      level: (label) => ({ level: label })
    };
  }

  const pinoLogger = pino(config);
  return wrapLogger(pinoLogger);
}

export { pino };
