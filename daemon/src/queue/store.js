/**
 * File-based queue storage
 * Stores discoveries in /daemon/data/discoveries.json
 * Stores health/status in /daemon/data/health.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logger = createLogger('store');

const DATA_DIR = join(__dirname, '../../data');
const DISCOVERIES_FILE = join(DATA_DIR, 'discoveries.json');
const HEALTH_FILE = join(DATA_DIR, 'health.json');

/**
 * Ensure the data directory exists
 */
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Atomic write - writes to temp file then renames
 */
function atomicWrite(filePath, data) {
  ensureDataDir();
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tempPath, filePath);
}

/**
 * Load all discoveries from file
 */
export function loadDiscoveries() {
  ensureDataDir();
  if (!existsSync(DISCOVERIES_FILE)) {
    return [];
  }
  try {
    const content = readFileSync(DISCOVERIES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    logger.error('Error loading discoveries', { error: err.message });
    return [];
  }
}

/**
 * Save a new discovery
 * Discovery schema: { id, source, type, title, summary, url, data, discoveredAt, reviewedAt, status }
 */
export function saveDiscovery(discovery) {
  const discoveries = loadDiscoveries();

  const now = new Date().toISOString();
  const newDiscovery = {
    id: discovery.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    source: discovery.source,
    type: discovery.type,
    title: discovery.title || '',
    summary: discovery.summary || '',
    url: discovery.url || '',
    data: discovery.data || {},
    discoveredAt: discovery.discoveredAt || now,
    reviewedAt: discovery.reviewedAt || null,
    status: discovery.status || 'pending'
  };

  discoveries.push(newDiscovery);
  atomicWrite(DISCOVERIES_FILE, discoveries);

  return newDiscovery;
}

/**
 * Mark a discovery as reviewed
 */
export function markReviewed(id, notes) {
  const discoveries = loadDiscoveries();
  const index = discoveries.findIndex(d => d.id === id);

  if (index === -1) {
    return null;
  }

  discoveries[index].reviewedAt = new Date().toISOString();
  discoveries[index].status = 'reviewed';
  if (notes) {
    discoveries[index].reviewNotes = notes;
  }
  atomicWrite(DISCOVERIES_FILE, discoveries);

  return discoveries[index];
}

/**
 * Get all unreviewed discoveries
 */
export function getUnreviewed() {
  const discoveries = loadDiscoveries();
  return discoveries.filter(d => d.status === 'pending' && !d.reviewedAt);
}

/**
 * Load health data from file
 */
export function loadHealth() {
  ensureDataDir();
  if (!existsSync(HEALTH_FILE)) {
    return {};
  }
  try {
    const content = readFileSync(HEALTH_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    logger.error('Error loading health', { error: err.message });
    return {};
  }
}

/**
 * Save health data to file
 */
export function saveHealth(health) {
  atomicWrite(HEALTH_FILE, health);
}

export default {
  loadDiscoveries,
  saveDiscovery,
  markReviewed,
  getUnreviewed,
  loadHealth,
  saveHealth,
  DATA_DIR,
  DISCOVERIES_FILE,
  HEALTH_FILE
};
