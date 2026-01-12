#!/usr/bin/env node

/**
 * Vendor Coverage Scraper v2 (Enhanced)
 *
 * Scrapes billing/coverage pages from diagnostic test vendors to extract
 * coverage-related information including LCD, NCD, CPT codes, reimbursement amounts, etc.
 *
 * Features:
 * - Comprehensive URL mappings (billing, coverage, press, investor pages)
 * - Automatic URL pattern construction for unknown vendors
 * - Vendor name to domain mapping
 * - Enhanced data extraction (LCD, NCD, CPT, dollar amounts, test names)
 * - Clean structured JSON output
 *
 * Usage: node scripts/cms-coverage-scraper/scrape-vendor-coverage-v2.js
 *
 * Output: scripts/cms-coverage-scraper/vendor-coverage-v2.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// VENDOR DOMAIN MAPPINGS
// =============================================================================

/**
 * Map of vendor names to their primary domain
 */
const VENDOR_DOMAINS = {
  'Natera': 'natera.com',
  'Guardant Health': 'guardanthealth.com',
  'Foundation Medicine': 'foundationmedicine.com',
  'GRAIL': 'grail.com',
  'Exact Sciences': 'exactsciences.com',
  'Tempus': 'tempus.com',
  'Tempus AI': 'tempus.com',
  'Caris Life Sciences': 'carislifesciences.com',
  'Adaptive Biotechnologies': 'adaptivebiotech.com',
  'Quest Diagnostics': 'questdiagnostics.com',
  'Labcorp': 'labcorp.com',
  'NeoGenomics': 'neogenomics.com',
  'Personalis': 'personalis.com',
  'BillionToOne': 'billiontoone.com',
  'Myriad Genetics': 'myriad.com',
  'Invitae': 'invitae.com',
  'Fulgent Genetics': 'fulgentgenetics.com',
  'Ambry Genetics': 'ambrygen.com',
  'Genomic Health': 'genomichealth.com',
  'Biodesix': 'biodesix.com',
  'Veracyte': 'veracyte.com',
  'Castle Biosciences': 'castlebiosciences.com',
  'Progenity': 'progenity.com',
  'CareDx': 'caredx.com',
  'Biocept': 'biocept.com',
  'Resolution Bioscience': 'resolutionbio.com',
  'ArcherDX': 'archerdx.com',
  'Illumina': 'illumina.com',
  'Thermo Fisher': 'thermofisher.com',
  'Agilent': 'agilent.com',
  'Roche': 'roche.com',
  'Abbott': 'abbott.com',
  'Siemens Healthineers': 'siemens-healthineers.com',
  'Hologic': 'hologic.com',
  'Qiagen': 'qiagen.com',
  'Bio-Rad': 'bio-rad.com',
  'Beckman Coulter': 'beckmancoulter.com',
  'Sysmex': 'sysmex.com',
  'Ortho Clinical': 'orthoclinicaldiagnostics.com',
  'EarlyDx': 'earlydx.com',
  'Bioarray': 'bioarraygenetics.com'
};

// =============================================================================
// COMPREHENSIVE URL MAPPINGS
// =============================================================================

/**
 * Known vendor URLs organized by page type
 */
