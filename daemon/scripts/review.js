#!/usr/bin/env node

/**
 * Interactive recommendation review CLI
 *
 * Review pending recommendations generated from discoveries. For each recommendation,
 * displays test info, proposed changes, confidence, reasoning, and sources.
 * Approve, reject, skip, or view full details interactively.
 *
 * If a discovery doesn't have a recommendation yet, can optionally generate one
 * using the triage module (Claude AI).
 *
 * Usage:
 *   node scripts/review.js                Review pending recommendations
 *   node scripts/review.js --generate     Generate recs for discoveries that lack them
 *   node scripts/review.js --stats        Show summary stats only
 *   node scripts/review.js --type X       Filter by discovery type (e.g. broken_url, publication)
 *   node scripts/review.js --limit N      Only review first N items
 */

import 'dotenv/config';
import { createInterface } from 'readline';
import chalk from 'chalk';
import { loadDiscoveries } from '../src/queue/store.js';
import {
  loadRecommendations,
  approveRecommendation,
  rejectRecommendation,
  generateRecommendation,
  saveRecommendation,
  loadTestDataById,
} from '../src/triage/recommendations.js';

// ── Helpers ──────────────────────────────────────────────────────────

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

function formatDate(iso) {
  if (!iso) return chalk.dim('n/a');
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function hr() {
  console.log(chalk.dim('─'.repeat(72)));
}

function typeBadge(type) {
  const colors = {
    broken_url:        chalk.bgRed.bold,
    redirect_url:      chalk.bgYellow.bold,
    missing_citation:  chalk.bgYellow.bold,
    publication:       chalk.bgGreen.bold,
    preprint:          chalk.bgCyan.bold,
    payer_policy_new:  chalk.bgMagenta.bold,
    vendor_update:     chalk.bgBlue.bold,
    fda_update:        chalk.bgBlue.bold,
    news:              chalk.bgWhite.black.bold,
  };
  const fmt = colors[type] || chalk.bgGray.bold;
  return fmt(` ${(type || 'unknown').toUpperCase().replace(/_/g, ' ')} `);
}

function statusBadge(status) {
  switch (status) {
    case 'pending':  return chalk.yellow('● pending');
    case 'reviewed': return chalk.green('✓ reviewed');
    case 'approved': return chalk.green('✓ approved');
    case 'rejected': return chalk.red('✗ rejected');
    case 'skipped':  return chalk.dim('→ skipped');
    default:         return chalk.dim(status || 'unknown');
  }
}

function sourceBadge(source) {
  const colors = {
    vendor_crawler: chalk.cyan,
    vendor:         chalk.cyan,
    pubmed:         chalk.green,
    preprints:      chalk.blue,
    cms_crawler:    chalk.magenta,
    cms:            chalk.magenta,
    fda_crawler:    chalk.yellow,
    payer_crawler:  chalk.magenta,
    payers:         chalk.magenta,
    news_crawler:   chalk.white,
  };
  const fmt = colors[source] || chalk.dim;
  return fmt(source || 'unknown');
}

function confidenceBar(confidence) {
  if (confidence == null) return chalk.dim('n/a');
  const pct = Math.round(confidence * 100);
  const filled = Math.round(confidence * 20);
  const empty = 20 - filled;
  const color = pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
  return color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty)) + ' ' + chalk.bold(`${pct}%`);
}

function actionBadge(action) {
  const badges = {
    update:      chalk.bgCyan.bold(' UPDATE '),
    delete:      chalk.bgRed.bold(' DELETE '),
    no_action:   chalk.bgYellow.bold(' NO ACTION '),
    needs_human: chalk.bgYellow.bold(' NEEDS HUMAN '),
  };
  return badges[action] || chalk.bgGray.bold(` ${(action || 'unknown').toUpperCase()} `);
}

// ── Display ──────────────────────────────────────────────────────────

