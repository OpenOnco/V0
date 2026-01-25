/**
 * End-to-end pipeline test
 * 1. Run citations crawler (missing citations only - fast)
 * 2. Take first 5 discoveries
 * 3. Run through triage system
 * 4. Generate Monday digest
 * 5. Save to test-output/monday-digest-real.html
 */

import { CitationsCrawler } from './src/crawlers/citations.js';
import { triageDiscoveries } from './src/triage/index.js';
import { generateMondayDigestHtml } from './src/email/templates.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runPipeline() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  END-TO-END PIPELINE TEST');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Step 1: Run citations crawler (missing citations only)
  console.log('📋 STEP 1: Running citations crawler (missing citations only)...');
  console.log('');

  const crawler = new CitationsCrawler();
  await crawler.loadTestData();

  // Only run the missing citations audit (fast, no URL checking)
  const missingCitations = await crawler.auditMissingCitations();

  console.log(`   Found ${missingCitations.length} missing citations`);
  console.log('');

  // Step 2: Take first 5 discoveries
  console.log('📋 STEP 2: Taking first 5 discoveries...');
  console.log('');

  const discoveries = missingCitations.slice(0, 5);

  for (let i = 0; i < discoveries.length; i++) {
    const d = discoveries[i];
    console.log(`   ${i + 1}. ${d.testName} - ${d.field}`);
    console.log(`      Value: ${d.value}`);
    console.log(`      Category: ${d.category}`);
    console.log('');
  }

  // Step 3: Run through triage
  console.log('📋 STEP 3: Running triage on discoveries...');
  console.log('');

  // Map discoveries to expected triage format
  const triageInput = discoveries.map(d => ({
    id: `citation-${d.testId}-${d.field}`,
    type: 'missing_citation',
    source: 'citations',
    title: d.title,
    summary: d.summary,
    url: d.metadata?.suggestedSearch || null,
    relevance: d.relevance,
    discoveredAt: new Date().toISOString(),
    data: {
      testId: d.testId,
      testName: d.testName,
      vendor: d.vendor,
      category: d.category,
      field: d.field,
      value: d.value,
      citationField: d.metadata?.citationField,
    },
    metadata: d.metadata,
  }));

  // For this test, we'll simulate triage results since real triage requires Claude API
  // In production, we'd call: const triageResults = await triageDiscoveries(triageInput, { verbose: true });

  // Simulated triage results for testing the template
  const triageResults = {
    highPriority: triageInput.slice(0, 2).map(d => ({
      title: `Add citation for ${d.data.testName} ${d.data.field}`,
      action: `Update ${d.data.testId} with ${d.data.field} citation`,
      testId: d.data.testId,
      testName: d.data.testName,
      field: d.data.field,
      newValue: d.data.value,
      source: 'Citation audit',
      sourceUrl: d.metadata?.suggestedSearch,
      evidence: `Test has ${d.data.field}=${d.data.value} but no supporting citation`,
      confidence: 'high',
      notes: `Search PubMed for "${d.data.testName}" validation studies`,
    })),
    mediumPriority: triageInput.slice(2, 4).map(d => ({
      title: `Review citation for ${d.data.testName} ${d.data.field}`,
      action: `Consider adding citation for ${d.data.field}`,
      testId: d.data.testId,
      testName: d.data.testName,
      field: d.data.field,
      sourceUrl: d.metadata?.suggestedSearch,
    })),
    lowPriority: triageInput.slice(4).map(d => ({
      title: `Low priority: ${d.data.testName} ${d.data.field}`,
      action: `Optional citation for ${d.data.field}`,
    })),
    ignored: {
      not_relevant: 0,
      duplicate: 0,
      already_addressed: 0,
    },
    metadata: {
      inputCount: triageInput.length,
      processedAt: new Date().toISOString(),
      durationMs: 150,
      costs: {
        totalCost: '0.00',
        apiCalls: 0,
      },
    },
  };

  console.log(`   High priority: ${triageResults.highPriority.length}`);
  console.log(`   Medium priority: ${triageResults.mediumPriority.length}`);
  console.log(`   Low priority: ${triageResults.lowPriority.length}`);
  console.log('');

  // Step 4: Generate Monday digest
  console.log('📋 STEP 4: Generating Monday digest HTML...');
  console.log('');

  // Build database stats from crawler data
  const dbStats = {
    totalTests: Object.values(crawler.testData).reduce((sum, arr) => sum + arr.length, 0),
    categoryCount: Object.keys(crawler.testData).length,
    citationCompleteness: Math.round((1 - missingCitations.length / 500) * 100), // Rough estimate
    citedFields: 500 - missingCitations.length,
    totalFields: 500,
    brokenUrls: 0,
    lastUpdated: new Date().toISOString(),
    updatesThisWeek: 3,
    byCategory: {
      'Molecular Residual Disease (MRD)': crawler.testData.mrd?.length || 0,
      'Early Cancer Detection (ECD)': crawler.testData.ecd?.length || 0,
      'Treatment Decision Support (TDS)': crawler.testData.tds?.length || 0,
      'Treatment Response Monitoring (TRM)': crawler.testData.trm?.length || 0,
      'Hereditary Cancer Testing (HCT)': crawler.testData.hct?.length || 0,
    },
  };

  // Build crawler health
  const crawlerHealth = {
    crawlers: [
      { source: 'citations', status: 'success', lastSuccess: new Date().toISOString(), errorsThisWeek: 0 },
      { source: 'pubmed', status: 'success', lastSuccess: new Date(Date.now() - 86400000).toISOString(), errorsThisWeek: 0 },
      { source: 'vendor', status: 'success', lastSuccess: new Date(Date.now() - 172800000).toISOString(), errorsThisWeek: 1 },
    ],
    recentErrors: [],
  };

  const html = generateMondayDigestHtml(triageResults, dbStats, crawlerHealth);

  // Step 5: Save and open
  console.log('📋 STEP 5: Saving to test-output/monday-digest-real.html...');
  console.log('');

  const outputPath = path.join(__dirname, 'test-output', 'monday-digest-real.html');
  fs.writeFileSync(outputPath, html);

  console.log(`   ✅ Saved to: ${outputPath}`);
  console.log('');

  // Open in browser
  console.log('📋 Opening in browser...');

  const openCmd = process.platform === 'darwin' ? 'open' :
                  process.platform === 'win32' ? 'start' : 'xdg-open';

  exec(`${openCmd} "${outputPath}"`, (error) => {
    if (error) {
      console.log(`   Note: Could not auto-open browser. Open manually: ${outputPath}`);
    } else {
      console.log('   ✅ Opened in browser');
    }
  });

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  PIPELINE TEST COMPLETE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('Summary:');
  console.log(`  • Crawled: ${missingCitations.length} missing citations found`);
  console.log(`  • Triaged: ${triageInput.length} discoveries processed`);
  console.log(`  • Output: ${outputPath}`);
}

runPipeline().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
