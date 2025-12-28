// Helper function to format LOD as "ppm (% VAF)"
export const formatLOD = (lod) => {
  // LOD values are now stored as strings in their original reported format
  // No conversion needed - just return as-is
  if (lod == null) return null;
  return String(lod);
};

// Helper to detect LOD unit type from string value
export const detectLodUnit = (lodValue) => {
  if (!lodValue) return null;
  const str = String(lodValue).toLowerCase();
  if (str.includes('ppm')) return 'ppm';
  if (str.includes('vaf') || str.includes('%')) return 'VAF';
  if (str.includes('mtm') || str.includes('molecules')) return 'MTM';
  if (str.includes('copies')) return 'copies';
  return 'other';
};

// Get badge color for LOD unit
export const getLodUnitBadge = (unit) => {
  const badges = {
    'ppm': { bg: 'bg-violet-100', text: 'text-violet-700', label: 'ppm' },
    'VAF': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'VAF%' },
    'MTM': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'MTM' },
    'copies': { bg: 'bg-amber-100', text: 'text-amber-700', label: 'copies' },
    'other': { bg: 'bg-gray-100', text: 'text-gray-600', label: '—' },
  };
  return badges[unit] || badges.other;
};
