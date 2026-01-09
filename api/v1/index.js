/**
 * OpenOnco Public API v1 - Unified Handler
 * 
 * Routes:
 *   GET /api/v1              - API documentation
 *   GET /api/v1/tests        - List all tests
 *   GET /api/v1/tests/:id    - Get single test
 *   GET /api/v1/categories   - List categories
 *   GET /api/v1/vendors      - List vendors
 *   GET /api/v1/stats        - Database statistics
 *   GET /api/v1/embed/test   - Embeddable test card
 */

import { mrdTestData, ecdTestData, cgpTestData, hctTestData } from '../_data.js';

// ============================================================================
// SHARED CONSTANTS
// ============================================================================

// Final API categories: mrd, ecd, cgp, hct
// Note: TRM tests merged into MRD, TDS renamed to CGP
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
  
  const docs = {
    name: 'OpenOnco Public API',
    version: '1.0.0',
    description: 'Free, open access to cancer diagnostic test data',
    baseUrl: 'https://openonco.org/api/v1',
    license: 'CC BY 4.0',
    endpoints: [
      { method: 'GET', path: '/api/v1/tests', description: 'List all tests with filtering' },
      { method: 'GET', path: '/api/v1/tests/:id', description: 'Get a single test by ID' },
      { method: 'GET', path: '/api/v1/categories', description: 'List all test categories' },
      { method: 'GET', path: '/api/v1/vendors', description: 'List all vendors' },
      { method: 'GET', path: '/api/v1/stats', description: 'Database statistics' },
      { method: 'GET', path: '/api/v1/embed/test', description: 'Embeddable test card' },
    ],
    categories: ['mrd', 'ecd', 'cgp', 'hct'],
  };

  if (format === 'json' || !accept.includes('text/html')) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json(docs);
  }

  // Return HTML documentation
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(`<!DOCTYPE html>
<html><head><title>OpenOnco API</title>
<style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6}
code{background:#f4f4f4;padding:2px 6px;border-radius:4px}
pre{background:#f4f4f4;padding:16px;overflow-x:auto;border-radius:8px}
h1{color:#059669}a{color:#059669}</style></head>
<body><h1>OpenOnco Public API</h1>
<p>Free, open access to cancer diagnostic test data. <a href="https://openonco.org">openonco.org</a></p>
<h2>Endpoints</h2>
${docs.endpoints.map(e => `<p><code>${e.method} ${e.path}</code> - ${e.description}</p>`).join('')}
<h2>Categories</h2>
<ul>
<li><code>mrd</code> - Molecular Residual Disease</li>
<li><code>ecd</code> - Early Cancer Detection</li>
<li><code>cgp</code> - Comprehensive Genomic Profiling</li>
<li><code>hct</code> - Hereditary Cancer Testing</li>
</ul>
<h2>Examples</h2>
<pre>curl "https://openonco.org/api/v1/tests?category=mrd&limit=5"
curl "https://openonco.org/api/v1/tests?category=hct"
curl "https://openonco.org/api/v1/stats"</pre>
<p>License: CC BY 4.0</p></body></html>`);
}

function handleTests(req, res) {
  const { category, vendor, cancer, fda = 'all', fields, limit = '100', offset = '0' } = req.query;
  
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

    return res.status(404).json({ error: 'Not found', route: routeKey });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
}
