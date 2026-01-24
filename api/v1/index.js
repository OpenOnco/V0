/**
 * OpenOnco Public API v1 - Unified Handler
 *
 * Routes:
 *   GET /api/v1                        - API documentation
 *   GET /api/v1/tests                  - List all tests
 *   GET /api/v1/tests/:id              - Get single test
 *   GET /api/v1/categories             - List categories
 *   GET /api/v1/vendors                - List vendors
 *   GET /api/v1/stats                  - Database statistics
 *   GET /api/v1/embed/test             - Embeddable test card
 *   GET /api/v1/coverage               - List tests with coverage data
 *   GET /api/v1/coverage/:testId       - Get coverage data for a test
 *   GET /api/v1/coverage/payer/:name   - Get tests by payer coverage status
 *   GET /api/v1/search                 - Full-text search across tests
 */

import { dal } from '../_data.js';
import { generateHtmlDocs, generateJsonDocs } from './docs.js';

// ============================================================================
// SHARED CONSTANTS
// ============================================================================

const VALID_PAYERS = ['aetna', 'cigna', 'united', 'anthem', 'humana'];
const VALID_MEDICARE_STATUSES = ['COVERED', 'NOT_COVERED', 'PENDING', 'PARTIAL', 'EXPERIMENTAL'];

// Category metadata for API responses
const CATEGORY_INFO = {
  MRD: { name: 'Molecular Residual Disease', shortName: 'MRD', urlPath: 'monitor' },
  ECD: { name: 'Early Cancer Detection', shortName: 'ECD', urlPath: 'screen' },
  CGP: { name: 'Comprehensive Genomic Profiling', shortName: 'CGP', urlPath: 'treat' },
  HCT: { name: 'Hereditary Cancer Testing', shortName: 'HCT', urlPath: 'risk' },
};

// Map lowercase API category params to uppercase category codes
const CATEGORY_PARAM_MAP = {
  mrd: 'MRD',
  ecd: 'ECD',
  cgp: 'CGP',
  hct: 'HCT',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function setCorsHeaders(res) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

function handleDocs(req, res) {
  const accept = req.headers.accept || '';
  const format = req.query.format;

  if (format === 'json' || (!accept.includes('text/html') && accept.includes('application/json'))) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(generateJsonDocs());
  }

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(generateHtmlDocs());
}

async function handleTests(req, res) {
  const { category, vendor, cancer, fda = 'all', medicare, payer, payerStatus, fields, limit = '100', offset = '0' } = req.query;

  const limitNum = Math.min(Math.max(1, parseInt(limit) || 100), 500);
  const offsetNum = Math.max(0, parseInt(offset) || 0);

  // Build where clause
  const where = {};

  // Category filter
  if (category) {
    const categories = category.toLowerCase().split(',').map(c => c.trim());
    const validCategories = categories
      .filter(c => CATEGORY_PARAM_MAP[c])
      .map(c => CATEGORY_PARAM_MAP[c]);
    if (validCategories.length === 1) {
      where.category = validCategories[0];
    } else if (validCategories.length > 1) {
      where.category = { in: validCategories };
    }
  }

  // Vendor filter
  if (vendor) {
    where.vendor = { contains: vendor };
  }

  // Cancer type filter
  if (cancer) {
    where.cancerTypes = { arrayContains: cancer };
  }

  // Get all matching tests first (before FDA/coverage filters that need custom logic)
  let { data: tests } = await dal.tests.findAll({ where });

  // FDA status filter
  if (fda && fda !== 'all') {
    tests = tests.filter(t => {
      if (!t.fdaStatus) return false;
      const status = t.fdaStatus.toLowerCase();
      if (fda === 'approved') return status.includes('fda') && (status.includes('approved') || status.includes('cleared'));
      if (fda === 'ldt') return status.includes('ldt') || status.includes('clia');
      if (fda === 'breakthrough') return status.includes('breakthrough');
      return true;
    });
  }

  // Medicare coverage filter
  if (medicare) {
    const medicareUpper = medicare.toUpperCase();
    tests = tests.filter(t => t.coverageCrossReference?.medicare?.status === medicareUpper);
  }

  // Private payer filter
  if (payer) {
    const payerLower = payer.toLowerCase();
    if (!VALID_PAYERS.includes(payerLower)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payer',
        message: `Valid payers: ${VALID_PAYERS.join(', ')}`,
      });
    }
    tests = tests.filter(t => t.coverageCrossReference?.privatePayers?.[payerLower]);

    if (payerStatus) {
      const statusUpper = payerStatus.toUpperCase();
      tests = tests.filter(t => t.coverageCrossReference?.privatePayers?.[payerLower]?.status === statusUpper);
    }
  }

  const totalCount = tests.length;
  tests = tests.slice(offsetNum, offsetNum + limitNum);

  // Field selection
  if (fields) {
    const fieldList = fields.split(',').map(f => f.trim());
    const requiredFields = ['id', 'name', 'vendor', 'category', 'categoryName'];
    const allowedFields = [...new Set([...requiredFields, ...fieldList])];
    tests = tests.map(test => {
      const filtered = {};
      for (const field of allowedFields) {
        if (test[field] !== undefined) filtered[field] = test[field];
      }
      return filtered;
    });
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
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
}

