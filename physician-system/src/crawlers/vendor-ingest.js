/**
 * Vendor Evidence Ingestion for Physician-System
 *
 * Primary mode: Direct DB write from test-data-tracker (automatic)
 * Backup mode: Read from export JSON file (manual fallback)
 *
 * The test-data-tracker vendor crawler writes directly to this DB when
 * PHYSICIAN_DATABASE_URL is configured. This script provides:
 * - Status checking for vendor evidence in the database
 * - Manual file-based import as a fallback
 * - Embedding generation trigger for new vendor evidence
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, transaction } from '../db/client.js';
import { createLogger } from '../utils/logger.js';
import { embedAfterInsert } from '../embeddings/mrd-embedder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = createLogger('vendor-ingest');

// Default path to test-data-tracker export (sibling repo)
const DEFAULT_EXPORT_PATH = path.resolve(__dirname, '../../../../test-data-tracker/data/clinical-evidence-export.json');

/**
 * Map vendor evidence to mrd_guidance_items schema
 */
function mapToGuidanceItem(item) {
  // Determine evidence type based on source
  let evidenceType = 'vendor_announcement';
  if (item.source_type === 'vendor_publication' && item.nct_id) {
    evidenceType = 'rct_results';
  } else if (item.source_type === 'vendor_performance') {
    evidenceType = 'observational';
  } else if (item.source_type === 'fda_vendor') {
    evidenceType = 'regulatory';
  }

  return {
    source_type: item.source_type || 'vendor',
    source_id: item.source_id,
    source_url: item.source_url,
    title: item.title,
    publication_date: item.publication_date ? new Date(item.publication_date) : new Date(),
    journal: item.journal,
    evidence_type: evidenceType,
    evidence_level: item.evidence_level,
    summary: item.summary,
    full_text_excerpt: item.full_text_excerpt,
    // Store vendor-specific metadata in decision_context JSONB
    decision_context: JSON.stringify({
      vendor: item.vendor,
      test_name: item.test_name,
      nct_id: item.nct_id,
      trial_name: item.trial_name,
      metric: item.metric,
      value: item.value,
      cancer_type: item.cancer_type,
      stage: item.stage,
      regulatory_action: item.regulatory_action,
      indication: item.indication,
      import_source: 'vendor-pipeline',
      imported_at: new Date().toISOString(),
    }),
  };
}

/**
 * Check if item already exists in database
 */
async function itemExists(sourceType, sourceId) {
  const result = await query(
    'SELECT id FROM mrd_guidance_items WHERE source_type = $1 AND source_id = $2',
    [sourceType, sourceId]
  );
  return result.rows.length > 0;
}

/**
 * Insert a guidance item into the database
 */
async function insertGuidanceItem(item) {
  const mapped = mapToGuidanceItem(item);

  const result = await query(
    `INSERT INTO mrd_guidance_items (
      source_type, source_id, source_url,
      title, publication_date, journal,
      evidence_type, evidence_level,
      summary, full_text_excerpt, decision_context
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (source_type, source_id) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      full_text_excerpt = EXCLUDED.full_text_excerpt,
      decision_context = EXCLUDED.decision_context,
      updated_at = NOW()
    RETURNING id, (xmax = 0) as is_new`,
    [
      mapped.source_type,
      mapped.source_id,
      mapped.source_url,
      mapped.title,
      mapped.publication_date,
      mapped.journal,
      mapped.evidence_type,
      mapped.evidence_level,
      mapped.summary,
      mapped.full_text_excerpt,
      mapped.decision_context,
    ]
  );

  const id = result.rows[0].id;
  const isNew = result.rows[0].is_new;

  if (isNew) {
    await embedAfterInsert(id, 'vendor-ingest');
  }

  return { id, isNew };
}

/**
 * Add cancer type association for a guidance item
 */
