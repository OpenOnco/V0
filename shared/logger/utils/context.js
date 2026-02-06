/**
 * Context utilities for logger metadata
 */

// Cache hostname at module load for Node.js
let cachedHostname = null;

/**
 * Get hostname for log entries (synchronous)
 * Node.js: uses os.hostname()
 * Browser: returns 'browser'
 *
 * @returns {string} Hostname identifier
 */
export function getHostname() {
  // Return cached value if available
  if (cachedHostname !== null) {
    return cachedHostname;
  }

  // Node.js environment - hostname will be set by node.js module
  if (typeof process !== 'undefined' && process.versions?.node) {
    return cachedHostname || 'node';
  }

  // Browser environment
  cachedHostname = 'browser';
  return cachedHostname;
}

/**
 * Set hostname directly (called by node.js module at init)
 * @param {string} hostname
 */
export function setHostname(hostname) {
  cachedHostname = hostname;
}

/**
 * Auto-detect project from environment or file path
 *
 * Priority:
 * 1. OPENONCO_PROJECT environment variable
 * 2. Path analysis (if available)
 * 3. Default to 'unknown'
 *
 * @param {string} [hint] - Optional path hint for detection
 * @returns {string} Project identifier
 */
export function autoDetectProject(hint) {
  // Check environment variable first
  if (typeof process !== 'undefined' && process.env?.OPENONCO_PROJECT) {
    return process.env.OPENONCO_PROJECT;
  }

  // Try to detect from hint path
  if (hint) {
    if (hint.includes('physician-system')) return 'physician-system';
    if (hint.includes('test-data-tracker')) return 'test-data-tracker';
    if (hint.includes('/api/') || hint.includes('\\api\\')) return 'api';
    if (hint.includes('/src/') || hint.includes('\\src\\')) return 'frontend';
  }

  // Try to detect from stack trace
  try {
    const stack = new Error().stack || '';
    if (stack.includes('physician-system')) return 'physician-system';
    if (stack.includes('test-data-tracker')) return 'test-data-tracker';
    if (stack.includes('/api/') || stack.includes('\\api\\')) return 'api';
    if (stack.includes('/src/') || stack.includes('\\src\\')) return 'frontend';
  } catch {
    // Ignore stack trace errors
  }

  return 'unknown';
}

/**
 * Detect current environment
 * @returns {'development' | 'production' | 'test'}
 */
export function getEnvironment() {
  if (typeof process !== 'undefined') {
    // Check for test environment
    if (process.env?.NODE_ENV === 'test') return 'test';

    // Check for Vercel environment (preview and production both run as 'production')
    if (process.env?.VERCEL === '1') {
      return process.env.VERCEL_ENV === 'development' ? 'development' : 'production';
    }

    // Standard NODE_ENV check
    if (process.env?.NODE_ENV === 'production') return 'production';
    if (process.env?.NODE_ENV === 'development') return 'development';
  }

  // Browser environment detection
  if (typeof window !== 'undefined') {
    // Check Vite dev mode via import.meta.env
    try {
      // @ts-ignore - import.meta.env is Vite-specific
      if (import.meta.env?.DEV) {
        return 'development';
      }
    } catch {
      // import.meta.env not available
    }
    // Localhost check
    if (window.location?.hostname === 'localhost') {
      return 'development';
    }
    return 'production';
  }

  return 'development';
}

/**
 * Get default log level based on environment
 * @returns {string} Log level
 */
export function getDefaultLogLevel() {
  // Check for explicit LOG_LEVEL override
  if (typeof process !== 'undefined' && process.env?.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }

  const env = getEnvironment();
  switch (env) {
    case 'test':
      return 'silent';
    case 'production':
      return 'info';
    case 'development':
    default:
      return 'debug';
  }
}

/**
 * Check if pretty printing should be enabled
 * @returns {boolean}
 */
export function shouldPrettyPrint() {
  // Check for explicit LOG_PRETTY override
  if (typeof process !== 'undefined' && process.env?.LOG_PRETTY !== undefined) {
    return process.env.LOG_PRETTY === 'true';
  }

  const env = getEnvironment();
  return env === 'development';
}
