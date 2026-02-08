/**
 * Daily AI-Powered Operations Report
 * Uses Claude to analyze system health and generate insights
 */

import Anthropic from '@anthropic-ai/sdk';
import { sendEmail } from './index.js';
import { getHealthSummary } from '../health.js';
import { query } from '../db/client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('daily-ai-report');

const anthropic = new Anthropic();

async function gatherSystemData() {
  const health = getHealthSummary();

  // Get counts and recent activity
  const [
    totals,
    recentItemsCount,
    recentItemsSample,
    recentTrials,
    sourceBreakdown,
    recentErrors,
    embeddingCoverage,
    staleSources,
    failedCrawlerRuns,
    lastSuccessfulRuns,
  ] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*) FROM mrd_guidance_items) as guidance_items,
        (SELECT COUNT(*) FROM mrd_clinical_trials) as clinical_trials,
        (SELECT COUNT(*) FROM mrd_item_embeddings) as embeddings
    `),
    // Get actual count of new items (not limited)
    query(`
      SELECT COUNT(*) as count
      FROM mrd_guidance_items
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `),
    // Get sample of recent items for AI to analyze
    query(`
      SELECT source_type, title, created_at
      FROM mrd_guidance_items
      WHERE created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 20
    `),
    query(`
      SELECT nct_number, brief_title, status, updated_at
      FROM mrd_clinical_trials
      WHERE updated_at > NOW() - INTERVAL '24 hours'
      ORDER BY updated_at DESC
      LIMIT 10
    `),
    query(`
      SELECT source_type, COUNT(*) as count,
             MAX(created_at) as latest
      FROM mrd_guidance_items
      GROUP BY source_type
      ORDER BY count DESC
    `),
    query(`
      SELECT source_type, title, created_at
      FROM mrd_guidance_items
      WHERE created_at > NOW() - INTERVAL '7 days'
        AND (title ILIKE '%error%' OR title ILIKE '%fail%')
      LIMIT 5
    `),
    query(`
      SELECT
        (SELECT COUNT(*) FROM mrd_guidance_items) as total_items,
        (SELECT COUNT(*) FROM mrd_item_embeddings) as embedded_items
    `),
    query(`
      SELECT source_key, source_type,
             EXTRACT(days FROM NOW() - COALESCE(last_release_at, created_at)) as days_stale
      FROM mrd_sources
      WHERE is_active = TRUE
        AND EXTRACT(days FROM NOW() - COALESCE(last_release_at, created_at)) > stale_threshold_days
      ORDER BY days_stale DESC
      LIMIT 5
    `),
    query(`
      SELECT crawler_name, error_message, completed_at
      FROM mrd_crawler_runs
      WHERE status = 'failed'
        AND completed_at > NOW() - INTERVAL '24 hours'
      ORDER BY completed_at DESC
      LIMIT 5
    `),
    // Get last successful run for each crawler to detect broken crons
    query(`
      SELECT DISTINCT ON (crawler_name)
             crawler_name, status, completed_at, items_found, items_new
      FROM mrd_crawler_runs
      WHERE status = 'completed'
      ORDER BY crawler_name, completed_at DESC
    `),
  ]);

  // Calculate embedding coverage
  const coverage = embeddingCoverage.rows[0];
  const embeddingPercent = coverage.total_items > 0
    ? Math.round((coverage.embedded_items / coverage.total_items) * 100)
    : 0;

  // Count pending proposals from test-data-tracker
  const pendingProposals = await countPendingProposals();

  // Generate CC action items focused on what needs human attention
  const ccActionItems = generateCCActionItems({
    staleSources: staleSources.rows,
    failedCrawlerRuns: failedCrawlerRuns.rows,
    lastSuccessfulRuns: lastSuccessfulRuns.rows,
    pendingProposals,
    embeddingPercent,
    health,
  });

  return {
    timestamp: new Date().toISOString(),
    health,
    totals: totals.rows[0],
    recentItemsCount: parseInt(recentItemsCount.rows[0].count),
    recentItemsSample: recentItemsSample.rows,
    recentTrials: recentTrials.rows,
    sourceBreakdown: sourceBreakdown.rows,
    potentialIssues: recentErrors.rows,
    embeddingCoverage: `${embeddingPercent}%`,
    ccActionItems,
  };
}

/**
 * Count pending proposals from test-data-tracker data directory.
 * These are the items that actually need human review in Claude Code.
 *
 * Works in two modes:
 * - Local dev (monorepo): reads proposals from ../test-data-tracker/data/proposals/
 * - Railway: fetches count from test-data-tracker /api/proposals/stats endpoint
 */
async function countPendingProposals() {
  const zeroCounts = { total: 0, coverage: 0, 'new-tests': 0, updates: 0, 'delegation-changes': 0 };

  // Try Railway internal URL first (if configured)
  const trackerUrl = process.env.TEST_DATA_TRACKER_URL;
  if (trackerUrl) {
    try {
      const res = await fetch(`${trackerUrl}/api/proposals/stats`);
      if (res.ok) return await res.json();
    } catch (e) {
      logger.warn('Failed to fetch proposal stats from test-data-tracker', { error: e.message });
    }
  }

  // Fallback: read from filesystem (works in local dev / monorepo)
  try {
    const { resolve, join } = await import('path');
    const { readdir, readFile } = await import('fs/promises');

    const proposalsBase = resolve(process.cwd(), '..', 'test-data-tracker', 'data', 'proposals');
    const subdirs = ['coverage', 'new-tests', 'updates', 'delegation-changes'];
    const counts = { ...zeroCounts };

    for (const subdir of subdirs) {
      try {
        const dir = join(proposalsBase, subdir);
        const files = await readdir(dir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const data = JSON.parse(await readFile(join(dir, file), 'utf8'));
            if (data.status === 'pending') {
              counts[subdir]++;
              counts.total++;
            }
          } catch { /* skip unreadable files */ }
        }
      } catch { /* dir may not exist */ }
    }

    return counts;
  } catch {
    return zeroCounts;
  }
}

/**
 * Crawlers managed by cron — staleness for these is informational only,
 * not an action item (unless the cron itself has stopped running).
 */
const CRON_MANAGED_CRAWLERS = new Set([
  'pubmed', 'clinicaltrials', 'fda', 'fda-drugs', 'fda-devices',
  'cms-lcd', 'monitor', 'embed', 'link',
]);

/**
 * Detect crawlers whose cron jobs appear broken (no successful run in 3+ days)
 */
function detectBrokenCrons(lastSuccessfulRuns) {
  const broken = [];
  const now = Date.now();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  for (const run of lastSuccessfulRuns) {
    if (!CRON_MANAGED_CRAWLERS.has(run.crawler_name)) continue;
    const lastSuccess = new Date(run.completed_at).getTime();
    const daysSince = Math.round((now - lastSuccess) / (24 * 60 * 60 * 1000));
    if (now - lastSuccess > THREE_DAYS_MS) {
      broken.push({ name: run.crawler_name, daysSince });
    }
  }

  return broken;
}

/**
 * Generate Claude Code action items focused on what needs human attention:
 * 1. Pending proposals (the primary reason to open Claude Code)
 * 2. Crawler failures (something broke)
 * 3. Broken cron jobs (crawler hasn't succeeded in 3+ days)
 * 4. Critical system errors
 *
 * NOT included: routine stale source warnings for cron-managed crawlers.
 * Those run automatically and don't need manual intervention.
 */
function generateCCActionItems({ staleSources, failedCrawlerRuns, lastSuccessfulRuns, pendingProposals, embeddingPercent, health }) {
  const items = [];

  // #1: Pending proposals — the main reason to come to Claude Code
  if (pendingProposals.total > 0) {
    const parts = [];
    if (pendingProposals.coverage > 0) parts.push(`${pendingProposals.coverage} coverage`);
    if (pendingProposals['new-tests'] > 0) parts.push(`${pendingProposals['new-tests']} new tests`);
    if (pendingProposals.updates > 0) parts.push(`${pendingProposals.updates} updates`);
    if (pendingProposals['delegation-changes'] > 0) parts.push(`${pendingProposals['delegation-changes']} delegation changes`);

    items.push({
      type: 'pending-proposals',
      priority: 'high',
      title: `${pendingProposals.total} proposals awaiting review (${parts.join(', ')})`,
      prompt: `Review and apply pending proposals. Run /proposals in Claude Code.`,
    });
  }

  // #2: Crawler failures in the last 24h — something actually broke
  for (const run of failedCrawlerRuns) {
    items.push({
      type: 'crawler-failure',
      priority: 'high',
      title: `${run.crawler_name} crawler failed`,
      prompt: `The ${run.crawler_name} crawler failed with: "${run.error_message}". Check Railway logs and re-run if needed.`,
    });
  }

  // #3: Broken cron jobs — crawler hasn't succeeded in 3+ days
  const brokenCrons = detectBrokenCrons(lastSuccessfulRuns);
  for (const cron of brokenCrons) {
    items.push({
      type: 'broken-cron',
      priority: 'high',
      title: `${cron.name} cron appears broken (no success in ${cron.daysSince} days)`,
      prompt: `The ${cron.name} crawler hasn't completed successfully in ${cron.daysSince} days. Check Railway deployment and logs. The cron job may have stopped.`,
    });
  }

  // #4: Critical system errors
  if (health.errorCount > 5) {
    items.push({
      type: 'errors',
      priority: 'high',
      title: `${health.errorCount} errors in the last 7 days`,
      prompt: `Investigate recent errors. Check Railway logs for patterns.`,
    });
  }

  // #5: Severe embedding backlog only (below 90%, not 95%)
  if (embeddingPercent < 90) {
    items.push({
      type: 'embedding-backlog',
      priority: 'medium',
      title: `Embedding coverage at ${embeddingPercent}% — below 90% threshold`,
      prompt: `Embedding backlog is significant. Check if the embed cron is running on Railway.`,
    });
  }

  return items;
}