function showStats(discoveries, recommendations) {
  const pending  = discoveries.filter(d => d.status === 'pending').length;
  const approved = discoveries.filter(d => d.status === 'approved').length;
  const rejected = discoveries.filter(d => d.status === 'rejected').length;
  const reviewed = discoveries.filter(d => d.status === 'reviewed').length;
  const total    = discoveries.length;

  // Type breakdown
  const byType = {};
  for (const d of discoveries) {
    const t = d.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
  }

  // Source breakdown
  const bySource = {};
  for (const d of discoveries) {
    const s = d.source || 'unknown';
    bySource[s] = (bySource[s] || 0) + 1;
  }

  console.log('');
  console.log(chalk.cyan.bold('  OpenOnco Discovery Review'));
  console.log('');
  hr();
  console.log(`  Discoveries:  ${chalk.bold(total)} total`);
  console.log(`    ${chalk.yellow('●')} Pending:    ${chalk.bold(pending)}`);
  console.log(`    ${chalk.green('✓')} Approved:   ${chalk.bold(approved)}`);
  console.log(`    ${chalk.red('✗')} Rejected:   ${chalk.bold(rejected)}`);
  console.log(`    ${chalk.dim('◌')} Reviewed:   ${chalk.bold(reviewed)}`);
  hr();

  if (recommendations.length > 0) {
    const recPending  = recommendations.filter(r => r.status === 'pending').length;
    const recApproved = recommendations.filter(r => r.status === 'approved').length;
    const recRejected = recommendations.filter(r => r.status === 'rejected').length;
    console.log(`  Recommendations: ${chalk.bold(recommendations.length)} total`);
    console.log(`    ${chalk.yellow('●')} Pending:    ${chalk.bold(recPending)}`);
    console.log(`    ${chalk.green('✓')} Approved:   ${chalk.bold(recApproved)}`);
    console.log(`    ${chalk.red('✗')} Rejected:   ${chalk.bold(recRejected)}`);
    hr();
  }

  if (Object.keys(byType).length > 0) {
    console.log(`  ${chalk.bold('By type:')}`);
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${typeBadge(type)} ${chalk.bold(count)}`);
    }
    hr();
  }

  if (Object.keys(bySource).length > 0) {
    console.log(`  ${chalk.bold('By source:')}`);
    for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${sourceBadge(source)}  ${chalk.bold(count)}`);
    }
    hr();
  }

  console.log('');
}

