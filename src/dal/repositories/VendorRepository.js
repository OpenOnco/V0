/**
 * VendorRepository - Domain-specific methods for vendor data access
 *
 * Provides high-level methods for querying consolidated vendor data,
 * including verification status, contributions, and assistance programs.
 */

import { buildVendorLookupMaps } from '../normalizers/vendors.js';

export class VendorRepository {
  /**
   * @param {import('../adapters/DataAdapter.js').DataAdapter} adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
    this.collection = 'vendors';
    this._lookupMaps = null;
  }

  /**
   * Get or build lookup maps for fast queries
   * @private
   */
  _getLookupMaps() {
    if (!this._lookupMaps) {
      try {
        const data = this.adapter.getRawData(this.collection);
        this._lookupMaps = buildVendorLookupMaps(data);
      } catch {
        this._lookupMaps = {
          byId: new Map(),
          byName: new Map(),
        };
      }
    }
    return this._lookupMaps;
  }

  // ============================================================================
  // CORE QUERY METHODS
  // ============================================================================

  /**
   * Find all vendors with optional filtering and pagination
   * @param {Object} [options] - Query options
   * @param {Object} [options.where] - Filter conditions
   * @param {Object|Array} [options.orderBy] - Sort specification
   * @param {number} [options.skip] - Records to skip
   * @param {number} [options.take] - Records to return
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findAll(options = {}) {
    return this.adapter.findMany(this.collection, options);
  }

  /**
   * Find a vendor by ID
   * @param {string} id - Vendor ID (slugified vendor name)
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const maps = this._getLookupMaps();
    return maps.byId.get(id) || null;
  }

  /**
   * Find a vendor by name (case-insensitive)
   * @param {string} name - Vendor name
   * @returns {Promise<Object|null>}
   */
  async findByName(name) {
    const maps = this._getLookupMaps();
    return maps.byName.get(name.toLowerCase()) || null;
  }

  // ============================================================================
  // VERIFICATION QUERIES
  // ============================================================================

  /**
   * Find vendors with verified tests
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findVerified(options = {}) {
    const where = {
      ...options.where,
      hasVerifiedTests: true,
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  /**
   * Check if a specific test is vendor-verified
   * @param {string} testId - Test ID (e.g., 'mrd-1')
   * @returns {Promise<boolean>}
   */
  async isTestVerified(testId) {
    const { data: vendors } = await this.findAll();
    return vendors.some(v => v.verifiedTestIds.includes(testId));
  }

  /**
   * Get verification details for a test
   * @param {string} testId - Test ID
   * @returns {Promise<Object|null>} - Verification data or null
   */
  async getTestVerification(testId) {
    const { data: vendors } = await this.findAll();

    for (const vendor of vendors) {
      const contribution = vendor.contributions.find(
        c => c.testId === testId && c.verifiedDate
      );
      if (contribution) {
        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          verifierName: contribution.name,
          verifiedDate: contribution.verifiedDate,
        };
      }
    }

    return null;
  }

  // ============================================================================
  // ASSISTANCE PROGRAM QUERIES
  // ============================================================================

  /**
   * Find vendors with patient assistance programs
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findWithAssistanceProgram(options = {}) {
    const where = {
      ...options.where,
      hasAssistanceProgram: true,
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  /**
   * Get assistance program details for a vendor
   * @param {string} vendorName - Vendor name
   * @returns {Promise<Object|null>}
   */
  async getAssistanceProgram(vendorName) {
    const vendor = await this.findByName(vendorName);
    return vendor?.assistanceProgram || null;
  }

  /**
   * Get assistance program by test name
   * Matches vendor name containing the test's vendor name
   * @param {string} testVendorName - Vendor name from test
   * @returns {Promise<Object|null>}
   */
  async getAssistanceProgramForTest(testVendorName) {
    const { data: vendors } = await this.findWithAssistanceProgram();

    // Direct match
    const directMatch = vendors.find(
      v => v.name.toLowerCase() === testVendorName.toLowerCase()
    );
    if (directMatch) return directMatch.assistanceProgram;

    // Partial match (test vendor contains program vendor name)
    for (const vendor of vendors) {
      if (testVendorName.toLowerCase().includes(vendor.name.toLowerCase())) {
        return vendor.assistanceProgram;
      }
    }

    return null;
  }

  /**
   * Check if a vendor has a patient assistance program
   * @param {string} vendorName - Vendor name
   * @returns {Promise<boolean>}
   */
  async hasAssistanceProgram(vendorName) {
    const program = await this.getAssistanceProgram(vendorName);
    return program?.hasProgram === true;
  }

  // ============================================================================
  // CONTRIBUTION QUERIES
  // ============================================================================

  /**
   * Find vendors with contributions
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findWithContributions(options = {}) {
    const where = {
      ...options.where,
      hasContributions: true,
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  /**
   * Get contribution details for a test
   * @param {string} testId - Test ID
   * @returns {Promise<Object|null>}
   */
  async getContribution(testId) {
    const { data: vendors } = await this.findAll();

    for (const vendor of vendors) {
      const contribution = vendor.contributions.find(c => c.testId === testId);
      if (contribution) {
        return {
          vendorId: vendor.id,
          vendorName: vendor.name,
          ...contribution,
        };
      }
    }

    return null;
  }

  // ============================================================================
  // AGGREGATION / STATS
  // ============================================================================

  /**
   * Count vendors with optional filter
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<number>}
   */
  async count(where) {
    return this.adapter.count(this.collection, where);
  }

  /**
   * Get vendor statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const { data: vendors } = await this.findAll();

    const stats = {
      total: vendors.length,
      withVerifiedTests: 0,
      withAssistancePrograms: 0,
      withContributions: 0,
      totalVerifiedTests: 0,
      totalContributions: 0,
    };

    for (const vendor of vendors) {
      if (vendor.hasVerifiedTests) stats.withVerifiedTests++;
      if (vendor.hasAssistanceProgram) stats.withAssistancePrograms++;
      if (vendor.hasContributions) stats.withContributions++;
      stats.totalVerifiedTests += vendor.verifiedTestCount;
      stats.totalContributions += vendor.contributionCount;
    }

    return stats;
  }

  /**
   * Get top vendors by test count
   * @param {number} [limit=10] - Number of vendors to return
   * @returns {Promise<Array>}
   */
  async getTopByTestCount(limit = 10) {
    const { data: vendors } = await this.findAll();
    return vendors
      .filter(v => v.testCount > 0)
      .sort((a, b) => b.testCount - a.testCount)
      .slice(0, limit);
  }

  // ============================================================================
  // SEARCH
  // ============================================================================

  /**
   * Search vendors by name
   * @param {string} query - Search query
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async search(query, options = {}) {
    const queryLower = query.toLowerCase();

    const { data: allVendors } = await this.adapter.findMany(this.collection, {
      ...options,
      skip: undefined,
      take: undefined,
    });

    const matches = allVendors.filter(vendor =>
      vendor.name.toLowerCase().includes(queryLower)
    );

    const total = matches.length;
    const skip = options.skip || 0;
    const take = options.take;
    const paginatedData = take !== undefined
      ? matches.slice(skip, skip + take)
      : matches.slice(skip);

    return {
      data: paginatedData,
      meta: {
        total,
        returned: paginatedData.length,
        hasMore: take !== undefined ? (skip + paginatedData.length) < total : false,
        skip,
        take,
        query,
      },
    };
  }
}
