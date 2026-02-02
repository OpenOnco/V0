/**
 * Oncology Terms Ontology
 * Centralized configuration for cancer types, MRD terms, and synonyms
 * Used by prefilter, triage, and search components
 */

/**
 * Cancer Type Ontology
 * Maps canonical names to synonyms and ICD-10 codes
 */
export const CANCER_TYPE_ONTOLOGY = {
  colorectal: {
    canonical: 'colorectal',
    displayName: 'Colorectal Cancer',
    synonyms: [
      'colorectal', 'colon', 'rectal', 'crc',
      'colorectal cancer', 'colon cancer', 'rectal cancer',
      'colorectal carcinoma', 'adenocarcinoma of the colon',
      'sigmoid', 'cecal', 'ascending colon', 'descending colon',
      'transverse colon', 'rectosigmoid',
    ],
    icd10: ['C18', 'C19', 'C20'],
    nccnGuideline: 'nccn-colorectal',
  },

  breast: {
    canonical: 'breast',
    displayName: 'Breast Cancer',
    synonyms: [
      'breast', 'breast cancer', 'mammary',
      'triple negative', 'tnbc', 'triple-negative',
      'her2+', 'her2-positive', 'her2 positive',
      'hr+', 'hormone receptor positive',
      'er+', 'estrogen receptor positive',
      'pr+', 'progesterone receptor positive',
      'invasive ductal', 'invasive lobular',
      'dcis', 'ductal carcinoma in situ',
    ],
    icd10: ['C50'],
    nccnGuideline: 'nccn-breast',
  },

  lung: {
    canonical: 'lung',
    displayName: 'Non-Small Cell Lung Cancer',
    synonyms: [
      'lung', 'lung cancer', 'pulmonary',
      'nsclc', 'non-small cell', 'non small cell',
      'adenocarcinoma lung', 'squamous cell lung',
      'large cell lung', 'bronchoalveolar',
      'egfr+', 'egfr mutant', 'alk+', 'alk positive',
      'ros1', 'kras g12c', 'met exon 14',
    ],
    icd10: ['C34'],
    nccnGuideline: 'nccn-lung',
  },

  bladder: {
    canonical: 'bladder',
    displayName: 'Bladder Cancer',
    synonyms: [
      'bladder', 'bladder cancer', 'urothelial',
      'transitional cell', 'uc', 'urothelial carcinoma',
      'muscle-invasive', 'mibc', 'non-muscle invasive', 'nmibc',
      'upper tract urothelial', 'utuc',
    ],
    icd10: ['C67'],
    nccnGuideline: 'nccn-bladder',
  },

  gastric: {
    canonical: 'gastric',
    displayName: 'Gastric Cancer',
    synonyms: [
      'gastric', 'stomach', 'gastric cancer', 'stomach cancer',
      'gastroesophageal', 'gej', 'gastroesophageal junction',
      'esophagogastric', 'cardia', 'antrum',
      'her2+ gastric', 'msi-h gastric',
    ],
    icd10: ['C16'],
    nccnGuideline: 'nccn-gastric',
  },

  esophageal: {
    canonical: 'esophageal',
    displayName: 'Esophageal Cancer',
    synonyms: [
      'esophageal', 'esophagus', 'oesophageal',
      'esophageal cancer', 'esophageal adenocarcinoma',
      'esophageal squamous', 'barrett', "barrett's",
    ],
    icd10: ['C15'],
    nccnGuideline: 'nccn-esophageal',
  },

  pancreatic: {
    canonical: 'pancreatic',
    displayName: 'Pancreatic Cancer',
    synonyms: [
      'pancreatic', 'pancreas', 'pancreatic cancer',
      'pdac', 'pancreatic adenocarcinoma',
      'pancreatic ductal', 'pancreatobiliary',
    ],
    icd10: ['C25'],
    nccnGuideline: 'nccn-pancreatic',
  },

  melanoma: {
    canonical: 'melanoma',
    displayName: 'Melanoma',
    synonyms: [
      'melanoma', 'cutaneous melanoma', 'skin melanoma',
      'uveal melanoma', 'mucosal melanoma', 'acral melanoma',
      'braf mutant', 'braf v600e', 'braf+',
    ],
    icd10: ['C43'],
    nccnGuideline: 'nccn-melanoma',
  },

  ovarian: {
    canonical: 'ovarian',
    displayName: 'Ovarian Cancer',
    synonyms: [
      'ovarian', 'ovary', 'ovarian cancer',
      'epithelial ovarian', 'serous ovarian',
      'high-grade serous', 'hgsoc',
      'brca1', 'brca2', 'brca+',
      'fallopian tube', 'primary peritoneal',
    ],
    icd10: ['C56'],
    nccnGuideline: 'nccn-ovarian',
  },

  prostate: {
    canonical: 'prostate',
    displayName: 'Prostate Cancer',
    synonyms: [
      'prostate', 'prostate cancer', 'prostatic',
      'castration-resistant', 'crpc', 'mcrpc',
      'hormone-sensitive', 'hspc', 'mhspc',
      'gleason', 'psa',
    ],
    icd10: ['C61'],
    nccnGuideline: 'nccn-prostate',
  },

  head_neck: {
    canonical: 'head_neck',
    displayName: 'Head and Neck Cancer',
    synonyms: [
      'head and neck', 'head neck', 'hnscc',
      'oral cavity', 'oropharyngeal', 'oropharynx',
      'laryngeal', 'larynx', 'hypopharynx',
      'nasopharyngeal', 'nasopharynx', 'npc',
      'hpv+', 'hpv positive', 'p16+',
      'squamous cell head', 'scchn',
    ],
    icd10: ['C00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C12', 'C13', 'C14', 'C32'],
    nccnGuideline: 'nccn-head-neck',
  },

  endometrial: {
    canonical: 'endometrial',
    displayName: 'Endometrial Cancer',
    synonyms: [
      'endometrial', 'endometrium', 'uterine',
      'endometrial cancer', 'uterine cancer',
      'endometrial carcinoma', 'uterine carcinoma',
    ],
    icd10: ['C54', 'C55'],
    nccnGuideline: 'nccn-uterine',
  },

  thyroid: {
    canonical: 'thyroid',
    displayName: 'Thyroid Cancer',
    synonyms: [
      'thyroid', 'thyroid cancer',
      'papillary thyroid', 'follicular thyroid',
      'medullary thyroid', 'mtc',
      'anaplastic thyroid', 'atc',
      'differentiated thyroid', 'dtc',
    ],
    icd10: ['C73'],
    nccnGuideline: 'nccn-thyroid',
  },

  sarcoma: {
    canonical: 'sarcoma',
    displayName: 'Soft Tissue Sarcoma',
    synonyms: [
      'sarcoma', 'soft tissue sarcoma',
      'liposarcoma', 'leiomyosarcoma',
      'undifferentiated pleomorphic', 'ups',
      'synovial sarcoma', 'angiosarcoma',
      'gastrointestinal stromal', 'gist',
    ],
    icd10: ['C49'],
    nccnGuideline: 'nccn-sarcoma',
  },
};

