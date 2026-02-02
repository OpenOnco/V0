/**
 * Coverage Reconciliation
 *
 * Reconciles coverage assertions from multiple sources/layers.
 * Detects contradictions and determines authoritative coverage status.
 *
 * Layer priority (highest to lowest authority):
 * 1. um_criteria - Operational UM rules are authoritative
 * 2. lbm_guideline - Delegated LBM overrides payer policy
 * 3. delegation - Delegation status affects which source is authoritative
 * 4. policy_stance - Medical policy evidence review
 * 5. overlay - State mandates, Medicare references
 */

import { COVERAGE_LAYERS, ASSERTION_STATUS } from '../proposals/schema.js';
import { getDelegation } from '../data/delegation-map.js';
import { logger } from '../utils/logger.js';

/**
 * Layer weights for reconciliation
 * Higher = more authoritative
 */
export const LAYER_WEIGHTS = {
  [COVERAGE_LAYERS.UM_CRITERIA]: 1.0,
  [COVERAGE_LAYERS.LBM_GUIDELINE]: 0.95,
  [COVERAGE_LAYERS.DELEGATION]: 0.9,
  [COVERAGE_LAYERS.POLICY_STANCE]: 0.7,
  [COVERAGE_LAYERS.OVERLAY]: 0.5,
  // Additional internal weights
  vendor_claim: 0.3, // Vendor in-network claims (lowest)
};

/**
 * Status conflict definitions
 * Maps status pairs to conflict severity
 */
export const STATUS_CONFLICTS = {
  // Direct contradictions (HIGH severity)
  'supports+denies': { severity: 'high', message: 'Direct contradiction: supports vs denies' },
  'denies+supports': { severity: 'high', message: 'Direct contradiction: denies vs supports' },

  // Significant conflicts (MEDIUM severity)
  'supports+restricts': { severity: 'medium', message: 'Coverage conditions may apply' },
  'restricts+supports': { severity: 'medium', message: 'Coverage conditions may apply' },
  'restricts+denies': { severity: 'medium', message: 'Restricted vs denied coverage' },
  'denies+restricts': { severity: 'medium', message: 'Denied vs restricted coverage' },

  // Uncertainty conflicts (LOW severity)
  'unclear+supports': { severity: 'low', message: 'Unclear language alongside support' },
  'unclear+denies': { severity: 'low', message: 'Unclear language alongside denial' },
  'unclear+restricts': { severity: 'low', message: 'Unclear language alongside restrictions' },
};

/**
 * Reconcile coverage assertions for a test+payer combination
 * @param {Object[]} assertions - Array of coverage assertions
 * @param {Object} options - { payerId, testId }
 * @returns {Object} Reconciliation result
 */
export function reconcileCoverage(assertions, options = {}) {
  if (!assertions || assertions.length === 0) {
    return {
      status: 'unknown',
      confidence: 0,
      authoritative: null,
      conflicts: [],
      message: 'No coverage assertions available',
    };
  }

  const { payerId, testId } = options;

  // Check for delegation - if delegated, LBM layer becomes authoritative
  const delegation = payerId ? getDelegation(payerId) : null;
  const adjustedWeights = { ...LAYER_WEIGHTS };

  if (delegation) {
    // Boost LBM layer, reduce policy_stance
    adjustedWeights[COVERAGE_LAYERS.LBM_GUIDELINE] = 1.0;
    adjustedWeights[COVERAGE_LAYERS.POLICY_STANCE] = 0.4;
  }

  // Sort by layer weight (highest first)
  const sorted = [...assertions].sort((a, b) => {
    const weightA = adjustedWeights[a.layer] || 0;
    const weightB = adjustedWeights[b.layer] || 0;
    if (weightB !== weightA) return weightB - weightA;
    // Secondary sort by confidence
    return (b.confidence || 0) - (a.confidence || 0);
  });

  // Detect conflicts
  const conflicts = detectConflicts(sorted);

  // Determine authoritative assertion
  const authoritative = sorted[0];

  // Calculate reconciled status
  const reconciledStatus = determineReconciledStatus(sorted, conflicts, delegation);

  // Calculate confidence in reconciliation
  const confidence = calculateReconciliationConfidence(sorted, conflicts);

  return {
    status: reconciledStatus,
    confidence,
    authoritative: {
      assertionId: authoritative.assertionId,
      layer: authoritative.layer,
      status: authoritative.status,
      sourceUrl: authoritative.sourceUrl,
    },
    supporting: sorted.slice(1).map(a => ({
      assertionId: a.assertionId,
      layer: a.layer,
      status: a.status,
    })),
    conflicts,
    delegation: delegation ? {
      delegatedTo: delegation.delegatedTo,
      effectiveDate: delegation.effectiveDate,
    } : null,
    message: buildReconciliationMessage(reconciledStatus, conflicts, delegation),
  };
}

