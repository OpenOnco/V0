/**
 * Payer Index Registry
 *
 * Maps Tier 1 payers to their policy index pages for automated discovery.
 * These are the pages we crawl to discover new policy URLs.
 *
 * Discovery workflow:
 * 1. Crawl index page with Playwright
 * 2. Extract all links
 * 3. Classify links using AI (is it ctDNA/liquid biopsy/MRD related?)
 * 4. Stage relevant links in discovered_policies table
 * 5. Human review → approve/reject
 * 6. Approved → added to policy-registry.js
 *
 * Status:
 * - enabled: true = automated discovery works
 * - enabled: false = page is too complex, use manual URL addition
 *
 * Note: Many payer index pages are JavaScript-heavy SPAs that require complex
 * interaction (modals, search, accordions) which makes automated discovery
 * unreliable. For these payers, manually adding URLs to policy-registry.js
 * is more practical.
 */

export const PAYER_INDEX_REGISTRY = {
  // ============================================================================
  // TIER 1: National Commercial Payers
  // ============================================================================

  aetna: {
    name: 'Aetna',
    tier: 1,
    indexPages: [
      {
        id: 'aetna-cpb-index',
        url: 'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins/medical-clinical-policy-bulletins.html',
        type: 'javascript',
        enabled: false, // Requires accepting modal + complex accordion navigation
        description: 'Clinical Policy Bulletins index',
        linkPattern: /\/cpb\/medical\/data\/.*\.html$/,
        notes: 'Complex SPA - requires modal acceptance, accordion expansion. Manual URL discovery recommended.',
        policyUrlPattern: 'https://www.aetna.com/cpb/medical/data/{range}/{number}.html',
      },
    ],
    searchKeywords: [
      'tumor marker',
      'liquid biopsy',
      'ctDNA',
      'circulating tumor',
      'molecular',
      'genomic',
      'NGS',
      'next-generation sequencing',
    ],
  },

  uhc: {
    name: 'UnitedHealthcare',
    tier: 1,
    indexPages: [
      {
        id: 'uhc-policies-index',
        url: 'https://www.uhcprovider.com/en/policies-protocols/commercial-policies.html',
        type: 'javascript',
        enabled: false, // Heavy SPA, requires navigation to specific policy categories
        description: 'Commercial medical policies',
        linkPattern: /\.pdf$/i,
        notes: 'Complex SPA - policies behind multiple navigation layers. Manual URL discovery recommended.',
      },
    ],
    searchKeywords: [
      'molecular oncology',
      'liquid biopsy',
      'tumor profiling',
      'genomic testing',
      'ctDNA',
    ],
  },

  cigna: {
    name: 'Cigna',
    tier: 1,
    indexPages: [
      {
        id: 'cigna-coverage-policies',
        url: 'https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/index.html',
        type: 'static',
        enabled: false, // URL times out - CDN issues
        description: 'Coverage Policies index',
        linkPattern: /\/coveragePolicies\/medical\/.*\.pdf$/,
        notes: 'URL has CDN timeouts. Known policy URLs work directly.',
        policyUrlPattern: 'https://static.cigna.com/assets/chcp/pdf/coveragePolicies/medical/{filename}.pdf',
      },
    ],
    searchKeywords: [
      'tumor profiling',
      'genetic testing',
      'molecular',
      'oncology',
      'liquid biopsy',
    ],
  },

  anthem: {
    name: 'Anthem/Elevance Health',
    tier: 1,
    indexPages: [
      {
        id: 'anthem-medical-policies',
        url: 'https://www.anthem.com/ca/provider/policies/medical-policies',
        type: 'javascript',
        enabled: false, // Complex SPA with state selection
        description: 'Medical policies (CA)',
        linkPattern: /\.pdf$/i,
        notes: 'State-specific policies, complex navigation. Manual URL discovery recommended.',
      },
    ],
    searchKeywords: [
      'molecular oncology',
      'GENE',
      'liquid biopsy',
      'ctDNA',
      'tumor',
    ],
  },

  humana: {
    name: 'Humana',
    tier: 1,
    indexPages: [
      {
        id: 'humana-medical-policies',
        url: 'https://apps.humana.com/tad/tad_new/home.aspx',
        type: 'javascript',
        enabled: false, // Search-only interface
        description: 'Medical policies search',
        linkPattern: /\.pdf$/i,
        notes: 'Search-only interface - no browsable list. Manual URL discovery recommended.',
      },
    ],
    searchKeywords: [
      'liquid biopsy',
      'molecular',
      'genomic',
      'tumor',
      'ctDNA',
    ],
  },

  // ============================================================================
  // TIER 1: Lab Benefit Managers (Critical - often make actual coverage decisions)
  // ============================================================================

  evicore: {
    name: 'EviCore (Evernorth)',
    tier: 1,
    indexPages: [
      {
        id: 'evicore-guidelines',
        url: 'https://www.evicore.com/provider/clinical-guidelines',
        type: 'javascript',
        enabled: false, // Multi-level navigation required
        description: 'Clinical guidelines',
        linkPattern: /\.pdf$/i,
        notes: 'Manages lab benefits for Cigna, Aetna, and others. Multi-level navigation to reach PDFs.',
        policyUrlPattern: 'https://www.evicore.com/sites/default/files/clinical-guidelines/{year}/{filename}.pdf',
      },
    ],
    searchKeywords: [
      'liquid biopsy',
      'molecular',
      'genetic',
      'oncology',
      'MRD',
      'ctDNA',
    ],
  },

  carelon: {
    name: 'Carelon (formerly AIM Specialty Health)',
    tier: 1,
    indexPages: [
      {
        id: 'carelon-genetic-guidelines',
        url: 'https://guidelines.carelonmedicalbenefitsmanagement.com/',
        type: 'javascript',
        enabled: false, // Multi-level navigation
        description: 'Clinical guidelines portal',
        linkPattern: /\.pdf$/i,
        notes: 'Owned by Elevance/Anthem. Rebranded from AIM. Multi-level navigation.',
        policyUrlPattern: 'https://guidelines.carelonmedicalbenefitsmanagement.com/wp-content/uploads/{year}/{month}/{filename}.pdf',
      },
    ],
    searchKeywords: [
      'molecular',
      'genetic',
      'oncology',
      'tumor',
      'profiling',
      'liquid biopsy',
    ],
  },

  // ============================================================================
  // TIER 1: HCSC-operated BCBS Plans (Large market share)
  // ============================================================================

  'hcsc-tx': {
    name: 'BCBS Texas (HCSC)',
    tier: 1,
    indexPages: [
      {
        id: 'bcbstx-medical-policies',
        url: 'https://www.bcbstx.com/provider/standards/medical-policy',
        type: 'javascript',
        enabled: false, // Search-only interface
        description: 'Medical policy search',
        linkPattern: /\.pdf$/i,
        notes: 'HCSC-operated plan. Search-only interface.',
      },
    ],
    searchKeywords: [
      'molecular',
      'genetic',
      'oncology',
      'liquid biopsy',
      'tumor',
    ],
  },

  'hcsc-il': {
    name: 'BCBS Illinois (HCSC)',
    tier: 1,
    indexPages: [
      {
        id: 'bcbsil-medical-policies',
        url: 'https://www.bcbsil.com/provider/standards/medical-policy',
        type: 'javascript',
        enabled: false, // Search-only interface
        description: 'Medical policy search',
        linkPattern: /\.pdf$/i,
        notes: 'HCSC-operated plan. Search-only interface.',
      },
    ],
    searchKeywords: [
      'molecular',
      'genetic',
      'oncology',
      'liquid biopsy',
      'tumor',
    ],
  },

  // ============================================================================
  // TIER 2: Large Regional BCBS (already in policy-registry.js)
  // ============================================================================

  bcbsm: {
    name: 'BCBS Michigan',
    tier: 2,
    indexPages: [
      {
        id: 'bcbsm-medical-policies',
        url: 'https://www.bcbsm.com/providers/medical-policies.html',
        type: 'javascript',
        enabled: false, // Complex navigation
        description: 'Medical policy reference',
        linkPattern: /\.pdf$/i,
        notes: 'Has ctDNA policy already in registry. Complex navigation.',
      },
    ],
    searchKeywords: [
      'molecular',
      'genetic',
      'oncology',
      'ctDNA',
      'tumor',
    ],
  },

  blueshieldca: {
    name: 'Blue Shield of California',
    tier: 2,
    indexPages: [
      {
        id: 'bsca-medical-policies',
        url: 'https://www.blueshieldca.com/provider/policies-guidelines/medical-policies',
        type: 'javascript',
        enabled: false, // Complex navigation
        description: 'Medical policies',
        linkPattern: /\.pdf$/i,
        notes: 'Has ctDNA and algorithmic testing policies in registry. Complex navigation.',
      },
    ],
    searchKeywords: [
      'molecular',
      'oncology',
      'liquid biopsy',
      'algorithmic',
      'tumor',
    ],
  },

  highmark: {
    name: 'Highmark BCBS',
    tier: 2,
    indexPages: [
      {
        id: 'highmark-medical-policies',
        url: 'https://www.highmark.com/health/provider/medical-policy',
        type: 'javascript',
        enabled: false, // Complex navigation
        description: 'Medical policy search',
        linkPattern: /\.html$/i,
        notes: 'Has liquid biopsy policy in registry. Complex navigation.',
      },
    ],
    searchKeywords: [
      'molecular',
      'genetic',
      'liquid biopsy',
      'oncology',
    ],
  },
};

