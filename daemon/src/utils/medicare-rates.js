/**
 * Medicare CLFS Rate Lookup Utility
 *
 * Downloads and caches the CMS Clinical Laboratory Fee Schedule (CLFS) data
 * and provides rate lookup for PLA/CPT codes.
 *
 * Usage:
 *   import { initializeCLFS, lookupPLARate, lookupMultiplePLARates } from './utils/medicare-rates.js';
 *
 *   // Initialize once at startup
 *   await initializeCLFS();
 *
 *   // Look up a single code
 *   const result = await lookupPLARate('0179U');
 *   // { code: '0179U', rate: 3350.00, status: 'Priced', nationalLimit: 3350.00, effective: '2026-Q1' }
 *
 *   // Look up multiple codes
 *   const results = await lookupMultiplePLARates(['0179U', '0239U']);
 *   // Map { '0179U' => {...}, '0239U' => {...} }
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger('medicare-rates');

// Cache configuration
const DATA_DIR = join(__dirname, '..', '..', 'data');
const CACHE_FILE = join(DATA_DIR, 'clfs-cache.json');
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get the current calendar quarter string (e.g., "2026-Q1")
 * @returns {string}
 */
function getCurrentQuarter() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

/**
 * Generate CLFS download URLs dynamically based on current date.
 * CMS publishes new CLFS files quarterly (Jan 1, Apr 1, Jul 1, Oct 1).
 * We try current quarter first, then fall back to previous quarters.
 *
 * URL pattern: https://www.cms.gov/files/zip/{YY}clabq{Q}.zip
 *   - YY = 2-digit year
 *   - Q = quarter number (1-4)
 *
 * @returns {Array<{url: string, quarter: string}>}
 */
function getCLFSUrls() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const quarter = Math.ceil(month / 3);

  const urls = [];

  // Helper to build URL entry
  const buildEntry = (y, q) => {
    const yearShort = y.toString().slice(-2);
    return {
      url: `https://www.cms.gov/files/zip/${yearShort}clabq${q}.zip`,
      quarter: `${y}-Q${q}`
    };
  };

  // Current quarter (may not be published yet early in quarter)
  urls.push(buildEntry(year, quarter));

  // Previous quarter (reliable fallback)
  if (quarter === 1) {
    urls.push(buildEntry(year - 1, 4));
  } else {
    urls.push(buildEntry(year, quarter - 1));
  }

  // Two quarters ago (extra fallback)
  if (quarter <= 2) {
    urls.push(buildEntry(year - 1, quarter === 1 ? 3 : 4));
  } else {
    urls.push(buildEntry(year, quarter - 2));
  }

  return urls;
}

/**
 * @typedef {Object} PLARate
 * @property {string} code - The PLA/CPT code (e.g., '0179U' or '81528')
 * @property {number|null} rate - The Medicare rate in dollars, or null if MAC-priced
 * @property {string} status - 'Priced', 'MAC-Priced', 'Not Valid', or 'Not Found'
 * @property {number|null} nationalLimit - The national limit amount from CLFS
 * @property {string} effective - The CLFS quarter (e.g., '2025-Q4')
 */

/** @type {Map<string, PLARate>|null} */
let ratesCache = null;

/** @type {string|null} */
let cacheQuarter = null;

/** @type {boolean} */
let initialized = false;

/**
 * Download and parse CLFS data from CMS
 * @returns {Promise<{rates: Map<string, PLARate>, quarter: string}>}
 */
async function downloadCLFS() {
  const tmpDir = '/tmp/clfs-daemon';

  // Ensure tmp directory exists
  try {
    execSync(`mkdir -p ${tmpDir}`, { stdio: 'pipe' });
  } catch (e) {
    throw new Error(`Failed to create temp directory: ${e.message}`);
  }

  // Try each URL until one works (dynamically generated based on current date)
  let csvPath = null;
  let quarter = null;
  const clfsUrls = getCLFSUrls();

  for (const { url, quarter: q } of clfsUrls) {
    try {
      logger.info(`Trying CLFS URL: ${url}`);
      execSync(`curl -sL -o ${tmpDir}/clfs.zip "${url}"`, {
        stdio: 'pipe',
        timeout: 60000
      });

      // Check if download was successful (file exists and is a valid zip)
      if (!existsSync(`${tmpDir}/clfs.zip`)) {
        logger.warn(`Download failed for ${q} - file not created`);
        continue;
      }

      const zipStats = statSync(`${tmpDir}/clfs.zip`);
      if (zipStats.size < 1000) {
        logger.warn(`Download too small for ${q} (${zipStats.size} bytes)`);
        continue;
      }

      execSync(`unzip -o ${tmpDir}/clfs.zip -d ${tmpDir}`, { stdio: 'pipe' });

      // Find CSV file
      const files = execSync(`ls ${tmpDir}/*.csv 2>/dev/null || true`).toString().trim();
      if (files) {
        csvPath = files.split('\n')[0];
        quarter = q;
        logger.info(`Successfully downloaded CLFS`, { quarter: q, csvPath });
        break;
      }
    } catch (e) {
      logger.warn(`Failed to download ${q}`, { error: e.message });
    }
  }

  if (!csvPath) {
    throw new Error('Failed to download CLFS from any URL');
  }

  // Parse CSV
  const rates = parseCLFSCsv(csvPath, quarter);

  // Cleanup
  try {
    execSync(`rm -rf ${tmpDir}`, { stdio: 'pipe' });
  } catch (e) {
    // Ignore cleanup errors
  }

  return { rates, quarter };
}

