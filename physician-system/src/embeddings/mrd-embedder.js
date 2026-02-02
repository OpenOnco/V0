/**
 * MRD Embedder: Generate embeddings for guidance items using OpenAI
 * Uses text-embedding-ada-002 for 1536-dimensional vectors
 */

import OpenAI from 'openai';
import { query, transaction } from '../db/client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mrd-embedder');
const EMBEDDING_MODEL = 'text-embedding-ada-002';
const MAX_CHUNK_TOKENS = 8000; // ada-002 supports 8191 tokens
const CHUNK_OVERLAP = 200; // Overlap between chunks for context

let openai = null;

function getClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for embeddings');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate embedding for text
 * @param {string} text - Text to embed
 * @returns {Promise<number[]>} - 1536-dimensional embedding vector
 */
export async function embed(text) {
  const client = getClient();

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * @param {string[]} texts - Array of texts
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function batchEmbed(texts) {
  const client = getClient();

  // OpenAI batch limit
  const BATCH_SIZE = 100;
  const allEmbeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch.map((t) => t.trim()),
    });

    const embeddings = response.data.map((d) => d.embedding);
    allEmbeddings.push(...embeddings);

    // Rate limiting
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return allEmbeddings;
}

/**
 * Chunk long text for embedding
 * @param {string} text - Text to chunk
 * @param {number} maxTokens - Max tokens per chunk (rough estimate: 4 chars = 1 token)
 * @returns {string[]} - Array of chunks
 */
export function chunkText(text, maxTokens = MAX_CHUNK_TOKENS) {
  const maxChars = maxTokens * 4;

  if (text.length <= maxChars) {
    return [text];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    // Try to break at sentence boundary
    if (end < text.length) {
      const sentenceEnd = text.lastIndexOf('. ', end);
      if (sentenceEnd > start + maxChars * 0.5) {
        end = sentenceEnd + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP * 4; // Overlap for context
  }

  return chunks;
}

/**
 * Build text for embedding from guidance item
 * Combines title, summary, and key findings
 * @param {Object} item - Guidance item
 * @returns {string}
 */
export function buildEmbeddingText(item) {
  const parts = [];

  // Source type context - important for NCCN guidelines
  if (item.source_type === 'nccn') {
    parts.push('Source: NCCN Clinical Practice Guidelines for ctDNA/MRD testing');
  }

  // Title is most important
  if (item.title) {
    parts.push(`Title: ${item.title}`);
  }

  // Evidence level - important for guidelines
  if (item.evidence_level) {
    parts.push(`Evidence Level: ${item.evidence_level}`);
  }

  // Summary
  if (item.summary) {
    parts.push(`Summary: ${item.summary}`);
  }

  // Key findings
  if (item.key_findings && Array.isArray(item.key_findings)) {
    const findings = item.key_findings
      .map((f) => {
        const findingParts = [f.finding];
        if (f.implication) findingParts.push(f.implication);
        if (f.quote) findingParts.push(`"${f.quote}"`);
        if (f.setting) findingParts.push(`Clinical setting: ${f.setting}`);
        return findingParts.join('. ');
      })
      .join(' ');
    parts.push(`Key Findings: ${findings}`);
  }

  // Full text excerpt
  if (item.full_text_excerpt) {
    parts.push(`Content: ${item.full_text_excerpt}`);
  }

  // Cancer types and settings for searchability
  if (item.cancer_types && item.cancer_types.length > 0) {
    parts.push(`Cancer Types: ${item.cancer_types.join(', ')}`);
  }

  if (item.clinical_settings && item.clinical_settings.length > 0) {
    parts.push(`Clinical Settings: ${item.clinical_settings.join(', ')}`);
  }

  // For NCCN items, add extra context keywords to improve matching
  if (item.source_type === 'nccn') {
    parts.push('Keywords: NCCN guidelines, clinical practice, evidence-based recommendations, ctDNA, circulating tumor DNA, liquid biopsy, MRD, minimal residual disease, molecular residual disease');
  }

  return parts.join('\n\n');
}

/**
 * Embed a guidance item and store in database
 * @param {number} guidanceId - Guidance item ID
 * @returns {Promise<{success: boolean, chunks: number}>}
 */
export async function embedGuidanceItem(guidanceId) {
  // Fetch the item
  const result = await query(
    `SELECT g.*,
            array_agg(DISTINCT ct.cancer_type) FILTER (WHERE ct.cancer_type IS NOT NULL) as cancer_types,
            array_agg(DISTINCT cs.clinical_setting) FILTER (WHERE cs.clinical_setting IS NOT NULL) as clinical_settings
     FROM mrd_guidance_items g
     LEFT JOIN mrd_guidance_cancer_types ct ON g.id = ct.guidance_id
     LEFT JOIN mrd_guidance_clinical_settings cs ON g.id = cs.guidance_id
     WHERE g.id = $1
     GROUP BY g.id`,
    [guidanceId]
  );

  if (result.rows.length === 0) {
    throw new Error(`Guidance item not found: ${guidanceId}`);
  }

  const item = result.rows[0];
  const text = buildEmbeddingText(item);
  const chunks = chunkText(text);

  logger.debug('Embedding guidance item', {
    id: guidanceId,
    title: item.title,
    chunks: chunks.length,
  });

  // Generate embeddings for each chunk
  const embeddings = await batchEmbed(chunks);

  // Store embeddings in database
  await transaction(async (client) => {
    // Delete existing embeddings for this item
    await client.query(
      'DELETE FROM mrd_item_embeddings WHERE guidance_id = $1',
      [guidanceId]
    );

    // Insert new embeddings
    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        `INSERT INTO mrd_item_embeddings (guidance_id, chunk_index, chunk_text, embedding)
         VALUES ($1, $2, $3, $4)`,
        [guidanceId, i, chunks[i], JSON.stringify(embeddings[i])]
      );
    }
  });

  logger.info('Embedded guidance item', {
    id: guidanceId,
    chunks: chunks.length,
  });

  return { success: true, chunks: chunks.length };
}

