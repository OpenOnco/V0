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
import Anthropic from '@anthropic-ai/sdk';
import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES, ALL_TEST_NAMES, MONITORED_VENDORS, PAYERS } from '../config.js';
import { matchTests, formatMatchesForPrompt } from '../data/test-dictionary.js';
import { computeDiff, truncateDiff } from '../utils/diff.js';
import { canonicalizeContent } from '../utils/canonicalize.js';

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

// Claude model for policy analysis
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Maximum content size to store for diffing (50KB)
const MAX_STORED_CONTENT_SIZE = 50000;

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

// =============================================================================
// PAYER CRAWL CONFIGURATION
// Extends config.js PAYERS with crawler-specific URLs and settings
// =============================================================================

// Crawl URLs for national commercial payers (Tier 1)
// URLs derived from reference data: domain + policyPath
const NATIONAL_COMMERCIAL_URLS = {
  uhc: {
    indexUrl: 'https://www.uhc.com/resources/policies',
    policyPages: [
      {
        path: '/content/provider/en/policies-protocols/commercial-policies/molecular-oncology-testing.html',
        description: 'Molecular Oncology Testing Policy',
      },
    ],
  },
  anthem: {
    indexUrl: 'https://www.anthem.com/provider/policies',
    policyPages: [],
  },
  centene: {
    indexUrl: 'https://www.ambetterhealth.com/provider',
    policyPages: [],
  },
  cigna: {
    indexUrl: 'https://www.cigna.com/health-care-providers/coverage-and-claims',
    policyPages: [],
  },
  humana: {
    indexUrl: 'https://www.humana.com/provider',
    policyPages: [],
  },
  molina: {
    indexUrl: 'https://www.molinahealthcare.com/providers',
    policyPages: [],
  },
  kaiser: {
    indexUrl: 'https://healthy.kaiserpermanente.org/',
    policyPages: [],
  },
  aetna: {
    indexUrl: 'https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html',
    policyPages: [
      { path: '/cpb/medical/data/100_199/0140.html', description: 'Genetic Testing CPB 0140' },
      { path: '/cpb/medical/data/400_499/0469.html', description: 'Tumor Markers CPB 0469' },
      { path: '/cpb/medical/data/700_799/0715.html', description: 'Liquid Biopsy CPB 0715' },
    ],
  },
};

// Crawl URLs for HCSC-operated BCBS plans
const HCSC_BCBS_URLS = {
  'hcsc-tx': {
    indexUrl: 'https://www.bcbstx.com/provider/medical-policies',
    policyPages: [],
  },
  'hcsc-il': {
    indexUrl: 'https://www.bcbsil.com/provider/medical-policies',
    policyPages: [],
  },
  'hcsc-mt': {
    indexUrl: 'https://www.bcbsmt.com/provider/medical-policies',
    policyPages: [],
  },
  'hcsc-ok': {
    indexUrl: 'https://www.bcbsok.com/provider/medical-policies',
    policyPages: [],
  },
  'hcsc-nm': {
    indexUrl: 'https://www.bcbsnm.com/provider/medical-policies',
    policyPages: [],
  },
};

// Crawl URLs for regional BCBS plans
const REGIONAL_BCBS_URLS = {
  // Tier 1 - Large regional
  highmark: {
    indexUrl: 'https://www.highmark.com/provider/medical-policy',
    policyPages: [],
  },
  floridablue: {
    indexUrl: 'https://www.floridablue.com/providers/medical-policies',
    policyPages: [],
  },
  // Tier 2 - Mid-sized regional
  bcbsm: {
    indexUrl: 'https://www.bcbsm.com/providers/medical-policies',
    policyPages: [],
  },
  bcbsnc: {
    indexUrl: 'https://www.bcbsnc.com/provider/medical-policies',
    policyPages: [],
  },
  bcbssc: {
    indexUrl: 'https://www.southcarolinablues.com/providers',
    policyPages: [],
  },
  bcbstn: {
    indexUrl: 'https://www.bcbst.com/providers/medical-policies',
    policyPages: [],
  },
  bcbsal: {
    indexUrl: 'https://www.bcbsal.org/providers/policies',
    policyPages: [],
  },
  bcbsla: {
    indexUrl: 'https://lablue.com/providers',
    policyPages: [],
  },
  bcbsaz: {
    indexUrl: 'https://www.azblue.com/providers/medical-policies',
    policyPages: [],
  },
  bcbsks: {
    indexUrl: 'https://www.bcbsks.com/providers',
    policyPages: [],
  },
  bcbskc: {
    indexUrl: 'https://www.bluekc.com/providers',
    policyPages: [],
  },
  bcbsne: {
    indexUrl: 'https://www.nebraskablue.com/providers',
    policyPages: [],
  },
  bcbsnd: {
    indexUrl: 'https://www.bcbsnd.com/providers',
    policyPages: [],
  },
  bcbswy: {
    indexUrl: 'https://www.bcbswy.com/providers',
    policyPages: [],
  },
  bcbsma: {
    indexUrl: 'https://www.bluecrossma.com/providers/medical-policies',
    policyPages: [],
  },
  bcbsri: {
    indexUrl: 'https://www.bcbsri.com/providers',
    policyPages: [],
  },
  bcbsvt: {
    indexUrl: 'https://www.bcbsvt.com/providers',
    policyPages: [],
  },
  bcbsmn: {
    indexUrl: 'https://www.bluecrossmn.com/providers',
    policyPages: [],
  },
  carefirst: {
    indexUrl: 'https://www.carefirst.com/providers/medical-policies',
    policyPages: [],
  },
  blueshieldca: {
    indexUrl: 'https://www.blueshieldca.com/provider/medical-policy',
    policyPages: [],
  },
  horizon: {
    indexUrl: 'https://www.horizonblue.com/providers/policies',
    policyPages: [],
  },
  excellus: {
    indexUrl: 'https://www.excellusbcbs.com/providers',
    policyPages: [],
  },
  empire: {
    indexUrl: 'https://www.empireblue.com/provider/policies',
    policyPages: [],
  },
  ibx: {
    indexUrl: 'https://www.ibx.com/providers/medical-policy',
    policyPages: [],
  },
  premera: {
    indexUrl: 'https://www.premera.com/provider/medical-policies',
    policyPages: [],
  },
  regence: {
    indexUrl: 'https://www.regence.com/provider/medical-policies',
    policyPages: [],
  },
  wellmark: {
    indexUrl: 'https://www.wellmark.com/providers/medical-policies',
    policyPages: [],
  },
  bcidaho: {
    indexUrl: 'https://www.bcidaho.com/providers',
    policyPages: [],
  },
  arkbcbs: {
    indexUrl: 'https://www.arkansasbluecross.com/providers',
    policyPages: [],
  },
};

