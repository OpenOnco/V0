/**
 * OpenOnco API v1 Documentation Generator
 * 
 * Generates comprehensive HTML documentation for beta testers
 */

export function generateHtmlDocs() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenOnco API Documentation</title>
  <style>
    :root {
      --bg: #ffffff;
      --bg-alt: #f9fafb;
      --bg-code: #f3f4f6;
      --text: #111827;
      --text-muted: #6b7280;
      --border: #e5e7eb;
      --accent: #059669;
      --accent-light: #d1fae5;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
    }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
    
    /* Header */
    header { margin-bottom: 48px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
    h1 { font-size: 32px; font-weight: 700; color: var(--accent); margin-bottom: 8px; }
    .subtitle { color: var(--text-muted); font-size: 18px; }
    .version { display: inline-block; background: var(--accent-light); color: var(--accent); font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-left: 12px; }
    
    /* Navigation */
    nav { background: var(--bg-alt); border-radius: 8px; padding: 16px; margin-bottom: 32px; }
    nav ul { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 16px; }
    nav a { color: var(--accent); text-decoration: none; font-size: 14px; }
    nav a:hover { text-decoration: underline; }
    
    /* Sections */
    section { margin-bottom: 48px; }
    h2 { font-size: 24px; font-weight: 600; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--accent); }
    h3 { font-size: 18px; font-weight: 600; margin: 24px 0 12px; color: var(--text); }
    h4 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
    p { margin-bottom: 12px; }
    
    /* Code */
    code { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 13px; background: var(--bg-code); padding: 2px 6px; border-radius: 4px; }
    pre { background: #1f2937; color: #f9fafb; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 12px 0; }
    pre code { background: none; padding: 0; color: inherit; }
    .response { background: var(--bg-alt); border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin: 12px 0; }
    .response pre { margin: 8px 0 0; }
    
    /* Endpoint cards */
    .endpoint { background: var(--bg-alt); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin: 16px 0; }
    .endpoint-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .method { background: var(--accent); color: white; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 4px; }
    .path { font-family: monospace; font-size: 15px; font-weight: 500; }
    .endpoint-desc { color: var(--text-muted); margin-bottom: 12px; }
    
    /* Tables */
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
    th { background: var(--bg-alt); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
    tr:hover { background: var(--bg-alt); }
    
    /* Lists */
    ul, ol { margin: 12px 0 12px 24px; }
    li { margin: 4px 0; }
    
    /* Badges */
    .badge { display: inline-block; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 9999px; }
    .badge-required { background: #fef2f2; color: #dc2626; }
    .badge-optional { background: #f3f4f6; color: #6b7280; }
    .badge-string { background: #dbeafe; color: #2563eb; }
    .badge-number { background: #fef3c7; color: #d97706; }
    .badge-boolean { background: #f3e8ff; color: #9333ea; }
    .badge-array { background: #dcfce7; color: #16a34a; }
    
    /* Callouts */
    .callout { padding: 16px; border-radius: 8px; margin: 16px 0; }
    .callout-info { background: #eff6ff; border-left: 4px solid #3b82f6; }
    .callout-success { background: #f0fdf4; border-left: 4px solid #22c55e; }
    .callout-warning { background: #fffbeb; border-left: 4px solid #f59e0b; }
    .callout-title { font-weight: 600; margin-bottom: 4px; }
    
    /* Footer */
    footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 14px; }
    footer a { color: var(--accent); }
    
    /* Responsive */
    @media (max-width: 600px) {
      .container { padding: 24px 16px; }
      h1 { font-size: 24px; }
      nav ul { flex-direction: column; }
      .endpoint-header { flex-direction: column; align-items: flex-start; gap: 8px; }
    }
  </style>
</head>
<body>
<div class="container">
  
<header>
  <h1>OpenOnco API <span class="version">v1.0</span></h1>
  <p class="subtitle">Free, open access to cancer diagnostic test data</p>
</header>

<nav>
  <ul>
    <li><a href="#overview">Overview</a></li>
    <li><a href="#authentication">Authentication</a></li>
    <li><a href="#rate-limits">Rate Limits</a></li>
    <li><a href="#endpoints">Endpoints</a></li>
    <li><a href="#categories">Categories</a></li>
    <li><a href="#schemas">Response Schemas</a></li>
    <li><a href="#errors">Error Handling</a></li>
    <li><a href="#examples">Code Examples</a></li>
    <li><a href="#changelog">Changelog</a></li>
  </ul>
</nav>

<section id="overview">
  <h2>Overview</h2>
  <p>The OpenOnco API provides programmatic access to our curated database of cancer diagnostic tests, including liquid biopsy, genomic profiling, and hereditary cancer tests.</p>
  
  <div class="callout callout-info">
    <div class="callout-title">Base URL</div>
    <code>https://openonco.org/api/v1</code>
  </div>
  
  <h4>Key Features</h4>
  <ul>
    <li><strong>No authentication required</strong> — completely public and free</li>
    <li><strong>JSON responses</strong> — all endpoints return JSON by default</li>
    <li><strong>CORS enabled</strong> — call directly from browser JavaScript</li>
    <li><strong>Embeddable widgets</strong> — drop test cards into your app</li>
  </ul>
  
  <h4>License</h4>
  <p>All data is available under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. You're free to use it for any purpose with attribution.</p>
</section>

<section id="authentication">
  <h2>Authentication</h2>
  <p>No authentication is required. The API is completely public.</p>
  
  <div class="callout callout-success">
    <div class="callout-title">Just start making requests</div>
    <pre><code>curl https://openonco.org/api/v1/stats</code></pre>
  </div>
</section>

<section id="rate-limits">
  <h2>Rate Limits</h2>
  <p>During the beta period, there are <strong>no enforced rate limits</strong>. We ask that you:</p>
  <ul>
    <li>Cache responses where possible (we set <code>Cache-Control</code> headers)</li>
    <li>Avoid polling more than once per minute for the same data</li>
    <li>Contact us if you expect high volume usage</li>
  </ul>
  
  <div class="callout callout-warning">
    <div class="callout-title">Future Rate Limits</div>
    <p>We may introduce rate limits in the future. If you'd like guaranteed access, reach out about API keys.</p>
  </div>
</section>

<section id="endpoints">
  <h2>Endpoints</h2>
  
  <div class="endpoint" id="endpoint-tests">
    <div class="endpoint-header">
      <span class="method">GET</span>
      <span class="path">/api/v1/tests</span>
    </div>
    <p class="endpoint-desc">List all tests with optional filtering</p>
    
    <h4>Query Parameters</h4>
    <table>
      <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
      <tr><td><code>category</code></td><td><span class="badge badge-string">string</span></td><td>Filter by category: <code>mrd</code>, <code>ecd</code>, <code>cgp</code>, <code>hct</code></td></tr>
      <tr><td><code>vendor</code></td><td><span class="badge badge-string">string</span></td><td>Filter by vendor name (partial match)</td></tr>
      <tr><td><code>cancer</code></td><td><span class="badge badge-string">string</span></td><td>Filter by cancer type (partial match)</td></tr>
      <tr><td><code>fda</code></td><td><span class="badge badge-string">string</span></td><td>Filter by FDA status: <code>approved</code>, <code>ldt</code>, <code>breakthrough</code>, <code>all</code></td></tr>
      <tr><td><code>fields</code></td><td><span class="badge badge-string">string</span></td><td>Comma-separated list of fields to return</td></tr>
      <tr><td><code>limit</code></td><td><span class="badge badge-number">number</span></td><td>Max results (1-500, default: 100)</td></tr>
      <tr><td><code>offset</code></td><td><span class="badge badge-number">number</span></td><td>Skip N results for pagination (default: 0)</td></tr>
    </table>
    
    <h4>Example Request</h4>
    <pre><code>curl "https://openonco.org/api/v1/tests?category=mrd&limit=3"</code></pre>
  </div>
  
  <div class="endpoint" id="endpoint-test">
    <div class="endpoint-header">
      <span class="method">GET</span>
      <span class="path">/api/v1/tests/:id</span>
    </div>
    <p class="endpoint-desc">Get a single test by ID</p>
    
    <h4>Path Parameters</h4>
    <table>
      <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
      <tr><td><code>id</code></td><td><span class="badge badge-string">string</span> <span class="badge badge-required">required</span></td><td>Test ID (e.g., <code>mrd-1</code>, <code>ecd-5</code>)</td></tr>
    </table>
    
    <h4>Example Request</h4>
    <pre><code>curl "https://openonco.org/api/v1/tests/mrd-1"</code></pre>
  </div>
  
  <div class="endpoint" id="endpoint-categories">
    <div class="endpoint-header">
      <span class="method">GET</span>
      <span class="path">/api/v1/categories</span>
    </div>
    <p class="endpoint-desc">List all test categories with metadata and counts</p>
    
    <h4>Example Request</h4>
    <pre><code>curl "https://openonco.org/api/v1/categories"</code></pre>
  </div>
  
  <div class="endpoint" id="endpoint-vendors">
    <div class="endpoint-header">
      <span class="method">GET</span>
      <span class="path">/api/v1/vendors</span>
    </div>
    <p class="endpoint-desc">List all vendors with test counts by category</p>
    
    <h4>Query Parameters</h4>
    <table>
      <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
      <tr><td><code>category</code></td><td><span class="badge badge-string">string</span></td><td>Filter to vendors with tests in this category</td></tr>
    </table>
    
    <h4>Example Request</h4>
    <pre><code>curl "https://openonco.org/api/v1/vendors?category=mrd"</code></pre>
  </div>
  
  <div class="endpoint" id="endpoint-stats">
    <div class="endpoint-header">
      <span class="method">GET</span>
      <span class="path">/api/v1/stats</span>
    </div>
    <p class="endpoint-desc">Get database summary statistics</p>
    
    <h4>Example Request</h4>
    <pre><code>curl "https://openonco.org/api/v1/stats"</code></pre>
    
    <div class="response">
      <h4>Example Response</h4>
      <pre><code>{
  "success": true,
  "meta": {
    "generatedAt": "2026-01-09T18:00:00.000Z",
    "source": "OpenOnco (openonco.org)",
    "license": "CC BY 4.0"
  },
  "data": {
    "totals": {
      "tests": 107,
      "vendors": 58,
      "cancerTypes": 45
    },
    "byCategory": {
      "MRD": { "tests": 28, "vendors": 22 },
      "ECD": { "tests": 26, "vendors": 18 },
      "CGP": { "tests": 41, "vendors": 27 },
      "HCT": { "tests": 12, "vendors": 10 }
    }
  }
}</code></pre>
    </div>
  </div>
  
  <div class="endpoint" id="endpoint-embed">
    <div class="endpoint-header">
      <span class="method">GET</span>
      <span class="path">/api/v1/embed/test</span>
    </div>
    <p class="endpoint-desc">Get an embeddable HTML card for a test</p>
    
    <h4>Query Parameters</h4>
    <table>
      <tr><th>Parameter</th><th>Type</th><th>Description</th></tr>
      <tr><td><code>id</code></td><td><span class="badge badge-string">string</span> <span class="badge badge-required">required</span></td><td>Test ID</td></tr>
      <tr><td><code>theme</code></td><td><span class="badge badge-string">string</span></td><td><code>light</code> (default) or <code>dark</code></td></tr>
      <tr><td><code>width</code></td><td><span class="badge badge-number">number</span></td><td>Card width in pixels (default: 400)</td></tr>
      <tr><td><code>format</code></td><td><span class="badge badge-string">string</span></td><td>Set to <code>json</code> for embed code instead of HTML</td></tr>
    </table>
    
    <h4>Embedding in Your App</h4>
    <pre><code>&lt;iframe 
  src="https://openonco.org/api/v1/embed/test?id=mrd-1&theme=light" 
  width="400" 
  height="200" 
  frameborder="0"&gt;
&lt;/iframe&gt;</code></pre>
  </div>
</section>

<section id="categories">
  <h2>Categories</h2>
  <p>OpenOnco organizes tests into four categories:</p>
  
  <table>
    <tr><th>Code</th><th>Name</th><th>Description</th><th>Web URL</th></tr>
    <tr>
      <td><code>mrd</code></td>
      <td>Molecular Residual Disease</td>
      <td>Post-treatment surveillance to detect cancer recurrence</td>
      <td><a href="https://openonco.org/monitor">/monitor</a></td>
    </tr>
    <tr>
      <td><code>ecd</code></td>
      <td>Early Cancer Detection</td>
      <td>Screening tests to detect cancer before symptoms</td>
      <td><a href="https://openonco.org/screen">/screen</a></td>
    </tr>
    <tr>
      <td><code>cgp</code></td>
      <td>Comprehensive Genomic Profiling</td>
      <td>Identify genetic alterations to guide therapy selection</td>
      <td><a href="https://openonco.org/treat">/treat</a></td>
    </tr>
    <tr>
      <td><code>hct</code></td>
      <td>Hereditary Cancer Testing</td>
      <td>Germline testing for inherited cancer risk</td>
      <td><a href="https://openonco.org/risk">/risk</a></td>
    </tr>
  </table>
</section>

<section id="schemas">
  <h2>Response Schemas</h2>
  
  <h3>Standard Response Envelope</h3>
  <p>All responses use this structure:</p>
  <pre><code>{
  "success": true,
  "meta": {
    "total": 107,           // Total matching records (for lists)
    "limit": 100,           // Requested limit
    "offset": 0,            // Requested offset
    "returned": 100,        // Records in this response
    "hasMore": true,        // More records available
    "generatedAt": "...",   // ISO 8601 timestamp
    "source": "OpenOnco (openonco.org)",
    "license": "CC BY 4.0"
  },
  "data": { ... }           // Payload (object or array)
}</code></pre>

  <h3>Test Object (MRD/ECD)</h3>
  <p>Fields vary by category. Here are common fields for liquid biopsy tests:</p>
  <table>
    <tr><th>Field</th><th>Type</th><th>Description</th></tr>
    <tr><td><code>id</code></td><td><span class="badge badge-string">string</span></td><td>Unique identifier (e.g., "mrd-1")</td></tr>
    <tr><td><code>name</code></td><td><span class="badge badge-string">string</span></td><td>Test name</td></tr>
    <tr><td><code>vendor</code></td><td><span class="badge badge-string">string</span></td><td>Company name</td></tr>
    <tr><td><code>category</code></td><td><span class="badge badge-string">string</span></td><td>Category code (uppercase)</td></tr>
    <tr><td><code>categoryName</code></td><td><span class="badge badge-string">string</span></td><td>Full category name</td></tr>
    <tr><td><code>sampleCategory</code></td><td><span class="badge badge-string">string</span></td><td>Sample type (Blood/Plasma, Tissue, etc.)</td></tr>
    <tr><td><code>approach</code></td><td><span class="badge badge-string">string</span></td><td>Technical approach (Tumor-informed, Tumor-naive)</td></tr>
    <tr><td><code>method</code></td><td><span class="badge badge-string">string</span></td><td>Detailed methodology</td></tr>
    <tr><td><code>cancerTypes</code></td><td><span class="badge badge-array">array</span></td><td>Supported cancer types</td></tr>
    <tr><td><code>sensitivity</code></td><td><span class="badge badge-number">number</span></td><td>Clinical sensitivity (0-100)</td></tr>
    <tr><td><code>sensitivityNotes</code></td><td><span class="badge badge-string">string</span></td><td>Context for sensitivity claim</td></tr>
    <tr><td><code>sensitivityCitations</code></td><td><span class="badge badge-string">string</span></td><td>Source URLs</td></tr>
    <tr><td><code>specificity</code></td><td><span class="badge badge-number">number</span></td><td>Clinical specificity (0-100)</td></tr>
    <tr><td><code>lod</code></td><td><span class="badge badge-string">string</span></td><td>Limit of detection</td></tr>
    <tr><td><code>fdaStatus</code></td><td><span class="badge badge-string">string</span></td><td>Regulatory status</td></tr>
    <tr><td><code>tat</code></td><td><span class="badge badge-string">string</span></td><td>Turnaround time</td></tr>
    <tr><td><code>vendorVerified</code></td><td><span class="badge badge-boolean">boolean</span></td><td>Data verified by vendor</td></tr>
  </table>
  
  <h3>Test Object (CGP)</h3>
  <p>Genomic profiling tests have additional fields:</p>
  <table>
    <tr><th>Field</th><th>Type</th><th>Description</th></tr>
    <tr><td><code>genesAnalyzed</code></td><td><span class="badge badge-number">number</span></td><td>Number of genes in panel</td></tr>
    <tr><td><code>biomarkersReported</code></td><td><span class="badge badge-array">array</span></td><td>Biomarkers included (TMB, MSI, etc.)</td></tr>
    <tr><td><code>fdaCompanionDxCount</code></td><td><span class="badge badge-number">number</span></td><td>FDA companion diagnostic indications</td></tr>
  </table>
  
  <h3>Test Object (HCT)</h3>
  <p>Hereditary cancer tests have these fields:</p>
  <table>
    <tr><th>Field</th><th>Type</th><th>Description</th></tr>
    <tr><td><code>genesAnalyzed</code></td><td><span class="badge badge-number">number</span></td><td>Number of genes tested</td></tr>
    <tr><td><code>syndromesCovered</code></td><td><span class="badge badge-array">array</span></td><td>Hereditary syndromes detected</td></tr>
    <tr><td><code>includesGeneticCounseling</code></td><td><span class="badge badge-boolean">boolean</span></td><td>Counseling included</td></tr>
  </table>
</section>

<section id="errors">
  <h2>Error Handling</h2>
  
  <p>Errors return appropriate HTTP status codes with a JSON body:</p>
  
  <pre><code>{
  "success": false,
  "error": "Test not found",
  "message": "No test found with ID \\"xyz-999\\""
}</code></pre>
  
  <h4>Error Codes</h4>
  <table>
    <tr><th>Status</th><th>Meaning</th><th>Common Causes</th></tr>
    <tr><td><code>400</code></td><td>Bad Request</td><td>Missing required parameter, invalid parameter value</td></tr>
    <tr><td><code>404</code></td><td>Not Found</td><td>Invalid test ID, unknown endpoint</td></tr>
    <tr><td><code>405</code></td><td>Method Not Allowed</td><td>Using POST/PUT/DELETE (only GET supported)</td></tr>
    <tr><td><code>500</code></td><td>Server Error</td><td>Something went wrong on our end</td></tr>
  </table>
</section>

<section id="examples">
  <h2>Code Examples</h2>
  
  <h3>cURL</h3>
  <pre><code># Get all MRD tests
curl "https://openonco.org/api/v1/tests?category=mrd"

# Get a specific test
curl "https://openonco.org/api/v1/tests/mrd-1"

# Filter by vendor
curl "https://openonco.org/api/v1/tests?vendor=natera"

# Get only specific fields
curl "https://openonco.org/api/v1/tests?category=ecd&fields=sensitivity,specificity,lod"

# Database stats
curl "https://openonco.org/api/v1/stats"</code></pre>

  <h3>JavaScript (fetch)</h3>
  <pre><code>// Get all MRD tests
const response = await fetch('https://openonco.org/api/v1/tests?category=mrd');
const { data: tests } = await response.json();

console.log(\`Found \${tests.length} MRD tests\`);

// Get a specific test
const testResponse = await fetch('https://openonco.org/api/v1/tests/mrd-1');
const { data: test } = await testResponse.json();

console.log(\`\${test.name} by \${test.vendor}\`);
console.log(\`Sensitivity: \${test.sensitivity}%\`);

// Search with multiple filters
const filtered = await fetch(
  'https://openonco.org/api/v1/tests?' + new URLSearchParams({
    category: 'ecd',
    fda: 'approved',
    limit: 10
  })
).then(r => r.json());

console.log(filtered.data);</code></pre>

  <h3>Python (requests)</h3>
  <pre><code>import requests

BASE_URL = "https://openonco.org/api/v1"

# Get all MRD tests
response = requests.get(f"{BASE_URL}/tests", params={"category": "mrd"})
tests = response.json()["data"]

print(f"Found {len(tests)} MRD tests")

# Get a specific test
test = requests.get(f"{BASE_URL}/tests/mrd-1").json()["data"]

print(f"{test['name']} by {test['vendor']}")
print(f"Sensitivity: {test.get('sensitivity')}%")

# Get database stats
stats = requests.get(f"{BASE_URL}/stats").json()["data"]

print(f"Total tests: {stats['totals']['tests']}")
print(f"Total vendors: {stats['totals']['vendors']}")</code></pre>

  <h3>Python (pandas)</h3>
  <pre><code>import pandas as pd
import requests

# Load all tests into a DataFrame
response = requests.get("https://openonco.org/api/v1/tests")
tests = response.json()["data"]

df = pd.DataFrame(tests)

# Analyze by category
print(df.groupby("category").size())

# Filter to high-sensitivity MRD tests
mrd_high_sens = df[(df["category"] == "MRD") & (df["sensitivity"] >= 95)]
print(mrd_high_sens[["name", "vendor", "sensitivity"]])</code></pre>
</section>

<section id="changelog">
  <h2>Changelog</h2>
  
  <h3>v1.0.0 — January 2026</h3>
  <ul>
    <li><strong>Initial release</strong></li>
    <li>4 categories: MRD, ECD, CGP, HCT</li>
    <li>107 tests from 58 vendors</li>
    <li>Endpoints: tests, categories, vendors, stats, embed</li>
  </ul>
  
  <div class="callout callout-info">
    <div class="callout-title">Breaking Changes Policy</div>
    <p>We'll provide at least 30 days notice before any breaking changes. The <code>/api/v1</code> prefix allows us to introduce <code>/api/v2</code> in the future without affecting existing integrations.</p>
  </div>
</section>

<footer>
  <p>
    <strong>OpenOnco</strong> — Free, open-source cancer diagnostics data<br>
    <a href="https://openonco.org">openonco.org</a> · 
    <a href="https://github.com/OpenOnco">GitHub</a> · 
    <a href="mailto:alex@openonco.org">Contact</a>
  </p>
  <p style="margin-top: 12px;">Data licensed under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>
</footer>

</div>
</body>
</html>`;
}

export function generateJsonDocs() {
  return {
    name: 'OpenOnco Public API',
    version: '1.0.0',
    description: 'Free, open access to cancer diagnostic test data',
    baseUrl: 'https://openonco.org/api/v1',
    documentation: 'https://openonco.org/api/v1',
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/'
    },
    authentication: 'none',
    rateLimits: {
      enforced: false,
      guidance: 'Cache responses, avoid polling more than once per minute'
    },
    endpoints: [
      {
        method: 'GET',
        path: '/api/v1/tests',
        description: 'List all tests with optional filtering',
        parameters: [
          { name: 'category', type: 'string', required: false, description: 'Filter by category (mrd, ecd, cgp, hct)' },
          { name: 'vendor', type: 'string', required: false, description: 'Filter by vendor name (partial match)' },
          { name: 'cancer', type: 'string', required: false, description: 'Filter by cancer type (partial match)' },
          { name: 'fda', type: 'string', required: false, description: 'Filter by FDA status (approved, ldt, breakthrough, all)' },
          { name: 'fields', type: 'string', required: false, description: 'Comma-separated fields to return' },
          { name: 'limit', type: 'number', required: false, description: 'Max results (1-500, default: 100)' },
          { name: 'offset', type: 'number', required: false, description: 'Skip N results (default: 0)' }
        ]
      },
      {
        method: 'GET',
        path: '/api/v1/tests/:id',
        description: 'Get a single test by ID',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Test ID (e.g., mrd-1)' }
        ]
      },
      {
        method: 'GET',
        path: '/api/v1/categories',
        description: 'List all test categories with metadata'
      },
      {
        method: 'GET',
        path: '/api/v1/vendors',
        description: 'List all vendors with test counts',
        parameters: [
          { name: 'category', type: 'string', required: false, description: 'Filter to vendors in category' }
        ]
      },
      {
        method: 'GET',
        path: '/api/v1/stats',
        description: 'Database summary statistics'
      },
      {
        method: 'GET',
        path: '/api/v1/embed/test',
        description: 'Embeddable HTML test card',
        parameters: [
          { name: 'id', type: 'string', required: true, description: 'Test ID' },
          { name: 'theme', type: 'string', required: false, description: 'light or dark (default: light)' },
          { name: 'width', type: 'number', required: false, description: 'Card width in pixels (default: 400)' },
          { name: 'format', type: 'string', required: false, description: 'Set to json for embed code' }
        ]
      }
    ],
    categories: [
      { id: 'mrd', name: 'Molecular Residual Disease', urlPath: '/monitor' },
      { id: 'ecd', name: 'Early Cancer Detection', urlPath: '/screen' },
      { id: 'cgp', name: 'Comprehensive Genomic Profiling', urlPath: '/treat' },
      { id: 'hct', name: 'Hereditary Cancer Testing', urlPath: '/risk' }
    ],
    errors: [
      { status: 400, meaning: 'Bad Request', causes: 'Missing required parameter, invalid value' },
      { status: 404, meaning: 'Not Found', causes: 'Invalid test ID, unknown endpoint' },
      { status: 405, meaning: 'Method Not Allowed', causes: 'Using POST/PUT/DELETE' },
      { status: 500, meaning: 'Server Error', causes: 'Internal error' }
    ]
  };
}
