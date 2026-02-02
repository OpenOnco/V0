/**
 * Crawl Complete Email
 *
 * Single email sent after each crawl with:
 * - What crawl ran
 * - Summary of each proposal created (2 lines each)
 * - Summary of each discovery that didn't become a proposal (2 lines each)
 * - Any errors
 */

import { Resend } from 'resend';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { listPending } from '../proposals/queue.js';

const logger = createLogger('crawl-complete-email');

/**
 * Send crawl complete notification
 *
 * @param {Object} options
 * @param {string} options.source - Which crawler ran (cms, vendor, payers)
 * @param {boolean} options.success - Whether crawl succeeded
 * @param {number} options.duration - Crawl duration in ms
 * @param {Array} options.proposals - Newly created proposals
 * @param {Array} options.skippedDiscoveries - Discoveries that didn't become proposals
 * @param {string[]} options.errors - Any errors that occurred
 */
export async function sendCrawlCompleteEmail(options = {}) {
  const {
    source = 'daemon',
    success = true,
    duration = 0,
    proposals = [],
    skippedDiscoveries = [],
    errors = [],
  } = options;

  if (!config.email.apiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'No API key' };
  }

  // Get all pending proposals (including from previous crawls)
  let allPending = [];
  try {
    allPending = await listPending();
  } catch (e) {
    logger.warn('Failed to get pending proposals', { error: e.message });
  }

  const resend = new Resend(config.email.apiKey);

  // Build subject
  const sourceName = source === 'cms' ? 'CMS' : source === 'payers' ? 'Payers' : 'Vendor';
  let subject;
  if (errors.length > 0) {
    subject = `[OpenOnco] ⚠️ ${sourceName} crawl: ${errors.length} error${errors.length > 1 ? 's' : ''}`;
  } else if (proposals.length > 0) {
    subject = `[OpenOnco] ${proposals.length} new proposal${proposals.length > 1 ? 's' : ''} from ${sourceName} crawl`;
  } else if (allPending.length > 0) {
    subject = `[OpenOnco] ${sourceName} crawl complete (${allPending.length} pending)`;
  } else {
    subject = `[OpenOnco] ${sourceName} crawl complete - no changes`;
  }

  const html = generateHtml({ sourceName, success, duration, proposals, skippedDiscoveries, allPending, errors });
  const text = generateText({ sourceName, success, duration, proposals, skippedDiscoveries, allPending, errors });

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
      newProposals: proposals.length,
      skipped: skippedDiscoveries.length,
      totalPending: allPending.length,
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

/**
 * Get emoji for proposal type
 */
function getTypeEmoji(type) {
  switch (type) {
    case 'coverage': return '📋';
    case 'update': return '📊';
    case 'new-test': return '🆕';
    default: return '📝';
  }
}

/**
 * Get short summary for a proposal (2 lines max)
 */
function getProposalSummary(proposal) {
  const lines = [];

  // Line 1: Type + Test name
  const typeLabel = proposal.type === 'new-test' ? 'New test' :
                    proposal.type === 'coverage' ? 'Coverage' : 'Update';
  const testName = proposal.testName || proposal.testData?.name || 'Unknown';
  lines.push(`${typeLabel}: ${testName}`);

  // Line 2: Details
  if (proposal.type === 'coverage' && proposal.payer) {
    lines.push(`Payer: ${proposal.payer}`);
  } else if (proposal.type === 'update' && proposal.changes) {
    const changeKeys = Object.keys(proposal.changes);
    lines.push(`Changes: ${changeKeys.join(', ')}`);
  } else if (proposal.type === 'new-test' && proposal.testData?.vendor) {
    lines.push(`Vendor: ${proposal.testData.vendor}`);
  } else if (proposal.snippet) {
    lines.push(proposal.snippet.slice(0, 80) + (proposal.snippet.length > 80 ? '...' : ''));
  }

  return lines;
}

/**
 * Get short summary for a skipped discovery (2 lines max)
 */
function getSkippedSummary(discovery) {
  const lines = [];

  // Line 1: What was found
  const title = discovery.title || 'Untitled discovery';
  lines.push(title.slice(0, 80) + (title.length > 80 ? '...' : ''));

  // Line 2: Why skipped
  const reason = discovery.skipReason || 'Low relevance / informational only';
  lines.push(`⤷ ${reason}`);

  return lines;
}

