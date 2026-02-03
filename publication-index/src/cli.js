#!/usr/bin/env node

/**
 * Publication Index Crawler CLI
 *
 * Command-line interface for running the publication index crawler.
 *
 * Usage:
 *   node src/cli.js crawl
 *   node src/cli.js crawl --source=natera_signatera_publications
 *   node src/cli.js crawl --dry-run
 *   node src/cli.js status
 */

import 'dotenv/config';
import { runPublicationIndexCrawler, getPublicationSourceStatus } from './index.js';
import { close } from '../../test-data-tracker/src/db/mrd-client.js';
import { createLogger } from '../../test-data-tracker/src/utils/logger.js';

const logger = createLogger('pubindex-cli');

function parseArgs(args) {
  const result = {
    command: args[0] || 'help',
    options: {},
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      result.options[key] = value === undefined ? true : value;
    } else if (arg.startsWith('-')) {
      result.options[arg.slice(1)] = true;
    }
  }

  return result;
}

function showHelp() {
  console.log(`
Publication Index Crawler CLI

Extracts publication citations from vendor evidence pages and society sources,
resolves them to PubMed, and writes to the physician-system database.

Usage:
  node src/crawlers/publication-index/cli.js <command> [options]

Commands:
  crawl       Run the publication index crawler
  status      Show status of active publication sources
  help        Show this help message

Options for 'crawl':
  --source=<key>    Crawl only a specific source (by source_key)
  --dry-run         Extract publications but don't write to database

Examples:
  # Crawl all active publication sources
  node src/crawlers/publication-index/cli.js crawl

  # Crawl a specific source
  node src/crawlers/publication-index/cli.js crawl --source=natera_signatera_publications

  # Dry run (extract but don't write)
  node src/crawlers/publication-index/cli.js crawl --dry-run

  # Check source status
  node src/crawlers/publication-index/cli.js status

Environment Variables:
  MRD_DATABASE_URL    PostgreSQL connection string (required)
  ANTHROPIC_API_KEY   Required for Claude extraction

Source Types Processed:
  - vendor      Vendor publication index pages
  - guideline   Clinical guideline reference pages
  - news        News articles and reviews
  - society     Medical society editorials and commentaries
`);
}

async function runCrawl(options) {
  console.log('Starting publication index crawl...\n');

  if (options.source) {
    console.log(`Filtering to source: ${options.source}`);
  }

  if (options['dry-run']) {
    console.log('DRY RUN MODE - no database writes will occur\n');
  }

  const result = await runPublicationIndexCrawler({
    sourceKey: options.source,
    dryRun: options['dry-run'],
  });

  console.log('\n=== Publication Index Crawl Results ===');
  console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);

  if (result.error) {
    console.log(`Error: ${result.error}`);
  }

  console.log('\nStats:');
  console.log(`  Sources crawled: ${result.stats.sources_crawled}`);
  console.log(`  Sources skipped (no changes): ${result.stats.sources_skipped}`);
  console.log(`  Sources failed: ${result.stats.sources_failed}`);
  console.log(`  Publications found: ${result.stats.publications_found}`);
  console.log(`  New items added: ${result.stats.new_items}`);
  console.log(`  Items updated: ${result.stats.updated_items}`);
  console.log(`  Resolved to PubMed: ${result.stats.resolved_to_pubmed}`);
  console.log(`  Guardrails set: ${result.stats.guardrails_set}`);

  if (result.duration) {
    console.log(`\nDuration: ${result.duration}s`);
  }

  return result;
}

async function showStatus() {
  console.log('Fetching publication source status...\n');

  const status = await getPublicationSourceStatus();

  console.log('=== Publication Source Status ===\n');
  console.log(`Total active sources: ${status.total}`);
  console.log(`Sources needing check (>7 days): ${status.needsCheck}\n`);

  if (status.sources.length === 0) {
    console.log('No active publication sources configured.');
    console.log('\nTo add sources, insert rows into mrd_sources table with:');
    console.log('  source_type: vendor, guideline, news, or society');
    console.log('  base_url: URL of the publication index page');
    console.log('  is_active: true');
    return;
  }

  // Format as table
  const headers = ['Source Key', 'Type', 'Last Checked', 'Days Since'];
  const colWidths = [35, 12, 20, 12];

  // Print header
  console.log(
    headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ')
  );
  console.log('-'.repeat(colWidths.reduce((a, b) => a + b + 3, 0)));

  // Print rows
  for (const source of status.sources) {
    const lastChecked = source.last_checked_at
      ? new Date(source.last_checked_at).toISOString().split('T')[0]
      : 'Never';

    const daysSince = source.days_since_check !== null
      ? `${source.days_since_check} days`
      : 'N/A';

    const row = [
      source.source_key.substring(0, 34),
      source.source_type,
      lastChecked,
      daysSince,
    ];

    console.log(
      row.map((val, i) => String(val).padEnd(colWidths[i])).join(' | ')
    );
  }

  // Show sources needing attention
  const stale = status.sources.filter((s) => s.days_since_check > 7);
  if (stale.length > 0) {
    console.log(`\n⚠️  ${stale.length} source(s) haven't been checked in over 7 days:`);
    for (const s of stale) {
      console.log(`   - ${s.source_key} (${s.days_since_check} days)`);
    }
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  try {
    switch (command) {
      case 'crawl':
        await runCrawl(options);
        break;

      case 'status':
        await showStatus();
        break;

      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    logger.error('CLI error', { error: error.message });
    console.error('\nError:', error.message);
    process.exit(1);
  } finally {
    await close();
  }
}

main();
