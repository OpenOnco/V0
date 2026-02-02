#!/usr/bin/env node

/**
 * File Watcher CLI for MRD Guidance Monitor
 *
 * Usage:
 *   node src/crawlers/mrd/file-cli.js scan [--dry-run] [--force] [--source=nccn]
 *   node src/crawlers/mrd/file-cli.js process <path> [--force]
 *   node src/crawlers/mrd/file-cli.js list
 *   node src/crawlers/mrd/file-cli.js status
 *   node src/crawlers/mrd/file-cli.js reset <path>
 */

import 'dotenv/config';
import path from 'path';
import {
  scanWatchedFiles,
  processFile,
  getFileStatus,
  listFiles,
  resetFile,
  loadManifest,
} from './file-watcher.js';
import { close } from '../db/client.js';

function parseArgs(args) {
  const result = {
    command: args[0] || 'help',
    positional: [],
    options: {},
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      result.options[key] = value === undefined ? true : value;
    } else if (arg.startsWith('-')) {
      result.options[arg.slice(1)] = true;
    } else {
      result.positional.push(arg);
    }
  }

  return result;
}

function showHelp() {
  console.log(`
MRD Guidance Monitor - File Watcher CLI

Usage:
  npm run mrd:files -- <command> [options]

Commands:
  scan              Scan for new/changed files and process them
  process <path>    Process a specific file
  list              List all tracked files
  status            Show files needing processing
  reset <path>      Mark file for reprocessing
  help              Show this help message

Options for 'scan':
  --dry-run         Show what would be processed without doing it
  --force           Reprocess all files even if unchanged
  --source=<type>   Only process files from specific source (nccn, asco, etc.)

Options for 'process':
  --force           Process even if unchanged

Examples:
  # Check what files need processing
  npm run mrd:files -- status

  # Process all new/changed files
  npm run mrd:files -- scan

  # Dry run to see what would be processed
  npm run mrd:files -- scan --dry-run

  # Process only NCCN files
  npm run mrd:files -- scan --source=nccn

  # Process a specific file
  npm run mrd:files -- process nccn/colon-2024.pdf

  # Force reprocess a file
  npm run mrd:files -- process nccn/colon-2024.pdf --force

Directory Structure:
  watched-files/
  ├── nccn/              NCCN Clinical Practice Guidelines
  ├── asco/              ASCO Practice Guidelines
  ├── esmo/              ESMO Consensus Statements
  ├── sitc/              SITC Consensus Documents
  ├── cap-amp/           CAP/AMP Laboratory Guidance
  └── payer-criteria/    Payer UM Criteria
      ├── carelon/       Carelon/eviCore criteria
      └── moldx/         Medicare MolDX LCDs
`);
}

