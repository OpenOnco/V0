/**
 * Physician-System Database Writer
 *
 * Writes clinical evidence directly to physician-system's PostgreSQL database.
 * This creates a direct pipeline from vendor monitoring to the RAG system.
 *
 * Requires PHYSICIAN_DATABASE_URL environment variable.
 */

import pg from 'pg';
import { createLogger } from '../utils/logger.js';

const { Pool } = pg;
const logger = createLogger('physician-db');

let pool = null;

/**
 * Get connection to physician-system database
 * Uses MRD_DATABASE_URL since both services share the same Supabase database
 */
function getPhysicianPool() {
  if (!pool) {
    // Both test-data-tracker and physician-system share the same database
    const connectionString = process.env.MRD_DATABASE_URL || process.env.PHYSICIAN_DATABASE_URL;

    if (!connectionString) {
      logger.debug('MRD_DATABASE_URL not configured - clinical evidence export disabled');
      return null;
    }

    // Use same SSL config as test-data-tracker main DB connection
    const useSSL = process.env.MRD_DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production';

    pool = new Pool({
      connectionString,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
      max: 3, // Small pool - we don't need many connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      logger.error('Physician DB pool error', { error: err.message });
    });
  }

  return pool;
}

/**
 * Check if physician-system DB is configured
 */
export function isPhysicianDbConfigured() {
  return !!(process.env.MRD_DATABASE_URL || process.env.PHYSICIAN_DATABASE_URL);
}

/**
 * Map vendor evidence to mrd_guidance_items schema
 */
function mapToGuidanceItem(evidence, vendorName, sourceUrl, discoveryType) {
  // Determine evidence type based on discovery type
  let evidenceType = 'vendor_announcement';
  let sourceType = 'vendor';

  if (discoveryType === 'clinical_evidence') {
    sourceType = 'vendor_publication';
    evidenceType = evidence.nctId ? 'rct_results' : 'observational';
  } else if (discoveryType === 'performance') {
    sourceType = 'vendor_performance';
    evidenceType = 'observational';
  } else if (discoveryType === 'regulatory') {
    sourceType = 'fda_vendor';
    evidenceType = 'regulatory';
  }

  // Generate unique source_id
  const sourceId = evidence.nctId ||
    evidence.publication ||
    `${vendorName.toLowerCase().replace(/\s+/g, '-')}-${discoveryType}-${Date.now()}`;

  return {
    source_type: sourceType,
    source_id: sourceId,
    source_url: sourceUrl,
    title: evidence.title || evidence.trialName || evidence.publication || `${vendorName} ${discoveryType}`,
    publication_date: evidence.date ? new Date(evidence.date) : new Date(),
    journal: evidence.publication || null,
    evidence_type: evidenceType,
    summary: evidence.findings || evidence.summary,
    full_text_excerpt: evidence.findings || evidence.summary,
    decision_context: {
      vendor: vendorName,
      test_name: evidence.testName,
      nct_id: evidence.nctId,
      trial_name: evidence.trialName,
      metric: evidence.metric,
      value: evidence.value,
      cancer_type: evidence.cancerType,
      stage: evidence.stage,
      regulatory_action: evidence.action,
      indication: evidence.indication,
      import_source: 'test-data-tracker-vendor-pipeline',
      imported_at: new Date().toISOString(),
    },
  };
}

/**
 * Insert a single evidence item into physician-system DB
 */
async function insertEvidenceItem(pool, item) {
  const result = await pool.query(
    `INSERT INTO mrd_guidance_items (
      source_type, source_id, source_url,
      title, publication_date, journal,
      evidence_type, summary, full_text_excerpt,
      decision_context
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (source_type, source_id) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      full_text_excerpt = EXCLUDED.full_text_excerpt,
      decision_context = EXCLUDED.decision_context,
      updated_at = NOW()
    RETURNING id, (xmax = 0) as is_new`,
    [
      item.source_type,
      item.source_id,
      item.source_url,
      item.title,
      item.publication_date,
      item.journal,
      item.evidence_type,
      item.summary,
      item.full_text_excerpt,
      JSON.stringify(item.decision_context),
    ]
  );

  return {
    id: result.rows[0].id,
    isNew: result.rows[0].is_new,
  };
}

