/**
 * Configuration module for the OpenOnco Intelligence Daemon
 * Focused on coverage intelligence: CMS, Payers, and Vendors
 */

import 'dotenv/config';

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

export const config = {
  // Email configuration
  email: {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.DIGEST_FROM_EMAIL || 'OpenOnco Daemon <daemon@openonco.org>',
    to: process.env.ALERT_EMAIL || process.env.DIGEST_RECIPIENT_EMAIL || 'alexgdickinson@gmail.com',
    alertRecipient: process.env.ALERT_EMAIL || 'alexgdickinson@gmail.com',
  },

  // Anthropic API configuration
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
  },

  // Crawler schedules (cron syntax)
  // All crawlers run Sunday at 2 AM, digest Monday 6 AM
  schedules: {
    cms: process.env.SCHEDULE_CMS || '0 2 * * 0',           // Sunday 2:00 AM
    payers: process.env.SCHEDULE_PAYERS || '0 2 * * 0',     // Sunday 2:00 AM
    vendors: process.env.SCHEDULE_VENDORS || '0 2 * * 0',   // Sunday 2:00 AM
    digest: process.env.SCHEDULE_DIGEST || '0 6 * * 1',     // Monday 6:00 AM
  },

  // Crawler enable flags
  crawlers: {
    cms: {
      enabled: process.env.CRAWLER_CMS_ENABLED !== 'false',
      name: 'CMS/Medicare',
      description: 'Medicare coverage determinations (NCDs and LCDs)',
      rateLimit: parseInt(process.env.RATE_LIMIT_CMS || '5', 10),
    },
    payers: {
      enabled: process.env.CRAWLER_PAYERS_ENABLED !== 'false',
      name: 'Private Payers',
      description: 'Commercial insurance and Medicare Advantage medical policies',
      rateLimit: parseFloat(process.env.RATE_LIMIT_PAYERS || '0.2'),
    },
    vendors: {
      enabled: process.env.CRAWLER_VENDORS_ENABLED !== 'false',
      name: 'Vendors',
      description: 'Test manufacturer coverage announcements and updates',
      rateLimit: parseInt(process.env.RATE_LIMIT_VENDORS || '3', 10),
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
// PAYER CONFIGURATION
// Comprehensive list of payers organized by category
// =============================================================================

export const PAYERS = {
  // National Commercial Payers
  nationalCommercial: [
    {
      id: 'uhc',
      name: 'UnitedHealthcare',
      shortName: 'UHC',
      policyPortal: 'https://www.uhcprovider.com/en/policies-protocols/commercial-policies.html',
    },
    {
      id: 'anthem',
      name: 'Anthem/Elevance',
      shortName: 'Anthem',
      policyPortal: 'https://www.anthem.com/provider/policies/',
    },
    {
      id: 'cigna',
      name: 'Cigna',
      shortName: 'Cigna',
      policyPortal: 'https://cignaforhcp.cigna.com/public/content/pdf/coveragePolicies/',
    },
    {
      id: 'aetna',
      name: 'Aetna',
      shortName: 'Aetna',
      policyPortal: 'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html',
    },
    {
      id: 'humana',
      name: 'Humana',
      shortName: 'Humana',
      policyPortal: 'https://www.humana.com/provider/medical-resources/clinical-medical-policies',
    },
  ],

  // Regional Blue Cross Blue Shield Plans (each has own molecular testing policies)
  regionalBCBS: [
    {
      id: 'bcbs-ma',
      name: 'Blue Cross Blue Shield of Massachusetts',
      shortName: 'BCBS MA',
      states: ['MA'],
      policyPortal: 'https://www.bluecrossma.org/medical-policies',
    },
    {
      id: 'bcbs-mi',
      name: 'Blue Cross Blue Shield of Michigan',
      shortName: 'BCBS MI',
      states: ['MI'],
      policyPortal: 'https://www.bcbsm.com/providers/clinical-resources/policies.html',
      notes: 'Largest BCBS plan by enrollment',
    },
    {
      id: 'bcbs-tx',
      name: 'Blue Cross Blue Shield of Texas',
      shortName: 'BCBS TX',
      states: ['TX'],
      policyPortal: 'https://www.bcbstx.com/provider/clinical/medical-policies.html',
    },
    {
      id: 'bcbs-il',
      name: 'Blue Cross Blue Shield of Illinois',
      shortName: 'BCBS IL',
      states: ['IL'],
      policyPortal: 'https://www.bcbsil.com/provider/clinical/medical-policies.html',
    },
    {
      id: 'florida-blue',
      name: 'Florida Blue',
      shortName: 'FL Blue',
      states: ['FL'],
      policyPortal: 'https://www.floridablue.com/providers/tools-resources/policies',
    },
    {
      id: 'bcbs-nc',
      name: 'Blue Cross Blue Shield of North Carolina',
      shortName: 'BCBS NC',
      states: ['NC'],
      policyPortal: 'https://www.bluecrossnc.com/providers/clinical-resources/medical-policy',
    },
    {
      id: 'highmark',
      name: 'Highmark',
      shortName: 'Highmark',
      states: ['PA', 'WV', 'DE'],
      policyPortal: 'https://www.highmark.com/provider/clinical/medical-policies.html',
    },
    {
      id: 'carefirst',
      name: 'CareFirst',
      shortName: 'CareFirst',
      states: ['MD', 'DC', 'VA'],
      policyPortal: 'https://www.carefirst.com/provider/medical-policy-reference-manual',
    },
    {
      id: 'excellus',
      name: 'Excellus BlueCross BlueShield',
      shortName: 'Excellus',
      states: ['NY'],
      policyPortal: 'https://www.excellusbcbs.com/providers/clinical/medical-policies',
    },
    {
      id: 'ibx',
      name: 'Independence Blue Cross',
      shortName: 'IBX',
      states: ['PA'],
      policyPortal: 'https://www.ibx.com/providers/clinical-resources/medical-policies',
    },
    {
      id: 'blue-shield-ca',
      name: 'Blue Shield of California',
      shortName: 'Blue Shield CA',
      states: ['CA'],
      policyPortal: 'https://www.blueshieldca.com/provider/policies-guidelines',
    },
    {
      id: 'premera',
      name: 'Premera Blue Cross',
      shortName: 'Premera',
      states: ['WA', 'AK'],
      policyPortal: 'https://www.premera.com/provider/medical-policies',
    },
    {
      id: 'regence',
      name: 'Regence BlueCross BlueShield',
      shortName: 'Regence',
      states: ['OR', 'WA', 'UT', 'ID'],
      policyPortal: 'https://www.regence.com/provider/medical-policies',
    },
    {
      id: 'horizon',
      name: 'Horizon Blue Cross Blue Shield of New Jersey',
      shortName: 'Horizon BCBS',
      states: ['NJ'],
      policyPortal: 'https://www.horizonblue.com/providers/clinical-policies',
    },
    {
      id: 'wellmark',
      name: 'Wellmark Blue Cross Blue Shield',
      shortName: 'Wellmark',
      states: ['IA', 'SD'],
      policyPortal: 'https://www.wellmark.com/provider/clinical/medical-policies',
    },
    {
      id: 'bcbs-az',
      name: 'Blue Cross Blue Shield of Arizona',
      shortName: 'BCBS AZ',
      states: ['AZ'],
      policyPortal: 'https://www.azblue.com/providers/clinical-policies',
    },
    {
      id: 'bcbs-mn',
      name: 'Blue Cross Blue Shield of Minnesota',
      shortName: 'BCBS MN',
      states: ['MN'],
      policyPortal: 'https://www.bluecrossmn.com/providers/clinical-policies',
    },
    {
      id: 'bcbs-tn',
      name: 'BlueCross BlueShield of Tennessee',
      shortName: 'BCBS TN',
      states: ['TN'],
      policyPortal: 'https://www.bcbst.com/providers/clinical-policies',
    },
    {
      id: 'bcbs-kc',
      name: 'Blue Cross Blue Shield of Kansas City',
      shortName: 'BCBS KC',
      states: ['MO', 'KS'],
      policyPortal: 'https://www.bluekc.com/providers/clinical-policies',
    },
    {
      id: 'bcbs-la',
      name: 'Blue Cross Blue Shield of Louisiana',
      shortName: 'BCBS LA',
      states: ['LA'],
      policyPortal: 'https://www.bcbsla.com/providers/clinical-policies',
    },
    {
      id: 'bcbs-al',
      name: 'Blue Cross Blue Shield of Alabama',
      shortName: 'BCBS AL',
      states: ['AL'],
      policyPortal: 'https://www.bcbsal.org/providers/clinical-policies',
    },
    {
      id: 'bcbs-ga',
      name: 'Blue Cross Blue Shield of Georgia',
      shortName: 'BCBS GA',
      states: ['GA'],
      policyPortal: 'https://www.bcbsga.com/providers/clinical-policies',
    },
    {
      id: 'bcbs-sc',
      name: 'Blue Cross Blue Shield of South Carolina',
      shortName: 'BCBS SC',
      states: ['SC'],
      policyPortal: 'https://www.bcbssc.com/providers/clinical-policies',
    },
    {
      id: 'bcbs-ne',
      name: 'Blue Cross Blue Shield of Nebraska',
      shortName: 'BCBS NE',
      states: ['NE'],
      policyPortal: 'https://www.bcbsne.com/providers/clinical-policies',
    },
    {
      id: 'capital-bc',
      name: 'Capital BlueCross',
      shortName: 'Capital BC',
      states: ['PA'],
      policyPortal: 'https://www.capbluecross.com/providers/clinical-policies',
      notes: 'Central PA',
    },
    {
      id: 'bcbs-vt',
      name: 'Blue Cross Blue Shield of Vermont',
      shortName: 'BCBS VT',
      states: ['VT'],
      policyPortal: 'https://www.bcbsvt.com/providers/clinical-policies',
    },
    {
      id: 'bcbs-nh',
      name: 'Blue Cross Blue Shield of New Hampshire',
      shortName: 'BCBS NH',
      states: ['NH'],
      policyPortal: 'https://www.bcbsnh.com/providers/clinical-policies',
    },
  ],

  // Medicare Advantage Plans (different from traditional Medicare)
  medicareAdvantage: [
    {
      id: 'uhc-ma',
      name: 'UnitedHealthcare Medicare Advantage',
      shortName: 'UHC MA',
      policyPortal: 'https://www.uhcprovider.com/en/policies-protocols/medicare-advantage-policies.html',
      notes: 'Largest Medicare Advantage carrier',
    },
    {
      id: 'humana-ma',
      name: 'Humana Medicare Advantage',
      shortName: 'Humana MA',
      policyPortal: 'https://www.humana.com/provider/medicare-advantage-policies',
    },
    {
      id: 'aetna-ma',
      name: 'Aetna Medicare Advantage',
      shortName: 'Aetna MA',
      policyPortal: 'https://www.aetna.com/health-care-professionals/medicare-advantage-policies.html',
    },
    {
      id: 'bcbs-ma-plans',
      name: 'BCBS Medicare Advantage Plans',
      shortName: 'BCBS MA',
      policyPortal: null,
      notes: 'Various regional BCBS MA plans - policies vary by region',
    },
  ],

  // Lab Benefit Managers (often make actual coverage decisions)
  labBenefitManagers: [
    {
      id: 'evicore',
      name: 'Evicore',
      shortName: 'Evicore',
      policyPortal: 'https://www.evicore.com/provider/clinical-guidelines',
      notes: 'Major LBM for molecular/genetic testing',
    },
    {
      id: 'aim',
      name: 'AIM Specialty Health',
      shortName: 'AIM',
      policyPortal: 'https://www.aimspecialtyhealth.com/clinical-guidelines',
      notes: 'Owned by Anthem/Elevance',
    },
    {
      id: 'avalon',
      name: 'Avalon Healthcare Solutions',
      shortName: 'Avalon',
      policyPortal: 'https://www.avalonhcs.com/provider/clinical-guidelines',
      notes: 'Lab benefits for BCBS plans',
    },
  ],

  // Other Large Payers
  otherLarge: [
    {
      id: 'kaiser',
      name: 'Kaiser Permanente',
      shortName: 'Kaiser',
      policyPortal: 'https://healthy.kaiserpermanente.org/provider/clinical-policies',
      notes: 'Integrated health system - policies may not be public',
    },
    {
      id: 'molina',
      name: 'Molina Healthcare',
      shortName: 'Molina',
      policyPortal: 'https://www.molinahealthcare.com/providers/clinical-policies',
      notes: 'Focus on Medicaid managed care',
    },
    {
      id: 'centene',
      name: 'Centene',
      shortName: 'Centene',
      policyPortal: 'https://www.centene.com/provider/clinical-policies.html',
      notes: 'Largest Medicaid managed care',
    },
    {
      id: 'hcsc',
      name: 'Health Care Service Corporation',
      shortName: 'HCSC',
      policyPortal: 'https://www.hcsc.com/provider/clinical-policies',
      notes: 'Operates BCBS plans in IL, MT, NM, OK, TX',
    },
  ],
};

// Flattened list of all payers for easy iteration
export const ALL_PAYERS = [
  ...PAYERS.nationalCommercial,
  ...PAYERS.regionalBCBS,
  ...PAYERS.medicareAdvantage,
  ...PAYERS.labBenefitManagers,
  ...PAYERS.otherLarge,
];

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
// DISCOVERY TYPES (Simplified for coverage focus)
// =============================================================================

export const DISCOVERY_TYPES = {
  // Medicare/CMS updates
  MEDICARE_LCD_UPDATE: 'medicare_lcd_update',
  MEDICARE_NCD_UPDATE: 'medicare_ncd_update',

  // Private payer updates
  PAYER_POLICY_UPDATE: 'payer_policy_update',
  PAYER_POLICY_NEW: 'payer_policy_new',
  COVERAGE_CHANGE: 'coverage_change',

  // Vendor announcements
  VENDOR_COVERAGE_ANNOUNCEMENT: 'vendor_coverage_announcement',
};

// =============================================================================
// SOURCES
// =============================================================================

export const SOURCES = {
  CMS: 'cms',
  PAYERS: 'payers',
  VENDORS: 'vendors',
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

/**
 * Get payer by ID
 * @param {string} payerId - The payer ID to look up
 * @returns {object|null} - The payer object or null
 */
export function getPayerById(payerId) {
  return ALL_PAYERS.find(p => p.id === payerId) || null;
}

/**
 * Get payers by state
 * @param {string} stateCode - Two-letter state code (e.g., 'CA')
 * @returns {array} - Array of payers covering that state
 */
export function getPayersByState(stateCode) {
  const state = stateCode.toUpperCase();
  return PAYERS.regionalBCBS.filter(p => p.states && p.states.includes(state));
}

/**
 * Get payers by category
 * @param {string} category - Category name (e.g., 'nationalCommercial', 'regionalBCBS')
 * @returns {array} - Array of payers in that category
 */
export function getPayersByCategory(category) {
  return PAYERS[category] || [];
}

export default config;
