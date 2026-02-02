/**
 * CMS LCD Ingestion for MRD Guidance Monitor
 *
 * Fetches MolDX LCDs related to ctDNA/MRD from CMS API and ingests them
 * as guidance items. Stores metadata and links to official CMS documents.
 *
 * Usage:
 *   npm run mrd:crawl cms-ingest [--dry-run]
 */

import https from 'https';
import { createLogger } from '../utils/logger.js';
import { query, close } from '../db/client.js';

const logger = createLogger('cms-ingest');

const CMS_API_BASE = 'https://api.coverage.cms.gov';

// Terms to filter for ctDNA/MRD relevant LCDs
const RELEVANT_TERMS = [
  'liquid biopsy',
  'ctdna',
  'circulating tumor',
  'mrd',
  'minimal residual',
  'signatera',
  'guardant',
  'foundation',
  'tumor cell',
];

// Contractor mapping for payer identification
const CONTRACTOR_MAP = {
  'palmetto': 'moldx-palmetto',
  'noridian': 'moldx-noridian',
  'cgs': 'moldx-cgs',
  'ngsmac': 'moldx-ngs',
  'novitas': 'moldx-novitas',
  'first coast': 'moldx-firstcoast',
  'wisconsin': 'moldx-wps',
};

/**
 * HTTP GET with promise
 */
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response from ${url}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Get CMS API license token
 */
async function getLicenseToken() {
  const response = await httpGet(`${CMS_API_BASE}/v1/metadata/license-agreement`);
  const token = response?.data?.[0]?.Token;
  if (!token) {
    throw new Error('Failed to obtain CMS API license token');
  }
  return token;
}

/**
 * Search CMS for LCDs
 */
async function searchLCDs(token, keyword) {
  const url = `${CMS_API_BASE}/v1/reports/local-coverage-final-lcds?keyword=${encodeURIComponent(keyword)}`;
  const response = await httpGet(url, { Authorization: `Bearer ${token}` });
  return response?.data || [];
}

/**
 * Search CMS for billing articles
 */
async function searchArticles(token, keyword) {
  const url = `${CMS_API_BASE}/v1/reports/local-coverage-articles?keyword=${encodeURIComponent(keyword)}`;
  const response = await httpGet(url, { Authorization: `Bearer ${token}` });
  return response?.data || [];
}

/**
 * Extract contractor/payer ID from contractor name
 */
function extractPayerId(contractorName) {
  const lowerName = (contractorName || '').toLowerCase();
  for (const [key, value] of Object.entries(CONTRACTOR_MAP)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }
  return 'medicare-lcd';
}

/**
 * Extract cancer types from LCD title
 */
function extractCancerTypes(title) {
  const lowerTitle = (title || '').toLowerCase();
  const cancerTypes = [];

  const patterns = {
    'colorectal': ['colorectal', 'colon', 'rectal'],
    'breast': ['breast'],
    'lung': ['lung', 'nsclc'],
    'bladder': ['bladder', 'urothelial'],
    'melanoma': ['melanoma'],
    'solid_tumor': ['solid tumor', 'cancer'],
  };

  for (const [type, keywords] of Object.entries(patterns)) {
    if (keywords.some(k => lowerTitle.includes(k))) {
      cancerTypes.push(type);
    }
  }

  // Default to solid_tumor if no specific type found
  if (cancerTypes.length === 0) {
    cancerTypes.push('solid_tumor');
  }

  return cancerTypes;
}

/**
 * Determine evidence type from document type
 */
function getEvidenceType(docType, title) {
  const lowerTitle = (title || '').toLowerCase();

  if (lowerTitle.includes('billing')) {
    return 'billing_guidance';
  }
  if (docType === 'LCD') {
    return 'payer_policy';
  }
  if (docType === 'Article') {
    return 'billing_article';
  }
  return 'payer_policy';
}

/**
 * Check if LCD is relevant to ctDNA/MRD
 */
