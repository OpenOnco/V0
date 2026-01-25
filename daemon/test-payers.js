/**
 * Test script for the Payers crawler
 * Tests 1-2 sources to verify Playwright-based crawling works
 */

import { PayerCrawler, PAYER_SOURCES, VENDOR_COVERAGE_SOURCES } from './src/crawlers/payers.js';

// Create a test version that only crawls specific sources
class TestPayerCrawler extends PayerCrawler {
  constructor(testPayers = [], testVendors = []) {
    super();
    this.payers = testPayers;
    this.vendorCoverageSources = testVendors;
  }
}

async function runTest() {
  console.log('='.repeat(60));
  console.log('Payers Crawler Test');
  console.log('='.repeat(60));

  // Test with 1 payer (Aetna - has specific policy pages) and 1 vendor (Natera)
  const testPayer = PAYER_SOURCES.find(p => p.id === 'aetna');
  const testVendor = VENDOR_COVERAGE_SOURCES.find(v => v.id === 'natera');

  console.log('\nTest Configuration:');
  console.log(`- Payer: ${testPayer?.name || 'None'}`);
  if (testPayer) {
    console.log(`  - Index pages: ${testPayer.policyIndexPages.length}`);
    console.log(`  - Policy pages: ${testPayer.policyPages?.length || 0}`);
  }
  console.log(`- Vendor: ${testVendor?.name || 'None'}`);
  if (testVendor) {
    console.log(`  - Pages: ${testVendor.pages.length}`);
  }

  // Only test what we found
  const crawler = new TestPayerCrawler(
    testPayer ? [testPayer] : [],
    testVendor ? [testVendor] : []
  );

  console.log('\n' + '-'.repeat(60));
  console.log('Starting crawl...\n');

  const startTime = Date.now();

  try {
    const discoveries = await crawler.crawl();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '-'.repeat(60));
    console.log('Results:');
    console.log(`- Time: ${elapsed}s`);
    console.log(`- Discoveries: ${discoveries.length}`);

    if (discoveries.length > 0) {
      console.log('\nDiscoveries found:');
      discoveries.forEach((d, i) => {
        console.log(`\n${i + 1}. ${d.title}`);
        console.log(`   Type: ${d.type}`);
        console.log(`   URL: ${d.url}`);
        console.log(`   Relevance: ${d.relevance}`);
        if (d.metadata?.matchedKeywords?.length > 0) {
          console.log(`   Keywords: ${d.metadata.matchedKeywords.slice(0, 5).join(', ')}`);
        }
      });
    } else {
      console.log('\nNo discoveries (this is expected on first run - baseline captured)');
      console.log('Run again to detect changes.');
    }

    // Check if hashes were saved
    const fs = await import('fs/promises');
    try {
      const hashData = await fs.readFile('./data/payer-hashes.json', 'utf-8');
      const hashes = JSON.parse(hashData);
      console.log(`\nHashes stored: ${Object.keys(hashes).length}`);
      console.log('Hash keys:');
      Object.keys(hashes).forEach(key => {
        console.log(`  - ${key.substring(0, 60)}...`);
      });
    } catch (e) {
      console.log('\nNo hash file found (first run or error)');
    }

  } catch (error) {
    console.error('\nCrawl failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test complete');
}

runTest();
