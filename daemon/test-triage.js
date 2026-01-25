/**
 * Test script for the triage system
 *
 * Usage:
 *   node test-triage.js           # Uses mock responses if no API key
 *   ANTHROPIC_API_KEY=... node test-triage.js  # Uses real API
 */

import { classifyDiscovery, extractDataFromPaper, processDiscoveryFull } from './src/triage/index.js';

// =============================================================================
// TEST DATA - Sample discoveries for testing
// =============================================================================

const testDiscoveries = [
  {
    id: 'test-paper-1',
    type: 'publication',
    source: 'pubmed',
    title: 'Phase III Trial Results: Signatera MRD Detection in Stage III Colorectal Cancer',
    summary: 'A prospective study of 500 patients demonstrated 96.4% sensitivity and 99.1% specificity for ctDNA-based MRD detection using Signatera in stage III CRC. Median lead time was 8.9 months before radiographic recurrence.',
    data: {
      abstract: 'Background: Circulating tumor DNA (ctDNA) analysis enables molecular residual disease detection. Methods: 500 stage III CRC patients were enrolled post-curative surgery. ctDNA was analyzed using Signatera tumor-informed assay at 4-week intervals. Results: MRD detection sensitivity was 96.4% (95% CI: 93.2-98.4%) with specificity of 99.1% (95% CI: 97.8-99.7%). Median lead time to radiographic recurrence was 8.9 months (IQR 5.2-12.4 months). Patients with positive ctDNA had significantly worse recurrence-free survival (HR 12.4, p<0.001). Conclusion: Signatera demonstrates high performance for MRD detection in stage III CRC.',
      pmid: '39999999',
      journal: 'Journal of Clinical Oncology',
      year: '2025'
    }
  },
  {
    id: 'test-vendor-1',
    type: 'vendor_update',
    source: 'vendor',
    title: 'Guardant Health Announces FDA Approval for Guardant Reveal in Colorectal Cancer',
    summary: 'Guardant Health received FDA approval for Guardant Reveal as a companion diagnostic for MRD detection in colorectal cancer patients.',
    data: {
      vendor: 'Guardant Health',
      test: 'Guardant Reveal',
      approval_date: '2025-01-15'
    }
  },
  {
    id: 'test-payer-1',
    type: 'policy_update',
    source: 'payers',
    title: 'Medicare Issues NCD for Multi-Cancer Early Detection Tests',
    summary: 'CMS releases National Coverage Determination expanding coverage for MCED tests including Galleri for adults 50+ with coverage starting March 2025.',
    data: {
      payer: 'CMS/Medicare',
      decision: 'positive',
      tests_covered: ['Galleri'],
      effective_date: '2025-03-01'
    }
  }
];

// =============================================================================
// MOCK RESPONSES - Used when no API key available
// =============================================================================

const mockClassificationResponse = {
  priority: 'high',
  classification: 'validation_study',
  confidence: 'high',
  affectedTests: ['Signatera'],
  testCategory: 'MRD',
  reasoning: 'Phase III trial with new performance data (96.4% sensitivity, 99.1% specificity)'
};

const mockExtractionResponse = {
  testName: 'Signatera',
  testId: 'mrd-1',
  vendor: 'Natera',
  extractedData: {
    sensitivity: '96.4%',
    specificity: '99.1%',
    sampleSize: 500,
    cancerTypes: ['colorectal'],
    leadTime: '8.9 months'
  },
  citation: {
    pmid: '39999999',
    journal: 'Journal of Clinical Oncology',
    year: '2025'
  },
  dataQuality: 'high',
  notes: 'Phase III prospective study'
};

// =============================================================================
// TEST RUNNER
// =============================================================================

async function runTests() {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;

  console.log('='.repeat(60));
  console.log('TRIAGE SYSTEM TEST');
  console.log('='.repeat(60));
  console.log(`API Key: ${hasApiKey ? 'Available ✓' : 'Not set - using mock responses'}`);
  console.log();

  if (!hasApiKey) {
    console.log('Note: Set ANTHROPIC_API_KEY environment variable to test with real API');
    console.log();
    runMockTests();
  } else {
    await runRealTests();
  }
}

