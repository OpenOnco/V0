/**
 * QueryBuilder - Functions for filtering and sorting data
 */

import { operators } from './operators.js';

/**
 * Evaluate a single condition against a record
 * @param {Object} record - The data record
 * @param {string} field - The field name to check
 * @param {Object|*} condition - The condition (operator object or direct value)
 * @returns {boolean}
 */
function evaluateCondition(record, field, condition) {
  const fieldValue = record[field];

  // Direct value comparison (shorthand for equals)
  if (condition === null || typeof condition !== 'object') {
    return fieldValue === condition;
  }

  // Operator-based condition
  for (const [op, target] of Object.entries(condition)) {
    const operatorFn = operators[op];
    if (!operatorFn) {
      console.warn(`Unknown operator: ${op}`);
      continue;
    }
    if (!operatorFn(fieldValue, target)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a record matches a where clause
 * @param {Object} record - The data record to check
 * @param {Object} where - The where clause with field conditions
 * @returns {boolean}
 */
export function matchesWhere(record, where) {
  if (!where || Object.keys(where).length === 0) {
    return true;
  }

  for (const [field, condition] of Object.entries(where)) {
    // Handle logical operators
    if (field === 'AND') {
      if (!Array.isArray(condition)) continue;
      if (!condition.every(subWhere => matchesWhere(record, subWhere))) {
        return false;
      }
      continue;
    }

    if (field === 'OR') {
      if (!Array.isArray(condition)) continue;
      if (!condition.some(subWhere => matchesWhere(record, subWhere))) {
        return false;
      }
      continue;
    }

    if (field === 'NOT') {
      if (matchesWhere(record, condition)) {
        return false;
      }
      continue;
    }

    // Regular field condition
    if (!evaluateCondition(record, field, condition)) {
      return false;
    }
  }

  return true;
}

/**
 * Apply orderBy to an array of records
 * @param {Array} records - Array of records to sort
 * @param {Object|Array} orderBy - Sort specification
 * @returns {Array} - Sorted array (new array, doesn't mutate input)
 */
export function applyOrderBy(records, orderBy) {
  if (!orderBy) return records;

  // Normalize to array of {field, direction} objects
  const sortSpecs = Array.isArray(orderBy) ? orderBy : [orderBy];

  return [...records].sort((a, b) => {
    for (const spec of sortSpecs) {
      const [field, direction] = typeof spec === 'object'
        ? Object.entries(spec)[0]
        : [spec, 'asc'];

      const aVal = a[field];
      const bVal = b[field];

      // Handle nulls - put them at the end
      if (aVal == null && bVal == null) continue;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Compare values
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      if (comparison !== 0) {
        return direction === 'desc' ? -comparison : comparison;
      }
    }
    return 0;
  });
}

/**
 * Apply select to pick specific fields from records
 * @param {Array} records - Array of records
 * @param {Object} select - Fields to include (true) or exclude (false)
 * @returns {Array} - Records with only selected fields
 */
export function applySelect(records, select) {
  if (!select || Object.keys(select).length === 0) return records;

  const includeFields = Object.entries(select)
    .filter(([, include]) => include)
    .map(([field]) => field);

  if (includeFields.length === 0) return records;

  return records.map(record => {
    const result = {};
    for (const field of includeFields) {
      if (field in record) {
        result[field] = record[field];
      }
    }
    return result;
  });
}

/**
 * Apply pagination (skip/take) to records
 * @param {Array} records - Array of records
 * @param {number} skip - Number of records to skip
 * @param {number} take - Number of records to take
 * @returns {Array} - Paginated records
 */
export function applyPagination(records, skip = 0, take) {
  if (skip > 0) {
    records = records.slice(skip);
  }
  if (take !== undefined && take !== null) {
    records = records.slice(0, take);
  }
  return records;
}

/**
 * Build query result with metadata
 * @param {Array} data - Result data
 * @param {number} total - Total count before pagination
 * @param {Object} options - Query options (skip, take)
 * @returns {Object} - Result with data and meta
 */
export function buildResult(data, total, options = {}) {
  const { skip = 0, take } = options;
  return {
    data,
    meta: {
      total,
      returned: data.length,
      hasMore: take !== undefined ? (skip + data.length) < total : false,
      skip,
      take,
    },
  };
}
