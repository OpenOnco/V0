#!/usr/bin/env node

/**
 * Policy Crawler Script
 *
 * Crawls known policy documents from the policy registry, extracts content,
 * identifies test mentions, and analyzes coverage positions using Claude.
 *
 * Usage:
 *   node scripts/crawl-policies.js              # Crawl all policies
 *   node scripts/crawl-policies.js --tier 1    # Only Tier 1 payers
 *   node scripts/crawl-policies.js --dry-run   # Skip AI analysis
 *   node scripts/crawl-policies.js --payer uhc # Single payer
 */

import 'dotenv/config';
import { createHash } from 'crypto';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { resolve } from 'path';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { config } from '../src/config.js';
import { POLICY_REGISTRY, getAllPolicies } from '../src/data/policy-registry.js';
import { initializeTestDictionary, getAllTests } from '../src/data/test-dictionary.js';
import { extractTestsWithAI } from '../src/utils/ai-test-matcher.js';
import {
  initHashStore,
  upsertPolicyCoverage,
  getPolicyCoverage,
  getCoverageSummary,
  recordSuccess,
  recordFailure,
  closeHashStore,
} from '../src/utils/hash-store.js';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_TIMEOUT_MS = 60000;  // 60 seconds for policy documents
const RATE_LIMIT_MS = 2000;     // 2 seconds between requests

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

// ─────────────────────────────────────────────────────────────────────────────
// POLICY CRAWLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

