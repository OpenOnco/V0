/**
 * Coverage Reconciliation
 *
 * Reconciles coverage assertions from multiple sources/layers.
 * Detects contradictions and determines authoritative coverage status.
 *
 * Layer priority (highest to lowest authority):
 * 1. um_criteria - Operational UM rules are authoritative
 * 2. lbm_guideline - Delegated LBM overrides payer policy
 * 3. policy_stance - Medical policy evidence review
 * 4. overlay - State mandates, Medicare references
 *
 * v2.1: Delegation is now ROUTING METADATA, not a stance layer.
 * Delegation tells us WHICH documents apply, not WHAT the coverage is.
 * When a payer delegates to an LBM, we route to LBM assertions,
 * but delegation itself does not contribute a coverage stance.
 */

import { COVERAGE_LAYERS, ASSERTION_STATUS } from '../proposals/schema.js';
import { getDelegation, getDelegationStatus } from '../data/delegation-map.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('reconcile');

/**
 * Layer weights for reconciliation
 * Higher = more authoritative
 *
 * NOTE: Delegation is NOT a layer weight - it's routing metadata.
 * See getDelegationRouting() for how delegation affects which assertions apply.
 */
export const LAYER_WEIGHTS = {
  [COVERAGE_LAYERS.UM_CRITERIA]: 1.0,
  [COVERAGE_LAYERS.LBM_GUIDELINE]: 0.95,
  [COVERAGE_LAYERS.POLICY_STANCE]: 0.7,
  [COVERAGE_LAYERS.OVERLAY]: 0.5,
  // Additional internal weights
  vendor_claim: 0.3, // Vendor in-network claims (lowest)
};

/**
 * Get delegation routing info for a payer
 * This determines which assertions are "applicable" based on delegation
 *
 * @param {string} payerId - Payer ID
 * @returns {Object} { active, delegatedTo, applicableDocuments, boostLBM }
 */
