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

import { mrdTestData, ecdTestData, cgpTestData, hctTestData } from '../_data.js';
import { generateHtmlDocs, generateJsonDocs } from './docs.js';

// ============================================================================
// SHARED CONSTANTS
// ============================================================================

// Final API categories: mrd, ecd, cgp, hct
// Note: TRM tests merged into MRD, TDS renamed to CGP
const VALID_PAYERS = ['aetna', 'cigna', 'united', 'anthem', 'humana'];
const VALID_MEDICARE_STATUSES = ['COVERED', 'NOT_COVERED', 'PENDING', 'PARTIAL', 'EXPERIMENTAL'];

const CATEGORY_DATA = {
  mrd: { data: mrdTestData, name: 'Molecular Residual Disease', shortName: 'MRD', urlPath: 'monitor' },
  ecd: { data: ecdTestData, name: 'Early Cancer Detection', shortName: 'ECD', urlPath: 'screen' },
  cgp: { data: cgpTestData, name: 'Comprehensive Genomic Profiling', shortName: 'CGP', urlPath: 'treat' },
  hct: { data: hctTestData, name: 'Hereditary Cancer Testing', shortName: 'HCT', urlPath: 'risk' },
};

const TEST_LOOKUP = new Map();
[
  { data: mrdTestData, category: 'mrd' },
  { data: ecdTestData, category: 'ecd' },
  { data: cgpTestData, category: 'cgp' },
  { data: hctTestData, category: 'hct' },
].forEach(({ data, category }) => {
  data.forEach(test => {
    TEST_LOOKUP.set(test.id, { ...test, category: category.toUpperCase(), categoryName: CATEGORY_DATA[category].name });
  });
});

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

  // Return comprehensive HTML documentation
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(generateHtmlDocs());
}

function handleTests(req, res) {
  const { category, vendor, cancer, fda = 'all', medicare, payer, payerStatus, fields, limit = '100', offset = '0' } = req.query;

  const limitNum = Math.min(Math.max(1, parseInt(limit) || 100), 500);
  const offsetNum = Math.max(0, parseInt(offset) || 0);

  let tests = [];
  const categories = category ? category.toLowerCase().split(',').map(c => c.trim()) : Object.keys(CATEGORY_DATA);

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

  if (vendor) {
    const vendorLower = vendor.toLowerCase();
    tests = tests.filter(t => t.vendor && t.vendor.toLowerCase().includes(vendorLower));
  }

  if (cancer) {
    const cancerLower = cancer.toLowerCase();
    tests = tests.filter(t => t.cancerTypes && t.cancerTypes.some(ct => ct.toLowerCase().includes(cancerLower)));
  }

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

  // Filter by Medicare coverage status
  if (medicare) {
    const medicareUpper = medicare.toUpperCase();
    tests = tests.filter(t => t.coverageCrossReference?.medicare?.status === medicareUpper);
  }

  // Filter by private payer coverage status
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
    meta: { total: totalCount, limit: limitNum, offset: offsetNum, returned: tests.length, hasMore: offsetNum + tests.length < totalCount, generatedAt: new Date().toISOString(), source: 'OpenOnco (openonco.org)', license: 'CC BY 4.0' },
    data: tests,
  });
}

function handleSingleTest(req, res, testId) {
  let test = TEST_LOOKUP.get(testId);
  if (!test) {
    const idLower = testId.toLowerCase();
    for (const [key, value] of TEST_LOOKUP) {
      if (key.toLowerCase() === idLower) { test = value; break; }
    }
  }

  if (!test) {
    return res.status(404).json({ success: false, error: 'Test not found', message: `No test found with ID "${testId}"` });
  }

  // Get the URL path for this category
  const catKey = test.category.toLowerCase();
  const urlPath = CATEGORY_DATA[catKey]?.urlPath || catKey;

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  return res.status(200).json({
    success: true,
    meta: { generatedAt: new Date().toISOString(), source: 'OpenOnco (openonco.org)', license: 'CC BY 4.0' },
    links: { self: `https://openonco.org/api/v1/tests/${test.id}`, web: `https://openonco.org/${urlPath}/${test.id}` },
    data: test,
  });
}

