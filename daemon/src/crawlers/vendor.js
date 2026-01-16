/**
 * Vendor Website Crawler
 * Monitors test manufacturer websites for product updates and announcements
 *
 * Uses Playwright to render JS-heavy pages and detect content changes via hashing.
 */

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { chromium } from 'playwright';
import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES } from '../config.js';

// Path to store content hashes for change detection
const HASH_FILE_PATH = resolve(process.cwd(), 'data', 'vendor-hashes.json');

// Realistic user agent to avoid bot detection
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Rate limit delay between requests (3 seconds)
const RATE_LIMIT_MS = 3000;

// Vendor websites to monitor with specific page configurations
const VENDOR_SOURCES = [
  {
    name: 'Natera',
    id: 'natera',
    baseUrl: 'https://www.natera.com',
    pages: [
      { path: '/oncology', description: 'Oncology landing page', type: 'product' },
      { path: '/company/news', description: 'News and press releases', type: 'news' },
    ],
  },
  {
    name: 'Guardant Health',
    id: 'guardant',
    baseUrl: 'https://guardanthealth.com',
    pages: [
      { path: '/products/tests-for-cancer-screening', description: 'Shield Blood Test', type: 'product' },
      { path: '/products/tests-for-patients-with-early-and-advanced-stage-cancer', description: 'Guardant Complete', type: 'product' },
      { path: '/newsroom/press-releases', description: 'Press releases', type: 'news' },
    ],
  },
  {
    name: 'Foundation Medicine',
    id: 'foundation',
    baseUrl: 'https://www.foundationmedicine.com',
    pages: [
      { path: '/genomic-testing/foundation-one-cdx', description: 'FoundationOne CDx', type: 'product' },
      { path: '/test/foundationone-liquid-cdx', description: 'FoundationOne Liquid CDx', type: 'product' },
      { path: '/press-releases', description: 'Press releases', type: 'news' },
    ],
  },
  {
    name: 'Tempus',
    id: 'tempus',
    baseUrl: 'https://www.tempus.com',
    pages: [
      { path: '/oncology/genomic-profiling', description: 'Genomic profiling services', type: 'product' },
      { path: '/news', description: 'News', type: 'news' },
    ],
  },
  {
    name: 'Caris Life Sciences',
    id: 'caris',
    baseUrl: 'https://www.carislifesciences.com',
    pages: [
      { path: '/products-and-services/molecular-profiling', description: 'Molecular profiling', type: 'product' },
      { path: '/news-and-events/news', description: 'News', type: 'news' },
    ],
  },
  {
    name: 'GRAIL',
    id: 'grail',
    baseUrl: 'https://www.grail.com',
    pages: [
      { path: '/galleri', description: 'Galleri test page', type: 'product' },
      { path: '/press-releases', description: 'Press releases', type: 'news' },
    ],
  },
];

