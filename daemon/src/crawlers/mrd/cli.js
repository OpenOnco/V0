#!/usr/bin/env node

/**
 * MRD Crawler CLI
 * Command-line interface for running MRD guidance crawlers
 *
 * Usage:
 *   node src/crawlers/mrd/cli.js pubmed --mode=incremental
 *   node src/crawlers/mrd/cli.js pubmed --mode=backfill --from=2023-01-01
 *   node src/crawlers/mrd/cli.js clinicaltrials
 *   node src/crawlers/mrd/cli.js clinicaltrials --seed
 *   node src/crawlers/mrd/cli.js fda
 *   node src/crawlers/mrd/cli.js gaps
 *   node src/crawlers/mrd/cli.js embed --limit=50
 */

import 'dotenv/config';
import { runPubMedCrawler, fillGaps } from './index.js';
import { crawlClinicalTrials, seedPriorityTrials } from './clinicaltrials.js';
import { crawlFDA } from './fda.js';
import { embedAllMissing } from '../../embeddings/mrd-embedder.js';
import { linkAllTrials } from '../../embeddings/cross-link.js';
import { close } from '../../db/mrd-client.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('mrd-cli');

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
MRD Guidance Monitor - Crawler CLI

Usage:
  node src/crawlers/mrd/cli.js <command> [options]

Commands:
  pubmed          Run PubMed crawler
  clinicaltrials  Run ClinicalTrials.gov crawler
  fda             Run FDA RSS feed crawler
  gaps            Detect and fill crawler gaps
  embed           Generate embeddings for items without them
  link            Link trials to publications
  all             Run all crawlers sequentially
  help            Show this help message

Options for 'pubmed':
  --mode=<mode>   Crawl mode: seed, backfill, incremental, catchup
                  (default: incremental)
  --from=<date>   Start date for crawl (YYYY-MM-DD)
  --to=<date>     End date for crawl (YYYY-MM-DD)
  --max=<n>       Maximum articles to fetch (default: 500)
  --skip-triage   Skip Haiku triage step
  --skip-classify Skip Sonnet classification step
  --dry-run       Don't write to database

Options for 'clinicaltrials':
  --seed          Seed priority MRD trials only
  --max=<n>       Maximum trials (default: 500)
  --dry-run       Don't write to database

Options for 'fda':
  --dry-run       Don't write to database

Options for 'embed':
  --limit=<n>     Max items to embed (default: 100)

Options for 'link':
  --limit=<n>     Max trials to link (default: 100)

Examples:
  # Daily incremental crawl
  node src/crawlers/mrd/cli.js pubmed

  # Backfill from specific date
  node src/crawlers/mrd/cli.js pubmed --mode=backfill --from=2023-01-01

  # Seed priority trials
  node src/crawlers/mrd/cli.js clinicaltrials --seed

  # Run all crawlers
  node src/crawlers/mrd/cli.js all

  # Generate embeddings for new items
  node src/crawlers/mrd/cli.js embed --limit=50

  # Link trials to publications
  node src/crawlers/mrd/cli.js link

Environment Variables:
  MRD_DATABASE_URL    PostgreSQL connection string
  ANTHROPIC_API_KEY   Required for AI triage/classification
  OPENAI_API_KEY      Required for embeddings
  NCBI_API_KEY        Optional, increases PubMed rate limit
