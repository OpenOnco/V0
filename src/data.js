// Auto-imported data (split from this file for auto-PR target stability)
import _COMPANY_CONTRIBUTIONS_DATA from './data/company_contributions.json' with { type: 'json' };
import _VENDOR_VERIFIED_DATA from './data/vendors_verified.json' with { type: 'json' };
import _VENDOR_ASSISTANCE_PROGRAMS_DATA from './data/vendor_assistance.json' with { type: 'json' };
import _mrdTestData_DATA from './data/tests/mrd.json' with { type: 'json' };
import _ecdTestData_DATA from './data/tests/ecd.json' with { type: 'json' };
import _trmTestData_DATA from './data/tests/trm.json' with { type: 'json' };
import _cgpTestData_DATA from './data/tests/cgp.json' with { type: 'json' };
import _hctTestData_DATA from './data/tests/hct.json' with { type: 'json' };
import _DATABASE_CHANGELOG_DATA from './data/changelog.json' with { type: 'json' };

// ============================================
// DATA.JS - OpenOnco Consolidated Data
// Last updated: 2026-04-06
// ============================================
//
// ⚠️  READ SUBMISSION_PROCESS.md BEFORE MAKING ANY CHANGES
//     Location: /Users/adickinson/Documents/GitHub/V0/SUBMISSION_PROCESS.md
//
// ┌─────────────────────────────────────────────────────────────────┐
// │                        QUICK REFERENCE                          │
// ├─────────────────────────────────────────────────────────────────┤
// │ SECTION                    │ START LINE  │ NOTES               │
// ├─────────────────────────────────────────────────────────────────┤
// │ VENDOR_VERIFIED            │ ~463        │ Vendor verification │
// │ VENDOR_ASSISTANCE_PROGRAMS │ ~515        │ Patient assistance  │
// │ MRD Tests                  │ ~750        │ mrd-27 next         │
// │ MRD IVD Kits               │ ~1900       │ mrd-kit-4 next      │
// │ ECD Tests                  │ ~2020       │ ecd-24 next         │
// │ TRM Tests                  │ ~3140       │ trm-15 next         │
// │ TDS Tests                  │ ~3490       │ tds-28 next         │
// │ TDS IVD Kits               │ ~4370       │ tds-kit-20 next     │
// │ HCT Tests                  │ ~6670       │ hct-34 next         │
// │ DATABASE_CHANGELOG         │ ~7070       │ --                  │
// └─────────────────────────────────────────────────────────────────┘
//
// ⚠️  MCED PORTAL SYNC: When updating ECD test data (especially MCED tests),
//     also update the MCED portal's data source notes:
//       Repo: /Users/adickinson/Documents/GitHub/mced-portal
//       File: src/data/testSources.js
//     That file has per-test commentary, citations, and publication counts
//     shown in the MCED portal's "Data Sources" popup. It does NOT auto-sync
//     from this file — manual update required. Deploy separately via
//     `npx vercel --prod` from the mced-portal directory.
//
// ============================================
// TEMPLATES - Copy, fill in, paste at insertion point
// ============================================

/*
┌─────────────────────────────────────────────────────────────────┐
│ FIELD SEMANTICS NOTES                                           │
├─────────────────────────────────────────────────────────────────┤
│ approach ("Tumor-informed" vs "Tumor-naïve"):                   │
│   - Tumor-informed: Test uses patient-specific variants         │
│     identified from a baseline sample (tumor tissue, bone       │
│     marrow, or high-disease-burden blood)                       │
│   - Tumor-naïve: Test uses fixed panels without patient-        │
│     specific customization                                      │
│                                                                 │
│ requiresTumorTissue ("Yes" vs "No"):                            │
│   - Indicates whether SOLID TUMOR TISSUE biopsy is required     │
│   - Hematologic MRD tests (clonoSEQ, LymphoVista) may be        │
│     tumor-informed but use blood/marrow, not tissue biopsies    │
│   - A test can be tumor-informed with requiresTumorTissue: "No" │
│     if it uses blood/marrow samples for baseline genotyping     │
│                                                                 │
│ slug (optional):                                                │
│   - Explicit URL slug when auto-generated slug would collide    │
│   - Example: Tempus xF+ has slug: "tempus-xf-plus" to avoid     │
│     collision with Tempus xF (both → "tempus-xf" otherwise)     │
└─────────────────────────────────────────────────────────────────┘
*/

/*
┌─────────────────────────────────────────────────────────────────┐
│ BASELINE COMPLETE (BC) QUALITY STANDARD                         │
├─────────────────────────────────────────────────────────────────┤
│ All tests must meet Baseline Complete (BC) requirements before  │
│ being added to the database. BC tests have ALL minimum fields   │
│ filled in for their category. Check MINIMUM_PARAMS in App.jsx   │
│ for the specific fields required per category.                  │
│                                                                 │
│ Key BC fields typically include:                                │
│   - MRD: sensitivity, specificity, lod, initialTat, followUpTat,│
│          fdaStatus, reimbursement, numPublications              │
│   - ECD: sensitivity, specificity, fdaStatus, reimbursement,    │
│          numPublications                                        │
│   - TDS: genesAnalyzed, fdaStatus, tat, reimbursement,          │
│          numPublications                                        │
│   - TRM: sensitivity, specificity, fdaStatus, tat,              │
│          reimbursement, numPublications                         │
│                                                                 │
│ Citation requirements for 100% sens/spec values:                │
│   - If sensitivity or specificity = 100%, check validation data │
│   - For small cohorts (<200 patients): set smallSampleWarning   │
│   - For analytical validation only: set analyticalValidation-   │
│     Warning = true                                              │
│   - Always prefer PubMed/peer-reviewed citations over vendor    │
│     websites for clinical performance data                      │
└─────────────────────────────────────────────────────────────────┘
*/

/*
┌─────────────────────────────────────────────────────────────────┐
│ MRD TEST TEMPLATE                                               │
│ Insert before: "// IVD KITS - Laboratory kits"                  │
│ Search for: "// INSERT NEW MRD TEST HERE"                       │
└─────────────────────────────────────────────────────────────────┘
  {
    "id": "mrd-XX",
    "sampleCategory": "Blood/Plasma",
    "name": "",
    "vendor": "",
    "approach": "Tumor-informed",  // or "Tumor-naïve"
    "method": "",
    "cancerTypes": [],
    "indicationsNotes": "",
    "sensitivity": null,
    "sensitivityNotes": "",
    "specificity": null,
    "specificityNotes": "",
    "lod": "",
    "lodNotes": "",
    "requiresTumorTissue": "Yes",
    "requiresMatchedNormal": "Yes",
    "variantsTracked": "",
    "initialTat": null,
    "initialTatNotes": "",
    "followUpTat": null,
    "followUpTatNotes": "",
    "bloodVolume": null,
    "bloodVolumeNotes": "",
    "fdaStatus": "CLIA LDT",
    "reimbursement": "Coverage emerging",
    "reimbursementNote": "",
    "cptCodes": "",
    "clinicalAvailability": "",
    "clinicalTrials": "",
    "clinicalSettings": ["Post-Surgery", "Surveillance"],
    "totalParticipants": null,
    "numPublications": null
  },

┌─────────────────────────────────────────────────────────────────┐
│ ECD TEST TEMPLATE                                               │
│ Insert before: "// IVD KITS - Self-Collection"                  │
│ Search for: "// INSERT NEW ECD TEST HERE"                       │
└─────────────────────────────────────────────────────────────────┘
  {
    "id": "ecd-XX",
    "sampleCategory": "Blood/Plasma",
    "name": "",
    "vendor": "",
    "testScope": "Single-cancer (TYPE)",  // or "Multi-cancer (MCED)"
    "approach": "Blood-based cfDNA screening (plasma)",
    "method": "",
    "cancerTypes": [],
    "targetPopulation": "",
    "indicationGroup": "",
    "sensitivity": null,
    "sensitivityCitations": "",
    "stageISensitivity": null,
    "stageIISensitivity": null,
    "stageIIISensitivity": null,
    "stageIVSensitivity": null,
    "specificity": null,
    "specificityCitations": "",
    "ppv": null,
    "npv": null,
    "fdaStatus": "CLIA LDT",
    "reimbursement": "Coverage Varies",
    "reimbursementNote": "",
    "clinicalAvailability": "",
    "availableRegions": ["US"],
    "tat": "",
    "sampleType": "",
    "cptCode": "",
    "listPrice": null,
    "screeningInterval": "",
    "clinicalTrials": "",
    "totalParticipants": null,
    "numPublications": null
  },

┌─────────────────────────────────────────────────────────────────┐
│ TRM TEST TEMPLATE                                               │
│ Insert before: "];" that ends trmTestData                       │
│ Search for: "// INSERT NEW TRM TEST HERE"                       │
└─────────────────────────────────────────────────────────────────┘
  {
    "id": "trm-XX",
    "sampleCategory": "Blood/Plasma",
    "name": "",
    "vendor": "",
    "approach": "Tumor-naïve",  // or "Tumor-informed"
    "method": "",
    "cancerTypes": [],
    "targetPopulation": "",
    "responseDefinition": "",
    "indicationsNotes": "",
    "sensitivity": null,
    "specificity": null,
    "lod": "",
    "lodNotes": "",
    "fdaStatus": "CLIA LDT",
    "reimbursement": "Coverage emerging",
    "reimbursementNote": "",
    "clinicalAvailability": "",
    "availableRegions": ["US"],
    "tat": "",
    "bloodVolume": null,
    "clinicalTrials": "",
    "totalParticipants": null,
    "numPublications": null,
    "requiresTumorTissue": "No",
    "requiresMatchedNormal": "No"
  },

┌─────────────────────────────────────────────────────────────────┐
│ TDS TEST TEMPLATE (Central Lab Service)                         │
│ Insert before: "// IVD KITS - Laboratory Kits for TDS"          │
│ Search for: "// INSERT NEW TDS TEST HERE"                       │
└─────────────────────────────────────────────────────────────────┘
  {
    "id": "tds-XX",
    "name": "",
    "vendor": "",
    "productType": "Central Lab Service",
    "sampleCategory": "Tissue",  // or "Blood/Plasma"
    "approach": "Tissue CGP",  // or "Liquid CGP", "Gene Expression Profiling"
    "method": "",
    "methodCitations": "",
    "genesAnalyzed": null,
    "geneListUrl": "",
    "biomarkersReported": ["SNVs", "Indels", "CNAs", "Fusions", "TMB", "MSI"],
    "cancerTypes": ["All solid tumors"],
    "targetPopulation": "",
    "fdaStatus": "CLIA LDT",
    "fdaCompanionDxCount": null,
    "vendorClaimsNCCNAlignment": true,
    "vendorNCCNAlignmentIndications": [],
    "vendorNCCNAlignmentNotes": "",
    "tat": "",
    "sampleRequirements": "",
    "reimbursement": "Medicare",
    "reimbursementNote": "",
    "listPrice": null,
    "cptCodes": "",
    "clinicalAvailability": "",
    "numPublications": null
  },

┌─────────────────────────────────────────────────────────────────┐
│ TDS IVD KIT TEMPLATE                                            │
│ Insert before: "];" that ends tdsTestData                       │
│ Search for: "// INSERT NEW TDS KIT HERE"                        │
└─────────────────────────────────────────────────────────────────┘
  {
    "id": "tds-kit-XX",
    "name": "",
    "vendor": "",
    "productType": "Laboratory IVD Kit",
    "platformRequired": "",
    "sampleCategory": "Tissue",
    "approach": "Tissue CGP",
    "method": "",
    "genesAnalyzed": null,
    "cancerTypes": [],
    "indicationsNotes": "",
    "fdaStatus": "FDA-approved",  // or "CE-IVD", "RUO"
    "reimbursement": "",
    "clinicalAvailability": "",
    "technologyDifferentiator": ""
  },

┌─────────────────────────────────────────────────────────────────┐
│ CHANGELOG ENTRY TEMPLATE                                        │
│ Insert at TOP of DATABASE_CHANGELOG array                       │
│ Search for: "export const DATABASE_CHANGELOG"                   │
└─────────────────────────────────────────────────────────────────┘
  {
    date: 'Mon DD, YYYY',
    type: 'added',  // or 'updated', 'feature'
    testId: 'xxx-XX',
    testName: '',
    vendor: '',
    category: 'TDS',  // MRD, ECD, TRM, TDS
    description: '',
    contributor: null,  // or 'Name'
    affiliation: 'OpenOnco',  // or 'Vendor Name (vendor)'
    citation: null  // or 'https://...'
  },
*/

