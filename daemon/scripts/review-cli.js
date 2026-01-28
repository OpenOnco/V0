#!/usr/bin/env node

/**
 * Interactive CLI for reviewing daemon recommendations
 *
 * Usage:
 *   node scripts/review-cli.js              Review pending recommendations
 *   node scripts/review-cli.js --all        Include already-reviewed recommendations
 *   node scripts/review-cli.js --stats      Show summary stats only
 *   node scripts/review-cli.js --generate   Generate recommendations for pending discoveries first
 *   node scripts/review-cli.js --generate --limit 3  Generate for only N pending discoveries
 */

import 'dotenv/config';
import { createInterface } from 'readline';
import {
  loadRecommendations,
  approveRecommendation,
  rejectRecommendation,
  saveRecommendation,
  generateRecommendation,
  loadTestDataById,
} from '../src/triage/recommendations.js';
import { loadDiscoveries } from '../src/queue/store.js';
import { processDiscoveryFull } from '../src/triage/index.js';

// ── ANSI formatting ──────────────────────────────────────────────────

const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const RESET = '\x1b[0m';
const RED   = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN  = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[37m';
const BG_RED    = '\x1b[41m';
const BG_GREEN  = '\x1b[42m';
const BG_YELLOW = '\x1b[43m';
const BG_CYAN   = '\x1b[46m';

// ── Helpers ──────────────────────────────────────────────────────────

function badge(text, bg) {
  return `${bg}${BOLD} ${text} ${RESET}`;
}

function actionBadge(action) {
  const badges = {
    update:      badge('UPDATE', BG_CYAN),
    delete:      badge('DELETE', BG_RED),
    no_action:   badge('NO ACTION', BG_YELLOW),
    needs_human: badge('NEEDS HUMAN', BG_YELLOW),
  };
  return badges[action] || badge(action.toUpperCase(), BG_YELLOW);
}

function statusBadge(status) {
  const badges = {
    pending:  `${YELLOW}● pending${RESET}`,
    approved: `${GREEN}✓ approved${RESET}`,
    rejected: `${RED}✗ rejected${RESET}`,
  };
  return badges[status] || status;
}

function confidenceBar(confidence) {
  const pct = Math.round(confidence * 100);
  const filled = Math.round(confidence * 20);
  const empty = 20 - filled;
  const color = pct >= 80 ? GREEN : pct >= 50 ? YELLOW : RED;
  return `${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${RESET} ${BOLD}${pct}%${RESET}`;
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function formatDate(iso) {
  if (!iso) return 'n/a';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function hr() {
  console.log(`${DIM}${'─'.repeat(72)}${RESET}`);
}

// ── Display functions ────────────────────────────────────────────────

function showStats(recommendations, discoveries) {
  const pending  = recommendations.filter(r => r.status === 'pending').length;
  const approved = recommendations.filter(r => r.status === 'approved').length;
  const rejected = recommendations.filter(r => r.status === 'rejected').length;
  const total    = recommendations.length;

  const unreviewedDisc = discoveries.filter(d => d.status !== 'reviewed').length;

  console.log(`\n${CYAN}${BOLD}  OpenOnco Review Dashboard${RESET}\n`);
  hr();
  console.log(`  Recommendations:  ${BOLD}${total}${RESET} total`);
  console.log(`    ${YELLOW}●${RESET} Pending:    ${BOLD}${pending}${RESET}`);
  console.log(`    ${GREEN}✓${RESET} Approved:   ${BOLD}${approved}${RESET}`);
  console.log(`    ${RED}✗${RESET} Rejected:   ${BOLD}${rejected}${RESET}`);
  hr();
  console.log(`  Discoveries:      ${BOLD}${discoveries.length}${RESET} total, ${BOLD}${unreviewedDisc}${RESET} unreviewed`);
  hr();
  console.log('');
}

function showRecommendationSummary(rec, index, total) {
  console.log('');
  hr();
  console.log(`  ${DIM}[${index + 1}/${total}]${RESET}  ${actionBadge(rec.action)}  ${statusBadge(rec.status)}  Confidence: ${confidenceBar(rec.confidence)}`);
  hr();
  console.log(`  ${BOLD}Test:${RESET}       ${rec.testName} ${DIM}(${rec.testId})${RESET}`);
  console.log(`  ${BOLD}Reasoning:${RESET}  ${truncate(rec.reasoning, 60)}`);
  console.log(`  ${BOLD}Created:${RESET}    ${formatDate(rec.createdAt)}`);

  if (rec.edits.length > 0) {
    console.log(`  ${BOLD}Edits:${RESET}      ${rec.edits.length} proposed change${rec.edits.length === 1 ? '' : 's'}`);
    showDiff(rec.edits);
  }

  if (rec.coverageUpdates.length > 0) {
    console.log(`  ${BOLD}Coverage:${RESET}   ${rec.coverageUpdates.length} update${rec.coverageUpdates.length === 1 ? '' : 's'}`);
    for (const cu of rec.coverageUpdates) {
      console.log(`              ${MAGENTA}${cu.type}${RESET} ${cu.payer}: ${BOLD}${cu.status}${RESET}${cu.effectiveDate ? ` (${cu.effectiveDate})` : ''}`);
    }
  }

  console.log('');
}

function showDiff(edits) {
  for (const edit of edits) {
    const field = `${BOLD}${edit.field}${RESET}`;
    const oldVal = edit.oldValue != null ? String(edit.oldValue) : '(empty)';
    const newVal = edit.newValue != null ? String(edit.newValue) : '(empty)';

    console.log(`              ${DIM}${edit.field}:${RESET}`);
    console.log(`                ${RED}- ${truncate(oldVal, 55)}${RESET}`);
    console.log(`                ${GREEN}+ ${truncate(newVal, 55)}${RESET}`);
    if (edit.citation) {
      console.log(`                ${DIM}↳ ${edit.citation}${RESET}`);
    }
  }
}

function showFullDetails(rec, discovery) {
  console.log('');
  console.log(`${CYAN}${BOLD}═══ Full Details ═══${RESET}`);
  console.log('');

  console.log(`${BOLD}Recommendation ID:${RESET} ${rec.id}`);
  console.log(`${BOLD}Discovery ID:${RESET}      ${rec.discoveryId}`);
  console.log(`${BOLD}Test:${RESET}              ${rec.testName} (${rec.testId})`);
  console.log(`${BOLD}Action:${RESET}            ${rec.action}`);
  console.log(`${BOLD}Confidence:${RESET}        ${(rec.confidence * 100).toFixed(0)}%`);
  console.log(`${BOLD}Status:${RESET}            ${rec.status}`);
  console.log(`${BOLD}Created:${RESET}           ${rec.createdAt}`);

  if (rec.reviewedAt) {
    console.log(`${BOLD}Reviewed:${RESET}          ${rec.reviewedAt}`);
    console.log(`${BOLD}Reviewed by:${RESET}       ${rec.reviewedBy || 'n/a'}`);
    console.log(`${BOLD}Review notes:${RESET}      ${rec.reviewNotes || 'n/a'}`);
  }

  console.log('');
  console.log(`${BOLD}Reasoning:${RESET}`);
  console.log(`  ${rec.reasoning}`);

  if (rec.edits.length > 0) {
    console.log('');
    console.log(`${BOLD}Proposed Edits:${RESET}`);
    for (const edit of rec.edits) {
      console.log(`  ${BOLD}${edit.field}${RESET}`);
      console.log(`    ${RED}old:${RESET} ${edit.oldValue ?? '(empty)'}`);
      console.log(`    ${GREEN}new:${RESET} ${edit.newValue ?? '(empty)'}`);
      if (edit.citation) {
        console.log(`    ${DIM}cite: ${edit.citation}${RESET}`);
      }
      if (edit.citationUrl) {
        console.log(`    ${DIM}url:  ${edit.citationUrl}${RESET}`);
      }
    }
  }

  if (rec.coverageUpdates.length > 0) {
    console.log('');
    console.log(`${BOLD}Coverage Updates:${RESET}`);
    for (const cu of rec.coverageUpdates) {
      console.log(`  ${MAGENTA}[${cu.type}]${RESET} ${cu.payer}`);
      console.log(`    Status: ${BOLD}${cu.status}${RESET}`);
      if (cu.effectiveDate) console.log(`    Effective: ${cu.effectiveDate}`);
      if (cu.source) console.log(`    ${DIM}Source: ${cu.source}${RESET}`);
    }
  }

  if (rec.sources.length > 0) {
    console.log('');
    console.log(`${BOLD}Sources:${RESET}`);
    for (const src of rec.sources) {
      console.log(`  ${DIM}•${RESET} ${src}`);
    }
  }

  if (discovery) {
    console.log('');
    console.log(`${BOLD}Source Discovery:${RESET}`);
    console.log(`  Title:  ${discovery.title}`);
    console.log(`  Source: ${discovery.source} / ${discovery.type}`);
    console.log(`  URL:    ${discovery.url || 'n/a'}`);
    if (discovery.data?.relevance) {
      console.log(`  Relevance: ${discovery.data.relevance}`);
    }
  }

  console.log('');
  console.log(`${CYAN}${BOLD}═══════════════════${RESET}`);
  console.log('');
}

// ── Interactive loop ────────────────────────────────────────────────

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function reviewLoop(recommendations, discoveriesMap) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const total = recommendations.length;
  let reviewed = 0;
  let approved = 0;
  let rejected = 0;
  let skipped = 0;
  let i = 0;

  console.log(`\n${CYAN}${BOLD}  Interactive Review${RESET}  ${DIM}(${total} recommendation${total === 1 ? '' : 's'} to review)${RESET}`);
  console.log(`  ${DIM}Commands: ${WHITE}a${DIM}=approve  ${WHITE}r${DIM}=reject  ${WHITE}s${DIM}=skip  ${WHITE}v${DIM}=view details  ${WHITE}q${DIM}=quit${RESET}\n`);

  while (i < total) {
    const rec = recommendations[i];
    const discovery = discoveriesMap.get(rec.discoveryId) || null;

    showRecommendationSummary(rec, i, total);

    let acted = false;
    while (!acted) {
      const answer = (await prompt(rl, `  ${CYAN}▸${RESET} Action: `)).trim().toLowerCase();

      switch (answer) {
        case 'a': {
          const result = approveRecommendation(rec.id, { reviewedBy: 'review-cli' });
          if (result) {
            console.log(`  ${GREEN}✓ Approved${RESET}`);
            approved++;
          } else {
            console.log(`  ${RED}✗ Failed to approve (recommendation not found)${RESET}`);
          }
          reviewed++;
          acted = true;
          break;
        }

        case 'r': {
          const notes = (await prompt(rl, `  ${DIM}Reason (optional):${RESET} `)).trim();
          const result = rejectRecommendation(rec.id, {
            reviewedBy: 'review-cli',
            notes: notes || null,
          });
          if (result) {
            console.log(`  ${RED}✗ Rejected${RESET}`);
            rejected++;
          } else {
            console.log(`  ${RED}✗ Failed to reject (recommendation not found)${RESET}`);
          }
          reviewed++;
          acted = true;
          break;
        }

        case 's':
          console.log(`  ${YELLOW}→ Skipped${RESET}`);
          skipped++;
          acted = true;
          break;

        case 'v':
          showFullDetails(rec, discovery);
          // Don't advance — show prompt again
          break;

        case 'q':
          console.log('');
          hr();
          console.log(`  ${BOLD}Session summary:${RESET}`);
          console.log(`    ${GREEN}✓${RESET} Approved:  ${BOLD}${approved}${RESET}`);
          console.log(`    ${RED}✗${RESET} Rejected:  ${BOLD}${rejected}${RESET}`);
          console.log(`    ${YELLOW}→${RESET} Skipped:   ${BOLD}${skipped}${RESET}`);
          console.log(`    ${DIM}Remaining: ${total - i}${RESET}`);
          hr();
          console.log('');
          rl.close();
          return;

        default:
          console.log(`  ${DIM}Unknown command. Use: a=approve  r=reject  s=skip  v=view  q=quit${RESET}`);
          break;
      }
    }

    i++;
  }

  // All done
  console.log('');
  hr();
  console.log(`  ${GREEN}${BOLD}All recommendations reviewed!${RESET}`);
  console.log(`    ${GREEN}✓${RESET} Approved:  ${BOLD}${approved}${RESET}`);
  console.log(`    ${RED}✗${RESET} Rejected:  ${BOLD}${rejected}${RESET}`);
  console.log(`    ${YELLOW}→${RESET} Skipped:   ${BOLD}${skipped}${RESET}`);
  hr();
  console.log('');

  rl.close();
}

// ── Generation ──────────────────────────────────────────────────────

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate recommendations for pending discoveries that don't already
 * have a recommendation. Processes in batches to avoid rate limits.
 *
 * @param {Object[]} discoveries - All discoveries
 * @param {Recommendation[]} existingRecs - Already-generated recommendations
 * @param {number} [limit=Infinity] - Maximum number of discoveries to process
 * @returns {Promise<number>} Number of recommendations generated
 */
async function generateRecommendationsForDiscoveries(discoveries, existingRecs, limit = Infinity) {
  // Find discoveries that are pending and don't already have a recommendation
  const existingDiscoveryIds = new Set(existingRecs.map(r => r.discoveryId));
  let pending = discoveries.filter(
    d => d.status === 'pending' && !existingDiscoveryIds.has(d.id)
  );

  const totalPending = pending.length;
  if (limit < pending.length) {
    pending = pending.slice(0, limit);
  }

  if (pending.length === 0) {
    console.log(`  ${YELLOW}⚠${RESET}  No pending discoveries without recommendations.\n`);
    return 0;
  }

  console.log(`\n${CYAN}${BOLD}  Generating Recommendations${RESET}`);
  const limitNote = limit < totalPending ? ` (limited to ${limit} of ${totalPending})` : '';
  console.log(`  ${DIM}${pending.length} pending discovery(ies)${limitNote}, batch size ${BATCH_SIZE}${RESET}\n`);

  let generated = 0;
  let failed = 0;

  for (let batch = 0; batch < pending.length; batch += BATCH_SIZE) {
    const chunk = pending.slice(batch, batch + BATCH_SIZE);
    const batchNum = Math.floor(batch / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pending.length / BATCH_SIZE);

    console.log(`  ${DIM}[Batch ${batchNum}/${totalBatches}]${RESET}`);

    for (const discovery of chunk) {
      const label = truncate(discovery.title || discovery.id, 50);
      process.stdout.write(`    ${DIM}▸${RESET} ${label}… `);

      try {
        // Run through full triage pipeline
        const triageResult = await processDiscoveryFull(discovery);

        if (triageResult.skipped) {
          console.log(`${YELLOW}skipped${RESET} ${DIM}(${triageResult.skipReason})${RESET}`);
          continue;
        }

        // Look up test data if the triage identified a test
        const testId = triageResult.testId || discovery.data?.testId;
        const testData = testId ? await loadTestDataById(testId) : null;

        // Generate structured recommendation via Claude
        const rec = await generateRecommendation(discovery, testData);

        if (rec) {
          saveRecommendation(rec);
          generated++;
          console.log(`${GREEN}✓${RESET} ${actionBadge(rec.action)}`);
        } else {
          failed++;
          console.log(`${RED}✗ no recommendation produced${RESET}`);
        }
      } catch (err) {
        failed++;
        console.log(`${RED}✗ ${err.message}${RESET}`);
      }
    }

    // Delay between batches (skip after the last one)
    if (batch + BATCH_SIZE < pending.length) {
      process.stdout.write(`    ${DIM}⏱ Waiting between batches…${RESET}`);
      await sleep(BATCH_DELAY_MS);
      process.stdout.write(`\r${''.padEnd(60)}\r`);
    }
  }

  console.log('');
  hr();
  console.log(`  ${BOLD}Generation complete:${RESET}`);
  console.log(`    ${GREEN}✓${RESET} Generated: ${BOLD}${generated}${RESET}`);
  if (failed > 0) {
    console.log(`    ${RED}✗${RESET} Failed:    ${BOLD}${failed}${RESET}`);
  }
  hr();
  console.log('');

  return generated;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const rawArgs = process.argv.slice(2);
  const args = new Set(rawArgs.map(a => a.toLowerCase()));

  // Parse --limit N
  let limit = Infinity;
  const limitIdx = rawArgs.findIndex(a => a.toLowerCase() === '--limit');
  if (limitIdx !== -1 && limitIdx + 1 < rawArgs.length) {
    const n = parseInt(rawArgs[limitIdx + 1], 10);
    if (!isNaN(n) && n > 0) limit = n;
  }

  // Load data
  const discoveries = loadDiscoveries();
  const discoveriesMap = new Map(discoveries.map(d => [d.id, d]));

  const showAll = args.has('--all');
  const statsOnly = args.has('--stats');
  const generate = args.has('--generate');

  let allRecs = loadRecommendations();

  if (statsOnly) {
    showStats(allRecs, discoveries);
    return;
  }

  // Generate recommendations for pending discoveries before reviewing
  if (generate) {
    await generateRecommendationsForDiscoveries(discoveries, allRecs, limit);
    // Reload after generation
    allRecs = loadRecommendations();
  }

  const toReview = showAll
    ? allRecs
    : allRecs.filter(r => r.status === 'pending');

  showStats(allRecs, discoveries);

  if (toReview.length === 0) {
    console.log(`  ${YELLOW}⚠${RESET}  No ${showAll ? '' : 'pending '}recommendations to review.\n`);
    return;
  }

  await reviewLoop(toReview, discoveriesMap);
}

main().catch(err => {
  console.error(`\n${RED}${BOLD}Fatal error:${RESET} ${err.message}`);
  if (err.stack) {
    console.error(`${DIM}${err.stack}${RESET}`);
  }
  process.exit(1);
});
