/**
 * Data Access Layer (DAL) - Main Entry Point
 *
 * This module provides an abstraction layer between data storage and consumers.
 * Currently uses in-memory storage; future versions can swap to PostgreSQL
 * with zero changes to consuming code.
 *
 * @example
 * // Initialize DAL with data arrays
 * import { initializeDAL } from './dal/index.js';
 * import { mrdTestData, ecdTestData, cgpTestData, hctTestData } from './data.js';
 *
 * const dal = initializeDAL({ mrdTestData, ecdTestData, cgpTestData, hctTestData });
 *
 * // Use the DAL
 * const { data: tests } = await dal.tests.findByCategory('MRD');
 * const test = await dal.tests.findById('mrd-1');
 */

import { normalizeTestData, CATEGORY_MAP } from './normalizer.js';
import { InMemoryAdapter } from './adapters/InMemoryAdapter.js';
import { TestRepository } from './repositories/TestRepository.js';

// Re-export for convenience
export { operators } from './operators.js';
export { matchesWhere, applyOrderBy, applySelect, applyPagination, buildResult } from './QueryBuilder.js';
export { normalizeTestData, CATEGORY_MAP, slugify, buildLookupMaps } from './normalizer.js';
export { DataAdapter } from './adapters/DataAdapter.js';
export { InMemoryAdapter } from './adapters/InMemoryAdapter.js';
export { TestRepository } from './repositories/TestRepository.js';

// React hooks for DAL access
export {
  useAllTests,
  useTestsByCategory,
  useTestCounts,
  useTestById,
  useTestStats,
  useTestsByCategories,
  resetCache,
} from './hooks/useTests.js';

/**
 * @typedef {Object} DAL
 * @property {TestRepository} tests - Test repository for querying tests
 * @property {InMemoryAdapter} adapter - The underlying data adapter
 */

/**
 * Initialize the Data Access Layer with test data
 *
 * @param {Object} dataArrays - Test data arrays
 * @param {Array} [dataArrays.mrdTestData=[]] - MRD test data
 * @param {Array} [dataArrays.ecdTestData=[]] - ECD test data
 * @param {Array} [dataArrays.trmTestData=[]] - TRM test data (may be empty)
 * @param {Array} [dataArrays.cgpTestData=[]] - CGP test data
 * @param {Array} [dataArrays.hctTestData=[]] - HCT test data
 * @returns {DAL} - The initialized DAL instance
 */
export function initializeDAL({
  mrdTestData = [],
  ecdTestData = [],
  trmTestData = [],
  cgpTestData = [],
  hctTestData = [],
} = {}) {
  // Normalize all test data into a unified collection
  const tests = normalizeTestData({
    mrdTestData,
    ecdTestData,
    trmTestData,
    cgpTestData,
    hctTestData,
  });

  // Create the in-memory adapter with the tests collection
  const adapter = new InMemoryAdapter({
    tests,
  });

  // Create repositories
  const testRepository = new TestRepository(adapter);

  return {
    tests: testRepository,
    adapter,
  };
}

/**
 * Create a DAL instance with a custom adapter
 * Useful for future database adapters or testing
 *
 * @param {import('./adapters/DataAdapter.js').DataAdapter} adapter - Custom adapter
 * @returns {DAL}
 */
export function createDAL(adapter) {
  return {
    tests: new TestRepository(adapter),
    adapter,
  };
}

// Singleton instance for convenience
let _instance = null;

/**
 * Get or create the global DAL instance
 * Lazily initializes on first call
 *
 * @param {Object} [dataArrays] - Test data arrays (only used on first call)
 * @returns {DAL}
 */
export function getDAL(dataArrays) {
  if (!_instance) {
    if (!dataArrays) {
      throw new Error('DAL not initialized. Call initializeDAL() first or provide data arrays.');
    }
    _instance = initializeDAL(dataArrays);
  }
  return _instance;
}

/**
 * Reset the global DAL instance
 * Useful for testing or re-initialization
 */
export function resetDAL() {
  _instance = null;
}

/**
 * Set a pre-initialized DAL as the global instance
 * @param {DAL} dal - The DAL instance to use
 */
export function setDAL(dal) {
  _instance = dal;
}
