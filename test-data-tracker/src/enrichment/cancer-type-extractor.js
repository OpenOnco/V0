/**
 * Cancer Type Extractor
 *
 * Extracts specific cancer types from text using regex patterns
 * and synonym mapping. Falls back to 'multi_solid' only when
 * no specific cancer type can be identified.
 */

const CANCER_PATTERNS = {
  colorectal: /\b(colorectal|colon\s*cancer|rectal\s*cancer|CRC|sigmoid|adenocarcinoma.{0,20}colon)\b/i,
  bladder: /\b(bladder|urothelial|MIBC|muscle.invasive.bladder|transitional.cell.carcinoma|UC\b)/i,
  breast: /\b(breast|TNBC|triple.negative|ER.positive|HER2.positive|mammary.carcinoma|ductal|lobular)\b/i,
  lung_nsclc: /\b(NSCLC|non.small.cell|lung.adenocarcinoma|lung.squamous|adenocarcinoma.{0,20}lung)\b/i,
  lung_sclc: /\b(SCLC|small.cell.lung)\b/i,
  pancreatic: /\b(pancrea|PDAC|pancreatic.ductal)\b/i,
  gastric: /\b(gastric|stomach.cancer|gastroesophageal|GEJ|gastro.esophageal)\b/i,
  ovarian: /\b(ovarian|ovary|fallopian|high.grade.serous)\b/i,
  prostate: /\b(prostate|prostatic|CRPC|castration.resistant)\b/i,
  melanoma: /\b(melanoma|cutaneous.melanoma)\b/i,
  head_and_neck: /\b(head.and.neck|HNSCC|oropharyngeal|laryngeal|oral.cavity|hypopharyngeal|nasopharyngeal)\b/i,
  esophageal: /\b(esophag|oesophag)\b/i,
  renal: /\b(renal.cell|kidney.cancer|RCC|clear.cell.renal)\b/i,
  liver: /\b(hepatocellular|HCC|liver.cancer|hepatic.carcinoma)\b/i,
  endometrial: /\b(endometri|uterine.cancer)\b/i,
  cervical: /\b(cervical.cancer|cervix)\b/i,
  thyroid: /\b(thyroid.cancer|papillary.thyroid|follicular.thyroid)\b/i,
  sarcoma: /\b(sarcoma|liposarcoma|leiomyosarcoma|osteosarcoma)\b/i,
  glioblastoma: /\b(glioblastoma|GBM|glioma)\b/i,
  merkel: /\b(merkel.cell)\b/i,
};

// General lung cancer pattern (defaults to NSCLC)
const LUNG_GENERAL = /\b(lung\s*cancer|pulmonary\s*carcinoma|lung\s*malignancy)\b/i;

/**
 * Extract cancer types from text
 * @param {string} text - Text to analyze (title, abstract, full text)
 * @returns {string[]} - Array of canonical cancer type strings
 */
export function extractCancerTypes(text) {
  if (!text) return ['multi_solid'];

  const types = new Set();

  for (const [type, pattern] of Object.entries(CANCER_PATTERNS)) {
    if (pattern.test(text)) {
      types.add(type);
    }
  }

  // Handle general lung cancer mention
  if (LUNG_GENERAL.test(text) && !types.has('lung_nsclc') && !types.has('lung_sclc')) {
    types.add('lung_nsclc'); // Default to NSCLC as more common in MRD context
  }

  // Default to multi_solid only if no specific types found
  return types.size > 0 ? Array.from(types) : ['multi_solid'];
}

/**
 * Map raw cancer type string to canonical value
 * Used when cancer types are extracted from structured data
 * @param {string} rawType - Raw cancer type string
 * @returns {string} - Canonical cancer type
 */
export function normalizeCancerType(rawType) {
  if (!rawType) return 'multi_solid';

  const normalized = rawType.toLowerCase().trim();

  const directMap = {
    'colorectal': 'colorectal',
    'colon': 'colorectal',
    'rectal': 'colorectal',
    'crc': 'colorectal',
    'bladder': 'bladder',
    'urothelial': 'bladder',
    'breast': 'breast',
    'tnbc': 'breast',
    'triple-negative breast': 'breast',
    'lung': 'lung_nsclc',
    'nsclc': 'lung_nsclc',
    'non-small cell lung': 'lung_nsclc',
    'sclc': 'lung_sclc',
    'small cell lung': 'lung_sclc',
    'pancreatic': 'pancreatic',
    'pancreas': 'pancreatic',
    'gastric': 'gastric',
    'stomach': 'gastric',
    'ovarian': 'ovarian',
    'ovary': 'ovarian',
    'prostate': 'prostate',
    'melanoma': 'melanoma',
    'head and neck': 'head_and_neck',
    'hnscc': 'head_and_neck',
    'esophageal': 'esophageal',
    'renal': 'renal',
    'kidney': 'renal',
    'rcc': 'renal',
    'liver': 'liver',
    'hcc': 'liver',
    'hepatocellular': 'liver',
    'endometrial': 'endometrial',
    'uterine': 'endometrial',
    'cervical': 'cervical',
    'thyroid': 'thyroid',
    'sarcoma': 'sarcoma',
    'glioblastoma': 'glioblastoma',
    'gbm': 'glioblastoma',
    'merkel cell': 'merkel',
  };

  return directMap[normalized] || 'multi_solid';
}

/**
 * Extract clinical settings from text
 * @param {string} text - Text to analyze
 * @returns {string[]} - Array of clinical setting strings
 */
export function extractClinicalSettings(text) {
  if (!text) return [];

  const settings = new Set();
  const textLower = text.toLowerCase();

  const patterns = {
    adjuvant: /\b(adjuvant|post.?operative|after.surgery|after.resection)\b/i,
    neoadjuvant: /\b(neoadjuvant|pre.?operative|before.surgery|induction)\b/i,
    surveillance: /\b(surveillance|monitoring|follow.?up|serial.testing)\b/i,
    metastatic: /\b(metastatic|stage.IV|advanced|mets\b)/i,
    recurrence_detection: /\b(recurrence|relapse|MRD|minimal.residual|molecular.residual)\b/i,
    treatment_response: /\b(treatment.response|therapy.response|response.assessment)\b/i,
    treatment_selection: /\b(treatment.selection|therapy.selection|guide.treatment|targeted.therapy)\b/i,
  };

  for (const [setting, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) {
      settings.add(setting);
    }
  }

  return Array.from(settings);
}

export default {
  extractCancerTypes,
  normalizeCancerType,
  extractClinicalSettings,
};