// ============================================
// COMPANY CONTRIBUTIONS - CC Badge Tracking
// Maps test IDs to company rep submissions/communications
// Includes: new test nominations + vendor-submitted corrections/updates
// ============================================
export const COMPANY_CONTRIBUTIONS = _COMPANY_CONTRIBUTIONS_DATA;

// ============================================
// VENDOR VERIFIED - Full Validation Badge Tracking
// Tests where vendor rep completed the Vendor Test Validation flow
// These get the premium green "VENDOR VERIFIED" badge and sort priority
// ============================================
export const VENDOR_VERIFIED = _VENDOR_VERIFIED_DATA;

// ============================================
// INSURANCE PROVIDERS
// Master list of insurance providers for wizard dropdowns
// When adding a new test with commercialPayers, add any new providers here
// Categories: government (Medicare, Medicaid, VA), major national, regional
// ============================================
export const INSURANCE_PROVIDERS = {
  // Government programs
  government: [
    { id: 'medicare', label: 'Medicare', description: 'Federal program for 65+' },
    { id: 'medicaid', label: 'Medicaid', description: 'State-based assistance program' },
    { id: 'va', label: 'VA / TRICARE', description: 'Veterans and military' },
  ],
  // Major national commercial payers (alphabetical)
  national: [
    { id: 'aetna', label: 'Aetna' },
    { id: 'anthem-bcbs', label: 'Anthem / BCBS' },
    { id: 'cigna', label: 'Cigna' },
    { id: 'humana', label: 'Humana' },
    { id: 'kaiser', label: 'Kaiser Permanente' },
    { id: 'united', label: 'UnitedHealthcare' },
  ],
  // Regional payers with known coverage (alphabetical)
  regional: [
    { id: 'bcbs-louisiana', label: 'BCBS Louisiana' },
    { id: 'blue-shield-ca', label: 'Blue Shield of California' },
    { id: 'geisinger', label: 'Geisinger Health Plan' },
    { id: 'highmark', label: 'Highmark' },
  ],
};

// Flat list of all insurance providers for easy lookup
export const ALL_INSURANCE_PROVIDERS = [
  ...INSURANCE_PROVIDERS.government,
  ...INSURANCE_PROVIDERS.national,
  ...INSURANCE_PROVIDERS.regional,
  { id: 'other', label: 'Other insurance', description: 'Not listed above' },
];

// Map from commercialPayers array values to our provider IDs
// Used to match test coverage to user's selected insurance
export const PAYER_NAME_TO_ID = {
  'Medicare': 'medicare',
  'Medicaid': 'medicaid',
  'VA': 'va',
  'TRICARE': 'va',
  'Aetna': 'aetna',
  'Anthem BCBS': 'anthem-bcbs',
  'BCBS': 'anthem-bcbs',
  'Cigna': 'cigna',
  'Humana': 'humana',
  'Kaiser': 'kaiser',
  'Kaiser Permanente': 'kaiser',
  'UnitedHealthcare': 'united',
  'BCBS Louisiana': 'bcbs-louisiana',
  'Blue Shield of California': 'blue-shield-ca',
  'Geisinger Health Plan': 'geisinger',
  'Highmark': 'highmark',
};

// Helper: Check if a test is covered by a specific insurance provider ID
export const isTestCoveredByInsurance = (test, insuranceId) => {
  if (!insuranceId || insuranceId === 'other') return true; // Can't filter on "other"
  
  // Check Medicare in reimbursement field
  if (insuranceId === 'medicare') {
    return test.reimbursement?.toLowerCase().includes('medicare');
  }
  
  // Check Medicaid in reimbursement field
  if (insuranceId === 'medicaid') {
    return test.reimbursement?.toLowerCase().includes('medicaid');
  }
  
  // Check VA/TRICARE
  if (insuranceId === 'va') {
    return test.reimbursement?.toLowerCase().includes('va') || 
           test.reimbursement?.toLowerCase().includes('tricare');
  }
  
  // Check commercialPayers array for commercial insurance
  if (test.commercialPayers && Array.isArray(test.commercialPayers)) {
    return test.commercialPayers.some(payer => {
      const payerId = PAYER_NAME_TO_ID[payer];
      return payerId === insuranceId;
    });
  }
  
  return false;
};

// ============================================
// AVAILABLE REGIONS
// Master list of regions/countries for location filtering
// ============================================
export const AVAILABLE_REGIONS = [
  { id: 'US', label: 'United States' },
  { id: 'EU', label: 'European Union' },
  { id: 'UK', label: 'United Kingdom' },
  { id: 'Canada', label: 'Canada' },
  { id: 'Australia', label: 'Australia' },
  { id: 'Japan', label: 'Japan' },
  { id: 'China', label: 'China' },
  { id: 'South Korea', label: 'South Korea' },
  { id: 'Singapore', label: 'Singapore' },
  { id: 'Israel', label: 'Israel' },
  { id: 'Germany', label: 'Germany' },
  { id: 'International', label: 'Other / International' },
];

// US States for granular US location
export const US_STATES = [
  { id: 'AL', label: 'Alabama' }, { id: 'AK', label: 'Alaska' }, { id: 'AZ', label: 'Arizona' },
  { id: 'AR', label: 'Arkansas' }, { id: 'CA', label: 'California' }, { id: 'CO', label: 'Colorado' },
  { id: 'CT', label: 'Connecticut' }, { id: 'DE', label: 'Delaware' }, { id: 'FL', label: 'Florida' },
  { id: 'GA', label: 'Georgia' }, { id: 'HI', label: 'Hawaii' }, { id: 'ID', label: 'Idaho' },
  { id: 'IL', label: 'Illinois' }, { id: 'IN', label: 'Indiana' }, { id: 'IA', label: 'Iowa' },
  { id: 'KS', label: 'Kansas' }, { id: 'KY', label: 'Kentucky' }, { id: 'LA', label: 'Louisiana' },
  { id: 'ME', label: 'Maine' }, { id: 'MD', label: 'Maryland' }, { id: 'MA', label: 'Massachusetts' },
  { id: 'MI', label: 'Michigan' }, { id: 'MN', label: 'Minnesota' }, { id: 'MS', label: 'Mississippi' },
  { id: 'MO', label: 'Missouri' }, { id: 'MT', label: 'Montana' }, { id: 'NE', label: 'Nebraska' },
  { id: 'NV', label: 'Nevada' }, { id: 'NH', label: 'New Hampshire' }, { id: 'NJ', label: 'New Jersey' },
  { id: 'NM', label: 'New Mexico' }, { id: 'NY', label: 'New York' }, { id: 'NC', label: 'North Carolina' },
  { id: 'ND', label: 'North Dakota' }, { id: 'OH', label: 'Ohio' }, { id: 'OK', label: 'Oklahoma' },
  { id: 'OR', label: 'Oregon' }, { id: 'PA', label: 'Pennsylvania' }, { id: 'RI', label: 'Rhode Island' },
  { id: 'SC', label: 'South Carolina' }, { id: 'SD', label: 'South Dakota' }, { id: 'TN', label: 'Tennessee' },
  { id: 'TX', label: 'Texas' }, { id: 'UT', label: 'Utah' }, { id: 'VT', label: 'Vermont' },
  { id: 'VA', label: 'Virginia' }, { id: 'WA', label: 'Washington' }, { id: 'WV', label: 'West Virginia' },
  { id: 'WI', label: 'Wisconsin' }, { id: 'WY', label: 'Wyoming' }, { id: 'DC', label: 'Washington D.C.' },
];

// Helper: Check if a test is available in a region
export const isTestAvailableInRegion = (test, regionId) => {
  if (!regionId || regionId === 'International') return true;
  if (!test.availableRegions || test.availableRegions.length === 0) return true; // Assume available if not specified
  
  // Check if region is in availableRegions array
  return test.availableRegions.some(region => {
    if (region === regionId) return true;
    if (region === 'International') return true;
    // Handle "EU" matching "Germany" etc.
    if (regionId === 'Germany' && region === 'EU') return true;
    return false;
  });
};

// ============================================
// VENDOR PATIENT ASSISTANCE PROGRAMS
// Source: Web research, verified 2026-01-07
// Programs change frequently - verify with vendor before relying on them
// ============================================
export const VENDOR_ASSISTANCE_PROGRAMS = _VENDOR_ASSISTANCE_PROGRAMS_DATA;

