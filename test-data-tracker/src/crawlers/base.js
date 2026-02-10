/**
 * Base crawler class
 * All crawlers extend this class for consistent interface and behavior
 */

import { createHttpClient } from '../utils/http.js';
import { createLogger } from '../utils/logger.js';
import { addDiscoveries } from '../queue/index.js';
import { updateCrawlerHealth, recordCrawlerError } from '../health.js';
import { writeStagingFile } from '../submissions/writer.js';

export class BaseCrawler {
  constructor(options = {}) {
    const {
      name,
      source,
      description = '',
      rateLimit = 10,
      enabled = true,
    } = options;

    if (!name || !source) {
      throw new Error('Crawler requires name and source');
    }

    this.name = name;
    this.source = source;
    this.description = description;
    this.enabled = enabled;
    this.logger = createLogger(`crawler:${source}`);
    this.http = createHttpClient(source, { requestsPerMinute: rateLimit });

    // Track run state
    this.isRunning = false;
    this.lastRun = null;
    this.lastSuccess = null;
    this.lastError = null;
  }

  /**
   * Main crawl method - to be implemented by subclasses
   * Should return an array of discovery objects
   */
  async crawl() {
    throw new Error('crawl() must be implemented by subclass');
  }

  /**
   * Run the crawler with error handling and tracking
   */
  async run() {
    if (!this.enabled) {
      this.logger.info(`Crawler ${this.name} is disabled, skipping`);
      return { success: true, skipped: true, discoveries: [] };
    }

    if (this.isRunning) {
      this.logger.warn(`Crawler ${this.name} is already running, skipping`);
      return { success: false, reason: 'already_running', discoveries: [] };
    }

    this.isRunning = true;
    this.lastRun = new Date().toISOString();
    const startTime = Date.now();

    this.logger.info(`Starting crawler: ${this.name}`);

    try {
      // Run the actual crawl implementation
      const crawlResult = await this.crawl();

      // Handle both array (old format) and object (new format with proposals)
      const isEnhancedResult = crawlResult && !Array.isArray(crawlResult) && crawlResult.discoveries;
      const discoveries = isEnhancedResult ? crawlResult.discoveries : (crawlResult || []);
      const proposals = isEnhancedResult ? crawlResult.proposals : [];
      const skippedDiscoveries = isEnhancedResult ? crawlResult.skippedDiscoveries : [];

      // Write staging file for weekly submissions aggregation
      // Include BOTH regular discoveries AND skipped ones (previously lost)
      const allItems = [
        ...discoveries.map(d => ({
          ...d,
          detectedAt: d.detectedAt || new Date().toISOString(),
          triageHint: d.triageHint || {
            daemonScore: d.relevanceScore ?? (d.relevance === 'high' ? 8 : d.relevance === 'medium' ? 5 : 3),
            reason: '',
            suggestedAction: d.type || 'review',
            suggestedTestName: d.metadata?.testName || d.metadata?.affectedTests?.[0] || null,
            confidence: d.relevance === 'high' ? 0.85 : d.relevance === 'medium' ? 0.6 : 0.35,
          },
        })),
        ...skippedDiscoveries.map(d => ({
          ...d,
          detectedAt: d.detectedAt || new Date().toISOString(),
          triageHint: d.triageHint || {
            daemonScore: d.relevanceScore ?? 3,
            reason: d.skipReason || 'Skipped by daemon',
            suggestedAction: 'informational',
            suggestedTestName: d.metadata?.testName || d.metadata?.affectedTests?.[0] || null,
            confidence: 0.35,
          },
        })),
      ];
      if (allItems.length > 0) {
        try {
          writeStagingFile(this.source, allItems);
        } catch (err) {
          this.logger.warn('Failed to write staging file', { error: err.message });
        }
      }

      // Add discoveries to queue
      if (discoveries && discoveries.length > 0) {
        const results = await addDiscoveries(discoveries);
        const addedCount = results.filter((r) => r.added).length;
        const duplicateCount = results.filter((r) => !r.added).length;

        this.logger.info(`Crawler ${this.name} completed`, {
          totalFound: discoveries.length,
          added: addedCount,
          duplicates: duplicateCount,
          proposals: proposals.length,
          skipped: skippedDiscoveries.length,
          duration: Date.now() - startTime,
        });

        this.lastSuccess = new Date().toISOString();
        this.lastError = null;

        // Update health tracking
        await updateCrawlerHealth(this.source, {
          lastRun: this.lastRun,
          lastSuccess: this.lastSuccess,
          discoveriesFound: discoveries.length,
          discoveriesAdded: addedCount,
          duration: Date.now() - startTime,
          status: 'success',
        });

        return {
          success: true,
          discoveries,
          proposals,
          skippedDiscoveries,
          added: addedCount,
          duplicates: duplicateCount,
          duration: Date.now() - startTime,
        };
      }

      this.logger.info(`Crawler ${this.name} completed with no discoveries`, {
        duration: Date.now() - startTime,
      });

      this.lastSuccess = new Date().toISOString();

      await updateCrawlerHealth(this.source, {
        lastRun: this.lastRun,
        lastSuccess: this.lastSuccess,
        discoveriesFound: 0,
        discoveriesAdded: 0,
        duration: Date.now() - startTime,
        status: 'success',
      });

      return {
        success: true,
        discoveries: [],
        proposals: [],
        skippedDiscoveries: [],
        added: 0,
        duplicates: 0,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
      };

      this.logger.error(`Crawler ${this.name} failed`, {
        error,
        duration: Date.now() - startTime,
      });

      // Record error in health tracking
      await recordCrawlerError(this.source, error);

      return {
        success: false,
        error: error.message,
        discoveries: [],
        proposals: [],
        skippedDiscoveries: [],
        duration: Date.now() - startTime,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Log a message with crawler name prefix
   * @param {string} level - Log level: 'debug', 'info', 'warn', 'error'
   * @param {string} message - Message to log
   * @param {Object} [meta] - Optional metadata
   */
  log(level, message, meta = {}) {
    const prefixedMessage = `[${this.name}] ${message}`;
    if (this.logger[level]) {
      this.logger[level](prefixedMessage, meta);
    } else {
      this.logger.info(prefixedMessage, meta);
    }
  }

  /**
   * Get crawler status
   */
  getStatus() {
    return {
      name: this.name,
      source: this.source,
      description: this.description,
      enabled: this.enabled,
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      lastSuccess: this.lastSuccess,
      lastError: this.lastError,
      httpStats: this.http.getStats(),
    };
  }
}

export default BaseCrawler;
