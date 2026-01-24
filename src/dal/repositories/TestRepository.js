/**
 * TestRepository - Domain-specific methods for test data access
 *
 * Provides high-level methods for common test queries,
 * built on top of the DataAdapter interface.
 */

export class TestRepository {
  /**
   * @param {import('../adapters/DataAdapter.js').DataAdapter} adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
    this.collection = 'tests';
  }

  // ============================================================================
  // CORE QUERY METHODS
  // ============================================================================

  /**
   * Find all tests with optional filtering and pagination
   * @param {Object} [options] - Query options
   * @param {Object} [options.where] - Filter conditions
   * @param {Object|Array} [options.orderBy] - Sort specification
   * @param {number} [options.skip] - Records to skip
   * @param {number} [options.take] - Records to return
   * @param {Object} [options.select] - Fields to include
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findAll(options = {}) {
    return this.adapter.findMany(this.collection, options);
  }

  /**
   * Find a test by its ID
   * @param {string} id - Test ID (e.g., 'mrd-1', 'ecd-5')
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    return this.adapter.findById(this.collection, id);
  }

  /**
   * Find a test by its URL slug
   * @param {string} slug - URL slug
   * @param {string} [category] - Optional category code to narrow search
   * @returns {Promise<Object|null>}
   */
  async findBySlug(slug, category) {
    return this.adapter.findBySlug(this.collection, slug, category);
  }

  /**
   * Find the first test matching conditions
   * @param {Object} where - Filter conditions
   * @returns {Promise<Object|null>}
   */
  async findFirst(where) {
    return this.adapter.findFirst(this.collection, where);
  }

  // ============================================================================
  // CATEGORY-BASED QUERIES
  // ============================================================================

  /**
   * Find tests by category
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

  /**
   * Find tests by multiple categories
   * @param {Array<string>} categories - Array of category codes
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByCategories(categories, options = {}) {
    const normalizedCategories = categories.map(c => c.toUpperCase());
    const where = {
      ...options.where,
      category: { in: normalizedCategories },
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  // ============================================================================
  // VENDOR-BASED QUERIES
  // ============================================================================

  /**
   * Find tests by vendor name (partial match)
   * @param {string} vendorName - Vendor name to search for
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByVendor(vendorName, options = {}) {
    const where = {
      ...options.where,
      vendor: { contains: vendorName },
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  /**
   * Find tests by exact vendor name
   * @param {string} vendorName - Exact vendor name
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByVendorExact(vendorName, options = {}) {
    const where = {
      ...options.where,
      vendor: vendorName,
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  // ============================================================================
  // CANCER TYPE QUERIES
  // ============================================================================

  /**
   * Find tests by cancer type (partial match in cancerTypes array)
   * @param {string} cancerType - Cancer type to search for
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByCancer(cancerType, options = {}) {
    const where = {
      ...options.where,
      cancerTypes: { arrayContains: cancerType },
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  /**
   * Find tests that cover any of the specified cancer types
   * @param {Array<string>} cancerTypes - Cancer types to search for
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByCancers(cancerTypes, options = {}) {
    const where = {
      ...options.where,
      cancerTypes: { hasAny: cancerTypes },
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  // ============================================================================
  // FDA STATUS QUERIES
  // ============================================================================

  /**
   * Find tests by FDA status
   * @param {'approved'|'ldt'|'breakthrough'|'all'} status - FDA status filter
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByFdaStatus(status, options = {}) {
    if (status === 'all') {
      return this.adapter.findMany(this.collection, options);
    }

    // FDA status is stored as text, so we need to search within it
    const where = { ...options.where };

    if (status === 'approved') {
      where.fdaStatus = { contains: 'FDA' };
    } else if (status === 'ldt') {
      where.OR = [
        { fdaStatus: { contains: 'LDT' } },
        { fdaStatus: { contains: 'CLIA' } },
      ];
    } else if (status === 'breakthrough') {
      where.fdaStatus = { contains: 'Breakthrough' };
    }

    return this.adapter.findMany(this.collection, { ...options, where });
  }

  // ============================================================================
  // VERIFICATION QUERIES
  // ============================================================================

  /**
   * Find vendor-verified tests
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findVendorVerified(options = {}) {
    const where = {
      ...options.where,
      vendorVerified: true,
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  // ============================================================================
  // SEARCH
  // ============================================================================

  /**
   * Full-text search across multiple fields
   * @param {string} query - Search query
   * @param {Array<string>} [fields] - Fields to search in
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async search(query, fields, options = {}) {
    const searchFields = fields || ['name', 'vendor', 'cancerTypes', 'description', 'biomarkers', 'clinicalSettings'];
    const queryLower = query.toLowerCase();

    // Get all records that match the base where clause
    const { data: allRecords } = await this.adapter.findMany(this.collection, {
      ...options,
      where: options.where,
      skip: undefined,
      take: undefined,
    });

    // Filter by search terms
    const matches = allRecords.filter(record => {
      for (const field of searchFields) {
        const value = record[field];
        if (value == null) continue;

        if (Array.isArray(value)) {
          if (value.some(item => String(item).toLowerCase().includes(queryLower))) {
            return true;
          }
        } else if (String(value).toLowerCase().includes(queryLower)) {
          return true;
        }
      }
      return false;
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
        query,
        fieldsSearched: searchFields,
      },
    };
  }

  // ============================================================================
  // AGGREGATION / STATS
  // ============================================================================

  /**
   * Count tests by category
   * @returns {Promise<Object>} - Map of category to count
   */
  async countByCategory() {
    return this.adapter.countBy(this.collection, 'category');
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const total = await this.adapter.count(this.collection);
    const byCategory = await this.countByCategory();
    const vendors = await this.adapter.distinct(this.collection, 'vendor');
    const cancerTypes = await this.adapter.distinct(this.collection, 'cancerTypes');

    // Count vendors per category
    const vendorsByCategory = {};
    for (const category of Object.keys(byCategory)) {
      const categoryVendors = await this.adapter.distinct(
        this.collection,
        'vendor',
        { category }
      );
      vendorsByCategory[category] = categoryVendors.length;
    }

    return {
      totals: {
        tests: total,
        vendors: vendors.length,
        cancerTypes: cancerTypes.length,
      },
      byCategory: Object.fromEntries(
        Object.entries(byCategory).map(([cat, count]) => [
          cat,
          {
            tests: count,
            vendors: vendorsByCategory[cat] || 0,
          },
        ])
      ),
    };
  }

