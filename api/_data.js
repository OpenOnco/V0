/**
 * Shared data exports for API endpoints
 *
 * All test data access should use the DAL (Data Access Layer).
 * Direct array imports are no longer supported.
 */

// Import data arrays for DAL initialization (internal use only)
import {
  mrdTestData,
  ecdTestData,
  cgpTestData,
  hctTestData,
  trmTestData,
  DATABASE_CHANGELOG,
  VENDOR_VERIFIED,
  COMPANY_CONTRIBUTIONS,
  VENDOR_ASSISTANCE_PROGRAMS,
  INSURANCE_PROVIDERS,
  PAYER_NAME_TO_ID,
  GLOSSARY,
} from '../src/data.js';

// Import and initialize the DAL
import { initializeDAL } from '../src/dal/index.js';

/**
 * Initialized Data Access Layer instance
 * Use dal.tests.* methods for all test data access
 *
 * @example
 * import { dal } from './_data.js';
 *
 * // Find tests by category
 * const { data: mrdTests } = await dal.tests.findByCategory('MRD');
 *
 * // Find a test by ID
 * const test = await dal.tests.findById('mrd-1');
 *
 * // Search tests
 * const { data: results } = await dal.tests.search('signatera');
 */
export const dal = initializeDAL({
  mrdTestData,
  ecdTestData,
  trmTestData,
  cgpTestData,
  hctTestData,
  changelogData: DATABASE_CHANGELOG,
  vendorVerified: VENDOR_VERIFIED,
  companyContributions: COMPANY_CONTRIBUTIONS,
  assistancePrograms: VENDOR_ASSISTANCE_PROGRAMS,
  insuranceProviders: INSURANCE_PROVIDERS,
  payerNameToId: PAYER_NAME_TO_ID,
  glossary: GLOSSARY,
});
