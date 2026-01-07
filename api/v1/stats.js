/**
 * OpenOnco Public API - Database Statistics
 * GET /api/v1/stats
 * 
 * Returns summary statistics about the OpenOnco database.
 */

import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../_data.js';

const ALL_DATA = {
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

function calculateStats() {
  const stats = {
    database: {
      lastUpdated: new Date().toISOString().split('T')[0], // Today's date as proxy
      version: '2.0',
    },
    totals: {
      tests: 0,
      ivdKits: 0,
      vendors: new Set(),
      cancerTypes: new Set(),
    },
    byCategory: {},
    regulatory: {
      fdaApproved: 0,
      fdaBreakthrough: 0,
      cliaLdt: 0,
      other: 0,
    },
    sampleTypes: {},
    coverage: {
      medicareNational: 0,
      medicareLocal: 0,
      commercialBroad: 0,
      limited: 0,
    },
  };

  for (const [category, tests] of Object.entries(ALL_DATA)) {
    const clinicalTests = tests.filter(t => !t.id.includes('-kit-'));
    const kits = tests.filter(t => t.id.includes('-kit-'));

    stats.byCategory[category.toUpperCase()] = {
      tests: clinicalTests.length,
      ivdKits: kits.length,
      vendors: [...new Set(tests.map(t => t.vendor).filter(Boolean))].length,
    };

    stats.totals.tests += clinicalTests.length;
    stats.totals.ivdKits += kits.length;

    for (const test of tests) {
      // Vendors
      if (test.vendor) stats.totals.vendors.add(test.vendor);
      
      // Cancer types
      if (test.cancerTypes) {
        test.cancerTypes.forEach(ct => stats.totals.cancerTypes.add(ct));
      }
      
      // Sample types
      if (test.sampleCategory) {
        stats.sampleTypes[test.sampleCategory] = (stats.sampleTypes[test.sampleCategory] || 0) + 1;
      }
      
      // Regulatory (only count clinical tests, not kits)
      if (!test.id.includes('-kit-') && test.fdaStatus) {
        const status = test.fdaStatus.toLowerCase();
        if (status.includes('fda') && (status.includes('approved') || status.includes('cleared') || status.includes('pma') || status.includes('510'))) {
          stats.regulatory.fdaApproved++;
        } else if (status.includes('breakthrough')) {
          stats.regulatory.fdaBreakthrough++;
        } else if (status.includes('ldt') || status.includes('clia')) {
          stats.regulatory.cliaLdt++;
        } else {
          stats.regulatory.other++;
        }
      }
      
      // Reimbursement
      if (!test.id.includes('-kit-') && test.reimbursement) {
        const reimb = test.reimbursement.toLowerCase();
        if (reimb.includes('medicare') && reimb.includes('national')) {
          stats.coverage.medicareNational++;
        } else if (reimb.includes('medicare') && reimb.includes('local')) {
          stats.coverage.medicareLocal++;
        } else if (reimb.includes('commercial') || reimb.includes('broad')) {
          stats.coverage.commercialBroad++;
        } else {
          stats.coverage.limited++;
        }
      }
    }
  }

  // Convert sets to counts
  stats.totals.vendors = stats.totals.vendors.size;
  stats.totals.cancerTypes = stats.totals.cancerTypes.size;

  return stats;
}

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
    const stats = calculateStats();

    return res.status(200).json({
      success: true,
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'OpenOnco (openonco.org)',
        license: 'CC BY 4.0',
        description: 'Non-profit cancer diagnostic test database providing independent, transparent test comparison.',
      },
      data: stats,
      links: {
        tests: 'https://openonco.org/api/v1/tests',
        categories: 'https://openonco.org/api/v1/categories',
        vendors: 'https://openonco.org/api/v1/vendors',
        documentation: 'https://openonco.org/api',
        website: 'https://openonco.org',
      },
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
