/**
 * Weekly Digest Email
 */

import { sendEmail } from './index.js';
import { getHealthSummary } from '../health.js';
import { query } from '../db/client.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('weekly-digest');

export async function sendWeeklyDigest() {
  logger.info('Generating weekly digest');

  // Get health summary
  const health = await getHealthSummary();

  // Get new items this week
  const newItems = await query(`
    SELECT source_type, COUNT(*) as count
    FROM mrd_guidance_items
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY source_type
    ORDER BY count DESC
  `);

  // Get items by source type (replacing queue status)
  const sourceBreakdown = await query(`
    SELECT source_type, COUNT(*) as count
    FROM mrd_guidance_items
    GROUP BY source_type
    ORDER BY count DESC
  `);

  // Get trial updates
  const trialUpdates = await query(`
    SELECT COUNT(*) as count
    FROM mrd_clinical_trials
    WHERE updated_at > NOW() - INTERVAL '7 days'
  `);

  // Get total counts
  const totals = await query(`
    SELECT
      (SELECT COUNT(*) FROM mrd_guidance_items) as guidance,
      (SELECT COUNT(*) FROM mrd_clinical_trials) as trials,
      (SELECT COUNT(*) FROM mrd_item_embeddings) as embeddings
  `);

  const html = generateDigestHtml({
    health,
    newItems: newItems.rows,
    sourceBreakdown: sourceBreakdown.rows,
    trialUpdates: trialUpdates.rows[0]?.count || 0,
    totals: totals.rows[0],
  });

  const text = generateDigestText({
    health,
    newItems: newItems.rows,
    sourceBreakdown: sourceBreakdown.rows,
    trialUpdates: trialUpdates.rows[0]?.count || 0,
    totals: totals.rows[0],
  });

  await sendEmail({
    subject: generateSubject(health, newItems.rows),
    html,
    text,
  });

  logger.info('Weekly digest sent');
}

function generateSubject(health, newItems) {
  const total = newItems.reduce((sum, r) => sum + parseInt(r.count), 0);
  const errorFlag = health.errorCount > 0 ? ` · ${health.errorCount} errors` : '';
  return `[OpenOnco MRD] Weekly: ${total} new items${errorFlag}`;
}

function generateDigestHtml({ health, newItems, sourceBreakdown, trialUpdates, totals }) {
  const itemsHtml = newItems.length > 0
    ? newItems.map(r => `<li><strong>${r.source_type}</strong>: ${r.count} new</li>`).join('')
    : '<li>No new items this week</li>';

  const sourceHtml = sourceBreakdown.length > 0
    ? sourceBreakdown.map(r => `<li>${r.source_type}: ${r.count}</li>`).join('')
    : '<li>No items</li>';

  const crawlerHtml = health.crawlers.length > 0
    ? health.crawlers.map(c => `<li><strong>${c.name}</strong>: ${c.status} (last: ${c.lastSuccess ? new Date(c.lastSuccess).toLocaleDateString() : 'never'})</li>`).join('')
    : '<li>No crawler data</li>';

  const errorsHtml = health.recentErrors.length > 0
    ? health.recentErrors.slice(0, 5).map(e =>
        `<li><strong>${e.source}</strong>: ${e.message} <small>(${new Date(e.timestamp).toLocaleString()})</small></li>`
      ).join('')
    : '<li>No errors this week</li>';

  return `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
  h1 { color: #1e293b; border-bottom: 2px solid #10b981; padding-bottom: 10px; }
  h2 { color: #334155; margin-top: 24px; }
  ul { padding-left: 20px; }
  li { margin: 8px 0; }
  .stats { background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0; }
  .stats span { display: inline-block; margin-right: 24px; }
  .error { color: #dc2626; }
  .success { color: #16a34a; }
</style></head>
<body>
  <h1>OpenOnco MRD Weekly Digest</h1>

  <div class="stats">
    <span><strong>Guidance Items:</strong> ${totals?.guidance || 0}</span>
    <span><strong>Clinical Trials:</strong> ${totals?.trials || 0}</span>
    <span><strong>Embeddings:</strong> ${totals?.embeddings || 0}</span>
  </div>

  <h2>New Items This Week</h2>
  <ul>${itemsHtml}</ul>

  <h2>Items by Source</h2>
  <ul>${sourceHtml}</ul>

  <h2>Trial Updates</h2>
  <p>${trialUpdates} trials updated this week</p>

  <h2>Crawler Health</h2>
  <ul>${crawlerHtml}</ul>

  <h2 class="${health.errorCount > 0 ? 'error' : ''}">Errors (${health.errorCount})</h2>
  <ul>${errorsHtml}</ul>

  <hr>
  <p><small>Uptime: ${health.uptime} · Digests sent: ${health.digestsSent + 1}</small></p>
</body>
</html>`;
}

function generateDigestText({ health, newItems, sourceBreakdown, trialUpdates, totals }) {
  return `
OPENONCO MRD WEEKLY DIGEST
==========================

DATABASE TOTALS
- Guidance Items: ${totals?.guidance || 0}
- Clinical Trials: ${totals?.trials || 0}
- Embeddings: ${totals?.embeddings || 0}

NEW ITEMS THIS WEEK
${newItems.length > 0 ? newItems.map(r => `- ${r.source_type}: ${r.count}`).join('\n') : '- None'}

ITEMS BY SOURCE
${sourceBreakdown.length > 0 ? sourceBreakdown.map(r => `- ${r.source_type}: ${r.count}`).join('\n') : '- No items'}

TRIAL UPDATES: ${trialUpdates}

CRAWLER HEALTH
${health.crawlers.length > 0 ? health.crawlers.map(c => `- ${c.name}: ${c.status}`).join('\n') : '- No data'}

ERRORS (${health.errorCount})
${health.recentErrors.length > 0 ? health.recentErrors.slice(0, 5).map(e => `- ${e.source}: ${e.message}`).join('\n') : '- None'}

---
Uptime: ${health.uptime}
`;
}

export default {
  sendWeeklyDigest,
};
