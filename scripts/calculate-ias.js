#!/usr/bin/env node

/**
 * Incidence-Adjusted Sensitivity (IAS) Calculator
 *
 * IAS = Σ(sensitivity_i × incidence_i) / Σ(incidence_i)
 *
 * Weights each cancer type's observed sensitivity by its population incidence,
 * giving a single metric that reflects real-world detection performance
 * across the cancers a test actually targets.
 *
 * Sources:
 *   - SEER 2021 estimated new cases (ACS Cancer Facts & Figures)
 *   - Galleri: CCGA sub-study (all stages)
 *   - CancerGuard: Table 6-4 (excluding breast/prostate — not indicated)
 */

// ---------------------------------------------------------------------------
// SEER 2021 incidence (estimated new cases)
// ---------------------------------------------------------------------------
const SEER_INCIDENCE = {
  'Breast':           281550,
  'Lung':             235760,
  'Prostate':         248530,
  'Colon/Rectum':     149500,
  'Uterus':            66570,
  'Melanoma':         106110,
  'Bladder':           83730,
  'NHL':               81560,
  'Kidney':            76080,
  'Pancreas':          60430,
  'Leukemia':          61090,
  'Thyroid':           43800,
  'Liver':             42230,
  'Head&Neck':         66000,
  'Esophagus':         19260,
  'Stomach':           26560,
  'Ovary':             21410,
  'Cervix':            14480,
  'Testis':             9470,
  'Small Intestine':   11390,
  'Myeloma':           34920,
  'Sarcoma':           13460,
  'Anus':               9090,
};

// ---------------------------------------------------------------------------
// Galleri CCGA observed sensitivity (%, all stages)
// Each key maps to the SEER category it corresponds to.
// ---------------------------------------------------------------------------
const GALLERI_SENSITIVITY = {
  'Anus':                  { pct: 81.8, seer: 'Anus' },
  'Bladder':               { pct: 34.8, seer: 'Bladder' },
  'Breast':                { pct: 30.5, seer: 'Breast' },
  'Cervix':                { pct: 80.0, seer: 'Cervix' },
  'Colon/Rectum':          { pct: 82.0, seer: 'Colon/Rectum' },
  'Esophagus':             { pct: 85.0, seer: 'Esophagus' },
  'Gallbladder':           { pct: 70.6, seer: null },  // no SEER category
  'Head and Neck':         { pct: 85.7, seer: 'Head&Neck' },
  'Kidney':                { pct: 18.2, seer: 'Kidney' },
  'Liver':                 { pct: 93.5, seer: 'Liver' },
  'Lung':                  { pct: 74.8, seer: 'Lung' },
  'Lymphoid Leukemia':     { pct: 41.2, seer: 'Leukemia', note: 'Combined with Myeloid Neoplasm for Leukemia SEER weight' },
  'Lymphoma':              { pct: 56.3, seer: 'NHL' },
  'Melanoma':              { pct: 46.2, seer: 'Melanoma' },
  'Myeloid Neoplasm':      { pct: 20.0, seer: 'Leukemia', note: 'Combined with Lymphoid Leukemia for Leukemia SEER weight' },
  'Ovary':                 { pct: 83.1, seer: 'Ovary' },
  'Pancreas':              { pct: 83.7, seer: 'Pancreas' },
  'Plasma Cell Neoplasm':  { pct: 72.3, seer: 'Myeloma' },
  'Prostate':              { pct: 11.2, seer: 'Prostate' },
  'Sarcoma':               { pct: 60.0, seer: 'Sarcoma' },
  'Stomach':               { pct: 66.7, seer: 'Stomach' },
  'Thyroid':               { pct:  0.0, seer: 'Thyroid' },
  'Urothelial Tract':      { pct: 80.0, seer: null },  // overlaps Bladder SEER category; excluded to avoid double-counting
  'Uterus':                { pct: 28.0, seer: 'Uterus' },
};

