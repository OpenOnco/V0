/**
 * Genetic risk factor mappings.
 * Each factor auto-adds associated cancer types to the concern list.
 */
export const GENETIC_MAPPINGS = {
  brca: { label: 'BRCA1 or BRCA2', cancers: ['Breast', 'Ovary', 'Pancreas', 'Prostate'] },
  mutyh: { label: 'MUTYH', cancers: ['Colon/Rectum', 'Gastric', 'Endometrial', 'Uterus', 'Ovary', 'Bladder', 'Liver', 'Thyroid'] },
  lynch: { label: 'Lynch syndrome', cancers: ['Colon/Rectum', 'Endometrial', 'Uterus', 'Ovary', 'Gastric', 'Pancreas', 'Prostate'] },
};
