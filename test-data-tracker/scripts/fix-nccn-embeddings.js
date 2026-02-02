#!/usr/bin/env node
/**
 * Fix NCCN items in database by:
 * 1. Adding cancer_types and clinical_settings junction table entries
 * 2. Re-generating embeddings with enriched text
 */

import 'dotenv/config';
import { query, close } from '../src/db/mrd-client.js';
import { embedGuidanceItem } from '../src/embeddings/mrd-embedder.js';

const CANCER_TYPE_FROM_TITLE = {
  'Bladder': 'bladder',
  'Breast': 'breast',
  'Colorectal': 'colorectal',
  'Colon': 'colorectal',
  'Rectal': 'colorectal',
  'Melanoma': 'melanoma',
  'Esophageal': 'esophageal',
  'Gastric': 'gastric',
  'Head': 'head_neck',
  'Lung': 'lung_nsclc',
  'NSCLC': 'lung_nsclc',
  'Ovarian': 'ovarian',
  'Pancreatic': 'pancreatic',
};

async function fixNccnItems() {
  console.log('Fetching NCCN items...');

  const result = await query(`
    SELECT id, title, key_findings
    FROM mrd_guidance_items
    WHERE source_type = 'nccn'
  `);

  console.log(`Found ${result.rows.length} NCCN items`);

  for (const item of result.rows) {
    // Extract cancer type from title
    let cancerType = null;
    for (const [pattern, type] of Object.entries(CANCER_TYPE_FROM_TITLE)) {
      if (item.title.includes(pattern)) {
        cancerType = type;
        break;
      }
    }

    // Extract clinical setting from title (after the colon)
    const colonIndex = item.title.indexOf(':');
    const clinicalSetting = colonIndex > 0
      ? item.title.slice(colonIndex + 1).trim()
      : null;

    console.log(`  ${item.id}: ${cancerType || 'unknown'} / ${clinicalSetting || 'none'}`);

    // Add cancer type to junction table
    if (cancerType) {
      await query(
        `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [item.id, cancerType]
      );
    }

    // Add clinical setting to junction table
    if (clinicalSetting) {
      await query(
        `INSERT INTO mrd_guidance_clinical_settings (guidance_id, clinical_setting)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [item.id, clinicalSetting]
      );
    }
  }

  console.log('\nJunction tables updated. Now regenerating embeddings...');

  // Delete existing NCCN embeddings
  await query(`
    DELETE FROM mrd_item_embeddings
    WHERE guidance_id IN (
      SELECT id FROM mrd_guidance_items WHERE source_type = 'nccn'
    )
  `);
  console.log('Deleted old NCCN embeddings');

  // Regenerate embeddings for NCCN items
  let success = 0;
  let failed = 0;

  for (const item of result.rows) {
    try {
      await embedGuidanceItem(item.id);
      success++;
      console.log(`  ✓ Embedded item ${item.id}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ Failed item ${item.id}: ${err.message}`);
    }
  }

  console.log(`\nEmbedding complete: ${success} success, ${failed} failed`);
}

(async () => {
  try {
    await fixNccnItems();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await close();
  }
})();