// Crawl URLs for Medicare Advantage plans
const MEDICARE_ADVANTAGE_URLS = {
  'uhc-ma': {
    indexUrl: 'https://www.uhcprovider.com/content/provider/en/policies-protocols/medicare-advantage-policies.html',
    policyPages: [],
  },
  'humana-ma': {
    indexUrl: null, // TODO: Find Humana MA policy index URL
    policyPages: [],
  },
  'aetna-ma': {
    indexUrl: null, // TODO: Find Aetna MA policy index URL
    policyPages: [],
  },
  'bcbs-ma-plans': {
    indexUrl: null, // Regional - varies by BCBS plan
    policyPages: [],
  },
};

// Crawl URLs for Lab Benefit Managers
const LBM_URLS = {
  'evicore': {
    indexUrl: 'https://www.evicore.com/provider/clinical-guidelines',
    policyPages: [],
  },
  'aim': {
    indexUrl: 'https://aimspecialtyhealth.com/resources/clinical-guidelines/genetic-testing/',
    policyPages: [],
  },
  'avalon': {
    indexUrl: null, // TODO: Find Avalon HCS policy index URL
    policyPages: [],
  },
};

// Crawl URLs for other large regional/specialty payers (Tier 2)
const OTHER_LARGE_URLS = {
  oscar: {
    indexUrl: 'https://www.hioscar.com/providers',
    policyPages: [],
  },
  caresource: {
    indexUrl: 'https://www.caresource.com/providers',
    policyPages: [],
  },
  healthnet: {
    indexUrl: 'https://www.healthnet.com/providers',
    policyPages: [],
  },
  fidelis: {
    indexUrl: 'https://www.fideliscare.org/providers',
    policyPages: [],
  },
};