/**
 * Embed all guidance items that don't have embeddings
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Stats
 */
export async function embedAllMissing(options = {}) {
  const { limit = 100, batchSize = 5 } = options;

  // Find items without embeddings
  const result = await query(
    `SELECT g.id FROM mrd_guidance_items g
     LEFT JOIN mrd_item_embeddings e ON g.id = e.guidance_id
     WHERE e.id IS NULL AND g.is_superseded = FALSE
     ORDER BY g.created_at DESC
     LIMIT $1`,
    [limit]
  );

  const itemIds = result.rows.map((r) => r.id);
  logger.info('Found items needing embeddings', { count: itemIds.length });

  if (itemIds.length === 0) {
    return { processed: 0, success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (id) => {
        try {
          await embedGuidanceItem(id);
          success++;
        } catch (error) {
          logger.error('Failed to embed item', { id, error: error.message });
          failed++;
        }
      })
    );

    // Rate limiting
    if (i + batchSize < itemIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  logger.info('Batch embedding complete', { success, failed });
  return { processed: itemIds.length, success, failed };
}

/**
 * Search for similar items using vector similarity
 * @param {string} queryText - Query text
 * @param {Object} options - Search options
 * @returns {Promise<Object[]>} - Similar items
 */
export async function searchSimilar(queryText, options = {}) {
  const {
    limit = 10,
    minSimilarity = 0.7,
    cancerType = null,
  } = options;

  // Generate query embedding
  const queryEmbedding = await embed(queryText);

  // Search using pgvector
  let sql = `
    SELECT DISTINCT ON (g.id)
      g.id,
      g.title,
      g.summary,
      g.source_type,
      g.source_id,
      g.source_url,
      g.evidence_type,
      g.publication_date,
      e.chunk_text,
      1 - (e.embedding <=> $1::vector) as similarity
    FROM mrd_item_embeddings e
    JOIN mrd_guidance_items g ON e.guidance_id = g.id
    WHERE g.is_superseded = FALSE
      AND 1 - (e.embedding <=> $1::vector) >= $2
  `;

  const params = [JSON.stringify(queryEmbedding), minSimilarity];

  // Add cancer type filter if specified
  if (cancerType) {
    sql += `
      AND EXISTS (
        SELECT 1 FROM mrd_guidance_cancer_types ct
        WHERE ct.guidance_id = g.id AND ct.cancer_type = $3
      )
    `;
    params.push(cancerType);
  }

  sql += `
    ORDER BY g.id, similarity DESC
    LIMIT $${params.length + 1}
  `;
  params.push(limit);

  const result = await query(sql, params);

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    evidenceType: row.evidence_type,
    publicationDate: row.publication_date,
    matchedText: row.chunk_text,
    similarity: parseFloat(row.similarity),
  }));
}

export default {
  embed,
  batchEmbed,
  chunkText,
  buildEmbeddingText,
  embedGuidanceItem,
  embedAllMissing,
  searchSimilar,
};
