// Domain detection and site configuration
// Supports openonco.org (oncology) and openalz.org (Alzheimer's)

export const DOMAINS = {
  ONCO: 'onco',
  ALZ: 'alz'
};

export const getDomain = () => {
  if (typeof window === 'undefined') return DOMAINS.ONCO;

  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('openalz') || hostname.includes('alz.')) {
    return DOMAINS.ALZ;
  }

  // Default to oncology (openonco)
  return DOMAINS.ONCO;
};

export const getSiteConfig = () => {
  const domain = getDomain();

  if (domain === DOMAINS.ALZ) {
    return {
      domain: DOMAINS.ALZ,
      name: 'OpenAlz',
      tagline: "Alzheimer's Diagnostics Database",
      description: "Compare blood-based Alzheimer's biomarker tests",
      logoText: 'OpenAlz',
      themeColor: '#6366f1', // Indigo for ALZ
      categories: ['ALZ-BLOOD']
    };
  }

  // Default: OpenOnco (oncology)
  return {
    domain: DOMAINS.ONCO,
    name: 'OpenOnco',
    tagline: 'Oncology Diagnostics Database',
    description: 'Compare cancer diagnostic tests across categories',
    logoText: 'OpenOnco',
    themeColor: '#2563eb', // Blue for Onco
    categories: ['MRD', 'ECD', 'TRM', 'TDS']
  };
};
