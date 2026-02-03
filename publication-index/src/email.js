/**
 * Publication Index Crawl Email Notifications
 *
 * Sends email after each crawl with:
 * - Crawl status and stats
 * - Publications extracted and resolved to PubMed
 * - Sources processed
 * - Any errors
 */

import { Resend } from 'resend';
import { createLogger } from '../../test-data-tracker/src/utils/logger.js';

const logger = createLogger('pubindex-email');

// Email config from environment
const EMAIL_CONFIG = {
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.DIGEST_FROM_EMAIL || 'OpenOnco Daemon <daemon@openonco.org>',
  to: process.env.ALERT_EMAIL || process.env.DIGEST_RECIPIENT_EMAIL || 'alexgdickinson@gmail.com',
};

/**
 * Send crawl complete notification
 *
 * @param {Object} result - Crawl result from runPublicationIndexCrawler
 */
export async function sendCrawlCompleteEmail(result) {
  if (!EMAIL_CONFIG.apiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'No API key' };
  }

  const resend = new Resend(EMAIL_CONFIG.apiKey);
  const { stats, success, error, duration } = result;

  // Build subject
  let subject;
  if (!success || error) {
    subject = `[OpenOnco] ⚠️ Publication Index crawl failed`;
  } else if (stats.new_items > 0) {
    subject = `[OpenOnco] ${stats.new_items} new publication${stats.new_items > 1 ? 's' : ''} indexed`;
  } else if (stats.publications_found > 0) {
    subject = `[OpenOnco] Publication Index: ${stats.publications_found} found, no new items`;
  } else {
    subject = `[OpenOnco] Publication Index crawl complete - no changes`;
  }

  const html = generateHtml(result);
  const text = generateText(result);

  try {
    const emailResult = await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: EMAIL_CONFIG.to,
      subject,
      html,
      text,
    });

    if (emailResult.error) {
      throw new Error(emailResult.error.message || JSON.stringify(emailResult.error));
    }

    logger.info('Publication index email sent', {
      to: EMAIL_CONFIG.to,
      messageId: emailResult.data?.id,
      newItems: stats.new_items,
    });

    return { success: true, messageId: emailResult.data?.id };
  } catch (err) {
    logger.error('Failed to send publication index email', { error: err.message });
    return { success: false, error: err.message };
  }
}

function formatDuration(seconds) {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

function generateHtml(result) {
  const { stats, success, error, duration } = result;
  const statusColor = success ? '#166534' : '#dc2626';
  const statusBg = success ? '#dcfce7' : '#fef2f2';
  const statusIcon = success ? '✓' : '⚠️';

  let errorHtml = '';
  if (error) {
    errorHtml = `
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 13px; font-weight: 600; color: #dc2626; margin-bottom: 8px;">Error</div>
      <div style="font-size: 12px; color: #991b1b; font-family: monospace; word-break: break-word;">${error}</div>
    </div>`;
  }

  const statsHtml = `
    <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Sources crawled</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500;">${stats.sources_crawled}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Sources skipped (no changes)</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500;">${stats.sources_skipped}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Sources failed</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500; ${stats.sources_failed > 0 ? 'color: #dc2626;' : ''}">${stats.sources_failed}</td>
        </tr>
        <tr style="border-top: 1px solid #e5e7eb;">
          <td style="padding: 6px 0; color: #6b7280;">Publications found</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500;">${stats.publications_found}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Resolved to PubMed</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500; color: #166534;">${stats.resolved_to_pubmed}</td>
        </tr>
        <tr style="border-top: 1px solid #e5e7eb;">
          <td style="padding: 6px 0; color: #6b7280;">New items added</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #166534;">${stats.new_items}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Items updated</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500;">${stats.updated_items}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280;">Guardrails set</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 500;">${stats.guardrails_set}</td>
        </tr>
      </table>
    </div>`;

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
        <h1 style="font-size: 18px; margin: 0; color: #1f2937;">Publication Index Crawl</h1>
        <p style="font-size: 13px; color: #666; margin: 0;">${formatDuration(duration)}</p>
      </div>
    </div>

    ${errorHtml}
    ${statsHtml}

    <div style="background: #1e293b; border-radius: 6px; padding: 12px 16px;">
      <div style="font-size: 11px; color: #94a3b8; margin-bottom: 4px;">Check status:</div>
      <code style="font-size: 13px; color: #e2e8f0;">cd publication-index && node src/cli.js status</code>
    </div>

    <p style="font-size: 11px; color: #999; margin-top: 20px; text-align: center;">
      OpenOnco Publication Index · ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
  `.trim();
}

function generateText(result) {
  const { stats, success, error, duration } = result;

  let text = `PUBLICATION INDEX CRAWL
${success ? '✓' : '⚠️'} ${formatDuration(duration)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  if (error) {
    text += `⚠️ ERROR: ${error}\n\n`;
  }

  text += `STATS:
  Sources crawled:    ${stats.sources_crawled}
  Sources skipped:    ${stats.sources_skipped}
  Sources failed:     ${stats.sources_failed}

  Publications found: ${stats.publications_found}
  Resolved to PubMed: ${stats.resolved_to_pubmed}

  New items added:    ${stats.new_items}
  Items updated:      ${stats.updated_items}
  Guardrails set:     ${stats.guardrails_set}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Check status: cd publication-index && node src/cli.js status

OpenOnco Publication Index · ${new Date().toLocaleString()}
`;

  return text.trim();
}

export default { sendCrawlCompleteEmail };
