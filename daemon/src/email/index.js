/**
 * Email service using Resend
 */

import { Resend } from 'resend';
import { createLogger } from '../utils/logger.js';
import { config } from '../config.js';
import { getHealthSummary, recordDigestSent } from '../health.js';
import { getAllDiscoveriesGroupedBySource, getQueueStatus } from '../queue/index.js';
import { generateDigestHtml, generateDigestText, generateDigestSubject } from './templates.js';

const logger = createLogger('email');

let resendClient = null;

/**
 * Initialize the Resend client
 */
function getClient() {
  if (!resendClient) {
    if (!config.email.apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resendClient = new Resend(config.email.apiKey);
  }
  return resendClient;
}

/**
 * Send the daily digest email
 */
export async function sendDailyDigest() {
  logger.info('Preparing daily digest email');

  try {
    // Gather all data for the digest
    const [healthSummary, discoveries, queueStatus] = await Promise.all([
      getHealthSummary(),
      getAllDiscoveriesGroupedBySource(),
      getQueueStatus(),
    ]);

    const digestData = { healthSummary, discoveries, queueStatus };

    // Generate email content
    const subject = generateDigestSubject(digestData);
    const html = generateDigestHtml(digestData);
    const text = generateDigestText(digestData);

    // Send email
    const client = getClient();
    const result = await client.emails.send({
      from: config.email.from,
      to: config.email.to,
      subject,
      html,
      text,
    });

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    logger.info('Daily digest sent successfully', {
      to: config.email.to,
      subject,
      messageId: result.data?.id,
    });

    // Record that we sent a digest
    await recordDigestSent();

    return {
      success: true,
      messageId: result.data?.id,
      subject,
    };
  } catch (error) {
    logger.error('Failed to send daily digest', { error });
    throw error;
  }
}

/**
 * Send a test email to verify configuration
 */
export async function sendTestEmail() {
  logger.info('Sending test email');

  try {
    const client = getClient();
    const result = await client.emails.send({
      from: config.email.from,
      to: config.email.to,
      subject: '[OpenOnco Daemon] Test Email',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from the OpenOnco Intelligence Daemon.</p>
        <p>If you received this, email configuration is working correctly.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
      text: `
Test Email

This is a test email from the OpenOnco Intelligence Daemon.
If you received this, email configuration is working correctly.

Sent at: ${new Date().toISOString()}
      `.trim(),
    });

    logger.info('Test email sent successfully', {
      to: config.email.to,
      messageId: result.data?.id,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logger.error('Failed to send test email', { error });
    throw error;
  }
}

/**
 * Send an alert email for critical errors
 */
export async function sendAlertEmail(alertData) {
  const { title, message, source, error } = alertData;

  logger.info('Sending alert email', { title, source });

  try {
    const client = getClient();
    const result = await client.emails.send({
      from: config.email.from,
      to: config.email.to,
      subject: `[OpenOnco Daemon] ⚠️ Alert: ${title}`,
      html: `
        <h1>⚠️ Daemon Alert</h1>
        <p><strong>Source:</strong> ${source || 'Unknown'}</p>
        <p><strong>Message:</strong> ${message}</p>
        ${error ? `<p><strong>Error:</strong> ${error.message || error}</p>` : ''}
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `,
      text: `
DAEMON ALERT: ${title}

Source: ${source || 'Unknown'}
Message: ${message}
${error ? `Error: ${error.message || error}` : ''}
Time: ${new Date().toISOString()}
      `.trim(),
    });

    logger.info('Alert email sent', { messageId: result.data?.id });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (emailError) {
    logger.error('Failed to send alert email', { error: emailError });
    throw emailError;
  }
}

export default {
  sendDailyDigest,
  sendTestEmail,
  sendAlertEmail,
};
