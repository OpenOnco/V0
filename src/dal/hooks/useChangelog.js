/**
 * React Hooks for Changelog DAL Access
 *
 * These hooks provide synchronous access to changelog data by pre-loading
 * data at module level, similar to useTests.js pattern.
 *
 * @module dal/hooks/useChangelog
 */

import { useState, useEffect, useMemo } from 'react';
import { dal } from '../../data.js';

// ============================================================================
// Module-level caching for sync access
// ============================================================================

let _cachedChangelog = null;
let _loadPromise = null;

/**
 * Ensure changelog data is loaded (with caching)
 * @returns {Promise<Array>} All changelog entries
 */
async function ensureLoaded() {
  if (_cachedChangelog) return _cachedChangelog;
  if (!_loadPromise) {
    _loadPromise = dal.changelog.findAll().then(({ data }) => {
      _cachedChangelog = data;
      return data;
    });
  }
  return _loadPromise;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook: Get all changelog entries from the DAL
 *
 * @returns {{ changelog: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { changelog, loading } = useChangelog();
 * if (loading) return <Spinner />;
 * return <ChangelogList entries={changelog} />;
 */
export function useChangelog() {
  const [changelog, setChangelog] = useState(_cachedChangelog || []);
  const [loading, setLoading] = useState(!_cachedChangelog);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (_cachedChangelog) {
      setChangelog(_cachedChangelog);
      setLoading(false);
      return;
    }

    ensureLoaded()
      .then(data => {
        setChangelog(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { changelog, loading, error };
}

/**
 * Hook: Get recent changelog entries
 *
 * @param {number} [limit=10] - Number of entries to return
 * @returns {{ entries: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { entries } = useRecentChanges(5);
 */
export function useRecentChanges(limit = 10) {
  const { changelog, loading, error } = useChangelog();

  const entries = useMemo(() => {
    if (!changelog.length) return [];
    return changelog.slice(0, limit);
  }, [changelog, limit]);

  return { entries, loading, error };
}

/**
 * Hook: Get changelog entries filtered by type
 *
 * @param {'added'|'updated'|'removed'} type - Change type
 * @returns {{ entries: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { entries } = useChangelogByType('added');
 */
export function useChangelogByType(type) {
  const { changelog, loading, error } = useChangelog();

  const entries = useMemo(() => {
    if (!type || !changelog.length) return [];
    return changelog.filter(entry => entry.type === type.toLowerCase());
  }, [changelog, type]);

  return { entries, loading, error };
}

/**
 * Hook: Get changelog entries for a specific test
 *
 * @param {string} testId - Test ID (e.g., 'mrd-1')
 * @returns {{ entries: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { entries } = useChangelogByTestId('mrd-1');
 */
export function useChangelogByTestId(testId) {
  const { changelog, loading, error } = useChangelog();

  const entries = useMemo(() => {
    if (!testId || !changelog.length) return [];
    return changelog.filter(entry => {
      if (!entry.testId) return false;
      // Handle comma-separated test IDs
      const testIds = entry.testId.split(',').map(id => id.trim());
      return testIds.includes(testId);
    });
  }, [changelog, testId]);

  return { entries, loading, error };
}

/**
 * Hook: Get changelog entries for a specific category
 *
 * @param {string} category - Category code (MRD, ECD, CGP, HCT)
 * @returns {{ entries: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { entries } = useChangelogByCategory('MRD');
 */
export function useChangelogByCategory(category) {
  const { changelog, loading, error } = useChangelog();

  const entries = useMemo(() => {
    if (!category || !changelog.length) return [];
    const normalizedCategory = category.toUpperCase();
    return changelog.filter(entry => entry.category === normalizedCategory);
  }, [changelog, category]);

  return { entries, loading, error };
}

/**
 * Hook: Get changelog statistics
 *
 * @returns {{ stats: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { stats } = useChangelogStats();
 * console.log(stats.byType.added); // e.g., 50
 */
export function useChangelogStats() {
  const { changelog, loading, error } = useChangelog();

  const stats = useMemo(() => {
    if (!changelog.length) return null;

    const byType = { added: 0, updated: 0, removed: 0 };
    const byCategory = {};
    const contributors = new Set();

    for (const entry of changelog) {
      // Count by type
      if (entry.type && byType.hasOwnProperty(entry.type)) {
        byType[entry.type]++;
      }

      // Count by category
      if (entry.category) {
        byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      }

      // Collect contributors
      if (entry.contributor) {
        contributors.add(entry.contributor);
      }
    }

    return {
      total: changelog.length,
      byType,
      byCategory,
      contributorCount: contributors.size,
    };
  }, [changelog]);

  return { stats, loading, error };
}

/**
 * Hook: Get recently added tests from changelog
 *
 * @param {number} [limit=10] - Number of entries to return
 * @returns {{ entries: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { entries } = useRecentlyAddedTests(5);
 */
export function useRecentlyAddedTests(limit = 10) {
  const { entries: addedEntries, loading, error } = useChangelogByType('added');

  const entries = useMemo(() => {
    return addedEntries.slice(0, limit);
  }, [addedEntries, limit]);

  return { entries, loading, error };
}

/**
 * Reset the cache (for testing)
 */
export function resetChangelogCache() {
  _cachedChangelog = null;
  _loadPromise = null;
}
