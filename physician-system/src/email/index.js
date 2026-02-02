/**
 * Email service using Resend
 */

import { Resend } from 'resend';
import { createLogger } from '../utils/logger.js';
import { config } from '../config.js';

const logger = createLogger('email');
let client = null;

function getClient() {
  if (!client && config.email.apiKey) {
    client = new Resend(config.email.apiKey);
  }
  return client;
}

export async function sendEmail({ subject, html, text }) {
  const resend = getClient();
  if (!resend) {
    logger.warn('Email not configured (no RESEND_API_KEY)');
    return null;
  }

  try {
    const result = await resend.emails.send({
      from: config.email.from,
      to: config.email.to,
      subject,
      html,
      text,
    });
    logger.info('Email sent', { subject, id: result.data?.id });
    return result;
  } catch (error) {
    logger.error('Failed to send email', { error: error.message });
    throw error;
  }
}

export async function sendTestEmail() {
  return sendEmail({
    subject: '[OpenOnco MRD] Test Email',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1e293b; border-bottom: 2px solid #10b981; padding-bottom: 10px;">OpenOnco MRD</h1>
        <p>Email configuration is working!</p>
        <p><small>Sent at ${new Date().toISOString()}</small></p>
      </div>
    `,
    text: `OpenOnco MRD - Email configuration is working!\n\nSent at ${new Date().toISOString()}`,
  });
}

export default {
  sendEmail,
  sendTestEmail,
};
