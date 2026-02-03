/**
 * Custom serializers for Pino logger
 */

/**
 * Serialize Error objects with full details
 * Captures message, name, stack, code, statusCode, and additional enumerable properties
 *
 * @param {Error} error - Error object to serialize
 * @returns {object} Serialized error object
 */
export function errorSerializer(error) {
  if (!error || typeof error !== 'object') {
    return error;
  }

  const serialized = {
    message: error.message,
    name: error.name,
    stack: error.stack
  };

  // Capture common error properties if present
  if (error.code !== undefined) {
    serialized.code = error.code;
  }
  if (error.statusCode !== undefined) {
    serialized.statusCode = error.statusCode;
  }

  // Capture any additional enumerable properties
  for (const key of Object.keys(error)) {
    if (!(key in serialized)) {
      serialized[key] = error[key];
    }
  }

  return serialized;
}

export const serializers = {
  error: errorSerializer,
  err: errorSerializer
};
