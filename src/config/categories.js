// Category color schemes for quality dashboard
// Final categories: MRD, ECD, CGP, HCT
// Note: TRM merged into MRD, TDS renamed to CGP
export const CATEGORY_COLORS = {
  MRD: { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'bg-orange-500', text: 'text-orange-700' },
  ECD: { bg: 'bg-emerald-50', border: 'border-emerald-200', accent: 'bg-emerald-500', text: 'text-emerald-700' },
  CGP: { bg: 'bg-violet-50', border: 'border-violet-200', accent: 'bg-violet-500', text: 'text-violet-700' },
  HCT: { bg: 'bg-rose-50', border: 'border-rose-200', accent: 'bg-rose-500', text: 'text-rose-700' },
  // Legacy aliases for backwards compatibility
  TRM: { bg: 'bg-orange-50', border: 'border-orange-200', accent: 'bg-orange-500', text: 'text-orange-700' }, // Now part of MRD
  TDS: { bg: 'bg-violet-50', border: 'border-violet-200', accent: 'bg-violet-500', text: 'text-violet-700' }, // Now CGP
};