const VENDOR_URLS = {
  'Natera': {
    billing: [
      'https://www.natera.com/oncology/billing/',
      'https://www.natera.com/womens-health/billing/',
      'https://www.natera.com/organ-health/billing/'
    ],
    coverage: [
      'https://www.natera.com/oncology/signatera-advanced-cancer-detection/coverage/',
      'https://www.natera.com/womens-health/panorama-nipt-screening-test/coverage/'
    ],
    products: [
      'https://www.natera.com/oncology/signatera-advanced-cancer-detection/',
      'https://www.natera.com/womens-health/panorama-nipt-screening-test/',
      'https://www.natera.com/organ-health/prospera/'
    ],
    press: [
      'https://www.natera.com/company/news/'
    ],
    investor: [
      'https://ir.natera.com/'
    ]
  },

  'Guardant Health': {
    billing: [
      'https://guardanthealth.com/billing-support/',
      'https://guardanthealth.com/providers/billing/'
    ],
    coverage: [
      'https://guardanthealth.com/providers/patient-coverage/',
      'https://guardanthealth.com/providers/coverage-policy/'
    ],
    products: [
      'https://guardanthealth.com/products/',
      'https://guardanthealth.com/guardant360/',
      'https://guardant360cdx.com/',
      'https://www.guardantreveal.com/'
    ],
    press: [
      'https://guardanthealth.com/news/'
    ],
    investor: [
      'https://investors.guardanthealth.com/'
    ]
  },

  'Foundation Medicine': {
    billing: [
      'https://www.foundationmedicine.com/resource/billing-and-financial-assistance',
      'https://www.foundationmedicine.com/billing'
    ],
    coverage: [
      'https://www.foundationmedicine.com/coverage',
      'https://www.foundationmedicine.com/resource/coverage-policy'
    ],
    products: [
      'https://www.foundationmedicine.com/test/foundationone-cdx',
      'https://www.foundationmedicine.com/test/foundationone-liquid-cdx',
      'https://www.foundationmedicine.com/genomic-testing'
    ],
    press: [
      'https://www.foundationmedicine.com/press-releases'
    ],
    investor: []
  },

  'GRAIL': {
    billing: [
      'https://grail.com/billing/',
      'https://grail.com/providers/billing/'
    ],
    coverage: [
      'https://grail.com/coverage/',
      'https://grail.com/galleri-test/coverage/'
    ],
    products: [
      'https://grail.com/galleri-test/',
      'https://grail.com/our-science/'
    ],
    press: [
      'https://grail.com/press-releases/'
    ],
    investor: []
  },

  'Exact Sciences': {
    billing: [
      'https://www.exactsciences.com/billing',
      'https://www.cologuard.com/billing',
      'https://www.oncotypeiq.com/en-US/billing'
    ],
    coverage: [
      'https://www.cologuard.com/coverage',
      'https://www.oncotypeiq.com/en-US/coverage'
    ],
    products: [
      'https://www.exactsciences.com/',
      'https://www.cologuard.com/',
      'https://www.oncotypeiq.com/'
    ],
    press: [
      'https://www.exactsciences.com/news'
    ],
    investor: [
      'https://investor.exactsciences.com/'
    ]
  },

  'Tempus': {
    billing: [
      'https://www.tempus.com/billing/',
      'https://www.tempus.com/providers/billing/'
    ],
    coverage: [
      'https://www.tempus.com/coverage/',
      'https://www.tempus.com/providers/coverage/'
    ],
    products: [
      'https://www.tempus.com/',
      'https://www.tempus.com/genomic-profiling/',
      'https://www.tempus.com/oncology/'
    ],
    press: [
      'https://www.tempus.com/news/'
    ],
    investor: []
  },

  'Caris Life Sciences': {
    billing: [
      'https://www.carislifesciences.com/patients/patient-services/financial-services/',
      'https://www.carislifesciences.com/billing/'
    ],
    coverage: [
      'https://www.carislifesciences.com/coverage/',
      'https://www.carislifesciences.com/patients/patient-services/'
    ],
    products: [
      'https://www.carislifesciences.com/products-and-services/molecular-profiling/',
      'https://www.carismolecularintelligence.com/'
    ],
    press: [
      'https://www.carislifesciences.com/news-events/'
    ],
    investor: []
  },

  'Adaptive Biotechnologies': {
    billing: [
      'https://www.adaptivebiotech.com/billing/',
      'https://www.clonoseq.com/billing/'
    ],
    coverage: [
      'https://www.adaptivebiotech.com/clonoseq/',
      'https://www.clonoseq.com/',
      'https://www.clonoseq.com/coverage/',
      'https://www.clonoseq.com/reimbursement/'
    ],
    products: [
      'https://www.clonoseq.com/',
      'https://www.adaptivebiotech.com/clonoseq/',
      'https://www.adaptivebiotech.com/immunoseq/'
    ],
    press: [
      'https://www.adaptivebiotech.com/news/'
    ],
    investor: [
      'https://investors.adaptivebiotech.com/'
    ]
  },

  'Quest Diagnostics': {
    billing: [
      'https://www.questdiagnostics.com/patients/billing',
      'https://www.questdiagnostics.com/healthcare-professionals/billing'
    ],
    coverage: [
      'https://www.questdiagnostics.com/healthcare-professionals/coverage',
      'https://www.questdiagnostics.com/patients/insurance-coverage'
    ],
    products: [
      'https://www.questdiagnostics.com/',
      'https://www.questdiagnostics.com/healthcare-professionals/test-menu',
      'https://www.questdiagnostics.com/healthcare-professionals/advanced-diagnostics'
    ],
    press: [
      'https://newsroom.questdiagnostics.com/'
    ],
    investor: [
      'https://investor.questdiagnostics.com/'
    ]
  },

  'Labcorp': {
    billing: [
      'https://www.labcorp.com/patients/billing',
      'https://www.labcorp.com/providers/billing'
    ],
    coverage: [
      'https://www.labcorp.com/patients/insurance-coverage',
      'https://www.labcorp.com/providers/coverage-policies'
    ],
    products: [
      'https://www.labcorp.com/',
      'https://www.labcorp.com/providers/test-menu',
      'https://www.labcorp.com/oncology'
    ],
    press: [
      'https://www.labcorp.com/newsroom'
    ],
    investor: [
      'https://ir.labcorp.com/'
    ]
  },

  'NeoGenomics': {
    billing: [
      'https://neogenomics.com/billing/',
      'https://neogenomics.com/patients/billing/'
    ],
    coverage: [
      'https://neogenomics.com/coverage/',
      'https://neogenomics.com/payers/'
    ],
    products: [
      'https://neogenomics.com/',
      'https://neogenomics.com/test-menu/',
      'https://neogenomics.com/pharma-services/'
    ],
    press: [
      'https://neogenomics.com/news/'
    ],
    investor: [
      'https://ir.neogenomics.com/'
    ]
  },

  'Personalis': {
    billing: [
      'https://www.personalis.com/billing/',
      'https://www.personalis.com/reimbursement/'
    ],
    coverage: [
      'https://www.personalis.com/coverage/',
      'https://www.personalis.com/clinical/coverage/'
    ],
    products: [
      'https://www.personalis.com/',
      'https://www.personalis.com/nexter/',
      'https://www.personalis.com/clinical/'
    ],
    press: [
      'https://www.personalis.com/news/'
    ],
    investor: [
      'https://ir.personalis.com/'
    ]
  },

  'BillionToOne': {
    billing: [
      'https://www.billiontoone.com/billing/',
      'https://www.billiontoone.com/unity-billing/'
    ],
    coverage: [
      'https://www.billiontoone.com/coverage/',
      'https://www.billiontoone.com/insurance/'
    ],
    products: [
      'https://www.billiontoone.com/',
      'https://www.billiontoone.com/unity/',
      'https://www.billiontoone.com/northstar/'
    ],
    press: [
      'https://www.billiontoone.com/news/'
    ],
    investor: []
  },

  'Myriad Genetics': {
    billing: [
      'https://www.myriad.com/patients/billing/',
      'https://www.myriad.com/providers/billing/'
    ],
    coverage: [
      'https://www.myriad.com/providers/coverage/',
      'https://www.myriad.com/patients/insurance/'
    ],
    products: [
      'https://www.myriad.com/',
      'https://www.myriad.com/products-services/',
      'https://www.bracnow.com/'
    ],
    press: [
      'https://investor.myriad.com/news-releases'
    ],
    investor: [
      'https://investor.myriad.com/'
    ]
  },

  'Invitae': {
    billing: [
      'https://www.invitae.com/billing/',
      'https://www.invitae.com/patients/billing/'
    ],
    coverage: [
      'https://www.invitae.com/coverage/',
      'https://www.invitae.com/patients/insurance/'
    ],
    products: [
      'https://www.invitae.com/',
      'https://www.invitae.com/en/tests/'
    ],
    press: [
      'https://www.invitae.com/news/'
    ],
    investor: []
  },

  'Veracyte': {
    billing: [
      'https://www.veracyte.com/billing/',
      'https://www.veracyte.com/patients/billing/'
    ],
    coverage: [
      'https://www.veracyte.com/coverage/',
      'https://www.veracyte.com/providers/coverage/'
    ],
    products: [
      'https://www.veracyte.com/',
      'https://www.veracyte.com/afirma/',
      'https://www.veracyte.com/percepta/',
      'https://www.veracyte.com/decipher/'
    ],
    press: [
      'https://www.veracyte.com/news/'
    ],
    investor: [
      'https://investor.veracyte.com/'
    ]
  },

  'EarlyDx': {
    billing: [],
    coverage: [],
    products: [
      'https://earlydx.com/',
      'https://earlydx.com/methylscan/'
    ],
    press: [],
    investor: []
  }
};

