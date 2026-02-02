#!/usr/bin/env node
/**
 * Policy Discovery Script
 *
 * Crawls payer index pages to discover new policy URLs for ctDNA/liquid biopsy/MRD.
 * Discovered URLs are staged in SQLite for human review.
 *
 * Usage:
 *   node scripts/discover-policies.js              # All Tier 1 payers
 *   node scripts/discover-policies.js --payer aetna
 *   node scripts/discover-policies.js --tier 1
 *   node scripts/discover-policies.js --dry-run    # Don't save to database
 *   node scripts/discover-policies.js --skip-ai    # Skip AI classification
 */

import { chromium } from 'playwright';
import { PAYER_INDEX_REGISTRY, getAllIndexPages, getIndexPagesByPayer } from '../src/data/payer-index-registry.js';
import { classifyLinks } from '../src/utils/link-classifier.js';
import {
  initHashStore,
  stageDiscoveredPolicy,
  isUrlAlreadyDiscovered,
  getDiscoveryStats,
  closeHashStore,
} from '../src/utils/hash-store.js';
import { getAllPolicies } from '../src/data/policy-registry.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  payer: null,
  tier: null,
  dryRun: false,
  skipAI: false,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--payer':
      options.payer = args[++i];
      break;
    case '--tier':
      options.tier = parseInt(args[++i], 10);
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--skip-ai':
      options.skipAI = true;
      break;
    case '--help':
      console.log(`
Policy Discovery Script

Usage:
  node scripts/discover-policies.js [options]

Options:
  --payer <id>   Discover for specific payer (e.g., aetna, uhc)
  --tier <n>     Discover for tier n payers only (1 or 2)
  --dry-run      Don't save discoveries to database
  --skip-ai      Skip AI classification (keyword matching only)
  --help         Show this help message

Examples:
  node scripts/discover-policies.js --payer aetna
  node scripts/discover-policies.js --tier 1
  node scripts/discover-policies.js --dry-run
`);
      process.exit(0);
  }
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Extract links from a page
 */
async function extractLinks(page, linkPattern) {
  return await page.evaluate((patternStr) => {
    const pattern = patternStr ? new RegExp(patternStr) : null;
    const links = [];
    const seen = new Set();

    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.href;
      const text = a.textContent?.trim() || '';

      // Skip empty, javascript:, or mailto: links
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) return;

      // Skip duplicates
      if (seen.has(href)) return;
      seen.add(href);

      // Apply pattern filter if provided
      if (pattern && !pattern.test(href)) return;

      // Get surrounding context
      const parent = a.parentElement;
      const context = parent?.textContent?.trim().slice(0, 200) || '';

      links.push({ href, text, context });
    });

    return links;
  }, linkPattern?.source || null);
}

/**
 * Crawl a single index page
 */
async function crawlIndexPage(browser, indexPage) {
  const { url, payerId, payerName, type, linkPattern, searchKeywords } = indexPage;

  log(`\n  Crawling: ${url}`, colors.dim);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  try {
    // Navigate with longer timeout for slow payer sites
    await page.goto(url, {
      waitUntil: type === 'static' ? 'domcontentloaded' : 'networkidle',
      timeout: 60000,
    });

    // Wait a bit for JS to settle
    if (type === 'javascript') {
      await page.waitForTimeout(2000);
    }

    // Extract all links
    const allLinks = await extractLinks(page, linkPattern);
    log(`    Found ${allLinks.length} links matching pattern`, colors.dim);

    // Filter to policy-like links (PDFs, HTML policies)
    const policyLinks = allLinks.filter((link) => {
      const href = link.href.toLowerCase();
      return (
        href.endsWith('.pdf') ||
        href.includes('/policy') ||
        href.includes('/cpb/') ||
        href.includes('/bulletin') ||
        href.includes('/coverage') ||
        href.includes('/medical-policy') ||
        href.includes('/clinical-guideline')
      );
    });

    log(`    ${policyLinks.length} policy-like links`, colors.dim);

    return policyLinks;
  } catch (error) {
    log(`    Error: ${error.message}`, colors.red);
    return [];
  } finally {
    await context.close();
  }
}

/**
 * Check if URL is in the static policy registry
 */
function isInPolicyRegistry(url) {
  const registryUrls = getAllPolicies().map((p) => p.url.toLowerCase());
  return registryUrls.includes(url.toLowerCase());
}

/**
 * Main discovery function
 */
