/**
 * Seed data for mrd_sources registry
 * Run with: node src/db/seed-sources.js
 */

import 'dotenv/config';
import { query, close } from './client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('seed-sources');

const SOURCES = [
  // Literature sources
  {
    source_key: 'pubmed',
    source_type: 'literature',
    display_name: 'PubMed (NCBI)',
    base_url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
    access_method: 'api',
    change_detector: 'last-modified',
    expected_cadence: 'daily',
    stale_threshold_days: 2,
  },

  // Clinical trials
  {
    source_key: 'clinicaltrials',
    source_type: 'trials',
    display_name: 'ClinicalTrials.gov',
    base_url: 'https://clinicaltrials.gov/api/v2/',
    access_method: 'api',
    change_detector: 'last-modified',
    expected_cadence: 'daily',
    stale_threshold_days: 2,
  },

  // Regulatory
  {
    source_key: 'fda-drugs',
    source_type: 'regulatory',
    display_name: 'FDA Drug Approvals',
    base_url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds',
    access_method: 'rss',
    change_detector: 'guid',
    expected_cadence: 'daily',
    stale_threshold_days: 3,
  },
  {
    source_key: 'fda-devices',
    source_type: 'regulatory',
    display_name: 'FDA Medical Device Approvals',
    base_url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds',
    access_method: 'rss',
    change_detector: 'guid',
    expected_cadence: 'daily',
    stale_threshold_days: 3,
  },
  {
    source_key: 'cms-lcd',
    source_type: 'regulatory',
    display_name: 'CMS Local Coverage Determinations',
    base_url: 'https://www.cms.gov/medicare-coverage-database/reports/local-coverage-determinations.aspx',
    access_method: 'api',
    change_detector: 'last-modified',
    expected_cadence: 'weekly',
    stale_threshold_days: 14,
  },

  // NCCN Guidelines
  {
    source_key: 'nccn-colorectal',
    source_type: 'guideline',
    display_name: 'NCCN Colorectal Cancer',
    base_url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1428',
    access_method: 'manual',
    auth_required: true,
    change_detector: 'version-string',
    expected_cadence: 'quarterly',
    stale_threshold_days: 120,
    tos_constraints: 'Requires NCCN account for download. Redistribution prohibited per ToS.',
  },
  {
    source_key: 'nccn-breast',
    source_type: 'guideline',
    display_name: 'NCCN Breast Cancer',
    base_url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419',
    access_method: 'manual',
    auth_required: true,
    change_detector: 'version-string',
    expected_cadence: 'quarterly',
    stale_threshold_days: 120,
    tos_constraints: 'Requires NCCN account for download. Redistribution prohibited per ToS.',
  },
  {
    source_key: 'nccn-lung',
    source_type: 'guideline',
    display_name: 'NCCN Non-Small Cell Lung Cancer',
    base_url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1450',
    access_method: 'manual',
    auth_required: true,
    change_detector: 'version-string',
    expected_cadence: 'quarterly',
    stale_threshold_days: 120,
    tos_constraints: 'Requires NCCN account for download. Redistribution prohibited per ToS.',
  },
  {
    source_key: 'nccn-bladder',
    source_type: 'guideline',
    display_name: 'NCCN Bladder Cancer',
    base_url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1417',
    access_method: 'manual',
    auth_required: true,
    change_detector: 'version-string',
    expected_cadence: 'quarterly',
    stale_threshold_days: 120,
    tos_constraints: 'Requires NCCN account for download. Redistribution prohibited per ToS.',
  },
  {
    source_key: 'nccn-gastric',
    source_type: 'guideline',
    display_name: 'NCCN Gastric Cancer',
    base_url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1434',
    access_method: 'manual',
    auth_required: true,
    change_detector: 'version-string',
    expected_cadence: 'quarterly',
    stale_threshold_days: 120,
    tos_constraints: 'Requires NCCN account for download. Redistribution prohibited per ToS.',
  },

  // Society guidelines
  {
    source_key: 'asco-ctdna',
    source_type: 'guideline',
    display_name: 'ASCO ctDNA Guidelines',
    base_url: 'https://ascopubs.org/journal/jco',
    access_method: 'manual',
    change_detector: 'version-string',
    expected_cadence: 'yearly',
    stale_threshold_days: 400,
  },
  {
    source_key: 'esmo-ctdna',
    source_type: 'guideline',
    display_name: 'ESMO ctDNA Guidelines',
    base_url: 'https://www.esmo.org/guidelines',
    access_method: 'manual',
    change_detector: 'version-string',
    expected_cadence: 'yearly',
    stale_threshold_days: 400,
  },
  {
    source_key: 'sitc-immunotherapy',
    source_type: 'guideline',
    display_name: 'SITC Immunotherapy Guidelines',
    base_url: 'https://www.sitcancer.org/aboutsitc/publications',
    access_method: 'manual',
    change_detector: 'version-string',
    expected_cadence: 'yearly',
    stale_threshold_days: 400,
  },

  // RSS feeds for monitoring
  {
    source_key: 'rss-jco',
    source_type: 'literature',
    display_name: 'Journal of Clinical Oncology (RSS)',
    base_url: 'https://ascopubs.org/action/showFeed?type=etoc&feed=rss&jc=jco',
    access_method: 'rss',
    change_detector: 'guid',
    expected_cadence: 'daily',
    stale_threshold_days: 7,
  },
  {
    source_key: 'rss-annals-oncology',
    source_type: 'literature',
    display_name: 'Annals of Oncology (RSS)',
    base_url: 'https://www.annalsofoncology.org/current.rss',
    access_method: 'rss',
    change_detector: 'guid',
    expected_cadence: 'daily',
    stale_threshold_days: 7,
  },
  {
    source_key: 'rss-jitc',
    source_type: 'literature',
    display_name: 'Journal for ImmunoTherapy of Cancer (RSS)',
    base_url: 'https://jitc.bmj.com/rss/current.xml',
    access_method: 'rss',
    change_detector: 'guid',
    expected_cadence: 'daily',
    stale_threshold_days: 7,
  },

  // Payer policies
  {
    source_key: 'payer-aetna',
    source_type: 'payer',
    display_name: 'Aetna Clinical Policy Bulletins',
    base_url: 'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html',
    access_method: 'scrape',
    change_detector: 'hash',
    expected_cadence: 'monthly',
    stale_threshold_days: 45,
  },
  {
    source_key: 'payer-cigna',
    source_type: 'payer',
    display_name: 'Cigna Coverage Policies',
    base_url: 'https://cignaforhcp.cigna.com/public/content/pdf/coveragePolicies/',
    access_method: 'scrape',
    change_detector: 'hash',
    expected_cadence: 'monthly',
    stale_threshold_days: 45,
  },
  {
    source_key: 'payer-moldx',
    source_type: 'payer',
    display_name: 'MolDX Program (Palmetto)',
    base_url: 'https://www.cms.gov/medicare-coverage-database/',
    access_method: 'api',
    change_detector: 'last-modified',
    expected_cadence: 'monthly',
    stale_threshold_days: 45,
  },
];

