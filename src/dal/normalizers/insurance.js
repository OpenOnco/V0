/**
 * Insurance Data Normalizer
 *
 * Normalizes INSURANCE_PROVIDERS data for consistent querying through the DAL.
 */

/**
 * Normalize insurance providers from categorized object to flat array
 *
 * @param {Object} insuranceProviders - INSURANCE_PROVIDERS object with categories
 * @returns {Array} - Array of normalized insurance provider records
 */
export function normalizeInsurance(insuranceProviders = {}) {
  const providers = [];

  for (const [category, categoryProviders] of Object.entries(insuranceProviders)) {
    if (!Array.isArray(categoryProviders)) continue;

    for (const provider of categoryProviders) {
      providers.push({
        id: provider.id,
        label: provider.label,
        description: provider.description || null,
        category, // 'government', 'national', 'regional'
      });
    }
  }

  return providers;
}

/**
 * Build lookup maps for insurance providers
 * @param {Array} normalizedInsurance - Normalized insurance array
 * @returns {Object} - Lookup maps
 */
export function buildInsuranceLookupMaps(normalizedInsurance) {
  const byId = new Map();
  const byCategory = new Map();
  const byLabel = new Map();

  for (const provider of normalizedInsurance) {
    // By ID
    byId.set(provider.id, provider);

    // By label (for reverse lookup)
    byLabel.set(provider.label.toLowerCase(), provider);

    // By category
    if (!byCategory.has(provider.category)) {
      byCategory.set(provider.category, []);
    }
    byCategory.get(provider.category).push(provider);
  }

  return { byId, byCategory, byLabel };
}

/**
 * Build payer name to ID mapping
 * Used to match test coverage data to insurance providers
 *
 * @param {Object} payerNameToId - PAYER_NAME_TO_ID object from data.js
 * @returns {Map} - Map of payer name to provider ID
 */
export function buildPayerNameMap(payerNameToId = {}) {
  const map = new Map();
  for (const [name, id] of Object.entries(payerNameToId)) {
    map.set(name.toLowerCase(), id);
  }
  return map;
}
