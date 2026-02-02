/**
 * MRD Guidance Document Downloader
 *
 * Downloads guideline documents for processing by the file watcher.
 * Uses existing APIs where available (CMS) and direct downloads for open-access content.
 *
 * Usage:
 *   npm run mrd:download -- cms        Download MolDX LCDs from CMS API
 *   npm run mrd:download -- asco       Download ASCO guidelines
 *   npm run mrd:download -- esmo       Download ESMO guidelines
 *   npm run mrd:download -- all        Download all available sources
 *   npm run mrd:download -- list       List available downloads
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { chromium } from 'playwright';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('mrd-downloader');

const WATCHED_DIR = path.join(process.cwd(), 'watched-files');

// Known open-access document URLs
// These are freely available PDFs from society websites
const OPEN_ACCESS_DOCUMENTS = {
  asco: [
    {
      name: 'ASCO ctDNA GI Cancers 2024',
      // JCO guideline - check for open access PDF
      url: 'https://ascopubs.org/doi/pdfdirect/10.1200/JCO.22.02767',
      fallbackUrl: 'https://ascopubs.org/doi/pdf/10.1200/JCO.22.02767',
      filename: 'ctdna-gi-cancers-2024.pdf',
      description: 'Circulating Tumor DNA Analysis in Patients With Gastrointestinal Cancers',
    },
  ],
  esmo: [
    {
      name: 'ESMO Colorectal Cancer Guidelines',
      // ESMO provides open access to guideline PDFs
      url: 'https://www.esmo.org/content/download/347823/6934379/1/ESMO-CPG-Localised-Colon-Cancer-Web.pdf',
      filename: 'colorectal-localized-2024.pdf',
      description: 'ESMO Clinical Practice Guidelines for diagnosis, treatment and follow-up',
    },
    {
      name: 'ESMO Metastatic Colorectal Cancer',
      url: 'https://www.esmo.org/content/download/347819/6934363/1/ESMO-CPG-mCRC-Web.pdf',
      filename: 'colorectal-metastatic-2024.pdf',
      description: 'ESMO Guidelines for metastatic colorectal cancer',
    },
  ],
  sitc: [
    {
      name: 'SITC Cancer Immunotherapy Biomarkers',
      // JITC (Journal for ImmunoTherapy of Cancer) - BMJ open access
      url: 'https://jitc.bmj.com/content/jitc/8/2/e000992.full.pdf',
      filename: 'biomarkers-consensus-2020.pdf',
      description: 'SITC consensus statement on predictive biomarkers for cancer immunotherapy',
    },
  ],
};

// CMS API configuration
const CMS_API = {
  baseUrl: 'https://api.coverage.cms.gov',
  searchTerms: ['ctDNA', 'circulating tumor DNA', 'MolDX', 'liquid biopsy', 'minimal residual disease'],
};

/**
 * Fetch CMS API license token
 */
