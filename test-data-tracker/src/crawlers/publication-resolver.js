/**
 * Publication Resolver
 *
 * Takes clinical evidence hints from vendor press releases and resolves them
 * to actual PubMed publications. Vendors announce trial results and publications
 * in their press releases - this module finds the actual papers.
 *
 * Flow:
 * 1. Vendor press release: "CIRCULATE trial results published in NEJM"
 * 2. Extract hints: trial name, journal, test name, authors
 * 3. Search PubMed for matching publication
 * 4. Fetch full abstract and metadata
 * 5. Write to physician-system database
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('publication-resolver');

const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const NCBI_API_KEY = process.env.NCBI_API_KEY;

// Rate limiting
const RATE_LIMIT_MS = NCBI_API_KEY ? 100 : 350; // 10/sec with key, 3/sec without

/**
 * Sleep helper for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Build PubMed search query from vendor evidence hints
 */
function buildSearchQuery(evidence) {
  const parts = [];

  // Direct title search - exact match on publication title
  if (evidence.title) {
    parts.push(`"${evidence.title}"[ti]`);
  }

  // Trial name is often the best identifier
  if (evidence.trialName) {
    // Clean up trial name - remove common suffixes
    const trialName = evidence.trialName
      .replace(/\s*(trial|study|results?)\s*/gi, ' ')
      .trim();
    parts.push(`"${trialName}"[tiab]`);
  }

  // Test name can help narrow down
  if (evidence.testName) {
    parts.push(`"${evidence.testName}"[tiab]`);
  }

  // Journal name if specified
  if (evidence.journal) {
    parts.push(`"${evidence.journal}"[journal]`);
  }

  // Author names if available
  if (evidence.firstAuthor) {
    parts.push(`${evidence.firstAuthor}[author]`);
  }

  // NCT ID is very specific
  if (evidence.nctId) {
    parts.push(`${evidence.nctId}[tiab]`);
  }

  // DOI is definitive
  if (evidence.doi) {
    parts.push(`${evidence.doi}[aid]`);
  }

  // PMID is definitive
  if (evidence.pmid) {
    return evidence.pmid; // Direct lookup
  }

  // Add MRD/ctDNA context if no specific identifiers
  if (parts.length < 2) {
    parts.push('(ctDNA[tiab] OR "circulating tumor DNA"[tiab] OR MRD[tiab] OR "minimal residual disease"[tiab])');
  }

  // Date filter if we have publication date
  if (evidence.publicationDate) {
    const year = new Date(evidence.publicationDate).getFullYear();
    parts.push(`${year}[pdat]`);
  }

  return parts.join(' AND ');
}

/**
 * Search PubMed for publications matching the query
 */
