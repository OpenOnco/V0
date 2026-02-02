/**
 * Discovery Crawler
 *
 * Automatically discovers new policy documents on payer websites.
 * Crawls index pages and uses site search to find relevant policies.
 *
 * Outputs DOCUMENT_CANDIDATE proposals for human review.
 */

import { logger } from '../utils/logger.js';
import { POLICY_REGISTRY } from '../data/policy-registry.js';
import {
  buildSearchQueries,
  calculateDocumentRelevance,
  filterByRelevance,
  getMatchedKeywords,
  guessDocType,
  PRIMARY_KEYWORDS,
} from '../data/discovery-keywords.js';
import {
  stageDiscoveredPolicy,
  isUrlAlreadyDiscovered,
  getPendingDiscoveries,
} from '../utils/hash-store.js';
import { createProposal, PROPOSAL_TYPES } from '../proposals/schema.js';
import { quickRelevanceCheck } from '../extractors/index.js';

/**
 * Payers with known index pages for discovery
 */
export const DISCOVERY_SOURCES = {
  // Tier 1 - National payers
  uhc: {
    id: 'uhc',
    name: 'UnitedHealthcare',
    indexPages: [
      'https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html',
    ],
    searchUrl: 'https://www.uhcprovider.com/search.html?q=',
    searchTerms: ['liquid biopsy', 'ctDNA', 'molecular oncology'],
  },
  aetna: {
    id: 'aetna',
    name: 'Aetna',
    indexPages: [
      'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html',
    ],
    searchUrl: null, // No public search
    searchTerms: [],
  },
  cigna: {
    id: 'cigna',
    name: 'Cigna',
    indexPages: [
      'https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/index.html',
    ],
    searchUrl: null,
    searchTerms: [],
  },
  anthem: {
    id: 'anthem',
    name: 'Anthem',
    indexPages: [
      'https://www.anthem.com/provider/policies/',
    ],
    searchUrl: null,
    searchTerms: [],
  },
  humana: {
    id: 'humana',
    name: 'Humana',
    indexPages: [
      'https://www.humana.com/provider/medical-resources/clinical-tools/clinical-policy-updates',
    ],
    searchUrl: null,
    searchTerms: [],
  },

  // LBMs
  carelon: {
    id: 'carelon',
    name: 'Carelon',
    indexPages: [
      'https://guidelines.carelonmedicalbenefitsmanagement.com/',
    ],
    searchUrl: 'https://guidelines.carelonmedicalbenefitsmanagement.com/?s=',
    searchTerms: ['liquid biopsy', 'genetic testing', 'MRD'],
  },
  evicore: {
    id: 'evicore',
    name: 'eviCore',
    indexPages: [
      'https://www.evicore.com/resources/healthplan/clinical-guidelines',
    ],
    searchUrl: null,
    searchTerms: [],
  },
};

/**
 * Discovery Crawler class
 */
export class DiscoveryCrawler {
  constructor(options = {}) {
    this.fetchFn = options.fetchFn || fetch;
    this.maxPagesPerPayer = options.maxPagesPerPayer || 10;
    this.minRelevanceScore = options.minRelevanceScore || 0.3;
    this.dryRun = options.dryRun || false;
  }

  /**
   * Run discovery for all configured payers
   * @returns {Object} { candidates, errors }
   */
  async run() {
    logger.info('Starting discovery crawl');

    const candidates = [];
    const errors = [];

    for (const [payerId, source] of Object.entries(DISCOVERY_SOURCES)) {
      try {
        const payerCandidates = await this.discoverForPayer(source);
        candidates.push(...payerCandidates);
        logger.info(`Discovery complete for ${source.name}`, {
          candidates: payerCandidates.length,
        });
      } catch (error) {
        logger.error(`Discovery failed for ${source.name}`, {
          error: error.message,
        });
        errors.push({ payerId, error: error.message });
      }
    }

    logger.info('Discovery crawl complete', {
      totalCandidates: candidates.length,
      errors: errors.length,
    });

    return { candidates, errors };
  }

