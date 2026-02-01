/**
 * Crawl Complete Email
 *
 * Single email sent after each crawl with:
 * - What crawl ran
 * - What was found
 * - Pending proposals
 * - Any errors
 * - Instructions to review
 */

import { Resend } from 'resend';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { getStats as getProposalStats } from '../proposals/queue.js';

const logger = createLogger('crawl-complete-email');

/**
 * Send crawl complete notification
 *
 * @param {Object} options
 * @param {string} options.source - Which crawler ran (cms, vendor, payers)
 * @param {boolean} options.success - Whether crawl succeeded
 * @param {number} options.duration - Crawl duration in ms
 * @param {number} options.discoveredCount - Items discovered
 * @param {number} options.newProposalsCount - New proposals created
 * @param {number} options.addedCount - New items added to queue
 * @param {number} options.duplicateCount - Duplicate items skipped
 * @param {string[]} options.errors - Any errors that occurred
 */
export async function sendCrawlCompleteEmail(options = {}) {
  const {
    source = 'daemon',
    success = true,
    duration = 0,
    discoveredCount = 0,
    newProposalsCount = 0,
    addedCount = 0,
    duplicateCount = 0,
    errors = [],
  } = options;

  if (!config.email.apiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'No API key' };
  }

  // Get current proposal stats
  let proposalStats = { pending: 0, coverage: 0, update: 0, newTest: 0 };
  try {
    const stats = await getProposalStats();
    proposalStats = {
      pending: stats.byStatus?.pending || 0,
      coverage: stats.byType?.coverage || 0,
      update: stats.byType?.update || 0,
      newTest: stats.byType?.['new-test'] || 0,
    };
  } catch (e) {
    logger.warn('Failed to get proposal stats', { error: e.message });
  }

  // Always send - user wants to know crawl completed

  const resend = new Resend(config.email.apiKey);

  // Build subject
  const sourceName = source === 'cms' ? 'CMS' : source === 'payers' ? 'Payers' : 'Vendor';
  let subject;
  if (errors.length > 0) {
    subject = `[OpenOnco] ⚠️ ${sourceName} crawl: ${errors.length} error${errors.length > 1 ? 's' : ''}`;
  } else if (proposalStats.pending > 0) {
    subject = `[OpenOnco] ${proposalStats.pending} proposal${proposalStats.pending > 1 ? 's' : ''} ready for review`;
  } else {
    subject = `[OpenOnco] ${sourceName} crawl complete`;
  }

  const html = generateHtml({ source, sourceName, success, duration, discoveredCount, newProposalsCount, addedCount, duplicateCount, errors, proposalStats });
  const text = generateText({ source, sourceName, success, duration, discoveredCount, newProposalsCount, addedCount, duplicateCount, errors, proposalStats });

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

    logger.info('Crawl complete email sent', {
      to: config.email.to,
      messageId: result.data?.id,
      source,
      proposalsPending: proposalStats.pending,
    });

    return { success: true, messageId: result.data?.id };
  } catch (error) {
    logger.error('Failed to send crawl complete email', { error: error.message });
    return { success: false, error: error.message };
  }
}