// ---------------------------------------------------------------------------
// CancerGuard observed sensitivity (%, Table 6-4)
// Breast and prostate excluded — not indicated for CancerGuard.
// ---------------------------------------------------------------------------
const CANCERGUARD_SENSITIVITY = {
  'Lung':              { pct: 62.9, seer: 'Lung' },
  'Colon/Rectum':      { pct: 76.1, seer: 'Colon/Rectum' },
  'Uterus':            { pct: 38.5, seer: 'Uterus' },
  'Pancreas':          { pct: 78.4, seer: 'Pancreas' },
  'Head and Neck':     { pct: 69.4, seer: 'Head&Neck' },
  'Kidney':            { pct: 46.9, seer: 'Kidney' },
  'Stomach':           { pct: 73.3, seer: 'Stomach' },
  'Bladder':           { pct: 67.9, seer: 'Bladder' },
  'Esophagus':         { pct: 63.0, seer: 'Esophagus' },
  'Liver':             { pct: 80.0, seer: 'Liver' },
  'Anus':              { pct: 68.8, seer: 'Anus' },
  'Ovary':             { pct: 71.4, seer: 'Ovary' },
  'Thyroid':           { pct: 23.1, seer: 'Thyroid' },
  'Vulva':             { pct: 46.2, seer: null },  // no SEER category
  'Cervix':            { pct: 76.9, seer: 'Cervix' },
  'Small Intestine':   { pct: 40.0, seer: 'Small Intestine' },
  'NHL':               { pct: 57.1, seer: 'NHL' },
  'Testis':            { pct: 50.0, seer: 'Testis' },
  'Multiple Myeloma':  { pct:  0.0, seer: 'Myeloma' },
};

// ---------------------------------------------------------------------------
// IAS calculation
// ---------------------------------------------------------------------------
function calculateIAS(testName, sensitivityData) {
  const rows = [];
  const unmapped = [];

  // Group entries by SEER category to handle multiple-to-one mappings
  // (e.g., Lymphoid Leukemia + Myeloid Neoplasm → Leukemia)
  const seerGroups = {};
  for (const [cancerType, { pct, seer }] of Object.entries(sensitivityData)) {
    if (!seer) {
      unmapped.push(cancerType);
      continue;
    }
    const incidence = SEER_INCIDENCE[seer];
    if (incidence === undefined) {
      unmapped.push(`${cancerType} → ${seer} (missing SEER data)`);
      continue;
    }
    if (!seerGroups[seer]) seerGroups[seer] = [];
    seerGroups[seer].push({ cancerType, pct });
  }

  let weightedSum = 0;
  let totalIncidence = 0;

  for (const [seer, entries] of Object.entries(seerGroups)) {
    const incidence = SEER_INCIDENCE[seer];
    // Average sensitivity across entries mapping to same SEER category
    const avgPct = entries.reduce((sum, e) => sum + e.pct, 0) / entries.length;
    const contribution = (avgPct / 100) * incidence;
    weightedSum += contribution;
    totalIncidence += incidence;

    const label = entries.length > 1
      ? entries.map(e => `${e.cancerType} (${e.pct}%)`).join(' + ')
      : entries[0].cancerType;

    rows.push({ cancerType: label, seer, pct: avgPct, incidence, contribution });
  }

  // Sort by incidence descending for readability
  rows.sort((a, b) => b.incidence - a.incidence);

  const ias = totalIncidence > 0 ? (weightedSum / totalIncidence) * 100 : 0;

  return { testName, rows, unmapped, ias, totalIncidence, weightedSum };
}

