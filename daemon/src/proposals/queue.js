/**
 * Proposal Queue Management
 *
 * Handles CRUD operations for proposals:
 * - Create proposals from crawler discoveries
 * - List pending proposals for review
 * - Approve/reject proposals
 * - Apply approved proposals to data.js
 */

import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { createLogger } from '../utils/logger.js';
import {
  PROPOSAL_TYPES,
  PROPOSAL_STATES,
  validateProposal,
  createProposal as createProposalObject,
} from './schema.js';

const logger = createLogger('proposals');

// Base path for proposal storage
const PROPOSALS_DIR = resolve(process.cwd(), 'data', 'proposals');

// Subdirectories by type
const TYPE_DIRS = {
  [PROPOSAL_TYPES.COVERAGE]: 'coverage',
  [PROPOSAL_TYPES.UPDATE]: 'updates',
  [PROPOSAL_TYPES.NEW_TEST]: 'new-tests',
};

/**
 * Ensure proposal directories exist
 */
async function ensureDirectories() {
  for (const dir of Object.values(TYPE_DIRS)) {
    const path = join(PROPOSALS_DIR, dir);
    if (!existsSync(path)) {
      await mkdir(path, { recursive: true });
    }
  }
}

/**
 * Get the directory for a proposal type
 * @param {string} type - Proposal type
 * @returns {string} Directory path
 */
function getTypeDir(type) {
  const subdir = TYPE_DIRS[type];
  if (!subdir) {
    throw new Error(`Unknown proposal type: ${type}`);
  }
  return join(PROPOSALS_DIR, subdir);
}

/**
 * Get the file path for a proposal
 * @param {Object} proposal - Proposal object
 * @returns {string} File path
 */
function getProposalPath(proposal) {
  return join(getTypeDir(proposal.type), `${proposal.id}.json`);
}

/**
 * Create a new proposal
 * @param {string} type - Proposal type (coverage, update, new-test)
 * @param {Object} data - Proposal data
 * @returns {Promise<Object>} Created proposal
 */
export async function createProposal(type, data) {
  await ensureDirectories();

  const proposal = createProposalObject(type, data);

  // Validate before saving
  const validation = validateProposal(proposal);
  if (!validation.valid) {
    logger.warn('Invalid proposal data', { errors: validation.errors });
    // Still save it but log the warning
  }

  const filePath = getProposalPath(proposal);
  await writeFile(filePath, JSON.stringify(proposal, null, 2));

  logger.info('Created proposal', { id: proposal.id, type, testName: proposal.testName });

  return proposal;
}

/**
 * Get a proposal by ID
 * @param {string} id - Proposal ID
 * @returns {Promise<Object|null>} Proposal or null if not found
 */
export async function getProposal(id) {
  // Determine type from ID prefix
  const prefix = id.split('-')[0];
  const typeMap = {
    cov: PROPOSAL_TYPES.COVERAGE,
    upd: PROPOSAL_TYPES.UPDATE,
    new: PROPOSAL_TYPES.NEW_TEST,
  };

  const type = typeMap[prefix];
  if (!type) {
    // Search all directories
    for (const dir of Object.values(TYPE_DIRS)) {
      const filePath = join(PROPOSALS_DIR, dir, `${id}.json`);
      if (existsSync(filePath)) {
        const content = await readFile(filePath, 'utf-8');
        return JSON.parse(content);
      }
    }
    return null;
  }

  const filePath = join(getTypeDir(type), `${id}.json`);
  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Update a proposal
 * @param {string} id - Proposal ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>} Updated proposal or null if not found
 */
export async function updateProposal(id, updates) {
  const proposal = await getProposal(id);
  if (!proposal) {
    return null;
  }

  const updated = {
    ...proposal,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const filePath = getProposalPath(updated);
  await writeFile(filePath, JSON.stringify(updated, null, 2));

  logger.info('Updated proposal', { id, updates: Object.keys(updates) });

  return updated;
}

/**
 * List proposals by status and/or type
 * @param {Object} options - Filter options
 * @param {string} options.status - Filter by status
 * @param {string} options.type - Filter by type
 * @returns {Promise<Object[]>} Array of proposals
 */
export async function listProposals(options = {}) {
  await ensureDirectories();

  const { status, type } = options;
  const proposals = [];

  // Determine which directories to search
  const dirsToSearch = type ? [getTypeDir(type)] : Object.values(TYPE_DIRS).map(d => join(PROPOSALS_DIR, d));

  for (const dir of dirsToSearch) {
    if (!existsSync(dir)) continue;

    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const content = await readFile(join(dir, file), 'utf-8');
      const proposal = JSON.parse(content);

      // Apply status filter
      if (status && proposal.status !== status) continue;

      proposals.push(proposal);
    }
  }

  // Sort by creation date (newest first)
  proposals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return proposals;
}

/**
 * Get all pending proposals
 * @returns {Promise<Object[]>} Array of pending proposals
 */
export async function listPending() {
  return listProposals({ status: PROPOSAL_STATES.PENDING });
}

/**
 * Get all approved (ready to apply) proposals
 * @returns {Promise<Object[]>} Array of approved proposals
 */
export async function listApproved() {
  return listProposals({ status: PROPOSAL_STATES.APPROVED });
}

/**
 * Approve a proposal
 * @param {string} id - Proposal ID
 * @param {string} reviewedBy - Who approved (email or name)
 * @returns {Promise<Object|null>} Updated proposal
 */
export async function approveProposal(id, reviewedBy = 'unknown') {
  return updateProposal(id, {
    status: PROPOSAL_STATES.APPROVED,
    reviewedAt: new Date().toISOString(),
    reviewedBy,
  });
}