/**
 * MRD/ctDNA Term Ontology
 * Primary terms, context terms, and test names
 */
export const MRD_TERM_ONTOLOGY = {
  // Core MRD/ctDNA terminology
  primary: [
    'minimal residual disease',
    'molecular residual disease',
    'mrd',
    'circulating tumor dna',
    'ctdna',
    'ct-dna',
    'cell-free dna',
    'cfdna',
    'cf-dna',
    'liquid biopsy',
    'liquid biopsies',
    'tumor-informed',
    'tumor informed',
    'tumor-naive',
    'tumor naive',
    'tumor-agnostic',
    'molecular relapse',
    'molecular recurrence',
    'genomic profiling',
    'personalized assay',
    'bespoke assay',
  ],

  // Clinical context terms
  context: [
    'surveillance',
    'monitoring',
    'recurrence detection',
    'recurrence risk',
    'adjuvant',
    'neoadjuvant',
    'treatment response',
    'therapy response',
    'treatment decision',
    'detectable',
    'undetectable',
    'clearance',
    'conversion',
    'dynamics',
    'kinetics',
    'landmark',
    'serial',
    'longitudinal',
    'post-operative',
    'postoperative',
    'post-treatment',
  ],

  // Specific test/assay names
  tests: [
    'signatera',
    'guardant reveal',
    'guardant360',
    'guardant 360',
    'foundationone tracker',
    'foundationone liquid',
    'caris assure',
    'tempus',
    'personalis neotype',
    'neotype',
    'archer reveal',
    'invitae',
    'roche avenio',
    'avenio',
    'grail',
    'freenome',
  ],

  // Evidence/study terms
  evidence: [
    'clinical utility',
    'clinical validity',
    'analytical validity',
    'sensitivity',
    'specificity',
    'positive predictive',
    'negative predictive',
    'lead time',
    'hazard ratio',
    'disease-free survival',
    'recurrence-free survival',
    'overall survival',
    'progression-free',
  ],
};

