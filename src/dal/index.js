/**
 * Data Access Layer (DAL) - Main Entry Point
 *
 * This module provides an abstraction layer between data storage and consumers.
 * Currently uses in-memory storage; future versions can swap to PostgreSQL
 * with zero changes to consuming code.
 *
 * @example
 * // Initialize DAL with data arrays
 * import { initializeDAL } from './dal/index.js';
 * import { mrdTestData, ecdTestData, cgpTestData, hctTestData } from './data.js';
 *
 * const dal = initializeDAL({ mrdTestData, ecdTestData, cgpTestData, hctTestData });
 *
 * // Use the DAL
 * const { data: tests } = await dal.tests.findByCategory('MRD');
 * const test = await dal.tests.findById('mrd-1');
 *
 * // Access changelog, vendors, insurance, glossary
 * const { data: changelog } = await dal.changelog.findAll();
 * const vendor = await dal.vendors.findByName('Natera');
 */

import { normalizeTestData, CATEGORY_MAP } from './normalizer.js';
import { InMemoryAdapter } from './adapters/InMemoryAdapter.js';
import { TestRepository } from './repositories/TestRepository.js';
import { ChangelogRepository } from './repositories/ChangelogRepository.js';
import { VendorRepository } from './repositories/VendorRepository.js';
import { InsuranceRepository } from './repositories/InsuranceRepository.js';
import { GlossaryRepository } from './repositories/GlossaryRepository.js';

// Import normalizers
import { normalizeChangelog } from './normalizers/changelog.js';
import { normalizeVendors } from './normalizers/vendors.js';
import { normalizeInsurance, buildPayerNameMap } from './normalizers/insurance.js';
import { normalizeGlossary } from './normalizers/glossary.js';

// Re-export for convenience
export { operators } from './operators.js';
export { matchesWhere, applyOrderBy, applySelect, applyPagination, buildResult } from './QueryBuilder.js';
export { normalizeTestData, CATEGORY_MAP, slugify, buildLookupMaps } from './normalizer.js';
export { DataAdapter } from './adapters/DataAdapter.js';
export { InMemoryAdapter } from './adapters/InMemoryAdapter.js';
export { TestRepository } from './repositories/TestRepository.js';
export { ChangelogRepository } from './repositories/ChangelogRepository.js';
export { VendorRepository } from './repositories/VendorRepository.js';
export { InsuranceRepository } from './repositories/InsuranceRepository.js';
export { GlossaryRepository } from './repositories/GlossaryRepository.js';

// Export normalizers
export { normalizeChangelog } from './normalizers/changelog.js';
export { normalizeVendors } from './normalizers/vendors.js';
export { normalizeInsurance, buildPayerNameMap } from './normalizers/insurance.js';
export { normalizeGlossary } from './normalizers/glossary.js';

// React hooks for DAL access - Tests
export {
  useAllTests,
  useTestsByCategory,
  useTestCounts,
  useTestStats,
  useTestsByCategories,
} from './hooks/useTests.js';

// React hooks for DAL access - Changelog
export {
  useChangelog,
} from './hooks/useChangelog.js';

// React hooks for DAL access - Vendors
export {
  useVendors,
  useTestVerification,
  useAssistanceProgram,
  useTestContribution,
} from './hooks/useVendors.js';

// React hooks for DAL access - Insurance
export {
  useInsuranceProviders,
  useInsuranceGrouped,
} from './hooks/useInsurance.js';

// React hooks for DAL access - Glossary
export {
  useGlossary,
  useGlossaryTerm,
} from './hooks/useGlossary.js';

/**
 * @typedef {Object} DAL
 * @property {TestRepository} tests - Test repository for querying tests
 * @property {ChangelogRepository} changelog - Changelog repository
 * @property {VendorRepository} vendors - Vendor repository
 * @property {InsuranceRepository} insurance - Insurance provider repository
 * @property {GlossaryRepository} glossary - Glossary repository
 * @property {InMemoryAdapter} adapter - The underlying data adapter
 */

