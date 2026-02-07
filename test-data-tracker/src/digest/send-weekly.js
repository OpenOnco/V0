/**
 * Hybrid Review Workflow for Physician MRD Weekly Digest
 *
 * Two-step process:
 * 1. Generate draft — curate content, render template, save to mrd_digest_history
 *    and send preview to admin for review
 * 2. Send on approval — send to all active subscribers
 *
 * CLI commands:
 *   node src/index.js digest:preview  — generate draft and email preview to admin
 *   node src/index.js digest:send     — send approved digest to subscribers
 */

import { Resend } from 'resend';
import { query } from '../db/mrd-client.js';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { curateDigestContent } from './curate.js';
import { getActiveSubscribers, markSent } from './subscribers.js';
import {
  generatePhysicianDigestSubject,
  generatePhysicianDigestHtml,
  generatePhysicianDigestText,
} from '../email/physician-digest.js';

const logger = createLogger('digest:send-weekly');

const SITE_URL = process.env.SITE_URL || 'https://www.openonco.org';

/**
 * Step 1: Generate a draft digest
 * Curates content, renders template, saves to DB, sends preview to admin
 */
export async function generateDraft() {
  logger.info('Generating physician digest draft');

  const content = await curateDigestContent({ days: 7 });

  if (content.totalItems === 0) {
    logger.info('No content for digest this week, skipping draft');
    return { skipped: true, reason: 'no_content' };
  }

  const weekDate = new Date();
  const subject = generatePhysicianDigestSubject(content, weekDate);

  // Render with a placeholder token for preview
  const htmlPreview = generatePhysicianDigestHtml(content, { unsubscribeToken: 'PREVIEW', weekDate });
  const textPreview = generatePhysicianDigestText(content, { unsubscribeToken: 'PREVIEW', weekDate });

  // Save draft to DB
  const result = await query(
    `INSERT INTO mrd_digest_history (subject, item_count, item_ids, status, html_preview, text_preview)
     VALUES ($1, $2, $3, 'draft', $4, $5)
     RETURNING id`,
    [
      subject,
      content.totalItems,
      JSON.stringify(content.clinicalEvidence.map(i => i.id).filter(Boolean)),
      htmlPreview,
      textPreview,
    ]
  );

  const digestId = result.rows[0].id;
  logger.info('Draft saved', { digestId, subject, items: content.totalItems });

  // Send preview to admin
  if (config.email.apiKey) {
    const resend = new Resend(config.email.apiKey);
    await resend.emails.send({
      from: 'OpenOnco MRD Digest <digest@openonco.org>',
      to: config.email.alertRecipient,
      subject: `[PREVIEW] ${subject}`,
      html: `
        <div style="background:#fef3c7;padding:16px;border-radius:8px;margin-bottom:16px;font-family:sans-serif;">
          <p style="margin:0;color:#92400e;font-weight:bold;">DIGEST PREVIEW — Awaiting Approval</p>
          <p style="margin:8px 0 0;color:#92400e;font-size:14px;">
            ${content.totalItems} items &bull; Digest ID: ${digestId}<br>
            To approve and send: <code>node src/index.js digest:send ${digestId}</code>
          </p>
        </div>
        ${htmlPreview}
      `,
      text: `DIGEST PREVIEW — Awaiting Approval\n\nDigest ID: ${digestId}\nTo approve and send: node src/index.js digest:send ${digestId}\n\n${textPreview}`,
    });
    logger.info('Preview sent to admin', { to: config.email.alertRecipient });
  }

  return { digestId, subject, items: content.totalItems, content };
}

/**
 * Step 2: Send an approved digest to all subscribers
 *
 * @param {number} digestId - ID from mrd_digest_history (or null for latest draft)
 */