/**
 * Add cancer type association
 */
async function addCancerType(pool, guidanceId, cancerType) {
  if (!cancerType) return;

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

  await pool.query(
    `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [guidanceId, normalized]
  );
}

/**
 * Write clinical evidence discoveries directly to physician-system DB
 *
 * @param {Array} discoveries - Discoveries from VendorCrawler
 * @returns {Object} Write results
 */
export async function writeToPhysicianDb(discoveries) {
  const physicianPool = getPhysicianPool();

  if (!physicianPool) {
    return {
      success: false,
      skipped: true,
      reason: 'PHYSICIAN_DATABASE_URL not configured',
      stats: { total: 0, new: 0, updated: 0, failed: 0 },
    };
  }

  const stats = {
    total: 0,
    new: 0,
    updated: 0,
    failed: 0,
  };

  const results = [];

  // Process clinical evidence
  for (const discovery of discoveries) {
    if (discovery.type !== 'vendor_clinical_evidence') continue;

    const { metadata, url } = discovery;
    stats.total++;

    try {
      const item = mapToGuidanceItem(
        {
          trialName: metadata.trialName,
          nctId: metadata.nctId,
          publication: metadata.publication,
          testName: metadata.testName,
          findings: metadata.findings,
          date: metadata.date,
        },
        metadata.vendorName,
        url,
        'clinical_evidence'
      );

      const result = await insertEvidenceItem(physicianPool, item);

      if (result.isNew) {
        stats.new++;
        logger.info('Inserted clinical evidence', { id: result.id, title: item.title });
      } else {
        stats.updated++;
      }

      results.push({ type: 'clinical_evidence', id: result.id, isNew: result.isNew });
    } catch (error) {
      stats.failed++;
      logger.error('Failed to insert clinical evidence', { error: error.message });
    }
  }

  // Process performance data
  for (const discovery of discoveries) {
    if (discovery.type !== 'vendor_performance_data') continue;

    const { metadata, url, summary } = discovery;
    stats.total++;

    try {
      const item = mapToGuidanceItem(
        {
          title: `${metadata.testName}: ${metadata.metric} in ${metadata.cancerType}`,
          testName: metadata.testName,
          metric: metadata.metric,
          value: metadata.value,
          cancerType: metadata.cancerType,
          stage: metadata.stage,
          findings: summary,
        },
        metadata.vendorName,
        url,
        'performance'
      );

      const result = await insertEvidenceItem(physicianPool, item);

      if (result.isNew) {
        stats.new++;

        // Add cancer type association
        if (metadata.cancerType) {
          await addCancerType(physicianPool, result.id, metadata.cancerType);
        }
      } else {
        stats.updated++;
      }

      results.push({ type: 'performance', id: result.id, isNew: result.isNew });
    } catch (error) {
      stats.failed++;
      logger.error('Failed to insert performance data', { error: error.message });
    }
  }

  // Process regulatory updates
  for (const discovery of discoveries) {
    if (discovery.type !== 'vendor_regulatory') continue;

    const { metadata, url, summary } = discovery;
    stats.total++;

    try {
      const item = mapToGuidanceItem(
        {
          title: `${metadata.testName}: ${metadata.action}`,
          testName: metadata.testName,
          action: metadata.action,
          indication: metadata.indication,
          date: metadata.date,
          findings: summary,
        },
        metadata.vendorName,
        url,
        'regulatory'
      );

      const result = await insertEvidenceItem(physicianPool, item);

      if (result.isNew) {
        stats.new++;
      } else {
        stats.updated++;
      }

      results.push({ type: 'regulatory', id: result.id, isNew: result.isNew });
    } catch (error) {
      stats.failed++;
      logger.error('Failed to insert regulatory update', { error: error.message });
    }
  }

  logger.info('Physician DB write complete', { stats });

  return {
    success: stats.failed === 0,
    skipped: false,
    stats,
    results,
  };
}

/**
 * Write resolved PubMed publications to physician-system DB
 * These are actual papers found via vendor publication hints
 *
 * @param {Array} resolvedItems - Items from publication-resolver with {evidence, publications}
 * @returns {Object} Write results
 */
export async function writePublicationsToPhysicianDb(resolvedItems) {
  const physicianPool = getPhysicianPool();

  if (!physicianPool) {
    return {
      success: false,
      skipped: true,
      reason: 'Database not configured',
      stats: { total: 0, new: 0, updated: 0, failed: 0 },
    };
  }

  const stats = {
    total: 0,
    new: 0,
    updated: 0,
    failed: 0,
  };

  const results = [];

  for (const { evidence, publications } of resolvedItems) {
    for (const pub of publications) {
      stats.total++;

      try {
        // Map PubMed article to mrd_guidance_items schema
        const item = {
          source_type: 'pubmed',
          source_id: pub.pmid,
          source_url: pub.sourceUrl,
          title: pub.title,
          publication_date: pub.publicationDate ? new Date(pub.publicationDate) : new Date(),
          journal: pub.journal,
          evidence_type: 'rct_results', // Most vendor-announced papers are trial results
          summary: pub.abstract?.substring(0, 1000),
          full_text_excerpt: pub.abstract,
          decision_context: {
            // PubMed metadata
            pmid: pub.pmid,
            doi: pub.doi,
            journal_abbrev: pub.journalAbbrev,
            authors: pub.authors?.slice(0, 5),
            // Vendor context - how we found this paper
            discovered_via: 'vendor_press_release',
            vendor_name: evidence.vendorName,
            test_name: evidence.testName,
            trial_name: evidence.trialName,
            cancer_type: evidence.cancerType,
            import_source: 'vendor-publication-pipeline',
            imported_at: new Date().toISOString(),
          },
        };

        const result = await physicianPool.query(
          `INSERT INTO mrd_guidance_items (
            source_type, source_id, source_url,
            title, publication_date, journal,
            evidence_type, summary, full_text_excerpt,
            decision_context, pmid, doi
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (source_type, source_id) DO UPDATE SET
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            full_text_excerpt = EXCLUDED.full_text_excerpt,
            decision_context = EXCLUDED.decision_context,
            updated_at = NOW()
          RETURNING id, (xmax = 0) as is_new`,
          [
            item.source_type,
            item.source_id,
            item.source_url,
            item.title,
            item.publication_date,
            item.journal,
            item.evidence_type,
            item.summary,
            item.full_text_excerpt,
            JSON.stringify(item.decision_context),
            pub.pmid,
            pub.doi,
          ]
        );

        if (result.rows[0].is_new) {
          stats.new++;
          logger.info('Inserted publication from vendor hint', {
            pmid: pub.pmid,
            title: pub.title?.substring(0, 60),
            vendor: evidence.vendorName,
          });

          // Add cancer type if known
          if (evidence.cancerType) {
            await addCancerType(physicianPool, result.rows[0].id, evidence.cancerType);
          }
        } else {
          stats.updated++;
        }

        results.push({
          pmid: pub.pmid,
          id: result.rows[0].id,
          isNew: result.rows[0].is_new,
        });

      } catch (error) {
        stats.failed++;
        logger.error('Failed to insert publication', {
          pmid: pub.pmid,
          error: error.message,
        });
      }
    }
  }

  logger.info('Publication write complete', { stats });

  return {
    success: stats.failed === 0,
    skipped: false,
    stats,
    results,
  };
}

/**
 * Write a single publication directly to physician-system DB
 * Used by publication-index crawler for extracted publications
 *
 * @param {Object} pub - Publication data
 * @param {Object} context - Discovery context (discoveredVia, sourceUrl)
 * @returns {Object} { id, isNew }
 */
export async function writePublicationToPhysicianDb(pub, context = {}) {
  const physicianPool = getPhysicianPool();

  if (!physicianPool) {
    throw new Error('Physician DB not configured');
  }

  // Determine source type and ID
  const sourceType = pub.pmid ? 'pubmed' : 'extracted_publication';
  const sourceId = pub.pmid || pub.doi || `ext-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Map to mrd_guidance_items schema
  const item = {
    source_type: sourceType,
    source_id: sourceId,
    source_url: pub.sourceUrl || pub.url || context.sourceUrl,
    title: pub.title,
    publication_date: pub.publicationDate ? new Date(pub.publicationDate) : (pub.year ? new Date(`${pub.year}-01-01`) : null),
    journal: pub.journal,
    evidence_type: pub.evidence_type || 'observational',
    summary: pub.clinical_context || pub.abstract?.substring(0, 1000),
    full_text_excerpt: pub.abstract,
    decision_context: {
      pmid: pub.pmid,
      doi: pub.doi,
      authors: pub.authors,
      cancer_types: pub.cancer_types,
      evidence_type: pub.evidence_type,
      discovered_via: context.discoveredVia || 'publication-index',
      import_source: 'publication-index-crawler',
      imported_at: new Date().toISOString(),
    },
  };

  const result = await physicianPool.query(
    `INSERT INTO mrd_guidance_items (
      source_type, source_id, source_url,
      title, publication_date, journal,
      evidence_type, summary, full_text_excerpt,
      decision_context, pmid, doi
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (source_type, source_id) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      full_text_excerpt = EXCLUDED.full_text_excerpt,
      decision_context = EXCLUDED.decision_context,
      updated_at = NOW()
    RETURNING id, (xmax = 0) as is_new`,
    [
      item.source_type,
      item.source_id,
      item.source_url,
      item.title,
      item.publication_date,
      item.journal,
      item.evidence_type,
      item.summary,
      item.full_text_excerpt,
      JSON.stringify(item.decision_context),
      pub.pmid || null,
      pub.doi || null,
    ]
  );

  const writeResult = {
    id: result.rows[0].id,
    isNew: result.rows[0].is_new,
  };

  if (writeResult.isNew) {
    logger.info('Inserted publication from index', {
      id: writeResult.id,
      title: item.title?.substring(0, 60),
    });

    // Add cancer type associations
    if (pub.cancer_types && Array.isArray(pub.cancer_types)) {
      for (const cancerType of pub.cancer_types) {
        await addCancerType(physicianPool, writeResult.id, cancerType);
      }
    }
  }

  return writeResult;
}

/**
 * Write a source-item edge to track provenance
 *
 * @param {number} sourceId - ID from mrd_sources table
 * @param {number} guidanceId - ID from mrd_guidance_items table
 * @param {Object} options - Additional edge metadata
 * @returns {Object} { id, isNew }
 */
export async function writeSourceItemEdge(sourceId, guidanceId, options = {}) {
  const physicianPool = getPhysicianPool();

  if (!physicianPool) {
    throw new Error('Physician DB not configured');
  }

  const result = await physicianPool.query(
    `INSERT INTO mrd_source_item_edges (
      source_id, guidance_id, extraction_method, confidence
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (source_id, guidance_id) DO UPDATE SET
      discovered_at = NOW(),
      extraction_method = EXCLUDED.extraction_method,
      confidence = EXCLUDED.confidence
    RETURNING id, (xmax = 0) as is_new`,
    [
      sourceId,
      guidanceId,
      options.extractionMethod || 'claude',
      options.confidence || null,
    ]
  );

  return {
    id: result.rows[0].id,
    isNew: result.rows[0].is_new,
  };
}

/**
 * Set interpretation guardrail on a guidance item
 *
 * @param {number} guidanceId - ID from mrd_guidance_items table
 * @param {string} guardrail - Guardrail text
 */
export async function setInterpretationGuardrail(guidanceId, guardrail) {
  const physicianPool = getPhysicianPool();

  if (!physicianPool) {
    throw new Error('Physician DB not configured');
  }

  await physicianPool.query(
    `UPDATE mrd_guidance_items
     SET interpretation_guardrail = $1
     WHERE id = $2 AND interpretation_guardrail IS NULL`,
    [guardrail, guidanceId]
  );
}

/**
 * Close the physician DB pool
 */
export async function closePhysicianPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export default {
  isPhysicianDbConfigured,
  writeToPhysicianDb,
  writePublicationsToPhysicianDb,
  writePublicationToPhysicianDb,
  writeSourceItemEdge,
  setInterpretationGuardrail,
  closePhysicianPool,
};
