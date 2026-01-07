/**
 * OpenOnco Public API - List Categories
 * GET /api/v1/categories
 * 
 * Returns all test categories with metadata and test counts.
 */

import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../_data.js';

const CATEGORIES = [
  {
    id: 'mrd',
    name: 'Molecular Residual Disease',
    shortName: 'MRD',
    description: 'Post-treatment monitoring tests that detect minimal residual disease and early cancer recurrence through circulating tumor DNA.',
    useCase: 'Post-surgery surveillance, treatment response assessment, early recurrence detection',
    keyMetrics: ['sensitivity', 'specificity', 'lod', 'leadTime', 'initialTat', 'followUpTat'],
    data: mrdTestData,
  },
  {
    id: 'ecd',
    name: 'Early Cancer Detection',
    shortName: 'ECD',
    description: 'Screening tests designed to detect cancer in asymptomatic individuals, including multi-cancer early detection (MCED) panels.',
    useCase: 'Cancer screening, early detection in high-risk populations',
    keyMetrics: ['sensitivity', 'specificity', 'ppv', 'npv', 'stageISensitivity'],
    data: ecdTestData,
  },
  {
    id: 'trm',
    name: 'Treatment Response Monitoring',
    shortName: 'TRM',
    description: 'Tests that track treatment effectiveness during active therapy by monitoring ctDNA levels or other biomarkers.',
    useCase: 'Chemotherapy response tracking, therapy adjustment decisions',
    keyMetrics: ['sensitivity', 'specificity', 'tat', 'responseDefinition'],
    data: trmTestData,
  },
  {
    id: 'tds',
    name: 'Treatment Decision Support',
    shortName: 'TDS',
    description: 'Comprehensive genomic profiling (CGP) tests that identify actionable mutations to guide therapy selection.',
    useCase: 'Therapy selection, clinical trial matching, companion diagnostics',
    keyMetrics: ['genesAnalyzed', 'fdaCdxIndications', 'tat', 'sampleType'],
    data: tdsTestData,
  },
];

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=600, s-maxage=1800', // 10min client, 30min CDN
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
    const categories = CATEGORIES.map(cat => {
      // Filter out IVD kits for count (they have "-kit-" in ID)
      const clinicalTests = cat.data.filter(t => !t.id.includes('-kit-'));
      const ivdKits = cat.data.filter(t => t.id.includes('-kit-'));
      
      // Get unique vendors
      const vendors = [...new Set(cat.data.map(t => t.vendor).filter(Boolean))];
      
      return {
        id: cat.id,
        name: cat.name,
        shortName: cat.shortName,
        description: cat.description,
        useCase: cat.useCase,
        keyMetrics: cat.keyMetrics,
        stats: {
          totalTests: clinicalTests.length,
          ivdKits: ivdKits.length,
          vendors: vendors.length,
        },
        links: {
          tests: `https://openonco.org/api/v1/tests?category=${cat.id}`,
          web: `https://openonco.org/${cat.id}`,
        },
      };
    });

    const totalTests = categories.reduce((sum, cat) => sum + cat.stats.totalTests, 0);
    const totalKits = categories.reduce((sum, cat) => sum + cat.stats.ivdKits, 0);

    return res.status(200).json({
      success: true,
      meta: {
        totalCategories: categories.length,
        totalTests,
        totalIvdKits: totalKits,
        generatedAt: new Date().toISOString(),
        source: 'OpenOnco (openonco.org)',
        license: 'CC BY 4.0',
      },
      data: categories,
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
