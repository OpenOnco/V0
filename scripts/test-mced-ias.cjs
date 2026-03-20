#!/usr/bin/env node

/**
 * Verification script for MCED incidence-adjusted sensitivity and specificity data.
 * Validates all fields, values, and cross-test consistency in src/data.js.
 *
 * Usage: node scripts/test-mced-ias.js
 * Exit code 0 = all pass, 1 = at least one failure
 */

const { execSync } = require('child_process');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(label, condition, actual, expected) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
console.log('\n=== Loading data ===\n');

let ecdTests;
try {
  const d = require('../src/data.js');
  ecdTests = d.ecdTests || d.default?.ecdTests || d.ecdTestData;
  assert('data.js loads without errors', true);
} catch (e) {
  console.log(`  ✗ data.js loads without errors`);
  console.log(`    error: ${e.message}`);
  process.exit(1);
}

assert('ecdTests array exists', Array.isArray(ecdTests) && ecdTests.length > 0, ecdTests?.length, '> 0');

const mcedTests = ecdTests.filter(x => x.testScope?.includes('Multi'));
const byId = Object.fromEntries(mcedTests.map(t => [t.id, t]));

// ---------------------------------------------------------------------------
// 1. Schema: All MCED tests have required new fields
// ---------------------------------------------------------------------------
console.log('\n=== 1. Schema: required fields exist ===\n');

assert('7 MCED tests found', mcedTests.length >= 7, mcedTests.length, '>= 7');

const requiredFields = [
  'sensitivityType',
  'incidenceAdjustedSensitivity',
  'incidenceAdjustedSensitivityNotes',
  'incidenceAdjustedSensitivityCitations',
];

const expectedIds = ['ecd-2', 'ecd-10', 'ecd-11', 'ecd-21', 'ecd-22', 'ecd-26', 'ecd-27'];
for (const id of expectedIds) {
  const t = byId[id];
  assert(`${id} exists in MCED set`, !!t, !!t, true);
  if (!t) continue;
  for (const field of requiredFields) {
    assert(`${id} has field '${field}'`, field in t, field in t, true);
  }
}

// ---------------------------------------------------------------------------
// 2. sensitivityType values
// ---------------------------------------------------------------------------
console.log('\n=== 2. sensitivityType values ===\n');

const expectedSensTypes = {
  'ecd-2':  'observed (case-control)',
  'ecd-10': 'episode-based interim',
  'ecd-11': 'incidence-adjusted (SEER-weighted)',
  'ecd-21': 'observed (case-control)',
  'ecd-22': 'observed (case-control)',
  'ecd-26': 'observed (case-control)',
  'ecd-27': 'observed (case-control)',
};

for (const [id, expected] of Object.entries(expectedSensTypes)) {
  const actual = byId[id]?.sensitivityType;
  assert(`${id} sensitivityType`, actual === expected, actual, expected);
}

// ---------------------------------------------------------------------------
// 3. CancerGuard (ecd-22) stage-specific fixes
// ---------------------------------------------------------------------------
console.log('\n=== 3. CancerGuard stage-specific fixes ===\n');

const cg = byId['ecd-22'];
if (cg) {
  assert('stageISensitivity === 24.8', cg.stageISensitivity === 24.8, cg.stageISensitivity, 24.8);
  assert('stageIISensitivity === 57.8', cg.stageIISensitivity === 57.8, cg.stageIISensitivity, 57.8);
  assert('stageIIISensitivity === 81.5', cg.stageIIISensitivity === 81.5, cg.stageIIISensitivity, 81.5);
  assert('stageIVSensitivity === 90.3', cg.stageIVSensitivity === 90.3, cg.stageIVSensitivity, 90.3);
  assert('stageISensitivityCitations contains exactsciences', cg.stageISensitivityCitations?.includes('exactsciences.com/cancerguardtestinfo'), cg.stageISensitivityCitations, 'contains exactsciences.com/cancerguardtestinfo');
  assert('stageIISensitivityCitations contains exactsciences', cg.stageIISensitivityCitations?.includes('exactsciences.com/cancerguardtestinfo'), cg.stageIISensitivityCitations, 'contains exactsciences.com/cancerguardtestinfo');
  assert('stageIIISensitivityCitations contains exactsciences', cg.stageIIISensitivityCitations?.includes('exactsciences.com/cancerguardtestinfo'), cg.stageIIISensitivityCitations, 'contains exactsciences.com/cancerguardtestinfo');
  assert('stageIVSensitivityCitations contains exactsciences', cg.stageIVSensitivityCitations?.includes('exactsciences.com/cancerguardtestinfo'), cg.stageIVSensitivityCitations, 'contains exactsciences.com/cancerguardtestinfo');
  assert('sensitivityNotes contains "39.0%"', cg.sensitivityNotes?.includes('39.0%'), cg.sensitivityNotes?.substring(0, 80), 'contains 39.0%');
  assert('sensitivityNotes does NOT contain "45-50%"', !cg.sensitivityNotes?.includes('45-50%'), 'absent', 'absent');
  assert('stageISensitivityNotes contains "24.8%"', cg.stageISensitivityNotes?.includes('24.8%'), cg.stageISensitivityNotes?.substring(0, 60), 'contains 24.8%');
  assert('stageISensitivityNotes contains "26.8%"', cg.stageISensitivityNotes?.includes('26.8%'), cg.stageISensitivityNotes?.substring(0, 80), 'contains 26.8%');
}

