/**
 * Conference Abstract Crawler
 *
 * Searches ASCO and ESMO conference abstract databases for MRD/ctDNA-relevant
 * abstracts. These are high-value early signals — conference presentations
 * often precede journal publication by months.
 *
 * Flow:
 * 1. Query mrd_sources for conference-type sources
 * 2. Fetch abstract search results (via Playwright for JS-rendered pages)
 * 3. Extract structured abstract data using Claude
 * 4. Resolve published abstracts to PubMed
 * 5. Write to physician DB with evidence_type='conference_abstract'
 * 6. Bridge new findings to proposals
 */

import Anthropic from '@anthropic-ai/sdk';
import { createHttpClient } from '../../utils/http.js';
import { createLogger } from '../../utils/logger.js';
import { query } from '../../db/mrd-client.js';
import { resolvePublication } from '../publication-resolver.js';
import {
  writePublicationToPhysicianDb,
  writeSourceItemEdge,
  isPhysicianDbConfigured,
} from '../physician-db-writer.js';
import { bridgeToProposals } from '../publication-bridge.js';
import { getPromptForSourceType } from '../publication-prompts.js';

const logger = createLogger('conference-abstracts');

const http = createHttpClient('conference', { rateLimitMs: 6000 }); // ~10 req/min

// Lazy-init Claude client
let anthropic = null;
function getAnthropic() {
  if (!anthropic) {
    anthropic = new Anthropic();
  }
  return anthropic;
}

// Search terms for finding MRD/ctDNA abstracts
const SEARCH_TERMS = [
  'ctDNA',
  'circulating tumor DNA',
  'liquid biopsy',
  'minimal residual disease',
  'molecular residual disease',
  'MRD',
];

// Conference-specific configurations
const CONFERENCE_CONFIGS = {
  'asco-annual-meeting': {
    name: 'ASCO Annual Meeting',
    searchUrl: 'https://meetings.asco.org/abstracts-presentations/search',
    // ASCO search uses query params
    buildSearchUrl: (term) =>
      `https://meetings.asco.org/abstracts-presentations/search?q=${encodeURIComponent(term)}&filters=`,
    accessMethod: 'scrape',
  },
  'esmo-congress': {
    name: 'ESMO Congress',
    searchUrl: 'https://oncologypro.esmo.org/meeting-resources',
    buildSearchUrl: (term) =>
      `https://oncologypro.esmo.org/meeting-resources?q=${encodeURIComponent(term)}`,
    accessMethod: 'scrape',
  },
};

/**
 * Get active conference sources from mrd_sources
 * @param {string|null} sourceKey - Optional specific source to fetch
 * @returns {Promise<Object[]>}
 */
async function getConferenceSources(sourceKey = null) {
  let sql = `
    SELECT id, source_key, source_type, display_name, base_url,
           last_checked_at, stale_threshold_days
    FROM mrd_sources
    WHERE is_active = true
      AND source_type = 'conference'
  `;
  const params = [];

  if (sourceKey) {
    sql += ' AND source_key = $1';
    params.push(sourceKey);
  }

  sql += ' ORDER BY last_checked_at ASC NULLS FIRST';

  const result = await query(sql, params);
  return result.rows;
}

/**
 * Check if an abstract has already been processed
 * @param {string} abstractKey - Unique abstract identifier
 * @returns {Promise<boolean>}
 */
async function isAbstractProcessed(abstractKey) {
  const result = await query(
    `SELECT 1 FROM mrd_discovery_queue
     WHERE source_type = 'conference_abstract'
       AND source_id = $1
     LIMIT 1`,
    [abstractKey]
  );
  return result.rows.length > 0;
}

/**
 * Record a processed abstract for dedup
 */
async function recordProcessedAbstract(abstractKey, metadata) {
  await query(
    `INSERT INTO mrd_discovery_queue (
       source_type, source_id, source_url, raw_data,
       status, priority, discovered_at
     ) VALUES ($1, $2, $3, $4, 'processed', 3, NOW())
     ON CONFLICT (source_type, source_id) DO NOTHING`,
    [
      'conference_abstract',
      abstractKey,
      metadata.url || null,
      JSON.stringify(metadata),
    ]
  );
}

/**
 * Fetch conference abstract search results as HTML
 * Uses HTTP GET — if the page requires JavaScript rendering, this will
 * return limited content. For JS-heavy sites, extend with Playwright.
 *
 * @param {string} url - Search URL
 * @returns {Promise<string|null>} Page HTML or null
 */
