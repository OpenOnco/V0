/**
 * Cross-Link: Link clinical trials to their publications
 * Uses NCT number mentions and embedding similarity
 */

import { query, transaction } from '../db/client.js';
import { embed } from './mrd-embedder.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mrd-crosslink');

// Confidence thresholds
const NCT_MENTION_CONFIDENCE = 1.0;
const EMBEDDING_MATCH_CONFIDENCE = 0.85;
const EMBEDDING_MIN_SIMILARITY = 0.80;  // Lowered from 0.82 to capture more potential links

/**
 * Find publications that mention NCT numbers
 * @param {string} nctNumber - NCT number to search for
 * @returns {Promise<Object[]>}
 */
export async function findPublicationsByNCT(nctNumber) {
  const result = await query(
    `SELECT id, title, source_type, source_id, source_url
     FROM mrd_guidance_items
     WHERE (full_text_excerpt ILIKE $1 OR title ILIKE $1 OR summary ILIKE $1)
       AND is_superseded = FALSE`,
    [`%${nctNumber}%`]
  );

  return result.rows.map((row) => ({
    guidanceId: row.id,
    title: row.title,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    matchMethod: 'nct_mention',
    confidence: NCT_MENTION_CONFIDENCE,
  }));
}

/**
 * Find publications by embedding similarity to trial
 * @param {Object} trial - Trial with brief_title and acronym
 * @returns {Promise<Object[]>}
 */
export async function findPublicationsByEmbedding(trial) {
  // Build search text from trial
  const searchText = [
    trial.brief_title,
    trial.acronym,
    trial.official_title,
  ].filter(Boolean).join(' ');

  const embedding = await embed(searchText);

  const result = await query(
    `SELECT
       g.id,
       g.title,
       g.source_type,
       g.source_id,
       g.source_url,
       1 - (e.embedding <=> $1::vector) as similarity
     FROM mrd_item_embeddings e
     JOIN mrd_guidance_items g ON e.guidance_id = g.id
     WHERE g.is_superseded = FALSE
       AND g.evidence_type IN ('rct_results', 'observational', 'meta_analysis')
       AND 1 - (e.embedding <=> $1::vector) >= $2
     ORDER BY similarity DESC
     LIMIT 10`,
    [JSON.stringify(embedding), EMBEDDING_MIN_SIMILARITY]
  );

  return result.rows.map((row) => ({
    guidanceId: row.id,
    title: row.title,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    matchMethod: 'embedding',
    confidence: row.similarity * EMBEDDING_MATCH_CONFIDENCE,
    similarity: parseFloat(row.similarity),
  }));
}

/**
 * Link a trial to its publications
 * @param {Object} trial - Trial object
 * @returns {Promise<Object[]>} - Created links
 */
export async function linkTrialToPublications(trial) {
  const links = [];

  // Method 1: NCT number mentions
  const nctMatches = await findPublicationsByNCT(trial.nct_number);
  for (const match of nctMatches) {
    links.push({
      trialId: trial.id,
      ...match,
    });
  }

  // Method 2: Embedding similarity (only if acronym or title available)
  if (trial.acronym || trial.brief_title) {
    const embeddingMatches = await findPublicationsByEmbedding(trial);

    for (const match of embeddingMatches) {
      // Don't add if already matched by NCT
      if (!links.find((l) => l.guidanceId === match.guidanceId)) {
        links.push({
          trialId: trial.id,
          ...match,
        });
      }
    }
  }

  // Store links in database
  for (const link of links) {
    try {
      await query(
        `INSERT INTO mrd_trial_publications (trial_id, guidance_id, match_confidence, match_method)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (trial_id, guidance_id) DO UPDATE SET
           match_confidence = GREATEST(mrd_trial_publications.match_confidence, $3),
           match_method = CASE
             WHEN $3 > mrd_trial_publications.match_confidence THEN $4
             ELSE mrd_trial_publications.match_method
           END`,
        [link.trialId, link.guidanceId, link.confidence, link.matchMethod]
      );
    } catch (error) {
      logger.warn('Failed to create link', {
        trial: trial.nct_number,
        guidance: link.guidanceId,
        error: error.message,
      });
    }
  }

  logger.info('Linked trial to publications', {
    nct: trial.nct_number,
    linksCreated: links.length,
    byNCT: nctMatches.length,
    byEmbedding: links.length - nctMatches.length,
  });

  return links;
}

/**
 * Run batch linking for all trials without links
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Stats
 */
export async function linkAllTrials(options = {}) {
  const { limit = 100, batchSize = 5 } = options;

  // Find trials without links
  const result = await query(
    `SELECT t.* FROM mrd_clinical_trials t
     LEFT JOIN mrd_trial_publications tp ON t.id = tp.trial_id
     WHERE tp.trial_id IS NULL
     ORDER BY t.last_update_date DESC
     LIMIT $1`,
    [limit]
  );

  const trials = result.rows;
  logger.info('Found trials needing linking', { count: trials.length });

  if (trials.length === 0) {
    return { processed: 0, linked: 0, totalLinks: 0 };
  }

  let linked = 0;
  let totalLinks = 0;

  for (let i = 0; i < trials.length; i += batchSize) {
    const batch = trials.slice(i, i + batchSize);

    for (const trial of batch) {
      const links = await linkTrialToPublications(trial);
      if (links.length > 0) {
        linked++;
        totalLinks += links.length;
      }
    }

    // Rate limiting
    if (i + batchSize < trials.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  logger.info('Batch linking complete', { processed: trials.length, linked, totalLinks });
  return { processed: trials.length, linked, totalLinks };
}

/**
 * Get publications linked to a trial
 * @param {number} trialId - Trial ID
 * @returns {Promise<Object[]>}
 */
export async function getTrialPublications(trialId) {
  const result = await query(
    `SELECT
       g.id,
       g.title,
       g.source_type,
       g.source_id,
       g.source_url,
       g.publication_date,
       g.journal,
       tp.match_confidence,
       tp.match_method
     FROM mrd_trial_publications tp
     JOIN mrd_guidance_items g ON tp.guidance_id = g.id
     WHERE tp.trial_id = $1
     ORDER BY tp.match_confidence DESC`,
    [trialId]
  );

  return result.rows;
}

/**
 * Get trials linked to a publication
 * @param {number} guidanceId - Guidance item ID
 * @returns {Promise<Object[]>}
 */
export async function getPublicationTrials(guidanceId) {
  const result = await query(
    `SELECT
       t.id,
       t.nct_number,
       t.brief_title,
       t.acronym,
       t.status,
       t.phase,
       tp.match_confidence,
       tp.match_method
     FROM mrd_trial_publications tp
     JOIN mrd_clinical_trials t ON tp.trial_id = t.id
     WHERE tp.guidance_id = $1
     ORDER BY tp.match_confidence DESC`,
    [guidanceId]
  );

  return result.rows;
}

export default {
  findPublicationsByNCT,
  findPublicationsByEmbedding,
  linkTrialToPublications,
  linkAllTrials,
  getTrialPublications,
  getPublicationTrials,
};
