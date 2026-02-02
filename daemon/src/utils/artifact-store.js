/**
 * Artifact Store
 *
 * Stores raw policy documents (PDF/HTML) for audit and replay.
 * Each fetch creates a timestamped snapshot with metadata.
 *
 * v2.1: Required for audit trail - can't resolve disputes without originals
 */

import { createHash } from 'crypto';
import { writeFile, readFile, mkdir, readdir, stat } from 'fs/promises';
import path from 'path';
import { createLogger } from './logger.js';

const logger = createLogger('artifact-store');

// Default artifact directory (relative to daemon root)
const DEFAULT_ARTIFACT_DIR = 'data/artifacts';

let artifactDir = DEFAULT_ARTIFACT_DIR;

/**
 * Set custom artifact directory (for testing)
 * @param {string} dir - Directory path
 */
export function setArtifactDir(dir) {
  artifactDir = dir;
}

/**
 * Get current artifact directory
 * @returns {string}
 */
export function getArtifactDir() {
  return artifactDir;
}

/**
 * Generate artifact ID from components
 * @param {string} payerId - Payer ID
 * @param {string} policyId - Policy ID
 * @param {string} contentHash - Short content hash
 * @returns {string} Artifact ID
 */
export function generateArtifactId(payerId, policyId, contentHash) {
  const timestamp = new Date().toISOString().split('T')[0];
  const shortHash = contentHash.slice(0, 12);
  return `${payerId}_${policyId}_${timestamp}_${shortHash}`;
}

/**
 * Store a policy artifact (raw content + metadata)
 *
 * @param {string} payerId - Payer ID
 * @param {string} policyId - Policy ID
 * @param {Buffer|string} content - Raw content (PDF bytes or HTML text)
 * @param {Object} metadata - Artifact metadata
 * @param {string} metadata.contentType - 'pdf' | 'html'
 * @param {string} metadata.sourceUrl - Original URL
 * @param {Object[]} [metadata.anchors] - Quote anchors for evidence
 * @returns {Promise<Object>} { artifactId, artifactPath, contentHash }
 */
export async function storeArtifact(payerId, policyId, content, metadata = {}) {
  if (!payerId || !policyId) {
    throw new Error('payerId and policyId are required');
  }

  if (!content) {
    throw new Error('content is required');
  }

  // Compute content hash
  const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const contentHash = createHash('sha256').update(contentBuffer).digest('hex');

  // Generate artifact ID and paths
  const artifactId = generateArtifactId(payerId, policyId, contentHash);
  const payerDir = path.join(artifactDir, payerId);
  const artifactPath = path.join(payerDir, artifactId);

  // Ensure directory exists
  await mkdir(payerDir, { recursive: true });

  // Determine file extension
  const ext = metadata.contentType === 'pdf' ? '.pdf' : '.html';

  // Store raw content
  await writeFile(`${artifactPath}${ext}`, contentBuffer);

  // Store metadata
  const metadataObj = {
    artifactId,
    payerId,
    policyId,
    fetchedAt: new Date().toISOString(),
    contentType: metadata.contentType || 'html',
    sourceUrl: metadata.sourceUrl || null,
    contentLength: contentBuffer.length,
    contentHash,

    // Anchors for evidence (page numbers, headings, quotes)
    anchors: metadata.anchors || [],

    // Additional metadata
    policyTitle: metadata.policyTitle || null,
    effectiveDate: metadata.effectiveDate || null,
    httpHeaders: metadata.httpHeaders || null,
  };

  await writeFile(`${artifactPath}.meta.json`, JSON.stringify(metadataObj, null, 2));

  logger.info('Artifact stored', {
    artifactId,
    payerId,
    policyId,
    contentType: metadata.contentType,
    contentLength: contentBuffer.length,
  });

  return {
    artifactId,
    artifactPath,
    contentHash,
  };
}

/**
 * Create an anchor for evidence linkage
 *
 * @param {Object} options - Anchor options
 * @param {number} [options.page] - Page number (for PDFs)
 * @param {string} [options.heading] - Section heading
 * @param {string} options.quote - Quoted text
 * @param {number} [options.offset] - Character offset in document
 * @returns {Object} Anchor object
 */
