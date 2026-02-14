/**
 * Admin API for Discoveries
 *
 * Routes:
 *   GET /api/admin/discoveries?key=xxx          - List all discoveries (read-only)
 *   POST /api/admin/discoveries?key=xxx         - Not supported on Vercel (returns error)
 *
 * Query params:
 *   key: Admin API key (required)
 *   source: Filter by source (pubmed, fda, cms, vendor, preprints)
 *   status: Filter by status (pending, reviewed)
 *   limit: Number of results (default 100)
 *   offset: Pagination offset (default 0)
 *
 * NOTE: Write operations (POST) are disabled on Vercel serverless because
 * the filesystem is read-only. Use the local daemon for write operations.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { withVercelLogging } from '../../shared/logger/index.js';

// In Vercel serverless, we read from the daemon/data directory
const DISCOVERIES_FILE = join(process.cwd(), 'daemon', 'data', 'discoveries.json');

const ADMIN_KEY = process.env.ADMIN_KEY;

// Detect if running on Vercel (read-only filesystem)
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

function loadDiscoveries(logger) {
  if (!existsSync(DISCOVERIES_FILE)) {
    return { data: [], error: null };
  }
  try {
    const content = readFileSync(DISCOVERIES_FILE, 'utf-8');
    return { data: JSON.parse(content), error: null };
  } catch (err) {
    if (logger) {
      logger.error('Error loading discoveries', { error: err });
    }
    return { data: [], error: err.message };
  }
}

export default withVercelLogging((req, res) => {
  const startTime = Date.now();

  // CORS headers — admin endpoints restricted to our domain
  const origin = req.headers.origin || '';
  const allowed = origin.endsWith('openonco.org') || origin.includes('localhost');
  res.setHeader('Access-Control-Allow-Origin', allowed ? origin : 'https://openonco.org');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key, Admin-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth check - support key in query param or header
  const key = req.query.key || req.headers['x-admin-key'] || req.headers['admin-key'];
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    req.logger.warn('Unauthorized access attempt', { hasKey: !!key, keyPrefix: key?.slice(0, 4) });
    req.logger.info('Error response sent', { status: 401, durationMs: Date.now() - startTime, errorType: 'unauthorized' });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - invalid or missing admin key'
    });
  }

  if (req.method === 'GET') {
    return handleGet(req, res, startTime);
  } else if (req.method === 'POST') {
    // Write operations are not supported on Vercel due to read-only filesystem
    if (IS_VERCEL) {
      req.logger.info('Error response sent', { status: 501, durationMs: Date.now() - startTime, errorType: 'write_not_supported' });
      return res.status(501).json({
        success: false,
        error: 'Write operations not supported on Vercel',
        message: 'The Vercel serverless environment has a read-only filesystem. Use the local daemon to mark discoveries as reviewed.'
      });
    }
    req.logger.info('Error response sent', { status: 501, durationMs: Date.now() - startTime, errorType: 'write_disabled' });
    return res.status(501).json({
      success: false,
      error: 'Write operations disabled',
      message: 'POST operations have been disabled. Use the local daemon for write operations.'
    });
  } else {
    req.logger.info('Error response sent', { status: 405, durationMs: Date.now() - startTime });
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }
}, { moduleName: 'api:admin:discoveries' });

function handleGet(req, res, startTime) {
  const { source, status, limit = '100', offset = '0' } = req.query;

  req.logger.info('Admin discoveries request received', {
    source: source || 'all',
    status: status || 'all',
    limit,
    offset
  });

  const { data: allDiscoveries, error: loadError } = loadDiscoveries(req.logger);

  if (loadError) {
    req.logger.info('Error response sent', { status: 500, durationMs: Date.now() - startTime, errorType: 'load_error' });
    return res.status(500).json({
      success: false,
      error: 'Failed to load discoveries',
      message: loadError
    });
  }

  let discoveries = [...allDiscoveries];

  // Apply filters
  if (source) {
    discoveries = discoveries.filter(d => d.source === source);
  }
  if (status) {
    discoveries = discoveries.filter(d => d.status === status);
  }

  // Sort by discoveredAt descending (newest first)
  discoveries.sort((a, b) => new Date(b.discoveredAt) - new Date(a.discoveredAt));

  // Calculate stats
  const stats = {
    total: allDiscoveries.length,
    pending: allDiscoveries.filter(d => d.status === 'pending').length,
    reviewed: allDiscoveries.filter(d => d.status === 'reviewed').length,
    bySource: {}
  };

  // Count by source
  const sources = ['pubmed', 'fda', 'cms', 'vendor', 'preprints'];
  sources.forEach(s => {
    stats.bySource[s] = allDiscoveries.filter(d => d.source === s).length;
  });

  // Pagination
  const limitNum = parseInt(limit, 10);
  const offsetNum = parseInt(offset, 10);
  const paginated = discoveries.slice(offsetNum, offsetNum + limitNum);

  req.logger.info('Response sent', {
    status: 200,
    durationMs: Date.now() - startTime,
    discoveryCount: paginated.length,
    hasMore: offsetNum + limitNum < discoveries.length
  });
  return res.status(200).json({
    success: true,
    meta: {
      total: discoveries.length,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < discoveries.length,
      readOnly: IS_VERCEL
    },
    stats,
    data: paginated
  });
}

