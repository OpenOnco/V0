/**
 * Multi-Hash Computation for Policy Documents
 *
 * v2 change detection uses 4 separate hashes to identify meaningful changes:
 *
 * 1. contentHash - Full canonicalized content (catches everything)
 * 2. metadataHash - Effective/revision dates, policy IDs (detects version changes)
 * 3. criteriaHash - Coverage criteria section only (most important for coverage)
 * 4. codesHash - CPT/PLA/HCPCS code tables (billing changes)
 *
 * Trigger priority:
 * - criteriaHash change → HIGH priority, always analyze
 * - codesHash change → HIGH priority, always analyze
 * - metadataHash change → MEDIUM priority, analyze for effective date changes
 * - contentHash only change → LOW priority, may skip (boilerplate changes)
 */

import crypto from 'crypto';

/**
 * Compute SHA256 hash of a string
 * @param {string} content - Content to hash
 * @returns {string} Hex-encoded SHA256 hash
 */
export function sha256(content) {
  if (!content) return null;
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Compute all 4 hashes for a policy document
 * @param {string} canonicalizedContent - Full canonicalized content
 * @param {Object} extractedData - Pre-extracted structured data
 * @returns {Object} { contentHash, metadataHash, criteriaHash, codesHash }
 */
export function computeMultiHash(canonicalizedContent, extractedData = {}) {
  return {
    // Full content hash (for catch-all change detection)
    contentHash: sha256(canonicalizedContent),

    // Metadata hash (dates, policy IDs, version numbers)
    metadataHash: computeMetadataHash(extractedData),

    // Criteria section hash (coverage position, medical necessity language)
    criteriaHash: computeCriteriaHash(extractedData),

    // Code table hash (CPT, PLA, HCPCS codes)
    codesHash: computeCodesHash(extractedData),
  };
}

/**
 * Compute hash of metadata fields
 * @param {Object} data - Extracted data
 * @returns {string|null} Hash or null if no metadata
 */
export function computeMetadataHash(data) {
  const metadata = {
    effectiveDate: data.effectiveDate || null,
    revisionDate: data.revisionDate || null,
    lastReviewed: data.lastReviewed || null,
    policyId: data.policyId || null,
    policyNumber: data.policyNumber || null,
    version: data.version || null,
  };

  // Only hash if we have at least one field
  const hasData = Object.values(metadata).some(v => v !== null);
  if (!hasData) return null;

  // Sort keys for consistent hashing
  const normalized = JSON.stringify(metadata, Object.keys(metadata).sort());
  return sha256(normalized);
}

/**
 * Compute hash of criteria section
 * @param {Object} data - Extracted data
 * @returns {string|null} Hash or null if no criteria
 */
export function computeCriteriaHash(data) {
  // If we have a pre-extracted criteria section, use it
  if (data.criteriaSection) {
    return sha256(data.criteriaSection);
  }

  // Otherwise, build from structured criteria
  const criteria = {
    stance: data.stance || null, // proven, investigational, unproven, etc.
    indications: data.indications || [],
    limitations: data.limitations || [],
    requirements: data.requirements || [],
    exclusions: data.exclusions || [],
    namedTests: data.namedTests || [],
  };

  // Only hash if we have meaningful criteria
  const hasData = criteria.stance ||
    criteria.indications.length > 0 ||
    criteria.limitations.length > 0 ||
    criteria.namedTests.length > 0;

  if (!hasData) return null;

  const normalized = JSON.stringify(criteria, Object.keys(criteria).sort());
  return sha256(normalized);
}

/**
 * Compute hash of billing codes
 * @param {Object} data - Extracted data
 * @returns {string|null} Hash or null if no codes
 */
export function computeCodesHash(data) {
  const codes = {
    cpt: (data.codes?.cpt || []).slice().sort(),
    pla: (data.codes?.pla || []).slice().sort(),
    hcpcs: (data.codes?.hcpcs || []).slice().sort(),
    icd10: (data.codes?.icd10 || []).slice().sort(),
  };

  // Only hash if we have at least one code
  const hasData = codes.cpt.length > 0 ||
    codes.pla.length > 0 ||
    codes.hcpcs.length > 0 ||
    codes.icd10.length > 0;

  if (!hasData) return null;

  const normalized = JSON.stringify(codes, Object.keys(codes).sort());
  return sha256(normalized);
}

/**
 * Compare two multi-hash objects and determine change priority
 * @param {Object} oldHashes - Previous hashes { contentHash, metadataHash, criteriaHash, codesHash }
 * @param {Object} newHashes - Current hashes
 * @returns {Object} { changed, priority, changedHashes, analysis }
 */
export function compareMultiHash(oldHashes, newHashes) {
  if (!oldHashes) {
    return {
      changed: true,
      priority: 'high',
      changedHashes: ['new_document'],
      analysis: 'New document (no previous hash)',
    };
  }

  const changedHashes = [];
  const reasons = [];

  // Check criteria hash (HIGH priority)
  if (newHashes.criteriaHash !== oldHashes.criteriaHash) {
    changedHashes.push('criteria');
    reasons.push('Coverage criteria changed');
  }

  // Check codes hash (HIGH priority)
  if (newHashes.codesHash !== oldHashes.codesHash) {
    changedHashes.push('codes');
    reasons.push('Billing codes changed');
  }

  // Check metadata hash (MEDIUM priority)
  if (newHashes.metadataHash !== oldHashes.metadataHash) {
    changedHashes.push('metadata');
    reasons.push('Policy metadata changed (dates/version)');
  }

  // Check content hash (LOW priority if only change)
  if (newHashes.contentHash !== oldHashes.contentHash) {
    changedHashes.push('content');
    if (changedHashes.length === 1) {
      reasons.push('Content changed (boilerplate only)');
    }
  }

  // Determine priority
  let priority = 'none';
  if (changedHashes.includes('criteria') || changedHashes.includes('codes')) {
    priority = 'high';
  } else if (changedHashes.includes('metadata')) {
    priority = 'medium';
  } else if (changedHashes.includes('content')) {
    priority = 'low';
  }

  return {
    changed: changedHashes.length > 0,
    priority,
    changedHashes,
    analysis: reasons.join('; ') || 'No changes detected',
  };
}

/**
 * Determine if a change should trigger analysis
 * @param {Object} comparison - Result from compareMultiHash
 * @param {string} minPriority - Minimum priority to trigger ('high', 'medium', 'low')
 * @returns {boolean}
 */
export function shouldAnalyze(comparison, minPriority = 'medium') {
  if (!comparison.changed) return false;

  const priorityOrder = ['none', 'low', 'medium', 'high'];
  const compPriority = priorityOrder.indexOf(comparison.priority);
  const minPriorityIndex = priorityOrder.indexOf(minPriority);

  return compPriority >= minPriorityIndex;
}

/**
 * Extract hash comparison summary for logging/storage
 * @param {Object} comparison - Result from compareMultiHash
 * @returns {string} Human-readable summary
 */
export function getChangeSummary(comparison) {
  if (!comparison.changed) {
    return 'No changes';
  }

  const hashLabels = {
    new_document: 'New document',
    criteria: 'Criteria',
    codes: 'Codes',
    metadata: 'Metadata',
    content: 'Content',
  };

  const changedLabels = comparison.changedHashes
    .map(h => hashLabels[h] || h)
    .join(', ');

  return `[${comparison.priority.toUpperCase()}] Changed: ${changedLabels}`;
}

export default {
  sha256,
  computeMultiHash,
  computeMetadataHash,
  computeCriteriaHash,
  computeCodesHash,
  compareMultiHash,
  shouldAnalyze,
  getChangeSummary,
};
