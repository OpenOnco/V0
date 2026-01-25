/**
 * Private Payer Medical Policy Crawler
 * Monitors major private insurers for coverage policy updates related to ctDNA/liquid biopsy testing
 *
 * Uses Playwright for JS-heavy payer sites with hash-based change detection.
 * Also monitors vendor coverage/reimbursement pages for updates.
 */

import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { chromium } from 'playwright';
import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES, ALL_TEST_NAMES, MONITORED_VENDORS } from '../config.js';

// Path to store content hashes for change detection
const HASH_FILE_PATH = resolve(process.cwd(), 'data', 'payer-hashes.json');

// Realistic user agent to avoid bot detection
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Rate limit delay between requests (5 seconds - more conservative for payer sites)
const RATE_LIMIT_MS = 5000;

// Page load timeout (payer sites can be slow/flaky)
const PAGE_TIMEOUT_MS = 60000;

// Maximum retries for flaky pages
const MAX_RETRIES = 3;

// Retry delay base (exponential backoff)
const RETRY_DELAY_BASE_MS = 2000;

// Keywords to search for in policy indexes
const SEARCH_KEYWORDS = [
  // Core ctDNA/liquid biopsy terms
  'ctDNA',
  'liquid biopsy',
  'MRD',
  'minimal residual disease',
  'cell-free DNA',
  'cfDNA',
  'circulating tumor DNA',
  // Profiling approaches
  'tumor profiling',
  'genomic profiling',
  'molecular profiling',
  'comprehensive genomic profiling',
  'CGP',
  'next-generation sequencing',
  'NGS',
  // MRD-specific terms
  'tumor-informed',
  'tumor-naive',
  'tumor-agnostic',
  // Specific test/vendor names (high priority)
  'Signatera',
  'Guardant',
  'Guardant360',
  'Guardant Reveal',
  'FoundationOne',
  'Galleri',
  'Tempus',
  'clonoSEQ',
  'Shield',
  // Additional relevant terms
  'somatic mutation',
  'variant allele frequency',
  'VAF',
];

// Tier 1: Major private payers with direct policy pages
const PAYER_SOURCES = [
  {
    name: 'UnitedHealthcare',
    id: 'uhc',
    baseUrl: 'https://www.uhcprovider.com',
    policyIndexPages: [
      {
        url: 'https://www.uhcprovider.com/en/policies-protocols/commercial-policies/commercial-medical-drug-policies.html',
        description: 'Commercial Medical & Drug Policies',
        type: 'index',
        // Search/filter for: molecular, genomic, liquid biopsy, ctDNA, oncology
      },
    ],
    // Direct policy pages to monitor for changes
    policyPages: [
      {
        path: '/content/provider/en/policies-protocols/commercial-policies/molecular-oncology-testing.html',
        description: 'Molecular Oncology Testing Policy',
        type: 'policy',
      },
    ],
    searchTerms: ['molecular', 'genomic', 'liquid biopsy', 'ctDNA', 'oncology'],
  },
  {
    name: 'Aetna',
    id: 'aetna',
    baseUrl: 'https://www.aetna.com',
    policyIndexPages: [
      {
        url: 'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html',
        description: 'Clinical Policy Bulletins',
        type: 'index',
        // Look for policy numbers related to genetic/molecular testing
      },
    ],
    policyPages: [
      {
        path: '/cpb/medical/data/100_199/0140.html',
        description: 'Genetic Testing CPB 0140',
        type: 'policy',
      },
      {
        path: '/cpb/medical/data/400_499/0469.html',
        description: 'Tumor Markers CPB 0469',
        type: 'policy',
      },
      {
        path: '/cpb/medical/data/700_799/0715.html',
        description: 'Liquid Biopsy CPB 0715',
        type: 'policy',
      },
    ],
    searchTerms: ['molecular', 'genetic', 'oncology', 'tumor', 'liquid biopsy', 'ctDNA'],
  },
  {
    name: 'Cigna',
    id: 'cigna',
    baseUrl: 'https://static.cigna.com',
    policyIndexPages: [
      {
        url: 'https://static.cigna.com/assets/chcp/pdf/coveragePolicies/medical/',
        description: 'Medical Coverage Policies (PDF Index)',
        type: 'pdf_index',
        // They have PDFs, look for molecular diagnostics policies
      },
    ],
    policyPages: [],
    searchTerms: ['molecular', 'genetic', 'oncology', 'tumor', 'sequencing', 'genomic', 'ctDNA'],
  },
  {
    name: 'Anthem/BCBS',
    id: 'anthem',
    baseUrl: 'https://www.anthem.com',
    policyIndexPages: [
      {
        url: 'https://www.anthem.com/provider/policies/medical-policies/',
        description: 'Medical Policies',
        type: 'index',
      },
    ],
    policyPages: [],
    searchTerms: ['molecular', 'genetic', 'oncology', 'tumor', 'genomic', 'liquid biopsy'],
  },
  {
    name: 'Humana',
    id: 'humana',
    baseUrl: 'https://www.humana.com',
    policyIndexPages: [
      {
        url: 'https://www.humana.com/provider/medical-resources/clinical-policies',
        description: 'Clinical Policies',
        type: 'index',
      },
    ],
    policyPages: [],
    searchTerms: ['molecular', 'genetic', 'oncology', 'tumor', 'genomic', 'laboratory', 'ctDNA'],
  },
];

