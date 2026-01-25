/**
 * Citations Validator Crawler
 * Audits the OpenOnco database for missing citations and validates existing citation URLs
 *
 * Two main functions:
 * - auditMissingCitations(): Find fields with values but no citations
 * - checkUrlLiveness(): Validate all citation URLs
 *
 * Checks:
 * 1. Missing citations on key performance fields (sensitivity, specificity, ppv, npv, lod, etc.)
 * 2. Broken URLs (4xx/5xx HTTP status codes)
 * 3. Redirected URLs (3xx status codes - may indicate stale links)
 * 4. Invalid PMIDs (validates against PubMed eutils API)
 *
 * Discovery structure:
 * {
 *   type: 'missing_citation' | 'broken_url' | 'redirect_url' | 'invalid_pmid',
 *   testId: 'mrd-1',
 *   testName: 'Signatera',
 *   vendor: 'Natera',
 *   category: 'mrd',
 *   field: 'sensitivity',
 *   value: '97.2%',        // for missing_citation
 *   url: 'https://...',    // for URL issues
 *   httpStatus: 404,       // for broken_url
 *   redirectUrl: 'https://...', // for redirect_url
 *   error: 'PMID not found'     // for invalid_pmid
 * }
 *
 * Rate limit: 2 requests/second for URL checks
 */

import { BaseCrawler } from './base.js';
import { config, SOURCES, DISCOVERY_TYPES } from '../config.js';
import { createHttpClient } from '../utils/http.js';

// Rate limit: 2 requests per second max (500ms between requests)
const URL_CHECK_DELAY_MS = 500;

// Rate limit delay for PubMed API (they request max 3 req/sec without API key)
const PUBMED_DELAY_MS = 400;

// Timeout for URL checks
const URL_TIMEOUT_MS = 15000;

// User agent for URL checks
const USER_AGENT = 'Mozilla/5.0 (compatible; OpenOncoBot/1.0; +https://openonco.org)';

// PubMed API base URL
const PUBMED_API_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

// Tier 1 fields that MUST have citations when they have values
// These are the clinically critical metrics that patients/clinicians rely on
const MUST_HAVE_CITATIONS = [
  'sensitivity',
  'specificity',
  'ppv',
  'npv',
  'lod',
  'lod95',
  'clinicalSensitivity',
  'analyticalSensitivity',
  'stageISensitivity',
  'stageIISensitivity',
  'stageIIISensitivity',
  'stageIVSensitivity',
  'landmarkSensitivity',
  'landmarkSpecificity',
  'longitudinalSensitivity',
  'longitudinalSpecificity',
  'advancedAdenomaSensitivity',
  'leadTimeVsImaging',
];

// Tier 2 fields that SHOULD have citations (nice to have, lower priority)
const NICE_TO_HAVE_CITATIONS = [
  'tat',
  'initialTat',
  'followUpTat',
  'listPrice',
  'genesAnalyzed',
  'bloodVolume',
  'variantsTracked',
];

// Combined list for iteration
const CITATION_REQUIRED_FIELDS = [...MUST_HAVE_CITATIONS, ...NICE_TO_HAVE_CITATIONS];

// Map of field to its citation field name (auto-generated from field list)
const CITATION_FIELD_MAP = {};
for (const field of CITATION_REQUIRED_FIELDS) {
  CITATION_FIELD_MAP[field] = `${field}Citations`;
}

// Soft 404 patterns - pages that return 200 but indicate content not found
const SOFT_404_PATTERNS = [
  /page\s*not\s*found/i,
  /404\s*error/i,
  /content\s*not\s*available/i,
  /no\s*longer\s*available/i,
  /this\s*page\s*doesn['']?t\s*exist/i,
  /the\s*requested\s*page\s*could\s*not\s*be\s*found/i,
  /we\s*couldn['']?t\s*find\s*the\s*page/i,
  /sorry,\s*we\s*can['']?t\s*find\s*that\s*page/i,
];

// Category ID to readable name mapping
const CATEGORY_NAMES = {
  mrd: 'Molecular Residual Disease',
  ecd: 'Early Cancer Detection',
  tds: 'Treatment Decision Support',
  trm: 'Treatment Response Monitoring',
  hct: 'Hereditary Cancer Testing',
};

