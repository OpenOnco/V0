import { SCREENING_MAP } from '../data/screeningMap';

/**
 * Identify cancer types that have standard screening but the user hasn't done.
 * Only includes screenings applicable to the user's sex.
 */
export function identifyScreeningGaps(form) {
  const gaps = [];

  for (const [key, screening] of Object.entries(SCREENING_MAP)) {
    if (screening.sexFilter && screening.sexFilter !== form.sex) continue;
    if (!form.screenings.includes(key)) {
      gaps.push(screening.cancerType);
    }
  }

  return gaps;
}
