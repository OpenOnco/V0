/**
 * Browser-specific Pino logger implementation
 *
 * Provides a browser-compatible logger with:
 * - Console output in development
 * - Optional remote transport in production for important logs
 */

import { addToBatch, isRemoteAvailable, initBrowserRemote } from './transports/browser-remote.js';

// Detect environment in browser context
function getBrowserEnvironment() {
  try {
    // Check Vite dev mode
    // @ts-ignore - import.meta.env is Vite-specific
    if (import.meta.env?.DEV) {
      return 'development';
    }
  } catch {
    // import.meta.env not available
  }

  // Localhost check
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return 'development';
  }

  return 'production';
}

function getBrowserLogLevel() {
  const env = getBrowserEnvironment();
  return env === 'development' ? 'debug' : 'warn';
}

/**
 * Check if remote logging should be enabled
 * Only in production and when endpoint exists
 */
function shouldEnableRemote() {
  const env = getBrowserEnvironment();
  return env === 'production' && isRemoteAvailable();
}

/**
 * Create a browser-compatible logger
 * Uses console methods with structured output format
 *
 * @param {string} moduleName - Component identifier (e.g., 'chat:ui', 'search')
 * @param {object} [options={}] - Logger options
 * @param {string} [options.project] - Project identifier
 * @param {string} [options.remoteEndpoint] - Remote logging endpoint (production only)
 * @param {boolean} [options.enableRemote=true] - Enable remote logging in production
 * @returns {object} Logger instance with Pino-compatible API
 */
export function createLogger(moduleName, options = {}) {
  const project = options.project || 'frontend';
  const hostname = 'browser';
  const minLevel = getBrowserLogLevel();
  const enableRemote = options.enableRemote !== false && shouldEnableRemote();

  // Initialize remote transport if needed
  if (enableRemote) {
    initBrowserRemote({
      remoteEndpoint: options.remoteEndpoint
    });
  }

  // Log level values for filtering
  const levels = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
    silent: Infinity
  };

  // Minimum level for remote transport (warn and above)
  const remoteMinLevel = levels.warn;

  const minLevelValue = levels[minLevel] || 30;

  // Base context for all log entries
  const baseContext = {
    module: moduleName,
    project,
    hostname
  };

  /**
   * Create structured log entry and output to console
   */
  function log(level, levelValue, consoleMethod, message, data = {}) {
    if (levelValue < minLevelValue) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...baseContext,
      msg: message,
      ...data
    };

    // Serialize errors if present
    if (data.error && data.error instanceof Error) {
      entry.error = {
        message: data.error.message,
        name: data.error.name,
        stack: data.error.stack
      };
    }
    if (data.err && data.err instanceof Error) {
      entry.err = {
        message: data.err.message,
        name: data.err.name,
        stack: data.err.stack
      };
    }

    // Output to console
    console[consoleMethod](`[${level.toUpperCase()}] ${moduleName}:`, message, entry);

    // Send to remote if enabled and level is warn or above
    if (enableRemote && levelValue >= remoteMinLevel) {
      addToBatch(entry);
    }
  }

  /**
   * Create a child logger with additional context
   *
   * @param {object} bindings - Additional context
   * @param {object} parentContext - Context from parent logger
   * @returns {object} Child logger instance
   */
  function createChildLogger(bindings, parentContext) {
    const childContext = { ...parentContext, ...bindings };

    function childLog(level, levelValue, consoleMethod, message, data = {}) {
      if (levelValue < minLevelValue) {
        return;
      }

      const entry = {
        timestamp: new Date().toISOString(),
        level,
        ...childContext,
        msg: message,
        ...data
      };

      // Serialize errors if present
      if (data.error && data.error instanceof Error) {
        entry.error = {
          message: data.error.message,
          name: data.error.name,
          stack: data.error.stack
        };
      }
      if (data.err && data.err instanceof Error) {
        entry.err = {
          message: data.err.message,
          name: data.err.name,
          stack: data.err.stack
        };
      }

      console[consoleMethod](`[${level.toUpperCase()}] ${moduleName}:`, message, entry);

      // Send to remote if enabled and level is warn or above
      if (enableRemote && levelValue >= remoteMinLevel) {
        addToBatch(entry);
      }
    }

    return {
      trace: (msg, data) => childLog('trace', levels.trace, 'debug', msg, data),
      debug: (msg, data) => childLog('debug', levels.debug, 'debug', msg, data),
      info: (msg, data) => childLog('info', levels.info, 'info', msg, data),
      warn: (msg, data) => childLog('warn', levels.warn, 'warn', msg, data),
      error: (msg, data) => childLog('error', levels.error, 'error', msg, data),
      fatal: (msg, data) => childLog('fatal', levels.fatal, 'error', msg, data),
      child: (moreBindings) => createChildLogger(moreBindings, childContext)
    };
  }

  const logger = {
    trace: (msg, data) => log('trace', levels.trace, 'debug', msg, data),
    debug: (msg, data) => log('debug', levels.debug, 'debug', msg, data),
    info: (msg, data) => log('info', levels.info, 'info', msg, data),
    warn: (msg, data) => log('warn', levels.warn, 'warn', msg, data),
    error: (msg, data) => log('error', levels.error, 'error', msg, data),
    fatal: (msg, data) => log('fatal', levels.fatal, 'error', msg, data),

    /**
     * Create a child logger with additional context
     * @param {object} bindings - Additional context to include in all logs
     * @returns {object} Child logger instance
     */
    child(bindings) {
      return createChildLogger(bindings, baseContext);
    }
  };

  return logger;
}
