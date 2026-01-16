/**
 * Axios-based HTTP client with built-in rate limiting and retry logic
 *
 * Features:
 * - Rate limiting: 1 request per second by default (configurable)
 * - Automatic retries with exponential backoff
 * - User-agent that identifies OpenOnco
 * - Timeout handling
 *
 * NOTE: robots.txt compliance
 * This client is designed for responsible crawling. Before crawling any site:
 * 1. Check robots.txt at the target domain
 * 2. Respect Crawl-delay directives
 * 3. Honor Disallow rules for our user-agent
 * 4. Consider implementing robots.txt parsing if needed:
 *    - Use robots-parser package for parsing
 *    - Cache parsed robots.txt per domain
 *    - Check isAllowed(url) before each request
 */

import axios from 'axios';
import axiosRetry from 'axios-retry';
import { createLogger } from './logger.js';

const logger = createLogger('http');

// Default rate limit: 1 request per second (1000ms between requests)
const DEFAULT_RATE_LIMIT_MS = 1000;

// Store rate limiters per source
const rateLimiters = new Map();

/**
 * Simple token bucket rate limiter
 * Enforces minimum delay between requests
 */
class RateLimiter {
  constructor(minDelayMs) {
    this.minDelayMs = minDelayMs;
    this.lastRequestTime = 0;
    this.queue = [];
    this.processing = false;
  }

  async acquire() {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      const waitTime = Math.max(0, this.minDelayMs - elapsed);

      if (waitTime > 0) {
        await new Promise(r => setTimeout(r, waitTime));
      }

      this.lastRequestTime = Date.now();
      const resolve = this.queue.shift();
      resolve();
    }

    this.processing = false;
  }
}

/**
 * Get or create a rate limiter for a specific source
 * @param {string} source - Source identifier
 * @param {number} rateLimitMs - Minimum milliseconds between requests
 * @returns {RateLimiter}
 */
function getRateLimiter(source, rateLimitMs) {
  if (!rateLimiters.has(source)) {
    const limiter = new RateLimiter(rateLimitMs);
    rateLimiters.set(source, limiter);
    logger.debug(`Created rate limiter for ${source}`, { rateLimitMs });
  }
  return rateLimiters.get(source);
}

/**
 * Create an HTTP client with rate limiting and retry logic
 *
 * @param {string} source - Identifier for this client (e.g., 'pubmed', 'cms')
 * @param {Object} options - Configuration options
 * @param {number} [options.rateLimitMs=1000] - Minimum ms between requests (default: 1 req/sec)
 * @param {number} [options.retries=3] - Number of retry attempts
 * @param {number} [options.timeout=30000] - Request timeout in ms
 * @param {string} [options.userAgent] - Custom user agent string
 * @returns {Object} HTTP client with get, getJson, getText, post methods
 */
