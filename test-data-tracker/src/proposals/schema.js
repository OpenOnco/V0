/**
 * Proposal Schema Definitions
 *
 * Proposals represent suggested changes to test data that require human review.
 * All changes go through this queue before being applied to data.js.
 *
 * v2 additions:
 * - COVERAGE_ASSERTION: Layered coverage model with policy stance / UM criteria / delegation
 * - DOCUMENT_CANDIDATE: New policy documents discovered for registry addition
 * - DELEGATION_CHANGE: Payer → LBM delegation announcements
 */

/**
 * Proposal types
 */
export const PROPOSAL_TYPES = {
  COVERAGE: 'coverage',               // Coverage status updates (v1 - simple)
  UPDATE: 'update',                   // Test record updates (performance, trials)
  NEW_TEST: 'new-test',               // New test submissions
  // v2 additions
  COVERAGE_ASSERTION: 'coverage-assertion',  // Layered coverage (policy/UM/delegation)
  DOCUMENT_CANDIDATE: 'document-candidate',  // Discovered policy documents
  DELEGATION_CHANGE: 'delegation-change',    // Payer delegation announcements
};

/**
 * Proposal states
 */
export const PROPOSAL_STATES = {
  PENDING: 'pending',         // Awaiting review
  APPROVED: 'approved',       // Ready to apply
  APPLIED: 'applied',         // Changes committed to data.js
  REJECTED: 'rejected',       // Discarded with reason
};

/**
 * Coverage status values (v1 - simple model)
 */
export const COVERAGE_STATUS = {
  COVERED: 'covered',
  NOT_COVERED: 'not_covered',
  CONDITIONAL: 'conditional',
  PRIOR_AUTH: 'prior_auth_required',
  UNKNOWN: 'unknown',
};

/**
 * v2: Coverage assertion layers
 * Priority order for reconciliation (1 = highest authority)
 */
export const COVERAGE_LAYERS = {
  UM_CRITERIA: 'um_criteria',           // 1. Operational utilization management rules
  LBM_GUIDELINE: 'lbm_guideline',       // 2. Delegated LBM (Carelon/eviCore) guidelines
  DELEGATION: 'delegation',             // 3. Delegation status (who manages)
  POLICY_STANCE: 'policy_stance',       // 4. Medical policy evidence review
  OVERLAY: 'overlay',                   // 5. State mandates, Medicare references
};

/**
 * v2: Coverage assertion status values
 */
export const ASSERTION_STATUS = {
  SUPPORTS: 'supports',     // Test is covered / medically necessary
  RESTRICTS: 'restricts',   // Covered with significant restrictions
  DENIES: 'denies',         // Not covered / investigational / unproven
  UNCLEAR: 'unclear',       // Ambiguous language, needs manual review
};

/**
 * v2: Document types for policy registry
 */
export const DOC_TYPES = {
  MEDICAL_POLICY: 'medical_policy',     // Evidence review stance
  UM_CRITERIA: 'um_criteria',           // Operational prior auth rules
  LBM_GUIDELINE: 'lbm_guideline',       // Lab Benefit Manager guidelines
  PROVIDER_BULLETIN: 'provider_bulletin', // Delegation, code changes
  INDEX_PAGE: 'index_page',             // Policy search/discovery page
};

/**
 * Generate a unique proposal ID
 * @param {string} type - Proposal type (coverage, update, new-test)
 * @returns {string} Unique ID like "cov-2024-001"
 */
export function generateProposalId(type) {
  const prefixes = {
    [PROPOSAL_TYPES.COVERAGE]: 'cov',
    [PROPOSAL_TYPES.UPDATE]: 'upd',
    [PROPOSAL_TYPES.NEW_TEST]: 'new',
    // v2 types
    [PROPOSAL_TYPES.COVERAGE_ASSERTION]: 'ca',
    [PROPOSAL_TYPES.DOCUMENT_CANDIDATE]: 'doc',
    [PROPOSAL_TYPES.DELEGATION_CHANGE]: 'del',
  };
  const prefix = prefixes[type] || 'prop';
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36);
  return `${prefix}-${year}-${timestamp}`;
}

/**
 * Coverage proposal schema
 * Used for payer coverage status changes
 *
 * NOTE: data.js uses two coverage structures:
 * 1. Simple: commercialPayers[] array + commercialPayersNotes
 * 2. Detailed: coverageCrossReference.privatePayers.{payerId}
 *
 * When applying coverage proposals, choose the appropriate structure
 * based on whether the test already has coverageCrossReference.
 */
