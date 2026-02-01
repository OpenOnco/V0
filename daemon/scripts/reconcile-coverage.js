#!/usr/bin/env node

/**
 * Coverage Reconciliation Script
 *
 * Compares crawled policy data against OpenOnco's existing coverage info.
 * Identifies:
 *   1. New coverage to add (payer covers test, not in OO)
 *   2. Contradictions (OO says covered, policy says not covered)
 *   3. Missing policies (test in OO, no policy data)
 *
 * Usage:
 *   node scripts/reconcile-coverage.js
 *   node scripts/reconcile-coverage.js --output report.md
 */

import 'dotenv/config';
import { writeFile } from 'fs/promises';
import Database from 'better-sqlite3';
import { resolve } from 'path';

// Console formatting
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// ─────────────────────────────────────────────────────────────────────────────
// TEST NAME MAPPING
// Maps policy-extracted test names to OpenOnco test names/IDs
// ─────────────────────────────────────────────────────────────────────────────

const TEST_NAME_MAP = {
  // Guardant tests
  'Guardant360 CDx': { ooName: 'Guardant360 CDx', ooId: 'tds-1' },
  'Guardant360 Liquid': { ooName: 'Guardant360 CDx', ooId: 'tds-1' },
  'Guardant360': { ooName: 'Guardant360 CDx', ooId: 'tds-1' },
  'Guardant360 Response': { ooName: 'Guardant360 Response', ooId: 'trm-1' },
  'Reveal MRD': { ooName: 'Guardant Reveal', ooId: 'mrd-4' },
  'Shield': { ooName: 'Shield', ooId: 'ecd-1' },

  // Foundation tests
  'FoundationOne CDx': { ooName: 'FoundationOne CDx', ooId: 'tds-2' },
  'FoundationOne Liquid CDx': { ooName: 'FoundationOne Liquid CDx', ooId: 'tds-3' },
  'FoundationOne Heme': { ooName: 'FoundationOne Heme', ooId: 'tds-4' },

  // Natera tests
  'Signatera': { ooName: 'Signatera', ooId: 'mrd-1' },

  // Other MRD tests
  'ClonoSEQ': { ooName: 'clonoSEQ', ooId: 'mrd-6' },

  // Screening tests
  'Galleri': { ooName: 'Galleri', ooId: 'ecd-2' },
  'Cologuard': { ooName: 'Cologuard', ooId: 'ecd-6' },

  // Other
  'Oncotype DX Breast Recurrence Score': { ooName: 'Oncotype DX Breast Recurrence Score', ooId: 'tds-10' },
  'BRACAnalysis CDx': { ooName: 'BRACAnalysis CDx', ooId: 'hct-1' },
  'MyRisk Hereditary Cancer Test': { ooName: 'MyRisk Hereditary Cancer Test', ooId: 'hct-2' },
  'Tempus xT CDx': { ooName: 'Tempus xT', ooId: 'tds-5' },
  'Tempus xF': { ooName: 'Tempus xF', ooId: 'tds-6' },
  'Tempus xF+': { ooName: 'Tempus xF+', ooId: 'tds-7' },
  'HelioLiver': { ooName: 'HelioLiver', ooId: 'ecd-12' },
  'Caris Assure': { ooName: 'Caris Assure', ooId: 'mrd-15' },
  'IsoPSA': { ooName: 'IsoPSA', ooId: 'ecd-20' },
};

// ─────────────────────────────────────────────────────────────────────────────
// PAYER ID MAPPING
// Maps our policy database payer IDs to OpenOnco payer names
// ─────────────────────────────────────────────────────────────────────────────

const PAYER_ID_TO_OO_NAME = {
  'aetna': 'Aetna',
  'uhc': 'UnitedHealthcare',
  'cigna': 'Cigna',
  'anthem': 'Anthem BCBS',
  'humana': 'Humana',
  'bcbsm': 'BCBS Michigan',
  'highmark': 'Highmark BCBS',
  'blueshieldca': 'Blue Shield of California',
  'evicore': 'EviCore',  // Lab benefit manager
  'cms': 'Medicare',
};