// Vendor coverage/reimbursement pages to monitor (they track their own coverage status)
const VENDOR_COVERAGE_SOURCES = [
  {
    name: 'Natera',
    id: 'natera',
    baseUrl: 'https://www.natera.com',
    pages: [
      {
        path: '/oncology/signatera-mrd-test/coverage/',
        description: 'Signatera MRD Coverage',
        type: 'coverage',
        testNames: ['Signatera'],
      },
    ],
  },
  {
    name: 'Guardant Health',
    id: 'guardant',
    baseUrl: 'https://guardanthealth.com',
    pages: [
      {
        path: '/coverage/',
        description: 'Guardant Coverage',
        type: 'coverage',
        testNames: ['Guardant360', 'Guardant Reveal', 'Shield'],
      },
    ],
  },
  {
    name: 'Foundation Medicine',
    id: 'foundation',
    baseUrl: 'https://www.foundationmedicine.com',
    pages: [
      {
        path: '/info/patient-coverage',
        description: 'Patient Coverage',
        type: 'coverage',
        testNames: ['FoundationOne CDx', 'FoundationOne Liquid CDx', 'FoundationOne Tracker'],
      },
    ],
  },
  {
    name: 'GRAIL',
    id: 'grail',
    baseUrl: 'https://www.grail.com',
    pages: [
      {
        path: '/galleri/coverage',
        description: 'Galleri Coverage',
        type: 'coverage',
        testNames: ['Galleri'],
      },
    ],
  },
  {
    name: 'Exact Sciences',
    id: 'exactsciences',
    baseUrl: 'https://www.exactsciences.com',
    pages: [
      {
        path: '/providers/coverage-and-reimbursement',
        description: 'Provider Coverage & Reimbursement',
        type: 'coverage',
        testNames: ['Cologuard', 'Oncotype DX'],
      },
    ],
  },
  {
    name: 'Tempus',
    id: 'tempus',
    baseUrl: 'https://www.tempus.com',
    pages: [
      {
        path: '/coverage',
        description: 'Coverage Information',
        type: 'coverage',
        testNames: ['Tempus xT', 'Tempus xF', 'Tempus MRD'],
      },
    ],
  },
];

