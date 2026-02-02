#!/usr/bin/env node

/**
 * MRD Guidance Monitor - CLI
 * Command-line interface for clinical evidence crawlers
 *
 * Usage:
 *   node src/cli.js pubmed --mode=incremental
 *   node src/cli.js pubmed --mode=backfill --from=2023-01-01
 *   node src/cli.js clinicaltrials
 *   node src/cli.js clinicaltrials --seed
 *   node src/cli.js fda
 *   node src/cli.js embed --limit=50
 */

import 'dotenv/config';
import { runPubMedCrawler, fillGaps } from './crawlers/index.js';
import { crawlClinicalTrials, seedPriorityTrials } from './crawlers/clinicaltrials.js';
import { crawlFDA } from './crawlers/fda.js';
import { processNccnPdf, processNccnDirectory } from './crawlers/processors/nccn.js';
import { processSocietyGuideline, processSocietyDirectory } from './crawlers/processors/society.js';
import { ingestCMSData, listCMSData } from './crawlers/cms.js';
import { embedAllMissing } from './embeddings/mrd-embedder.js';
import { linkAllTrials } from './embeddings/cross-link.js';
import { close } from './db/client.js';
import { createLogger } from './utils/logger.js';

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
MRD Guidance Monitor - CLI

Usage:
  node src/cli.js <command> [options]

Commands:
  pubmed          Run PubMed crawler for clinical literature
  clinicaltrials  Run ClinicalTrials.gov crawler
  fda             Run FDA RSS feed crawler
  nccn            Process NCCN guideline PDFs
  society         Process ASCO/ESMO/SITC guideline PDFs
  cms             Ingest CMS MolDX LCDs for ctDNA/MRD
  monitor         Check RSS feeds for new MRD-relevant articles
  gaps            Detect and fill crawler gaps
  embed           Generate embeddings for items without them
  link            Link trials to publications
  all             Run all crawlers sequentially
  serve           Start the MRD Chat API server
  scheduler       Start the cron scheduler (runs in foreground)
  digest          Send the weekly digest email now
  daily-report    Send AI-powered daily ops report now
  test-email      Send a test email to verify configuration
  health          Show health summary for all crawlers
  version-watch   Check guideline pages for new versions
  guideline-scan  Scan watch folders for new guideline PDFs
  seed-sources    Seed the source registry with all known sources
  sources         List all registered sources and their status
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

Options for 'nccn':
  --dir           Process all PDFs in directory
  <path>          Path to PDF file or directory (with --dir)

Options for 'society':
  --dir           Process all PDFs in directory
  --filter=<id>   Only process specific society (asco, esmo, sitc, cap-amp)
  <path>          Path to PDF file or directory (with --dir)

Options for 'cms':
  --list          List available LCDs without ingesting
  --dry-run       Show what would be ingested without writing

Options for 'embed':
  --limit=<n>     Max items to embed (default: 100)

Options for 'link':
  --limit=<n>     Max trials to link (default: 100)

Examples:
  # Daily incremental crawl
  node src/cli.js pubmed

  # Backfill from specific date
  node src/cli.js pubmed --mode=backfill --from=2023-01-01

  # Seed priority trials
  node src/cli.js clinicaltrials --seed

  # Run all crawlers
  node src/cli.js all

  # Generate embeddings for new items
  node src/cli.js embed --limit=50

  # Start the chat API server
  node src/cli.js serve

  # Start the scheduler
  node src/cli.js scheduler

  # Check health status
  node src/cli.js health

  # Send weekly digest
  node src/cli.js digest

