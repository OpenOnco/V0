/**
 * Digest Confirmation Email Template
 * Sent when a physician subscribes to the MRD Weekly Digest
 */

import { Resend } from 'resend';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('email:digest-confirmation');

const SITE_URL = process.env.SITE_URL || 'https://www.openonco.org';

/**
 * Send confirmation email to new subscriber
 */
export async function sendConfirmationEmail({ email, confirmationToken, name, digestType }) {
  if (!config.email.apiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping confirmation email');
    return { success: false, error: 'No API key' };
  }

  const confirmUrl = `${SITE_URL}/api/mrd-digest/confirm?token=${confirmationToken}`;
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const isRD = digestType === 'research';

  const digestName = isRD ? 'R&D Industry Digest' : 'MRD Weekly Digest';
  const tagline = isRD
    ? 'Weekly Market Intelligence for Industry Professionals'
    : 'Weekly Clinical Intelligence for Physicians';
  const headerColor = isRD ? '#7c3aed' : '#059669';
  const headerColorLight = isRD ? '#c4b5fd' : '#a7f3d0';
  const buttonColor = isRD ? '#7c3aed' : '#059669';
  const description = isRD
    ? 'weekly updates on liquid biopsy industry developments, regulatory changes, and market intelligence'
    : 'weekly updates on MRD/ctDNA clinical developments';
  const bulletItems = isRD
    ? [
        'Vendor news &amp; product launches',
        'FDA &amp; regulatory updates',
        'Clinical publications &amp; trials',
        'New tests and pricing/PLA codes',
      ]
    : [
        'Top clinical evidence highlights (PubMed, preprints)',
        'Payer coverage policy updates',
        'New tests and FDA designations',
        'NCCN/ESMO/ASCO guideline changes',
      ];
  const bulletItemsText = isRD
    ? [
        'Vendor news & product launches',
        'FDA & regulatory updates',
        'Clinical publications & trials',
        'New tests and pricing/PLA codes',
      ]
    : [
        'Top clinical evidence highlights (PubMed, preprints)',
        'Payer coverage policy updates',
        'New tests and FDA designations',
        'NCCN/ESMO/ASCO guideline changes',
      ];

  const resend = new Resend(config.email.apiKey);

  try {
    const result = await resend.emails.send({
      from: `OpenOnco ${digestName} <digest@openonco.org>`,
      replyTo: config.email.alertRecipient,
      to: email,
      subject: `Confirm your ${digestName} subscription`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${headerColor},${isRD ? '#6d28d9' : '#047857'});padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">OpenOnco ${digestName}</h1>
              <p style="margin:8px 0 0;color:${headerColorLight};font-size:14px;">${tagline}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6;">${greeting}</p>
              <p style="margin:0 0 24px;color:#334155;font-size:16px;line-height:1.6;">
                Thank you for subscribing to the OpenOnco ${digestName}. Please confirm your email address to start receiving ${description}.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${confirmUrl}" style="display:inline-block;background-color:${buttonColor};color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
                      Confirm Subscription
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 16px;color:#64748b;font-size:14px;line-height:1.6;">
                <strong>What you'll receive:</strong>
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;color:#64748b;font-size:14px;line-height:1.8;">
                ${bulletItems.map(item => `<li>${item}</li>`).join('\n                ')}
              </ul>

              <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
                If you didn't subscribe, you can safely ignore this email. This link expires in 7 days.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">
                OpenOnco &mdash; Open-source cancer diagnostic test database
              </p>
              <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">
                <a href="${SITE_URL}" style="color:#059669;text-decoration:none;">openonco.org</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `${greeting}

Thank you for subscribing to the OpenOnco ${digestName}.

Please confirm your email address by visiting:
${confirmUrl}

What you'll receive:
${bulletItemsText.map(item => `- ${item}`).join('\n')}

If you didn't subscribe, you can safely ignore this email.

OpenOnco - openonco.org`,
    });

    logger.info('Confirmation email sent', { email, messageId: result.data?.id });
    return { success: true, messageId: result.data?.id };
  } catch (error) {
    logger.error('Failed to send confirmation email', { email, error: error.message });
    throw error;
  }
}

export default { sendConfirmationEmail };
