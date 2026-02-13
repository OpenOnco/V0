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

import { withVercelLogging } from '../shared/logger/index.js';

const DAEMON_URL = process.env.MRD_DAEMON_URL || 'https://physician-system-production.up.railway.app';

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = origin.endsWith('openonco.org') || origin.includes('localhost');
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'https://openonco.org');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default withVercelLogging(async (req, res) => {
  const startTime = Date.now();

  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    req.logger.info('Error response sent', { status: 405, durationMs: Date.now() - startTime });
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { query, filters = {} } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      req.logger.info('Error response sent', { status: 400, durationMs: Date.now() - startTime, errorType: 'validation' });
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid query',
      });
    }

    if (query.length > 1000) {
      req.logger.info('Error response sent', { status: 400, durationMs: Date.now() - startTime, errorType: 'validation' });
      return res.status(400).json({
        success: false,
        error: 'Query too long (max 1000 characters)',
      });
    }

    // Log request
    req.logger.info('MRD chat request received', {
      queryLength: query?.length,
      hasCancerType: !!filters?.cancerType,
      hasClinicalSetting: !!filters?.clinicalSetting
    });

    // Forward request to daemon's MRD chat API
    const response = await fetch(`${DAEMON_URL}/api/mrd-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown',
      },
      body: JSON.stringify({ query, filters }),
    });

    // Parse response — guard against non-JSON daemon responses
    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      req.logger.error('Daemon returned non-JSON response', {
        status: response.status,
        contentType,
        bodyPreview: text.slice(0, 200),
      });
      return res.status(502).json({
        success: false,
        error: 'MRD service temporarily unavailable',
      });
    }

    // Log response
    req.logger.info('Response sent', {
      status: response.status,
      durationMs: Date.now() - startTime
    });

    // Forward the daemon's response
    return res.status(response.status).json(data);

  } catch (error) {
    req.logger.error('MRD chat proxy error', {
      error,
      daemonUrl: DAEMON_URL
    });

    req.logger.info('Error response sent', { status: 500, durationMs: Date.now() - startTime, errorType: 'proxy_error' });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
}, { moduleName: 'api:chat:mrd' });
