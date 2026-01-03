#!/usr/bin/env node
/**
 * OpenOnco Citation Filler
 * 
 * Generates citation search commands for Claude to execute using
 * PubMed MCP and web_search tools.
 * 
 * Usage:
 *   node scripts/fill_citations.js [--test-id <id>] [--field <field>] [--batch <n>]
 * 
 * Output: Structured commands for Claude to execute
 */

const path = require('path');
const { MUST_HAVE_FIELDS, NICE_HAVE_FIELDS, getAllTests, getVendorDomain } = require('./check_citations.cjs');

// Combine all citation fields
const ALL_FIELDS = { ...MUST_HAVE_FIELDS, ...NICE_HAVE_FIELDS };

function generateSearchPlan(test, field, value) {
  const vendorDomain = getVendorDomain(test.vendor);
  
  // Clean test name for search (remove parentheticals, RUO markers, etc.)
  const cleanName = test.name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Field-specific search strategies
  const fieldStrategies = {
    sensitivity: {
      pubmedTerms: ['sensitivity', 'detection rate', 'clinical sensitivity'],
      webTerms: ['sensitivity', 'detection', 'performance']
    },
    specificity: {
      pubmedTerms: ['specificity', 'false positive', 'clinical specificity'],
      webTerms: ['specificity', 'false positive rate', 'performance']
    },
    ppv: {
      pubmedTerms: ['positive predictive value', 'PPV'],
      webTerms: ['PPV', 'positive predictive value']
    },
    npv: {
      pubmedTerms: ['negative predictive value', 'NPV'],
      webTerms: ['NPV', 'negative predictive value']
    },
    lod: {
      pubmedTerms: ['limit of detection', 'LOD', 'analytical sensitivity'],
      webTerms: ['limit of detection', 'LOD', 'sensitivity']
    },
    tat: {
      pubmedTerms: [],  // TAT rarely in PubMed
      webTerms: ['turnaround time', 'TAT', 'results', 'days']
    },
    genesAnalyzed: {
      pubmedTerms: ['gene panel', 'genes', 'coverage'],
      webTerms: ['gene panel', 'genes covered', 'panel size']
    },
    leadTimeVsImaging: {
      pubmedTerms: ['lead time', 'earlier detection', 'imaging'],
      webTerms: ['lead time', 'earlier', 'months before']
    }
  };
  
  const strategy = fieldStrategies[field] || { pubmedTerms: [field], webTerms: [field] };
  
  return {
    test: {
      id: test.id,
      name: test.name,
      vendor: test.vendor,
      category: test._category
    },
    field: field,
    citationField: ALL_FIELDS[field],
    currentValue: value,
    searches: {
      // PubMed searches (priority 1)
      pubmed: strategy.pubmedTerms.length > 0 ? [
        {
          tool: 'PubMed:search_articles',
          query: `${cleanName} ${test.vendor}`,
          purpose: 'Find any publications about this test'
        },
        {
          tool: 'PubMed:search_articles', 
          query: `${cleanName} ${strategy.pubmedTerms[0]}`,
          purpose: `Find publications mentioning ${field}`
        }
      ] : [],
      
      // Web searches (priority 2)
      web: [
        {
          tool: 'web_search',
          query: `"${cleanName}" ${test.vendor} ${strategy.webTerms[0]} site:${vendorDomain}`,
          purpose: 'Search vendor website'
        },
        {
          tool: 'web_search',
          query: `"${cleanName}" ${strategy.webTerms[0]} ${value}`,
          purpose: 'Find source mentioning the specific value'
        }
      ],
      
      // FDA/regulatory (for certain fields)
      regulatory: field === 'sensitivity' || field === 'specificity' ? [
        {
          tool: 'web_search',
          query: `"${cleanName}" FDA approval ${field}`,
          purpose: 'Check FDA submission data'
        }
      ] : []
    },
    
    // Template for updating data.js once citation is found
    updateTemplate: {
      field: ALL_FIELDS[field],
      format: 'URL | Description',
      example: `https://pubmed.ncbi.nlm.nih.gov/XXXXXXXX/ | Author et al. Journal Year`
    }
  };
}

