/**
 * File Watcher for MRD Guidance Monitor
 *
 * Tracks downloaded guideline files (PDFs), detects changes via SHA256,
 * and routes to appropriate processors.
 *
 * Usage:
 *   npm run mrd:files -- scan [--dry-run]
 *   npm run mrd:files -- process <path> [--force]
 *   npm run mrd:files -- list
 *   npm run mrd:files -- status
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createLogger } from '../../utils/logger.js';
import { query } from '../../db/mrd-client.js';

const logger = createLogger('file-watcher');

const WATCHED_DIR = path.join(process.cwd(), 'watched-files');
const MANIFEST_PATH = path.join(process.cwd(), 'data', 'file-manifest.json');

/**
 * Load manifest from disk
 */
export function loadManifest() {
  try {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    logger.warn('Could not load manifest, creating new one', { error: error.message });
    return {
      schema_version: '1.0',
      last_scan: null,
      files: {},
      processors: {},
      statistics: { total_files: 0, total_processed: 0, by_source: {} },
    };
  }
}

/**
 * Save manifest to disk
 */
export function saveManifest(manifest) {
  manifest.statistics = computeStatistics(manifest);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  logger.info('Manifest saved', { files: Object.keys(manifest.files).length });
}

/**
 * Compute statistics from manifest
 */
function computeStatistics(manifest) {
  const bySource = {};
  let totalProcessed = 0;

  for (const [filePath, info] of Object.entries(manifest.files)) {
    const source = info.source_type || 'unknown';
    bySource[source] = (bySource[source] || 0) + 1;
    if (info.processed_at) totalProcessed++;
  }

  return {
    total_files: Object.keys(manifest.files).length,
    total_processed: totalProcessed,
    by_source: bySource,
  };
}

/**
 * Compute SHA256 hash of a file
 */
export function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Find all files in a directory recursively
 */
