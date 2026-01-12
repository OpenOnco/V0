#!/usr/bin/env node

/**
 * Vendor Coverage Scraper
 *
 * Scrapes billing/coverage pages from diagnostic test vendors to extract
 * coverage-related information (LCD, NCD, Medicare, reimbursement codes, etc.)
 *
 * Usage: node scripts/cms-coverage-scraper/scrape-vendor-coverage.js
 *
 * Output: scripts/cms-coverage-scraper/vendor-coverage-raw.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Known vendor billing/coverage page URLs
const VENDOR_URLS = {
  'Natera': [
    'https://www.natera.com/oncology/billing/'
  ],
  'Guardant Health': [
    'https://guardanthealth.com/billing-support/'
  ],
  'Foundation Medicine': [
    'https://www.foundationmedicine.com/resource/billing-and-financial-assistance'
  ],
  'GRAIL': [
    'https://grail.com/galleri-test/'
  ],
  'Exact Sciences': [
    'https://www.exactsciences.com/'
  ],
  'Tempus': [
    'https://www.tempus.com/'
  ],
  'Tempus AI': [
    'https://www.tempus.com/'
  ],
  'Caris Life Sciences': [
    'https://www.carislifesciences.com/patients/patient-services/financial-services/'
  ],
  'Adaptive Biotechnologies': [
    'https://www.adaptivebiotech.com/clonoseq/'
  ]
};

// Patterns to look for in scraped content
const COVERAGE_PATTERNS = [
  /LCD/gi,
  /NCD/gi,
  /Medicare/gi,
  /coverage/gi,
  /reimbursement/gi,
  /L38779/gi,
  /90\.2/gi,
  /CPT/gi,
  /\b0239U\b/gi,
  /\b0022U\b/gi,
  /\b0037U\b/gi,
  /\b81479\b/gi,
  /MolDX/gi,
  /Palmetto/gi,
  /Noridian/gi,
  /MAC\b/gi,
  /prior\s*auth/gi,
  /pre-?authorization/gi,
  /covered\s+test/gi,
  /insurance/gi
];

/**
 * Extract unique vendors from test data
 */
function extractVendorsFromData() {
  try {
    // Read the data.js file and extract vendor names using regex
    const dataPath = join(__dirname, '../../src/data.js');
    const dataContent = readFileSync(dataPath, 'utf-8');

    // Extract all "vendor": "..." patterns
    const vendorMatches = dataContent.matchAll(/"vendor":\s*"([^"]+)"/g);
    const vendors = new Set();

    for (const match of vendorMatches) {
      const vendor = match[1].trim();
      if (vendor) {
        // Handle combined vendors like "Foundation Medicine / Natera"
        if (vendor.includes('/')) {
          vendor.split('/').forEach(v => vendors.add(v.trim()));
        } else {
          vendors.add(vendor);
        }
      }
    }

    return Array.from(vendors).sort();
  } catch (error) {
    console.error('Error reading data.js:', error.message);
    return [];
  }
}

/**
 * Extract text content from HTML
 */
function extractTextFromHtml(html) {
  // Remove script and style tags and their contents
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  text = text.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&rsquo;/g, "'");
  text = text.replace(/&lsquo;/g, "'");
  text = text.replace(/&rdquo;/g, '"');
  text = text.replace(/&ldquo;/g, '"');
  text = text.replace(/&mdash;/g, '—');
  text = text.replace(/&ndash;/g, '–');

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Find coverage-related matches in text
 */
function findCoverageMatches(text) {
  const matches = [];

  for (const pattern of COVERAGE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Get surrounding context (100 chars before and after)
      const start = Math.max(0, match.index - 100);
      const end = Math.min(text.length, match.index + match[0].length + 100);
      const context = text.slice(start, end);

      matches.push({
        term: match[0],
        pattern: pattern.source,
        context: context.trim()
      });
    }
  }

  // Deduplicate by context
  const seen = new Set();
  return matches.filter(m => {
    const key = m.context;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Fetch a URL and extract content
 */
async function fetchAndExtract(url) {
  try {
    console.log(`  Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow',
      timeout: 30000
    });

    if (!response.ok) {
      return {
        url,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        rawHtml: null,
        textContent: null,
        coverageMatches: []
      };
    }

    const html = await response.text();
    const textContent = extractTextFromHtml(html);
    const coverageMatches = findCoverageMatches(textContent);

    return {
      url,
      success: true,
      error: null,
      rawHtml: html.slice(0, 50000), // Limit raw HTML size
      textContent: textContent.slice(0, 20000), // Limit text content size
      coverageMatches
    };
  } catch (error) {
    return {
      url,
      success: false,
      error: error.message,
      rawHtml: null,
      textContent: null,
      coverageMatches: []
    };
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Vendor Coverage Scraper');
  console.log('='.repeat(60));
  console.log();

  // Extract vendors from data
  console.log('Extracting vendors from src/data.js...');
  const allVendors = extractVendorsFromData();
  console.log(`Found ${allVendors.length} unique vendors:`);
  allVendors.forEach(v => console.log(`  - ${v}`));
  console.log();

  // Identify which vendors have known URLs
  const vendorsWithUrls = allVendors.filter(v => VENDOR_URLS[v]);
  const vendorsWithoutUrls = allVendors.filter(v => !VENDOR_URLS[v]);

  console.log(`Vendors with known billing URLs: ${vendorsWithUrls.length}`);
  vendorsWithUrls.forEach(v => console.log(`  ✓ ${v}`));
  console.log();

  console.log(`Vendors without known billing URLs: ${vendorsWithoutUrls.length}`);
  vendorsWithoutUrls.forEach(v => console.log(`  ✗ ${v}`));
  console.log();

  // Scrape each vendor's URLs
  console.log('Starting to scrape vendor pages...');
  console.log('-'.repeat(60));

  const results = {};

  for (const vendor of vendorsWithUrls) {
    console.log(`\n[${vendor}]`);
    results[vendor] = {
      urls: VENDOR_URLS[vendor],
      scrapeResults: []
    };

    for (const url of VENDOR_URLS[vendor]) {
      const scrapeResult = await fetchAndExtract(url);
      results[vendor].scrapeResults.push(scrapeResult);

      if (scrapeResult.success) {
        console.log(`  ✓ Success - Found ${scrapeResult.coverageMatches.length} coverage-related matches`);
      } else {
        console.log(`  ✗ Failed: ${scrapeResult.error}`);
      }
    }
  }

  // Prepare output
  const output = {
    metadata: {
      scrapedAt: new Date().toISOString(),
      totalVendors: allVendors.length,
      vendorsScraped: vendorsWithUrls.length,
      vendorsMissingUrls: vendorsWithoutUrls
    },
    vendors: results
  };

  // Write results
  const outputPath = join(__dirname, 'vendor-coverage-raw.json');
  writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('Scraping complete!');
  console.log(`Results saved to: ${outputPath}`);
  console.log('='.repeat(60));

  // Print summary of coverage matches
  console.log('\nSummary of coverage-related content found:');
  console.log('-'.repeat(60));

  for (const [vendor, data] of Object.entries(results)) {
    const totalMatches = data.scrapeResults.reduce((sum, r) => sum + r.coverageMatches.length, 0);
    console.log(`\n${vendor}: ${totalMatches} matches`);

    // Show unique terms found
    const terms = new Set();
    data.scrapeResults.forEach(r => {
      r.coverageMatches.forEach(m => terms.add(m.term.toLowerCase()));
    });
    if (terms.size > 0) {
      console.log(`  Terms: ${Array.from(terms).join(', ')}`);
    }
  }
}

// Run the script
main().catch(console.error);
