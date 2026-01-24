/**
 * ChangelogRepository - Domain-specific methods for changelog data access
 *
 * Provides high-level methods for querying the database changelog,
 * built on top of the DataAdapter interface.
 */

import { buildChangelogLookupMaps } from '../normalizers/changelog.js';

export class ChangelogRepository {
  /**
   * @param {import('../adapters/DataAdapter.js').DataAdapter} adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
    this.collection = 'changelog';
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
        this._lookupMaps = buildChangelogLookupMaps(data);
      } catch {
        // Collection might not exist yet
        this._lookupMaps = {
          byId: new Map(),
          byTestId: new Map(),
          byDate: new Map(),
          byType: new Map(),
        };
      }
    }
    return this._lookupMaps;
  }

  // ============================================================================
  // CORE QUERY METHODS
  // ============================================================================

  /**
   * Find all changelog entries with optional filtering and pagination
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
   * Find a changelog entry by ID
   * @param {string} id - Entry ID
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const maps = this._getLookupMaps();
    return maps.byId.get(id) || null;
  }

  // ============================================================================
  // DATE-BASED QUERIES
  // ============================================================================

  /**
   * Find changelog entries within a date range
   * @param {string|Date} startDate - Start date (inclusive)
   * @param {string|Date} endDate - End date (inclusive)
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByDateRange(startDate, endDate, options = {}) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all entries and filter by date
    const { data: allEntries } = await this.adapter.findMany(this.collection, {
      ...options,
      skip: undefined,
      take: undefined,
    });

    const matches = allEntries.filter(entry => {
      if (!entry.dateParsed) return false;
      return entry.dateParsed >= start && entry.dateParsed <= end;
    });

    // Apply pagination
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
      },
    };
  }

  /**
   * Find changelog entries for a specific date
   * @param {string} dateISO - ISO date string (YYYY-MM-DD)
   * @returns {Promise<Array>}
   */
  async findByDate(dateISO) {
    const maps = this._getLookupMaps();
    return maps.byDate.get(dateISO) || [];
  }

  // ============================================================================
  // TYPE-BASED QUERIES
  // ============================================================================

  /**
   * Find changelog entries by change type
   * @param {'added'|'updated'|'removed'} type - Change type
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByChangeType(type, options = {}) {
    const where = {
      ...options.where,
      type: type.toLowerCase(),
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  // ============================================================================
  // TEST-BASED QUERIES
  // ============================================================================

  /**
   * Find changelog entries for a specific test
   * @param {string} testId - Test ID (e.g., 'mrd-1')
   * @returns {Promise<Array>}
   */
  async findByTestId(testId) {
    const maps = this._getLookupMaps();
    return maps.byTestId.get(testId) || [];
  }

  /**
   * Find changelog entries by category
   * @param {string} category - Category code (MRD, ECD, CGP, HCT)
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByCategory(category, options = {}) {
    const where = {
      ...options.where,
      category: category.toUpperCase(),
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Get the most recent changelog entries
   * @param {number} [limit=10] - Number of entries to return
   * @returns {Promise<Array>}
   */
  async getRecentChanges(limit = 10) {
    // Changelog is typically already in reverse chronological order
    const { data } = await this.adapter.findMany(this.collection, {
      take: limit,
    });
    return data;
  }

  /**
   * Get changelog entries for recently added tests
   * @param {number} [limit=10] - Number of entries to return
   * @returns {Promise<Array>}
   */
  async getRecentlyAdded(limit = 10) {
    const { data } = await this.findByChangeType('added', { take: limit * 2 });
    // Return the most recent 'added' entries
    return data.slice(0, limit);
  }

  // ============================================================================
  // AGGREGATION / STATS
  // ============================================================================

  /**
   * Count changelog entries with optional filter
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<number>}
   */
  async count(where) {
    return this.adapter.count(this.collection, where);
  }

  /**
   * Count changelog entries by type
   * @returns {Promise<Object>} - Map of type to count
   */
  async countByType() {
    return this.adapter.countBy(this.collection, 'type');
  }

  /**
   * Count changelog entries by category
   * @returns {Promise<Object>} - Map of category to count
   */
  async countByCategory() {
    return this.adapter.countBy(this.collection, 'category');
  }

  /**
   * Get distinct contributors
   * @returns {Promise<Array<string>>}
   */
  async getDistinctContributors() {
    return this.adapter.distinct(this.collection, 'contributor');
  }

  /**
   * Get changelog statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const total = await this.count();
    const byType = await this.countByType();
    const byCategory = await this.countByCategory();
    const contributors = await this.getDistinctContributors();

    return {
      total,
      byType,
      byCategory,
      contributorCount: contributors.length,
    };
  }

  // ============================================================================
  // SEARCH
  // ============================================================================

  /**
   * Search changelog entries by description
   * @param {string} query - Search query
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async search(query, options = {}) {
    const queryLower = query.toLowerCase();

    const { data: allEntries } = await this.adapter.findMany(this.collection, {
      ...options,
      skip: undefined,
      take: undefined,
    });

    const matches = allEntries.filter(entry => {
      return (
        entry.description?.toLowerCase().includes(queryLower) ||
        entry.testName?.toLowerCase().includes(queryLower) ||
        entry.vendor?.toLowerCase().includes(queryLower) ||
        entry.contributor?.toLowerCase().includes(queryLower)
      );
    });

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
