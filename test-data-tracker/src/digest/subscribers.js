/**
 * Subscriber data access layer for MRD Physician Digest
 * Wraps SQL against mrd_digest_subscribers using db/mrd-client.js
 */

import { query, transaction } from '../db/mrd-client.js';
import { createLogger } from '../utils/logger.js';
import crypto from 'crypto';

const logger = createLogger('digest:subscribers');

/**
 * Create or re-subscribe a subscriber
 * Uses ON CONFLICT to handle re-subscribe flow (reactivate if previously unsubscribed)
 */
export async function createSubscriber({ email, cancerTypes = null, contentTypes = null, name = null, institution = null }) {
  const confirmationToken = crypto.randomUUID();

  const result = await query(
    `INSERT INTO mrd_digest_subscribers (email, cancer_types, content_types, name, institution, confirmation_token, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     ON CONFLICT (email) DO UPDATE SET
       cancer_types = COALESCE($2, mrd_digest_subscribers.cancer_types),
       content_types = COALESCE($3, mrd_digest_subscribers.content_types),
       name = COALESCE($4, mrd_digest_subscribers.name),
       institution = COALESCE($5, mrd_digest_subscribers.institution),
       confirmation_token = $6,
       is_active = TRUE,
       unsubscribed_at = NULL,
       confirmed_at = CASE WHEN mrd_digest_subscribers.confirmed_at IS NOT NULL THEN mrd_digest_subscribers.confirmed_at ELSE NULL END
     RETURNING id, email, confirmation_token, confirmed_at, unsubscribe_token`,
    [email, cancerTypes ? JSON.stringify(cancerTypes) : null, contentTypes ? JSON.stringify(contentTypes) : null, name, institution, confirmationToken]
  );

  logger.info('Subscriber created/updated', { email, id: result.rows[0].id });
  return result.rows[0];
}

/**
 * Confirm a subscriber by their confirmation token
 */
export async function confirmSubscriber(confirmationToken) {
  const result = await query(
    `UPDATE mrd_digest_subscribers
     SET confirmed_at = NOW(), confirmation_token = NULL
     WHERE confirmation_token = $1 AND is_active = TRUE
     RETURNING id, email, confirmed_at`,
    [confirmationToken]
  );

  if (result.rows.length === 0) {
    return null;
  }

  logger.info('Subscriber confirmed', { email: result.rows[0].email });
  return result.rows[0];
}

/**
 * Unsubscribe by unsubscribe token (one-click from email)
 */
export async function unsubscribeByToken(unsubscribeToken) {
  const result = await query(
    `UPDATE mrd_digest_subscribers
     SET unsubscribed_at = NOW(), is_active = FALSE
     WHERE unsubscribe_token = $1
     RETURNING id, email`,
    [unsubscribeToken]
  );

  if (result.rows.length === 0) {
    return null;
  }

  logger.info('Subscriber unsubscribed', { email: result.rows[0].email });
  return result.rows[0];
}

/**
 * Get all active, confirmed subscribers for a given frequency
 */
export async function getActiveSubscribers(frequency = 'weekly') {
  const result = await query(
    `SELECT id, email, name, institution, cancer_types, content_types, frequency, unsubscribe_token, last_sent_at, send_count
     FROM mrd_digest_subscribers
     WHERE is_active = TRUE AND confirmed_at IS NOT NULL AND frequency = $1
     ORDER BY created_at ASC`,
    [frequency]
  );

  return result.rows;
}

/**
 * Get subscriber preferences by unsubscribe token (used for preference management page)
 */
export async function getPreferences(unsubscribeToken) {
  const result = await query(
    `SELECT id, email, name, institution, cancer_types, content_types, frequency, is_active, confirmed_at, created_at
     FROM mrd_digest_subscribers
     WHERE unsubscribe_token = $1`,
    [unsubscribeToken]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Update subscriber preferences by unsubscribe token
 */
export async function updatePreferences(unsubscribeToken, updates) {
  const { cancerTypes, contentTypes, frequency, name, institution } = updates;

  const result = await query(
    `UPDATE mrd_digest_subscribers
     SET
       cancer_types = COALESCE($2, cancer_types),
       content_types = COALESCE($3, content_types),
       frequency = COALESCE($4, frequency),
       name = COALESCE($5, name),
       institution = COALESCE($6, institution)
     WHERE unsubscribe_token = $1 AND is_active = TRUE
     RETURNING id, email, cancer_types, content_types, frequency, name, institution`,
    [
      unsubscribeToken,
      cancerTypes ? JSON.stringify(cancerTypes) : null,
      contentTypes ? JSON.stringify(contentTypes) : null,
      frequency || null,
      name || null,
      institution || null,
    ]
  );

  if (result.rows.length === 0) {
    return null;
  }

  logger.info('Preferences updated', { email: result.rows[0].email });
  return result.rows[0];
}

/**
 * Update last_sent_at and increment send_count for subscribers who received a digest
 */
export async function markSent(subscriberIds) {
  if (!subscriberIds.length) return;

  await query(
    `UPDATE mrd_digest_subscribers
     SET last_sent_at = NOW(), send_count = send_count + 1
     WHERE id = ANY($1)`,
    [subscriberIds]
  );

  logger.info('Marked subscribers as sent', { count: subscriberIds.length });
}

export default {
  createSubscriber,
  confirmSubscriber,
  unsubscribeByToken,
  getActiveSubscribers,
  getPreferences,
  updatePreferences,
  markSent,
};
