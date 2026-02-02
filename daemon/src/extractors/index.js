/**
 * Extraction Pipeline
 *
 * Unified interface for deterministic data extraction from policy documents.
 * Runs BEFORE LLM analysis to provide structured metadata for:
 * - Multi-hash computation
 * - Confidence scoring
 * - LLM prompt enrichment
 */

import { extractAllDates, getMostRecentDate, isDateCurrent } from './dates.js';
import { extractAllCodes, detectMRDCodes, isLiquidBiopsyRelevant, getCodesFingerprint } from './codes.js';
import { extractNamedTests, detectMRDContent, extractTestIds } from './tests.js';
import { extractCriteriaSection, detectStance, extractAllCriteria } from './criteria.js';

// Re-export individual modules
export * from './dates.js';
export * from './codes.js';
export * from './tests.js';
export * from './criteria.js';

/**
 * Extract all structured data from a policy document
 * @param {string} content - Document content (text extracted from PDF/HTML)
 * @param {Object} options - { docType, payerId }
 * @returns {Object} Comprehensive extraction result
 */
export async function extractStructuredData(content, options = {}) {
  const { docType = null, payerId = null } = options;

  // Extract dates
  const dates = extractAllDates(content);
  const mostRecentDate = getMostRecentDate(dates);
  const effectiveDateCurrent = isDateCurrent(dates.effectiveDate);

  // Extract codes
  const codes = extractAllCodes(content);
  const mrdCodeDetection = detectMRDCodes(content);
  const codesFingerprint = getCodesFingerprint(codes);
  const liquidBiopsyRelevant = isLiquidBiopsyRelevant(codes);

  // Extract named tests
  const namedTests = extractNamedTests(content);
  const testIds = namedTests.map(t => t.id);
  const mrdContent = detectMRDContent(content);

  // Extract criteria
  const criteriaResult = extractAllCriteria(content, docType);

  // Compute relevance score
  const relevanceScore = computeRelevanceScore({
    namedTests,
    mrdCodeDetection,
    mrdContent,
    criteriaResult,
    liquidBiopsyRelevant,
  });

  return {
    // Dates
    effectiveDate: dates.effectiveDate,
    revisionDate: dates.revisionDate,
    reviewedDate: dates.reviewedDate,
    publishedDate: dates.publishedDate,
    nextReviewDate: dates.nextReviewDate,
    mostRecentDate,
    effectiveDateCurrent,

    // Codes
    codes,
    codesFingerprint,
    mrdPLACodes: mrdCodeDetection.plaCodes,
    mrdCPTCodes: mrdCodeDetection.cptCodes,
    hasMRDCodes: mrdCodeDetection.hasMRDCodes,
    liquidBiopsyRelevant,

    // Tests
    namedTests,
    testIds,
    testsMentioned: mrdContent.namedTests,
    categories: mrdContent.categories,
    isMRDRelated: mrdContent.isMRDRelated,

    // Criteria
    criteriaSection: criteriaResult.criteriaSection,
    stance: criteriaResult.stance,
    stanceConfidence: criteriaResult.stanceConfidence,
    stanceEvidence: criteriaResult.stanceEvidence,
    cancerTypes: criteriaResult.cancerTypes,
    stages: criteriaResult.stages,
    settings: criteriaResult.settings,
    priorAuth: criteriaResult.priorAuth,

    // Metadata
    relevanceScore,
    docType,
    payerId,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Compute relevance score for a document
 * Higher = more relevant to MRD/liquid biopsy coverage
 * @param {Object} data - Extracted data
 * @returns {number} 0-1 relevance score
 */
function computeRelevanceScore(data) {
  let score = 0;

  // Named tests found (high signal)
  if (data.namedTests.length > 0) {
    score += 0.4;
    score += Math.min(data.namedTests.length * 0.05, 0.15);
  }

  // MRD-specific PLA codes
  if (data.mrdCodeDetection.hasMRDCodes) {
    score += 0.25;
    score += Math.min(data.mrdCodeDetection.plaCodes.length * 0.05, 0.1);
  }

  // MRD/ctDNA category detected
  if (data.mrdContent.isMRDRelated) {
    score += 0.15;
  }

  // Has criteria section
  if (data.criteriaResult.criteriaSection) {
    score += 0.1;
  }

  // Liquid biopsy relevant codes
  if (data.liquidBiopsyRelevant) {
    score += 0.1;
  }

  return Math.min(1.0, score);
}

/**
 * Light extraction for quick relevance filtering
 * Use this before full extraction to filter irrelevant documents
 * @param {string} content - Document content
 * @returns {Object} { isRelevant, confidence, reason }
 */
export function quickRelevanceCheck(content) {
  // Fast checks first
  const mrdContent = detectMRDContent(content);

  if (mrdContent.namedTests.length > 0) {
    return {
      isRelevant: true,
      confidence: 0.9,
      reason: `Named tests found: ${mrdContent.namedTests.map(t => t.id).join(', ')}`,
    };
  }

  const mrdCodes = detectMRDCodes(content);
  if (mrdCodes.hasMRDCodes) {
    return {
      isRelevant: true,
      confidence: 0.85,
      reason: `MRD codes found: ${[...mrdCodes.plaCodes, ...mrdCodes.cptCodes].join(', ')}`,
    };
  }

  if (mrdContent.isMRDRelated) {
    return {
      isRelevant: true,
      confidence: 0.7,
      reason: `MRD-related content: ${mrdContent.categories.join(', ')}`,
    };
  }

  // Check for general liquid biopsy relevance
  const codes = extractAllCodes(content);
  if (isLiquidBiopsyRelevant(codes)) {
    return {
      isRelevant: true,
      confidence: 0.5,
      reason: 'Contains liquid biopsy relevant codes',
    };
  }

  return {
    isRelevant: false,
    confidence: 0.2,
    reason: 'No MRD/liquid biopsy content detected',
  };
}

/**
 * Calculate confidence score for an extraction
 * Based on quality of extracted data
 * @param {Object} extraction - Result from extractStructuredData
 * @returns {number} 0-1 confidence score
 */
export function calculateConfidence(extraction) {
  let score = 0.5;

  // Boost factors
  if (extraction.namedTests.length > 0) {
    score += 0.2;
  }
  if (extraction.criteriaSection) {
    score += 0.1;
  }
  if (extraction.effectiveDateCurrent) {
    score += 0.1;
  }
  if (extraction.stance !== 'unclear') {
    score += 0.05;
  }
  if (extraction.hasMRDCodes) {
    score += 0.05;
  }

  // Penalty factors
  if (extraction.stance === 'unclear') {
    score -= 0.1;
  }
  if (!extraction.effectiveDate && !extraction.revisionDate) {
    score -= 0.1;
  }
  if (extraction.namedTests.length === 0 && !extraction.hasMRDCodes) {
    score -= 0.1;
  }

  return Math.min(0.95, Math.max(0.1, score));
}

/**
 * Prepare extraction data for multi-hash computation
 * @param {Object} extraction - Result from extractStructuredData
 * @returns {Object} Data formatted for computeMultiHash
 */
export function prepareForMultiHash(extraction) {
  return {
    // Metadata for metadataHash
    effectiveDate: extraction.effectiveDate,
    revisionDate: extraction.revisionDate,
    lastReviewed: extraction.reviewedDate,
    policyId: null, // Would come from policy registry
    policyNumber: null,
    version: null,

    // Criteria for criteriaHash
    criteriaSection: extraction.criteriaSection,
    stance: extraction.stance,
    indications: extraction.cancerTypes,
    limitations: [],
    requirements: extraction.settings,
    exclusions: [],
    namedTests: extraction.testIds,

    // Codes for codesHash
    codes: extraction.codes,
  };
}

/**
 * Enrich LLM prompt with extracted data
 * Provides context to improve LLM analysis
 * @param {Object} extraction - Result from extractStructuredData
 * @returns {string} Context string for LLM prompt
 */
export function buildLLMContext(extraction) {
  const lines = ['Pre-extracted data from document:'];

  if (extraction.effectiveDate) {
    lines.push(`- Effective date: ${extraction.effectiveDate}`);
  }

  if (extraction.namedTests.length > 0) {
    const testNames = extraction.namedTests.map(t => t.id).join(', ');
    lines.push(`- Named tests found: ${testNames}`);
  }

  if (extraction.hasMRDCodes) {
    const codes = [...extraction.mrdPLACodes, ...extraction.mrdCPTCodes].join(', ');
    lines.push(`- MRD billing codes found: ${codes}`);
  }

  if (extraction.stance !== 'unclear') {
    lines.push(`- Detected stance: ${extraction.stance} (confidence: ${(extraction.stanceConfidence * 100).toFixed(0)}%)`);
  }

  if (extraction.cancerTypes.length > 0) {
    lines.push(`- Cancer types mentioned: ${extraction.cancerTypes.join(', ')}`);
  }

  if (extraction.priorAuth !== 'unknown') {
    lines.push(`- Prior auth: ${extraction.priorAuth}`);
  }

  return lines.join('\n');
}

export default {
  extractStructuredData,
  quickRelevanceCheck,
  calculateConfidence,
  prepareForMultiHash,
  buildLLMContext,
};
