/**
 * Browser remote transport for sending logs to a server endpoint
 *
 * Features:
 * - Batches logs (10 entries or 5 seconds, whichever comes first)
 * - Uses fetch() for normal sending
 * - Uses navigator.sendBeacon() on page unload for reliability
 * - Graceful degradation on network failure
 */

// Configuration
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_FLUSH_INTERVAL = 5000; // 5 seconds
const DEFAULT_ENDPOINT = '/api/log-ingest';

// Internal state
let batch = [];
let flushTimer = null;
let endpoint = DEFAULT_ENDPOINT;
let batchSize = DEFAULT_BATCH_SIZE;
let flushInterval = DEFAULT_FLUSH_INTERVAL;
let isInitialized = false;

/**
 * Initialize the browser remote transport
 *
 * @param {object} [options={}] - Configuration options
 * @param {string} [options.remoteEndpoint] - Server endpoint for log ingestion
 * @param {number} [options.batchSize=10] - Number of logs before automatic flush
 * @param {number} [options.flushInterval=5000] - Milliseconds before automatic flush
 */
export function initBrowserRemote(options = {}) {
  if (isInitialized) {
    return;
  }

  endpoint = options.remoteEndpoint || DEFAULT_ENDPOINT;
  batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  flushInterval = options.flushInterval || DEFAULT_FLUSH_INTERVAL;

  // Set up page unload handler
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // Also handle beforeunload as a fallback
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);
  }

  isInitialized = true;
}

/**
 * Handle visibility change - flush when page goes hidden
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    flushWithBeacon();
  }
}

/**
 * Handle beforeunload - flush remaining logs
 */
function handleBeforeUnload() {
  flushWithBeacon();
}

/**
 * Add a log entry to the batch
 *
 * @param {object} logEntry - Structured log entry to send
 */
export function addToBatch(logEntry) {
  if (!isInitialized) {
    initBrowserRemote();
  }

  batch.push(logEntry);

  // Flush if batch is full
  if (batch.length >= batchSize) {
    flush();
  } else if (!flushTimer) {
    // Start flush timer if not already running
    flushTimer = setTimeout(flush, flushInterval);
  }
}

/**
 * Flush the batch using fetch()
 * Called automatically when batch is full or timer expires
 */
export async function flush() {
  if (batch.length === 0) {
    return;
  }

  // Clear the timer
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  // Take current batch and reset
  const logs = batch.splice(0);

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(logs),
      // Don't wait for response in non-critical path
      keepalive: true
    });
  } catch (error) {
    // Graceful degradation - logs lost but no error shown to user
    // Could optionally add back to batch for retry, but risk memory growth
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[logger] Failed to send remote logs:', error.message);
    }
  }
}

/**
 * Flush using navigator.sendBeacon() for page unload scenarios
 * More reliable than fetch() during page close
 */
function flushWithBeacon() {
  if (batch.length === 0) {
    return;
  }

  // Clear the timer
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  // Take current batch
  const logs = batch.splice(0);

  // Use sendBeacon for reliability during unload
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const blob = new Blob([JSON.stringify(logs)], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } catch (error) {
      // Silently fail - page is closing anyway
    }
  }
}

/**
 * Create a Pino browser transmit function
 * Used with Pino's browser.transmit option
 *
 * @param {object} [options={}] - Transport options
 * @param {string} [options.remoteEndpoint] - Server endpoint
 * @returns {object} Pino transmit configuration
 */
export function createBrowserTransmit(options = {}) {
  initBrowserRemote(options);

  return {
    level: 'warn',
    send: (level, logEvent) => {
      // Convert Pino browser log event to structured entry
      const entry = {
        timestamp: new Date().toISOString(),
        level: logEvent.level.label,
        ...logEvent.bindings.reduce((acc, b) => ({ ...acc, ...b }), {}),
        messages: logEvent.messages
      };

      addToBatch(entry);
    }
  };
}

/**
 * Get the current batch size (for testing)
 *
 * @returns {number} Number of logs in current batch
 */
export function getBatchLength() {
  return batch.length;
}

/**
 * Clear the batch without sending (for testing)
 */
export function clearBatch() {
  batch = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/**
 * Check if remote transport is available
 * Only available in browser with fetch support
 *
 * @returns {boolean}
 */
export function isRemoteAvailable() {
  return typeof window !== 'undefined' && typeof fetch !== 'undefined';
}