// Helper function to check if a test has assistance program by vendor name
export const hasAssistanceProgram = (vendorName) => {
  if (!vendorName) return false;
  // Direct match
  if (VENDOR_ASSISTANCE_PROGRAMS[vendorName]?.hasProgram) return true;
  // Partial match (e.g., "Foundation Medicine / Natera" should match)
  for (const vendor of Object.keys(VENDOR_ASSISTANCE_PROGRAMS)) {
    if (vendorName.includes(vendor) && VENDOR_ASSISTANCE_PROGRAMS[vendor]?.hasProgram) {
      return true;
    }
  }
  return false;
};

// Helper to get assistance program details for a vendor
export const getAssistanceProgramForVendor = (vendorName) => {
  if (!vendorName) return null;
  // Direct match first
  if (VENDOR_ASSISTANCE_PROGRAMS[vendorName]) {
    return VENDOR_ASSISTANCE_PROGRAMS[vendorName];
  }
  // Partial match
  for (const vendor of Object.keys(VENDOR_ASSISTANCE_PROGRAMS)) {
    if (vendorName.includes(vendor)) {
      return VENDOR_ASSISTANCE_PROGRAMS[vendor];
    }
  }
  return null;
};

// Additional resources for all patients
export const PATIENT_ASSISTANCE_RESOURCES = [
  {
    name: 'Cancer Financial Assistance Coalition (CFAC)',
    url: 'https://cancerfac.org',
    description: 'Consortium of organizations helping patients manage financial challenges from cancer diagnosis'
  },
  {
    name: 'CancerCare',
    url: 'https://www.cancercare.org/financial_assistance',
    description: 'Financial assistance for cancer-related costs and co-pays; professional oncology social workers'
  },
  {
    name: 'Patient Advocate Foundation',
    url: 'https://www.patientadvocate.org/connect-with-services/financial-aid-funds/',
    description: 'Various funds for specific cancer types including Merkel Cell Carcinoma, Ovarian Cancer, etc.'
  },
  {
    name: 'American Cancer Society',
    url: 'https://www.cancer.org',
    description: 'Resources for finding financial help for cancer patients'
  }
];

// ============================================
// TEST DATA ARRAYS START HERE
// ============================================

// MRD Tests
export const mrdTestData = _mrdTestData_DATA;

// ECD Tests
export const ecdTestData = _ecdTestData_DATA;


// DEPRECATED: TRM tests merged into mrdTestData - empty alias for backwards compatibility
export const trmTestData = _trmTestData_DATA;

// CGP Tests (Comprehensive Genomic Profiling - formerly TDS)
export const cgpTestData = _cgpTestData_DATA;

// ============================================

// DEPRECATED: tdsTestData renamed to cgpTestData - alias for backwards compatibility
export const tdsTestData = cgpTestData;

// HCT (Hereditary Cancer Testing) Tests
// Germline genetic testing for inherited cancer predisposition
// ============================================
export const hctTestData = _hctTestData_DATA;


// Database Changelog - OpenOnco (Cancer)
export const DATABASE_CHANGELOG = _DATABASE_CHANGELOG_DATA;

// Recently Added Tests
export const RECENTLY_ADDED_TESTS = [
  { id: 'ecd-27', name: 'OncoXPLORE+', vendor: 'OncoDNA', category: 'ECD', dateAdded: 'Jan 8, 2026' },
  { id: 'mrd-26', name: 'MRDVision', vendor: 'Inocras', category: 'MRD', dateAdded: 'Jan 7, 2026' },
  { id: 'tds-kit-19', name: 'Oncomine Comprehensive Assay Plus GX', vendor: 'Thermo Fisher Scientific', category: 'TDS', dateAdded: 'Mar 25, 2026' },
  { id: 'ecd-26', name: 'Trucheck Intelli', vendor: 'Datar Cancer Genetics', category: 'ECD', dateAdded: 'Jan 7, 2026' },
  { id: 'tds-26', name: 'CellSight DNA', vendor: 'Cancer Cell Dx', category: 'TDS', dateAdded: 'Jan 7, 2026' },
  { id: 'tds-27', name: 'CancerVision', vendor: 'Inocras', category: 'TDS', dateAdded: 'Jan 7, 2026' },
  { id: 'ecd-25', name: 'CancerDetect Oral & Throat', vendor: 'Viome', category: 'ECD', dateAdded: 'Jan 1, 2026' },
  { id: 'tds-kit-15', name: 'OncoScreen Plus Tissue Kit', vendor: 'Burning Rock Dx', category: 'TDS', dateAdded: 'Jan 1, 2026' },
  { id: 'tds-kit-14', name: 'OncoScreen Focus CDx Tissue Kit', vendor: 'Burning Rock Dx', category: 'TDS', dateAdded: 'Jan 1, 2026' },
  { id: 'tds-25', name: 'OncoScreen Focus CDx', vendor: 'Burning Rock Dx', category: 'TDS', dateAdded: 'Jan 1, 2026' },
  { id: 'tds-24', name: 'OncoCompass Target', vendor: 'Burning Rock Dx', category: 'TDS', dateAdded: 'Jan 1, 2026' },
  { id: 'tds-23', name: 'Resolution ctDx FIRST', vendor: 'Agilent / Resolution Bioscience', category: 'TDS', dateAdded: 'Dec 24, 2025' },
  { id: 'tds-22', name: 'LiquidHALLMARK', vendor: 'Lucence', category: 'TDS', dateAdded: 'Dec 19, 2025' },
  { id: 'mrd-24', name: 'CancerVista', vendor: 'LIQOMICS', category: 'MRD', dateAdded: 'Dec 15, 2025' },
  { id: 'ecd-kit-1', name: 'Cologuard', vendor: 'Exact Sciences', category: 'ECD', dateAdded: 'Dec 14, 2025' },
  { id: 'mrd-kit-1', name: 'clonoSEQ Assay (IVD Kit)', vendor: 'Adaptive Biotechnologies', category: 'MRD', dateAdded: 'Dec 14, 2025' },
  { id: 'tds-kit-1', name: 'TSO Comprehensive', vendor: 'Illumina', category: 'TDS', dateAdded: 'Dec 14, 2025' },
  { id: 'tds-kit-6', name: 'cobas EGFR v2', vendor: 'Roche', category: 'TDS', dateAdded: 'Dec 14, 2025' },
  { id: 'tds-18', name: 'IsoPSA', vendor: 'Cleveland Diagnostics', category: 'TDS', dateAdded: 'Dec 13, 2025' },
  { id: 'trm-12', name: 'Reveal TRM', vendor: 'Guardant Health', category: 'TRM', dateAdded: 'Dec 12, 2025' },
  { id: 'mrd-23', name: 'LymphoVista', vendor: 'LIQOMICS', category: 'MRD', dateAdded: 'Dec 12, 2025' },
  { id: 'mrd-22', name: 'CancerDetect', vendor: 'IMBdx', category: 'MRD', dateAdded: 'Dec 11, 2025' },
];

// Helper to get changelog
export const getChangelog = () => {
  return DATABASE_CHANGELOG;
};

// Helper to get recently added tests
export const getRecentlyAddedTests = () => {
  return RECENTLY_ADDED_TESTS;
};


// ============================================
// Domain Detection
// ============================================
export const DOMAINS = {
  ONCO: 'onco'
};

export const getDomain = () => {
  return DOMAINS.ONCO;
};

// Build info for display purposes
export const BUILD_INFO = {
  date: new Date(typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : new Date().toISOString()).toLocaleString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }),
  sources: {
    MRD: 'https://docs.google.com/spreadsheets/d/16F_QRjpiqlrCK1f5fPSHQsODdE5QVPrrdx-0rfKAa5U/edit',
    ECD: 'https://docs.google.com/spreadsheets/d/1eFZg2EtdnR4Ly_lrXoZxzI4Z2bH23LDkCAVCXrewwnI/edit',
    TRM: 'https://docs.google.com/spreadsheets/d/1ZgvK8AgZzZ4XuZEija_m1FSffnnhvIgmVCkQvP1AIXE/edit',
    TDS: 'https://docs.google.com/spreadsheets/d/1HxYNQ9s4qJKHxFMkYjW1uXBq3Zg3nVkFp3mQZQvZF0s/edit'
  }
};

export const getSiteConfig = () => {
  return {
    domain: DOMAINS.ONCO,
    name: 'OpenOnco',
    tagline: 'Oncology Diagnostics Database',
    description: 'Compare cancer diagnostic tests across categories',
    logoText: 'OpenOnco',
    themeColor: '#2563eb', // Blue for Onco
    categories: ['MRD', 'ECD', 'CGP', 'HCT']
  };
};

// ============================================
// Lifecycle Stages
// ============================================
export const LIFECYCLE_STAGES = [
  {
    id: 'HCT',
    name: 'Risk',
    fullName: 'Hereditary Risk',
    acronym: 'HCT',
    technicalName: 'Hereditary Cancer Testing',
    phase: 'Prevention',
    color: 'sky',
    icon: '🧬',
    gridPosition: 0,
    animationOrder: 0,
    arrowDirection: 'right',
    domain: DOMAINS.ONCO,
    path: '/risk',
  },
  {
    id: 'ECD',
    name: 'Screen',
    fullName: 'Cancer Screening',
    acronym: 'ECD',
    technicalName: 'Early Cancer Detection',
    phase: 'Screening',
    color: 'emerald',
    icon: '🔬',
    gridPosition: 1,
    animationOrder: 1,
    arrowDirection: 'down',
    domain: DOMAINS.ONCO,
    path: '/screen',
  },
  {
    id: 'MRD',
    name: 'Monitor',
    fullName: 'Cancer Monitoring',
    acronym: 'MRD',
    technicalName: 'Molecular Residual Disease',
    phase: 'Surveillance',
    color: 'orange',
    icon: '🎯',
    gridPosition: 2,
    animationOrder: 2,
    arrowDirection: 'up',
    domain: DOMAINS.ONCO,
    path: '/monitor',
    // Note: MRD lifecycle stage combines MRD + TRM test categories
    includesCategories: ['MRD', 'TRM'],
  },
  {
    id: 'CGP',
    name: 'Treat',
    fullName: 'Treatment Selection',
    acronym: 'CGP',
    technicalName: 'Comprehensive Genomic Profiling',
    phase: 'Diagnosis',
    color: 'violet',
    icon: '🧬',
    gridPosition: 3,
    animationOrder: 3,
    arrowDirection: 'left',
    domain: DOMAINS.ONCO,
    path: '/treat',
  },
];

export const LIFECYCLE_STAGES_BY_GRID = [...LIFECYCLE_STAGES].sort((a, b) => a.gridPosition - b.gridPosition);

