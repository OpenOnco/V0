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
import { crawlClinicalTrials, seedPriorityTrials, syncTrialsToGuidance } from './crawlers/clinicaltrials.js';
import { crawlFDA } from './crawlers/fda.js';
import { processNccnPdf, processNccnDirectory } from './crawlers/processors/nccn.js';
import { processSocietyGuideline, processSocietyDirectory } from './crawlers/processors/society.js';
import { ingestCMSData, listCMSData } from './crawlers/cms.js';
import { ingestVendorEvidence, checkVendorEvidenceStatus } from './crawlers/vendor-ingest.js';
import { ingestPublications, ingestSources } from './crawlers/seed-ingest.js';
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
  vendor-ingest   Ingest vendor clinical evidence from test-data-tracker
  seed            Load seed publications and sources from CSV files
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
  --sync          Sync trials to guidance items for RAG search
  --priority-only Only sync priority trials (with --sync)
  --force-update  Update existing guidance items (with --sync)
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

Options for 'vendor-ingest':
  --status        Show status of vendor evidence in DB (primary mode)
  --dry-run       Show what would be ingested without writing (backup mode)
  --force         Re-ingest already processed items (backup mode)
  --path=<path>   Custom path to export JSON file (backup mode)

Options for 'seed':
  --publications=<path>  Path to publications CSV file
  --sources=<path>       Path to sources CSV file
  --dry-run              Preview without writing
  --no-abstracts         Skip fetching abstracts from PubMed

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
        } else if (options.sync) {
          const priorityOnly = options['priority-only'];
          const forceUpdate = options['force-update'];
          console.log(`Syncing ${priorityOnly ? 'priority' : 'all relevant'} trials to guidance items for RAG...`);
          const result = await syncTrialsToGuidance({ priorityOnly, forceUpdate });
          console.log('\n=== Trials Synced to Guidance ===');
          console.log(`  Synced: ${result.synced}`);
          console.log(`  Updated: ${result.updated}`);
          console.log(`  Skipped (already exist): ${result.skipped}`);
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

        // Sync trials to guidance items for RAG search
        console.log('\n3. Syncing trials to guidance items...');
        await syncTrialsToGuidance();

        // FDA
        console.log('\n4. FDA crawler...');
        await crawlFDA({});

        // Embeddings
        console.log('\n5. Generating embeddings...');
        await embedAllMissing({ limit: 100 });

        // Trial linking
        console.log('\n6. Linking trials to publications...');
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
        const summary = await getHealthSummary();
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

      case 'vendor-ingest': {
        if (options.status) {
          // Show status of vendor evidence in DB
          const status = await checkVendorEvidenceStatus();

          console.log('\n=== Vendor Evidence Status ===');
          console.log('\nBy source type and evidence type:');

          if (status.byType.length === 0) {
            console.log('  No vendor evidence in database yet.');
            console.log('  The test-data-tracker vendor crawler writes directly to this DB');
            console.log('  when PHYSICIAN_DATABASE_URL is configured.');
          } else {
            for (const row of status.byType) {
              console.log(`  ${row.source_type} / ${row.evidence_type}:`);
              console.log(`    Total: ${row.count}, Last 24h: ${row.last_24h}, Last 7d: ${row.last_7d}`);
            }
          }

          console.log('\nEmbedding status:');
          console.log(`  Total items: ${status.embeddings.total}`);
          console.log(`  With embeddings: ${status.embeddings.with_embeddings}`);
          console.log(`  Missing embeddings: ${status.embeddings.total - status.embeddings.with_embeddings}`);

          if (status.embeddings.total > status.embeddings.with_embeddings) {
            console.log('\n  Run "node src/cli.js embed" to generate missing embeddings.');
          }
        } else {
          // File-based import (backup mode)
          const result = await ingestVendorEvidence({
            dryRun: options['dry-run'],
            forceReingest: options.force,
            exportPath: options.path,
          });

          console.log('\n=== Vendor Evidence Ingestion Results ===');
          console.log('(File-based backup mode - primary mode is direct DB write from test-data-tracker)');
          console.log(`\nStatus: ${result.success ? 'Success' : 'Completed with errors'}`);
          console.log('\nStats:');
          console.log(`  Total items: ${result.stats.total}`);
          console.log(`  New: ${result.stats.new}`);
          console.log(`  Updated: ${result.stats.updated}`);
          console.log(`  Skipped: ${result.stats.skipped}`);
          console.log(`  Failed: ${result.stats.failed}`);

          if (result.failed?.length > 0) {
            console.log('\nFailed items:');
            for (const f of result.failed.slice(0, 5)) {
              console.log(`  - ${f.source_id}: ${f.error}`);
            }
          }
        }
        break;
      }

      case 'seed': {
        const pubPath = options.publications;
        const srcPath = options.sources;
        const dryRun = options['dry-run'];
        const fetchAbstracts = !options['no-abstracts'];

        if (!pubPath && !srcPath) {
          console.log('Error: Specify --publications=<path> and/or --sources=<path>');
          console.log('Example: node src/cli.js seed --publications=/path/to/mrd_seed_publications.csv');
          break;
        }

        console.log('\n=== Seed Data Ingestion ===');
        if (dryRun) console.log('(Dry run mode - no changes will be made)\n');

        if (pubPath) {
          console.log(`\nLoading publications from: ${pubPath}`);
          const pubStats = await ingestPublications(pubPath, { dryRun, fetchAbstracts });
          console.log('\nPublication Results:');
          console.log(`  Total: ${pubStats.total}`);
          console.log(`  New: ${pubStats.new}`);
          console.log(`  Updated: ${pubStats.updated}`);
          console.log(`  Failed: ${pubStats.failed}`);
          if (pubStats.abstractsFetched) {
            console.log(`  Abstracts fetched: ${pubStats.abstractsFetched}`);
          }
        }

        if (srcPath) {
          console.log(`\nLoading sources from: ${srcPath}`);
          const srcStats = await ingestSources(srcPath, { dryRun });
          console.log('\nSource Results:');
          console.log(`  Total: ${srcStats.total}`);
          console.log(`  New: ${srcStats.new}`);
          console.log(`  Updated: ${srcStats.updated}`);
          console.log(`  Failed: ${srcStats.failed}`);
        }

        console.log('\nDone! Run "node src/cli.js embed" to generate embeddings for new items.');
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