function showDiscoverySummary(discovery, rec, index, total) {
  console.log('');
  hr();
  console.log(
    `  ${chalk.dim(`[${index + 1}/${total}]`)}  ` +
    `${typeBadge(discovery.type)}  ` +
    `${statusBadge(discovery.status)}`
  );
  hr();
  console.log(`  ${chalk.bold('Title:')}     ${truncate(discovery.title, 60)}`);
  console.log(`  ${chalk.bold('Source:')}    ${sourceBadge(discovery.source)}`);
  console.log(`  ${chalk.bold('Found:')}     ${formatDate(discovery.discoveredAt)}`);

  if (discovery.summary) {
    console.log(`  ${chalk.bold('Summary:')}   ${truncate(discovery.summary, 60)}`);
  }

  if (discovery.url) {
    console.log(`  ${chalk.bold('URL:')}       ${chalk.dim(truncate(discovery.url, 60))}`);
  }

  // Show relevant data fields from the discovery
  if (discovery.data) {
    const d = discovery.data;
    if (d.testName) {
      console.log(`  ${chalk.bold('Test:')}      ${d.testName}${d.testId ? chalk.dim(` (${d.testId})`) : ''}`);
    }
    if (d.relevance) {
      const relColor = d.relevance === 'high' ? chalk.green : d.relevance === 'medium' ? chalk.yellow : chalk.dim;
      console.log(`  ${chalk.bold('Relevance:')} ${relColor(d.relevance)}`);
    }
    if (d.oldUrl && d.newUrl) {
      console.log(`  ${chalk.bold('Redirect:')}`);
      console.log(`    ${chalk.red('- ' + truncate(d.oldUrl, 55))}`);
      console.log(`    ${chalk.green('+ ' + truncate(d.newUrl, 55))}`);
    }
    if (d.field && (d.oldValue !== undefined || d.newValue !== undefined)) {
      console.log(`  ${chalk.bold('Change:')}`);
      console.log(`    ${chalk.dim(d.field + ':')}`);
      if (d.oldValue !== undefined) {
        console.log(`      ${chalk.red('- ' + truncate(String(d.oldValue), 50))}`);
      }
      if (d.newValue !== undefined) {
        console.log(`      ${chalk.green('+ ' + truncate(String(d.newValue), 50))}`);
      }
    }
  }

  // Show recommendation details if one exists
  if (rec) {
    console.log('');
    console.log(`  ${chalk.cyan.bold('── Recommendation ──')}`);
    console.log(`  ${chalk.bold('Test:')}       ${rec.testName || 'n/a'} ${chalk.dim(rec.testId ? `(${rec.testId})` : '')}`);
    console.log(`  ${chalk.bold('Action:')}     ${actionBadge(rec.action)}`);
    console.log(`  ${chalk.bold('Confidence:')} ${confidenceBar(rec.confidence)}`);
    console.log(`  ${chalk.bold('Reasoning:')}  ${truncate(rec.reasoning, 60)}`);

    if (rec.edits && rec.edits.length > 0) {
      console.log(`  ${chalk.bold('Changes:')}`);
      for (const edit of rec.edits) {
        const oldVal = edit.oldValue != null ? String(edit.oldValue) : '(empty)';
        const newVal = edit.newValue != null ? String(edit.newValue) : '(empty)';
        console.log(`    ${chalk.dim(edit.field + ':')}`);
        console.log(`      ${chalk.red('- ' + truncate(oldVal, 50))}`);
        console.log(`      ${chalk.green('+ ' + truncate(newVal, 50))}`);
        if (edit.citation) {
          console.log(`      ${chalk.dim('↳ ' + truncate(edit.citation, 50))}`);
        }
      }
    }

    if (rec.coverageUpdates && rec.coverageUpdates.length > 0) {
      console.log(`  ${chalk.bold('Coverage:')}`);
      for (const cu of rec.coverageUpdates) {
        console.log(`    ${chalk.magenta(`[${cu.type}]`)} ${cu.payer}: ${chalk.bold(cu.status)}${cu.effectiveDate ? ` (${cu.effectiveDate})` : ''}`);
      }
    }

    if (rec.sources && rec.sources.length > 0) {
      console.log(`  ${chalk.bold('Sources:')}   ${chalk.dim(rec.sources.map(s => truncate(s, 50)).join(', '))}`);
    }
  }

  console.log('');
}

