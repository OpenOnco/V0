/**
 * PubMed Crawler
 * Searches for relevant oncology and ctDNA publications using E-utilities API
 *
 * API Documentation: https://www.ncbi.nlm.nih.gov/books/NBK25501/
 * E-utilities base URL: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
 *
 * Focus areas:
 * - Validation studies for MRD tests
 * - Clinical utility studies
 * - Comparative studies between tests
 * - Coverage and reimbursement analyses
 */

import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES, ALL_TEST_NAMES } from '../config.js';

// Build search queries from monitored test names and key topics
const TEST_SEARCH_QUERIES = ALL_TEST_NAMES.slice(0, 15).map((test) => `"${test}"`);

// Topic-based queries for relevant research areas
const TOPIC_QUERIES = [
  // ctDNA and MRD research
  '(ctDNA OR "circulating tumor DNA") AND "minimal residual disease"',
  '"liquid biopsy" AND (MRD OR "molecular residual disease")',
  'ctDNA AND colorectal AND (recurrence OR surveillance)',

  // Clinical utility and validation
  '"clinical utility" AND (ctDNA OR "liquid biopsy")',
  '"validation study" AND ctDNA AND cancer',

  // Coverage and policy
  '(Medicare OR "coverage determination") AND (ctDNA OR "liquid biopsy")',
];

