/**
 * Source Discovery / Audit Tool
 *
 * Discovers new candidate sources for the publication-index by:
 * 1. Scanning PubMed author affiliations for new vendor companies
 * 2. Checking known vendor websites for /publications or /evidence pages
 * 3. Auditing existing mrd_sources for stale or broken URLs
 *
 * This is an audit/discovery tool — it outputs suggestions for manual review.
 * It does NOT automatically register new sources.
 *
 * Usage:
 *   node src/crawlers/mrd/cli.js discover-sources
 *   node src/crawlers/mrd/cli.js discover-sources --stale
 */

import { createHttpClient } from '../../utils/http.js';
import { createLogger } from '../../utils/logger.js';
import { query } from '../../db/mrd-client.js';

const logger = createLogger('source-discovery');

const http = createHttpClient('source-discovery', { rateLimitMs: 4000 }); // ~15 req/min

// Known vendor domains to scan for evidence pages
const VENDOR_DOMAINS = [
  { vendor: 'Natera', domain: 'natera.com', paths: ['/oncology/signatera/publications', '/oncology/publications'] },
  { vendor: 'Guardant Health', domain: 'guardanthealth.com', paths: ['/publications', '/clinical-evidence', '/providers/publications'] },
  { vendor: 'Foundation Medicine', domain: 'foundationmedicine.com', paths: ['/clinical-evidence', '/publications'] },
  { vendor: 'Tempus', domain: 'tempus.com', paths: ['/publications', '/clinical-evidence', '/research'] },
  { vendor: 'NeoGenomics', domain: 'neogenomics.com', paths: ['/publications', '/clinical-evidence'] },
  { vendor: 'Biodesix', domain: 'biodesix.com', paths: ['/publications', '/clinical-evidence'] },
  { vendor: 'GRAIL', domain: 'grail.com', paths: ['/publications', '/clinical-evidence', '/science'] },
  { vendor: 'Exact Sciences', domain: 'exactsciences.com', paths: ['/publications', '/clinical-evidence'] },
  { vendor: 'Myriad Genetics', domain: 'myriad.com', paths: ['/publications', '/clinical-evidence'] },
  { vendor: 'Invitae', domain: 'invitae.com', paths: ['/publications', '/clinical-evidence'] },
  { vendor: 'Resolution Bioscience', domain: 'resolutionbio.com', paths: ['/publications', '/evidence'] },
  { vendor: 'Personalis', domain: 'personalis.com', paths: ['/publications', '/clinical-data'] },
  { vendor: 'Biovica', domain: 'biovica.com', paths: ['/publications', '/clinical-evidence'] },
  { vendor: 'Caris Life Sciences', domain: 'carislifesciences.com', paths: ['/publications', '/clinical-evidence'] },
];

// Publication-related path patterns to check on vendor sites
const EVIDENCE_PATH_PATTERNS = [
  '/publications',
  '/evidence',
  '/clinical-evidence',
  '/clinical-data',
  '/research/publications',
  '/science/publications',
  '/providers/publications',
];

/**
 * Get all currently registered source URLs from mrd_sources
 * @returns {Promise<Set<string>>} Set of registered base_url values
 */
async function getRegisteredSourceUrls() {
  const result = await query(
    'SELECT base_url, source_key FROM mrd_sources WHERE is_active = true'
  );

  const urls = new Set();
  for (const row of result.rows) {
    if (row.base_url) {
      urls.add(row.base_url.toLowerCase());
    }
  }
  return urls;
}

/**
 * Get all active sources with their staleness info
 * @returns {Promise<Object[]>}
 */
async function getSourcesWithStaleness() {
  const result = await query(`
    SELECT
      id, source_key, display_name, base_url,
      source_type, access_method,
      last_checked_at, stale_threshold_days,
      EXTRACT(DAYS FROM NOW() - last_checked_at)::INTEGER as days_since_check
    FROM mrd_sources
    WHERE is_active = true
    ORDER BY last_checked_at ASC NULLS FIRST
  `);
  return result.rows;
}

/**
 * Check if a URL is accessible via HTTP GET request
 * @param {string} url - URL to check
 * @returns {Promise<{ accessible: boolean, status?: number, error?: string }>}
 */
async function checkUrlHealth(url) {
  try {
    const response = await http.get(url, { maxRedirects: 3 });
    return {
      accessible: response.status >= 200 && response.status < 400,
      status: response.status,
    };
  } catch (error) {
    return {
      accessible: false,
      error: error.message,
      status: error.response?.status,
    };
  }
}

/**
 * Scan vendor websites for publication/evidence pages not already registered
 *
 * @param {Set<string>} registeredUrls - Already registered source URLs
 * @returns {Promise<Object[]>} Candidate sources
 */
