// ============================================
// Vendor Configuration
// Last updated: 2026-01-11
// ============================================

// ============================================
// Vendor Badges - Awards and recognition
// ============================================
export const VENDOR_BADGES = {
  'Exact Sciences': [
    { id: 'openness-leader', icon: '📊', label: 'Openness Leader', tooltip: 'Top 3 in OpenOnco Data Openness Ranking' }
  ],
};

// ============================================
// Vendor Availability (US Market)
// ============================================
// Derived from: lab network presence, ordering infrastructure, Medicare coverage
// 
// Tiers:
//   - widespread: National lab networks, any oncologist can order, established reimbursement
//   - moderate:   Available nationally but specialized pathways or emerging coverage
//   - limited:    Regional, international-focused, or newer US market entrants
//
// Note: This applies to central lab services only, not IVD kits.
// OUS availability is handled separately via availableRegions field.
// ============================================

export const VENDOR_AVAILABILITY_US = {
  // Tier 1: Widespread
  // National labs, established ordering, Medicare LCD coverage
  'Guardant Health': 'widespread',
  'Foundation Medicine': 'widespread',
  'Natera': 'widespread',
  'Exact Sciences': 'widespread',
  'Labcorp': 'widespread',
  'Labcorp (Invitae)': 'widespread',
  'Labcorp/PGDx': 'widespread',
  'Tempus AI': 'widespread',
  
  // Tier 2: Moderate
  // National reach but specialized (heme-only, specific cancers) or emerging coverage
  'Adaptive Biotechnologies': 'moderate',
  'BillionToOne': 'moderate',
  'NeoGenomics': 'moderate',
  'Personalis': 'moderate',
  'Genomic Testing Cooperative (GTC)': 'moderate',
  'Cleveland Diagnostics': 'moderate',
  
  // Tier 3: Limited
  // International-focused, regional, or newer US market entrants
  'Burning Rock Dx': 'limited',           // China-focused, limited US
  'Wuhan Ammunition Life Technology': 'limited',  // China-only
  'LIQOMICS': 'limited',                  // Germany-based, EU focus
  'Inocras': 'limited',                   // Newer entrant
  'Lucence': 'limited',                   // Singapore-based
  'IMBdx': 'limited',                     // Korea-based
  'Datar Cancer Genetics': 'limited',     // India-based
  'OncoDNA': 'limited',                   // Belgium-based
  'Hedera Dx': 'limited',                 // Spain-based (kit vendor)
  'Precision Epigenomics': 'limited',     // Limited availability
  'Cancer Cell Dx': 'limited',            // Newer entrant
  'ClearNote Health': 'limited',          // Newer entrant
  'Universal DX': 'limited',              // Newer entrant
  'Viome': 'limited',                     // Consumer-focused
  'Allelica': 'limited',                  // Specialty
  'SOPHiA GENETICS': 'limited',           // Platform company
  'Agilent / Resolution Bioscience': 'limited',
  'Helio Genomics, Exact Sciences': 'moderate',  // Joint venture with Exact
};

// ============================================
// Utility Functions
// ============================================

/**
 * Get US availability tier for a vendor
 * @param {string} vendor - Vendor name
 * @returns {'widespread' | 'moderate' | 'limited' | 'unknown'}
 */
export const getVendorAvailabilityUS = (vendor) => {
  if (!vendor) return 'unknown';
  return VENDOR_AVAILABILITY_US[vendor] || 'unknown';
};

/**
 * Get display label for availability tier
 * @param {'widespread' | 'moderate' | 'limited' | 'unknown'} tier
 * @returns {string}
 */
export const getAvailabilityLabel = (tier) => {
  const labels = {
    widespread: 'Widely Available',
    moderate: 'Available',
    limited: 'Limited Availability',
    unknown: 'Availability Unknown'
  };
  return labels[tier] || labels.unknown;
};

/**
 * Get tooltip text explaining availability tier
 * @param {'widespread' | 'moderate' | 'limited' | 'unknown'} tier
 * @returns {string}
 */
export const getAvailabilityTooltip = (tier) => {
  const tooltips = {
    widespread: 'Orderable by any oncologist through major lab networks with established insurance coverage',
    moderate: 'Available nationally but may require specialized ordering pathways',
    limited: 'Limited US availability - may be regional, international-focused, or newly launched',
    unknown: 'US availability not yet confirmed'
  };
  return tooltips[tier] || tooltips.unknown;
};
