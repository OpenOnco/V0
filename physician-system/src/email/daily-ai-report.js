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
    lowConfidenceItems,
    failedCrawlerRuns,
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
      SELECT source_key,
             EXTRACT(days FROM NOW() - COALESCE(last_release_at, created_at)) as days_stale
      FROM mrd_sources
      WHERE is_active = TRUE
        AND EXTRACT(days FROM NOW() - COALESCE(last_release_at, created_at)) > stale_threshold_days
      ORDER BY days_stale DESC
      LIMIT 5
    `),
    query(`
      SELECT id, title, source_type, relevance_score
      FROM mrd_guidance_items
      WHERE relevance_score < 5
        AND created_at > NOW() - INTERVAL '7 days'
      ORDER BY relevance_score ASC
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
  ]);

  // Calculate embedding coverage
  const coverage = embeddingCoverage.rows[0];
  const embeddingPercent = coverage.total_items > 0
    ? Math.round((coverage.embedded_items / coverage.total_items) * 100)
    : 0;

  // Generate CC action items with copy-paste prompts
  const ccActionItems = generateCCActionItems({
    staleSources: staleSources.rows,
    lowConfidenceItems: lowConfidenceItems.rows,
    failedCrawlerRuns: failedCrawlerRuns.rows,
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
 * Generate Claude Code action items with copy-paste prompts
 */
function generateCCActionItems({ staleSources, lowConfidenceItems, failedCrawlerRuns, embeddingPercent, health }) {
  const items = [];

  // Stale sources need version check
  for (const src of staleSources) {
    items.push({
      type: 'stale-source',
      priority: src.days_stale > 30 ? 'high' : 'medium',
      title: `${src.source_key} is ${Math.round(src.days_stale)} days stale`,
      prompt: `Check if there's a new version of ${src.source_key}. If it's an NCCN guideline, check their website for updates. Run: node src/cli.js version-watch`,
    });
  }

  // Low confidence items need review
  if (lowConfidenceItems.length > 0) {
    const ids = lowConfidenceItems.map(i => i.id).join(', ');
    items.push({
      type: 'low-confidence',
      priority: 'medium',
      title: `${lowConfidenceItems.length} low-confidence extractions need review`,
      prompt: `Review these low-confidence guidance items (IDs: ${ids}). Check if they're truly MRD-relevant. If not, mark as superseded. If yes, improve the extraction.`,
    });
  }

  // Failed crawler runs need investigation
  for (const run of failedCrawlerRuns) {
    items.push({
      type: 'crawler-failure',
      priority: 'high',
      title: `${run.crawler_name} crawler failed`,
      prompt: `The ${run.crawler_name} crawler failed with: "${run.error_message}". Check the logs with: railway logs -n 100 | grep ${run.crawler_name}. Fix the issue and re-run.`,
    });
  }

  // Embedding backlog
  if (embeddingPercent < 95) {
    items.push({
      type: 'embedding-backlog',
      priority: 'low',
      title: `Embedding coverage at ${embeddingPercent}%`,
      prompt: `Clear the embedding backlog. Run: node src/cli.js embed --limit=100`,
    });
  }

  // Recent errors
  if (health.errorCount > 0) {
    items.push({
      type: 'errors',
      priority: 'high',
      title: `${health.errorCount} errors in the last 7 days`,
      prompt: `Investigate recent errors. Check: node src/cli.js health, then look at specific crawler logs.`,
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
4. **Issues & Recommendations** (only if there are problems worth noting)
5. **Key Numbers** (quick stats table)

Style guidelines:
- Be concise, not verbose
- Flag anything unusual or concerning
- If crawlers haven't run recently, note it
- If embedding coverage is low, flag it
- Skip sections if nothing relevant to report
- Use plain text formatting (no markdown headers, use CAPS for section names)
- Keep total length under 300 words`;

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
    const hasActivity = systemData.recentItemsCount > 0;

    let statusEmoji = '✅';
    if (hasErrors) statusEmoji = '⚠️';
    else if (!hasActivity) statusEmoji = '📊';

    const subject = `${statusEmoji} OpenOnco MRD Daily: ${systemData.totals.guidance_items} items, ${systemData.recentItemsCount} new today`;

    // Generate CC action items HTML
    const ccItemsHtml = systemData.ccActionItems.length > 0
      ? `
  <div class="cc-actions">
    <h3>CC Action Items</h3>
    <p style="color: #64748b; font-size: 12px;">Copy a prompt below and paste into Claude Code:</p>
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
      : '';

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

    // Plain text version with CC prompts
    const ccItemsText = systemData.ccActionItems.length > 0
      ? `\n\n--- CC ACTION ITEMS ---\n${systemData.ccActionItems.map(item =>
          `[${item.priority.toUpperCase()}] ${item.title}\nPrompt: ${item.prompt}`
        ).join('\n\n')}`
      : '';

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