/**
 * Hematologic malignancy terms (to EXCLUDE from solid tumor MRD)
 */
export const HEMATOLOGIC_EXCLUSIONS = [
  'leukemia',
  'lymphoma',
  'myeloma',
  'multiple myeloma',
  'myeloid',
  'myelodysplastic',
  'mds',
  'aml',
  'all',
  'cll',
  'cml',
  'hodgkin',
  'non-hodgkin',
  'b-cell',
  't-cell',
  'plasma cell',
  'bone marrow',
];

/**
 * Normalize cancer type to canonical form
 * @param {string} text - Text containing cancer type mention
 * @returns {string|null} - Canonical cancer type or null
 */
export function normalizeCancerType(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const [canonical, config] of Object.entries(CANCER_TYPE_ONTOLOGY)) {
    if (config.synonyms.some(s => lower.includes(s.toLowerCase()))) {
      return canonical;
    }
  }
  return null;
}

/**
 * Extract all cancer types from text
 * @param {string} text - Text to analyze
 * @returns {string[]} - Array of canonical cancer types found
 */
export function extractCancerTypes(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const types = new Set();

  for (const [canonical, config] of Object.entries(CANCER_TYPE_ONTOLOGY)) {
    if (config.synonyms.some(s => lower.includes(s.toLowerCase()))) {
      types.add(canonical);
    }
  }

  return Array.from(types);
}

/**
 * Expand a search term to include all synonyms
 * @param {string} term - Search term
 * @returns {string[]} - Array including term and all synonyms
 */
export function expandSearchTerms(term) {
  const lower = term.toLowerCase();

  // Check cancer types
  for (const config of Object.values(CANCER_TYPE_ONTOLOGY)) {
    if (config.canonical === lower || config.synonyms.includes(lower)) {
      return [config.canonical, ...config.synonyms];
    }
  }

  // Check MRD terms
  for (const category of Object.values(MRD_TERM_ONTOLOGY)) {
    if (category.includes(lower)) {
      return category;
    }
  }

  return [term];
}

/**
 * Check if text contains hematologic malignancy terms
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export function containsHematologic(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return HEMATOLOGIC_EXCLUSIONS.some(term => lower.includes(term));
}

/**
 * Get display name for a canonical cancer type
 * @param {string} canonical - Canonical type name
 * @returns {string}
 */
export function getCancerDisplayName(canonical) {
  return CANCER_TYPE_ONTOLOGY[canonical]?.displayName || canonical;
}

/**
 * Get all primary MRD terms (flattened)
 * @returns {string[]}
 */
export function getAllMRDTerms() {
  return [
    ...MRD_TERM_ONTOLOGY.primary,
    ...MRD_TERM_ONTOLOGY.context,
    ...MRD_TERM_ONTOLOGY.tests,
  ];
}

/**
 * Get all solid tumor terms (flattened)
 * @returns {string[]}
 */
export function getAllSolidTumorTerms() {
  return Object.values(CANCER_TYPE_ONTOLOGY).flatMap(c => c.synonyms);
}

export default {
  CANCER_TYPE_ONTOLOGY,
  MRD_TERM_ONTOLOGY,
  HEMATOLOGIC_EXCLUSIONS,
  normalizeCancerType,
  extractCancerTypes,
  expandSearchTerms,
  containsHematologic,
  getCancerDisplayName,
  getAllMRDTerms,
  getAllSolidTumorTerms,
};