function formatDuration(ms) {
  if (!ms) return '-';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function generateHtml({ sourceName, success, duration, discoveredCount, newProposalsCount, addedCount, duplicateCount, errors, proposalStats }) {
  const statusColor = success && errors.length === 0 ? '#166534' : '#dc2626';
  const statusBg = success && errors.length === 0 ? '#dcfce7' : '#fef2f2';
  const statusIcon = success && errors.length === 0 ? '✓' : '⚠️';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
      <div style="background: ${statusBg}; color: ${statusColor}; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px;">
        ${statusIcon}
      </div>
      <div>
        <h1 style="font-size: 18px; margin: 0; color: #1f2937;">${sourceName} Crawl Complete</h1>
        <p style="font-size: 13px; color: #666; margin: 0;">${formatDuration(duration)}</p>
      </div>
    </div>

    <!-- Crawl Stats -->
    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; text-align: center;">
        <div>
          <div style="font-size: 20px; font-weight: bold; color: #334155;">${discoveredCount}</div>
          <div style="font-size: 11px; color: #64748b;">items found</div>
        </div>
        <div>
          <div style="font-size: 20px; font-weight: bold; color: ${addedCount > 0 ? '#166534' : '#334155'};">${addedCount}</div>
          <div style="font-size: 11px; color: #64748b;">new (${duplicateCount} dupes)</div>
        </div>
        <div>
          <div style="font-size: 20px; font-weight: bold; color: ${newProposalsCount > 0 ? '#0369a1' : '#334155'};">${newProposalsCount}</div>
          <div style="font-size: 11px; color: #64748b;">proposals created</div>
        </div>
        <div>
          <div style="font-size: 20px; font-weight: bold; color: ${proposalStats.pending > 0 ? '#d97706' : '#334155'};">${proposalStats.pending}</div>
          <div style="font-size: 11px; color: #64748b;">pending review</div>
        </div>
      </div>
    </div>

    ${errors.length > 0 ? `
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 13px; font-weight: 600; color: #dc2626; margin-bottom: 8px;">
        ${errors.length} Error${errors.length > 1 ? 's' : ''}
      </div>
      ${errors.slice(0, 3).map(e => `
        <div style="font-size: 12px; color: #991b1b; font-family: monospace; margin-bottom: 4px; word-break: break-word;">
          ${e}
        </div>
      `).join('')}
      ${errors.length > 3 ? `<div style="font-size: 11px; color: #666;">+${errors.length - 3} more</div>` : ''}
    </div>
    ` : ''}

    ${proposalStats.pending > 0 ? `
    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 28px; font-weight: bold; color: #0369a1; margin-bottom: 4px;">${proposalStats.pending}</div>
      <div style="font-size: 13px; color: #666; margin-bottom: 12px;">proposal${proposalStats.pending > 1 ? 's' : ''} pending review</div>

      <div style="display: flex; gap: 16px; font-size: 12px; color: #888;">
        ${proposalStats.coverage > 0 ? `<span>📋 Coverage: ${proposalStats.coverage}</span>` : ''}
        ${proposalStats.update > 0 ? `<span>📊 Updates: ${proposalStats.update}</span>` : ''}
        ${proposalStats.newTest > 0 ? `<span>🆕 New tests: ${proposalStats.newTest}</span>` : ''}
      </div>
    </div>
    ` : ''}

    <div style="background: #1e293b; border-radius: 6px; padding: 12px 16px;">
      <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">In Claude Code (V0 project):</div>
      <code style="font-size: 14px; color: #e2e8f0;">/proposals</code>
    </div>

    <p style="font-size: 11px; color: #999; margin-top: 20px; text-align: center;">
      OpenOnco · ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
  `.trim();
}

function generateText({ sourceName, success, duration, discoveredCount, newProposalsCount, addedCount, duplicateCount, errors, proposalStats }) {
  let text = `${sourceName.toUpperCase()} CRAWL COMPLETE
${success && errors.length === 0 ? '✓' : '⚠️'} ${formatDuration(duration)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Items found: ${discoveredCount} (${addedCount} new, ${duplicateCount} dupes)
Proposals created: ${newProposalsCount}
Pending review: ${proposalStats.pending}

`;

  if (errors.length > 0) {
    text += `⚠️ ${errors.length} ERROR${errors.length > 1 ? 'S' : ''}:\n`;
    errors.slice(0, 3).forEach(e => { text += `  ${e}\n`; });
    if (errors.length > 3) text += `  +${errors.length - 3} more\n`;
    text += '\n';
  }

  if (proposalStats.pending > 0) {
    text += `${proposalStats.pending} PROPOSAL${proposalStats.pending > 1 ? 'S' : ''} PENDING REVIEW\n`;
    if (proposalStats.coverage > 0) text += `  📋 Coverage: ${proposalStats.coverage}\n`;
    if (proposalStats.update > 0) text += `  📊 Updates: ${proposalStats.update}\n`;
    if (proposalStats.newTest > 0) text += `  🆕 New tests: ${proposalStats.newTest}\n`;
    text += '\n';
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In Claude Code (V0 project): /proposals

OpenOnco · ${new Date().toLocaleString()}
`;

  return text.trim();
}

export default { sendCrawlCompleteEmail };
