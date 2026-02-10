/**
 * Weekly Summary Email
 *
 * Single email sent after weekly aggregation with all crawler results.
 * Replaces per-crawler emails with one unified summary.
 * Directs the admin to run /triage in Claude Code.
 */

import { Resend } from 'resend';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('weekly-summary-email');

/**
 * Send weekly summary notification
 *
 * @param {Object} weeklyFile - The weekly submissions file object
 */
export async function sendWeeklySummaryEmail(weeklyFile) {
  if (!config.email.apiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'No API key' };
  }

  const resend = new Resend(config.email.apiKey);
  const { stats, crawlSummary, submissions } = weeklyFile;

  const subject = stats.total > 0
    ? `[OpenOnco] Weekly crawl: ${stats.total} submissions ready for /triage`
    : `[OpenOnco] Weekly crawl complete - no submissions`;

  const html = generateHtml(weeklyFile);
  const text = generateText(weeklyFile);

  try {
    const result = await resend.emails.send({
      from: config.email.from,
      to: config.email.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    logger.info('Weekly summary email sent', {
      to: config.email.to,
      messageId: result.data?.id,
      total: stats.total,
    });

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    logger.error('Failed to send weekly summary email', { error: error.message });
    return { success: false, error: error.message };
  }
}

function generateHtml(weeklyFile) {
  const { stats, crawlSummary, submissions } = weeklyFile;

  // Source badges
  const sources = Object.entries(crawlSummary).map(([source, info]) => {
    const color = info.ran ? (info.errors.length > 0 ? '#dc2626' : '#16a34a') : '#9ca3af';
    const bg = info.ran ? (info.errors.length > 0 ? '#fef2f2' : '#f0fdf4') : '#f9fafb';
    const icon = info.ran ? (info.errors.length > 0 ? '!' : info.itemCount) : '-';
    const label = source.toUpperCase();
    return `<div style="display:inline-block;background:${bg};color:${color};border:1px solid ${color}30;border-radius:6px;padding:6px 12px;margin:0 6px 6px 0;font-size:13px;font-weight:500;">${label}: ${icon}</div>`;
  }).join('');

  // Confidence breakdown
  const confHtml = ['high', 'medium', 'low'].map(level => {
    const count = stats.byConfidence[level] || 0;
    const colors = { high: '#16a34a', medium: '#ca8a04', low: '#9ca3af' };
    const bgs = { high: '#f0fdf4', medium: '#fef9c3', low: '#f9fafb' };
    return `<div style="display:inline-block;background:${bgs[level]};color:${colors[level]};border-radius:4px;padding:4px 10px;margin:0 6px 0 0;font-size:12px;">${level}: ${count}</div>`;
  }).join('');

  // Top items preview (up to 5 high-confidence)
  const highItems = submissions
    .filter(s => s.triageHint.daemonScore >= 7)
    .slice(0, 5);

  let previewHtml = '';
  if (highItems.length > 0) {
    previewHtml = `
    <div style="margin-bottom:20px;">
      <h2 style="font-size:14px;color:#166534;margin:0 0 8px 0;">Top Items</h2>
      ${highItems.map(s => `
        <div style="background:#f0fdf4;border-left:3px solid #16a34a;padding:6px 12px;margin-bottom:6px;border-radius:0 4px 4px 0;">
          <div style="font-size:12px;color:#166534;font-weight:500;">${escapeHtml(s.title.slice(0, 80))}</div>
          <div style="font-size:11px;color:#4b5563;margin-top:2px;">${s.source} | score ${s.triageHint.daemonScore} | ${s.triageHint.suggestedAction}</div>
        </div>
      `).join('')}
    </div>`;
  }

  // Errors
  const allErrors = Object.entries(crawlSummary)
    .filter(([, info]) => info.errors.length > 0)
    .flatMap(([source, info]) => info.errors.map(e => `${source}: ${e}`));

  let errorsHtml = '';
  if (allErrors.length > 0) {
    errorsHtml = `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
      <div style="font-size:13px;font-weight:600;color:#dc2626;margin-bottom:6px;">${allErrors.length} Error(s)</div>
      ${allErrors.slice(0, 3).map(e => `<div style="font-size:12px;color:#991b1b;font-family:monospace;margin-bottom:3px;">${escapeHtml(e)}</div>`).join('')}
    </div>`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;padding:20px;background:#f5f5f5;">
  <div style="background:white;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <h1 style="font-size:18px;margin:0 0 4px 0;color:#1f2937;">Weekly Crawl Summary</h1>
    <p style="font-size:13px;color:#666;margin:0 0 16px 0;">Week of ${weeklyFile.weekOf}</p>

    <div style="margin-bottom:16px;">${sources}</div>

    <div style="background:#f8fafc;border-radius:6px;padding:12px 16px;margin-bottom:16px;">
      <div style="font-size:24px;font-weight:700;color:#1f2937;">${stats.total}</div>
      <div style="font-size:12px;color:#666;margin-bottom:8px;">total submissions</div>
      ${confHtml}
    </div>

    ${errorsHtml}
    ${previewHtml}

    <div style="background:#1e293b;border-radius:6px;padding:12px 16px;margin-bottom:12px;">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">In Claude Code (V0 project):</div>
      <code style="font-size:16px;color:#e2e8f0;">/triage</code>
    </div>

    <p style="font-size:11px;color:#999;margin-top:20px;text-align:center;">
      OpenOnco · ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
  `.trim();
}

function generateText(weeklyFile) {
  const { stats, crawlSummary } = weeklyFile;

  const sourceLines = Object.entries(crawlSummary)
    .map(([source, info]) => `  ${source.toUpperCase()}: ${info.ran ? `${info.itemCount} items` : 'did not run'}${info.errors.length > 0 ? ` (${info.errors.length} errors)` : ''}`)
    .join('\n');

  return `WEEKLY CRAWL SUMMARY
Week of ${weeklyFile.weekOf}
${'='.repeat(40)}

${stats.total} TOTAL SUBMISSIONS

By source:
${sourceLines}

By confidence:
  High: ${stats.byConfidence.high || 0}
  Medium: ${stats.byConfidence.medium || 0}
  Low: ${stats.byConfidence.low || 0}

${'='.repeat(40)}

In Claude Code (V0 project): /triage

OpenOnco · ${new Date().toLocaleString()}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default { sendWeeklySummaryEmail };
