/**
 * Publication Enrichment
 *
 * Enriches publications with full text from PMC/Unpaywall,
 * extracts structured content, updates cancer types, and
 * re-embeds with enriched content.
 */

import { query } from '../db/mrd-client.js';
import { fetchFullText, fetchPubMedMetadata } from './fulltext-fetcher.js';
import { extractStructuredContent, extractFromAbstract, buildEnrichedContent } from './content-extractor.js';
import { extractCancerTypes, extractClinicalSettings } from './cancer-type-extractor.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('enrich-publications');

/**
 * Enrich publications with full text and structured content
 * @param {Object} options - Options
 * @returns {Object} - Stats
 */
export async function enrichPublications(options = {}) {
  const {
    limit = 50,
    dryRun = false,
    reEmbed = true,
    sourceType = null,
    minContentLength = 500,
  } = options;

  // Find publications needing enrichment
  let sql = `
    SELECT id, pmid, doi, title, summary, full_text_excerpt, source_type
    FROM mrd_guidance_items
    WHERE source_type IN ('extracted_publication', 'seed_publication', 'pubmed')
      AND (full_text_excerpt IS NULL OR LENGTH(full_text_excerpt) < $1)
      AND (pmid IS NOT NULL OR doi IS NOT NULL)
  `;
  const params = [minContentLength];

  if (sourceType) {
    sql += ` AND source_type = $${params.length + 1}`;
    params.push(sourceType);
  }

  sql += ` ORDER BY id DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const items = await query(sql, params);
  logger.info('Found publications to enrich', { count: items.rows.length });

  const stats = {
    processed: 0,
    fullTextFound: 0,
    abstractOnly: 0,
    noContent: 0,
    cancerTypesUpdated: 0,
    clinicalSettingsUpdated: 0,
    reEmbedded: 0,
    errors: 0,
  };

  for (const item of items.rows) {
    try {
      await enrichSinglePublication(item, { dryRun, reEmbed }, stats);
      stats.processed++;

      // Rate limiting between items
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      logger.error('Failed to enrich publication', {
        id: item.id,
        error: error.message
      });
      stats.errors++;
    }
  }

  logger.info('Enrichment complete', { stats });
  return stats;
}

/**
 * Enrich a single publication
 */
async function enrichSinglePublication(item, options, stats) {
  const { dryRun, reEmbed } = options;

  logger.info('Enriching publication', {
    id: item.id,
    pmid: item.pmid,
    title: item.title?.substring(0, 50)
  });

  // Fetch full text or abstract
  const result = await fetchFullText(item.pmid, item.doi);

  if (!result) {
    logger.warn('No content found', { id: item.id });
    stats.noContent++;
    return;
  }

  let extracted = null;
  let enrichedContent = null;
  let cancerTypes = [];
  let clinicalSettings = [];

  if (result.fullText && result.fullText.length > 1000) {
    // Extract structured content from full text using Claude
    extracted = await extractStructuredContent(result.fullText, item.title);
    enrichedContent = buildEnrichedContent(extracted, result.abstract, result.sections);

    // Get cancer types from extraction or regex
    cancerTypes = extracted?.cancer_types?.length > 0
      ? extracted.cancer_types
      : extractCancerTypes(result.fullText + ' ' + item.title);

    clinicalSettings = extracted?.clinical_settings?.length > 0
      ? extracted.clinical_settings
      : extractClinicalSettings(result.fullText + ' ' + item.title);

    stats.fullTextFound++;
    logger.info('Full text processed', {
      id: item.id,
      source: result.source,
      contentLength: enrichedContent.length,
      cancerTypes
    });

  } else if (result.abstract) {
    // Use abstract only with regex-based extraction
    extracted = extractFromAbstract(result.abstract, item.title);
    enrichedContent = buildEnrichedContent(extracted, result.abstract);

    cancerTypes = extracted.cancer_types;
    clinicalSettings = extracted.clinical_settings;

    stats.abstractOnly++;
    logger.info('Abstract processed', {
      id: item.id,
      contentLength: enrichedContent.length,
      cancerTypes
    });

  } else {
    stats.noContent++;
    return;
  }

  if (dryRun) {
    logger.info('Would update (dry run)', {
      id: item.id,
      contentLength: enrichedContent?.length,
      cancerTypes,
      clinicalSettings,
      studyDesign: extracted?.study_design,
      mrdTest: extracted?.mrd_test_used
    });
    return;
  }

  // Update item with enriched content
  await query(`
    UPDATE mrd_guidance_items
    SET full_text_excerpt = $1,
        evidence_type = COALESCE($2, evidence_type),
        updated_at = NOW()
    WHERE id = $3
  `, [enrichedContent, extracted?.study_design, item.id]);

  // Update cancer types
  if (cancerTypes.length > 0 && !cancerTypes.every(t => t === 'multi_solid')) {
    await updateCancerTypes(item.id, cancerTypes);
    stats.cancerTypesUpdated++;
  }

  // Update clinical settings
  if (clinicalSettings.length > 0) {
    await updateClinicalSettings(item.id, clinicalSettings);
    stats.clinicalSettingsUpdated++;
  }

  // Re-embed with full content
  if (reEmbed) {
    try {
      await reEmbedItem(item.id);
      stats.reEmbedded++;
    } catch (error) {
      logger.error('Re-embedding failed', { id: item.id, error: error.message });
    }
  }
}

/**
 * Update cancer types for an item
 */
async function updateCancerTypes(guidanceId, cancerTypes) {
  // Delete existing cancer types
  await query('DELETE FROM mrd_guidance_cancer_types WHERE guidance_id = $1', [guidanceId]);

  // Insert new cancer types
  for (const cancerType of cancerTypes) {
    if (cancerType && cancerType !== 'multi_solid') {
      await query(`
        INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [guidanceId, cancerType]);
    }
  }

  // If we have specific types, also add multi_solid for broad queries
  if (cancerTypes.length > 0) {
    await query(`
      INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
      VALUES ($1, 'multi_solid')
      ON CONFLICT DO NOTHING
    `, [guidanceId]);
  }
}

