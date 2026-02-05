/**
 * Canonical cancer type normalization
 * 
 * Single source of truth for cancer type mappings across all processors.
 * All processors should use normalizeCancerType() to ensure consistency.
 */

// Canonical cancer types used in the database
export const CANONICAL_CANCER_TYPES = [
  'colorectal',
  'breast', 
  'lung_nsclc',
  'lung_sclc',
  'bladder',
  'pancreatic',
  'melanoma',
  'ovarian',
  'gastric',
  'esophageal',
  'hepatocellular',
  'prostate',
  'renal',
  'head_neck',
  'sarcoma',
  'multiple_myeloma',
  'cll',
  'merkel_cell',
  'multi_solid',  // pan-cancer, solid tumors generally
];

// Mapping of variant spellings/terms to canonical types
const CANCER_TYPE_ALIASES = {
  // Colorectal variants
  'colon': 'colorectal',
  'rectal': 'colorectal',
  'crc': 'colorectal',
  'bowel': 'colorectal',
  
  // Lung variants
  'lung': 'lung_nsclc',  // Default lung to NSCLC
  'nsclc': 'lung_nsclc',
  'non-small cell': 'lung_nsclc',
  'non-small-cell': 'lung_nsclc',
  'sclc': 'lung_sclc',
  'small cell lung': 'lung_sclc',
  'small-cell lung': 'lung_sclc',
  
  // Head and neck variants
  'head_and_neck': 'head_neck',
  'head and neck': 'head_neck',
  'hnscc': 'head_neck',
  
  // Bladder variants
  'urothelial': 'bladder',
  
  // Gastric variants  
  'stomach': 'gastric',
  'gastroesophageal': 'gastric',
  
  // Esophageal variants
  'esophagus': 'esophageal',
  'oesophageal': 'esophageal',
  
  // Liver variants
  'liver': 'hepatocellular',
  'hcc': 'hepatocellular',
  
  // Multi-solid / pan-cancer variants
  'solid_tumor': 'multi_solid',
  'solid tumor': 'multi_solid',
  'solid tumors': 'multi_solid',
  'pan-cancer': 'multi_solid',
  'pan_cancer': 'multi_solid',
  'pan-solid': 'multi_solid',
  'pan_solid': 'multi_solid',
  'tumor agnostic': 'multi_solid',
  'cancer': 'multi_solid',  // Generic "cancer" maps to multi_solid
  
  // Merkel cell variants
  'merkel': 'merkel_cell',
  
  // Multiple myeloma variants
  'myeloma': 'multiple_myeloma',
  
  // ALL variant
  'all': 'all',  // Acute lymphoblastic leukemia, keep as-is
};

/**
 * Normalize a cancer type string to canonical form
 * @param {string} cancerType - Raw cancer type string
 * @returns {string} - Canonical cancer type
 */
export function normalizeCancerType(cancerType) {
  if (!cancerType) return 'multi_solid';
  
  const lower = cancerType.toLowerCase().trim();
  
  // Check if it's already canonical
  if (CANONICAL_CANCER_TYPES.includes(lower)) {
    return lower;
  }
  
  // Check aliases
  if (CANCER_TYPE_ALIASES[lower]) {
    return CANCER_TYPE_ALIASES[lower];
  }
  
  // Partial matching for compound terms
  for (const [alias, canonical] of Object.entries(CANCER_TYPE_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return canonical;
    }
  }
  
  // Default to multi_solid if unknown
  return 'multi_solid';
}

/**
 * Normalize an array of cancer types
 * @param {string[]} cancerTypes - Array of raw cancer type strings
 * @returns {string[]} - Deduplicated array of canonical types
 */
export function normalizeCancerTypes(cancerTypes) {
  if (!cancerTypes || !Array.isArray(cancerTypes)) {
    return ['multi_solid'];
  }
  
  const normalized = new Set(
    cancerTypes.map(ct => normalizeCancerType(ct))
  );
  
  return [...normalized];
}

export default {
  CANONICAL_CANCER_TYPES,
  normalizeCancerType,
  normalizeCancerTypes,
};