Environment Variables:
  MRD_DATABASE_URL    PostgreSQL connection string
  ANTHROPIC_API_KEY   Required for AI triage/classification
  OPENAI_API_KEY      Required for embeddings
  NCBI_API_KEY        Optional, increases PubMed rate limit
  RESEND_API_KEY      Required for email notifications
  EMAIL_TO            Recipient email for digests
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

      case 'nccn': {
        // Get the path from remaining args
        const pathArg = process.argv.slice(3).find(a => !a.startsWith('-'));

        if (!pathArg) {
          console.log('Error: Please provide a PDF path or directory');
          console.log('Usage:');
          console.log('  node src/cli.js nccn /path/to/guideline.pdf');
          console.log('  node src/cli.js nccn --dir /path/to/nccn-pdfs/');
          break;
        }

        let result;
        if (options.dir) {
          console.log(`Processing all PDFs in: ${pathArg}`);
          result = await processNccnDirectory(pathArg);
        } else {
          console.log(`Processing PDF: ${pathArg}`);
          result = await processNccnPdf(pathArg);
        }

        console.log('\n=== NCCN Processing Results ===');
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'society': {
        // Get the path from remaining args
        const societyPathArg = process.argv.slice(3).find(a => !a.startsWith('-'));

        if (!societyPathArg) {
          console.log('Error: Please provide a PDF path or directory');
          console.log('Usage:');
          console.log('  node src/cli.js society /path/to/guideline.pdf');
          console.log('  node src/cli.js society --dir /path/to/society-pdfs/');
          console.log('  node src/cli.js society --dir --filter=asco /path/to/guidelines/');
          break;
        }

        let societyResult;
        if (options.dir) {
          console.log(`Processing all society PDFs in: ${societyPathArg}`);
          if (options.filter) {
            console.log(`Filtering by society: ${options.filter}`);
          }
          societyResult = await processSocietyDirectory(societyPathArg, options.filter);
        } else {
          console.log(`Processing society PDF: ${societyPathArg}`);
          societyResult = await processSocietyGuideline(societyPathArg);
        }

        console.log('\n=== Society Guideline Processing Results ===');
        console.log(JSON.stringify(societyResult, null, 2));
        break;
      }

      case 'cms': {
        if (options.list) {
          await listCMSData();
        } else {
          const result = await ingestCMSData({
            dryRun: options['dry-run'],
          });

          console.log('\n=== CMS LCD Ingestion Results ===');
          console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
          if (result.error) {
            console.log(`Error: ${result.error}`);
          } else {
            console.log(`\nStats:`);
            console.log(`  Total found: ${result.totalFound}`);
            console.log(`  After dedup: ${result.deduplicated}`);
            console.log(`  Saved: ${result.saved}`);
            console.log(`  Skipped: ${result.skipped}`);
            console.log(`  Updated: ${result.updated}`);
          }
        }
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

      case 'serve': {
        // Import and start server
        const { startServer } = await import('./chat/server.js');
        await startServer();
        // Server keeps running
        break;
      }

      case 'scheduler': {
        const { startScheduler } = await import('./scheduler.js');
        startScheduler();
        console.log('Scheduler running. Press Ctrl+C to stop.');
        // Keep process alive
        await new Promise(() => {});
        break;
      }

      case 'digest': {
        const { sendWeeklyDigest } = await import('./email/weekly-digest.js');
        await sendWeeklyDigest();
        console.log('Weekly digest sent');
        break;
      }

      case 'daily-report': {
        const { sendDailyAIReport } = await import('./email/daily-ai-report.js');
        console.log('Generating AI-powered daily report...');
        const result = await sendDailyAIReport();
        console.log(`Daily report sent: ${result.subject}`);
        break;
      }

      case 'test-email': {
        const { sendTestEmail } = await import('./email/index.js');
        const result = await sendTestEmail();
        if (result) {
          console.log('Test email sent successfully!');
        } else {
          console.log('Email not configured. Set RESEND_API_KEY environment variable.');
        }
        break;
      }

      case 'monitor': {
        const { monitorRSSFeeds } = await import('./crawlers/society-monitor.js');
        const result = await monitorRSSFeeds();
        console.log('\n=== RSS Monitor Results ===');
        console.log(`  Feeds checked: ${Object.keys(result.feeds).length}`);
        console.log(`  Items checked: ${result.checked}`);
        console.log(`  MRD-relevant: ${result.relevant}`);
        console.log(`  New items added: ${result.new}`);
        console.log('\nBy feed:');
        for (const [feed, data] of Object.entries(result.feeds)) {
          if (data.error) {
            console.log(`  ${feed}: ERROR - ${data.error}`);
          } else {
            console.log(`  ${feed}: ${data.total} items, ${data.relevant} relevant, ${data.new} new`);
          }
        }
        break;
      }

      case 'health': {
        const { getHealthSummary } = await import('./health.js');
        const summary = getHealthSummary();
        console.log('\n=== Health Summary ===');
        console.log(`Uptime: ${summary.uptime}`);
        console.log(`Digests sent: ${summary.digestsSent}`);
        if (summary.lastDigestSent) {
          console.log(`Last digest: ${new Date(summary.lastDigestSent).toLocaleString()}`);
        }
        console.log(`\nCrawler Status:`);
        if (summary.crawlers.length === 0) {
          console.log('  No crawler data yet');
        } else {
          for (const crawler of summary.crawlers) {
            const lastRun = crawler.lastRun ? new Date(crawler.lastRun).toLocaleString() : 'never';
            console.log(`  ${crawler.name}: ${crawler.status} (last: ${lastRun})`);
          }
        }
        console.log(`\nRecent Errors: ${summary.errorCount}`);
        if (summary.recentErrors.length > 0) {
          for (const err of summary.recentErrors.slice(0, 5)) {
            console.log(`  - ${err.source}: ${err.message}`);
          }
        }
        break;
      }

      case 'version-watch': {
        const { checkGuidelineVersions } = await import('./crawlers/version-watcher.js');
        console.log('Checking guideline versions...');
        const result = await checkGuidelineVersions();
        console.log('\n=== Version Watch Results ===');
        console.log(`  Checked: ${result.checked}`);
        console.log(`  Changed: ${result.changed}`);
        console.log(`  Errors: ${result.errors}`);
        if (result.details.length > 0) {
          console.log('\nDetails:');
          for (const d of result.details) {
            if (d.status === 'changed') {
              console.log(`  ${d.source_key}: ${d.oldVersion} → ${d.newVersion} ✨`);
            } else if (d.status === 'error') {
              console.log(`  ${d.source_key}: ERROR - ${d.error}`);
            } else {
              console.log(`  ${d.source_key}: ${d.version || d.status}`);
            }
          }
        }
        break;
      }

      case 'guideline-scan': {
        const { scanForNewGuidelines } = await import('./crawlers/guideline-watcher.js');
        console.log('Scanning for new guideline PDFs...');
        const result = await scanForNewGuidelines();
        console.log('\n=== Guideline Scan Results ===');
        console.log(`  Processed: ${result.processed}`);
        console.log(`  Skipped: ${result.skipped}`);
        console.log(`  Errors: ${result.errors.length}`);
        if (result.details.length > 0) {
          console.log('\nProcessed:');
          for (const d of result.details) {
            console.log(`  ${d.filename}: v${d.version}, ${d.itemsAdded} items`);
          }
        }
        if (result.errors.length > 0) {
          console.log('\nErrors:');
          for (const e of result.errors) {
            console.log(`  ${e.file}: ${e.error}`);
          }
        }
        break;
      }

      case 'seed-sources': {
        const { seedSources } = await import('./db/seed-sources.js');
        console.log('Seeding source registry...');
        const result = await seedSources();
        console.log('\n=== Source Seeding Results ===');
        console.log(`  Added: ${result.added}`);
        console.log(`  Updated: ${result.updated}`);
        break;
      }

      case 'sources': {
        const { query: dbQuery } = await import('./db/client.js');
        const result = await dbQuery(`
          SELECT
            source_key,
            source_type,
            display_name,
            access_method,
            expected_cadence,
            version_string,
            last_checked_at,
            last_release_at,
            is_active
          FROM mrd_sources
          ORDER BY source_type, source_key
        `);
        console.log('\n=== Registered Sources ===\n');
        let currentType = '';
        for (const s of result.rows) {
          if (s.source_type !== currentType) {
            currentType = s.source_type;
            console.log(`\n[${currentType.toUpperCase()}]`);
          }
          const lastCheck = s.last_checked_at ? new Date(s.last_checked_at).toLocaleDateString() : 'never';
          const version = s.version_string ? ` v${s.version_string}` : '';
          const status = s.is_active ? '' : ' (inactive)';
          console.log(`  ${s.source_key}${version} - ${s.access_method}, ${s.expected_cadence} (last: ${lastCheck})${status}`);
        }
        console.log(`\nTotal: ${result.rows.length} sources`);
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
    if (command !== 'serve' && command !== 'scheduler') {
      await close();
    }
  }
}

main();
