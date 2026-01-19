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

// In Vercel serverless, we read from the daemon/data directory
const DISCOVERIES_FILE = join(process.cwd(), 'daemon', 'data', 'discoveries.json');

// Simple admin key check - in production you'd want proper auth
const ADMIN_KEY = process.env.ADMIN_KEY || 'openonco-admin-2024';

// Detect if running on Vercel (read-only filesystem)
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

function loadDiscoveries() {
  if (!existsSync(DISCOVERIES_FILE)) {
    return { data: [], error: null };
  }
  try {
    const content = readFileSync(DISCOVERIES_FILE, 'utf-8');
    return { data: JSON.parse(content), error: null };
  } catch (err) {
    console.error('Error loading discoveries:', err.message);
    return { data: [], error: err.message };
  }
}

export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth check - support key in query param or header
  const key = req.query.key || req.headers['x-admin-key'] || req.headers['admin-key'];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - invalid or missing admin key'
    });
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST') {
    // Write operations are not supported on Vercel due to read-only filesystem
    if (IS_VERCEL) {
      return res.status(501).json({
        success: false,
        error: 'Write operations not supported on Vercel',
        message: 'The Vercel serverless environment has a read-only filesystem. Use the local daemon to mark discoveries as reviewed.'
      });
    }
    return res.status(501).json({
      success: false,
      error: 'Write operations disabled',
      message: 'POST operations have been disabled. Use the local daemon for write operations.'
    });
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }
}

function handleGet(req, res) {
  const { source, status, limit = '100', offset = '0' } = req.query;

  const { data: allDiscoveries, error: loadError } = loadDiscoveries();

  if (loadError) {
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