async function main() {
  const { command, positional, options } = parseArgs(process.argv.slice(2));

  try {
    switch (command) {
      case 'scan': {
        console.log('Scanning watched files...\n');

        const results = await scanWatchedFiles({
          dryRun: options['dry-run'],
          force: options.force,
          source: options.source,
        });

        if (options['dry-run']) {
          console.log('=== Dry Run Results ===\n');
        } else {
          console.log('=== Scan Results ===\n');
        }

        if (results.new.length > 0) {
          console.log(`New files (${results.new.length}):`);
          results.new.forEach((f) => console.log(`  + ${f}`));
          console.log();
        }

        if (results.changed.length > 0) {
          console.log(`Changed files (${results.changed.length}):`);
          results.changed.forEach((f) => console.log(`  ~ ${f}`));
          console.log();
        }

        if (results.unchanged.length > 0) {
          console.log(`Unchanged files: ${results.unchanged.length}`);
          console.log();
        }

        if (!options['dry-run']) {
          if (results.processed.length > 0) {
            console.log(`Successfully processed (${results.processed.length}):`);
            results.processed.forEach((f) => console.log(`  ✓ ${f}`));
            console.log();
          }

          if (results.errors.length > 0) {
            console.log(`Errors (${results.errors.length}):`);
            results.errors.forEach((e) => console.log(`  ✗ ${e.path}: ${e.error}`));
            console.log();
          }
        }

        console.log('Summary:');
        console.log(`  New: ${results.new.length}`);
        console.log(`  Changed: ${results.changed.length}`);
        console.log(`  Unchanged: ${results.unchanged.length}`);
        if (!options['dry-run']) {
          console.log(`  Processed: ${results.processed.length}`);
          console.log(`  Errors: ${results.errors.length}`);
        }
        break;
      }

      case 'process': {
        const filePath = positional[0];
        if (!filePath) {
          console.error('Error: Please provide a file path');
          console.log('Usage: npm run mrd:files -- process <path>');
          process.exit(1);
        }

        // Resolve path relative to watched-files if not absolute
        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.join(process.cwd(), 'watched-files', filePath);

        console.log(`Processing: ${filePath}\n`);

        const result = await processFile(fullPath, {
          force: options.force,
        });

        console.log('=== Processing Result ===\n');
        console.log(`Status: ${result.status}`);
        console.log(`Path: ${result.path}`);

        if (result.sourceType) {
          console.log(`Source: ${result.sourceType}`);
        }

        if (result.result) {
          console.log('\nExtraction Results:');
          console.log(JSON.stringify(result.result, null, 2));
        }

        if (result.error) {
          console.log(`\nError: ${result.error}`);
        }
        break;
      }

      case 'list': {
        const data = listFiles();

        console.log('=== Tracked Files ===\n');

        if (Object.keys(data.files).length === 0) {
          console.log('No files tracked yet.');
          console.log('Place PDF files in watched-files/ subdirectories and run "scan".');
        } else {
          for (const [filePath, info] of Object.entries(data.files)) {
            const status = info.error ? '✗' : info.processed_at ? '✓' : '○';
            const items = info.metadata?.items_extracted || 0;
            console.log(`${status} ${filePath}`);
            console.log(`    Source: ${info.source_type}, Items: ${items}, Hash: ${info.sha256?.substring(0, 12)}`);
            if (info.processed_at) {
              console.log(`    Processed: ${info.processed_at}`);
            }
            if (info.error) {
              console.log(`    Error: ${info.error}`);
            }
          }
        }

        console.log('\n=== Statistics ===');
        console.log(`Total files: ${data.statistics.total_files}`);
        console.log(`Processed: ${data.statistics.total_processed}`);
        console.log(`Last scan: ${data.last_scan || 'never'}`);

        if (Object.keys(data.statistics.by_source).length > 0) {
          console.log('\nBy source:');
          for (const [source, count] of Object.entries(data.statistics.by_source)) {
            console.log(`  ${source}: ${count}`);
          }
        }
        break;
      }

      case 'status': {
        const status = getFileStatus();

        console.log('=== File Status ===\n');

        if (status.needs_processing.length > 0) {
          console.log(`Files needing processing (${status.needs_processing.length}):`);
          for (const file of status.needs_processing) {
            if (file.status === 'new') {
              console.log(`  + ${file.path} (new)`);
            } else {
              console.log(`  ~ ${file.path} (changed: ${file.old_hash} → ${file.new_hash})`);
            }
          }
          console.log();
        }

        if (status.has_errors.length > 0) {
          console.log(`Files with errors (${status.has_errors.length}):`);
          for (const file of status.has_errors) {
            console.log(`  ✗ ${file.path}: ${file.error}`);
          }
          console.log();
        }

        const currentFiles = status.tracked.filter((f) => f.status === 'current');
        if (currentFiles.length > 0) {
          console.log(`Up to date (${currentFiles.length}):`);
          for (const file of currentFiles) {
            console.log(`  ✓ ${file.path} (${file.items || 0} items)`);
          }
          console.log();
        }

        console.log('Summary:');
        console.log(`  Need processing: ${status.needs_processing.length}`);
        console.log(`  Have errors: ${status.has_errors.length}`);
        console.log(`  Up to date: ${currentFiles.length}`);

        if (status.needs_processing.length > 0) {
          console.log('\nRun "npm run mrd:files -- scan" to process pending files.');
        }
        break;
      }

      case 'reset': {
        const filePath = positional[0];
        if (!filePath) {
          console.error('Error: Please provide a file path');
          console.log('Usage: npm run mrd:files -- reset <path>');
          process.exit(1);
        }

        const result = resetFile(filePath);

        if (result.status === 'reset') {
          console.log(`Reset: ${filePath}`);
          console.log('File will be reprocessed on next scan.');
        } else {
          console.log(`File not found in manifest: ${filePath}`);
        }
        break;
      }

      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await close();
  }
}

main();