// Crawl URLs for regional/specialty plans (Tier 3)
const REGIONAL_URLS = {
  // Midwest
  medica: {
    indexUrl: 'https://www.medica.com/providers',
    policyPages: [],
  },
  healthpartners: {
    indexUrl: 'https://www.healthpartners.com/providers',
    policyPages: [],
  },
  ucare: {
    indexUrl: 'https://www.ucare.org/providers',
    policyPages: [],
  },
  priority: {
    indexUrl: 'https://www.priorityhealth.com/providers',
    policyPages: [],
  },
  mclaren: {
    indexUrl: 'https://www.mclarenhealthplan.org/providers',
    policyPages: [],
  },
  quartz: {
    indexUrl: 'https://quartzbenefits.com/providers',
    policyPages: [],
  },
  sanford: {
    indexUrl: 'https://www.sanfordhealthplan.com/providers',
    policyPages: [],
  },
  avera: {
    indexUrl: 'https://www.avera.org/health-plans',
    policyPages: [],
  },
  // Pennsylvania region
  geisinger: {
    indexUrl: 'https://www.geisinger.org/health-plan/providers',
    policyPages: [],
  },
  upmc: {
    indexUrl: 'https://www.upmchealthplan.com/providers',
    policyPages: [],
  },
  // New England
  tufts: {
    indexUrl: 'https://tuftshealthplan.com/providers',
    policyPages: [],
  },
  harvard: {
    indexUrl: 'https://www.harvardpilgrim.org/providers',
    policyPages: [],
  },
  fallon: {
    indexUrl: 'https://www.fallonhealth.org/providers',
    policyPages: [],
  },
  connecticare: {
    indexUrl: 'https://www.connecticare.com/providers',
    policyPages: [],
  },
  // New York region
  healthfirst: {
    indexUrl: 'https://healthfirst.org/providers',
    policyPages: [],
  },
  metroplus: {
    indexUrl: 'https://www.metroplus.org/providers',
    policyPages: [],
  },
  mvp: {
    indexUrl: 'https://www.mvphealthcare.com/providers',
    policyPages: [],
  },
  // California
  lacare: {
    indexUrl: 'https://www.lacare.org/providers',
    policyPages: [],
  },
  // Pacific Northwest
  selecthealth: {
    indexUrl: 'https://selecthealth.org/providers',
    policyPages: [],
  },
  providence: {
    indexUrl: 'https://providencehealthplan.com/providers',
    policyPages: [],
  },
  pacificsource: {
    indexUrl: 'https://www.pacificsource.com/providers',
    policyPages: [],
  },
  moda: {
    indexUrl: 'https://www.modahealth.com/providers',
    policyPages: [],
  },
  bridgespan: {
    indexUrl: 'https://bridgespanhealth.com/providers',
    policyPages: [],
  },
  // Hawaii
  hmsa: {
    indexUrl: 'https://hmsa.com/providers',
    policyPages: [],
  },
  // Southeast
  optima: {
    indexUrl: 'https://www.optimahealth.com/providers',
    policyPages: [],
  },
  sentara: {
    indexUrl: 'https://www.sentarahealthplans.com/providers',
    policyPages: [],
  },
  // Ohio
  medmutual: {
    indexUrl: 'https://www.medmutual.com/providers',
    policyPages: [],
  },
  // Multi-state
  amerihealth: {
    indexUrl: 'https://www.amerihealth.com/providers',
    policyPages: [],
  },
};

// Standard search terms for all payers
const STANDARD_SEARCH_TERMS = ['molecular', 'genetic', 'oncology', 'tumor', 'genomic', 'liquid biopsy', 'ctDNA', 'NGS'];

/**
 * Build PAYER_SOURCES array from config PAYERS + crawler URLs
 * Only includes payers with non-null indexUrl
 * Also returns list of skipped payers for logging
 */
