/**
 * MRD Pre-filter: Keyword-based filtering before AI triage
 * Reduces volume and cost by filtering out obviously irrelevant content
 */

// Primary MRD terms that must be present
const PRIMARY_TERMS = [
  'mrd',
  'minimal residual disease',
  'molecular residual disease',
  'measurable residual disease',
  'ctdna',
  'circulating tumor dna',
  'cell-free dna',
  'cfdna',
  'liquid biopsy',
  'genomic profiling',
  'tumor-informed',
  'personalized assay',
  'tumor-naive',
];

// Context terms that increase relevance
const CONTEXT_TERMS = [
  'surveillance',
  'monitoring',
  'recurrence',
  'adjuvant',
  'neoadjuvant',
  'post-surgery',
  'postoperative',
  'treatment response',
  'therapy',
  'curative',
  'resection',
];

// Exclude terms (hematologic malignancies)
const EXCLUDE_TERMS = [
  'leukemia',
  'lymphoma',
  'myeloma',
  'aplastic anemia',
  'bone marrow transplant',
  'bmt',
];

// Solid tumor cancer types we care about
const SOLID_TUMOR_TERMS = [
  'colorectal',
  'colon cancer',
  'rectal cancer',
  'crc',
  'breast cancer',
  'lung cancer',
  'nsclc',
  'bladder cancer',
  'urothelial',
  'pancreatic',
  'melanoma',
  'ovarian',
  'gastric',
  'esophageal',
  'hepatocellular',
  'liver cancer',
  'prostate cancer',
  'renal',
  'kidney cancer',
  'solid tumor',
  'solid tumour',
  'head and neck',
  'thyroid',
  'endometrial',
  'sarcoma',
];

/**
 * Check if text passes the pre-filter
 * @param {string} title - Article title
 * @param {string} abstract - Article abstract
 * @returns {{passes: boolean, reason: string, score: number}}
 */
export function prefilter(title, abstract = '') {
  const text = `${title} ${abstract}`.toLowerCase();

  // Check for exclude terms (hematologic malignancies)
  for (const term of EXCLUDE_TERMS) {
    if (text.includes(term)) {
      return {
        passes: false,
        reason: `Excluded term: ${term}`,
        score: 0,
      };
    }
  }

  // Check for at least one primary MRD term
  let hasPrimaryTerm = false;
  let matchedPrimary = null;

  for (const term of PRIMARY_TERMS) {
    if (text.includes(term)) {
      hasPrimaryTerm = true;
      matchedPrimary = term;
      break;
    }
  }

  if (!hasPrimaryTerm) {
    return {
      passes: false,
      reason: 'No primary MRD terms found',
      score: 0,
    };
  }

  // Check for solid tumor context
  let hasSolidTumor = false;
  let matchedTumor = null;

  for (const term of SOLID_TUMOR_TERMS) {
    if (text.includes(term)) {
      hasSolidTumor = true;
      matchedTumor = term;
      break;
    }
  }

  // Calculate relevance score
  let score = 1;

  // Primary term match
  if (hasPrimaryTerm) score += 2;

  // Solid tumor context
  if (hasSolidTumor) score += 2;

  // Context terms
  let contextMatches = 0;
  for (const term of CONTEXT_TERMS) {
    if (text.includes(term)) {
      contextMatches++;
    }
  }
  score += Math.min(contextMatches, 3); // Max +3 for context

  // If no solid tumor context but has primary term, still pass
  // Removed score cap to avoid penalizing general MRD articles
  if (!hasSolidTumor && hasPrimaryTerm) {
    return {
      passes: true,
      reason: `Matched: ${matchedPrimary} (no specific cancer type)`,
      score,
    };
  }

  return {
    passes: true,
    reason: `Matched: ${matchedPrimary}, ${matchedTumor}`,
    score: Math.min(score, 10),
  };
}

/**
 * Batch pre-filter articles
 * @param {Object[]} articles - Array of articles with title and abstract
 * @returns {{passed: Object[], rejected: Object[]}}
 */
export function batchPrefilter(articles) {
  const passed = [];
  const rejected = [];

  for (const article of articles) {
    const result = prefilter(article.title, article.abstract);

    if (result.passes) {
      passed.push({
        ...article,
        prefilterScore: result.score,
        prefilterReason: result.reason,
      });
    } else {
      rejected.push({
        ...article,
        prefilterReason: result.reason,
      });
    }
  }

  return { passed, rejected };
}

/**
 * Get stats on pre-filter results
 * @param {Object[]} articles - Array of articles
 * @returns {Object} - Stats object
 */
export function getPrefilterStats(articles) {
  const { passed, rejected } = batchPrefilter(articles);

  return {
    total: articles.length,
    passed: passed.length,
    rejected: rejected.length,
    passRate: (passed.length / articles.length * 100).toFixed(1) + '%',
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