async function getCMSLicenseToken() {
  return new Promise((resolve, reject) => {
    const url = `${CMS_API.baseUrl}/v1/metadata/license-agreement`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const token = parsed?.data?.[0]?.Token;
          if (token) {
            resolve(token);
          } else {
            reject(new Error('No token in response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Search CMS for MolDX/ctDNA LCDs
 */
async function searchCMSForLCDs(token, keyword) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${CMS_API.baseUrl}/v1/reports/local-coverage-final-lcds`);
    url.searchParams.set('keyword', keyword);

    const options = {
      headers: { Authorization: `Bearer ${token}` },
    };

    https.get(url.toString(), options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.data || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Get LCD details from CMS API
 */
async function getLCDDetails(token, lcdId) {
  return new Promise((resolve, reject) => {
    const url = `${CMS_API.baseUrl}/v1/reports/local-coverage-lcd-detail/${lcdId}`;

    const options = {
      headers: { Authorization: `Bearer ${token}` },
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.data?.[0] || null);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download file from URL
 */
async function downloadFile(url, destPath, options = {}) {
  const { maxRedirects = 5, timeout = 30000 } = options;

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, { timeout }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        logger.debug(`Redirecting to: ${redirectUrl}`);
        downloadFile(redirectUrl, destPath, { ...options, maxRedirects: maxRedirects - 1 })
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      // Check content type
      const contentType = res.headers['content-type'] || '';
      if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
        logger.warn(`Unexpected content type: ${contentType}`);
      }

      const file = fs.createWriteStream(destPath);
      res.pipe(file);

      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(destPath);
        if (stats.size < 1000) {
          fs.unlinkSync(destPath);
          reject(new Error('Downloaded file too small, likely an error page'));
          return;
        }
        resolve({ path: destPath, size: stats.size });
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {}); // Clean up
        reject(err);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Download using Playwright (for sites that block simple requests)
 */
async function downloadWithPlaywright(url, destPath) {
  logger.info(`Using Playwright for: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await context.newPage();

  try {
    // Set up download handler
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Check if it's a PDF viewer or direct download
    const contentType = await page.evaluate(() => document.contentType);

    if (contentType === 'application/pdf') {
      // Direct PDF - get the content
      const response = await page.goto(url);
      const buffer = await response.body();
      fs.writeFileSync(destPath, buffer);
      return { path: destPath, size: buffer.length };
    }

    // Try to find and click download button
    const downloadButton = await page.$('a[href*=".pdf"], button:has-text("Download"), a:has-text("PDF")');
    if (downloadButton) {
      await downloadButton.click();
      const download = await downloadPromise;
      await download.saveAs(destPath);
      const stats = fs.statSync(destPath);
      return { path: destPath, size: stats.size };
    }

    throw new Error('Could not find PDF download on page');

  } finally {
    await browser.close();
  }
}

/**
 * Download CMS LCD documents
 */
async function downloadCMSDocuments() {
  logger.info('Downloading CMS MolDX LCD documents...');

  const outputDir = path.join(WATCHED_DIR, 'payer-criteria', 'moldx');
  fs.mkdirSync(outputDir, { recursive: true });

  const results = { downloaded: [], skipped: [], failed: [] };

  try {
    // Get license token
    const token = await getCMSLicenseToken();
    logger.info('Obtained CMS API license token');

    // Search for relevant LCDs
    const seenIds = new Set();
    const relevantLCDs = [];

    for (const term of CMS_API.searchTerms) {
      logger.info(`Searching CMS for: ${term}`);
      const lcds = await searchCMSForLCDs(token, term);

      for (const lcd of lcds) {
        const lcdId = lcd.lcdId || lcd.id;
        if (lcdId && !seenIds.has(lcdId)) {
          seenIds.add(lcdId);

          // Filter for MolDX relevance
          const title = (lcd.title || lcd.name || '').toLowerCase();
          if (
            title.includes('moldx') ||
            title.includes('ctdna') ||
            title.includes('liquid biopsy') ||
            title.includes('circulating tumor') ||
            title.includes('molecular')
          ) {
            relevantLCDs.push(lcd);
          }
        }
      }
    }

    logger.info(`Found ${relevantLCDs.length} relevant LCDs`);

    // Get details and save each LCD
    for (const lcd of relevantLCDs) {
      const lcdId = lcd.lcdId || lcd.id;
      const title = lcd.title || lcd.name || `LCD-${lcdId}`;
      const filename = `${lcdId}-${title.replace(/[^a-z0-9]/gi, '-').substring(0, 50)}.json`;
      const destPath = path.join(outputDir, filename);

      // Check if already exists
      if (fs.existsSync(destPath)) {
        results.skipped.push({ lcdId, title, reason: 'Already exists' });
        continue;
      }

      try {
        // Get full LCD details
        const details = await getLCDDetails(token, lcdId);

        if (details) {
          // Save as JSON (CMS doesn't provide PDFs via API, but we get structured data)
          fs.writeFileSync(destPath, JSON.stringify({
            lcdId,
            title,
            ...details,
            downloadedAt: new Date().toISOString(),
          }, null, 2));

          results.downloaded.push({ lcdId, title, path: destPath });
          logger.info(`Downloaded LCD: ${title}`);
        } else {
          results.failed.push({ lcdId, title, error: 'No details returned' });
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 1000));

      } catch (error) {
        results.failed.push({ lcdId, title, error: error.message });
        logger.warn(`Failed to download LCD ${lcdId}: ${error.message}`);
      }
    }

  } catch (error) {
    logger.error('CMS download failed', { error: error.message });
    results.failed.push({ error: error.message });
  }

  return results;
}

/**
 * Download open-access society documents
 */
async function downloadOpenAccessDocuments(source) {
  const docs = OPEN_ACCESS_DOCUMENTS[source];
  if (!docs || docs.length === 0) {
    logger.warn(`No documents configured for source: ${source}`);
    return { downloaded: [], skipped: [], failed: [] };
  }

  const outputDir = path.join(WATCHED_DIR, source);
  fs.mkdirSync(outputDir, { recursive: true });

  const results = { downloaded: [], skipped: [], failed: [] };

  for (const doc of docs) {
    const destPath = path.join(outputDir, doc.filename);

    // Check if already exists
    if (fs.existsSync(destPath)) {
      results.skipped.push({ name: doc.name, reason: 'Already exists' });
      logger.info(`Skipping (exists): ${doc.name}`);
      continue;
    }

    logger.info(`Downloading: ${doc.name}`);

    try {
      // Try direct download first
      await downloadFile(doc.url, destPath);
      results.downloaded.push({ name: doc.name, path: destPath });
      logger.info(`Downloaded: ${doc.name}`);

    } catch (error) {
      logger.warn(`Direct download failed: ${error.message}`);

      // Try fallback URL if available
      if (doc.fallbackUrl) {
        try {
          await downloadFile(doc.fallbackUrl, destPath);
          results.downloaded.push({ name: doc.name, path: destPath });
          logger.info(`Downloaded (fallback): ${doc.name}`);
          continue;
        } catch (e2) {
          logger.warn(`Fallback download failed: ${e2.message}`);
        }
      }

      // Try Playwright as last resort
      try {
        await downloadWithPlaywright(doc.url, destPath);
        results.downloaded.push({ name: doc.name, path: destPath });
        logger.info(`Downloaded (Playwright): ${doc.name}`);

      } catch (e3) {
        results.failed.push({ name: doc.name, error: e3.message });
        logger.error(`Failed to download: ${doc.name}`, { error: e3.message });
      }
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}

/**
 * List available downloads
 */
function listAvailableDownloads() {
  console.log('\n=== Available MRD Document Downloads ===\n');

  console.log('CMS/MolDX (via API):');
  console.log('  - Searches for ctDNA, MolDX, liquid biopsy LCDs');
  console.log('  - Downloads structured JSON data');
  console.log('  - Run: npm run mrd:download -- cms\n');

  for (const [source, docs] of Object.entries(OPEN_ACCESS_DOCUMENTS)) {
    console.log(`${source.toUpperCase()} (${docs.length} documents):`);
    for (const doc of docs) {
      console.log(`  - ${doc.name}`);
      console.log(`    ${doc.description}`);
    }
    console.log(`  Run: npm run mrd:download -- ${source}\n`);
  }

  console.log('Download all: npm run mrd:download -- all');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';

  const allResults = { downloaded: [], skipped: [], failed: [] };

  switch (command) {
    case 'list':
      listAvailableDownloads();
      break;

    case 'cms':
      const cmsResults = await downloadCMSDocuments();
      Object.assign(allResults, cmsResults);
      break;

    case 'asco':
    case 'esmo':
    case 'sitc':
      const sourceResults = await downloadOpenAccessDocuments(command);
      Object.assign(allResults, sourceResults);
      break;

    case 'all':
      // Download from all sources
      const cms = await downloadCMSDocuments();
      allResults.downloaded.push(...cms.downloaded);
      allResults.skipped.push(...cms.skipped);
      allResults.failed.push(...cms.failed);

      for (const source of Object.keys(OPEN_ACCESS_DOCUMENTS)) {
        const results = await downloadOpenAccessDocuments(source);
        allResults.downloaded.push(...results.downloaded);
        allResults.skipped.push(...results.skipped);
        allResults.failed.push(...results.failed);
      }
      break;

    default:
      console.log(`Unknown command: ${command}`);
      console.log('Use: list, cms, asco, esmo, sitc, or all');
      process.exit(1);
  }

  if (command !== 'list') {
    console.log('\n=== Download Summary ===');
    console.log(`Downloaded: ${allResults.downloaded.length}`);
    console.log(`Skipped: ${allResults.skipped.length}`);
    console.log(`Failed: ${allResults.failed.length}`);

    if (allResults.downloaded.length > 0) {
      console.log('\nDownloaded files:');
      for (const item of allResults.downloaded) {
        console.log(`  ✓ ${item.name || item.title}`);
      }
    }

    if (allResults.failed.length > 0) {
      console.log('\nFailed downloads:');
      for (const item of allResults.failed) {
        console.log(`  ✗ ${item.name || item.title || 'Unknown'}: ${item.error}`);
      }
    }

    console.log('\nNext: Run "npm run mrd:files -- scan" to process downloaded files');
  }
}

export {
  downloadCMSDocuments,
  downloadOpenAccessDocuments,
  listAvailableDownloads,
  OPEN_ACCESS_DOCUMENTS,
};

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     process.argv[1]?.endsWith('downloader.js');
if (isMainModule) {
  main().catch(error => {
    logger.error('Download failed', { error: error.message });
    process.exit(1);
  });
}
