/**
 * Discovery Keywords
 *
 * Keywords and patterns used by the discovery crawler to find
 * relevant policy documents on payer websites.
 */

/**
 * Primary search keywords
 * High-value terms that indicate MRD/liquid biopsy relevance
 */
export const PRIMARY_KEYWORDS = [
  // Core technology terms
  'ctDNA',
  'circulating tumor DNA',
  'liquid biopsy',
  'cell-free DNA',
  'cfDNA',

  // MRD-specific
  'minimal residual disease',
  'molecular residual disease',
  'MRD',
  'MRD testing',
  'MRD monitoring',

  // Technology approaches
  'tumor-informed',
  'tumor informed',
  'tumor-naive',
  'tumor agnostic',
];

/**
 * Named test keywords
 * Specific tests we track in our database
 */
export const TEST_KEYWORDS = [
  // MRD tests
  'Signatera',
  'RaDaR',
  'Guardant Reveal',
  'NavDx',
  'clonoSEQ',
  'Haystack MRD',
  'NeXT Personal',
  'Oncodetect',
  'Pathlight',
  'Foresight',
  'PredicineATLAS',

  // Liquid biopsy panels
  'Guardant360',
  'FoundationOne Liquid',
  'Tempus xF',
  'ctDx',

  // Early detection
  'Galleri',
  'MCED',
  'multi-cancer early detection',
];

/**
 * Operational keywords
 * Terms that indicate coverage/policy relevance
 */
export const OPERATIONAL_KEYWORDS = [
  // Coverage terms
  'prior authorization',
  'medical necessity',
  'coverage criteria',
  'medical policy',

  // Stance terms
  'investigational',
  'experimental',
  'unproven',
  'not medically necessary',
  'medically necessary',

  // Document types
  'clinical policy',
  'utilization management',
  'UM criteria',
];

/**
 * Billing code keywords
 * PLA and CPT codes for MRD/liquid biopsy tests
 */
export const CODE_KEYWORDS = [
  // MRD PLA codes
  '0239U', // Signatera
  '0306U', // Guardant Reveal
  '0340U', // RaDaR
  '0356U', // NeXT Personal
  '0364U', // NavDx
  '0421U', // Oncodetect
  '0464U', // Haystack
  '0569U', // clonoSEQ

  // Common CPT
  '81479', // Unlisted molecular pathology
  '81599', // Unlisted multianalyte assay
];

/**
 * Negative keywords
 * Terms that indicate a document is NOT relevant
 */
export const NEGATIVE_KEYWORDS = [
  'prenatal',
  'maternal',
  'fetal',
  'newborn screening',
  'carrier screening',
  'pharmacogenomics',
  'pharmacogenetic',
  'HLA typing',
  'paternity',
  'forensic',
];

/**
 * Document title patterns that indicate policy relevance
 */
export const POLICY_TITLE_PATTERNS = [
  /liquid\s+biopsy/i,
  /ctDNA/i,
  /circulating\s+tumor/i,
  /molecular\s+(?:residual\s+)?disease/i,
  /minimal\s+residual\s+disease/i,
  /MRD\s+(?:test|monitor)/i,
  /cell.?free\s+DNA/i,
  /tumor.?informed/i,
  /molecular\s+oncology/i,
  /genetic\s+testing/i,
  /molecular\s+profiling/i,
];

/**
 * URL patterns that suggest policy documents
 */
export const POLICY_URL_PATTERNS = [
  /medical.?polic/i,
  /clinical.?polic/i,
  /coverage.?polic/i,
  /utilization/i,
  /prior.?auth/i,
  /guidelines?/i,
  /criteria/i,
  /\.pdf$/i,
];

/**
 * Build search query for a payer
 * @param {string} payerName - Payer name
 * @param {string} queryType - 'primary', 'tests', 'codes', 'all'
 * @returns {string[]} Search queries
 */
