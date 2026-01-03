#!/usr/bin/env node
/**
 * OpenOnco Citation Checker
 * 
 * Identifies missing citations in data.js and outputs structured data
 * for filling them via PubMed or web search.
 * 
 * Usage:
 *   node scripts/check_citations.js [--json] [--must-have] [--nice-have]
 */

const path = require('path');

// Load data
const dataPath = path.join(__dirname, '..', 'src', 'data.js');
const { mrdTestData, ecdTestData, trmTestData, tdsTestData } = require(dataPath);

// Citation field definitions
const MUST_HAVE_FIELDS = {
  sensitivity: 'sensitivityCitations',
  specificity: 'specificityCitations',
  ppv: 'ppvCitations',
  npv: 'npvCitations',
  lod: 'lodCitations',
  leadTimeVsImaging: 'leadTimeVsImagingCitations',
  stageISensitivity: 'stageISensitivityCitations',
  stageIISensitivity: 'stageIISensitivityCitations',
  stageIIISensitivity: 'stageIIISensitivityCitations',
  stageIVSensitivity: 'stageIVSensitivityCitations',
  advancedAdenomaSensitivity: 'advancedAdenomaSensitivityCitations'
};

const NICE_HAVE_FIELDS = {
  tat: 'tatCitations',
  initialTat: 'initialTatCitations',
  followUpTat: 'followUpTatCitations',
  genesAnalyzed: 'genesAnalyzedCitations',
  variantsTracked: 'variantsTrackedCitations',
  listPrice: 'listPriceCitations',
  bloodVolume: 'bloodVolumeCitations',
  sampleVolumeMl: 'sampleVolumeMlCitations',
  totalParticipants: 'totalParticipantsCitations',
  validationCohortSize: 'validationCohortSizeCitations'
};

function getAllTests() {
  return [
    ...mrdTestData.map(t => ({ ...t, _category: 'MRD' })),
    ...ecdTestData.map(t => ({ ...t, _category: 'ECD' })),
    ...trmTestData.map(t => ({ ...t, _category: 'TRM' })),
    ...tdsTestData.map(t => ({ ...t, _category: 'TDS' }))
  ];
}

function checkMissingCitations(tests, fieldMap, priority) {
  const missing = [];
  
  tests.forEach(test => {
    Object.entries(fieldMap).forEach(([field, citField]) => {
      const val = test[field];
      const cit = test[citField];
      
      // Check if field has value but no citation
      if (val != null && val !== '' && val !== 'N/A' && val !== 'Not specified') {
        if (!cit || cit.trim() === '') {
          missing.push({
            id: test.id,
            name: test.name,
            vendor: test.vendor,
            category: test._category,
            field: field,
            citationField: citField,
            value: val,
            priority: priority,
            // Generate search suggestions
            pubmedQuery: `${test.name} ${test.vendor} ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`,
            webQuery: `"${test.name}" "${test.vendor}" ${field.replace(/([A-Z])/g, ' $1').toLowerCase()} site:${getVendorDomain(test.vendor)}`
          });
        }
      }
    });
  });
  
  return missing;
}

function getVendorDomain(vendor) {
  const domainMap = {
    'Natera': 'natera.com',
    'Guardant Health': 'guardanthealth.com',
    'Foundation Medicine': 'foundationmedicine.com',
    'GRAIL': 'grail.com',
    'Exact Sciences': 'exactsciences.com',
    'Tempus': 'tempus.com',
    'Caris Life Sciences': 'carislifesciences.com',
    'Personalis': 'personalis.com',
    'NeoGenomics': 'neogenomics.com',
    'Labcorp': 'labcorp.com',
    'Quest Diagnostics': 'questdiagnostics.com',
    'Illumina': 'illumina.com',
    'Roche': 'roche.com',
    'Thermo Fisher Scientific': 'thermofisher.com',
    'QIAGEN': 'qiagen.com',
    'Burning Rock Dx': 'brbiotech.com',
    'Freenome': 'freenome.com',
    'Helio Genomics': 'heliogenomics.com',
    'BillionToOne': 'billiontoone.com',
    'Invivoscribe': 'invivoscribe.com'
  };
  
  // Try to find matching vendor
  for (const [key, domain] of Object.entries(domainMap)) {
    if (vendor.toLowerCase().includes(key.toLowerCase())) {
      return domain;
    }
  }
  
  // Fallback: generate domain from vendor name
  return vendor.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
}

function formatOutput(mustHave, niceHave, jsonOutput) {
  if (jsonOutput) {
    return JSON.stringify({
      summary: {
        mustHave: mustHave.length,
        niceHave: niceHave.length,
        total: mustHave.length + niceHave.length
      },
      mustHave,
      niceHave
    }, null, 2);
  }
  
  let output = [];
  output.push('📋 OpenOnco Citation Check');
  output.push('============================================================');
  output.push('');
  output.push('📊 Summary:');
  output.push(`   🔴 Must-have missing: ${mustHave.length}`);
  output.push(`   🟡 Nice-have missing: ${niceHave.length}`);
  output.push(`   Total: ${mustHave.length + niceHave.length}`);
  output.push('');
  
  if (mustHave.length > 0) {
    output.push('============================================================');
    output.push('🔴 MUST-HAVE CITATIONS (Performance Metrics)');
    output.push('============================================================');
    
    const byTest = groupByTest(mustHave);
    Object.entries(byTest).forEach(([id, data]) => {
      output.push('');
      output.push(`### ${data.name} (${data.vendor}) [${data.category}]`);
      data.fields.forEach(f => {
        output.push(`  - ${f.field}: ${f.value}`);
        output.push(`    PubMed: "${f.pubmedQuery}"`);
        output.push(`    Web: "${f.webQuery}"`);
      });
    });
  }
  
  if (niceHave.length > 0) {
    output.push('');
    output.push('============================================================');
    output.push('🟡 NICE-HAVE CITATIONS (Operational Data)');
    output.push('============================================================');
    
    const byTest = groupByTest(niceHave);
    Object.entries(byTest).forEach(([id, data]) => {
      output.push('');
      output.push(`### ${data.name} (${data.vendor}) [${data.category}]`);
      data.fields.forEach(f => {
        output.push(`  - ${f.field}: ${f.value}`);
      });
    });
  }
  
  return output.join('\n');
}

function groupByTest(items) {
  const byTest = {};
  items.forEach(m => {
    const key = m.id;
    if (!byTest[key]) {
      byTest[key] = { name: m.name, vendor: m.vendor, category: m.category, fields: [] };
    }
    byTest[key].fields.push({
      field: m.field,
      value: m.value,
      pubmedQuery: m.pubmedQuery,
      webQuery: m.webQuery
    });
  });
  return byTest;
}

// Main execution
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const mustHaveOnly = args.includes('--must-have');
const niceHaveOnly = args.includes('--nice-have');

const tests = getAllTests();

let mustHave = [];
let niceHave = [];

if (!niceHaveOnly) {
  mustHave = checkMissingCitations(tests, MUST_HAVE_FIELDS, 'must-have');
}

if (!mustHaveOnly) {
  niceHave = checkMissingCitations(tests, NICE_HAVE_FIELDS, 'nice-have');
}

console.log(formatOutput(mustHave, niceHave, jsonOutput));

// Export for use as module
module.exports = {
  MUST_HAVE_FIELDS,
  NICE_HAVE_FIELDS,
  getAllTests,
  checkMissingCitations,
  getVendorDomain
};
