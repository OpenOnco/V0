/**
 * OpenOnco Public API - List Vendors
 * GET /api/v1/vendors
 * 
 * Returns all vendors with their test counts by category.
 * 
 * Query parameters:
 *   category - Filter to vendors with tests in specific category(ies)
 */

import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../../src/data.js';

const CATEGORY_DATA = {
  mrd: mrdTestData,
  ecd: ecdTestData,
  trm: trmTestData,
  tds: tdsTestData,
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=600, s-maxage=1800',
};

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  try {
    const { category } = req.query;

    // Build vendor map
    const vendorMap = new Map();

    const categories = category 
      ? category.toLowerCase().split(',').map(c => c.trim())
      : Object.keys(CATEGORY_DATA);

    for (const cat of categories) {
      if (!CATEGORY_DATA[cat]) continue;
      
      for (const test of CATEGORY_DATA[cat]) {
        if (!test.vendor) continue;
        
        const isKit = test.id.includes('-kit-');
        
        if (!vendorMap.has(test.vendor)) {
          vendorMap.set(test.vendor, {
            name: test.vendor,
            slug: test.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, ''),
            tests: { mrd: 0, ecd: 0, trm: 0, tds: 0 },
            kits: { mrd: 0, ecd: 0, trm: 0, tds: 0 },
            totalTests: 0,
            totalKits: 0,
            testIds: [],
          });
        }
        
        const vendor = vendorMap.get(test.vendor);
        if (isKit) {
          vendor.kits[cat]++;
          vendor.totalKits++;
        } else {
          vendor.tests[cat]++;
          vendor.totalTests++;
        }
        vendor.testIds.push(test.id);
      }
    }

    // Convert to array and sort by total tests
    let vendors = Array.from(vendorMap.values())
      .sort((a, b) => b.totalTests - a.totalTests);

    // Add links
    vendors = vendors.map(v => ({
      ...v,
      links: {
        tests: `https://openonco.org/api/v1/tests?vendor=${encodeURIComponent(v.name)}`,
      },
    }));

    return res.status(200).json({
      success: true,
      meta: {
        totalVendors: vendors.length,
        generatedAt: new Date().toISOString(),
        source: 'OpenOnco (openonco.org)',
        license: 'CC BY 4.0',
      },
      data: vendors,
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
