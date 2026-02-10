/**
 * Seed Data Ingestion for MRD Evidence Database
 *
 * Loads curated seed publications and sources from CSV files.
 * For items with PMIDs, fetches full abstracts from PubMed.
 *
 * Usage:
 *   node src/cli.js seed --publications=/path/to/mrd_seed_publications.csv
 *   node src/cli.js seed --sources=/path/to/mrd_seed_sources.csv
 *   node src/cli.js seed --all (loads both from default paths)
 */

import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { query } from '../db/client.js';
import { createLogger } from '../utils/logger.js';
import { embedAfterInsert } from '../embeddings/mrd-embedder.js';

const logger = createLogger('seed-ingest');

const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const NCBI_API_KEY = process.env.NCBI_API_KEY;

/**
 * Fetch abstract from PubMed by PMID
 */
async function fetchPubMedAbstract(pmid) {
  if (!pmid) return null;

  const params = new URLSearchParams({
    db: 'pubmed',
    id: pmid,
    retmode: 'xml',
    rettype: 'abstract',
  });

  if (NCBI_API_KEY) {
    params.append('api_key', NCBI_API_KEY);
  }

  const url = `${PUBMED_BASE}/efetch.fcgi?${params}`;

  try {
    const response = await fetch(url);
    const xml = await response.text();

    // Extract abstract
    const abstractMatch = xml.match(/<Abstract>([\s\S]*?)<\/Abstract>/i);
    if (!abstractMatch) return null;

    const texts = [];
    const textMatches = abstractMatch[1].matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi);
    for (const match of textMatches) {
      texts.push(match[1].replace(/<[^>]+>/g, '').trim());
    }

    return texts.join(' ') || null;
  } catch (error) {
    logger.warn('Failed to fetch PubMed abstract', { pmid, error: error.message });
    return null;
  }
}

/**
 * Map evidence_type from CSV to our schema
 */
function mapEvidenceType(csvType) {
  const typeMap = {
    'randomized trial': 'rct_results',
    'prospective observational': 'observational',
    'clinical study': 'observational',
    'clinical validation': 'observational',
    'subset analysis': 'rct_results',
    'post-hoc analysis': 'observational',
    'prospective study': 'observational',
    'guideline excerpt (vendor-hosted)': 'guideline',
    'regulatory review': 'regulatory',
    'news summary': 'review',
    'society editorial + clinical review': 'consensus',
    'society editorial': 'consensus',
  };
  return typeMap[csvType?.toLowerCase()] || 'review';
}

/**
 * Map cancer type from CSV to our schema
 */
function mapCancerType(csvCancer) {
  if (!csvCancer) return [];

  const cancer = csvCancer.toLowerCase();
  const types = [];

  if (cancer.includes('colorectal') || cancer.includes('crc') || cancer.includes('colon')) {
    types.push('colorectal');
  }
  if (cancer.includes('breast')) {
    types.push('breast');
  }
  if (cancer.includes('lung') || cancer.includes('nsclc')) {
    types.push('lung_nsclc');
  }
  if (cancer.includes('head') || cancer.includes('neck') || cancer.includes('hnscc')) {
    types.push('head_neck');
  }
  if (cancer.includes('myeloma')) {
    types.push('multiple_myeloma');
  }
  if (cancer.includes('all') || cancer.includes('b-all')) {
    types.push('all');
  }
  if (cancer.includes('cll')) {
    types.push('cll');
  }
  if (cancer.includes('merkel')) {
    types.push('merkel_cell');
  }
  if (cancer.includes('multi')) {
    types.push('multi_solid');
  }

  return types.length > 0 ? types : ['multi_solid'];
}

/**
 * Generate a unique source_id from the publication data
 */
function generateSourceId(pub) {
  if (pub.pmid) return pub.pmid;
  if (pub.doi) return pub.doi.replace(/[^a-zA-Z0-9]/g, '_');

  // Fallback to title-based ID
  const titleSlug = pub.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .substring(0, 50);
  return `seed_${titleSlug}_${pub.year || 'unknown'}`;
}

/**
 * Ingest publications from CSV
 */