// =============================================================================
// KNOWN TEST NAMES BY VENDOR
// =============================================================================

const VENDOR_TESTS = {
  'Natera': ['Signatera', 'Panorama', 'Prospera', 'Horizon', 'Empower', 'Vistara', 'Spectrum', 'Anora', 'Latitude', 'Foresight CLARITY', 'Renasight'],
  'Guardant Health': ['Guardant360', 'Guardant360 CDx', 'Guardant360 TissueNext', 'GuardantOMNI', 'Guardant Reveal', 'Guardant Response', 'LUNAR-1', 'LUNAR-2', 'Shield'],
  'Foundation Medicine': ['FoundationOne CDx', 'FoundationOne Liquid CDx', 'FoundationOne Heme', 'FoundationACT'],
  'GRAIL': ['Galleri'],
  'Exact Sciences': ['Cologuard', 'Cologuard Plus', 'Oncotype DX', 'Oncotype DX Breast', 'Oncotype DX Prostate', 'Oncotype DX Colon', 'OncoExTra', 'PreventionGenetics'],
  'Tempus': ['xT', 'xF', 'xF+', 'xR', 'xG', 'xE', 'xO', 'Tempus One'],
  'Caris Life Sciences': ['Caris Molecular Intelligence', 'MI Profile', 'MI Tumor Seek', 'MI Exome', 'MI Transcriptome'],
  'Adaptive Biotechnologies': ['clonoSEQ', 'immunoSEQ'],
  'Quest Diagnostics': ['QuestCap', 'InSite', 'MyQuest'],
  'Labcorp': ['IntelliGEN', 'OmniSeq'],
  'NeoGenomics': ['NeoType', 'NeoTYPE Discovery Profile'],
  'Personalis': ['NeXT Personal', 'NeXT Dx', 'ImmunoID NeXT'],
  'BillionToOne': ['Unity', 'Unity Complete', 'Unity Fetal Risk Screen', 'Northstar'],
  'Myriad Genetics': ['BRACAnalysis', 'myRisk', 'Prolaris', 'GeneSight', 'Vectra DA', 'EndoPredict', 'MyChoice CDx', 'Precise'],
  'Invitae': ['Invitae Common Hereditary Cancers Panel', 'Invitae Cardio Panel', 'Invitae Multi-Cancer Panel'],
  'Veracyte': ['Afirma', 'Afirma GSC', 'Percepta', 'Decipher', 'Decipher Prostate', 'Envisia', 'Prosigna'],
  'EarlyDx': ['MethylScan', 'MethylScan HCC']
};

