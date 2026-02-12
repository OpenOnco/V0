/**
 * audit-identifiers.js — Deep audit of all identifiers in the DB
 */
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.MRD_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // 1. Check ALL pubmed entries have numeric source_ids
  const pubmed = await pool.query(
    "SELECT id, source_id, pmid, title FROM mrd_guidance_items WHERE source_type = 'pubmed' ORDER BY id"
  );
  console.log(`=== ALL pubmed entries (${pubmed.rows.length} total) ===`);
  let issues = 0;
  for (const row of pubmed.rows) {
    const sidOk = /^\d+$/.test(row.source_id);
    const pmidOk = row.pmid === null || /^\d+$/.test(row.pmid);
    if (!sidOk || !pmidOk) {
      console.log(`  BAD: ID ${row.id} | source_id: ${row.source_id} | pmid: ${row.pmid} | ${(row.title || '').substring(0, 50)}`);
      issues++;
    }
  }
  if (issues === 0) {
    console.log(`  ✅ All ${pubmed.rows.length} pubmed entries have valid numeric source_ids`);
  }

  // 2. Check seed_publication entries
  const seeds = await pool.query(
    "SELECT id, source_id, pmid, title FROM mrd_guidance_items WHERE source_type = 'seed_publication' ORDER BY id"
  );
  console.log(`\n=== seed_publication entries (${seeds.rows.length}) ===`);
  for (const row of seeds.rows) {
    const pmidValid = row.pmid === null || /^\d+$/.test(row.pmid);
    const marker = pmidValid ? '  ' : '⚠️';
    console.log(`  ${marker} ID ${row.id} | source_id: ${row.source_id} | pmid: ${row.pmid} | ${(row.title || '').substring(0, 60)}`);
  }

  // 3. Check extracted_publication entries
  const extracted = await pool.query(
    "SELECT id, source_id, pmid, title FROM mrd_guidance_items WHERE source_type = 'extracted_publication' AND (source_id !~ '^[0-9]+$' OR (pmid IS NOT NULL AND pmid !~ '^[0-9]+$')) ORDER BY id"
  );
  console.log(`\n=== extracted_publication with non-numeric IDs (${extracted.rows.length}) ===`);
  if (extracted.rows.length === 0) {
    const total = await pool.query("SELECT count(*) FROM mrd_guidance_items WHERE source_type = 'extracted_publication'");
    console.log(`  ✅ All ${total.rows[0].count} extracted_publication entries have valid numeric IDs`);
  } else {
    for (const row of extracted.rows) {
      console.log(`  BAD: ID ${row.id} | source_id: ${row.source_id} | pmid: ${row.pmid}`);
    }
  }

  // 4. Check clinicaltrials entries for non-standard IDs
  const ct = await pool.query(
    "SELECT id, source_id, title FROM mrd_guidance_items WHERE source_type = 'clinicaltrials' ORDER BY id"
  );
  console.log(`\n=== clinicaltrials entries (${ct.rows.length}) ===`);
  let ctIssues = 0;
  for (const row of ct.rows) {
    const isStandard = /^(NCT|jRCT|EPOC|UMIN|ISRCTN)\d/.test(row.source_id);
    if (!isStandard) {
      console.log(`  ⚠️  ID ${row.id} | source_id: ${row.source_id} | ${(row.title || '').substring(0, 60)}`);
      ctIssues++;
    }
  }
  if (ctIssues === 0) {
    console.log(`  ✅ All ${ct.rows.length} clinicaltrials entries have standard registry IDs`);
  }

  // 5. Summary
  const allTypes = await pool.query(
    "SELECT source_type, count(*) as cnt FROM mrd_guidance_items GROUP BY source_type ORDER BY source_type"
  );
  console.log(`\n=== Source type summary ===`);
  for (const row of allTypes.rows) {
    console.log(`  ${row.source_type}: ${row.cnt}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