function showFullDetails(discovery, rec) {
  console.log('');
  console.log(chalk.cyan.bold('═══ Full Discovery Details ═══'));
  console.log('');

  console.log(`${chalk.bold('ID:')}          ${discovery.id}`);
  console.log(`${chalk.bold('Source:')}      ${discovery.source}`);
  console.log(`${chalk.bold('Type:')}        ${discovery.type}`);
  console.log(`${chalk.bold('Status:')}      ${discovery.status}`);
  console.log(`${chalk.bold('Discovered:')} ${discovery.discoveredAt}`);

  if (discovery.reviewedAt) {
    console.log(`${chalk.bold('Reviewed:')}   ${discovery.reviewedAt}`);
  }
  if (discovery.reviewNotes) {
    console.log(`${chalk.bold('Notes:')}      ${discovery.reviewNotes}`);
  }

  console.log('');
  console.log(`${chalk.bold('Title:')}`);
  console.log(`  ${discovery.title || '(none)'}`);

  if (discovery.summary) {
    console.log('');
    console.log(`${chalk.bold('Summary:')}`);
    console.log(`  ${discovery.summary}`);
  }

  if (discovery.url) {
    console.log('');
    console.log(`${chalk.bold('URL:')}`);
    console.log(`  ${discovery.url}`);
  }

  if (discovery.data && Object.keys(discovery.data).length > 0) {
    console.log('');
    console.log(`${chalk.bold('Data:')}`);
    for (const [key, value] of Object.entries(discovery.data)) {
      const display = typeof value === 'object'
        ? JSON.stringify(value, null, 2).split('\n').join('\n    ')
        : String(value);
      console.log(`  ${chalk.dim(key + ':')} ${display}`);
    }
  }

  // Show full recommendation details if available
  if (rec) {
    console.log('');
    console.log(chalk.cyan.bold('═══ Recommendation Details ═══'));
    console.log('');

    console.log(`${chalk.bold('Rec ID:')}       ${rec.id}`);
    console.log(`${chalk.bold('Test:')}         ${rec.testName || 'n/a'} (${rec.testId || 'n/a'})`);
    console.log(`${chalk.bold('Action:')}       ${rec.action}`);
    console.log(`${chalk.bold('Confidence:')}   ${(rec.confidence * 100).toFixed(0)}%`);
    console.log(`${chalk.bold('Status:')}       ${rec.status}`);
    console.log(`${chalk.bold('Created:')}      ${rec.createdAt}`);

    if (rec.reviewedAt) {
      console.log(`${chalk.bold('Reviewed:')}     ${rec.reviewedAt}`);
      console.log(`${chalk.bold('Reviewed by:')}  ${rec.reviewedBy || 'n/a'}`);
      console.log(`${chalk.bold('Review notes:')} ${rec.reviewNotes || 'n/a'}`);
    }

    console.log('');
    console.log(`${chalk.bold('Reasoning:')}`);
    console.log(`  ${rec.reasoning}`);

    if (rec.edits && rec.edits.length > 0) {
      console.log('');
      console.log(`${chalk.bold('Proposed Edits:')}`);
      for (const edit of rec.edits) {
        console.log(`  ${chalk.bold(edit.field)}`);
        console.log(`    ${chalk.red('old:')} ${edit.oldValue ?? '(empty)'}`);
        console.log(`    ${chalk.green('new:')} ${edit.newValue ?? '(empty)'}`);
        if (edit.citation) {
          console.log(`    ${chalk.dim('cite: ' + edit.citation)}`);
        }
        if (edit.citationUrl) {
          console.log(`    ${chalk.dim('url:  ' + edit.citationUrl)}`);
        }
      }
    }

    if (rec.coverageUpdates && rec.coverageUpdates.length > 0) {
      console.log('');
      console.log(`${chalk.bold('Coverage Updates:')}`);
      for (const cu of rec.coverageUpdates) {
        console.log(`  ${chalk.magenta(`[${cu.type}]`)} ${cu.payer}`);
        console.log(`    Status: ${chalk.bold(cu.status)}`);
        if (cu.effectiveDate) console.log(`    Effective: ${cu.effectiveDate}`);
        if (cu.source) console.log(`    ${chalk.dim('Source: ' + cu.source)}`);
      }
    }

    if (rec.sources && rec.sources.length > 0) {
      console.log('');
      console.log(`${chalk.bold('Sources:')}`);
      for (const src of rec.sources) {
        console.log(`  ${chalk.dim('•')} ${src}`);
      }
    }
  }

  console.log('');
  console.log(chalk.cyan.bold('═════════════════════════════'));
  console.log('');
}

// ── Interactive loop ─────────────────────────────────────────────────

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function showSessionSummary(approved, rejected, skipped, generated, remaining) {
  console.log('');
  hr();
  if (remaining === 0) {
    console.log(chalk.green.bold('  All recommendations reviewed!'));
  } else {
    console.log(chalk.bold('  Session summary:'));
  }
  console.log(`    ${chalk.green('✓')} Approved:   ${chalk.bold(approved)}`);
  console.log(`    ${chalk.red('✗')} Rejected:   ${chalk.bold(rejected)}`);
  console.log(`    ${chalk.yellow('→')} Skipped:    ${chalk.bold(skipped)}`);
  if (generated > 0) {
    console.log(`    ${chalk.cyan('+')} Generated:  ${chalk.bold(generated)}`);
  }
  if (remaining > 0) {
    console.log(`    ${chalk.dim(`Remaining: ${remaining}`)}`);
  }
  hr();
  console.log('');
}