// ---------------------------------------------------------------------------
// 4. IAS values populated and sane
// ---------------------------------------------------------------------------
console.log('\n=== 4. IAS values ===\n');

const galleri = byId['ecd-2'];
const episeek = byId['ecd-11'];

if (galleri) {
  const v = galleri.incidenceAdjustedSensitivity;
  assert('Galleri IAS is number between 20-60', typeof v === 'number' && v >= 20 && v <= 60, v, '20-60');
}
if (episeek) {
  assert('EPISEEK IAS === 54.0', episeek.incidenceAdjustedSensitivity === 54.0, episeek.incidenceAdjustedSensitivity, 54.0);
}
if (cg) {
  const v = cg.incidenceAdjustedSensitivity;
  assert('CancerGuard IAS is number between 30-70', typeof v === 'number' && v >= 30 && v <= 70, v, '30-70');
}

for (const id of ['ecd-10', 'ecd-21', 'ecd-26', 'ecd-27']) {
  assert(`${id} IAS === null`, byId[id]?.incidenceAdjustedSensitivity === null, byId[id]?.incidenceAdjustedSensitivity, null);
}

// ---------------------------------------------------------------------------
// 5. IAS notes contain methodology context
// ---------------------------------------------------------------------------
console.log('\n=== 5. IAS notes methodology ===\n');

if (galleri) {
  const n = galleri.incidenceAdjustedSensitivityNotes || '';
  assert('Galleri IAS notes contain "SEER 2021"', n.includes('SEER 2021'), n.substring(0, 60), 'contains SEER 2021');
  assert('Galleri IAS notes contain "99.5% specificity"', n.includes('99.5% specificity'), n.substring(0, 60), 'contains 99.5% specificity');
}
if (cg) {
  const n = cg.incidenceAdjustedSensitivityNotes || '';
  assert('CancerGuard IAS notes contain "SEER 2021"', n.includes('SEER 2021'), n.substring(0, 60), 'contains SEER 2021');
  assert('CancerGuard IAS notes contain "97.4% specificity"', n.includes('97.4% specificity'), n.substring(0, 60), 'contains 97.4% specificity');
}
if (episeek) {
  const n = episeek.incidenceAdjustedSensitivityNotes || '';
  assert('EPISEEK IAS notes contain "Vendor-reported"', n.includes('Vendor-reported'), n.substring(0, 60), 'contains Vendor-reported');
}

// ---------------------------------------------------------------------------
// 6. IAS citations populated
// ---------------------------------------------------------------------------
console.log('\n=== 6. IAS citations ===\n');

if (galleri) {
  const c = galleri.incidenceAdjustedSensitivityCitations;
  assert('Galleri IAS citations not null/empty', !!c && c.length > 0, c?.substring(0, 40), 'non-empty');
}
if (cg) {
  const c = cg.incidenceAdjustedSensitivityCitations;
  assert('CancerGuard IAS citations not null/empty', !!c && c.length > 0, c?.substring(0, 40), 'non-empty');
}
if (episeek) {
  const c = episeek.incidenceAdjustedSensitivityCitations || '';
  assert('EPISEEK IAS citations contain "ascopubs.org"', c.includes('ascopubs.org'), c.substring(0, 40), 'contains ascopubs.org');
}

// ---------------------------------------------------------------------------
// 7. Specificity context in notes
// ---------------------------------------------------------------------------
console.log('\n=== 7. Specificity context ===\n');

