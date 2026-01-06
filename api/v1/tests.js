/**
 * OpenOnco Public API - List Tests
 * GET /api/v1/tests
 * 
 * Query parameters:
 *   category   - Filter by category: mrd, ecd, trm, tds (comma-separated for multiple)
 *   vendor     - Filter by vendor name (partial match, case-insensitive)
 *   cancer     - Filter by cancer type (partial match in cancerTypes array)
 *   fda        - Filter by FDA status: approved, ldt, breakthrough, all (default: all)
 *   fields     - Comma-separated list of fields to include (default: all)
 *   limit      - Max results (default: 100, max: 500)
 *   offset     - Pagination offset (default: 0)
 * 
 * Response includes CORS headers for cross-origin access.
 */

import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../../src/data.js';

// Category mapping
const CATEGORY_DATA = {
  mrd: { data: mrdTestData, name: 'Molecular Residual Disease', shortName: 'MRD' },
  ecd: { data: ecdTestData, name: 'Early Cancer Detection', shortName: 'ECD' },
  trm: { data: trmTestData, name: 'Treatment Response Monitoring', shortName: 'TRM' },
  tds: { data: tdsTestData, name: 'Treatment Decision Support', shortName: 'TDS' },
};

// CORS headers for public API
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300, s-maxage=600', // 5min client, 10min CDN
};

export default function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeaders(corsHeaders).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  try {
    const {
      category,
      vendor,
      cancer,
      fda = 'all',
      fields,
      limit = '100',
      offset = '0',
    } = req.query;

    // Parse pagination
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 100), 500);
    const offsetNum = Math.max(0, parseInt(offset) || 0);

    // Collect tests from requested categories
    let tests = [];
    const categories = category 
      ? category.toLowerCase().split(',').map(c => c.trim())
      : Object.keys(CATEGORY_DATA);

    for (const cat of categories) {
      if (CATEGORY_DATA[cat]) {
        const categoryTests = CATEGORY_DATA[cat].data.map(test => ({
          ...test,
          category: cat.toUpperCase(),
          categoryName: CATEGORY_DATA[cat].name,
        }));
        tests.push(...categoryTests);
      }
    }

    // Filter by vendor
    if (vendor) {
      const vendorLower = vendor.toLowerCase();
      tests = tests.filter(t => 
        t.vendor && t.vendor.toLowerCase().includes(vendorLower)
      );
    }

    // Filter by cancer type
    if (cancer) {
      const cancerLower = cancer.toLowerCase();
      tests = tests.filter(t => 
        t.cancerTypes && t.cancerTypes.some(ct => 
          ct.toLowerCase().includes(cancerLower)
        )
      );
    }

    // Filter by FDA status
    if (fda && fda !== 'all') {
      const fdaLower = fda.toLowerCase();
      tests = tests.filter(t => {
        if (!t.fdaStatus) return false;
        const status = t.fdaStatus.toLowerCase();
        
        if (fdaLower === 'approved') {
          return status.includes('fda') && (status.includes('approved') || status.includes('cleared') || status.includes('pma') || status.includes('510'));
        }
        if (fdaLower === 'ldt') {
          return status.includes('ldt') || status.includes('clia');
        }
        if (fdaLower === 'breakthrough') {
          return status.includes('breakthrough');
        }
        return true;
      });
    }

    // Calculate totals before pagination
    const totalCount = tests.length;

    // Apply pagination
    tests = tests.slice(offsetNum, offsetNum + limitNum);

    // Filter fields if requested
    if (fields) {
      const fieldList = fields.split(',').map(f => f.trim());
      // Always include id, name, vendor, category for usability
      const requiredFields = ['id', 'name', 'vendor', 'category', 'categoryName'];
      const allowedFields = [...new Set([...requiredFields, ...fieldList])];
      
      tests = tests.map(test => {
        const filtered = {};
        for (const field of allowedFields) {
          if (test[field] !== undefined) {
            filtered[field] = test[field];
          }
        }
        return filtered;
      });
    }

    // Response
    return res.status(200).json({
      success: true,
      meta: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        returned: tests.length,
        hasMore: offsetNum + tests.length < totalCount,
        generatedAt: new Date().toISOString(),
        source: 'OpenOnco (openonco.org)',
        license: 'CC BY 4.0',
      },
      data: tests,
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}
