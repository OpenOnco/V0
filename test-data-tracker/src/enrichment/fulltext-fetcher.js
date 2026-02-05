/**
 * Full Text Fetcher
 *
 * Fetches full text from open access sources in priority order:
 * 1. PubMed Central (PMC) - best quality, structured XML
 * 2. Unpaywall API - finds OA versions via DOI
 * 3. Europe PMC - additional OA coverage
 * 4. Abstract fallback - if no full text available
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('fulltext-fetcher');

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const UNPAYWALL_BASE = 'https://api.unpaywall.org/v2';
const EUROPEPMC_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

// Rate limiting
const RATE_LIMIT_MS = 350; // ~3 requests per second for NCBI
let lastRequestTime = 0;

async function rateLimitedFetch(url, options = {}) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();
  return fetch(url, options);
}

/**
 * Fetch full text content for a publication
 * @param {string} pmid - PubMed ID
 * @param {string} doi - DOI
 * @param {Object} options - Options
 * @returns {Object|null} - { source, fullText, abstract, sections, pmid }
 */
export async function fetchFullText(pmid, doi, options = {}) {
  const { email = 'openonco@openonco.org' } = options;

  // If no PMID but have DOI, try to resolve DOI to PMID first
  if (!pmid && doi) {
    pmid = await resolveDOItoPMID(doi);
    if (pmid) {
      logger.info('Resolved DOI to PMID', { doi, pmid });
    }
  }

  // 1. Try PMC first (best quality, structured XML)
  if (pmid) {
    const pmcResult = await tryPMC(pmid);
    if (pmcResult?.fullText) {
      logger.info('Found full text in PMC', { pmid, chars: pmcResult.fullText.length });
      return { source: 'pmc', pmid, ...pmcResult };
    }
  }

  // 2. Try Unpaywall (finds OA versions via DOI)
  if (doi) {
    const unpaywallResult = await tryUnpaywall(doi, email);
    if (unpaywallResult?.fullText) {
      logger.info('Found full text via Unpaywall', { doi, chars: unpaywallResult.fullText.length });
      return { source: 'unpaywall', pmid, ...unpaywallResult };
    }
  }

  // 3. Try Europe PMC
  if (pmid) {
    const europeResult = await tryEuropePMC(pmid);
    if (europeResult?.fullText) {
      logger.info('Found full text in Europe PMC', { pmid, chars: europeResult.fullText.length });
      return { source: 'europepmc', pmid, ...europeResult };
    }
  }

  // 4. Fall back to abstract only
  if (pmid) {
    const abstract = await fetchPubMedAbstract(pmid);
    if (abstract) {
      logger.info('Falling back to abstract only', { pmid, chars: abstract.length });
      return { source: 'abstract', fullText: null, abstract, pmid };
    }
  }

  logger.warn('No content found', { pmid, doi });
  return null;
}

/**
 * Resolve DOI to PubMed ID using NCBI ID Converter
 */
async function resolveDOItoPMID(doi) {
  try {
    // Try NCBI ID Converter API
    const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?ids=${encodeURIComponent(doi)}&format=json`;
    const resp = await rateLimitedFetch(url);
    const data = await resp.json();

    const record = data.records?.[0];
    if (record?.pmid) {
      return record.pmid;
    }

    // Try ESearch as fallback
    const searchUrl = `${EUTILS_BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}[doi]&retmode=json`;
    const searchResp = await rateLimitedFetch(searchUrl);
    const searchData = await searchResp.json();

    if (searchData.esearchresult?.idlist?.length > 0) {
      return searchData.esearchresult.idlist[0];
    }

    return null;
  } catch (error) {
    logger.debug('DOI to PMID resolution failed', { doi, error: error.message });
    return null;
  }
}

/**
 * Try to fetch from PubMed Central
 */
async function tryPMC(pmid) {
  try {
    // First check if article is in PMC
    const linkUrl = `${EUTILS_BASE}/elink.fcgi?dbfrom=pubmed&db=pmc&id=${pmid}&retmode=json`;
    const linkResp = await rateLimitedFetch(linkUrl);
    const linkData = await linkResp.json();

    const pmcLinks = linkData.linksets?.[0]?.linksetdbs?.find(db => db.dbto === 'pmc');
    if (!pmcLinks?.links?.length) {
      logger.debug('Article not in PMC', { pmid });
      return null;
    }

    const pmcid = pmcLinks.links[0];
    logger.debug('Found PMCID', { pmid, pmcid });

    // Fetch full text XML from PMC OAI service
    const fullTextUrl = `https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${pmcid}&metadataPrefix=pmc`;
    const fullTextResp = await rateLimitedFetch(fullTextUrl);
    const xml = await fullTextResp.text();

    if (!xml.includes('<body') && !xml.includes('<abstract')) {
      // Try alternative PMC fetch method
      const altUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pmc&id=${pmcid}&rettype=full&retmode=xml`;
      const altResp = await rateLimitedFetch(altUrl);
      const altXml = await altResp.text();

      if (altXml.includes('<body') || altXml.includes('<abstract')) {
        return parsePMCXML(altXml, pmcid);
      }
    }

    return parsePMCXML(xml, pmcid);
  } catch (error) {
    logger.debug('PMC fetch failed', { pmid, error: error.message });
    return null;
  }
}