if (cg) {
  assert('CancerGuard specificityNotes contains "2,574" or "5x"',
    cg.specificityNotes?.includes('2,574') || cg.specificityNotes?.includes('5x'),
    cg.specificityNotes?.substring(0, 60), 'contains 2,574 or 5x');
  assert('CancerGuard performanceNotes contains "19.4%"',
    cg.performanceNotes?.includes('19.4%'),
    cg.performanceNotes?.substring(0, 60), 'contains 19.4%');
  assert('CancerGuard performanceNotes contains "5x" or "specificity"',
    cg.performanceNotes?.includes('5x') || cg.performanceNotes?.includes('specificity'),
    cg.performanceNotes?.substring(0, 60), 'contains 5x or specificity');
}
if (galleri) {
  assert('Galleri specificityNotes contains "495"',
    galleri.specificityNotes?.includes('495'),
    galleri.specificityNotes?.substring(0, 60), 'contains 495');
}
if (episeek) {
  assert('EPISEEK specificityNotes contains "495" or "0.5%"',
    episeek.specificityNotes?.includes('495') || episeek.specificityNotes?.includes('0.5%'),
    episeek.specificityNotes?.substring(0, 60), 'contains 495 or 0.5%');
}

// ---------------------------------------------------------------------------
// 8. Cross-test consistency checks
// ---------------------------------------------------------------------------
console.log('\n=== 8. Cross-test consistency ===\n');

if (galleri) {
  assert('Galleri observed (51.5) > IAS (breast/prostate drag down)',
    galleri.sensitivity > galleri.incidenceAdjustedSensitivity,
    `${galleri.sensitivity} > ${galleri.incidenceAdjustedSensitivity}`, 'observed > IAS');
}

if (cg) {
  const diff = Math.abs(cg.sensitivity - cg.incidenceAdjustedSensitivity);
  assert('CancerGuard IAS within 20 points of observed',
    diff <= 20, `diff=${diff.toFixed(1)}`, '<= 20');
  assert('CancerGuard IAS !== observed (should differ)',
    cg.incidenceAdjustedSensitivity !== cg.sensitivity,
    cg.incidenceAdjustedSensitivity, `!== ${cg.sensitivity}`);
}

// All tests with IAS also have sensitivityType
for (const t of mcedTests) {
  if (t.incidenceAdjustedSensitivity !== null && t.incidenceAdjustedSensitivity !== undefined) {
    assert(`${t.id} has sensitivityType when IAS is populated`,
      !!t.sensitivityType, t.sensitivityType, 'non-empty');
  }
}

// ---------------------------------------------------------------------------
// 9. IAS calculation script exists and runs
// ---------------------------------------------------------------------------
console.log('\n=== 9. IAS script ===\n');

const scriptPath = path.join(__dirname, 'calculate-ias.js');
const fs = require('fs');
assert('scripts/calculate-ias.js exists', fs.existsSync(scriptPath), fs.existsSync(scriptPath), true);

try {
  const output = execSync(`node ${scriptPath}`, { encoding: 'utf-8' });
  assert('calculate-ias.js runs without error', true);
  assert('Output contains "Galleri"', output.includes('Galleri'), 'present', 'present');
  assert('Output contains "CancerGuard"', output.includes('CancerGuard'), 'present', 'present');

  // Check IAS values in output match data.js
  if (galleri) {
    const iasStr = galleri.incidenceAdjustedSensitivity.toFixed(1);
    assert(`Script output contains Galleri IAS ${iasStr}%`, output.includes(`${iasStr}%`), 'present', `contains ${iasStr}%`);
  }
  if (cg) {
    const iasStr = cg.incidenceAdjustedSensitivity.toFixed(1);
    assert(`Script output contains CancerGuard IAS ${iasStr}%`, output.includes(`${iasStr}%`), 'present', `contains ${iasStr}%`);
  }
} catch (e) {
  assert('calculate-ias.js runs without error', false, e.message, 'exit code 0');
}

// ---------------------------------------------------------------------------
// 10. data.js integrity
// ---------------------------------------------------------------------------
console.log('\n=== 10. data.js integrity ===\n');

assert('ecdTests count >= 30 (no accidental deletions)', ecdTests.length >= 30, ecdTests.length, '>= 30');

// Check the 7 target MCED tests have numeric sensitivity/specificity
for (const id of expectedIds) {
  const t = byId[id];
  if (!t) continue;
  assert(`${t.id} has numeric sensitivity`, typeof t.sensitivity === 'number', typeof t.sensitivity, 'number');
  assert(`${t.id} has numeric specificity`, typeof t.specificity === 'number', typeof t.specificity, 'number');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + '='.repeat(60));
console.log(`  ${passed + failed} tests: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
