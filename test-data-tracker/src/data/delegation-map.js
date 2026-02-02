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
 * Delegation evidence levels (how confident are we this delegation exists?)
 * v2.1.1: Separated from effectiveness to avoid "active vs confirmed" confusion
 */
export const DELEGATION_EVIDENCE = {
  SUSPECTED: 'suspected',   // In static map or single weak signal, needs verification
  CONFIRMED: 'confirmed',   // Multiple sources or manual verification
};

/**
 * Delegation effectiveness (is it currently in force?)
 * v2.1.1: Separated from evidence level
 */
export const DELEGATION_EFFECTIVENESS = {
  PENDING: 'pending',       // Future effective date not yet reached
  EFFECTIVE: 'effective',   // Currently in force
  EXPIRED: 'expired',       // Past end date or superseded
};

/**
 * Line of business types for delegation scope
 * v2.1.1: Delegation often varies by product line
 */
export const LINE_OF_BUSINESS = {
  COMMERCIAL: 'commercial',
  MEDICARE_ADVANTAGE: 'medicare_advantage',
  MEDICAID: 'medicaid',
  EXCHANGE: 'exchange',
  ALL: 'all',
};

/**
 * @deprecated Use DELEGATION_EVIDENCE and DELEGATION_EFFECTIVENESS instead
 * Kept for backwards compatibility during transition
 */