export class VendorCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.vendor.name,
      source: SOURCES.VENDOR,
      description: config.crawlers.vendor.description,
      rateLimit: config.crawlers.vendor.rateLimit,
      enabled: config.crawlers.vendor.enabled,
    });

    this.vendors = VENDOR_SOURCES;
    this.browser = null;
    this.hashes = {};
  }

  /**
   * Load stored content hashes from disk
   */
  async loadHashes() {
    try {
      const data = await readFile(HASH_FILE_PATH, 'utf-8');
      this.hashes = JSON.parse(data);
      this.log('debug', `Loaded ${Object.keys(this.hashes).length} stored hashes`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.log('info', 'No existing hash file, starting fresh');
        this.hashes = {};
      } else {
        this.log('warn', 'Failed to load hash file', { error: error.message });
        this.hashes = {};
      }
    }
  }

  /**
   * Save content hashes to disk
   */
  async saveHashes() {
    try {
      await mkdir(dirname(HASH_FILE_PATH), { recursive: true });
      await writeFile(HASH_FILE_PATH, JSON.stringify(this.hashes, null, 2));
      this.log('debug', `Saved ${Object.keys(this.hashes).length} hashes`);
    } catch (error) {
      this.log('error', 'Failed to save hash file', { error: error.message });
    }
  }

  /**
   * Compute hash of page content
   */
  computeHash(content) {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Launch browser instance
   */
  async launchBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
      });
      this.log('debug', 'Browser launched');
    }
    return this.browser;
  }

  /**
   * Close browser instance
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.log('debug', 'Browser closed');
    }
  }

  /**
   * Fetch page content using Playwright
   */
  async fetchPage(url) {
    const browser = await this.launchBrowser();
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Extract text content and key elements
      const content = await page.evaluate(() => {
        // Remove script and style elements for cleaner text
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach((el) => el.remove());
        return document.body.innerText;
      });

      // Extract structured data
      const extractedData = await page.evaluate(() => {
        const data = {
          title: document.title,
          headings: [],
          productNames: [],
          versions: [],
          pricing: [],
          features: [],
        };

        // Extract headings
        document.querySelectorAll('h1, h2, h3').forEach((h) => {
          const text = h.innerText.trim();
          if (text) data.headings.push(text);
        });

        const bodyText = document.body.innerText;

        // Look for version patterns (v1.0, Version 2.0, etc.)
        const versionMatches = bodyText.match(/(?:v|version\s*)(\d+(?:\.\d+)*)/gi) || [];
        data.versions = [...new Set(versionMatches)];

        // Look for pricing mentions
        const pricingPatterns = [
          /\$[\d,]+(?:\.\d{2})?/g,
          /(?:price|pricing|cost|fee)[:\s]+[^\n.]+/gi,
          /(?:covered|reimbursement|medicare|insurance)[:\s]+[^\n.]+/gi,
        ];
        pricingPatterns.forEach((pattern) => {
          const matches = bodyText.match(pattern) || [];
          data.pricing.push(...matches.slice(0, 5)); // Limit to 5 per pattern
        });

        // Look for feature/capability mentions
        const featurePatterns = [
          /(?:new|introducing|announcing|launch)[:\s]+[^\n.]+/gi,
          /(?:now available|now offering)[:\s]+[^\n.]+/gi,
          /(?:fda approved|fda cleared|ce marked)[^\n.]*/gi,
        ];
        featurePatterns.forEach((pattern) => {
          const matches = bodyText.match(pattern) || [];
          data.features.push(...matches.slice(0, 5));
        });

        return data;
      });

      return { content, extractedData, url };
    } finally {
      await context.close();
    }
  }

  /**
   * Main crawl implementation
   */
  async crawl() {
    this.log('info', `Starting vendor crawl: ${this.vendors.length} vendors, ${this.getTotalPages()} pages`);

    await this.loadHashes();
    const discoveries = [];
    let pagesProcessed = 0;
    let pagesChanged = 0;
    let pagesFailed = 0;

    try {
      for (const vendor of this.vendors) {
        this.log('info', `Crawling vendor: ${vendor.name}`);

        for (const page of vendor.pages) {
          const url = `${vendor.baseUrl}${page.path}`;

          try {
            // Rate limit: wait between requests for same vendor
            if (pagesProcessed > 0) {
              await this.sleep(RATE_LIMIT_MS);
            }

            this.log('debug', `Fetching: ${url}`);
            const { content, extractedData } = await this.fetchPage(url);

            // Compute hash of page content
            const newHash = this.computeHash(content);
            const oldHash = this.hashes[url];

            pagesProcessed++;

            if (newHash !== oldHash) {
              pagesChanged++;
              const isFirstCrawl = !oldHash;

              this.log('info', `Content ${isFirstCrawl ? 'captured' : 'changed'}: ${url}`);

              // Store new hash
              this.hashes[url] = newHash;

              // Only create discoveries for actual changes (not first-time captures)
              if (!isFirstCrawl) {
                const discovery = this.createDiscoveryFromChange(vendor, page, url, extractedData);
                if (discovery) {
                  discoveries.push(discovery);
                }
              }
            } else {
              this.log('debug', `No changes: ${url}`);
            }
          } catch (error) {
            pagesFailed++;
            this.log('warn', `Failed to fetch ${url}`, { error: error.message });
            // Continue with other pages - don't let one failure stop the crawl
          }
        }
      }
    } finally {
      await this.closeBrowser();
      await this.saveHashes();
    }

    this.log('info', 'Vendor crawl complete', {
      pagesProcessed,
      pagesChanged,
      pagesFailed,
      discoveries: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Create discovery from detected page change
   */
  createDiscoveryFromChange(vendor, page, url, extractedData) {
    const changeDetails = {
      title: extractedData.title,
      summary: this.generateChangeSummary(vendor, page, extractedData),
      versions: extractedData.versions,
      pricing: extractedData.pricing,
      features: extractedData.features,
    };

    if (page.type === 'news') {
      return this.createNewsDiscovery(vendor, {
        title: `New content on ${page.description}`,
        summary: changeDetails.summary,
        url,
      });
    } else if (page.type === 'documentation') {
      return this.createDocumentationDiscovery(vendor, {
        title: page.description,
        summary: changeDetails.summary,
        url,
        type: 'documentation',
      });
    } else {
      return this.createProductUpdateDiscovery(vendor, page, changeDetails);
    }
  }

  /**
   * Generate a summary of detected changes
   */
  generateChangeSummary(vendor, page, extractedData) {
    const parts = [`Changes detected on ${vendor.name} ${page.description}`];

    if (extractedData.versions.length > 0) {
      parts.push(`Version info: ${extractedData.versions.slice(0, 3).join(', ')}`);
    }

    if (extractedData.features.length > 0) {
      parts.push(`Notable: ${extractedData.features[0].slice(0, 100)}`);
    }

    if (extractedData.pricing.length > 0) {
      parts.push(`Pricing mentions detected`);
    }

    return parts.join('. ');
  }

  /**
   * Get total number of pages across all vendors
   */
  getTotalPages() {
    return this.vendors.reduce((sum, vendor) => sum + vendor.pages.length, 0);
  }

  /**
   * Create discovery from product page change
   */
  createProductUpdateDiscovery(vendor, page, changeDetails = {}) {
    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_UPDATE,
      title: `${vendor.name}: Product Page Updated - ${page.description}`,
      summary: changeDetails.summary || `Changes detected on ${page.description}`,
      url: `${vendor.baseUrl}${page.path}`,
      relevance: this.calculateRelevance(changeDetails),
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        pageType: page.type,
        pagePath: page.path,
        changeType: 'product_update',
      },
    };
  }

  /**
   * Create discovery from news/press release
   */
  createNewsDiscovery(vendor, newsItem) {
    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_UPDATE,
      title: `${vendor.name}: ${newsItem.title}`,
      summary: newsItem.summary || newsItem.title,
      url: newsItem.url || `${vendor.baseUrl}/news`,
      relevance: this.calculateRelevance(newsItem),
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        pageType: 'news',
        publishDate: newsItem.date,
        changeType: 'press_release',
      },
    };
  }

  /**
   * Create discovery for documentation updates
   */
  createDocumentationDiscovery(vendor, doc) {
    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.TEST_DOCUMENTATION,
      title: `${vendor.name}: Documentation Updated - ${doc.title}`,
      summary: doc.summary || `Technical documentation updated`,
      url: doc.url,
      relevance: 'medium',
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        documentType: doc.type,
        changeType: 'documentation_update',
      },
    };
  }

  /**
   * Calculate relevance based on content
   */
  calculateRelevance(item) {
    const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();

    // High relevance terms - coverage, regulatory, clinical data
    const highTerms = [
      'coverage',
      'medicare',
      'cms',
      'fda',
      'approval',
      'cleared',
      'clinical data',
      'study results',
      'trial results',
      'guideline',
      'nccn',
      'indication',
      'expanded',
    ];

    if (highTerms.some((term) => text.includes(term))) {
      return 'high';
    }

    // Medium relevance - product updates, launches
    const mediumTerms = ['update', 'launch', 'new', 'partnership', 'collaboration', 'pricing'];

    if (mediumTerms.some((term) => text.includes(term))) {
      return 'medium';
    }

    return 'low';
  }
}

export default VendorCrawler;
