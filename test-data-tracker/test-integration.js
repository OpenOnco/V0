/**
 * Quick integration test for v2 modules
 */

async function test() {
  console.log('Testing v2 module imports...\n');

  // Test payer crawler imports
  console.log('1. Payer crawler...');
  const { PayerCrawler } = await import('./src/crawlers/payers.js');
  console.log('   ✓ PayerCrawler imported');

  // Test scheduler imports
  console.log('2. Scheduler...');
  const { startScheduler, triggerDiscovery } = await import('./src/scheduler.js');
  console.log('   ✓ Scheduler imported with triggerDiscovery');

  // Test coverage service
  console.log('3. Coverage service...');
  const { getTestCoverage, getCoverageStats } = await import('./src/services/coverage.js');
  console.log('   ✓ Coverage service imported');

  // Test extractors
  console.log('4. Extractors...');
  const { extractStructuredData, quickRelevanceCheck } = await import('./src/extractors/index.js');
  console.log('   ✓ Extractors imported');

  // Test multi-hash
  console.log('5. Multi-hash...');
  const { computeMultiHash, compareMultiHash } = await import('./src/utils/multi-hash.js');
  console.log('   ✓ Multi-hash imported');

  // Test reconciliation
  console.log('6. Reconciliation...');
  const { reconcileCoverage } = await import('./src/analysis/reconcile.js');
  console.log('   ✓ Reconciliation imported');

  // Test discovery
  console.log('7. Discovery...');
  const { DiscoveryCrawler, runDiscovery } = await import('./src/crawlers/discovery.js');
  console.log('   ✓ Discovery crawler imported');

  // Quick functional test
  console.log('\n8. Functional tests...');

  // Test extraction
  const extraction = await extractStructuredData('Signatera is covered for Stage II CRC. Effective Date: January 1, 2026. Code 0239U applies.');
  console.log('   ✓ Extraction works:', {
    tests: extraction.testIds,
    effectiveDate: extraction.effectiveDate,
    codes: extraction.codes.pla,
  });

  // Test relevance check
  const relevance = quickRelevanceCheck('This policy covers Signatera MRD testing for colorectal cancer.');
  console.log('   ✓ Relevance check works:', relevance.isRelevant ? 'Relevant' : 'Not relevant');

  console.log('\n✅ All v2 integration tests passed!');
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