export class PubMedCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.pubmed.name,
      source: SOURCES.PUBMED,
      description: config.crawlers.pubmed.description,
      rateLimit: config.crawlers.pubmed.rateLimit,
      enabled: config.crawlers.pubmed.enabled,
    });

    this.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    this.seenPmids = new Set(); // Track PMIDs to avoid duplicates across queries
  }

  /**
   * Main crawl implementation
   * Searches PubMed for papers from the last 7 days mentioning monitored tests
   */
  async crawl() {
    this.log('info', 'Starting PubMed crawl');
    this.seenPmids.clear();

    const discoveries = [];
    const allQueries = [...TEST_SEARCH_QUERIES.slice(0, 10), ...TOPIC_QUERIES];

    for (const query of allQueries) {
      try {
        const articles = await this.searchArticles(query);

        for (const article of articles) {
          // Skip if we've already seen this PMID
          if (this.seenPmids.has(article.pmid)) {
            continue;
          }
          this.seenPmids.add(article.pmid);

          // Filter for relevance
          const relevance = this.calculateRelevance(article);
          if (relevance !== 'low') {
            discoveries.push(this.createDiscoveryFromArticle({ ...article, relevance }));
          }
        }
      } catch (error) {
        this.log('warn', `Failed to search query: ${query}`, { error: error.message });
      }
    }

    this.log('info', 'PubMed crawl complete', {
      queriesRun: allQueries.length,
      uniquePmids: this.seenPmids.size,
      discoveries: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Search PubMed for articles matching query from last 7 days
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Array of article objects
   */
  async searchArticles(query) {
    // Step 1: Use esearch to get PMIDs
    const searchUrl = new URL(`${this.baseUrl}/esearch.fcgi`);
    searchUrl.searchParams.set('db', 'pubmed');
    searchUrl.searchParams.set('term', query);
    searchUrl.searchParams.set('retmax', '20');
    searchUrl.searchParams.set('datetype', 'pdat'); // Publication date
    searchUrl.searchParams.set('reldate', '7'); // Last 7 days
    searchUrl.searchParams.set('retmode', 'json');
    searchUrl.searchParams.set('sort', 'relevance');

    this.log('debug', `Searching: ${query}`);

    const searchResult = await this.http.getJson(searchUrl.toString());
    const ids = searchResult.esearchresult?.idlist || [];

    if (ids.length === 0) {
      this.log('debug', `No results for: ${query}`);
      return [];
    }

    this.log('debug', `Found ${ids.length} articles for: ${query}`);

    // Step 2: Use esummary to get article details (lighter than efetch)
    const articles = await this.fetchArticleSummaries(ids);
    return articles;
  }

  /**
   * Fetch article summaries using esummary
   * @param {string[]} pmids - Array of PubMed IDs
   * @returns {Promise<Array>} - Array of article summary objects
   */
  async fetchArticleSummaries(pmids) {
    if (pmids.length === 0) return [];

    const summaryUrl = new URL(`${this.baseUrl}/esummary.fcgi`);
    summaryUrl.searchParams.set('db', 'pubmed');
    summaryUrl.searchParams.set('id', pmids.join(','));
    summaryUrl.searchParams.set('retmode', 'json');

    const summaryResult = await this.http.getJson(summaryUrl.toString());
    const result = summaryResult.result || {};

    const articles = [];
    for (const pmid of pmids) {
      const doc = result[pmid];
      if (!doc || doc.error) continue;

      articles.push({
        pmid,
        title: doc.title || '',
        authors: this.formatAuthors(doc.authors || []),
        journal: doc.source || doc.fulljournalname || '',
        pubDate: doc.pubdate || doc.epubdate || '',
        abstract: '', // esummary doesn't include abstract, would need efetch for full abstract
        articleType: doc.pubtype || [],
        doi: this.extractDoi(doc.articleids || []),
      });
    }

    return articles;
  }

  /**
   * Format author list into readable string
   * @param {Array} authors - Array of author objects
   * @returns {string}
   */
  formatAuthors(authors) {
    if (!authors || authors.length === 0) return 'Unknown';
    if (authors.length <= 3) {
      return authors.map((a) => a.name).join(', ');
    }
    return `${authors[0].name} et al.`;
  }

  /**
   * Extract DOI from article IDs
   * @param {Array} articleIds - Array of ID objects
   * @returns {string|null}
   */
  extractDoi(articleIds) {
    const doiEntry = articleIds.find((id) => id.idtype === 'doi');
    return doiEntry ? doiEntry.value : null;
  }

  /**
   * Calculate relevance score based on title and article type
   * Focus on validation studies, clinical utility, and comparative studies
   * @param {Object} article - Article object
   * @returns {string} - 'high', 'medium', or 'low'
   */
  calculateRelevance(article) {
    const text = `${article.title} ${article.journal}`.toLowerCase();
    const types = (article.articleType || []).map((t) => t.toLowerCase());

    // High relevance indicators
    const highRelevanceKeywords = [
      'signatera',
      'guardant reveal',
      'guardant360',
      'foundationone',
      'validation study',
      'clinical utility',
      'clinical validation',
      'comparative study',
      'medicare',
      'coverage',
      'mrd',
      'minimal residual disease',
      'molecular residual disease',
      'surveillance',
      'recurrence detection',
    ];

    // Check for high relevance
    for (const keyword of highRelevanceKeywords) {
      if (text.includes(keyword)) {
        return 'high';
      }
    }

    // Boost clinical trials and reviews
    if (types.includes('clinical trial') || types.includes('review') || types.includes('meta-analysis')) {
      return 'high';
    }

    // Medium relevance indicators
    const mediumRelevanceKeywords = [
      'ctdna',
      'circulating tumor dna',
      'liquid biopsy',
      'colorectal',
      'colon cancer',
      'breast cancer',
      'lung cancer',
      'oncology',
      'biomarker',
    ];

    for (const keyword of mediumRelevanceKeywords) {
      if (text.includes(keyword)) {
        return 'medium';
      }
    }

    return 'low';
  }

  /**
   * Create a discovery object from a PubMed article
   * @param {Object} article - Article object with relevance
   * @returns {Object} - Discovery object
   */
  createDiscoveryFromArticle(article) {
    return {
      source: SOURCES.PUBMED,
      type: DISCOVERY_TYPES.PUBLICATION,
      title: article.title,
      summary: `${article.authors} - ${article.journal} (${article.pubDate})`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      relevance: article.relevance,
      metadata: {
        pmid: article.pmid,
        authors: article.authors,
        journal: article.journal,
        publicationDate: article.pubDate,
        articleType: article.articleType,
        doi: article.doi,
      },
    };
  }
}

export default PubMedCrawler;