function findMissingCitations(tests, testId = null, fieldFilter = null) {
  const missing = [];
  
  tests.forEach(test => {
    // Filter by test ID if specified
    if (testId && test.id !== testId) return;
    
    Object.entries(ALL_FIELDS).forEach(([field, citField]) => {
      // Filter by field if specified
      if (fieldFilter && field !== fieldFilter) return;
      
      const val = test[field];
      const cit = test[citField];
      
      if (val != null && val !== '' && val !== 'N/A' && val !== 'Not specified') {
        if (!cit || cit.trim() === '') {
          const priority = MUST_HAVE_FIELDS[field] ? 'must-have' : 'nice-have';
          missing.push({
            ...generateSearchPlan(test, field, val),
            priority
          });
        }
      }
    });
  });
  
  return missing;
}

function formatAsClaudeCommands(searchPlans, batchSize = 5) {
  let output = [];
  
  output.push('# Citation Fill Plan');
  output.push('');
  output.push(`Found ${searchPlans.length} missing citations to fill.`);
  output.push('');
  
  // Group by priority
  const mustHave = searchPlans.filter(p => p.priority === 'must-have');
  const niceHave = searchPlans.filter(p => p.priority === 'nice-have');
  
  output.push(`## Priority Breakdown`);
  output.push(`- 🔴 Must-have: ${mustHave.length}`);
  output.push(`- 🟡 Nice-have: ${niceHave.length}`);
  output.push('');
  
  // Process must-have first, limited to batch size
  const toProcess = [...mustHave, ...niceHave].slice(0, batchSize);
  
  output.push(`## Processing ${toProcess.length} citations`);
  output.push('');
  
  toProcess.forEach((plan, i) => {
    output.push(`### ${i + 1}. ${plan.test.name} - ${plan.field}`);
    output.push(`**Test ID:** ${plan.test.id}`);
    output.push(`**Current Value:** ${plan.currentValue}`);
    output.push(`**Citation Field:** ${plan.citationField}`);
    output.push(`**Priority:** ${plan.priority}`);
    output.push('');
    
    output.push('**Search Strategy:**');
    output.push('');
    
    if (plan.searches.pubmed.length > 0) {
      output.push('1. **PubMed First** (peer-reviewed)');
      plan.searches.pubmed.forEach(s => {
        output.push(`   - Query: \`${s.query}\``);
        output.push(`   - Purpose: ${s.purpose}`);
      });
      output.push('');
    }
    
    output.push('2. **Web Search** (vendor/regulatory)');
    plan.searches.web.forEach(s => {
      output.push(`   - Query: \`${s.query}\``);
      output.push(`   - Purpose: ${s.purpose}`);
    });
    output.push('');
    
    if (plan.searches.regulatory.length > 0) {
      output.push('3. **Regulatory** (FDA)');
      plan.searches.regulatory.forEach(s => {
        output.push(`   - Query: \`${s.query}\``);
      });
      output.push('');
    }
    
    output.push('**Update Format:**');
    output.push('```javascript');
    output.push(`"${plan.citationField}": "${plan.updateTemplate.example}",`);
    output.push('```');
    output.push('');
    output.push('---');
    output.push('');
  });
  
  return output.join('\n');
}

function formatAsJSON(searchPlans) {
  return JSON.stringify(searchPlans, null, 2);
}

// Main execution
const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const testIdIdx = args.indexOf('--test-id');
const testId = testIdIdx !== -1 ? args[testIdIdx + 1] : null;
const fieldIdx = args.indexOf('--field');
const fieldFilter = fieldIdx !== -1 ? args[fieldIdx + 1] : null;
const batchIdx = args.indexOf('--batch');
const batchSize = batchIdx !== -1 ? parseInt(args[batchIdx + 1]) : 10;

const tests = getAllTests();
const searchPlans = findMissingCitations(tests, testId, fieldFilter);

if (jsonOutput) {
  console.log(formatAsJSON(searchPlans));
} else {
  console.log(formatAsClaudeCommands(searchPlans, batchSize));
}

module.exports = {
  generateSearchPlan,
  findMissingCitations,
  formatAsClaudeCommands
};
