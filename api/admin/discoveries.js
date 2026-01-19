/**
 * Admin API for Discoveries
 *
 * Routes:
 *   GET /api/admin/discoveries?key=xxx          - List all discoveries
 *   POST /api/admin/discoveries?key=xxx         - Mark discovery as reviewed
 *
 * Query params:
 *   key: Admin API key (required)
 *   source: Filter by source (pubmed, fda, cms, vendor, preprints)
 *   status: Filter by status (pending, reviewed)
 *   limit: Number of results (default 100)
 *   offset: Pagination offset (default 0)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// In Vercel serverless, we read from the daemon/data directory
const DISCOVERIES_FILE = join(process.cwd(), 'daemon', 'data', 'discoveries.json');

// Simple admin key check - in production you'd want proper auth
const ADMIN_KEY = process.env.ADMIN_KEY || 'openonco-admin-2024';

function loadDiscoveries() {
  if (!existsSync(DISCOVERIES_FILE)) {
    return [];
  }
  try {
    const content = readFileSync(DISCOVERIES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error loading discoveries:', err.message);
    return [];
  }
}

function saveDiscoveries(discoveries) {
  try {
    writeFileSync(DISCOVERIES_FILE, JSON.stringify(discoveries, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving discoveries:', err.message);
    return false;
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
    return handlePost(req, res);
  } else {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }
}

function handleGet(req, res) {
  const { source, status, limit = '100', offset = '0' } = req.query;

  let discoveries = loadDiscoveries();

  // Apply filters
  if (source) {
    discoveries = discoveries.filter(d => d.source === source);
  }
  if (status) {
    discoveries = discoveries.filter(d => d.status === status);
  }

  // Sort by discoveredAt descending (newest first)
  discoveries.sort((a, b) => new Date(b.discoveredAt) - new Date(a.discoveredAt));

  // Calculate stats before pagination
  const allDiscoveries = loadDiscoveries();
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
      hasMore: offsetNum + limitNum < discoveries.length
    },
    stats,
    data: paginated
  });
}

function handlePost(req, res) {
  const { action, id } = req.body || {};

  if (action === 'markReviewed' && id) {
    const discoveries = loadDiscoveries();
    const index = discoveries.findIndex(d => d.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Discovery not found'
      });
    }

    discoveries[index].reviewedAt = new Date().toISOString();
    discoveries[index].status = 'reviewed';

    if (!saveDiscoveries(discoveries)) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save discovery'
      });
    }

    return res.status(200).json({
      success: true,
      data: discoveries[index]
    });
  }

  if (action === 'markPending' && id) {
    const discoveries = loadDiscoveries();
    const index = discoveries.findIndex(d => d.id === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: 'Discovery not found'
      });
    }

    discoveries[index].reviewedAt = null;
    discoveries[index].status = 'pending';

    if (!saveDiscoveries(discoveries)) {
      return res.status(500).json({
        success: false,
        error: 'Failed to save discovery'
      });
    }

    return res.status(200).json({
      success: true,
      data: discoveries[index]
    });
  }

  return res.status(400).json({
    success: false,
    error: 'Invalid action or missing id'
  });
}