function generateHtml({ sourceName, success, duration, proposals, skippedDiscoveries, allPending, errors }) {
  const statusColor = success && errors.length === 0 ? '#166534' : '#dc2626';
  const statusBg = success && errors.length === 0 ? '#dcfce7' : '#fef2f2';
  const statusIcon = success && errors.length === 0 ? '✓' : '⚠️';

  // Build proposals section
  let proposalsHtml = '';
  if (proposals.length > 0) {
    proposalsHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="font-size: 14px; color: #166534; margin: 0 0 12px 0; font-weight: 600;">
        ${proposals.length} New Proposal${proposals.length > 1 ? 's' : ''} Created
      </h2>
      ${proposals.map(p => {
        const [line1, line2] = getProposalSummary(p);
        return `
        <div style="background: #f0fdf4; border-left: 3px solid #16a34a; padding: 8px 12px; margin-bottom: 8px; border-radius: 0 4px 4px 0;">
          <div style="font-size: 13px; color: #166534; font-weight: 500;">${getTypeEmoji(p.type)} ${line1}</div>
          ${line2 ? `<div style="font-size: 12px; color: #4b5563; margin-top: 2px;">${line2}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  // Build skipped discoveries section
  let skippedHtml = '';
  if (skippedDiscoveries.length > 0) {
    skippedHtml = `
    <div style="margin-bottom: 20px;">
      <h2 style="font-size: 14px; color: #6b7280; margin: 0 0 12px 0; font-weight: 600;">
        ${skippedDiscoveries.length} Item${skippedDiscoveries.length > 1 ? 's' : ''} Skipped
      </h2>
      ${skippedDiscoveries.slice(0, 10).map(d => {
        const [line1, line2] = getSkippedSummary(d);
        return `
        <div style="background: #f9fafb; border-left: 3px solid #d1d5db; padding: 8px 12px; margin-bottom: 6px; border-radius: 0 4px 4px 0;">
          <div style="font-size: 12px; color: #374151;">${line1}</div>
          <div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${line2}</div>
        </div>`;
      }).join('')}
      ${skippedDiscoveries.length > 10 ? `<div style="font-size: 11px; color: #9ca3af; padding: 4px 12px;">+${skippedDiscoveries.length - 10} more</div>` : ''}
    </div>`;
  }

  // Build errors section
  let errorsHtml = '';
  if (errors.length > 0) {
    errorsHtml = `
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
    </div>`;
  }

  // Build pending summary
  let pendingHtml = '';
  if (allPending.length > 0) {
    const byType = { coverage: 0, update: 0, 'new-test': 0 };
    allPending.forEach(p => { if (byType[p.type] !== undefined) byType[p.type]++; });

    pendingHtml = `
    <div style="background: #fef3c7; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px;">
      <div style="font-size: 13px; color: #92400e; font-weight: 500;">
        📋 ${allPending.length} total pending review
      </div>
      <div style="font-size: 11px; color: #a16207; margin-top: 4px;">
        ${byType.coverage > 0 ? `Coverage: ${byType.coverage}` : ''}
        ${byType.update > 0 ? ` · Updates: ${byType.update}` : ''}
        ${byType['new-test'] > 0 ? ` · New tests: ${byType['new-test']}` : ''}
      </div>
    </div>`;
  }

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

    ${errorsHtml}
    ${proposalsHtml}
    ${skippedHtml}
    ${pendingHtml}

    <div style="background: #1e293b; border-radius: 6px; padding: 12px 16px; margin-bottom: 12px;">
      <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">In Claude Code (V0 project):</div>
      <code style="font-size: 14px; color: #e2e8f0;">/proposals</code>
    </div>

    <div style="background: #374151; border-radius: 6px; padding: 10px 16px;">
      <div style="font-size: 11px; color: #9ca3af;">
        💡 Occasionally run <code style="color: #e2e8f0;">/policy-research</code> to verify payer URLs and find new policies
      </div>
    </div>

    <p style="font-size: 11px; color: #999; margin-top: 20px; text-align: center;">
      OpenOnco · ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
  `.trim();
}

function generateText({ sourceName, success, duration, proposals, skippedDiscoveries, allPending, errors }) {
  let text = `${sourceName.toUpperCase()} CRAWL COMPLETE
${success && errors.length === 0 ? '✓' : '⚠️'} ${formatDuration(duration)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  if (errors.length > 0) {
    text += `⚠️ ${errors.length} ERROR${errors.length > 1 ? 'S' : ''}:\n`;
    errors.slice(0, 3).forEach(e => { text += `  ${e}\n`; });
    if (errors.length > 3) text += `  +${errors.length - 3} more\n`;
    text += '\n';
  }

  if (proposals.length > 0) {
    text += `✅ ${proposals.length} NEW PROPOSAL${proposals.length > 1 ? 'S' : ''} CREATED:\n`;
    proposals.forEach(p => {
      const [line1, line2] = getProposalSummary(p);
      text += `  ${getTypeEmoji(p.type)} ${line1}\n`;
      if (line2) text += `     ${line2}\n`;
    });
    text += '\n';
  }

  if (skippedDiscoveries.length > 0) {
    text += `⏭️ ${skippedDiscoveries.length} ITEM${skippedDiscoveries.length > 1 ? 'S' : ''} SKIPPED:\n`;
    skippedDiscoveries.slice(0, 10).forEach(d => {
      const [line1, line2] = getSkippedSummary(d);
      text += `  • ${line1}\n`;
      text += `    ${line2}\n`;
    });
    if (skippedDiscoveries.length > 10) text += `  +${skippedDiscoveries.length - 10} more\n`;
    text += '\n';
  }

  if (allPending.length > 0) {
    text += `📋 ${allPending.length} TOTAL PENDING REVIEW\n\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In Claude Code (V0 project): /proposals

💡 Occasionally run /policy-research to verify payer URLs and find new policies

OpenOnco · ${new Date().toLocaleString()}
`;

  return text.trim();
}

export default { sendCrawlCompleteEmail };