async function handleSingleTest(req, res, testId) {
  let test = await dal.tests.findById(testId);

  // Try case-insensitive lookup if not found
  if (!test) {
    const idLower = testId.toLowerCase();
    const { data: allTests } = await dal.tests.findAll();
    test = allTests.find(t => t.id.toLowerCase() === idLower);
  }

  if (!test) {
    return res.status(404).json({ success: false, error: 'Test not found', message: `No test found with ID "${testId}"` });
  }

  const urlPath = CATEGORY_INFO[test.category]?.urlPath || test.category.toLowerCase();

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  return res.status(200).json({
    success: true,
    meta: { generatedAt: new Date().toISOString(), source: 'OpenOnco (openonco.org)', license: 'CC BY 4.0' },
    links: { self: `https://openonco.org/api/v1/tests/${test.id}`, web: `https://openonco.org/${urlPath}/${test.id}` },
    data: test,
  });
}

async function handleCategories(req, res) {
  const stats = await dal.tests.getStats();

  const categories = Object.entries(CATEGORY_INFO).map(([id, info]) => ({
    id: id.toLowerCase(),
    name: info.name,
    shortName: info.shortName,
    urlPath: info.urlPath,
    description: getDescription(id.toLowerCase()),
    stats: {
      totalTests: stats.byCategory[id]?.tests || 0,
      vendors: stats.byCategory[id]?.vendors || 0,
    },
    links: {
      tests: `https://openonco.org/api/v1/tests?category=${id.toLowerCase()}`,
      web: `https://openonco.org/${info.urlPath}`,
    },
  }));

  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800');
  return res.status(200).json({
    success: true,
    meta: { totalCategories: categories.length, generatedAt: new Date().toISOString(), source: 'OpenOnco (openonco.org)', license: 'CC BY 4.0' },
    data: categories,
  });
}

function getDescription(id) {
  const descriptions = {
    mrd: 'Post-treatment surveillance to detect cancer recurrence at the molecular level',
    ecd: 'Screening tests designed to detect cancer early, before symptoms appear',
    cgp: 'Comprehensive genomic profiling to identify genetic alterations and guide therapy selection',
    hct: 'Germline genetic testing to assess inherited cancer predisposition risk',
  };
  return descriptions[id] || '';
}