export const coverageProposalSchema = {
  id: '',                     // e.g., "cov-2024-abc123"
  type: PROPOSAL_TYPES.COVERAGE,
  status: PROPOSAL_STATES.PENDING,

  // What's being changed
  testId: '',                 // ID from data.js (e.g., "mrd-7", "tds-1")
  testName: '',               // Human-readable name (for lookup if testId unknown)
  payer: '',                  // Payer display name (e.g., "Blue Shield of California")
  payerId: '',                // Payer ID for privatePayers key (e.g., "blueshieldca")

  // The proposed change - maps to data.js structures
  coverageStatus: '',         // COVERED | PARTIAL | CONDITIONAL | EXPERIMENTAL | NOT_COVERED
  conditions: '',             // Coverage conditions (goes in commercialPayersNotes or privatePayers.notes)
  coveredIndications: [],     // Specific indications covered (for privatePayers structure)
  effectiveDate: null,        // When coverage takes effect
  policyNumber: '',           // Policy ID (e.g., "CPB 0715")
  policyUrl: '',              // Direct URL to policy document

  // Evidence
  source: '',                 // URL where this was discovered
  sourceTitle: '',            // Title of source page
  confidence: 0,              // AI confidence score (0-1)
  snippet: '',                // Relevant text snippet

  // Metadata
  createdAt: '',              // ISO timestamp
  createdBy: 'daemon',        // Source system
  reviewedAt: null,           // When reviewed
  reviewedBy: null,           // Who reviewed
  appliedAt: null,            // When applied
  rejectionReason: null,      // If rejected, why
};

/**
 * Update proposal schema
 * Used for test record updates (performance, trials, etc.)
 */
export const updateProposalSchema = {
  id: '',                     // e.g., "upd-2024-abc123"
  type: PROPOSAL_TYPES.UPDATE,
  status: PROPOSAL_STATES.PENDING,

  // What's being changed
  testId: '',                 // ID from data.js
  testName: '',               // Human-readable name

  // The proposed changes (field -> value)
  changes: {
    // Examples:
    // sensitivity: { old: '95%', new: '97%', context: 'Stage II CRC' },
    // turnaroundTime: { old: '7 days', new: '5 days' },
    // clinicalTrials: { added: ['NCT12345678'] },
  },

  // Evidence
  source: '',                 // URL where this was discovered
  sourceTitle: '',            // Title of source page
  confidence: 0,              // AI confidence score (0-1)
  quotes: [],                 // Exact quotes from source

  // Metadata
  createdAt: '',
  createdBy: 'daemon',
  reviewedAt: null,
  reviewedBy: null,
  appliedAt: null,
  rejectionReason: null,
};

/**
 * New test proposal schema
 * Used for adding new tests to the database
 */
export const newTestProposalSchema = {
  id: '',                     // e.g., "new-2024-abc123"
  type: PROPOSAL_TYPES.NEW_TEST,
  status: PROPOSAL_STATES.PENDING,

  // Proposed test data (follows SUBMISSION_PROCESS.md format)
  testData: {
    name: '',                 // Test name
    vendor: '',               // Vendor name
    category: '',             // mrd | tds | ecd | hct | trm
    description: '',          // Brief description

    // Optional fields that may need manual completion
    cancerTypes: [],          // Array of cancer types
    biomarkers: [],           // Array of biomarkers
    sampleType: '',           // Blood, tissue, etc.
    turnaroundTime: '',       // Expected TAT
    sensitivity: '',          // If available
    specificity: '',          // If available

    // Regulatory
    fdaApproved: false,
    fdaApprovalDate: null,
    plaCode: null,

    // Links
    vendorUrl: '',
    orderingUrl: '',
  },

  // Evidence
  source: '',                 // URL where this was discovered
  sourceTitle: '',            // Title of source page
  confidence: 0,              // AI confidence score
  launchDate: null,           // Announced launch date

  // Metadata
  createdAt: '',
  createdBy: 'daemon',
  reviewedAt: null,
  reviewedBy: null,
  appliedAt: null,
  rejectionReason: null,

  // After approval, set vendorVerified: false until confirmed with vendor
  vendorVerified: false,
};

// =============================================================================
// v2: NEW PROPOSAL SCHEMAS
// =============================================================================

