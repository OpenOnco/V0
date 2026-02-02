/**
 * Guideline Watcher
 * Drop-to-ingest system for PDF guidelines
 * Watches folders, auto-detects versions, and supersedes old versions
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from '../db/client.js';
import { processSocietyGuideline } from './processors/society.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('guideline-watcher');

// Watch directories for each guideline type
const WATCH_DIRS = {
  nccn: './data/guidelines/nccn/',
  asco: './data/guidelines/asco/',
  esmo: './data/guidelines/esmo/',
  sitc: './data/guidelines/sitc/',
  'cap-amp': './data/guidelines/cap-amp/',
};

// Version patterns in filenames
const VERSION_PATTERNS = [
  /v(\d+\.\d{4})/i,                    // v2.2025
  /version[_\s-]?(\d+\.\d{4})/i,       // version_2.2025
  /(\d{4})[_\s-]v(\d+)/i,              // 2025_v1 -> 1.2025
  /(\d+\.\d+)[_\s-](\d{4})/i,          // 2.1_2025 -> 2.1.2025
];

/**
 * Extract version from filename
 */
function extractVersionFromFilename(filename) {
  for (const pattern of VERSION_PATTERNS) {
    const match = filename.match(pattern);
    if (match) {
      // Handle different pattern captures
      if (match[2] && /^\d{4}$/.test(match[1])) {
        // Pattern: 2025_v1 -> v1.2025
        return `${match[2]}.${match[1]}`;
      }
      return match[1];
    }
  }

  // Fall back to modification date
  return null;
}

/**
 * Get base guideline name from filename (for matching previous versions)
 */
function getBaseGuideline(filename) {
  // Remove version info and extension
  return filename
    .replace(/[-_]?v?\d+\.?\d*\.?\d{0,4}\.pdf$/i, '')
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .trim();
}

/**
 * Map source type to source key for registry
 */
function getSourceKey(sourceType, baseGuideline) {
  const guidelineMap = {
    'colorectal': 'nccn-colorectal',
    'colon': 'nccn-colorectal',
    'breast': 'nccn-breast',
    'lung': 'nccn-lung',
    'nsclc': 'nccn-lung',
    'bladder': 'nccn-bladder',
    'gastric': 'nccn-gastric',
    'esophageal': 'nccn-gastric',
  };

  if (sourceType === 'nccn') {
    const key = Object.keys(guidelineMap).find(k => baseGuideline.includes(k));
    return key ? guidelineMap[key] : `nccn-${baseGuideline}`;
  }

  return `${sourceType}-ctdna`;
}

/**
 * Scan a single guideline file
 */