async function reviewLoop(recommendations, discoveryMap, options = {}) {
  const { generateMissing = false } = options;

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let items = recommendations.map(rec => ({
    rec,
    discovery: discoveryMap.get(rec.discoveryId) || null,
  }));

  // Filter to only pending recommendations
  items = items.filter(item => item.rec.status === 'pending');

  const total = items.length;
  let approved = 0;
  let rejected = 0;
  let skipped = 0;
  let generated = 0;
  let i = 0;

  if (total === 0) {
    console.log(chalk.yellow('\n  No pending recommendations to review.\n'));
    rl.close();
    return { approved, rejected, skipped, generated };
  }

  console.log(
    `\n${chalk.cyan.bold('  Interactive Recommendation Review')}  ` +
    `${chalk.dim(`(${total} recommendation${total === 1 ? '' : 's'} to review)`)}`
  );
  console.log(
    `  ${chalk.dim('Commands:')} ` +
    `${chalk.white.bold('a')}${chalk.dim('=approve  ')}` +
    `${chalk.white.bold('r')}${chalk.dim('=reject  ')}` +
    `${chalk.white.bold('s')}${chalk.dim('=skip  ')}` +
    `${chalk.white.bold('v')}${chalk.dim('=view details  ')}` +
    `${chalk.white.bold('q')}${chalk.dim('=quit')}`
  );
  console.log('');

  while (i < total) {
    const { rec, discovery } = items[i];

    showDiscoverySummary(discovery, rec, i, total);

    let acted = false;
    while (!acted) {
      const answer = (await prompt(rl, `  ${chalk.cyan('▸')} Action: `)).trim().toLowerCase();

      switch (answer) {
        case 'a': {
          const notes = (await prompt(rl, `  ${chalk.dim('Approval notes (optional):')} `)).trim();
          const result = approveRecommendation(rec.id, {
            reviewedBy: 'cli',
            notes: notes || null,
          });
          if (result) {
            console.log(`  ${chalk.green('✓ Approved')}`);
            approved++;
          } else {
            console.log(`  ${chalk.red('✗ Failed (recommendation not found)')}`);
          }
          acted = true;
          break;
        }

        case 'r': {
          const notes = (await prompt(rl, `  ${chalk.dim('Rejection reason (optional):')} `)).trim();
          const result = rejectRecommendation(rec.id, {
            reviewedBy: 'cli',
            notes: notes || null,
          });
          if (result) {
            console.log(`  ${chalk.red('✗ Rejected')}`);
            rejected++;
          } else {
            console.log(`  ${chalk.red('✗ Failed (recommendation not found)')}`);
          }
          acted = true;
          break;
        }

        case 's':
          console.log(`  ${chalk.yellow('→ Skipped')}`);
          skipped++;
          acted = true;
          break;

        case 'v':
          showFullDetails(discovery, rec);
          break;

        case 'q':
          showSessionSummary(approved, rejected, skipped, generated, total - i);
          rl.close();
          return { approved, rejected, skipped, generated };

        default:
          console.log(`  ${chalk.dim('Unknown command. Use: a=approve  r=reject  s=skip  v=view  q=quit')}`);
          break;
      }
    }

    i++;
  }

  // All done
  showSessionSummary(approved, rejected, skipped, generated, 0);
  rl.close();
  return { approved, rejected, skipped, generated };
}

/**
 * Generate recommendations for pending discoveries that don't have one yet.
 */
async function generateMissingRecommendations(discoveries, existingRecIds, limit = 10) {
  const pending = discoveries.filter(
    d => d.status === 'pending' && !existingRecIds.has(d.id)
  );

  if (pending.length === 0) {
    console.log(chalk.dim('  No discoveries need recommendations generated.\n'));
    return [];
  }

  const toProcess = pending.slice(0, limit);
  console.log(
    `\n${chalk.cyan.bold('  Generating Recommendations')}  ` +
    `${chalk.dim(`(${toProcess.length} of ${pending.length} pending)`)}`
  );
  console.log('');

  const generated = [];

  for (let i = 0; i < toProcess.length; i++) {
    const discovery = toProcess[i];
    const label = truncate(discovery.title || discovery.id, 50);
    process.stdout.write(`  ${chalk.dim(`[${i + 1}/${toProcess.length}]`)} ${label}... `);

    try {
      // Load test data if available
      const testId = discovery.data?.testId;
      let testData = null;
      if (testId) {
        try {
          testData = await loadTestDataById(testId);
        } catch {
          // Non-fatal
        }
      }

      const rec = await generateRecommendation(discovery, testData, { useTools: true });
      if (rec) {
        saveRecommendation(rec);
        generated.push(rec);
        console.log(`${chalk.green('✓')} ${actionBadge(rec.action)}`);
      } else {
        console.log(chalk.yellow('⚠ no recommendation'));
      }
    } catch (err) {
      console.log(`${chalk.red('✗')} ${err.message}`);
    }
  }

  console.log('');
  if (generated.length > 0) {
    console.log(`  ${chalk.green('✓')} Generated ${chalk.bold(generated.length)} new recommendations\n`);
  }

  return generated;
}

