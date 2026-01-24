/**
 * Changelog Data Normalizer
 *
 * Normalizes DATABASE_CHANGELOG entries for consistent querying through the DAL.
 */

/**
 * Parse a changelog date string into a Date object
 * Handles formats like "Jan 12, 2026"
 * @param {string} dateStr - Date string to parse
 * @returns {Date|null}
 */
function parseChangelogDate(dateStr) {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Generate a unique ID for a changelog entry
 * @param {Object} entry - Changelog entry
 * @param {number} index - Index in the array
 * @returns {string}
 */
function generateId(entry, index) {
  // Use date + testId + index for uniqueness
  const dateStr = entry.date?.replace(/[^a-z0-9]/gi, '') || '';
  const testId = entry.testId?.replace(/[^a-z0-9-]/gi, '') || 'unknown';
  return `changelog-${dateStr}-${testId}-${index}`.toLowerCase();
}

/**
 * Normalize a single changelog entry
 * @param {Object} entry - Raw changelog entry from data.js
 * @param {number} index - Index in the source array
 * @returns {Object} - Normalized changelog entry
 */
function normalizeChangelogEntry(entry, index) {
  const parsedDate = parseChangelogDate(entry.date);

  return {
    id: generateId(entry, index),
    date: entry.date || null,
    dateISO: parsedDate ? parsedDate.toISOString().split('T')[0] : null,
    dateParsed: parsedDate,
    type: entry.type || 'updated', // 'added' | 'updated' | 'removed'
    testId: entry.testId || null,
    testName: entry.testName || null,
    vendor: entry.vendor || null,
    category: entry.category || null,
    description: entry.description || '',
    contributor: entry.contributor || null,
    affiliation: entry.affiliation || null,
    citation: entry.citation || null,
    // Preserve any additional fields
    ...Object.fromEntries(
      Object.entries(entry).filter(([key]) =>
        !['date', 'type', 'testId', 'testName', 'vendor', 'category',
          'description', 'contributor', 'affiliation', 'citation'].includes(key)
      )
    ),
  };
}

/**
 * Normalize an array of changelog entries
 * @param {Array} changelogData - Raw DATABASE_CHANGELOG array
 * @returns {Array} - Array of normalized changelog entries
 */
export function normalizeChangelog(changelogData = []) {
  if (!Array.isArray(changelogData)) {
    console.warn('normalizeChangelog: expected array, got', typeof changelogData);
    return [];
  }

  return changelogData.map((entry, index) => normalizeChangelogEntry(entry, index));
}

/**
 * Build lookup maps for changelog entries
 * @param {Array} normalizedChangelog - Normalized changelog array
 * @returns {Object} - Lookup maps
 */
export function buildChangelogLookupMaps(normalizedChangelog) {
  const byId = new Map();
  const byTestId = new Map();
  const byDate = new Map();
  const byType = new Map();

  for (const entry of normalizedChangelog) {
    // By ID
    byId.set(entry.id, entry);

    // By test ID (can have multiple entries per test)
    if (entry.testId) {
      // Handle comma-separated test IDs like "ecd-8, ecd-9"
      const testIds = entry.testId.split(',').map(id => id.trim());
      for (const testId of testIds) {
        if (!byTestId.has(testId)) {
          byTestId.set(testId, []);
        }
        byTestId.get(testId).push(entry);
      }
    }

    // By date (ISO format for grouping)
    if (entry.dateISO) {
      if (!byDate.has(entry.dateISO)) {
        byDate.set(entry.dateISO, []);
      }
      byDate.get(entry.dateISO).push(entry);
    }

    // By type
    if (entry.type) {
      if (!byType.has(entry.type)) {
        byType.set(entry.type, []);
      }
      byType.get(entry.type).push(entry);
    }
  }

  return { byId, byTestId, byDate, byType };
}
