/**
 * PII Sanitization Utilities for API Logging
 *
 * Provides consistent redaction of sensitive data before logging.
 * All API handlers should use these functions when logging user data.
 */

import crypto from 'crypto';

/**
 * Hash an IP address for logging
 * @param {string|undefined} ip - IP address to hash
 * @returns {string|undefined} Hashed IP prefixed with 'ip:' or undefined
 */
export function sanitizeIP(ip) {
  if (!ip) return undefined;
  const hash = crypto.createHash('sha256').update(ip).digest('hex');
  return 'ip:' + hash.slice(0, 8);
}

/**
 * Redact an email address for logging
 * @param {string|undefined} email - Email to redact
 * @returns {string|undefined} '[REDACTED]' or undefined
 */
export function sanitizeEmail(email) {
  return email ? '[REDACTED]' : undefined;
}

/**
 * Truncate a message for logging
 * @param {string|undefined} content - Message content to truncate
 * @param {number} [maxLength=50] - Maximum length before truncation
 * @returns {string|undefined} Truncated message or undefined
 */
export function sanitizeMessage(content, maxLength = 50) {
  if (!content) return undefined;
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '...';
}