export async function sendApprovedDigest(digestId = null) {
  // Find the digest
  let digestRow;
  if (digestId) {
    const result = await query('SELECT * FROM mrd_digest_history WHERE id = $1', [digestId]);
    digestRow = result.rows[0];
  } else {
    // Get latest draft
    const result = await query(
      `SELECT * FROM mrd_digest_history WHERE status = 'draft' ORDER BY id DESC LIMIT 1`
    );
    digestRow = result.rows[0];
  }

  if (!digestRow) {
    logger.warn('No digest found to send');
    return { success: false, error: 'No digest found' };
  }

  if (digestRow.status === 'sent') {
    logger.warn('Digest already sent', { digestId: digestRow.id });
    return { success: false, error: 'Already sent' };
  }

  logger.info('Sending approved digest', { digestId: digestRow.id, subject: digestRow.subject });

  // Get subscribers
  const subscribers = await getActiveSubscribers('weekly');
  if (subscribers.length === 0) {
    logger.info('No active subscribers, marking as sent');
    await query(
      `UPDATE mrd_digest_history SET status = 'sent', approved_at = NOW(), subscriber_count = 0, delivered_count = 0, failed_count = 0 WHERE id = $1`,
      [digestRow.id]
    );
    return { success: true, delivered: 0, failed: 0 };
  }

  if (!config.email.apiKey) {
    logger.error('RESEND_API_KEY not configured');
    return { success: false, error: 'No email API key' };
  }

  const resend = new Resend(config.email.apiKey);
  let delivered = 0;
  let failed = 0;
  const deliveredIds = [];

  // Re-curate content to personalize per subscriber, or use the stored HTML
  // For now, use stored HTML with subscriber-specific unsubscribe tokens
  const content = await curateDigestContent({ days: 7 });
  const weekDate = new Date();

  for (const subscriber of subscribers) {
    try {
      const html = generatePhysicianDigestHtml(content, {
        unsubscribeToken: subscriber.unsubscribe_token,
        weekDate,
      });
      const text = generatePhysicianDigestText(content, {
        unsubscribeToken: subscriber.unsubscribe_token,
        weekDate,
      });
      const unsubscribeUrl = `${SITE_URL}/api/mrd-digest/unsubscribe?token=${subscriber.unsubscribe_token}`;

      await resend.emails.send({
        from: 'OpenOnco MRD Digest <digest@openonco.org>',
        replyTo: config.email.alertRecipient,
        to: subscriber.email,
        subject: digestRow.subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      delivered++;
      deliveredIds.push(subscriber.id);
    } catch (error) {
      failed++;
      logger.error('Failed to send to subscriber', { email: subscriber.email, error: error.message });
    }
  }

  // Update subscriber send tracking
  if (deliveredIds.length > 0) {
    await markSent(deliveredIds);
  }

  // Update digest history
  await query(
    `UPDATE mrd_digest_history
     SET status = 'sent', approved_at = NOW(), sent_at = NOW(),
         subscriber_count = $2, delivered_count = $3, failed_count = $4
     WHERE id = $1`,
    [digestRow.id, subscribers.length, delivered, failed]
  );

  logger.info('Digest sent', { digestId: digestRow.id, delivered, failed, total: subscribers.length });

  return { success: true, digestId: digestRow.id, delivered, failed, total: subscribers.length };
}

/**
 * Auto-send: If no manual approval by cutoff, auto-send the latest draft
 */
export async function autoSendIfPending() {
  const result = await query(
    `SELECT id, created_at FROM mrd_digest_history WHERE status = 'draft' ORDER BY id DESC LIMIT 1`
  );

  if (result.rows.length === 0) {
    logger.info('No pending draft to auto-send');
    return { action: 'none' };
  }

  const draft = result.rows[0];
  const hoursSinceDraft = (Date.now() - new Date(draft.created_at).getTime()) / (1000 * 60 * 60);

  if (hoursSinceDraft >= 5) {
    logger.info('Auto-sending draft (past cutoff)', { digestId: draft.id, hoursSinceDraft });
    return sendApprovedDigest(draft.id);
  }

  logger.info('Draft still within review window', { digestId: draft.id, hoursSinceDraft });
  return { action: 'waiting', digestId: draft.id, hoursSinceDraft };
}

export default { generateDraft, sendApprovedDigest, autoSendIfPending };
