/**
 * Duplicate Check: Detect semantically similar items before insertion
 * Uses embedding similarity to catch the same study from different sources
 */

import { query } from '../db/client.js';
import { embed } from './mrd-embedder.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mrd-duplicate');

// Similarity thresholds
const DUPLICATE_THRESHOLD = 0.92; // Very high similarity = likely duplicate
const RELATED_THRESHOLD = 0.85;   // High similarity = related but distinct

/**
 * Check if a new item is a duplicate of existing items
 * @param {string} text - Text to check (title + summary)
 * @returns {Promise<{isDuplicate: boolean, matches: Object[]}>}
 */
export async function checkDuplicate(text) {
  try {
    const embedding = await embed(text);

    const result = await query(
      `SELECT * FROM check_duplicate_embedding($1::vector, $2)`,
      [JSON.stringify(embedding), DUPLICATE_THRESHOLD]
    );

    const matches = result.rows.map((row) => ({
      guidanceId: row.guidance_id,
      title: row.title,
      sourceType: row.source_type,
      sourceId: row.source_id,
      similarity: parseFloat(row.similarity),
    }));

    return {
      isDuplicate: matches.length > 0,
      matches,
    };
  } catch (error) {
    logger.error('Duplicate check failed', { error: error.message });
    // On error, allow the item through (don't block on check failure)
    return { isDuplicate: false, matches: [], error: error.message };
  }
}

/**
 * Check multiple items for duplicates in batch
 * @param {Object[]} items - Array of items with title and summary
 * @returns {Promise<Object[]>} - Items with duplicate info attached
 */
export async function batchCheckDuplicates(items) {
  const results = [];

  for (const item of items) {
    const text = `${item.title} ${item.summary || item.abstract || ''}`;
    const { isDuplicate, matches } = await checkDuplicate(text);

    results.push({
      ...item,
      isDuplicate,
      duplicateMatches: matches,
    });

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return results;
}

/**
 * Find related but distinct items (for "related reading" suggestions)
 * @param {number} guidanceId - Source guidance item ID
 * @param {number} limit - Max related items to return
 * @returns {Promise<Object[]>}
 */
export async function findRelatedItems(guidanceId, limit = 5) {
  const result = await query(
    `SELECT DISTINCT ON (g2.id)
       g2.id,
       g2.title,
       g2.source_type,
       g2.source_url,
       g2.summary,
       1 - (e1.embedding <=> e2.embedding) as similarity
     FROM mrd_item_embeddings e1
     JOIN mrd_item_embeddings e2 ON e1.guidance_id != e2.guidance_id
     JOIN mrd_guidance_items g1 ON e1.guidance_id = g1.id
     JOIN mrd_guidance_items g2 ON e2.guidance_id = g2.id
     WHERE e1.guidance_id = $1
       AND g2.is_superseded = FALSE
       AND 1 - (e1.embedding <=> e2.embedding) >= $2
       AND 1 - (e1.embedding <=> e2.embedding) < $3
     ORDER BY g2.id, similarity DESC
     LIMIT $4`,
    [guidanceId, RELATED_THRESHOLD, DUPLICATE_THRESHOLD, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    summary: row.summary,
    similarity: parseFloat(row.similarity),
  }));
}

/**
 * Merge duplicate detection for cross-source linking
 * Finds items that may be the same study from different sources
 * @param {Object} options - Options
 * @returns {Promise<Object[]>} - Potential duplicates to review
 */
export async function findPotentialDuplicates(options = {}) {
  const { minSimilarity = 0.88, limit = 50 } = options;

  // Find pairs of items from different sources with high similarity
  const result = await query(
    `SELECT
       g1.id as id1,
       g1.title as title1,
       g1.source_type as source1,
       g1.source_id as source_id1,
       g2.id as id2,
       g2.title as title2,
       g2.source_type as source2,
       g2.source_id as source_id2,
       1 - (e1.embedding <=> e2.embedding) as similarity
     FROM mrd_item_embeddings e1
     JOIN mrd_item_embeddings e2 ON e1.id < e2.id
     JOIN mrd_guidance_items g1 ON e1.guidance_id = g1.id
     JOIN mrd_guidance_items g2 ON e2.guidance_id = g2.id
     WHERE g1.source_type != g2.source_type
       AND g1.is_superseded = FALSE
       AND g2.is_superseded = FALSE
       AND 1 - (e1.embedding <=> e2.embedding) >= $1
     ORDER BY similarity DESC
     LIMIT $2`,
    [minSimilarity, limit]
  );

  return result.rows.map((row) => ({
    item1: {
      id: row.id1,
      title: row.title1,
      sourceType: row.source1,
      sourceId: row.source_id1,
    },
    item2: {
      id: row.id2,
      title: row.title2,
      sourceType: row.source2,
      sourceId: row.source_id2,
    },
    similarity: parseFloat(row.similarity),
  }));
}

/**
 * Mark items as related (manual or automated linking)
 * @param {number} item1Id - First item ID
 * @param {number} item2Id - Second item ID
 * @param {string} relationship - Relationship type (duplicate, supersedes, related)
 */
export async function linkItems(item1Id, item2Id, relationship = 'related') {
  if (relationship === 'duplicate') {
    // Mark item2 as superseded by item1
    await query(
      `UPDATE mrd_guidance_items
       SET is_superseded = TRUE, superseded_by = $1
       WHERE id = $2`,
      [item1Id, item2Id]
    );
    logger.info('Marked duplicate', { kept: item1Id, superseded: item2Id });
  } else if (relationship === 'supersedes') {
    // Item1 supersedes item2 (newer version)
    await query(
      `UPDATE mrd_guidance_items
       SET is_superseded = TRUE, superseded_by = $1
       WHERE id = $2`,
      [item1Id, item2Id]
    );
    await query(
      `UPDATE mrd_guidance_items SET supersedes = $2 WHERE id = $1`,
      [item1Id, item2Id]
    );
    logger.info('Set supersession', { newer: item1Id, older: item2Id });
  }
  // For 'related', we don't need to store anything - the embedding similarity handles it
}

export default {
  checkDuplicate,
  batchCheckDuplicates,
  findRelatedItems,
  findPotentialDuplicates,
  linkItems,
  DUPLICATE_THRESHOLD,
  RELATED_THRESHOLD,
};
