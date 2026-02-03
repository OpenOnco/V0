/**
 * Publication Index Crawler
 *
 * Purpose-built crawler for extracting publications from vendor evidence pages
 * and society sources. Reads crawl targets from mrd_sources table, extracts
 * publication citations via Claude, resolves to PubMed, and writes to
 * physician-system database.
 *
 * Flow:
 * 1. Query mrd_sources WHERE is_active = true AND source_type IN (vendor, guideline, news)
 * 2. For each source:
 *    a. Fetch page content (Playwright or HTTP)
 *    b. Check hash - skip if unchanged
 *    c. Extract publications via Claude (using appropriate prompt)
 *    d. For each publication:
 *       - Search PubMed by DOI/title/author (publication-resolver.js)
 *       - If found: use PubMed metadata + abstract
 *       - If not: use extracted metadata as-is
 *       - Write to mrd_guidance_items (physician-db-writer.js)
 *       - Write source-item edge
 *       - Set interpretation_guardrail if applicable
 *    e. Update source.last_checked_at
 * 3. Return stats: sources_crawled, publications_found, new_items, resolved_to_pubmed
 */

// Import shared modules from test-data-tracker
import { PlaywrightCrawler } from '../../test-data-tracker/src/crawlers/playwright-base.js';
import { resolvePublication } from '../../test-data-tracker/src/crawlers/publication-resolver.js';
import {
  writePublicationToPhysicianDb,
  writeSourceItemEdge,
  setInterpretationGuardrail,
  isPhysicianDbConfigured,
} from '../../test-data-tracker/src/crawlers/physician-db-writer.js';
import { query } from '../../test-data-tracker/src/db/mrd-client.js';
import { createLogger } from '../../test-data-tracker/src/utils/logger.js';

// Local modules
import {
  getPromptForSourceType,
  getGuardrailForSourceType,
  formatContentForPrompt,
} from './prompts.js';

const logger = createLogger('publication-index');

// Source types we process for publication extraction
const PUBLICATION_SOURCE_TYPES = ['vendor', 'guideline', 'news', 'society'];

export class PublicationIndexCrawler extends PlaywrightCrawler {
  constructor(options = {}) {
    super({
      source: 'publication-index',
      name: 'Publication Index Crawler',
      ...options,
    });

    this.dryRun = options.dryRun || false;
    this.sourceFilter = options.sourceKey || null;
  }