async function generateAIReport(systemData) {
  const prompt = `You are an operations analyst for OpenOnco, a medical informatics system that tracks MRD (Molecular Residual Disease) testing guidance for oncologists.

Analyze this system health data and write a concise daily operations email. Be direct and actionable.

SYSTEM DATA:
${JSON.stringify(systemData, null, 2)}

Write an email with these sections:
1. **Status Summary** (1-2 sentences - is everything healthy?)
2. **Today's Activity** (bullet points of what happened in last 24h)
3. **Data Quality** (embedding coverage, any gaps in sources)
4. **Issues & Recommendations** (only if there are actual problems — crawler failures, broken crons, critical errors)
5. **Key Numbers** (quick stats table)

IMPORTANT context about this system:
- All crawlers (PubMed, FDA, ClinicalTrials, CMS, RSS monitor, embeddings) run automatically on cron jobs via Railway. Do NOT tell the user to manually run crawlers unless one has actually failed or its cron appears broken.
- Stale data sources are normal between cron runs. Only flag staleness if it indicates a broken cron (3+ days with no successful run).
- The CC Action Items section (generated separately) handles actionable items. Your report should focus on what happened, not duplicate those action items.
- The main reason the user opens Claude Code is to review pending proposals, not to babysit crawlers.

Style guidelines:
- Be concise, not verbose
- Only flag things that actually need human attention
- Skip sections if nothing relevant to report
- Use plain text formatting (no markdown headers, use CAPS for section names)
- Keep total length under 200 words — shorter is better when everything is healthy`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  return response.content[0].text;
}

