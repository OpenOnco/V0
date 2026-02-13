/**
 * MRD Digest Preferences API Endpoint
 * Proxies preference read/update to Railway daemon
 *
 * GET  /api/mrd-digest/preferences?token=<unsubscribe_token>
 * POST /api/mrd-digest/preferences { token, cancerTypes?, contentTypes?, frequency?, name?, institution? }
 */

import { withVercelLogging } from '../../shared/logger/index.js';

const DAEMON_URL = process.env.TRACKER_DAEMON_URL || 'https://daemon-production-5ed1.up.railway.app';

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = origin.endsWith('openonco.org') || origin.includes('localhost');
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'https://openonco.org');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default withVercelLogging(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const token = req.query.token;
      if (!token) return res.status(400).json({ success: false, error: 'Token is required' });

      const response = await fetch(`${DAEMON_URL}/api/digest/preferences?token=${encodeURIComponent(token)}`);
      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        return res.status(502).json({ success: false, error: 'Service temporarily unavailable' });
      }

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    if (req.method === 'POST') {
      const { token, cancerTypes, contentTypes, frequency, name, institution } = req.body || {};
      if (!token) return res.status(400).json({ success: false, error: 'Token is required' });

      const response = await fetch(`${DAEMON_URL}/api/digest/preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cancerTypes, contentTypes, frequency, name, institution }),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return res.status(502).json({ success: false, error: 'Service temporarily unavailable' });
      }

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    req.logger.error('Preferences proxy error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}, { moduleName: 'api:digest:preferences' });