function printResult(result) {
  const { testName, rows, unmapped, ias, totalIncidence } = result;

  console.log('='.repeat(80));
  console.log(`  ${testName}`);
  console.log('='.repeat(80));
  console.log('');

  // Header
  const hdr = [
    'Cancer Type'.padEnd(24),
    'SEER Category'.padEnd(18),
    'Sens %'.padStart(8),
    'Incidence'.padStart(11),
    'Weight %'.padStart(10),
    'Contribution'.padStart(14),
  ].join('  ');
  console.log(hdr);
  console.log('-'.repeat(hdr.length));

  for (const r of rows) {
    const weight = ((r.incidence / totalIncidence) * 100).toFixed(1);
    console.log([
      r.cancerType.padEnd(24),
      r.seer.padEnd(18),
      r.pct.toFixed(1).padStart(8),
      r.incidence.toString().padStart(11),
      (weight + '%').padStart(10),
      r.contribution.toFixed(0).padStart(14),
    ].join('  '));
  }

  console.log('-'.repeat(hdr.length));
  console.log([
    'TOTAL'.padEnd(24),
    ''.padEnd(18),
    ''.padStart(8),
    totalIncidence.toString().padStart(11),
    '100.0%'.padStart(10),
    result.weightedSum.toFixed(0).padStart(14),
  ].join('  '));

  console.log('');
  if (unmapped.length > 0) {
    console.log(`  Unmapped (excluded): ${unmapped.join(', ')}`);
  }
  console.log(`  Matched cancer types: ${rows.length}`);
  console.log(`  Total matched incidence: ${totalIncidence.toLocaleString()} cases`);
  console.log('');
  console.log(`  *** IAS = ${ias.toFixed(1)}% ***`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const galleri = calculateIAS('Galleri (GRAIL) — CCGA, All Stages', GALLERI_SENSITIVITY);
const cancerguard = calculateIAS('CancerGuard (Exact Sciences) — Table 6-4', CANCERGUARD_SENSITIVITY);

printResult(galleri);
printResult(cancerguard);

// Side-by-side comparison
console.log('='.repeat(80));
console.log('  Comparison');
console.log('='.repeat(80));
console.log('');
console.log(`  Galleri IAS:      ${galleri.ias.toFixed(1)}%  (${galleri.rows.length} cancer types, ${galleri.totalIncidence.toLocaleString()} cases)`);
console.log(`  CancerGuard IAS:  ${cancerguard.ias.toFixed(1)}%  (${cancerguard.rows.length} cancer types, ${cancerguard.totalIncidence.toLocaleString()} cases)`);
console.log('');
console.log('  Note: IAS weights sensitivity by population incidence. Higher IAS means');
console.log('  better detection of the cancers people actually get. Tests target different');
console.log('  cancer panels, so direct comparison should note the denominator differences.');
console.log('  CancerGuard excludes breast/prostate (not indicated), which are the two');
console.log('  highest-incidence cancers and where Galleri has low sensitivity (30.5%, 11.2%).');
console.log('');

// ---------------------------------------------------------------------------
// Specificity / False Positive Rate / PPV comparison across all MCED tests
// ---------------------------------------------------------------------------
const MCED_TESTS = [
  { name: 'Galleri',          specificity: 99.5, ppv: 61.6, ias: galleri.ias },
  { name: 'EPISEEK',          specificity: 99.5, ppv: 64.9, ias: 54.0 },
  { name: 'CancerGuard',      specificity: 97.4, ppv: 19.4, ias: cancerguard.ias },
  { name: 'Shield MCD',       specificity: 98.5, ppv: null, ias: null },
  { name: 'OverC',            specificity: 98.9, ppv: null, ias: null },
  { name: 'Trucheck Intelli', specificity: 96.3, ppv: null, ias: null },
  { name: 'OncoXPLORE+',      specificity: 99.0, ppv: null, ias: null },
];

// Assume 1% cancer prevalence in screening population → 99,000 healthy per 100K
const SCREENING_POP = 100000;
const CANCER_PREVALENCE = 0.01;
const HEALTHY_COUNT = SCREENING_POP * (1 - CANCER_PREVALENCE);

console.log('='.repeat(80));
console.log('  Specificity & False Positive Comparison (all MCED tests)');
console.log('='.repeat(80));
console.log('');
console.log('  Assumption: 1% cancer prevalence → 99,000 healthy individuals per 100,000 screened');
console.log('');

const specHdr = [
  'Test'.padEnd(20),
  'Spec %'.padStart(8),
  'FPR %'.padStart(8),
  'Est. FP/100K'.padStart(14),
  'PPV'.padStart(8),
  'IAS'.padStart(8),
].join('  ');
console.log(specHdr);
console.log('-'.repeat(specHdr.length));

for (const t of MCED_TESTS) {
  const fpr = 100 - t.specificity;
  const estFP = Math.round(HEALTHY_COUNT * (fpr / 100));
  console.log([
    t.name.padEnd(20),
    t.specificity.toFixed(1).padStart(8),
    fpr.toFixed(1).padStart(8),
    estFP.toString().padStart(14),
    (t.ppv !== null ? t.ppv.toFixed(1) + '%' : '—').padStart(8),
    (t.ias !== null ? t.ias.toFixed(1) + '%' : '—').padStart(8),
  ].join('  '));
}

console.log('');
console.log('  Key insight: 97.4% vs 99.5% specificity = ~5x more false positives.');
console.log('  Higher observed sensitivity at lower specificity may reflect a lower');
console.log('  detection threshold rather than superior cancer detection ability.');
console.log('  Cross-test comparisons should always state the specificity alongside sensitivity.');
console.log('');
