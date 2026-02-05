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
import { crawlJournalRSS } from './journal-rss.js';
import { crawlConferenceAbstracts } from './conference-abstracts.js';
import { discoverNewSources } from './source-discovery.js';
import { processNccnPdf, processNccnDirectory } from './nccn-processor.js';
import { ingestCMSData, listCMSData } from './cms-ingest.js';
import { embedAllMissing } from '../../embeddings/mrd-embedder.js';
import { linkAllTrials } from '../../embeddings/cross-link.js';
import { runPublicationIndexCrawler, getPublicationSourceStatus } from '../publication-index.js';
import { enrichPublications, getEnrichmentStatus } from '../../enrichment/enrich-publications.js';
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
  journal-rss     Crawl journal RSS feeds for MRD-relevant articles
  conference      Crawl conference abstract databases (ASCO/ESMO)
  discover-sources  Audit tool: discover new sources, check stale/broken
  nccn            Process NCCN guideline PDFs
  cms             Ingest CMS MolDX LCDs for ctDNA/MRD
  publication-index  Extract publications from vendor/society pages
  enrich          Enrich publications with full text from PMC/Unpaywall
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

Options for 'journal-rss':
  --source=<key>  Crawl specific RSS source by source_key (e.g., rss-jco)
  --dry-run       Extract but don't write to database

Options for 'conference':
  --source=<key>  Crawl specific conference (e.g., asco-annual-meeting)
  --dry-run       Extract but don't write to database

Options for 'discover-sources':
  --stale         Only check stale/broken sources (skip vendor scan)

Options for 'nccn':
  --dir           Process all PDFs in directory
  <path>          Path to PDF file or directory (with --dir)

Options for 'cms':
  --list          List available LCDs without ingesting
  --dry-run       Show what would be ingested without writing

Options for 'embed':
  --limit=<n>     Max items to embed (default: 100)

Options for 'link':
  --limit=<n>     Max trials to link (default: 100)

Options for 'publication-index':
  --source=<key>  Crawl specific source by source_key
  --status        Show status of all publication sources
  --dry-run       Extract but don't write to database