`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  try {
    switch (command) {
      case 'pubmed': {
        const result = await runPubMedCrawler({
          mode: options.mode || 'incremental',
          fromDate: options.from,
          toDate: options.to,
          maxResults: parseInt(options.max || '500', 10),
          skipTriage: options['skip-triage'],
          skipClassify: options['skip-classify'],
          dryRun: options['dry-run'],
        });

        console.log('\n=== PubMed Crawl Results ===');
        console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
        if (result.error) {
          console.log(`Error: ${result.error}`);
        }
        console.log('\nStats:');
        console.log(`  Found: ${result.stats.found}`);
        console.log(`  Pre-filtered: ${result.stats.prefiltered}`);
        console.log(`  Triaged: ${result.stats.triaged}`);
        console.log(`  Classified: ${result.stats.classified}`);
        console.log(`  Added: ${result.stats.added}`);
        console.log(`  Duplicates: ${result.stats.duplicate}`);
        console.log(`  Rejected: ${result.stats.rejected}`);
        break;
      }

      case 'clinicaltrials': {
        if (options.seed) {
          console.log('Seeding priority MRD trials...');
          const result = await seedPriorityTrials();
          console.log('\n=== Priority Trials Seeded ===');
          console.log(`  Success: ${result.success}`);
          console.log(`  Failed: ${result.failed}`);
        } else {
          const result = await crawlClinicalTrials({
            maxResults: parseInt(options.max || '500', 10),
            dryRun: options['dry-run'],
          });

          console.log('\n=== ClinicalTrials.gov Crawl Results ===');
          console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
          if (result.error) {
            console.log(`Error: ${result.error}`);
          }
          console.log('\nStats:');
          console.log(`  Found: ${result.stats.found}`);
          console.log(`  New: ${result.stats.new}`);
          console.log(`  Updated: ${result.stats.updated}`);
          console.log(`  Failed: ${result.stats.failed}`);
        }
        break;
      }

      case 'fda': {
        const result = await crawlFDA({
          dryRun: options['dry-run'],
        });

        console.log('\n=== FDA Crawl Results ===');
        console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
        console.log('\nStats:');
        console.log(`  Feeds checked: ${result.stats.feeds}`);
        console.log(`  Items found: ${result.stats.items}`);
        console.log(`  MRD-relevant: ${result.stats.relevant}`);
        console.log(`  Added to queue: ${result.stats.added}`);
        break;
      }

      case 'gaps': {
        const result = await fillGaps('pubmed');
        console.log('\n=== Gap Fill Results ===');
        console.log(`Gaps detected: ${result.gaps.length}`);
        console.log(`Gaps filled: ${result.filled}`);

        if (result.gaps.length > 0) {
          console.log('\nGaps:');
          for (const gap of result.gaps) {
            console.log(`  ${gap.gap_start} to ${gap.gap_end} (${gap.gap_days.toFixed(1)} days)`);
          }
        }
        break;
      }

      case 'embed': {
        const result = await embedAllMissing({
          limit: parseInt(options.limit || '100', 10),
        });

        console.log('\n=== Embedding Results ===');
        console.log(`  Processed: ${result.processed}`);
        console.log(`  Success: ${result.success}`);
        console.log(`  Failed: ${result.failed}`);
        break;
      }

      case 'link': {
        const result = await linkAllTrials({
          limit: parseInt(options.limit || '100', 10),
        });

        console.log('\n=== Trial Linking Results ===');
        console.log(`  Processed: ${result.processed}`);
        console.log(`  Linked: ${result.linked}`);
        console.log(`  Total links: ${result.totalLinks}`);
        break;
      }

      case 'all': {
        console.log('Running all crawlers...\n');

        // PubMed
        console.log('1. PubMed crawler...');
        await runPubMedCrawler({ mode: 'incremental' });

        // ClinicalTrials.gov
        console.log('\n2. ClinicalTrials.gov crawler...');
        await crawlClinicalTrials({ maxResults: 500 });

        // FDA
        console.log('\n3. FDA crawler...');
        await crawlFDA({});

        // Embeddings
        console.log('\n4. Generating embeddings...');
        await embedAllMissing({ limit: 100 });

        // Trial linking
        console.log('\n5. Linking trials to publications...');
        await linkAllTrials({ limit: 100 });

        console.log('\n=== All Crawlers Complete ===');
        break;
      }

      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    logger.error('CLI error', { error: error.message });
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await close();
  }
}

main();
