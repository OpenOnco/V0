#!/usr/bin/env node

/**
 * Payer Baseline Collection Script
 *
 * One-time script to crawl all configured payers and generate a comprehensive
 * "state of payer coverage" report for ctDNA/liquid biopsy tests.
 *
 * This establishes baseline content hashes for future incremental daemon runs.
 *
 * Usage:
 *   node scripts/collect-payer-baseline.js
 *   node scripts/collect-payer-baseline.js --dry-run    # Skip Claude analysis
 *   node scripts/collect-payer-baseline.js --tier 1     # Only Tier 1 payers
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { config, PAYERS } from '../src/config.js';
import { initializeTestDictionary, matchTests, formatMatchesForPrompt, getAllTests } from '../src/data/test-dictionary.js';
import { canonicalizeContent } from '../src/utils/canonicalize.js';
import { extractTestsWithAI } from '../src/utils/ai-test-matcher.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const HASH_FILE_PATH = resolve(process.cwd(), 'data', 'payer-hashes.json');
const DATA_DIR = resolve(process.cwd(), 'data');

// Browser settings
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PAGE_TIMEOUT_MS = 45000;  // 45 seconds per page
const RATE_LIMIT_MS = 3000;     // 3 seconds between requests
const MAX_RETRIES = 2;          // 2 retry attempts on failure
const RETRY_DELAY_BASE_MS = 2000;

// Concurrency
const CONCURRENCY = 5;  // 5 payers at a time within each tier

// Claude model for analysis
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Console formatting
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

// ─────────────────────────────────────────────────────────────────────────────
// PAYER URL CONFIGURATION
// Maps payer IDs to their policy index URLs
// ─────────────────────────────────────────────────────────────────────────────

const PAYER_URLS = {
  // National Commercial (Tier 1)
  uhc: 'https://www.uhc.com/resources/policies',
  anthem: 'https://www.anthem.com/provider/policies',
  centene: 'https://www.ambetterhealth.com/provider',
  cigna: 'https://www.cigna.com/health-care-providers/coverage-and-claims',
  humana: 'https://www.humana.com/provider',
  molina: 'https://www.molinahealthcare.com/providers',
  kaiser: 'https://healthy.kaiserpermanente.org/',
  aetna: 'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html',

  // HCSC BCBS
  'hcsc-tx': 'https://www.bcbstx.com/provider/medical-policies',
  'hcsc-il': 'https://www.bcbsil.com/provider/medical-policies',
  'hcsc-mt': 'https://www.bcbsmt.com/provider/medical-policies',
  'hcsc-ok': 'https://www.bcbsok.com/provider/medical-policies',
  'hcsc-nm': 'https://www.bcbsnm.com/provider/medical-policies',

  // Regional BCBS
  highmark: 'https://www.highmark.com/provider/medical-policy',
  floridablue: 'https://www.floridablue.com/providers/medical-policies',
  bcbsm: 'https://www.bcbsm.com/providers/medical-policies',
  bcbsnc: 'https://www.bcbsnc.com/provider/medical-policies',
  bcbssc: 'https://www.southcarolinablues.com/providers',
  bcbstn: 'https://www.bcbst.com/providers/medical-policies',
  bcbsal: 'https://www.bcbsal.org/providers/policies',
  bcbsla: 'https://lablue.com/providers',
  bcbsaz: 'https://www.azblue.com/providers/medical-policies',
  bcbsks: 'https://www.bcbsks.com/providers',
  bcbskc: 'https://www.bluekc.com/providers',
  bcbsne: 'https://www.nebraskablue.com/providers',
  bcbsnd: 'https://www.bcbsnd.com/providers',
  bcbswy: 'https://www.bcbswy.com/providers',
  bcbsma: 'https://www.bluecrossma.com/providers/medical-policies',
  bcbsri: 'https://www.bcbsri.com/providers',
  bcbsvt: 'https://www.bcbsvt.com/providers',
  bcbsmn: 'https://www.bluecrossmn.com/providers',
  carefirst: 'https://www.carefirst.com/providers/medical-policies',
  blueshieldca: 'https://www.blueshieldca.com/provider/medical-policy',
  horizon: 'https://www.horizonblue.com/providers/policies',
  excellus: 'https://www.excellusbcbs.com/providers',
  empire: 'https://www.empireblue.com/provider/policies',
  ibx: 'https://www.ibx.com/providers/medical-policy',
  premera: 'https://www.premera.com/provider/medical-policies',
  regence: 'https://www.regence.com/provider/medical-policies',
  wellmark: 'https://www.wellmark.com/providers/medical-policies',
  bcidaho: 'https://www.bcidaho.com/providers',
  arkbcbs: 'https://www.arkansasbluecross.com/providers',

  // Medicare Advantage
  'uhc-ma': 'https://www.uhcprovider.com/content/provider/en/policies-protocols/medicare-advantage-policies.html',

  // Lab Benefit Managers
  evicore: 'https://www.evicore.com/provider/clinical-guidelines',
  aim: 'https://aimspecialtyhealth.com/resources/clinical-guidelines/genetic-testing/',

  // Other Large (Tier 2)
  oscar: 'https://www.hioscar.com/providers',
  caresource: 'https://www.caresource.com/providers',
  healthnet: 'https://www.healthnet.com/providers',
  fidelis: 'https://www.fideliscare.org/providers',

  // Regional (Tier 3)
  medica: 'https://www.medica.com/providers',
  healthpartners: 'https://www.healthpartners.com/providers',
  ucare: 'https://www.ucare.org/providers',
  priority: 'https://www.priorityhealth.com/providers',
  mclaren: 'https://www.mclarenhealthplan.org/providers',
  quartz: 'https://quartzbenefits.com/providers',
  sanford: 'https://www.sanfordhealthplan.com/providers',
  avera: 'https://www.avera.org/health-plans',
  geisinger: 'https://www.geisinger.org/health-plan/providers',
  upmc: 'https://www.upmchealthplan.com/providers',
  tufts: 'https://tuftshealthplan.com/providers',
  harvard: 'https://www.harvardpilgrim.org/providers',
  fallon: 'https://www.fallonhealth.org/providers',
  connecticare: 'https://www.connecticare.com/providers',
  healthfirst: 'https://healthfirst.org/providers',
  metroplus: 'https://www.metroplus.org/providers',
  mvp: 'https://www.mvphealthcare.com/providers',
  lacare: 'https://www.lacare.org/providers',
  selecthealth: 'https://selecthealth.org/providers',
  providence: 'https://providencehealthplan.com/providers',
  pacificsource: 'https://www.pacificsource.com/providers',
  moda: 'https://www.modahealth.com/providers',
  bridgespan: 'https://bridgespanhealth.com/providers',
  hmsa: 'https://hmsa.com/providers',
  optima: 'https://www.optimahealth.com/providers',
  sentara: 'https://www.sentarahealthplans.com/providers',
  medmutual: 'https://www.medmutual.com/providers',
  amerihealth: 'https://www.amerihealth.com/providers',
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function computeHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function elapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if URL is an Anthem domain (requires HTTP/1.1 fallback)
 */
function isAnthemDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes('anthem.com') || hostname.includes('anthem.');
  } catch {
    return false;
  }
}

/**
 * Fallback fetch using Node.js https module with HTTP/1.1
 */
async function fetchWithHttp1(url) {
  const https = await import('https');
  const http = await import('http');

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https.default : http.default;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
      },
      ALPNProtocols: ['http/1.1'],
    };

    const req = client.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location, url).href;
        fetchWithHttp1(redirectUrl).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(PAGE_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`Request timeout for ${url}`));
    });
    req.end();
  });
}

/**
 * Parse HTML content and extract text (for HTTP/1.1 fallback)
 */
function parseHtmlContent(html, url) {
  let content = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

  content = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  return { content, extractedData: { title }, url };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYER CRAWLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class PayerBaselineCollector {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.tierFilter = options.tierFilter || null;
    this.useAI = options.useAI || false;  // Use AI-based test matching
    this.browser = null;
    this.anthropic = config.anthropic?.apiKey && !this.dryRun
      ? new Anthropic({ apiKey: config.anthropic.apiKey })
      : null;
    this.results = [];
    this.hashes = {};
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      timeout: 0,
      withTests: 0,
      aiMatches: 0,      // Tests found via AI
      regexMatches: 0,   // Tests found via regex
    };
  }

  /**
   * Build payer list from config
   */
  buildPayerList() {
    const allPayers = [
      ...PAYERS.nationalCommercial,
      ...(PAYERS.hcscBCBS || []),
      ...PAYERS.regionalBCBS,
      ...PAYERS.medicareAdvantage,
      ...PAYERS.labBenefitManagers,
      ...PAYERS.otherLarge,
      ...(PAYERS.regional || []),
    ];

    // Filter by tier if specified
    let payers = allPayers.filter(p => PAYER_URLS[p.id]);
    if (this.tierFilter) {
      payers = payers.filter(p => p.tier === this.tierFilter);
    }

    // Group by tier for ordered processing
    const byTier = { 1: [], 2: [], 3: [] };
    for (const p of payers) {
      const tier = p.tier || 3;
      if (!byTier[tier]) byTier[tier] = [];
      byTier[tier].push({
        ...p,
        url: PAYER_URLS[p.id],
      });
    }

    return byTier;
  }

  /**
   * Launch browser instance
   */
  async launchBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
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
    }
  }

  /**
   * Fetch page content with retry logic
   */
  async fetchPage(url) {
    const isAnthem = isAnthemDomain(url);

    // Try HTTP/1.1 fallback for Anthem domains
    if (isAnthem) {
      try {
        const html = await fetchWithHttp1(url);
        return parseHtmlContent(html, url);
      } catch (err) {
        // Fall through to Playwright
      }
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const browser = await this.launchBrowser();
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: isAnthem,
      });
      const page = await context.newPage();

      try {
        if (attempt > 0) {
          const backoffDelay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
          await sleep(backoffDelay);
        }

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: PAGE_TIMEOUT_MS,
        });

        await sleep(2000);  // Wait for dynamic content

        const content = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script, style, noscript');
          scripts.forEach(el => el.remove());
          return document.body?.innerText || '';
        });

        const extractedData = await page.evaluate(() => ({
          title: document.title,
        }));

        await context.close();
        return { content, extractedData, url };

      } catch (error) {
        await context.close();
        if (attempt === MAX_RETRIES) {
          throw error;
        }
      }
    }
  }

  /**
   * Analyze content using Claude for coverage position
   */
  async analyzeContent(payer, content, deterministicMatches) {
    if (!this.anthropic || deterministicMatches.length === 0) {
      return null;
    }

    try {
      const formattedMatches = formatMatchesForPrompt(deterministicMatches);
      const truncatedContent = content.length > 15000
        ? content.slice(0, 15000) + '\n...[content truncated]...'
        : content;

      const prompt = `You are analyzing a payer medical policy page to understand their coverage position on ctDNA/liquid biopsy diagnostic tests.

PAYER: ${payer.name}
URL: ${payer.url}

=== TESTS IDENTIFIED ON THIS PAGE ===
${formattedMatches}

=== PAGE CONTENT ===
${truncatedContent}

For EACH test mentioned, determine the coverage position if possible:
- covered: Test is covered as a benefit
- not_covered: Test is explicitly not covered
- conditional: Covered under specific conditions/criteria
- prior_auth_required: Requires prior authorization
- unknown: Cannot determine from content

Also note any specific criteria, effective dates, or policy numbers mentioned.

Respond in JSON format:
{
  "coveragePositions": {
    "TestName": "covered|not_covered|conditional|prior_auth_required|unknown"
  },
  "effectiveDate": "date string or null",
  "policyNumbers": ["any policy numbers found"],
  "summary": "Brief 1-2 sentence summary of coverage stance",
  "confidence": "high|medium|low"
}`;

      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = response.content[0]?.text || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Silently fail - analysis is optional
    }

    return null;
  }

  /**
   * Process a single payer
   */
  async processPayer(payer, index, total) {
    const startTime = Date.now();
    const result = {
      payerId: payer.id,
      payerName: payer.name,
      tier: payer.tier || 3,
      url: payer.url,
      status: 'pending',
      testsFound: [],
      coveragePositions: {},
      contentHash: null,
      analysisConfidence: null,
      rawAnalysis: null,
      error: null,
    };

    try {
      // Fetch page content
      const { content, extractedData } = await this.fetchPage(payer.url);

      if (!content || content.length < 100) {
        result.status = 'failed';
        result.error = 'Empty or minimal content';
        this.stats.failed++;
        return result;
      }

      // Compute hash
      const canonical = canonicalizeContent(content);
      result.contentHash = computeHash(canonical);

      // Run test matching (AI or deterministic)
      let matches = [];
      let aiResult = null;

      if (this.useAI && !this.dryRun) {
        // AI-based matching
        const testList = getAllTests().map(t => ({
          name: t.name,
          vendor: t.vendor,
          id: t.id
        }));

        aiResult = await extractTestsWithAI(content, testList);

        if (aiResult.error) {
          // Fall back to regex matching on AI failure
          console.log(`    ${YELLOW}⚠${RESET} AI matching failed, falling back to regex: ${DIM}${aiResult.error}${RESET}`);
          matches = matchTests(content);
          result.matchMethod = 'regex_fallback';
          this.stats.regexMatches++;
        } else {
          // Convert AI results to match format
          const allTests = getAllTests();
          const testsByName = new Map(allTests.map(t => [t.name.toLowerCase(), t]));

          for (const testName of aiResult.tests) {
            const test = testsByName.get(testName.toLowerCase());
            if (test) {
              matches.push({
                test,
                matchType: 'ai_match',
                confidence: 0.85,
                matchedOn: testName
              });
            }
          }

          // Add uncertain matches with lower confidence
          for (const testName of aiResult.uncertain) {
            const test = testsByName.get(testName.toLowerCase());
            if (test) {
              matches.push({
                test,
                matchType: 'ai_uncertain',
                confidence: 0.60,
                matchedOn: testName
              });
            }
          }

          result.matchMethod = 'ai';
          result.aiReasoning = aiResult.reasoning;
          this.stats.aiMatches++;
        }
      } else {
        // Deterministic regex matching
        matches = matchTests(content);
        result.matchMethod = 'regex';
        if (matches.length > 0) {
          this.stats.regexMatches++;
        }
      }

      result.testsFound = matches.map(m => m.test.name);

      // If tests found, run Claude analysis for coverage positions (unless dry run)
      if (matches.length > 0 && !this.dryRun) {
        const analysis = await this.analyzeContent(payer, content, matches);
        if (analysis) {
          result.coveragePositions = analysis.coveragePositions || {};
          result.analysisConfidence = analysis.confidence;
          result.rawAnalysis = analysis;
        }
        this.stats.withTests++;
      }

      result.status = 'success';
      this.stats.success++;

      // Store hash for future change detection
      this.hashes[`${payer.id}:index:${payer.url}`] = {
        hash: result.contentHash,
        content: content.slice(0, 50000),  // Store first 50KB
        fetchedAt: new Date().toISOString(),
      };

      // Log progress
      const testsMsg = result.testsFound.length > 0
        ? `${GREEN}found ${result.testsFound.length} tests${RESET}`
        : `${DIM}no tests${RESET}`;
      console.log(`  ${GREEN}✓${RESET} [${index}/${total}] ${payer.name} ${DIM}(${elapsed(Date.now() - startTime)})${RESET} - ${testsMsg}`);

    } catch (error) {
      const errorMsg = error.message || 'Unknown error';
      const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('Timeout');

      result.status = isTimeout ? 'timeout' : 'failed';
      result.error = errorMsg;

      if (isTimeout) {
        this.stats.timeout++;
      } else {
        this.stats.failed++;
      }

      console.log(`  ${RED}✗${RESET} [${index}/${total}] ${payer.name} - ${DIM}${errorMsg.slice(0, 50)}${RESET}`);
    }

    return result;
  }

  /**
   * Process payers in parallel batches
   */
  async processTier(payers, tierNum) {
    console.log(`\n${CYAN}▸${RESET} ${BOLD}Tier ${tierNum}${RESET} ${DIM}(${payers.length} payers)${RESET}`);

    const results = [];

    // Process in batches of CONCURRENCY
    for (let i = 0; i < payers.length; i += CONCURRENCY) {
      const batch = payers.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map((p, j) =>
          this.processPayer(p, i + j + 1, payers.length)
            .then(async (result) => {
              // Rate limit between requests
              await sleep(RATE_LIMIT_MS);
              return result;
            })
        )
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Load existing hashes
   */
  async loadHashes() {
    try {
      const data = await readFile(HASH_FILE_PATH, 'utf-8');
      const rawHashes = JSON.parse(data);

      // Normalize to new format
      this.hashes = {};
      for (const [key, value] of Object.entries(rawHashes)) {
        if (typeof value === 'string') {
          this.hashes[key] = { hash: value, content: null, fetchedAt: null };
        } else {
          this.hashes[key] = value;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.log(`${YELLOW}⚠${RESET} Could not load existing hashes: ${error.message}`);
      }
      this.hashes = {};
    }
  }

  /**
   * Save hashes to disk
   */
  async saveHashes() {
    await mkdir(dirname(HASH_FILE_PATH), { recursive: true });
    await writeFile(HASH_FILE_PATH, JSON.stringify(this.hashes, null, 2));
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport() {
    const date = formatDate();
    const lines = [
      `# Payer Coverage Baseline Report`,
      ``,
      `**Generated:** ${new Date().toISOString()}`,
      ``,
      `## Summary`,
      ``,
      `| Metric | Value |`,
      `|--------|-------|`,
      `| Total Payers | ${this.stats.total} |`,
      `| Successful | ${this.stats.success} |`,
      `| Failed | ${this.stats.failed} |`,
      `| Timeouts | ${this.stats.timeout} |`,
      `| With Test Mentions | ${this.stats.withTests} |`,
      ``,
      `## Payers with Test Mentions`,
      ``,
    ];

    const withTests = this.results.filter(r => r.testsFound.length > 0);
    if (withTests.length === 0) {
      lines.push(`_No payers had detectable test mentions._`);
    } else {
      for (const r of withTests.sort((a, b) => a.tier - b.tier)) {
        lines.push(`### ${r.payerName} (Tier ${r.tier})`);
        lines.push(``);
        lines.push(`- **URL:** ${r.url}`);
        lines.push(`- **Tests Found:** ${r.testsFound.join(', ')}`);

        if (Object.keys(r.coveragePositions).length > 0) {
          lines.push(`- **Coverage Positions:**`);
          for (const [test, pos] of Object.entries(r.coveragePositions)) {
            lines.push(`  - ${test}: ${pos}`);
          }
        }

        if (r.rawAnalysis?.summary) {
          lines.push(`- **Summary:** ${r.rawAnalysis.summary}`);
        }

        lines.push(``);
      }
    }

    lines.push(`## Failed Payers`);
    lines.push(``);

    const failed = this.results.filter(r => r.status !== 'success');
    if (failed.length === 0) {
      lines.push(`_All payers were successfully crawled._`);
    } else {
      lines.push(`| Payer | Tier | Status | Error |`);
      lines.push(`|-------|------|--------|-------|`);
      for (const r of failed) {
        const error = r.error?.slice(0, 50) || 'Unknown';
        lines.push(`| ${r.payerName} | ${r.tier} | ${r.status} | ${error} |`);
      }
    }

    lines.push(``);
    lines.push(`---`);
    lines.push(`*Generated by collect-payer-baseline.js*`);

    return lines.join('\n');
  }

  /**
   * Main collection process
   */
  async run() {
    const startTime = Date.now();

    console.log(`\n${CYAN}╔════════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${CYAN}║  ${BOLD}OpenOnco Payer Baseline Collection${RESET}${CYAN}                        ║${RESET}`);
    console.log(`${CYAN}╚════════════════════════════════════════════════════════════╝${RESET}\n`);

    if (this.dryRun) {
      console.log(`${YELLOW}⚠${RESET} Running in dry-run mode (no Claude analysis)\n`);
    }

    if (this.useAI) {
      console.log(`${CYAN}▸${RESET} ${BOLD}AI mode enabled${RESET} - using Haiku 3.5 for test extraction\n`);
    }

    // Initialize test dictionary
    console.log(`${CYAN}▸${RESET} ${BOLD}Initializing test dictionary...${RESET}`);
    await initializeTestDictionary();

    // Load existing hashes
    await this.loadHashes();

    // Build payer list
    const payersByTier = this.buildPayerList();
    const totalPayers = Object.values(payersByTier).flat().length;
    this.stats.total = totalPayers;

    console.log(`${CYAN}▸${RESET} ${BOLD}Found ${totalPayers} payers to crawl${RESET}`);

    // Process each tier in order
    for (const tier of [1, 2, 3]) {
      const payers = payersByTier[tier] || [];
      if (payers.length === 0) continue;

      const tierResults = await this.processTier(payers, tier);
      this.results.push(...tierResults);
    }

    // Close browser
    await this.closeBrowser();

    // Save results
    const date = formatDate();
    await mkdir(DATA_DIR, { recursive: true });

    // Save JSON results
    const jsonOutput = {
      collectedAt: new Date().toISOString(),
      payerCount: this.stats.total,
      payersWithTestMentions: this.stats.withTests,
      stats: this.stats,
      results: this.results,
    };
    const jsonPath = resolve(DATA_DIR, `payer-baseline-${date}.json`);
    await writeFile(jsonPath, JSON.stringify(jsonOutput, null, 2));

    // Save markdown report
    const mdPath = resolve(DATA_DIR, `payer-baseline-${date}.md`);
    await writeFile(mdPath, this.generateMarkdownReport());

    // Update hashes file
    await this.saveHashes();

    // Print summary
    const duration = Date.now() - startTime;
    console.log(`\n${GREEN}${BOLD}Collection complete${RESET} ${DIM}(${elapsed(duration)})${RESET}`);
    console.log(`\n  ${BOLD}Results:${RESET}`);
    console.log(`    Total payers:       ${this.stats.total}`);
    console.log(`    Successful:         ${GREEN}${this.stats.success}${RESET}`);
    console.log(`    Failed:             ${this.stats.failed > 0 ? RED : ''}${this.stats.failed}${RESET}`);
    console.log(`    Timeouts:           ${this.stats.timeout > 0 ? YELLOW : ''}${this.stats.timeout}${RESET}`);
    console.log(`    With test mentions: ${CYAN}${this.stats.withTests}${RESET}`);
    if (this.useAI) {
      console.log(`    AI matches:         ${CYAN}${this.stats.aiMatches}${RESET}`);
      console.log(`    Regex fallbacks:    ${this.stats.regexMatches > 0 ? YELLOW : ''}${this.stats.regexMatches}${RESET}`);
    }
    console.log(`\n  ${BOLD}Output files:${RESET}`);
    console.log(`    ${DIM}${jsonPath}${RESET}`);
    console.log(`    ${DIM}${mdPath}${RESET}`);
    console.log(`    ${DIM}${HASH_FILE_PATH}${RESET}`);
    console.log();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

const USAGE = `
${BOLD}Usage:${RESET}  node scripts/collect-payer-baseline.js [options]

${BOLD}Options:${RESET}
  --dry-run     Skip Claude analysis (faster, just collect hashes)
  --tier N      Only process Tier N payers (1, 2, or 3)
  --ai          Use AI-based test matching (Haiku 3.5) instead of regex
  --help        Show this help message

${BOLD}Examples:${RESET}
  node scripts/collect-payer-baseline.js              # Full collection with regex matching
  node scripts/collect-payer-baseline.js --ai         # Use AI for test extraction
  node scripts/collect-payer-baseline.js --dry-run    # Skip AI analysis
  node scripts/collect-payer-baseline.js --tier 1     # Only Tier 1 payers
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  const options = {
    dryRun: args.includes('--dry-run'),
    useAI: args.includes('--ai'),
    tierFilter: null,
  };

  const tierIdx = args.indexOf('--tier');
  if (tierIdx !== -1 && args[tierIdx + 1]) {
    options.tierFilter = parseInt(args[tierIdx + 1], 10);
    if (![1, 2, 3].includes(options.tierFilter)) {
      console.error(`${RED}Invalid tier: ${args[tierIdx + 1]}. Must be 1, 2, or 3.${RESET}`);
      process.exit(1);
    }
  }

  const collector = new PayerBaselineCollector(options);
  await collector.run();
}

main().catch(error => {
  console.error(`\n${RED}${BOLD}Fatal error:${RESET} ${error.message}`);
  if (error.stack) {
    console.error(`${DIM}${error.stack}${RESET}`);
  }
  process.exit(1);
});
