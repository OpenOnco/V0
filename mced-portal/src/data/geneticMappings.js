/**
 * Genetic risk factor mappings.
 * Each factor auto-adds associated cancer types to the concern list.
 */
export const GENETIC_MAPPINGS = {
  brca: {
    label: 'BRCA1 / BRCA2 / PALB2',
    cancers: ['Breast', 'Ovary', 'Pancreas', 'Prostate'],
  },
  lynch: {
    label: 'Lynch syndrome',
    cancers: ['Colon/Rectum', 'Endometrial', 'Uterus', 'Ovary', 'Gastric', 'Pancreas', 'Prostate'],
  },
  chek2Atm: {
    label: 'CHEK2 / ATM',
    cancers: ['Breast', 'Pancreas', 'Prostate', 'Colon/Rectum'],
  },
  tp53: {
    label: 'TP53 (Li-Fraumeni)',
    cancers: ['Breast', 'Sarcoma', 'Lung', 'Pancreas', 'Colon/Rectum', 'Leukemia'],
  },
  apc: {
    label: 'APC / FAP',
    cancers: ['Colon/Rectum', 'Gastric', 'Thyroid'],
  },
  mutyh: {
    label: 'MUTYH-associated polyposis',
    cancers: ['Colon/Rectum', 'Gastric', 'Endometrial', 'Uterus', 'Ovary', 'Bladder', 'Liver', 'Thyroid'],
  },
};