export const getStagesByDomain = (domain) => {
  return LIFECYCLE_STAGES.filter(stage => stage.domain === domain);
};

// ============================================
// Color Classes
// ============================================
export const lifecycleColorClasses = {
  emerald: {
    bg: 'bg-emerald-500',
    bgLight: 'bg-emerald-50',
    bgMedium: 'bg-emerald-100',
    border: 'border-emerald-200',
    borderActive: 'border-emerald-500',
    text: 'text-emerald-600',
    textLight: 'text-emerald-400',
    textDark: 'text-emerald-700',
  },
  violet: {
    bg: 'bg-violet-500',
    bgLight: 'bg-violet-50',
    bgMedium: 'bg-violet-100',
    border: 'border-violet-200',
    borderActive: 'border-violet-500',
    text: 'text-violet-600',
    textLight: 'text-violet-400',
    textDark: 'text-violet-700',
  },
  sky: {
    bg: 'bg-sky-500',
    bgLight: 'bg-sky-50',
    bgMedium: 'bg-sky-100',
    border: 'border-sky-200',
    borderActive: 'border-sky-500',
    text: 'text-sky-600',
    textLight: 'text-sky-400',
    textDark: 'text-sky-700',
  },
  orange: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-50',
    bgMedium: 'bg-orange-100',
    border: 'border-orange-200',
    borderActive: 'border-orange-500',
    text: 'text-orange-600',
    textLight: 'text-orange-400',
    textDark: 'text-orange-700',
  },
  indigo: {
    bg: 'bg-indigo-500',
    bgLight: 'bg-indigo-50',
    bgMedium: 'bg-indigo-100',
    border: 'border-indigo-200',
    borderActive: 'border-indigo-500',
    text: 'text-indigo-600',
    textLight: 'text-indigo-400',
    textDark: 'text-indigo-700',
  },
};

// ============================================
// Product Types
// ============================================
export const PRODUCT_TYPES = {
  SELF_COLLECTION: {
    id: 'Self-Collection',
    label: 'Self-Collection',
    icon: '🏠',
    description: 'Patient collects sample at home',
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
  },
  LAB_KIT: {
    id: 'Laboratory IVD Kit',
    label: 'Lab Kit',
    icon: '🔬',
    description: 'IVD kit run at CLIA-certified lab',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
  },
  CENTRAL_LAB: {
    id: 'Central Lab Service',
    label: 'Service',
    icon: '🏥',
    description: 'Sample shipped to central laboratory',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
  },
};

export const getProductTypeConfig = (productType) => {
  if (!productType) return PRODUCT_TYPES.CENTRAL_LAB;
  return Object.values(PRODUCT_TYPES).find(pt => pt.id === productType) || PRODUCT_TYPES.CENTRAL_LAB;
};

// ============================================
// Category Metadata
// ============================================
export const createCategoryMeta = (buildInfoSources = {}) => ({
  MRD: {
    title: 'Molecular Residual Disease',
    shortTitle: 'MRD Testing',
    description: 'Molecular Residual Disease (MRD) testing detects tiny amounts of cancer that remain in the body after treatment, often before any symptoms or imaging findings appear. These tests analyze circulating tumor DNA (ctDNA) from a blood sample to identify whether cancer cells persist at the molecular level. MRD results help oncologists make critical decisions about whether additional treatment is needed, assess the effectiveness of therapy, and monitor for early signs of recurrence during surveillance.',
    patientTitle: 'Tests After Treatment',
    patientDescription: 'These blood tests check if any cancer cells remain after surgery or treatment. Finding leftover cancer early can help your doctor decide if you need more treatment.',
    color: 'orange',
    tests: mrdTestData,
    sourceUrl: buildInfoSources.MRD || '',
    domain: DOMAINS.ONCO,
  },
  ECD: {
    title: 'Early Cancer Detection',
    shortTitle: 'Early Detection',
    description: 'Early Cancer Detection (ECD) tests screen for cancer in people who have no symptoms, with the goal of catching the disease at its earliest and most treatable stages. These tests look for cancer signals in blood or stool samples using various biomarkers including ctDNA methylation patterns, tumor-derived proteins, genetic mutations, and stool DNA markers. Some tests screen for a single cancer type (like colorectal), while multi-cancer early detection (MCED) tests can screen for dozens of cancer types simultaneously.',
    patientTitle: 'Cancer Screening Tests',
    patientDescription: 'These tests look for signs of cancer before you have any symptoms using a blood draw or stool sample. Finding cancer early, when it\'s easiest to treat, can save lives.',
    color: 'green',
    tests: ecdTestData,
    sourceUrl: buildInfoSources.ECD || '',
    domain: DOMAINS.ONCO,
  },
  TRM: {
    title: 'Treatment Response Monitoring',
    shortTitle: 'Response Monitoring',
    description: 'Treatment Response Monitoring (TRM) tests track how well a cancer treatment is working by measuring changes in circulating tumor DNA (ctDNA) levels over time. A decrease in ctDNA often indicates the treatment is effective, while stable or rising levels may signal resistance or progression—sometimes weeks before changes appear on imaging scans. This sensitive molecular monitoring helps oncologists optimize therapy for most favorable outcomes, potentially switching ineffective treatments earlier and sparing patients unnecessary toxicity.',
    patientTitle: 'Is My Treatment Working?',
    patientDescription: 'These blood tests track whether your cancer treatment is working. They can show results weeks before a scan, helping your doctor adjust treatment if needed.',
    color: 'red',
    tests: trmTestData,
    sourceUrl: buildInfoSources.TRM || '',
    domain: DOMAINS.ONCO,
  },
  TDS: {
    title: 'Treatment Decision Support',
    shortTitle: 'Treatment Decisions',
    description: 'Treatment Decision Support (TDS) tests help guide clinical decisions about cancer treatment. This includes Comprehensive Genomic Profiling (CGP) tests that analyze tumor DNA/RNA to identify targetable mutations and match patients to therapies, as well as risk stratification tests that help determine whether interventions like biopsies are needed. These tests support personalized treatment decisions based on molecular and protein biomarker analysis.',
    patientTitle: 'Find My Best Treatment',
    patientDescription: 'These tests help your doctor decide the best treatment approach for you. They can analyze your tumor\'s characteristics to find specific treatments that may work best, or help determine if procedures like biopsies are necessary.',
    color: 'violet',
    tests: tdsTestData,
    sourceUrl: buildInfoSources.TDS || '',
    domain: DOMAINS.ONCO,
  },
  // CGP - Alias for TDS (Comprehensive Genomic Profiling is the new primary name)
  CGP: {
    title: 'Comprehensive Genomic Profiling',
    shortTitle: 'CGP Tests',
    description: 'Comprehensive Genomic Profiling (CGP) tests analyze tumor DNA and RNA to identify actionable mutations, guide treatment selection, and match patients to targeted therapies and clinical trials. These tests sequence hundreds of cancer-related genes to find alterations that can be targeted with FDA-approved drugs or emerging treatments.',
    patientTitle: 'Find My Best Treatment',
    patientDescription: 'These tests analyze your tumor to find genetic changes that can help your doctor choose the most effective treatment for you.',
    color: 'violet',
    tests: tdsTestData,  // Uses same data as TDS for now
    sourceUrl: buildInfoSources.TDS || '',
    domain: DOMAINS.ONCO,
  },
  // HCT - Hereditary Cancer Testing
  HCT: {
    title: 'Hereditary Cancer Testing',
    shortTitle: 'Hereditary Risk',
    description: 'Hereditary Cancer Testing identifies inherited gene mutations that increase cancer risk. These tests analyze germline DNA from blood or saliva to detect mutations in genes like BRCA1/2, Lynch syndrome genes (MLH1, MSH2, MSH6, PMS2), and others associated with hereditary cancer predisposition syndromes. Results help identify individuals who may benefit from enhanced screening, risk-reducing interventions, or cascade testing of family members.',
    patientTitle: 'Understand Your Cancer Risk',
    patientDescription: 'These tests look for inherited gene changes that may increase your risk of developing certain cancers, helping you and your family make informed decisions about screening and prevention.',
    color: 'purple',
    tests: hctTestData,
    sourceUrl: '',
    domain: DOMAINS.ONCO,
  },
});

export const getTestListByCategory = (categoryId) => {
  const categoryMap = {
    MRD: mrdTestData,
    ECD: ecdTestData,
    TRM: trmTestData,
    TDS: tdsTestData,
    CGP: tdsTestData,  // CGP uses same data as TDS
    HCT: hctTestData,  // Hereditary cancer testing
  };
  return categoryMap[categoryId] || [];
};