export function buildSearchQueries(payerName, queryType = 'all') {
  const queries = [];
  const year = new Date().getFullYear();

  if (queryType === 'primary' || queryType === 'all') {
    // Primary terms
    queries.push(`"${payerName}" liquid biopsy ctDNA medical policy ${year}`);
    queries.push(`"${payerName}" circulating tumor DNA coverage policy`);
    queries.push(`"${payerName}" MRD molecular residual disease`);
  }

  if (queryType === 'tests' || queryType === 'all') {
    // Named tests
    queries.push(`"${payerName}" Signatera coverage`);
    queries.push(`"${payerName}" Guardant Reveal MRD`);
    queries.push(`"${payerName}" clonoSEQ policy`);
  }

  if (queryType === 'codes' || queryType === 'all') {
    // PLA codes
    queries.push(`"${payerName}" 0239U 0306U coverage`);
    queries.push(`"${payerName}" 81479 molecular pathology`);
  }

  return queries;
}

/**
 * Calculate relevance score for a discovered document
 * @param {Object} doc - { title, url, snippet }
 * @returns {number} 0-1 relevance score
 */
export function calculateDocumentRelevance(doc) {
  let score = 0;
  const text = `${doc.title || ''} ${doc.snippet || ''} ${doc.url || ''}`.toLowerCase();

  // Check primary keywords (high value)
  for (const kw of PRIMARY_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      score += 0.15;
    }
  }

  // Check test keywords (high value)
  for (const kw of TEST_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      score += 0.1;
    }
  }

  // Check operational keywords (medium value)
  for (const kw of OPERATIONAL_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      score += 0.05;
    }
  }

  // Check code keywords (high value)
  for (const kw of CODE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      score += 0.1;
    }
  }

  // Check negative keywords (penalty)
  for (const kw of NEGATIVE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      score -= 0.15;
    }
  }

  // Bonus for PDF URLs
  if (doc.url && /\.pdf$/i.test(doc.url)) {
    score += 0.1;
  }

  // Bonus for policy-like URLs
  for (const pattern of POLICY_URL_PATTERNS) {
    if (doc.url && pattern.test(doc.url)) {
      score += 0.05;
      break;
    }
  }

  return Math.min(1.0, Math.max(0, score));
}

/**
 * Filter documents by relevance threshold
 * @param {Object[]} documents - Array of { title, url, snippet }
 * @param {number} threshold - Minimum relevance score (default 0.3)
 * @returns {Object[]} Filtered documents with scores
 */
export function filterByRelevance(documents, threshold = 0.3) {
  return documents
    .map(doc => ({
      ...doc,
      relevanceScore: calculateDocumentRelevance(doc),
    }))
    .filter(doc => doc.relevanceScore >= threshold)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Get matched keywords for a document
 * @param {Object} doc - { title, url, snippet }
 * @returns {string[]} Matched keywords
 */
export function getMatchedKeywords(doc) {
  const text = `${doc.title || ''} ${doc.snippet || ''} ${doc.url || ''}`.toLowerCase();
  const matched = [];

  const allKeywords = [
    ...PRIMARY_KEYWORDS,
    ...TEST_KEYWORDS,
    ...OPERATIONAL_KEYWORDS,
    ...CODE_KEYWORDS,
  ];

  for (const kw of allKeywords) {
    if (text.includes(kw.toLowerCase())) {
      matched.push(kw);
    }
  }

  return [...new Set(matched)];
}

/**
 * Guess document type from URL and title
 * @param {Object} doc - { title, url }
 * @returns {string} medical_policy | um_criteria | lbm_guideline | provider_bulletin | unknown
 */
export function guessDocType(doc) {
  const text = `${doc.title || ''} ${doc.url || ''}`.toLowerCase();

  if (/um\s*criteria|utilization\s*management|prior\s*auth/i.test(text)) {
    return 'um_criteria';
  }
  if (/guideline|carelon|evicore/i.test(text)) {
    return 'lbm_guideline';
  }
  if (/bulletin|announcement|update|alert/i.test(text)) {
    return 'provider_bulletin';
  }
  if (/medical\s*polic|clinical\s*polic|coverage\s*polic/i.test(text)) {
    return 'medical_policy';
  }

  return 'unknown';
}

export default {
  PRIMARY_KEYWORDS,
  TEST_KEYWORDS,
  OPERATIONAL_KEYWORDS,
  CODE_KEYWORDS,
  NEGATIVE_KEYWORDS,
  POLICY_TITLE_PATTERNS,
  POLICY_URL_PATTERNS,
  buildSearchQueries,
  calculateDocumentRelevance,
  filterByRelevance,
  getMatchedKeywords,
  guessDocType,
};