export function createHttpClient(source, options = {}) {
  const {
    rateLimitMs = DEFAULT_RATE_LIMIT_MS,
    retries = 3,
    timeout = 30000,
    userAgent = 'OpenOnco-Intelligence-Daemon/1.0 (+https://openonco.com/bot)',
  } = options;

  const rateLimiter = getRateLimiter(source, rateLimitMs);
  const clientLogger = createLogger(`http:${source}`);

  // Create axios instance with defaults
  const axiosInstance = axios.create({
    timeout,
    headers: {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  // Configure retry logic with exponential backoff
  axiosRetry(axiosInstance, {
    retries,
    retryDelay: (retryCount, error) => {
      // Exponential backoff: 1s, 2s, 4s, 8s...
      const delay = Math.pow(2, retryCount - 1) * 1000;
      clientLogger.debug(`Retry ${retryCount} for ${error.config?.url}`, {
        delay,
        error: error.message,
      });
      return delay;
    },
    retryCondition: (error) => {
      // Retry on network errors or 5xx status codes
      // Also retry on 429 (rate limited)
      if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
        return true;
      }
      const status = error.response?.status;
      return status === 429 || (status >= 500 && status < 600);
    },
    onRetry: (retryCount, error, requestConfig) => {
      clientLogger.warn(`Attempt ${retryCount} failed for ${requestConfig.url}`, {
        retriesLeft: retries - retryCount,
        error: error.message,
        status: error.response?.status,
      });
    },
  });

  // Request interceptor for logging
  axiosInstance.interceptors.request.use(
    (config) => {
      clientLogger.debug(`Requesting ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      clientLogger.error('Request configuration error', { error: error.message });
      return Promise.reject(error);
    }
  );

  // Response interceptor for logging
  axiosInstance.interceptors.response.use(
    (response) => {
      clientLogger.debug(`Response ${response.status} from ${response.config.url}`, {
        contentType: response.headers['content-type'],
        size: response.headers['content-length'],
      });
      return response;
    },
    (error) => {
      if (error.response) {
        clientLogger.error(`HTTP ${error.response.status} from ${error.config?.url}`, {
          status: error.response.status,
          statusText: error.response.statusText,
        });
      } else if (error.request) {
        clientLogger.error(`No response received for ${error.config?.url}`, {
          error: error.message,
        });
      }
      return Promise.reject(error);
    }
  );

  /**
   * Make a rate-limited request
   * @param {Function} requestFn - Function that returns an axios promise
   * @returns {Promise} - Axios response
   */
  async function rateLimitedRequest(requestFn) {
    await rateLimiter.acquire();
    return requestFn();
  }

  return {
    /**
     * Make a rate-limited GET request
     * @param {string} url - URL to fetch
     * @param {Object} [config] - Axios request config
     * @returns {Promise} - Axios response
     */
    async get(url, config = {}) {
      return rateLimitedRequest(() => axiosInstance.get(url, config));
    },

    /**
     * GET request returning JSON data
     * @param {string} url - URL to fetch
     * @param {Object} [config] - Axios request config
     * @returns {Promise<any>} - Parsed JSON data
     */
    async getJson(url, config = {}) {
      const response = await this.get(url, {
        ...config,
        headers: {
          ...config.headers,
          Accept: 'application/json',
        },
      });
      return response.data;
    },

    /**
     * GET request returning text content
     * @param {string} url - URL to fetch
     * @param {Object} [config] - Axios request config
     * @returns {Promise<string>} - Response text
     */
    async getText(url, config = {}) {
      const response = await this.get(url, {
        ...config,
        responseType: 'text',
      });
      return response.data;
    },

    /**
     * Make a rate-limited POST request
     * @param {string} url - URL to post to
     * @param {any} data - Request body
     * @param {Object} [config] - Axios request config
     * @returns {Promise} - Axios response
     */
    async post(url, data, config = {}) {
      return rateLimitedRequest(() => axiosInstance.post(url, data, config));
    },

    /**
     * POST request returning JSON data
     * @param {string} url - URL to post to
     * @param {any} data - Request body
     * @param {Object} [config] - Axios request config
     * @returns {Promise<any>} - Parsed JSON data
     */
    async postJson(url, data, config = {}) {
      const response = await this.post(url, data, {
        ...config,
        headers: {
          ...config.headers,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      return response.data;
    },

    /**
     * Get the underlying axios instance for advanced usage
     * @returns {AxiosInstance}
     */
    getAxiosInstance() {
      return axiosInstance;
    },

    /**
     * Get rate limiter stats
     * @returns {Object} - Queue length info
     */
    getStats() {
      return {
        queueLength: rateLimiter.queue.length,
        source,
        rateLimitMs,
      };
    },
  };
}

/**
 * Create a client with PubMed-specific settings
 * PubMed allows 3 requests/second with API key, 1/second without
 */
export function createPubMedClient(apiKey) {
  return createHttpClient('pubmed', {
    rateLimitMs: apiKey ? 334 : 1000, // 3/sec with key, 1/sec without
    userAgent: 'OpenOnco-Intelligence-Daemon/1.0 (+https://openonco.com/bot; contact@openonco.com)',
    timeout: 60000, // PubMed can be slow
  });
}

/**
 * Create a client for government sites (CMS, FDA)
 * More conservative rate limiting for .gov domains
 */
export function createGovClient(source) {
  return createHttpClient(source, {
    rateLimitMs: 2000, // 1 request per 2 seconds for .gov sites
    userAgent: 'OpenOnco-Intelligence-Daemon/1.0 (+https://openonco.com/bot)',
    timeout: 45000,
  });
}

/**
 * Create a client for vendor websites
 * Conservative rate limiting to be respectful
 */
export function createVendorClient(vendorName) {
  return createHttpClient(`vendor:${vendorName}`, {
    rateLimitMs: 3000, // 1 request per 3 seconds for vendor sites
    userAgent: 'OpenOnco-Intelligence-Daemon/1.0 (+https://openonco.com/bot)',
    timeout: 30000,
  });
}

export default { createHttpClient, createPubMedClient, createGovClient, createVendorClient };