// ============================================
// Filter Configurations
// ============================================
// NOTE: Filter matching should use prefix/contains logic, not exact matching.
// Many fdaStatus and reimbursement values are verbose sentences. The filter
// options below represent categories that should match via prefix/contains:
//   - "CLIA LDT" matches "CLIA LDT - not FDA approved", "CLIA LDT – NOT FDA approved", etc.
//   - "Medicare" matches "Medicare (CRC only)", "Medicare LCD", "Medicare covered", etc.
//   - "FDA Approved" matches "FDA-approved", "FDA PMA-approved", "FDA De Novo cleared", etc.
// Future enhancement: Split into normalized category fields (e.g., fdaStatusCategory) 
// plus free-text notes fields (e.g., fdaStatusNotes) for cleaner filtering.
export const filterConfigs = {
  MRD: {
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(mrdTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: [...new Set(mrdTestData.map(t => t.sampleCategory || 'Blood/Plasma'))].sort(),
    fdaStatuses: ['FDA Approved', 'FDA Cleared', 'FDA Breakthrough', 'CLIA LDT', 'CE-IVD', 'RUO', 'Investigational'],
    reimbursements: ['Medicare', 'Commercial', 'Coverage Varies', 'Coverage emerging', 'Not established'],
    approaches: ['Tumor-informed', 'Tumor-naïve'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
    clinicalSettings: ['Neoadjuvant', 'Post-Surgery', 'Post-Adjuvant', 'Surveillance'],
  },
  ECD: {
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit', 'Self-Collection'],
    testScopes: ['Single-cancer', 'Multi-cancer'],  // Matches prefix of actual testScope values
    indicationGroups: [...new Set(ecdTestData.map(t => t.indicationGroup).filter(Boolean))].sort(),
    sampleCategories: ['Blood/Plasma', 'Saliva', 'Stool'],
    fdaStatuses: ['FDA Approved', 'FDA Cleared', 'FDA Breakthrough', 'CLIA LDT', 'CE-IVD', 'RUO', 'Investigational', 'PMA submitted'],
    reimbursements: ['Medicare', 'Commercial', 'Coverage Varies', 'Coverage emerging', 'Self-Pay', 'Not established'],
    approaches: ['Blood-based cfDNA screening (plasma)', 'Blood-based cfDNA methylation MCED (plasma)', 'Stool DNA + FIT'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
  },
  TRM: {
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(trmTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: ['Blood/Plasma'],
    fdaStatuses: ['FDA Approved', 'FDA Cleared', 'FDA Breakthrough', 'CLIA LDT', 'CE-IVD', 'RUO', 'Investigational'],
    approaches: ['Tumor-informed', 'Tumor-naïve', 'Tumor-agnostic'],
    reimbursements: ['Medicare', 'Commercial', 'Coverage Varies', 'Coverage emerging', 'Not established'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
  },
  TDS: {
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(tdsTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: [...new Set(tdsTestData.map(t => t.sampleCategory || 'Unknown'))].sort(),
    approaches: [...new Set(tdsTestData.map(t => t.approach || 'Unknown'))].sort(),
    fdaStatuses: ['FDA Approved', 'FDA Cleared', 'FDA Breakthrough', 'CLIA LDT', 'CE-IVD', 'NMPA', 'RUO'],
    reimbursements: ['Medicare', 'Commercial', 'Coverage Varies', 'Coverage emerging', 'Not established'],
  },
  // CGP - Uses same filter config as TDS (same data source)
  CGP: {
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(tdsTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: [...new Set(tdsTestData.map(t => t.sampleCategory || 'Unknown'))].sort(),
    approaches: [...new Set(tdsTestData.map(t => t.approach || 'Unknown'))].sort(),
    fdaStatuses: ['FDA Approved', 'FDA Cleared', 'FDA Breakthrough', 'CLIA LDT', 'CE-IVD', 'NMPA', 'RUO'],
    reimbursements: ['Medicare', 'Commercial', 'Coverage Varies', 'Coverage emerging', 'Not established'],
    // Key biomarkers for CGP filtering
    biomarkers: ['TMB', 'MSI', 'HRD', 'PD-L1', 'gLOH'],
  },
  // HCT - Hereditary Cancer Testing
  HCT: {
    productTypes: ['Central Lab Service'],
    syndromesDetected: [...new Set(hctTestData.flatMap(t => t.syndromesDetected || []))].sort(),
    cancerTypesAssessed: [...new Set(hctTestData.flatMap(t => t.cancerTypesAssessed || []))].sort(),
    sampleCategories: [...new Set(hctTestData.map(t => t.sampleCategory || 'Blood or Saliva'))].sort(),
    fdaStatuses: ['CLIA LDT'],
    reimbursements: ['Broad Coverage', 'Self-Pay / Employer'],
    geneRanges: ['1-30', '31-60', '61-100', '100+'],  // Gene count buckets
  },
};

// ============================================
// Comparison Parameters
// ============================================
export const comparisonParams = {
  MRD: [
    { key: 'productType', label: 'Product Type' },
    { key: 'platformRequired', label: 'Platform Required' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Cancer Types' },
    { key: 'clinicalSettingsStr', label: 'Clinical Settings' },
    { key: 'sensitivity', label: 'Reported Sensitivity (%)' },
    { key: 'sensitivityStagesReported', label: 'Stages in Headline' },
    { key: 'stageIISensitivity', label: 'Stage II Sensitivity (%)' },
    { key: 'stageIIISensitivity', label: 'Stage III Sensitivity (%)' },
    { key: 'landmarkSensitivity', label: 'Post-Surgery Sensitivity (%)' },
    { key: 'longitudinalSensitivity', label: 'Surveillance Sensitivity (%)' },
    { key: 'specificity', label: 'Reported Specificity (%)' },
    { key: 'analyticalSpecificity', label: 'Analytical Specificity (%)' },
    { key: 'clinicalSpecificity', label: 'Clinical Specificity (%)' },
    { key: 'lod', label: 'LOD (detection)' },
    { key: 'lod95', label: 'LOD95 (95% conf)' },
    { key: 'variantsTracked', label: 'Variants Tracked' },
    { key: 'sampleVolumeMl', label: 'Sample Volume (mL)' },
    { key: 'sampleTubeType', label: 'Collection Tube' },
    { key: 'sampleTubeCount', label: 'Tubes Required' },
    { key: 'cfdnaInput', label: 'cfDNA Input (ng)' },
    { key: 'initialTat', label: 'Initial TAT (days)' },
    { key: 'followUpTat', label: 'Follow-up TAT (days)' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
    { key: 'availableRegionsStr', label: 'Availability' },
  ],
  ECD: [
    { key: 'productType', label: 'Product Type' },
    { key: 'platformRequired', label: 'Platform Required' },
    { key: 'testScope', label: 'Scope' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'sensitivity', label: 'Reported Sensitivity (%)' },
    { key: 'stageISensitivity', label: 'Stage I Sens (%)' },
    { key: 'stageIISensitivity', label: 'Stage II Sens (%)' },
    { key: 'stageIIISensitivity', label: 'Stage III Sens (%)' },
    { key: 'stageIVSensitivity', label: 'Stage IV Sens (%)' },
    { key: 'specificity', label: 'Reported Specificity (%)' },
    { key: 'ppv', label: 'PPV (%)' },
    { key: 'npv', label: 'NPV (%)' },
    { key: 'tumorOriginAccuracy', label: 'Origin Prediction (%)' },
    { key: 'leadTimeNotes', label: 'Lead Time vs Screening' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
    { key: 'availableRegionsStr', label: 'Availability' },
    { key: 'clinicalAvailability', label: 'Clinical Availability' },
    { key: 'tat', label: 'Turnaround Time' },
    { key: 'sampleType', label: 'Sample Details' },
    { key: 'listPrice', label: 'List Price (USD)' },
    { key: 'screeningInterval', label: 'Screening Interval' },
    { key: 'cptCode', label: 'CPT Code' },
    { key: 'performanceCitations', label: 'Citations' },
    { key: 'performanceNotes', label: 'Performance Notes' },
  ],
  TRM: [
    { key: 'productType', label: 'Product Type' },
    { key: 'platformRequired', label: 'Platform Required' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'responseDefinition', label: 'Response Definition' },
    { key: 'leadTimeVsImaging', label: 'Lead Time (days)' },
    { key: 'lod', label: 'LOD (detection)' },
    { key: 'lod95', label: 'LOD95 (95% conf)' },
    { key: 'sensitivity', label: 'Reported Sensitivity (%)' },
    { key: 'specificity', label: 'Reported Specificity (%)' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
    { key: 'availableRegionsStr', label: 'Availability' },
  ],
  TDS: [
    { key: 'productType', label: 'Product Type' },
    { key: 'platformRequired', label: 'Platform Required' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'genesAnalyzed', label: 'Genes Analyzed' },
    { key: 'biomarkersReportedStr', label: 'Biomarkers Reported' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'fdaCompanionDxCount', label: 'FDA CDx Indications' },
    { key: 'nccnRecommended', label: 'NCCN Recommended' },
    { key: 'tat', label: 'Turnaround Time' },
    { key: 'sampleRequirements', label: 'Sample Requirements' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'listPrice', label: 'List Price (USD)' },
  ],
  // CGP - Uses same comparison params as TDS
  CGP: [
    { key: 'productType', label: 'Product Type' },
    { key: 'platformRequired', label: 'Platform Required' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'genesAnalyzed', label: 'Genes Analyzed' },
    { key: 'biomarkersReportedStr', label: 'Biomarkers Reported' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'fdaCompanionDxCount', label: 'FDA CDx Indications' },
    { key: 'nccnRecommended', label: 'NCCN Recommended' },
    { key: 'tat', label: 'Turnaround Time' },
    { key: 'sampleRequirements', label: 'Sample Requirements' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'listPrice', label: 'List Price (USD)' },
  ],
  // HCT - Hereditary Cancer Testing params
  HCT: [
    { key: 'productType', label: 'Product Type' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'genesAnalyzed', label: 'Genes Analyzed' },
    { key: 'keyGenesStr', label: 'Key Genes' },
    { key: 'syndromesDetectedStr', label: 'Syndromes Detected' },
    { key: 'cancerTypesAssessedStr', label: 'Cancers Assessed' },
    { key: 'analyticalSensitivity', label: 'Analytical Sensitivity (%)' },
    { key: 'analyticalSpecificity', label: 'Analytical Specificity (%)' },
    { key: 'deletionDuplicationAnalysis', label: 'Del/Dup Analysis' },
    { key: 'geneticCounselingIncluded', label: 'Genetic Counseling' },
    { key: 'cascadeTestingOffered', label: 'Cascade Testing' },
    { key: 'variantReclassificationPolicy', label: 'VUS Reclassification' },
    { key: 'tat', label: 'Turnaround Time' },
    { key: 'selfPayPrice', label: 'Self-Pay Price (USD)' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Coverage' },
    { key: 'nyApproved', label: 'NY Approved' },
  ],
};

// ============================================
// External Resources & Interlinking
// ============================================
// Authoritative external resources for each category
// Used for category page resource sections and glossary tooltips

export const STANDARDS_BODIES = {
  BLOODPAC: {
    name: 'Blood Profiling Atlas in Cancer (BLOODPAC)',
    shortName: 'BLOODPAC',
    description: 'Cancer Moonshot consortium focused on liquid biopsy standards and data sharing',
    url: 'https://www.bloodpac.org',
    logo: null
  },
  FRIENDS: {
    name: 'Friends of Cancer Research',
    shortName: 'Friends of Cancer Research',
    description: 'Non-profit advancing regulatory science and patient-focused drug development',
    url: 'https://friendsofcancerresearch.org',
    logo: null
  },
  NCI: {
    name: 'National Cancer Institute',
    shortName: 'NCI',
    description: 'U.S. federal government\'s principal agency for cancer research',
    url: 'https://www.cancer.gov',
    logo: null
  },
  FDA: {
    name: 'U.S. Food and Drug Administration',
    shortName: 'FDA',
    description: 'Federal agency responsible for protecting public health through regulation of medical devices',
    url: 'https://www.fda.gov',
    logo: null
  },
  NCCN: {
    name: 'National Comprehensive Cancer Network',
    shortName: 'NCCN',
    description: 'Alliance of cancer centers developing clinical practice guidelines',
    url: 'https://www.nccn.org',
    logo: null
  },
  LUNGEVITY: {
    name: 'LUNGevity Foundation',
    shortName: 'LUNGevity',
    description: 'Lung cancer patient advocacy and research organization',
    url: 'https://www.lungevity.org',
    logo: null
  },
  ILSA: {
    name: 'International Liquid Biopsy Standardization Alliance',
    shortName: 'ILSA',
    description: 'FNIH-hosted global alliance for liquid biopsy standardization',
    url: 'https://fnih.org/our-programs/international-liquid-biopsy-standardization-alliance-ilsa/',
    logo: null
  },
  ASCO: {
    name: 'American Society of Clinical Oncology',
    shortName: 'ASCO',
    description: 'Professional organization for physicians and oncology professionals',
    url: 'https://www.asco.org',
    logo: null
  }
};

export const EXTERNAL_RESOURCES = {
  // General resources applicable across categories
  general: [
    {
      id: 'nci-liquid-biopsy',
      title: 'What Is a Liquid Biopsy?',
      source: 'NCI',
      type: 'definition',
      audience: ['patient', 'clinician'],
      url: 'https://www.cancer.gov/publications/dictionaries/cancer-terms/def/liquid-biopsy',
      description: 'Patient-friendly definition of liquid biopsy from the National Cancer Institute'
    },
    {
      id: 'nci-ctdna',
      title: 'Circulating Tumor DNA (ctDNA)',
      source: 'NCI',
      type: 'definition',
      audience: ['patient', 'clinician'],
      url: 'https://www.cancer.gov/publications/dictionaries/cancer-terms/def/ctdna',
      description: 'NCI dictionary definition of ctDNA'
    },
    {
      id: 'nci-liquid-biopsy-blog',
      title: 'Liquid Biopsy: Using DNA in Blood to Detect, Track, and Treat Cancer',
      source: 'NCI',
      type: 'overview',
      audience: ['patient'],
      url: 'https://www.cancer.gov/news-events/cancer-currents-blog/2017/liquid-biopsy-detects-treats-cancer',
      description: 'Comprehensive overview of liquid biopsy applications in cancer care'
    },
    {
      id: 'ilsa-overview',
      title: 'International Liquid Biopsy Standardization Alliance',
      source: 'ILSA',
      type: 'standards',
      audience: ['clinician', 'researcher'],
      url: 'https://fnih.org/our-programs/international-liquid-biopsy-standardization-alliance-ilsa/',
      description: 'Global effort to standardize liquid biopsy testing and reporting'
    }
  ],
  
  // MRD-specific resources
  MRD: [
    {
      id: 'bloodpac-mrd-lexicon',
      title: 'BLOODPAC MRD Terminology Lexicon',
      source: 'BLOODPAC',
      type: 'standards',
      audience: ['clinician', 'researcher'],
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/',
      description: 'Standardized terminology for MRD testing including tumor-informed, tumor-naïve, and molecular response definitions',
      isPrimary: true
    },
    {
      id: 'fda-ctdna-guidance',
      title: 'FDA Guidance: Use of ctDNA in Early-Stage Solid Tumors',
      source: 'FDA',
      type: 'regulatory',
      audience: ['clinician', 'researcher'],
      url: 'https://www.fda.gov/media/183874/download',
      description: 'December 2024 FDA guidance on ctDNA for patient enrichment and response endpoints',
      isPrimary: true
    },
    {
      id: 'friends-ctdna',
      title: 'ctDNA as a Clinical Endpoint',
      source: 'FRIENDS',
      type: 'research',
      audience: ['clinician', 'researcher'],
      url: 'https://friendsofcancerresearch.org/ctdna/',
      description: 'ctMoniTR project validating ctDNA as an early efficacy endpoint'
    },
    {
      id: 'friends-ctdna-definition',
      title: 'Circulating Tumor DNA Definition',
      source: 'FRIENDS',
      type: 'definition',
      audience: ['clinician'],
      url: 'https://friendsofcancerresearch.org/glossary-term/circulating-tumor-dna-ctdna/',
      description: 'Technical definition of ctDNA from Friends of Cancer Research'
    },
    {
      id: 'bloodpac-working-groups',
      title: 'BLOODPAC Working Groups',
      source: 'BLOODPAC',
      type: 'standards',
      audience: ['researcher'],
      url: 'https://www.bloodpac.org/how-we-work',
      description: 'Overview of BLOODPAC working groups developing liquid biopsy standards'
    }
  ],
  
  // ECD-specific resources
  ECD: [
    {
      id: 'nci-lbc',
      title: 'NCI Liquid Biopsy Consortium',
      source: 'NCI',
      type: 'research',
      audience: ['clinician', 'researcher'],
      url: 'https://prevention.cancer.gov/research-areas/networks-consortia-programs/lbc',
      description: 'NCI-funded consortium focused on early cancer detection research',
      isPrimary: true
    },
    {
      id: 'nci-ctdna-sensitivity',
      title: 'Increasing ctDNA Detection in Blood',
      source: 'NCI',
      type: 'research',
      audience: ['clinician', 'researcher'],
      url: 'https://www.cancer.gov/news-events/cancer-currents-blog/2024/liquid-biopsy-increase-ctdna-in-blood',
      description: 'Research on improving liquid biopsy sensitivity for early detection'
    },
    {
      id: 'lungevity-biomarker',
      title: 'Biomarker Testing for Lung Cancer',
      source: 'LUNGEVITY',
      type: 'patient-education',
      audience: ['patient'],
      url: 'https://www.lungevity.org/patients-care-partners/navigating-your-diagnosis/biomarker-testing',
      description: 'Patient guide to understanding biomarker and liquid biopsy testing',
      isPrimary: true
    },
    {
      id: 'lungevity-booklet',
      title: 'Biomarker Testing Booklet (PDF)',
      source: 'LUNGEVITY',
      type: 'patient-education',
      audience: ['patient'],
      url: 'https://www.lungevity.org/sites/default/files/request-materials/LUNGevity-biomarker-testing-booklet-112817.pdf',
      description: 'Downloadable patient education booklet on biomarker testing'
    },
    {
      id: 'noonemissed',
      title: 'No One Missed Campaign',
      source: 'LUNGEVITY',
      type: 'patient-education',
      audience: ['patient'],
      url: 'https://noonemissed.org/lungcancer/us',
      description: 'Campaign ensuring all lung cancer patients receive biomarker testing'
    }
  ],
  
  // TRM-specific resources
  TRM: [
    {
      id: 'friends-ctmonitr',
      title: 'ctMoniTR: ctDNA Monitoring for Treatment Response',
      source: 'FRIENDS',
      type: 'research',
      audience: ['clinician', 'researcher'],
      url: 'https://friendsofcancerresearch.org/ctdna/',
      description: 'Multi-stakeholder project validating ctDNA as an early efficacy endpoint',
      isPrimary: true
    },
    {
      id: 'friends-evidentiary-roadmap',
      title: 'Evidentiary Framework for ctDNA',
      source: 'FRIENDS',
      type: 'regulatory',
      audience: ['researcher'],
      url: 'https://friendsofcancerresearch.org/wp-content/uploads/Framework-for-Integrating-Change-in-ctDNA-Levels-as-an-Efficacy-Measure-on-Oncology-Clinical-Trials.pdf',
      description: 'Framework for integrating ctDNA changes as efficacy measures in clinical trials'
    },
    {
      id: 'progress-for-patients',
      title: 'Progress for Patients',
      source: 'FRIENDS',
      type: 'patient-education',
      audience: ['patient'],
      url: 'https://progressforpatients.org',
      description: 'Patient-focused information on cancer treatment advances'
    },
    {
      id: 'fda-ctdna-trm',
      title: 'FDA Guidance: ctDNA for Treatment Response',
      source: 'FDA',
      type: 'regulatory',
      audience: ['clinician', 'researcher'],
      url: 'https://www.fda.gov/media/183874/download',
      description: 'FDA guidance on using ctDNA to measure treatment response'
    }
  ],
  
  // TDS-specific resources
  TDS: [
    {
      id: 'nccn-guidelines',
      title: 'NCCN Clinical Practice Guidelines',
      source: 'NCCN',
      type: 'guidelines',
      audience: ['clinician'],
      url: 'https://www.nccn.org/guidelines/guidelines-detail',
      description: 'Evidence-based clinical practice guidelines for oncology',
      isPrimary: true
    },
    {
      id: 'fda-cdx-list',
      title: 'FDA List of Cleared or Approved Companion Diagnostics',
      source: 'FDA',
      type: 'regulatory',
      audience: ['clinician', 'researcher'],
      url: 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/list-cleared-or-approved-companion-diagnostic-devices-in-vitro-and-imaging-tools',
      description: 'Complete list of FDA-approved companion diagnostic devices'
    },
    {
      id: 'asco-cgp',
      title: 'Comprehensive Genomic Profiling Education',
      source: 'ASCO',
      type: 'education',
      audience: ['clinician'],
      url: 'https://ascopubs.org/doi/10.1200/EDBK-25-481114',
      description: 'ASCO educational resources on CGP testing and interpretation'
    },
    {
      id: 'lungevity-clinical-value',
      title: 'Clinical Value of Biomarker Testing',
      source: 'LUNGEVITY',
      type: 'patient-education',
      audience: ['patient'],
      url: 'https://www.lungevity.org/learn-about-lungevity/precision-medicine/clinical-value-of-biomarker-testing-in-nsclc',
      description: 'Patient guide to understanding the clinical value of biomarker testing'
    }
  ],
  
  // CGP - Uses same resources as TDS
  CGP: [
    {
      id: 'nccn-guidelines',
      title: 'NCCN Clinical Practice Guidelines',
      source: 'NCCN',
      type: 'guidelines',
      audience: ['clinician'],
      url: 'https://www.nccn.org/guidelines/guidelines-detail',
      description: 'Evidence-based clinical practice guidelines for oncology',
      isPrimary: true
    },
    {
      id: 'fda-cdx-list',
      title: 'FDA List of Cleared or Approved Companion Diagnostics',
      source: 'FDA',
      type: 'regulatory',
      audience: ['clinician', 'researcher'],
      url: 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/list-cleared-or-approved-companion-diagnostic-devices-in-vitro-and-imaging-tools',
      description: 'Complete list of FDA-approved companion diagnostic devices'
    },
    {
      id: 'asco-cgp',
      title: 'Comprehensive Genomic Profiling Education',
      source: 'ASCO',
      type: 'education',
      audience: ['clinician'],
      url: 'https://ascopubs.org/doi/10.1200/EDBK-25-481114',
      description: 'ASCO educational resources on CGP testing and interpretation'
    }
  ],
  
  // HCT - Hereditary Cancer Testing resources (placeholder)
  HCT: []
};

// Glossary of terms with authoritative source links
export const GLOSSARY = {
  'liquid-biopsy': {
    term: 'Liquid Biopsy',
    definition: 'A test done on a sample of blood to look for cancer cells or pieces of DNA from tumor cells that are circulating in the blood.',
    shortDefinition: 'Blood test that detects cancer DNA or cells',
    sourceUrl: 'https://www.cancer.gov/publications/dictionaries/cancer-terms/def/liquid-biopsy',
    source: 'NCI',
    relatedTerms: ['ctDNA', 'cfDNA', 'CTC']
  },
  'ctdna': {
    term: 'Circulating Tumor DNA (ctDNA)',
    definition: 'Small pieces of DNA that are released into the bloodstream when cancer cells die. ctDNA carries the same genetic alterations as the tumor.',
    shortDefinition: 'Tumor DNA fragments in blood',
    sourceUrl: 'https://www.cancer.gov/publications/dictionaries/cancer-terms/def/ctdna',
    source: 'NCI',
    relatedTerms: ['liquid-biopsy', 'cfDNA', 'VAF']
  },
  'cfdna': {
    term: 'Cell-Free DNA (cfDNA)',
    definition: 'DNA fragments circulating freely in the bloodstream, released from both normal and tumor cells. In cancer patients, a portion derives from tumor cells (ctDNA).',
    shortDefinition: 'Free-floating DNA in blood',
    sourceUrl: 'https://friendsofcancerresearch.org/glossary-term/circulating-tumor-dna-ctdna/',
    source: 'Friends of Cancer Research',
    relatedTerms: ['ctDNA', 'liquid-biopsy']
  },
  'mrd': {
    term: 'Molecular Residual Disease (MRD)',
    definition: 'Cancer that remains after treatment at levels too low to detect with standard imaging or laboratory tests, but detectable through sensitive molecular methods.',
    shortDefinition: 'Remaining cancer detected by molecular tests',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/',
    source: 'BLOODPAC',
    relatedTerms: ['tumor-informed', 'tumor-naive', 'ctDNA']
  },
  'tumor-informed': {
    term: 'Tumor-Informed Assay',
    definition: 'An MRD testing approach that first sequences the patient\'s tumor to identify specific mutations, then designs a personalized test to track those mutations in blood.',
    shortDefinition: 'Personalized test based on tumor sequencing',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/',
    source: 'BLOODPAC',
    relatedTerms: ['mrd', 'tumor-naive']
  },
  'tumor-naive': {
    term: 'Tumor-Naïve Assay',
    definition: 'An MRD testing approach that uses a fixed panel of common cancer genes without requiring prior tumor sequencing. Faster turnaround but generally less sensitive than tumor-informed approaches.',
    shortDefinition: 'Fixed panel test without prior tumor analysis',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/',
    source: 'BLOODPAC',
    relatedTerms: ['mrd', 'tumor-informed']
  },
  'vaf': {
    term: 'Variant Allele Frequency (VAF)',
    definition: 'The percentage of sequencing reads containing a specific mutation. In ctDNA testing, VAF reflects the proportion of mutant DNA fragments in the sample.',
    shortDefinition: 'Percentage of DNA with a specific mutation',
    sourceUrl: 'https://friendsofcancerresearch.org/glossary-term/circulating-tumor-dna-ctdna/',
    source: 'Friends of Cancer Research',
    relatedTerms: ['ctDNA', 'lod']
  },
  'lod': {
    term: 'Limit of Detection (LOD)',
    definition: 'The lowest concentration of ctDNA that can be reliably detected by a test. Often expressed as VAF (e.g., 0.01%) or parts per million (ppm).',
    shortDefinition: 'Lowest detectable ctDNA level',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/',
    source: 'BLOODPAC',
    relatedTerms: ['vaf', 'sensitivity']
  },
  'sensitivity': {
    term: 'Sensitivity',
    definition: 'The ability of a test to correctly identify patients who have the condition (true positive rate). A test with 90% sensitivity will detect 90 out of 100 patients with cancer.',
    shortDefinition: 'Ability to detect true positives',
    sourceUrl: 'https://www.cancer.gov/publications/dictionaries/cancer-terms/def/sensitivity',
    source: 'NCI',
    relatedTerms: ['specificity', 'ppv', 'npv']
  },
  'specificity': {
    term: 'Specificity',
    definition: 'The ability of a test to correctly identify patients who do not have the condition (true negative rate). A test with 99% specificity will correctly rule out 99 of 100 patients without cancer.',
    shortDefinition: 'Ability to avoid false positives',
    sourceUrl: 'https://www.cancer.gov/publications/dictionaries/cancer-terms/def/specificity',
    source: 'NCI',
    relatedTerms: ['sensitivity', 'ppv', 'npv']
  },
  'ngs': {
    term: 'Next-Generation Sequencing (NGS)',
    definition: 'High-throughput DNA sequencing technology that can analyze millions of DNA fragments simultaneously, enabling comprehensive genomic profiling.',
    shortDefinition: 'High-throughput DNA sequencing',
    sourceUrl: 'https://www.cancer.gov/publications/dictionaries/cancer-terms/def/next-generation-sequencing',
    source: 'NCI',
    relatedTerms: ['cgp', 'ctDNA']
  },
  'cgp': {
    term: 'Comprehensive Genomic Profiling (CGP)',
    definition: 'A type of NGS test that analyzes hundreds of genes simultaneously to identify mutations, fusions, and other alterations that may guide treatment decisions.',
    shortDefinition: 'Broad cancer gene panel test',
    sourceUrl: 'https://ascopubs.org/doi/10.1200/EDBK-25-481114',
    source: 'ASCO',
    relatedTerms: ['ngs', 'companion-dx']
  },
  'companion-dx': {
    term: 'Companion Diagnostic (CDx)',
    definition: 'An FDA-approved test that is essential for the safe and effective use of a corresponding drug or biological product, typically identifying patients likely to benefit from a specific therapy.',
    shortDefinition: 'Test linked to specific drug approval',
    sourceUrl: 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/companion-diagnostics',
    source: 'FDA',
    relatedTerms: ['cgp', 'targeted-therapy']
  },
  'methylation': {
    term: 'DNA Methylation',
    definition: 'A chemical modification of DNA that can affect gene expression. Cancer-specific methylation patterns in cfDNA are used by some early detection tests to identify cancer signals.',
    shortDefinition: 'Chemical DNA modification used in cancer detection',
    sourceUrl: 'https://www.cancer.gov/publications/dictionaries/cancer-terms/def/dna-methylation',
    source: 'NCI',
    relatedTerms: ['cfDNA', 'ecd']
  },
  'chip': {
    term: 'Clonal Hematopoiesis of Indeterminate Potential (CHIP)',
    definition: 'Age-related mutations in blood cells that can be confused with tumor-derived mutations in liquid biopsy tests. Advanced assays use various methods to filter out CHIP.',
    shortDefinition: 'Age-related blood cell mutations that can confound testing',
    sourceUrl: 'https://www.cancer.gov/publications/dictionaries/cancer-terms/def/chip',
    source: 'NCI',
    relatedTerms: ['ctDNA', 'cfDNA']
  },
  'nccn': {
    term: 'National Comprehensive Cancer Network (NCCN)',
    definition: 'An alliance of leading cancer centers that develops clinical practice guidelines used by oncologists worldwide. NCCN guidelines recommend specific biomarkers to test for, though they do not endorse specific commercial assays.',
    shortDefinition: 'Alliance developing cancer treatment guidelines',
    sourceUrl: 'https://www.nccn.org/guidelines/guidelines-detail',
    source: 'NCCN',
    relatedTerms: ['companion-dx', 'cgp']
  },
  'fda-approved': {
    term: 'FDA Approved/Cleared',
    definition: 'Tests that have been reviewed by the FDA and meet analytical and clinical validation requirements. FDA-approved companion diagnostics (CDx) are linked to specific drug therapies.',
    shortDefinition: 'Test reviewed and authorized by FDA',
    sourceUrl: 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/companion-diagnostics',
    source: 'FDA',
    relatedTerms: ['companion-dx', 'ldt']
  },
  'ldt': {
    term: 'Laboratory Developed Test (LDT)',
    definition: 'A test developed and validated by an individual CLIA-certified laboratory rather than a commercial manufacturer. LDTs must meet CLIA quality standards but have not undergone FDA premarket review.',
    shortDefinition: 'Test developed by individual lab, not FDA-reviewed',
    sourceUrl: 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/laboratory-developed-tests',
    source: 'FDA',
    relatedTerms: ['fda-approved']
  },
  'ctdna-clearance': {
    term: 'ctDNA Clearance',
    definition: 'The transition from detectable to undetectable ctDNA levels, typically measured after treatment. Per BLOODPAC: clearance indicates molecular response but does not guarantee absence of disease.',
    shortDefinition: 'Transition from detectable to undetectable ctDNA',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/',
    source: 'BLOODPAC',
    relatedTerms: ['mrd', 'molecular-response']
  },
  'molecular-response': {
    term: 'Molecular Response',
    definition: 'A measurable change in ctDNA levels following treatment. Per BLOODPAC MRD Lexicon: can be quantified as fold-change, percent reduction, or transition between detectable/undetectable states.',
    shortDefinition: 'Measurable ctDNA change after treatment',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/',
    source: 'BLOODPAC',
    relatedTerms: ['ctdna-clearance', 'mrd']
  },
  'bloodpac': {
    term: 'BLOODPAC (Blood Profiling Atlas in Cancer)',
    definition: 'A Cancer Moonshot consortium of 30+ organizations developing standards for liquid biopsy testing. Published the MRD Terminology Lexicon in 2025 to standardize definitions across the field.',
    shortDefinition: 'Consortium developing liquid biopsy standards',
    sourceUrl: 'https://www.bloodpac.org',
    source: 'BLOODPAC',
    relatedTerms: ['mrd', 'ctDNA', 'liquid-biopsy']
  }
};

// Category-specific standards attribution for display
export const CATEGORY_STANDARDS = {
  MRD: {
    primary: 'BLOODPAC MRD Lexicon',
    primaryUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11897061/',
    secondary: 'FDA ctDNA Guidance (Dec 2024)',
    secondaryUrl: 'https://www.fda.gov/media/183874/download',
    attribution: 'Terminology aligned with BLOODPAC Consortium MRD Lexicon'
  },
  ECD: {
    primary: 'NCI Liquid Biopsy Consortium',
    primaryUrl: 'https://prevention.cancer.gov/research-areas/networks-consortia-programs/lbc',
    secondary: 'LUNGevity Foundation',
    secondaryUrl: 'https://www.lungevity.org/patients-care-partners/navigating-your-diagnosis/biomarker-testing',
    attribution: 'Patient resources from LUNGevity Foundation'
  },
  TRM: {
    primary: 'Friends of Cancer Research ctMoniTR',
    primaryUrl: 'https://friendsofcancerresearch.org/ctdna/',
    secondary: 'FDA ctDNA Guidance',
    secondaryUrl: 'https://www.fda.gov/media/183874/download',
    attribution: 'Endpoint validation research from Friends of Cancer Research'
  },
  TDS: {
    primary: 'NCCN Clinical Practice Guidelines',
    primaryUrl: 'https://www.nccn.org/guidelines/guidelines-detail',
    secondary: 'FDA Companion Diagnostics',
    secondaryUrl: 'https://www.fda.gov/medical-devices/in-vitro-diagnostics/companion-diagnostics',
    attribution: 'NCCN guideline-referenced'
  }
};

// ============================================
// SEO Configuration
// ============================================
export const SEO_DEFAULTS = {
  siteName: 'OpenOnco',
  siteUrl: 'https://openonco.org',
  defaultDescription: 'Compare cancer diagnostic tests side-by-side. Independent, transparent data on MRD, early detection, and treatment monitoring tests.',
  defaultImage: 'https://openonco.org/og-image.png',
};

export const PAGE_SEO = {
  home: {
    title: 'Compare Cancer Diagnostic Tests',
    description: 'Independent database comparing 60+ cancer blood tests. MRD, early detection, treatment monitoring - all specs side-by-side.',
    path: '/'
  },
  competitions: {
    title: 'OpenOnco Competitions - Data Completeness Rankings',
    description: 'Vendor data completeness rankings and recognition. See which cancer diagnostic tests have complete, transparent data.',
    path: '/competitions'
  },
  // Primary categories with new plain-language URLs
  MRD: {
    title: 'Cancer Monitoring Tests - MRD & Recurrence Detection',
    description: 'Compare 20+ MRD tests: Signatera, Guardant Reveal, clonoSEQ, Oncodetect. Sensitivity, turnaround time, Medicare coverage.',
    path: '/monitor'
  },
  ECD: {
    title: 'Cancer Screening Tests - Early Detection',
    description: 'Compare early cancer detection tests: Galleri, Shield, CancerSEEK. Multi-cancer screening sensitivity and specificity data.',
    path: '/screen'
  },
  CGP: {
    title: 'Treatment Selection Tests - CGP & Genomic Profiling',
    description: 'Compare comprehensive genomic profiling tests: FoundationOne, Tempus xT, Guardant360. Genes analyzed, FDA companion diagnostics.',
    path: '/treat'
  },
  HCT: {
    title: 'Hereditary Cancer Tests - Genetic Risk Assessment',
    description: 'Compare hereditary cancer risk tests. BRCA, Lynch syndrome, and multi-gene panel testing for inherited cancer predisposition.',
    path: '/risk'
  },
  // Legacy category aliases (backward compatibility)
  TRM: {
    title: 'Cancer Monitoring Tests - MRD & Recurrence Detection',
    description: 'Compare ctDNA tests for tracking cancer treatment response. Lead time vs imaging, sensitivity, clinical validation.',
    path: '/monitor'
  },
  TDS: {
    title: 'Treatment Selection Tests - CGP & Genomic Profiling',
    description: 'Compare comprehensive genomic profiling tests: FoundationOne, Tempus xT, Guardant360. Genes analyzed, FDA companion diagnostics.',
    path: '/treat'
  },
  evidence: {
    title: 'Evidence Explorer - Peer-Reviewed Cancer Diagnostic Evidence',
    description: 'Search peer-reviewed clinical evidence on MRD testing, ctDNA, and liquid biopsy. Every claim traces to a PubMed citation.',
    path: '/evidence'
  },
  learn: {
    title: 'Learn About Cancer Blood Tests',
    description: 'Educational guides on liquid biopsy, MRD testing, early cancer detection, and how to interpret test results.',
    path: '/learn'
  },
  about: {
    title: 'About OpenOnco',
    description: 'OpenOnco is a non-profit cancer diagnostic test database built in memory of Ingrid. Our mission is transparent, independent test comparison.',
    path: '/about'
  },
  faq: {
    title: 'Frequently Asked Questions',
    description: 'Common questions about cancer blood tests, liquid biopsy, MRD testing, and how to use OpenOnco.',
    path: '/faq'
  },
  'how-it-works': {
    title: 'How OpenOnco Works',
    description: 'Learn how OpenOnco collects, curates, and presents cancer diagnostic test data.',
    path: '/how-it-works'
  },
  'data-sources': {
    title: 'Data Sources',
    description: 'OpenOnco data sources including FDA filings, peer-reviewed publications, and vendor documentation.',
    path: '/data-sources'
  },
  submissions: {
    title: 'Submit Data or Feedback',
    description: 'Submit corrections, new test data, or feedback to improve OpenOnco.',
    path: '/submissions'
  },
};

// ============================================
// URL Utilities
// ============================================

// Category code to URL path mapping (new plain-language URLs)
const categoryToPath = {
  MRD: 'monitor',
  ECD: 'screen',
  CGP: 'treat',
  HCT: 'risk',
  // Legacy mappings
  TRM: 'monitor',
  TDS: 'treat',
};

export const slugify = (text) =>
  text.toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const getTestUrl = (test, category) => {
  // Use explicit slug if defined, otherwise generate from name
  const slug = test.slug || slugify(test.name);
  const urlPath = categoryToPath[category] || category.toLowerCase();
  return `/${urlPath}/${slug}`;
};

export const getTestBySlug = (slug, category) => {
  const categoryMap = {
    MRD: mrdTestData,
    ECD: ecdTestData,
    TRM: trmTestData,  // Legacy: maps to MRD data eventually
    TDS: tdsTestData,  // Legacy: maps to CGP data eventually
    CGP: tdsTestData,  // CGP uses TDS data array
    HCT: [],           // New category, empty for now
  };
  const tests = categoryMap[category] || [];
  // Check explicit slug field first, then fall back to slugified name
  return tests.find(t => (t.slug || slugify(t.name)) === slug);
};

export const getAbsoluteUrl = (path) => `${SEO_DEFAULTS.siteUrl}${path}`;

// ============================================
// Structured Data Generators (JSON-LD)
// ============================================
export const generateTestSchema = (test, category) => {
  const categoryLabels = {
    MRD: 'Cancer Monitoring & Residual Disease Test',
    ECD: 'Early Cancer Detection Test',
    CGP: 'Comprehensive Genomic Profiling Test',
    HCT: 'Hereditary Cancer Risk Test',
    // Legacy aliases
    TRM: 'Cancer Monitoring & Residual Disease Test',
    TDS: 'Comprehensive Genomic Profiling Test'
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalTest',
    '@id': getAbsoluteUrl(getTestUrl(test, category)),
    name: test.name,
    alternateName: test.id,
    description: test.indicationsNotes || test.method,
    manufacturer: {
      '@type': 'Organization',
      name: test.vendor
    },
    usedToDiagnose: (test.cancerTypes || []).join(', '),
    relevantSpecialty: {
      '@type': 'MedicalSpecialty',
      name: 'Oncology'
    },
    medicineSystem: 'WesternConventional',
    ...(test.sensitivity && { sensitivityValue: `${test.sensitivity}%` }),
    ...(test.specificity && { specificityValue: `${test.specificity}%` }),
    ...(test.fdaStatus && {
      recognizingAuthority: {
        '@type': 'Organization',
        name: test.fdaStatus.includes('FDA') ? 'FDA' : 'CLIA'
      }
    })
  };
};

export const generateCategorySchema = (category, tests) => {
  const seo = PAGE_SEO[category] || PAGE_SEO.home;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${seo.title}`,
    description: seo.description,
    numberOfItems: tests.length,
    itemListElement: tests.slice(0, 10).map((test, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'MedicalTest',
        '@id': getAbsoluteUrl(getTestUrl(test, category)),
        name: test.name,
        manufacturer: {
          '@type': 'Organization',
          name: test.vendor
        }
      }
    }))
  };
};

export const generateOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'NonProfit',
  name: 'OpenOnco',
  url: SEO_DEFAULTS.siteUrl,
  logo: `${SEO_DEFAULTS.siteUrl}/og-image.png`,
  description: 'Non-profit cancer diagnostic test database providing independent, transparent test comparison.',
  foundingDate: '2024',
});

export const generateFAQSchema = (faqs) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer
    }
  }))
});

// ============================================
// Data Access Layer (DAL)
// ============================================
// The DAL provides an abstraction layer for data access.
// Use dal.* repository methods for async queries that will work
// unchanged when the backend migrates to a database.

import { initializeDAL } from './dal/index.js';

/**
 * Initialized Data Access Layer instance
 * Use this for all new code instead of directly accessing arrays
 *
 * @example
 * import { dal } from './data';
 *
 * // Find tests by category
 * const { data: mrdTests } = await dal.tests.findByCategory('MRD');
 *
 * // Find a test by ID
 * const test = await dal.tests.findById('mrd-1');
 *
 * // Search tests
 * const { data: results } = await dal.tests.search('signatera');
 *
 * // Get stats
 * const stats = await dal.tests.getStats();
 *
 * // Access changelog
 * const { data: changelog } = await dal.changelog.findAll();
 * const recentChanges = await dal.changelog.getRecentChanges(10);
 *
 * // Access vendors
 * const vendor = await dal.vendors.findByName('Natera');
 * const program = await dal.vendors.getAssistanceProgram('Natera');
 *
 * // Access insurance providers
 * const { data: providers } = await dal.insurance.findAll();
 *
 * // Access glossary
 * const term = await dal.glossary.findById('ctdna');
 */
export const dal = initializeDAL({
  // Test data
  mrdTestData,
  ecdTestData,
  trmTestData,
  cgpTestData,
  hctTestData,
  // Changelog
  changelogData: DATABASE_CHANGELOG,
  // Vendor data
  vendorVerified: VENDOR_VERIFIED,
  companyContributions: COMPANY_CONTRIBUTIONS,
  assistancePrograms: VENDOR_ASSISTANCE_PROGRAMS,
  // Insurance
  insuranceProviders: INSURANCE_PROVIDERS,
  payerNameToId: PAYER_NAME_TO_ID,
  // Glossary
  glossary: GLOSSARY,
});
