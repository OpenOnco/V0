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
 *
 * v2.1: EVIDENCE-GATED DELEGATION
 * Static map entries are now ADVISORY only. Delegation status is:
 * - 'suspected': In static map but no recent document evidence
 * - 'active': Document evidence detected within verification window
 * - 'confirmed': Manually verified by human reviewer
 * - 'expired': Was active but evidence is stale (>90 days without verification)
 *
 * The reconciliation engine uses status to decide how much to boost LBM layer weight.
 */

/**
 * Delegation status types
 */
export const DELEGATION_STATUS = {
  SUSPECTED: 'suspected',   // In static map, no recent evidence
  ACTIVE: 'active',         // Document evidence detected recently
  CONFIRMED: 'confirmed',   // Manually verified by human
  EXPIRED: 'expired',       // Was active but evidence is stale
};

/**
 * Evidence verification window (days)
 * Delegations without evidence within this window become 'suspected'
 */
export const EVIDENCE_WINDOW_DAYS = 90;

export const PAYER_DELEGATIONS = {
  // ============================================================================
  // CARELON DELEGATIONS
  // Carelon (formerly AIM Specialty Health) is owned by Elevance/Anthem
  // ============================================================================

  'bcbs-louisiana': {
    payerId: 'bcbsla',
    payerName: 'BCBS Louisiana',
    delegatesTo: 'carelon',
    delegatedToName: 'Carelon Medical Benefits Management',
    effectiveDate: '2024-07-01',
    scope: 'genetic_testing',
    scopeDescription: 'All genetic testing including ctDNA, MRD, and molecular profiling',

    // v2.1: Evidence-gating fields
    status: DELEGATION_STATUS.ACTIVE,  // Has document evidence
    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.lablue.com/-/media/Medical%20Policies/2022/07/11/17/15/Tumor%20Informed%20Circulating%20Tumor%20DNA%20Testing%20for%20Cancer%20Management%2000792%2020220711_accessibile%20pdf.pdf',
      quotes: ['This policy is being retired as part of partnership with Carelon. Carelon will provide genetic testing management services effective 07/01/2024.'],
      detectedAt: '2026-02-01',
      verificationMethod: 'document_detection',
    },
    lastVerified: '2026-02-01',
    notes: 'Monitor carelon-liquid-biopsy-2025 guideline for BCBSLA coverage.',
  },

  'blue-cross-idaho': {
    payerId: 'bcidaho',
    payerName: 'Blue Cross of Idaho',
    delegatesTo: 'carelon',
    delegatedToName: 'Carelon Medical Benefits Management',
    effectiveDate: '2026-01-01',
    scope: 'genetic_testing',
    scopeDescription: 'Genetic and molecular testing benefit management',

    // v2.1: Evidence-gating fields
    status: DELEGATION_STATUS.ACTIVE,
    staticSource: true,
    evidence: {
      sourceUrl: 'https://providers.bcidaho.com/medical-management/medical-policies/med/mp_204141.page',
      quotes: ['Transitioning to Carelon Jan 2026.'],
      detectedAt: '2026-02-01',
      verificationMethod: 'document_detection',
    },
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
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2023-01-01',
    scope: 'molecular_genomic_testing',
    scopeDescription: 'Molecular and genomic testing prior authorization',

    // v2.1: Evidence-gating fields
    status: DELEGATION_STATUS.ACTIVE,
    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.horizonblue.com/providers/products-programs/evicore-health-care/molecular-and-genomic-testing-program',
      quotes: ['Horizon uses eviCore for molecular/genomic testing authorizations.'],
      detectedAt: '2026-02-01',
      verificationMethod: 'document_detection',
    },
    lastVerified: '2026-02-01',
    notes: 'Monitor evicore-liquid-biopsy-2026 guideline for Horizon NJ coverage.',
  },

  'wellmark-bcbs': {
    payerId: 'wellmark',
    payerName: 'Wellmark BCBS (Iowa/South Dakota)',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2022-01-01',
    scope: 'molecular_testing',
    scopeDescription: 'Molecular testing including liquid biopsy',

    // v2.1: Evidence-gating fields
    status: DELEGATION_STATUS.ACTIVE,
    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.wellmark.com/Provider/MedPoliciesAndAuthorizations/MedicalPolicies/policies/Detection_Quantification.aspx',
      quotes: ['Uses eviCore for molecular testing.'],
      detectedAt: '2026-02-01',
      verificationMethod: 'document_detection',
    },
    lastVerified: '2026-02-01',
    notes: 'Policy notes eviCore delegation.',
  },

  // Cigna's own plans often route through eviCore internally
  // NOTE: No document evidence - marked as SUSPECTED
  'cigna-internal': {
    payerId: 'cigna',
    payerName: 'Cigna',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare (internal)',
    effectiveDate: '2020-01-01',
    scope: 'lab_benefits',
    scopeDescription: 'Lab benefit management including molecular testing (select plans)',

    // v2.1: Evidence-gating fields
    status: DELEGATION_STATUS.SUSPECTED,  // No document evidence
    staticSource: true,
    evidence: null,  // No document evidence available
    lastVerified: '2026-02-01',
    notes: 'eviCore is owned by Cigna parent company Evernorth. Not all Cigna plans delegate. No explicit document evidence.',
  },
};

