/**
 * DataAdapter - Abstract interface for data access
 *
 * This defines the contract that all adapters must implement.
 * Currently: InMemoryAdapter
 * Future: PostgresAdapter, etc.
 *
 * @typedef {Object} QueryOptions
 * @property {Object} [where] - Filter conditions using operators
 * @property {Object|Array} [orderBy] - Sort specification
 * @property {number} [skip] - Number of records to skip (pagination)
 * @property {number} [take] - Number of records to return (pagination)
 * @property {Object} [select] - Fields to include/exclude
 *
 * @typedef {Object} QueryResult
 * @property {Array} data - The result records
 * @property {Object} meta - Metadata about the result
 * @property {number} meta.total - Total count before pagination
 * @property {number} meta.returned - Number of records returned
 * @property {boolean} meta.hasMore - Whether more records exist
 * @property {number} [meta.skip] - Skip value used
 * @property {number} [meta.take] - Take value used
 */

/**
 * Abstract DataAdapter class
 * All adapters must implement these methods
 */
export class DataAdapter {
  /**
   * Find multiple records from a collection
   * @param {string} collection - Collection name (e.g., 'tests')
   * @param {QueryOptions} [options] - Query options
   * @returns {Promise<QueryResult>}
   */
  async findMany(collection, options = {}) {
    throw new Error('Method not implemented: findMany');
  }

  /**
   * Find a single record by ID
   * @param {string} collection - Collection name
   * @param {string} id - Record ID
   * @returns {Promise<Object|null>}
   */
  async findById(collection, id) {
    throw new Error('Method not implemented: findById');
  }

  /**
   * Find the first record matching conditions
   * @param {string} collection - Collection name
   * @param {Object} where - Filter conditions
   * @returns {Promise<Object|null>}
   */
  async findFirst(collection, where) {
    throw new Error('Method not implemented: findFirst');
  }

  /**
   * Count records matching conditions
   * @param {string} collection - Collection name
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<number>}
   */
  async count(collection, where) {
    throw new Error('Method not implemented: count');
  }

  /**
   * Get distinct values for a field
   * @param {string} collection - Collection name
   * @param {string} field - Field to get distinct values from
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<Array>}
   */
  async distinct(collection, field, where) {
    throw new Error('Method not implemented: distinct');
  }

  /**
   * Aggregate records (count by group)
   * @param {string} collection - Collection name
   * @param {string} groupBy - Field to group by
   * @param {Object} [where] - Filter conditions
   * @returns {Promise<Object>} - Map of group value to count
   */
  async countBy(collection, groupBy, where) {
    throw new Error('Method not implemented: countBy');
  }
}
