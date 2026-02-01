/**
 * Proposal Notification Email
 *
 * Sends a notification email after each crawl with proposal counts.
 * Sent immediately after sync, not as part of Monday digest.
 */

import { Resend } from 'resend';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('proposal-notification');

/**
 * Send proposal notification email
 *
 * @param {Object} options
 * @param {number} options.coverage - Number of coverage proposals
 * @param {number} options.updates - Number of update proposals
 * @param {number} options.newTests - Number of new test proposals
 * @param {number} options.totalPending - Total pending proposals
 * @param {string} options.crawlSource - Source that triggered this (cms, vendor, payers)
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendProposalNotification(options = {}) {
  const {
    coverage = 0,
    updates = 0,
    newTests = 0,
    totalPending = 0,
    crawlSource = 'daemon',
  } = options;

  // Don't send if no proposals
  const totalNew = coverage + updates + newTests;
  if (totalNew === 0) {
    logger.info('No new proposals to notify about');
    return { success: true, skipped: true };
  }

  if (!config.email.apiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping notification');
    return { success: false, error: 'No API key' };
  }

  const resend = new Resend(config.email.apiKey);

  // Build subject
  const subject = `[OpenOnco] ${totalNew} new proposal${totalNew !== 1 ? 's' : ''} ready for review`;

  // Build email body
  const html = generateHtml({ coverage, updates, newTests, totalPending, crawlSource });
  const text = generateText({ coverage, updates, newTests, totalPending, crawlSource });

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

    logger.info('Proposal notification sent', {
      to: config.email.to,
      messageId: result.data?.id,
      totalNew,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logger.error('Failed to send proposal notification', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate HTML email
 */
function generateHtml({ coverage, updates, newTests, totalPending, crawlSource }) {
  const totalNew = coverage + updates + newTests;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

    <h1 style="font-size: 18px; margin: 0 0 16px 0; color: #1f2937;">
      ${totalNew} New Proposal${totalNew !== 1 ? 's' : ''} Ready
    </h1>

    <p style="color: #666; font-size: 13px; margin: 0 0 20px 0;">
      From: ${crawlSource.toUpperCase()} crawler
    </p>

    <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      ${coverage > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #475569;">📋 Coverage updates</span>
          <span style="font-weight: 600; color: #0369a1;">${coverage}</span>
        </div>
      ` : ''}
      ${updates > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #475569;">📊 Test updates</span>
          <span style="font-weight: 600; color: #7c3aed;">${updates}</span>
        </div>
      ` : ''}
      ${newTests > 0 ? `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span style="color: #475569;">🆕 New tests</span>
          <span style="font-weight: 600; color: #059669;">${newTests}</span>
        </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; padding: 8px 0;">
        <span style="color: #475569; font-weight: 500;">Total pending</span>
        <span style="font-weight: 600; color: #d97706;">${totalPending}</span>
      </div>
    </div>

    <div style="background: #1e293b; border-radius: 6px; padding: 12px 16px; margin-bottom: 16px;">
      <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">In Claude Code (V0 project):</div>
      <code style="font-size: 13px; color: #e2e8f0;">/proposals</code>
    </div>

    <p style="font-size: 11px; color: #999; margin-top: 20px; text-align: center;">
      OpenOnco Coverage Intelligence · ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text email
 */
function generateText({ coverage, updates, newTests, totalPending, crawlSource }) {
  const totalNew = coverage + updates + newTests;

  let text = `${totalNew} NEW PROPOSAL${totalNew !== 1 ? 'S' : ''} READY FOR REVIEW
From: ${crawlSource.toUpperCase()} crawler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  if (coverage > 0) text += `📋 Coverage updates: ${coverage}\n`;
  if (updates > 0) text += `📊 Test updates: ${updates}\n`;
  if (newTests > 0) text += `🆕 New tests: ${newTests}\n`;
  text += `\nTotal pending: ${totalPending}\n`;

  text += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In Claude Code (V0 project): /proposals

OpenOnco Coverage Intelligence · ${new Date().toLocaleString()}
`;

  return text.trim();
}

export default { sendProposalNotification };
