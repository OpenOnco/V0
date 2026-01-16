/**
 * Preprints Crawler
 * Searches medRxiv and bioRxiv for oncology diagnostic test-related preprints
 *
 * API Documentation: https://api.biorxiv.org/
 * - medRxiv: https://api.biorxiv.org/details/medrxiv/{interval}/{cursor}
 * - bioRxiv: https://api.biorxiv.org/details/biorxiv/{interval}/{cursor}
 *
 * Focus areas:
 * - ctDNA and MRD research
 * - Liquid biopsy studies
 * - Cancer biomarker discovery
 * - Clinical validation studies for diagnostic tests
 */

import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES, ALL_TEST_NAMES } from '../config.js';

// Keywords for searching preprints - used for relevance filtering
const HIGH_RELEVANCE_KEYWORDS = [
  // Specific test names
  'signatera',
  'guardant reveal',
  'guardant360',
  'foundationone',
  'foundationone cdx',
  'foundationone liquid',
  'tempus xt',
  'tempus xf',
  'galleri',
  'grail',
  'clonoséq',
  'clonoseq',
  // MRD-specific terms
  'minimal residual disease',
  'molecular residual disease',
  'mrd detection',
  'mrd monitoring',
  'mrd-guided',
  // Clinical utility terms
  'clinical utility',
  'clinical validation',
  'validation study',
  'surveillance ctdna',
  'recurrence detection',
  'recurrence monitoring',
];

const MEDIUM_RELEVANCE_KEYWORDS = [
  // General ctDNA/liquid biopsy terms
  'ctdna',
  'circulating tumor dna',
  'cell-free dna',
  'cfdna',
  'liquid biopsy',
  'cell-free tumor dna',
  // Methylation-based detection
  'methylation cancer',
  'methylation detection',
  'methylation-based',
  'cancer methylation',
  // Cancer-specific terms
  'colorectal cancer',
  'colon cancer',
  'breast cancer',
  'lung cancer',
  'pancreatic cancer',
  'early detection cancer',
  'multi-cancer early detection',
  'mced',
  // Biomarker terms
  'tumor biomarker',
  'cancer biomarker',
  'circulating biomarker',
];

// Search terms to query the API (used in the collection filter)
const SEARCH_COLLECTIONS = [
  'oncology',
  'cancer biology',
  'genetic and genomic medicine',
];