/**
 * v2: Coverage assertion proposal schema
 * Layered coverage model with explicit source tracking
 */
export const coverageAssertionProposalSchema = {
  id: '',                     // e.g., "ca-2026-abc123"
  type: PROPOSAL_TYPES.COVERAGE_ASSERTION,
  status: PROPOSAL_STATES.PENDING,

  // What's being asserted
  payerId: '',                // Payer ID
  payerName: '',              // Human-readable name
  testId: '',                 // Test ID from data.js
  testName: '',               // Human-readable test name

  // The layer this assertion applies to
  layer: '',                  // um_criteria | lbm_guideline | delegation | policy_stance | overlay

  // Coverage status
  assertionStatus: '',        // supports | restricts | denies | unclear

  // Detailed criteria (structured)
  criteria: {
    cancerTypes: [],          // ["CRC", "Breast", "NSCLC"]
    stages: [],               // ["Stage II", "Stage III"]
    settings: [],             // ["post-surgical", "surveillance", "neoadjuvant"]
    frequency: null,          // "every 3 months" or null
    priorAuth: null,          // "required" | "not_required" | "unknown"
    timeWindow: null,         // "within 3 months of surgery"
    otherRequirements: [],    // Other listed requirements
    exclusions: [],           // Explicit exclusions
  },

  // Source document
  sourceDocumentId: '',       // Policy ID from policy_hashes
  sourceUrl: '',              // Direct URL
  sourceDocType: '',          // medical_policy | um_criteria | lbm_guideline
  sourceCitation: '',         // Page/section reference
  sourceQuote: '',            // Exact quote from document

  // Validity
  effectiveDate: null,        // When this takes effect
  expirationDate: null,       // When this expires (if known)
  confidence: 0,              // AI confidence (0-1)

  // Conflict info (if this contradicts other assertions)
  conflictsWith: [],          // Array of conflicting assertion IDs
  conflictResolution: null,   // How to resolve (if any)

  // Metadata
  createdAt: '',
  createdBy: 'daemon',
  reviewedAt: null,
  reviewedBy: null,
  appliedAt: null,
  rejectionReason: null,
};

/**
 * v2: Document candidate proposal schema
 * For discovered policy documents to add to registry
 */
export const documentCandidateProposalSchema = {
  id: '',                     // e.g., "doc-2026-abc123"
  type: PROPOSAL_TYPES.DOCUMENT_CANDIDATE,
  status: PROPOSAL_STATES.PENDING,

  // Document info
  payerId: '',                // Payer ID
  payerName: '',              // Human-readable name
  url: '',                    // Document URL
  title: '',                  // Document title

  // Classification
  docTypeGuess: '',           // medical_policy | um_criteria | lbm_guideline | provider_bulletin
  policyTypeGuess: '',        // liquid_biopsy | mrd | molecular_oncology | ctdna
  contentType: '',            // pdf | html

  // Discovery info
  matchedKeywords: [],        // Keywords that matched
  relevanceScore: 0,          // AI relevance score (0-1)
  sourcePageUrl: '',          // Where this was discovered
  linkText: '',               // Original link text
  linkContext: '',            // Surrounding text

  // After approval: fields to populate in registry
  confirmedDocType: null,
  confirmedPolicyType: null,
  notes: null,

  // Metadata
  createdAt: '',
  createdBy: 'daemon',
  reviewedAt: null,
  reviewedBy: null,
  appliedAt: null,
  rejectionReason: null,
};

/**
 * v2: Delegation change proposal schema
 * For payer → LBM delegation announcements
 */
export const delegationChangeProposalSchema = {
  id: '',                     // e.g., "del-2026-abc123"
  type: PROPOSAL_TYPES.DELEGATION_CHANGE,
  status: PROPOSAL_STATES.PENDING,

  // Payer being delegated
  payerId: '',                // Payer ID
  payerName: '',              // Human-readable name

  // Delegation target
  delegatedTo: '',            // 'carelon' | 'evicore' | other LBM
  delegatedToName: '',        // Full LBM name

  // Scope and timing
  effectiveDate: null,        // When delegation takes effect
  scope: '',                  // 'genetic_testing' | 'molecular_testing' | 'lab_benefits'
  scopeDescription: '',       // Human-readable scope

  // Evidence
  sourceUrl: '',              // URL where this was discovered
  sourceQuote: '',            // Exact quote announcing delegation
  confidence: 0,              // AI confidence (0-1)

  // Recommended action
  recommendation: '',         // e.g., "Monitor Carelon guidelines for BCBSLA"
  lbmGuidelinesToMonitor: [], // Suggested guideline IDs to add

  // Metadata
  createdAt: '',
  createdBy: 'daemon',
  reviewedAt: null,
  reviewedBy: null,
  appliedAt: null,
  rejectionReason: null,
};