// Vendor domain mappings for search suggestions
const VENDOR_DOMAINS = {
  'Natera': 'natera.com',
  'Guardant Health': 'guardanthealth.com',
  'Foundation Medicine': 'foundationmedicine.com',
  'GRAIL': 'grail.com',
  'Exact Sciences': 'exactsciences.com',
  'Tempus': 'tempus.com',
  'Caris Life Sciences': 'carismolecularintelligence.com',
  'Myriad Genetics': 'myriad.com',
  'Labcorp': 'labcorp.com',
  'Quest Diagnostics': 'questdiagnostics.com',
  'Adaptive Biotechnologies': 'adaptivebiotech.com',
  'NeoGenomics': 'neogenomics.com',
  'Burning Rock Dx': 'brbiotech.com',
  'Personalis': 'personalis.com',
  'Resolution Bioscience': 'resolutionbio.com',
};

export class CitationsCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers?.citations?.name || 'Citations Validator',
      source: SOURCES.CITATIONS,
      description:
        config.crawlers?.citations?.description ||
        'Validates database citations for completeness and accessibility',
      rateLimit: config.crawlers?.citations?.rateLimit || 2,
      enabled: config.crawlers?.citations?.enabled !== false,
    });

    this.testData = null;
    this.checkedUrls = new Map(); // Cache URL check results

    // Create HTTP client with rate limiting (500ms = 2 req/sec)
    this.httpClient = createHttpClient('citations', {
      rateLimitMs: URL_CHECK_DELAY_MS,
      timeout: URL_TIMEOUT_MS,
      retries: 2,
      userAgent: USER_AGENT,
    });
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Load test data from the main V0 project using dynamic import
   */
  async loadTestData() {
    try {
      // Dynamic import of the data file
      // Path: daemon/src/crawlers/ -> daemon/src/ -> daemon/ -> project root -> src/data.js
      const dataModule = await import('../../../src/data.js');

      this.testData = {
        mrd: dataModule.mrdTestData || [],
        ecd: dataModule.ecdTestData || [],
        trm: dataModule.trmTestData || [],
        tds: dataModule.tdsTestData || [],
        hct: dataModule.hctTestData || [],
      };

      const totalTests = Object.values(this.testData).reduce(
        (sum, arr) => sum + arr.length,
        0
      );

      this.log('info', `Loaded ${totalTests} tests from database`, {
        mrd: this.testData.mrd.length,
        ecd: this.testData.ecd.length,
        trm: this.testData.trm.length,
        tds: this.testData.tds.length,
        hct: this.testData.hct.length,
      });

      return true;
    } catch (error) {
      this.log('error', 'Failed to load test data', { error: error.message });
      throw new Error(`Failed to load test data: ${error.message}`);
    }
  }

  /**
   * Check if a value is meaningful (not null, undefined, empty)
   */
  hasValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (typeof value === 'number') return true;
    return Boolean(value);
  }

  /**
   * Extract all URLs from a citation string
   * Citations may contain multiple URLs separated by ' | '
   */
  extractUrls(citationString) {
    if (!citationString || typeof citationString !== 'string') {
      return [];
    }

    const urls = [];
    // Split by pipe separator used in the data
    const parts = citationString.split(/\s*\|\s*/);

    for (const part of parts) {
      const trimmed = part.trim();
      // Check if it's a URL
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        urls.push(trimmed);
      }
      // Check if it looks like a DOI without https prefix
      else if (trimmed.match(/^10\.\d+\//)) {
        urls.push(`https://doi.org/${trimmed}`);
      }
      // Check if it looks like a bare PMID
      else if (/^\d{7,8}$/.test(trimmed)) {
        urls.push(`https://pubmed.ncbi.nlm.nih.gov/${trimmed}/`);
      }
    }

    return urls;
  }

  /**
   * Extract PMID from a URL
   */
  extractPmid(url) {
    if (!url) return null;

    // Match pubmed.ncbi.nlm.nih.gov/12345678
    const match = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
    if (match) return match[1];

    // Match ncbi.nlm.nih.gov/pubmed/12345678
    const altMatch = url.match(/ncbi\.nlm\.nih\.gov\/pubmed\/(\d+)/);
    if (altMatch) return altMatch[1];

    return null;
  }

  /**
   * Validate a PMID via PubMed eutils API
   * Uses the http utility for rate-limited requests
   */
  async validatePmid(pmid) {
    try {
      const url = `${PUBMED_API_BASE}/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;

      // Use the http client for rate-limited request
      const data = await this.httpClient.getJson(url);

      // Check if the PMID exists in the result
      if (data.result && data.result[pmid]) {
        const article = data.result[pmid];
        // Check for error in the article data
        if (article.error) {
          return { valid: false, error: article.error };
        }
        return {
          valid: true,
          title: article.title,
          authors: article.authors?.[0]?.name,
          pubDate: article.pubdate,
        };
      }

      return { valid: false, error: 'PMID not found' };
    } catch (error) {
      // Check for HTTP errors
      if (error.response) {
        return { valid: false, error: `HTTP ${error.response.status}` };
      }
      return { valid: false, error: error.message };
    }
  }

  /**
   * Check URL liveness with soft 404 detection
   * Handles DOI URLs specially by following redirects
   * Uses the http utility for rate-limited requests
   */
  async checkUrl(url) {
    // Return cached result if available
    if (this.checkedUrls.has(url)) {
      return this.checkedUrls.get(url);
    }

    // Handle DOI URLs specially - they always redirect
    if (url.includes('doi.org')) {
      return this.checkDoiUrl(url);
    }

    try {
      // Try HEAD request first using the http client
      const response = await this.httpClient.get(url, {
        method: 'HEAD',
        maxRedirects: 0, // Don't follow redirects automatically
        validateStatus: () => true, // Accept all status codes
      });

      const status = response.status;
      let bodyText = null;

      // If HEAD fails with 405 Method Not Allowed, or we got 200 and need soft 404 check
      if (status === 405 || status === 200) {
        try {
          // Make a GET request to check for soft 404s
          const getResponse = await this.httpClient.get(url, {
            maxRedirects: 0,
            validateStatus: () => true,
          });

          if (status === 405) {
            // Use GET response status if HEAD wasn't allowed
            const getStatus = getResponse.status;
            let result = {
              status: getStatus,
              ok: getStatus >= 200 && getStatus < 300,
              redirected: getStatus >= 300 && getStatus < 400,
              redirectUrl: getResponse.headers?.location,
            };
            this.checkedUrls.set(url, result);
            return result;
          }

          // Only read body for soft 404 detection on 200 responses
          if (getResponse.status === 200 && getResponse.data) {
            bodyText = typeof getResponse.data === 'string'
              ? getResponse.data
              : JSON.stringify(getResponse.data);
          }
        } catch {
          // Ignore body read errors
        }
      }

      let result = {
        status,
        ok: status >= 200 && status < 300,
        redirected: status >= 300 && status < 400,
        redirectUrl: response.headers?.location,
      };

      // Check for soft 404s (200 OK but content indicates not found)
      if (result.ok && bodyText) {
        // Only check first 10KB to avoid processing huge pages
        const sample = bodyText.substring(0, 10000);
        for (const pattern of SOFT_404_PATTERNS) {
          if (pattern.test(sample)) {
            result = {
              ...result,
              ok: false,
              softError: true,
              error: 'Soft 404: Page returns 200 but appears to be a not-found page',
            };
            break;
          }
        }
      }

      this.checkedUrls.set(url, result);
      return result;
    } catch (error) {
      const result = {
        status: error.response?.status || 0,
        ok: false,
        error: error.code === 'ECONNABORTED' ? 'timeout' : error.message,
      };
      this.checkedUrls.set(url, result);
      return result;
    }
  }

  /**
   * Check DOI URL by following redirect to final destination
   * DOI URLs always redirect to the publisher, so we follow the chain
   * Uses the http utility for rate-limited requests
   */
  async checkDoiUrl(url) {
    try {
      // Follow redirects to final destination using the http client
      // axios follows redirects by default
      const response = await this.httpClient.get(url, {
        validateStatus: () => true, // Accept all status codes
      });

      const status = response.status;

      let result;
      if (status >= 200 && status < 300) {
        result = { status, ok: true, redirected: false };
      } else if (status >= 300 && status < 400) {
        // Incomplete redirect chain
        result = {
          status,
          ok: false,
          redirected: true,
          redirectUrl: response.headers?.location,
          error: `DOI redirect chain incomplete (${status})`,
        };
      } else {
        result = {
          status,
          ok: false,
          redirected: false,
          error: `DOI resolution failed with HTTP ${status}`,
        };
      }

      this.checkedUrls.set(url, result);
      return result;
    } catch (error) {
      const result = {
        status: error.response?.status || 0,
        ok: false,
        error: error.code === 'ECONNABORTED' ? 'DOI timeout' : `DOI resolution failed: ${error.message}`,
      };
      this.checkedUrls.set(url, result);
      return result;
    }
  }

  /**
   * Audit a single test for citation issues
   */
  async auditTest(test, category) {
    const discoveries = [];
    const testContext = {
      testId: test.id,
      testName: test.name,
      vendor: test.vendor,
      category: category.toUpperCase(),
    };

    // Check each field that requires citations
    for (const field of CITATION_REQUIRED_FIELDS) {
      const value = test[field];
      const citationField = CITATION_FIELD_MAP[field];
      const citationValue = test[citationField];

      // Skip if the field has no value
      if (!this.hasValue(value)) {
        continue;
      }

      // Check for missing citation
      if (!this.hasValue(citationValue)) {
        // Determine relevance based on field priority
        const relevance = MUST_HAVE_CITATIONS.includes(field) ? 'high' : 'medium';
        const categoryName = CATEGORY_NAMES[category] || category.toUpperCase();

        discoveries.push({
          source: SOURCES.CITATIONS,
          type: DISCOVERY_TYPES.MISSING_CITATION,
          title: `Missing citation: ${test.name} - ${field}`,
          summary: `${categoryName} test "${test.name}" by ${test.vendor} has ${field}=${value} but no citation.`,
          url: null,
          relevance,
          metadata: {
            ...testContext,
            categoryName,
            field,
            currentValue: value,
            citationField,
            issueType: 'missing_citation',
            suggestedSearches: this.generateSearchSuggestions(test, field),
          },
        });
        continue;
      }

      // Extract and validate URLs from citation
      const urls = this.extractUrls(citationValue);

      if (urls.length === 0) {
        // Citation exists but contains no valid URLs (might be a text reference)
        this.log('debug', `Citation has no extractable URLs: ${citationValue.substring(0, 100)}`);
        continue;
      }

      // Check each URL
      for (const url of urls) {
        await this.sleep(URL_CHECK_DELAY_MS);

        // Check for PubMed URLs - validate PMID
        const pmid = this.extractPmid(url);
        if (pmid) {
          await this.sleep(PUBMED_DELAY_MS);
          const pmidResult = await this.validatePmid(pmid);

          if (!pmidResult.valid) {
            const categoryName = CATEGORY_NAMES[category] || category.toUpperCase();
            discoveries.push({
              source: SOURCES.CITATIONS,
              type: DISCOVERY_TYPES.BROKEN_CITATION,
              title: `Invalid PMID: ${test.name} - ${field}`,
              summary: `${categoryName} test "${test.name}": PMID ${pmid} is invalid (${pmidResult.error})`,
              url,
              relevance: 'high',
              metadata: {
                ...testContext,
                categoryName,
                field,
                currentValue: value,
                citationField,
                pmid,
                httpStatus: null,
                issueType: 'invalid_pmid',
                error: pmidResult.error,
                suggestedSearches: this.generateSearchSuggestions(test, field),
              },
            });
          }
          continue; // Skip regular URL check for PubMed URLs
        }

        // Check URL liveness for non-PubMed URLs
        const urlResult = await this.checkUrl(url);

        const categoryName = CATEGORY_NAMES[category] || category.toUpperCase();

        if (!urlResult.ok && !urlResult.redirected) {
          // Broken URL (including soft 404s)
          const errorMsg = urlResult.softError
            ? 'soft 404 (page not found content)'
            : urlResult.status
              ? `HTTP ${urlResult.status}`
              : urlResult.error;

          discoveries.push({
            source: SOURCES.CITATIONS,
            type: DISCOVERY_TYPES.BROKEN_CITATION,
            title: `Broken URL: ${test.name} - ${field}`,
            summary: `${categoryName} test "${test.name}": Citation URL returns ${errorMsg}`,
            url,
            relevance: 'high',
            metadata: {
              ...testContext,
              categoryName,
              field,
              currentValue: value,
              citationField,
              httpStatus: urlResult.status,
              issueType: 'broken_url',
              error: urlResult.error,
              softError: urlResult.softError || false,
              suggestedSearches: this.generateSearchSuggestions(test, field),
            },
          });
        } else if (urlResult.redirected) {
          // Redirected URL - may be stale
          discoveries.push({
            source: SOURCES.CITATIONS,
            type: DISCOVERY_TYPES.BROKEN_CITATION,
            title: `Redirected URL: ${test.name} - ${field}`,
            summary: `${categoryName} test "${test.name}": Citation URL redirects (${urlResult.status}) to ${urlResult.redirectUrl || 'unknown'}`,
            url,
            relevance: 'medium',
            metadata: {
              ...testContext,
              categoryName,
              field,
              currentValue: value,
              citationField,
              httpStatus: urlResult.status,
              redirectUrl: urlResult.redirectUrl,
              issueType: 'redirect_url',
              suggestedSearches: this.generateSearchSuggestions(test, field),
            },
          });
        }
      }
    }

    return discoveries;
  }

  /**
   * Main crawl implementation - runs both audits
   */
  async crawl() {
    this.log('info', 'Starting citations validation crawl');
    this.checkedUrls.clear();

    // Load test data
    await this.loadTestData();

    const discoveries = [];

    // Run missing citations audit
    this.log('info', 'Starting missing citations audit');
    const missingCitationDiscoveries = await this.auditMissingCitations();
    discoveries.push(...missingCitationDiscoveries);
    this.log('info', `Found ${missingCitationDiscoveries.length} missing citations`);

    // Run URL liveness check
    this.log('info', 'Starting URL liveness check');
    const urlDiscoveries = await this.checkUrlLiveness();
    discoveries.push(...urlDiscoveries);
    this.log('info', `Found ${urlDiscoveries.length} URL issues`);

    // Summary stats
    const stats = {
      totalDiscoveries: discoveries.length,
      missingCitations: missingCitationDiscoveries.length,
      brokenUrls: urlDiscoveries.filter((d) => d.metadata?.issueType === 'broken_url').length,
      invalidPmids: urlDiscoveries.filter((d) => d.metadata?.issueType === 'invalid_pmid').length,
      redirectedUrls: urlDiscoveries.filter((d) => d.metadata?.issueType === 'redirect_url').length,
    };

    this.log('info', 'Citations validation complete', stats);

    // Clear URL cache
    this.checkedUrls.clear();

    return discoveries;
  }

  /**
   * Audit for missing citations - find fields with values but no citations
   * @returns {Array} Array of discovery objects for missing citations
   */
  async auditMissingCitations() {
    const discoveries = [];

    for (const [category, tests] of Object.entries(this.testData)) {
      for (const test of tests) {
        const categoryName = CATEGORY_NAMES[category] || category.toUpperCase();
        const testContext = {
          testId: test.id,
          testName: test.name,
          vendor: test.vendor,
          category: category,
        };

        for (const field of CITATION_REQUIRED_FIELDS) {
          const value = test[field];
          const citationField = CITATION_FIELD_MAP[field];
          const citationValue = test[citationField];

          // Skip if the field has no value
          if (!this.hasValue(value)) {
            continue;
          }

          // Check for missing citation
          if (!this.hasValue(citationValue)) {
            const relevance = MUST_HAVE_CITATIONS.includes(field) ? 'high' : 'medium';

            // Flat discovery structure per specification
            discoveries.push({
              // Core identification
              source: SOURCES.CITATIONS,
              type: DISCOVERY_TYPES.MISSING_CITATION,

              // Test identification (flat structure per spec)
              testId: test.id,
              testName: test.name,
              vendor: test.vendor,
              category,
              field,

              // Value for missing_citation type
              value: this.formatValue(value),

              // URL fields (null for missing_citation)
              url: null,
              httpStatus: null,
              redirectUrl: null,
              error: null,

              // Additional context
              title: `Missing citation: ${test.name} - ${field}`,
              summary: `${categoryName} test "${test.name}" by ${test.vendor} has ${field}=${value} but no citation.`,
              relevance,

              // Metadata for additional context
              metadata: {
                categoryName,
                citationField,
                issueType: 'missing_citation',
                suggestedSearch: this.generatePubMedSearchUrl(test, field),
                suggestedSearches: this.generateSearchSuggestions(test, field),
              },
            });
          }
        }
      }
    }

    return discoveries;
  }

  /**
   * Check URL liveness for all citation URLs in the database
   * @returns {Array} Array of discovery objects for URL issues
   */
  async checkUrlLiveness() {
    const discoveries = [];
    let urlsChecked = 0;

    for (const [category, tests] of Object.entries(this.testData)) {
      for (const test of tests) {
        const categoryName = CATEGORY_NAMES[category] || category.toUpperCase();
        const testContext = {
          testId: test.id,
          testName: test.name,
          vendor: test.vendor,
          category: category,
        };

        // Check each citation field
        for (const field of CITATION_REQUIRED_FIELDS) {
          const citationField = CITATION_FIELD_MAP[field];
          const citationValue = test[citationField];

          if (!this.hasValue(citationValue)) continue;

          // Extract and validate URLs from citation
          const urls = this.extractUrls(citationValue);

          for (const url of urls) {
            // Skip if already checked (de-dupe)
            if (this.checkedUrls.has(url)) {
              const cached = this.checkedUrls.get(url);
              if (cached.issue) {
                discoveries.push(this.createUrlDiscovery(cached, url, test, field, categoryName, testContext));
              }
              continue;
            }

            try {
              // Rate limit
              await this.sleep(URL_CHECK_DELAY_MS);

              // Check for PubMed URLs - validate PMID
              const pmid = this.extractPmid(url);
              if (pmid) {
                await this.sleep(PUBMED_DELAY_MS);
                const pmidResult = await this.validatePmid(pmid);

                if (!pmidResult.valid) {
                  const result = {
                    issue: true,
                    issueType: 'invalid_pmid',
                    pmid,
                    error: pmidResult.error,
                  };
                  this.checkedUrls.set(url, result);
                  discoveries.push(this.createUrlDiscovery(result, url, test, field, categoryName, testContext));
                } else {
                  this.checkedUrls.set(url, { issue: false });
                }
                continue;
              }

              // Check URL liveness for non-PubMed URLs
              const urlResult = await this.checkUrl(url);

              if (!urlResult.ok && !urlResult.redirected) {
                const result = {
                  issue: true,
                  issueType: 'broken_url',
                  httpStatus: urlResult.status,
                  error: urlResult.softError
                    ? 'soft 404 (page not found content)'
                    : urlResult.error || `HTTP ${urlResult.status}`,
                  softError: urlResult.softError,
                };
                this.checkedUrls.set(url, result);
                discoveries.push(this.createUrlDiscovery(result, url, test, field, categoryName, testContext));
              } else if (urlResult.redirected) {
                const result = {
                  issue: true,
                  issueType: 'redirect_url',
                  httpStatus: urlResult.status,
                  redirectUrl: urlResult.redirectUrl,
                };
                this.checkedUrls.set(url, result);
                discoveries.push(this.createUrlDiscovery(result, url, test, field, categoryName, testContext));
              } else {
                this.checkedUrls.set(url, { issue: false });
              }

              urlsChecked++;

              // Log progress every 100 URLs
              if (urlsChecked % 100 === 0) {
                this.log('info', `URL check progress: ${urlsChecked} URLs checked`);
              }
            } catch (error) {
              this.log('warn', `Error checking URL ${url}`, { error: error.message });
              const result = {
                issue: true,
                issueType: 'broken_url',
                error: error.message,
              };
              this.checkedUrls.set(url, result);
              discoveries.push(this.createUrlDiscovery(result, url, test, field, categoryName, testContext));
            }
          }
        }
      }
    }

    return discoveries;
  }

  /**
   * Create a discovery object for URL issues
   * Returns flat structure matching the specification:
   * {
   *   type: 'missing_citation' | 'broken_url' | 'redirect_url' | 'invalid_pmid',
   *   testId, testName, vendor, category, field, url, httpStatus, redirectUrl, error
   * }
   */
  createUrlDiscovery(result, url, test, field, categoryName, testContext) {
    const typeMap = {
      broken_url: DISCOVERY_TYPES.BROKEN_URL,
      invalid_pmid: DISCOVERY_TYPES.INVALID_PMID,
      redirect_url: DISCOVERY_TYPES.REDIRECT_URL,
    };

    // Build flat discovery object matching the specification
    const discovery = {
      // Core identification
      source: SOURCES.CITATIONS,
      type: typeMap[result.issueType] || DISCOVERY_TYPES.BROKEN_URL,

      // Test identification (flat structure per spec)
      testId: test.id,
      testName: test.name,
      vendor: test.vendor,
      category: testContext.category,
      field,

      // URL info
      url,

      // Type-specific fields
      httpStatus: result.httpStatus || null,
      redirectUrl: result.redirectUrl || null,
      error: result.error || null,

      // Additional context for processing
      title: this.getDiscoveryTitle(result.issueType, test, field),
      summary: this.getDiscoverySummary(result, test, field, categoryName),
      relevance: result.issueType === 'redirect_url' ? 'medium' : 'high',

      // Metadata for additional context (preserves backwards compatibility)
      metadata: {
        categoryName,
        citationField: CITATION_FIELD_MAP[field],
        issueType: result.issueType,
        softError: result.softError || false,
        pmid: result.pmid || null,
        suggestedSearch: this.generatePubMedSearchUrl(test, field),
        suggestedSearches: this.generateSearchSuggestions(test, field),
      },
    };

    return discovery;
  }

  /**
   * Get discovery title based on issue type
   */
  getDiscoveryTitle(issueType, test, field) {
    const titleMap = {
      broken_url: `Broken URL: ${test.name} - ${field}`,
      invalid_pmid: `Invalid PMID: ${test.name} - ${field}`,
      redirect_url: `Redirected URL: ${test.name} - ${field}`,
    };
    return titleMap[issueType] || `URL Issue: ${test.name} - ${field}`;
  }

  /**
   * Get discovery summary based on issue type
   */
  getDiscoverySummary(result, test, field, categoryName) {
    const summaryMap = {
      broken_url: `${categoryName} test "${test.name}": Citation URL returns ${result.error}`,
      invalid_pmid: `${categoryName} test "${test.name}": PMID ${result.pmid} is invalid (${result.error})`,
      redirect_url: `${categoryName} test "${test.name}": Citation URL redirects (${result.httpStatus}) to ${result.redirectUrl || 'unknown'}`,
    };
    return summaryMap[result.issueType] || `${categoryName} test "${test.name}": URL issue in ${field}`;
  }

  /**
   * Format a value for display
   */
  formatValue(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return String(value).substring(0, 100);
  }

  /**
   * Generate a PubMed search URL for finding citations
   */
  generatePubMedSearchUrl(test, field) {
    const testName = test.name || '';
    const vendor = test.vendor || '';

    let searchTerms = [];

    if (testName) {
      searchTerms.push(`"${testName}"`);
    }

    // Add field-specific terms
    switch (field) {
      case 'sensitivity':
      case 'specificity':
      case 'ppv':
      case 'npv':
        searchTerms.push('(sensitivity OR specificity OR performance OR validation)');
        break;
      case 'lod':
      case 'lod95':
        searchTerms.push('(limit of detection OR LOD OR analytical sensitivity)');
        break;
      case 'clinicalSensitivity':
      case 'analyticalSensitivity':
        searchTerms.push('(clinical validation OR analytical validation)');
        break;
      default:
        if (vendor) {
          searchTerms.push(`"${vendor}"`);
        }
    }

    const query = searchTerms.join(' AND ');
    return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(query)}`;
  }

  /**
   * Audit a single test for citation issues (legacy method for backwards compatibility)
   */
  async auditTest(test, category) {
    const discoveries = [];
    const testContext = {
      testId: test.id,
      testName: test.name,
      vendor: test.vendor,
      category: category.toUpperCase(),
    };

    // Check each field that requires citations
    for (const field of CITATION_REQUIRED_FIELDS) {
      const value = test[field];
      const citationField = CITATION_FIELD_MAP[field];
      const citationValue = test[citationField];

      // Skip if the field has no value
      if (!this.hasValue(value)) {
        continue;
      }

      // Check for missing citation
      if (!this.hasValue(citationValue)) {
        // Determine relevance based on field priority
        const relevance = MUST_HAVE_CITATIONS.includes(field) ? 'high' : 'medium';
        const categoryName = CATEGORY_NAMES[category] || category.toUpperCase();

        discoveries.push({
          source: SOURCES.CITATIONS,
          type: DISCOVERY_TYPES.MISSING_CITATION,
          title: `Missing citation: ${test.name} - ${field}`,
          summary: `${categoryName} test "${test.name}" by ${test.vendor} has ${field}=${value} but no citation.`,
          url: null,
          relevance,
          metadata: {
            ...testContext,
            categoryName,
            field,
            currentValue: value,
            citationField,
            issueType: 'missing_citation',
            suggestedSearches: this.generateSearchSuggestions(test, field),
          },
        });
        continue;
      }

      // Extract and validate URLs from citation
      const urls = this.extractUrls(citationValue);

      if (urls.length === 0) {
        // Citation exists but contains no valid URLs (might be a text reference)
        this.log('debug', `Citation has no extractable URLs: ${citationValue.substring(0, 100)}`);
        continue;
      }

      // Check each URL
      for (const url of urls) {
        await this.sleep(URL_CHECK_DELAY_MS);

        // Check for PubMed URLs - validate PMID
        const pmid = this.extractPmid(url);
        if (pmid) {
          await this.sleep(PUBMED_DELAY_MS);
          const pmidResult = await this.validatePmid(pmid);

          if (!pmidResult.valid) {
            const categoryName = CATEGORY_NAMES[category] || category.toUpperCase();
            discoveries.push({
              source: SOURCES.CITATIONS,
              type: DISCOVERY_TYPES.BROKEN_CITATION,
              title: `Invalid PMID: ${test.name} - ${field}`,
              summary: `${categoryName} test "${test.name}": PMID ${pmid} is invalid (${pmidResult.error})`,
              url,
              relevance: 'high',
              metadata: {
                ...testContext,
                categoryName,
                field,
                currentValue: value,
                citationField,
                pmid,
                httpStatus: null,
                issueType: 'invalid_pmid',
                error: pmidResult.error,
                suggestedSearches: this.generateSearchSuggestions(test, field),
              },
            });
          }
          continue; // Skip regular URL check for PubMed URLs
        }

        // Check URL liveness for non-PubMed URLs
        const urlResult = await this.checkUrl(url);

        const categoryName = CATEGORY_NAMES[category] || category.toUpperCase();

        if (!urlResult.ok && !urlResult.redirected) {
          // Broken URL (including soft 404s)
          const errorMsg = urlResult.softError
            ? 'soft 404 (page not found content)'
            : urlResult.status
              ? `HTTP ${urlResult.status}`
              : urlResult.error;

          discoveries.push({
            source: SOURCES.CITATIONS,
            type: DISCOVERY_TYPES.BROKEN_CITATION,
            title: `Broken URL: ${test.name} - ${field}`,
            summary: `${categoryName} test "${test.name}": Citation URL returns ${errorMsg}`,
            url,
            relevance: 'high',
            metadata: {
              ...testContext,
              categoryName,
              field,
              currentValue: value,
              citationField,
              httpStatus: urlResult.status,
              issueType: 'broken_url',
              error: urlResult.error,
              softError: urlResult.softError || false,
              suggestedSearches: this.generateSearchSuggestions(test, field),
            },
          });
        } else if (urlResult.redirected) {
          // Redirected URL - may be stale
          discoveries.push({
            source: SOURCES.CITATIONS,
            type: DISCOVERY_TYPES.BROKEN_CITATION,
            title: `Redirected URL: ${test.name} - ${field}`,
            summary: `${categoryName} test "${test.name}": Citation URL redirects (${urlResult.status}) to ${urlResult.redirectUrl || 'unknown'}`,
            url,
            relevance: 'medium',
            metadata: {
              ...testContext,
              categoryName,
              field,
              currentValue: value,
              citationField,
              httpStatus: urlResult.status,
              redirectUrl: urlResult.redirectUrl,
              issueType: 'redirect_url',
              suggestedSearches: this.generateSearchSuggestions(test, field),
            },
          });
        }
      }
    }

    return discoveries;
  }

  /**
   * Generate search suggestions for finding citations
   * @param {Object} test - Test object
   * @param {string} field - Field name needing citation
   * @returns {Array} - Array of search suggestion objects
   */
  generateSearchSuggestions(test, field) {
    const suggestions = [];
    const testName = test.name;
    const vendor = test.vendor;

    // PubMed search
    const pubmedQuery = `"${testName}" ${field}`;
    suggestions.push({
      source: 'PubMed',
      query: pubmedQuery,
      url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(pubmedQuery)}`,
    });

    // Google Scholar search
    const scholarQuery = `"${testName}" ${vendor} ${field} validation`;
    suggestions.push({
      source: 'Google Scholar',
      query: scholarQuery,
      url: `https://scholar.google.com/scholar?q=${encodeURIComponent(scholarQuery)}`,
    });

    // Vendor website search (if known)
    const vendorDomain = this.getVendorDomain(vendor);
    if (vendorDomain) {
      suggestions.push({
        source: 'Vendor Website',
        query: `site:${vendorDomain} ${testName} ${field}`,
        url: `https://www.google.com/search?q=site:${vendorDomain}+${encodeURIComponent(testName)}+${field}`,
      });
    }

    return suggestions;
  }

  /**
   * Get vendor domain for search suggestions
   * @param {string} vendor - Vendor name
   * @returns {string|null} - Domain or null if unknown
   */
  getVendorDomain(vendor) {
    if (!vendor) return null;

    // Try exact match first
    if (VENDOR_DOMAINS[vendor]) {
      return VENDOR_DOMAINS[vendor];
    }

    // Try partial match
    for (const [name, domain] of Object.entries(VENDOR_DOMAINS)) {
      if (vendor.includes(name) || name.includes(vendor)) {
        return domain;
      }
    }

    return null;
  }
}

export default CitationsCrawler;
