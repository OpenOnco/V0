/**
 * Configuration module for the OpenOnco Intelligence Daemon
 * Loads from .env and exports crawler schedules, test/vendor names, and email settings
 */

import 'dotenv/config';

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

export const config = {
  // Email configuration
  email: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.DIGEST_FROM_EMAIL || 'OpenOnco Daemon <daemon@openonco.com>',
    to: process.env.ALERT_EMAIL || process.env.DIGEST_RECIPIENT_EMAIL || 'team@openonco.com',
    alertRecipient: process.env.ALERT_EMAIL || 'team@openonco.com',
  },

  // Crawler schedules (cron syntax)
  // PubMed: daily 6am, CMS: weekly Sunday, FDA: weekly Monday, Vendors: weekly Tuesday
  schedules: {
    pubmed: process.env.SCHEDULE_PUBMED || '0 6 * * *',        // Daily at 6:00 AM
    cms: process.env.SCHEDULE_CMS || '0 6 * * 0',              // Weekly Sunday 6:00 AM
    fda: process.env.SCHEDULE_FDA || '0 6 * * 1',              // Weekly Monday 6:00 AM
    vendor: process.env.SCHEDULE_VENDOR || '0 6 * * 2',        // Weekly Tuesday 6:00 AM
    preprints: process.env.SCHEDULE_PREPRINTS || '0 6 * * 3',  // Weekly Wednesday 6:00 AM
    digest: process.env.SCHEDULE_DIGEST || '0 10 * * *',       // Daily digest at 10:00 AM
  },

  // Crawler enable flags
  crawlers: {
    pubmed: {
      enabled: process.env.CRAWLER_PUBMED_ENABLED !== 'false',
      name: 'PubMed',
      description: 'Scientific literature and clinical studies',
      rateLimit: parseInt(process.env.RATE_LIMIT_PUBMED || '10', 10),
    },
    cms: {
      enabled: process.env.CRAWLER_CMS_ENABLED !== 'false',
      name: 'CMS/Medicare',
      description: 'Coverage determinations and policy updates',
      rateLimit: parseInt(process.env.RATE_LIMIT_CMS || '5', 10),
    },
    fda: {
      enabled: process.env.CRAWLER_FDA_ENABLED !== 'false',
      name: 'FDA',
      description: 'Drug approvals and regulatory updates',
      rateLimit: parseInt(process.env.RATE_LIMIT_FDA || '5', 10),
    },
    vendor: {
      enabled: process.env.CRAWLER_VENDOR_ENABLED !== 'false',
      name: 'Vendor Websites',
      description: 'Test manufacturer updates and documentation',
      rateLimit: parseInt(process.env.RATE_LIMIT_VENDOR || '3', 10),
    },
    preprints: {
      enabled: process.env.CRAWLER_PREPRINTS_ENABLED !== 'false',
      name: 'Preprints',
      description: 'medRxiv and bioRxiv preprint servers',
      rateLimit: parseInt(process.env.RATE_LIMIT_PREPRINTS || '5', 10),
    },
  },

  // Queue configuration
  queue: {
    filePath: process.env.QUEUE_FILE_PATH || './data/queue.json',
    maxItemAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: process.env.LOG_DIR || './logs',

  // Health tracking file
  healthFile: './data/health.json',
};

// =============================================================================
// MONITORED TEST NAMES
// Key diagnostic tests tracked across MRD, TDS, and ECD categories
// =============================================================================

