/**
 * Genetic risk factor mappings.
 * Each factor auto-adds associated cancer types to the concern list.
 */
export const GENETIC_MAPPINGS = {
  brca: { label: 'BRCA1 or BRCA2', cancers: ['Breast', 'Ovarian', 'Pancreatic', 'Prostate'] },
  mutyh: { label: 'MUTYH', cancers: ['Colorectal'] },
  lynch: { label: 'Lynch syndrome', cancers: ['Colorectal', 'Endometrial', 'Ovarian', 'Gastric'] },
};