// =============================================================================
// MOCK TESTS - No API key required
// =============================================================================

function runMockTests() {
  console.log('--- MOCK TEST RESULTS ---\n');

  console.log('1. Classification Response (mock):');
  console.log(JSON.stringify(mockClassificationResponse, null, 2));
  console.log();

  console.log('2. Extraction Response (mock):');
  console.log(JSON.stringify(mockExtractionResponse, null, 2));
  console.log();

  console.log('3. Test Discoveries Available:');
  testDiscoveries.forEach((d, i) => {
    console.log(`   ${i + 1}. [${d.type}] ${d.title.substring(0, 60)}...`);
  });
  console.log();

  console.log('Mock tests completed. To run real API tests:');
  console.log('  ANTHROPIC_API_KEY=sk-... node test-triage.js');
}

// =============================================================================
// REAL TESTS - Requires API key
// =============================================================================

async function runRealTests() {
  console.log('--- REAL API TESTS ---\n');

  let totalCost = 0;

  // Test 1: Classify the paper discovery
  console.log('Test 1: Classifying publication discovery...');
  try {
    const result1 = await classifyDiscovery(testDiscoveries[0]);
    console.log('Result:');
    console.log(`  Priority: ${result1.priority}`);
    console.log(`  Classification: ${result1.classification}`);
    console.log(`  Confidence: ${result1.confidence}`);
    console.log(`  Affected Tests: ${result1.affectedTests?.join(', ') || 'none'}`);
    console.log(`  Test Category: ${result1.testCategory}`);
    console.log(`  Reasoning: ${result1.reasoning}`);
    if (result1.costs) {
      console.log(`  Cost: $${result1.costs.totalCost}`);
      totalCost += parseFloat(result1.costs.totalCost);
    }
    console.log();
  } catch (err) {
    console.error('  Error:', err.message);
    console.log();
  }

  // Test 2: Extract data from paper
  console.log('Test 2: Extracting data from paper...');
  try {
    const result2 = await extractDataFromPaper(testDiscoveries[0]);
    console.log('Result:');
    console.log(`  Test Name: ${result2.testName}`);
    console.log(`  Test ID: ${result2.testId}`);
    console.log(`  Vendor: ${result2.vendor}`);
    console.log(`  Data Quality: ${result2.dataQuality}`);
    console.log(`  Extracted Metrics:`, JSON.stringify(result2.extractedData, null, 4));
    console.log(`  Citation:`, JSON.stringify(result2.citation, null, 4));
    if (result2.costs) {
      console.log(`  Cost: $${result2.costs.totalCost}`);
      totalCost += parseFloat(result2.costs.totalCost);
    }
    console.log();
  } catch (err) {
    console.error('  Error:', err.message);
    console.log();
  }

  // Test 3: Classify vendor update
  console.log('Test 3: Classifying vendor update (FDA approval)...');
  try {
    const result3 = await classifyDiscovery(testDiscoveries[1]);
    console.log('Result:');
    console.log(`  Priority: ${result3.priority}`);
    console.log(`  Classification: ${result3.classification}`);
    console.log(`  Confidence: ${result3.confidence}`);
    console.log(`  Affected Tests: ${result3.affectedTests?.join(', ') || 'none'}`);
    console.log(`  Reasoning: ${result3.reasoning}`);
    if (result3.costs) {
      console.log(`  Cost: $${result3.costs.totalCost}`);
      totalCost += parseFloat(result3.costs.totalCost);
    }
    console.log();
  } catch (err) {
    console.error('  Error:', err.message);
    console.log();
  }

  // Summary
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total API cost: $${totalCost.toFixed(4)}`);
  console.log('Tests completed.');
}

// Run
runTests().catch(console.error);