/**
 * Validate a proposal object
 * @param {Object} proposal - Proposal to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateProposal(proposal) {
  const errors = [];

  if (!proposal.id) {
    errors.push('Missing proposal ID');
  }

  if (!Object.values(PROPOSAL_TYPES).includes(proposal.type)) {
    errors.push(`Invalid proposal type: ${proposal.type}`);
  }

  if (!Object.values(PROPOSAL_STATES).includes(proposal.status)) {
    errors.push(`Invalid proposal status: ${proposal.status}`);
  }

  if (!proposal.source) {
    errors.push('Missing source URL');
  }

  if (!proposal.createdAt) {
    errors.push('Missing createdAt timestamp');
  }

  // Type-specific validation
  if (proposal.type === PROPOSAL_TYPES.COVERAGE) {
    if (!proposal.testName) errors.push('Coverage proposal missing testName');
    if (!proposal.payer) errors.push('Coverage proposal missing payer');
  }

  if (proposal.type === PROPOSAL_TYPES.UPDATE) {
    if (!proposal.testId && !proposal.testName) {
      errors.push('Update proposal missing test identifier');
    }
    if (!proposal.changes || Object.keys(proposal.changes).length === 0) {
      errors.push('Update proposal has no changes');
    }
  }

  if (proposal.type === PROPOSAL_TYPES.NEW_TEST) {
    if (!proposal.testData?.name) errors.push('New test proposal missing name');
    if (!proposal.testData?.vendor) errors.push('New test proposal missing vendor');
    if (!proposal.testData?.category) errors.push('New test proposal missing category');
  }

  // v2: Coverage assertion validation
  if (proposal.type === PROPOSAL_TYPES.COVERAGE_ASSERTION) {
    if (!proposal.payerId) errors.push('Coverage assertion missing payerId');
    if (!proposal.testId && !proposal.testName) {
      errors.push('Coverage assertion missing test identifier');
    }
    if (!Object.values(COVERAGE_LAYERS).includes(proposal.layer)) {
      errors.push(`Invalid coverage layer: ${proposal.layer}`);
    }
    if (!Object.values(ASSERTION_STATUS).includes(proposal.assertionStatus)) {
      errors.push(`Invalid assertion status: ${proposal.assertionStatus}`);
    }
  }

  // v2: Document candidate validation
  if (proposal.type === PROPOSAL_TYPES.DOCUMENT_CANDIDATE) {
    if (!proposal.payerId) errors.push('Document candidate missing payerId');
    if (!proposal.url) errors.push('Document candidate missing url');
  }

  // v2: Delegation change validation
  if (proposal.type === PROPOSAL_TYPES.DELEGATION_CHANGE) {
    if (!proposal.payerId) errors.push('Delegation change missing payerId');
    if (!proposal.delegatedTo) errors.push('Delegation change missing delegatedTo');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a new proposal object with defaults
 * @param {string} type - Proposal type
 * @param {Object} data - Proposal data
 * @returns {Object} Complete proposal object
 */
export function createProposal(type, data = {}) {
  const base = {
    id: generateProposalId(type),
    type,
    status: PROPOSAL_STATES.PENDING,
    createdAt: new Date().toISOString(),
    createdBy: 'daemon',
    reviewedAt: null,
    reviewedBy: null,
    appliedAt: null,
    rejectionReason: null,
  };

  return { ...base, ...data };
}

export default {
  PROPOSAL_TYPES,
  PROPOSAL_STATES,
  COVERAGE_STATUS,
  // v2 enums
  COVERAGE_LAYERS,
  ASSERTION_STATUS,
  DOC_TYPES,
  // Functions
  generateProposalId,
  validateProposal,
  createProposal,
  // v1 schemas
  coverageProposalSchema,
  updateProposalSchema,
  newTestProposalSchema,
  // v2 schemas
  coverageAssertionProposalSchema,
  documentCandidateProposalSchema,
  delegationChangeProposalSchema,
};
