import 'dotenv/config';
import { createAllCrawlers } from './src/crawlers/index.js';
import { getQueueStatus } from './src/queue/index.js';

async function runAll() {
  console.log('Starting manual crawl at', new Date().toISOString());

  const crawlers = createAllCrawlers();

  for (const [name, crawler] of Object.entries(crawlers)) {
    console.log(`\n=== Running ${name} ===`);
    try {
      const results = await crawler.crawl();
      console.log(`${name}: ${results.length} discoveries`);
      if (results.length > 0) {
        results.forEach(r => console.log(`  - ${r.title}`));
      }
    } catch (err) {
      console.log(`${name} error: ${err.message}`);
    }
  }

  const queue = await getQueueStatus();
  console.log('\n=== Queue Status ===');
  console.log(queue);
}

runAll().then(() => process.exit(0));