export class PreprintsCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.preprints.name,
      source: SOURCES.PREPRINTS,
      description: config.crawlers.preprints.description,
      rateLimit: config.crawlers.preprints.rateLimit,
      enabled: config.crawlers.preprints.enabled,
    });

    this.medrxivUrl = 'https://api.biorxiv.org/details/medrxiv';
    this.biorxivUrl = 'https://api.biorxiv.org/details/biorxiv';
    this.seenDois = new Set(); // Track DOIs to avoid duplicates
  }

  /**
   * Main crawl implementation
   * Searches both medRxiv and bioRxiv for recent preprints
   */
  async crawl() {
    this.log('info', 'Starting preprints crawl');
    this.seenDois.clear();

    const discoveries = [];

    // Calculate date range (last 7 days)
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateFrom = this.formatDate(weekAgo);
    const dateTo = this.formatDate(today);
    const interval = `${dateFrom}/${dateTo}`;

    // Query both medRxiv and bioRxiv
    const sources = [
      { name: 'medRxiv', url: this.medrxivUrl },
      { name: 'bioRxiv', url: this.biorxivUrl },
    ];

    for (const source of sources) {
      try {
        const preprints = await this.fetchPreprints(source.url, interval, source.name);

        for (const preprint of preprints) {
          // Skip if we've already seen this DOI
          if (this.seenDois.has(preprint.doi)) {
            continue;
          }
          this.seenDois.add(preprint.doi);

          // Filter for relevance
          const relevance = this.calculateRelevance(preprint);
          if (relevance !== 'low') {
            discoveries.push(this.createDiscoveryFromPreprint({ ...preprint, relevance, server: source.name }));
          }
        }
      } catch (error) {
        this.log('warn', `Failed to fetch from ${source.name}`, { error: error.message });
      }
    }

    this.log('info', 'Preprints crawl complete', {
      sourcesQueried: sources.length,
      uniqueDois: this.seenDois.size,
      discoveries: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Format date as YYYY-MM-DD for API query
   * @param {Date} date - Date object
   * @returns {string} - Formatted date string
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  /**
   * Fetch preprints from a preprint server
   * @param {string} baseUrl - Base API URL for the server
   * @param {string} interval - Date interval (YYYY-MM-DD/YYYY-MM-DD)
   * @param {string} serverName - Name of server for logging
   * @returns {Promise<Array>} - Array of preprint objects
   */
  async fetchPreprints(baseUrl, interval, serverName) {
    const allPreprints = [];
    let cursor = 0;
    const limit = 100; // Max per request
    let hasMore = true;

    this.log('debug', `Fetching preprints from ${serverName}`, { interval });

    while (hasMore) {
      const url = `${baseUrl}/${interval}/${cursor}`;

      try {
        const response = await this.http.getJson(url);

        if (!response || !response.collection) {
          this.log('debug', `No more results from ${serverName} at cursor ${cursor}`);
          break;
        }

        const preprints = response.collection || [];

        if (preprints.length === 0) {
          hasMore = false;
          break;
        }

        // Filter for oncology-related preprints before adding
        const relevantPreprints = preprints.filter((p) => this.isOncologyRelated(p));
        allPreprints.push(...relevantPreprints);

        this.log('debug', `Fetched ${preprints.length} preprints from ${serverName}, ${relevantPreprints.length} oncology-related`, {
          cursor,
          total: allPreprints.length,
        });

        // Check if there are more results
        // The API returns up to 100 results per page
        if (preprints.length < limit) {
          hasMore = false;
        } else {
          cursor += limit;
        }

        // Safety limit to prevent infinite loops
        if (cursor >= 1000) {
          this.log('warn', `Reached cursor limit for ${serverName}`, { cursor });
          hasMore = false;
        }
      } catch (error) {
        this.log('warn', `Error fetching from ${serverName} at cursor ${cursor}`, { error: error.message });
        hasMore = false;
      }
    }

    this.log('info', `Fetched ${allPreprints.length} oncology-related preprints from ${serverName}`);
    return allPreprints;
  }

  /**
   * Check if a preprint is potentially oncology-related (initial broad filter)
   * @param {Object} preprint - Preprint object
   * @returns {boolean}
   */
  isOncologyRelated(preprint) {
    const text = `${preprint.title || ''} ${preprint.abstract || ''} ${preprint.category || ''}`.toLowerCase();

    // Check for oncology-related terms
    const oncologyTerms = [
      'cancer',
      'tumor',
      'tumour',
      'oncology',
      'carcinoma',
      'neoplasm',
      'malignant',
      'metastasis',
      'metastatic',
      'ctdna',
      'liquid biopsy',
      'circulating tumor',
      'cell-free dna',
      'mrd',
      'minimal residual',
      'biopsy',
      'diagnostic',
      'biomarker',
      'methylation',
      // Add test names
      ...ALL_TEST_NAMES.map((t) => t.toLowerCase()),
    ];

    return oncologyTerms.some((term) => text.includes(term));
  }

  /**
   * Calculate relevance score based on title and abstract
   * @param {Object} preprint - Preprint object
   * @returns {string} - 'high', 'medium', or 'low'
   */
  calculateRelevance(preprint) {
    const text = `${preprint.title || ''} ${preprint.abstract || ''}`.toLowerCase();

    // Check for high relevance keywords (specific tests and MRD terms)
    for (const keyword of HIGH_RELEVANCE_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        return 'high';
      }
    }

    // Check for monitored test names from config
    for (const testName of ALL_TEST_NAMES) {
      if (text.includes(testName.toLowerCase())) {
        return 'high';
      }
    }

    // Check for medium relevance keywords
    for (const keyword of MEDIUM_RELEVANCE_KEYWORDS) {
      if (text.includes(keyword.toLowerCase())) {
        return 'medium';
      }
    }

    return 'low';
  }

  /**
   * Format author list into readable string
   * @param {string} authors - Authors string from API
   * @returns {string}
   */
  formatAuthors(authors) {
    if (!authors) return 'Unknown';

    // The API returns authors as a semicolon-separated string
    const authorList = authors.split(';').map((a) => a.trim()).filter(Boolean);

    if (authorList.length === 0) return 'Unknown';
    if (authorList.length <= 3) {
      return authorList.join(', ');
    }
    return `${authorList[0]} et al.`;
  }

  /**
   * Create a discovery object from a preprint
   * @param {Object} preprint - Preprint object with relevance and server
   * @returns {Object} - Discovery object
   */
  createDiscoveryFromPreprint(preprint) {
    const authors = this.formatAuthors(preprint.authors);
    const pubDate = preprint.date || preprint.published || '';

    return {
      source: SOURCES.PREPRINTS,
      type: DISCOVERY_TYPES.PREPRINT,
      title: preprint.title || 'Untitled Preprint',
      summary: `${authors} - ${preprint.server} (${pubDate})`,
      url: `https://doi.org/${preprint.doi}`,
      relevance: preprint.relevance,
      metadata: {
        doi: preprint.doi,
        authors: preprint.authors,
        authorFormatted: authors,
        server: preprint.server,
        category: preprint.category || '',
        publishedDate: pubDate,
        abstract: preprint.abstract || '',
        version: preprint.version || '1',
        license: preprint.license || '',
      },
    };
  }
}

export default PreprintsCrawler;
