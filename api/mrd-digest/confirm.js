/**
 * MRD Digest Confirm API Endpoint
 * Proxies confirmation to Railway daemon, then redirects to site
 *
 * GET /api/mrd-digest/confirm?token=<confirmation_token>
 */

import { withVercelLogging } from '../../shared/logger/index.js';

const DAEMON_URL = process.env.TRACKER_DAEMON_URL || 'https://daemon-production-5ed1.up.railway.app';
const SITE_URL = process.env.SITE_URL || 'https://www.openonco.org';

export default withVercelLogging(async (req, res) => {
  // This is a GET endpoint clicked from email links
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const token = req.query.token;

  if (!token) {
    return res.redirect(302, `${SITE_URL}/?digest_error=missing_token`);
  }

  try {
    req.logger.info('Digest confirm request');

    const response = await fetch(`${DAEMON_URL}/api/digest/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (data.success) {
        return res.redirect(302, `${SITE_URL}/?digest_confirmed=true`);
      }
    }

    // Token invalid or expired
    return res.redirect(302, `${SITE_URL}/?digest_error=invalid_token`);
  } catch (error) {
    req.logger.error('Confirm proxy error', { error: error.message });
    return res.redirect(302, `${SITE_URL}/?digest_error=server_error`);
  }
}, { moduleName: 'api:digest:confirm' });
