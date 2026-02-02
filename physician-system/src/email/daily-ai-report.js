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
    recentItems,
    recentTrials,
    sourceBreakdown,
    recentErrors,
    embeddingCoverage,
  ] = await Promise.all([
    query(`
      SELECT
        (SELECT COUNT(*) FROM mrd_guidance_items) as guidance_items,
        (SELECT COUNT(*) FROM mrd_clinical_trials) as clinical_trials,
        (SELECT COUNT(*) FROM mrd_item_embeddings) as embeddings
    `),
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
  ]);

  // Calculate embedding coverage
  const coverage = embeddingCoverage.rows[0];
  const embeddingPercent = coverage.total_items > 0
    ? Math.round((coverage.embedded_items / coverage.total_items) * 100)
    : 0;

  return {
    timestamp: new Date().toISOString(),
    health,
    totals: totals.rows[0],
    recentItems: recentItems.rows,
    recentTrials: recentTrials.rows,
    sourceBreakdown: sourceBreakdown.rows,
    potentialIssues: recentErrors.rows,
    embeddingCoverage: `${embeddingPercent}%`,
  };
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
      recentActivity: systemData.recentItems.length
    });

    // Generate AI analysis
    const aiReport = await generateAIReport(systemData);
    logger.info('AI report generated');

    // Determine status for subject line
    const hasErrors = systemData.health.errorCount > 0;
    const hasActivity = systemData.recentItems.length > 0;

    let statusEmoji = '✅';
    if (hasErrors) statusEmoji = '⚠️';
    else if (!hasActivity) statusEmoji = '📊';

    const subject = `${statusEmoji} OpenOnco MRD Daily: ${systemData.totals.guidance_items} items, ${systemData.recentItems.length} new today`;

    // Format email
    const html = `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
  pre { background: #f8fafc; padding: 16px; border-radius: 8px; white-space: pre-wrap; font-size: 14px; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; }
</style></head>
<body>
  <pre>${aiReport}</pre>
  <div class="footer">
    Generated by Claude at ${new Date().toLocaleString()}<br>
    <a href="https://physician-system-production.up.railway.app/health">Health Endpoint</a>
  </div>
</body>
</html>`;

    const text = `${aiReport}\n\n---\nGenerated by Claude at ${new Date().toLocaleString()}`;

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
