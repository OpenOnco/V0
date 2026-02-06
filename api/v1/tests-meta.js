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
import { withVercelLogging } from '../../shared/logger/index.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCorsHeaders(res) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
}

export default withVercelLogging(async (req, res) => {
  const startTime = Date.now();
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    req.logger.info('Error response sent', { status: 405, durationMs: Date.now() - startTime });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    req.logger.info('Tests meta request received');

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

    req.logger.info('Response sent', { status: 200, durationMs: Date.now() - startTime, testsReturned: tests.length });
    return res.status(200).json({
      count: tests.length,
      generated: new Date().toISOString(),
      tests,
    });
  } catch (error) {
    req.logger.error('API error', { error });
    req.logger.info('Error response sent', { status: 500, durationMs: Date.now() - startTime, errorType: 'internal_error' });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}, { moduleName: 'api:v1:tests-meta' });
