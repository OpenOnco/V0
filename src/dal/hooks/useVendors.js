/**
 * React Hooks for Vendor DAL Access
 *
 * These hooks provide synchronous access to vendor data by pre-loading
 * data at module level.
 *
 * @module dal/hooks/useVendors
 */

import { useState, useEffect, useMemo } from 'react';
import { dal } from '../../data.js';

// ============================================================================
// Module-level caching for sync access
// ============================================================================

let _cachedVendors = null;
let _loadPromise = null;

/**
 * Ensure vendor data is loaded (with caching)
 * @returns {Promise<Array>} All vendors
 */
async function ensureLoaded() {
  if (_cachedVendors) return _cachedVendors;
  if (!_loadPromise) {
    _loadPromise = dal.vendors.findAll().then(({ data }) => {
      _cachedVendors = data;
      return data;
    });
  }
  return _loadPromise;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook: Get all vendors from the DAL
 *
 * @returns {{ vendors: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { vendors, loading } = useVendors();
 */
export function useVendors() {
  const [vendors, setVendors] = useState(_cachedVendors || []);
  const [loading, setLoading] = useState(!_cachedVendors);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (_cachedVendors) {
      setVendors(_cachedVendors);
      setLoading(false);
      return;
    }

    ensureLoaded()
      .then(data => {
        setVendors(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { vendors, loading, error };
}

/**
 * Hook: Get a vendor by ID
 *
 * @param {string} id - Vendor ID (slugified vendor name)
 * @returns {{ vendor: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { vendor } = useVendorById('natera');
 */
export function useVendorById(id) {
  const { vendors, loading, error } = useVendors();

  const vendor = useMemo(() => {
    if (!id || !vendors.length) return null;
    return vendors.find(v => v.id === id) || null;
  }, [vendors, id]);

  return { vendor, loading, error };
}

/**
 * Hook: Get a vendor by name
 *
 * @param {string} name - Vendor name
 * @returns {{ vendor: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { vendor } = useVendorByName('Natera');
 */
export function useVendorByName(name) {
  const { vendors, loading, error } = useVendors();

  const vendor = useMemo(() => {
    if (!name || !vendors.length) return null;
    const nameLower = name.toLowerCase();
    return vendors.find(v => v.name.toLowerCase() === nameLower) || null;
  }, [vendors, name]);

  return { vendor, loading, error };
}

/**
 * Hook: Check if a test is vendor-verified
 *
 * @param {string} testId - Test ID (e.g., 'mrd-1')
 * @returns {{ isVerified: boolean, verification: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { isVerified, verification } = useTestVerification('mrd-26');
 */
export function useTestVerification(testId) {
  const { vendors, loading, error } = useVendors();

  const result = useMemo(() => {
    if (!testId || !vendors.length) {
      return { isVerified: false, verification: null };
    }

    for (const vendor of vendors) {
      if (vendor.verifiedTestIds.includes(testId)) {
        const contribution = vendor.contributions.find(
          c => c.testId === testId && c.verifiedDate
        );
        return {
          isVerified: true,
          verification: {
            vendorId: vendor.id,
            vendorName: vendor.name,
            verifierName: contribution?.name || null,
            verifiedDate: contribution?.verifiedDate || null,
          },
        };
      }
    }

    return { isVerified: false, verification: null };
  }, [vendors, testId]);

  return { ...result, loading, error };
}

/**
 * Hook: Get vendors with assistance programs
 *
 * @returns {{ vendors: Array, loading: boolean, error: Error|null }}
 *
 * @example
 * const { vendors } = useVendorsWithAssistance();
 */
export function useVendorsWithAssistance() {
  const { vendors, loading, error } = useVendors();

  const filtered = useMemo(() => {
    return vendors.filter(v => v.hasAssistanceProgram);
  }, [vendors]);

  return { vendors: filtered, loading, error };
}

/**
 * Hook: Get assistance program for a vendor
 *
 * @param {string} vendorName - Vendor name
 * @returns {{ program: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { program } = useAssistanceProgram('Natera');
 */
export function useAssistanceProgram(vendorName) {
  const { vendors, loading, error } = useVendors();

  const program = useMemo(() => {
    if (!vendorName || !vendors.length) return null;

    // Direct match
    const directMatch = vendors.find(
      v => v.name.toLowerCase() === vendorName.toLowerCase()
    );
    if (directMatch?.assistanceProgram) {
      return directMatch.assistanceProgram;
    }

    // Partial match (vendor name contains program vendor name)
    for (const vendor of vendors) {
      if (
        vendor.hasAssistanceProgram &&
        vendorName.toLowerCase().includes(vendor.name.toLowerCase())
      ) {
        return vendor.assistanceProgram;
      }
    }

    return null;
  }, [vendors, vendorName]);

  return { program, loading, error };
}

/**
 * Hook: Get contribution details for a test
 *
 * @param {string} testId - Test ID
 * @returns {{ contribution: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { contribution } = useTestContribution('mrd-26');
 */
export function useTestContribution(testId) {
  const { vendors, loading, error } = useVendors();

  const contribution = useMemo(() => {
    if (!testId || !vendors.length) return null;

    for (const vendor of vendors) {
      const found = vendor.contributions.find(c => c.testId === testId);
      if (found) {
        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          ...found,
        };
      }
    }

    return null;
  }, [vendors, testId]);

  return { contribution, loading, error };
}

/**
 * Hook: Get vendor statistics
 *
 * @returns {{ stats: Object|null, loading: boolean, error: Error|null }}
 *
 * @example
 * const { stats } = useVendorStats();
 */
export function useVendorStats() {
  const { vendors, loading, error } = useVendors();

  const stats = useMemo(() => {
    if (!vendors.length) return null;

    const result = {
      total: vendors.length,
      withVerifiedTests: 0,
      withAssistancePrograms: 0,
      withContributions: 0,
      totalVerifiedTests: 0,
      totalContributions: 0,
    };

    for (const vendor of vendors) {
      if (vendor.hasVerifiedTests) result.withVerifiedTests++;
      if (vendor.hasAssistanceProgram) result.withAssistancePrograms++;
      if (vendor.hasContributions) result.withContributions++;
      result.totalVerifiedTests += vendor.verifiedTestCount;
      result.totalContributions += vendor.contributionCount;
    }

    return result;
  }, [vendors]);

  return { stats, loading, error };
}

/**
 * Reset the cache (for testing)
 */
export function resetVendorCache() {
  _cachedVendors = null;
  _loadPromise = null;
}
