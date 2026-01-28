#!/usr/bin/env node

/**
 * Manual pipeline runner for OpenOnco daemon
 *
 * Usage:
 *   node scripts/run-pipeline.js --crawl     Run all crawlers
 *   node scripts/run-pipeline.js --triage    Run AI triage on queued discoveries
 *   node scripts/run-pipeline.js --digest    Send the daily digest email
 *   node scripts/run-pipeline.js --all       Run full pipeline: crawl → triage → digest
 */

import 'dotenv/config';
import { runAllCrawlersNow, triggerTriage, triggerDigest, triggerExport } from '../src/scheduler.js';

// ── Formatting helpers ───────────────────────────────────────────────

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

function banner(text) {
  const line = '═'.repeat(text.length + 4);
  console.log(`\n${CYAN}╔${line}╗`);
  console.log(`║  ${BOLD}${text}${RESET}${CYAN}  ║`);
  console.log(`╚${line}╝${RESET}\n`);
}

function step(label) {
  console.log(`${CYAN}▸${RESET} ${BOLD}${label}${RESET}`);
}

function success(label, detail) {
  const extra = detail ? `  ${DIM}${detail}${RESET}` : '';
  console.log(`  ${GREEN}✓${RESET} ${label}${extra}`);
}

function fail(label, detail) {
  const extra = detail ? `  ${DIM}${detail}${RESET}` : '';
  console.log(`  ${RED}✗${RESET} ${label}${extra}`);
}

function warn(msg) {
  console.log(`  ${YELLOW}⚠${RESET} ${msg}`);
}

function elapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Pipeline stages ──────────────────────────────────────────────────

async function runCrawlStage() {
  step('Running all crawlers...');
  const t0 = Date.now();

  const results = await runAllCrawlersNow();
  const dt = Date.now() - t0;

  let totalDiscoveries = 0;
  let totalAdded = 0;
  let failures = 0;

  for (const [source, result] of Object.entries(results)) {
    if (result.success) {
      const found = result.discoveries?.length ?? 0;
      const added = result.added ?? 0;
      totalDiscoveries += found;
      totalAdded += added;
      success(source, `${found} found, ${added} new (${elapsed(result.duration ?? 0)})`);
    } else {
      failures++;
      fail(source, result.error || 'unknown error');
    }
  }

  console.log();
  console.log(`  ${DIM}Total: ${totalDiscoveries} discoveries, ${totalAdded} new, ${failures} failures (${elapsed(dt)})${RESET}`);
  return { totalDiscoveries, totalAdded, failures, duration: dt };
}

async function runTriageStage() {
  step('Running AI triage...');
  const t0 = Date.now();

  const result = await triggerTriage();
  const dt = Date.now() - t0;

  const high = result.highPriority?.length ?? 0;
  const medium = result.mediumPriority?.length ?? 0;
  const low = result.lowPriority?.length ?? 0;
  const ignored = result.ignored?.length ?? 0;
  const cost = result.metadata?.costs?.totalCost;
  const calls = result.metadata?.costs?.apiCalls;

  success('Classification complete', `high=${high} medium=${medium} low=${low} ignored=${ignored}`);
  if (cost != null) {
    success('API usage', `${calls} calls, $${Number(cost).toFixed(4)}`);
  }
  console.log(`  ${DIM}Duration: ${elapsed(dt)}${RESET}`);

  return { high, medium, low, ignored, cost, duration: dt };
}

async function runDigestStage() {
  step('Sending daily digest email...');
  const t0 = Date.now();

  const result = await triggerDigest();
  const dt = Date.now() - t0;

  if (result.success) {
    success('Digest sent', result.messageId || '');
  } else {
    fail('Digest failed', result.error || 'unknown error');
  }

  console.log(`  ${DIM}Duration: ${elapsed(dt)}${RESET}`);
  return { success: result.success, duration: dt };
}

async function runExportStage() {
  step('Exporting discoveries to GitHub...');
  const t0 = Date.now();

  const result = await triggerExport();
  const dt = Date.now() - t0;

  if (result.success) {
    success('Export complete', result.url || '');
    if (result.emailSent) {
      success('Summary email sent', result.emailMessageId || '');
    }
  } else {
    fail('Export failed', result.error || 'unknown error');
  }

  console.log(`  ${DIM}Duration: ${elapsed(dt)}${RESET}`);
  return { success: result.success, url: result.url, duration: dt };
}

// ── Main ─────────────────────────────────────────────────────────────

const USAGE = `
${BOLD}Usage:${RESET}  node scripts/run-pipeline.js <flag>

${BOLD}Flags:${RESET}
  --crawl    Run all crawlers
  --triage   Run AI triage on queued discoveries
  --digest   Send the daily digest email
  --export   Export discoveries to GitHub + send summary email
  --all      Run full pipeline: crawl → triage → export
  --help     Show this help message
`;

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.map(a => a.toLowerCase()));

  if (flags.has('--help') || flags.has('-h') || args.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  const runCrawl = flags.has('--crawl') || flags.has('--all');
  const runTriage = flags.has('--triage') || flags.has('--all');
  const runDigest = flags.has('--digest');
  const runExport = flags.has('--export') || flags.has('--all');

  if (!runCrawl && !runTriage && !runDigest && !runExport) {
    console.error(`${RED}Unknown flag: ${args.join(' ')}${RESET}`);
    console.log(USAGE);
    process.exit(1);
  }

  const stages = [
    runCrawl && 'crawl',
    runTriage && 'triage',
    runDigest && 'digest',
    runExport && 'export',
  ].filter(Boolean);

  banner(`OpenOnco Pipeline: ${stages.join(' → ')}`);

  const t0 = Date.now();
  const results = {};

  try {
    if (runCrawl) {
      results.crawl = await runCrawlStage();
      if (runTriage || runDigest || runExport) console.log();
    }

    if (runTriage) {
      results.triage = await runTriageStage();
      if (runDigest || runExport) console.log();
    }

    if (runDigest) {
      results.digest = await runDigestStage();
      if (runExport) console.log();
    }

    if (runExport) {
      results.export = await runExportStage();
    }
  } catch (error) {
    console.error(`\n${RED}${BOLD}Pipeline failed:${RESET} ${error.message}`);
    if (error.stack) {
      console.error(`${DIM}${error.stack}${RESET}`);
    }
    process.exit(1);
  }

  const totalDuration = Date.now() - t0;

  console.log(`\n${GREEN}${BOLD}Pipeline complete${RESET} ${DIM}(${elapsed(totalDuration)})${RESET}\n`);
}

main().catch((error) => {
  console.error(`${RED}${BOLD}Fatal error:${RESET} ${error.message}`);
  if (error.stack) {
    console.error(`${DIM}${error.stack}${RESET}`);
  }
  process.exit(1);
});
