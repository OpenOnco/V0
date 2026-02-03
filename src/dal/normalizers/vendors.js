/**
 * Vendor Data Normalizer
 *
 * Consolidates vendor-related data from multiple sources:
 * - VENDOR_VERIFIED: Tests with vendor verification
 * - COMPANY_CONTRIBUTIONS: Vendor submissions/contributions
 * - VENDOR_ASSISTANCE_PROGRAMS: Patient financial assistance programs
 *
 * Creates a unified vendor collection for DAL access.
 */

/**
 * Generate a unique vendor ID from vendor name
 * @param {string} vendorName - Vendor name
 * @returns {string} - Normalized vendor ID
 */
function generateVendorId(vendorName) {
  return vendorName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Consolidate vendor data from multiple sources into a unified collection
 *
 * @param {Object} sources - Data sources
 * @param {Object} [sources.vendorVerified={}] - VENDOR_VERIFIED object
 * @param {Object} [sources.companyContributions={}] - COMPANY_CONTRIBUTIONS object
 * @param {Object} [sources.assistancePrograms={}] - VENDOR_ASSISTANCE_PROGRAMS object
 * @param {Array} [sources.tests=[]] - Normalized test data (to extract vendor names)
 * @returns {Array} - Array of normalized vendor records
 */
export function normalizeVendors({
  vendorVerified = {},
  companyContributions = {},
  assistancePrograms = {},
  tests = [],
} = {}) {
  // Collect all unique vendor names from various sources
  const vendorMap = new Map();

  // 1. Extract vendors from tests
  for (const test of tests) {
    if (test.vendor) {
      const id = generateVendorId(test.vendor);
      if (!vendorMap.has(id)) {
        vendorMap.set(id, {
          id,
          name: test.vendor,
          testIds: [],
          verifiedTestIds: [],
          contributions: [],
          assistanceProgram: null,
        });
      }
      vendorMap.get(id).testIds.push(test.id);
    }
  }

  // 2. Add vendor verified data
  for (const [testId, verificationData] of Object.entries(vendorVerified)) {
    const vendorName = verificationData.company;
    if (!vendorName) continue;

    const id = generateVendorId(vendorName);
    if (!vendorMap.has(id)) {
      vendorMap.set(id, {
        id,
        name: vendorName,
        testIds: [],
        verifiedTestIds: [],
        contributions: [],
        assistanceProgram: null,
      });
    }

    const vendor = vendorMap.get(id);
    if (!vendor.verifiedTestIds.includes(testId)) {
      vendor.verifiedTestIds.push(testId);
    }
  }

  // 3. Add company contributions data
  for (const [testId, contributionData] of Object.entries(companyContributions)) {
    const vendorName = contributionData.company;
    if (!vendorName) continue;

    const id = generateVendorId(vendorName);
    if (!vendorMap.has(id)) {
      vendorMap.set(id, {
        id,
        name: vendorName,
        testIds: [],
        verifiedTestIds: [],
        contributions: [],
        assistanceProgram: null,
      });
    }

    const vendor = vendorMap.get(id);
    vendor.contributions.push({
      testId,
      name: contributionData.name,
      date: contributionData.date,
      verifiedDate: contributionData.verifiedDate || null,
      note: contributionData.note || null,
    });
  }

  // 4. Add assistance programs
  for (const [programVendorName, programData] of Object.entries(assistancePrograms)) {
    const id = generateVendorId(programVendorName);
    if (!vendorMap.has(id)) {
      vendorMap.set(id, {
        id,
        name: programVendorName,
        testIds: [],
        verifiedTestIds: [],
        contributions: [],
        assistanceProgram: null,
      });
    }

    vendorMap.get(id).assistanceProgram = {
      ...programData,
      vendorName: programVendorName,
    };
  }

  // Convert to array and add computed fields
  const vendors = Array.from(vendorMap.values()).map(vendor => ({
    ...vendor,
    // Computed fields
    testCount: vendor.testIds.length,
    verifiedTestCount: vendor.verifiedTestIds.length,
    hasVerifiedTests: vendor.verifiedTestIds.length > 0,
    contributionCount: vendor.contributions.length,
    hasContributions: vendor.contributions.length > 0,
    hasAssistanceProgram: vendor.assistanceProgram?.hasProgram || false,
  }));

  // Sort alphabetically by name
  vendors.sort((a, b) => a.name.localeCompare(b.name));

  return vendors;
}

/**
 * Build lookup maps for vendor data
 * @param {Array} normalizedVendors - Normalized vendor array
 * @returns {Object} - Lookup maps
 */
export function buildVendorLookupMaps(normalizedVendors) {
  const byId = new Map();
  const byName = new Map();

  for (const vendor of normalizedVendors) {
    byId.set(vendor.id, vendor);
    byName.set(vendor.name.toLowerCase(), vendor);
  }

  return { byId, byName };
}