async function handleVendors(req, res) {
  const { category } = req.query;

  const { data: allTests } = await dal.tests.findAll();

  const vendorMap = new Map();

  for (const test of allTests) {
    const vendor = test.vendor;
    const catId = test.category.toLowerCase();

    if (!vendorMap.has(vendor)) {
      vendorMap.set(vendor, { name: vendor, tests: { mrd: 0, ecd: 0, cgp: 0, hct: 0 }, kits: { mrd: 0, ecd: 0, cgp: 0, hct: 0 }, totalTests: 0 });
    }
    const v = vendorMap.get(vendor);
    if (test.isKitProduct) v.kits[catId]++;
    else v.tests[catId]++;
    v.totalTests++;
  }

  let vendors = Array.from(vendorMap.values()).sort((a, b) => b.totalTests - a.totalTests);

  if (category) {
    const cat = category.toLowerCase();
    vendors = vendors.filter(v => (v.tests[cat] || 0) + (v.kits[cat] || 0) > 0);
  }

  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800');
  return res.status(200).json({
    success: true,
    meta: { totalVendors: vendors.length, generatedAt: new Date().toISOString(), source: 'OpenOnco (openonco.org)', license: 'CC BY 4.0' },
    data: vendors,
  });
}

async function handleStats(req, res) {
  const stats = await dal.tests.getStats();

  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800');
  return res.status(200).json({
    success: true,
    meta: { generatedAt: new Date().toISOString(), source: 'OpenOnco (openonco.org)', license: 'CC BY 4.0' },
    data: stats,
  });
}

async function handleEmbed(req, res) {
  const { id, theme = 'light', width = '400', format } = req.query;

  if (!id) {
    return res.status(400).send('<!DOCTYPE html><html><body>Missing test ID</body></html>');
  }

  let test = await dal.tests.findById(id);
  if (!test) {
    const idLower = id.toLowerCase();
    const { data: allTests } = await dal.tests.findAll();
    test = allTests.find(t => t.id.toLowerCase() === idLower);
  }

  if (!test) {
    return res.status(404).send('<!DOCTYPE html><html><body>Test not found</body></html>');
  }

  const urlPath = CATEGORY_INFO[test.category]?.urlPath || test.category.toLowerCase();

  if (format === 'json') {
    return res.status(200).json({
      success: true,
      embed: { iframe: `<iframe src="https://openonco.org/api/v1/embed/test?id=${test.id}" width="${width}" height="280" frameborder="0"></iframe>` },
      data: { id: test.id, name: test.name, vendor: test.vendor, category: test.category },
    });
  }

  const isDark = theme === 'dark';
  const bg = isDark ? '#1f2937' : '#ffffff';
  const text = isDark ? '#f9fafb' : '#111827';
  const muted = isDark ? '#9ca3af' : '#6b7280';
  const accent = '#059669';

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('Cache-Control', 'public, max-age=300');

  const metric1 = test.sensitivity ? `<div class="metric"><div class="metric-label">Sensitivity</div><div class="metric-value">${test.sensitivity}%</div></div>` :
                  test.genesAnalyzed ? `<div class="metric"><div class="metric-label">Genes</div><div class="metric-value">${test.genesAnalyzed}</div></div>` : '';
  const metric2 = test.specificity ? `<div class="metric"><div class="metric-label">Specificity</div><div class="metric-value">${test.specificity}%</div></div>` : '';

  return res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;background:${bg};color:${text};padding:16px}