export function getDelegationRouting(payerId) {
  const delegation = getDelegationStatus ? getDelegationStatus(payerId) : getDelegation(payerId);

  if (!delegation) {
    return {
      active: false,
      delegatedTo: null,
      status: null,
      boostLBM: false,
    };
  }

  // v2.1: Check if delegation is confirmed with evidence
  const isActive = delegation.status === 'active' || delegation.status === 'confirmed';
  const isSuspected = delegation.status === 'suspected';

  return {
    active: isActive,
    suspected: isSuspected,
    delegatedTo: delegation.delegatesTo || delegation.delegatedTo,
    program: delegation.program,
    effectiveDate: delegation.effectiveDate,
    // When delegation is active, boost LBM guideline layer
    boostLBM: isActive,
    // Evidence for audit trail
    evidence: delegation.evidence || null,
    lastVerified: delegation.lastVerified || null,
  };
}

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
 *
 * v2.1: Delegation is now routing metadata, not a stance layer.
 * When delegation is active, we boost LBM layer weight but delegation
 * itself doesn't contribute a coverage stance.
 *
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
      hasConflict: false,
      message: 'No coverage assertions available',
      delegation: null,
    };
  }

  const { payerId, testId } = options;

  // v2.1: Get delegation routing (metadata, not stance)
  const delegationRouting = payerId ? getDelegationRouting(payerId) : { active: false };

  // Build adjusted weights based on delegation routing
  const adjustedWeights = { ...LAYER_WEIGHTS };

  if (delegationRouting.active && delegationRouting.boostLBM) {
    // When delegation is ACTIVE with evidence, LBM layer is most authoritative
    adjustedWeights[COVERAGE_LAYERS.LBM_GUIDELINE] = 1.0;
    adjustedWeights[COVERAGE_LAYERS.POLICY_STANCE] = 0.4;

    logger.debug('Delegation active, boosting LBM layer', {
      payerId,
      delegatedTo: delegationRouting.delegatedTo,
    });
  } else if (delegationRouting.suspected) {
    // When delegation is suspected but unconfirmed, slight LBM boost
    adjustedWeights[COVERAGE_LAYERS.LBM_GUIDELINE] = 0.98;
  }

  // Filter assertions to only those from applicable layers
  // (delegation routing may exclude certain sources)
  const applicableAssertions = filterByDelegationRouting(assertions, delegationRouting);

  // Sort by layer weight (highest first)
  const sorted = [...applicableAssertions].sort((a, b) => {
    const weightA = adjustedWeights[a.layer] || 0;
    const weightB = adjustedWeights[b.layer] || 0;
    if (weightB !== weightA) return weightB - weightA;
    // Secondary sort by confidence
    return (b.confidence || 0) - (a.confidence || 0);
  });

  if (sorted.length === 0) {
    return {
      status: 'unknown',
      confidence: 0,
      authoritative: null,
      conflicts: [],
      hasConflict: false,
      message: 'No applicable coverage assertions (delegation may apply)',
      delegation: delegationRouting.active ? {
        active: true,
        delegatedTo: delegationRouting.delegatedTo,
        program: delegationRouting.program,
        status: 'awaiting_lbm_assertion',
      } : null,
    };
  }

  // Detect conflicts
  const conflicts = detectConflicts(sorted);
  const hasConflict = conflicts.some(c => c.severity === 'high' || c.severity === 'medium');

  // Determine authoritative assertion
  const authoritative = sorted[0];

  // Calculate reconciled status
  const reconciledStatus = determineReconciledStatus(sorted, conflicts, delegationRouting);

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
    hasConflict,
    conflictDetails: hasConflict ? {
      layers: [...new Set(conflicts.flatMap(c => c.layers))],
      description: conflicts.map(c => c.message).join('; '),
    } : null,
    // v2.1: Delegation as metadata, not stance
    delegation: delegationRouting.active || delegationRouting.suspected ? {
      active: delegationRouting.active,
      suspected: delegationRouting.suspected,
      delegatedTo: delegationRouting.delegatedTo,
      program: delegationRouting.program,
      effectiveDate: delegationRouting.effectiveDate,
      evidence: delegationRouting.evidence,
    } : null,
    message: buildReconciliationMessage(reconciledStatus, conflicts, delegationRouting),
  };
}

/**
 * Filter assertions based on delegation routing
 * When delegation is active, prioritize LBM assertions
 *
 * @param {Object[]} assertions - All assertions
 * @param {Object} delegationRouting - Delegation routing info
 * @returns {Object[]} Applicable assertions
 */
function filterByDelegationRouting(assertions, delegationRouting) {
  if (!delegationRouting.active) {
    // No active delegation - all assertions apply
    return assertions;
  }

  // When delegation is active:
  // 1. Always include UM_CRITERIA (payer-specific ops rules)
  // 2. Always include LBM_GUIDELINE (from the delegated LBM)
  // 3. Include OVERLAY (state mandates still apply)
  // 4. Reduce weight of POLICY_STANCE (payer policy may be superseded)

  // For now, include all but let weights handle priority
  // In future, could filter out stale policy_stance assertions
  return assertions;
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
 * @param {Object} delegationRouting - Delegation routing info
 * @returns {string} Reconciled status
 */
function determineReconciledStatus(sortedAssertions, conflicts, delegationRouting) {
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
 * @param {Object} delegationRouting - Delegation routing info
 * @returns {string} Message
 */
function buildReconciliationMessage(status, conflicts, delegationRouting) {
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

  // v2.1: Delegation as routing metadata
  if (delegationRouting.active) {
    parts.push(`Note: Payer delegates to ${delegationRouting.delegatedTo}. LBM guidelines are authoritative.`);
  } else if (delegationRouting.suspected) {
    parts.push(`Note: Payer may delegate to ${delegationRouting.delegatedTo} (unconfirmed).`);
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
  getDelegationRouting,
  reconcileCoverage,
  detectConflicts,
  reconcileAllForTest,
  getConflictsForReview,
  summarizeReconciliation,
  exportForFrontend,
};
