/**
 * Glossary Data Normalizer
 *
 * Normalizes GLOSSARY data for consistent querying through the DAL.
 */

/**
 * Normalize glossary from object to array
 *
 * @param {Object} glossary - GLOSSARY object from data.js
 * @returns {Array} - Array of normalized glossary term records
 */
export function normalizeGlossary(glossary = {}) {
  return Object.entries(glossary).map(([key, termData]) => ({
    id: key,
    term: termData.term || key,
    definition: termData.definition || '',
    shortDefinition: termData.shortDefinition || null,
    sourceUrl: termData.sourceUrl || null,
    source: termData.source || null,
    relatedTerms: termData.relatedTerms || [],
    // Preserve any additional fields
    ...Object.fromEntries(
      Object.entries(termData).filter(([k]) =>
        !['term', 'definition', 'shortDefinition', 'sourceUrl', 'source', 'relatedTerms'].includes(k)
      )
    ),
  }));
}

/**
 * Build lookup maps for glossary terms
 * @param {Array} normalizedGlossary - Normalized glossary array
 * @returns {Object} - Lookup maps
 */
export function buildGlossaryLookupMaps(normalizedGlossary) {
  const byId = new Map();
  const byTerm = new Map();
  const bySource = new Map();

  for (const entry of normalizedGlossary) {
    // By ID
    byId.set(entry.id, entry);

    // By term (normalized)
    byTerm.set(entry.term.toLowerCase(), entry);

    // By source
    if (entry.source) {
      if (!bySource.has(entry.source)) {
        bySource.set(entry.source, []);
      }
      bySource.get(entry.source).push(entry);
    }
  }

  return { byId, byTerm, bySource };
}
