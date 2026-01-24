/**
 * React Hooks for DAL Access
 *
 * These hooks provide synchronous access to test data by pre-loading
 * data at module level. This ensures components can render immediately
 * without loading states in most cases.
 *
 * @module dal/hooks/useTests
 */

import { useState, useEffect, useMemo } from 'react';
import { dal } from '../../data.js';

// ============================================================================
// Module-level caching for sync access
// ============================================================================

let _cachedTests = null;
let _loadPromise = null;

/**
 * Ensure test data is loaded (with caching)
 * @returns {Promise<Array>} All tests
 */
async function ensureLoaded() {
  if (_cachedTests) return _cachedTests;
  if (!_loadPromise) {
    _loadPromise = dal.tests.findAll().then(({ data }) => {
      _cachedTests = data;
      return data;
    });
  }
  return _loadPromise;
}

// Note: Pre-loading removed to avoid circular dependency issues.
// Data loads on first hook use, which is fast enough for the in-memory adapter.

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook: Get all tests from the DAL
 *
 * @returns {{ tests: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { tests, loading } = useAllTests();
 * if (loading) return <Spinner />;
 * return <TestList tests={tests} />;
 */
export function useAllTests() {
  const [tests, setTests] = useState(_cachedTests || []);
  const [loading, setLoading] = useState(!_cachedTests);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (_cachedTests) {
      setTests(_cachedTests);
      setLoading(false);
      return;
    }

    ensureLoaded()
      .then(data => {
        setTests(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { tests, loading, error };
}

/**
 * Hook: Get tests filtered by category
 *
 * @param {string} category - Category code (MRD, ECD, CGP, HCT, TRM, TDS)
 * @returns {{ tests: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { tests } = useTestsByCategory('MRD');
 */
export function useTestsByCategory(category) {
  const { tests, loading, error } = useAllTests();

  const filtered = useMemo(() => {
    if (!category || !tests.length) return [];
    const normalizedCategory = category.toUpperCase();
    return tests.filter(t => t.category === normalizedCategory);
  }, [tests, category]);

  return { tests: filtered, loading, error };
}

/**
 * Hook: Get test counts by category
 *
 * @returns {{ counts: Object, loading: boolean, error: Error|null }}
 *
 * @example
 * const { counts } = useTestCounts();
 * console.log(counts.MRD); // e.g., 27
 */
export function useTestCounts() {
  const { tests, loading, error } = useAllTests();

  const counts = useMemo(() => {
    if (!tests.length) {
      return { MRD: 0, ECD: 0, CGP: 0, HCT: 0, TRM: 0 };
    }

    const result = { MRD: 0, ECD: 0, CGP: 0, HCT: 0, TRM: 0 };

    for (const test of tests) {
      const cat = test.category;
      if (cat && result.hasOwnProperty(cat)) {
        result[cat]++;
      }
    }

    return result;
  }, [tests]);

  return { counts, loading, error };
}

/**
 * Hook: Get a single test by ID
 *
 * @param {string} id - Test ID (e.g., 'mrd-1', 'ecd-5')
 * @returns {{ test: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { test } = useTestById('mrd-1');
 */
export function useTestById(id) {
  const { tests, loading, error } = useAllTests();

  const test = useMemo(() => {
    if (!id || !tests.length) return null;
    return tests.find(t => t.id === id) || null;
  }, [tests, id]);

  return { test, loading, error };
}

/**
 * Hook: Get database statistics
 *
 * @returns {{ stats: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { stats } = useTestStats();
 * console.log(stats.totals.tests); // e.g., 150
 */
export function useTestStats() {
  const { tests, loading, error } = useAllTests();

  const stats = useMemo(() => {
    if (!tests.length) return null;

    // Count unique vendors
    const vendors = new Set();
    for (const test of tests) {
      if (test.vendor) vendors.add(test.vendor);
    }

    // Count unique cancer types (from all cancerTypes arrays)
    const cancerTypes = new Set();
    for (const test of tests) {
      if (Array.isArray(test.cancerTypes)) {
        for (const ct of test.cancerTypes) {
          cancerTypes.add(ct);
        }
      }
    }

    // Count by category
    const byCategory = {};
    const vendorsByCategory = {};

    for (const test of tests) {
      const cat = test.category;
      if (!cat) continue;

      if (!byCategory[cat]) {
        byCategory[cat] = { tests: 0, vendors: new Set() };
      }
      byCategory[cat].tests++;
      if (test.vendor) {
        byCategory[cat].vendors.add(test.vendor);
      }
    }

    // Convert Sets to counts
    const byCategoryFinal = {};
    for (const [cat, data] of Object.entries(byCategory)) {
      byCategoryFinal[cat] = {
        tests: data.tests,
        vendors: data.vendors.size,
      };
    }

    return {
      totals: {
        tests: tests.length,
        vendors: vendors.size,
        cancerTypes: cancerTypes.size,
      },
      byCategory: byCategoryFinal,
    };
  }, [tests]);

  return { stats, loading, error };
}

/**
 * Hook: Get all tests grouped by category
 *
 * @returns {{ testsByCategory: Object, loading: boolean, error: Error|null }}
 *
 * @example
 * const { testsByCategory } = useTestsByCategories();
 * console.log(testsByCategory.MRD); // Array of MRD tests
 */
export function useTestsByCategories() {
  const { tests, loading, error } = useAllTests();

  const testsByCategory = useMemo(() => {
    const result = { MRD: [], ECD: [], CGP: [], HCT: [], TRM: [] };

    for (const test of tests) {
      const cat = test.category;
      if (cat && result.hasOwnProperty(cat)) {
        result[cat].push(test);
      }
    }

    return result;
  }, [tests]);

  return { testsByCategory, loading, error };
}

/**
 * Reset the cache (for testing)
 */
export function resetCache() {
  _cachedTests = null;
  _loadPromise = null;
}
