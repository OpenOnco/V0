import { SENSITIVITY_TIERS } from '../data/thresholds';

export function tierInfo(sensitivity) {
  if (sensitivity == null) return { color: '#E24B4A' };
  if (sensitivity > SENSITIVITY_TIERS.GOOD) return { color: '#4aba4a' };
  if (sensitivity >= SENSITIVITY_TIERS.OK) return { color: '#EF9F27' };
  return { color: '#E24B4A' };
}
