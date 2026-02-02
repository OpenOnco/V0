/**
 * Payer Delegation Map
 *
 * Tracks which payers delegate genetic/molecular testing benefit management
 * to Lab Benefit Managers (LBMs) like Carelon or eviCore.
 *
 * When a payer delegates to an LBM:
 * 1. The payer's own medical policy may become advisory only
 * 2. The LBM's guidelines become operationally authoritative
 * 3. Prior auth requests route through the LBM
 *
 * This map helps the crawler:
 * - Know to monitor LBM guidelines for delegated payers
 * - Detect when a payer announces new delegation
 * - Reconcile coverage assertions from multiple sources
 */

export const PAYER_DELEGATIONS = {
  // ============================================================================
  // CARELON DELEGATIONS
  // Carelon (formerly AIM Specialty Health) is owned by Elevance/Anthem
  // ============================================================================

  'bcbs-louisiana': {
    payerId: 'bcbsla',
    payerName: 'BCBS Louisiana',
    delegatedTo: 'carelon',
    delegatedToName: 'Carelon Medical Benefits Management',
    effectiveDate: '2024-07-01',
    scope: 'genetic_testing',
    scopeDescription: 'All genetic testing including ctDNA, MRD, and molecular profiling',
    sourceUrl: 'https://www.lablue.com/-/media/Medical%20Policies/2022/07/11/17/15/Tumor%20Informed%20Circulating%20Tumor%20DNA%20Testing%20for%20Cancer%20Management%2000792%2020220711_accessibile%20pdf.pdf',
    sourceQuote: 'This policy is being retired as part of partnership with Carelon. Carelon will provide genetic testing management services effective 07/01/2024.',
    lastVerified: '2026-02-01',
    notes: 'Monitor carelon-liquid-biopsy-2025 guideline for BCBSLA coverage.',
  },

  'blue-cross-idaho': {
    payerId: 'bcidaho',
    payerName: 'Blue Cross of Idaho',
    delegatedTo: 'carelon',
    delegatedToName: 'Carelon Medical Benefits Management',
    effectiveDate: '2026-01-01',
    scope: 'genetic_testing',
    scopeDescription: 'Genetic and molecular testing benefit management',
    sourceUrl: 'https://providers.bcidaho.com/medical-management/medical-policies/med/mp_204141.page',
    sourceQuote: 'Transitioning to Carelon Jan 2026.',
    lastVerified: '2026-02-01',
    notes: 'Transition announced in policy MP 2.04.141.',
  },

  // ============================================================================
  // EVICORE DELEGATIONS
  // eviCore (owned by Evernorth/Cigna) manages lab benefits for multiple payers
  // ============================================================================

  'horizon-bcbs-nj': {
    payerId: 'horizonnj',
    payerName: 'Horizon BCBS New Jersey',
    delegatedTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2023-01-01',
    scope: 'molecular_genomic_testing',
    scopeDescription: 'Molecular and genomic testing prior authorization',
    sourceUrl: 'https://www.horizonblue.com/providers/products-programs/evicore-health-care/molecular-and-genomic-testing-program',
    sourceQuote: 'Horizon uses eviCore for molecular/genomic testing authorizations.',
    lastVerified: '2026-02-01',
    notes: 'Monitor evicore-liquid-biopsy-2026 guideline for Horizon NJ coverage.',
  },

  'wellmark-bcbs': {
    payerId: 'wellmark',
    payerName: 'Wellmark BCBS (Iowa/South Dakota)',
    delegatedTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2022-01-01',
    scope: 'molecular_testing',
    scopeDescription: 'Molecular testing including liquid biopsy',
    sourceUrl: 'https://www.wellmark.com/Provider/MedPoliciesAndAuthorizations/MedicalPolicies/policies/Detection_Quantification.aspx',
    sourceQuote: 'Uses eviCore for molecular testing.',
    lastVerified: '2026-02-01',
    notes: 'Policy notes eviCore delegation.',
  },

  // Cigna's own plans often route through eviCore internally
  'cigna-internal': {
    payerId: 'cigna',
    payerName: 'Cigna',
    delegatedTo: 'evicore',
    delegatedToName: 'eviCore Healthcare (internal)',
    effectiveDate: '2020-01-01',
    scope: 'lab_benefits',
    scopeDescription: 'Lab benefit management including molecular testing (select plans)',
    sourceUrl: null,
    sourceQuote: null,
    lastVerified: '2026-02-01',
    notes: 'eviCore is owned by Cigna parent company Evernorth. Not all Cigna plans delegate.',
  },
};

/**
 * Get the authoritative guideline source for a payer
 * @param {string} payerId - The payer ID
 * @returns {object|null} Delegation info if delegated, null if payer manages internally
 */
export function getDelegation(payerId) {
  // Check direct match
  const delegation = Object.values(PAYER_DELEGATIONS).find(d => d.payerId === payerId);
  if (delegation) {
    return delegation;
  }

  // Check by key (some entries use hyphenated keys)
  const byKey = PAYER_DELEGATIONS[payerId];
  if (byKey) {
    return byKey;
  }

  return null;
}

/**
 * Get all payers delegated to a specific LBM
 * @param {string} lbmId - 'carelon' or 'evicore'
 * @returns {Array} List of delegations
 */
export function getPayersByLBM(lbmId) {
  return Object.values(PAYER_DELEGATIONS).filter(d => d.delegatedTo === lbmId);
}

/**
 * Check if a payer delegates to an LBM for the given scope
 * @param {string} payerId - The payer ID
 * @param {string} scope - 'genetic_testing', 'molecular_testing', 'lab_benefits'
 * @returns {boolean}
 */
export function isDelegated(payerId, scope = 'genetic_testing') {
  const delegation = getDelegation(payerId);
  if (!delegation) return false;

  // Check if the delegation scope matches or is broader
  const scopeHierarchy = ['lab_benefits', 'molecular_testing', 'molecular_genomic_testing', 'genetic_testing'];
  const delegationScopeIndex = scopeHierarchy.indexOf(delegation.scope);
  const queryScopeIndex = scopeHierarchy.indexOf(scope);

  // If delegation scope is broader (lower index), it covers the query scope
  return delegationScopeIndex <= queryScopeIndex;
}

/**
 * Patterns that indicate delegation in policy text
 * Used by the crawler to detect new delegations
 */
export const DELEGATION_PATTERNS = [
  // Explicit delegation language
  /(?:retired|replaced|superseded).*(?:carelon|evicore|aim\s+specialty)/i,
  /delegated?\s+to\s+(?:carelon|evicore|aim)/i,
  /(?:carelon|evicore|aim)\s+(?:will|now)\s+(?:manage|provide|handle)/i,
  /genetic\s+testing\s+management\s+(?:services|program)/i,
  /(?:effective|starting|beginning)\s+(\d{1,2}\/\d{1,2}\/\d{4}).*(?:carelon|evicore)/i,
  /partnership\s+with\s+(?:carelon|evicore)/i,
  /(?:carelon|evicore)\s+partnership/i,
  /transitioning\s+to\s+(?:carelon|evicore)/i,

  // Prior auth routing language
  /prior\s+auth(?:orization)?\s+(?:requests?\s+)?(?:through|via|to)\s+(?:carelon|evicore)/i,
  /(?:carelon|evicore)\s+(?:portal|system)\s+for\s+(?:prior\s+auth|authorization)/i,
];

export default PAYER_DELEGATIONS;
