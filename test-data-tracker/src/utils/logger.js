/**
 * Winston-based logging utility with console and file output
 * Features: JSON format, daily rotation, configurable log levels
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { config } from '../config.js';

// Ensure log directory exists
const LOG_DIR = config.logDir || './logs';

// Custom JSON format with timestamp and source
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format with colors for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, source, ...meta }) => {
    const sourceTag = source ? `[${source}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${sourceTag} ${message}${metaStr}`;
  })
);

// Daily rotation transport for combined logs
const dailyRotateTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'daemon-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d', // Keep 14 days of logs
  format: jsonFormat,
  level: config.logLevel,
});

// Separate transport for error logs
const errorRotateTransport = new DailyRotateFile({
  dirname: LOG_DIR,
  filename: 'daemon-error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d', // Keep 30 days of error logs
  format: jsonFormat,
  level: 'error',
});

// Handle rotation events
dailyRotateTransport.on('rotate', (oldFilename, newFilename) => {
  // Log rotation event (will go to new file)
  baseLogger.info('Log file rotated', { oldFilename, newFilename });
});

dailyRotateTransport.on('error', (error) => {
  console.error('Daily rotate transport error:', error);
});

// Create base winston logger
const baseLogger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: { service: 'openonco-daemon' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: consoleFormat,
      level: config.logLevel,
    }),
    // Daily rotating file for all logs
    dailyRotateTransport,
    // Separate file for errors only
    errorRotateTransport,
  ],
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Handle uncaught exceptions and unhandled rejections
baseLogger.exceptions.handle(
  new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'daemon-exceptions-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    format: jsonFormat,
  })
);

/**
 * Create a logger instance with a specific source name
 * @param {string} source - The source/module name for log entries
 * @returns {Object} Logger object with info, warn, error, debug methods
 */
export function createLogger(source) {
  const childLogger = baseLogger.child({ source });

  return {
    /**
     * Log debug message
     * @param {string} message - Log message
     * @param {Object} [meta] - Additional metadata
     */
    debug(message, meta = {}) {
      childLogger.debug(message, meta);
    },

    /**
     * Log info message
     * @param {string} message - Log message
     * @param {Object} [meta] - Additional metadata
     */
    info(message, meta = {}) {
      childLogger.info(message, meta);
    },

    /**
     * Log warning message
     * @param {string} message - Log message
     * @param {Object} [meta] - Additional metadata
     */
    warn(message, meta = {}) {
      childLogger.warn(message, meta);
    },

    /**
     * Log error message
     * @param {string} message - Log message
     * @param {Object} [meta] - Additional metadata (supports error objects)
     */
    error(message, meta = {}) {
      // Handle error objects specially
      if (meta?.error instanceof Error) {
        meta = {
          ...meta,
          errorMessage: meta.error.message,
          stack: meta.error.stack,
        };
        delete meta.error;
      }
      childLogger.error(message, meta);
    },
  };
}

// Default logger for general use
export const logger = createLogger('daemon');

// Export base winston logger for advanced usage
export { baseLogger };

export default logger;