/**
 * Parse CLFS CSV into a rates map
 *
 * CLFS CSV format:
 * Year,HCPCS,Short Desc,Effective Date,Indicator,Rate,National Limit,Ceiling
 * Example: 2025,0179U,,01012025,A,2050.00,3350.00,3500.00
 *
 * Price Indicators:
 * - A: National limit established
 * - L: MAC (carrier) priced - no national limit
 * - N: Code no longer valid
 * - B, C, D, E: Various limit types
 *
 * @param {string} csvPath - Path to the CSV file
 * @param {string} quarter - CLFS quarter string
 * @returns {Map<string, PLARate>}
 */
function parseCLFSCsv(csvPath, quarter) {
  const content = readFileSync(csvPath, 'utf-8');
  const rates = new Map();

  for (const line of content.split('\n')) {
    // Match CLFS format: Year,Code,,Date,Indicator,Rate,NationalLimit,...
    // Regex: year, code (PLA 0XXXU or CPT 8XXXX), empty desc, date, indicator, then rates
    const match = line.match(/^(\d{4}),([^,]+),,(\d{8}),([A-Z]),([^,]*),([^,]*),?/i);
    if (!match) continue;

    const [, , code, , indicator, rateStr, nationalLimitStr] = match;

    // Only process PLA codes (0XXXU format) and relevant CPT codes (8XXXX)
    if (!code.match(/^(0\d{3}U|8\d{4})$/)) continue;

    const indicatorUpper = indicator.toUpperCase();

    // Parse rate values
    const rateVal = rateStr ? parseFloat(rateStr) : null;
    const nationalLimitVal = nationalLimitStr ? parseFloat(nationalLimitStr) : null;

    // Use national limit as the primary rate if available and larger
    let rate = null;
    let nationalLimit = null;

    if (!isNaN(nationalLimitVal) && nationalLimitVal > 0) {
      nationalLimit = nationalLimitVal;
      rate = nationalLimitVal;
    }
    if (!isNaN(rateVal) && rateVal > 0) {
      if (rate === null || rateVal > rate) {
        rate = rateVal;
      }
    }

    // Determine status based on indicator
    let status = 'Priced';
    if (indicatorUpper === 'L') {
      // L = Carrier (MAC) priced, no national limit
      status = 'MAC-Priced';
      rate = null;
      nationalLimit = null;
    } else if (indicatorUpper === 'N') {
      // N = Not priced/no longer valid
      status = 'Not Valid';
    } else if (rate === null || rate === 0) {
      status = 'MAC-Priced';
      rate = null;
    }

    rates.set(code, {
      code,
      rate,
      status,
      nationalLimit,
      effective: quarter,
    });
  }

  logger.info(`Parsed CLFS data`, { codesFound: rates.size });
  return rates;
}

/**
 * Load rates from disk cache if valid
 * @returns {boolean} True if cache was loaded successfully
 */
function loadFromCache() {
  try {
    if (!existsSync(CACHE_FILE)) {
      logger.debug('No cache file found');
      return false;
    }

    const stats = statSync(CACHE_FILE);
    const age = Date.now() - stats.mtimeMs;

    if (age > CACHE_MAX_AGE_MS) {
      const ageDays = Math.round(age / (24 * 60 * 60 * 1000));
      logger.info(`Cache expired`, { ageDays, maxAgeDays: 7 });
      return false;
    }

    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));

    // Validate cache structure
    if (!data.rates || !data.quarter || !data.timestamp) {
      logger.warn('Invalid cache structure, ignoring');
      return false;
    }

    // Check if a new quarter is available (e.g., cached Q4 but now in Q1)
    const currentQuarter = getCurrentQuarter();
    const isNewQuarterAvailable = data.quarter !== currentQuarter;

    if (isNewQuarterAvailable) {
      logger.info(`New quarter detected, will attempt refresh`, {
        cached: data.quarter,
        current: currentQuarter
      });
      // Return false to trigger download attempt
      // If download fails, we'll fall back to this cache in initializeCLFS
      return false;
    }

    ratesCache = new Map(Object.entries(data.rates));
    cacheQuarter = data.quarter;

    const ageHours = Math.round(age / (60 * 60 * 1000));
    logger.info(`Loaded rates from cache`, {
      codesLoaded: ratesCache.size,
      quarter: cacheQuarter,
      ageHours
    });
    return true;
  } catch (e) {
    logger.warn(`Failed to load cache`, { error: e.message });
    return false;
  }
}

