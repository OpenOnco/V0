#!/usr/bin/env node
/**
 * OpenOnco Data Quality Audit Script
 * Analyzes data.js for quality issues, missing citations, and data staleness.
 *
 * Usage:
 *     node scripts/audit.js [path/to/data.js]
 *     
 * If no path provided, uses default: /Users/adickinson/Documents/GitHub/V0/src/data.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Default path
const DEFAULT_DATA_PATH = '/Users/adickinson/Documents/GitHub/V0/src/data.js';

// Fields that should have citations when populated
const CITATION_REQUIRED_FIELDS = {
  sensitivity: 'sensitivityCitations',
  specificity: 'specificityCitations',
  ppv: 'ppvCitations',
  npv: 'npvCitations',
  lod: 'lodCitations',
  leadTimeDays: 'leadTimeDaysCitations',
};

// Required fields by category
const REQUIRED_FIELDS = {
  mrd: ['id', 'name', 'vendor', 'sampleCategory'],
  ecd: ['id', 'name', 'vendor', 'sampleCategory'],
  trm: ['id', 'name', 'vendor', 'sampleCategory'],
  tds: ['id', 'name', 'vendor', 'sampleCategory'],
};

// Important fields that should be populated
const IMPORTANT_FIELDS = {
  mrd: ['sensitivity', 'specificity', 'lod', 'fdaStatus', 'numPublications'],
  ecd: ['sensitivity', 'specificity', 'fdaStatus', 'numPublications'],
  trm: ['sensitivity', 'specificity', 'fdaStatus', 'numPublications'],
  tds: ['genesAnalyzed', 'fdaStatus', 'numPublications'],
};

class AuditFinding {
  constructor(severity, category, testId, testName, vendor, message, field = null) {
    this.severity = severity;  // critical, high, medium, low
    this.category = category;  // mrd, ecd, trm, tds
    this.testId = testId;
    this.testName = testName;
    this.vendor = vendor;
    this.message = message;
    this.field = field;
  }
  
  toString() {
    return `[${this.category.toUpperCase()}] ${this.testName} (${this.vendor}): ${this.message}`;
  }
}

function extractTestData(content) {
  // Create a sandbox to safely eval the JS
  const sandbox = {
    exports: {},
    mrdTestData: [],
    ecdTestData: [],
    trmTestData: [],
    tdsTestData: [],
  };
  
  // Replace export const with variable assignments
  let modifiedContent = content
    .replace(/export\s+const\s+(\w+)\s*=/g, '$1 =');
  
  try {
    vm.runInNewContext(modifiedContent, sandbox);
  } catch (e) {
    console.error('Error parsing data.js:', e.message);
    // Try extracting arrays manually
    return extractTestDataFallback(content);
  }
  
  return {
    mrd: sandbox.mrdTestData || [],
    ecd: sandbox.ecdTestData || [],
    trm: sandbox.trmTestData || [],
    tds: sandbox.tdsTestData || [],
  };
}

function extractTestDataFallback(content) {
  const tests = {
    mrd: [],
    ecd: [],
    trm: [],
    tds: []
  };
  
  // Find array start positions
  const patterns = {
    mrd: /export\s+const\s+mrdTestData\s*=\s*\[/,
    ecd: /export\s+const\s+ecdTestData\s*=\s*\[/,
    trm: /export\s+const\s+trmTestData\s*=\s*\[/,
    tds: /export\s+const\s+tdsTestData\s*=\s*\[/,
  };
  
  for (const [category, pattern] of Object.entries(patterns)) {
    const match = pattern.exec(content);
    if (match) {
      const startIdx = match.index + match[0].length;
      // Find matching close bracket
      let depth = 1;
      let idx = startIdx;
      while (depth > 0 && idx < content.length) {
        if (content[idx] === '[') depth++;
        if (content[idx] === ']') depth--;
        idx++;
      }
      
      const arrayContent = '[' + content.substring(startIdx, idx - 1) + ']';
      
      try {
        // Remove JS comments
        const cleaned = arrayContent
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');
        
        tests[category] = JSON.parse(cleaned);
      } catch (e) {
        console.error(`Warning: Could not parse ${category}TestData:`, e.message);
        tests[category] = extractObjectsFallback(arrayContent, category);
      }
    }
  }
  
  return tests;
}

function extractObjectsFallback(arrayContent, category) {
  const objects = [];
  // Match individual test objects by their id field
  const regex = new RegExp(`\\{[^{}]*"id"\\s*:\\s*"${category}-[^"]+"`,'g');
  
  let depth = 0;
  let start = -1;
  
  for (let i = 0; i < arrayContent.length; i++) {
    if (arrayContent[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (arrayContent[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const objStr = arrayContent.substring(start, i + 1);
        try {
          const cleaned = objStr
            .replace(/\/\/.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/,(\s*[}\]])/g, '$1');
          const obj = JSON.parse(cleaned);
          if (obj.id && obj.id.startsWith(category + '-')) {
            objects.push(obj);
          }
        } catch (e) {
          // Skip malformed objects
        }
        start = -1;
      }
    }
  }
  
  return objects;
}

function checkMissingCitations(test, category) {
  const findings = [];
  
  for (const [metricField, citationField] of Object.entries(CITATION_REQUIRED_FIELDS)) {
    const value = test[metricField];
    const citation = test[citationField] || '';
    
    // If the metric has a value but no citation
    if (value !== null && value !== undefined && value !== '' && value !== 'N/A') {
      if (!citation || citation.trim() === '') {
        let severity = 'high';
        if (typeof value === 'number') {
          if (value === 100 || value === 0) {
            severity = 'critical';  // Perfect scores need citations
          }
        }
        
        findings.push(new AuditFinding(
          severity,
          category,
          test.id || 'unknown',
          test.name || 'Unknown Test',
          test.vendor || 'Unknown',
          `Missing citation for ${metricField} (${value})`,
          metricField
        ));
      }
    }
  }
  
  return findings;
}

function checkPerfectScores(test, category) {
  const findings = [];
  
  for (const field of ['sensitivity', 'specificity']) {
    const value = test[field];
    if (value === 100) {
      const cohort = test.validationCohortSize || test.totalParticipants;
      const hasWarning = test.smallSampleWarning || test.analyticalValidationWarning;
      
      if (!hasWarning) {
        if (cohort && cohort < 200) {
          findings.push(new AuditFinding(
            'critical',
            category,
            test.id || 'unknown',
            test.name || 'Unknown Test',
            test.vendor || 'Unknown',
            `100% ${field} with small cohort (n=${cohort}) - needs smallSampleWarning flag`,
            field
          ));
        } else {
          findings.push(new AuditFinding(
            'high',
            category,
            test.id || 'unknown',
            test.name || 'Unknown Test',
            test.vendor || 'Unknown',
            `100% ${field} - verify this is accurate and consider adding warning flag`,
            field
          ));
        }
      }
    }
  }
  
  return findings;
}

function checkRequiredFields(test, category) {
  const findings = [];
  const required = REQUIRED_FIELDS[category] || [];
  
  for (const field of required) {
    const value = test[field];
    if (value === null || value === undefined || value === '') {
      findings.push(new AuditFinding(
        'critical',
        category,
        test.id || 'unknown',
        test.name || 'Unknown Test',
        test.vendor || 'Unknown',
        `Missing required field: ${field}`,
        field
      ));
    }
  }
  
  return findings;
}

function checkImportantFields(test, category) {
  const findings = [];
  const important = IMPORTANT_FIELDS[category] || [];
  
  for (const field of important) {
    const value = test[field];
    if (value === null || value === undefined || value === '') {
      findings.push(new AuditFinding(
        'medium',
        category,
        test.id || 'unknown',
        test.name || 'Unknown Test',
        test.vendor || 'Unknown',
        `Missing important field: ${field}`,
        field
      ));
    }
  }
  
  return findings;
}

function checkVendorVerification(test, category) {
  const findings = [];
  
  const verified = test.vendorVerified;
  
  if (!verified) {
    const vendorChanges = test.vendorRequestedChanges || '';
    if (vendorChanges && vendorChanges.length > 20) {
      findings.push(new AuditFinding(
        'low',
        category,
        test.id || 'unknown',
        test.name || 'Unknown Test',
        test.vendor || 'Unknown',
        'Test has vendor interaction but not marked as verified',
        'vendorVerified'
      ));
    }
  }
  
  return findings;
}

function checkInvalidValues(test, category) {
  const findings = [];
  
  // Sensitivity and specificity should be 0-100
  for (const field of ['sensitivity', 'specificity', 'ppv', 'npv']) {
    const value = test[field];
    if (value !== null && value !== undefined) {
      if (typeof value === 'number') {
        if (value < 0 || value > 100) {
          findings.push(new AuditFinding(
            'critical',
            category,
            test.id || 'unknown',
            test.name || 'Unknown Test',
            test.vendor || 'Unknown',
            `Invalid ${field} value: ${value} (should be 0-100)`,
            field
          ));
        }
      }
    }
  }
  
  // Check for empty arrays that should have content
  if (['mrd', 'ecd', 'trm'].includes(category)) {
    const cancerTypes = test.cancerTypes || [];
    if (!cancerTypes || cancerTypes.length === 0) {
      findings.push(new AuditFinding(
        'medium',
        category,
        test.id || 'unknown',
        test.name || 'Unknown Test',
        test.vendor || 'Unknown',
        'Empty cancerTypes array',
        'cancerTypes'
      ));
    }
  }
  
  return findings;
}

function checkNotesQuality(test, category) {
  const findings = [];
  
  const lowValuePatterns = [
    /^[\d.]+%?\s*(per|from|via)?\s*vendor\s*$/i,
    /^Per vendor\s*$/i,
    /^Vendor (data|reported|claims?)\.?\s*$/i,
    /^N\/A\.?\s*$/i,
    /^-+\s*$/,
  ];
  
  for (const field of ['sensitivityNotes', 'specificityNotes', 'lodNotes']) {
    const notes = test[field] || '';
    if (notes) {
      for (const pattern of lowValuePatterns) {
        if (pattern.test(notes)) {
          findings.push(new AuditFinding(
            'low',
            category,
            test.id || 'unknown',
            test.name || 'Unknown Test',
            test.vendor || 'Unknown',
            `${field} doesn't add value: '${notes}'`,
            field
          ));
          break;
        }
      }
    }
  }
  
  return findings;
}

function checkUrlPatterns(test, category) {
  const findings = [];
  
  const urlFields = [
    'sensitivityCitations', 'specificityCitations', 'lodCitations',
    'ppvCitations', 'npvCitations', 'numPublicationsCitations',
    'methodCitations', 'clinicalTrialsCitations'
  ];
  
  const suspiciousPatterns = [
    /example\.com/i,
    /localhost/i,
    /file:\/\//i,
    /^\s*https?:\/\/\s*$/i,  // Just "http://" with no domain
  ];
  
  for (const field of urlFields) {
    const url = test[field] || '';
    if (url) {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(url)) {
          findings.push(new AuditFinding(
            'high',
            category,
            test.id || 'unknown',
            test.name || 'Unknown Test',
            test.vendor || 'Unknown',
            `Suspicious URL in ${field}: '${url.substring(0, 50)}...'`,
            field
          ));
          break;
        }
      }
    }
  }
  
  return findings;
}

function checkDuplicateIds(testsByCategory) {
  const findings = [];
  const allIds = {};
  
  for (const [category, tests] of Object.entries(testsByCategory)) {
    for (const test of tests) {
      const testId = test.id || '';
      if (testId) {
        if (allIds[testId]) {
          findings.push(new AuditFinding(
            'critical',
            category,
            testId,
            test.name || 'Unknown Test',
            test.vendor || 'Unknown',
            `Duplicate ID: ${testId} (also in ${allIds[testId]})`,
            'id'
          ));
        } else {
          allIds[testId] = category;
        }
      }
    }
  }
  
  return findings;
}

function runAudit(dataPath) {
  console.log(`📊 OpenOnco Data Audit`);
  console.log(`📁 Source: ${dataPath}`);
  console.log(`📅 Date: ${new Date().toISOString().substring(0, 16).replace('T', ' ')}`);
  console.log('='.repeat(60));
  
  // Read the data file
  let content;
  try {
    content = fs.readFileSync(dataPath, 'utf-8');
  } catch (e) {
    console.error(`❌ Error: File not found: ${dataPath}`);
    process.exit(1);
  }
  
  // Extract test arrays
  const testsByCategory = extractTestData(content);
  
  // Count tests
  const totalTests = Object.values(testsByCategory).reduce((sum, tests) => sum + tests.length, 0);
  console.log(`\n📈 Found ${totalTests} tests across ${Object.keys(testsByCategory).length} categories`);
  for (const [cat, tests] of Object.entries(testsByCategory)) {
    console.log(`   ${cat.toUpperCase()}: ${tests.length} tests`);
  }
  
  // Run all checks
  const allFindings = [];
  
  // Check for duplicate IDs first
  allFindings.push(...checkDuplicateIds(testsByCategory));
  
  for (const [category, tests] of Object.entries(testsByCategory)) {
    for (const test of tests) {
      allFindings.push(...checkRequiredFields(test, category));
      allFindings.push(...checkMissingCitations(test, category));
      allFindings.push(...checkPerfectScores(test, category));
      allFindings.push(...checkImportantFields(test, category));
      allFindings.push(...checkInvalidValues(test, category));
      allFindings.push(...checkVendorVerification(test, category));
      allFindings.push(...checkNotesQuality(test, category));
      allFindings.push(...checkUrlPatterns(test, category));
    }
  }
  
  // Group findings by severity
  const bySeverity = {};
  for (const finding of allFindings) {
    if (!bySeverity[finding.severity]) {
      bySeverity[finding.severity] = [];
    }
    bySeverity[finding.severity].push(finding);
  }
  
  // Print results
  const severityOrder = ['critical', 'high', 'medium', 'low'];
  const severityEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵'
  };
  
  console.log('\n' + '='.repeat(60));
  console.log('AUDIT FINDINGS');
  console.log('='.repeat(60));
  
  for (const severity of severityOrder) {
    const findings = bySeverity[severity] || [];
    if (findings.length > 0) {
      console.log(`\n${severityEmoji[severity]} ${severity.toUpperCase()} (${findings.length})`);
      console.log('-'.repeat(40));
      
      // Group by test for readability
      const byTest = {};
      for (const f of findings) {
        const key = `${f.testId} - ${f.testName}`;
        if (!byTest[key]) {
          byTest[key] = [];
        }
        byTest[key].push(f);
      }
      
      for (const [testKey, testFindings] of Object.entries(byTest)) {
        console.log(`\n  [${testFindings[0].category.toUpperCase()}] ${testKey}`);
        console.log(`      Vendor: ${testFindings[0].vendor}`);
        for (const tf of testFindings) {
          console.log(`      • ${tf.message}`);
        }
      }
    }
  }
  
  // Summary statistics
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  // Count vendor verified
  let verifiedCount = 0;
  let totalCitations = 0;
  let testsWithCitations = 0;
  
  for (const [category, tests] of Object.entries(testsByCategory)) {
    for (const test of tests) {
      if (test.vendorVerified) {
        verifiedCount++;
      }
      // Count citation fields
      let citationCount = 0;
      for (const cf of Object.values(CITATION_REQUIRED_FIELDS)) {
        if (test[cf]) {
          citationCount++;
        }
      }
      if (citationCount > 0) {
        testsWithCitations++;
        totalCitations += citationCount;
      }
    }
  }
  
  console.log(`\n  Total tests: ${totalTests}`);
  console.log(`  Vendor verified: ${verifiedCount} (${totalTests > 0 ? (100 * verifiedCount / totalTests).toFixed(1) : 0}%)`);
  console.log(`  Tests with citations: ${testsWithCitations} (${totalTests > 0 ? (100 * testsWithCitations / totalTests).toFixed(1) : 0}%)`);
  console.log(`  Average citations per test: ${totalTests > 0 ? (totalCitations / totalTests).toFixed(1) : 0}`);
  
  console.log('\n  Issues found:');
  for (const severity of severityOrder) {
    const count = (bySeverity[severity] || []).length;
    console.log(`    ${severityEmoji[severity]} ${severity.charAt(0).toUpperCase() + severity.slice(1)}: ${count}`);
  }
  
  const testsNeedingAttention = new Set(allFindings.map(f => f.testId)).size;
  console.log(`\n  Tests needing attention: ${testsNeedingAttention}`);
  
  return { findings: allFindings, tests: testsByCategory };
}

// Main execution
const dataPath = process.argv[2] || DEFAULT_DATA_PATH;
const { findings } = runAudit(dataPath);

// Exit with error code if critical issues found
const criticalCount = findings.filter(f => f.severity === 'critical').length;
if (criticalCount > 0) {
  console.log(`\n⚠️  ${criticalCount} critical issues require immediate attention!`);
  process.exit(1);
}
