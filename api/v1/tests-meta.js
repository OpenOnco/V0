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

// Map internal category codes to lowercase API category names
const CATEGORY_OUTPUT_MAP = {
  MRD: 'mrd',
  ECD: 'ecd',
  CGP: 'tds', // CGP is stored internally but exposed as TDS
  TRM: 'trm',
  HCT: 'hct',
};

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
    // Fetch all tests from all categories
    const categories = ['MRD', 'ECD', 'CGP', 'TRM', 'HCT'];
    const allTests = [];

    for (const category of categories) {
      const { data: tests } = await dal.tests.findByCategory(category);
      allTests.push(...tests);
    }

    // Extract only the required fields
    const tests = allTests.map(test => ({
      id: test.id,
      name: test.name,
      vendor: test.vendor,
      category: CATEGORY_OUTPUT_MAP[test.category] || test.category.toLowerCase(),
      cptCodes: test.cptCodes || [],
    }));

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
