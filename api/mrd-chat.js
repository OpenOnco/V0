/**
 * MRD Guidance Chat API Endpoint
 * Proxies requests to the Railway daemon which has internal database access
 *
 * POST /api/mrd-chat
 *
 * Request body:
 * {
 *   "query": "What does evidence say about positive MRD in stage III colorectal?",
 *   "filters": {
 *     "cancerType": "colorectal",
 *     "clinicalSetting": "post_surgery"
 *   }
 * }
 */

const DAEMON_URL = process.env.MRD_DAEMON_URL || 'https://daemon-production-5ed1.up.railway.app';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  // Set CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { query, filters = {} } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid query',
      });
    }

    if (query.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Query too long (max 1000 characters)',
      });
    }

    // Forward request to daemon's MRD chat API
    const response = await fetch(`${DAEMON_URL}/api/mrd-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
      },
      body: JSON.stringify({ query, filters }),
    });

    const data = await response.json();

    // Forward the daemon's response
    return res.status(response.status).json(data);

  } catch (error) {
    console.error('MRD Chat Proxy Error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}