export function findAllFiles(dir, extensions = ['.pdf']) {
  const results = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      results.push(...findAllFiles(fullPath, extensions));
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (extensions.includes(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Get source type from file path
 */
export function getSourceType(filePath) {
  const relativePath = path.relative(WATCHED_DIR, filePath);
  const parts = relativePath.split(path.sep);
  return parts[0] || 'unknown';
}

/**
 * Get processor for a source type
 */
export async function getProcessor(sourceType) {
  const manifest = loadManifest();
  const config = manifest.processors[sourceType];

  if (!config || !config.enabled) {
    return null;
  }

  try {
    const modulePath = config.module;
    const module = await import(modulePath);
    return module[config.function];
  } catch (error) {
    logger.error('Failed to load processor', { sourceType, error: error.message });
    return null;
  }
}

/**
 * Store artifact in database
 */
async function storeArtifact(filePath, hash, extractedText, metadata = {}) {
  const stats = fs.statSync(filePath);
  const sourceType = getSourceType(filePath);
  const filename = path.basename(filePath);

  // Check if artifact already exists
  const existing = await query(
    'SELECT id FROM mrd_artifacts WHERE sha256 = $1',
    [hash]
  );

  if (existing.rows.length > 0) {
    logger.info('Artifact already exists', { hash: hash.substring(0, 12), id: existing.rows[0].id });
    return existing.rows[0].id;
  }

  // Insert new artifact
  const result = await query(
    `INSERT INTO mrd_artifacts (
      source_type, source_identifier, sha256, file_size, content_type,
      original_filename, extracted_text, metadata, processed_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    RETURNING id`,
    [
      sourceType,
      path.relative(WATCHED_DIR, filePath),
      hash,
      stats.size,
      'application/pdf',
      filename,
      extractedText,
      JSON.stringify(metadata),
    ]
  );

  logger.info('Stored artifact', { id: result.rows[0].id, filename });
  return result.rows[0].id;
}

/**
 * Process a single file
 */
export async function processFile(filePath, options = {}) {
  const { force = false, dryRun = false } = options;

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const manifest = loadManifest();
  const relativePath = path.relative(WATCHED_DIR, filePath);
  const sourceType = getSourceType(filePath);
  const stats = fs.statSync(filePath);
  const hash = computeFileHash(filePath);

  const existing = manifest.files[relativePath];

  // Check if already processed with same hash
  if (existing && existing.sha256 === hash && !force) {
    logger.info('File unchanged, skipping', { path: relativePath });
    return { status: 'unchanged', path: relativePath };
  }

  if (dryRun) {
    return {
      status: existing ? 'would_update' : 'would_add',
      path: relativePath,
      sourceType,
      hash: hash.substring(0, 12),
    };
  }

  // Get processor
  const processor = await getProcessor(sourceType);

  if (!processor) {
    logger.warn('No processor available', { sourceType });
    return { status: 'no_processor', path: relativePath, sourceType };
  }

  logger.info('Processing file', { path: relativePath, sourceType });

  try {
    // Run processor
    const result = await processor(filePath, { sourceType });

    // Update manifest
    manifest.files[relativePath] = {
      sha256: hash,
      size: stats.size,
      last_modified: stats.mtime.toISOString(),
      processed_at: new Date().toISOString(),
      source_type: sourceType,
      metadata: {
        items_extracted: result.saved || result.recommendationsExtracted || 0,
        ...result,
      },
    };

    saveManifest(manifest);

    return {
      status: 'processed',
      path: relativePath,
      sourceType,
      result,
    };
  } catch (error) {
    logger.error('Processing failed', { path: relativePath, error: error.message });

    // Record failure in manifest
    manifest.files[relativePath] = {
      sha256: hash,
      size: stats.size,
      last_modified: stats.mtime.toISOString(),
      processed_at: null,
      source_type: sourceType,
      error: error.message,
    };

    saveManifest(manifest);

    return {
      status: 'error',
      path: relativePath,
      error: error.message,
    };
  }
}

/**
 * Scan watched directories for new/changed files
 */
export async function scanWatchedFiles(options = {}) {
  const { dryRun = false, force = false, source = null } = options;

  logger.info('Scanning watched files', { dryRun, force, source });

  const manifest = loadManifest();
  const results = {
    new: [],
    changed: [],
    unchanged: [],
    processed: [],
    errors: [],
  };

  // Find all PDF files
  const allFiles = findAllFiles(WATCHED_DIR, ['.pdf']);
  logger.info('Found files', { count: allFiles.length });

  for (const filePath of allFiles) {
    const relativePath = path.relative(WATCHED_DIR, filePath);
    const sourceType = getSourceType(filePath);

    // Filter by source if specified
    if (source && sourceType !== source) {
      continue;
    }

    const stats = fs.statSync(filePath);
    const hash = computeFileHash(filePath);
    const existing = manifest.files[relativePath];

    if (!existing) {
      results.new.push(relativePath);
    } else if (existing.sha256 !== hash) {
      results.changed.push(relativePath);
    } else if (force) {
      results.changed.push(relativePath);
    } else {
      results.unchanged.push(relativePath);
      continue;
    }

    // Process the file
    if (!dryRun) {
      const result = await processFile(filePath, { force, dryRun: false });
      if (result.status === 'processed') {
        results.processed.push(relativePath);
      } else if (result.status === 'error') {
        results.errors.push({ path: relativePath, error: result.error });
      }
    }
  }

  if (!dryRun) {
    manifest.last_scan = new Date().toISOString();
    saveManifest(manifest);
  }

  return results;
}

/**
 * Get status of all tracked files
 */
export function getFileStatus() {
  const manifest = loadManifest();
  const status = {
    tracked: [],
    needs_processing: [],
    has_errors: [],
  };

  // Check tracked files
  for (const [relativePath, info] of Object.entries(manifest.files)) {
    const fullPath = path.join(WATCHED_DIR, relativePath);

    if (!fs.existsSync(fullPath)) {
      status.tracked.push({
        path: relativePath,
        status: 'missing',
        ...info,
      });
      continue;
    }

    const currentHash = computeFileHash(fullPath);

    if (info.error) {
      status.has_errors.push({
        path: relativePath,
        error: info.error,
        ...info,
      });
    } else if (currentHash !== info.sha256) {
      status.needs_processing.push({
        path: relativePath,
        status: 'changed',
        old_hash: info.sha256?.substring(0, 12),
        new_hash: currentHash.substring(0, 12),
      });
    } else {
      status.tracked.push({
        path: relativePath,
        status: 'current',
        processed_at: info.processed_at,
        items: info.metadata?.items_extracted,
      });
    }
  }

  // Check for untracked files
  const allFiles = findAllFiles(WATCHED_DIR, ['.pdf']);
  for (const filePath of allFiles) {
    const relativePath = path.relative(WATCHED_DIR, filePath);
    if (!manifest.files[relativePath]) {
      status.needs_processing.push({
        path: relativePath,
        status: 'new',
      });
    }
  }

  return status;
}

/**
 * List all tracked files
 */
export function listFiles() {
  const manifest = loadManifest();
  return {
    files: manifest.files,
    statistics: manifest.statistics,
    last_scan: manifest.last_scan,
  };
}

/**
 * Reset a file for reprocessing
 */
export function resetFile(relativePath) {
  const manifest = loadManifest();

  if (manifest.files[relativePath]) {
    delete manifest.files[relativePath];
    saveManifest(manifest);
    return { status: 'reset', path: relativePath };
  }

  return { status: 'not_found', path: relativePath };
}

export default {
  loadManifest,
  saveManifest,
  computeFileHash,
  findAllFiles,
  getSourceType,
  processFile,
  scanWatchedFiles,
  getFileStatus,
  listFiles,
  resetFile,
};