// =============================================================================
// URL PATTERN PATHS TO TRY FOR UNKNOWN VENDORS
// =============================================================================

const URL_PATTERN_PATHS = [
  '/billing',
  '/billing/',
  '/coverage',
  '/coverage/',
  '/medicare',
  '/medicare/',
  '/reimbursement',
  '/reimbursement/',
  '/insurance',
  '/insurance/',
  '/patients/billing',
  '/patients/billing/',
  '/providers/billing',
  '/providers/billing/',
  '/providers/coverage',
  '/providers/coverage/',
  '/financial-assistance',
  '/financial-assistance/',
  '/payers',
  '/payers/',
  '/healthcare-professionals',
  '/healthcare-professionals/',
  '/press-releases',
  '/news',
  '/news/',
  '/newsroom',
  '/newsroom/'
];

// =============================================================================
// REGEX PATTERNS FOR DATA EXTRACTION
// =============================================================================

const PATTERNS = {
  // LCD numbers: L followed by 5 digits
  lcd: /\bL\d{5}\b/gi,

  // NCD numbers: format like "90.2", "210.3", "190.14"
  ncd: /\b\d{1,3}\.\d{1,2}\b/g,

  // CPT codes: 5 digits OR 4 digits + letter (like 0211U)
  cpt: /\b(?:\d{5}|\d{4}[A-Z])\b/gi,

  // Dollar amounts with reimbursement context
  reimbursementAmount: /\$[\d,]+(?:\.\d{2})?/g,

  // Coverage/Medicare keywords for context
  coverageKeywords: /\b(?:LCD|NCD|Medicare|Medicaid|coverage|covered|reimbursement|reimbursed|CPT|HCPCS|MolDX|Palmetto|Noridian|MAC|CMS|payer|payor|insurance|insured|prior\s*auth(?:orization)?|pre-?authorization|billing|billed)\b/gi,

  // Test name patterns (will be combined with vendor-specific tests)
  genericTestPatterns: /\b(?:panel|assay|test|profil(?:e|ing)|analysis|screen(?:ing)?|diagnostic|CDx|liquid biopsy|ctDNA|NGS|whole genome|WGS|WES|exome)\b/gi
};