/**
 * Update clinical settings for an item
 */
async function updateClinicalSettings(guidanceId, clinicalSettings) {
  // Delete existing clinical settings
  await query('DELETE FROM mrd_guidance_clinical_settings WHERE guidance_id = $1', [guidanceId]);

  // Insert new clinical settings
  for (const setting of clinicalSettings) {
    if (setting) {
      await query(`
        INSERT INTO mrd_guidance_clinical_settings (guidance_id, clinical_setting)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [guidanceId, setting]);
    }
  }
}

/**
 * Re-embed an item with updated content
 */
async function reEmbedItem(guidanceId) {
  // Get the updated item
  const result = await query(`
    SELECT g.id, g.title, g.summary, g.full_text_excerpt, g.key_findings,
           array_agg(DISTINCT ct.cancer_type) as cancer_types,
           array_agg(DISTINCT cs.clinical_setting) as clinical_settings
    FROM mrd_guidance_items g
    LEFT JOIN mrd_guidance_cancer_types ct ON ct.guidance_id = g.id
    LEFT JOIN mrd_guidance_clinical_settings cs ON cs.guidance_id = g.id
    WHERE g.id = $1
    GROUP BY g.id
  `, [guidanceId]);

  if (result.rows.length === 0) return;

  const item = result.rows[0];

  // Build embedding content
  const parts = [
    `Title: ${item.title}`,
  ];

  if (item.summary) {
    parts.push(`Summary: ${item.summary}`);
  }

  if (item.full_text_excerpt) {
    // Truncate to reasonable embedding size
    const excerpt = item.full_text_excerpt.length > 6000
      ? item.full_text_excerpt.substring(0, 6000) + '...'
      : item.full_text_excerpt;
    parts.push(excerpt);
  }

  if (item.key_findings) {
    parts.push(`Key Findings: ${item.key_findings}`);
  }

  // Add cancer types and clinical settings for semantic matching
  const cancerTypes = item.cancer_types?.filter(t => t);
  if (cancerTypes?.length) {
    parts.push(`Cancer Types: ${cancerTypes.join(', ')}`);
  }

  const clinicalSettings = item.clinical_settings?.filter(s => s);
  if (clinicalSettings?.length) {
    parts.push(`Clinical Settings: ${clinicalSettings.join(', ')}`);
  }

  const embeddingContent = parts.join('\n\n');

  // Generate embedding
  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const embResponse = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: embeddingContent,
  });

  const embedding = embResponse.data[0].embedding;

  // Delete existing embedding
  await query('DELETE FROM mrd_item_embeddings WHERE guidance_id = $1', [guidanceId]);

  // Insert new embedding
  await query(`
    INSERT INTO mrd_item_embeddings (guidance_id, chunk_index, chunk_text, embedding)
    VALUES ($1, 0, $2, $3::vector)
  `, [guidanceId, embeddingContent, JSON.stringify(embedding)]);

  logger.debug('Re-embedded item', { id: guidanceId, contentLength: embeddingContent.length });
}

/**
 * Get enrichment status for publications
 */
export async function getEnrichmentStatus() {
  const result = await query(`
    SELECT
      source_type,
      COUNT(*) as total,
      COUNT(CASE WHEN full_text_excerpt IS NOT NULL AND LENGTH(full_text_excerpt) > 1000 THEN 1 END) as full_text,
      COUNT(CASE WHEN full_text_excerpt IS NOT NULL AND LENGTH(full_text_excerpt) BETWEEN 200 AND 1000 THEN 1 END) as abstract_only,
      COUNT(CASE WHEN full_text_excerpt IS NULL OR LENGTH(full_text_excerpt) < 200 THEN 1 END) as minimal
    FROM mrd_guidance_items
    WHERE source_type IN ('extracted_publication', 'seed_publication', 'pubmed')
    GROUP BY source_type
    ORDER BY total DESC
  `);

  return result.rows;
}

export default {
  enrichPublications,
  getEnrichmentStatus,
};
