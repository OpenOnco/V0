#!/usr/bin/env node
/**
 * Test script for previewing the daily digest email
 *
 * Usage:
 *   node run-test-email.js          # Preview HTML in console
 *   node run-test-email.js --send   # Actually send the test email
 */

import { getHealthSummary } from './src/health.js';
import { loadDiscoveries, getQueueStatus } from './src/queue/index.js';
import { generateDigestHtml, generateDigestSubject } from './src/email/templates.js';
import { config, SOURCES } from './src/config.js';

async function main() {
  const shouldSend = process.argv.includes('--send');

  console.log('📧 OpenOnco Email Test Script\n');

  if (shouldSend) {
    console.log('Mode: SEND (will send actual email)\n');
  } else {
    console.log('Mode: PREVIEW (use --send to actually send)\n');
  }

  try {
    // Get health summary
    console.log('Fetching health summary...');
    const healthSummary = await getHealthSummary();
    console.log(`  ✓ Uptime: ${healthSummary.uptime}`);
    console.log(`  ✓ Crawlers tracked: ${healthSummary.crawlers.length}`);
    console.log(`  ✓ Recent errors: ${healthSummary.recentErrorCount}`);
    console.log(`  ✓ Digests sent: ${healthSummary.digestsSent}\n`);

    // Get discoveries grouped by source
    console.log('Fetching discoveries...');
    const allDiscoveries = loadDiscoveries();

    // Group discoveries by source and normalize data structure for templates
    const discoveries = {};
    for (const source of Object.values(SOURCES)) {
      discoveries[source] = allDiscoveries
        .filter(d => d.source === source)
        .map(d => ({
          ...d,
          // Template expects these at top level, but store has them in d.data
          relevance: d.relevance || d.data?.relevance || 'low',
          metadata: d.metadata || d.data?.metadata || {},
        }));
    }

    const totalCount = allDiscoveries.length;
    console.log(`  ✓ Total discoveries: ${totalCount}`);
    for (const [source, items] of Object.entries(discoveries)) {
      if (items.length > 0) {
        const sourceName = config.crawlers[source]?.name || source;
        console.log(`    - ${sourceName}: ${items.length}`);
      }
    }
    console.log('');

    // Get queue status
    console.log('Fetching queue status...');
    const rawQueueStatus = getQueueStatus();
    // Template expects pendingCount, queue returns pending
    const queueStatus = {
      ...rawQueueStatus,
      pendingCount: rawQueueStatus.pending,
    };
    console.log(`  ✓ Pending count: ${queueStatus.pendingCount}`);
    console.log(`  ✓ Total in queue: ${queueStatus.total}\n`);

    if (shouldSend) {
      // Note: sendDailyDigest was removed - use npm run test:email for Monday digest
      console.log('⚠️  The --send flag is no longer supported.');
      console.log('   Use "npm run test:email" to test the Monday digest instead.\n');
    } else {
      // Generate and display the email HTML
      const digestData = { healthSummary, discoveries, queueStatus };
      const subject = generateDigestSubject(digestData);
      const html = generateDigestHtml(digestData);

      console.log('━'.repeat(60));
      console.log(`SUBJECT: ${subject}`);
      console.log('━'.repeat(60));
      console.log('\nHTML OUTPUT:\n');
      console.log(html);
      console.log('\n' + '━'.repeat(60));
      console.log('\n💡 Run with --send to send this email');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

main();