function handleCategories(req, res) {
  const categories = Object.entries(CATEGORY_DATA).map(([id, cat]) => ({
    id,
    name: cat.name,
    shortName: cat.shortName,
    urlPath: cat.urlPath,
    description: getDescription(id),
    stats: { totalTests: cat.data.length, vendors: [...new Set(cat.data.map(t => t.vendor))].length },
    links: { tests: `https://openonco.org/api/v1/tests?category=${id}`, web: `https://openonco.org/${cat.urlPath}` },
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

function handleVendors(req, res) {
  const { category } = req.query;
  const vendorMap = new Map();

  Object.entries(CATEGORY_DATA).forEach(([catId, cat]) => {
    cat.data.forEach(test => {
      const vendor = test.vendor;
      if (!vendorMap.has(vendor)) {
        vendorMap.set(vendor, { name: vendor, tests: { mrd: 0, ecd: 0, cgp: 0, hct: 0 }, kits: { mrd: 0, ecd: 0, cgp: 0, hct: 0 }, totalTests: 0 });
      }
      const v = vendorMap.get(vendor);
      if (test.isKitProduct) v.kits[catId]++;
      else v.tests[catId]++;
      v.totalTests++;
    });
  });

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

function handleStats(req, res) {
  const allTests = [...mrdTestData, ...ecdTestData, ...cgpTestData, ...hctTestData];
  const stats = {
    totals: {
      tests: allTests.length,
      vendors: [...new Set(allTests.map(t => t.vendor))].length,
      cancerTypes: [...new Set(allTests.flatMap(t => t.cancerTypes || []))].length,
    },
    byCategory: {
      MRD: { tests: mrdTestData.length, vendors: [...new Set(mrdTestData.map(t => t.vendor))].length },
      ECD: { tests: ecdTestData.length, vendors: [...new Set(ecdTestData.map(t => t.vendor))].length },
      CGP: { tests: cgpTestData.length, vendors: [...new Set(cgpTestData.map(t => t.vendor))].length },
      HCT: { tests: hctTestData.length, vendors: [...new Set(hctTestData.map(t => t.vendor))].length },
    },
  };

  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800');
  return res.status(200).json({
    success: true,
    meta: { generatedAt: new Date().toISOString(), source: 'OpenOnco (openonco.org)', license: 'CC BY 4.0' },
    data: stats,
  });
}

function handleEmbed(req, res) {
  const { id, theme = 'light', width = '400', format } = req.query;

  if (!id) {
    return res.status(400).send('<!DOCTYPE html><html><body>Missing test ID</body></html>');
  }

  let test = TEST_LOOKUP.get(id);
  if (!test) {
    const idLower = id.toLowerCase();
    for (const [key, value] of TEST_LOOKUP) {
      if (key.toLowerCase() === idLower) { test = value; break; }
    }
  }

  if (!test) {
    return res.status(404).send('<!DOCTYPE html><html><body>Test not found</body></html>');
  }

  // Get the URL path for this category
  const catKey = test.category.toLowerCase();
  const urlPath = CATEGORY_DATA[catKey]?.urlPath || catKey;

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

  // HCT tests may have genesAnalyzed instead of sensitivity/specificity
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

function handleCoverage(req, res) {
  const { medicare, payer, payerStatus, limit = '100', offset = '0' } = req.query;

  const limitNum = Math.min(Math.max(1, parseInt(limit) || 100), 500);
  const offsetNum = Math.max(0, parseInt(offset) || 0);

  // Get all tests with coverageCrossReference
  let tests = [];
  for (const [catId, cat] of Object.entries(CATEGORY_DATA)) {
    for (const test of cat.data) {
      if (test.coverageCrossReference) {
        tests.push({
          id: test.id,
          name: test.name,
          vendor: test.vendor,
          category: catId.toUpperCase(),
          categoryName: cat.name,
          coverageCrossReference: test.coverageCrossReference,
        });
      }
    }
  }

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

function handleCoverageById(req, res, testId) {
  let test = TEST_LOOKUP.get(testId);
  if (!test) {
    const idLower = testId.toLowerCase();
    for (const [key, value] of TEST_LOOKUP) {
      if (key.toLowerCase() === idLower) {
        test = value;
        break;
      }
    }
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

function handleCoverageByPayer(req, res, payerName) {
  const payerLower = payerName.toLowerCase();

  if (!VALID_PAYERS.includes(payerLower)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid payer',
      message: `Valid payers: ${VALID_PAYERS.join(', ')}`,
    });
  }

  // Collect tests with coverage data for this payer, grouped by status
  const grouped = {};

  for (const [catId, cat] of Object.entries(CATEGORY_DATA)) {
    for (const test of cat.data) {
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
          category: catId.toUpperCase(),
          categoryName: cat.name,
          coverage: payerData,
        });
      }
    }
  }

  // Calculate totals
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

function handleSearch(req, res) {
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

  const searchTerm = q.toLowerCase().trim();

  // Determine which fields to search
  const defaultFields = ['name', 'vendor', 'description', 'cancerTypes', 'biomarkers', 'clinicalSettings'];
  const searchFields = fields ? fields.split(',').map(f => f.trim()) : defaultFields;

  // Get tests to search
  let tests = [];
  const categories = category ? category.toLowerCase().split(',').map(c => c.trim()) : Object.keys(CATEGORY_DATA);

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

  // Search function - case-insensitive partial match
  const matchesSearch = (test) => {
    for (const field of searchFields) {
      const value = test[field];
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        // Search in arrays (cancerTypes, biomarkers, clinicalSettings)
        if (value.some(item => String(item).toLowerCase().includes(searchTerm))) {
          return true;
        }
      } else if (typeof value === 'string') {
        if (value.toLowerCase().includes(searchTerm)) {
          return true;
        }
      }
    }
    return false;
  };

  // Filter by search
  const matchedTests = tests.filter(matchesSearch);
  const totalCount = matchedTests.length;

  // Apply pagination
  const paginatedTests = matchedTests.slice(offsetNum, offsetNum + limitNum);

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
  return res.status(200).json({
    success: true,
    meta: {
      query: q,
      fieldsSearched: searchFields,
      total: totalCount,
      limit: limitNum,
      offset: offsetNum,
      returned: paginatedTests.length,
      hasMore: offsetNum + paginatedTests.length < totalCount,
      generatedAt: new Date().toISOString(),
      source: 'OpenOnco (openonco.org)',
      license: 'CC BY 4.0',
    },
    data: paginatedTests,
  });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Route based on query param (set by vercel rewrites) or URL path
    const route = req.query.route || '';
    const testId = req.query.id;
    const embedType = req.query.type;

    // Also support direct path parsing for local dev
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace(/^\/api\/v1\/?/, '');
    const segments = path.split('/').filter(Boolean);

    // Determine routing - prefer query params, fall back to path
    const routeKey = route || segments[0] || '';

    if (!routeKey) {
      return handleDocs(req, res);
    }

    if (routeKey === 'tests') {
      if (testId) {
        return handleSingleTest(req, res, testId);
      }
      if (segments[1]) {
        return handleSingleTest(req, res, segments[1]);
      }
      return handleTests(req, res);
    }

    if (routeKey === 'categories') {
      return handleCategories(req, res);
    }

    if (routeKey === 'vendors') {
      return handleVendors(req, res);
    }

    if (routeKey === 'stats') {
      return handleStats(req, res);
    }

    if (routeKey === 'embed') {
      if (embedType === 'test' || segments[1] === 'test') {
        return handleEmbed(req, res);
      }
    }

    if (routeKey === 'coverage') {
      // /coverage/payer/:payerName
      if (segments[1] === 'payer' && segments[2]) {
        return handleCoverageByPayer(req, res, segments[2]);
      }
      // Also support query param for payer route
      if (req.query.payerRoute) {
        return handleCoverageByPayer(req, res, req.query.payerRoute);
      }
      // /coverage/:testId
      if (segments[1] && segments[1] !== 'payer') {
        return handleCoverageById(req, res, segments[1]);
      }
      // Also support query param for testId
      if (testId) {
        return handleCoverageById(req, res, testId);
      }
      // /coverage (list all)
      return handleCoverage(req, res);
    }

    if (routeKey === 'search') {
      return handleSearch(req, res);
    }

    return res.status(404).json({ error: 'Not found', route: routeKey });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
}