function parsePMCXML(xml, pmcid) {
  const abstract = extractAbstractFromXML(xml);
  const fullText = extractBodyFromXML(xml);
  const sections = extractSectionsFromXML(xml);

  if (!fullText && !abstract) {
    return null;
  }

  return {
    pmcid: `PMC${pmcid}`,
    fullText,
    abstract,
    sections,
  };
}

/**
 * Try Unpaywall API to find open access version
 */
async function tryUnpaywall(doi, email) {
  try {
    const url = `${UNPAYWALL_BASE}/${encodeURIComponent(doi)}?email=${email}`;
    const resp = await fetch(url);

    if (!resp.ok) {
      logger.debug('Unpaywall returned non-OK', { doi, status: resp.status });
      return null;
    }

    const data = await resp.json();
    const bestOA = data.best_oa_location;

    if (!bestOA) {
      logger.debug('No OA location found', { doi });
      return null;
    }

    // If we have a URL for landing page, we could potentially scrape
    // For now, just note we found OA but can't get full text without PDF parsing
    logger.debug('Found OA location', {
      doi,
      host: bestOA.host_type,
      hasPdf: !!bestOA.url_for_pdf
    });

    // PDF parsing would require additional dependencies
    // For now, return null and fall back to abstract
    return null;

  } catch (error) {
    logger.debug('Unpaywall fetch failed', { doi, error: error.message });
    return null;
  }
}

/**
 * Try Europe PMC
 */
async function tryEuropePMC(pmid) {
  try {
    const searchUrl = `${EUROPEPMC_BASE}/search?query=EXT_ID:${pmid}&resultType=core&format=json`;
    const searchResp = await fetch(searchUrl);
    const searchData = await searchResp.json();

    const result = searchData.resultList?.result?.[0];
    if (!result) {
      logger.debug('Not found in Europe PMC', { pmid });
      return null;
    }

    // Check if full text is available
    if (result.isOpenAccess !== 'Y' && !result.inEPMC === 'Y') {
      logger.debug('Not open access in Europe PMC', { pmid });
      return { fullText: null, abstract: result.abstractText };
    }

    // Try to fetch full text XML
    const fullTextUrl = `${EUROPEPMC_BASE}/${result.source}/${result.id}/fullTextXML`;
    const fullTextResp = await fetch(fullTextUrl);

    if (!fullTextResp.ok) {
      return { fullText: null, abstract: result.abstractText };
    }

    const xml = await fullTextResp.text();
    const fullText = extractBodyFromXML(xml);

    return {
      fullText,
      abstract: result.abstractText,
    };
  } catch (error) {
    logger.debug('Europe PMC fetch failed', { pmid, error: error.message });
    return null;
  }
}

/**
 * Fetch abstract from PubMed
 */
export async function fetchPubMedAbstract(pmid) {
  try {
    const url = `${EUTILS_BASE}/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=xml`;
    const response = await rateLimitedFetch(url);
    const xml = await response.text();

    return extractAbstractFromPubMedXML(xml);
  } catch (error) {
    logger.debug('PubMed abstract fetch failed', { pmid, error: error.message });
    return null;
  }
}

/**
 * Fetch metadata from PubMed including MeSH terms
 */
