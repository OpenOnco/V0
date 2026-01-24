/**
 * InMemoryAdapter - In-memory implementation of DataAdapter
 *
 * Stores data in JavaScript arrays and uses QueryBuilder for filtering/sorting.
 * This is the default adapter for the current implementation.
 */

import { DataAdapter } from './DataAdapter.js';
import {
  matchesWhere,
  applyOrderBy,
  applySelect,
  applyPagination,
  buildResult,
} from '../QueryBuilder.js';
import { buildLookupMaps } from '../normalizer.js';

export class InMemoryAdapter extends DataAdapter {
  /**
   * @param {Object} collections - Map of collection name to array of records
   */
  constructor(collections = {}) {
    super();
    this.collections = collections;
    this.lookupMaps = {};

    // Build lookup maps for each collection
    for (const [name, data] of Object.entries(collections)) {
      this.lookupMaps[name] = buildLookupMaps(data);
    }
  }

  /**
   * Get a collection by name
   * @param {string} collection - Collection name
   * @returns {Array}
   * @private
   */
  _getCollection(collection) {
    const data = this.collections[collection];
    if (!data) {
      throw new Error(`Collection not found: ${collection}`);
    }
    return data;
  }

  /**
   * Get lookup maps for a collection
   * @param {string} collection - Collection name
   * @returns {Object}
   * @private
   */
  _getLookupMaps(collection) {
    return this.lookupMaps[collection] || { byId: new Map(), bySlug: new Map(), bySlugAndCategory: new Map() };
  }

  /**
   * Find multiple records from a collection
   * @param {string} collection - Collection name
   * @param {Object} [options] - Query options
   * @returns {Promise<{data: Array, meta: Object}>}
   */
  async findMany(collection, options = {}) {
    const { where, orderBy, skip, take, select } = options;

    let records = this._getCollection(collection);

    // Apply where filter
    if (where && Object.keys(where).length > 0) {
      records = records.filter(record => matchesWhere(record, where));
    }

    const total = records.length;

    // Apply ordering
    if (orderBy) {
      records = applyOrderBy(records, orderBy);
    }

    // Apply pagination
    records = applyPagination(records, skip, take);

    // Apply field selection
    if (select) {
      records = applySelect(records, select);
    }

    return buildResult(records, total, { skip, take });
  }

  /**
   * Find a single record by ID
   * @param {string} collection - Collection name
   * @param {string} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async findById(collection, id) {
    const maps = this._getLookupMaps(collection);
    return maps.byId.get(id) || null;
  }

  /**
   * Find a record by slug (optionally within a category)
   * @param {string} collection - Collection name
   * @param {string} slug - The slug to find
   * @param {string} [category] - Optional category to narrow search
   * @returns {Promise<Object|null>}
   */
  async findBySlug(collection, slug, category) {
    const maps = this._getLookupMaps(collection);

    if (category) {
      return maps.bySlugAndCategory.get(`${category}:${slug}`) || null;
    }

    // Without category, return first match (or null)
    const matches = maps.bySlug.get(slug);
    return matches && matches.length > 0 ? matches[0] : null;
  }

  /**
   * Find the first record matching conditions
   * @param {string} collection - Collection name
   * @param {Object} where - Filter conditions
   * @returns {Promise<Object|null>}
   */
  async findFirst(collection, where) {
    const records = this._getCollection(collection);

    for (const record of records) {
      if (matchesWhere(record, where)) {
        return record;
      }
    }

    return null;
  }

  /**
   * Count records matching conditions
   * @param {string} collection - Collection name
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<number>}
   */
  async count(collection, where) {
    const records = this._getCollection(collection);

    if (!where || Object.keys(where).length === 0) {
      return records.length;
    }

    return records.filter(record => matchesWhere(record, where)).length;
  }

  /**
   * Get distinct values for a field
   * @param {string} collection - Collection name
   * @param {string} field - Field to get distinct values from
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<Array>}
   */
  async distinct(collection, field, where) {
    let records = this._getCollection(collection);

    if (where && Object.keys(where).length > 0) {
      records = records.filter(record => matchesWhere(record, where));
    }

    const values = new Set();

    for (const record of records) {
      const value = record[field];
      if (value == null) continue;

      if (Array.isArray(value)) {
        // Flatten array fields (e.g., cancerTypes)
        for (const item of value) {
          values.add(item);
        }
      } else {
        values.add(value);
      }
    }

    return Array.from(values).sort();
  }

  /**
   * Count records grouped by a field
   * @param {string} collection - Collection name
   * @param {string} groupBy - Field to group by
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<Object>} - Map of group value to count
   */
  async countBy(collection, groupBy, where) {
    let records = this._getCollection(collection);

    if (where && Object.keys(where).length > 0) {
      records = records.filter(record => matchesWhere(record, where));
    }

    const counts = {};

    for (const record of records) {
      const value = record[groupBy];
      if (value == null) continue;

      const key = String(value);
      counts[key] = (counts[key] || 0) + 1;
    }

    return counts;
  }

  /**
   * Get the raw collection data (for advanced operations)
   * @param {string} collection - Collection name
   * @returns {Array}
   */
  getRawData(collection) {
    return this._getCollection(collection);
  }
}