/**
 * Detect conflicts between assertions
 * @param {Object[]} sortedAssertions - Assertions sorted by weight
 * @returns {Object[]} Array of conflict descriptions
 */
export function detectConflicts(sortedAssertions) {
  const conflicts = [];
  const statusesSeen = new Set();

  for (const assertion of sortedAssertions) {
    for (const seenStatus of statusesSeen) {
      const conflictKey = `${seenStatus}+${assertion.status}`;
      const conflictDef = STATUS_CONFLICTS[conflictKey];

      if (conflictDef) {
        conflicts.push({
          severity: conflictDef.severity,
          message: conflictDef.message,
          statuses: [seenStatus, assertion.status],
          layers: [
            sortedAssertions.find(a => a.status === seenStatus)?.layer,
            assertion.layer,
          ],
        });
      }
    }
    statusesSeen.add(assertion.status);
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  conflicts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return conflicts;
}

/**
 * Determine the reconciled status
 * @param {Object[]} sortedAssertions - Sorted assertions
 * @param {Object[]} conflicts - Detected conflicts
 * @param {Object|null} delegation - Delegation info
 * @returns {string} Reconciled status
 */
function determineReconciledStatus(sortedAssertions, conflicts, delegation) {
  const hasHighConflict = conflicts.some(c => c.severity === 'high');

  // If high-severity conflict, flag for review
  if (hasHighConflict) {
    return 'conflict_review_required';
  }

  const authoritative = sortedAssertions[0];

  // If authoritative is unclear, check next layer
  if (authoritative.status === ASSERTION_STATUS.UNCLEAR && sortedAssertions.length > 1) {
    const next = sortedAssertions[1];
    if (next.status !== ASSERTION_STATUS.UNCLEAR) {
      return next.status;
    }
  }

  return authoritative.status;
}

/**
 * Calculate confidence in the reconciliation
 * @param {Object[]} sortedAssertions - Sorted assertions
 * @param {Object[]} conflicts - Detected conflicts
 * @returns {number} 0-1 confidence score
 */
function calculateReconciliationConfidence(sortedAssertions, conflicts) {
  let confidence = 0.7;

  // Boost if all assertions agree
  const statuses = new Set(sortedAssertions.map(a => a.status));
  if (statuses.size === 1) {
    confidence += 0.2;
  }

  // Reduce for conflicts
  for (const conflict of conflicts) {
    if (conflict.severity === 'high') confidence -= 0.3;
    else if (conflict.severity === 'medium') confidence -= 0.15;
    else confidence -= 0.05;
  }

  // Boost if authoritative has high confidence
  const authoritative = sortedAssertions[0];
  if (authoritative.confidence > 0.8) {
    confidence += 0.1;
  }

  // Reduce if authoritative is unclear
  if (authoritative.status === ASSERTION_STATUS.UNCLEAR) {
    confidence -= 0.2;
  }

  return Math.min(0.95, Math.max(0.1, confidence));
}

/**
 * Build human-readable reconciliation message
 * @param {string} status - Reconciled status
 * @param {Object[]} conflicts - Conflicts
 * @param {Object|null} delegation - Delegation info
 * @returns {string} Message
 */
function buildReconciliationMessage(status, conflicts, delegation) {
  const parts = [];

  if (status === 'conflict_review_required') {
    parts.push('CONFLICT: Manual review required.');
    parts.push(`Found ${conflicts.filter(c => c.severity === 'high').length} high-severity conflicts.`);
  } else {
    const statusLabels = {
      [ASSERTION_STATUS.SUPPORTS]: 'Covered',
      [ASSERTION_STATUS.RESTRICTS]: 'Covered with restrictions',
      [ASSERTION_STATUS.DENIES]: 'Not covered',
      [ASSERTION_STATUS.UNCLEAR]: 'Coverage unclear',
    };
    parts.push(`Status: ${statusLabels[status] || status}`);
  }

  if (delegation) {
    parts.push(`Note: Payer delegates to ${delegation.delegatedTo}. LBM guidelines are authoritative.`);
  }

  if (conflicts.length > 0 && status !== 'conflict_review_required') {
    parts.push(`Warning: ${conflicts.length} coverage signal conflict(s) detected.`);
  }

  return parts.join(' ');
}

/**
 * Reconcile all coverage for a test across payers
 * @param {Object} assertionsByPayer - { payerId: assertions[] }
 * @param {string} testId - Test ID
 * @returns {Object} { payerId: reconciliationResult }
 */
export function reconcileAllForTest(assertionsByPayer, testId) {
  const results = {};

  for (const [payerId, assertions] of Object.entries(assertionsByPayer)) {
    results[payerId] = reconcileCoverage(assertions, { payerId, testId });
  }

  return results;
}

/**
 * Get all conflicts requiring review
 * @param {Object} reconciliationResults - Results from reconcileAllForTest
 * @returns {Object[]} Conflicts needing review
 */
export function getConflictsForReview(reconciliationResults) {
  const conflicts = [];

  for (const [payerId, result] of Object.entries(reconciliationResults)) {
    if (result.status === 'conflict_review_required') {
      conflicts.push({
        payerId,
        status: result.status,
        conflicts: result.conflicts,
        authoritative: result.authoritative,
        message: result.message,
      });
    }
  }

  return conflicts;
}

/**
 * Generate a summary of reconciliation across all payers
 * @param {Object} reconciliationResults - Results from reconcileAllForTest
 * @returns {Object} Summary statistics
 */
export function summarizeReconciliation(reconciliationResults) {
  const summary = {
    total: Object.keys(reconciliationResults).length,
    supports: 0,
    restricts: 0,
    denies: 0,
    unclear: 0,
    conflicts: 0,
    avgConfidence: 0,
  };

  let totalConfidence = 0;

  for (const result of Object.values(reconciliationResults)) {
    if (result.status === ASSERTION_STATUS.SUPPORTS) summary.supports++;
    else if (result.status === ASSERTION_STATUS.RESTRICTS) summary.restricts++;
    else if (result.status === ASSERTION_STATUS.DENIES) summary.denies++;
    else if (result.status === ASSERTION_STATUS.UNCLEAR) summary.unclear++;
    else if (result.status === 'conflict_review_required') summary.conflicts++;

    totalConfidence += result.confidence;
  }

  summary.avgConfidence = summary.total > 0 ? totalConfidence / summary.total : 0;

  return summary;
}

/**
 * Export a reconciliation result for the frontend
 * @param {Object} result - Reconciliation result
 * @returns {Object} Frontend-friendly format
 */
export function exportForFrontend(result) {
  const statusLabels = {
    [ASSERTION_STATUS.SUPPORTS]: 'covered',
    [ASSERTION_STATUS.RESTRICTS]: 'conditional',
    [ASSERTION_STATUS.DENIES]: 'not_covered',
    [ASSERTION_STATUS.UNCLEAR]: 'unknown',
    conflict_review_required: 'unknown',
  };

  return {
    status: statusLabels[result.status] || 'unknown',
    conditions: result.status === ASSERTION_STATUS.RESTRICTS
      ? 'See policy for coverage criteria'
      : null,
    source: result.authoritative?.sourceUrl || null,
    confidence: result.confidence,
    hasConflicts: result.conflicts.length > 0,
    delegatedTo: result.delegation?.delegatedTo || null,
    updatedAt: new Date().toISOString().split('T')[0],
  };
}

export default {
  LAYER_WEIGHTS,
  STATUS_CONFLICTS,
  reconcileCoverage,
  detectConflicts,
  reconcileAllForTest,
  getConflictsForReview,
  summarizeReconciliation,
  exportForFrontend,
};
