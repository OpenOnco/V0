/**
 * Proposal Schema Definitions
 *
 * Proposals represent suggested changes to test data that require human review.
 * All changes go through this queue before being applied to data.js.
 */

/**
 * Proposal types
 */
export const PROPOSAL_TYPES = {
  COVERAGE: 'coverage',       // Coverage status updates
  UPDATE: 'update',           // Test record updates (performance, trials)
  NEW_TEST: 'new-test',       // New test submissions
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
 * Coverage status values
 */
export const COVERAGE_STATUS = {
  COVERED: 'covered',
  NOT_COVERED: 'not_covered',
  CONDITIONAL: 'conditional',
  PRIOR_AUTH: 'prior_auth_required',
  UNKNOWN: 'unknown',
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
  };
  const prefix = prefixes[type] || 'prop';
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString(36);
  return `${prefix}-${year}-${timestamp}`;
}

/**
 * Coverage proposal schema
 * Used for payer coverage status changes
 */
export const coverageProposalSchema = {
  id: '',                     // e.g., "cov-2024-abc123"
  type: PROPOSAL_TYPES.COVERAGE,
  status: PROPOSAL_STATES.PENDING,

  // What's being changed
  testId: '',                 // ID from data.js
  testName: '',               // Human-readable name
  payer: '',                  // Payer name
  payerId: '',                // Payer ID

  // The proposed change
  coverageStatus: '',         // covered | not_covered | conditional | prior_auth_required
  conditions: '',             // Coverage conditions/requirements
  effectiveDate: null,        // When coverage takes effect

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
  generateProposalId,
  validateProposal,
  createProposal,
  coverageProposalSchema,
  updateProposalSchema,
  newTestProposalSchema,
};
