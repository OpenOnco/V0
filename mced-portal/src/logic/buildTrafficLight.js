import { SENSITIVITY_TIERS, MIN_SAMPLE_SIZE } from '../data/thresholds';
import { canonicalize } from '../data/canonicalCancerTypes';

/**
 * Parse the raw cancerTypeSensitivity array from the API into a
 * lookup map keyed by canonical cancer name.
 *
 * Input format (from data.js):
 *   [{ cancerType: "Lung", overall: { detected: 302, total: 404 }, ... }]
 *
 * Output format:
 *   { "Lung": { sensitivity: 74.8, sampleSize: 404 } }
 */
export function parseSensitivityData(rawArray) {
  if (!Array.isArray(rawArray)) return {};

  const map = {};
  for (const entry of rawArray) {
    const canonical = canonicalize(entry.cancerType);
    if (!canonical || !entry.overall) continue;

    const { detected, total } = entry.overall;
    if (total === 0) continue;

    // Deduplicate: if we already have this canonical name (e.g., Lymphoid Leukemia
    // and Myeloid Neoplasm both map to Leukemia), keep the one with larger sample.
    if (map[canonical] && map[canonical].sampleSize >= total) continue;

    map[canonical] = {
      sensitivity: Math.round((detected / total) * 1000) / 10, // one decimal
      sampleSize: total,
    };
  }
  return map;
}

/**
 * Classify a sensitivity value into a traffic light tier.
 */
export function getTier(sensitivity, sampleSize) {
  if (sensitivity == null || sampleSize < MIN_SAMPLE_SIZE) return 'no-data';
  if (sensitivity > SENSITIVITY_TIERS.GOOD) return 'good';
  if (sensitivity >= SENSITIVITY_TIERS.OK) return 'ok';
  return 'bad';
}

/**
 * Build traffic light rows for a single test against the user's concern
 * cancers and screening gaps.
 *
 * Returns:
 *   {
 *     concernRows: [{ cancer, tier, sensitivity, sampleSize }],
 *     gapRows: [{ cancer, tier, sensitivity, sampleSize }],
 *     hasAnySensitivityData: boolean
 *   }
 */
export function buildTrafficLight(test, concernCancers, screeningGaps) {
  const sensitivityMap = parseSensitivityData(test.cancerTypeSensitivity);
  const hasAnySensitivityData = Object.keys(sensitivityMap).length > 0;

  function buildRow(cancer) {
    const data = sensitivityMap[cancer];
    if (!data || data.sampleSize < MIN_SAMPLE_SIZE) {
      return { cancer, tier: 'no-data', sensitivity: null, sampleSize: null };
    }
    return {
      cancer,
      tier: getTier(data.sensitivity, data.sampleSize),
      sensitivity: data.sensitivity,
      sampleSize: data.sampleSize,
    };
  }

  const concernRows = concernCancers.map(buildRow);
  const gapRows = screeningGaps.map(buildRow);

  return { concernRows, gapRows, hasAnySensitivityData };
}
