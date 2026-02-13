/**
 * MRD Digest Subscribe API Endpoint
 * Proxies subscription requests to Railway daemon (test-data-tracker)
 *
 * POST /api/mrd-digest/subscribe
 * Body: { email, name?, cancerTypes?, contentTypes?, institution? }
 */

import { withVercelLogging } from '../../shared/logger/index.js';

const DAEMON_URL = process.env.TRACKER_DAEMON_URL || 'https://daemon-production-5ed1.up.railway.app';

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = origin.endsWith('openonco.org') || origin.includes('localhost');
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'https://openonco.org');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Simple in-memory rate limiting (per Vercel instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

export default withVercelLogging(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
  }

  try {
    const { email, name, cancerTypes, contentTypes, institution, digestType } = req.body || {};

    // Validate email
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Valid email address is required.' });
    }

    if (email.length > 254) {
      return res.status(400).json({ success: false, error: 'Email address too long.' });
    }

    req.logger.info('Digest subscribe request', { email: email.substring(0, 3) + '***' });

    const response = await fetch(`${DAEMON_URL}/api/digest/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ip,
      },
      body: JSON.stringify({ email: email.trim(), name, cancerTypes, contentTypes, institution, digestType }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      req.logger.error('Daemon returned non-JSON', { status: response.status, bodyPreview: text.slice(0, 200) });
      return res.status(502).json({ success: false, error: 'Service temporarily unavailable' });
    }

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    req.logger.error('Subscribe proxy error', { error: error.message });
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}, { moduleName: 'api:digest:subscribe' });
