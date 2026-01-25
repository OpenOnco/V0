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
    to: process.env.ALERT_EMAIL || process.env.DIGEST_RECIPIENT_EMAIL || 'alexgdickinson@gmail.com',
    alertRecipient: process.env.ALERT_EMAIL || 'alexgdickinson@gmail.com',
  },

  // Anthropic API configuration
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // Crawler schedules (cron syntax)
  // All crawlers run Sunday at 2 AM, triage at 5 AM Sunday, digest Monday 6 AM
  schedules: {
    pubmed: process.env.SCHEDULE_PUBMED || '0 2 * * 0',        // Sunday 2:00 AM
    cms: process.env.SCHEDULE_CMS || '0 2 * * 0',              // Sunday 2:00 AM
    fda: process.env.SCHEDULE_FDA || '0 2 * * 0',              // Sunday 2:00 AM
    vendor: process.env.SCHEDULE_VENDOR || '0 2 * * 0',        // Sunday 2:00 AM
    preprints: process.env.SCHEDULE_PREPRINTS || '0 2 * * 0',  // Sunday 2:00 AM
    citations: process.env.SCHEDULE_CITATIONS || '0 2 * * 0',  // Sunday 2:00 AM
    payers: process.env.SCHEDULE_PAYERS || '0 2 * * 0',        // Sunday 2:00 AM
    triage: process.env.SCHEDULE_TRIAGE || '0 5 * * 0',        // Sunday 5:00 AM - after all crawlers finish
    digest: process.env.SCHEDULE_DIGEST || '0 6 * * 1',        // Monday 6:00 AM - the final email
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
    citations: {
      enabled: process.env.CRAWLER_CITATIONS_ENABLED !== 'false',
      name: 'Citations Validator',
      description: 'Audits missing citations and checks URL liveness',
      rateLimit: parseInt(process.env.RATE_LIMIT_CITATIONS || '2', 10),
    },
    payers: {
      enabled: process.env.CRAWLER_PAYERS_ENABLED !== 'false',
      name: 'Private Payers',
      description: 'Monitors private insurance medical policies',
      rateLimit: parseFloat(process.env.RATE_LIMIT_PAYERS || '0.2'),
    },
    triage: {
      enabled: process.env.CRAWLER_TRIAGE_ENABLED !== 'false',
      name: 'AI Triage',
      description: 'Runs AI triage on accumulated discoveries to prioritize and categorize',
      rateLimit: parseInt(process.env.RATE_LIMIT_TRIAGE || '5', 10),
    },
  },

  // AI Triage configuration
  triage: {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.TRIAGE_MODEL || 'claude-sonnet-4-20250514',
    maxTokens: parseInt(process.env.TRIAGE_MAX_TOKENS || '4096', 10),
    temperature: parseFloat(process.env.TRIAGE_TEMPERATURE || '0.3'),
    batchSize: parseInt(process.env.TRIAGE_BATCH_SIZE || '20', 10),
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
  PAYER_POLICY_UPDATE: 'payer_policy_update',
  PAYER_POLICY_NEW: 'payer_policy_new',
  NEW_POLICY: 'new_policy',
  MISSING_CITATION: 'missing_citation',
  BROKEN_CITATION: 'broken_citation',
  BROKEN_URL: 'broken_url',
  REDIRECT_URL: 'redirect_url',
  INVALID_PMID: 'invalid_pmid',
  NEW_PAYER_POLICY: 'new_payer_policy',
  POLICY_CHANGE: 'policy_change',
  COVERAGE_UPDATE: 'coverage_update',
  PAYER_POLICY_CHANGED: 'payer_policy_changed',
};

export const SOURCES = {
  PUBMED: 'pubmed',
  CMS: 'cms',
  FDA: 'fda',
  VENDOR: 'vendor',
  PREPRINTS: 'preprints',
  CITATIONS: 'citations',
  PAYERS: 'payers',
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