async function scanVendorWebsites(registeredUrls) {
  const candidates = [];

  for (const vendor of VENDOR_DOMAINS) {
    logger.debug('Scanning vendor website', { vendor: vendor.vendor, domain: vendor.domain });

    for (const path of vendor.paths) {
      const url = `https://www.${vendor.domain}${path}`;
      const urlAlt = `https://${vendor.domain}${path}`;

      // Skip if already registered
      if (registeredUrls.has(url.toLowerCase()) || registeredUrls.has(urlAlt.toLowerCase())) {
        continue;
      }

      // Check if the URL is accessible
      const health = await checkUrlHealth(url);

      if (health.accessible) {
        candidates.push({
          type: 'vendor_website',
          vendor: vendor.vendor,
          url,
          status: health.status,
          suggestedSourceKey: `${vendor.vendor.toLowerCase().replace(/\s+/g, '_')}${path.replace(/\//g, '_')}`,
          suggestedSourceType: path.includes('publication') ? 'vendor_publications_index' : 'vendor_evidence_page',
        });

        logger.info('Found candidate source', {
          vendor: vendor.vendor,
          url,
          status: health.status,
        });

        break; // Found one working path for this vendor, skip rest
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return candidates;
}

/**
 * Scan PubMed for recent MRD publications and extract author affiliations
 * to identify vendor companies producing research
 *
 * @returns {Promise<Object[]>} Unique company affiliations
 */
async function scanPubMedAffiliations() {
  const affiliations = [];

  try {
    // Query recent MRD publications from our DB
    const result = await query(`
      SELECT DISTINCT
        decision_context->>'authors' as authors,
        decision_context->>'vendor_name' as vendor_name,
        title,
        journal
      FROM mrd_guidance_items
      WHERE source_type = 'pubmed'
        AND created_at > NOW() - INTERVAL '90 days'
      ORDER BY created_at DESC
      LIMIT 200
    `);

    // Extract unique vendor names from recent publications
    const vendorCounts = new Map();

    for (const row of result.rows) {
      if (row.vendor_name) {
        const v = row.vendor_name.toLowerCase();
        vendorCounts.set(v, (vendorCounts.get(v) || 0) + 1);
      }
    }

    // Return vendors that appear multiple times (more likely to be significant)
    for (const [vendor, count] of vendorCounts.entries()) {
      if (count >= 2) {
        affiliations.push({
          vendor,
          publicationCount: count,
          type: 'pubmed_affiliation',
        });
      }
    }
  } catch (error) {
    logger.warn('PubMed affiliation scan failed', { error: error.message });
  }

  return affiliations;
}

/**
 * Check existing sources for staleness and broken URLs
 *
 * @returns {Promise<{ stale: Object[], broken: Object[] }>}
 */
async function checkStaleOrBroken() {
  const sources = await getSourcesWithStaleness();

  const stale = [];
  const broken = [];

  for (const source of sources) {
    // Check staleness
    if (source.days_since_check !== null &&
        source.stale_threshold_days &&
        source.days_since_check > source.stale_threshold_days) {
      stale.push({
        sourceKey: source.source_key,
        displayName: source.display_name,
        url: source.base_url,
        daysSinceCheck: source.days_since_check,
        threshold: source.stale_threshold_days,
        overdueDays: source.days_since_check - source.stale_threshold_days,
      });
    }

    // Never checked
    if (source.last_checked_at === null) {
      stale.push({
        sourceKey: source.source_key,
        displayName: source.display_name,
        url: source.base_url,
        daysSinceCheck: null,
        threshold: source.stale_threshold_days,
        overdueDays: null,
        neverChecked: true,
      });
    }

    // Check URL health for sources with URLs
    if (source.base_url && source.access_method !== 'manual') {
      const health = await checkUrlHealth(source.base_url);

      if (!health.accessible) {
        broken.push({
          sourceKey: source.source_key,
          displayName: source.display_name,
          url: source.base_url,
          error: health.error || `HTTP ${health.status}`,
          status: health.status,
        });
      }

      // Rate limiting between health checks
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return { stale, broken };
}

/**
 * Run the full source discovery audit
 *
 * @param {Object} options - Discovery options
 * @param {boolean} options.staleOnly - Only check stale/broken sources
 * @returns {Promise<Object>} { candidates, stale, broken, affiliations }
 */
export async function discoverNewSources(options = {}) {
  const { staleOnly = false } = options;

  logger.info('Starting source discovery audit', { staleOnly });

  const results = {
    candidates: [],
    stale: [],
    broken: [],
    affiliations: [],
  };

  // Always check stale/broken
  logger.info('Checking stale and broken sources...');
  const { stale, broken } = await checkStaleOrBroken();
  results.stale = stale;
  results.broken = broken;

  if (!staleOnly) {
    // Scan vendor websites for new evidence pages
    logger.info('Scanning vendor websites for new sources...');
    const registeredUrls = await getRegisteredSourceUrls();
    results.candidates = await scanVendorWebsites(registeredUrls);

    // Scan PubMed affiliations for active vendors
    logger.info('Scanning PubMed affiliations...');
    results.affiliations = await scanPubMedAffiliations();
  }

  logger.info('Source discovery audit complete', {
    candidates: results.candidates.length,
    stale: results.stale.length,
    broken: results.broken.length,
    affiliations: results.affiliations.length,
  });

  return results;
}

export default { discoverNewSources };
