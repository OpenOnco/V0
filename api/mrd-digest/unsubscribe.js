/**
 * MRD Digest Unsubscribe API Endpoint
 * One-click unsubscribe from email link — returns standalone HTML page
 *
 * GET /api/mrd-digest/unsubscribe?token=<unsubscribe_token>
 */

import { withVercelLogging } from '../../shared/logger/index.js';

const DAEMON_URL = process.env.TRACKER_DAEMON_URL || 'https://daemon-production-5ed1.up.railway.app';
const SITE_URL = process.env.SITE_URL || 'https://www.openonco.org';

function renderHtml(title, message, showResubscribe = false) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - OpenOnco</title>
  <style>
    body { margin: 0; padding: 40px 20px; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .card { max-width: 480px; margin: 60px auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    h1 { color: #334155; font-size: 22px; margin: 0 0 16px; }
    p { color: #64748b; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    a { color: #059669; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .btn { display: inline-block; background: #059669; color: #fff !important; padding: 10px 24px; border-radius: 8px; text-decoration: none !important; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    ${showResubscribe ? `<p><a href="${SITE_URL}/digest" class="btn">Re-subscribe</a></p>` : ''}
    <p><a href="${SITE_URL}">Return to OpenOnco</a></p>
  </div>
</body>
</html>`;
}

export default withVercelLogging(async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const token = req.query.token;

  if (!token) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(renderHtml('Missing Token', 'No unsubscribe token was provided.'));
  }

  try {
    req.logger.info('Digest unsubscribe request');

    const response = await fetch(`${DAEMON_URL}/api/digest/unsubscribe?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });

    const contentType = response.headers.get('content-type') || '';
    let data = {};
    if (contentType.includes('application/json')) {
      data = await response.json();
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');

    if (data.success) {
      return res.status(200).send(renderHtml(
        'Unsubscribed',
        'You have been unsubscribed from the MRD Weekly Digest. You will no longer receive emails from us.',
        true
      ));
    }

    return res.status(200).send(renderHtml(
      'Unsubscribed',
      'You are already unsubscribed or the link has expired.',
      true
    ));
  } catch (error) {
    req.logger.error('Unsubscribe proxy error', { error: error.message });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(renderHtml('Error', 'Something went wrong. Please try again later.'));
  }
}, { moduleName: 'api:digest:unsubscribe' });