export function createAnchor(options = {}) {
  return {
    page: options.page || null,
    heading: options.heading || null,
    quote: options.quote || '',
    offset: options.offset || null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get artifact metadata by ID
 *
 * @param {string} artifactId - Artifact ID
 * @returns {Promise<Object|null>} Metadata or null if not found
 */
export async function getArtifactMetadata(artifactId) {
  // Parse artifact ID to get payer
  const parts = artifactId.split('_');
  if (parts.length < 4) {
    return null;
  }

  const payerId = parts[0];
  const metaPath = path.join(artifactDir, payerId, `${artifactId}.meta.json`);

  try {
    const content = await readFile(metaPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Get artifact content by ID
 *
 * @param {string} artifactId - Artifact ID
 * @returns {Promise<Object|null>} { content: Buffer, metadata: Object } or null
 */
export async function getArtifact(artifactId) {
  const metadata = await getArtifactMetadata(artifactId);
  if (!metadata) {
    return null;
  }

  const ext = metadata.contentType === 'pdf' ? '.pdf' : '.html';
  const contentPath = path.join(artifactDir, metadata.payerId, `${artifactId}${ext}`);

  try {
    const content = await readFile(contentPath);
    return { content, metadata };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * List all artifacts for a payer
 *
 * @param {string} payerId - Payer ID
 * @returns {Promise<Object[]>} Array of artifact metadata
 */
export async function listArtifacts(payerId) {
  const payerDir = path.join(artifactDir, payerId);

  try {
    const files = await readdir(payerDir);
    const metaFiles = files.filter(f => f.endsWith('.meta.json'));

    const artifacts = [];
    for (const file of metaFiles) {
      try {
        const content = await readFile(path.join(payerDir, file), 'utf8');
        artifacts.push(JSON.parse(content));
      } catch (error) {
        logger.warn('Failed to read artifact metadata', { file, error: error.message });
      }
    }

    // Sort by fetchedAt descending (newest first)
    artifacts.sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt));

    return artifacts;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * List artifacts for a specific policy
 *
 * @param {string} payerId - Payer ID
 * @param {string} policyId - Policy ID
 * @returns {Promise<Object[]>} Array of artifact metadata
 */
export async function listPolicyArtifacts(payerId, policyId) {
  const allArtifacts = await listArtifacts(payerId);
  return allArtifacts.filter(a => a.policyId === policyId);
}

/**
 * Get the most recent artifact for a policy
 *
 * @param {string} payerId - Payer ID
 * @param {string} policyId - Policy ID
 * @returns {Promise<Object|null>} Most recent artifact metadata or null
 */
export async function getLatestArtifact(payerId, policyId) {
  const artifacts = await listPolicyArtifacts(payerId, policyId);
  return artifacts.length > 0 ? artifacts[0] : null;
}

/**
 * Add an anchor to an existing artifact
 *
 * @param {string} artifactId - Artifact ID
 * @param {Object} anchor - Anchor to add
 * @returns {Promise<boolean>} Success
 */
export async function addAnchor(artifactId, anchor) {
  const metadata = await getArtifactMetadata(artifactId);
  if (!metadata) {
    return false;
  }

  metadata.anchors = metadata.anchors || [];
  metadata.anchors.push({
    ...anchor,
    createdAt: anchor.createdAt || new Date().toISOString(),
  });

  const metaPath = path.join(artifactDir, metadata.payerId, `${artifactId}.meta.json`);
  await writeFile(metaPath, JSON.stringify(metadata, null, 2));

  return true;
}

/**
 * Clean up old artifacts (keep N most recent per policy)
 *
 * @param {string} payerId - Payer ID
 * @param {number} keepCount - Number of recent artifacts to keep per policy
 * @returns {Promise<number>} Number of artifacts deleted
 */
export async function cleanupArtifacts(payerId, keepCount = 10) {
  const artifacts = await listArtifacts(payerId);

  // Group by policyId
  const byPolicy = {};
  for (const artifact of artifacts) {
    if (!byPolicy[artifact.policyId]) {
      byPolicy[artifact.policyId] = [];
    }
    byPolicy[artifact.policyId].push(artifact);
  }

  let deleted = 0;

  for (const [policyId, policyArtifacts] of Object.entries(byPolicy)) {
    // Already sorted by fetchedAt descending
    const toDelete = policyArtifacts.slice(keepCount);

    for (const artifact of toDelete) {
      try {
        const ext = artifact.contentType === 'pdf' ? '.pdf' : '.html';
        const basePath = path.join(artifactDir, payerId, artifact.artifactId);

        await Promise.all([
          readFile(`${basePath}${ext}`).then(() =>
            writeFile(`${basePath}${ext}`, '').then(() =>
              stat(`${basePath}${ext}`).catch(() => null)
            )
          ).catch(() => null),
          readFile(`${basePath}.meta.json`).then(() =>
            writeFile(`${basePath}.meta.json`, '').then(() =>
              stat(`${basePath}.meta.json`).catch(() => null)
            )
          ).catch(() => null),
        ]);

        deleted++;
      } catch (error) {
        logger.warn('Failed to delete artifact', {
          artifactId: artifact.artifactId,
          error: error.message,
        });
      }
    }
  }

  return deleted;
}

export default {
  setArtifactDir,
  getArtifactDir,
  generateArtifactId,
  storeArtifact,
  createAnchor,
  getArtifactMetadata,
  getArtifact,
  listArtifacts,
  listPolicyArtifacts,
  getLatestArtifact,
  addAnchor,
  cleanupArtifacts,
};
