/**
 * OpenOnco Public API - Documentation
 * GET /api/v1
 * 
 * Returns API documentation and available endpoints.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DOCS = {
  name: 'OpenOnco Public API',
  version: '1.0.0',
  description: 'Public, read-only API for accessing the OpenOnco cancer diagnostic test database. Free to use, no authentication required.',
  baseUrl: 'https://openonco.org/api/v1',
  license: 'CC BY 4.0 - Free to use with attribution',
  rateLimit: 'No strict limits, but please be reasonable (~100 req/min)',
  caching: 'Responses are cached for 5-30 minutes. Data updates within 24 hours of database changes.',
  
  endpoints: [
    {
      method: 'GET',
      path: '/tests',
      description: 'List all tests with optional filtering',
      parameters: [
        { name: 'category', type: 'string', description: 'Filter by category: mrd, ecd, trm, tds (comma-separated for multiple)' },
        { name: 'vendor', type: 'string', description: 'Filter by vendor name (partial match, case-insensitive)' },
        { name: 'cancer', type: 'string', description: 'Filter by cancer type (partial match)' },
        { name: 'fda', type: 'string', description: 'Filter by FDA status: approved, ldt, breakthrough, all' },
        { name: 'fields', type: 'string', description: 'Comma-separated list of fields to include' },
        { name: 'limit', type: 'integer', description: 'Max results (default: 100, max: 500)' },
        { name: 'offset', type: 'integer', description: 'Pagination offset' },
      ],
      examples: [
        '/api/v1/tests',
        '/api/v1/tests?category=mrd',
        '/api/v1/tests?vendor=natera&category=mrd',
        '/api/v1/tests?cancer=colorectal&fda=approved',
        '/api/v1/tests?fields=sensitivity,specificity,lod&category=mrd',
      ],
    },
    {
      method: 'GET',
      path: '/tests/{id}',
      description: 'Get a single test by ID',
      parameters: [
        { name: 'id', type: 'string', required: true, description: 'Test ID (e.g., mrd-1, ecd-5)' },
        { name: 'fields', type: 'string', description: 'Comma-separated list of fields to include' },
      ],
      examples: [
        '/api/v1/tests/mrd-1',
        '/api/v1/tests/ecd-3?fields=sensitivity,specificity',
      ],
    },
    {
      method: 'GET',
      path: '/categories',
      description: 'List all test categories with metadata and counts',
      examples: ['/api/v1/categories'],
    },
    {
      method: 'GET',
      path: '/vendors',
      description: 'List all vendors with their test counts',
      parameters: [
        { name: 'category', type: 'string', description: 'Filter to vendors with tests in specific category' },
      ],
      examples: [
        '/api/v1/vendors',
        '/api/v1/vendors?category=mrd',
      ],
    },
    {
      method: 'GET',
      path: '/stats',
      description: 'Get database summary statistics',
      examples: ['/api/v1/stats'],
    },
    {
      method: 'GET',
      path: '/embed/test',
      description: 'Get embeddable HTML card for a test (for iframe embedding)',
      parameters: [
        { name: 'id', type: 'string', required: true, description: 'Test ID' },
        { name: 'theme', type: 'string', description: 'light or dark (default: light)' },
        { name: 'width', type: 'integer', description: 'Card width in pixels (default: 400)' },
        { name: 'compact', type: 'boolean', description: 'Minimal view (default: false)' },
        { name: 'format', type: 'string', description: 'html or json (default: html)' },
      ],
      examples: [
        '/api/v1/embed/test?id=mrd-1',
        '/api/v1/embed/test?id=mrd-1&theme=dark&width=350',
        '/api/v1/embed/test?id=mrd-1&format=json',
      ],
    },
  ],

  categories: {
    MRD: {
      name: 'Molecular Residual Disease',
      description: 'Post-treatment monitoring for cancer recurrence',
      keyFields: ['sensitivity', 'specificity', 'lod', 'leadTime', 'initialTat', 'followUpTat'],
    },
    ECD: {
      name: 'Early Cancer Detection',
      description: 'Screening tests for asymptomatic individuals',
      keyFields: ['sensitivity', 'specificity', 'ppv', 'npv', 'stageISensitivity', 'testScope'],
    },
    TRM: {
      name: 'Treatment Response Monitoring',
      description: 'Tracking treatment effectiveness during therapy',
      keyFields: ['sensitivity', 'specificity', 'tat', 'responseDefinition'],
    },
    TDS: {
      name: 'Treatment Decision Support',
      description: 'Comprehensive genomic profiling for therapy selection',
      keyFields: ['genesAnalyzed', 'fdaStatus', 'tat', 'sampleType'],
    },
  },

  embedUsage: {
    description: 'Embed OpenOnco test cards in your application',
    iframe: '<iframe src="https://openonco.org/api/v1/embed/test?id=mrd-1" width="400" height="300" frameborder="0"></iframe>',
    note: 'Cards automatically link back to OpenOnco for full details',
  },

  attribution: 'When using this API, please attribute: "Data from OpenOnco (openonco.org)"',
  contact: 'For questions or issues: hello@openonco.org',
  website: 'https://openonco.org',
};

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(200).end();
  }

  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  res.setHeader('Cache-Control', 'public, max-age=3600');

  // Check if HTML is requested
  const acceptHeader = req.headers.accept || '';
  if (acceptHeader.includes('text/html') && !req.query.format) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(generateHTMLDocs());
  }

  return res.status(200).json(DOCS);
}

function generateHTMLDocs() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenOnco API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background: #f9fafb;
    }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    h1 { font-size: 2.5rem; margin-bottom: 8px; }
    h2 { font-size: 1.5rem; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    h3 { font-size: 1.1rem; margin: 24px 0 8px; }
    p { margin-bottom: 12px; color: #4b5563; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .badge-blue { background: #dbeafe; color: #1d4ed8; }
    .badge-green { background: #dcfce7; color: #166534; }
    code {
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #1f2937;
      color: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 12px 0;
    }
    pre code { background: transparent; color: inherit; }
    .endpoint {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px;
      margin: 16px 0;
    }
    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .method {
      background: #10b981;
      color: white;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.8rem;
    }
    .path { font-family: monospace; font-size: 1.1rem; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; }
    .examples { margin-top: 12px; }
    .example-link {
      display: block;
      color: #2563eb;
      text-decoration: none;
      font-family: monospace;
      font-size: 0.9rem;
      padding: 4px 0;
    }
    .example-link:hover { text-decoration: underline; }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧬 OpenOnco API</h1>
    <p style="font-size: 1.2rem; margin-bottom: 24px;">
      Public, read-only API for cancer diagnostic test data
    </p>
    
    <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 32px;">
      <span class="badge badge-blue">v1.0.0</span>
      <span class="badge badge-green">No Auth Required</span>
      <span class="badge badge-green">CC BY 4.0</span>
    </div>

    <h2>Base URL</h2>
    <pre><code>https://openonco.org/api/v1</code></pre>

    <h2>Endpoints</h2>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/tests</span>
      </div>
      <p>List all tests with optional filtering</p>
      <table>
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        <tr><td>category</td><td>string</td><td>mrd, ecd, trm, tds (comma-separated)</td></tr>
        <tr><td>vendor</td><td>string</td><td>Filter by vendor name (partial match)</td></tr>
        <tr><td>cancer</td><td>string</td><td>Filter by cancer type</td></tr>
        <tr><td>fda</td><td>string</td><td>approved, ldt, breakthrough, all</td></tr>
        <tr><td>limit</td><td>int</td><td>Max results (default: 100)</td></tr>
        <tr><td>offset</td><td>int</td><td>Pagination offset</td></tr>
      </table>
      <div class="examples">
        <strong>Examples:</strong>
        <a class="example-link" href="/api/v1/tests">/api/v1/tests</a>
        <a class="example-link" href="/api/v1/tests?category=mrd">/api/v1/tests?category=mrd</a>
        <a class="example-link" href="/api/v1/tests?vendor=natera">/api/v1/tests?vendor=natera</a>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/tests/{id}</span>
      </div>
      <p>Get a single test by ID</p>
      <div class="examples">
        <a class="example-link" href="/api/v1/tests/mrd-1">/api/v1/tests/mrd-1</a>
        <a class="example-link" href="/api/v1/tests/ecd-3">/api/v1/tests/ecd-3</a>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/categories</span>
      </div>
      <p>List all test categories with metadata and counts</p>
      <a class="example-link" href="/api/v1/categories">/api/v1/categories</a>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/vendors</span>
      </div>
      <p>List all vendors with test counts by category</p>
      <a class="example-link" href="/api/v1/vendors">/api/v1/vendors</a>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/stats</span>
      </div>
      <p>Database summary statistics</p>
      <a class="example-link" href="/api/v1/stats">/api/v1/stats</a>
    </div>

    <div class="endpoint">
      <div class="endpoint-header">
        <span class="method">GET</span>
        <span class="path">/embed/test</span>
      </div>
      <p>Embeddable HTML card for iframes</p>
      <table>
        <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
        <tr><td>id</td><td>string</td><td>Test ID (required)</td></tr>
        <tr><td>theme</td><td>string</td><td>light or dark</td></tr>
        <tr><td>width</td><td>int</td><td>Card width in pixels</td></tr>
      </table>
      <div class="examples">
        <a class="example-link" href="/api/v1/embed/test?id=mrd-1" target="_blank">/api/v1/embed/test?id=mrd-1</a>
      </div>
      <h4 style="margin-top: 16px;">Embed Code:</h4>
      <pre><code>&lt;iframe 
  src="https://openonco.org/api/v1/embed/test?id=mrd-1" 
  width="400" height="280" 
  frameborder="0"
&gt;&lt;/iframe&gt;</code></pre>
    </div>

    <h2>Response Format</h2>
    <pre><code>{
  "success": true,
  "meta": {
    "total": 56,
    "generatedAt": "2025-01-06T...",
    "source": "OpenOnco (openonco.org)",
    "license": "CC BY 4.0"
  },
  "data": [...]
}</code></pre>

    <h2>Attribution</h2>
    <p>When using this API, please include: <strong>"Data from OpenOnco (openonco.org)"</strong></p>

    <div class="footer">
      <p>Questions? <a href="mailto:hello@openonco.org">hello@openonco.org</a></p>
      <p style="margin-top: 8px;"><a href="https://openonco.org">← Back to OpenOnco</a></p>
    </div>
  </div>
</body>
</html>`;
}