function isRelevant(lcd) {
  const title = (lcd.title || '').toLowerCase();

  // Must be MolDX
  if (!title.includes('moldx')) {
    return false;
  }

  // Must match at least one relevant term
  return RELEVANT_TERMS.some(term => title.includes(term));
}

/**
 * Ingest LCDs into database
 */
async function ingestLCDs(lcds, options = {}) {
  const { dryRun = false } = options;
  const results = { saved: 0, skipped: 0, updated: 0 };

  for (const lcd of lcds) {
    const lcdId = lcd.document_display_id || `LCD-${lcd.document_id}`;
    const sourceId = `cms-${lcdId}-v${lcd.document_version || 1}`;

    try {
      // Check if already exists
      const existing = await query(
        `SELECT id, source_version FROM mrd_guidance_items
         WHERE source_type LIKE 'payer-%' AND source_id LIKE $1`,
        [`cms-${lcdId}%`]
      );

      if (existing.rows.length > 0) {
        const existingVersion = existing.rows[0].source_version;
        if (existingVersion === lcd.document_version?.toString()) {
          results.skipped++;
          continue;
        }
        // Would update to new version - mark old as superseded
        if (!dryRun) {
          await query(
            `UPDATE mrd_guidance_items SET is_superseded = TRUE WHERE id = $1`,
            [existing.rows[0].id]
          );
        }
        results.updated++;
      }

      const payerId = extractPayerId(lcd.contractor_name_type);
      const cancerTypes = extractCancerTypes(lcd.title);
      const evidenceType = getEvidenceType(lcd.document_type, lcd.title);

      // Build summary from available metadata
      const summaryParts = [
        `Medicare ${lcd.document_type} coverage determination`,
        lcd.contractor_name_type ? `Contractor: ${lcd.contractor_name_type.split('\n')[0]}` : null,
        lcd.effective_date ? `Effective: ${lcd.effective_date}` : null,
      ].filter(Boolean);

      const summary = summaryParts.join('. ');

      // Decision context with coverage metadata
      const decisionContext = {
        decision_point: 'Medicare coverage determination',
        coverage_status: 'covered_with_conditions',
        contractor: lcd.contractor_name_type,
        effective_date: lcd.effective_date,
        document_type: lcd.document_type,
        document_version: lcd.document_version,
      };

      if (dryRun) {
        logger.info('Would save LCD', { lcdId, title: lcd.title?.substring(0, 50) });
      } else {
        // Insert guidance item
        const insertResult = await query(
          `INSERT INTO mrd_guidance_items (
            source_type, source_id, source_url,
            title, summary, evidence_type, evidence_level,
            publication_date, decision_context, extraction_version, source_version
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id`,
          [
            `payer-${payerId}`,
            sourceId,
            lcd.url,
            lcd.title,
            summary,
            evidenceType,
            'Medicare LCD',
            lcd.effective_date ? new Date(lcd.effective_date) : new Date(),
            JSON.stringify(decisionContext),
            1,
            lcd.document_version?.toString(),
          ]
        );

        const guidanceId = insertResult.rows[0].id;

        // Add cancer types
        for (const cancerType of cancerTypes) {
          await query(
            `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [guidanceId, cancerType]
          );
        }

        // Add clinical setting
        await query(
          `INSERT INTO mrd_guidance_clinical_settings (guidance_id, clinical_setting)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [guidanceId, 'coverage_determination']
        );

        logger.info('Saved LCD', { id: guidanceId, lcdId, title: lcd.title?.substring(0, 50) });
      }

      results.saved++;

    } catch (error) {
      logger.warn('Failed to save LCD', { lcdId, error: error.message });
    }
  }

  return results;
}

/**
 * Main ingestion function
 */
export async function ingestCMSData(options = {}) {
  const { dryRun = false } = options;

  logger.info('Starting CMS LCD ingestion', { dryRun });

  try {
    // Get API token
    const token = await getLicenseToken();
    logger.info('Obtained CMS API token');

    // Collect all relevant LCDs
    const seenIds = new Set();
    const relevantLCDs = [];

    // Search with MolDX keyword (returns all MolDX LCDs)
    logger.info('Searching CMS for MolDX LCDs...');
    const allLCDs = await searchLCDs(token, 'MolDX');
    logger.info(`Found ${allLCDs.length} total MolDX LCDs`);

    // Filter for ctDNA/MRD relevance
    for (const lcd of allLCDs) {
      const id = lcd.document_id;
      if (id && !seenIds.has(id) && isRelevant(lcd)) {
        seenIds.add(id);
        relevantLCDs.push(lcd);
      }
    }

    logger.info(`Filtered to ${relevantLCDs.length} ctDNA/MRD relevant LCDs`);

    // Also get billing articles
    logger.info('Searching for billing articles...');
    const articles = await searchArticles(token, 'MRD');
    const relevantArticles = articles.filter(a => {
      const title = (a.title || '').toLowerCase();
      return title.includes('moldx') && title.includes('minimal residual');
    });
    logger.info(`Found ${relevantArticles.length} MRD billing articles`);

    // Combine LCDs and articles
    const allDocs = [...relevantLCDs, ...relevantArticles];

    // Deduplicate by title (keep most recent version)
    const byTitle = new Map();
    for (const doc of allDocs) {
      const key = doc.title?.toLowerCase();
      const existing = byTitle.get(key);
      if (!existing || (doc.document_version || 0) > (existing.document_version || 0)) {
        byTitle.set(key, doc);
      }
    }
    const dedupedDocs = Array.from(byTitle.values());
    logger.info(`After deduplication: ${dedupedDocs.length} documents`);

    // Ingest into database
    const results = await ingestLCDs(dedupedDocs, { dryRun });

    logger.info('CMS ingestion complete', results);

    return {
      success: true,
      totalFound: allDocs.length,
      deduplicated: dedupedDocs.length,
      ...results,
    };

  } catch (error) {
    logger.error('CMS ingestion failed', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List available LCDs without ingesting
 */
export async function listCMSData() {
  logger.info('Listing available CMS LCDs...');

  try {
    const token = await getLicenseToken();
    const allLCDs = await searchLCDs(token, 'MolDX');

    const relevant = allLCDs.filter(isRelevant);

    console.log('\n=== CMS MolDX LCDs for ctDNA/MRD ===\n');
    console.log(`Total MolDX LCDs: ${allLCDs.length}`);
    console.log(`Relevant to ctDNA/MRD: ${relevant.length}\n`);

    // Group by title (excluding version differences)
    const byTitle = new Map();
    for (const lcd of relevant) {
      const title = lcd.title;
      if (!byTitle.has(title)) {
        byTitle.set(title, []);
      }
      byTitle.get(title).push(lcd);
    }

    console.log('Unique policies:');
    for (const [title, versions] of byTitle) {
      const latest = versions.sort((a, b) => (b.document_version || 0) - (a.document_version || 0))[0];
      console.log(`\n  ${latest.document_display_id}: ${title}`);
      console.log(`    Effective: ${latest.effective_date} | Version: ${latest.document_version}`);
      console.log(`    Contractors: ${versions.length}`);
    }

    return { success: true, count: relevant.length };

  } catch (error) {
    logger.error('Failed to list CMS data', { error: error.message });
    return { success: false, error: error.message };
  }
}

// CLI execution
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     process.argv[1]?.endsWith('cms-ingest.js');

if (isMainModule) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const listOnly = args.includes('--list');

  (async () => {
    try {
      if (listOnly) {
        await listCMSData();
      } else {
        const result = await ingestCMSData({ dryRun });
        console.log('\n=== CMS Ingestion Results ===');
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    } finally {
      await close();
    }
  })();
}

export default { ingestCMSData, listCMSData };
