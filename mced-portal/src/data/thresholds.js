/**
 * Sensitivity tier thresholds for the traffic light visualization.
 *
 * Informed by CMS reimbursement standards (NCD 210.3 requires ≥74%
 * sensitivity for CRC coverage) and CCGA validation data.
 */
export const SENSITIVITY_TIERS = {
  GOOD: 50, // > 50% = green
  OK: 25,   // 25–50% = amber
  // ≤ 25% = red
};

/**
 * Minimum sample size to display a cancer type in the traffic light.
 * Cancer types with n < 5 are excluded from the main visualization
 * but can appear in an expanded detail view with a "limited data" note.
 */
export const MIN_SAMPLE_SIZE = 5;
