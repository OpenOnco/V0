/**
 * Rotating file transport for Pino using pino-roll
 *
 * Creates daily rotating log files with 14-day retention.
 * Enabled via LOG_TO_FILE=true environment variable.
 */

import fs from 'fs';
import path from 'path';

/**
 * Get the log directory, ensuring it exists
 *
 * @returns {string} Absolute path to log directory
 */
function getLogDirectory() {
  const logDir = process.env.LOG_DIR || './logs';
  const absolutePath = path.resolve(logDir);

  // Ensure directory exists
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }

  return absolutePath;
}

/**
 * Check if file logging is enabled
 *
 * @returns {boolean}
 */
export function isFileLoggingEnabled() {
  return process.env.LOG_TO_FILE === 'true';
}

/**
 * Get file transport configuration for Pino multi-transport
 *
 * Configuration:
 * - Daily rotation
 * - 14-day retention
 * - JSON format (one entry per line)
 * - File naming: app.YYYY-MM-DD.log
 *
 * @param {object} [options={}] - Transport options
 * @param {string} [options.level='info'] - Minimum log level for this transport
 * @param {string} [options.filename='app'] - Base filename (without date suffix)
 * @returns {object | null} Pino transport target configuration, or null if not enabled
 */
export function getFileTarget(options = {}) {
  if (!isFileLoggingEnabled()) {
    return null;
  }

  const logDir = getLogDirectory();
  const filename = options.filename || 'app';
  const filePath = path.join(logDir, filename);

  return {
    target: 'pino-roll',
    level: options.level || 'info',
    options: {
      file: filePath,
      frequency: 'daily',
      limit: {
        count: 14  // Keep 14 days of logs
      },
      mkdir: true,
      symlink: false  // Don't create symlink to latest log
    }
  };
}

/**
 * Get the current log file path (for testing/debugging)
 *
 * @param {string} [filename='app'] - Base filename
 * @returns {string} Full path to today's log file
 */
export function getCurrentLogPath(filename = 'app') {
  const logDir = getLogDirectory();
  const today = new Date().toISOString().split('T')[0];
  return path.join(logDir, `${filename}.${today}.log`);
}
