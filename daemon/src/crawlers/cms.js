/**
 * CMS/Medicare Crawler
 * Monitors for Local Coverage Determination (LCD) and National Coverage Determination (NCD) updates
 *
 * Uses the public CMS Coverage Database API:
 * - Base URL: https://api.coverage.cms.gov
 * - Endpoints:
 *   - GET /service/ncd - search NCDs
 *   - GET /service/lcd - search LCDs
 *   - GET /service/whats-new-report - get recent updates
 */

import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES } from '../config.js';

// Keywords to search in CMS database
const SEARCH_KEYWORDS = [
  'molecular',
  'liquid biopsy',
  'ctDNA',
  'MRD',
  'tumor marker',
  'genomic',
];

// Keywords for oncology relevance filtering (case-insensitive)
const ONCOLOGY_KEYWORDS = [
  'moldx',
  'molecular',
  'tumor',
  'cancer',
  'oncology',
  'biopsy',
  'genomic',
];

export class CMSCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.cms.name,
      source: SOURCES.CMS,
      description: config.crawlers.cms.description,
      rateLimit: config.crawlers.cms.rateLimit,
      enabled: config.crawlers.cms.enabled,
    });

    this.baseUrl = 'https://api.coverage.cms.gov';
    // Track seen document IDs in format "lcdid:version" to avoid duplicates
    this.seenDocuments = new Set();
  }

  /**
   * Main crawl implementation
   * Uses two strategies:
   * 1. Check "What's New" report for recent LCD/Article changes
   * 2. Search for keywords related to molecular diagnostics
   */
  async crawl() {
    this.log('info', 'Starting CMS crawler');
    const discoveries = [];

    // Strategy 1: Check What's New report for recent changes
    try {
      const whatsNewDiscoveries = await this.fetchWhatsNew();
      discoveries.push(...whatsNewDiscoveries);
      this.log('info', `What's New report found ${whatsNewDiscoveries.length} relevant items`);
    } catch (error) {
      this.log('error', 'Failed to fetch What\'s New report', { error: error.message });
    }

    // Strategy 2: Search for each keyword
    for (const keyword of SEARCH_KEYWORDS) {
      try {
        // Search LCDs
        const lcdDiscoveries = await this.searchLCDs(keyword);
        discoveries.push(...lcdDiscoveries);

        // Search NCDs
        const ncdDiscoveries = await this.searchNCDs(keyword);
        discoveries.push(...ncdDiscoveries);
      } catch (error) {
        this.log('warn', `Failed to search for keyword: ${keyword}`, { error: error.message });
      }
    }

    this.log('info', 'CMS crawl complete', {
      keywordsSearched: SEARCH_KEYWORDS.length,
      discoveries: discoveries.length,
      seenDocuments: this.seenDocuments.size,
    });

    return discoveries;
  }

  /**
   * Fetch the What's New report for recent LCD/Article changes
   * @returns {Promise<Array>} - Array of discovery objects
   */
  async fetchWhatsNew() {
    const url = `${this.baseUrl}/service/whats-new-report`;
    this.log('debug', 'Fetching What\'s New report');

    const response = await this.http.getJson(url);
    const items = response?.data || response || [];
    const discoveries = [];

    for (const item of items) {
      // Filter for oncology relevance
      if (!this.isOncologyRelevant(item.title || item.name || '')) {
        continue;
      }

      const documentId = this.getDocumentId(item);
      if (this.seenDocuments.has(documentId)) {
        continue;
      }
      this.seenDocuments.add(documentId);

      const discovery = this.createDiscovery(item, 'Article');
      if (discovery) {
        discoveries.push(discovery);
      }
    }

    return discoveries;
  }

  /**
   * Search LCDs for a given keyword
   * @param {string} keyword - Search keyword
   * @returns {Promise<Array>} - Array of discovery objects
   */
  async searchLCDs(keyword) {
    const url = new URL(`${this.baseUrl}/service/lcd`);
    url.searchParams.set('keyword', keyword);

    this.log('debug', `Searching LCDs for: ${keyword}`);

    const response = await this.http.getJson(url.toString());
    const items = response?.data || response || [];

    return this.processSearchResults(items, 'LCD');
  }

  /**
   * Search NCDs for a given keyword
   * @param {string} keyword - Search keyword
   * @returns {Promise<Array>} - Array of discovery objects
   */
  async searchNCDs(keyword) {
    const url = new URL(`${this.baseUrl}/service/ncd`);
    url.searchParams.set('keyword', keyword);

    this.log('debug', `Searching NCDs for: ${keyword}`);

    const response = await this.http.getJson(url.toString());
    const items = response?.data || response || [];

    return this.processSearchResults(items, 'NCD');
  }

  /**
   * Process search results and filter for oncology relevance
   * @param {Array} items - Array of search result items
   * @param {string} documentType - 'LCD' or 'NCD'
   * @returns {Array} - Array of discovery objects
   */
  processSearchResults(items, documentType) {
    const discoveries = [];

    for (const item of items) {
      const title = item.title || item.name || '';

      // Filter for oncology relevance
      if (!this.isOncologyRelevant(title)) {
        continue;
      }

      const documentId = this.getDocumentId(item);
      if (this.seenDocuments.has(documentId)) {
        continue;
      }
      this.seenDocuments.add(documentId);

      const discovery = this.createDiscovery(item, documentType);
      if (discovery) {
        discoveries.push(discovery);
      }
    }

    return discoveries;
  }

  /**
   * Check if a title is relevant to oncology based on keyword matching
   * @param {string} title - The title to check
   * @returns {boolean}
   */
  isOncologyRelevant(title) {
    const lowerTitle = title.toLowerCase();
    return ONCOLOGY_KEYWORDS.some((keyword) => lowerTitle.includes(keyword));
  }

  /**
   * Generate a unique document ID in format "lcdid:version"
   * @param {Object} item - The CMS item
   * @returns {string}
   */
  getDocumentId(item) {
    const id = item.lcdId || item.ncdId || item.id || item.articleId || 'unknown';
    const version = item.version || item.versionNumber || 1;
    return `${id}:${version}`;
  }

  /**
   * Create a discovery object from a CMS item
   * @param {Object} item - The CMS item
   * @param {string} documentType - 'LCD', 'NCD', or 'Article'
   * @returns {Object|null} - Discovery object or null if invalid
   */
  createDiscovery(item, documentType) {
    const title = item.title || item.name || '';
    if (!title) {
      return null;
    }

    const id = item.lcdId || item.ncdId || item.id || item.articleId || '';
    const contractor = item.contractor || item.mac || item.contractorName || '';
    const effectiveDate = item.effectiveDate || item.revisionEffectiveDate || item.publishDate || '';
    const version = item.version || item.versionNumber || 1;

    // Build the URL based on document type
    let url = '';
    if (documentType === 'LCD' && id) {
      url = `https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=${id}`;
    } else if (documentType === 'NCD' && id) {
      url = `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=${id}`;
    } else if (documentType === 'Article' && id) {
      url = `https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid=${id}`;
    }

    // Build summary from available fields
    const summaryParts = [];
    if (documentType) summaryParts.push(`${documentType} update`);
    if (contractor) summaryParts.push(`Contractor: ${contractor}`);
    if (effectiveDate) summaryParts.push(`Effective: ${effectiveDate}`);
    const summary = summaryParts.join(' | ') || `${documentType} coverage update`;

    return {
      source: SOURCES.CMS,
      type: DISCOVERY_TYPES.COVERAGE_CHANGE,
      title,
      summary,
      url,
      relevance: this.calculateRelevance(item),
      metadata: {
        documentId: id,
        documentType,
        contractor,
        effectiveDate,
        version,
      },
    };
  }

  /**
   * Calculate relevance based on content match
   * @param {Object} item - The CMS item
   * @returns {string} - 'high', 'medium', or 'low'
   */
  calculateRelevance(item) {
    const title = item.title || item.name || '';
    const summary = item.summary || item.description || '';
    const text = `${title} ${summary}`.toLowerCase();

    // High relevance: directly mentions MolDX, MRD, or specific test vendors
    if (
      text.includes('moldx') ||
      text.includes('signatera') ||
      text.includes('guardant') ||
      text.includes('minimal residual disease') ||
      text.includes('mrd') ||
      text.includes('foundationone')
    ) {
      return 'high';
    }

    // Medium relevance: mentions ctDNA, liquid biopsy, or genomic testing
    if (
      text.includes('ctdna') ||
      text.includes('liquid biopsy') ||
      text.includes('circulating tumor') ||
      text.includes('genomic') ||
      text.includes('molecular diagnostic')
    ) {
      return 'medium';
    }

    return 'low';
  }
}

// Export helper functions for testing
export { SEARCH_KEYWORDS, ONCOLOGY_KEYWORDS };

export default CMSCrawler;