async function seedSources() {
  logger.info('Seeding source registry...');
  let added = 0;
  let updated = 0;

  for (const source of SOURCES) {
    try {
      const existing = await query(
        'SELECT id FROM mrd_sources WHERE source_key = $1',
        [source.source_key]
      );

      if (existing.rows.length > 0) {
        // Update existing
        await query(`
          UPDATE mrd_sources SET
            source_type = $2,
            display_name = $3,
            base_url = $4,
            access_method = $5,
            auth_required = $6,
            tos_constraints = $7,
            change_detector = $8,
            expected_cadence = $9,
            stale_threshold_days = $10,
            updated_at = NOW()
          WHERE source_key = $1
        `, [
          source.source_key,
          source.source_type,
          source.display_name,
          source.base_url,
          source.access_method,
          source.auth_required || false,
          source.tos_constraints || null,
          source.change_detector,
          source.expected_cadence,
          source.stale_threshold_days,
        ]);
        updated++;
      } else {
        // Insert new
        await query(`
          INSERT INTO mrd_sources (
            source_key, source_type, display_name, base_url, access_method,
            auth_required, tos_constraints, change_detector, expected_cadence,
            stale_threshold_days
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          source.source_key,
          source.source_type,
          source.display_name,
          source.base_url,
          source.access_method,
          source.auth_required || false,
          source.tos_constraints || null,
          source.change_detector,
          source.expected_cadence,
          source.stale_threshold_days,
        ]);
        added++;
      }
    } catch (error) {
      logger.error(`Failed to seed source: ${source.source_key}`, { error: error.message });
    }
  }

  logger.info('Source seeding complete', { added, updated, total: SOURCES.length });
  return { added, updated };
}

// Run if called directly
const isMain = process.argv[1]?.includes('seed-sources');
if (isMain) {
  seedSources()
    .then(result => {
      console.log('Seeding complete:', result);
      return close();
    })
    .catch(error => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedSources, SOURCES };