export async function fetchPubMedMetadata(pmid) {
  try {
    const url = `${EUTILS_BASE}/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;
    const response = await rateLimitedFetch(url);
    const xml = await response.text();

    return {
      abstract: extractAbstractFromPubMedXML(xml),
      meshTerms: extractMeshTerms(xml),
      keywords: extractKeywords(xml),
      publicationType: extractPublicationType(xml),
    };
  } catch (error) {
    logger.debug('PubMed metadata fetch failed', { pmid, error: error.message });
    return null;
  }
}

// XML parsing helpers

function extractAbstractFromPubMedXML(xml) {
  const abstractParts = [];
  const regex = /<AbstractText[^>]*(?:Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const label = match[1];
    const text = stripTags(match[2]).trim();
    if (label) {
      abstractParts.push(`${label}: ${text}`);
    } else {
      abstractParts.push(text);
    }
  }

  return abstractParts.length > 0 ? abstractParts.join(' ') : null;
}

function extractAbstractFromXML(xml) {
  // Try JATS/PMC format
  const abstractMatch = xml.match(/<abstract[^>]*>([\s\S]*?)<\/abstract>/i);
  if (abstractMatch) {
    return stripTags(abstractMatch[1]).trim();
  }
  return null;
}

function extractBodyFromXML(xml) {
  // Extract body text from JATS XML
  const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) return null;

  let text = bodyMatch[1];

  // Remove figures, tables, and their captions
  text = text.replace(/<fig[^>]*>[\s\S]*?<\/fig>/gi, '');
  text = text.replace(/<table-wrap[^>]*>[\s\S]*?<\/table-wrap>/gi, '');

  // Strip remaining tags and normalize whitespace
  text = stripTags(text);
  text = text.replace(/\s+/g, ' ').trim();

  return text.length > 100 ? text : null;
}

function extractSectionsFromXML(xml) {
  const sections = {};

  // Methods/Materials
  const methodsPatterns = [
    /<sec[^>]*sec-type="methods"[^>]*>([\s\S]*?)<\/sec>/i,
    /<sec[^>]*sec-type="materials\|methods"[^>]*>([\s\S]*?)<\/sec>/i,
    /<sec[^>]*>[\s\S]*?<title[^>]*>\s*(?:Methods|Materials and Methods|Patients and Methods)\s*<\/title>([\s\S]*?)<\/sec>/i,
  ];

  for (const pattern of methodsPatterns) {
    const match = xml.match(pattern);
    if (match) {
      sections.methods = stripTags(match[1]).substring(0, 3000);
      break;
    }
  }

  // Results
  const resultsMatch = xml.match(/<sec[^>]*sec-type="results"[^>]*>([\s\S]*?)<\/sec>/i) ||
                       xml.match(/<sec[^>]*>[\s\S]*?<title[^>]*>\s*Results\s*<\/title>([\s\S]*?)<\/sec>/i);
  if (resultsMatch) {
    sections.results = stripTags(resultsMatch[1]).substring(0, 5000);
  }

  // Discussion/Conclusions
  const conclusionsMatch = xml.match(/<sec[^>]*sec-type="(?:conclusions|discussion)"[^>]*>([\s\S]*?)<\/sec>/i) ||
                           xml.match(/<sec[^>]*>[\s\S]*?<title[^>]*>\s*(?:Conclusions?|Discussion)\s*<\/title>([\s\S]*?)<\/sec>/i);
  if (conclusionsMatch) {
    sections.conclusions = stripTags(conclusionsMatch[1]).substring(0, 2000);
  }

  return Object.keys(sections).length > 0 ? sections : null;
}

function extractMeshTerms(xml) {
  const terms = [];
  const regex = /<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    terms.push(stripTags(match[1]).trim());
  }

  return terms;
}

function extractKeywords(xml) {
  const keywords = [];
  const regex = /<Keyword[^>]*>([\s\S]*?)<\/Keyword>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    keywords.push(stripTags(match[1]).trim());
  }

  return keywords;
}

function extractPublicationType(xml) {
  const types = [];
  const regex = /<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    types.push(stripTags(match[1]).trim());
  }

  return types;
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export default {
  fetchFullText,
  fetchPubMedAbstract,
  fetchPubMedMetadata,
};
