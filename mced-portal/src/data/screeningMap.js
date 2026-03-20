/**
 * Maps standard screening tests to the cancer types they screen for.
 * Used to identify screening gaps.
 */
export const SCREENING_MAP = {
  colonoscopy: {
    label: 'Colonoscopy (last 10 years, normal)',
    cancerType: 'Colon/Rectum',
    sexFilter: null, // available to all
  },
  mammogram: {
    label: 'Mammogram (last 2 years, normal)',
    cancerType: 'Breast',
    sexFilter: 'female',
  },
  papHpv: {
    label: 'Pap/HPV test (last 3–5 years, normal)',
    cancerType: 'Cervix',
    sexFilter: 'female',
  },
};

/**
 * Returns screening options applicable to a given sex.
 */
export function getScreeningsForSex(sex) {
  return Object.entries(SCREENING_MAP)
    .filter(([, v]) => v.sexFilter === null || v.sexFilter === sex)
    .map(([key, v]) => ({ key, ...v }));
}

/**
 * All cancer types that have a standard screening pathway.
 */
export const SCREENABLE_CANCERS = Object.values(SCREENING_MAP).map(
  (s) => s.cancerType
);
