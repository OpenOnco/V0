/**
 * PubMed Crawler for MRD Guidance Monitor
 * Uses NCBI E-utilities API to search and fetch medical literature
 *
 * API Documentation: https://www.ncbi.nlm.nih.gov/books/NBK25499/
 *
 * Rate limits:
 * - Without API key: 3 requests/second
 * - With API key: 10 requests/second
 *
 * Environment variables:
 * - NCBI_API_KEY: Optional API key from NCBI
 */

import { createHttpClient } from '../../utils/http.js';
import { createLogger } from '../../utils/logger.js';
import { buildMRDSearchQuery, scoreRelevance, getMRDKeywordRegex } from './pubmed-queries.js';

const logger = createLogger('mrd-pubmed');
const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// Create HTTP client with appropriate rate limiting
const http = createHttpClient('pubmed', {
  requestsPerMinute: process.env.NCBI_API_KEY ? 600 : 180, // 10/sec or 3/sec
});

/**
 * Search PubMed for articles matching query
 * @param {string} query - PubMed search query
 * @param {Object} options - Search options
 * @returns {Promise<{count: number, ids: string[]}>}
 */
export async function search(query, options = {}) {
  const {
    retmax = 100,
    retstart = 0,
    sort = 'pub+date',
  } = options;

  const params = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmax: retmax.toString(),
    retstart: retstart.toString(),
    sort,
    retmode: 'json',
  });

  if (process.env.NCBI_API_KEY) {
    params.append('api_key', process.env.NCBI_API_KEY);
  }

  const url = `${BASE_URL}/esearch.fcgi?${params}`;
  logger.debug('PubMed search', { query: query.substring(0, 100), retmax, retstart });

  const response = await http.getJson(url);
  const result = response.esearchresult;

  if (!result) {
    throw new Error('Invalid PubMed search response');
  }

  return {
    count: parseInt(result.count, 10),
    ids: result.idlist || [],
    queryTranslation: result.querytranslation,
  };
}

/**
 * Fetch article details by PMIDs
 * @param {string[]} pmids - Array of PubMed IDs
 * @returns {Promise<Object[]>} - Array of article objects
 */
export async function fetchArticles(pmids) {
  if (!pmids || pmids.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
  });

  if (process.env.NCBI_API_KEY) {
    params.append('api_key', process.env.NCBI_API_KEY);
  }

  const url = `${BASE_URL}/efetch.fcgi?${params}`;
  logger.debug('Fetching articles', { count: pmids.length });

  const response = await http.getText(url);

  // Parse XML response
  return parseArticlesXML(response);
}

/**
 * Parse PubMed XML response into article objects
 * @param {string} xml - XML response from efetch
 * @returns {Object[]} - Array of parsed articles
 */
function parseArticlesXML(xml) {
  const articles = [];

  // Simple regex-based parsing for key fields
  // Note: A proper XML parser would be better for production
  const articleMatches = xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g);

  for (const match of articleMatches) {
    const articleXml = match[1];

    try {
      const article = {
        pmid: extractTag(articleXml, 'PMID'),
        title: extractTag(articleXml, 'ArticleTitle'),
        abstract: extractAbstract(articleXml),
        journal: extractTag(articleXml, 'Title'), // Journal title
        journalAbbrev: extractTag(articleXml, 'ISOAbbreviation'),
        publicationDate: extractPublicationDate(articleXml),
        doi: extractDOI(articleXml),
        authors: extractAuthors(articleXml),
        publicationTypes: extractPublicationTypes(articleXml),
        meshTerms: extractMeshTerms(articleXml),
        keywords: extractKeywords(articleXml),
      };

      if (article.pmid && article.title) {
        articles.push(article);
      }
    } catch (error) {
      logger.warn('Failed to parse article', { error: error.message });
    }
  }

  return articles;
}

function extractTag(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 's'));
  return match ? cleanText(match[1]) : null;
}

function extractAbstract(xml) {
  // Handle structured abstracts with multiple AbstractText elements
  const abstractTexts = [];
  const matches = xml.matchAll(/<AbstractText[^>]*>([^<]*)<\/AbstractText>/gs);

  for (const match of matches) {
    abstractTexts.push(cleanText(match[1]));
  }

  return abstractTexts.join(' ').trim() || null;
}

function extractPublicationDate(xml) {
  // Try PubDate first
  const pubDateMatch = xml.match(/<PubDate>([\s\S]*?)<\/PubDate>/);
  if (pubDateMatch) {
    const dateXml = pubDateMatch[1];
    const year = extractTag(dateXml, 'Year');
    const month = extractTag(dateXml, 'Month');
    const day = extractTag(dateXml, 'Day');

    if (year) {
      const monthNum = monthToNumber(month) || '01';
      const dayNum = day ? day.padStart(2, '0') : '01';
      return `${year}-${monthNum}-${dayNum}`;
    }
  }

  // Fallback to MedlineDate
  const medlineDateMatch = xml.match(/<MedlineDate>(\d{4})/);
  if (medlineDateMatch) {
    return `${medlineDateMatch[1]}-01-01`;
  }

  return null;
}