async function processGuidelineFile(filePath, sourceType) {
  const filename = path.basename(filePath);
  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  logger.info(`Processing guideline: ${filename}`);

  // Check if already processed by hash
  const existing = await query(
    'SELECT id FROM mrd_artifacts WHERE sha256 = $1',
    [hash]
  );

  if (existing.rows.length > 0) {
    logger.info(`Skipping ${filename} - already processed (hash match)`);
    return { status: 'skipped', reason: 'duplicate' };
  }

  // Extract version and base name
  const version = extractVersionFromFilename(filename) ||
    new Date(stats.mtime).toISOString().split('T')[0];
  const baseGuideline = getBaseGuideline(filename);
  const sourceKey = getSourceKey(sourceType, baseGuideline);

  logger.info(`Detected: base=${baseGuideline}, version=${version}, sourceKey=${sourceKey}`);

  // Find and supersede previous version
  const previousVersion = await query(`
    SELECT id, version_string
    FROM mrd_artifacts
    WHERE source_type = $1
      AND source_identifier LIKE $2
      AND is_current = TRUE
    ORDER BY created_at DESC
    LIMIT 1
  `, [sourceType, `%${baseGuideline}%`]);

  if (previousVersion.rows.length > 0) {
    const prev = previousVersion.rows[0];
    logger.info(`Superseding previous version: ${prev.version_string}`);

    await query(`
      UPDATE mrd_artifacts
      SET is_current = FALSE,
          superseded_at = NOW()
      WHERE id = $1
    `, [prev.id]);
  }

  // Process the guideline
  const result = await processSocietyGuideline(filePath, {
    sourceType,
    sourceKey,
    version,
  });

  // Record artifact
  const artifactResult = await query(`
    INSERT INTO mrd_artifacts (
      source_type, source_identifier, sha256, file_size, content_type,
      version_string, is_current, processed_at, items_extracted
    ) VALUES ($1, $2, $3, $4, 'application/pdf', $5, TRUE, NOW(), $6)
    RETURNING id
  `, [sourceType, filename, hash, stats.size, version, result.itemsAdded || 0]);

  const artifactId = artifactResult.rows[0].id;

  // Record release in ledger
  try {
    await query(`
      SELECT record_source_release($1, $2, $3, $4, $5, $6)
    `, [
      sourceKey,
      `${version}-${hash.substring(0, 8)}`,
      'file-drop',
      hash,
      version,
      new Date(),
    ]);

    await query(`
      UPDATE mrd_source_releases
      SET status = 'processed',
          processed_at = NOW(),
          items_extracted = $2,
          artifact_id = $3
      WHERE source_id = (SELECT id FROM mrd_sources WHERE source_key = $1)
        AND release_key = $4
    `, [sourceKey, result.itemsAdded || 0, artifactId, `${version}-${hash.substring(0, 8)}`]);
  } catch (error) {
    // Source may not be registered yet - that's okay
    logger.warn(`Could not record release for ${sourceKey}`, { error: error.message });
  }

  logger.info(`Processed guideline: ${filename}`, {
    version,
    itemsAdded: result.itemsAdded,
    artifactId,
  });

  return {
    status: 'processed',
    filename,
    version,
    itemsAdded: result.itemsAdded,
    artifactId,
  };
}

/**
 * Scan all watch directories for new guidelines
 */
export async function scanForNewGuidelines() {
  const results = {
    processed: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  for (const [sourceType, dir] of Object.entries(WATCH_DIRS)) {
    // Ensure directory exists
    const fullDir = path.resolve(dir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
      logger.info(`Created watch directory: ${fullDir}`);
      continue;
    }

    // Find PDF files
    const files = fs.readdirSync(fullDir).filter(f =>
      f.toLowerCase().endsWith('.pdf')
    );

    if (files.length === 0) {
      continue;
    }

    logger.info(`Found ${files.length} PDF files in ${dir}`);

    for (const file of files) {
      const filePath = path.join(fullDir, file);

      try {
        const result = await processGuidelineFile(filePath, sourceType);

        if (result.status === 'processed') {
          results.processed++;
          results.details.push(result);
        } else {
          results.skipped++;
        }
      } catch (error) {
        logger.error(`Failed to process ${file}`, { error: error.message });
        results.errors.push({ file, error: error.message });
      }
    }
  }

  logger.info('Guideline scan complete', {
    processed: results.processed,
    skipped: results.skipped,
    errors: results.errors.length,
  });

  return results;
}

/**
 * Watch for new files (optional: can use fs.watch for real-time)
 */
export function startWatcher(callback) {
  logger.info('Starting guideline watcher');

  for (const [sourceType, dir] of Object.entries(WATCH_DIRS)) {
    const fullDir = path.resolve(dir);

    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    fs.watch(fullDir, { persistent: false }, async (eventType, filename) => {
      if (!filename || !filename.toLowerCase().endsWith('.pdf')) return;
      if (eventType !== 'rename') return; // New file added

      const filePath = path.join(fullDir, filename);

      // Wait a bit for file to finish writing
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (!fs.existsSync(filePath)) return; // File was deleted

      try {
        const result = await processGuidelineFile(filePath, sourceType);
        if (callback) callback(result);
      } catch (error) {
        logger.error(`Failed to process ${filename}`, { error: error.message });
        if (callback) callback({ status: 'error', error: error.message });
      }
    });

    logger.info(`Watching directory: ${fullDir}`);
  }
}

export default {
  scanForNewGuidelines,
  startWatcher,
  extractVersionFromFilename,
  getBaseGuideline,
};
