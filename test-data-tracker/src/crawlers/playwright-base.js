/**
 * PlaywrightCrawler Base Class
 *
 * Extends BaseCrawler with shared Playwright browser automation functionality:
 * - Browser lifecycle management with graceful cleanup
 * - Page fetching with retry logic and exponential backoff
 * - HTTP/1.1 fallback for problematic sites (e.g., Anthem)
 * - Hash-based change detection via SQLite storage
 * - URL health tracking (skip repeatedly failing URLs)
 * - Claude API wrapper for content analysis
 *
 * Used by VendorCrawler and policy discovery scripts.
 */

import { createHash } from 'crypto';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { BaseCrawler } from './base.js';
import { config } from '../config.js';
import { computeDiff, truncateDiff } from '../utils/diff.js';
import { canonicalizeContent } from '../utils/canonicalize.js';
import {
  initHashStore,
  getHash,
  setHash,
  getAllHashes,
  saveAllHashes,
  recordSuccess,
  recordFailure,
  shouldSkipUrl as checkShouldSkipUrl,
  closeHashStore,
} from '../utils/hash-store.js';

// Realistic user agent to avoid bot detection
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Default timeouts and delays
const DEFAULT_PAGE_TIMEOUT_MS = 60000;
const DEFAULT_RATE_LIMIT_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_BASE_MS = 2000;

// Maximum content size to store for diffing (50KB)
const MAX_STORED_CONTENT_SIZE = 50000;

// Claude model for content analysis
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

export class PlaywrightCrawler extends BaseCrawler {
  constructor(options = {}) {
    super(options);

    // Playwright browser instance
    this.browser = null;

    // In-memory hash cache (loaded from SQLite)
    this.hashes = {};

    // Claude API client
    this.anthropic = config.anthropic?.apiKey
      ? new Anthropic({ apiKey: config.anthropic.apiKey })
      : null;

    // Configurable timeouts
    this.pageTimeout = options.pageTimeout || DEFAULT_PAGE_TIMEOUT_MS;
    this.rateLimitMs = options.rateLimitMs || DEFAULT_RATE_LIMIT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelayBase = options.retryDelayBase || DEFAULT_RETRY_DELAY_BASE_MS;
  }

  // ===========================================================================
  // Browser Lifecycle
  // ===========================================================================

