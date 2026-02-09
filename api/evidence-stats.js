/**
 * Evidence Stats API Endpoint
 * Proxies requests to the Railway daemon which queries the physician-system DB
 *
 * GET /api/evidence-stats
 */

import { withVercelLogging } from '../shared/logger/index.js';

const DAEMON_URL = process.env.MRD_DAEMON_URL || 'https://physician-system-production.up.railway.app';

export default withVercelLogging(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${DAEMON_URL}/api/evidence-stats`);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      req.logger.error('Daemon returned non-JSON response', {
        status: response.status,
        contentType,
        bodyPreview: text.slice(0, 200),
      });
      return res.status(502).json({ error: 'Evidence stats service temporarily unavailable' });
    }

    const data = await response.json();
    // Cache for 5 minutes at CDN level
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(response.status).json(data);
  } catch (error) {
    req.logger.error('Evidence stats proxy error', { error, daemonUrl: DAEMON_URL });
    return res.status(500).json({ error: 'Internal server error' });
  }
}, { moduleName: 'api:evidence-stats' });