class PolicyCrawler {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.tierFilter = options.tierFilter || null;
    this.payerFilter = options.payerFilter || null;
    this.browser = null;
    this.anthropic = config.anthropic?.apiKey && !this.dryRun
      ? new Anthropic({ apiKey: config.anthropic.apiKey })
      : null;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      changed: 0,
      withTests: 0,
    };
  }

  /**
   * Launch browser
   */
  async launchBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: true });
    }
    return this.browser;
  }

  /**
   * Close browser
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Fetch HTML policy page
   */
  async fetchHtmlPolicy(url) {
    const browser = await this.launchBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    try {
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

      const title = await page.title();
      await context.close();

      return { content, title };
    } catch (error) {
      await context.close();
      throw error;
    }
  }

  /**
   * Fetch PDF policy via download and parse
   */
  async fetchPdfPolicy(url) {
    const browser = await this.launchBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      acceptDownloads: true,
    });
    const page = await context.newPage();

    // Create temp directory for downloads
    const tempDir = resolve(process.cwd(), 'data', 'temp');
    await mkdir(tempDir, { recursive: true });

    try {
      // Set up download handler
      const downloadPromise = page.waitForEvent('download', { timeout: PAGE_TIMEOUT_MS });

      // Navigate to PDF URL (will trigger download)
      page.goto(url, { timeout: PAGE_TIMEOUT_MS }).catch(() => {});

      // Wait for download to start
      const download = await downloadPromise;

      // Save to temp file
      const tempPath = resolve(tempDir, `policy-${Date.now()}.pdf`);
      await download.saveAs(tempPath);

      // Parse PDF
      const dataBuffer = await import('fs').then(fs =>
        fs.promises.readFile(tempPath)
      );
      const pdfData = await pdfParse(dataBuffer);

      // Cleanup temp file
      await unlink(tempPath).catch(() => {});
      await context.close();

      return {
        content: pdfData.text,
        title: pdfData.info?.Title || 'PDF Document',
        numPages: pdfData.numpages,
      };

    } catch (error) {
      await context.close();

      // If download approach failed, try direct fetch
      if (error.message?.includes('Download') || error.message?.includes('timeout')) {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const buffer = await response.arrayBuffer();
          const pdfData = await pdfParse(Buffer.from(buffer));

          return {
            content: pdfData.text,
            title: pdfData.info?.Title || 'PDF Document',
            numPages: pdfData.numpages,
          };
        } catch (fetchError) {
          throw new Error(`PDF fetch failed: ${fetchError.message}`);
        }
      }

      throw error;
    }
  }

  /**
   * Analyze policy content using Claude
   */
  async analyzePolicy(policy, content, testsMentioned) {
    if (!this.anthropic) {
      return null;
    }

    try {
      const truncatedContent = content.length > 20000
        ? content.slice(0, 20000) + '\n...[content truncated]...'
        : content;

      const testsSection = testsMentioned.length > 0
        ? `\n=== TESTS IDENTIFIED ===\n${testsMentioned.join(', ')}\n`
        : '\n=== NO SPECIFIC TESTS IDENTIFIED ===\n';

      const prompt = `You are analyzing a health insurance medical policy document to understand coverage for ctDNA/liquid biopsy diagnostic tests.

PAYER: ${policy.payerName}
POLICY: ${policy.name}
URL: ${policy.url}
${testsSection}
=== POLICY CONTENT ===
${truncatedContent}

Analyze this policy and determine:

1. What is the overall coverage position for ctDNA/liquid biopsy testing?
   - covered: Generally covered as a benefit
   - not_covered: Explicitly not covered / investigational
   - conditional: Covered only under specific conditions
   - prior_auth_required: Requires prior authorization
   - unknown: Cannot determine from content

2. What specific conditions/criteria must be met for coverage?

3. Which specific tests are mentioned and their individual coverage status?

4. Any policy numbers, effective dates, or key limitations?

Respond in JSON format:
{
  "overallPosition": "covered|not_covered|conditional|prior_auth_required|unknown",
  "conditions": ["list of coverage conditions"],
  "testCoverage": {
    "TestName": "covered|not_covered|conditional|unknown"
  },
  "policyNumber": "if found",
  "effectiveDate": "if found",
  "keyLimitations": ["list of key limitations"],
  "summary": "2-3 sentence summary of the coverage position",
  "confidence": "high|medium|low"
}`;

      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      const responseText = response.content[0]?.text || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.log(`    ${YELLOW}⚠${RESET} Analysis error: ${error.message.slice(0, 50)}`);
    }

    return null;
  }

  /**
   * Process a single policy
   */
  async processPolicy(policy, index, total) {
    const startTime = Date.now();
    console.log(`  [${index}/${total}] ${policy.payerName}: ${policy.name}`);

    try {
      // Fetch content based on type
      let content, title;
      if (policy.contentType === 'pdf') {
        ({ content, title } = await this.fetchPdfPolicy(policy.url));
      } else {
        ({ content, title } = await this.fetchHtmlPolicy(policy.url));
      }

      if (!content || content.length < 100) {
        console.log(`    ${RED}✗${RESET} Empty or minimal content`);
        recordFailure(policy.url, policy.payerId, 'Empty content');
        this.stats.failed++;
        return;
      }

      // Compute hash to detect changes
      const contentHash = computeHash(content);
      const existing = getPolicyCoverage(policy.id);
      const hasChanged = !existing || existing.contentHash !== contentHash;

      // Find test mentions using AI
      let testsMentioned = [];
      if (!this.dryRun) {
        const testList = getAllTests().map(t => ({
          name: t.name,
          vendor: t.vendor,
          id: t.id,
        }));

        const aiResult = await extractTestsWithAI(content, testList);
        if (!aiResult.error) {
          testsMentioned = [...aiResult.tests, ...aiResult.uncertain];
        }
      }

      // Analyze coverage if tests found or if policy is new/changed
      let analysis = null;
      if (!this.dryRun && (testsMentioned.length > 0 || hasChanged)) {
        analysis = await this.analyzePolicy(policy, content, testsMentioned);
      }

      // Store results
      upsertPolicyCoverage({
        policyId: policy.id,
        payerId: policy.payerId,
        policyName: policy.name,
        url: policy.url,
        contentType: policy.contentType,
        policyType: policy.policyType,
        contentHash,
        contentSnippet: content.slice(0, 5000),
        coveragePosition: analysis?.overallPosition || null,
        testsMentioned,
        effectiveDate: analysis?.effectiveDate || null,
        policyNumber: analysis?.policyNumber || null,
        analysisConfidence: analysis?.confidence || null,
        rawAnalysis: analysis,
        lastFetched: new Date().toISOString(),
        lastChanged: hasChanged ? new Date().toISOString() : existing?.lastChanged,
      });

      recordSuccess(policy.url, policy.payerId);

      // Log result
      const testsMsg = testsMentioned.length > 0
        ? `${GREEN}${testsMentioned.length} tests${RESET}`
        : `${DIM}no tests${RESET}`;
      const changeMsg = hasChanged ? `${YELLOW}changed${RESET}` : `${DIM}unchanged${RESET}`;
      const positionMsg = analysis?.overallPosition
        ? `${CYAN}${analysis.overallPosition}${RESET}`
        : '';

      console.log(`    ${GREEN}✓${RESET} ${testsMsg} | ${changeMsg} ${positionMsg} ${DIM}(${elapsed(Date.now() - startTime)})${RESET}`);

      this.stats.success++;
      if (hasChanged) this.stats.changed++;
      if (testsMentioned.length > 0) this.stats.withTests++;

    } catch (error) {
      console.log(`    ${RED}✗${RESET} ${error.message.slice(0, 60)}`);
      recordFailure(policy.url, policy.payerId, error.message);
      this.stats.failed++;
    }
  }

  /**
   * Main run method
   */
  async run() {
    const startTime = Date.now();

    console.log(`\n${CYAN}╔════════════════════════════════════════════════════════════╗${RESET}`);
    console.log(`${CYAN}║  ${BOLD}OpenOnco Policy Crawler${RESET}${CYAN}                                   ║${RESET}`);
    console.log(`${CYAN}╚════════════════════════════════════════════════════════════╝${RESET}\n`);

    if (this.dryRun) {
      console.log(`${YELLOW}⚠${RESET} Running in dry-run mode (no AI analysis)\n`);
    }

    // Initialize
    await initHashStore();
    await initializeTestDictionary();

    // Get policies to crawl
    let policies = getAllPolicies();

    if (this.tierFilter) {
      policies = policies.filter(p => p.payerTier === this.tierFilter);
    }
    if (this.payerFilter) {
      policies = policies.filter(p => p.payerId === this.payerFilter);
    }

    this.stats.total = policies.length;
    console.log(`${CYAN}▸${RESET} ${BOLD}Found ${policies.length} policies to crawl${RESET}\n`);

    // Process each policy
    for (let i = 0; i < policies.length; i++) {
      await this.processPolicy(policies[i], i + 1, policies.length);
      if (i < policies.length - 1) {
        await sleep(RATE_LIMIT_MS);
      }
    }

    // Cleanup
    await this.closeBrowser();

    // Print summary
    const summary = getCoverageSummary();
    console.log(`\n${GREEN}${BOLD}Crawl complete${RESET} ${DIM}(${elapsed(Date.now() - startTime)})${RESET}`);
    console.log(`\n  ${BOLD}This Run:${RESET}`);
    console.log(`    Policies crawled:  ${this.stats.total}`);
    console.log(`    Successful:        ${GREEN}${this.stats.success}${RESET}`);
    console.log(`    Failed:            ${this.stats.failed > 0 ? RED : ''}${this.stats.failed}${RESET}`);
    console.log(`    Changed:           ${this.stats.changed > 0 ? YELLOW : ''}${this.stats.changed}${RESET}`);
    console.log(`    With test mentions: ${CYAN}${this.stats.withTests}${RESET}`);

    console.log(`\n  ${BOLD}Overall Coverage Database:${RESET}`);
    console.log(`    Total policies:    ${summary.total_policies}`);
    console.log(`    Total payers:      ${summary.total_payers}`);
    console.log(`    Covered:           ${GREEN}${summary.covered}${RESET}`);
    console.log(`    Not covered:       ${RED}${summary.not_covered}${RESET}`);
    console.log(`    Conditional:       ${YELLOW}${summary.conditional}${RESET}`);
    console.log(`    Prior auth:        ${summary.prior_auth}`);
    console.log(`    Unknown:           ${DIM}${summary.unknown}${RESET}`);
    console.log();

    closeHashStore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

const USAGE = `
${BOLD}Usage:${RESET}  node scripts/crawl-policies.js [options]

${BOLD}Options:${RESET}
  --dry-run     Skip Claude analysis
  --tier N      Only process Tier N payers (1, 2, or 3)
  --payer ID    Only process a specific payer (e.g., uhc, aetna)
  --help        Show this help message

${BOLD}Examples:${RESET}
  node scripts/crawl-policies.js              # Crawl all policies
  node scripts/crawl-policies.js --tier 1     # Only Tier 1 payers
  node scripts/crawl-policies.js --payer uhc  # Only UHC policies
  node scripts/crawl-policies.js --dry-run    # Skip AI analysis
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  const options = {
    dryRun: args.includes('--dry-run'),
    tierFilter: null,
    payerFilter: null,
  };

  const tierIdx = args.indexOf('--tier');
  if (tierIdx !== -1 && args[tierIdx + 1]) {
    options.tierFilter = parseInt(args[tierIdx + 1], 10);
  }

  const payerIdx = args.indexOf('--payer');
  if (payerIdx !== -1 && args[payerIdx + 1]) {
    options.payerFilter = args[payerIdx + 1];
  }

  const crawler = new PolicyCrawler(options);
  await crawler.run();
}

main().catch(error => {
  console.error(`\n${RED}${BOLD}Fatal error:${RESET} ${error.message}`);
  if (error.stack) {
    console.error(`${DIM}${error.stack}${RESET}`);
  }
  process.exit(1);
});