  /**
   * Get distinct cancer types
   * @param {string} [category] - Optional category to filter by
   * @returns {Promise<Array<string>>}
   */
  async getDistinctCancerTypes(category) {
    const where = category ? { category: category.toUpperCase() } : undefined;
    return this.adapter.distinct(this.collection, 'cancerTypes', where);
  }

  /**
   * Get distinct vendors
   * @param {string} [category] - Optional category to filter by
   * @returns {Promise<Array<string>>}
   */
  async getDistinctVendors(category) {
    const where = category ? { category: category.toUpperCase() } : undefined;
    return this.adapter.distinct(this.collection, 'vendor', where);
  }

  /**
   * Count total tests
   * @param {Object} [where] - Optional filter conditions
   * @returns {Promise<number>}
   */
  async count(where) {
    return this.adapter.count(this.collection, where);
  }

  // ============================================================================
  // COVERAGE QUERIES
  // ============================================================================

  /**
   * Find tests with coverage data
   * @param {Object} [options] - Query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findWithCoverage(options = {}) {
    const where = {
      ...options.where,
      coverageCrossReference: { isNotNull: true },
    };
    return this.adapter.findMany(this.collection, { ...options, where });
  }

  /**
   * Find tests by Medicare coverage status
   * @param {string} status - Medicare status (COVERED, NOT_COVERED, etc.)
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findByMedicareStatus(status, options = {}) {
    // This requires custom filtering since it's a nested field
    const { data: allTests } = await this.adapter.findMany(this.collection, {
      ...options,
      where: options.where,
      skip: undefined,
      take: undefined,
    });

    const matches = allTests.filter(
      t => t.coverageCrossReference?.medicare?.status === status.toUpperCase()
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
      },
    };
  }
}
