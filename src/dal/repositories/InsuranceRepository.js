/**
 * InsuranceRepository - Domain-specific methods for insurance provider data access
 *
 * Provides high-level methods for querying insurance provider data
 * and checking test coverage.
 */

import { buildInsuranceLookupMaps } from '../normalizers/insurance.js';

export class InsuranceRepository {
  /**
   * @param {import('../adapters/DataAdapter.js').DataAdapter} adapter
   * @param {Object} [options] - Additional options
   * @param {Map} [options.payerNameMap] - Map of payer names to provider IDs
   */
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.collection = 'insurance';
    this.payerNameMap = options.payerNameMap || new Map();
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
        this._lookupMaps = buildInsuranceLookupMaps(data);
      } catch {
        this._lookupMaps = {
          byId: new Map(),
          byCategory: new Map(),
          byLabel: new Map(),
        };
      }
    }
    return this._lookupMaps;
  }

  // ============================================================================
  // CORE QUERY METHODS
  // ============================================================================

  /**
   * Find all insurance providers with optional filtering
   * @param {Object} [options] - Query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findAll(options = {}) {
    return this.adapter.findMany(this.collection, options);
  }

  /**
   * Find an insurance provider by ID
   * @param {string} id - Provider ID (e.g., 'medicare', 'aetna')
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const maps = this._getLookupMaps();
    return maps.byId.get(id) || null;
  }

  /**
   * Find an insurance provider by label
   * @param {string} label - Provider label (e.g., 'Medicare', 'Aetna')
   * @returns {Promise<Object|null>}
   */
  async findByLabel(label) {
    const maps = this._getLookupMaps();
    return maps.byLabel.get(label.toLowerCase()) || null;
  }

  // ============================================================================
  // CATEGORY-BASED QUERIES
  // ============================================================================

  /**
   * Find insurance providers by category
   * @param {'government'|'national'|'regional'} category - Provider category
   * @returns {Promise<Array>}
   */
  async findByCategory(category) {
    const maps = this._getLookupMaps();
    return maps.byCategory.get(category) || [];
  }

  /**
   * Find government insurance providers (Medicare, Medicaid, VA)
   * @returns {Promise<Array>}
   */
  async findGovernment() {
    return this.findByCategory('government');
  }

  /**
   * Find national commercial insurance providers
   * @returns {Promise<Array>}
   */
  async findNational() {
    return this.findByCategory('national');
  }

  /**
   * Find regional insurance providers
   * @returns {Promise<Array>}
   */
  async findRegional() {
    return this.findByCategory('regional');
  }

  // ============================================================================
  // COVERAGE QUERIES
  // ============================================================================

  /**
   * Resolve a payer name from test data to a provider ID
   * @param {string} payerName - Payer name from test commercialPayers array
   * @returns {Promise<string|null>} - Provider ID or null
   */
  async resolvePayerName(payerName) {
    if (!payerName) return null;
    return this.payerNameMap.get(payerName.toLowerCase()) ||
           this.payerNameMap.get(payerName) ||
           null;
  }

  /**
   * Check if a test is covered by a specific insurance provider
   * @param {Object} test - Test object with reimbursement/commercialPayers data
   * @param {string} providerId - Insurance provider ID
   * @returns {Promise<Object>} - Coverage result
   */
  async isTestCovered(test, providerId) {
    if (!test || !providerId) {
      return { covered: false, reason: 'missing-data' };
    }

    // Handle Medicare specially
    if (providerId === 'medicare') {
      const reimbursement = (test.reimbursement || '').toLowerCase();
      if (reimbursement.includes('medicare')) {
        return { covered: true, type: 'medicare', note: test.reimbursementNote };
      }
      // Check medicareCoverage object if present
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
      for (const payer of test.commercialPayers) {
        const payerId = await this.resolvePayerName(payer);
        if (payerId === providerId) {
          return { covered: true, type: 'commercial', payer };
        }
      }
    }

    // Check inNetworkPlans from assistance programs if available
    // (This would require cross-referencing with vendor data)

    return { covered: false, reason: 'not-in-coverage-list' };
  }

  /**
   * Get all providers that cover a specific test
   * @param {Object} test - Test object with coverage data
   * @returns {Promise<Array>} - Array of provider IDs that cover the test
   */
  async getProvidersCoveringTest(test) {
    if (!test) return [];

    const { data: allProviders } = await this.findAll();
    const coveredBy = [];

    for (const provider of allProviders) {
      const { covered } = await this.isTestCovered(test, provider.id);
      if (covered) {
        coveredBy.push(provider);
      }
    }

    return coveredBy;
  }

  // ============================================================================
  // AGGREGATION / STATS
  // ============================================================================

  /**
   * Count insurance providers with optional filter
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<number>}
   */
  async count(where) {
    return this.adapter.count(this.collection, where);
  }

  /**
   * Count providers by category
   * @returns {Promise<Object>}
   */
  async countByCategory() {
    return this.adapter.countBy(this.collection, 'category');
  }

  /**
   * Get insurance provider statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const total = await this.count();
    const byCategory = await this.countByCategory();

    return {
      total,
      byCategory,
    };
  }
}
