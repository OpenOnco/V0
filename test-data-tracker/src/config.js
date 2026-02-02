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
  // Crawlers run Sunday 11 PM, digest Monday 1 AM
  schedules: {
    cms: process.env.SCHEDULE_CMS || '0 23 * * 0',           // Sunday 11:00 PM
    vendor: process.env.SCHEDULE_VENDORS || '0 23 * * 0',    // Sunday 11:00 PM
    payers: process.env.SCHEDULE_PAYERS || '30 23 * * 0',    // Sunday 11:30 PM
    discovery: process.env.SCHEDULE_DISCOVERY || '0 22 * * 0', // Sunday 10:00 PM (v2)
    digest: process.env.SCHEDULE_DIGEST || '0 1 * * 1',      // Monday 1:00 AM
  },

  // Crawler enable flags
  crawlers: {
    cms: {
      enabled: process.env.CRAWLER_CMS_ENABLED !== 'false',
      name: 'CMS/Medicare',
      description: 'Medicare coverage determinations (NCDs and LCDs)',
      rateLimit: parseInt(process.env.RATE_LIMIT_CMS || '5', 10),
    },
    vendor: {
      enabled: process.env.CRAWLER_VENDORS_ENABLED !== 'false',
      name: 'Vendors',
      description: 'Test manufacturer coverage announcements and updates',
      rateLimit: parseInt(process.env.RATE_LIMIT_VENDORS || '3', 10),
    },
    payers: {
      enabled: process.env.CRAWLER_PAYERS_ENABLED !== 'false',
      name: 'Payer Policies',
      description: 'Payer ctDNA/MRD policy documents from policy registry',
      rateLimit: parseInt(process.env.RATE_LIMIT_PAYERS || '3', 10),
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
// Comprehensive list of US health insurers organized by category
// Tier 1 = ~80% market coverage, Tier 2 = ~15% market, Tier 3 = ~5% market
// =============================================================================

export const PAYERS = {
  // National Commercial Payers (Tier 1)
  nationalCommercial: [
    {
      id: 'uhc',
      name: 'UnitedHealthcare',
      shortName: 'UHC',
      tier: 1,
      states: ['AL', 'AZ', 'FL', 'IA', 'IN', 'KS', 'LA', 'MI', 'MO', 'MS', 'NC', 'NE', 'NV', 'OH', 'OK', 'SC', 'TN', 'TX', 'WI', 'WY'],
      policyPortal: 'https://www.uhc.com/resources/policies',
    },
    {
      id: 'anthem',
      name: 'Anthem/Elevance Health',
      shortName: 'Anthem',
      tier: 1,
      states: ['CA', 'CO', 'CT', 'FL', 'GA', 'IN', 'KY', 'ME', 'MO', 'NH', 'NV', 'NY', 'OH', 'TX', 'VA', 'WI'],
      policyPortal: 'https://www.anthem.com/provider/policies',
    },
    {
      id: 'centene',
      name: 'Centene/Ambetter',
      shortName: 'Ambetter',
      tier: 1,
      states: ['AL', 'AR', 'AZ', 'CA', 'DE', 'FL', 'GA', 'IA', 'IN', 'KS', 'LA', 'MI', 'MO', 'MS', 'NC', 'NE', 'NH', 'NY', 'OH', 'OK', 'SC', 'TN', 'TX'],
      policyPortal: 'https://www.ambetterhealth.com/provider',
      notes: 'Largest Medicaid managed care; includes Fidelis Care, Health Net',
    },
    {
      id: 'cigna',
      name: 'Cigna',
      shortName: 'Cigna',
      tier: 1,
      states: ['AZ', 'CO', 'FL', 'IN', 'MS', 'NC', 'TN', 'TX'],
      policyPortal: 'https://www.cigna.com/health-care-providers/coverage-and-claims',
    },
    {
      id: 'humana',
      name: 'Humana',
      shortName: 'Humana',
      tier: 1,
      states: ['KY'],
      policyPortal: 'https://www.humana.com/provider',
      notes: 'Primarily Medicare Advantage; limited ACA marketplace',
    },
    {
      id: 'molina',
      name: 'Molina Healthcare',
      shortName: 'Molina',
      tier: 1,
      states: ['CA', 'FL', 'IL', 'MS', 'OH', 'SC', 'TX', 'UT', 'WA'],
      policyPortal: 'https://www.molinahealthcare.com/providers',
      notes: 'Focus on Medicaid managed care',
    },
    {
      id: 'kaiser',
      name: 'Kaiser Permanente',
      shortName: 'Kaiser',
      tier: 1,
      states: ['CA', 'CO', 'DC', 'GA', 'HI', 'MD', 'OR', 'VA', 'WA'],
      policyPortal: 'https://healthy.kaiserpermanente.org/',
      notes: 'Integrated health system - policies may not be public',
    },
    {
      id: 'aetna',
      name: 'Aetna',
      shortName: 'Aetna',
      tier: 1,
      policyPortal: 'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html',
      notes: 'CVS Health subsidiary',
    },
  ],

  // HCSC-operated BCBS Plans (Tier 1 - large market share)
  hcscBCBS: [
    {
      id: 'hcsc-tx',
      name: 'BCBS Texas (HCSC)',
      shortName: 'BCBS TX',
      tier: 1,
      states: ['TX'],
      policyPortal: 'https://www.bcbstx.com/provider/medical-policies',
    },
    {
      id: 'hcsc-il',
      name: 'BCBS Illinois (HCSC)',
      shortName: 'BCBS IL',
      tier: 1,
      states: ['IL'],
      policyPortal: 'https://www.bcbsil.com/provider/medical-policies',
    },
    {
      id: 'hcsc-mt',
      name: 'BCBS Montana (HCSC)',
      shortName: 'BCBS MT',
      tier: 2,
      states: ['MT'],
      policyPortal: 'https://www.bcbsmt.com/provider/medical-policies',
    },
    {
      id: 'hcsc-ok',
      name: 'BCBS Oklahoma (HCSC)',
      shortName: 'BCBS OK',
      tier: 2,
      states: ['OK'],
      policyPortal: 'https://www.bcbsok.com/provider/medical-policies',
    },
    {
      id: 'hcsc-nm',
      name: 'BCBS New Mexico (HCSC)',
      shortName: 'BCBS NM',
      tier: 2,
      states: ['NM'],
      policyPortal: 'https://www.bcbsnm.com/provider/medical-policies',
    },
  ],

  // Regional Blue Cross Blue Shield Plans (independent licensees)
  regionalBCBS: [
    // Tier 1 - Large regional plans
    {
      id: 'highmark',
      name: 'Highmark BCBS',
      shortName: 'Highmark',
      tier: 1,
      states: ['PA', 'DE', 'WV'],
      policyPortal: 'https://www.highmark.com/provider/medical-policy',
    },
    {
      id: 'floridablue',
      name: 'Florida Blue',
      shortName: 'FL Blue',
      tier: 2,
      states: ['FL'],
      policyPortal: 'https://www.floridablue.com/providers/medical-policies',
    },
    // Tier 2 - Mid-sized regional plans
    {
      id: 'bcbsm',
      name: 'BCBS Michigan',
      shortName: 'BCBS MI',
      tier: 2,
      states: ['MI'],
      policyPortal: 'https://www.bcbsm.com/providers/medical-policies',
    },
    {
      id: 'bcbsnc',
      name: 'BCBS North Carolina',
      shortName: 'BCBS NC',
      tier: 2,
      states: ['NC'],
      policyPortal: 'https://www.bcbsnc.com/provider/medical-policies',
    },
    {
      id: 'bcbssc',
      name: 'BCBS South Carolina',
      shortName: 'BCBS SC',
      tier: 2,
      states: ['SC'],
      policyPortal: 'https://www.southcarolinablues.com/providers',
    },
    {
      id: 'bcbstn',
      name: 'BCBS Tennessee',
      shortName: 'BCBS TN',
      tier: 2,
      states: ['TN'],
      policyPortal: 'https://www.bcbst.com/providers/medical-policies',
    },
    {
      id: 'bcbsal',
      name: 'BCBS Alabama',
      shortName: 'BCBS AL',
      tier: 2,
      states: ['AL'],
      policyPortal: 'https://www.bcbsal.org/providers/policies',
    },
    {
      id: 'bcbsla',
      name: 'BCBS Louisiana',
      shortName: 'BCBS LA',
      tier: 2,
      states: ['LA'],
      policyPortal: 'https://lablue.com/providers',
    },
    {
      id: 'bcbsaz',
      name: 'BCBS Arizona',
      shortName: 'BCBS AZ',
      tier: 2,
      states: ['AZ'],
      policyPortal: 'https://www.azblue.com/providers/medical-policies',
    },
    {
      id: 'bcbsks',
      name: 'BCBS Kansas',
      shortName: 'BCBS KS',
      tier: 2,
      states: ['KS'],
      policyPortal: 'https://www.bcbsks.com/providers',
    },
    {
      id: 'bcbskc',
      name: 'BCBS Kansas City',
      shortName: 'BCBS KC',
      tier: 2,
      states: ['MO', 'KS'],
      policyPortal: 'https://www.bluekc.com/providers',
    },
    {
      id: 'bcbsne',
      name: 'BCBS Nebraska',
      shortName: 'BCBS NE',
      tier: 2,
      states: ['NE'],
      policyPortal: 'https://www.nebraskablue.com/providers',
    },
    {
      id: 'bcbsnd',
      name: 'BCBS North Dakota',
      shortName: 'BCBS ND',
      tier: 2,
      states: ['ND'],
      policyPortal: 'https://www.bcbsnd.com/providers',
    },
    {
      id: 'bcbswy',
      name: 'BCBS Wyoming',
      shortName: 'BCBS WY',
      tier: 2,
      states: ['WY'],
      policyPortal: 'https://www.bcbswy.com/providers',
    },
    {
      id: 'bcbsma',
      name: 'BCBS Massachusetts',
      shortName: 'BCBS MA',
      tier: 2,
      states: ['MA'],
      policyPortal: 'https://www.bluecrossma.com/providers/medical-policies',
    },
    {
      id: 'bcbsri',
      name: 'BCBS Rhode Island',
      shortName: 'BCBS RI',
      tier: 2,
      states: ['RI'],
      policyPortal: 'https://www.bcbsri.com/providers',
    },
    {
      id: 'bcbsvt',
      name: 'BCBS Vermont',
      shortName: 'BCBS VT',
      tier: 2,
      states: ['VT'],
      policyPortal: 'https://www.bcbsvt.com/providers',
    },
    {
      id: 'bcbsmn',
      name: 'BCBS Minnesota',
      shortName: 'BCBS MN',
      tier: 2,
      states: ['MN'],
      policyPortal: 'https://www.bluecrossmn.com/providers',
    },
    {
      id: 'carefirst',
      name: 'CareFirst BCBS',
      shortName: 'CareFirst',
      tier: 2,
      states: ['MD', 'DC', 'VA'],
      policyPortal: 'https://www.carefirst.com/providers/medical-policies',
    },
    {
      id: 'blueshieldca',
      name: 'Blue Shield of California',
      shortName: 'Blue Shield CA',
      tier: 2,
      states: ['CA'],
      policyPortal: 'https://www.blueshieldca.com/provider/medical-policy',
    },
    {
      id: 'horizon',
      name: 'Horizon BCBS NJ',
      shortName: 'Horizon',
      tier: 2,
      states: ['NJ'],
      policyPortal: 'https://www.horizonblue.com/providers/policies',
    },
    {
      id: 'excellus',
      name: 'Excellus BCBS',
      shortName: 'Excellus',
      tier: 2,
      states: ['NY'],
      policyPortal: 'https://www.excellusbcbs.com/providers',
    },
    {
      id: 'empire',
      name: 'Empire BCBS',
      shortName: 'Empire',
      tier: 2,
      states: ['NY'],
      policyPortal: 'https://www.empireblue.com/provider/policies',
      notes: 'Anthem/Elevance-owned',
    },
    {
      id: 'ibx',
      name: 'Independence Blue Cross',
      shortName: 'IBX',
      tier: 2,
      states: ['PA'],
      policyPortal: 'https://www.ibx.com/providers/medical-policy',
    },
    {
      id: 'premera',
      name: 'Premera Blue Cross',
      shortName: 'Premera',
      tier: 2,
      states: ['WA', 'AK'],
      policyPortal: 'https://www.premera.com/provider/medical-policies',
    },
    {
      id: 'regence',
      name: 'Regence BlueCross BlueShield',
      shortName: 'Regence',
      tier: 2,
      states: ['OR', 'WA', 'UT', 'ID'],
      policyPortal: 'https://www.regence.com/provider/medical-policies',
    },
    {
      id: 'wellmark',
      name: 'Wellmark BCBS',
      shortName: 'Wellmark',
      tier: 2,
      states: ['IA', 'SD'],
      policyPortal: 'https://www.wellmark.com/providers/medical-policies',
    },
    {
      id: 'bcidaho',
      name: 'Blue Cross of Idaho',
      shortName: 'BC Idaho',
      tier: 2,
      states: ['ID'],
      policyPortal: 'https://www.bcidaho.com/providers',
    },
    {
      id: 'arkbcbs',
      name: 'Arkansas BCBS',
      shortName: 'AR BCBS',
      tier: 2,
      states: ['AR'],
      policyPortal: 'https://www.arkansasbluecross.com/providers',
    },
  ],

  // Medicare Advantage Plans (different from traditional Medicare)
  medicareAdvantage: [
    {
      id: 'uhc-ma',
      name: 'UnitedHealthcare Medicare Advantage',
      shortName: 'UHC MA',
      tier: 1,
      policyPortal: 'https://www.uhcprovider.com/en/policies-protocols/medicare-advantage-policies.html',
      notes: 'Largest Medicare Advantage carrier',
    },
    {
      id: 'humana-ma',
      name: 'Humana Medicare Advantage',
      shortName: 'Humana MA',
      tier: 1,
      policyPortal: 'https://www.humana.com/provider/medicare-advantage-policies',
    },
    {
      id: 'aetna-ma',
      name: 'Aetna Medicare Advantage',
      shortName: 'Aetna MA',
      tier: 1,
      policyPortal: 'https://www.aetna.com/health-care-professionals/medicare-advantage-policies.html',
    },
    {
      id: 'bcbs-ma-plans',
      name: 'BCBS Medicare Advantage Plans',
      shortName: 'BCBS MA',
      tier: 2,
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
      tier: 1,
      policyPortal: 'https://www.evicore.com/provider/clinical-guidelines',
      notes: 'Major LBM for molecular/genetic testing',
    },
    {
      id: 'aim',
      name: 'AIM Specialty Health',
      shortName: 'AIM',
      tier: 1,
      policyPortal: 'https://www.aimspecialtyhealth.com/clinical-guidelines',
      notes: 'Owned by Anthem/Elevance',
    },
    {
      id: 'avalon',
      name: 'Avalon Healthcare Solutions',
      shortName: 'Avalon',
      tier: 2,
      policyPortal: 'https://www.avalonhcs.com/provider/clinical-guidelines',
      notes: 'Lab benefits for BCBS plans',
    },
  ],

  // Other Large Regional/Specialty Payers (Tier 2)
  otherLarge: [
    {
      id: 'oscar',
      name: 'Oscar Health',
      shortName: 'Oscar',
      tier: 2,
      states: ['AL', 'AZ', 'FL', 'IA', 'KS', 'MI', 'MO', 'MS', 'NC', 'NE', 'NJ', 'OH', 'OK', 'TN', 'TX'],
      policyPortal: 'https://www.hioscar.com/providers',
    },
    {
      id: 'caresource',
      name: 'CareSource',
      shortName: 'CareSource',
      tier: 2,
      states: ['IN', 'OH', 'WI', 'WV'],
      policyPortal: 'https://www.caresource.com/providers',
    },
    {
      id: 'healthnet',
      name: 'Health Net',
      shortName: 'Health Net',
      tier: 2,
      states: ['CA'],
      policyPortal: 'https://www.healthnet.com/providers',
      notes: 'Centene subsidiary',
    },
    {
      id: 'fidelis',
      name: 'Fidelis Care',
      shortName: 'Fidelis',
      tier: 2,
      states: ['NY'],
      policyPortal: 'https://www.fideliscare.org/providers',
      notes: 'Centene subsidiary',
    },
  ],

  // Regional/Specialty Plans (Tier 3)
  regional: [
    // Midwest
    {
      id: 'medica',
      name: 'Medica',
      shortName: 'Medica',
      tier: 3,
      states: ['IA', 'KS', 'MN', 'MO', 'ND', 'NE', 'OK', 'WI'],
      policyPortal: 'https://www.medica.com/providers',
    },
    {
      id: 'healthpartners',
      name: 'HealthPartners',
      shortName: 'HealthPartners',
      tier: 3,
      states: ['MN', 'WI'],
      policyPortal: 'https://www.healthpartners.com/providers',
    },
    {
      id: 'ucare',
      name: 'UCare',
      shortName: 'UCare',
      tier: 3,
      states: ['MN'],
      policyPortal: 'https://www.ucare.org/providers',
    },
    {
      id: 'priority',
      name: 'Priority Health',
      shortName: 'Priority',
      tier: 3,
      states: ['MI'],
      policyPortal: 'https://www.priorityhealth.com/providers',
    },
    {
      id: 'mclaren',
      name: 'McLaren Health Plan',
      shortName: 'McLaren',
      tier: 3,
      states: ['MI'],
      policyPortal: 'https://www.mclarenhealthplan.org/providers',
    },
    {
      id: 'quartz',
      name: 'Quartz',
      shortName: 'Quartz',
      tier: 3,
      states: ['WI'],
      policyPortal: 'https://quartzbenefits.com/providers',
    },
    {
      id: 'sanford',
      name: 'Sanford Health Plan',
      shortName: 'Sanford',
      tier: 3,
      states: ['ND', 'SD'],
      policyPortal: 'https://www.sanfordhealthplan.com/providers',
    },
    {
      id: 'avera',
      name: 'Avera Health Plans',
      shortName: 'Avera',
      tier: 3,
      states: ['IA', 'SD'],
      policyPortal: 'https://www.avera.org/health-plans',
    },
    // Pennsylvania region
    {
      id: 'geisinger',
      name: 'Geisinger Health Plan',
      shortName: 'Geisinger',
      tier: 3,
      states: ['PA'],
      policyPortal: 'https://www.geisinger.org/health-plan/providers',
    },
    {
      id: 'upmc',
      name: 'UPMC Health Plan',
      shortName: 'UPMC',
      tier: 3,
      states: ['PA'],
      policyPortal: 'https://www.upmchealthplan.com/providers',
    },
    // New England
    {
      id: 'tufts',
      name: 'Tufts Health Plan',
      shortName: 'Tufts',
      tier: 3,
      states: ['MA'],
      policyPortal: 'https://tuftshealthplan.com/providers',
    },
    {
      id: 'harvard',
      name: 'Harvard Pilgrim Health Care',
      shortName: 'Harvard Pilgrim',
      tier: 3,
      states: ['MA', 'NH'],
      policyPortal: 'https://www.harvardpilgrim.org/providers',
    },
    {
      id: 'fallon',
      name: 'Fallon Health',
      shortName: 'Fallon',
      tier: 3,
      states: ['MA'],
      policyPortal: 'https://www.fallonhealth.org/providers',
    },
    {
      id: 'connecticare',
      name: 'ConnectiCare',
      shortName: 'ConnectiCare',
      tier: 3,
      states: ['CT'],
      policyPortal: 'https://www.connecticare.com/providers',
    },
    // New York region
    {
      id: 'healthfirst',
      name: 'Healthfirst',
      shortName: 'Healthfirst',
      tier: 3,
      states: ['NY'],
      policyPortal: 'https://healthfirst.org/providers',
    },
    {
      id: 'metroplus',
      name: 'MetroPlus Health',
      shortName: 'MetroPlus',
      tier: 3,
      states: ['NY'],
      policyPortal: 'https://www.metroplus.org/providers',
    },
    {
      id: 'mvp',
      name: 'MVP Health Care',
      shortName: 'MVP',
      tier: 3,
      states: ['NY', 'VT'],
      policyPortal: 'https://www.mvphealthcare.com/providers',
    },
    // California
    {
      id: 'lacare',
      name: 'LA Care Health Plan',
      shortName: 'LA Care',
      tier: 3,
      states: ['CA'],
      policyPortal: 'https://www.lacare.org/providers',
    },
    // Pacific Northwest
    {
      id: 'selecthealth',
      name: 'Select Health',
      shortName: 'SelectHealth',
      tier: 3,
      states: ['UT'],
      policyPortal: 'https://selecthealth.org/providers',
      notes: 'Intermountain Healthcare',
    },
    {
      id: 'providence',
      name: 'Providence Health Plan',
      shortName: 'Providence',
      tier: 3,
      states: ['OR'],
      policyPortal: 'https://providencehealthplan.com/providers',
    },
    {
      id: 'pacificsource',
      name: 'PacificSource',
      shortName: 'PacificSource',
      tier: 3,
      states: ['MT', 'OR'],
      policyPortal: 'https://www.pacificsource.com/providers',
    },
    {
      id: 'moda',
      name: 'Moda Health',
      shortName: 'Moda',
      tier: 3,
      states: ['AK', 'OR', 'TX'],
      policyPortal: 'https://www.modahealth.com/providers',
    },
    {
      id: 'bridgespan',
      name: 'BridgeSpan Health',
      shortName: 'BridgeSpan',
      tier: 3,
      states: ['OR', 'UT'],
      policyPortal: 'https://bridgespanhealth.com/providers',
    },
    // Hawaii
    {
      id: 'hmsa',
      name: 'HMSA Hawaii',
      shortName: 'HMSA',
      tier: 3,
      states: ['HI'],
      policyPortal: 'https://hmsa.com/providers',
    },
    // Southeast
    {
      id: 'optima',
      name: 'Optima Health',
      shortName: 'Optima',
      tier: 3,
      states: ['VA'],
      policyPortal: 'https://www.optimahealth.com/providers',
    },
    {
      id: 'sentara',
      name: 'Sentara Health Plans',
      shortName: 'Sentara',
      tier: 3,
      states: ['VA'],
      policyPortal: 'https://www.sentarahealthplans.com/providers',
    },
    // Ohio
    {
      id: 'medmutual',
      name: 'Medical Mutual',
      shortName: 'Med Mutual',
      tier: 3,
      states: ['OH'],
      policyPortal: 'https://www.medmutual.com/providers',
    },
    // Multi-state
    {
      id: 'amerihealth',
      name: 'AmeriHealth',
      shortName: 'AmeriHealth',
      tier: 3,
      states: ['DE', 'FL', 'LA', 'NC', 'NJ'],
      policyPortal: 'https://www.amerihealth.com/providers',
    },
  ],

  // Government Programs
  government: [
    {
      id: 'tricare',
      name: 'TRICARE',
      shortName: 'TRICARE',
      tier: 1,
      states: ['ALL'],
      policyPortal: 'https://www.tricare.mil/CoveredServices/IsItCovered',
      notes: 'Military health system',
    },
  ],
};

// Flattened list of all payers for easy iteration
export const ALL_PAYERS = [
  ...PAYERS.nationalCommercial,
  ...PAYERS.hcscBCBS,
  ...PAYERS.regionalBCBS,
  ...PAYERS.medicareAdvantage,
  ...PAYERS.labBenefitManagers,
  ...PAYERS.otherLarge,
  ...PAYERS.regional,
  ...PAYERS.government,
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
// DISCOVERY TYPES
// =============================================================================

export const DISCOVERY_TYPES = {
  // Medicare/CMS updates (existing)
  MEDICARE_LCD_UPDATE: 'medicare_lcd_update',
  MEDICARE_NCD_UPDATE: 'medicare_ncd_update',

  // Private payer updates (existing)
  PAYER_POLICY_UPDATE: 'payer_policy_update',
  PAYER_POLICY_NEW: 'payer_policy_new',
  COVERAGE_CHANGE: 'coverage_change',

  // Vendor coverage (existing)
  VENDOR_COVERAGE_ANNOUNCEMENT: 'vendor_coverage_announcement',

  // Financial/PAP types (NEW - HIGH PRIORITY)
  VENDOR_PAP_UPDATE: 'vendor_pap_update',           // PAP eligibility or program changes
  VENDOR_PRICE_CHANGE: 'vendor_price_change',       // Cash pay or list price changes
  VENDOR_PAYMENT_PLAN: 'vendor_payment_plan',       // Payment plan availability or changes

  // PLA/Medicare rate types (NEW)
  VENDOR_PLA_CODE: 'vendor_pla_code',               // New PLA code announced by vendor
  CMS_PLA_REFERENCE: 'cms_pla_reference',           // PLA code referenced in LCD/NCD

  // Other vendor intelligence (NEW - nice to have)
  VENDOR_CLINICAL_EVIDENCE: 'vendor_clinical_evidence',
  VENDOR_PERFORMANCE_DATA: 'vendor_performance_data',
  VENDOR_REGULATORY: 'vendor_regulatory',
  VENDOR_NEW_INDICATION: 'vendor_new_indication',
  VENDOR_NEW_TEST: 'vendor_new_test',
};

// =============================================================================
// SOURCES
// =============================================================================

export const SOURCES = {
  CMS: 'cms',
  PAYERS: 'payers',
  VENDOR: 'vendor',
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
