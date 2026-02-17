#!/usr/bin/env node

/**
 * Auto-triage orchestrator.
 * Reads weekly submissions, calls Claude for each item, applies changes.
 *
 * Usage:
 *   node scripts/auto-triage/index.js [path-to-weekly-file]
 *
 * Environment:
 *   ANTHROPIC_API_KEY — required
 *   DRY_RUN=true     — log decisions without applying changes
 *   BATCH_SIZE=5     — parallel batch size (default 5)
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { triageItem } from './claude-client.js';
import { applyChanges, validateDataJs } from './applier.js';
import { resetDataJsCache } from './tools.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '5', 10);

/**
 * Find the most recent weekly submissions file
 */
function findWeeklyFile(explicitPath) {
  if (explicitPath) {
    const fullPath = resolve(explicitPath);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }
    return fullPath;
  }

  const submissionsDir = resolve(PROJECT_ROOT, 'test-data-tracker/data/submissions');
  const entries = readdirSync(submissionsDir)
    .filter(f => f.startsWith('weekly-') && f.endsWith('.json'));
  entries.sort().reverse(); // Most recent first

  if (entries.length === 0) {
    throw new Error(`No weekly files found in ${submissionsDir}`);
  }

  return resolve(submissionsDir, entries[0]);
}

/**
 * Process items in parallel batches
 */
