/**
 * Date Extraction Utilities
 *
 * Deterministic extraction of policy dates from document content.
 * Runs BEFORE LLM analysis to provide structured metadata.
 */

/**
 * Common date patterns in policy documents
 */
const DATE_PATTERNS = {
  // "Effective Date: January 1, 2026" or "Effective: 01/01/2026"
  effective: [
    /effective\s*(?:date)?[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /effective\s*(?:date)?[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /effective\s*(?:date)?[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /effective[:\s]+(\d{1,2}-\d{1,2}-\d{4})/i,
    /(?:becomes?\s+)?effective\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
  ],

  // "Revision Date: 12/15/2025" or "Last Revised: December 2025"
  revision: [
    /(?:revision|revised|last\s+revised)\s*(?:date)?[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:revision|revised|last\s+revised)\s*(?:date)?[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(?:revision|revised|last\s+revised)\s*(?:date)?[:\s]+(\d{4}-\d{2}-\d{2})/i,
    /(?:revision|revised)\s*(?:date)?[:\s]+([A-Za-z]+\s+\d{4})/i,
  ],

  // "Last Reviewed: 01/2026" or "Review Date: January 15, 2026"
  reviewed: [
    /(?:last\s+)?review(?:ed)?\s*(?:date)?[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:last\s+)?review(?:ed)?\s*(?:date)?[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(?:last\s+)?review(?:ed)?\s*(?:date)?[:\s]+(\d{1,2}\/\d{4})/i,
    /(?:last\s+)?review(?:ed)?\s*(?:date)?[:\s]+([A-Za-z]+\s+\d{4})/i,
  ],

  // "Published: 11/15/2025" or "Publication Date: November 15, 2025"
  published: [
    /(?:publish(?:ed|ation)?)\s*(?:date)?[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /(?:publish(?:ed|ation)?)\s*(?:date)?[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(?:publish(?:ed|ation)?)\s*(?:date)?[:\s]+(\d{4}-\d{2}-\d{2})/i,
  ],

  // "Next Review: 01/2027"
  nextReview: [
    /next\s+review\s*(?:date)?[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
    /next\s+review\s*(?:date)?[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /next\s+review\s*(?:date)?[:\s]+(\d{1,2}\/\d{4})/i,
    /next\s+review\s*(?:date)?[:\s]+([A-Za-z]+\s+\d{4})/i,
  ],
};

/**
 * Month name to number mapping
 */
const MONTHS = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12',
};

/**
 * Normalize a date string to ISO format (YYYY-MM-DD)
 * @param {string} dateStr - Raw date string
 * @returns {string|null} ISO date or null if unparseable
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  // Already ISO format: 2026-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // MM/DD/YYYY format: 01/15/2026
  const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // MM-DD-YYYY format: 01-15-2026
  const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, month, day, year] = dashMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // MM/YYYY format: 01/2026 (assume first of month)
  const monthYearSlash = cleaned.match(/^(\d{1,2})\/(\d{4})$/);
  if (monthYearSlash) {
    const [, month, year] = monthYearSlash;
    return `${year}-${month.padStart(2, '0')}-01`;
  }

  // "January 15, 2026" or "January 15 2026"
  const namedDateMatch = cleaned.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (namedDateMatch) {
    const [, monthName, day, year] = namedDateMatch;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) {
      return `${year}-${month}-${day.padStart(2, '0')}`;
    }
  }

  // "January 2026" (assume first of month)
  const monthYearNamed = cleaned.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthYearNamed) {
    const [, monthName, year] = monthYearNamed;
    const month = MONTHS[monthName.toLowerCase()];
    if (month) {
      return `${year}-${month}-01`;
    }
  }

  return null;
}

/**
 * Extract a specific date type from content
 * @param {string} content - Document content
 * @param {string} dateType - 'effective', 'revision', 'reviewed', 'published', 'nextReview'
 * @returns {string|null} ISO date or null
 */
export function extractDate(content, dateType) {
  const patterns = DATE_PATTERNS[dateType];
  if (!patterns) return null;

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const normalized = normalizeDate(match[1]);
      if (normalized) return normalized;
    }
  }

  return null;
}

/**
 * Extract effective date from content
 * @param {string} content - Document content
 * @returns {string|null} ISO date or null
 */
export function extractEffectiveDate(content) {
  return extractDate(content, 'effective');
}

/**
 * Extract revision date from content
 * @param {string} content - Document content
 * @returns {string|null} ISO date or null
 */
export function extractRevisionDate(content) {
  return extractDate(content, 'revision');
}

/**
 * Extract last reviewed date from content
 * @param {string} content - Document content
 * @returns {string|null} ISO date or null
 */
export function extractReviewedDate(content) {
  return extractDate(content, 'reviewed');
}

/**
 * Extract all dates from content
 * @param {string} content - Document content
 * @returns {Object} { effectiveDate, revisionDate, reviewedDate, publishedDate, nextReviewDate }
 */
export function extractAllDates(content) {
  return {
    effectiveDate: extractDate(content, 'effective'),
    revisionDate: extractDate(content, 'revision'),
    reviewedDate: extractDate(content, 'reviewed'),
    publishedDate: extractDate(content, 'published'),
    nextReviewDate: extractDate(content, 'nextReview'),
  };
}

/**
 * Check if a date is current (within last 2 years)
 * @param {string} isoDate - ISO date string
 * @returns {boolean}
 */
export function isDateCurrent(isoDate) {
  if (!isoDate) return false;

  const date = new Date(isoDate);
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  return date >= twoYearsAgo;
}

/**
 * Get the most recent date from extracted dates
 * @param {Object} dates - Object with date fields
 * @returns {string|null} Most recent ISO date or null
 */
export function getMostRecentDate(dates) {
  const validDates = Object.values(dates)
    .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();

  return validDates[0] || null;
}

export default {
  normalizeDate,
  extractDate,
  extractEffectiveDate,
  extractRevisionDate,
  extractReviewedDate,
  extractAllDates,
  isDateCurrent,
  getMostRecentDate,
};