async function fetchSearchPage(url) {
  try {
    const html = await http.getText(url);
    return html;
  } catch (error) {
    logger.warn('Failed to fetch search page', { url, error: error.message });
    return null;
  }
}

/**
 * Extract conference abstracts from search results using Claude
 *
 * @param {string} content - Page HTML/text content
 * @param {Object} conference - Conference config
 * @param {string} searchTerm - The term used to search
 * @returns {Promise<Object[]>} Extracted abstracts
 */
async function extractAbstracts(content, conference, searchTerm) {
  const client = getAnthropic();

  // Truncate content for Claude context limits
  const maxContentLength = 40000;
  const truncatedContent = content.length > maxContentLength
    ? content.substring(0, maxContentLength) + '\n\n[Content truncated...]'
    : content;

  const prompt = getPromptForSourceType('conference');

  const fullPrompt = `${prompt}

Conference: ${conference.name}
Search term used: "${searchTerm}"

Page content:
---
${truncatedContent}
---

Extract all conference abstracts found on this page. Return as JSON.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: fullPrompt }],
    });

    const text = response.content[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.publications || parsed.abstracts || [];
  } catch (error) {
    logger.error('Claude extraction failed', { error: error.message });
    return [];
  }
}

/**
 * Process a single extracted abstract
 *
 * @param {Object} abstract - Extracted abstract data
 * @param {Object} source - Source row from mrd_sources
 * @param {string} conferenceName - Conference name
 * @param {Object} options - Processing options
 * @returns {Promise<Object|null>}
 */
async function processAbstract(abstract, source, conferenceName, options = {}) {
  const { dryRun = false } = options;

  // Build unique key for dedup
  const abstractKey = abstract.abstract_number
    ? `${source.source_key}:${abstract.abstract_number}`
    : `${source.source_key}:${(abstract.title || '').substring(0, 80)}`;

  // Check if already processed
  if (!dryRun) {
    const alreadyProcessed = await isAbstractProcessed(abstractKey);
    if (alreadyProcessed) {
      return { skipped: true, reason: 'already_processed' };
    }
  }

  // Try to resolve to PubMed (many abstracts get published)
  let resolvedPub = null;
  if (abstract.doi || abstract.title) {
    try {
      const resolved = await resolvePublication({
        doi: abstract.doi,
        title: abstract.title,
        firstAuthor: abstract.authors?.split(' ')[0],
      });

      if (resolved && resolved.length > 0) {
        resolvedPub = resolved[0];
        logger.debug('Abstract resolved to PubMed', {
          abstractTitle: abstract.title?.substring(0, 50),
          pmid: resolvedPub.pmid,
        });
      }
    } catch (error) {
      logger.debug('PubMed resolution failed for abstract', { error: error.message });
    }
  }

  // Build publication object
  const pubToWrite = {
    title: resolvedPub?.title || abstract.title,
    authors: resolvedPub?.authors || abstract.authors || null,
    journal: resolvedPub?.journal || conferenceName,
    year: resolvedPub?.publicationDate?.substring(0, 4) || abstract.year || null,
    publicationDate: resolvedPub?.publicationDate || (abstract.year ? `${abstract.year}-01-01` : null),
    doi: resolvedPub?.doi || abstract.doi || null,
    pmid: resolvedPub?.pmid || null,
    abstract: resolvedPub?.abstract || abstract.abstract_text || abstract.clinical_context || null,
    sourceUrl: resolvedPub?.sourceUrl || abstract.url || source.base_url,
    evidence_type: resolvedPub ? (abstract.evidence_type || 'observational') : 'conference_abstract',
    cancer_types: abstract.cancer_types || [],
    clinical_context: abstract.clinical_context || abstract.conclusions || null,
  };

  if (dryRun) {
    logger.info('Would write abstract (dry run)', {
      title: pubToWrite.title?.substring(0, 60),
      conference: conferenceName,
      abstractNumber: abstract.abstract_number,
      pmid: pubToWrite.pmid,
    });
    return { dryRun: true, pmid: pubToWrite.pmid, resolved: !!resolvedPub };
  }

  // Write to physician DB
  try {
    const writeResult = await writePublicationToPhysicianDb(pubToWrite, {
      discoveredVia: `conference:${source.source_key}`,
      sourceUrl: abstract.url || source.base_url,
    });

    if (writeResult.isNew) {
      // Create provenance edge
      try {
        await writeSourceItemEdge(source.id, writeResult.id, {
          extractionMethod: 'claude-conference-extraction',
          confidence: pubToWrite.pmid ? 0.9 : 0.65,
        });
      } catch (edgeError) {
        logger.debug('Edge creation failed (non-fatal)', { error: edgeError.message });
      }

      // Bridge to proposals
      try {
        await bridgeToProposals(pubToWrite, source);
      } catch (bridgeError) {
        logger.debug('Publication bridge failed (non-fatal)', { error: bridgeError.message });
      }
    }

    // Record for dedup
    await recordProcessedAbstract(abstractKey, {
      title: abstract.title,
      abstract_number: abstract.abstract_number,
      conference: conferenceName,
      presentation_type: abstract.presentation_type,
      pmid: pubToWrite.pmid,
      doi: pubToWrite.doi,
      url: abstract.url,
    });

    return { ...writeResult, resolved: !!resolvedPub };
  } catch (error) {
    logger.error('Failed to write abstract', {
      title: pubToWrite.title?.substring(0, 50),
      error: error.message,
    });
    return null;
  }
}

/**
 * Crawl conference abstract databases for MRD-relevant content
 *
 * @param {Object} options - Crawl options
 * @param {boolean} options.dryRun - Extract but don't write
 * @param {string} options.sourceKey - Crawl specific conference only
 * @returns {Promise<Object>} { success, stats }
 */
export async function crawlConferenceAbstracts(options = {}) {
  const { dryRun = false, sourceKey = null } = options;

  logger.info('Starting conference abstract crawler', { dryRun, sourceKey });

  const stats = {
    sources: 0,
    searchesPerformed: 0,
    abstractsFound: 0,
    relevant: 0,
    alreadyProcessed: 0,
    resolved: 0,
    written: 0,
    newItems: 0,
    failed: 0,
  };

  // Get conference sources from DB
  const sources = await getConferenceSources(sourceKey);

  if (sources.length === 0) {
    logger.warn('No active conference sources found in mrd_sources');
    return { success: true, stats };
  }

  if (!isPhysicianDbConfigured() && !dryRun) {
    logger.warn('Physician DB not configured - will extract but not write');
  }

  for (const source of sources) {
    const config = CONFERENCE_CONFIGS[source.source_key];

    if (!config) {
      logger.warn('No configuration found for conference source', {
        sourceKey: source.source_key,
      });
      // Still attempt with base_url as search endpoint
    }

    const conferenceName = config?.name || source.display_name;

    logger.info('Processing conference', {
      sourceKey: source.source_key,
      name: conferenceName,
    });

    stats.sources++;

    // Search for each term
    const allAbstracts = new Map(); // dedup by title

    for (const term of SEARCH_TERMS) {
      const searchUrl = config?.buildSearchUrl
        ? config.buildSearchUrl(term)
        : `${source.base_url}?q=${encodeURIComponent(term)}`;

      logger.debug('Searching conference abstracts', { term, url: searchUrl });
      stats.searchesPerformed++;

      const pageContent = await fetchSearchPage(searchUrl);
      if (!pageContent) {
        logger.debug('No content returned for search', { term });
        continue;
      }

      // Extract abstracts using Claude
      const abstracts = await extractAbstracts(pageContent, { name: conferenceName }, term);
      stats.abstractsFound += abstracts.length;

      // Dedup across search terms by title
      for (const abs of abstracts) {
        const key = abs.abstract_number || abs.title?.substring(0, 80) || '';
        if (key && !allAbstracts.has(key)) {
          allAbstracts.set(key, abs);
        }
      }

      // Rate limiting between searches
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    stats.relevant += allAbstracts.size;
    logger.info('Unique abstracts after dedup', {
      sourceKey: source.source_key,
      count: allAbstracts.size,
    });

    // Process each unique abstract
    for (const abstract of allAbstracts.values()) {
      const result = await processAbstract(abstract, source, conferenceName, { dryRun });

      if (result) {
        if (result.skipped) {
          stats.alreadyProcessed++;
        } else {
          stats.written++;
          if (result.isNew) stats.newItems++;
          if (result.resolved || result.pmid) stats.resolved++;
        }
      } else {
        stats.failed++;
      }
    }

    // Update source timestamp
    if (!dryRun) {
      await query(
        'UPDATE mrd_sources SET last_checked_at = NOW() WHERE id = $1',
        [source.id]
      );
    }

    // Rate limiting between conferences
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  logger.info('Conference abstract crawl complete', { stats });
  return { success: true, stats };
}

export default { crawlConferenceAbstracts };