/**
 * Runtime evidence store for detected delegations
 * Populated by crawler when delegation patterns are detected
 */
const detectedDelegations = new Map();

/**
 * Get the authoritative guideline source for a payer (basic lookup)
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
 * Store detected delegation evidence from crawler
 * @param {string} payerId - Payer ID
 * @param {Object} evidence - Evidence object
 */
export function storeDetectedDelegation(payerId, evidence) {
  detectedDelegations.set(payerId, {
    ...evidence,
    detectedAt: new Date().toISOString(),
  });
}

/**
 * Get detected delegation evidence
 * @param {string} payerId - Payer ID
 * @returns {Object|null} Detected evidence or null
 */
export function getDetectedDelegation(payerId) {
  return detectedDelegations.get(payerId) || null;
}

/**
 * Get delegation status with evidence gating
 * v2.1: Returns status based on both static map and detected evidence
 *
 * @param {string} payerId - Payer ID
 * @returns {Object|null} Delegation with computed status
 */
export function getDelegationStatus(payerId) {
  const staticDelegation = getDelegation(payerId);
  const detected = getDetectedDelegation(payerId);

  // No delegation known
  if (!staticDelegation && !detected) {
    return null;
  }

  // Only detected (new delegation not in static map)
  if (!staticDelegation && detected) {
    return {
      payerId,
      delegatesTo: detected.delegatesTo,
      status: detected.confidence > 0.8 ? DELEGATION_STATUS.ACTIVE : DELEGATION_STATUS.SUSPECTED,
      staticSource: false,
      evidence: detected,
      lastVerified: detected.detectedAt,
    };
  }

  // Static delegation exists - check if evidence is fresh
  const base = { ...staticDelegation };

  // If we have recent detected evidence, promote to active
  if (detected && detected.confidence > 0.8) {
    base.status = DELEGATION_STATUS.ACTIVE;
    base.evidence = detected;
    base.lastVerified = detected.detectedAt;
    return base;
  }

  // Check if static evidence is within window
  if (staticDelegation.lastVerified) {
    const verifiedDate = new Date(staticDelegation.lastVerified);
    const daysSinceVerified = (Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceVerified > EVIDENCE_WINDOW_DAYS) {
      // Evidence is stale
      base.status = staticDelegation.evidence ? DELEGATION_STATUS.EXPIRED : DELEGATION_STATUS.SUSPECTED;
    }
  }

  return base;
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

export default {
  PAYER_DELEGATIONS,
  DELEGATION_STATUS,
  EVIDENCE_WINDOW_DAYS,
  getDelegation,
  getDelegationStatus,
  storeDetectedDelegation,
  getDetectedDelegation,
  getPayersByLBM,
  isDelegated,
  DELEGATION_PATTERNS,
};