export class PayerCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.payers.name,
      source: SOURCES.PAYERS,
      description: config.crawlers.payers.description,
      rateLimit: config.crawlers.payers.rateLimit,
      enabled: config.crawlers.payers.enabled,
    });

    this.payers = PAYER_SOURCES;
    this.vendorCoverageSources = VENDOR_COVERAGE_SOURCES;
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
   * Fetch page content using Playwright with retry logic
   */
  async fetchPage(url, options = {}) {
    const { retries = MAX_RETRIES } = options;
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const browser = await this.launchBrowser();
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1920, height: 1080 },
      });

      const page = await context.newPage();

      try {
        if (attempt > 0) {
          // Exponential backoff for retries
          const backoffDelay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
          this.log('debug', `Retry attempt ${attempt} for ${url} (waiting ${backoffDelay}ms)`);
          await this.sleep(backoffDelay);
        }

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: PAGE_TIMEOUT_MS,
        });

        // Wait for dynamic content
        await this.sleep(2000);

        // Extract text content
        const content = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script, style, noscript');
          scripts.forEach((el) => el.remove());
          return document.body?.innerText || '';
        });

        // Extract policy-specific data
        const extractedData = await page.evaluate(() => {
          const data = {
            title: document.title,
            headings: [],
            policies: [],
            links: [],
            effectiveDates: [],
            lastUpdated: null,
            policyNumbers: [],
          };

          // Extract headings
          document.querySelectorAll('h1, h2, h3, h4').forEach((h) => {
            const text = h.innerText?.trim();
            if (text && text.length > 5 && text.length < 200) {
              data.headings.push(text);
              data.policies.push(text);
            }
          });

          // Extract links that look like policy documents
          document.querySelectorAll('a[href]').forEach((a) => {
            const href = a.getAttribute('href') || '';
            const text = a.innerText?.trim();
            if (
              (href.includes('policy') ||
                href.includes('bulletin') ||
                href.includes('coverage') ||
                href.includes('cpb') ||
                href.includes('.pdf')) &&
              text &&
              text.length > 5
            ) {
              data.links.push({
                text,
                href: href.startsWith('http') ? href : new URL(href, window.location.origin).href,
              });
            }
          });

          const bodyText = document.body?.innerText || '';

          // Look for effective date patterns
          const effectiveDatePatterns = [
            /effective\s*(?:date)?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
            /effective\s*(?:date)?[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
            /(?:effective|eff\.?)\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
          ];
          effectiveDatePatterns.forEach((pattern) => {
            const matches = bodyText.match(pattern) || [];
            data.effectiveDates.push(...matches.slice(0, 5));
          });

          // Look for last updated dates
          const updatedPatterns = [
            /(?:last\s+)?(?:updated|revised|modified)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
            /(?:last\s+)?(?:updated|revised|modified)[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
            /(?:revision|rev\.?)\s*date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
          ];
          updatedPatterns.forEach((pattern) => {
            const match = bodyText.match(pattern);
            if (match && !data.lastUpdated) {
              data.lastUpdated = match[0];
            }
          });

          // Look for policy numbers/IDs
          const policyPatterns = [
            /policy\s*(?:number|#|no\.?)?\s*[:\s]*([A-Z0-9\-]+)/gi,
            /CPB\s*#?\s*(\d+)/gi,
            /(?:med|medical)\s*policy\s*(?:#|number)?\s*([A-Z0-9\-\.]+)/gi,
          ];
          policyPatterns.forEach((pattern) => {
            const matches = bodyText.match(pattern) || [];
            data.policyNumbers.push(...matches.slice(0, 5));
          });

          return data;
        });

        await context.close();
        return { content, extractedData, url };
      } catch (error) {
        lastError = error;
        this.log('debug', `Attempt ${attempt + 1} failed for ${url}`, { error: error.message });
        await context.close();
      }
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
  }

  /**
   * Find relevant tests mentioned in content
   */
  findRelevantTests(content) {
    const contentLower = content.toLowerCase();
    const foundTests = new Set();

    // Check for test names
    for (const testName of ALL_TEST_NAMES) {
      if (contentLower.includes(testName.toLowerCase())) {
        foundTests.add(testName);
      }
    }

    // Check for vendor names
    for (const vendor of MONITORED_VENDORS) {
      if (contentLower.includes(vendor.toLowerCase())) {
        foundTests.add(vendor);
      }
    }

    return [...foundTests];
  }

  /**
   * Find matched keywords in content
   */
  findMatchedKeywords(content) {
    const contentLower = content.toLowerCase();
    return SEARCH_KEYWORDS.filter((keyword) => contentLower.includes(keyword.toLowerCase()));
  }

  /**
   * Detect change type based on content analysis
   */
  detectChangeType(content, extractedData, previousHash) {
    if (!previousHash) {
      return 'new_policy';
    }

    const contentLower = content.toLowerCase();
    const indicators = [...(extractedData.headings || []), extractedData.title || '']
      .join(' ')
      .toLowerCase();

    // Check for coverage-specific changes
    const coverageTerms = [
      'coverage',
      'covered',
      'not covered',
      'medical necessity',
      'prior authorization',
      'denied',
      'approved',
      'reimbursement',
    ];

    if (coverageTerms.some((term) => indicators.includes(term) || contentLower.includes(term))) {
      return 'coverage_change';
    }

    return 'policy_update';
  }

  /**
   * Get total number of pages to crawl
   */
  getTotalPages() {
    let total = 0;
    for (const payer of this.payers) {
      total += payer.policyIndexPages.length;
      total += (payer.policyPages || []).length;
    }
    for (const vendor of this.vendorCoverageSources) {
      total += vendor.pages.length;
    }
    return total;
  }

  /**
   * Main crawl implementation
   */
  async crawl() {
    const totalPages = this.getTotalPages();
    this.log(
      'info',
      `Starting payer crawl: ${this.payers.length} payers, ${this.vendorCoverageSources.length} vendors, ${totalPages} total pages`
    );

    await this.loadHashes();
    const discoveries = [];
    let pagesProcessed = 0;
    let pagesChanged = 0;
    let pagesFailed = 0;

    try {
      // Crawl payer policy index pages
      for (const payer of this.payers) {
        this.log('info', `Crawling payer: ${payer.name}`);

        // Crawl index pages
        for (const indexPage of payer.policyIndexPages) {
          try {
            if (pagesProcessed > 0) {
              await this.sleep(RATE_LIMIT_MS);
            }

            this.log('debug', `Fetching index: ${indexPage.url}`);
            const { content, extractedData } = await this.fetchPage(indexPage.url);

            const newHash = this.computeHash(content);
            const hashKey = `${payer.id}:index:${indexPage.url}`;
            const oldHash = this.hashes[hashKey];

            pagesProcessed++;

            const matchedKeywords = this.findMatchedKeywords(content);
            const relevantTests = this.findRelevantTests(content);
            const changeType = this.detectChangeType(content, extractedData, oldHash);

            if (newHash !== oldHash) {
              pagesChanged++;
              const isFirstCrawl = !oldHash;

              this.log('info', `Content ${isFirstCrawl ? 'captured' : 'changed'}: ${indexPage.url}`);

              this.hashes[hashKey] = newHash;

              if (!isFirstCrawl) {
                const indexDiscoveries = this.createDiscoveriesFromIndexChange(
                  payer,
                  indexPage,
                  { matchedKeywords, relevantTests, changeType },
                  extractedData
                );
                discoveries.push(...indexDiscoveries);
              }
            } else {
              this.log('debug', `No changes: ${indexPage.url}`);
            }
          } catch (error) {
            pagesFailed++;
            this.log('warn', `Failed to fetch ${indexPage.url}`, { error: error.message });
          }
        }

        // Crawl direct policy pages
        for (const policyPage of payer.policyPages || []) {
          const url = `${payer.baseUrl}${policyPage.path}`;
          try {
            if (pagesProcessed > 0) {
              await this.sleep(RATE_LIMIT_MS);
            }

            this.log('debug', `Fetching policy: ${url}`);
            const { content, extractedData } = await this.fetchPage(url);

            const newHash = this.computeHash(content);
            const hashKey = `${payer.id}:policy:${url}`;
            const oldHash = this.hashes[hashKey];

            pagesProcessed++;

            const matchedKeywords = this.findMatchedKeywords(content);
            const relevantTests = this.findRelevantTests(content);
            const changeType = this.detectChangeType(content, extractedData, oldHash);

            if (newHash !== oldHash) {
              pagesChanged++;
              const isFirstCrawl = !oldHash;

              this.log('info', `Content ${isFirstCrawl ? 'captured' : 'changed'}: ${url}`);

              this.hashes[hashKey] = newHash;

              if (!isFirstCrawl) {
                const discovery = this.createPolicyPageDiscovery(
                  payer,
                  policyPage,
                  url,
                  { matchedKeywords, relevantTests, changeType },
                  extractedData,
                  content
                );
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
          }
        }
      }

      // Crawl vendor coverage pages
      for (const vendor of this.vendorCoverageSources) {
        this.log('info', `Crawling vendor coverage: ${vendor.name}`);

        for (const page of vendor.pages) {
          const url = `${vendor.baseUrl}${page.path}`;

          try {
            if (pagesProcessed > 0) {
              await this.sleep(RATE_LIMIT_MS);
            }

            this.log('debug', `Fetching vendor coverage: ${url}`);
            const { content, extractedData } = await this.fetchPage(url);

            const newHash = this.computeHash(content);
            const hashKey = `vendor:${vendor.id}:${url}`;
            const oldHash = this.hashes[hashKey];

            pagesProcessed++;

            if (newHash !== oldHash) {
              pagesChanged++;
              const isFirstCrawl = !oldHash;

              this.log('info', `Content ${isFirstCrawl ? 'captured' : 'changed'}: ${url}`);

              this.hashes[hashKey] = newHash;

              if (!isFirstCrawl) {
                const discovery = this.createVendorCoverageDiscovery(vendor, page, url, extractedData, content);
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
          }
        }
      }
    } finally {
      await this.closeBrowser();
      await this.saveHashes();
    }

    this.log('info', 'Payer crawl complete', {
      pagesProcessed,
      pagesChanged,
      pagesFailed,
      discoveries: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Create discoveries from policy index page changes
   */
  createDiscoveriesFromIndexChange(payer, indexPage, analysisData, extractedData) {
    const discoveries = [];
    const { matchedKeywords, relevantTests, changeType } = analysisData;

    // Check for relevant policy links
    const relevantLinks = extractedData.links.filter((link) => {
      const textLower = link.text.toLowerCase();
      return (
        SEARCH_KEYWORDS.some((kw) => textLower.includes(kw.toLowerCase())) ||
        ALL_TEST_NAMES.some((test) => textLower.includes(test.toLowerCase())) ||
        textLower.includes('molecular') ||
        textLower.includes('genetic') ||
        textLower.includes('oncology') ||
        textLower.includes('tumor') ||
        textLower.includes('genomic')
      );
    });

    if (relevantLinks.length > 0) {
      // Create individual discoveries for relevant policy links
      for (const link of relevantLinks.slice(0, 10)) {
        const discovery = this.createPolicyLinkDiscovery(payer, link, analysisData, extractedData);
        if (discovery) {
          discoveries.push(discovery);
        }
      }
    } else {
      // Create general page change discovery
      // Map internal changeType to spec format
      let specChangeType = 'unknown';
      if (changeType === 'new_policy') {
        specChangeType = 'new';
      } else if (changeType === 'policy_update' || changeType === 'coverage_change') {
        specChangeType = 'revision';
      }

      discoveries.push({
        source: SOURCES.PAYERS,
        type: this.getDiscoveryType(changeType),
        title: `${payer.name}: ${indexPage.description} Updated`,
        summary: this.generateChangeSummary(payer, indexPage, analysisData, extractedData),
        url: indexPage.url,
        relevance: this.calculateRelevance(analysisData),
        metadata: {
          // Spec-required fields
          payer: payer.name,
          policyId: extractedData.policyNumbers?.[0] || null,
          policyTitle: indexPage.description,
          effectiveDate: extractedData.effectiveDates?.[0] || null,
          changeType: specChangeType,
          snippet: null, // Index pages don't have meaningful snippets
          matchedKeywords,
          // Additional useful fields
          payerId: payer.id,
          lastUpdated: extractedData.lastUpdated || null,
          relevantTests,
        },
      });
    }

    return discoveries;
  }

  /**
   * Create discovery from a specific policy link
   */
  createPolicyLinkDiscovery(payer, link, analysisData, extractedData) {
    const { matchedKeywords, relevantTests, changeType } = analysisData;
    const isNew = link.text.toLowerCase().includes('new');
    const type = isNew ? DISCOVERY_TYPES.PAYER_POLICY_NEW : this.getDiscoveryType(changeType);

    // Extract policy ID from URL if present
    const policyIdMatch = link.href.match(/(?:policy|bulletin|cpb|document)[_\-]?(?:id)?[=\/]?(\d+)/i);
    const policyId = policyIdMatch ? policyIdMatch[1] : null;

    // Map to spec changeType format
    const specChangeType = isNew ? 'new' : (changeType === 'policy_update' ? 'revision' : 'unknown');

    return {
      source: SOURCES.PAYERS,
      type,
      title: `${payer.name}: ${link.text}`,
      summary: `${payer.name} policy ${isNew ? 'published' : 'updated'}. ${
        extractedData.effectiveDates?.[0] ? `Effective: ${extractedData.effectiveDates[0]}` : ''
      }`.trim(),
      url: link.href,
      relevance: this.calculateRelevanceFromText(link.text),
      metadata: {
        // Spec-required fields
        payer: payer.name,
        policyId,
        policyTitle: link.text,
        effectiveDate: extractedData.effectiveDates?.[0] || null,
        changeType: specChangeType,
        snippet: null,
        matchedKeywords,
        // Additional useful fields
        payerId: payer.id,
        relevantTests,
      },
    };
  }

  /**
   * Create discovery from direct policy page change
   *
   * Discovery structure follows the spec:
   * {
   *   type: 'payer_policy_new' | 'payer_policy_changed',
   *   payer: 'UnitedHealthcare',
   *   policyId: 'T0593.24',
   *   policyTitle: 'Cell-Free DNA Testing for Cancer',
   *   url: 'https://...',
   *   effectiveDate: '2025-02-01',
   *   changeType: 'new' | 'revision' | 'unknown',
   *   snippet: '...first 500 chars of content...',
   *   matchedKeywords: ['ctDNA', 'MRD'],
   * }
   */
  createPolicyPageDiscovery(payer, policyPage, url, analysisData, extractedData, content = '') {
    const { matchedKeywords, relevantTests, changeType } = analysisData;
    const snippet = this.extractSnippet(content, matchedKeywords.length > 0 ? matchedKeywords : SEARCH_KEYWORDS, 500);

    // Map internal changeType to spec format
    let specChangeType = 'unknown';
    if (changeType === 'new_policy') {
      specChangeType = 'new';
    } else if (changeType === 'policy_update' || changeType === 'coverage_change') {
      specChangeType = 'revision';
    }

    return {
      source: SOURCES.PAYERS,
      type: this.getDiscoveryType(changeType),
      title: `${payer.name}: ${policyPage.description} Updated`,
      summary: this.generateChangeSummary(payer, policyPage, analysisData, extractedData),
      url,
      relevance: this.calculateRelevance(analysisData),
      metadata: {
        // Spec-required fields
        payer: payer.name,
        policyId: extractedData.policyNumbers?.[0] || null,
        policyTitle: policyPage.description,
        effectiveDate: extractedData.effectiveDates?.[0] || null,
        changeType: specChangeType,
        snippet,
        matchedKeywords,
        // Additional useful fields
        payerId: payer.id,
        lastUpdated: extractedData.lastUpdated || null,
        relevantTests,
      },
    };
  }

  /**
   * Create discovery from vendor coverage page change
   */
  createVendorCoverageDiscovery(vendor, page, url, extractedData, content = '') {
    // Use page-defined test names if available, otherwise try to find them
    const relevantTests = page.testNames || this.findRelevantTests(extractedData.title || content);
    const snippet = this.extractSnippet(content, SEARCH_KEYWORDS, 500);

    return {
      source: SOURCES.PAYERS,
      type: DISCOVERY_TYPES.COVERAGE_CHANGE,
      title: `${vendor.name}: ${page.description} Updated`,
      summary: `Coverage/reimbursement information updated on ${vendor.name} website. ${
        relevantTests.length > 0 ? `Tests: ${relevantTests.join(', ')}` : ''
      }`.trim(),
      url,
      relevance: 'high', // Vendor coverage updates are always high relevance
      metadata: {
        // Use 'payer' field for consistency (vendor acts as source here)
        payer: vendor.name,
        policyId: null, // Vendor pages don't have policy IDs
        policyTitle: page.description,
        effectiveDate: extractedData.effectiveDates?.[0] || null,
        changeType: 'revision', // Vendor coverage pages are always revisions (we saw them before)
        snippet,
        matchedKeywords: this.findMatchedKeywords(content),
        // Additional fields
        vendorId: vendor.id,
        lastUpdated: extractedData.lastUpdated || null,
        relevantTests,
        pageType: 'vendor_coverage',
      },
    };
  }

  /**
   * Extract a relevant snippet from content around keywords
   * @param {string} content - Full content text
   * @param {string[]} keywords - Keywords to search for context
   * @param {number} maxLength - Maximum snippet length (default 500 per spec)
   */
  extractSnippet(content, keywords = SEARCH_KEYWORDS, maxLength = 500) {
    if (!content) return null;

    const lowerContent = content.toLowerCase();

    for (const keyword of keywords) {
      const index = lowerContent.indexOf(keyword.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + maxLength);
        let snippet = content.slice(start, end).trim();

        // Clean up the snippet
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';

        return snippet.replace(/\s+/g, ' ');
      }
    }

    // Fallback: return first part of content
    if (content.length > maxLength) {
      return content.slice(0, maxLength).trim().replace(/\s+/g, ' ') + '...';
    }
    return content.trim().replace(/\s+/g, ' ');
  }

  /**
   * Get discovery type from change type
   */
  getDiscoveryType(changeType) {
    switch (changeType) {
      case 'new_policy':
        return DISCOVERY_TYPES.PAYER_POLICY_NEW;
      case 'coverage_change':
        return DISCOVERY_TYPES.COVERAGE_CHANGE;
      case 'policy_update':
      default:
        return DISCOVERY_TYPES.PAYER_POLICY_UPDATE;
    }
  }

  /**
   * Generate summary for discovery
   */
  generateChangeSummary(payer, page, analysisData, extractedData) {
    const { matchedKeywords, relevantTests, changeType } = analysisData;
    const parts = [];

    if (changeType === 'new_policy') {
      parts.push(`New policy detected from ${payer.name}`);
    } else if (changeType === 'coverage_change') {
      parts.push(`Coverage policy updated by ${payer.name}`);
    } else {
      parts.push(`Policy update detected from ${payer.name}`);
    }

    if (extractedData.effectiveDates?.length > 0) {
      parts.push(`Effective: ${extractedData.effectiveDates[0]}`);
    }

    if (relevantTests.length > 0) {
      parts.push(`Relevant tests: ${relevantTests.slice(0, 3).join(', ')}`);
    }

    if (matchedKeywords.length > 0 && relevantTests.length === 0) {
      parts.push(`Keywords: ${matchedKeywords.slice(0, 3).join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * Calculate relevance based on analysis data
   */
  calculateRelevance(analysisData) {
    const { matchedKeywords, relevantTests, changeType } = analysisData;

    // Coverage changes are high relevance
    if (changeType === 'coverage_change') {
      return 'high';
    }

    // New policies are high relevance
    if (changeType === 'new_policy') {
      return 'high';
    }

    // Mentions of specific tests = high relevance
    if (relevantTests.length > 0) {
      return 'high';
    }

    // High-priority keywords
    const highKeywords = ['mrd', 'ctdna', 'liquid biopsy', 'circulating tumor', 'minimal residual'];
    if (matchedKeywords.some((kw) => highKeywords.some((hk) => kw.toLowerCase().includes(hk)))) {
      return 'high';
    }

    // Any matched keywords = medium
    if (matchedKeywords.length > 0) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Calculate relevance from text content
   */
  calculateRelevanceFromText(text) {
    const lowerText = text.toLowerCase();

    const highTerms = [
      'mrd',
      'ctdna',
      'liquid biopsy',
      'circulating tumor',
      'signatera',
      'guardant',
      'foundationone',
      'minimal residual',
      'galleri',
      'clonosq',
    ];

    if (highTerms.some((term) => lowerText.includes(term))) {
      return 'high';
    }

    const mediumTerms = [
      'molecular',
      'genomic',
      'genetic testing',
      'oncology',
      'tumor marker',
      'ngs',
      'next-generation',
      'comprehensive genomic',
    ];

    if (mediumTerms.some((term) => lowerText.includes(term))) {
      return 'medium';
    }

    return 'low';
  }
}

// Export constants for testing
export { PAYER_SOURCES, VENDOR_COVERAGE_SOURCES, SEARCH_KEYWORDS };

export default PayerCrawler;