  /**
   * Run discovery for a single payer
   * @param {Object} source - Payer discovery source config
   * @returns {Object[]} Candidate documents
   */
  async discoverForPayer(source) {
    const candidates = [];

    // 1. Crawl index pages
    for (const indexUrl of source.indexPages || []) {
      try {
        const indexCandidates = await this.crawlIndexPage(indexUrl, source);
        candidates.push(...indexCandidates);
      } catch (error) {
        logger.warn(`Failed to crawl index page`, {
          url: indexUrl,
          error: error.message,
        });
      }
    }

    // 2. Search site if available
    if (source.searchUrl && source.searchTerms.length > 0) {
      for (const term of source.searchTerms) {
        try {
          const searchCandidates = await this.searchPayerSite(source, term);
          candidates.push(...searchCandidates);
        } catch (error) {
          logger.warn(`Search failed for ${source.name}`, {
            term,
            error: error.message,
          });
        }
      }
    }

    // 3. Deduplicate and filter
    const uniqueCandidates = this.deduplicateCandidates(candidates);
    const filteredCandidates = filterByRelevance(uniqueCandidates, this.minRelevanceScore);

    // 4. Filter out already known URLs
    const newCandidates = [];
    for (const candidate of filteredCandidates) {
      if (!this.isUrlKnown(candidate.url)) {
        newCandidates.push(candidate);
      }
    }

    // 5. Stage discoveries
    if (!this.dryRun) {
      for (const candidate of newCandidates.slice(0, this.maxPagesPerPayer)) {
        await this.stageCandidate(candidate, source);
      }
    }

    return newCandidates.slice(0, this.maxPagesPerPayer);
  }

