/**
 * Version Watcher
 * Monitors public guideline pages for version changes
 * Sends email alerts when new versions are detected
 */

import * as cheerio from 'cheerio';
import { query } from '../db/client.js';
import { sendEmail } from '../email/index.js';
import { createHttpClient } from '../utils/http.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('version-watcher');
const http = createHttpClient('version-watcher', { requestsPerMinute: 10 });

// Guideline pages to monitor for version changes
const GUIDELINE_PAGES = [
  {
    source_key: 'nccn-colorectal',
    url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1428',
    versionSelector: '.version-info, .guideline-version, .version',
    versionPattern: /Version\s*(\d+\.\d{4})/i,
    fallbackPattern: /(\d+\.\d{4})/,
  },
  {
    source_key: 'nccn-breast',
    url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419',
    versionSelector: '.version-info, .guideline-version, .version',
    versionPattern: /Version\s*(\d+\.\d{4})/i,
    fallbackPattern: /(\d+\.\d{4})/,
  },
  {
    source_key: 'nccn-lung',
    url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1450',
    versionSelector: '.version-info, .guideline-version, .version',
    versionPattern: /Version\s*(\d+\.\d{4})/i,
    fallbackPattern: /(\d+\.\d{4})/,
  },
  {
    source_key: 'nccn-bladder',
    url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1417',
    versionSelector: '.version-info, .guideline-version, .version',
    versionPattern: /Version\s*(\d+\.\d{4})/i,
    fallbackPattern: /(\d+\.\d{4})/,
  },
  {
    source_key: 'nccn-gastric',
    url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1434',
    versionSelector: '.version-info, .guideline-version, .version',
    versionPattern: /Version\s*(\d+\.\d{4})/i,
    fallbackPattern: /(\d+\.\d{4})/,
  },
];

/**
 * Extract version string from page content
 */
function extractVersion(html, config) {
  const $ = cheerio.load(html);

  // Try selector first
  if (config.versionSelector) {
    const elements = $(config.versionSelector);
    for (const el of elements.toArray()) {
      const text = $(el).text().trim();
      const match = text.match(config.versionPattern);
      if (match) return match[1];
    }
  }

  // Try searching full page text
  const pageText = $('body').text();
  const match = pageText.match(config.versionPattern);
  if (match) return match[1];

  // Try fallback pattern
  if (config.fallbackPattern) {
    const fallbackMatch = pageText.match(config.fallbackPattern);
    if (fallbackMatch) return fallbackMatch[1];
  }

  return null;
}

/**
 * Check a single guideline for version changes
 */
async function checkGuideline(config) {
  try {
    logger.debug(`Checking version for ${config.source_key}`);

    const html = await http.getText(config.url);
    const currentVersion = extractVersion(html, config);

    if (!currentVersion) {
      logger.warn(`Could not extract version for ${config.source_key}`);
      return { source_key: config.source_key, status: 'no_version' };
    }

    // Get stored version from source registry
    const source = await query(
      'SELECT id, version_string, display_name FROM mrd_sources WHERE source_key = $1',
      [config.source_key]
    );

    if (source.rows.length === 0) {
      logger.warn(`Source not in registry: ${config.source_key}`);
      return { source_key: config.source_key, status: 'not_registered' };
    }

    const { id: sourceId, version_string: storedVersion, display_name } = source.rows[0];

    // Update last checked timestamp
    await query(
      'UPDATE mrd_sources SET last_checked_at = NOW() WHERE id = $1',
      [sourceId]
    );

    if (!storedVersion) {
      // First time - just record version
      await query(
        'UPDATE mrd_sources SET version_string = $1 WHERE id = $2',
        [currentVersion, sourceId]
      );
      logger.info(`Recorded initial version for ${config.source_key}: ${currentVersion}`);
      return {
        source_key: config.source_key,
        status: 'initial',
        version: currentVersion,
      };
    }

    if (storedVersion !== currentVersion) {
      // Version changed!
      logger.info(`Version change detected: ${config.source_key} ${storedVersion} → ${currentVersion}`);

      // Update source with new version
      await query(
        'UPDATE mrd_sources SET version_string = $1, updated_at = NOW() WHERE id = $2',
        [currentVersion, sourceId]
      );

      // Record as a release observation
      try {
        await query(`
          INSERT INTO mrd_source_releases (
            source_id, release_key, detector, version_string, status
          ) VALUES ($1, $2, 'version-watcher', $3, 'observed')
          ON CONFLICT (source_id, release_key) DO NOTHING
        `, [sourceId, currentVersion, currentVersion]);
      } catch (error) {
        logger.warn(`Could not record release for ${config.source_key}`, { error: error.message });
      }

      // Send alert email
      await sendEmail({
        subject: `🔔 New guideline version: ${display_name} ${currentVersion}`,
        text: `A new version of ${display_name} is available.

Old version: ${storedVersion}
New version: ${currentVersion}

Please download the updated PDF from:
${config.url}

Then place it in the guidelines folder for automatic processing.`,
        html: `
          <h2>New Guideline Version Available</h2>
          <p>A new version of <strong>${display_name}</strong> has been detected.</p>
          <table>
            <tr><td>Old version:</td><td>${storedVersion}</td></tr>
            <tr><td>New version:</td><td><strong>${currentVersion}</strong></td></tr>
          </table>
          <p><a href="${config.url}">Download from NCCN</a></p>
          <p><em>Place the PDF in the guidelines folder for automatic processing.</em></p>
        `,
      });

      return {
        source_key: config.source_key,
        status: 'changed',
        oldVersion: storedVersion,
        newVersion: currentVersion,
      };
    }

    logger.debug(`No change for ${config.source_key}: ${currentVersion}`);
    return {
      source_key: config.source_key,
      status: 'unchanged',
      version: currentVersion,
    };

  } catch (error) {
    logger.error(`Failed to check ${config.source_key}`, { error: error.message });
    return {
      source_key: config.source_key,
      status: 'error',
      error: error.message,
    };
  }
}

/**
 * Check all guideline versions
 */
export async function checkGuidelineVersions() {
  const results = {
    checked: 0,
    changed: 0,
    errors: 0,
    details: [],
  };

  logger.info('Starting guideline version check');

  for (const config of GUIDELINE_PAGES) {
    const result = await checkGuideline(config);
    results.details.push(result);
    results.checked++;

    if (result.status === 'changed') {
      results.changed++;
    } else if (result.status === 'error') {
      results.errors++;
    }

    // Rate limit between checks
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  logger.info('Guideline version check complete', {
    checked: results.checked,
    changed: results.changed,
    errors: results.errors,
  });

  return results;
}

/**
 * Get all registered guidelines with version info
 */
export async function getGuidelineVersions() {
  const result = await query(`
    SELECT
      source_key,
      display_name,
      version_string,
      last_checked_at,
      last_release_at,
      EXTRACT(DAYS FROM NOW() - COALESCE(last_checked_at, created_at))::INTEGER as days_since_check
    FROM mrd_sources
    WHERE source_type = 'guideline'
    ORDER BY source_key
  `);

  return result.rows;
}

export default {
  checkGuidelineVersions,
  getGuidelineVersions,
};
