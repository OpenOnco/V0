/**
 * Canonical payer ID normalization.
 *
 * Maps variant payer IDs (kebab-case, LOB-specific, etc.) to their
 * canonical form defined in payer-ids.json.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const payerIds = require('../data/payer-ids.json');

const aliasMap = new Map();
for (const [canonical, { aliases }] of Object.entries(payerIds)) {
  aliasMap.set(canonical, canonical);
  for (const alias of aliases || []) {
    aliasMap.set(alias.toLowerCase(), canonical);
  }
}

/**
 * Normalize a payer ID to its canonical form.
 * @param {string} raw - Raw payer ID
 * @returns {string|null} Canonical ID or null if unknown
 */
export function normalizePayerId(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  return aliasMap.get(lower) || null;
}

/**
 * Check if a payer ID is recognized (canonical or alias).
 * @param {string} raw - Raw payer ID
 * @returns {boolean}
 */
export function isValidPayerId(raw) {
  return normalizePayerId(raw) !== null;
}

/**
 * Get the display name for a payer ID.
 * @param {string} raw - Raw payer ID
 * @returns {string|null}
 */
export function getPayerName(raw) {
  const canonical = normalizePayerId(raw);
  if (!canonical) return null;
  return payerIds[canonical]?.name || null;
}
