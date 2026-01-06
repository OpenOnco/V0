/**
 * OpenOnco Public API - Embeddable Test Card
 * GET /api/v1/embed/test?id=mrd-1
 * 
 * Returns an embeddable HTML card for a test that can be used in iframes.
 * 
 * Query parameters:
 *   id     - Test ID (required)
 *   theme  - 'light' or 'dark' (default: light)
 *   width  - Card width (default: 400)
 *   compact - 'true' for minimal view (default: false)
 */

import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../../../src/data.js';

// Build lookup
const TEST_LOOKUP = new Map();
const CATEGORY_META = {
  mrd: { name: 'Molecular Residual Disease', color: '#8b5cf6' }, // violet
  ecd: { name: 'Early Cancer Detection', color: '#f59e0b' },     // amber
  trm: { name: 'Treatment Response Monitoring', color: '#06b6d4' }, // cyan
  tds: { name: 'Treatment Decision Support', color: '#10b981' },    // emerald
};

[
  { data: mrdTestData, category: 'mrd' },
  { data: ecdTestData, category: 'ecd' },
  { data: trmTestData, category: 'trm' },
  { data: tdsTestData, category: 'tds' },
].forEach(({ data, category }) => {
  data.forEach(test => {
    TEST_LOOKUP.set(test.id, { ...test, category });
  });
});

function generateEmbedHTML(test, options) {
  const { theme = 'light', width = 400, compact = false } = options;
  const cat = CATEGORY_META[test.category] || { name: 'Unknown', color: '#6b7280' };
  
  const isDark = theme === 'dark';
  const bgColor = isDark ? '#1f2937' : '#ffffff';
  const textColor = isDark ? '#f9fafb' : '#111827';
  const mutedColor = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  // Key metrics based on category
  let metrics = [];
  if (test.sensitivity != null) metrics.push({ label: 'Sensitivity', value: `${test.sensitivity}%` });
  if (test.specificity != null) metrics.push({ label: 'Specificity', value: `${test.specificity}%` });
  if (test.lod) metrics.push({ label: 'LOD', value: test.lod });
  if (test.genesAnalyzed) metrics.push({ label: 'Genes', value: test.genesAnalyzed.toLocaleString() });
  if (test.tat) metrics.push({ label: 'TAT', value: `${test.tat} days` });
  if (test.followUpTat) metrics.push({ label: 'Follow-up TAT', value: `${test.followUpTat} days` });

  const metricsHTML = metrics.slice(0, compact ? 2 : 4).map(m => `
    <div style="text-align: center;">
      <div style="font-size: 18px; font-weight: 600; color: ${textColor};">${m.value}</div>
      <div style="font-size: 11px; color: ${mutedColor}; text-transform: uppercase;">${m.label}</div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${test.name} - OpenOnco</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
    }
    a { color: inherit; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div style="
    width: ${width}px;
    max-width: 100%;
    background: ${bgColor};
    border: 1px solid ${borderColor};
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  ">
    <!-- Header -->
    <div style="
      padding: 16px;
      border-bottom: 1px solid ${borderColor};
    ">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="
          background: ${cat.color}20;
          color: ${cat.color};
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        ">${test.category.toUpperCase()}</span>
        ${test.fdaStatus?.toLowerCase().includes('fda') && !test.fdaStatus?.toLowerCase().includes('ldt') ? `
        <span style="
          background: #dcfce7;
          color: #166534;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        ">FDA</span>
        ` : ''}
      </div>
      <h2 style="
        font-size: 18px;
        font-weight: 600;
        color: ${textColor};
        margin-bottom: 4px;
      ">${test.name}</h2>
      <p style="
        font-size: 14px;
        color: ${mutedColor};
      ">${test.vendor}</p>
    </div>

    ${!compact ? `
    <!-- Metrics -->
    <div style="
      padding: 16px;
      display: grid;
      grid-template-columns: repeat(${Math.min(metrics.length, 4)}, 1fr);
      gap: 12px;
      border-bottom: 1px solid ${borderColor};
    ">
      ${metricsHTML}
    </div>
    ` : ''}

    ${!compact && test.cancerTypes?.length ? `
    <!-- Cancer Types -->
    <div style="padding: 12px 16px; border-bottom: 1px solid ${borderColor};">
      <div style="font-size: 11px; color: ${mutedColor}; text-transform: uppercase; margin-bottom: 6px;">Cancer Types</div>
      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
        ${test.cancerTypes.slice(0, 5).map(ct => `
          <span style="
            background: ${isDark ? '#374151' : '#f3f4f6'};
            color: ${mutedColor};
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
          ">${ct}</span>
        `).join('')}
        ${test.cancerTypes.length > 5 ? `<span style="color: ${mutedColor}; font-size: 12px;">+${test.cancerTypes.length - 5} more</span>` : ''}
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: ${isDark ? '#111827' : '#f9fafb'};
    ">
      <a href="https://openonco.org/${test.category}/${test.id}" target="_blank" style="
        font-size: 13px;
        color: ${cat.color};
        font-weight: 500;
      ">View on OpenOnco →</a>
      <img src="https://openonco.org/favicon.ico" alt="OpenOnco" style="width: 16px; height: 16px; opacity: 0.5;">
    </div>
  </div>
</body>
</html>`;
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow iframe embedding
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const { id, theme = 'light', width = '400', compact = 'false', format = 'html' } = req.query;

    if (!id) {
      return res.status(400).send(`
        <html><body style="font-family: sans-serif; padding: 20px;">
          <h3>Missing test ID</h3>
          <p>Usage: /api/v1/embed/test?id=mrd-1</p>
        </body></html>
      `);
    }

    const test = TEST_LOOKUP.get(id);
    if (!test) {
      return res.status(404).send(`
        <html><body style="font-family: sans-serif; padding: 20px;">
          <h3>Test not found</h3>
          <p>No test with ID "${id}"</p>
        </body></html>
      `);
    }

    // JSON format option
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).json({
        success: true,
        embed: {
          iframe: `<iframe src="https://openonco.org/api/v1/embed/test?id=${id}&theme=${theme}&width=${width}" width="${width}" height="300" frameborder="0"></iframe>`,
          script: `<!-- Coming soon: script embed -->`,
        },
        data: test,
      });
    }

    // HTML embed
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=300');
    
    const html = generateEmbedHTML(test, {
      theme,
      width: parseInt(width) || 400,
      compact: compact === 'true',
    });

    return res.status(200).send(html);

  } catch (error) {
    console.error('Embed Error:', error);
    return res.status(500).send(`
      <html><body style="font-family: sans-serif; padding: 20px;">
        <h3>Error</h3>
        <p>${error.message}</p>
      </body></html>
    `);
  }
}
