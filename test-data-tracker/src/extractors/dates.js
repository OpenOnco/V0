/**
 * Date Extraction Utilities
 *
 * Deterministic extraction of policy dates from document content.
 * Runs BEFORE LLM analysis to provide structured metadata.
 *
 * v2.1: Added date ranges and precision tracking for imprecise dates
 * (e.g., "Q1 2026" becomes a range, not a single date)
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
 * Quarter patterns (v2.1)
 */
const QUARTER_PATTERNS = [
  /\b(Q[1-4])\s*[\/-]?\s*(\d{4})\b/i,  // Q1 2026, Q1/2026, Q1-2026
  /\b(\d{4})\s*[\/-]?\s*(Q[1-4])\b/i,  // 2026 Q1, 2026/Q1
  /\bfirst\s+quarter\s+(?:of\s+)?(\d{4})/i,
  /\bsecond\s+quarter\s+(?:of\s+)?(\d{4})/i,
  /\bthird\s+quarter\s+(?:of\s+)?(\d{4})/i,
  /\bfourth\s+quarter\s+(?:of\s+)?(\d{4})/i,
];

/**
 * Quarter to month range mapping
 */
const QUARTER_RANGES = {
  Q1: { start: '01', end: '03' },
  Q2: { start: '04', end: '06' },
  Q3: { start: '07', end: '09' },
  Q4: { start: '10', end: '12' },
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

/**
 * Parse a quarter string to a date range
 * v2.1: Handles imprecise dates properly
 *
 * @param {string} quarterStr - Quarter string (e.g., "Q1", "Q2")
 * @param {string} year - Year string
 * @returns {Object} { start, end, precision }
 */
function parseQuarterToRange(quarterStr, year) {
  const quarter = quarterStr.toUpperCase();
  const range = QUARTER_RANGES[quarter];

  if (!range) return null;

  return {
    start: `${year}-${range.start}-01`,
    end: `${year}-${range.end}-${range.end === '03' || range.end === '12' ? '31' : '30'}`,
    precision: 'quarter',
  };
}

/**
 * Extract date with precision and range information
 * v2.1: Returns structured date object with uncertainty info
 *
 * @param {string} content - Document content
 * @param {string} dateType - Date type to extract
 * @returns {Object|null} { value, precision, range, original }
 */
export function extractDateWithPrecision(content, dateType) {
  // First check for quarter patterns
  for (const pattern of QUARTER_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      let quarter, year;

      if (/^Q[1-4]$/i.test(match[1])) {
        quarter = match[1];
        year = match[2];
      } else if (/^Q[1-4]$/i.test(match[2])) {
        quarter = match[2];
        year = match[1];
      } else if (/first/i.test(pattern.source)) {
        quarter = 'Q1';
        year = match[1];
      } else if (/second/i.test(pattern.source)) {
        quarter = 'Q2';
        year = match[1];
      } else if (/third/i.test(pattern.source)) {
        quarter = 'Q3';
        year = match[1];
      } else if (/fourth/i.test(pattern.source)) {
        quarter = 'Q4';
        year = match[1];
      }

      if (quarter && year) {
        const range = parseQuarterToRange(quarter, year);
        if (range) {
          return {
            value: range.start,  // Use start of range as value
            precision: 'quarter',
            range: { start: range.start, end: range.end },
            original: match[0],
          };
        }
      }
    }
  }

  // Try standard date extraction
  const standardDate = extractDate(content, dateType);
  if (standardDate) {
    // Determine precision based on original format
    const patterns = DATE_PATTERNS[dateType] || [];
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const original = match[1];

        // Month + Year only (no day) = month precision
        if (/^[A-Za-z]+\s+\d{4}$/.test(original) || /^\d{1,2}\/\d{4}$/.test(original)) {
          const [year, month] = standardDate.split('-');
          const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
          return {
            value: standardDate,
            precision: 'month',
            range: {
              start: `${year}-${month}-01`,
              end: `${year}-${month}-${lastDay}`,
            },
            original,
          };
        }

        // Full date = day precision
        return {
          value: standardDate,
          precision: 'day',
          range: null,  // Precise date, no range
          original,
        };
      }
    }
  }

  return null;
}

/**
 * Extract all dates with precision information
 * v2.1: Returns structured dates with uncertainty
 *
 * @param {string} content - Document content
 * @returns {Object} Date objects with precision info
 */
export function extractAllDatesWithPrecision(content) {
  return {
    effectiveDate: extractDateWithPrecision(content, 'effective'),
    revisionDate: extractDateWithPrecision(content, 'revision'),
    reviewedDate: extractDateWithPrecision(content, 'reviewed'),
    publishedDate: extractDateWithPrecision(content, 'published'),
    nextReviewDate: extractDateWithPrecision(content, 'nextReview'),
  };
}

/**
 * Check if two date ranges overlap
 * v2.1: Handles imprecise dates properly
 *
 * @param {Object} date1 - Date object with optional range
 * @param {Object} date2 - Date object with optional range
 * @returns {boolean}
 */
export function datesOverlap(date1, date2) {
  if (!date1 || !date2) return false;

  const start1 = date1.range?.start || date1.value;
  const end1 = date1.range?.end || date1.value;
  const start2 = date2.range?.start || date2.value;
  const end2 = date2.range?.end || date2.value;

  // Ranges overlap if start1 <= end2 AND start2 <= end1
  return start1 <= end2 && start2 <= end1;
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
  extractDateWithPrecision,
  extractAllDatesWithPrecision,
  datesOverlap,
};