  /**
   * Launch Playwright browser instance (lazy initialization)
   * @returns {Promise<Browser>} Browser instance
   */
  async launchBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
      });
      this.log('debug', 'Browser launched');
    }
    return this.browser;
  }

  /**
   * Close browser instance and cleanup
   */
  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        this.log('warn', 'Error closing browser', { error: error.message });
      }
      this.browser = null;
      this.log('debug', 'Browser closed');
    }
  }

  // ===========================================================================
  // Hash Storage (SQLite-backed)
  // ===========================================================================

  /**
   * Load stored content hashes from SQLite database
   */
  async loadHashes() {
    try {
      await initHashStore();
      this.hashes = getAllHashes();
      this.log('debug', `Loaded ${Object.keys(this.hashes).length} stored hashes from SQLite`);
    } catch (error) {
      this.log('warn', 'Failed to load hash store', { error: error.message });
      this.hashes = {};
    }
  }

  /**
   * Save content hashes to SQLite database
   */
  async saveHashes() {
    try {
      saveAllHashes(this.hashes);
      this.log('debug', `Saved ${Object.keys(this.hashes).length} hashes to SQLite`);
    } catch (error) {
      this.log('error', 'Failed to save hash store', { error: error.message });
    }
  }

  /**
   * Compute SHA256 hash of content
   * @param {string} content - Content to hash
   * @returns {string} Hex-encoded hash
   */
  computeHash(content) {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Detect if content has changed, compute diff
   * @param {string} url - Page URL
   * @param {string} content - New page content
   * @param {string} hashKey - Key for hash storage
   * @returns {Object} { hasChanged, isFirstCrawl, diff, oldHash, newHash }
   */
  detectChange(url, content, hashKey) {
    // Canonicalize content for hash comparison
    const canonicalizedContent = canonicalizeContent(content);
    const newHash = this.computeHash(canonicalizedContent);

    const oldHashData = this.hashes[hashKey];
    const oldHashValue = oldHashData?.hash || null;
    const isFirstCrawl = !oldHashValue;
    const hasChanged = newHash !== oldHashValue;

    let diff = null;
    if (hasChanged && !isFirstCrawl) {
      const previousContent = oldHashData?.content || null;
      diff = computeDiff(previousContent, content);
    }

    return {
      hasChanged,
      isFirstCrawl,
      diff,
      oldHash: oldHashValue,
      newHash,
      previousContent: oldHashData?.content || null,
    };
  }

  /**
   * Store updated hash and content snapshot
   * @param {string} hashKey - Hash storage key
   * @param {string} hash - New hash value
   * @param {string} content - Content to store (truncated)
   */
  storeHash(hashKey, hash, content) {
    this.hashes[hashKey] = {
      hash,
      content: content.slice(0, MAX_STORED_CONTENT_SIZE),
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Close hash store connection
   */
  closeHashStore() {
    closeHashStore();
  }

  // ===========================================================================
  // URL Health Tracking
  // ===========================================================================

  /**
   * Record successful page fetch for health tracking
   * @param {string} url - Page URL
   * @param {string} sourceId - Source identifier (payer ID, vendor ID)
   */
  recordPageSuccess(url, sourceId) {
    try {
      recordSuccess(url, sourceId);
    } catch (error) {
      this.log('debug', `Failed to record success: ${error.message}`);
    }
  }

  /**
   * Record failed page fetch for health tracking
   * @param {string} url - Page URL
   * @param {string} sourceId - Source identifier
   * @param {Error} error - Error that occurred
   */
  recordPageFailure(url, sourceId, error) {
    try {
      recordFailure(url, sourceId, error?.message || 'Unknown error');
    } catch (err) {
      this.log('debug', `Failed to record failure: ${err.message}`);
    }
  }

  /**
   * Check if URL should be skipped due to repeated failures
   * @param {string} url - Page URL
   * @param {number} threshold - Failure count threshold (default: 5)
   * @returns {boolean} True if URL should be skipped
   */
  shouldSkipUrl(url, threshold = 5) {
    try {
      return checkShouldSkipUrl(url, threshold);
    } catch (error) {
      return false; // Don't skip if health check fails
    }
  }

  // ===========================================================================
  // Page Fetching
  // ===========================================================================

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if URL is an Anthem domain (requires HTTP/1.1 fallback)
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isAnthemDomain(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.includes('anthem.com') || hostname.includes('anthem.');
    } catch {
      return false;
    }
  }

  /**
   * Fallback fetch using Node.js https module with HTTP/1.1
   * Used for domains that have HTTP/2 protocol issues
   * @param {string} url - URL to fetch
   * @returns {Promise<string>} HTML content
   */
  async fetchWithHttp1(url) {
    const https = await import('https');
    const http = await import('http');

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https.default : http.default;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        // Force HTTP/1.1 by disabling ALPN negotiation for HTTP/2
        ALPNProtocols: ['http/1.1'],
      };

      const req = client.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href;
          this.fetchWithHttp1(redirectUrl).then(resolve).catch(reject);
          return;
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.setTimeout(this.pageTimeout, () => {
        req.destroy();
        reject(new Error(`Request timeout for ${url}`));
      });
      req.end();
    });
  }

  /**
   * Parse HTML content and extract data (for HTTP/1.1 fallback)
   * @param {string} html - Raw HTML
   * @param {string} url - Source URL
   * @returns {Object} { content, extractedData, url }
   */
  parseHtmlContent(html, url) {
    // Remove script and style tags
    let content = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

    // Extract text from HTML
    content = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract headings
    const headings = [];
    const headingMatches = html.matchAll(/<h[1-4][^>]*>([^<]*)<\/h[1-4]>/gi);
    for (const match of headingMatches) {
      const text = match[1].trim();
      if (text && text.length > 5 && text.length < 200) {
        headings.push(text);
      }
    }

    // Extract links that look like policies
    const links = [];
    const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi);
    for (const match of linkMatches) {
      const href = match[1];
      const text = match[2].trim();
      if (
        (href.includes('policy') ||
          href.includes('bulletin') ||
          href.includes('coverage') ||
          href.includes('cpb') ||
          href.includes('.pdf')) &&
        text &&
        text.length > 5
      ) {
        links.push({
          text,
          href: href.startsWith('http') ? href : new URL(href, url).href,
        });
      }
    }

    // Look for effective dates
    const effectiveDates = [];
    const effectiveDatePatterns = [
      /effective\s*(?:date)?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /effective\s*(?:date)?[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
    ];
    effectiveDatePatterns.forEach((pattern) => {
      const matches = content.match(pattern) || [];
      effectiveDates.push(...matches.slice(0, 5));
    });

    // Look for policy numbers
    const policyNumbers = [];
    const policyPatterns = [
      /policy\s*(?:number|#|no\.?)?\s*[:\s]*([A-Z0-9\-]+)/gi,
      /CPB\s*#?\s*(\d+)/gi,
    ];
    policyPatterns.forEach((pattern) => {
      const matches = content.match(pattern) || [];
      policyNumbers.push(...matches.slice(0, 5));
    });

    return {
      content,
      extractedData: {
        title,
        headings,
        policies: headings,
        links,
        effectiveDates,
        lastUpdated: null,
        policyNumbers,
      },
      url,
    };
  }

  /**
   * Fetch page content using Playwright with retry logic
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} options.retries - Max retry attempts
   * @param {boolean} options.extractHeadlines - Extract news headlines (for vendor pages)
   * @returns {Promise<Object>} { content, extractedData, headlines?, url }
   */
  async fetchPage(url, options = {}) {
    const { retries = this.maxRetries, extractHeadlines = false } = options;
    let lastError = null;
    const isAnthem = this.isAnthemDomain(url);

    // For Anthem domains, try HTTP/1.1 fallback first
    if (isAnthem) {
      this.log('debug', `Using HTTP/1.1 fallback for Anthem domain: ${url}`);
      try {
        const html = await this.fetchWithHttp1(url);
        const result = this.parseHtmlContent(html, url);
        this.log('debug', `HTTP/1.1 fallback successful for ${url}`);
        return result;
      } catch (http1Error) {
        this.log('warn', `HTTP/1.1 fallback failed for ${url}, trying Playwright`, {
          error: http1Error.message,
        });
        // Fall through to Playwright attempt
      }
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      const browser = await this.launchBrowser();

      // Configure context options
      const contextOptions = {
        userAgent: USER_AGENT,
        viewport: { width: 1920, height: 1080 },
      };

      // For Anthem, add extra options to help with potential issues
      if (isAnthem) {
        contextOptions.ignoreHTTPSErrors = true;
      }

      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();

      try {
        if (attempt > 0) {
          // Exponential backoff for retries
          const backoffDelay = this.retryDelayBase * Math.pow(2, attempt - 1);
          this.log('debug', `Retry attempt ${attempt} for ${url} (waiting ${backoffDelay}ms)`);
          await this.sleep(backoffDelay);
        }

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: this.pageTimeout,
        });

        // Wait for dynamic content
        await this.sleep(2000);

        // Extract text content
        const content = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script, style, noscript');
          scripts.forEach((el) => el.remove());
          return document.body?.innerText || '';
        });

        // Extract structured data
        const extractedData = await page.evaluate(() => {
          const data = {
            title: document.title,
            headings: [],
            policies: [],
            links: [],
            effectiveDates: [],
            lastUpdated: null,
            policyNumbers: [],
          };

          // Extract headings
          document.querySelectorAll('h1, h2, h3, h4').forEach((h) => {
            const text = h.innerText?.trim();
            if (text && text.length > 5 && text.length < 200) {
              data.headings.push(text);
              data.policies.push(text);
            }
          });

          // Extract links that look like policy documents
          document.querySelectorAll('a[href]').forEach((a) => {
            const href = a.getAttribute('href') || '';
            const text = a.innerText?.trim();
            if (
              (href.includes('policy') ||
                href.includes('bulletin') ||
                href.includes('coverage') ||
                href.includes('cpb') ||
                href.includes('.pdf')) &&
              text &&
              text.length > 5
            ) {
              data.links.push({
                text,
                href: href.startsWith('http') ? href : new URL(href, window.location.origin).href,
              });
            }
          });

          const bodyText = document.body?.innerText || '';

          // Look for effective date patterns
          const effectiveDatePatterns = [
            /effective\s*(?:date)?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
            /effective\s*(?:date)?[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
          ];
          effectiveDatePatterns.forEach((pattern) => {
            const matches = bodyText.match(pattern) || [];
            data.effectiveDates.push(...matches.slice(0, 5));
          });

          // Look for last updated dates
          const updatedPatterns = [
            /(?:last\s+)?(?:updated|revised|modified)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
            /(?:last\s+)?(?:updated|revised|modified)[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
          ];
          updatedPatterns.forEach((pattern) => {
            const match = bodyText.match(pattern);
            if (match && !data.lastUpdated) {
              data.lastUpdated = match[0];
            }
          });

          // Look for policy numbers/IDs
          const policyPatterns = [
            /policy\s*(?:number|#|no\.?)?\s*[:\s]*([A-Z0-9\-]+)/gi,
            /CPB\s*#?\s*(\d+)/gi,
            /(?:med|medical)\s*policy\s*(?:#|number)?\s*([A-Z0-9\-\.]+)/gi,
          ];
          policyPatterns.forEach((pattern) => {
            const matches = bodyText.match(pattern) || [];
            data.policyNumbers.push(...matches.slice(0, 5));
          });

          return data;
        });

        // Optionally extract headlines for news pages
        let headlines = [];
        if (extractHeadlines) {
          headlines = await page.evaluate(() => {
            const items = [];
            const selectors = [
              'article h2',
              'article h3',
              '.news-item h2',
              '.news-item h3',
              '.press-release-title',
              '.press-release h2',
              '.newsroom-item h2',
              '.newsroom-item h3',
              'h2 a',
              'h3 a',
              '[class*="news"] h2',
              '[class*="news"] h3',
              '[class*="press"] h2',
              '[class*="press"] h3',
            ];

            for (const selector of selectors) {
              document.querySelectorAll(selector).forEach((el) => {
                const text = el.innerText?.trim();
                if (text && text.length > 10 && text.length < 300) {
                  items.push(text);
                }
              });
            }
            return [...new Set(items)].slice(0, 20);
          });
        }

        await context.close();
        return { content, extractedData, headlines, url };
      } catch (error) {
        lastError = error;
        this.log('debug', `Attempt ${attempt + 1} failed for ${url}`, { error: error.message });
        await context.close();
      }
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
  }

  // ===========================================================================
  // Claude Analysis
  // ===========================================================================

  /**
   * Analyze content using Claude API
   * @param {string} prompt - The analysis prompt
   * @param {Object} options - Analysis options
   * @param {number} options.maxTokens - Max response tokens (default: 2048)
   * @returns {Promise<Object|null>} Parsed JSON response or null on failure
   */
  async analyzeWithClaude(prompt, options = {}) {
    const { maxTokens = 2048 } = options;

    if (!this.anthropic) {
      this.log('debug', 'Claude analysis unavailable - no API key configured');
      return null;
    }

    try {
      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseText = response.content[0]?.text?.trim();
      if (!responseText) {
        return null;
      }

      // Parse JSON response - handle potential markdown code fences
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      // Find JSON object in response
      const objectMatch = jsonText.match(/\{[\s\S]*\}/);
      if (!objectMatch) {
        this.log('warn', 'Claude response did not contain valid JSON');
        return null;
      }

      return JSON.parse(objectMatch[0]);
    } catch (error) {
      this.log('warn', 'Claude analysis failed', { error: error.message });
      return null;
    }
  }

  /**
   * Format diff for Claude analysis
   * @param {Object} diff - Diff object from computeDiff
   * @param {number} maxLength - Maximum length (default: 8000)
   * @returns {string} Formatted diff text
   */
  formatDiffForAnalysis(diff, maxLength = 8000) {
    return truncateDiff(diff, maxLength);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Extract a relevant snippet from content around keywords
   * @param {string} content - Full content text
   * @param {string[]} keywords - Keywords to search for context
   * @param {number} maxLength - Maximum snippet length (default: 500)
   * @returns {string|null} Extracted snippet
   */
  extractSnippet(content, keywords, maxLength = 500) {
    if (!content) return null;

    const lowerContent = content.toLowerCase();

    for (const keyword of keywords) {
      const index = lowerContent.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + maxLength);
        let snippet = content.slice(start, end).trim();

        // Clean up the snippet
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        return snippet.replace(/\s+/g, ' ');
      }
    }

    // Fallback: return first part of content
    if (content.length > maxLength) {
      return content.slice(0, maxLength).trim().replace(/\s+/g, ' ') + '...';
    }
    return content.trim().replace(/\s+/g, ' ');
  }
}

export default PlaywrightCrawler;