/**
 * Get all index pages as a flat array
 * @param {number} tier - Optional tier filter (1 or 2)
 * @param {Object} options - { enabledOnly: boolean }
 * @returns {Array} All index page entries with payer info
 */
export function getAllIndexPages(tier = null, options = {}) {
  const { enabledOnly = false } = options;
  const pages = [];
  for (const [payerId, payer] of Object.entries(PAYER_INDEX_REGISTRY)) {
    if (tier !== null && payer.tier !== tier) continue;

    for (const indexPage of payer.indexPages) {
      if (enabledOnly && !indexPage.enabled) continue;

      pages.push({
        ...indexPage,
        payerId,
        payerName: payer.name,
        payerTier: payer.tier,
        searchKeywords: payer.searchKeywords,
      });
    }
  }
  return pages;
}

/**
 * Get index pages by payer ID
 * @param {string} payerId - Payer identifier
 * @returns {Array} Index pages for that payer
 */
export function getIndexPagesByPayer(payerId) {
  const payer = PAYER_INDEX_REGISTRY[payerId];
  if (!payer) return [];

  return payer.indexPages.map((page) => ({
    ...page,
    payerId,
    payerName: payer.name,
    payerTier: payer.tier,
    searchKeywords: payer.searchKeywords,
  }));
}

/**
 * Get Tier 1 payers only
 * @returns {Array} Tier 1 index pages
 */
export function getTier1IndexPages() {
  return getAllIndexPages(1);
}

/**
 * Get payer by ID
 * @param {string} payerId - Payer identifier
 * @returns {Object|null} Payer object or null
 */
export function getPayerById(payerId) {
  return PAYER_INDEX_REGISTRY[payerId] || null;
}

export default PAYER_INDEX_REGISTRY;
