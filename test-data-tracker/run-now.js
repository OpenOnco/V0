import 'dotenv/config';
import { createAllCrawlers } from './src/crawlers/index.js';
import { getQueueStatus } from './src/queue/index.js';

async function runAll() {
  console.log('Starting manual crawl at', new Date().toISOString());

  const crawlers = createAllCrawlers();

  for (const [name, crawler] of Object.entries(crawlers)) {
    console.log(`\n=== Running ${name} ===`);
    try {
      // Use run() instead of crawl() to add discoveries to queue
      const result = await crawler.run();
      console.log(`${name}: ${result.discoveries?.length || 0} discoveries found, ${result.added || 0} added to queue`);
      if (result.discoveries?.length > 0) {
        result.discoveries.forEach(r => console.log(`  - ${r.title}`));
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