  /**
   * Main crawl entry point
   * @returns {Promise<Object>} Crawl results
   */
  async crawl() {
    const startTime = Date.now();
    const stats = {
      sources_crawled: 0,
      sources_skipped: 0,
      sources_failed: 0,
      publications_found: 0,
      new_items: 0,
      updated_items: 0,
      resolved_to_pubmed: 0,
      guardrails_set: 0,
    };

    try {
      // Load hashes for change detection
      await this.loadHashes();

      // Get active sources from database
      const sources = await this.getActiveSources();
      logger.info(`Found ${sources.length} active publication sources`);

      if (sources.length === 0) {
        return {
          success: true,
          stats,
          message: 'No active publication sources configured',
        };
      }

      // Process each source
      for (const source of sources) {
        try {
          const result = await this.processSource(source);
          stats.sources_crawled++;
          stats.publications_found += result.publicationsFound;
          stats.new_items += result.newItems;
          stats.updated_items += result.updatedItems;
          stats.resolved_to_pubmed += result.resolvedToPubmed;
          stats.guardrails_set += result.guardrailsSet;

          if (result.skipped) {
            stats.sources_skipped++;
            stats.sources_crawled--;
          }
        } catch (error) {
          stats.sources_failed++;
          logger.error(`Failed to process source ${source.source_key}`, {
            error: error.message,
          });
        }

        // Rate limiting between sources
        await this.sleep(this.rateLimitMs);
      }

      // Save updated hashes
      await this.saveHashes();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`Publication index crawl complete in ${duration}s`, { stats });

      return {
        success: true,
        stats,
        duration: parseFloat(duration),
      };
    } catch (error) {
      logger.error('Publication index crawl failed', { error: error.message });
      return {
        success: false,
        error: error.message,
        stats,
      };
    } finally {
      await this.closeBrowser();
      this.closeHashStore();
    }
  }

  /**
   * Get active sources from mrd_sources table
   * @returns {Promise<Array>} Array of source objects
   */
  async getActiveSources() {
    let queryText = `
      SELECT id, source_key, source_type, display_name, base_url,
             access_method, change_detector, last_checked_at
      FROM mrd_sources
      WHERE is_active = TRUE
        AND source_type = ANY($1)
    `;
    const params = [PUBLICATION_SOURCE_TYPES];

    // Filter by specific source if provided
    if (this.sourceFilter) {
      queryText += ' AND source_key = $2';
      params.push(this.sourceFilter);
    }

    queryText += ' ORDER BY last_checked_at ASC NULLS FIRST';

    const result = await query(queryText, params);
    return result.rows;
  }

  /**
   * Process a single source
   * @param {Object} source - Source record from mrd_sources
   * @returns {Promise<Object>} Processing results
   */
  async processSource(source) {
    const result = {
      publicationsFound: 0,
      newItems: 0,
      updatedItems: 0,
      resolvedToPubmed: 0,
      guardrailsSet: 0,
      skipped: false,
    };

    logger.info(`Processing source: ${source.display_name}`, {
      sourceKey: source.source_key,
      sourceType: source.source_type,
    });

    if (!source.base_url) {
      logger.warn(`Source ${source.source_key} has no base_url configured`);
      result.skipped = true;
      // Still update last_checked_at to prevent retrying every run
      await this.updateSourceCheckedAt(source.id);
      return result;
    }

    // Fetch page content
    let pageData;
    try {
      pageData = await this.fetchPage(source.base_url, {
        extractHeadlines: false,
      });
    } catch (error) {
      logger.error(`Failed to fetch ${source.base_url}`, { error: error.message });
      this.recordPageFailure(source.base_url, source.source_key, error);
      throw error;
    }

    this.recordPageSuccess(source.base_url, source.source_key);

    // Check for changes using hash
    const hashKey = `pubindex:${source.source_key}`;
    const changeResult = this.detectChange(source.base_url, pageData.content, hashKey);

    if (!changeResult.hasChanged && !changeResult.isFirstCrawl) {
      logger.debug(`No changes detected for ${source.source_key}, skipping extraction`);
      result.skipped = true;

      // Still update last_checked_at
      await this.updateSourceCheckedAt(source.id);
      return result;
    }

    // Extract publications via Claude
    const publications = await this.extractPublications(
      pageData.content,
      source.source_type
    );

    result.publicationsFound = publications.length;
    logger.info(`Extracted ${publications.length} publications from ${source.source_key}`);

    if (publications.length === 0) {
      // Store hash even if no publications found
      this.storeHash(hashKey, changeResult.newHash, pageData.content);
      await this.updateSourceCheckedAt(source.id);
      return result;
    }

    // Process each publication
    const guardrail = getGuardrailForSourceType(source.source_type);

    for (const pub of publications) {
      try {
        const writeResult = await this.processSinglePublication(
          pub,
          source,
          guardrail
        );

        if (writeResult.isNew) {
          result.newItems++;
        } else if (writeResult.updated) {
          result.updatedItems++;
        }

        if (writeResult.resolvedToPubmed) {
          result.resolvedToPubmed++;
        }

        if (writeResult.guardrailSet) {
          result.guardrailsSet++;
        }
      } catch (error) {
        logger.warn(`Failed to process publication: ${pub.title?.substring(0, 50)}`, {
          error: error.message,
        });
      }
    }

    // Store updated hash and update source
    this.storeHash(hashKey, changeResult.newHash, pageData.content);
    await this.updateSourceCheckedAt(source.id);

    return result;
  }

  /**
   * Extract publications from page content using Claude
   * @param {string} content - Page content
   * @param {string} sourceType - Type of source (vendor, guideline, etc.)
   * @returns {Promise<Array>} Extracted publications
   */
  async extractPublications(content, sourceType) {
    if (!this.anthropic) {
      logger.warn('Claude API not configured, skipping extraction');
      return [];
    }

    // Get appropriate prompt for source type
    const promptTemplate = getPromptForSourceType(sourceType);
    const formattedContent = formatContentForPrompt(content);
    const prompt = promptTemplate.replace('{content}', formattedContent);

    try {
      // Call Claude directly to handle array responses
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = response.content[0]?.text?.trim();
      if (!responseText) {
        return [];
      }

      // Parse JSON - handle arrays, objects with publications, and markdown code fences
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      // Try to find JSON array or object
      const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
      const objectMatch = jsonText.match(/\{[\s\S]*\}/);

      let publications;
      if (arrayMatch) {
        publications = JSON.parse(arrayMatch[0]);
      } else if (objectMatch) {
        const obj = JSON.parse(objectMatch[0]);
        publications = obj.publications || [obj];
      } else {
        logger.warn('Claude response did not contain valid JSON array or object');
        return [];
      }

      if (!Array.isArray(publications)) {
        publications = [publications];
      }

      // Validate and clean extracted publications
      return publications
        .filter((pub) => pub && pub.title)
        .map((pub) => ({
          title: pub.title?.trim(),
          authors: pub.authors?.trim() || null,
          journal: pub.journal?.trim() || null,
          year: pub.year ? parseInt(pub.year, 10) : null,
          doi: this.cleanDoi(pub.doi),
          pmid: this.cleanPmid(pub.pmid),
          url: pub.url || null,
          evidence_type: pub.evidence_type || 'observational',
          cancer_types: Array.isArray(pub.cancer_types) ? pub.cancer_types : [],
          clinical_context: pub.clinical_context?.trim() || null,
        }));
    } catch (error) {
      logger.error('Claude extraction failed', { error: error.message });
      return [];
    }
  }

  /**
   * Process a single extracted publication
   * @param {Object} pub - Extracted publication data
   * @param {Object} source - Source record
   * @param {string|null} guardrail - Interpretation guardrail text
   * @returns {Promise<Object>} Processing result
   */
  async processSinglePublication(pub, source, guardrail) {
    const result = {
      isNew: false,
      updated: false,
      resolvedToPubmed: false,
      guardrailSet: false,
      guidanceId: null,
    };

    if (this.dryRun) {
      logger.debug('DRY RUN: Would process publication', {
        title: pub.title?.substring(0, 50),
        doi: pub.doi,
        pmid: pub.pmid,
      });
      return result;
    }

    if (!isPhysicianDbConfigured()) {
      logger.debug('Physician DB not configured, skipping write');
      return result;
    }

    // Try to resolve to PubMed for richer metadata
    let enrichedPub = pub;
    if (pub.doi || pub.pmid || pub.title) {
      try {
        const resolved = await resolvePublication({
          doi: pub.doi,
          pmid: pub.pmid,
          title: pub.title,
          firstAuthor: pub.authors?.split(' ')[0],
          journal: pub.journal,
        });

        if (resolved && resolved.length > 0) {
          // Merge PubMed data with extracted data
          const pubmedData = resolved[0];
          enrichedPub = {
            ...pub,
            title: pubmedData.title || pub.title,
            pmid: pubmedData.pmid || pub.pmid,
            doi: pubmedData.doi || pub.doi,
            journal: pubmedData.journal || pub.journal,
            abstract: pubmedData.abstract,
            authors: pubmedData.authors
              ? pubmedData.authors.map((a) => a.name).join(', ')
              : pub.authors,
            publicationDate: pubmedData.publicationDate,
            sourceUrl: pubmedData.sourceUrl,
          };
          result.resolvedToPubmed = true;
        }
      } catch (error) {
        logger.debug(`PubMed resolution failed for: ${pub.title?.substring(0, 40)}`, {
          error: error.message,
        });
        // Continue with extracted data
      }
    }

    // Write to physician DB
    try {
      const writeResult = await writePublicationToPhysicianDb(enrichedPub, {
        discoveredVia: `publication-index:${source.source_key}`,
        sourceUrl: source.base_url,
      });

      result.isNew = writeResult.isNew;
      result.updated = !writeResult.isNew;
      result.guidanceId = writeResult.id;

      // Create source-item edge
      if (writeResult.id) {
        await writeSourceItemEdge(source.id, writeResult.id, {
          extractionMethod: 'claude',
          confidence: result.resolvedToPubmed ? 0.95 : 0.75,
        });
      }

      // Set interpretation guardrail if applicable
      if (guardrail && writeResult.id && writeResult.isNew) {
        await setInterpretationGuardrail(writeResult.id, guardrail);
        result.guardrailSet = true;
      }
    } catch (error) {
      logger.error('Failed to write publication to DB', {
        title: pub.title?.substring(0, 50),
        error: error.message,
      });
      throw error;
    }

    return result;
  }

  /**
   * Update source's last_checked_at timestamp
   * @param {number} sourceId - Source ID
   */
  async updateSourceCheckedAt(sourceId) {
    if (this.dryRun) return;

    try {
      await query(
        'UPDATE mrd_sources SET last_checked_at = NOW() WHERE id = $1',
        [sourceId]
      );
    } catch (error) {
      logger.warn(`Failed to update last_checked_at for source ${sourceId}`, {
        error: error.message,
      });
    }
  }

  /**
   * Clean and validate DOI
   * @param {string} doi - Raw DOI
   * @returns {string|null} Cleaned DOI or null
   */
  cleanDoi(doi) {
    if (!doi) return null;

    // Extract DOI from various formats
    const match = doi.match(/10\.\d{4,}\/[^\s]+/);
    return match ? match[0].replace(/[.,;]$/, '') : null;
  }

  /**
   * Clean and validate PMID
   * @param {string|number} pmid - Raw PMID
   * @returns {string|null} Cleaned PMID or null
   */
  cleanPmid(pmid) {
    if (!pmid) return null;

    const cleaned = String(pmid).replace(/\D/g, '');
    return cleaned.length > 0 ? cleaned : null;
  }

  /**
   * Get crawler status
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      ...super.getStatus(),
      source: 'publication-index',
      sourceFilter: this.sourceFilter,
      dryRun: this.dryRun,
    };
  }
}

/**
 * Run the publication index crawler
 * @param {Object} options - Crawler options
 * @returns {Promise<Object>} Crawl results
 */
export async function runPublicationIndexCrawler(options = {}) {
  const crawler = new PublicationIndexCrawler(options);
  return crawler.crawl();
}

/**
 * Get status of active publication sources
 * @returns {Promise<Object>} Source status summary
 */
export async function getPublicationSourceStatus() {
  const result = await query(`
    SELECT
      source_key,
      display_name,
      source_type,
      last_checked_at,
      last_release_at,
      EXTRACT(DAYS FROM NOW() - COALESCE(last_checked_at, created_at))::INTEGER as days_since_check
    FROM mrd_sources
    WHERE is_active = TRUE
      AND source_type = ANY($1)
    ORDER BY last_checked_at ASC NULLS FIRST
  `, [PUBLICATION_SOURCE_TYPES]);

  return {
    sources: result.rows,
    total: result.rows.length,
    needsCheck: result.rows.filter((s) => s.days_since_check > 7).length,
  };
}

export default {
  PublicationIndexCrawler,
  runPublicationIndexCrawler,
  getPublicationSourceStatus,
};
