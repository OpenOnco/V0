/**
 * Test script for Monday digest email generation
 * Generates mock triaged discoveries and outputs the HTML to a file for preview
 *
 * Run with: node test-monday-digest.js
 */

import { generateMondayDigestHtml, generateMondayDigestSubject } from './src/email/templates.js';
import fs from 'fs';
import path from 'path';

// =============================================================================
// MOCK DATA
// =============================================================================

// Mock triaged discoveries with different priority levels
const mockTriageResults = {
  highPriority: [
    {
      title: 'Update Signatera sensitivity for CRC',
      action: 'Update sensitivity field for mrd-1',
      testId: 'mrd-1',
      testName: 'Signatera',
      field: 'sensitivity',
      newValue: '93.2%',
      oldValue: '91.0%',
      source: 'PMID 39182745',
      pmid: '39182745',
      year: '2024',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/39182745/',
      evidence: 'In a cohort of 485 CRC patients, Signatera demonstrated 93.2% sensitivity (95% CI: 90.1-95.6%) for detecting molecular residual disease.',
      confidence: 'high',
    },
    {
      title: 'Add new FDA clearance for Guardant360 CDx',
      action: 'Add FDA clearance date for companion diagnostic',
      testId: 'tds-3',
      testName: 'Guardant360 CDx',
      field: 'fdaClearances',
      newValue: 'FDA PMA P240015 approved January 2025',
      source: 'FDA 510(k) Database',
      sourceUrl: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id=P240015',
      evidence: 'FDA granted PMA approval for expanded companion diagnostic indication for NSCLC.',
      confidence: 'high',
    },
    {
      title: 'Fix broken citation URL for FoundationOne CDx',
      action: 'Replace broken DOI link',
      testId: 'tds-1',
      testName: 'FoundationOne CDx',
      field: 'citationUrl_sensitivity',
      oldValue: 'https://doi.org/10.1016/j.annonc.2020.broken',
      newValue: 'https://doi.org/10.1016/j.annonc.2022.04.084',
      source: 'Citation Validator',
      sourceUrl: 'https://doi.org/10.1016/j.annonc.2022.04.084',
      confidence: 'high',
      notes: 'Old DOI returned 404, found corrected publication',
    },
  ],

  mediumPriority: [
    {
      title: 'New clinical validation study for Galleri',
      testId: 'ecd-1',
      source: 'PubMed',
      sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/39187654/',
    },
    {
      title: 'UnitedHealthcare updates MRD testing policy',
      testId: null,
      source: 'Payer Policy',
      sourceUrl: 'https://www.uhcprovider.com/policies/mrd-2025',
    },
    {
      title: 'AACR abstract mentions Tempus xF performance data',
      testId: 'tds-8',
      source: 'Preprint',
      sourceUrl: 'https://www.medrxiv.org/content/10.1101/2025.01.15.12345',
    },
    {
      title: 'CMS revises LCD for liquid biopsy',
      testId: null,
      source: 'CMS/Medicare',
      sourceUrl: 'https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=39876',
    },
  ],

  lowPriority: [
    { title: 'Minor vendor website update for Natera', source: 'Vendor' },
    { title: 'Conference poster mentions Signatera', source: 'PubMed' },
    { title: 'Caris updates test requisition form', source: 'Vendor' },
    { title: 'Aetna policy renews without changes', source: 'Payer' },
    { title: 'Preprint on ctDNA fragmentation patterns', source: 'Preprint' },
    { title: 'Quest Diagnostics blog post', source: 'Vendor' },
    { title: 'Editorial on liquid biopsy landscape', source: 'PubMed' },
  ],

  ignored: {
    'off_topic_publications': 15,
    'duplicate_entries': 8,
    'superseded_policies': 3,
    'non_US_coverage': 12,
    'promotional_content': 6,
  },

  findings: {
    totalProcessed: 127,
    relevantToDatabase: 24,
  },
};

// Mock database stats
const mockDbStats = {
  totalTests: 156,
  categoryCount: 5,
  citationCompleteness: 78,
  citedFields: 892,
  totalFields: 1143,
  brokenUrls: 4,
  lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
  updatesThisWeek: 12,
  byCategory: {
    'MRD (Molecular Residual Disease)': 32,
    'TDS (Treatment Decision Support)': 48,
    'ECD (Early Cancer Detection)': 24,
    'HCT (Hereditary Cancer Testing)': 38,
    'TRM (Treatment Response Monitoring)': 14,
  },
};

// Mock crawler health
const mockCrawlerHealth = {
  crawlers: [
    { source: 'pubmed', status: 'success', lastSuccess: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), errorsThisWeek: 0 },
    { source: 'cms', status: 'success', lastSuccess: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), errorsThisWeek: 0 },
    { source: 'fda', status: 'success', lastSuccess: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), errorsThisWeek: 1 },
    { source: 'vendor', status: 'error', lastSuccess: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), errorsThisWeek: 3 },
    { source: 'preprints', status: 'success', lastSuccess: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), errorsThisWeek: 0 },
    { source: 'citations', status: 'success', lastSuccess: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), errorsThisWeek: 0 },
    { source: 'payers', status: 'success', lastSuccess: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), errorsThisWeek: 2 },
    { source: 'triage', status: 'success', lastSuccess: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), errorsThisWeek: 0 },
  ],
  recentErrors: [
    { source: 'vendor', message: 'Natera website returned 503 - temporarily unavailable', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString() },
    { source: 'vendor', message: 'Guardant Health page structure changed - selector not found', timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() },
    { source: 'payers', message: 'Cigna policy page timeout after 30s', timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
  ],
};

// =============================================================================
// GENERATE AND SAVE
// =============================================================================

console.log('Generating Monday digest email...\n');

// Generate the HTML
const html = generateMondayDigestHtml(mockTriageResults, mockDbStats, mockCrawlerHealth);

// Generate subject line
const subject = generateMondayDigestSubject(mockTriageResults, mockDbStats);

// Create output directory if it doesn't exist
const outputDir = path.join(process.cwd(), 'test-output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write the HTML to a file
const outputPath = path.join(outputDir, 'monday-digest.html');
fs.writeFileSync(outputPath, html);

console.log('Subject:', subject);
console.log('\nHTML written to:', outputPath);
console.log('\nOpen in browser to preview:');
console.log(`  open "${outputPath}"`);

// Also log some stats
console.log('\n--- Mock Data Summary ---');
console.log(`High Priority Actions: ${mockTriageResults.highPriority.length}`);
console.log(`Medium Priority Items: ${mockTriageResults.mediumPriority.length}`);
console.log(`Low Priority Items: ${mockTriageResults.lowPriority.length}`);
console.log(`Total Ignored: ${Object.values(mockTriageResults.ignored).reduce((a, b) => a + b, 0)}`);
console.log(`Database Tests: ${mockDbStats.totalTests}`);
console.log(`Citation Coverage: ${mockDbStats.citationCompleteness}%`);
console.log(`Broken URLs: ${mockDbStats.brokenUrls}`);
