/**
 * Publication Index Crawler
 *
 * Purpose-built crawler for extracting publications from vendor evidence pages
 * and society sources. Extracts citations, resolves to PubMed, and writes to
 * physician-system database with provenance tracking.
 *
 * Flow:
 * 1. Read crawl targets from mrd_sources table (where is_active = true)
 * 2. Fetch page content using Playwright
 * 3. Extract publications via Claude using source-type-specific prompts
 * 4. Resolve to PubMed via publication-resolver.js
 * 5. Write to physician-system DB via physician-db-writer.js
 * 6. Track source→publication edges for provenance
 */

import { PlaywrightCrawler } from './playwright-base.js';
import { query } from '../db/mrd-client.js';
import { resolvePublication } from './publication-resolver.js';
import {
  writePublicationToPhysicianDb,
  writeSourceItemEdge,
  setInterpretationGuardrail,
  isPhysicianDbConfigured,
} from './physician-db-writer.js';
import {
  getPromptForSourceType,
  getDefaultGuardrail,
  normalizeEvidenceType,
  normalizeCancerTypes,
} from './publication-prompts.js';
import { bridgeToProposals } from './publication-bridge.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('publication-index');

/**
 * Source types we can crawl for publications
 */
const PUBLICATION_SOURCE_TYPES = [
  'vendor',
  'vendor_publications_index',
  'vendor_evidence_page',
  'society_editorial',
  'guideline_excerpt',
  'news_review',
  // Additional types found in database
  'news',
  'guideline',
  'society',
];

export class PublicationIndexCrawler extends PlaywrightCrawler {
  constructor(options = {}) {
    super({
      name: 'Publication Index Crawler',
      source: 'publication-index',
      description: 'Extracts publications from vendor and society pages',
      ...options,
    });

    this.dryRun = options.dryRun || false;
    this.sourceKey = options.sourceKey || null; // Filter to specific source
    this.stats = {
      sourcesCrawled: 0,
      sourcesSkipped: 0,
      sourcesUnchanged: 0,
      sourcesFailed: 0,
      publicationsFound: 0,
      newItems: 0,
      resolvedToPubmed: 0,
      edgesCreated: 0,
    };
  }

  /**
   * Main entry point - crawl all active publication sources
   */
  async crawl() {
    logger.info('Starting publication index crawl', {
      dryRun: this.dryRun,
      sourceKey: this.sourceKey,
    });

    if (!isPhysicianDbConfigured()) {
      logger.warn('Physician DB not configured - will extract but not write');
    }

    await this.loadHashes();

    try {
      // Get active sources from database
      const sources = await this.getActiveSources();
      logger.info('Found active sources', { count: sources.length });

      // Process each source
      for (const source of sources) {
        try {
          await this.processSource(source);
          this.stats.sourcesCrawled++;
        } catch (error) {
          logger.error('Failed to process source', {
            sourceKey: source.source_key,
            error: error.message,
          });
          this.stats.sourcesFailed++;
        }

        // Rate limiting between sources
        await this.sleep(this.rateLimitMs);
      }

      await this.saveHashes();

    } finally {
      await this.closeBrowser();
      this.closeHashStore();
    }

    logger.info('Publication index crawl complete', { stats: this.stats });
    return {
      success: true,
      stats: this.stats,
    };
  }

