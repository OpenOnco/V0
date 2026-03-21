import { SENSITIVITY_TIERS } from '../data/thresholds';

export function tierInfo(sensitivity, thresholds) {
  const strong = thresholds?.strong ?? SENSITIVITY_TIERS.GOOD;
  const moderate = thresholds?.moderate ?? SENSITIVITY_TIERS.OK;
  if (sensitivity == null) return { color: '#E24B4A' };
  if (sensitivity > strong) return { color: '#4aba4a' };
  if (sensitivity >= moderate) return { color: '#EF9F27' };
  return { color: '#E24B4A' };
}
