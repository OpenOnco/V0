import { SMOKING_CANCERS } from '../data/smokingCancers';

/**
 * Build a deduplicated list of cancer types the user is concerned about.
 * Sources: family history, smoking-related cancers, personal history.
 */
export function buildConcernList(form) {
  const concerns = new Set();

  if (Array.isArray(form.familyHistory)) {
    form.familyHistory.forEach((c) => concerns.add(c));
  }

  if (form.smokingStatus === 'former' || form.smokingStatus === 'current') {
    SMOKING_CANCERS.forEach((c) => concerns.add(c));
  }

  if (
    form.personalCancerDiagnosis &&
    form.continueAfterDiagnosis &&
    form.personalCancerType
  ) {
    concerns.add(form.personalCancerType);
  }

  return [...concerns].sort();
}
