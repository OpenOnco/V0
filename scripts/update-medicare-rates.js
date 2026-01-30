#!/usr/bin/env node
/**
 * Update Medicare Rates from CMS CLFS
 * 
 * Downloads the latest CMS Clinical Laboratory Fee Schedule and updates
 * OpenOnco test records with current Medicare rates.
 * 
 * Usage:
 *   node scripts/update-medicare-rates.js [--dry-run] [--verbose]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Configuration
const CLFS_URL = 'https://www.cms.gov/files/zip/25clabq4.zip';
const CLFS_QUARTER = '2025-Q4';
const TMP_DIR = '/tmp/clfs-update';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

/**
 * Download and extract CLFS data
 */
function downloadCLFS() {
  console.log(`📥 Downloading CLFS from ${CLFS_URL}...`);
  execSync(`mkdir -p ${TMP_DIR}`, { stdio: 'pipe' });
  execSync(`curl -sL -o ${TMP_DIR}/clfs.zip "${CLFS_URL}"`, { stdio: 'pipe' });
  execSync(`unzip -o ${TMP_DIR}/clfs.zip -d ${TMP_DIR}`, { stdio: 'pipe' });
  
  const files = execSync(`ls ${TMP_DIR}/*.csv`).toString().trim().split('\n');
  if (files.length === 0) throw new Error('No CSV file found');
  
  console.log(`✅ Downloaded: ${files[0]}`);
  return files[0];
}

/**
 * Parse CLFS CSV into a map of code -> rate
 */
function parseCLFS(csvPath) {
  console.log(`📊 Parsing CLFS data...`);
  
  const content = readFileSync(csvPath, 'utf-8');
  const rates = new Map();
  
  for (const line of content.split('\n')) {
    const match = line.match(/^(\d{4}),([^,]+),,(\d{8}),([A-Z]),(\d+\.\d+),/);
    if (!match) continue;
    
    const [, , code, , indicator, rateStr] = match;
    const rate = parseFloat(rateStr);
    
    if (indicator === 'L' && rate === 0) {
      rates.set(code, { rate: null, status: 'MAC-Priced', indicator });
    } else if (indicator === 'N' || rate > 0) {
      rates.set(code, { rate, status: 'Priced', indicator });
    }
  }
  
  console.log(`✅ Found ${rates.size} codes\n`);
  return rates;
}

/**
 * Extract CPT/PLA code from cptCodes field
 */
function extractCptCode(field) {
  if (!field) return null;
  const match = field.match(/\b(0\d{3}U|8\d{4})\b/);
  return match ? match[1] : null;
}

/**
 * Parse data.js - find tests by scanning for id patterns and extracting fields
 */
function parseDataFile(content) {
  const lines = content.split('\n');
  const tests = [];
  
  // First pass: find all test ID line numbers
  const testStarts = [];
  const idPattern = /^\s*"id":\s*"((mrd|tds|ecd|trm|hct|cgp)(-kit)?-\d+)"/;
  
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(idPattern);
    if (match) {
      testStarts.push({ lineNum: i, id: match[1] });
    }
  }
  
  // Second pass: for each test, extract fields until next test or array end
  for (let t = 0; t < testStarts.length; t++) {
    const start = testStarts[t].lineNum;
    const end = t + 1 < testStarts.length ? testStarts[t + 1].lineNum : lines.length;
    
    const test = {
      id: testStarts[t].id,
      lineStart: start + 1, // 1-indexed
      lineEnd: end,
      name: null,
      vendor: null,
      cptCodes: null,
      cptCode: null,
      cptCodesLine: null,
      codeTypeLine: null,
      medicareRate: undefined,
      medicareRateLine: null,
      medicareStatus: null,
      medicareStatusLine: null,
      medicareEffective: null,
      medicareEffectiveLine: null,
      adltStatus: null,
      adltStatusLine: null,
    };
    
    // Scan lines in this test's block
    for (let i = start; i < end; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // Extract fields - only match at top level (4 spaces indent)
      if (line.match(/^    "name":/)) {
        const m = line.match(/"name":\s*"([^"]+)"/);
        if (m) test.name = m[1];
      }
      if (line.match(/^    "vendor":/)) {
        const m = line.match(/"vendor":\s*"([^"]+)"/);
        if (m) test.vendor = m[1];
      }
      if (line.match(/^    "cptCodes":/)) {
        const m = line.match(/"cptCodes":\s*"([^"]*)"/);
        if (m) {
          test.cptCodes = m[1];
          test.cptCode = extractCptCode(m[1]);
          test.cptCodesLine = lineNum;
        }
      }
      // Also handle singular "cptCode" field (used in ECD tests)
      if (line.match(/^    "cptCode":/) && !test.cptCode) {
        const m = line.match(/"cptCode":\s*"([^"]*)"/);
        if (m) {
          test.cptCodes = m[1];
          test.cptCode = extractCptCode(m[1]);
          test.cptCodesLine = lineNum;
        }
      }
      if (line.match(/^    "codeType":/)) {
        test.codeTypeLine = lineNum;
      }
      if (line.match(/^    "medicareRate":/)) {
        const m = line.match(/"medicareRate":\s*(\d+\.?\d*|null)/);
        if (m) {
          test.medicareRate = m[1] === 'null' ? null : parseFloat(m[1]);
          test.medicareRateLine = lineNum;
        }
      }
      if (line.match(/^    "medicareStatus":/)) {
        const m = line.match(/"medicareStatus":\s*"([^"]*)"/);
        if (m) {
          test.medicareStatus = m[1];
          test.medicareStatusLine = lineNum;
        }
      }
      if (line.match(/^    "medicareEffective":/)) {
        const m = line.match(/"medicareEffective":\s*"([^"]*)"/);
        if (m) {
          test.medicareEffective = m[1];
          test.medicareEffectiveLine = lineNum;
        }
      }
      if (line.match(/^    "adltStatus":/)) {
        const m = line.match(/"adltStatus":\s*(true|false)/);
        if (m) {
          test.adltStatus = m[1] === 'true';
          test.adltStatusLine = lineNum;
        }
      }
    }
    
    if (test.name) {
      tests.push(test);
    }
  }
  
  return tests;
}