// ── CLI arg parsing ──────────────────────────────────────────────────

function parseArgs() {
  const rawArgs = process.argv.slice(2);
  const flags = {
    generate: false,
    stats:    false,
    type:     null,
    limit:    null,
  };

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i].toLowerCase();
    switch (arg) {
      case '--generate':
        flags.generate = true;
        break;
      case '--stats':
        flags.stats = true;
        break;
      case '--type':
        if (i + 1 < rawArgs.length) flags.type = rawArgs[++i];
        break;
      case '--limit':
        if (i + 1 < rawArgs.length) flags.limit = parseInt(rawArgs[++i], 10);
        break;
      case '--help':
        console.log(`
  ${chalk.cyan.bold('OpenOnco Recommendation Review CLI')}

  ${chalk.bold('Usage:')}
    node scripts/review.js              Review pending recommendations
    node scripts/review.js --generate   Generate recs for discoveries that lack them
    node scripts/review.js --stats      Show summary stats only
    node scripts/review.js --type X     Filter by discovery type
    node scripts/review.js --limit N    Only review/generate first N items

  ${chalk.bold('Interactive commands:')}
    a  Approve recommendation (saves to recommendations.json)
    r  Reject recommendation (prompts for optional reason)
    s  Skip to next recommendation
    v  View full details (discovery + recommendation JSON)
    q  Quit review session

  ${chalk.bold('Discovery types:')}
    publication, vendor_update, payer_policy_new,
    broken_url, redirect_url, missing_citation, fda_update

  ${chalk.bold('Examples:')}
    ${chalk.dim('# Review all pending recommendations')}
    node scripts/review.js

    ${chalk.dim('# Generate recs for discoveries without them, then review')}
    node scripts/review.js --generate

    ${chalk.dim('# Review first 5 recommendations')}
    node scripts/review.js --limit 5
`);
        process.exit(0);
        break;
    }
  }

  return flags;
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const flags = parseArgs();

  const allDiscoveries = loadDiscoveries();

  if (allDiscoveries.length === 0) {
    console.log('');
    console.log(chalk.yellow('  No discoveries found.'));
    console.log(chalk.dim('  Run the crawlers first: npm run run:crawl'));
    console.log('');
    return;
  }

  // Load recommendations and index by discoveryId for quick lookup
  const allRecs = loadRecommendations();
  const recsMap = new Map();
  for (const rec of allRecs) {
    if (rec.discoveryId) {
      recsMap.set(rec.discoveryId, rec);
    }
  }

  if (flags.stats) {
    showStats(allDiscoveries, allRecs);
    return;
  }

  // Filter to reviewable set
  let toReview = flags.all
    ? [...allDiscoveries]
    : allDiscoveries.filter(d => d.status === 'pending');

  if (flags.type) {
    toReview = toReview.filter(d => d.type === flags.type);
  }

  if (flags.source) {
    toReview = toReview.filter(d => d.source === flags.source);
  }

  if (flags.limit != null && flags.limit > 0) {
    toReview = toReview.slice(0, flags.limit);
  }

  // Show dashboard
  showStats(allDiscoveries, allRecs);

  if (toReview.length === 0) {
    const filters = [];
    if (!flags.all) filters.push('pending');
    if (flags.type) filters.push(`type=${flags.type}`);
    if (flags.source) filters.push(`source=${flags.source}`);
    const desc = filters.length > 0 ? ` (${filters.join(', ')})` : '';
    console.log(chalk.yellow(`  No discoveries to review${desc}.`));
    console.log(chalk.dim('  Use --all to include already-reviewed discoveries.'));
    console.log('');
    return;
  }

  await reviewLoop(toReview, allDiscoveries, recsMap);
}

main().catch(err => {
  console.error(`\n${chalk.red.bold('Fatal error:')} ${err.message}`);
  if (err.stack) {
    console.error(chalk.dim(err.stack));
  }
  process.exit(1);
});