export const DELEGATION_STATUS = {
  SUSPECTED: 'suspected',
  ACTIVE: 'active',         // Maps to: confirmed + effective
  CONFIRMED: 'confirmed',   // Maps to: confirmed (any effectiveness)
  EXPIRED: 'expired',       // Maps to: any evidence + expired
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
    effectiveEndDate: null,  // v2.1.1: null = no known end date
    scope: 'genetic_testing',
    scopeDescription: 'All genetic testing including ctDNA, MRD, and molecular profiling',

    // v2.1.1: Separated evidence and effectiveness
    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    // v2.1.1: Line of business applicability
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL, LINE_OF_BUSINESS.EXCHANGE],
    lobNotes: 'Medicare Advantage follows CMS LCD; Medicaid follows state guidelines',

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
    effectiveEndDate: null,
    scope: 'genetic_testing',
    scopeDescription: 'Genetic and molecular testing benefit management',

    // v2.1.1: Separated evidence and effectiveness
    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.ALL],
    lobNotes: null,

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
    effectiveEndDate: null,
    scope: 'molecular_genomic_testing',
    scopeDescription: 'Molecular and genomic testing prior authorization',

    // v2.1.1: Separated evidence and effectiveness
    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    // v2.1.1: LOB-specific delegation
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL],
    lobNotes: 'Medicare Advantage NOT delegated - uses internal Horizon policies',

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
    effectiveEndDate: null,
    scope: 'molecular_testing',
    scopeDescription: 'Molecular testing including liquid biopsy',

    // v2.1.1: Separated evidence and effectiveness
    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL, LINE_OF_BUSINESS.EXCHANGE],
    lobNotes: null,

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
    effectiveEndDate: null,
    scope: 'lab_benefits',
    scopeDescription: 'Lab benefit management including molecular testing (select plans)',

    // v2.1.1: Separated evidence and effectiveness - SUSPECTED due to no doc evidence
    evidenceLevel: DELEGATION_EVIDENCE.SUSPECTED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,  // Likely effective but unconfirmed
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL],  // Only some commercial plans
    lobNotes: 'Not all Cigna plans delegate. Plan-specific verification needed.',

    staticSource: true,
    evidence: null,  // No document evidence available
    lastVerified: '2026-02-01',
    notes: 'eviCore is owned by Cigna parent company Evernorth. Not all Cigna plans delegate. No explicit document evidence.',
  },

  // ============================================================================
  // INDEPENDENCE BLUE CROSS - eviCore
  // ============================================================================

  'independence-blue-cross': {
    payerId: 'ibx',
    payerName: 'Independence Blue Cross',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2019-01-01',
    effectiveEndDate: null,
    scope: 'genetic_testing',
    scopeDescription: 'All genetic/genomic tests, molecular analyses, and cytogenetic tests',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL],
    lobNotes: 'Commercial members only. Medicare Advantage may have different requirements.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.evicore.com/resources/healthplan/independence-blue-cross',
      quotes: ['Precertification has been delegated to eviCore healthcare for genetic/genomic tests, certain molecular analyses, and cytogenetic tests.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Labs must ensure precertification is on file before rendering services.',
  },

  // ============================================================================
  // CAPITAL BLUE CROSS - eviCore
  // ============================================================================

  'capital-blue-cross': {
    payerId: 'capitalbcbs',
    payerName: 'Capital Blue Cross',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2020-01-01',
    effectiveEndDate: null,
    scope: 'molecular_testing',
    scopeDescription: 'Molecular Lab Management including genetic and genomic testing',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL, LINE_OF_BUSINESS.MEDICARE_ADVANTAGE],
    lobNotes: 'Commercial, CHIP, and Medicare plans require prior authorization from eviCore.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.evicore.com/resources/healthplan/Capital_Blue_Cross',
      quotes: ['Capital Blue Cross members with Commercial, CHIP, and Medicare plans that require prior authorization from EviCore must submit requests via the CareCore National portal.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Submit via CareCore National portal for Molecular Lab Management.',
  },

  // ============================================================================
  // BCBS MICHIGAN - eviCore (Medicare) + Joint Venture Labs (BCN)
  // ============================================================================

  'bcbs-michigan-medicare': {
    payerId: 'bcbsm-ma',
    payerName: 'BCBS Michigan Medicare Plus Blue',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2023-01-01',
    effectiveEndDate: null,
    scope: 'molecular_testing',
    scopeDescription: 'Prior authorization for molecular and genetic testing',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.MEDICARE_ADVANTAGE],
    lobNotes: 'Medicare Plus Blue PPO members. Commercial PPO nationally also uses eviCore.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.evicore.com/resources/healthplan/blue-cross-blue-shield/michigan',
      quotes: ['EviCore by Evernorth provides prior authorization services for Blue Cross Blue Shield of Michigan Medicare Plus Blue PPO members.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Quick Reference Guide updated May 2025.',
  },

  // ============================================================================
  // BCBS MONTANA - Carelon (Commercial) / eviCore (Government)
  // ============================================================================

  'bcbs-montana-commercial': {
    payerId: 'bcbsmt-comm',
    payerName: 'BCBS Montana (Commercial)',
    delegatesTo: 'carelon',
    delegatedToName: 'Carelon Medical Benefits Management',
    effectiveDate: '2026-01-01',
    effectiveEndDate: null,
    scope: 'genetic_testing',
    scopeDescription: 'Genetic testing prior authorization for commercial members',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL],
    lobNotes: 'Medicare Advantage and Medicaid use eviCore instead.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.bcbsmt.com/provider/education-and-reference/education/news-and-updates/2025/10-01-2025-prior-authorization-changes',
      quotes: ['Changes include addition of Genetic Testing codes to be reviewed by Carelon for commercial members.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Effective Jan 1, 2026. Part of Elevance/Anthem family.',
  },

  'bcbs-montana-government': {
    payerId: 'bcbsmt-gov',
    payerName: 'BCBS Montana (Medicare/Medicaid)',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2026-01-01',
    effectiveEndDate: null,
    scope: 'molecular_testing',
    scopeDescription: 'Molecular Genetic Lab Testing for government program members',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.MEDICARE_ADVANTAGE, LINE_OF_BUSINESS.MEDICAID],
    lobNotes: 'Commercial members use Carelon instead.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.bcbsmt.com/provider/education-and-reference/education/news-and-updates/2025/10-01-2025-prior-authorization-changes',
      quotes: ['Addition of Molecular Genetic Lab Testing codes to be reviewed by EviCore for government programs.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Effective Jan 1, 2026.',
  },

  // ============================================================================
  // BCBS ILLINOIS - eviCore (Medicare Advantage)
  // ============================================================================

  'bcbs-illinois-ma': {
    payerId: 'bcbsil-ma',
    payerName: 'BCBS Illinois (Medicare Advantage)',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2026-01-01',
    effectiveEndDate: null,
    scope: 'molecular_testing',
    scopeDescription: 'Molecular Genetic Lab Testing prior authorization',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.MEDICARE_ADVANTAGE],
    lobNotes: 'Medicare Advantage members only.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.bcbsil.com/provider/education/education-reference/news/2025/10-01-2025-prior-authorization-changes',
      quotes: ['Addition of Molecular Genetic Lab Testing codes to be reviewed by EviCore (MA).'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Effective Jan 1, 2026. Part of HCSC family.',
  },

  // ============================================================================
  // BCBS TEXAS - eviCore (Medicare Advantage)
  // ============================================================================

  'bcbs-texas-ma': {
    payerId: 'bcbstx-ma',
    payerName: 'BCBS Texas (Medicare Advantage)',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2026-01-01',
    effectiveEndDate: null,
    scope: 'molecular_testing',
    scopeDescription: 'Molecular Genetic Lab Testing prior authorization',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.MEDICARE_ADVANTAGE],
    lobNotes: 'Government program members only.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.bcbstx.com/provider/education/education/news/2025/10-01-2025-prior-authorization-changes',
      quotes: ['Addition of Molecular Genetic Lab Testing codes to be reviewed by EviCore for government programs.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Effective Jan 1, 2026. Part of HCSC family.',
  },

  // ============================================================================
  // BCBS OKLAHOMA - eviCore (Medicare)
  // ============================================================================

  'bcbs-oklahoma-medicare': {
    payerId: 'bcbsok-ma',
    payerName: 'BCBS Oklahoma (Medicare)',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2023-01-01',
    effectiveEndDate: null,
    scope: 'molecular_testing',
    scopeDescription: 'Molecular and genetic lab testing prior authorization',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.MEDICARE_ADVANTAGE],
    lobNotes: 'Medicare plans only.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.evicore.com/resources/healthplan/blue-cross-blue-shield/oklahoma/medicare',
      quotes: ['eviCore healthcare provides prior authorization services for BCBS Oklahoma Medicare plans.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Part of HCSC family.',
  },

  // ============================================================================
  // BCBS NEW MEXICO - eviCore (Medicare)
  // ============================================================================

  'bcbs-new-mexico-medicare': {
    payerId: 'bcbsnm-ma',
    payerName: 'BCBS New Mexico (Medicare)',
    delegatesTo: 'evicore',
    delegatedToName: 'eviCore Healthcare',
    effectiveDate: '2023-01-01',
    effectiveEndDate: null,
    scope: 'molecular_testing',
    scopeDescription: 'Molecular and genetic lab testing prior authorization',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.MEDICARE_ADVANTAGE],
    lobNotes: 'Medicare plans only.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://www.evicore.com/resources/healthplan/blue-cross-blue-shield/new-mexico/medicare',
      quotes: ['eviCore healthcare provides prior authorization services for BCBS New Mexico Medicare plans.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Part of HCSC family.',
  },

  // ============================================================================
  // ANTHEM/ELEVANCE PLANS - Carelon
  // ============================================================================

  'anthem-virginia': {
    payerId: 'anthem-va',
    payerName: 'Anthem Blue Cross Blue Shield Virginia',
    delegatesTo: 'carelon',
    delegatedToName: 'Carelon Medical Benefits Management',
    effectiveDate: '2019-01-01',
    effectiveEndDate: null,
    scope: 'genetic_testing',
    scopeDescription: 'All genetic testing including hereditary cancer susceptibility and molecular profiling',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL, LINE_OF_BUSINESS.EXCHANGE],
    lobNotes: 'Does not apply to BlueCard, FEP, California HMO, Hospital Only plans, or Anthem as secondary payor.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://providernews.anthem.com/virginia/articles/transition-to-genetic-testing-guidelines-for-carelon-medical-16-16857',
      quotes: ['Carelon Medical Benefits Management performs the medical necessity review of all genetic testing services.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Elevance Health subsidiary. Monitor Carelon guidelines for Anthem VA coverage.',
  },

  'anthem-indiana': {
    payerId: 'anthem-in',
    payerName: 'Anthem Blue Cross Blue Shield Indiana',
    delegatesTo: 'carelon',
    delegatedToName: 'Carelon Medical Benefits Management',
    effectiveDate: '2019-01-01',
    effectiveEndDate: null,
    scope: 'genetic_testing',
    scopeDescription: 'Genetic testing prior authorization',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL, LINE_OF_BUSINESS.EXCHANGE],
    lobNotes: 'Exclusions apply for certain plan types.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://providernews.anthem.com/indiana/articles/carelon-genetic-testing-cpt-code-list-update',
      quotes: ['Carelon genetic testing CPT code list update for Anthem Indiana.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Elevance Health subsidiary.',
  },

  'anthem-new-york': {
    payerId: 'anthem-ny',
    payerName: 'Anthem Blue Cross Blue Shield New York',
    delegatesTo: 'carelon',
    delegatedToName: 'Carelon Medical Benefits Management',
    effectiveDate: '2019-01-01',
    effectiveEndDate: null,
    scope: 'genetic_testing',
    scopeDescription: 'Genetic testing prior authorization',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL],
    lobNotes: 'Commercial plans. Medicaid may have separate requirements.',

    staticSource: true,
    evidence: {
      sourceUrl: 'https://providernews.anthem.com/new-york/articles/carelon-medical-benefits-management-inc-genetic-testing-code-2-17956',
      quotes: ['Carelon Medical Benefits Management genetic testing code updates for Anthem New York.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Elevance Health subsidiary.',
  },

  // ============================================================================
  // BLUE CROSS MA - Carelon
  // ============================================================================

  'blue-cross-ma': {
    payerId: 'bcbsma',
    payerName: 'Blue Cross Blue Shield Massachusetts',
    delegatesTo: 'carelon',
    delegatedToName: 'Carelon Medical Benefits Management',
    effectiveDate: '2020-01-01',
    effectiveEndDate: null,
    scope: 'genetic_testing',
    scopeDescription: 'Genetic testing prior authorization',

    evidenceLevel: DELEGATION_EVIDENCE.CONFIRMED,
    effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,
    linesOfBusiness: [LINE_OF_BUSINESS.COMMERCIAL],
    lobNotes: null,

    staticSource: true,
    evidence: {
      sourceUrl: 'https://provider.bluecrossma.com/ProviderHome/portal/home/clinical-resources/prior-authorization/genetic-testing',
      quotes: ['Blue Cross Blue Shield Massachusetts uses Carelon for genetic testing prior authorization.'],
      detectedAt: '2026-02-02',
      verificationMethod: 'web_search',
    },
    lastVerified: '2026-02-02',
    notes: 'Independent BCBS plan (not Anthem/Elevance).',
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
 * v2.1.1: Returns separated evidence level and effectiveness
 *
 * @param {string} payerId - Payer ID
 * @param {Object} options - { lineOfBusiness?: string }
 * @returns {Object|null} Delegation with computed status
 */
export function getDelegationStatus(payerId, options = {}) {
  const { lineOfBusiness } = options;
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
      // v2.1.1: Separated axes
      evidenceLevel: detected.confidence > 0.8
        ? DELEGATION_EVIDENCE.CONFIRMED
        : DELEGATION_EVIDENCE.SUSPECTED,
      effectiveness: DELEGATION_EFFECTIVENESS.EFFECTIVE,  // Assume effective if detected
      // Legacy field for backwards compatibility
      status: detected.confidence > 0.8 ? DELEGATION_STATUS.ACTIVE : DELEGATION_STATUS.SUSPECTED,
      staticSource: false,
      evidence: detected,
      lastVerified: detected.detectedAt,
      linesOfBusiness: [LINE_OF_BUSINESS.ALL],  // Unknown, assume all
      lobApplicable: true,
    };
  }

  // Static delegation exists - build result
  const base = { ...staticDelegation };

  // v2.1.1: Check LOB applicability
  if (lineOfBusiness && base.linesOfBusiness) {
    const lobApplicable = base.linesOfBusiness.includes(LINE_OF_BUSINESS.ALL) ||
      base.linesOfBusiness.includes(lineOfBusiness);
    base.lobApplicable = lobApplicable;

    if (!lobApplicable) {
      // Delegation exists but not for this LOB
      return {
        ...base,
        lobApplicable: false,
        routingNote: `Delegation to ${base.delegatesTo} does not apply to ${lineOfBusiness}. ${base.lobNotes || ''}`.trim(),
      };
    }
  } else {
    base.lobApplicable = true;
  }

  // v2.1.1: Compute effectiveness based on dates
  const now = new Date();
  if (base.effectiveDate) {
    const effectiveDate = new Date(base.effectiveDate);
    if (effectiveDate > now) {
      base.effectiveness = DELEGATION_EFFECTIVENESS.PENDING;
    }
  }
  if (base.effectiveEndDate) {
    const endDate = new Date(base.effectiveEndDate);
    if (endDate < now) {
      base.effectiveness = DELEGATION_EFFECTIVENESS.EXPIRED;
    }
  }

  // If we have recent detected evidence, upgrade evidence level
  if (detected && detected.confidence > 0.8) {
    base.evidenceLevel = DELEGATION_EVIDENCE.CONFIRMED;
    base.evidence = detected;
    base.lastVerified = detected.detectedAt;
  }

  // Check if static evidence is within window (affects evidence level)
  if (staticDelegation.lastVerified) {
    const verifiedDate = new Date(staticDelegation.lastVerified);
    const daysSinceVerified = (Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceVerified > EVIDENCE_WINDOW_DAYS && !detected) {
      // Evidence is stale - downgrade to suspected
      base.evidenceLevel = DELEGATION_EVIDENCE.SUSPECTED;
    }
  }

  // v2.1.1: Compute legacy status for backwards compatibility
  base.status = computeLegacyStatus(base.evidenceLevel, base.effectiveness);

  return base;
}

/**
 * Compute legacy status from new separated axes
 * @private
 */
function computeLegacyStatus(evidenceLevel, effectiveness) {
  if (effectiveness === DELEGATION_EFFECTIVENESS.EXPIRED) {
    return DELEGATION_STATUS.EXPIRED;
  }
  if (evidenceLevel === DELEGATION_EVIDENCE.SUSPECTED) {
    return DELEGATION_STATUS.SUSPECTED;
  }
  if (evidenceLevel === DELEGATION_EVIDENCE.CONFIRMED &&
      effectiveness === DELEGATION_EFFECTIVENESS.EFFECTIVE) {
    return DELEGATION_STATUS.ACTIVE;
  }
  return DELEGATION_STATUS.CONFIRMED;
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
  // v2.1.1: New separated axes
  DELEGATION_EVIDENCE,
  DELEGATION_EFFECTIVENESS,
  LINE_OF_BUSINESS,
  // Legacy (deprecated)
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