/**
 * Generate updates for tests based on CLFS rates
 */
function generateUpdates(tests, clfsRates) {
  const updates = [];
  const matched = [];
  const unmatched = [];
  const noCode = [];
  
  for (const test of tests) {
    if (!test.cptCode) {
      noCode.push(test);
      continue;
    }
    
    const clfsData = clfsRates.get(test.cptCode);
    if (!clfsData) {
      unmatched.push(test);
      continue;
    }
    
    matched.push({ ...test, clfsData });
    
    const newRate = clfsData.rate;
    const newStatus = clfsData.status;
    
    const rateChanged = test.medicareRate !== newRate;
    const statusChanged = test.medicareStatus !== newStatus;
    const effectiveChanged = test.medicareEffective !== CLFS_QUARTER;
    const noExistingFields = test.medicareRateLine === null;
    
    if (rateChanged || statusChanged || effectiveChanged || noExistingFields) {
      updates.push({
        test,
        oldRate: test.medicareRate,
        newRate,
        oldStatus: test.medicareStatus,
        newStatus,
        newEffective: CLFS_QUARTER,
        cptCode: test.cptCode,
        needsNewFields: noExistingFields,
      });
    }
  }
  
  return { updates, matched, unmatched, noCode };
}

/**
 * Apply updates to data.js content
 */