async function processBatch(items) {
  const results = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(items.length / BATCH_SIZE)} (${batch.length} items)`);

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const decision = await triageItem(item);
          console.log(`  [${item.submissionId}] → ${decision.action}: ${decision.reason}`);
          return { item, decision, error: null };
        } catch (err) {
          console.error(`  [${item.submissionId}] ERROR: ${err.message}`);
          return {
            item,
            decision: {
              action: 'ESCALATE',
              reason: `API error: ${err.message}`,
              research_summary: '',
              changes: [],
            },
            error: err.message,
          };
        }
      })
    );
    results.push(...batchResults);
  }
  return results;
}

/**
 * Main orchestrator
 */
async function main() {
  const startTime = Date.now();
  const weeklyPath = findWeeklyFile(process.argv[2]);

  console.log(`\n=== Auto-Triage ${DRY_RUN ? '(DRY RUN)' : ''} ===`);
  console.log(`File: ${weeklyPath}`);

  // Read weekly file
  const weekly = JSON.parse(readFileSync(weeklyPath, 'utf-8'));
  console.log(`Week of: ${weekly.weekOf}`);
  console.log(`Total submissions: ${weekly.stats.total}`);

  // Filter to pending items only
  const pending = weekly.submissions.filter(s => s.status === 'pending');
  console.log(`Pending items: ${pending.length}`);

  if (pending.length === 0) {
    console.log('No pending items to triage.');
    setOutput('changes_made', 'false');
    setOutput('escalation_count', '0');
    setOutput('summary', 'No pending items');
    process.exit(0);
  }

  // Pre-filter: auto-ignore daemonScore <= 2
  const preFiltered = [];
  const toProcess = [];
  for (const item of pending) {
    const score = item.triageHint?.daemonScore || 0;
    if (score <= 2) {
      preFiltered.push(item);
    } else {
      toProcess.push(item);
    }
  }

  console.log(`Pre-filtered (daemonScore <= 2): ${preFiltered.length}`);
  console.log(`Items for Claude: ${toProcess.length}`);

  // Process with Claude
  const results = await processBatch(toProcess);

  // Categorize results
  const approved = results.filter(r => r.decision.action === 'APPROVE');
  const ignored = results.filter(r => r.decision.action === 'IGNORE');
  const escalated = results.filter(r => r.decision.action === 'ESCALATE');

  console.log(`\n--- Results ---`);
  console.log(`Approved: ${approved.length}`);
  console.log(`Ignored: ${ignored.length + preFiltered.length} (${preFiltered.length} pre-filtered + ${ignored.length} by Claude)`);
  console.log(`Escalated: ${escalated.length}`);

  // Apply approved changes
  let allChanges = [];
  const applierErrors = [];

  if (approved.length > 0 && !DRY_RUN) {
    for (const { item, decision } of approved) {
      if (decision.changes && decision.changes.length > 0) {
        allChanges.push(...decision.changes);
      }
    }

    if (allChanges.length > 0) {
      console.log(`\nApplying ${allChanges.length} change operations to data.js...`);
      const result = applyChanges(allChanges);
      console.log(`Applied: ${result.applied}, Errors: ${result.errors.length}`);

      if (result.errors.length > 0) {
        console.error('Applier errors:');
        for (const err of result.errors) {
          console.error(`  - ${err}`);
          applierErrors.push(err);
        }
      }

      // Reset data.js cache in tools.js
      resetDataJsCache();
    }
  }

  // Validate data.js
  if (allChanges.length > 0 && !DRY_RUN) {
    console.log('\nValidating data.js...');
    const validation = validateDataJs();
    if (!validation.valid) {
      console.error('Validation errors:');
      for (const err of validation.errors) {
        console.error(`  - ${err}`);
      }
    } else {
      console.log('Validation passed');
    }
  }

  // Update weekly file statuses
  if (!DRY_RUN) {
    for (const item of preFiltered) {
      const sub = weekly.submissions.find(s => s.submissionId === item.submissionId);
      if (sub) {
        sub.status = 'ignored';
        sub.triageResult = { action: 'IGNORE', reason: 'Pre-filtered: daemonScore <= 2', automated: true };
      }
    }
    for (const { item, decision } of results) {
      const sub = weekly.submissions.find(s => s.submissionId === item.submissionId);
      if (sub) {
        sub.status = decision.action === 'APPROVE' ? 'approved'
          : decision.action === 'IGNORE' ? 'ignored'
          : 'escalated';
        sub.triageResult = {
          action: decision.action,
          reason: decision.reason,
          research_summary: decision.research_summary,
          automated: true,
        };
      }
    }
    writeFileSync(weeklyPath, JSON.stringify(weekly, null, 2) + '\n', 'utf-8');
    console.log('Weekly file updated');
  }

  // Build PR body
  const duration = ((Date.now() - startTime) / 1000).toFixed(0);
  const prBody = buildPrBody({
    weekOf: weekly.weekOf,
    approved,
    ignored: [...ignored, ...preFiltered.map(item => ({ item, decision: { action: 'IGNORE', reason: 'Pre-filtered' } }))],
    escalated,
    applierErrors,
    duration,
    dryRun: DRY_RUN,
    allChanges,
  });

  writeFileSync('/tmp/triage-pr-body.md', prBody, 'utf-8');
  console.log('PR body written to /tmp/triage-pr-body.md');

  // Write escalation file for notify.js
  if (escalated.length > 0) {
    const escalationData = {
      weekOf: weekly.weekOf,
      items: escalated.map(({ item, decision }) => ({
        submissionId: item.submissionId,
        title: item.title,
        source: item.source,
        type: item.type,
        daemonScore: item.triageHint?.daemonScore,
        reason: decision.reason,
        research_summary: decision.research_summary,
      })),
    };
    writeFileSync('/tmp/triage-escalations.json', JSON.stringify(escalationData, null, 2), 'utf-8');
    console.log('Escalation file written to /tmp/triage-escalations.json');
  }

  // Set GitHub Action outputs
  const changesMade = approved.length > 0 && allChanges.length > 0 && !DRY_RUN;
  setOutput('changes_made', String(changesMade));
  setOutput('escalation_count', String(escalated.length));
  setOutput('summary', `Approved: ${approved.length}, Ignored: ${ignored.length + preFiltered.length}, Escalated: ${escalated.length}`);

  console.log(`\n=== Done in ${duration}s ===`);
}

/**
 * Build the PR body markdown
 */
function buildPrBody({ weekOf, approved, ignored, escalated, applierErrors, duration, dryRun, allChanges }) {
  const lines = [];
  lines.push(`## Auto-Triage: Week of ${weekOf}${dryRun ? ' (DRY RUN)' : ''}`);
  lines.push('');
  lines.push('### Summary');
  lines.push(`| Category | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Approved | ${approved.length} |`);
  lines.push(`| Ignored | ${ignored.length} |`);
  lines.push(`| Escalated | ${escalated.length} |`);
  lines.push(`| Duration | ${duration}s |`);
  lines.push(`| Changes applied | ${allChanges.length} |`);
  lines.push('');

  if (approved.length > 0) {
    lines.push('### Approved Changes');
    for (const { item, decision } of approved) {
      lines.push(`- **${item.title}** (${item.source})`);
      lines.push(`  - ${decision.reason}`);
    }
    lines.push('');
  }

  if (escalated.length > 0) {
    lines.push('### Escalated (Needs Human Review)');
    for (const { item, decision } of escalated) {
      lines.push(`- **${item.title}** (${item.source}, score: ${item.triageHint?.daemonScore || '?'})`);
      lines.push(`  - ${decision.reason}`);
      if (decision.research_summary) {
        lines.push(`  - Research: ${decision.research_summary}`);
      }
    }
    lines.push('');
  }

  if (applierErrors.length > 0) {
    lines.push('### Applier Errors');
    for (const err of applierErrors) {
      lines.push(`- ${err}`);
    }
    lines.push('');
  }

  if (ignored.length > 0) {
    lines.push('<details>');
    lines.push('<summary>Ignored items (' + ignored.length + ')</summary>');
    lines.push('');
    for (const { item, decision } of ignored) {
      lines.push(`- ${item.title} — ${decision.reason}`);
    }
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  lines.push('---');
  lines.push('Generated by auto-triage workflow');

  return lines.join('\n');
}

/**
 * Set a GitHub Actions output variable
 */
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