async function addCancerType(guidanceId, cancerType) {
  // Normalize cancer type to our enum values
  const cancerTypeMap = {
    'colorectal': 'colorectal',
    'colon': 'colorectal',
    'rectal': 'colorectal',
    'breast': 'breast',
    'lung': 'lung_nsclc',
    'nsclc': 'lung_nsclc',
    'bladder': 'bladder',
    'urothelial': 'bladder',
    'pancreatic': 'pancreatic',
    'melanoma': 'melanoma',
    'ovarian': 'ovarian',
    'gastric': 'gastric',
    'esophageal': 'esophageal',
  };

  const normalized = cancerTypeMap[cancerType?.toLowerCase()] || 'multi_solid';

  await query(
    `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [guidanceId, normalized]
  );
}

/**
 * Ingest vendor evidence from export file
 * @param {Object} options - Ingestion options
 * @returns {Object} Ingestion results
 */
export async function ingestVendorEvidence(options = {}) {
  const {
    exportPath = DEFAULT_EXPORT_PATH,
    dryRun = false,
    markIngested = true,
  } = options;

  logger.info('Starting vendor evidence ingestion', { exportPath, dryRun });

  // Check if export file exists
  if (!fs.existsSync(exportPath)) {
    logger.warn('Export file not found', { exportPath });
    return {
      success: false,
      error: `Export file not found: ${exportPath}`,
      stats: { total: 0, new: 0, updated: 0, skipped: 0, failed: 0 },
    };
  }

  // Read export file
  let exportData;
  try {
    exportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
  } catch (error) {
    logger.error('Failed to parse export file', { error: error.message });
    return {
      success: false,
      error: `Failed to parse export file: ${error.message}`,
      stats: { total: 0, new: 0, updated: 0, skipped: 0, failed: 0 },
    };
  }

  const items = exportData.items || [];
  logger.info('Found items to ingest', { count: items.length });

  const stats = {
    total: items.length,
    new: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  const ingested = [];
  const failed = [];

  for (const item of items) {
    try {
      // Skip already-ingested items if marked
      if (item._ingested && !options.forceReingest) {
        stats.skipped++;
        continue;
      }

      if (dryRun) {
        logger.info('Would ingest', { title: item.title, source_id: item.source_id });
        stats.new++;
        continue;
      }

      // Insert into database
      const result = await insertGuidanceItem(item);

      if (result.isNew) {
        stats.new++;
        logger.info('Inserted new item', { id: result.id, title: item.title });
      } else {
        stats.updated++;
        logger.debug('Updated existing item', { id: result.id, title: item.title });
      }

      // Add cancer type if specified
      if (item.cancer_type) {
        await addCancerType(result.id, item.cancer_type);
      }

      ingested.push({
        id: result.id,
        source_id: item.source_id,
        isNew: result.isNew,
      });

      // Mark as ingested in export file
      item._ingested = true;
      item._ingestedAt = new Date().toISOString();
      item._guidanceId = result.id;

    } catch (error) {
      stats.failed++;
      logger.error('Failed to ingest item', {
        source_id: item.source_id,
        error: error.message,
      });
      failed.push({
        source_id: item.source_id,
        error: error.message,
      });
    }
  }

  // Update export file with ingestion markers
  if (markIngested && !dryRun && ingested.length > 0) {
    try {
      exportData.lastIngested = new Date().toISOString();
      exportData.ingestStats = stats;
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
      logger.info('Updated export file with ingestion markers');
    } catch (error) {
      logger.warn('Failed to update export file', { error: error.message });
    }
  }

  logger.info('Vendor evidence ingestion complete', { stats });

  return {
    success: stats.failed === 0,
    stats,
    ingested,
    failed,
  };
}

/**
 * CLI entry point
 */
export async function runCLI(options = {}) {
  const result = await ingestVendorEvidence(options);

  console.log('\n=== Vendor Evidence Ingestion Results ===');
  console.log(`Status: ${result.success ? 'Success' : 'Completed with errors'}`);
  console.log('\nStats:');
  console.log(`  Total items: ${result.stats.total}`);
  console.log(`  New: ${result.stats.new}`);
  console.log(`  Updated: ${result.stats.updated}`);
  console.log(`  Skipped: ${result.stats.skipped}`);
  console.log(`  Failed: ${result.stats.failed}`);

  if (result.failed?.length > 0) {
    console.log('\nFailed items:');
    for (const f of result.failed.slice(0, 5)) {
      console.log(`  - ${f.source_id}: ${f.error}`);
    }
  }

  return result;
}

/**
 * Check status of vendor evidence in the database
 * Shows what's been imported from the vendor pipeline
 */
export async function checkVendorEvidenceStatus() {
  const result = await query(`
    SELECT
      source_type,
      evidence_type,
      COUNT(*) as count,
      MIN(created_at) as oldest,
      MAX(created_at) as newest,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d
    FROM mrd_guidance_items
    WHERE source_type IN ('vendor', 'vendor_publication', 'vendor_performance', 'fda_vendor')
    GROUP BY source_type, evidence_type
    ORDER BY source_type, evidence_type
  `);

  const embeddingStatus = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings
    FROM mrd_guidance_items
    WHERE source_type IN ('vendor', 'vendor_publication', 'vendor_performance', 'fda_vendor')
  `);

  return {
    byType: result.rows,
    embeddings: embeddingStatus.rows[0],
  };
}

export default {
  ingestVendorEvidence,
  checkVendorEvidenceStatus,
  runCLI,
};