function applyUpdates(content, updates) {
  const lines = content.split('\n');
  
  // Sort by line number descending
  const sorted = [...updates].sort((a, b) => b.test.lineStart - a.test.lineStart);
  
  for (const update of sorted) {
    const { test, newRate, newStatus, newEffective, needsNewFields } = update;
    
    if (!needsNewFields) {
      // Update existing fields in place
      if (test.medicareRateLine) {
        lines[test.medicareRateLine - 1] = lines[test.medicareRateLine - 1].replace(
          /"medicareRate":\s*(\d+|null)/,
          `"medicareRate": ${newRate === null ? 'null' : newRate}`
        );
      }
      if (test.medicareStatusLine) {
        lines[test.medicareStatusLine - 1] = lines[test.medicareStatusLine - 1].replace(
          /"medicareStatus":\s*"[^"]*"/,
          `"medicareStatus": "${newStatus}"`
        );
      }
      if (test.medicareEffectiveLine) {
        lines[test.medicareEffectiveLine - 1] = lines[test.medicareEffectiveLine - 1].replace(
          /"medicareEffective":\s*"[^"]*"/,
          `"medicareEffective": "${newEffective}"`
        );
      }
    } else {
      // Add new Medicare fields after codeType or cptCodes
      const insertAfter = test.codeTypeLine || test.cptCodesLine;
      if (insertAfter) {
        // Check if medicareStatus already exists in the next few lines
        const checkRange = 5;
        let alreadyExists = false;
        for (let i = insertAfter; i < Math.min(insertAfter + checkRange, lines.length); i++) {
          if (lines[i] && lines[i].includes('"medicareStatus"')) {
            alreadyExists = true;
            break;
          }
        }
        
        if (!alreadyExists) {
          const indent = '    ';
          const newLines = [];
          
          if (newRate !== null) {
            newLines.push(`${indent}"medicareRate": ${newRate},`);
          }
          newLines.push(`${indent}"medicareStatus": "${newStatus}",`);
          newLines.push(`${indent}"medicareEffective": "${newEffective}",`);
          
          // Add adltStatus for PLA codes
          if (test.cptCode?.match(/^0\d{3}U$/) && test.adltStatusLine === null) {
            newLines.push(`${indent}"adltStatus": true,`);
          }
          
          lines.splice(insertAfter, 0, ...newLines);
        }
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Main
 */
async function main() {
  console.log('🏥 OpenOnco Medicare Rate Updater');
  console.log('='.repeat(50));
  if (DRY_RUN) console.log('🔍 DRY RUN MODE\n');
  
  try {
    const csvPath = downloadCLFS();
    const clfsRates = parseCLFS(csvPath);
    
    const dataPath = join(ROOT, 'src', 'data.js');
    console.log(`📂 Loading ${dataPath}...`);
    const content = readFileSync(dataPath, 'utf-8');
    const tests = parseDataFile(content);
    console.log(`📋 Found ${tests.length} tests\n`);
    
    const testsWithCodes = tests.filter(t => t.cptCode);
    console.log(`🔢 Tests with CPT/PLA codes: ${testsWithCodes.length}`);
    if (VERBOSE) {
      for (const t of testsWithCodes) {
        const rate = t.medicareRate !== undefined 
          ? (t.medicareRate !== null ? `$${t.medicareRate}` : 'null') 
          : '(none)';
        console.log(`   ${t.id.padEnd(12)} ${t.cptCode.padEnd(7)} ${rate.padStart(10)}  ${t.name}`);
      }
    }
    
    const { updates, matched, unmatched, noCode } = generateUpdates(tests, clfsRates);
    
    console.log(`\n📊 MATCHED IN CLFS: ${matched.length}`);
    console.log('-'.repeat(90));
    for (const t of matched) {
      const clfsRate = t.clfsData.rate !== null ? `$${t.clfsData.rate.toLocaleString()}` : 'MAC-Priced';
      const curRate = t.medicareRate !== undefined
        ? (t.medicareRate !== null ? `$${t.medicareRate.toLocaleString()}` : 'null')
        : '(none)';
      const changed = t.medicareRate !== t.clfsData.rate ? '⚡' : ' ';
      console.log(`${changed} ${t.id.padEnd(12)} ${t.cptCode}  ${curRate.padStart(12)} → ${clfsRate.padStart(12)}  ${t.name}`);
    }
    
    console.log(`\n🔄 UPDATES NEEDED: ${updates.length}`);
    console.log('-'.repeat(90));
    if (updates.length === 0) {
      console.log('  ✅ All rates current!');
    } else {
      for (const u of updates) {
        const oldRate = u.oldRate !== undefined
          ? (u.oldRate !== null ? `$${u.oldRate.toLocaleString()}` : 'null')
          : '(new)';
        const newRate = u.newRate !== null ? `$${u.newRate.toLocaleString()}` : 'MAC-Priced';
        const action = u.needsNewFields ? 'ADD' : 'UPD';
        console.log(`  [${action}] ${u.test.id.padEnd(12)} ${u.cptCode}  ${oldRate.padStart(10)} → ${newRate.padStart(12)}  ${u.test.name}`);
      }
    }
    
    if (unmatched.length > 0) {
      console.log(`\n⚠️  NOT IN CLFS: ${unmatched.length}`);
      for (const t of unmatched) {
        console.log(`  ${t.id.padEnd(12)} ${t.cptCode.padEnd(7)}  ${t.name}`);
      }
    }
    
    console.log('\n📈 SUMMARY:');
    console.log(`  Total tests:        ${tests.length}`);
    console.log(`  With CPT codes:     ${testsWithCodes.length}`);
    console.log(`  Matched in CLFS:    ${matched.length}`);
    console.log(`  Updates needed:     ${updates.length}`);
    
    if (!DRY_RUN && updates.length > 0) {
      console.log('\n💾 Applying updates...');
      const updated = applyUpdates(content, updates);
      writeFileSync(dataPath, updated);
      console.log('✅ Done! Review changes and commit.');
    } else if (DRY_RUN && updates.length > 0) {
      console.log('\n🔍 Dry run complete. Remove --dry-run to apply.');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