export const MONITORED_TESTS = {
  // MRD (Minimal Residual Disease) Tests
  mrd: [
    'Signatera',
    'Guardant Reveal',
    'FoundationOne Tracker',
    'Haystack MRD',
    'NeXT Personal Dx',
    'Oncomine',
    'clonoSEQ',
    'NavDx',
    'RaDaR',
    'PhasED-Seq',
    'AVENIO ctDNA',
    'Tempus MRD',
    'Resolution HRD',
    'PredicineATLAS',
    'Invitae Personalized Cancer Monitoring',
  ],

  // TDS (Tumor Detection/Screening) Tests
  tds: [
    'FoundationOne CDx',
    'FoundationOne Liquid CDx',
    'Guardant360 CDx',
    'Guardant360 TissueNext',
    'Tempus xT',
    'Tempus xF',
    'Tempus xR',
    'Caris Molecular Intelligence',
    'Oncotype DX',
    'MammaPrint',
    'Prosigna',
    'Decipher Prostate',
    'SelectMDx',
    'ExoDx Prostate',
    'Epi proColon',
    'Cologuard',
    'Galleri',
  ],

  // ECD (Early Cancer Detection) Tests
  ecd: [
    'Galleri',
    'CancerSEEK',
    'Shield',
    'GRAIL Galleri',
    'Freenome',
    'DELFI',
    'Helio Liver Test',
    'IvyGene',
    'Oncuria',
    'ColoSense',
  ],
};

// Flattened list of all test names for easy searching
export const ALL_TEST_NAMES = [
  ...MONITORED_TESTS.mrd,
  ...MONITORED_TESTS.tds,
  ...MONITORED_TESTS.ecd,
];

// =============================================================================
// MONITORED VENDOR NAMES
// Key diagnostic test manufacturers and laboratories
// =============================================================================

export const MONITORED_VENDORS = [
  // Major ctDNA/MRD vendors
  'Natera',
  'Guardant Health',
  'Foundation Medicine',
  'Tempus',
  'Caris Life Sciences',
  'NeoGenomics',
  'Personalis',

  // Large reference labs
  'Quest Diagnostics',
  'Labcorp',
  'Exact Sciences',

  // Specialized vendors
  'Adaptive Biotechnologies',
  'GRAIL',
  'Freenome',
  'Burning Rock Dx',
  'Resolution Bioscience',
  'Invitae',
  'Myriad Genetics',
  'Genomic Health',
  'Agilent',
  'Illumina',

  // Emerging vendors
  'Veracyte',
  'BillionToOne',
  'DELFI Diagnostics',
  'Helio Genomics',
  'Lucence',
  'Nucleix',
  'Inocras',
  'IMBdx',
  'OncoDNA',
  'Geneoscopy',
];

// =============================================================================
// DISCOVERY TYPES & SOURCES
// =============================================================================

export const DISCOVERY_TYPES = {
  PUBLICATION: 'publication',
  PREPRINT: 'preprint',
  POLICY_UPDATE: 'policy_update',
  COVERAGE_CHANGE: 'coverage_change',
  FDA_APPROVAL: 'fda_approval',
  FDA_GUIDANCE: 'fda_guidance',
  VENDOR_UPDATE: 'vendor_update',
  TEST_DOCUMENTATION: 'test_documentation',
};

export const SOURCES = {
  PUBMED: 'pubmed',
  CMS: 'cms',
  FDA: 'fda',
  VENDOR: 'vendor',
  PREPRINTS: 'preprints',
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Check if a test name is being monitored
 * @param {string} testName - The test name to check
 * @returns {boolean}
 */
export function isMonitoredTest(testName) {
  const normalized = testName.toLowerCase();
  return ALL_TEST_NAMES.some(t => normalized.includes(t.toLowerCase()));
}

/**
 * Check if a vendor is being monitored
 * @param {string} vendorName - The vendor name to check
 * @returns {boolean}
 */
export function isMonitoredVendor(vendorName) {
  const normalized = vendorName.toLowerCase();
  return MONITORED_VENDORS.some(v => normalized.includes(v.toLowerCase()));
}

/**
 * Get the category for a test name
 * @param {string} testName - The test name to categorize
 * @returns {string|null} - 'mrd', 'tds', 'ecd', or null
 */
export function getTestCategory(testName) {
  const normalized = testName.toLowerCase();
  for (const [category, tests] of Object.entries(MONITORED_TESTS)) {
    if (tests.some(t => normalized.includes(t.toLowerCase()))) {
      return category;
    }
  }
  return null;
}

export default config;