Options for 'enrich':
  --limit=<n>     Max publications to enrich (default: 50)
  --status        Show enrichment status by source type
  --dry-run       Show what would be enriched without writing
  --no-re-embed   Skip re-generating embeddings after enrichment
  --source=<type> Only enrich specific source_type

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

  # Crawl journal RSS feeds for MRD-relevant articles
  node src/crawlers/mrd/cli.js journal-rss
  node src/crawlers/mrd/cli.js journal-rss --source=rss-jco
  node src/crawlers/mrd/cli.js journal-rss --dry-run

  # Crawl conference abstract databases
  node src/crawlers/mrd/cli.js conference
  node src/crawlers/mrd/cli.js conference --source=asco-annual-meeting
  node src/crawlers/mrd/cli.js conference --dry-run

  # Discover new sources and audit existing ones
  node src/crawlers/mrd/cli.js discover-sources
  node src/crawlers/mrd/cli.js discover-sources --stale

  # Extract publications from vendor/society pages
  node src/crawlers/mrd/cli.js publication-index

  # Crawl specific source
  node src/crawlers/mrd/cli.js publication-index --source=natera_signatera_publications

  # Dry run (extract but don't write)
  node src/crawlers/mrd/cli.js publication-index --dry-run

  # Check source status
  node src/crawlers/mrd/cli.js publication-index --status

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

      case 'journal-rss': {
        const result = await crawlJournalRSS({
          dryRun: options['dry-run'],
          sourceKey: options.source,
        });

        console.log('\n=== Journal RSS Crawl Results ===');
        console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
        console.log('\nStats:');
        console.log(`  Sources checked: ${result.stats.sources}`);
        console.log(`  RSS items found: ${result.stats.items}`);
        console.log(`  MRD-relevant: ${result.stats.relevant}`);
        console.log(`  Already processed: ${result.stats.alreadyProcessed}`);
        console.log(`  Resolved to PubMed: ${result.stats.resolved}`);
        console.log(`  Written: ${result.stats.written}`);
        console.log(`  New items: ${result.stats.newItems}`);
        console.log(`  Failed: ${result.stats.failed}`);
        break;
      }

      case 'conference': {
        const result = await crawlConferenceAbstracts({
          dryRun: options['dry-run'],
          sourceKey: options.source,
        });

        console.log('\n=== Conference Abstract Crawl Results ===');
        console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
        console.log('\nStats:');
        console.log(`  Conferences checked: ${result.stats.sources}`);
        console.log(`  Searches performed: ${result.stats.searchesPerformed}`);
        console.log(`  Abstracts found: ${result.stats.abstractsFound}`);
        console.log(`  Unique relevant: ${result.stats.relevant}`);
        console.log(`  Already processed: ${result.stats.alreadyProcessed}`);
        console.log(`  Resolved to PubMed: ${result.stats.resolved}`);
        console.log(`  Written: ${result.stats.written}`);
        console.log(`  New items: ${result.stats.newItems}`);
        console.log(`  Failed: ${result.stats.failed}`);
        break;
      }

      case 'discover-sources': {
        const result = await discoverNewSources({
          staleOnly: options.stale,
        });

        console.log('\n=== Source Discovery Audit Results ===');

        if (result.stale.length > 0) {
          console.log(`\nStale Sources (${result.stale.length}):`);
          for (const s of result.stale) {
            if (s.neverChecked) {
              console.log(`  ${s.sourceKey}: NEVER CHECKED - ${s.displayName}`);
            } else {
              console.log(`  ${s.sourceKey}: ${s.daysSinceCheck} days since check (threshold: ${s.threshold}) - ${s.displayName}`);
            }
          }
        } else {
          console.log('\nNo stale sources found.');
        }

        if (result.broken.length > 0) {
          console.log(`\nBroken Sources (${result.broken.length}):`);
          for (const b of result.broken) {
            console.log(`  ${b.sourceKey}: ${b.error} - ${b.url}`);
          }
        } else {
          console.log('\nNo broken sources found.');
        }

        if (result.candidates.length > 0) {
          console.log(`\nCandidate New Sources (${result.candidates.length}):`);
          for (const c of result.candidates) {
            console.log(`  ${c.vendor}: ${c.url}`);
            console.log(`    Suggested key: ${c.suggestedSourceKey}`);
            console.log(`    Suggested type: ${c.suggestedSourceType}`);
          }
        } else if (!options.stale) {
          console.log('\nNo new candidate sources found.');
        }

        if (result.affiliations.length > 0) {
          console.log(`\nActive Vendors (from PubMed affiliations, ${result.affiliations.length}):`);
          for (const a of result.affiliations) {
            console.log(`  ${a.vendor}: ${a.publicationCount} recent publications`);
          }
        }

        console.log('\nSummary:');
        console.log(`  Stale: ${result.stale.length}`);
        console.log(`  Broken: ${result.broken.length}`);
        console.log(`  Candidates: ${result.candidates.length}`);
        console.log(`  Active vendors: ${result.affiliations.length}`);
        break;
      }

      case 'nccn': {
        // Get the path from remaining args
        const pathArg = process.argv.slice(3).find(a => !a.startsWith('-'));

        if (!pathArg) {
          console.log('Error: Please provide a PDF path or directory');
          console.log('Usage:');
          console.log('  node src/crawlers/mrd/cli.js nccn /path/to/guideline.pdf');
          console.log('  node src/crawlers/mrd/cli.js nccn --dir /path/to/nccn-pdfs/');
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

      case 'publication-index': {
        if (options.status) {
          console.log('Checking publication source status...\n');
          const sources = await getPublicationSourceStatus();

          console.log('=== Publication Index Sources ===\n');
          if (sources.length === 0) {
            console.log('No active publication sources found in mrd_sources table.');
            console.log('Add sources with source_type in: vendor, vendor_publications_index, vendor_evidence_page, society_editorial, guideline_excerpt, news_review');
          } else {
            for (const source of sources) {
              console.log(`${source.source_key}`);
              console.log(`  Name: ${source.display_name}`);
              console.log(`  Type: ${source.source_type}`);
              console.log(`  URL: ${source.base_url || '(not set)'}`);
              console.log(`  Last checked: ${source.last_checked_at || 'never'}`);
              console.log(`  Days since check: ${source.days_since_check ?? 'N/A'}`);
              console.log('');
            }
          }
        } else {
          const result = await runPublicationIndexCrawler({
            dryRun: options['dry-run'],
            sourceKey: options.source,
          });

          console.log('\n=== Publication Index Crawl Results ===');
          console.log(`Status: ${result.success ? 'Success' : 'Failed'}`);
          console.log('\nStats:');
          console.log(`  Sources crawled: ${result.stats.sourcesCrawled}`);
          console.log(`  Sources unchanged: ${result.stats.sourcesUnchanged}`);
          console.log(`  Sources skipped: ${result.stats.sourcesSkipped}`);
          console.log(`  Sources failed: ${result.stats.sourcesFailed}`);
          console.log(`  Publications found: ${result.stats.publicationsFound}`);
          console.log(`  Resolved to PubMed: ${result.stats.resolvedToPubmed}`);
          console.log(`  New items: ${result.stats.newItems}`);
          console.log(`  Edges created: ${result.stats.edgesCreated}`);
        }
        break;
      }

      case 'enrich': {
        if (options.status) {
          console.log('Checking enrichment status...\n');
          const status = await getEnrichmentStatus();

          console.log('=== Publication Enrichment Status ===\n');
          console.log('Source Type          | Total | Full Text | Abstract | Minimal');
          console.log('---------------------|-------|-----------|----------|--------');
          for (const row of status) {
            console.log(
              `${row.source_type.padEnd(20)} | ${String(row.total).padStart(5)} | ${String(row.full_text).padStart(9)} | ${String(row.abstract_only).padStart(8)} | ${String(row.minimal).padStart(7)}`
            );
          }
        } else {
          console.log('Enriching publications with full text...\n');
          const result = await enrichPublications({
            limit: parseInt(options.limit || '50', 10),
            dryRun: options['dry-run'],
            reEmbed: !options['no-re-embed'],
            sourceType: options.source,
          });

          console.log('\n=== Enrichment Results ===');
          console.log(`  Processed: ${result.processed}`);
          console.log(`  Full text found: ${result.fullTextFound}`);
          console.log(`  Abstract only: ${result.abstractOnly}`);
          console.log(`  No content: ${result.noContent}`);
          console.log(`  Cancer types updated: ${result.cancerTypesUpdated}`);
          console.log(`  Clinical settings updated: ${result.clinicalSettingsUpdated}`);
          console.log(`  Re-embedded: ${result.reEmbedded}`);
          console.log(`  Errors: ${result.errors}`);
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

        // Journal RSS
        console.log('\n4. Journal RSS crawler...');
        await crawlJournalRSS({});

        // Conference abstracts
        console.log('\n5. Conference abstract crawler...');
        await crawlConferenceAbstracts({});

        // Embeddings
        console.log('\n6. Generating embeddings...');
        await embedAllMissing({ limit: 100 });

        // Trial linking
        console.log('\n7. Linking trials to publications...');
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
