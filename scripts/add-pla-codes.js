#!/usr/bin/env node
/**
 * Add PLA codes from BCBSM mapping to OpenOnco tests
 * Source: BCBSM Medical Policy - PLA Codes (Jan 2025)
 * 
 * Updates:
 * - MSK-IMPACT (tds-8): 0048U
 * - Caris Assure MRD (mrd-17): 0485U
 * - Caris Assure TRM (trm-5): 0485U (same test, different category)
 * 
 * Note: Guardant360 Liquid (tds-17, 744 genes) does NOT get 0326U
 * because 0326U is for the original ~74-gene Guardant360, not the
 * new December 2024 expanded product.
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../src/data.js');

// Confirmed PLA code mappings from BCBSM Jan 2025
const PLA_UPDATES = {
  'tds-8': {
    testName: 'MSK-IMPACT',
    plaCode: '0048U',
    source: 'BCBSM PLA Policy Jan 2025',
    notes: 'MSK-IMPACT Integrated Mutation Profiling of Actionable Cancer Targets'
  },
  'mrd-17': {
    testName: 'Caris Assure',
    plaCode: '0485U',
    source: 'BCBSM PLA Policy Jan 2025',
    notes: 'Caris Assure tumor-naïve MRD assay'
  },
  'trm-5': {
    testName: 'Caris Assure',
    plaCode: '0485U',
    source: 'BCBSM PLA Policy Jan 2025',
    notes: 'Same test as mrd-17, TRM category entry'
  }
};

function main() {
  const dryRun = process.argv.includes('--dry-run');
  
  console.log('=== Add PLA Codes from BCBSM Mapping ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);
  
  let content = fs.readFileSync(DATA_FILE, 'utf8');
  let updates = 0;
  
  for (const [testId, info] of Object.entries(PLA_UPDATES)) {
    console.log(`Processing ${testId} (${info.testName})...`);
    
    // Check if code already exists
    if (content.includes(`"${info.plaCode}"`)) {
      console.log(`  ⚠️  Code ${info.plaCode} already in file - checking if for this test`);
    }
    
    // Find the test entry
    const idPattern = new RegExp(`"id":\\s*"${testId}"`, 'g');
    const match = idPattern.exec(content);
    
    if (!match) {
      console.log(`  ❌ Test ${testId} not found`);
      continue;
    }
    
    const startPos = match.index;
    
    // Find a good insertion point - after reimbursement fields
    // Look for "reimbursement" field after this test id
    const testSection = content.substring(startPos, startPos + 5000);
    
    // Check if cptCodes already exists for this test
    const existingCptMatch = testSection.match(/"cptCodes":\s*"([^"]*)"/);
    if (existingCptMatch) {
      if (existingCptMatch[1].includes(info.plaCode)) {
        console.log(`  ✓ Already has ${info.plaCode}`);
        continue;
      } else if (existingCptMatch[1]) {
        console.log(`  ⚠️  Has different code: ${existingCptMatch[1]}`);
        continue;
      }
    }
    
    // Find reimbursementNote or similar field to insert after
    const insertPatterns = [
      /"reimbursementNote":\s*"[^"]*"/,
      /"reimbursement":\s*"[^"]*"/,
      /"fdaStatus":\s*"[^"]*"/
    ];
    
    let insertPoint = null;
    for (const pattern of insertPatterns) {
      const insertMatch = pattern.exec(testSection);
      if (insertMatch) {
        insertPoint = startPos + insertMatch.index + insertMatch[0].length;
        break;
      }
    }
    
    if (!insertPoint) {
      console.log(`  ❌ Could not find insertion point`);
      continue;
    }
    
    // Insert the cptCodes field
    const insertion = `,\n    "cptCodes": "${info.plaCode}"`;
    content = content.substring(0, insertPoint) + insertion + content.substring(insertPoint);
    
    console.log(`  ✓ Added ${info.plaCode}`);
    updates++;
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Updates: ${updates}`);
  
  if (updates > 0 && !dryRun) {
    fs.writeFileSync(DATA_FILE, content);
    console.log('Changes written to data.js');
  } else if (dryRun) {
    console.log('Dry run - no changes written');
  }
}

main();
