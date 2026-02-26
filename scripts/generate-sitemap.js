/**
 * Sitemap Generator for OpenOnco
 * Run with: node scripts/generate-sitemap.js
 * Called automatically during build via package.json prebuild script
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITE_URL = 'https://www.openonco.org';
const TODAY = new Date().toISOString().split('T')[0];

const slugify = (text) =>
  text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// Static pages - use new plain-language URLs as primary, keep legacy for SEO continuity
const staticPages = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  // New primary URLs
  { path: '/monitor', priority: '0.9', changefreq: 'weekly' },
  { path: '/screen', priority: '0.9', changefreq: 'weekly' },
  { path: '/treat', priority: '0.9', changefreq: 'weekly' },
  // Other pages
  { path: '/alz-blood', priority: '0.9', changefreq: 'weekly' },
  { path: '/learn', priority: '0.8', changefreq: 'monthly' },
  { path: '/about', priority: '0.5', changefreq: 'monthly' },
  { path: '/faq', priority: '0.6', changefreq: 'monthly' },
  { path: '/how-it-works', priority: '0.6', changefreq: 'monthly' },
  { path: '/data-sources', priority: '0.5', changefreq: 'monthly' },
  { path: '/submissions', priority: '0.5', changefreq: 'monthly' },
];

async function generateSitemap() {
  // Dynamically import the data module
  const dataPath = path.join(__dirname, '../src/data.js');
  const data = await import(dataPath);

  const { mrdTestData, ecdTestData, trmTestData, tdsTestData, alzBloodTestData } = data;

  // Map category codes to new URL paths
  const categoryTests = {
    monitor: mrdTestData,     // MRD → /monitor
    screen: ecdTestData,      // ECD → /screen
    treat: tdsTestData,       // TDS/CGP → /treat
    'alz-blood': alzBloodTestData,
  };
  // Note: TRM tests are merged into MRD/monitor, so we don't duplicate them

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Add static pages
  staticPages.forEach(page => {
    xml += `  <url>
    <loc>${SITE_URL}${page.path}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  });

  // Add individual test pages (deduplicate by URL)
  let testCount = 0;
  const seenUrls = new Set();
  Object.entries(categoryTests).forEach(([category, tests]) => {
    if (!tests) return;
    tests.forEach(test => {
      const slug = slugify(test.name);
      const url = `${SITE_URL}/${category}/${slug}`;
      if (seenUrls.has(url)) return;
      seenUrls.add(url);
      xml += `  <url>
    <loc>${url}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
      testCount++;
    });
  });

  xml += '</urlset>';

  // Write to public folder
  const outputPath = path.join(__dirname, '../public/sitemap.xml');
  fs.writeFileSync(outputPath, xml);

  console.log(`Sitemap generated: ${staticPages.length} static pages + ${testCount} test pages = ${staticPages.length + testCount} total URLs`);
  console.log(`Output: ${outputPath}`);
}

generateSitemap().catch(console.error);