export async function ingestPublications(csvPath, options = {}) {
  const { dryRun = false, fetchAbstracts = true } = options;

  logger.info('Loading publications CSV', { path: csvPath });

  if (!fs.existsSync(csvPath)) {
    throw new Error(`File not found: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  logger.info('Parsed publications', { count: records.length });

  const stats = {
    total: records.length,
    new: 0,
    updated: 0,
    failed: 0,
    abstractsFetched: 0,
  };

  for (const pub of records) {
    try {
      const sourceId = generateSourceId(pub);
      const evidenceType = mapEvidenceType(pub.evidence_type);
      const cancerTypes = mapCancerType(pub.cancer);

      // Determine source_type
      let sourceType = 'seed_publication';
      if (pub.pmid) sourceType = 'pubmed';
      else if (pub.evidence_type?.includes('guideline')) sourceType = 'guideline';
      else if (pub.evidence_type?.includes('regulatory')) sourceType = 'regulatory';

      // Fetch abstract from PubMed if we have PMID
      let abstract = null;
      if (fetchAbstracts && pub.pmid && !dryRun) {
        logger.debug('Fetching abstract from PubMed', { pmid: pub.pmid });
        abstract = await fetchPubMedAbstract(pub.pmid);
        if (abstract) stats.abstractsFetched++;
        // Rate limit
        await new Promise(r => setTimeout(r, NCBI_API_KEY ? 100 : 350));
      }

      // Build summary from context if no abstract
      const summary = abstract?.substring(0, 1000) ||
        `${pub.context}. ${pub.evidence_type} from ${pub.vendor}.`;

      if (dryRun) {
        logger.info('Would insert', {
          title: pub.title?.substring(0, 60),
          sourceType,
          evidenceType,
          pmid: pub.pmid,
        });
        stats.new++;
        continue;
      }

      // Insert into database
      const result = await query(
        `INSERT INTO mrd_guidance_items (
          source_type, source_id, source_url,
          title, publication_date, journal, doi, pmid,
          evidence_type, summary, full_text_excerpt,
          decision_context
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (source_type, source_id) DO UPDATE SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          full_text_excerpt = EXCLUDED.full_text_excerpt,
          decision_context = EXCLUDED.decision_context,
          updated_at = NOW()
        RETURNING id, (xmax = 0) as is_new`,
        [
          sourceType,
          sourceId,
          pub.primary_url || pub.vendor_source_url,
          pub.title,
          pub.year ? new Date(`${pub.year}-01-01`) : null,
          pub.journal,
          pub.doi || null,
          pub.pmid || null,
          evidenceType,
          summary,
          abstract,
          JSON.stringify({
            vendor: pub.vendor,
            cancer_context: pub.cancer,
            clinical_context: pub.context,
            evidence_type_original: pub.evidence_type,
            vendor_source_url: pub.vendor_source_url,
            import_source: 'seed_csv',
            imported_at: new Date().toISOString(),
          }),
        ]
      );

      const itemId = result.rows[0].id;
      const isNew = result.rows[0].is_new;

      if (isNew) {
        await embedAfterInsert(itemId, 'seed-ingest');
        stats.new++;
        logger.info('Inserted publication', { id: itemId, title: pub.title?.substring(0, 50) });
      } else {
        stats.updated++;
      }

      // Add cancer type associations
      for (const cancerType of cancerTypes) {
        await query(
          `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [itemId, cancerType]
        );
      }

    } catch (error) {
      stats.failed++;
      logger.error('Failed to ingest publication', {
        title: pub.title?.substring(0, 50),
        error: error.message,
      });
    }
  }

  logger.info('Publication ingestion complete', { stats });
  return stats;
}

/**
 * Ingest source registry from CSV
 */
export async function ingestSources(csvPath, options = {}) {
  const { dryRun = false } = options;

  logger.info('Loading sources CSV', { path: csvPath });

  if (!fs.existsSync(csvPath)) {
    throw new Error(`File not found: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  logger.info('Parsed sources', { count: records.length });

  const stats = {
    total: records.length,
    new: 0,
    updated: 0,
    failed: 0,
  };

  for (const src of records) {
    try {
      // Map type to our schema
      let sourceType = 'vendor';
      if (src.type.includes('guideline') || src.type.includes('society')) {
        sourceType = 'guideline';
      } else if (src.type.includes('news')) {
        sourceType = 'news';
      } else if (src.type.includes('coverage') || src.type.includes('payer')) {
        sourceType = 'payer';
      }

      // Determine access method
      let accessMethod = 'scrape';
      if (src.type.includes('press_release')) {
        accessMethod = 'scrape';
      } else if (src.notes?.includes('Static HTML')) {
        accessMethod = 'scrape';
      }

      if (dryRun) {
        logger.info('Would insert source', {
          source_key: src.source_id,
          org: src.org,
          type: sourceType,
        });
        stats.new++;
        continue;
      }

      // Insert into mrd_sources
      const result = await query(
        `INSERT INTO mrd_sources (
          source_key, source_type, display_name, base_url,
          access_method, expected_cadence
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (source_key) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          base_url = EXCLUDED.base_url,
          updated_at = NOW()
        RETURNING id, (xmax = 0) as is_new`,
        [
          src.source_id,
          sourceType,
          `${src.org} - ${src.type}${src.notes ? ` (${src.notes.substring(0, 100)})` : ''}`,
          src.url,
          accessMethod,
          'weekly', // Default cadence
        ]
      );

      if (result.rows[0].is_new) {
        stats.new++;
        logger.info('Inserted source', { source_key: src.source_id });
      } else {
        stats.updated++;
      }

    } catch (error) {
      stats.failed++;
      logger.error('Failed to ingest source', {
        source_id: src.source_id,
        error: error.message,
      });
    }
  }

  logger.info('Source ingestion complete', { stats });
  return stats;
}

export default {
  ingestPublications,
  ingestSources,
  fetchPubMedAbstract,
};