// More specific NCD patterns (common NCDs)
const KNOWN_NCDS = [
  '90.2',    // Colorectal cancer screening
  '210.3',   // Prostate specific antigen
  '190.14',  // Human papillomavirus
  '190.31',  // Genetic testing for Lynch syndrome
  '190.32',  // Genetic testing for breast/ovarian cancer
  '190.33',  // Genetic testing for ALS
  '210.1',   // Prostate cancer
  '110.18',  // NGS for cancer diagnosis
  '110.21',  // NGS cancer panels
  '110.24',  // MRD
  '90.3',    // Cervical cancer screening
  '310.1'    // Routine screening
];

// Common LCD numbers
const KNOWN_LCDS = [
  'L38779',  // MolDX: MRD testing
  'L38794',  // MolDX: Genomic sequencing
  'L38816',  // MolDX: NGS cancer panels
  'L38337',  // MolDX: Oncology panels
  'L37421',  // MolDX: DEX-NIPT
  'L36256',  // MolDX: Gene Expression
  'L38793',  // MolDX: ctDNA
  'L39004',  // MolDX: Whole exome
  'L39067',  // MolDX: Whole genome
  'L37525',  // MolDX: Prenatal testing
  'L38335',  // MolDX: Pharmacogenomics
  'L38831'   // MolDX: Breast cancer
];

// Common CPT/PLA codes for molecular diagnostics
const KNOWN_CPT_CODES = [
  '0239U',   // Signatera
  '0022U',   // BRCAplus
  '0037U',   // FoundationOne CDx
  '0211U',   // Oncotype DX
  '0017M',   // Oncotype DX
  '81479',   // Unlisted molecular pathology
  '81455',   // HLA typing
  '81445',   // Solid tumor NGS 5-50 genes
  '81450',   // Heme NGS 5-50 genes
  '81455',   // Solid tumor NGS 51+ genes
  '81507',   // Fetal aneuploidy
  '81528',   // Cologuard
  '81519',   // Oncotype DX Breast
  '81521',   // Oncotype DX Colon
  '0016U',   // Guardant360
  '0019U',   // Targeted genomic
  '0045U',   // ctDNA
  '0154U',   // clonoSEQ
  '0155U',   // clonoSEQ
  '0156U',   // clonoSEQ
  '0298U',   // Galleri
  '0334U',   // Guardant360 CDx
  '0340U',   // Signatera
  '81599'    // Unlisted multianalyte assay
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract unique vendors from test data
 */
function extractVendorsFromData() {
  try {
    const dataPath = join(__dirname, '../../src/data.js');
    const dataContent = readFileSync(dataPath, 'utf-8');
    const vendorMatches = dataContent.matchAll(/"vendor":\s*"([^"]+)"/g);
    const vendors = new Set();

    for (const match of vendorMatches) {
      const vendor = match[1].trim();
      if (vendor) {
        if (vendor.includes('/')) {
          vendor.split('/').forEach(v => vendors.add(v.trim()));
        } else {
          vendors.add(vendor);
        }
      }
    }

    return Array.from(vendors).sort();
  } catch (error) {
    console.error('Error reading data.js:', error.message);
    return [];
  }
}

/**
 * Generate URLs to try for a vendor without known URLs
 */