// ─────────────────────────────────────────────────────────────────────────────
// OPENONCO COVERAGE DATA (loaded from API or hardcoded snapshot)
// ─────────────────────────────────────────────────────────────────────────────

// This would ideally be fetched from the API, but for now we'll hardcode known coverage
const OO_COVERAGE = {
  'mrd-1': { // Signatera
    name: 'Signatera',
    payers: ['UnitedHealthcare', 'Cigna', 'Anthem BCBS', 'BCBS Louisiana', 'Blue Shield of California'],
    notes: 'Aetna lists codes as in-network but current policies show non-covered',
  },
  'mrd-4': { // Guardant Reveal
    name: 'Guardant Reveal',
    payers: ['BCBS Louisiana', 'Geisinger Health Plan'],
    notes: 'BCBS Massachusetts may have coverage',
  },
  'mrd-6': { // clonoSEQ
    name: 'clonoSEQ',
    payers: [],
    notes: '',
  },
  'tds-1': { // Guardant360 CDx
    name: 'Guardant360 CDx',
    payers: [],
    notes: '',
  },
  'tds-2': { // FoundationOne CDx
    name: 'FoundationOne CDx',
    payers: [],
    notes: '',
  },
  'tds-3': { // FoundationOne Liquid CDx
    name: 'FoundationOne Liquid CDx',
    payers: [],
    notes: '',
  },
  'ecd-1': { // Shield
    name: 'Shield',
    payers: [],
    notes: '',
  },
  'ecd-2': { // Galleri
    name: 'Galleri',
    payers: [],
    notes: 'Limited coverage; most patients self-pay',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// RECONCILIATION LOGIC
// ─────────────────────────────────────────────────────────────────────────────

async function loadPolicyData() {
  const dbPath = resolve(process.cwd(), 'data', 'payer-hashes.db');
  const db = new Database(dbPath);

  const rows = db.prepare(`
    SELECT
      policy_id, payer_id, policy_name, url,
      coverage_position, tests_mentioned,
      analysis_confidence, raw_analysis
    FROM policy_coverage
    WHERE tests_mentioned IS NOT NULL AND tests_mentioned != '[]'
  `).all();

  db.close();

  return rows.map(row => ({
    ...row,
    testsMentioned: JSON.parse(row.tests_mentioned || '[]'),
    rawAnalysis: row.raw_analysis ? JSON.parse(row.raw_analysis) : null,
  }));
}

function reconcile(policyData) {
  const findings = {
    newCoverage: [],      // Payer covers test, not in OO
    contradictions: [],   // OO says covered, policy says not
    confirmations: [],    // Both agree on coverage
    missingInOO: [],      // Test in policy but not mapped
    notCovered: [],       // Explicitly not covered
  };

  // Build a map of test -> payer -> coverage from policies
  const policyCoverage = {};

  for (const policy of policyData) {
    const payerName = PAYER_ID_TO_OO_NAME[policy.payer_id];
    if (!payerName) continue;

    for (const testName of policy.testsMentioned) {
      const mapping = TEST_NAME_MAP[testName];
      if (!mapping) {
        // Test not mapped to OO
        findings.missingInOO.push({
          testName,
          payer: payerName,
          payerId: policy.payer_id,
          policyName: policy.policy_name,
          position: policy.coverage_position,
        });
        continue;
      }

      const ooId = mapping.ooId;
      if (!policyCoverage[ooId]) {
        policyCoverage[ooId] = {};
      }

      // Get test-specific coverage from raw analysis if available
      let testPosition = policy.coverage_position;
      if (policy.rawAnalysis?.testCoverage?.[testName]) {
        testPosition = policy.rawAnalysis.testCoverage[testName];
      }

      policyCoverage[ooId][payerName] = {
        position: testPosition,
        policyName: policy.policy_name,
        policyUrl: policy.url,
        confidence: policy.analysis_confidence,
      };
    }
  }

  // Compare with OO coverage
  for (const [ooId, payers] of Object.entries(policyCoverage)) {
    const ooTest = OO_COVERAGE[ooId];
    const testName = ooTest?.name || TEST_NAME_MAP[Object.keys(TEST_NAME_MAP).find(k => TEST_NAME_MAP[k].ooId === ooId)]?.ooName || ooId;

    for (const [payerName, coverage] of Object.entries(payers)) {
      const isInOO = ooTest?.payers?.includes(payerName);
      const position = coverage.position;

      if (position === 'not_covered') {
        if (isInOO) {
          // CONTRADICTION: OO says covered, policy says not
          findings.contradictions.push({
            testId: ooId,
            testName,
            payer: payerName,
            ooSays: 'covered',
            policySays: 'not_covered',
            policyName: coverage.policyName,
            policyUrl: coverage.policyUrl,
            confidence: coverage.confidence,
          });
        } else {
          findings.notCovered.push({
            testId: ooId,
            testName,
            payer: payerName,
            policyName: coverage.policyName,
            policyUrl: coverage.policyUrl,
          });
        }
      } else if (position === 'covered' || position === 'conditional') {
        if (isInOO) {
          // CONFIRMATION: Both agree
          findings.confirmations.push({
            testId: ooId,
            testName,
            payer: payerName,
            position,
            policyName: coverage.policyName,
          });
        } else {
          // NEW COVERAGE: Policy shows coverage, not in OO
          findings.newCoverage.push({
            testId: ooId,
            testName,
            payer: payerName,
            position,
            policyName: coverage.policyName,
            policyUrl: coverage.policyUrl,
            confidence: coverage.confidence,
          });
        }
      }
    }
  }

  return findings;
}

function printFindings(findings) {
  console.log(`\n${CYAN}╔════════════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}║  ${BOLD}Coverage Reconciliation Report${RESET}${CYAN}                            ║${RESET}`);
  console.log(`${CYAN}╚════════════════════════════════════════════════════════════╝${RESET}\n`);

  // Contradictions (most important)
  console.log(`${RED}${BOLD}⚠ CONTRADICTIONS (${findings.contradictions.length})${RESET}`);
  console.log(`${DIM}OpenOnco says covered, but policy says not covered${RESET}\n`);
  if (findings.contradictions.length === 0) {
    console.log(`  ${GREEN}None found${RESET}\n`);
  } else {
    for (const c of findings.contradictions) {
      console.log(`  ${RED}•${RESET} ${BOLD}${c.testName}${RESET} @ ${c.payer}`);
      console.log(`    OO: ${GREEN}covered${RESET} → Policy: ${RED}${c.policySays}${RESET}`);
      console.log(`    ${DIM}Source: ${c.policyName}${RESET}`);
      console.log();
    }
  }

  // New coverage to add
  console.log(`${GREEN}${BOLD}✚ NEW COVERAGE TO ADD (${findings.newCoverage.length})${RESET}`);
  console.log(`${DIM}Policy shows coverage, not yet in OpenOnco${RESET}\n`);
  if (findings.newCoverage.length === 0) {
    console.log(`  ${DIM}None found${RESET}\n`);
  } else {
    // Group by test
    const byTest = {};
    for (const n of findings.newCoverage) {
      if (!byTest[n.testId]) {
        byTest[n.testId] = { testName: n.testName, payers: [] };
      }
      byTest[n.testId].payers.push(n);
    }

    for (const [testId, data] of Object.entries(byTest)) {
      console.log(`  ${GREEN}•${RESET} ${BOLD}${data.testName}${RESET} (${testId})`);
      for (const p of data.payers) {
        console.log(`    + ${p.payer}: ${CYAN}${p.position}${RESET} ${DIM}(${p.policyName})${RESET}`);
      }
      console.log();
    }
  }

  // Confirmations
  console.log(`${CYAN}${BOLD}✓ CONFIRMATIONS (${findings.confirmations.length})${RESET}`);
  console.log(`${DIM}OpenOnco coverage matches policy data${RESET}\n`);
  if (findings.confirmations.length === 0) {
    console.log(`  ${DIM}None${RESET}\n`);
  } else {
    for (const c of findings.confirmations) {
      console.log(`  ${CYAN}•${RESET} ${c.testName} @ ${c.payer}: ${c.position}`);
    }
    console.log();
  }

  // Not covered (informational)
  console.log(`${YELLOW}${BOLD}✗ NOT COVERED (${findings.notCovered.length})${RESET}`);
  console.log(`${DIM}Tests explicitly not covered by these payers${RESET}\n`);
  if (findings.notCovered.length === 0) {
    console.log(`  ${DIM}None explicitly denied${RESET}\n`);
  } else {
    for (const n of findings.notCovered) {
      console.log(`  ${YELLOW}•${RESET} ${n.testName} @ ${n.payer}`);
      console.log(`    ${DIM}Source: ${n.policyName}${RESET}`);
    }
    console.log();
  }

  // Unmapped tests
  if (findings.missingInOO.length > 0) {
    console.log(`${DIM}${BOLD}? UNMAPPED TESTS (${findings.missingInOO.length})${RESET}`);
    console.log(`${DIM}Tests found in policies but not mapped to OpenOnco IDs${RESET}\n`);
    const uniqueTests = [...new Set(findings.missingInOO.map(m => m.testName))];
    for (const t of uniqueTests) {
      console.log(`  ${DIM}• ${t}${RESET}`);
    }
    console.log();
  }
}

function generateMarkdownReport(findings) {
  const lines = [
    '# Coverage Reconciliation Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `| Category | Count |`,
    `|----------|-------|`,
    `| Contradictions | ${findings.contradictions.length} |`,
    `| New Coverage to Add | ${findings.newCoverage.length} |`,
    `| Confirmations | ${findings.confirmations.length} |`,
    `| Not Covered | ${findings.notCovered.length} |`,
    '',
  ];

  // Contradictions
  lines.push('## ⚠️ Contradictions');
  lines.push('');
  lines.push('OpenOnco shows coverage, but payer policy says not covered.');
  lines.push('');
  if (findings.contradictions.length === 0) {
    lines.push('_None found_');
  } else {
    lines.push('| Test | Payer | OO Says | Policy Says | Source |');
    lines.push('|------|-------|---------|-------------|--------|');
    for (const c of findings.contradictions) {
      lines.push(`| ${c.testName} | ${c.payer} | covered | ${c.policySays} | [${c.policyName}](${c.policyUrl}) |`);
    }
  }
  lines.push('');

  // New coverage
  lines.push('## ✚ New Coverage to Add');
  lines.push('');
  lines.push('Payer policies show coverage not yet reflected in OpenOnco.');
  lines.push('');
  if (findings.newCoverage.length === 0) {
    lines.push('_None found_');
  } else {
    lines.push('| Test | Payer | Position | Source |');
    lines.push('|------|-------|----------|--------|');
    for (const n of findings.newCoverage) {
      lines.push(`| ${n.testName} | ${n.payer} | ${n.position} | [${n.policyName}](${n.policyUrl}) |`);
    }
  }
  lines.push('');

  // Confirmations
  lines.push('## ✓ Confirmations');
  lines.push('');
  if (findings.confirmations.length === 0) {
    lines.push('_None_');
  } else {
    lines.push('| Test | Payer | Position |');
    lines.push('|------|-------|----------|');
    for (const c of findings.confirmations) {
      lines.push(`| ${c.testName} | ${c.payer} | ${c.position} |`);
    }
  }
  lines.push('');

  // Not covered
  lines.push('## ✗ Explicitly Not Covered');
  lines.push('');
  if (findings.notCovered.length === 0) {
    lines.push('_None explicitly denied_');
  } else {
    lines.push('| Test | Payer | Source |');
    lines.push('|------|-------|--------|');
    for (const n of findings.notCovered) {
      lines.push(`| ${n.testName} | ${n.payer} | ${n.policyName} |`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('*Generated by reconcile-coverage.js*');

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');
  const outputFile = outputIdx !== -1 ? args[outputIdx + 1] : null;

  console.log(`${CYAN}Loading policy data...${RESET}`);
  const policyData = await loadPolicyData();
  console.log(`${GREEN}Loaded ${policyData.length} policies with test mentions${RESET}\n`);

  const findings = reconcile(policyData);

  printFindings(findings);

  if (outputFile) {
    const report = generateMarkdownReport(findings);
    await writeFile(outputFile, report);
    console.log(`${GREEN}Report saved to: ${outputFile}${RESET}\n`);
  }
}

main().catch(error => {
  console.error(`${RED}Error: ${error.message}${RESET}`);
  process.exit(1);
});