async function discoverPolicies() {
  log(`${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  log(`${colors.blue}║  ${colors.bright}OpenOnco Policy Discovery${colors.reset}${colors.blue}                                 ║${colors.reset}`);
  log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);

  // Initialize database
  if (!options.dryRun) {
    await initHashStore();
  }

  // Get index pages to crawl
  let indexPages;
  if (options.payer) {
    indexPages = getIndexPagesByPayer(options.payer);
    if (indexPages.length === 0) {
      log(`\nError: Unknown payer '${options.payer}'`, colors.red);
      log(`Available payers: ${Object.keys(PAYER_INDEX_REGISTRY).join(', ')}`, colors.dim);
      process.exit(1);
    }
  } else {
    indexPages = getAllIndexPages(options.tier);
  }

  // Filter to enabled pages only (unless specific payer requested)
  const enabledPages = options.payer ? indexPages : indexPages.filter((p) => p.enabled);
  const disabledCount = indexPages.length - enabledPages.length;

  if (enabledPages.length === 0) {
    log(`\n${colors.yellow}No enabled index pages found.${colors.reset}`);
    if (disabledCount > 0) {
      log(`\n${colors.dim}Note: ${disabledCount} payer index page(s) are disabled because they require`);
      log(`complex interaction (modals, search, accordions) that makes automated`);
      log(`discovery unreliable. For these payers, manually add URLs to policy-registry.js.${colors.reset}`);
      log(`\nTo force discovery for a specific payer anyway:`);
      log(`  ${colors.blue}node scripts/discover-policies.js --payer <payer_id>${colors.reset}`);
    }
    return;
  }

  log(`\n${colors.bright}Discovering policies from ${enabledPages.length} index page(s)${colors.reset}`);
  if (disabledCount > 0) {
    log(`${colors.dim}(${disabledCount} payer(s) disabled - use --payer to force)${colors.reset}`);
  }
  if (options.dryRun) log(`${colors.yellow}(dry run - not saving to database)${colors.reset}`);
  if (options.skipAI) log(`${colors.yellow}(AI classification disabled)${colors.reset}`);

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
  });

  const stats = {
    pagesProcessed: 0,
    pagesFailed: 0,
    linksFound: 0,
    highRelevance: 0,
    mediumRelevance: 0,
    alreadyKnown: 0,
    newDiscoveries: 0,
  };

  try {
    for (const indexPage of enabledPages) {
      log(`\n${colors.bright}[${indexPage.payerName}]${colors.reset} ${indexPage.description}`);

      // Crawl the index page
      const links = await crawlIndexPage(browser, indexPage);
      stats.pagesProcessed++;

      if (links.length === 0) {
        log(`  No links found`, colors.yellow);
        continue;
      }

      stats.linksFound += links.length;

      // Classify links
      log(`  Classifying ${links.length} links...`, colors.dim);
      const classification = await classifyLinks(links, indexPage.payerName, {
        skipAI: options.skipAI,
      });

      stats.highRelevance += classification.high.length;
      stats.mediumRelevance += classification.medium.length;

      log(`    ${colors.green}${classification.high.length} high relevance${colors.reset}`);
      log(`    ${colors.yellow}${classification.medium.length} medium relevance${colors.reset}`);

      // Process relevant links
      const relevantLinks = [...classification.high, ...classification.medium];

      for (const item of relevantLinks) {
        const { link, confidence, reason } = item;

        // Skip if already in registry or discovered
        if (isInPolicyRegistry(link.href)) {
          stats.alreadyKnown++;
          continue;
        }

        if (!options.dryRun && isUrlAlreadyDiscovered(link.href)) {
          stats.alreadyKnown++;
          continue;
        }

        // Infer content type
        const contentType = link.href.toLowerCase().endsWith('.pdf') ? 'pdf' : 'html';

        // Infer policy type from link text
        let policyType = 'molecular_oncology';
        const textLower = (link.text + ' ' + link.context).toLowerCase();
        if (textLower.includes('liquid biopsy') || textLower.includes('ctdna')) {
          policyType = 'liquid_biopsy';
        } else if (textLower.includes('mrd') || textLower.includes('minimal residual')) {
          policyType = 'mrd';
        } else if (textLower.includes('tumor marker')) {
          policyType = 'tumor_markers';
        }

        // Stage the discovery
        if (!options.dryRun) {
          stageDiscoveredPolicy({
            payerId: indexPage.payerId,
            payerName: indexPage.payerName,
            url: link.href,
            linkText: link.text,
            linkContext: link.context,
            contentType,
            policyType,
            classificationConfidence: confidence,
            classificationReason: reason,
            sourcePageUrl: indexPage.url,
          });
        }

        stats.newDiscoveries++;
        log(`    ${colors.green}✓${colors.reset} ${link.text.slice(0, 60)}...`);
        log(`      ${colors.dim}${link.href}${colors.reset}`);
      }
    }
  } finally {
    await browser.close();

    if (!options.dryRun) {
      closeHashStore();
    }
  }

  // Print summary
  log(`\n${colors.green}${colors.bright}Discovery complete${colors.reset}`);
  log(`\n  ${colors.bright}Stats:${colors.reset}`);
  log(`    Pages crawled:     ${stats.pagesProcessed}`);
  log(`    Links found:       ${stats.linksFound}`);
  log(`    High relevance:    ${colors.green}${stats.highRelevance}${colors.reset}`);
  log(`    Medium relevance:  ${colors.yellow}${stats.mediumRelevance}${colors.reset}`);
  log(`    Already known:     ${colors.dim}${stats.alreadyKnown}${colors.reset}`);
  log(`    ${colors.bright}New discoveries:   ${colors.green}${stats.newDiscoveries}${colors.reset}`);

  if (!options.dryRun && stats.newDiscoveries > 0) {
    log(`\n  ${colors.bright}Next steps:${colors.reset}`);
    log(`    Review discoveries: ${colors.blue}node scripts/review-discoveries.js --list${colors.reset}`);
    log(`    Approve a policy:   ${colors.blue}node scripts/review-discoveries.js --approve <id>${colors.reset}`);
  }
}

// Run
discoverPolicies().catch((error) => {
  console.error('Discovery failed:', error);
  process.exit(1);
});
