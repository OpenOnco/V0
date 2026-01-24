/**
 * Query operators for the Data Access Layer
 * Prisma-like operators for filtering data
 */

/**
 * Check if a string field contains a substring (case-insensitive)
 * @param {*} fieldValue - The value from the record
 * @param {string} target - The substring to search for
 * @returns {boolean}
 */
export const contains = (fieldValue, target) => {
  if (fieldValue == null || target == null) return false;
  return String(fieldValue).toLowerCase().includes(String(target).toLowerCase());
};

/**
 * Check strict equality
 * @param {*} fieldValue - The value from the record
 * @param {*} target - The value to compare against
 * @returns {boolean}
 */
export const equals = (fieldValue, target) => fieldValue === target;

/**
 * Check if a value is in a list of targets
 * @param {*} fieldValue - The value from the record
 * @param {Array} targets - Array of acceptable values
 * @returns {boolean}
 */
export const isIn = (fieldValue, targets) => {
  if (!Array.isArray(targets)) return false;
  return targets.includes(fieldValue);
};

/**
 * Check if an array field has any of the target values
 * @param {Array} fieldValue - Array field from the record
 * @param {Array} targets - Array of values to check for
 * @returns {boolean}
 */
export const hasAny = (fieldValue, targets) => {
  if (!Array.isArray(fieldValue) || !Array.isArray(targets)) return false;
  return targets.some(t => fieldValue.includes(t));
};

/**
 * Check if an array field has all of the target values
 * @param {Array} fieldValue - Array field from the record
 * @param {Array} targets - Array of values that must all be present
 * @returns {boolean}
 */
export const hasAll = (fieldValue, targets) => {
  if (!Array.isArray(fieldValue) || !Array.isArray(targets)) return false;
  return targets.every(t => fieldValue.includes(t));
};

/**
 * Check if an array field contains a value (case-insensitive for strings)
 * @param {Array} fieldValue - Array field from the record
 * @param {*} target - Value to check for
 * @returns {boolean}
 */
export const arrayContains = (fieldValue, target) => {
  if (!Array.isArray(fieldValue)) return false;
  if (typeof target === 'string') {
    const targetLower = target.toLowerCase();
    return fieldValue.some(v =>
      typeof v === 'string' && v.toLowerCase().includes(targetLower)
    );
  }
  return fieldValue.includes(target);
};

/**
 * Greater than comparison
 * @param {*} fieldValue - The value from the record
 * @param {number} target - The threshold
 * @returns {boolean}
 */
export const gt = (fieldValue, target) => {
  const num = parseFloat(fieldValue);
  return !isNaN(num) && num > target;
};

/**
 * Greater than or equal comparison
 * @param {*} fieldValue - The value from the record
 * @param {number} target - The threshold
 * @returns {boolean}
 */
export const gte = (fieldValue, target) => {
  const num = parseFloat(fieldValue);
  return !isNaN(num) && num >= target;
};

/**
 * Less than comparison
 * @param {*} fieldValue - The value from the record
 * @param {number} target - The threshold
 * @returns {boolean}
 */
export const lt = (fieldValue, target) => {
  const num = parseFloat(fieldValue);
  return !isNaN(num) && num < target;
};

/**
 * Less than or equal comparison
 * @param {*} fieldValue - The value from the record
 * @param {number} target - The threshold
 * @returns {boolean}
 */
export const lte = (fieldValue, target) => {
  const num = parseFloat(fieldValue);
  return !isNaN(num) && num <= target;
};

/**
 * Check if a value is not equal
 * @param {*} fieldValue - The value from the record
 * @param {*} target - The value to compare against
 * @returns {boolean}
 */
export const not = (fieldValue, target) => fieldValue !== target;

/**
 * Check if a value is not null/undefined
 * @param {*} fieldValue - The value from the record
 * @returns {boolean}
 */
export const isNotNull = (fieldValue) => fieldValue != null;

/**
 * Check if a value is null/undefined
 * @param {*} fieldValue - The value from the record
 * @returns {boolean}
 */
export const isNull = (fieldValue) => fieldValue == null;

/**
 * Case-insensitive equality
 * @param {*} fieldValue - The value from the record
 * @param {string} target - The value to compare against
 * @returns {boolean}
 */
export const equalsInsensitive = (fieldValue, target) => {
  if (fieldValue == null || target == null) return fieldValue === target;
  return String(fieldValue).toLowerCase() === String(target).toLowerCase();
};

/**
 * Check if string starts with target (case-insensitive)
 * @param {*} fieldValue - The value from the record
 * @param {string} target - The prefix to check
 * @returns {boolean}
 */
export const startsWith = (fieldValue, target) => {
  if (fieldValue == null || target == null) return false;
  return String(fieldValue).toLowerCase().startsWith(String(target).toLowerCase());
};

/**
 * Check if string ends with target (case-insensitive)
 * @param {*} fieldValue - The value from the record
 * @param {string} target - The suffix to check
 * @returns {boolean}
 */
export const endsWith = (fieldValue, target) => {
  if (fieldValue == null || target == null) return false;
  return String(fieldValue).toLowerCase().endsWith(String(target).toLowerCase());
};

/**
 * All operators as a map
 */
export const operators = {
  equals,
  contains,
  in: isIn,
  hasAny,
  hasAll,
  arrayContains,
  gt,
  gte,
  lt,
  lte,
  not,
  isNotNull,
  isNull,
  equalsInsensitive,
  startsWith,
  endsWith,
};