  /**
   * Crawl an index page for policy links
   * @param {string} url - Index page URL
   * @param {Object} source - Payer source config
   * @returns {Object[]} Candidate documents
   */
  async crawlIndexPage(url, source) {
    logger.debug(`Crawling index page: ${url}`);

    try {
      const response = await this.fetchFn(url, {
        headers: {
          'User-Agent': 'OpenOnco-Daemon/1.0 (Research; contact@openonco.org)',
        },
        timeout: 30000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const links = this.extractLinks(html, url);

      // Filter to policy-like links
      const policyLinks = links.filter(link => this.isPolicyLikeUrl(link.url));

      // Check relevance
      const candidates = policyLinks.map(link => ({
        url: link.url,
        title: link.text,
        snippet: link.context,
        sourcePageUrl: url,
        payerId: source.id,
        payerName: source.name,
      }));

      return candidates;
    } catch (error) {
      logger.warn(`Index crawl failed: ${url}`, { error: error.message });
      return [];
    }
  }

  /**
   * Search a payer's site for relevant documents
   * @param {Object} source - Payer source config
   * @param {string} term - Search term
   * @returns {Object[]} Candidate documents
   */
  async searchPayerSite(source, term) {
    if (!source.searchUrl) return [];

    const searchUrl = `${source.searchUrl}${encodeURIComponent(term)}`;
    logger.debug(`Searching: ${searchUrl}`);

    try {
      const response = await this.fetchFn(searchUrl, {
        headers: {
          'User-Agent': 'OpenOnco-Daemon/1.0 (Research; contact@openonco.org)',
        },
        timeout: 30000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const results = this.parseSearchResults(html, searchUrl);

      return results.map(result => ({
        ...result,
        sourcePageUrl: searchUrl,
        payerId: source.id,
        payerName: source.name,
      }));
    } catch (error) {
      logger.warn(`Search failed: ${searchUrl}`, { error: error.message });
      return [];
    }
  }

  /**
   * Extract links from HTML content
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for resolving relative links
   * @returns {Object[]} { url, text, context }
   */
  extractLinks(html, baseUrl) {
    const links = [];
    const linkPattern = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;

    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].trim();

      // Skip empty or anchor links
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        continue;
      }

      // Resolve relative URLs
      let fullUrl;
      try {
        fullUrl = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }

      // Get surrounding context
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(html.length, match.index + match[0].length + 100);
      const context = html.slice(contextStart, contextEnd).replace(/<[^>]+>/g, ' ').trim();

      links.push({
        url: fullUrl,
        text,
        context,
      });
    }

    return links;
  }

  /**
   * Parse search results from HTML
   * @param {string} html - Search results HTML
   * @param {string} searchUrl - Search URL
   * @returns {Object[]} Search results
   */
  parseSearchResults(html, searchUrl) {
    // Generic search result extraction
    // This may need customization per payer
    const results = [];

    // Common patterns for search results
    const patterns = [
      // WordPress/generic
      /<article[^>]*>.*?<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>.*?<\/article>/gis,
      // List items with links
      /<li[^>]*>.*?<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>.*?<\/li>/gis,
      // Divs with result class
      /<div[^>]*class=["'][^"']*result[^"']*["'][^>]*>.*?<a\s+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gis,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const url = match[1];
        const title = match[2].trim();

        if (url && title && !url.startsWith('#')) {
          try {
            const fullUrl = new URL(url, searchUrl).toString();
            results.push({
              url: fullUrl,
              title,
              snippet: '',
            });
          } catch {
            // Invalid URL, skip
          }
        }
      }
    }

    return results;
  }

  /**
   * Check if URL looks like a policy document
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isPolicyLikeUrl(url) {
    const lower = url.toLowerCase();

    // Must be PDF or HTML
    if (!lower.endsWith('.pdf') && !lower.endsWith('.html') && !lower.endsWith('.htm')) {
      // Allow URLs with policy-like paths
      if (!/polic|guideline|criteria|coverage/i.test(lower)) {
        return false;
      }
    }

    // Check for policy-like patterns
    const policyPatterns = [
      /medical.?polic/i,
      /clinical.?polic/i,
      /coverage.?polic/i,
      /guideline/i,
      /criteria/i,
      /\.pdf$/i,
    ];

    return policyPatterns.some(p => p.test(url));
  }

  /**
   * Check if URL is already in registry or discovered
   * @param {string} url - URL to check
   * @returns {boolean}
   */
  isUrlKnown(url) {
    // Check policy registry
    for (const payer of Object.values(POLICY_REGISTRY)) {
      for (const policy of payer.policies || []) {
        if (policy.url === url) {
          return true;
        }
      }
    }

    // Check discovered policies (async but we'll check sync for now)
    return isUrlAlreadyDiscovered(url);
  }

  /**
   * Deduplicate candidate documents by URL
   * @param {Object[]} candidates - Candidates to dedupe
   * @returns {Object[]} Unique candidates
   */
  deduplicateCandidates(candidates) {
    const seen = new Set();
    const unique = [];

    for (const candidate of candidates) {
      if (!seen.has(candidate.url)) {
        seen.add(candidate.url);
        unique.push(candidate);
      }
    }

    return unique;
  }

  /**
   * Stage a candidate for review
   * @param {Object} candidate - Candidate document
   * @param {Object} source - Payer source config
   */
  async stageCandidate(candidate, source) {
    const matchedKeywords = getMatchedKeywords(candidate);
    const docTypeGuess = guessDocType(candidate);

    const discovery = {
      payerId: source.id,
      payerName: source.name,
      url: candidate.url,
      linkText: candidate.title,
      linkContext: candidate.snippet,
      contentType: candidate.url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html',
      policyType: 'liquid_biopsy', // Default guess
      classificationConfidence: candidate.relevanceScore || 0.5,
      classificationReason: `Matched keywords: ${matchedKeywords.join(', ')}`,
      sourcePageUrl: candidate.sourcePageUrl,
    };

    try {
      const staged = stageDiscoveredPolicy(discovery);
      logger.info(`Staged discovery: ${candidate.url}`, {
        discoveryId: staged.discoveryId,
        payerId: source.id,
      });
    } catch (error) {
      logger.error(`Failed to stage discovery`, {
        url: candidate.url,
        error: error.message,
      });
    }
  }
}

/**
 * Create a document candidate proposal from a discovery
 * @param {Object} discovery - Discovery record
 * @returns {Object} Proposal object
 */
export function createDocumentCandidateProposal(discovery) {
  return createProposal(PROPOSAL_TYPES.DOCUMENT_CANDIDATE, {
    payerId: discovery.payer_id || discovery.payerId,
    payerName: discovery.payer_name || discovery.payerName,
    url: discovery.url,
    title: discovery.link_text || discovery.linkText,
    docTypeGuess: discovery.policy_type || discovery.policyType || 'unknown',
    policyTypeGuess: 'liquid_biopsy',
    contentType: discovery.content_type || discovery.contentType,
    matchedKeywords: discovery.classification_reason?.match(/[\w\s]+/g) || [],
    relevanceScore: discovery.classification_confidence || discovery.classificationConfidence || 0.5,
    sourcePageUrl: discovery.source_page_url || discovery.sourcePageUrl,
    linkText: discovery.link_text || discovery.linkText,
    linkContext: discovery.link_context || discovery.linkContext,
    source: discovery.url, // For validator compatibility
  });
}

/**
 * Run a quick discovery scan
 * @param {Object} options - { payerIds, dryRun }
 * @returns {Object} Discovery results
 */
export async function runDiscovery(options = {}) {
  const crawler = new DiscoveryCrawler({
    dryRun: options.dryRun || false,
  });

  if (options.payerIds && options.payerIds.length > 0) {
    // Run for specific payers
    const candidates = [];
    const errors = [];

    for (const payerId of options.payerIds) {
      const source = DISCOVERY_SOURCES[payerId];
      if (!source) {
        errors.push({ payerId, error: 'Unknown payer ID' });
        continue;
      }

      try {
        const payerCandidates = await crawler.discoverForPayer(source);
        candidates.push(...payerCandidates);
      } catch (error) {
        errors.push({ payerId, error: error.message });
      }
    }

    return { candidates, errors };
  }

  // Run for all payers
  return crawler.run();
}

export default {
  DiscoveryCrawler,
  DISCOVERY_SOURCES,
  createDocumentCandidateProposal,
  runDiscovery,
};