/**
 * Initialize the Data Access Layer with test data and additional collections
 *
 * @param {Object} dataArrays - Data arrays and objects
 * @param {Array} [dataArrays.mrdTestData=[]] - MRD test data
 * @param {Array} [dataArrays.ecdTestData=[]] - ECD test data
 * @param {Array} [dataArrays.trmTestData=[]] - TRM test data (may be empty)
 * @param {Array} [dataArrays.cgpTestData=[]] - CGP test data
 * @param {Array} [dataArrays.hctTestData=[]] - HCT test data
 * @param {Array} [dataArrays.changelogData=[]] - DATABASE_CHANGELOG data
 * @param {Object} [dataArrays.vendorVerified={}] - VENDOR_VERIFIED object
 * @param {Object} [dataArrays.companyContributions={}] - COMPANY_CONTRIBUTIONS object
 * @param {Object} [dataArrays.assistancePrograms={}] - VENDOR_ASSISTANCE_PROGRAMS object
 * @param {Object} [dataArrays.insuranceProviders={}] - INSURANCE_PROVIDERS object
 * @param {Object} [dataArrays.payerNameToId={}] - PAYER_NAME_TO_ID mapping
 * @param {Object} [dataArrays.glossary={}] - GLOSSARY object
 * @returns {DAL} - The initialized DAL instance
 */
export function initializeDAL({
  // Test data
  mrdTestData = [],
  ecdTestData = [],
  trmTestData = [],
  cgpTestData = [],
  hctTestData = [],
  // Additional data
  changelogData = [],
  vendorVerified = {},
  companyContributions = {},
  assistancePrograms = {},
  insuranceProviders = {},
  payerNameToId = {},
  glossary = {},
} = {}) {
  // Normalize all test data into a unified collection
  const tests = normalizeTestData({
    mrdTestData,
    ecdTestData,
    trmTestData,
    cgpTestData,
    hctTestData,
  });

  // Normalize changelog data
  const changelog = normalizeChangelog(changelogData);

  // Normalize vendor data (consolidates multiple sources)
  const vendors = normalizeVendors({
    vendorVerified,
    companyContributions,
    assistancePrograms,
    tests,
  });

  // Normalize insurance data
  const insurance = normalizeInsurance(insuranceProviders);
  const payerNameMap = buildPayerNameMap(payerNameToId);

  // Normalize glossary data
  const glossaryTerms = normalizeGlossary(glossary);

  // Create the in-memory adapter with all collections
  const adapter = new InMemoryAdapter({
    tests,
    changelog,
    vendors,
    insurance,
    glossary: glossaryTerms,
  });

  // Create repositories
  const testRepository = new TestRepository(adapter);
  const changelogRepository = new ChangelogRepository(adapter);
  const vendorRepository = new VendorRepository(adapter);
  const insuranceRepository = new InsuranceRepository(adapter, { payerNameMap });
  const glossaryRepository = new GlossaryRepository(adapter);

  return {
    tests: testRepository,
    changelog: changelogRepository,
    vendors: vendorRepository,
    insurance: insuranceRepository,
    glossary: glossaryRepository,
    adapter,
  };
}

/**
 * Create a DAL instance with a custom adapter
 * Useful for future database adapters or testing
 *
 * @param {import('./adapters/DataAdapter.js').DataAdapter} adapter - Custom adapter
 * @param {Object} [options] - Additional options
 * @param {Map} [options.payerNameMap] - Payer name to ID mapping
 * @returns {DAL}
 */
export function createDAL(adapter, options = {}) {
  return {
    tests: new TestRepository(adapter),
    changelog: new ChangelogRepository(adapter),
    vendors: new VendorRepository(adapter),
    insurance: new InsuranceRepository(adapter, options),
    glossary: new GlossaryRepository(adapter),
    adapter,
  };
}
