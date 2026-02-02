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

import { createHttpClient } from '../utils/http.js';
import { createLogger } from '../utils/logger.js';
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

// ============================================
// PMC FULL TEXT FETCHING (P2.3)
// ============================================

/**
 * Check if an article has PMC full text available
 * @param {string} pmid - PubMed ID
 * @returns {Promise<{hasPMC: boolean, pmcId: string|null}>}
 */
export async function checkPMCAvailability(pmid) {
  const params = new URLSearchParams({
    dbfrom: 'pubmed',
    db: 'pmc',
    id: pmid,
    retmode: 'json',
  });

  if (process.env.NCBI_API_KEY) {
    params.append('api_key', process.env.NCBI_API_KEY);
  }

  const url = `${BASE_URL}/elink.fcgi?${params}`;

  try {
    const response = await http.getJson(url);
    const linksets = response?.linksets?.[0]?.linksetdbs;

    if (!linksets) {
      return { hasPMC: false, pmcId: null };
    }

    const pmcDb = linksets.find(db => db.dbto === 'pmc');
    const pmcId = pmcDb?.links?.[0];

    return {
      hasPMC: !!pmcId,
      pmcId: pmcId ? `PMC${pmcId}` : null,
    };
  } catch (error) {
    logger.debug('PMC availability check failed', { pmid, error: error.message });
    return { hasPMC: false, pmcId: null };
  }
}

/**
 * Fetch PMC full text for an article
 * @param {string} pmcId - PMC ID (e.g., "PMC1234567")
 * @returns {Promise<{fullText: string, isOpenAccess: boolean}|null>}
 */
export async function fetchPMCFullText(pmcId) {
  // Strip 'PMC' prefix if present
  const numericId = pmcId.replace(/^PMC/i, '');

  // Use PMC OAI service for open access articles
  const oaiUrl = `https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${numericId}&metadataPrefix=pmc`;

  try {
    const response = await http.getText(oaiUrl);

    // Check for error responses
    if (response.includes('<error code=')) {
      logger.debug('PMC article not available via OAI', { pmcId });
      return null;
    }

    // Extract body text from XML
    const bodyMatch = response.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!bodyMatch) {
      // Try alternative: extract from full article content
      const articleMatch = response.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      if (!articleMatch) {
        return null;
      }

      // Extract just the sections
      const sections = [];
      const sectionMatches = articleMatch[1].matchAll(/<sec[^>]*>([\s\S]*?)<\/sec>/gi);
      for (const match of sectionMatches) {
        sections.push(stripXmlTags(match[1]));
      }

      if (sections.length === 0) {
        return null;
      }

      return {
        fullText: sections.join('\n\n').substring(0, 100000), // Limit to 100k chars
        isOpenAccess: true,
      };
    }

    // Strip XML tags and clean up
    const fullText = stripXmlTags(bodyMatch[1]);

    return {
      fullText: fullText.substring(0, 100000), // Limit to 100k chars
      isOpenAccess: true,
    };

  } catch (error) {
    logger.debug('PMC full text fetch failed', { pmcId, error: error.message });
    return null;
  }
}

/**
 * Strip XML tags from text
 * @param {string} xml - XML content
 * @returns {string} - Plain text
 */
function stripXmlTags(xml) {
  return xml
    .replace(/<xref[^>]*>.*?<\/xref>/gi, '') // Remove citations
    .replace(/<ext-link[^>]*>.*?<\/ext-link>/gi, '') // Remove external links
    .replace(/<[^>]+>/g, ' ') // Remove all other tags
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Enrich article with PMC full text if available
 * @param {Object} article - Article object with pmid
 * @returns {Promise<Object>} - Enriched article
 */
export async function enrichWithFullText(article) {
  if (!article.pmid) {
    return article;
  }

  try {
    // Check PMC availability
    const { hasPMC, pmcId } = await checkPMCAvailability(article.pmid);

    if (!hasPMC || !pmcId) {
      return article;
    }

    // Fetch full text
    const result = await fetchPMCFullText(pmcId);

    if (!result) {
      return { ...article, pmcId };
    }

    logger.debug('Enriched with full text', {
      pmid: article.pmid,
      pmcId,
      textLength: result.fullText.length,
    });

    return {
      ...article,
      pmcId,
      fullTextExcerpt: result.fullText,
      isOpenAccess: result.isOpenAccess,
    };

  } catch (error) {
    logger.warn('Full text enrichment failed', {
      pmid: article.pmid,
      error: error.message,
    });
    return article;
  }
}

/**
 * Batch enrich articles with PMC full text
 * @param {Object[]} articles - Array of articles
 * @param {Object} options - Options
 * @returns {Promise<Object[]>} - Enriched articles
 */
export async function batchEnrichWithFullText(articles, options = {}) {
  const { concurrency = 3, limit = 50 } = options;

  // Only enrich articles that don't already have full text
  const needsEnrichment = articles.filter(a => !a.fullTextExcerpt);

  if (needsEnrichment.length === 0) {
    return articles;
  }

  logger.info('Enriching articles with PMC full text', {
    total: articles.length,
    needsEnrichment: needsEnrichment.length,
    limit,
  });

  // Limit how many we enrich per batch to avoid rate limiting
  const toEnrich = needsEnrichment.slice(0, limit);
  const enriched = new Map();

  // Process in batches for rate limiting
  for (let i = 0; i < toEnrich.length; i += concurrency) {
    const batch = toEnrich.slice(i, i + concurrency);

    const results = await Promise.all(
      batch.map(async (article) => {
        const result = await enrichWithFullText(article);
        return { pmid: article.pmid, result };
      })
    );

    for (const { pmid, result } of results) {
      enriched.set(pmid, result);
    }

    // Small delay between batches
    if (i + concurrency < toEnrich.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Merge enriched results back
  return articles.map(article => {
    if (enriched.has(article.pmid)) {
      return enriched.get(article.pmid);
    }
    return article;
  });
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

  // Build search query - use 'all' to cast a wider net, AI triage will filter
  const query = buildMRDSearchQuery({
    fromDate,
    toDate,
    publicationTypes: 'all',
    includeReviews: true, // Include reviews - they often have important synthesis
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