export async function sendDailyAIReport() {
  logger.info('Generating daily AI operations report');

  try {
    // Gather all system data
    const systemData = await gatherSystemData();
    logger.info('System data gathered', {
      items: systemData.totals.guidance_items,
      recentActivity: systemData.recentItemsCount
    });

    // Generate AI analysis
    const aiReport = await generateAIReport(systemData);
    logger.info('AI report generated');

    // Determine status for subject line
    const hasErrors = systemData.health.errorCount > 0;
    const hasActionItems = systemData.ccActionItems.length > 0;
    const hasPendingProposals = systemData.ccActionItems.some(i => i.type === 'pending-proposals');

    let statusEmoji = '✅';
    let statusNote = `${systemData.recentItemsCount} new today`;
    if (hasErrors || systemData.ccActionItems.some(i => i.type === 'crawler-failure' || i.type === 'broken-cron')) {
      statusEmoji = '⚠️';
      statusNote = 'action needed';
    } else if (hasPendingProposals) {
      statusEmoji = '📋';
      const proposalItem = systemData.ccActionItems.find(i => i.type === 'pending-proposals');
      statusNote = proposalItem.title;
    } else if (!hasActionItems) {
      statusEmoji = '✅';
      statusNote = 'all clear';
    }

    const subject = `${statusEmoji} OpenOnco Daily: ${statusNote}`;

    // Generate CC action items HTML — only shown when there's something that needs human attention
    const ccItemsHtml = systemData.ccActionItems.length > 0
      ? `
  <div class="cc-actions">
    <h3>Action Needed</h3>
    <p style="color: #64748b; font-size: 12px;">These items need your attention in Claude Code:</p>
    ${systemData.ccActionItems.map(item => `
    <div class="action-item ${item.priority}">
      <div class="action-header">
        <span class="priority-badge">${item.priority.toUpperCase()}</span>
        <strong>${item.title}</strong>
      </div>
      <div class="prompt-box">
        <code>${item.prompt}</code>
      </div>
    </div>
    `).join('')}
  </div>`
      : `
  <div style="margin-top: 24px; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
    <strong style="color: #059669;">No action needed today.</strong>
    <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">All crawlers running on schedule. No pending proposals.</p>
  </div>`;

    // Format email
    const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
  pre { background: #f8fafc; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 14px; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
  .cc-actions { margin-top: 24px; padding-top: 16px; border-top: 2px solid #10b981; }
  .cc-actions h3 { color: #10b981; margin-bottom: 8px; }
  .action-item { margin: 12px 0; padding: 12px; border-radius: 8px; border-left: 4px solid #e2e8f0; background: #f8fafc; }
  .action-item.high { border-left-color: #ef4444; }
  .action-item.medium { border-left-color: #f59e0b; }
  .action-item.low { border-left-color: #3b82f6; }
  .action-header { margin-bottom: 8px; }
  .priority-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-right: 8px; }
  .high .priority-badge { background: #fee2e2; color: #dc2626; }
  .medium .priority-badge { background: #fef3c7; color: #d97706; }
  .low .priority-badge { background: #dbeafe; color: #2563eb; }
  .prompt-box { background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 4px; font-size: 13px; overflow-x: auto; }
  .prompt-box code { white-space: pre-wrap; word-break: break-word; }
</style></head>
<body>
  <pre>${aiReport}</pre>
  ${ccItemsHtml}
  <div class="footer">
    Generated by Claude at ${new Date().toLocaleString()}<br>
    <a href="https://physician-system-production.up.railway.app/health">Health Endpoint</a>
  </div>
</body>
</html>`;

    // Plain text version
    const ccItemsText = systemData.ccActionItems.length > 0
      ? `\n\n--- ACTION NEEDED ---\n${systemData.ccActionItems.map(item =>
          `[${item.priority.toUpperCase()}] ${item.title}\n→ ${item.prompt}`
        ).join('\n\n')}`
      : '\n\n--- No action needed today. All crawlers on schedule. ---';

    const text = `${aiReport}${ccItemsText}\n\n---\nGenerated by Claude at ${new Date().toLocaleString()}`;

    await sendEmail({ subject, html, text });
    logger.info('Daily AI report sent');

    return { success: true, subject };
  } catch (error) {
    logger.error('Failed to generate daily AI report', { error: error.message });

    // Send error notification
    await sendEmail({
      subject: '❌ OpenOnco MRD Daily Report Failed',
      text: `Failed to generate daily report: ${error.message}\n\nCheck logs for details.`,
      html: `<p>Failed to generate daily report:</p><pre>${error.message}</pre><p>Check logs for details.</p>`,
    });

    throw error;
  }
}

export default { sendDailyAIReport };
