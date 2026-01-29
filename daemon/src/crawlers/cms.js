/**
 * CMS/Medicare Crawler
 * Monitors for Local Coverage Determination (LCD) and National Coverage Determination (NCD) updates
 *
 * Uses the CMS Coverage Database API v1:
 * - Base URL: https://api.coverage.cms.gov
 * - Requires license token from /v1/metadata/license-agreement (valid 1 hour)
 * - Endpoints:
 *   - GET /v1/reports/national-coverage-ncd - search NCDs
 *   - GET /v1/reports/local-coverage-final-lcds - search LCDs
 *   - GET /v1/reports/local-coverage-whats-new - get recent updates
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES, ALL_TEST_NAMES } from '../config.js';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

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
    // License token for API v1 (valid 1 hour)
    this.licenseToken = null;
    // Anthropic client for AI analysis
    this.anthropic = config.anthropic?.apiKey ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;
  }

  /**
   * Fetch license token required for API v1
   * Token is valid for 1 hour
   * @returns {Promise<string>} - Bearer token
   */
  async fetchLicenseToken() {
    if (this.licenseToken) {
      return this.licenseToken;
    }

    const url = `${this.baseUrl}/v1/metadata/license-agreement`;
    this.log('debug', 'Fetching CMS API license token');

    const response = await this.http.getJson(url);
    const token = response?.data?.[0]?.Token;

    if (!token) {
      throw new Error('Failed to obtain CMS API license token');
    }

    this.licenseToken = token;
    this.log('debug', 'Obtained CMS API license token');
    return token;
  }

  /**
   * Make authenticated API request
   * @param {string} url - API endpoint URL
   * @returns {Promise<Object>} - JSON response
   */
  async authenticatedRequest(url) {
    const token = await this.fetchLicenseToken();
    return this.http.getJson(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
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
    const url = `${this.baseUrl}/v1/reports/whats-new/local`;
    this.log('debug', 'Fetching What\'s New report');

    const response = await this.authenticatedRequest(url);
    const items = response?.data || [];
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

      const discovery = await this.createDiscovery(item, 'Article');
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
    const url = new URL(`${this.baseUrl}/v1/reports/local-coverage-final-lcds`);
    url.searchParams.set('keyword', keyword);

    this.log('debug', `Searching LCDs for: ${keyword}`);

    const response = await this.authenticatedRequest(url.toString());
    const items = response?.data || [];

    return await this.processSearchResults(items, 'LCD');
  }

  /**
   * Search NCDs for a given keyword
   * @param {string} keyword - Search keyword
   * @returns {Promise<Array>} - Array of discovery objects
   */
  async searchNCDs(keyword) {
    const url = new URL(`${this.baseUrl}/v1/reports/national-coverage-ncd`);
    url.searchParams.set('keyword', keyword);

    this.log('debug', `Searching NCDs for: ${keyword}`);

    const response = await this.authenticatedRequest(url.toString());
    const items = response?.data || [];

    return await this.processSearchResults(items, 'NCD');
  }

  /**
   * Process search results and filter for oncology relevance
   * @param {Array} items - Array of search result items
   * @param {string} documentType - 'LCD' or 'NCD'
   * @returns {Promise<Array>} - Array of discovery objects
   */
  async processSearchResults(items, documentType) {
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

      const discovery = await this.createDiscovery(item, documentType);
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
   * @returns {Promise<Object|null>} - Discovery object or null if invalid
   */
  async createDiscovery(item, documentType) {
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

    // Run AI analysis if Anthropic client is available
    const aiAnalysis = await this.analyzeDiscovery(item, documentType);

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
        ...(aiAnalysis && { aiAnalysis }),
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

  /**
   * Use Claude AI to analyze a CMS coverage determination item
   * @param {Object} item - The CMS item data
   * @param {string} documentType - 'LCD', 'NCD', or 'Article'
   * @returns {Promise<Object|null>} - Analysis results or null if unavailable
   */
  async analyzeDiscovery(item, documentType) {
    if (!this.anthropic) {
      this.log('debug', 'Skipping AI analysis - Anthropic client not configured');
      return null;
    }

    const title = item.title || item.name || '';
    const summary = item.summary || item.description || '';
    const contractor = item.contractor || item.mac || item.contractorName || '';
    const effectiveDate = item.effectiveDate || item.revisionEffectiveDate || item.publishDate || '';

    const prompt = `Analyze this CMS Medicare coverage determination and extract structured information about its relevance to molecular diagnostics testing.

Document Type: ${documentType}
Title: ${title}
Summary: ${summary}
Contractor/MAC: ${contractor}
Effective Date: ${effectiveDate}
Raw Data: ${JSON.stringify(item, null, 2)}

Known molecular diagnostic tests to look for: ${ALL_TEST_NAMES.join(', ')}

Please analyze this coverage determination and respond with ONLY a JSON object (no markdown, no explanation) containing:
{
  "coverageDecision": "covered" | "not_covered" | "conditional" | "unknown",
  "affectedTests": ["array of specific test names mentioned or likely affected"],
  "isMolDXRelevant": true | false,
  "keyChanges": "Brief summary of important policy changes or coverage criteria",
  "analysisNotes": "Your analysis notes about this coverage determination's significance for molecular diagnostics"
}

Focus on:
- Whether this affects ctDNA, liquid biopsy, MRD, or tumor profiling tests
- Specific coverage criteria or limitations mentioned
- Any changes from previous policy versions
- Impact on MolDX program tests`;

    try {
      this.log('debug', `Analyzing ${documentType} with Claude: ${title}`);

      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0]?.text;
      if (!content) {
        this.log('warn', 'Empty response from Claude AI analysis');
        return null;
      }

      // Parse the JSON response
      const analysis = JSON.parse(content);
      this.log('debug', `AI analysis complete for: ${title}`, { analysis });

      return {
        coverageDecision: analysis.coverageDecision || 'unknown',
        affectedTests: analysis.affectedTests || [],
        isMolDXRelevant: analysis.isMolDXRelevant || false,
        keyChanges: analysis.keyChanges || '',
        analysisNotes: analysis.analysisNotes || '',
      };
    } catch (error) {
      this.log('warn', `AI analysis failed for ${documentType}: ${title}`, { error: error.message });
      return null;
    }
  }
}

// Export helper functions for testing
export { SEARCH_KEYWORDS, ONCOLOGY_KEYWORDS };

export default CMSCrawler;