async function searchPubMed(query, maxResults = 5) {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmax: maxResults.toString(),
    retmode: 'json',
    sort: 'relevance',
  });

  if (NCBI_API_KEY) {
    params.append('api_key', NCBI_API_KEY);
  }

  const url = `${PUBMED_BASE}/esearch.fcgi?${params}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    return {
      count: parseInt(data.esearchresult?.count || '0', 10),
      ids: data.esearchresult?.idlist || [],
    };
  } catch (error) {
    logger.error('PubMed search failed', { error: error.message, query });
    return { count: 0, ids: [] };
  }
}

/**
 * Fetch article details from PubMed
 */
async function fetchArticleDetails(pmids) {
  if (!pmids || pmids.length === 0) return [];

  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
  });

  if (NCBI_API_KEY) {
    params.append('api_key', NCBI_API_KEY);
  }

  const url = `${PUBMED_BASE}/efetch.fcgi?${params}`;

  try {
    const response = await fetch(url);
    const xml = await response.text();
    return parseArticlesXML(xml);
  } catch (error) {
    logger.error('PubMed fetch failed', { error: error.message });
    return [];
  }
}

/**
 * Parse PubMed XML response
 */
function parseArticlesXML(xml) {
  const articles = [];
  const articleMatches = xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g);

  for (const match of articleMatches) {
    const articleXml = match[1];

    const pmid = extractXmlTag(articleXml, 'PMID');
    const title = extractXmlTag(articleXml, 'ArticleTitle');
    const abstractText = extractAbstract(articleXml);
    const journal = extractXmlTag(articleXml, 'Title'); // Journal title
    const journalAbbrev = extractXmlTag(articleXml, 'ISOAbbreviation');
    const pubDate = extractPubDate(articleXml);
    const doi = extractDOI(articleXml);
    const authors = extractAuthors(articleXml);

    if (pmid && title) {
      articles.push({
        pmid,
        title,
        abstract: abstractText,
        journal,
        journalAbbrev,
        publicationDate: pubDate,
        doi,
        authors,
        sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      });
    }
  }

  return articles;
}

function extractXmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].replace(/<[^>]+>/g, '').trim() : null;
}

function extractAbstract(xml) {
  const abstractMatch = xml.match(/<Abstract>([\s\S]*?)<\/Abstract>/i);
  if (!abstractMatch) return null;

  const abstractXml = abstractMatch[1];
  const texts = [];
  const textMatches = abstractXml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi);

  for (const match of textMatches) {
    texts.push(match[1].replace(/<[^>]+>/g, '').trim());
  }

  return texts.join(' ') || null;
}

function extractPubDate(xml) {
  const pubDateMatch = xml.match(/<PubDate>([\s\S]*?)<\/PubDate>/i);
  if (!pubDateMatch) return null;

  const year = extractXmlTag(pubDateMatch[1], 'Year');
  const month = extractXmlTag(pubDateMatch[1], 'Month');
  const day = extractXmlTag(pubDateMatch[1], 'Day');

  if (year) {
    const monthNum = month ? (isNaN(month) ? monthNameToNum(month) : month.padStart(2, '0')) : '01';
    const dayNum = day ? day.padStart(2, '0') : '01';
    return `${year}-${monthNum}-${dayNum}`;
  }
  return null;
}

function monthNameToNum(name) {
  const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                   jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  return months[name.toLowerCase().substring(0, 3)] || '01';
}

function extractDOI(xml) {
  const doiMatch = xml.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/i);
  return doiMatch ? doiMatch[1] : null;
}

function extractAuthors(xml) {
  const authors = [];
  const authorMatches = xml.matchAll(/<Author[^>]*>([\s\S]*?)<\/Author>/gi);

  for (const match of authorMatches) {
    const lastName = extractXmlTag(match[1], 'LastName');
    const foreName = extractXmlTag(match[1], 'ForeName');
    if (lastName) {
      authors.push({
        name: foreName ? `${lastName} ${foreName.charAt(0)}` : lastName,
        fullName: foreName ? `${foreName} ${lastName}` : lastName,
      });
    }
  }

  return authors;
}

/**
 * Resolve a single vendor evidence item to PubMed publication(s)
 */
export async function resolvePublication(evidence) {
  logger.debug('Resolving publication', {
    title: evidence.title,
    trialName: evidence.trialName,
    testName: evidence.testName,
  });

  // Build search query
  const query = buildSearchQuery(evidence);
  logger.debug('PubMed search query', { query });

  await sleep(RATE_LIMIT_MS);

  // Search PubMed
  const searchResults = await searchPubMed(query, 3);

  if (searchResults.ids.length === 0) {
    logger.debug('No PubMed results found', { query });
    return [];
  }

  await sleep(RATE_LIMIT_MS);

  // Fetch article details
  const articles = await fetchArticleDetails(searchResults.ids);

  // Add vendor context to articles
  return articles.map(article => ({
    ...article,
    vendorContext: {
      trialName: evidence.trialName,
      testName: evidence.testName,
      vendorName: evidence.vendorName,
      discoveredVia: 'vendor_press_release',
    },
  }));
}

/**
 * Resolve multiple vendor evidence items to publications
 */
export async function resolvePublications(evidenceItems) {
  const results = {
    resolved: [],
    failed: [],
    stats: {
      total: evidenceItems.length,
      found: 0,
      notFound: 0,
    },
  };

  for (const evidence of evidenceItems) {
    try {
      const publications = await resolvePublication(evidence);

      if (publications.length > 0) {
        results.resolved.push({
          evidence,
          publications,
        });
        results.stats.found++;
      } else {
        results.failed.push({
          evidence,
          reason: 'No matching publications found',
        });
        results.stats.notFound++;
      }
    } catch (error) {
      results.failed.push({
        evidence,
        reason: error.message,
      });
      results.stats.notFound++;
    }
  }

  logger.info('Publication resolution complete', results.stats);
  return results;
}

export default {
  resolvePublication,
  resolvePublications,
  buildSearchQuery,
};
