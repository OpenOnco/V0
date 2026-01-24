/**
 * React Hooks for Insurance DAL Access
 *
 * These hooks provide synchronous access to insurance provider data
 * by pre-loading data at module level.
 *
 * @module dal/hooks/useInsurance
 */

import { useState, useEffect, useMemo } from 'react';
import { dal } from '../../data.js';

// ============================================================================
// Module-level caching for sync access
// ============================================================================

let _cachedInsurance = null;
let _loadPromise = null;

/**
 * Ensure insurance data is loaded (with caching)
 * @returns {Promise<Array>} All insurance providers
 */
async function ensureLoaded() {
  if (_cachedInsurance) return _cachedInsurance;
  if (!_loadPromise) {
    _loadPromise = dal.insurance.findAll().then(({ data }) => {
      _cachedInsurance = data;
      return data;
    });
  }
  return _loadPromise;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook: Get all insurance providers from the DAL
 *
 * @returns {{ providers: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { providers, loading } = useInsuranceProviders();
 */
export function useInsuranceProviders() {
  const [providers, setProviders] = useState(_cachedInsurance || []);
  const [loading, setLoading] = useState(!_cachedInsurance);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (_cachedInsurance) {
      setProviders(_cachedInsurance);
      setLoading(false);
      return;
    }

    ensureLoaded()
      .then(data => {
        setProviders(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { providers, loading, error };
}

/**
 * Hook: Get an insurance provider by ID
 *
 * @param {string} id - Provider ID (e.g., 'medicare', 'aetna')
 * @returns {{ provider: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { provider } = useInsuranceById('medicare');
 */
export function useInsuranceById(id) {
  const { providers, loading, error } = useInsuranceProviders();

  const provider = useMemo(() => {
    if (!id || !providers.length) return null;
    return providers.find(p => p.id === id) || null;
  }, [providers, id]);

  return { provider, loading, error };
}

/**
 * Hook: Get insurance providers by category
 *
 * @param {'government'|'national'|'regional'} category - Provider category
 * @returns {{ providers: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { providers } = useInsuranceByCategory('government');
 */
export function useInsuranceByCategory(category) {
  const { providers, loading, error } = useInsuranceProviders();

  const filtered = useMemo(() => {
    if (!category || !providers.length) return [];
    return providers.filter(p => p.category === category);
  }, [providers, category]);

  return { providers: filtered, loading, error };
}

/**
 * Hook: Get insurance providers grouped by category
 *
 * @returns {{ providersByCategory: Object, loading: boolean, error: Error|null }}
 *
 * @example
 * const { providersByCategory } = useInsuranceGrouped();
 * console.log(providersByCategory.government); // [{ id: 'medicare', ... }]
 */
export function useInsuranceGrouped() {
  const { providers, loading, error } = useInsuranceProviders();

  const providersByCategory = useMemo(() => {
    const result = {
      government: [],
      national: [],
      regional: [],
    };

    for (const provider of providers) {
      if (result.hasOwnProperty(provider.category)) {
        result[provider.category].push(provider);
      }
    }

    return result;
  }, [providers]);

  return { providersByCategory, loading, error };
}

/**
 * Hook: Check if a test is covered by a specific provider
 *
 * @param {Object} test - Test object with reimbursement/commercialPayers
 * @param {string} providerId - Insurance provider ID
 * @returns {{ coverage: Object, loading: boolean, error: Error|null }}
 *
 * @example
 * const { coverage } = useTestCoverage(test, 'medicare');
 * if (coverage.covered) { ... }
 */
export function useTestCoverage(test, providerId) {
  const { providers, loading, error } = useInsuranceProviders();

  const coverage = useMemo(() => {
    if (!test || !providerId) {
      return { covered: false, reason: 'missing-data' };
    }

    // Handle Medicare
    if (providerId === 'medicare') {
      const reimbursement = (test.reimbursement || '').toLowerCase();
      if (reimbursement.includes('medicare')) {
        return { covered: true, type: 'medicare', note: test.reimbursementNote };
      }
      if (test.medicareCoverage?.status === 'COVERED') {
        return {
          covered: true,
          type: 'medicare',
          policy: test.medicareCoverage.policyNumber,
          note: test.medicareCoverage.notes,
        };
      }
    }

    // Handle Medicaid
    if (providerId === 'medicaid') {
      const reimbursement = (test.reimbursement || '').toLowerCase();
      if (reimbursement.includes('medicaid')) {
        return { covered: true, type: 'medicaid', note: test.reimbursementNote };
      }
    }

    // Check commercialPayers array
    if (Array.isArray(test.commercialPayers)) {
      // Simple check - would need PAYER_NAME_TO_ID for proper mapping
      const matchingPayer = test.commercialPayers.find(
        payer => payer.toLowerCase().includes(providerId.replace(/-/g, ' '))
      );
      if (matchingPayer) {
        return { covered: true, type: 'commercial', payer: matchingPayer };
      }
    }

    return { covered: false, reason: 'not-in-coverage-list' };
  }, [test, providerId, providers]);

  return { coverage, loading, error };
}

/**
 * Hook: Get all providers covering a specific test
 *
 * @param {Object} test - Test object with coverage data
 * @returns {{ coveringProviders: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { coveringProviders } = useTestCoveringProviders(test);
 */
export function useTestCoveringProviders(test) {
  const { providers, loading, error } = useInsuranceProviders();

  const coveringProviders = useMemo(() => {
    if (!test || !providers.length) return [];

    const covered = [];
    const reimbursement = (test.reimbursement || '').toLowerCase();

    for (const provider of providers) {
      // Check Medicare
      if (provider.id === 'medicare') {
        if (reimbursement.includes('medicare') || test.medicareCoverage?.status === 'COVERED') {
          covered.push(provider);
          continue;
        }
      }

      // Check Medicaid
      if (provider.id === 'medicaid' && reimbursement.includes('medicaid')) {
        covered.push(provider);
        continue;
      }

      // Check commercial payers
      if (Array.isArray(test.commercialPayers)) {
        const hasMatch = test.commercialPayers.some(
          payer => payer.toLowerCase().includes(provider.label.toLowerCase())
        );
        if (hasMatch) {
          covered.push(provider);
        }
      }
    }

    return covered;
  }, [test, providers]);

  return { coveringProviders, loading, error };
}

/**
 * Reset the cache (for testing)
 */
export function resetInsuranceCache() {
  _cachedInsurance = null;
  _loadPromise = null;
}
