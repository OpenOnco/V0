/**
 * Vendor Website Crawler
 * Monitors test manufacturer news/press release pages for coverage announcements
 *
 * Uses Playwright to render JS-heavy pages, hash-based change detection,
 * and Claude API to identify coverage-related announcements.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { chromium } from 'playwright';
import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES, MONITORED_VENDORS } from '../config.js';

// Path to store content hashes for change detection
const HASH_FILE_PATH = resolve(process.cwd(), 'data', 'vendor-hashes.json');

// Realistic user agent to avoid bot detection
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Rate limit delay between requests (3 seconds)
const RATE_LIMIT_MS = 3000;

// Claude model for coverage analysis
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Vendor news/press release pages to monitor
// Focus ONLY on news pages - no product pages
const VENDOR_SOURCES = [
  // Major ctDNA/MRD vendors
  {
    name: 'Natera',
    id: 'natera',
    newsUrl: 'https://www.natera.com/company/news',
  },
  {
    name: 'Guardant Health',
    id: 'guardant',
    newsUrl: 'https://guardanthealth.com/newsroom/press-releases',
  },
  {
    name: 'Foundation Medicine',
    id: 'foundation',
    newsUrl: 'https://www.foundationmedicine.com/press-releases',
  },
  {
    name: 'Tempus',
    id: 'tempus',
    newsUrl: 'https://www.tempus.com/news',
  },
  {
    name: 'Caris Life Sciences',
    id: 'caris',
    newsUrl: 'https://www.carislifesciences.com/news-and-events/news',
  },
  {
    name: 'GRAIL',
    id: 'grail',
    newsUrl: 'https://www.grail.com/press-releases',
  },

  // Large reference labs
  {
    name: 'Exact Sciences',
    id: 'exact-sciences',
    newsUrl: 'https://www.exactsciences.com/newsroom',
  },
  {
    name: 'Labcorp',
    id: 'labcorp',
    newsUrl: 'https://www.labcorp.com/newsroom',
  },
  {
    name: 'Quest Diagnostics',
    id: 'quest',
    newsUrl: 'https://newsroom.questdiagnostics.com/press-releases',
  },

  // Specialized vendors
  {
    name: 'Adaptive Biotechnologies',
    id: 'adaptive',
    newsUrl: 'https://investors.adaptivebiotech.com/news-events/news-releases',
    rssUrl: 'https://investors.adaptivebiotech.com/rss/news-releases.xml',
  },
  {
    name: 'NeoGenomics',
    id: 'neogenomics',
    newsUrl: 'https://neogenomics.com/newsroom',
  },
  {
    name: 'Personalis',
    id: 'personalis',
    newsUrl: 'https://www.personalis.com/news',
  },
  {
    name: 'Myriad Genetics',
    id: 'myriad',
    newsUrl: 'https://myriad.com/news-events/news',
  },
  {
    name: 'Invitae',
    id: 'invitae',
    newsUrl: 'https://www.invitae.com/en/press',
  },
  {
    name: 'Veracyte',
    id: 'veracyte',
    newsUrl: 'https://investor.veracyte.com/press-releases',
    rssUrl: 'https://investor.veracyte.com/rss/news-releases.xml',
  },
  {
    name: 'Freenome',
    id: 'freenome',
    newsUrl: 'https://www.freenome.com/news',
  },
  {
    name: 'BillionToOne',
    id: 'billiontoone',
    newsUrl: 'https://billiontoone.com/news',
  },
  {
    name: 'Resolution Bioscience',
    id: 'resolution',
    newsUrl: 'https://www.resolutionbio.com/news',
  },
  {
    name: 'Burning Rock Dx',
    id: 'burning-rock',
    newsUrl: 'https://www.brbiotech.com/news',
  },
  {
    name: 'Helio Genomics',
    id: 'helio',
    newsUrl: 'https://www.helio.health/news',
  },
];

export class VendorCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.vendor?.name || 'Vendors',
      source: SOURCES.VENDOR,
      description: config.crawlers.vendor?.description || 'Vendor coverage announcements',
      rateLimit: config.crawlers.vendor?.rateLimit || 3,
      enabled: config.crawlers.vendor?.enabled ?? true,
    });

    this.vendors = VENDOR_SOURCES;
    this.browser = null;
    this.hashes = {};
    this.anthropic = config.anthropic?.apiKey ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;
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
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Extract text content for hashing and analysis
      const content = await page.evaluate(() => {
        // Remove script and style elements for cleaner text
        const scripts = document.querySelectorAll('script, style, noscript');
        scripts.forEach((el) => el.remove());
        return document.body.innerText;
      });

      // Extract headlines/article titles for targeted analysis
      const headlines = await page.evaluate(() => {
        const items = [];
        // Common news item selectors
        const selectors = [
          'article h2', 'article h3',
          '.news-item h2', '.news-item h3',
          '.press-release-title', '.press-release h2',
          '.newsroom-item h2', '.newsroom-item h3',
          'h2 a', 'h3 a',
          '[class*="news"] h2', '[class*="news"] h3',
          '[class*="press"] h2', '[class*="press"] h3',
        ];

        for (const selector of selectors) {
          document.querySelectorAll(selector).forEach((el) => {
            const text = el.innerText?.trim();
            if (text && text.length > 10 && text.length < 300) {
              items.push(text);
            }
          });
        }
        return [...new Set(items)].slice(0, 20); // Dedupe and limit
      });

      return { content, headlines, url };
    } finally {
      await context.close();
    }
  }

  /**
   * Fetch RSS feed content for vendors that block Playwright
   * Returns { content, headlines, url } in same format as fetchPage
   */
  async fetchRSS(url) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    });

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();

    // Parse RSS XML to extract items
    const headlines = [];
    const descriptions = [];

    // Extract all <item> blocks
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const itemContent = itemMatch[1];

      // Extract title
      const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      if (titleMatch) {
        const title = titleMatch[1].trim();
        if (title && title.length > 10 && title.length < 300) {
          headlines.push(title);
        }
      }

      // Extract description
      const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      if (descMatch) {
        // Strip HTML tags from description
        const desc = descMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (desc) {
          descriptions.push(desc);
        }
      }
    }

    // Combine descriptions for content
    const content = descriptions.join('\n\n');

    return { content, headlines: [...new Set(headlines)].slice(0, 20), url };
  }

  /**
   * Use Claude to analyze if content contains coverage announcements
   * Returns extracted coverage info or null if not coverage-related
   */
  async analyzeCoverageContent(vendor, content, headlines) {
    if (!this.anthropic) {
      this.log('warn', 'Anthropic API key not configured, skipping Claude analysis');
      return null;
    }

    // Prepare content for analysis - focus on headlines + recent content
    const analysisContent = [
      `VENDOR: ${vendor.name}`,
      '',
      'RECENT HEADLINES:',
      ...headlines.slice(0, 10),
      '',
      'PAGE CONTENT (excerpt):',
      content.slice(0, 4000), // Limit content size
    ].join('\n');

    try {
      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Analyze this vendor news page for coverage or reimbursement announcements.

${analysisContent}

TASK: Identify any announcements about:
- Insurance coverage (Medicare, Medicaid, commercial payers)
- Reimbursement decisions or approvals
- CMS coverage determinations
- Payer partnerships or contracts
- Prior authorization changes

If you find coverage-related announcements, respond with JSON:
{
  "hasCoverageNews": true,
  "announcements": [
    {
      "headline": "The announcement headline",
      "payerName": "Name of payer if mentioned (or null)",
      "testName": "Name of test if mentioned (or null)",
      "coverageType": "One of: medicare, medicaid, commercial, medicare_advantage, or null",
      "effectiveDate": "Date if mentioned (or null)",
      "summary": "Brief summary of the coverage news"
    }
  ]
}

If NO coverage-related news found, respond with:
{
  "hasCoverageNews": false,
  "announcements": []
}

Respond ONLY with valid JSON, no other text.`,
          },
        ],
      });

      const responseText = response.content[0]?.text?.trim();
      if (!responseText) return null;

      // Parse JSON response - handle potential markdown code fences
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const result = JSON.parse(jsonText);
      return result;
    } catch (error) {
      this.log('warn', `Claude analysis failed for ${vendor.name}`, { error: error.message });
      return null;
    }
  }

  /**
   * Main crawl implementation
   */
  async crawl() {
    this.log('info', `Starting vendor coverage crawl: ${this.vendors.length} vendors`);

    await this.loadHashes();
    const discoveries = [];
    let pagesProcessed = 0;
    let pagesChanged = 0;
    let pagesFailed = 0;
    let coverageFound = 0;

    try {
      for (const vendor of this.vendors) {
        const url = vendor.rssUrl || vendor.newsUrl;

        try {
          // Rate limit between requests
          if (pagesProcessed > 0) {
            await this.sleep(RATE_LIMIT_MS);
          }

          // Use RSS feed if available, otherwise use Playwright
          let content, headlines;
          if (vendor.rssUrl) {
            this.log('debug', `Fetching RSS: ${url}`);
            ({ content, headlines } = await this.fetchRSS(url));
          } else {
            this.log('debug', `Fetching page: ${url}`);
            ({ content, headlines } = await this.fetchPage(url));
          }

          // Compute hash of page content
          const newHash = this.computeHash(content);
          const oldHash = this.hashes[url];

          pagesProcessed++;

          if (newHash !== oldHash) {
            pagesChanged++;
            const isFirstCrawl = !oldHash;

            this.log('info', `Content ${isFirstCrawl ? 'captured' : 'changed'}: ${vendor.name}`);

            // Store new hash
            this.hashes[url] = newHash;

            // Only analyze for coverage if content changed (not first crawl)
            if (!isFirstCrawl) {
              // Use Claude to check for coverage announcements
              const analysis = await this.analyzeCoverageContent(vendor, content, headlines);

              if (analysis?.hasCoverageNews && analysis.announcements?.length > 0) {
                coverageFound += analysis.announcements.length;

                for (const announcement of analysis.announcements) {
                  const discovery = this.createCoverageDiscovery(vendor, announcement, url);
                  discoveries.push(discovery);
                }
              }
            }
          } else {
            this.log('debug', `No changes: ${vendor.name}`);
          }
        } catch (error) {
          pagesFailed++;
          this.log('warn', `Failed to fetch ${url}`, { error: error.message });
        }
      }
    } finally {
      await this.closeBrowser();
      await this.saveHashes();
    }

    this.log('info', 'Vendor coverage crawl complete', {
      pagesProcessed,
      pagesChanged,
      pagesFailed,
      coverageFound,
      discoveries: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Create discovery from coverage announcement
   */
  createCoverageDiscovery(vendor, announcement, sourceUrl) {
    const parts = [];
    if (announcement.payerName) parts.push(announcement.payerName);
    if (announcement.testName) parts.push(announcement.testName);
    if (announcement.coverageType) parts.push(announcement.coverageType);

    const title = announcement.headline ||
      `${vendor.name}: Coverage Announcement${parts.length ? ` - ${parts.join(', ')}` : ''}`;

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_COVERAGE_ANNOUNCEMENT,
      title: title.slice(0, 200),
      summary: announcement.summary || announcement.headline,
      url: sourceUrl,
      relevance: this.calculateRelevance(announcement),
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        payerName: announcement.payerName,
        testName: announcement.testName,
        coverageType: announcement.coverageType,
        effectiveDate: announcement.effectiveDate,
        changeType: 'coverage_announcement',
      },
    };
  }

  /**
   * Calculate relevance based on content
   */
  calculateRelevance(announcement) {
    const text = `${announcement.headline || ''} ${announcement.summary || ''}`.toLowerCase();

    // High relevance: Major payers or Medicare
    const highTerms = [
      'medicare',
      'cms',
      'medicaid',
      'unitedhealthcare',
      'uhc',
      'anthem',
      'cigna',
      'aetna',
      'humana',
      'blue cross',
      'bcbs',
      'national coverage',
      'lcd',
      'ncd',
    ];

    if (highTerms.some((term) => text.includes(term))) {
      return 'high';
    }

    // Medium relevance: Coverage-related terms
    const mediumTerms = [
      'coverage',
      'reimbursement',
      'payer',
      'insurance',
      'prior authorization',
      'approved',
    ];

    if (mediumTerms.some((term) => text.includes(term))) {
      return 'medium';
    }

    return 'low';
  }
}

export default VendorCrawler;
