/**
 * Coverage Stats API Endpoint
 * Computes coverage statistics directly from data.js on the Vercel side
 *
 * GET /api/coverage-stats
 */

import { dal } from './_data.js';
import { withVercelLogging } from '../shared/logger/index.js';

export default withVercelLogging(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data: allTests } = await dal.tests.findAll();

    const uniquePayers = new Set();
    let testsWithCoverage = 0;

    for (const test of allTests) {
      const hasCommercial = Array.isArray(test.commercialPayers) && test.commercialPayers.length > 0;
      const hasCrossRef = test.coverageCrossReference &&
        typeof test.coverageCrossReference === 'object' &&
        Object.keys(test.coverageCrossReference).length > 0;

      if (hasCommercial || hasCrossRef) {
        testsWithCoverage++;
      }

      if (hasCommercial) {
        for (const payer of test.commercialPayers) {
          uniquePayers.add(payer.trim().toLowerCase());
        }
      }

      if (hasCrossRef && test.coverageCrossReference.privatePayers) {
        for (const payerId of Object.keys(test.coverageCrossReference.privatePayers)) {
          uniquePayers.add(payerId.toLowerCase());
        }
      }
    }

    const stats = {
      generated: new Date().toISOString(),
      sources: {
        payers: { label: 'Private Payers', count: uniquePayers.size, unit: 'insurers tracked', color: 'blue' },
        tests: { label: 'Tests', count: testsWithCoverage, unit: 'with coverage data', color: 'violet' },
      },
    };

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(stats);
  } catch (error) {
    req.logger.error('Coverage stats error', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
}, { moduleName: 'api:coverage-stats' });