.card{border:1px solid ${isDark ? '#374151' : '#e5e7eb'};border-radius:12px;padding:16px;max-width:${width}px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px}
.name{font-size:16px;font-weight:600;color:${text}}
.vendor{font-size:13px;color:${muted};margin-top:2px}
.badge{font-size:11px;font-weight:500;padding:2px 8px;border-radius:9999px;background:${accent}20;color:${accent}}
.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px}
.metric{background:${isDark ? '#374151' : '#f3f4f6'};padding:8px;border-radius:6px}
.metric-label{font-size:11px;color:${muted};text-transform:uppercase}
.metric-value{font-size:14px;font-weight:600;color:${text}}
.footer{display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid ${isDark ? '#374151' : '#e5e7eb'}}
.link{font-size:12px;color:${accent};text-decoration:none}
.powered{font-size:10px;color:${muted}}</style></head>
<body><div class="card">
<div class="header"><div><div class="name">${test.name}</div><div class="vendor">${test.vendor}</div></div><span class="badge">${test.category}</span></div>
<div class="metrics">
${metric1}
${metric2}
</div>
<div class="footer"><a class="link" href="https://openonco.org/${urlPath}/${test.id}" target="_blank">View Details →</a><span class="powered">via openonco.org</span></div>
</div></body></html>`);
}

// ============================================================================
// COVERAGE ENDPOINTS
// ============================================================================

async function handleCoverage(req, res) {
  const { medicare, payer, payerStatus, limit = '100', offset = '0' } = req.query;

  const limitNum = Math.min(Math.max(1, parseInt(limit) || 100), 500);
  const offsetNum = Math.max(0, parseInt(offset) || 0);

  // Get all tests with coverageCrossReference
  const { data: allTests } = await dal.tests.findAll();

  let tests = allTests
    .filter(test => test.coverageCrossReference)
    .map(test => ({
      id: test.id,
      name: test.name,
      vendor: test.vendor,
      category: test.category,
      categoryName: test.categoryName,
      coverageCrossReference: test.coverageCrossReference,
    }));

  // Filter by medicare status
  if (medicare) {
    const medicareUpper = medicare.toUpperCase();
    tests = tests.filter(t => t.coverageCrossReference.medicare?.status === medicareUpper);
  }

  // Filter by payer and payerStatus
  if (payer) {
    const payerLower = payer.toLowerCase();
    if (!VALID_PAYERS.includes(payerLower)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payer',
        message: `Valid payers: ${VALID_PAYERS.join(', ')}`,
      });
    }
    tests = tests.filter(t => t.coverageCrossReference.privatePayers?.[payerLower]);

    if (payerStatus) {
      const statusUpper = payerStatus.toUpperCase();
      tests = tests.filter(t => t.coverageCrossReference.privatePayers?.[payerLower]?.status === statusUpper);
    }
  }

  // Calculate summary stats before pagination
  const stats = {
    total: tests.length,
    byMedicareStatus: {},
    byPayer: {},
  };

  for (const test of tests) {
    const medicareStatus = test.coverageCrossReference.medicare?.status || 'UNKNOWN';
    stats.byMedicareStatus[medicareStatus] = (stats.byMedicareStatus[medicareStatus] || 0) + 1;

    for (const payerName of VALID_PAYERS) {
      const payerData = test.coverageCrossReference.privatePayers?.[payerName];
      if (payerData) {
        if (!stats.byPayer[payerName]) {
          stats.byPayer[payerName] = {};
        }
        const status = payerData.status || 'UNKNOWN';
        stats.byPayer[payerName][status] = (stats.byPayer[payerName][status] || 0) + 1;
      }
    }
  }

  const totalCount = tests.length;
  tests = tests.slice(offsetNum, offsetNum + limitNum);

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
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
    stats,
    data: tests,
  });
}

async function handleCoverageById(req, res, testId) {
  let test = await dal.tests.findById(testId);
  if (!test) {
    const idLower = testId.toLowerCase();
    const { data: allTests } = await dal.tests.findAll();
    test = allTests.find(t => t.id.toLowerCase() === idLower);
  }

  if (!test) {
    return res.status(404).json({
      success: false,
      error: 'Test not found',
      message: `No test found with ID "${testId}"`,
    });
  }

  if (!test.coverageCrossReference) {
    return res.status(404).json({
      success: false,
      error: 'No coverage data',
      message: `Test "${testId}" exists but has no coverage data`,
    });
  }

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  return res.status(200).json({
    success: true,
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'OpenOnco (openonco.org)',
      license: 'CC BY 4.0',
    },
    data: {
      testId: test.id,
      testName: test.name,
      vendor: test.vendor,
      category: test.category,
      coverageCrossReference: test.coverageCrossReference,
    },
  });
}

async function handleCoverageByPayer(req, res, payerName) {
  const payerLower = payerName.toLowerCase();

  if (!VALID_PAYERS.includes(payerLower)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payer',
      message: `Valid payers: ${VALID_PAYERS.join(', ')}`,
    });
  }

  const { data: allTests } = await dal.tests.findAll();

  // Collect tests with coverage data for this payer, grouped by status
  const grouped = {};

  for (const test of allTests) {
    const payerData = test.coverageCrossReference?.privatePayers?.[payerLower];
    if (payerData) {
      const status = payerData.status || 'UNKNOWN';
      if (!grouped[status]) {
        grouped[status] = [];
      }
      grouped[status].push({
        id: test.id,
        name: test.name,
        vendor: test.vendor,
        category: test.category,
        categoryName: test.categoryName,
        coverage: payerData,
      });
    }
  }

  const totalTests = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  return res.status(200).json({
    success: true,
    meta: {
      payer: payerLower,
      totalTests,
      generatedAt: new Date().toISOString(),
      source: 'OpenOnco (openonco.org)',
      license: 'CC BY 4.0',
    },
    data: grouped,
  });
}

// ============================================================================
// SEARCH ENDPOINT
// ============================================================================

async function handleSearch(req, res) {
  const { q, category, fields, limit = '100', offset = '0' } = req.query;

  if (!q || q.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Missing search query',
      message: 'The "q" query parameter is required',
    });
  }

  const limitNum = Math.min(Math.max(1, parseInt(limit) || 100), 500);
  const offsetNum = Math.max(0, parseInt(offset) || 0);

  const searchFields = fields ? fields.split(',').map(f => f.trim()) : undefined;

  // Build category filter
  let categories;
  if (category) {
    categories = category.toLowerCase().split(',').map(c => c.trim())
      .filter(c => CATEGORY_PARAM_MAP[c])
      .map(c => CATEGORY_PARAM_MAP[c]);
  }

  // Use DAL search
  const where = categories && categories.length > 0
    ? { category: categories.length === 1 ? categories[0] : { in: categories } }
    : undefined;

  const { data, meta } = await dal.tests.search(q, searchFields, {
    where,
    skip: offsetNum,
    take: limitNum,
  });

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  return res.status(200).json({
    success: true,
    meta: {
      query: q,
      fieldsSearched: meta.fieldsSearched,
      total: meta.total,
      limit: limitNum,
      offset: offsetNum,
      returned: data.length,
      hasMore: meta.hasMore,
      generatedAt: new Date().toISOString(),
      source: 'OpenOnco (openonco.org)',
      license: 'CC BY 4.0',
    },
    data,
  });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const route = req.query.route || '';
    const testId = req.query.id;
    const embedType = req.query.type;

    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace(/^\/api\/v1\/?/, '');
    const segments = path.split('/').filter(Boolean);

    const routeKey = route || segments[0] || '';

    if (!routeKey) {
      return handleDocs(req, res);
    }

    if (routeKey === 'tests') {
      if (testId) {
        return await handleSingleTest(req, res, testId);
      }
      if (segments[1]) {
        return await handleSingleTest(req, res, segments[1]);
      }
      return await handleTests(req, res);
    }

    if (routeKey === 'categories') {
      return await handleCategories(req, res);
    }

    if (routeKey === 'vendors') {
      return await handleVendors(req, res);
    }

    if (routeKey === 'stats') {
      return await handleStats(req, res);
    }

    if (routeKey === 'embed') {
      if (embedType === 'test' || segments[1] === 'test') {
        return await handleEmbed(req, res);
      }
    }

    if (routeKey === 'coverage') {
      if (segments[1] === 'payer' && segments[2]) {
        return await handleCoverageByPayer(req, res, segments[2]);
      }
      if (req.query.subRoute === 'payer' && req.query.payer) {
        return await handleCoverageByPayer(req, res, req.query.payer);
      }
      if (segments[1] && segments[1] !== 'payer') {
        return await handleCoverageById(req, res, segments[1]);
      }
      if (testId) {
        return await handleCoverageById(req, res, testId);
      }
      return await handleCoverage(req, res);
    }

    if (routeKey === 'search') {
      return await handleSearch(req, res);
    }

    return res.status(404).json({ error: 'Not found', route: routeKey });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
}
