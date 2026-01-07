/**
 * OpenOnco Public API - Get Single Test
 * GET /api/v1/tests/[id]
 * 
 * Path parameters:
 *   id - Test ID (e.g., mrd-1, ecd-5, tds-12)
 * 
 * Query parameters:
 *   fields - Comma-separated list of fields to include (default: all)
 * 
 * Response includes full test data with category context.
 */

import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../../_data.js';

// Build lookup map for fast access
const TEST_LOOKUP = new Map();
const CATEGORY_META = {
  mrd: { name: 'Molecular Residual Disease', shortName: 'MRD' },
  ecd: { name: 'Early Cancer Detection', shortName: 'ECD' },
  trm: { name: 'Treatment Response Monitoring', shortName: 'TRM' },
  tds: { name: 'Treatment Decision Support', shortName: 'TDS' },
};

// Populate lookup on module load
[
  { data: mrdTestData, category: 'mrd' },
  { data: ecdTestData, category: 'ecd' },
  { data: trmTestData, category: 'trm' },
  { data: tdsTestData, category: 'tds' },
].forEach(({ data, category }) => {
  data.forEach(test => {
    TEST_LOOKUP.set(test.id, { ...test, category: category.toUpperCase(), categoryName: CATEGORY_META[category].name });
  });
});

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300, s-maxage=600',
};

export default function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  try {
    const { id, fields } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Missing test ID',
        message: 'Please provide a test ID in the URL path (e.g., /api/v1/tests/mrd-1)',
      });
    }

    // Look up test (exact match first)
    let test = TEST_LOOKUP.get(id);

    // Try case-insensitive search if not found
    if (!test) {
      const idLower = id.toLowerCase();
      for (const [key, value] of TEST_LOOKUP) {
        if (key.toLowerCase() === idLower) {
          test = value;
          break;
        }
      }
    }

    // Return 404 if still not found
    if (!test) {
      return res.status(404).json({
        success: false,
        error: 'Test not found',
        message: `No test found with ID "${id}"`,
        hint: 'Test IDs follow the pattern: mrd-1, ecd-5, trm-3, tds-12',
      });
    }

    let responseTest = test;

    // Filter fields if requested
    if (fields) {
      const fieldList = fields.split(',').map(f => f.trim());
      const requiredFields = ['id', 'name', 'vendor', 'category', 'categoryName'];
      const allowedFields = [...new Set([...requiredFields, ...fieldList])];
      
      const filtered = {};
      for (const field of allowedFields) {
        if (responseTest[field] !== undefined) {
          filtered[field] = responseTest[field];
        }
      }
      responseTest = filtered;
    }

    // Add useful links
    const links = {
      self: `https://openonco.org/api/v1/tests/${test.id}`,
      web: `https://openonco.org/${test.category?.toLowerCase()}/${test.id}`,
      category: `https://openonco.org/api/v1/tests?category=${test.category?.toLowerCase()}`,
    };

    return res.status(200).json({
      success: true,
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'OpenOnco (openonco.org)',
        license: 'CC BY 4.0',
      },
      links,
      data: responseTest,
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
