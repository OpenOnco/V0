/**
 * Normalizer - Converts separate test arrays into a unified collection
 */

/**
 * Category mappings from data arrays to standard category codes
 */
export const CATEGORY_MAP = {
  mrd: { code: 'MRD', name: 'Molecular Residual Disease', urlPath: 'monitor' },
  ecd: { code: 'ECD', name: 'Early Cancer Detection', urlPath: 'screen' },
  trm: { code: 'TRM', name: 'Treatment Response Monitoring', urlPath: 'monitor' },
  tds: { code: 'TDS', name: 'Treatment Decision Support', urlPath: 'treat' },
  cgp: { code: 'CGP', name: 'Comprehensive Genomic Profiling', urlPath: 'treat' },
  hct: { code: 'HCT', name: 'Hereditary Cancer Testing', urlPath: 'risk' },
};

/**
 * Generate a URL-friendly slug from test name
 * @param {string} text - Text to slugify
 * @returns {string}
 */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalize a single test by adding category and ensuring slug
 * @param {Object} test - The test object
 * @param {string} categoryKey - Category key (mrd, ecd, etc.)
 * @returns {Object} - Normalized test object
 */
function normalizeTest(test, categoryKey) {
  const categoryInfo = CATEGORY_MAP[categoryKey];
  if (!categoryInfo) {
    throw new Error(`Unknown category: ${categoryKey}`);
  }

  return {
    ...test,
    category: categoryInfo.code,
    categoryName: categoryInfo.name,
    categoryUrlPath: categoryInfo.urlPath,
    slug: test.slug || slugify(test.name),
  };
}

/**
 * Normalize all test data arrays into a single unified collection
 * @param {Object} dataArrays - Object containing test data arrays
 * @param {Array} dataArrays.mrdTestData - MRD tests
 * @param {Array} dataArrays.ecdTestData - ECD tests
 * @param {Array} dataArrays.trmTestData - TRM tests (may be empty/merged into MRD)
 * @param {Array} dataArrays.tdsTestData - TDS tests (alias for CGP)
 * @param {Array} dataArrays.cgpTestData - CGP tests
 * @param {Array} dataArrays.hctTestData - HCT tests
 * @returns {Array} - Unified array of all tests with category field
 */
export function normalizeTestData({
  mrdTestData = [],
  ecdTestData = [],
  trmTestData = [],
  cgpTestData = [],
  hctTestData = [],
}) {
  const tests = [];

  // Process MRD tests
  for (const test of mrdTestData) {
    tests.push(normalizeTest(test, 'mrd'));
  }

  // Process ECD tests
  for (const test of ecdTestData) {
    tests.push(normalizeTest(test, 'ecd'));
  }

  // Process TRM tests (may be empty if merged into MRD)
  for (const test of trmTestData) {
    tests.push(normalizeTest(test, 'trm'));
  }

  // Process CGP tests (CGP is the primary, TDS is alias)
  // Note: tdsTestData is just an alias for cgpTestData, so we only process cgpTestData
  for (const test of cgpTestData) {
    tests.push(normalizeTest(test, 'cgp'));
  }

  // Process HCT tests
  for (const test of hctTestData) {
    tests.push(normalizeTest(test, 'hct'));
  }

  return tests;
}

/**
 * Build lookup maps for fast access
 * @param {Array} tests - Normalized tests array
 * @returns {Object} - Maps for id and slug lookups
 */
export function buildLookupMaps(tests) {
  const byId = new Map();
  const bySlug = new Map(); // slug -> array of tests (slug may not be unique across categories)
  const bySlugAndCategory = new Map(); // `${category}:${slug}` -> test

  for (const test of tests) {
    byId.set(test.id, test);

    // Slug lookup (multiple tests may have same slug across categories)
    if (!bySlug.has(test.slug)) {
      bySlug.set(test.slug, []);
    }
    bySlug.get(test.slug).push(test);

    // Unique slug+category lookup
    bySlugAndCategory.set(`${test.category}:${test.slug}`, test);
  }

  return { byId, bySlug, bySlugAndCategory };
}
