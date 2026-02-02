#!/usr/bin/env node
/**
 * Test script to run a single crawler and print discoveries
 * Usage: node test-crawler.js <crawler-name>
 *
 * Crawler names: cms, payers, vendor
 */

import { runCrawler } from './src/crawlers/index.js';
import { SOURCES } from './src/config.js';

const validCrawlers = Object.values(SOURCES);

const crawlerName = process.argv[2];

if (!crawlerName) {
  console.error('Usage: node test-crawler.js <crawler-name>');
  console.error(`Valid crawlers: ${validCrawlers.join(', ')}`);
  process.exit(1);
}

if (!validCrawlers.includes(crawlerName)) {
  console.error(`Invalid crawler: ${crawlerName}`);
  console.error(`Valid crawlers: ${validCrawlers.join(', ')}`);
  process.exit(1);
}

console.log(`Running ${crawlerName} crawler...\n`);

try {
  const result = await runCrawler(crawlerName);

  console.log('='.repeat(60));
  console.log(`Crawler: ${crawlerName}`);
  console.log(`Success: ${result.success}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Discoveries: ${result.discoveries?.length || 0}`);
  console.log('='.repeat(60));

  if (result.discoveries?.length > 0) {
    console.log('\nDiscoveries:\n');
    result.discoveries.forEach((discovery, i) => {
      console.log(`[${i + 1}] ${discovery.title || discovery.name || 'Untitled'}`);
      console.log(`    Type: ${discovery.type || 'unknown'}`);
      console.log(`    URL: ${discovery.url || 'N/A'}`);
      if (discovery.summary) {
        console.log(`    Summary: ${discovery.summary}`);
      }
      console.log('');
    });
  } else {
    console.log('\nNo discoveries found.');
  }

  if (result.error) {
    console.error(`\nError: ${result.error}`);
  }
} catch (error) {
  console.error(`Crawler failed: ${error.message}`);
  process.exit(1);
}
