/**
 * GlossaryRepository - Domain-specific methods for glossary data access
 *
 * Provides high-level methods for querying glossary terms,
 * searching definitions, and finding related terms.
 */

import { buildGlossaryLookupMaps } from '../normalizers/glossary.js';

export class GlossaryRepository {
  /**
   * @param {import('../adapters/DataAdapter.js').DataAdapter} adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
    this.collection = 'glossary';
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
        this._lookupMaps = buildGlossaryLookupMaps(data);
      } catch {
        this._lookupMaps = {
          byId: new Map(),
          byTerm: new Map(),
          bySource: new Map(),
        };
      }
    }
    return this._lookupMaps;
  }

  // ============================================================================
  // CORE QUERY METHODS
  // ============================================================================

  /**
   * Find all glossary terms with optional filtering
   * @param {Object} [options] - Query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findAll(options = {}) {
    return this.adapter.findMany(this.collection, options);
  }

  /**
   * Find a glossary term by ID (slug)
   * @param {string} id - Term ID (e.g., 'ctdna', 'mrd')
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const maps = this._getLookupMaps();
    return maps.byId.get(id) || null;
  }

  /**
   * Find a glossary term by term name (case-insensitive)
   * @param {string} term - Term name (e.g., 'Liquid Biopsy')
   * @returns {Promise<Object|null>}
   */
  async findByTerm(term) {
    const maps = this._getLookupMaps();
    return maps.byTerm.get(term.toLowerCase()) || null;
  }

  // ============================================================================
  // SOURCE-BASED QUERIES
  // ============================================================================

  /**
   * Find glossary terms by source
   * @param {string} source - Source name (e.g., 'NCI', 'FDA')
   * @returns {Promise<Array>}
   */
  async findBySource(source) {
    const maps = this._getLookupMaps();
    return maps.bySource.get(source) || [];
  }

  /**
   * Get distinct sources
   * @returns {Promise<Array<string>>}
   */
  async getDistinctSources() {
    return this.adapter.distinct(this.collection, 'source');
  }

  // ============================================================================
  // SEARCH
  // ============================================================================

  /**
   * Search glossary terms by term name and definition
   * @param {string} query - Search query
   * @param {Object} [options] - Additional query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async search(query, options = {}) {
    const queryLower = query.toLowerCase();

    const { data: allTerms } = await this.adapter.findMany(this.collection, {
      ...options,
      skip: undefined,
      take: undefined,
    });

    const matches = allTerms.filter(entry => {
      return (
        entry.term?.toLowerCase().includes(queryLower) ||
        entry.definition?.toLowerCase().includes(queryLower) ||
        entry.shortDefinition?.toLowerCase().includes(queryLower) ||
        entry.id?.toLowerCase().includes(queryLower)
      );
    });

    // Sort by relevance (term match > definition match)
    matches.sort((a, b) => {
      const aTermMatch = a.term?.toLowerCase().includes(queryLower) ? 1 : 0;
      const bTermMatch = b.term?.toLowerCase().includes(queryLower) ? 1 : 0;
      return bTermMatch - aTermMatch;
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

  // ============================================================================
  // RELATED TERMS
  // ============================================================================

  /**
   * Get related terms for a glossary entry
   * @param {string} termId - Term ID
   * @returns {Promise<Array>} - Array of related term entries
   */
  async getRelatedTerms(termId) {
    const entry = await this.findById(termId);
    if (!entry || !entry.relatedTerms?.length) return [];

    const relatedEntries = [];
    for (const relatedId of entry.relatedTerms) {
      const related = await this.findById(relatedId);
      if (related) {
        relatedEntries.push(related);
      }
    }

    return relatedEntries;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get a random glossary term
   * Useful for "word of the day" features
   * @returns {Promise<Object|null>}
   */
  async getRandomTerm() {
    const { data: allTerms } = await this.findAll();
    if (!allTerms.length) return null;

    const randomIndex = Math.floor(Math.random() * allTerms.length);
    return allTerms[randomIndex];
  }

  /**
   * Get terms for a quick reference card
   * Returns a subset of core terms with short definitions
   * @param {number} [limit=10] - Number of terms to return
   * @returns {Promise<Array>}
   */
  async getQuickReference(limit = 10) {
    const { data: allTerms } = await this.findAll();

    // Prefer terms with short definitions
    const withShortDef = allTerms.filter(t => t.shortDefinition);
    const toReturn = withShortDef.length >= limit
      ? withShortDef.slice(0, limit)
      : [...withShortDef, ...allTerms.filter(t => !t.shortDefinition)].slice(0, limit);

    return toReturn;
  }

  // ============================================================================
  // AGGREGATION / STATS
  // ============================================================================

  /**
   * Count glossary terms with optional filter
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<number>}
   */
  async count(where) {
    return this.adapter.count(this.collection, where);
  }

  /**
   * Count terms by source
   * @returns {Promise<Object>}
   */
  async countBySource() {
    return this.adapter.countBy(this.collection, 'source');
  }

  /**
   * Get glossary statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    const total = await this.count();
    const bySource = await this.countBySource();
    const sources = await this.getDistinctSources();

    return {
      total,
      bySource,
      sourceCount: sources.length,
    };
  }
}
