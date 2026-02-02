/**
 * Extraction Patterns
 *
 * Regex patterns for fast filtering before AI analysis.
 * Used to reduce Claude API calls by ~90% through pre-filtering.
 *
 * Three-stage pipeline:
 * 1. Regex Filter (fast, cheap) - filters pages with keyword matches
 * 2. Change Detection (hash comparison) - only changed pages proceed
 * 3. AI Analysis (Claude, expensive) - extracts structured data
 */

/**
 * Coverage-related patterns
 * Matches: coverage announcements, reimbursement decisions, payer partnerships
 */
export const COVERAGE_PATTERNS = [
  // Coverage status
  /\bcover(age|ed|s|ing)?\b/i,
  /\breimburse?(ment|d|s)?\b/i,
  /\bprior\s*auth(orization)?\b/i,
  /\bmedical\s*policy\b/i,
  /\bmedical\s*necessity\b/i,

  // CMS/Medicare terms
  /\b(LCD|NCD|MolDX)\b/i,
  /\bmedicare\b/i,
  /\bmedicaid\b/i,
  /\bCMS\b/,

  // Network status
  /\bin-network\b/i,
  /\bout-of-network\b/i,
  /\bpreferred\s*provider\b/i,

  // Major payer names
  /\bUnited\s*Health(care)?\b/i,
  /\bAetna\b/i,
  /\bCigna\b/i,
  /\bAnthem\b/i,
  /\bBCBS\b/i,
  /\bBlue\s*Cross\b/i,
  /\bHumana\b/i,
  /\bKaiser\b/i,
];

/**
 * Performance-related patterns
 * Matches: sensitivity, specificity, clinical validation data
 */
export const PERFORMANCE_PATTERNS = [
  // Core metrics
  /\bsensitiv(ity|e)\b/i,
  /\bspecific(ity)?\b/i,
  /\bPPV\b/,
  /\bNPV\b/,
  /\baccuracy\b/i,
  /\bprecision\b/i,

  // Clinical metrics with percentages
  /\d+(\.\d+)?%\s*(sensitiv|specific|accuracy|PPV|NPV)/i,
  /(sensitiv|specific|accuracy|PPV|NPV)[^.]{0,20}\d+(\.\d+)?%/i,

  // Turnaround time
  /\bturnaround\b/i,
  /\bTAT\b/,
  /\b\d+\s*(day|hour|week)s?\s*(turnaround|TAT)/i,

  // Clinical validation
  /\bclinical\s*(validation|trial|study)\b/i,
  /\bFDA\s*(approv|clear|grant)\b/i,
  /\bbreakthrough\s*designation\b/i,
  /\bNCT\d{8}\b/, // Clinical trial ID

  // Study types
  /\bprospective\b/i,
  /\bretrospective\b/i,
  /\brandomized\b/i,
  /\bpeer[\s-]*reviewed\b/i,
  /\bpublished\b/i,
];

/**
 * New test detection patterns
 * Matches: product launches, new offerings, FDA approvals
 */
export const NEW_TEST_PATTERNS = [
  // Launch language
  /\blaunch(es|ed|ing)?\b/i,
  /\bannounc(e|es|ed|ing|ement)\b/i,
  /\bintroduc(e|es|ed|ing|tion)\b/i,
  /\bnow\s*available\b/i,
  /\bavailable\s*now\b/i,
  /\brolling\s*out\b/i,

  // New product language
  /\bnew\s*(test|assay|product|offering)\b/i,
  /\bfirst[\s-]*(of|in)[\s-]*class\b/i,
  /\bnovel\b/i,
  /\bnext[\s-]*generation\b/i,

  // FDA approvals
  /\bFDA\s*(approv|clear|grant|authoriz)\b/i,
  /\b510\(k\)\b/i,
  /\bde\s*novo\b/i,
  /\bPMA\b/,

  // Expansion language
  /\bexpand(s|ed|ing)?\s*(to|into|coverage)\b/i,
  /\bnew\s*indication\b/i,
];

/**
 * PLA code patterns
 * Matches: Proprietary Laboratory Analyses codes (0XXXU format)
 */
export const PLA_CODE_PATTERNS = [
  /\b0\d{3}U\b/,           // Standard PLA code format
  /\bPLA\s*code\b/i,
  /\bCPT\s*code\b/i,
  /\bAMA\s*code\b/i,
];

/**
 * Financial/pricing patterns
 * Matches: pricing, patient assistance, copay info
 */
export const FINANCIAL_PATTERNS = [
  // Pricing
  /\$\d{1,3}(,\d{3})*(\.\d{2})?\b/, // Dollar amounts
  /\bcash\s*price\b/i,
  /\blist\s*price\b/i,
  /\bout[\s-]*of[\s-]*pocket\b/i,

  // Patient assistance
  /\bpatient\s*assist(ance)?\b/i,
  /\bfinancial\s*assist(ance)?\b/i,
  /\bcopay\s*(assist|program|card)\b/i,
  /\bPAP\b/,
  /\bcompassionate\b/i,

  // Payment terms
  /\bpayment\s*plan\b/i,
  /\binterest[\s-]*free\b/i,
  /\bno\s*cost\b/i,
  /\bfree\s*(of\s*charge|testing)\b/i,
];

/**
 * Check if content matches any patterns in an array
 * @param {string} content - Content to check
 * @param {RegExp[]} patterns - Array of patterns to test
 * @returns {Object} { matches: boolean, matchedPatterns: string[] }
 */
export function matchPatterns(content, patterns) {
  const matchedPatterns = [];

  for (const pattern of patterns) {
    if (pattern.test(content)) {
      matchedPatterns.push(pattern.source);
    }
  }

  return {
    matches: matchedPatterns.length > 0,
    matchedPatterns,
    count: matchedPatterns.length,
  };
}

/**
 * Categorize content based on pattern matches
 * @param {string} content - Content to analyze
 * @returns {Object} Categories that matched with their patterns
 */
export function categorizeContent(content) {
  return {
    coverage: matchPatterns(content, COVERAGE_PATTERNS),
    performance: matchPatterns(content, PERFORMANCE_PATTERNS),
    newTest: matchPatterns(content, NEW_TEST_PATTERNS),
    plaCode: matchPatterns(content, PLA_CODE_PATTERNS),
    financial: matchPatterns(content, FINANCIAL_PATTERNS),
  };
}

/**
 * Check if content is relevant for analysis
 * @param {string} content - Content to check
 * @param {string[]} categories - Categories to check (default: all)
 * @returns {boolean} True if any category matches
 */
export function isRelevantContent(content, categories = ['coverage', 'performance', 'newTest']) {
  const categorized = categorizeContent(content);

  for (const category of categories) {
    if (categorized[category]?.matches) {
      return true;
    }
  }

  return false;
}

/**
 * Get all matching categories for content
 * @param {string} content - Content to analyze
 * @returns {string[]} Array of matching category names
 */
export function getMatchingCategories(content) {
  const categorized = categorizeContent(content);
  const matching = [];

  for (const [category, result] of Object.entries(categorized)) {
    if (result.matches) {
      matching.push(category);
    }
  }

  return matching;
}

export default {
  COVERAGE_PATTERNS,
  PERFORMANCE_PATTERNS,
  NEW_TEST_PATTERNS,
  PLA_CODE_PATTERNS,
  FINANCIAL_PATTERNS,
  matchPatterns,
  categorizeContent,
  isRelevantContent,
  getMatchingCategories,
};