/**
 * Save rates to disk cache
 * @param {Map<string, PLARate>} rates
 * @param {string} quarter
 */
function saveToCache(rates, quarter) {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    const data = {
      quarter,
      timestamp: new Date().toISOString(),
      rates: Object.fromEntries(rates)
    };

    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    logger.info(`Saved rates to cache`, { codesCount: rates.size, quarter });
  } catch (e) {
    logger.error(`Failed to save cache`, { error: e.message });
  }
}

/**
 * Initialize the CLFS rate data.
 * Call this once at crawler startup. Loads from cache if available and not expired,
 * otherwise downloads fresh data from CMS.
 *
 * @returns {Promise<void>}
 */
export async function initializeCLFS() {
  if (initialized && ratesCache) {
    logger.debug('CLFS already initialized');
    return;
  }

  // Try cache first (returns false if expired or new quarter available)
  if (loadFromCache()) {
    initialized = true;
    return;
  }

  // Download fresh data
  try {
    logger.info('Downloading fresh CLFS data from CMS');
    const { rates, quarter } = await downloadCLFS();
    ratesCache = rates;
    cacheQuarter = quarter;
    saveToCache(rates, quarter);
    initialized = true;
  } catch (e) {
    logger.error(`Failed to download CLFS data`, { error: e.message });

    // Fallback: try loading stale cache (better than nothing)
    if (loadStaleCacheAsFallback()) {
      logger.warn(`Using stale CLFS cache as fallback`);
      initialized = true;
      return;
    }

    // Last resort: empty cache
    logger.error(`No CLFS data available, rate lookups will return null`);
    ratesCache = new Map();
    cacheQuarter = 'unknown';
    initialized = true;
  }
}

/**
 * Load stale cache as fallback when download fails
 * Ignores TTL and quarter checks - just loads whatever is there
 * @returns {boolean}
 */
function loadStaleCacheAsFallback() {
  try {
    if (!existsSync(CACHE_FILE)) return false;

    const data = JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    if (!data.rates || !data.quarter) return false;

    ratesCache = new Map(Object.entries(data.rates));
    cacheQuarter = data.quarter;

    logger.info(`Loaded stale cache as fallback`, {
      codesLoaded: ratesCache.size,
      quarter: cacheQuarter
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Ensure rates are loaded (internal helper)
 * @returns {Promise<void>}
 */
async function ensureRatesLoaded() {
  if (!initialized || !ratesCache) {
    await initializeCLFS();
  }
}

/**
 * Look up Medicare rate for a PLA/CPT code
 *
 * @param {string} code - PLA code (e.g., '0179U') or CPT code (e.g., '81528')
 * @returns {Promise<PLARate|null>} Rate info or null if not found
 */
export async function lookupPLARate(code) {
  await ensureRatesLoaded();

  if (!code) return null;

  // Normalize code format
  const normalizedCode = code.toUpperCase().trim();

  const cached = ratesCache.get(normalizedCode);
  if (cached) {
    return cached;
  }

  // Return null for codes not in CLFS
  return null;
}

/**
 * Look up Medicare rates for multiple PLA/CPT codes
 *
 * @param {string[]} codes - Array of PLA/CPT codes
 * @returns {Promise<Map<string, PLARate>>} Map of code to rate info (excludes not-found codes)
 */
export async function lookupMultiplePLARates(codes) {
  await ensureRatesLoaded();

  const results = new Map();

  for (const code of codes) {
    if (!code) continue;

    const normalizedCode = code.toUpperCase().trim();
    const rate = ratesCache.get(normalizedCode);

    if (rate) {
      results.set(normalizedCode, rate);
    }
  }

  return results;
}

/**
 * Get the current CLFS quarter being used
 * @returns {Promise<string>}
 */
export async function getCLFSQuarter() {
  await ensureRatesLoaded();
  return cacheQuarter || 'unknown';
}

/**
 * Force refresh the CLFS data from CMS
 * @returns {Promise<void>}
 */
export async function refreshCLFS() {
  ratesCache = null;
  cacheQuarter = null;
  initialized = false;

  const { rates, quarter } = await downloadCLFS();
  ratesCache = rates;
  cacheQuarter = quarter;
  saveToCache(rates, quarter);
  initialized = true;
}

/**
 * Extract PLA codes from text content
 * @param {string} text - Text to search for PLA codes
 * @returns {string[]} Array of found PLA codes
 */
export function extractPLACodes(text) {
  if (!text) return [];

  // Match PLA codes: 0XXXU format
  const plaPattern = /\b(0\d{3}U)\b/gi;
  const matches = text.match(plaPattern) || [];

  // Dedupe and normalize
  return [...new Set(matches.map(c => c.toUpperCase()))];
}

export default {
  initializeCLFS,
  lookupPLARate,
  lookupMultiplePLARates,
  getCLFSQuarter,
  refreshCLFS,
  extractPLACodes
};
