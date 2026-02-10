/**
 * Weekly submissions writer.
 *
 * Reads per-crawler staging files from data/crawler-results/,
 * merges them into a single weekly submissions file at
 * data/submissions/weekly-YYYY-MM-DD.json, then cleans up staging.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import { SOURCES } from '../config.js';
import {
  createSubmission,
  scoreToConfidence,
  validateWeeklyFile,
  CONFIDENCE,
} from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const STAGING_DIR = path.join(DATA_DIR, 'crawler-results');
const SUBMISSIONS_DIR = path.join(DATA_DIR, 'submissions');

const logger = createLogger('submissions-writer');

/**
 * Read all staging files for a given week
 * @returns {Object} { source: discoveries[] }
 */
function readStagingFiles() {
  const results = {};

  if (!fs.existsSync(STAGING_DIR)) {
    logger.warn('Staging directory does not exist', { dir: STAGING_DIR });
    return results;
  }

  const files = fs.readdirSync(STAGING_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const filePath = path.join(STAGING_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // Extract source from filename: vendor-2026-02-09.json -> vendor
      const source = file.split('-')[0];
      if (!results[source]) results[source] = [];

      if (Array.isArray(data)) {
        results[source].push(...data);
      } else if (data.discoveries) {
        results[source].push(...data.discoveries);
      } else if (data.items) {
        results[source].push(...data.items);
      }

      logger.info(`Read staging file: ${file}`, { items: results[source].length });
    } catch (err) {
      logger.error(`Failed to read staging file: ${file}`, { error: err.message });
    }
  }

  return results;
}

/**
 * Build the weekly submissions file from staging data
 */
export async function buildWeeklySubmissions() {
  const weekOf = getWeekOfDate();
  const id = `weekly-${weekOf}`;

  logger.info('Building weekly submissions file', { id, weekOf });

  const stagingData = readStagingFiles();

  const crawlSummary = {};
  const allSubmissions = [];

  for (const source of Object.values(SOURCES)) {
    const discoveries = stagingData[source] || [];
    const errors = [];

    crawlSummary[source] = {
      ran: discoveries.length > 0,
      itemCount: discoveries.length,
      errors,
    };

    for (const discovery of discoveries) {
      const submission = createSubmission(discovery, {
        daemonScore: discovery.triageHint?.daemonScore ?? discovery.relevanceScore ?? 5,
        reason: discovery.triageHint?.reason ?? discovery.skipReason ?? '',
        suggestedAction: discovery.triageHint?.suggestedAction ?? mapTypeToAction(discovery.type),
        suggestedTestName: discovery.triageHint?.suggestedTestName
          ?? discovery.metadata?.testName
          ?? discovery.metadata?.affectedTests?.[0]
          ?? null,
        confidence: discovery.triageHint?.confidence ?? mapRelevanceToConfidence(discovery.relevance),
      });

      allSubmissions.push(submission);
    }
  }

  // Compute stats
  const stats = computeStats(allSubmissions);

  const weeklyFile = {
    id,
    generatedAt: new Date().toISOString(),
    weekOf,
    crawlSummary,
    submissions: allSubmissions,
    stats,
  };

  // Validate
  const validation = validateWeeklyFile(weeklyFile);
  if (!validation.valid) {
    logger.warn('Weekly file has validation issues', { errors: validation.errors });
  }

  // Write
  const outPath = path.join(SUBMISSIONS_DIR, `${id}.json`);
  fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });

  // Atomic write
  const tmpPath = outPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(weeklyFile, null, 2));
  fs.renameSync(tmpPath, outPath);

  logger.info('Weekly submissions file written', {
    path: outPath,
    total: allSubmissions.length,
    stats,
  });

  return { path: outPath, weeklyFile };
}

/**
 * Write a single crawler's results to a staging file
 */
export function writeStagingFile(source, discoveries) {
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  const date = getWeekOfDate();
  const filename = `${source}-${date}.json`;
  const filePath = path.join(STAGING_DIR, filename);

  const data = {
    source,
    generatedAt: new Date().toISOString(),
    discoveries,
  };

  // Atomic write
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);

  logger.info(`Staging file written: ${filename}`, { items: discoveries.length });

  return filePath;
}

/**
 * Clean up staging files after aggregation
 */
export function cleanupStagingFiles() {
  if (!fs.existsSync(STAGING_DIR)) return 0;

  const files = fs.readdirSync(STAGING_DIR).filter(f => f.endsWith('.json'));
  let removed = 0;

  for (const file of files) {
    try {
      fs.unlinkSync(path.join(STAGING_DIR, file));
      removed++;
    } catch (err) {
      logger.warn(`Failed to remove staging file: ${file}`, { error: err.message });
    }
  }

  logger.info('Staging files cleaned up', { removed });
  return removed;
}

/**
 * Get the most recent weekly submissions file path
 */
export function getLatestWeeklyFile() {
  if (!fs.existsSync(SUBMISSIONS_DIR)) return null;

  const files = fs.readdirSync(SUBMISSIONS_DIR)
    .filter(f => f.startsWith('weekly-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const filePath = path.join(SUBMISSIONS_DIR, files[0]);
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// --- Helpers ---

function getWeekOfDate() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

function mapTypeToAction(type) {
  if (!type) return 'review';
  if (type.includes('pap') || type.includes('pla') || type.includes('price') || type.includes('payment')) {
    return 'informational';
  }
  if (type.includes('coverage') || type.includes('policy')) return 'coverage_update';
  if (type.includes('clinical') || type.includes('performance')) return 'data_update';
  if (type.includes('regulatory')) return 'regulatory_update';
  if (type.includes('new_test')) return 'new_test';
  if (type.includes('grant')) return 'informational';
  return 'review';
}

function mapRelevanceToConfidence(relevance) {
  if (relevance === 'high') return 0.85;
  if (relevance === 'medium') return 0.6;
  return 0.35;
}

function computeStats(submissions) {
  const bySource = {};
  const byConfidence = { high: 0, medium: 0, low: 0 };

  for (const s of submissions) {
    bySource[s.source] = (bySource[s.source] || 0) + 1;

    const conf = scoreToConfidence(s.triageHint.daemonScore);
    byConfidence[conf]++;
  }

  return {
    total: submissions.length,
    bySource,
    byConfidence,
  };
}
