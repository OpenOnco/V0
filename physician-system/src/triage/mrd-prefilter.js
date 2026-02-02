/**
 * MRD Pre-filter: Keyword-based filtering before AI triage
 * Reduces volume and cost by filtering out obviously irrelevant content
 *
 * Now uses centralized oncology-terms.js for term definitions
 */

import {
  MRD_TERM_ONTOLOGY,
  HEMATOLOGIC_EXCLUSIONS,
  getAllSolidTumorTerms,
  extractCancerTypes,
  containsHematologic,
} from '../config/oncology-terms.js';

// Import terms from ontology
const PRIMARY_TERMS = MRD_TERM_ONTOLOGY.primary;
const CONTEXT_TERMS = MRD_TERM_ONTOLOGY.context;
const TEST_TERMS = MRD_TERM_ONTOLOGY.tests;
const EXCLUDE_TERMS = HEMATOLOGIC_EXCLUSIONS;
const SOLID_TUMOR_TERMS = getAllSolidTumorTerms();

/**
 * Check if text passes the pre-filter
 * @param {string} title - Article title
 * @param {string} abstract - Article abstract
 * @returns {{passes: boolean, reason: string, score: number, cancerTypes: string[]}}
 */
export function prefilter(title, abstract = '') {
  const text = `${title} ${abstract}`.toLowerCase();

  // Check for hematologic malignancies (exclusion)
  if (containsHematologic(text)) {
    const matchedExclusion = EXCLUDE_TERMS.find(term => text.includes(term));
    return {
      passes: false,
      reason: `Excluded (hematologic): ${matchedExclusion}`,
      score: 0,
      cancerTypes: [],
    };
  }

  // Check for at least one primary MRD term
  let hasPrimaryTerm = false;
  let matchedPrimary = null;

  for (const term of PRIMARY_TERMS) {
    if (text.includes(term.toLowerCase())) {
      hasPrimaryTerm = true;
      matchedPrimary = term;
      break;
    }
  }

  // Also check for test names as primary indicators
  if (!hasPrimaryTerm) {
    for (const term of TEST_TERMS) {
      if (text.includes(term.toLowerCase())) {
        hasPrimaryTerm = true;
        matchedPrimary = `test:${term}`;
        break;
      }
    }
  }

  if (!hasPrimaryTerm) {
    return {
      passes: false,
      reason: 'No primary MRD terms found',
      score: 0,
      cancerTypes: [],
    };
  }

  // Extract all cancer types mentioned
  const cancerTypes = extractCancerTypes(text);
  const hasSolidTumor = cancerTypes.length > 0;

  // Calculate relevance score
  let score = 1;

  // Primary term match
  if (hasPrimaryTerm) score += 2;

  // Solid tumor context - bonus for each cancer type (max +3)
  score += Math.min(cancerTypes.length * 2, 3);

  // Context terms (max +3)
  let contextMatches = 0;
  for (const term of CONTEXT_TERMS) {
    if (text.includes(term.toLowerCase())) {
      contextMatches++;
    }
  }
  score += Math.min(contextMatches, 3);

  // Evidence terms bonus
  for (const term of MRD_TERM_ONTOLOGY.evidence) {
    if (text.includes(term.toLowerCase())) {
      score += 0.5;
    }
  }

  // Cap score at 10
  score = Math.min(score, 10);

  // Build reason string
  const tumorContext = hasSolidTumor
    ? `cancer: ${cancerTypes.join(', ')}`
    : 'no specific cancer type';

  return {
    passes: true,
    reason: `Matched: ${matchedPrimary}, ${tumorContext}`,
    score,
    cancerTypes,
  };
}

/**
 * Batch pre-filter articles
 * @param {Object[]} articles - Array of articles with title and abstract
 * @param {Object} options - Filter options
 * @returns {{passed: Object[], rejected: Object[]}}
 */
export function batchPrefilter(articles, options = {}) {
  const { minScore = 2 } = options;
  const passed = [];
  const rejected = [];

  for (const article of articles) {
    const result = prefilter(article.title, article.abstract);

    if (result.passes && result.score >= minScore) {
      passed.push({
        ...article,
        prefilterScore: result.score,
        prefilterReason: result.reason,
        cancerTypes: result.cancerTypes,
      });
    } else {
      rejected.push({
        ...article,
        prefilterReason: result.reason,
        prefilterScore: result.score,
      });
    }
  }

  // Sort passed by score (highest first)
  passed.sort((a, b) => b.prefilterScore - a.prefilterScore);

  return { passed, rejected };
}

/**
 * Get stats on pre-filter results
 * @param {Object[]} articles - Array of articles
 * @returns {Object} - Stats object
 */
export function getPrefilterStats(articles) {
  const { passed, rejected } = batchPrefilter(articles);

  // Count by cancer type
  const byCancerType = {};
  for (const article of passed) {
    for (const type of article.cancerTypes || []) {
      byCancerType[type] = (byCancerType[type] || 0) + 1;
    }
  }

  return {
    total: articles.length,
    passed: passed.length,
    rejected: rejected.length,
    passRate: (passed.length / articles.length * 100).toFixed(1) + '%',
    avgScore: passed.length > 0
      ? (passed.reduce((sum, a) => sum + a.prefilterScore, 0) / passed.length).toFixed(2)
      : 0,
    byCancerType,
  };
}

export default {
  prefilter,
  batchPrefilter,
  getPrefilterStats,
  PRIMARY_TERMS,
  CONTEXT_TERMS,
  EXCLUDE_TERMS,
  SOLID_TUMOR_TERMS,
};
