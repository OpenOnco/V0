// Find incomplete tests based on MINIMUM_PARAMS
const fs = require('fs');
const path = require('path');

// Read data.js file
const dataPath = path.join(__dirname, '..', 'src', 'data.js');
const dataContent = fs.readFileSync(dataPath, 'utf8');

// Extract tests by category
const extractArray = (content, arrayName) => {
  // Match patterns like: export const mrdTestData = [ ... ];
  const regex = new RegExp(`export const ${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`, 'm');
  const match = content.match(regex);
  if (!match) return null;
  try {
    return eval('[' + match[1] + '\n]');
  } catch (e) {
    console.error(`Error parsing ${arrayName}:`, e.message);
    return null;
  }
};

const mrdTests = extractArray(dataContent, 'mrdTestData') || [];
const ecdTests = extractArray(dataContent, 'ecdTestData') || [];
const trmTests = extractArray(dataContent, 'trmTestData') || [];
const tdsTests = extractArray(dataContent, 'tdsTestData') || [];

const allTests = [
  ...mrdTests.map(t => ({ ...t, category: 'MRD' })),
  ...ecdTests.map(t => ({ ...t, category: 'ECD' })),
  ...trmTests.map(t => ({ ...t, category: 'TRM' })),
  ...tdsTests.map(t => ({ ...t, category: 'TDS' })),
];

const MINIMUM_PARAMS = {
  MRD: {
    core: [
      { key: 'sensitivity', label: 'Sensitivity' },
      { key: 'specificity', label: 'Specificity' },
      { key: 'lod', label: 'Limit of Detection' },
      { key: 'numPublications', label: 'Publications' },
      { key: 'totalParticipants', label: 'Study Participants' },
      { key: 'initialTat', label: 'Initial TAT' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Medicare Coverage' },
    ]
  },
  ECD: {
    core: [
      { key: 'sensitivity', label: 'Sensitivity' },
      { key: 'specificity', label: 'Specificity' },
      { key: 'ppv', label: 'PPV' },
      { key: 'npv', label: 'NPV' },
      { key: 'numPublications', label: 'Publications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'listPrice', label: 'List Price' },
    ]
  },
  TRM: {
    core: [
      { key: 'numPublications', label: 'Publications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'fdaStatus', label: 'FDA Status' },
    ]
  },
  TDS: {
    core: [
      { key: 'numPublications', label: 'Publications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'fdaStatus', label: 'FDA Status' },
    ]
  },
};

const hasValue = (val) => val != null && String(val).trim() !== '' && val !== 'N/A' && val !== 'Not disclosed';

const incompleteTests = [];
allTests.forEach(test => {
  if (test.isDiscontinued || test.isRUO) return; // Skip these
  
  const minParams = MINIMUM_PARAMS[test.category];
  if (!minParams) return;
  
  const missing = minParams.core.filter(p => !hasValue(test[p.key])).map(p => ({ key: p.key, label: p.label, current: test[p.key] }));
  if (missing.length > 0) {
    incompleteTests.push({
      id: test.id,
      name: test.name,
      vendor: test.vendor,
      category: test.category,
      missing
    });
  }
});

console.log(`\nINCOMPLETE TESTS (${incompleteTests.length}):`);
console.log('====================================\n');

// Group by category
const byCategory = {};
incompleteTests.forEach(t => {
  if (!byCategory[t.category]) byCategory[t.category] = [];
  byCategory[t.category].push(t);
});

Object.keys(byCategory).sort().forEach(cat => {
  console.log(`\n${cat} (${byCategory[cat].length} incomplete):`);
  console.log('-'.repeat(40));
  byCategory[cat].forEach(t => {
    console.log(`\n  ${t.name} (${t.vendor})`);
    console.log(`  ID: ${t.id}`);
    t.missing.forEach(m => {
      console.log(`    ❌ ${m.label} (${m.key}): ${m.current === undefined ? 'undefined' : JSON.stringify(m.current)}`);
    });
  });
});
