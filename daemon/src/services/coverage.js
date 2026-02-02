/**
 * Coverage Service
 *
 * Provides reconciled coverage data by combining:
 * - Coverage assertions from multiple layers
 * - Delegation awareness
 * - Conflict detection
 *
 * Used by CLI, proposals review, and can be integrated with main API.
 */

import { initHashStore, getAssertionsForTest, getAssertionsForPayer, getConflictingAssertions, getPolicyHashStats, getAssertionStats } from '../utils/hash-store.js';
import { reconcileCoverage, reconcileAllForTest, getConflictsForReview, summarizeReconciliation, exportForFrontend } from '../analysis/reconcile.js';
import { getDelegation, getPayersByLBM, PAYER_DELEGATIONS } from '../data/delegation-map.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('coverage-service');

/**
 * Get reconciled coverage for a test across all payers
 * @param {string} testId - Test ID (e.g., 'signatera')
 * @returns {Object} { byPayer, summary, conflicts }
 */
export async function getTestCoverage(testId) {
  await initHashStore();

  const assertions = getAssertionsForTest(testId);

  // Group by payer
  const byPayer = {};
  for (const assertion of assertions) {
    if (!byPayer[assertion.payerId]) {
      byPayer[assertion.payerId] = [];
    }
    byPayer[assertion.payerId].push(assertion);
  }

  // Reconcile each payer
  const reconciled = reconcileAllForTest(byPayer, testId);

  // Get conflicts needing review
  const conflicts = getConflictsForReview(reconciled);

  // Summarize
  const summary = summarizeReconciliation(reconciled);

  return {
    testId,
    byPayer: reconciled,
    summary,
    conflicts,
    totalPayers: Object.keys(reconciled).length,
    assertionCount: assertions.length,
  };
}

/**
 * Get coverage for a specific test+payer combination
 * @param {string} testId - Test ID
 * @param {string} payerId - Payer ID
 * @returns {Object} Reconciled coverage result
 */
export async function getTestPayerCoverage(testId, payerId) {
  await initHashStore();

  const assertions = getAssertionsForTest(testId)
    .filter(a => a.payerId === payerId);

  if (assertions.length === 0) {
    return {
      testId,
      payerId,
      status: 'unknown',
      confidence: 0,
      message: 'No coverage assertions found',
      delegation: getDelegation(payerId),
    };
  }

  const result = reconcileCoverage(assertions, { payerId, testId });

  return {
    testId,
    payerId,
    ...result,
  };
}

/**
 * Get all coverage for a payer
 * @param {string} payerId - Payer ID
 * @returns {Object} Coverage by test
 */
export async function getPayerCoverage(payerId) {
  await initHashStore();

  const assertions = getAssertionsForPayer(payerId);
  const delegation = getDelegation(payerId);

  // Group by test
  const byTest = {};
  for (const assertion of assertions) {
    if (!byTest[assertion.testId]) {
      byTest[assertion.testId] = [];
    }
    byTest[assertion.testId].push(assertion);
  }

  // Reconcile each test
  const reconciled = {};
  for (const [testId, testAssertions] of Object.entries(byTest)) {
    reconciled[testId] = reconcileCoverage(testAssertions, { payerId, testId });
  }

  return {
    payerId,
    delegation,
    byTest: reconciled,
    totalTests: Object.keys(reconciled).length,
    assertionCount: assertions.length,
  };
}

/**
 * Get all coverage conflicts needing review
 * @returns {Object[]} Conflicts with context
 */
export async function getAllConflicts() {
  await initHashStore();

  const conflicts = getConflictingAssertions();

  return conflicts.map(conflict => ({
    ...conflict,
    delegation: getDelegation(conflict.payerId),
  }));
}

/**
 * Export coverage data for frontend consumption
 * @param {string} testId - Test ID
 * @returns {Object} Frontend-friendly coverage data
 */
export async function exportCoverageForFrontend(testId) {
  await initHashStore();

  const { byPayer, summary } = await getTestCoverage(testId);

  const payerCoverage = [];
  for (const [payerId, result] of Object.entries(byPayer)) {
    payerCoverage.push({
      payer: payerId,
      ...exportForFrontend(result),
    });
  }

  return {
    testId,
    payerCoverage,
    summary: {
      covered: summary.supports,
      conditional: summary.restricts,
      notCovered: summary.denies,
      unknown: summary.unclear + summary.conflicts,
      total: summary.total,
    },
  };
}

/**
 * Get coverage statistics
 * @returns {Object} Statistics
 */
export async function getCoverageStats() {
  await initHashStore();

  const policyStats = getPolicyHashStats();
  const assertionStats = getAssertionStats();

  return {
    policies: policyStats,
    assertions: assertionStats,
    delegations: {
      total: Object.keys(PAYER_DELEGATIONS).length,
      carelon: getPayersByLBM('carelon').length,
      evicore: getPayersByLBM('evicore').length,
    },
  };
}

/**
 * Get delegation info for a payer
 * @param {string} payerId - Payer ID
 * @returns {Object|null} Delegation info
 */
export function getPayerDelegation(payerId) {
  return getDelegation(payerId);
}

/**
 * Get all known delegations
 * @returns {Object} All delegations
 */
export function getAllDelegations() {
  return PAYER_DELEGATIONS;
}

export default {
  getTestCoverage,
  getTestPayerCoverage,
  getPayerCoverage,
  getAllConflicts,
  exportCoverageForFrontend,
  getCoverageStats,
  getPayerDelegation,
  getAllDelegations,
};
