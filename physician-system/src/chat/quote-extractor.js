/**
 * Quote Extractor
 * Extracts and stores anchored quotes for citation verification
 */

import { query } from '../db/client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('quote-extractor');

/**
 * Find the position of a quote within text, handling minor variations
 */
function findQuotePosition(fullText, quoteText) {
  if (!fullText || !quoteText) return null;

  // Try exact match first
  const exactIndex = fullText.indexOf(quoteText);
  if (exactIndex >= 0) {
    return {
      charStart: exactIndex,
      charEnd: exactIndex + quoteText.length,
      confidence: 1.0,
    };
  }

  // Try normalized match (collapse whitespace, lowercase)
  const normalizedFull = fullText.toLowerCase().replace(/\s+/g, ' ');
  const normalizedQuote = quoteText.toLowerCase().replace(/\s+/g, ' ');

  const normalizedIndex = normalizedFull.indexOf(normalizedQuote);
  if (normalizedIndex >= 0) {
    // Map back to original positions (approximate)
    return {
      charStart: normalizedIndex,
      charEnd: normalizedIndex + normalizedQuote.length,
      confidence: 0.95,
    };
  }

  // Try finding a significant substring (first 50 chars)
  const shortQuote = normalizedQuote.substring(0, Math.min(50, normalizedQuote.length));
  const shortIndex = normalizedFull.indexOf(shortQuote);
  if (shortIndex >= 0) {
    return {
      charStart: shortIndex,
      charEnd: shortIndex + quoteText.length,
      confidence: 0.8,
    };
  }

  return null;
}

/**
 * Extract quote from a guidance item and determine its position
 */
export async function extractAndStoreQuote(guidanceId, quoteText, options = {}) {
  const { pageNumber = null } = options;

  try {
    // Get the item's content and any existing chunks
    const itemResult = await query(`
      SELECT
        g.id,
        g.summary,
        g.full_text_excerpt,
        g.source_type
      FROM mrd_guidance_items g
      WHERE g.id = $1
    `, [guidanceId]);

    if (itemResult.rows.length === 0) {
      logger.warn('Guidance item not found', { guidanceId });
      return null;
    }

    const item = itemResult.rows[0];

    // Try to find quote in full text excerpt first, then summary
    const searchText = item.full_text_excerpt || item.summary || '';
    let position = findQuotePosition(searchText, quoteText);

    // If not found in main content, search embeddings chunks
    let chunkIndex = 0;
    if (!position) {
      const chunksResult = await query(`
        SELECT chunk_index, chunk_text
        FROM mrd_item_embeddings
        WHERE guidance_id = $1
        ORDER BY chunk_index
      `, [guidanceId]);

      for (const chunk of chunksResult.rows) {
        position = findQuotePosition(chunk.chunk_text, quoteText);
        if (position) {
          chunkIndex = chunk.chunk_index;
          break;
        }
      }
    }

    // Store the anchor using upsert function
    // Note: upsert_quote_anchor uses char_offset (not char_start/char_end)
    const result = await query(`
      SELECT upsert_quote_anchor($1, $2, $3, $4, $5, $6, $7) as anchor_id
    `, [
      guidanceId,
      quoteText.substring(0, 2000), // Limit quote length
      chunkIndex,
      position?.charStart || null,  // maps to char_offset in function
      null,  // char_end not used in current schema
      pageNumber,
      position?.confidence || 0.5, // Low confidence if position not found
    ]);

    const anchorId = result.rows[0]?.anchor_id;

    logger.debug('Stored quote anchor', {
      guidanceId,
      anchorId,
      confidence: position?.confidence || 0.5,
      chunkIndex,
    });

    return {
      anchorId,
      chunkIndex,
      charStart: position?.charStart,
      charEnd: position?.charEnd,
      confidence: position?.confidence || 0.5,
      pageNumber,
    };
  } catch (error) {
    logger.error('Failed to store quote anchor', {
      guidanceId,
      error: error.message,
    });
    return null;
  }
}

/**
 * Extract and store quotes for all sources in a response
 */
export async function anchorResponseQuotes(sources) {
  const anchored = [];

  for (const source of sources) {
    if (!source.directQuote || !source.id) continue;

    const anchor = await extractAndStoreQuote(
      source.id,
      source.directQuote,
      { pageNumber: source.pageNumber }
    );

    if (anchor) {
      anchored.push({
        sourceIndex: source.index,
        guidanceId: source.id,
        ...anchor,
      });
    }
  }

  return anchored;
}

/**
 * Get existing quote anchors for a guidance item
 */
export async function getQuoteAnchors(guidanceId) {
  const result = await query(`
    SELECT
      id,
      quote_text,
      chunk_index,
      char_start,
      char_end,
      page_number,
      confidence,
      usage_count,
      last_used_at
    FROM mrd_quote_anchors
    WHERE guidance_id = $1
    ORDER BY usage_count DESC, created_at DESC
  `, [guidanceId]);

  return result.rows;
}

/**
 * Search for items that have a specific quote
 */
export async function findItemsByQuote(quoteFragment) {
  const result = await query(`
    SELECT
      q.guidance_id,
      q.quote_text,
      q.confidence,
      g.title,
      g.source_type
    FROM mrd_quote_anchors q
    JOIN mrd_guidance_items g ON q.guidance_id = g.id
    WHERE q.quote_text ILIKE $1
    ORDER BY q.confidence DESC, q.usage_count DESC
    LIMIT 10
  `, [`%${quoteFragment}%`]);

  return result.rows;
}

/**
 * Get quote anchor statistics
 */
export async function getQuoteStats() {
  const result = await query(`
    SELECT * FROM v_quote_anchor_stats
  `);

  const totalResult = await query(`
    SELECT
      COUNT(DISTINCT guidance_id) as items_with_anchors,
      COUNT(*) as total_anchors,
      AVG(confidence) as avg_confidence
    FROM mrd_quote_anchors
  `);

  return {
    bySourceType: result.rows,
    totals: totalResult.rows[0],
  };
}

export default {
  extractAndStoreQuote,
  anchorResponseQuotes,
  getQuoteAnchors,
  findItemsByQuote,
  getQuoteStats,
};