function monthToNumber(month) {
  if (!month) return null;

  const monthMap = {
    jan: '01', feb: '02', mar: '03', apr: '04',
    may: '05', jun: '06', jul: '07', aug: '08',
    sep: '09', oct: '10', nov: '11', dec: '12',
  };

  const lower = month.toLowerCase().substring(0, 3);
  return monthMap[lower] || null;
}

function extractDOI(xml) {
  const match = xml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
  return match ? match[1] : null;
}

function extractAuthors(xml) {
  const authors = [];
  const authorMatches = xml.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/g);

  for (const match of authorMatches) {
    const authorXml = match[1];
    const lastName = extractTag(authorXml, 'LastName');
    const foreName = extractTag(authorXml, 'ForeName');
    const initials = extractTag(authorXml, 'Initials');

    if (lastName) {
      authors.push({
        name: foreName ? `${lastName} ${initials || foreName.charAt(0)}` : lastName,
        affiliation: extractTag(authorXml, 'Affiliation'),
      });
    }
  }

  // Mark first and last authors
  if (authors.length > 0) {
    authors[0].is_first = true;
    authors[authors.length - 1].is_last = true;
  }

  return authors;
}

function extractPublicationTypes(xml) {
  const types = [];
  const matches = xml.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g);

  for (const match of matches) {
    types.push(cleanText(match[1]));
  }

  return types;
}

function extractMeshTerms(xml) {
  const terms = [];
  const matches = xml.matchAll(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g);

  for (const match of matches) {
    terms.push(cleanText(match[1]));
  }

  return terms;
}

function extractKeywords(xml) {
  const keywords = [];
  const matches = xml.matchAll(/<Keyword[^>]*>([^<]+)<\/Keyword>/g);

  for (const match of matches) {
    keywords.push(cleanText(match[1]));
  }

  return keywords;
}

function cleanText(text) {
  if (!text) return null;
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Search and fetch MRD-related articles
 * Main entry point for the crawler
 * @param {Object} options - Crawl options
 * @returns {Promise<Object[]>} - Array of processed articles
 */
export async function crawlMRDArticles(options = {}) {
  const {
    fromDate,
    toDate,
    maxResults = 500,
    batchSize = 50,
  } = options;

  logger.info('Starting PubMed MRD crawl', { fromDate, toDate, maxResults });

  // Build search query
  const query = buildMRDSearchQuery({
    fromDate,
    toDate,
    publicationTypes: 'clinical', // Focus on clinical evidence
  });

  // Initial search to get count and first batch of IDs
  const searchResult = await search(query, { retmax: batchSize });
  logger.info('PubMed search results', {
    count: searchResult.count,
    firstBatch: searchResult.ids.length,
  });

  if (searchResult.count === 0) {
    return [];
  }

  // Collect all PMIDs up to maxResults
  let allPmids = [...searchResult.ids];
  let offset = batchSize;

  while (offset < Math.min(searchResult.count, maxResults)) {
    const batch = await search(query, { retmax: batchSize, retstart: offset });
    allPmids = allPmids.concat(batch.ids);
    offset += batchSize;

    // Rate limiting pause
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logger.info('Collected PMIDs', { count: allPmids.length });

  // Fetch articles in batches
  const articles = [];
  const fetchBatchSize = 20;

  for (let i = 0; i < allPmids.length; i += fetchBatchSize) {
    const batch = allPmids.slice(i, i + fetchBatchSize);
    const batchArticles = await fetchArticles(batch);
    articles.push(...batchArticles);

    logger.debug('Fetched batch', { batch: i / fetchBatchSize + 1, articles: batchArticles.length });

    // Rate limiting pause
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  logger.info('Fetched all articles', { count: articles.length });

  // Apply keyword pre-filter
  const keywordRegex = getMRDKeywordRegex();
  const filtered = articles.filter((article) => {
    const text = `${article.title} ${article.abstract || ''}`;
    return keywordRegex.test(text);
  });

  logger.info('After keyword filter', {
    before: articles.length,
    after: filtered.length,
    filtered: articles.length - filtered.length,
  });

  // Score relevance
  const scored = filtered.map((article) => ({
    ...article,
    relevanceScore: scoreRelevance(article.title, article.abstract || ''),
    sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
  }));

  // Sort by relevance
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scored;
}

export default {
  search,
  fetchArticles,
  crawlMRDArticles,
};