function buildPayerSources() {
  const sources = [];
  const skipped = [];
  const allUrls = {
    ...NATIONAL_COMMERCIAL_URLS,
    ...HCSC_BCBS_URLS,
    ...REGIONAL_BCBS_URLS,
    ...MEDICARE_ADVANTAGE_URLS,
    ...LBM_URLS,
    ...OTHER_LARGE_URLS,
    ...REGIONAL_URLS,
  };

  // Process all payer categories
  const allPayers = [
    ...PAYERS.nationalCommercial,
    ...(PAYERS.hcscBCBS || []),
    ...PAYERS.regionalBCBS,
    ...PAYERS.medicareAdvantage,
    ...PAYERS.labBenefitManagers,
    ...PAYERS.otherLarge,
    ...(PAYERS.regional || []),
  ];

  for (const payer of allPayers) {
    const urls = allUrls[payer.id];

    // Track payers without URL configuration
    if (!urls || urls.indexUrl === null) {
      skipped.push(payer.name);
      continue;
    }

    // Extract base URL from index URL
    const urlObj = new URL(urls.indexUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

    sources.push({
      name: payer.name,
      id: payer.id,
      shortName: payer.shortName,
      baseUrl,
      policyIndexPages: [
        {
          url: urls.indexUrl,
          description: `${payer.shortName || payer.name} Medical Policies`,
          type: urls.indexType || 'index',
        },
      ],
      policyPages: (urls.policyPages || []).map(p => ({
        ...p,
        type: 'policy',
      })),
      searchTerms: STANDARD_SEARCH_TERMS,
      states: payer.states || null,
      notes: payer.notes || null,
    });
  }

  return { sources, skipped };
}

// Build the payer sources array
const { sources: PAYER_SOURCES, skipped: SKIPPED_PAYERS } = buildPayerSources();

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
    this.anthropic = config.anthropic?.apiKey ? new Anthropic({ apiKey: config.anthropic.apiKey }) : null;
  }

  /**
   * Load stored content hashes from disk
   * Handles both old format (string hash) and new format (object with hash, content, fetchedAt)
   */
  async loadHashes() {
    try {
      const data = await readFile(HASH_FILE_PATH, 'utf-8');
      const rawHashes = JSON.parse(data);

      // Normalize to new format, handling backward compatibility
      this.hashes = {};
      for (const [key, value] of Object.entries(rawHashes)) {
        if (typeof value === 'string') {
          // Old format: just the hash string
          this.hashes[key] = {
            hash: value,
            content: null, // No previous content available
            fetchedAt: null,
          };
        } else {
          // New format: object with hash, content, fetchedAt
          this.hashes[key] = value;
        }
      }

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
   * Analyze payer policy change using Claude AI
   * Uses deterministic test matching first, then Claude for additional analysis
   * @param {Object} payer - Payer info object
   * @param {string} url - URL of the changed page
   * @param {string} content - New page content
   * @param {Object} extractedData - Data extracted from the page
   * @param {Object|null} diff - Diff object from computeDiff (if available)
   * @returns {Object|null} Analysis results or null if unavailable
   */
  async analyzePayerChange(payer, url, content, extractedData, diff = null) {
    // Run deterministic test matching FIRST (before Claude)
    const deterministicMatches = matchTests(content);
    const formattedMatches = formatMatchesForPrompt(deterministicMatches);

    this.log('debug', `Deterministic matches for ${url}`, {
      matchCount: deterministicMatches.length,
      highConfidence: deterministicMatches.filter(m => m.confidence >= 0.75).length,
    });

    if (!this.anthropic) {
      this.log('debug', 'Claude analysis unavailable - no API key configured');
      // Return partial analysis with just deterministic matches
      return {
        isSignificantChange: deterministicMatches.length > 0,
        changeCategory: 'unknown',
        affectedTests: deterministicMatches.map(m => m.test.name),
        coveragePosition: null,
        effectiveDateDetected: extractedData.effectiveDates?.[0] || null,
        changeSummary: deterministicMatches.length > 0
          ? `Tests identified: ${deterministicMatches.map(m => m.test.name).join(', ')}`
          : 'Unable to analyze - no API key configured',
        confidenceLevel: 'low',
        deterministicMatches: deterministicMatches.map(m => ({
          testId: m.test.id,
          testName: m.test.name,
          matchType: m.matchType,
          confidence: m.confidence,
          matchedOn: m.matchedOn,
        })),
      };
    }

    try {
      // Format diff or fall back to truncated content
      let contentSection;
      if (diff) {
        // Use diff for more precise analysis
        const formattedDiff = truncateDiff(diff, 8000);
        contentSection = `=== WHAT CHANGED ON THIS PAGE ===
${formattedDiff}

=== CURRENT PAGE CONTENT (for context) ===
${content.slice(0, 5000)}${content.length > 5000 ? '\n...[content truncated]...' : ''}`;
      } else {
        // Fall back to full content if no diff available
        const maxContentLength = 15000;
        const truncatedContent = content.length > maxContentLength
          ? content.slice(0, maxContentLength) + '\n...[content truncated]...'
          : content;
        contentSection = `PAGE CONTENT:
${truncatedContent}`;
      }

      const prompt = `You are analyzing a payer medical policy page for changes. Your job is to determine if the detected change represents a REAL policy change that affects coverage decisions, or if it's just a cosmetic/minor update.

PAYER: ${payer.name}
URL: ${url}
PAGE TITLE: ${extractedData.title || 'Unknown'}
DETECTED EFFECTIVE DATES: ${extractedData.effectiveDates?.join(', ') || 'None found'}
DETECTED POLICY NUMBERS: ${extractedData.policyNumbers?.join(', ') || 'None found'}

=== DETERMINISTIC TEST MATCHES (pre-identified with high confidence) ===
${formattedMatches}

Please CONFIRM the tests listed above and identify any ADDITIONAL tests not already listed.
================================================================================

${contentSection}

Analyze this content and determine:

1. Is this a SIGNIFICANT policy change? (vs cosmetic updates like copyright year changes, CSS/layout changes, minor typo fixes, footer updates)

2. What category best describes this change?
   - policy_coverage_change: Actual coverage criteria changed (covered/not covered, medical necessity criteria)
   - effective_date_update: Policy effective date was updated
   - new_policy: This appears to be a newly published policy
   - procedure_code_change: CPT/HCPCS codes were added, removed, or modified
   - criteria_change: Medical necessity criteria or prior auth requirements changed
   - formatting_only: Only formatting, layout, or cosmetic changes
   - unknown: Cannot determine

3. Which specific diagnostic tests or vendor names are mentioned? Include the pre-identified tests above PLUS any additional ones you find. (e.g., Signatera, Guardant360, FoundationOne, Galleri, ctDNA tests, liquid biopsy tests)

4. What is the coverage position if determinable?
   - covered: Service/test is covered
   - not_covered: Service/test is explicitly not covered
   - conditional: Covered under specific conditions
   - prior_auth_required: Requires prior authorization
   - null: Cannot determine from content

5. If an effective date is mentioned for policy changes, what is it?

6. Brief summary of what changed (1-2 sentences)

7. How confident are you in this analysis? (high/medium/low)

Respond in JSON format:
{
  "isSignificantChange": boolean,
  "changeCategory": "policy_coverage_change" | "effective_date_update" | "new_policy" | "procedure_code_change" | "criteria_change" | "formatting_only" | "unknown",
  "affectedTests": ["array of test/vendor names mentioned - include pre-identified tests plus any additional"],
  "additionalTestsFound": ["only tests YOU found that were NOT in the pre-identified list"],
  "coveragePosition": "covered" | "not_covered" | "conditional" | "prior_auth_required" | null,
  "effectiveDateDetected": "date string or null",
  "changeSummary": "brief description",
  "confidenceLevel": "high" | "medium" | "low"
}`;

      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract JSON from response
      const responseText = response.content[0]?.text || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        this.log('warn', 'Claude response did not contain valid JSON', { url });
        // Return deterministic matches only
        return {
          isSignificantChange: deterministicMatches.length > 0,
          changeCategory: 'unknown',
          affectedTests: deterministicMatches.map(m => m.test.name),
          coveragePosition: null,
          effectiveDateDetected: extractedData.effectiveDates?.[0] || null,
          changeSummary: 'Claude analysis failed - using deterministic matches only',
          confidenceLevel: 'low',
          deterministicMatches: deterministicMatches.map(m => ({
            testId: m.test.id,
            testName: m.test.name,
            matchType: m.matchType,
            confidence: m.confidence,
            matchedOn: m.matchedOn,
          })),
        };
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Merge deterministic matches with Claude's analysis
      // Deterministic matches are stored separately for transparency
      analysis.deterministicMatches = deterministicMatches.map(m => ({
        testId: m.test.id,
        testName: m.test.name,
        matchType: m.matchType,
        confidence: m.confidence,
        matchedOn: m.matchedOn,
      }));

      // Ensure affectedTests includes all deterministic matches
      const deterministicTestNames = deterministicMatches.map(m => m.test.name);
      const allTests = [...new Set([...deterministicTestNames, ...(analysis.affectedTests || [])])];
      analysis.affectedTests = allTests;

      this.log('debug', `Claude analysis complete for ${url}`, {
        isSignificant: analysis.isSignificantChange,
        category: analysis.changeCategory,
        confidence: analysis.confidenceLevel,
        deterministicMatchCount: deterministicMatches.length,
        totalTestsFound: allTests.length,
      });

      return analysis;
    } catch (error) {
      this.log('warn', 'Claude analysis failed', { url, error: error.message });
      // Return deterministic matches on error
      return {
        isSignificantChange: deterministicMatches.length > 0,
        changeCategory: 'unknown',
        affectedTests: deterministicMatches.map(m => m.test.name),
        coveragePosition: null,
        effectiveDateDetected: extractedData.effectiveDates?.[0] || null,
        changeSummary: `Claude analysis error: ${error.message}`,
        confidenceLevel: 'low',
        deterministicMatches: deterministicMatches.map(m => ({
          testId: m.test.id,
          testName: m.test.name,
          matchType: m.matchType,
          confidence: m.confidence,
          matchedOn: m.matchedOn,
        })),
      };
    }
  }

  /**
   * Check if URL is an Anthem domain (requires HTTP/1.1)
   */
  isAnthemDomain(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return hostname.includes('anthem.com') || hostname.includes('anthem.');
    } catch {
      return false;
    }
  }

  /**
   * Fallback fetch using Node.js https module with HTTP/1.1
   * Used for domains that have HTTP/2 protocol issues (e.g., Anthem)
   */
  async fetchWithHttp1(url) {
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
          'Upgrade-Insecure-Requests': '1',
        },
        // Force HTTP/1.1 by disabling ALPN negotiation for HTTP/2
        ALPNProtocols: ['http/1.1'],
      };

      const req = client.request(options, (res) => {
        // Handle redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href;
          this.fetchWithHttp1(redirectUrl).then(resolve).catch(reject);
          return;
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
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
   * Parse HTML content and extract data (for HTTP/1.1 fallback)
   */
  parseHtmlContent(html, url) {
    // Simple HTML text extraction (without browser)
    // Remove script and style tags
    let content = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');

    // Extract text from HTML
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

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract headings
    const headings = [];
    const headingMatches = html.matchAll(/<h[1-4][^>]*>([^<]*)<\/h[1-4]>/gi);
    for (const match of headingMatches) {
      const text = match[1].trim();
      if (text && text.length > 5 && text.length < 200) {
        headings.push(text);
      }
    }

    // Extract links
    const links = [];
    const linkMatches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi);
    for (const match of linkMatches) {
      const href = match[1];
      const text = match[2].trim();
      if (
        (href.includes('policy') ||
          href.includes('bulletin') ||
          href.includes('coverage') ||
          href.includes('cpb') ||
          href.includes('.pdf')) &&
        text &&
        text.length > 5
      ) {
        links.push({
          text,
          href: href.startsWith('http') ? href : new URL(href, url).href,
        });
      }
    }

    // Look for effective dates
    const effectiveDates = [];
    const effectiveDatePatterns = [
      /effective\s*(?:date)?[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
      /effective\s*(?:date)?[:\s]+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/gi,
    ];
    effectiveDatePatterns.forEach((pattern) => {
      const matches = content.match(pattern) || [];
      effectiveDates.push(...matches.slice(0, 5));
    });

    // Look for policy numbers
    const policyNumbers = [];
    const policyPatterns = [
      /policy\s*(?:number|#|no\.?)?\s*[:\s]*([A-Z0-9\-]+)/gi,
      /CPB\s*#?\s*(\d+)/gi,
    ];
    policyPatterns.forEach((pattern) => {
      const matches = content.match(pattern) || [];
      policyNumbers.push(...matches.slice(0, 5));
    });

    return {
      content,
      extractedData: {
        title,
        headings,
        policies: headings,
        links,
        effectiveDates,
        lastUpdated: null,
        policyNumbers,
      },
      url,
    };
  }

  /**
   * Fetch page content using Playwright with retry logic
   */
  async fetchPage(url, options = {}) {
    const { retries = MAX_RETRIES } = options;
    let lastError = null;
    const isAnthem = this.isAnthemDomain(url);

    // For Anthem domains, try HTTP/1.1 fallback first to avoid HTTP/2 protocol errors
    if (isAnthem) {
      this.log('debug', `Using HTTP/1.1 fallback for Anthem domain: ${url}`);
      try {
        const html = await this.fetchWithHttp1(url);
        const result = this.parseHtmlContent(html, url);
        this.log('debug', `HTTP/1.1 fallback successful for ${url}`);
        return result;
      } catch (http1Error) {
        this.log('warn', `HTTP/1.1 fallback failed for ${url}, trying Playwright`, { error: http1Error.message });
        // Fall through to Playwright attempt
      }
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      const browser = await this.launchBrowser();

      // Configure context options
      const contextOptions = {
        userAgent: USER_AGENT,
        viewport: { width: 1920, height: 1080 },
      };

      // For Anthem, add extra options to help with potential issues
      if (isAnthem) {
        contextOptions.ignoreHTTPSErrors = true;
      }

      const context = await browser.newContext(contextOptions);

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

    // Log skipped payers (no URL configured)
    if (SKIPPED_PAYERS.length > 0) {
      this.log('warn', `Skipping ${SKIPPED_PAYERS.length} payers with no URL configured: ${SKIPPED_PAYERS.join(', ')}`);
    }

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

            // Canonicalize content for hash comparison (removes dynamic elements)
            // Raw content is still used for Claude analysis
            const canonicalizedContent = canonicalizeContent(content);
            const newHash = this.computeHash(canonicalizedContent);
            const hashKey = `${payer.id}:index:${indexPage.url}`;
            const oldHash = this.hashes[hashKey];

            pagesProcessed++;

            const matchedKeywords = this.findMatchedKeywords(content);
            const relevantTests = this.findRelevantTests(content);
            const oldHashData = this.hashes[hashKey];
            const oldHashValue = oldHashData?.hash || null;
            const changeType = this.detectChangeType(content, extractedData, oldHashValue);

            if (newHash !== oldHashValue) {
              pagesChanged++;
              const isFirstCrawl = !oldHashValue;

              this.log('info', `Content ${isFirstCrawl ? 'captured' : 'changed'}: ${indexPage.url}`);

              // Compute diff (returns isFirstCrawl: true if no previous content)
              const previousContent = oldHashData?.content || null;
              const diff = computeDiff(previousContent, content);

              // Store new hash with content snapshot
              this.hashes[hashKey] = {
                hash: newHash,
                content: content.slice(0, MAX_STORED_CONTENT_SIZE),
                fetchedAt: new Date().toISOString(),
              };

              if (!isFirstCrawl && !diff.isFirstCrawl) {
                // Use Claude to analyze if this is a significant change
                const claudeAnalysis = await this.analyzePayerChange(
                  payer,
                  indexPage.url,
                  content,
                  extractedData,
                  diff
                );

                // Only create discoveries if Claude says significant, or if Claude unavailable (fallback)
                const shouldCreateDiscovery = claudeAnalysis === null || claudeAnalysis.isSignificantChange;

                if (shouldCreateDiscovery) {
                  const indexDiscoveries = this.createDiscoveriesFromIndexChange(
                    payer,
                    indexPage,
                    { matchedKeywords, relevantTests, changeType, claudeAnalysis },
                    extractedData
                  );
                  discoveries.push(...indexDiscoveries);
                } else {
                  this.log('info', `Skipping non-significant change (${claudeAnalysis.changeCategory}): ${indexPage.url}`);
                }
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

            // Canonicalize content for hash comparison (removes dynamic elements)
            // Raw content is still used for Claude analysis
            const canonicalizedContent = canonicalizeContent(content);
            const newHash = this.computeHash(canonicalizedContent);
            const hashKey = `${payer.id}:policy:${url}`;
            const oldHashData = this.hashes[hashKey];
            const oldHashValue = oldHashData?.hash || null;

            pagesProcessed++;

            const matchedKeywords = this.findMatchedKeywords(content);
            const relevantTests = this.findRelevantTests(content);
            const changeType = this.detectChangeType(content, extractedData, oldHashValue);

            if (newHash !== oldHashValue) {
              pagesChanged++;
              const isFirstCrawl = !oldHashValue;

              this.log('info', `Content ${isFirstCrawl ? 'captured' : 'changed'}: ${url}`);

              // Compute diff (returns isFirstCrawl: true if no previous content)
              const previousContent = oldHashData?.content || null;
              const diff = computeDiff(previousContent, content);

              // Store new hash with content snapshot
              this.hashes[hashKey] = {
                hash: newHash,
                content: content.slice(0, MAX_STORED_CONTENT_SIZE),
                fetchedAt: new Date().toISOString(),
              };

              if (!isFirstCrawl && !diff.isFirstCrawl) {
                // Use Claude to analyze if this is a significant change
                const claudeAnalysis = await this.analyzePayerChange(
                  payer,
                  url,
                  content,
                  extractedData,
                  diff
                );

                // Only create discoveries if Claude says significant, or if Claude unavailable (fallback)
                const shouldCreateDiscovery = claudeAnalysis === null || claudeAnalysis.isSignificantChange;

                if (shouldCreateDiscovery) {
                  const discovery = this.createPolicyPageDiscovery(
                    payer,
                    policyPage,
                    url,
                    { matchedKeywords, relevantTests, changeType, claudeAnalysis },
                    extractedData,
                    content
                  );
                  if (discovery) {
                    discoveries.push(discovery);
                  }
                } else {
                  this.log('info', `Skipping non-significant change (${claudeAnalysis.changeCategory}): ${url}`);
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

            // Canonicalize content for hash comparison (removes dynamic elements)
            // Raw content is still used for Claude analysis
            const canonicalizedContent = canonicalizeContent(content);
            const newHash = this.computeHash(canonicalizedContent);
            const hashKey = `vendor:${vendor.id}:${url}`;
            const oldHashData = this.hashes[hashKey];
            const oldHashValue = oldHashData?.hash || null;

            pagesProcessed++;

            if (newHash !== oldHashValue) {
              pagesChanged++;
              const isFirstCrawl = !oldHashValue;

              this.log('info', `Content ${isFirstCrawl ? 'captured' : 'changed'}: ${url}`);

              // Compute diff (returns isFirstCrawl: true if no previous content)
              const previousContent = oldHashData?.content || null;
              const diff = computeDiff(previousContent, content);

              // Store new hash with content snapshot
              this.hashes[hashKey] = {
                hash: newHash,
                content: content.slice(0, MAX_STORED_CONTENT_SIZE),
                fetchedAt: new Date().toISOString(),
              };

              if (!isFirstCrawl && !diff.isFirstCrawl) {
                // Use Claude to analyze if this is a significant change
                // For vendor pages, create a pseudo-payer object for the analysis
                const claudeAnalysis = await this.analyzePayerChange(
                  { name: vendor.name, id: vendor.id },
                  url,
                  content,
                  extractedData,
                  diff
                );

                // Only create discoveries if Claude says significant, or if Claude unavailable (fallback)
                const shouldCreateDiscovery = claudeAnalysis === null || claudeAnalysis.isSignificantChange;

                if (shouldCreateDiscovery) {
                  const discovery = this.createVendorCoverageDiscovery(vendor, page, url, extractedData, content, claudeAnalysis);
                  if (discovery) {
                    discoveries.push(discovery);
                  }
                } else {
                  this.log('info', `Skipping non-significant change (${claudeAnalysis.changeCategory}): ${url}`);
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
    const { matchedKeywords, relevantTests, changeType, claudeAnalysis } = analysisData;

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
        summary: claudeAnalysis?.changeSummary || this.generateChangeSummary(payer, indexPage, analysisData, extractedData),
        url: indexPage.url,
        relevance: this.calculateRelevance(analysisData),
        metadata: {
          // Spec-required fields
          payer: payer.name,
          policyId: extractedData.policyNumbers?.[0] || null,
          policyTitle: indexPage.description,
          effectiveDate: claudeAnalysis?.effectiveDateDetected || extractedData.effectiveDates?.[0] || null,
          changeType: specChangeType,
          snippet: null, // Index pages don't have meaningful snippets
          matchedKeywords,
          // Additional useful fields
          payerId: payer.id,
          lastUpdated: extractedData.lastUpdated || null,
          relevantTests: claudeAnalysis?.affectedTests?.length > 0 ? claudeAnalysis.affectedTests : relevantTests,
          // Claude AI analysis
          aiAnalysis: claudeAnalysis ? {
            changeCategory: claudeAnalysis.changeCategory,
            coveragePosition: claudeAnalysis.coveragePosition,
            confidenceLevel: claudeAnalysis.confidenceLevel,
            changeSummary: claudeAnalysis.changeSummary,
          } : null,
          // Deterministic test matches (high confidence, rule-based)
          deterministicMatches: claudeAnalysis?.deterministicMatches || [],
          // Tests found by LLM that weren't in deterministic matches
          llmSuggestedTests: claudeAnalysis?.additionalTestsFound || [],
        },
      });
    }

    return discoveries;
  }

  /**
   * Create discovery from a specific policy link
   */
  createPolicyLinkDiscovery(payer, link, analysisData, extractedData) {
    const { matchedKeywords, relevantTests, changeType, claudeAnalysis } = analysisData;
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
      summary: claudeAnalysis?.changeSummary || `${payer.name} policy ${isNew ? 'published' : 'updated'}. ${
        extractedData.effectiveDates?.[0] ? `Effective: ${extractedData.effectiveDates[0]}` : ''
      }`.trim(),
      url: link.href,
      relevance: this.calculateRelevanceFromText(link.text),
      metadata: {
        // Spec-required fields
        payer: payer.name,
        policyId,
        policyTitle: link.text,
        effectiveDate: claudeAnalysis?.effectiveDateDetected || extractedData.effectiveDates?.[0] || null,
        changeType: specChangeType,
        snippet: null,
        matchedKeywords,
        // Additional useful fields
        payerId: payer.id,
        relevantTests: claudeAnalysis?.affectedTests?.length > 0 ? claudeAnalysis.affectedTests : relevantTests,
        // Claude AI analysis
        aiAnalysis: claudeAnalysis ? {
          changeCategory: claudeAnalysis.changeCategory,
          coveragePosition: claudeAnalysis.coveragePosition,
          confidenceLevel: claudeAnalysis.confidenceLevel,
          changeSummary: claudeAnalysis.changeSummary,
        } : null,
        // Deterministic test matches (high confidence, rule-based)
        deterministicMatches: claudeAnalysis?.deterministicMatches || [],
        // Tests found by LLM that weren't in deterministic matches
        llmSuggestedTests: claudeAnalysis?.additionalTestsFound || [],
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
    const { matchedKeywords, relevantTests, changeType, claudeAnalysis } = analysisData;
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
      summary: claudeAnalysis?.changeSummary || this.generateChangeSummary(payer, policyPage, analysisData, extractedData),
      url,
      relevance: this.calculateRelevance(analysisData),
      metadata: {
        // Spec-required fields
        payer: payer.name,
        policyId: extractedData.policyNumbers?.[0] || null,
        policyTitle: policyPage.description,
        effectiveDate: claudeAnalysis?.effectiveDateDetected || extractedData.effectiveDates?.[0] || null,
        changeType: specChangeType,
        snippet,
        matchedKeywords,
        // Additional useful fields
        payerId: payer.id,
        lastUpdated: extractedData.lastUpdated || null,
        relevantTests: claudeAnalysis?.affectedTests?.length > 0 ? claudeAnalysis.affectedTests : relevantTests,
        // Claude AI analysis
        aiAnalysis: claudeAnalysis ? {
          changeCategory: claudeAnalysis.changeCategory,
          coveragePosition: claudeAnalysis.coveragePosition,
          confidenceLevel: claudeAnalysis.confidenceLevel,
          changeSummary: claudeAnalysis.changeSummary,
        } : null,
        // Deterministic test matches (high confidence, rule-based)
        deterministicMatches: claudeAnalysis?.deterministicMatches || [],
        // Tests found by LLM that weren't in deterministic matches
        llmSuggestedTests: claudeAnalysis?.additionalTestsFound || [],
      },
    };
  }

  /**
   * Create discovery from vendor coverage page change
   */
  createVendorCoverageDiscovery(vendor, page, url, extractedData, content = '', claudeAnalysis = null) {
    // Use page-defined test names if available, otherwise try to find them
    const relevantTests = claudeAnalysis?.affectedTests?.length > 0
      ? claudeAnalysis.affectedTests
      : (page.testNames || this.findRelevantTests(extractedData.title || content));
    const snippet = this.extractSnippet(content, SEARCH_KEYWORDS, 500);

    return {
      source: SOURCES.PAYERS,
      type: DISCOVERY_TYPES.COVERAGE_CHANGE,
      title: `${vendor.name}: ${page.description} Updated`,
      summary: claudeAnalysis?.changeSummary || `Coverage/reimbursement information updated on ${vendor.name} website. ${
        relevantTests.length > 0 ? `Tests: ${relevantTests.join(', ')}` : ''
      }`.trim(),
      url,
      relevance: 'high', // Vendor coverage updates are always high relevance
      metadata: {
        // Use 'payer' field for consistency (vendor acts as source here)
        payer: vendor.name,
        policyId: null, // Vendor pages don't have policy IDs
        policyTitle: page.description,
        effectiveDate: claudeAnalysis?.effectiveDateDetected || extractedData.effectiveDates?.[0] || null,
        changeType: 'revision', // Vendor coverage pages are always revisions (we saw them before)
        snippet,
        matchedKeywords: this.findMatchedKeywords(content),
        // Additional fields
        vendorId: vendor.id,
        lastUpdated: extractedData.lastUpdated || null,
        relevantTests,
        pageType: 'vendor_coverage',
        // Claude AI analysis
        aiAnalysis: claudeAnalysis ? {
          changeCategory: claudeAnalysis.changeCategory,
          coveragePosition: claudeAnalysis.coveragePosition,
          confidenceLevel: claudeAnalysis.confidenceLevel,
          changeSummary: claudeAnalysis.changeSummary,
        } : null,
        // Deterministic test matches (high confidence, rule-based)
        deterministicMatches: claudeAnalysis?.deterministicMatches || [],
        // Tests found by LLM that weren't in deterministic matches
        llmSuggestedTests: claudeAnalysis?.additionalTestsFound || [],
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
