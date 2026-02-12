/**
 * Normalize cancer types in existing DB data
 *
 * Fixes two issues identified in code review:
 * 1. Taxonomy drift: 'solid_tumor' → 'multi_solid', 'lung' → 'lung_nsclc', etc.
 * 2. Missing junction rows: nccn/society/payer items with no cancer_type tags
 *
 * Usage: node scripts/normalize-cancer-types.js [--dry-run]
 */

import dotenv from 'dotenv';
dotenv.config();

import { query, close } from '../src/db/client.js';
import { normalizeCancerType, CANONICAL_CANCER_TYPES } from '../src/utils/cancer-types.js';

const DRY_RUN = process.argv.includes('--dry-run');

// Patterns to detect cancer type from guidance item titles
const TITLE_CANCER_PATTERNS = [
  { pattern: /\bcolorectal\b/i, type: 'colorectal' },
  { pattern: /\bcolon\b/i, type: 'colorectal' },
  { pattern: /\brectal\b/i, type: 'colorectal' },
  { pattern: /\bCRC\b/, type: 'colorectal' },
  { pattern: /\bbreast\b/i, type: 'breast' },
  { pattern: /\bTNBC\b/, type: 'breast' },
  { pattern: /\btriple.negative\b/i, type: 'breast' },
  { pattern: /\bNSCLC\b/, type: 'lung_nsclc' },
  { pattern: /\bnon.small.cell\b/i, type: 'lung_nsclc' },
  { pattern: /\blung\b/i, type: 'lung_nsclc' },
  { pattern: /\bSCLC\b/, type: 'lung_sclc' },
  { pattern: /\bsmall.cell.lung\b/i, type: 'lung_sclc' },
  { pattern: /\bbladder\b/i, type: 'bladder' },
  { pattern: /\burothelial\b/i, type: 'bladder' },
  { pattern: /\bmelanoma\b/i, type: 'melanoma' },
  { pattern: /\bpancrea/i, type: 'pancreatic' },
  { pattern: /\bgastric\b/i, type: 'gastric' },
  { pattern: /\besophag/i, type: 'esophageal' },
  { pattern: /\bovarian\b/i, type: 'ovarian' },
  { pattern: /\bprostate\b/i, type: 'prostate' },
  { pattern: /\bhead.and.neck\b/i, type: 'head_neck' },
  { pattern: /\bHNSCC\b/, type: 'head_neck' },
  { pattern: /\boropharyngeal\b/i, type: 'head_neck' },
  { pattern: /\brenal\b/i, type: 'renal' },
  { pattern: /\bhepato/i, type: 'hepatocellular' },
  { pattern: /\bliver\b/i, type: 'hepatocellular' },
  { pattern: /\bmerkel\b/i, type: 'merkel_cell' },
];

function detectCancerTypeFromTitle(title) {
  if (!title) return 'multi_solid';
  for (const { pattern, type } of TITLE_CANCER_PATTERNS) {
    if (pattern.test(title)) return type;
  }
  return 'multi_solid';
}

async function run() {
  console.log(`\n=== Cancer Type Normalization ${DRY_RUN ? '(DRY RUN)' : ''} ===\n`);

  // Step 1: Find and fix non-canonical values in mrd_guidance_cancer_types
  console.log('Step 1: Normalizing existing cancer_type values...');
  const existing = await query(
    `SELECT DISTINCT cancer_type FROM mrd_guidance_cancer_types ORDER BY cancer_type`
  );

  const driftValues = [];
  for (const row of existing.rows) {
    const raw = row.cancer_type;
    const normalized = normalizeCancerType(raw);
    if (raw !== normalized) {
      driftValues.push({ raw, normalized });
    }
  }

  if (driftValues.length === 0) {
    console.log('  No drift values found - all values are canonical.');
  } else {
    console.log(`  Found ${driftValues.length} drift values:`);
    for (const { raw, normalized } of driftValues) {
      console.log(`    "${raw}" → "${normalized}"`);
      if (!DRY_RUN) {
        // Update in place, handling potential conflicts
        // First insert normalized values that don't exist yet
        await query(
          `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
           SELECT guidance_id, $1 FROM mrd_guidance_cancer_types
           WHERE cancer_type = $2
           ON CONFLICT DO NOTHING`,
          [normalized, raw]
        );
        // Then delete the old drift values
        const deleted = await query(
          `DELETE FROM mrd_guidance_cancer_types WHERE cancer_type = $1`,
          [raw]
        );
        console.log(`    → Updated ${deleted.rowCount} rows`);
      }
    }
  }

  // Step 2: Find guidance items with no cancer type tags
  console.log('\nStep 2: Backfilling missing cancer type tags...');
  const untagged = await query(
    `SELECT g.id, g.source_type, g.title
     FROM mrd_guidance_items g
     LEFT JOIN mrd_guidance_cancer_types ct ON ct.guidance_id = g.id
     WHERE ct.guidance_id IS NULL
     ORDER BY g.id`
  );

  if (untagged.rows.length === 0) {
    console.log('  All guidance items have cancer type tags.');
  } else {
    console.log(`  Found ${untagged.rows.length} untagged items:`);
    let backfilled = 0;
    for (const row of untagged.rows) {
      const cancerType = detectCancerTypeFromTitle(row.title);
      console.log(`    [${row.source_type}] ID ${row.id}: "${row.title?.substring(0, 60)}" → ${cancerType}`);
      if (!DRY_RUN) {
        await query(
          `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [row.id, cancerType]
        );
        backfilled++;
      }
    }
    console.log(`  ${DRY_RUN ? 'Would backfill' : 'Backfilled'} ${backfilled || untagged.rows.length} items.`);
  }

  // Step 3: Summary
  console.log('\nStep 3: Final state...');
  const finalCounts = await query(
    `SELECT cancer_type, COUNT(*) as count
     FROM mrd_guidance_cancer_types
     GROUP BY cancer_type
     ORDER BY count DESC`
  );
  console.log('  Cancer type distribution:');
  for (const row of finalCounts.rows) {
    const isCanonical = CANONICAL_CANCER_TYPES.includes(row.cancer_type);
    console.log(`    ${row.cancer_type}: ${row.count}${isCanonical ? '' : ' ⚠️  NOT CANONICAL'}`);
  }

  const stillUntagged = await query(
    `SELECT COUNT(*) as count FROM mrd_guidance_items g
     LEFT JOIN mrd_guidance_cancer_types ct ON ct.guidance_id = g.id
     WHERE ct.guidance_id IS NULL`
  );
  console.log(`\n  Items still untagged: ${stillUntagged.rows[0].count}`);

  await close();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