function generateUrlsForVendor(vendorName) {
  const domain = VENDOR_DOMAINS[vendorName];
  if (!domain) {
    return [];
  }

  const urls = {
    billing: [],
    coverage: [],
    products: [`https://www.${domain}/`, `https://${domain}/`],
    press: [],
    investor: []
  };

  // Generate URLs from pattern paths
  for (const path of URL_PATTERN_PATHS) {
    const url = `https://www.${domain}${path}`;
    if (path.includes('billing') || path.includes('financial')) {
      urls.billing.push(url);
    } else if (path.includes('coverage') || path.includes('medicare') || path.includes('reimbursement') || path.includes('insurance') || path.includes('payers')) {
      urls.coverage.push(url);
    } else if (path.includes('press') || path.includes('news')) {
      urls.press.push(url);
    }
  }

  return urls;
}

/**
 * Extract text content from HTML
 */
function extractTextFromHtml(html) {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');
  text = text.replace(/&#\d+;/g, ' ');

  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * Extract LCDs from text
 */
function extractLCDs(text) {
  const matches = text.match(PATTERNS.lcd) || [];
  const unique = [...new Set(matches.map(m => m.toUpperCase()))];
  // Prioritize known LCDs
  return unique.sort((a, b) => {
    const aKnown = KNOWN_LCDS.includes(a);
    const bKnown = KNOWN_LCDS.includes(b);
    if (aKnown && !bKnown) return -1;
    if (!aKnown && bKnown) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Extract NCDs from text (validate against known patterns)
 */
function extractNCDs(text) {
  const matches = text.match(PATTERNS.ncd) || [];
  // Filter to only include valid NCD-like numbers (not just any decimal)
  const filtered = matches.filter(m => {
    // Check if it's in context of NCD/coverage
    const idx = text.indexOf(m);
    const context = text.slice(Math.max(0, idx - 50), Math.min(text.length, idx + 50)).toLowerCase();
    return context.includes('ncd') || context.includes('national coverage') || KNOWN_NCDS.includes(m);
  });
  return [...new Set(filtered)];
}

/**
 * Extract CPT codes from text
 */
function extractCPTCodes(text) {
  const matches = text.match(PATTERNS.cpt) || [];
  const unique = [...new Set(matches.map(m => m.toUpperCase()))];

  // Filter out numbers that are clearly not CPT codes (e.g., years, phone numbers)
  const filtered = unique.filter(code => {
    // CPT codes starting with 0 are usually PLA codes (valid)
    if (code.startsWith('0') && code.length === 5) return true;
    // Standard CPT codes are 5 digits, often 8xxxx, 9xxxx for molecular
    const num = parseInt(code);
    if (!isNaN(num)) {
      // Exclude obvious non-CPT numbers like years (1900-2100)
      if (num >= 1900 && num <= 2100) return false;
      // Valid CPT ranges
      if (num >= 80000 && num <= 99999) return true;
      if (KNOWN_CPT_CODES.includes(code)) return true;
    }
    // Codes ending with letter (like 0211U) are PLA codes
    if (/\d{4}[A-Z]$/.test(code)) return true;
    return false;
  });

  // Prioritize known codes
  return filtered.sort((a, b) => {
    const aKnown = KNOWN_CPT_CODES.includes(a);
    const bKnown = KNOWN_CPT_CODES.includes(b);
    if (aKnown && !bKnown) return -1;
    if (!aKnown && bKnown) return 1;
    return a.localeCompare(b);
  });
}

/**
 * Extract reimbursement amounts from text
 */
function extractReimbursementAmounts(text) {
  const amounts = [];
  const dollarMatches = text.matchAll(/(\$[\d,]+(?:\.\d{2})?)/g);

  for (const match of dollarMatches) {
    const amount = match[1];
    const idx = match.index;
    const context = text.slice(Math.max(0, idx - 100), Math.min(text.length, idx + 100)).toLowerCase();

    // Only include amounts in reimbursement context
    if (context.includes('reimburs') || context.includes('price') || context.includes('cost') ||
        context.includes('payment') || context.includes('rate') || context.includes('fee') ||
        context.includes('charge') || context.includes('billing') || context.includes('pay')) {
      amounts.push({
        amount,
        context: text.slice(Math.max(0, idx - 50), Math.min(text.length, idx + 50)).trim()
      });
    }
  }

  return [...new Set(amounts.map(a => a.amount))];
}

/**
 * Extract covered indications from text
 */
function extractCoveredIndications(text) {
  const indications = [];
  const indicationPatterns = [
    /covered\s+(?:for|when|in)\s+([^.]+)/gi,
    /indication[s]?[:\s]+([^.]+)/gi,
    /approved\s+(?:for|in)\s+([^.]+)/gi,
    /(?:stage\s+)?(?:I{1,4}|[1-4])(?:-(?:I{1,4}|[1-4]))?\s+[a-z]+\s+cancer/gi,
    /(?:metastatic|advanced|recurrent|early[- ]stage|late[- ]stage)\s+[a-z]+\s+(?:cancer|carcinoma|melanoma|lymphoma|leukemia)/gi,
    /(?:breast|lung|colon|colorectal|prostate|ovarian|pancreatic|bladder|kidney|liver|gastric|esophageal)\s+cancer/gi,
    /(?:non-?small\s+cell\s+lung\s+cancer|NSCLC|SCLC|HCC|CRC|mCRC)/gi,
    /(?:minimal|measurable)\s+residual\s+disease|MRD/gi,
    /(?:recurrence|relapse)\s+(?:monitoring|detection|surveillance)/gi
  ];

  for (const pattern of indicationPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const indication = (match[1] || match[0]).trim();
      if (indication.length > 5 && indication.length < 100) {
        indications.push(indication);
      }
    }
  }

  return [...new Set(indications)].slice(0, 20); // Limit to top 20
}

/**
 * Extract test names from text for a specific vendor
 */
function extractTestNames(text, vendorName) {
  const testNames = [];
  const vendorTests = VENDOR_TESTS[vendorName] || [];

  // Look for vendor-specific test names
  for (const testName of vendorTests) {
    const regex = new RegExp(`\\b${escapeRegex(testName)}\\b`, 'gi');
    if (regex.test(text)) {
      testNames.push(testName);
    }
  }

  return [...new Set(testNames)];
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract raw coverage matches with context
 */
function extractRawMatches(text) {
  const matches = [];
  const seen = new Set();

  PATTERNS.coverageKeywords.lastIndex = 0;
  let match;
  while ((match = PATTERNS.coverageKeywords.exec(text)) !== null) {
    const start = Math.max(0, match.index - 100);
    const end = Math.min(text.length, match.index + match[0].length + 100);
    const context = text.slice(start, end).trim();

    if (!seen.has(context)) {
      seen.add(context);
      matches.push({
        term: match[0],
        context
      });
    }
  }

  return matches.slice(0, 50); // Limit to 50 matches
}

/**
 * Fetch a URL and return content
 */
async function fetchUrl(url, timeout = 15000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}`, html: null };
    }

    const html = await response.text();
    return { success: true, error: null, html };
  } catch (error) {
    return { success: false, error: error.message, html: null };
  }
}

/**
 * Process a single vendor
 */
async function processVendor(vendorName) {
  console.log(`\n[${vendorName}]`);

  // Get URLs for this vendor
  let urlConfig = VENDOR_URLS[vendorName];

  // If no known URLs, try to generate them
  if (!urlConfig) {
    console.log('  No known URLs, generating from domain patterns...');
    urlConfig = generateUrlsForVendor(vendorName);
    if (Object.values(urlConfig).flat().length === 0) {
      console.log('  ✗ No domain mapping found');
      return null;
    }
  }

  // Collect all URLs to scrape
  const allUrls = [
    ...new Set([
      ...(urlConfig.billing || []),
      ...(urlConfig.coverage || []),
      ...(urlConfig.products || []),
      ...(urlConfig.press || []),
      ...(urlConfig.investor || [])
    ])
  ];

  if (allUrls.length === 0) {
    console.log('  ✗ No URLs to scrape');
    return null;
  }

  // Scrape each URL
  const successfulScrapes = [];
  const sources = [];
  let combinedText = '';

  for (const url of allUrls) {
    console.log(`  Fetching: ${url}`);
    const result = await fetchUrl(url);

    if (result.success && result.html) {
      const text = extractTextFromHtml(result.html);
      combinedText += ' ' + text;
      successfulScrapes.push({ url, text });
      sources.push(url);
      console.log(`    ✓ Success (${text.length} chars)`);
    } else {
      console.log(`    ✗ Failed: ${result.error}`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (successfulScrapes.length === 0) {
    console.log('  ✗ All URLs failed');
    return null;
  }

  // Extract data from combined text
  console.log('  Extracting coverage data...');

  const lcds = extractLCDs(combinedText);
  const ncds = extractNCDs(combinedText);
  const cptCodes = extractCPTCodes(combinedText);
  const reimbursementAmounts = extractReimbursementAmounts(combinedText);
  const coveredIndications = extractCoveredIndications(combinedText);
  const rawMatches = extractRawMatches(combinedText);
  const testNames = extractTestNames(combinedText, vendorName);

  console.log(`    LCDs: ${lcds.length}, NCDs: ${ncds.length}, CPTs: ${cptCodes.length}`);
  console.log(`    Tests found: ${testNames.join(', ') || 'none'}`);

  return {
    vendor: vendorName,
    tests: testNames.length > 0 ? testNames : (VENDOR_TESTS[vendorName] || []),
    coverage: {
      lcds,
      ncds,
      cptCodes,
      reimbursementAmounts,
      coveredIndications,
      rawMatches
    },
    sources,
    metadata: {
      scrapedAt: new Date().toISOString(),
      successfulUrls: successfulScrapes.length,
      totalUrls: allUrls.length
    }
  };
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

async function main() {
  console.log('='.repeat(70));
  console.log('Vendor Coverage Scraper v2 (Enhanced)');
  console.log('='.repeat(70));
  console.log();

  // Extract vendors from data
  console.log('Extracting vendors from src/data.js...');
  const allVendors = extractVendorsFromData();
  console.log(`Found ${allVendors.length} unique vendors`);
  console.log();

  // Categorize vendors
  const vendorsWithKnownUrls = allVendors.filter(v => VENDOR_URLS[v]);
  const vendorsWithDomainOnly = allVendors.filter(v => !VENDOR_URLS[v] && VENDOR_DOMAINS[v]);
  const vendorsUnknown = allVendors.filter(v => !VENDOR_URLS[v] && !VENDOR_DOMAINS[v]);

  console.log('Vendor categories:');
  console.log(`  Known URLs: ${vendorsWithKnownUrls.length}`);
  console.log(`  Domain only (will try patterns): ${vendorsWithDomainOnly.length}`);
  console.log(`  Unknown: ${vendorsUnknown.length}`);
  console.log();

  if (vendorsUnknown.length > 0) {
    console.log('Vendors without domain mapping:');
    vendorsUnknown.forEach(v => console.log(`  - ${v}`));
    console.log();
  }

  // Process all vendors
  console.log('Starting scraping...');
  console.log('-'.repeat(70));

  const results = [];
  const vendorsToProcess = [...vendorsWithKnownUrls, ...vendorsWithDomainOnly];

  for (const vendor of vendorsToProcess) {
    const result = await processVendor(vendor);
    if (result) {
      results.push(result);
    }

    // Delay between vendors
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Prepare output
  const output = {
    metadata: {
      version: '2.0',
      scrapedAt: new Date().toISOString(),
      totalVendors: allVendors.length,
      vendorsScraped: results.length,
      vendorsSkipped: vendorsUnknown
    },
    vendors: results
  };

  // Write results
  const outputPath = join(__dirname, 'vendor-coverage-v2.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log('\n' + '='.repeat(70));
  console.log('Scraping complete!');
  console.log(`Results saved to: ${outputPath}`);
  console.log('='.repeat(70));

  // Print summary
  console.log('\nSummary:');
  console.log('-'.repeat(70));

  for (const result of results) {
    const { vendor, tests, coverage } = result;
    console.log(`\n${vendor}:`);
    console.log(`  Tests: ${tests.slice(0, 3).join(', ')}${tests.length > 3 ? ` (+${tests.length - 3} more)` : ''}`);
    console.log(`  LCDs: ${coverage.lcds.length > 0 ? coverage.lcds.join(', ') : 'none'}`);
    console.log(`  NCDs: ${coverage.ncds.length > 0 ? coverage.ncds.join(', ') : 'none'}`);
    console.log(`  CPTs: ${coverage.cptCodes.length > 0 ? coverage.cptCodes.slice(0, 5).join(', ') : 'none'}${coverage.cptCodes.length > 5 ? ` (+${coverage.cptCodes.length - 5} more)` : ''}`);
    console.log(`  Reimb amounts: ${coverage.reimbursementAmounts.length > 0 ? coverage.reimbursementAmounts.slice(0, 3).join(', ') : 'none'}`);
  }
}

// Run the script
main().catch(console.error);