  /**
   * Get active sources from mrd_sources table
   */
  async getActiveSources() {
    let sql = `
      SELECT id, source_key, source_type, display_name, base_url,
             access_method, version_string, last_checked_at
      FROM mrd_sources
      WHERE is_active = true
        AND source_type = ANY($1)
    `;
    const params = [PUBLICATION_SOURCE_TYPES];

    // Filter to specific source if requested
    if (this.sourceKey) {
      sql += ' AND source_key = $2';
      params.push(this.sourceKey);
    }

    sql += ' ORDER BY last_checked_at ASC NULLS FIRST';

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Process a single source - fetch, extract, resolve, write
   */
  async processSource(source) {
    logger.info('Processing source', {
      sourceKey: source.source_key,
      sourceType: source.source_type,
      url: source.base_url,
    });

    if (!source.base_url) {
      logger.warn('Source has no URL', { sourceKey: source.source_key });
      this.stats.sourcesSkipped++;
      return;
    }

    // Check URL health
    if (this.shouldSkipUrl(source.base_url)) {
      logger.info('Skipping unhealthy URL', { url: source.base_url });
      this.stats.sourcesSkipped++;
      return;
    }

    // Fetch page content
    let pageData;
    try {
      pageData = await this.fetchPage(source.base_url);
      this.recordPageSuccess(source.base_url, source.source_key);
    } catch (error) {
      this.recordPageFailure(source.base_url, source.source_key, error);
      throw error;
    }

    // Check for content changes
    const hashKey = `pub-index:${source.source_key}`;
    const changeResult = this.detectChange(source.base_url, pageData.content, hashKey);

    if (!changeResult.hasChanged && !changeResult.isFirstCrawl) {
      logger.info('Source unchanged', { sourceKey: source.source_key });
      this.stats.sourcesUnchanged++;
      await this.updateSourceChecked(source.id);
      return;
    }

    // Extract publications using Claude
    const publications = await this.extractPublications(
      pageData.content,
      source.source_type,
      source.base_url
    );

    if (!publications || publications.length === 0) {
      logger.info('No publications extracted', { sourceKey: source.source_key });
      this.storeHash(hashKey, changeResult.newHash, pageData.content);
      await this.updateSourceChecked(source.id);
      return;
    }

    this.stats.publicationsFound += publications.length;
    logger.info('Extracted publications', {
      sourceKey: source.source_key,
      count: publications.length,
    });

    // Process each publication
    if (!this.dryRun) {
      for (const pub of publications) {
        await this.processPublication(pub, source);
      }
    } else {
      // Dry run - just log what we found
      for (const pub of publications) {
        logger.info('Would process publication (dry run)', {
          title: pub.title?.substring(0, 60),
          pmid: pub.pmid,
          doi: pub.doi,
        });
      }
    }

    // Update hash and source timestamp
    this.storeHash(hashKey, changeResult.newHash, pageData.content);
    await this.updateSourceChecked(source.id);
  }

  /**
   * Extract publications from page content using Claude
   */
  async extractPublications(content, sourceType, sourceUrl) {
    if (!this.anthropic) {
      logger.warn('Claude API not configured - cannot extract publications');
      return [];
    }

    // Get appropriate prompt for source type
    const basePrompt = getPromptForSourceType(sourceType);

    // Truncate content if too long (Claude context limits)
    const maxContentLength = 50000;
    const truncatedContent = content.length > maxContentLength
      ? content.substring(0, maxContentLength) + '\n\n[Content truncated...]'
      : content;

    const prompt = `${basePrompt}

Page URL: ${sourceUrl}

Page content:
---
${truncatedContent}
---

Extract all publications found and return as JSON.`;

    try {
      const result = await this.analyzeWithClaude(prompt, { maxTokens: 4096 });

      if (!result) {
        logger.warn('Claude returned empty result');
        return [];
      }

      // Handle publications array in result
      const publications = result.publications || [];

      // Add extraction metadata
      return publications.map((pub) => ({
        ...pub,
        evidence_type: normalizeEvidenceType(pub.evidence_type),
        cancer_types: normalizeCancerTypes(pub.cancer_types),
        source_url: sourceUrl,
        extraction_guardrail: result.guardrail_text || getDefaultGuardrail(sourceType),
      }));

    } catch (error) {
      logger.error('Claude extraction failed', { error: error.message });
      return [];
    }
  }

  /**
   * Process a single extracted publication - resolve and write
   */
  async processPublication(pub, source) {
    // Try to resolve to PubMed
    let resolvedPub = null;

    if (pub.pmid || pub.doi || pub.title) {
      try {
        const resolved = await resolvePublication({
          pmid: pub.pmid,
          doi: pub.doi,
          title: pub.title,
          journal: pub.journal,
          publicationDate: pub.year ? `${pub.year}-01-01` : null,
        });

        if (resolved && resolved.length > 0) {
          resolvedPub = resolved[0];
          this.stats.resolvedToPubmed++;
          logger.debug('Resolved to PubMed', {
            originalTitle: pub.title?.substring(0, 40),
            resolvedPmid: resolvedPub.pmid,
          });
        }
      } catch (error) {
        logger.debug('PubMed resolution failed', { error: error.message });
      }
    }

    // Use resolved data if available, otherwise use extracted
    const finalPub = resolvedPub || pub;

    // Merge extracted context with resolved data
    const pubToWrite = {
      title: finalPub.title || pub.title,
      authors: finalPub.authors || pub.authors,
      journal: finalPub.journal || pub.journal,
      year: finalPub.publicationDate?.substring(0, 4) || pub.year,
      publicationDate: finalPub.publicationDate || (pub.year ? `${pub.year}-01-01` : null),
      doi: finalPub.doi || pub.doi,
      pmid: finalPub.pmid || pub.pmid,
      abstract: finalPub.abstract,
      sourceUrl: finalPub.sourceUrl || pub.url || pub.source_url,
      evidence_type: pub.evidence_type, // Keep extracted evidence type
      cancer_types: pub.cancer_types,
      clinical_context: pub.clinical_context,
    };

    // Write to physician DB
    try {
      const writeResult = await writePublicationToPhysicianDb(pubToWrite, {
        discoveredVia: `publication-index:${source.source_key}`,
        sourceUrl: source.base_url,
      });

      if (writeResult.isNew) {
        this.stats.newItems++;

        // Bridge new publications to test-data-tracker proposals
        try {
          await bridgeToProposals(pubToWrite, source);
        } catch (bridgeError) {
          logger.warn('Publication bridge failed (non-fatal)', {
            title: pubToWrite.title?.substring(0, 40),
            error: bridgeError.message,
          });
        }
      }

      // Write source-item edge for provenance
      await writeSourceItemEdge(source.id, writeResult.id, {
        extractionMethod: 'claude',
        confidence: pub.pmid ? 0.95 : 0.75, // Higher confidence if we had a PMID
      });
      this.stats.edgesCreated++;

      // Set interpretation guardrail if applicable
      if (pub.extraction_guardrail) {
        await setInterpretationGuardrail(writeResult.id, pub.extraction_guardrail);
      }

      return writeResult;

    } catch (error) {
      logger.error('Failed to write publication', {
        title: pubToWrite.title?.substring(0, 40),
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Update source last_checked_at timestamp
   */
  async updateSourceChecked(sourceId) {
    if (this.dryRun) return;

    await query(
      'UPDATE mrd_sources SET last_checked_at = NOW() WHERE id = $1',
      [sourceId]
    );
  }

  /**
   * Get status of active sources (for --status flag)
   */
  async getSourceStatus() {
    const result = await query(`
      SELECT
        source_key,
        display_name,
        source_type,
        base_url,
        last_checked_at,
        EXTRACT(DAYS FROM NOW() - last_checked_at)::INTEGER as days_since_check
      FROM mrd_sources
      WHERE is_active = true
        AND source_type = ANY($1)
      ORDER BY last_checked_at ASC NULLS FIRST
    `, [PUBLICATION_SOURCE_TYPES]);

    return result.rows;
  }
}

/**
 * Run the publication index crawler
 * @param {Object} options - Crawler options
 * @returns {Promise<Object>} - Crawl results
 */
export async function runPublicationIndexCrawler(options = {}) {
  const crawler = new PublicationIndexCrawler(options);
  return crawler.crawl();
}

/**
 * Get status of publication index sources
 */
export async function getPublicationSourceStatus() {
  const crawler = new PublicationIndexCrawler();
  return crawler.getSourceStatus();
}

export default {
  PublicationIndexCrawler,
  runPublicationIndexCrawler,
  getPublicationSourceStatus,
};
