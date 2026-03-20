/**
 * Canonical cancer type names used across the MCED portal.
 * Derived from Galleri/Cancerguard cancerTypeSensitivity data.
 */
export const CANONICAL_CANCER_TYPES = [
  'Anus',
  'Bladder',
  'Brain',
  'Breast',
  'Cervix',
  'Colon/Rectum',
  'Endometrial',
  'Esophagus',
  'Gallbladder',
  'Gastric',
  'Head and Neck',
  'Kidney',
  'Leukemia',
  'Liver',
  'Lung',
  'Lymphoma',
  'Melanoma',
  'Mesothelioma',
  'Multiple Myeloma',
  'Ovary',
  'Pancreas',
  'Prostate',
  'Sarcoma',
  'Small Intestine',
  'Testis',
  'Thyroid',
  'Uterus',
  'Vulva',
];

/**
 * Map non-canonical names to canonical ones.
 * Used when normalizing API data or user input.
 */
export const CANCER_TYPE_ALIASES = {
  'Colorectal': 'Colon/Rectum',
  'CRC': 'Colon/Rectum',
  'Colon': 'Colon/Rectum',
  'Rectum': 'Colon/Rectum',
  'Stomach': 'Gastric',
  'Liver/Bile-duct': 'Liver',
  'Liver/Bile Duct': 'Liver',
  'Hepatobiliary': 'Liver',
  'Lymphoid Leukemia': 'Leukemia',
  'Myeloid Neoplasm': 'Leukemia',
  'Plasma Cell Neoplasm': 'Multiple Myeloma',
  'Non-Hodgkin Lymphoma': 'Lymphoma',
  'NHL': 'Lymphoma',
  'Head & Neck': 'Head and Neck',
  'H&N': 'Head and Neck',
  'Ovarian': 'Ovary',
  'Pancreatic': 'Pancreas',
  'Esophageal': 'Esophagus',
  'Endometrium': 'Endometrial',
  'Uterine': 'Uterus',
  'Glioma': 'Brain',
  'Testicular': 'Testis',
  'Renal': 'Kidney',
};

/**
 * Resolve a cancer type name to its canonical form.
 */
export function canonicalize(name) {
  if (!name) return null;
  const trimmed = name.trim();
  return CANCER_TYPE_ALIASES[trimmed] || trimmed;
}
