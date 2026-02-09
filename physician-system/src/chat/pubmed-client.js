/**
 * PubMed Client for Chat Tool Calling
 * Thin wrapper around the existing PubMed crawler with in-memory caching.
 * Used by the MRD chat handler when Claude needs to verify a study PMID.
 */

import { search, fetchArticles } from '../crawlers/pubmed.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('pubmed-client');

// In-memory cache: query → { articles, timestamp }
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const CACHE_MAX = 500;

function pruneCache() {
  if (cache.size <= CACHE_MAX) return;
  const now = Date.now();
  // Evict expired entries first
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL) cache.delete(key);
  }
  // If still over limit, evict oldest
  if (cache.size > CACHE_MAX) {
    const sorted = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toEvict = sorted.slice(0, cache.size - CACHE_MAX);
    for (const [key] of toEvict) cache.delete(key);
  }
}

/**
 * Search PubMed and return simplified article metadata.
 * Results are cached for 30 minutes.
 *
 * @param {string} query - Search query (study name, PMID, keywords)
 * @param {Object} options
 * @param {number} options.maxResults - Max articles to return (default 3)
 * @returns {Promise<{ articles: Array<{ pmid, title, authors, journal, year, doi }>, error?: string }>}
 */
export async function searchPubMed(query, { maxResults = 3 } = {}) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { articles: [], error: 'Empty query' };
  }

  const cacheKey = `${query.trim().toLowerCase()}:${maxResults}`;
  const now = Date.now();

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    logger.debug('PubMed cache hit', { query: query.substring(0, 60) });
    return { articles: cached.articles };
  }

  try {
    // Search for PMIDs
    const searchResult = await search(query.trim(), { retmax: maxResults, sort: 'relevance' });

    if (!searchResult.ids || searchResult.ids.length === 0) {
      return { articles: [] };
    }

    // Fetch article details
    const articles = await fetchArticles(searchResult.ids.slice(0, maxResults));

    // Simplify to tool-friendly format
    const simplified = articles.map(a => ({
      pmid: a.pmid,
      title: a.title,
      authors: a.authors?.slice(0, 3).map(au => au.name || au).join(', ') +
        (a.authors?.length > 3 ? ' et al.' : ''),
      journal: a.journalAbbrev || a.journal,
      year: a.publicationDate?.substring(0, 4) || null,
      doi: a.doi,
    }));

    // Cache the result
    cache.set(cacheKey, { articles: simplified, timestamp: now });
    pruneCache();

    logger.debug('PubMed search complete', {
      query: query.substring(0, 60),
      results: simplified.length,
    });

    return { articles: simplified };
  } catch (error) {
    logger.warn('PubMed search failed', { query: query.substring(0, 60), error: error.message });
    return { articles: [], error: error.message };
  }
}

export default { searchPubMed };
