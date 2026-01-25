#!/usr/bin/env node
/**
 * Minimal test script for the Citations crawler
 * Only runs the missing citations audit (no URL checking) on a limited subset
 */

import { CitationsCrawler } from './src/crawlers/citations.js';

async function main() {
  console.log('🔍 Testing Citations Crawler (missing citations audit only)\n');

  const crawler = new CitationsCrawler();

  try {
    // Load test data
    console.log('Loading test data...');
    await crawler.loadTestData();

    // Run just the missing citations audit (fast, no network calls)
    console.log('\nRunning missing citations audit...\n');
    const discoveries = await crawler.auditMissingCitations();

    // Show summary
    console.log(`\n📊 Found ${discoveries.length} missing citations\n`);

    // Group by category
    const byCategory = {};
    for (const d of discoveries) {
      const cat = d.category || 'unknown';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    console.log('By category:');
    for (const [cat, count] of Object.entries(byCategory)) {
      console.log(`  ${cat}: ${count}`);
    }

    // Show first 5 high-relevance issues
    const highRelevance = discoveries.filter(d => d.relevance === 'high');
    console.log(`\n⚠️  High relevance issues: ${highRelevance.length}`);
    console.log('\nFirst 5 high-relevance issues:');
    for (const d of highRelevance.slice(0, 5)) {
      console.log(`  - ${d.testName} (${d.vendor}): ${d.field} = ${d.value}`);
    }

    console.log('\n✅ Test complete!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
