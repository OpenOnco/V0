import { TESTS } from '../data/tests';

const ALL_CANCERS = [
  'Bladder', 'Brain', 'Breast', 'Cervix', 'Colon/Rectum', 'Endometrial',
  'Esophagus', 'Gallbladder', 'Gastric', 'Head and Neck', 'Kidney',
  'Leukemia', 'Liver', 'Lung', 'Lymphoma', 'Melanoma', 'Multiple Myeloma',
  'Ovary', 'Pancreas', 'Prostate', 'Sarcoma', 'Small Intestine',
  'Testis', 'Thyroid', 'Uterus',
];

/**
 * Returns only the cancer types where at least one test has sensitivity data.
 */
export function getDetectableCancers() {
  const detectable = new Set();
  TESTS.forEach((t) => {
    Object.keys(t.cancers).forEach((c) => detectable.add(c));
  });
  return ALL_CANCERS.filter((c) => detectable.has(c));
}
