/**
 * fix-fake-identifiers.js — Fix fake/wrong identifiers in production DB
 *
 * Corrects the following issues seeded by seed-content-gaps.js:
 *   1. GALAXY: fake source_id 'circulate-galaxy-2024' → real PMID 37749153
 *   2. HPV ctDNA: source_type 'pubmed' with fake ID → 'expert_synthesis'
 *   3. F1 Tracker: source_type 'pubmed' with fake ID → 'expert_synthesis'
 *   4. DYNAMIC: wrong PMID 35657322 → correct PMID 35657320
 *   5. VEGA: fake source_id 'circulate-vega-nct' → real jRCT1031200006
 *   6. ALTAIR: fake source_id 'circulate-altair-nct' → real EPOC1905
 *
 * Usage:
 *   node physician-system/scripts/fix-fake-identifiers.js              # full run
 *   node physician-system/scripts/fix-fake-identifiers.js --dry-run    # preview only
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DRY_RUN = process.argv.includes('--dry-run');

const FIXES = [
  {
    description: 'GALAXY: fake source_id → real PMID 37749153',
    where: "source_id = 'circulate-galaxy-2024'",
    set: {
      source_type: 'pubmed',
      source_id: '37749153',
      pmid: '37749153',
      doi: '10.1038/s41591-024-03254-6',
      journal: 'Nature Medicine',
      publication_date: '2024-09-17',
    },
  },
  {
    description: 'HPV ctDNA: fake pubmed source_type → expert_synthesis',
    where: "source_id = 'hpv-ctdna-hnc-overview'",
    set: {
      source_type: 'expert_synthesis',
    },
  },
  {
    description: 'F1 Tracker: fake pubmed source_type → expert_synthesis',
    where: "source_id = 'f1tracker-breast-validation'",
    set: {
      source_type: 'expert_synthesis',
    },
  },
  {
    description: 'DYNAMIC: wrong PMID 35657322 → correct 35657320',
    where: "source_id = '35657322'",
    set: {
      source_id: '35657320',
      pmid: '35657320',
    },
  },
  {
    description: 'VEGA: fake source_id → real jRCT1031200006',
    where: "source_id = 'circulate-vega-nct'",
    set: {
      source_id: 'jRCT1031200006',
    },
  },
  {
    description: 'ALTAIR: fake source_id → real EPOC1905',
    where: "source_id = 'circulate-altair-nct'",
    set: {
      source_id: 'EPOC1905',
    },
  },
];

async function main() {
  const connectionString = process.env.MRD_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: MRD_DATABASE_URL or DATABASE_URL required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.MRD_DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Fix fake identifiers in production DB`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  let fixed = 0;
  let skipped = 0;

  for (const fix of FIXES) {
    // First check if the record exists
    const check = await pool.query(
      `SELECT id, source_type, source_id, pmid, title FROM mrd_guidance_items WHERE ${fix.where}`
    );

    if (check.rows.length === 0) {
      console.log(`⏭  SKIP: ${fix.description}`);
      console.log(`   No record found matching: ${fix.where}\n`);
      skipped++;
      continue;
    }

    const row = check.rows[0];
    console.log(`🔧 FIX: ${fix.description}`);
    console.log(`   Record ID: ${row.id}, Title: "${row.title?.substring(0, 60)}..."`);
    console.log(`   Before: source_type=${row.source_type}, source_id=${row.source_id}, pmid=${row.pmid}`);

    if (!DRY_RUN) {
      // Build SET clause
      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(fix.set)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      const sql = `UPDATE mrd_guidance_items SET ${setClauses.join(', ')} WHERE ${fix.where}`;
      await pool.query(sql, values);
      console.log(`   ✅ Updated successfully`);
    } else {
      console.log(`   Would update: ${JSON.stringify(fix.set)}`);
    }

    fixed++;
    console.log('');
  }

  // Validation: check for any remaining non-numeric PMIDs
  console.log(`${'='.repeat(60)}`);
  console.log('POST-FIX VALIDATION: Checking for remaining fake PMIDs...');
  const fakeCheck = await pool.query(`
    SELECT id, source_type, source_id, pmid, title
    FROM mrd_guidance_items
    WHERE source_type = 'pubmed'
      AND source_id !~ '^[0-9]+$'
  `);

  if (fakeCheck.rows.length > 0) {
    console.log(`\n⚠️  REMAINING FAKE PMIDs FOUND:`);
    for (const row of fakeCheck.rows) {
      console.log(`   ID ${row.id}: source_id="${row.source_id}" — ${row.title?.substring(0, 60)}`);
    }
  } else {
    console.log('✅ No fake PMIDs remaining — all source_type=pubmed entries have numeric source_ids');
  }

  // Also check for non-numeric pmid fields
  const fakePmidCheck = await pool.query(`
    SELECT id, source_type, source_id, pmid, title
    FROM mrd_guidance_items
    WHERE pmid IS NOT NULL
      AND pmid !~ '^[0-9]+$'
  `);

  if (fakePmidCheck.rows.length > 0) {
    console.log(`\n⚠️  REMAINING FAKE PMID FIELD VALUES:`);
    for (const row of fakePmidCheck.rows) {
      console.log(`   ID ${row.id}: pmid="${row.pmid}" — ${row.title?.substring(0, 60)}`);
    }
  } else {
    console.log('✅ All pmid field values are numeric');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary: ${fixed} fixed, ${skipped} skipped`);
  console.log(`${'='.repeat(60)}\n`);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