/**
 * Reject a proposal
 * @param {string} id - Proposal ID
 * @param {string} reason - Rejection reason
 * @param {string} reviewedBy - Who rejected
 * @returns {Promise<Object|null>} Updated proposal
 */
export async function rejectProposal(id, reason, reviewedBy = 'unknown') {
  return updateProposal(id, {
    status: PROPOSAL_STATES.REJECTED,
    reviewedAt: new Date().toISOString(),
    reviewedBy,
    rejectionReason: reason,
  });
}

/**
 * Mark a proposal as applied
 * @param {string} id - Proposal ID
 * @param {string} commitHash - Git commit hash (optional)
 * @returns {Promise<Object|null>} Updated proposal
 */
export async function markApplied(id, commitHash = null) {
  return updateProposal(id, {
    status: PROPOSAL_STATES.APPLIED,
    appliedAt: new Date().toISOString(),
    commitHash,
  });
}

/**
 * Delete a proposal (use sparingly - prefer reject)
 * @param {string} id - Proposal ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteProposal(id) {
  const proposal = await getProposal(id);
  if (!proposal) {
    return false;
  }

  const filePath = getProposalPath(proposal);
  await unlink(filePath);

  logger.info('Deleted proposal', { id });
  return true;
}

/**
 * Get proposal statistics
 * @returns {Promise<Object>} Stats by type and status
 */
export async function getStats() {
  const proposals = await listProposals();

  const stats = {
    total: proposals.length,
    byStatus: {
      [PROPOSAL_STATES.PENDING]: 0,
      [PROPOSAL_STATES.APPROVED]: 0,
      [PROPOSAL_STATES.APPLIED]: 0,
      [PROPOSAL_STATES.REJECTED]: 0,
    },
    byType: {
      [PROPOSAL_TYPES.COVERAGE]: 0,
      [PROPOSAL_TYPES.UPDATE]: 0,
      [PROPOSAL_TYPES.NEW_TEST]: 0,
    },
  };

  for (const proposal of proposals) {
    if (stats.byStatus[proposal.status] !== undefined) {
      stats.byStatus[proposal.status]++;
    }
    if (stats.byType[proposal.type] !== undefined) {
      stats.byType[proposal.type]++;
    }
  }

  return stats;
}

/**
 * Create a coverage proposal from crawler discovery
 * @param {Object} discovery - Discovery object from crawler
 * @returns {Promise<Object>} Created proposal
 */
export async function createCoverageProposal(discovery) {
  return createProposal(PROPOSAL_TYPES.COVERAGE, {
    testName: discovery.metadata?.testName || discovery.title,
    testId: discovery.metadata?.testId || null,
    payer: discovery.metadata?.payer || discovery.metadata?.payerName,
    payerId: discovery.metadata?.payerId,
    coverageStatus: discovery.metadata?.coveragePosition || discovery.metadata?.aiAnalysis?.coveragePosition,
    conditions: discovery.metadata?.conditions || null,
    effectiveDate: discovery.metadata?.effectiveDate || null,
    source: discovery.url,
    sourceTitle: discovery.title,
    confidence: discovery.metadata?.aiAnalysis?.confidenceLevel === 'high' ? 0.9 :
               discovery.metadata?.aiAnalysis?.confidenceLevel === 'medium' ? 0.7 : 0.5,
    snippet: discovery.metadata?.snippet || discovery.summary,
  });
}

/**
 * Create an update proposal from crawler discovery
 * @param {Object} discovery - Discovery object from crawler
 * @param {Object} changes - Proposed field changes
 * @returns {Promise<Object>} Created proposal
 */
export async function createUpdateProposal(discovery, changes) {
  return createProposal(PROPOSAL_TYPES.UPDATE, {
    testName: discovery.metadata?.testName,
    testId: discovery.metadata?.testId || null,
    changes,
    source: discovery.url,
    sourceTitle: discovery.title,
    confidence: discovery.metadata?.confidence || 0.7,
    quotes: discovery.metadata?.rawQuotes || [],
  });
}

/**
 * Create a new test proposal from crawler discovery
 * @param {Object} discovery - Discovery object from crawler
 * @returns {Promise<Object>} Created proposal
 */
export async function createNewTestProposal(discovery) {
  const metadata = discovery.metadata || {};

  return createProposal(PROPOSAL_TYPES.NEW_TEST, {
    testData: {
      name: metadata.testName || discovery.title,
      vendor: metadata.vendorName || metadata.vendor,
      category: metadata.category || null,
      description: metadata.description || discovery.summary,
      cancerTypes: metadata.cancerTypes || [],
      biomarkers: metadata.biomarkers || [],
      sampleType: metadata.sampleType || null,
      turnaroundTime: metadata.turnaroundTime || null,
      sensitivity: metadata.sensitivity || null,
      specificity: metadata.specificity || null,
      fdaApproved: metadata.fdaApproved || false,
      fdaApprovalDate: metadata.fdaApprovalDate || null,
      plaCode: metadata.plaCode || null,
      vendorUrl: metadata.vendorUrl || discovery.url,
      orderingUrl: metadata.orderingUrl || null,
    },
    source: discovery.url,
    sourceTitle: discovery.title,
    confidence: metadata.confidence || 0.6,
    launchDate: metadata.launchDate || null,
    vendorVerified: false,
  });
}

export default {
  createProposal,
  getProposal,
  updateProposal,
  listProposals,
  listPending,
  listApproved,
  approveProposal,
  rejectProposal,
  markApplied,
  deleteProposal,
  getStats,
  createCoverageProposal,
  createUpdateProposal,
  createNewTestProposal,
};
