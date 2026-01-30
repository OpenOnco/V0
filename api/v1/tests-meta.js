/**
 * OpenOnco API v1 - Tests Metadata Endpoint
 *
 * Returns minimal metadata for all tests across all categories.
 * Designed for external integrations that need test identifiers and CPT codes.
 *
 * GET /api/v1/tests-meta
 *
 * Response: { count, generated, tests: [{ id, name, vendor, category, cptCodes }] }
 */

import { dal } from '../_data.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCorsHeaders(res) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Fetch all tests using findAll() to ensure we get all tests
    // regardless of internal category structure
    const { data: allTests } = await dal.tests.findAll();

    // Extract only the required fields
    // Category is derived from ID prefix (mrd-*, ecd-*, tds-*, trm-*, hct-*)
    const tests = allTests.map(test => {
      const idPrefix = test.id.split('-')[0];
      return {
        id: test.id,
        name: test.name,
        vendor: test.vendor,
        category: idPrefix, // Use ID prefix as category
        cptCodes: test.cptCodes || null,
      };
    });

    // Set cache header for CDN (1 hour)
    res.setHeader('Cache-Control', 'public, s-maxage=3600');

    return res.status(200).json({
      count: tests.length,
      generated: new Date().toISOString(),
      tests,
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
