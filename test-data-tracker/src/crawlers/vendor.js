/**
 * Vendor Website Crawler
 * Monitors test manufacturer news/press release pages for coverage announcements
 *
 * Uses Playwright to render JS-heavy pages, hash-based change detection,
 * and Claude API to identify coverage-related announcements.
 */

import Anthropic from '@anthropic-ai/sdk';
import { PlaywrightCrawler, USER_AGENT } from './playwright-base.js';
import { config, DISCOVERY_TYPES, SOURCES, MONITORED_VENDORS } from '../config.js';
import { writeToPhysicianDb, writePublicationsToPhysicianDb, isPhysicianDbConfigured } from './physician-db-writer.js';
import { resolvePublications } from './publication-resolver.js';
import { matchTests, formatMatchesForPrompt, lookupTestByName } from '../data/test-dictionary.js';
import { computeDiff, truncateDiff } from '../utils/diff.js';
import { canonicalizeContent } from '../utils/canonicalize.js';
import { initializeCLFS, lookupPLARate, extractPLACodes } from '../utils/medicare-rates.js';
import { isRelevantContent, getMatchingCategories } from '../utils/extraction-patterns.js';
import { createProposal } from '../proposals/queue.js';
import { PROPOSAL_TYPES } from '../proposals/schema.js';

// Claude model for coverage analysis
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// Maximum content size to store for diffing (50KB)
const MAX_STORED_CONTENT_SIZE = 50000;

// Vendor PAP/Billing pages to monitor - TOP PRIORITY for financial intelligence
const VENDOR_PAP_SOURCES = [
  {
    id: 'natera',
    name: 'Natera',
    papUrl: 'https://www.natera.com/oncology/billing/',
    tests: ['Signatera', 'Prospera', 'Panorama'],
  },
  {
    id: 'guardant',
    name: 'Guardant Health',
    papUrl: 'https://guardanthealth.com/patients/billing-financial-assistance/',
    tests: ['Guardant360 CDx', 'Guardant Reveal', 'Shield'],
  },
  {
    id: 'foundation',
    name: 'Foundation Medicine',
    papUrl: 'https://www.foundationmedicine.com/resource/billing-and-financial-assistance',
    tests: ['FoundationOne CDx', 'FoundationOne Liquid CDx', 'FoundationOne Tracker'],
  },
  {
    id: 'grail',
    name: 'GRAIL',
    papUrl: 'https://www.galleri.com/patient/coverage-cost',
    tests: ['Galleri'],
  },
  {
    id: 'exact-sciences',
    name: 'Exact Sciences',
    papUrl: 'https://www.exactsciences.com/patients/patient-assistance',
    tests: ['Cologuard', 'Oncotype DX', 'Oncodetect'],
  },
  {
    id: 'myriad',
    name: 'Myriad Genetics',
    papUrl: 'https://myriad.com/patients/patient-financial-assistance/',
    tests: ['myRisk', 'BRACAnalysis', 'MyChoice CDx'],
  },
  {
    id: 'tempus',
    name: 'Tempus',
    papUrl: 'https://www.tempus.com/patients/billing/',
    tests: ['Tempus xT CDx', 'Tempus xF', 'Tempus xM MRD'],
  },
  {
    id: 'adaptive',
    name: 'Adaptive Biotechnologies',
    papUrl: 'https://www.adaptivebiotech.com/patients/',
    tests: ['clonoSEQ'],
  },
  {
    id: 'neogenomics',
    name: 'NeoGenomics',
    papUrl: 'https://neogenomics.com/patients',
    tests: ['RaDaR'],
  },
  {
    id: 'caris',
    name: 'Caris Life Sciences',
    papUrl: 'https://www.carislifesciences.com/patients/',
    tests: ['Caris MI Profile', 'Caris Assure'],
  },
  {
    id: 'invitae',
    name: 'Invitae',
    papUrl: 'https://www.invitae.com/en/patient-resources',
    tests: ['Invitae PCM'],
  },
];

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

  // Additional high-priority vendors
  {
    name: 'SOPHiA GENETICS',
    id: 'sophia',
    newsUrl: 'https://www.sophiagenetics.com/news-room/',
  },
  {
    name: 'Genomic Testing Cooperative',
    id: 'gtc',
    newsUrl: 'https://genomictestingcooperative.com/category/press-release/',
  },
  {
    name: 'Roche Diagnostics',
    id: 'roche',
    newsUrl: 'https://www.roche.com/media/releases',
  },
  {
    name: 'Illumina',
    id: 'illumina',
    newsUrl: 'https://www.illumina.com/company/news-center/press-releases.html',
  },
  {
    name: 'QIAGEN',
    id: 'qiagen',
    newsUrl: 'https://corporate.qiagen.com/newsroom/press-releases/default.aspx',
  },
  {
    name: 'Thermo Fisher Scientific',
    id: 'thermofisher',
    newsUrl: 'https://newsroom.thermofisher.com/newsroom/press-releases/default.aspx',
  },
];

export class VendorCrawler extends PlaywrightCrawler {
  constructor() {
    super({
      name: config.crawlers.vendor?.name || 'Vendors',
      source: SOURCES.VENDOR,
      description: config.crawlers.vendor?.description || 'Vendor coverage announcements',
      rateLimit: config.crawlers.vendor?.rateLimit || 3,
      enabled: config.crawlers.vendor?.enabled ?? true,
      // Vendor sites are faster than payer sites
      rateLimitMs: 3000,
    });

    this.vendors = VENDOR_SOURCES;
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
   * Use Claude to analyze vendor news for comprehensive intelligence extraction
   * Extracts: coverage announcements, PLA codes, clinical evidence, performance data,
   * regulatory updates, new indications, and new test launches.
   *
   * @param {Object} vendor - Vendor info object
   * @param {string} content - Page content
   * @param {string[]} headlines - Extracted headlines
   * @param {Object|null} diff - Diff object from computeDiff (if available)
   * @returns {Promise<Object|null>} Comprehensive analysis result
   */
  async analyzeCoverageContent(vendor, content, headlines, diff = null) {
    // Run deterministic test matching FIRST (before Claude)
    const fullContent = `${headlines.join('\n')}\n${content}`;
    const deterministicMatches = matchTests(fullContent);
    const formattedMatches = formatMatchesForPrompt(deterministicMatches);

    // Extract PLA codes from content
    const foundPLACodes = extractPLACodes(fullContent);

    this.log('debug', `Deterministic matches for ${vendor.name}`, {
      matchCount: deterministicMatches.length,
      highConfidence: deterministicMatches.filter(m => m.confidence >= 0.75).length,
      plaCodes: foundPLACodes.length,
    });

    if (!this.anthropic) {
      this.log('warn', 'Anthropic API key not configured, skipping Claude analysis');
      // Return partial analysis with just deterministic matches if any found
      if (deterministicMatches.length > 0 || foundPLACodes.length > 0) {
        return {
          hasCoverageNews: false,
          announcements: [],
          plaCodes: foundPLACodes.map(code => ({ code, testName: null, isNew: false })),
          clinicalEvidence: [],
          performanceData: [],
          regulatoryUpdates: [],
          newIndications: [],
          newTests: [],
          deterministicMatches: deterministicMatches.map(m => ({
            testId: m.test.id,
            testName: m.test.name,
            matchType: m.matchType,
            confidence: m.confidence,
            matchedOn: m.matchedOn,
          })),
        };
      }
      return null;
    }

    // Format content section - use diff if available for more precise analysis
    let contentSection;
    if (diff) {
      const formattedDiff = truncateDiff(diff, 5000);
      contentSection = `=== WHAT CHANGED ON THIS PAGE ===
${formattedDiff}

=== CURRENT HEADLINES ===
${headlines.slice(0, 10).join('\n')}

=== CURRENT PAGE CONTENT (for context) ===
${content.slice(0, 2000)}${content.length > 2000 ? '\n...[content truncated]...' : ''}`;
    } else {
      contentSection = `RECENT HEADLINES:
${headlines.slice(0, 10).join('\n')}

PAGE CONTENT (excerpt):
${content.slice(0, 4000)}`;
    }

    // Prepare content for analysis
    const analysisContent = [
      `VENDOR: ${vendor.name}`,
      '',
      '=== DETERMINISTIC TEST MATCHES (pre-identified with high confidence) ===',
      formattedMatches,
      '================================================================================',
      '',
      foundPLACodes.length > 0 ? `=== PLA CODES FOUND IN CONTENT ===\n${foundPLACodes.join(', ')}\n================================================================================\n` : '',
      contentSection,
    ].join('\n');

    try {
      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Analyze this vendor news page for comprehensive intelligence extraction.

${analysisContent}

TASK: ${diff ? 'Based on the changes detected, extract' : 'Extract'} ALL of the following information categories:

1. **Coverage Announcements** - Insurance coverage, reimbursement decisions, CMS determinations, payer partnerships
2. **PLA/CPT Codes** - Any codes mentioned (format: 0XXXU for PLA), which test, is it newly assigned?
3. **Clinical Evidence / Publications** - IMPORTANT: Extract enough detail to find the paper on PubMed:
   - Trial/study name (CIRCULATE, DYNAMIC, GALAXY, etc.)
   - Journal name (NEJM, JCO, Lancet Oncology, Nature Medicine, etc.)
   - NCT ID, PMID, or DOI if mentioned
   - First author's last name if mentioned
   - Publication date/year
4. **Performance Data** - Sensitivity, specificity, PPV, NPV with cancer type/stage context
5. **Regulatory Updates** - FDA actions (approval, clearance, breakthrough designation) with dates and indications
6. **New Indications** - New cancer types or clinical settings for existing tests
7. **New Test Launches** - New products announced

Note: Tests have been pre-identified above using deterministic matching. Confirm these and identify any ADDITIONAL tests.

Respond with JSON ONLY (no markdown, no explanation):
{
  "hasCoverageNews": true/false,
  "announcements": [
    {
      "headline": "The announcement headline",
      "payerName": "Name of payer if mentioned (or null)",
      "testName": "Name of test (or null)",
      "coverageType": "medicare | medicaid | commercial | medicare_advantage | null",
      "effectiveDate": "Date if mentioned (or null)",
      "summary": "Brief summary"
    }
  ],
  "plaCodes": [
    {
      "code": "0XXXU",
      "testName": "Associated test name (or null)",
      "isNew": true/false,
      "context": "Brief context of how code was mentioned"
    }
  ],
  "clinicalEvidence": [
    {
      "trialName": "Trial or study name (e.g., CIRCULATE, DYNAMIC, GALAXY)",
      "nctId": "NCT ID if available (e.g., NCT04264702)",
      "journal": "Journal name if mentioned (e.g., NEJM, JCO, Lancet Oncology)",
      "pmid": "PubMed ID if mentioned (numeric only)",
      "doi": "DOI if mentioned (e.g., 10.1056/NEJMoa2305032)",
      "firstAuthor": "First author's last name if mentioned",
      "testName": "Associated test name",
      "cancerType": "Cancer type (colorectal, breast, lung, etc.)",
      "findings": "Key findings summary",
      "publicationDate": "Publication date if mentioned (YYYY-MM or YYYY)"
    }
  ],
  "performanceData": [
    {
      "testName": "Test name",
      "metric": "sensitivity | specificity | ppv | npv | accuracy",
      "value": "Numeric value with % if applicable",
      "cancerType": "Cancer type context",
      "stage": "Stage context if available (or null)",
      "population": "Study population context"
    }
  ],
  "regulatoryUpdates": [
    {
      "testName": "Test name",
      "action": "FDA approval | FDA clearance | breakthrough designation | de novo | etc",
      "indication": "Approved indication",
      "date": "Date if available (or null)"
    }
  ],
  "newIndications": [
    {
      "testName": "Test name",
      "indication": "New cancer type or clinical setting",
      "date": "Date if available (or null)"
    }
  ],
  "newTests": [
    {
      "testName": "New test name",
      "vendor": "${vendor.name}",
      "category": "mrd | tds | ecd | hct | trm | cgp",
      "description": "Brief description",
      "launchDate": "Date if available (or null)"
    }
  ],
  "additionalTestsFound": ["tests found by LLM NOT in pre-identified list"]
}

If a category has no items, use an empty array []. Respond ONLY with valid JSON.`,
          },
        ],
      });

      const responseText = response.content[0]?.text?.trim();
      if (!responseText) {
        return this.buildEmptyAnalysisResult(deterministicMatches, foundPLACodes);
      }

      // Parse JSON response - handle potential markdown code fences
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const result = JSON.parse(jsonText);

      // Add deterministic matches to result
      result.deterministicMatches = deterministicMatches.map(m => ({
        testId: m.test.id,
        testName: m.test.name,
        matchType: m.matchType,
        confidence: m.confidence,
        matchedOn: m.matchedOn,
      }));

      // Look up Medicare rates for any PLA codes found
      if (result.plaCodes && result.plaCodes.length > 0) {
        for (const plaItem of result.plaCodes) {
          try {
            const rateInfo = await lookupPLARate(plaItem.code);
            plaItem.medicareRate = rateInfo.rate;
            plaItem.medicareStatus = rateInfo.status;
            plaItem.medicareEffective = rateInfo.effective;
            plaItem.adltStatus = rateInfo.adltStatus;
          } catch (e) {
            this.log('debug', `Failed to lookup rate for ${plaItem.code}: ${e.message}`);
          }
        }
      }

      return result;
    } catch (error) {
      this.log('warn', `Claude analysis failed for ${vendor.name}`, { error: error.message });
      return this.buildEmptyAnalysisResult(deterministicMatches, foundPLACodes);
    }
  }

  /**
   * Build empty analysis result with deterministic matches
   */
  buildEmptyAnalysisResult(deterministicMatches, foundPLACodes = []) {
    return {
      hasCoverageNews: false,
      announcements: [],
      plaCodes: foundPLACodes.map(code => ({ code, testName: null, isNew: false })),
      clinicalEvidence: [],
      performanceData: [],
      regulatoryUpdates: [],
      newIndications: [],
      newTests: [],
      deterministicMatches: deterministicMatches.map(m => ({
        testId: m.test.id,
        testName: m.test.name,
        matchType: m.matchType,
        confidence: m.confidence,
        matchedOn: m.matchedOn,
      })),
    };
  }

  /**
   * Analyze vendor PAP/billing page for financial intelligence
   * Extracts: cash prices, PAP programs, payment plans, copay assistance
   *
   * @param {Object} vendor - Vendor info object
   * @param {string} content - Page content
   * @param {Object|null} diff - Diff object from computeDiff (if available)
   * @returns {Promise<Object|null>} Financial analysis result
   */
  async analyzeFinancialContent(vendor, content, diff = null) {
    if (!this.anthropic) {
      this.log('warn', 'Anthropic API key not configured, skipping financial analysis');
      return null;
    }

    // Extract PLA codes from content
    const foundPLACodes = extractPLACodes(content);

    // Format content section - use diff if available
    let contentSection;
    if (diff && !diff.isFirstCrawl) {
      const formattedDiff = truncateDiff(diff, 5000);
      contentSection = `=== WHAT CHANGED ON THIS PAGE ===
${formattedDiff}

=== CURRENT PAGE CONTENT (for context) ===
${content.slice(0, 4000)}${content.length > 4000 ? '\n...[content truncated]...' : ''}`;
    } else {
      contentSection = `PAGE CONTENT:
${content.slice(0, 6000)}${content.length > 6000 ? '\n...[content truncated]...' : ''}`;
    }

    // Prepare content for analysis
    const analysisContent = [
      `VENDOR: ${vendor.name}`,
      `PAGE TYPE: Patient Assistance / Billing Information`,
      '',
      foundPLACodes.length > 0 ? `=== PLA CODES FOUND IN CONTENT ===\n${foundPLACodes.join(', ')}\n================================================================================\n` : '',
      contentSection,
    ].join('\n');

    try {
      const response = await this.anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `Analyze this vendor patient assistance/billing page for financial intelligence.

${analysisContent}

TASK: Extract ALL financial and patient assistance information. This is HIGH PRIORITY data.

Respond with JSON ONLY (no markdown, no explanation):
{
  "hasFinancialInfo": true/false,
  "cashPrice": {
    "amount": 4150,
    "currency": "USD",
    "perTest": true,
    "notes": "Any notes about the cash price"
  },
  "listPrice": {
    "amount": null,
    "currency": "USD",
    "notes": "Any notes about list price if mentioned"
  },
  "papProgram": {
    "name": "Compassionate Care or program name",
    "url": "URL to PAP application if found",
    "phone": "Phone number if found",
    "eligibility": "Eligibility criteria description",
    "maxDiscount": "Up to 100% or specific discount",
    "reducedPriceRange": "$0-$149 or price range for assisted patients",
    "incomeThreshold": "Specific FPL% or income limit if mentioned",
    "uninsuredOnly": false,
    "underinsuredEligible": true,
    "documentsRequired": ["List of required documents if mentioned"]
  },
  "paymentPlan": {
    "available": true/false,
    "interestFree": true/false,
    "maxMonths": 12,
    "notes": "Details about payment plan"
  },
  "copayAssistance": {
    "available": true/false,
    "maxAmount": null,
    "forCommercial": true/false,
    "forMedicare": false,
    "notes": "Any copay assistance details"
  },
  "insuranceCoverage": {
    "mentionedPayers": ["List of payers mentioned as covering the test"],
    "priorAuthRequired": true/false,
    "notes": "Any coverage details"
  },
  "plaCodes": [
    {
      "code": "0XXXU",
      "testName": "Associated test name if mentioned",
      "context": "How the code was mentioned"
    }
  ],
  "changes": [
    {
      "field": "What changed (e.g., 'cashPrice', 'papProgram.eligibility')",
      "description": "Description of the change detected"
    }
  ],
  "rawQuotes": [
    "Exact quotes from page with key financial information"
  ]
}

If a section has no information, use null for objects or empty arrays for lists.
Extract phone numbers, URLs, and specific dollar amounts exactly as written.
Respond ONLY with valid JSON.`,
          },
        ],
      });

      const responseText = response.content[0]?.text?.trim();
      if (!responseText) {
        return null;
      }

      // Parse JSON response - handle potential markdown code fences
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const result = JSON.parse(jsonText);

      // Look up Medicare rates for any PLA codes found
      if (result.plaCodes && result.plaCodes.length > 0) {
        for (const plaItem of result.plaCodes) {
          try {
            const rateInfo = await lookupPLARate(plaItem.code);
            plaItem.medicareRate = rateInfo.rate;
            plaItem.medicareStatus = rateInfo.status;
            plaItem.medicareEffective = rateInfo.effective;
            plaItem.adltStatus = rateInfo.adltStatus;
          } catch (e) {
            this.log('debug', `Failed to lookup rate for ${plaItem.code}: ${e.message}`);
          }
        }
      }

      return result;
    } catch (error) {
      this.log('warn', `Financial analysis failed for ${vendor.name}`, { error: error.message });
      return null;
    }
  }

  /**
   * Main crawl implementation
   * Processes both news pages and PAP/billing pages
   */
  async crawl() {
    this.log('info', `Starting vendor intelligence crawl: ${this.vendors.length} news sources, ${VENDOR_PAP_SOURCES.length} PAP sources`);

    // Initialize Medicare CLFS rate data for PLA code lookups
    await initializeCLFS();

    await this.loadHashes();
    const discoveries = [];
    let pagesProcessed = 0;
    let pagesChanged = 0;
    let pagesFailed = 0;
    const stats = {
      coverage: 0,
      plaCodes: 0,
      clinicalEvidence: 0,
      performanceData: 0,
      regulatory: 0,
      newIndications: 0,
      newTests: 0,
      financial: 0,
      pap: 0,
      priceChanges: 0,
    };

    try {
      // Phase 1: Crawl PAP/billing pages (TOP PRIORITY)
      this.log('info', 'Phase 1: Crawling PAP/billing pages (TOP PRIORITY)');
      for (const vendor of VENDOR_PAP_SOURCES) {
        const url = vendor.papUrl;

        try {
          // Rate limit between requests
          if (pagesProcessed > 0) {
            await this.sleep(this.rateLimitMs);
          }

          this.log('debug', `Fetching PAP page: ${url}`);
          const { content } = await this.fetchPage(url);

          // Canonicalize content for hash comparison
          const canonicalizedContent = canonicalizeContent(content);
          const newHash = this.computeHash(canonicalizedContent);
          const oldHashData = this.hashes[url];
          const oldHashValue = oldHashData?.hash || null;

          pagesProcessed++;

          if (newHash !== oldHashValue) {
            pagesChanged++;
            const isFirstCrawl = !oldHashValue;

            this.log('info', `PAP content ${isFirstCrawl ? 'captured' : 'changed'}: ${vendor.name}`);

            // Compute diff
            const previousContent = oldHashData?.content || null;
            const diff = computeDiff(previousContent, content);

            // Store new hash with content snapshot
            this.hashes[url] = {
              hash: newHash,
              content: content.slice(0, MAX_STORED_CONTENT_SIZE),
              fetchedAt: new Date().toISOString(),
            };

            // Only analyze if content changed (not first crawl)
            if (!isFirstCrawl && !diff.isFirstCrawl) {
              // Use Claude for financial intelligence extraction
              const analysis = await this.analyzeFinancialContent(vendor, content, diff);

              if (analysis && analysis.hasFinancialInfo) {
                // Create discoveries for financial information
                const financialDiscoveries = this.createFinancialDiscoveries(vendor, url, analysis);
                discoveries.push(...financialDiscoveries);

                // Update stats
                stats.financial += financialDiscoveries.length;
                if (analysis.papProgram?.name) stats.pap++;
                if (analysis.changes?.length > 0) {
                  const priceChanges = analysis.changes.filter(c =>
                    c.field?.includes('cashPrice') || c.field?.includes('listPrice')
                  );
                  stats.priceChanges += priceChanges.length;
                }
                stats.plaCodes += analysis.plaCodes?.length || 0;
              }
            }
          } else {
            this.log('debug', `No changes: ${vendor.name} (PAP)`);
          }
        } catch (error) {
          pagesFailed++;
          this.log('warn', `Failed to fetch PAP page ${url}`, { error: error.message });
        }
      }

      // Phase 2: Crawl news/press release pages
      this.log('info', 'Phase 2: Crawling news/press release pages');
      for (const vendor of this.vendors) {
        const url = vendor.rssUrl || vendor.newsUrl;

        try {
          // Rate limit between requests
          if (pagesProcessed > 0) {
            await this.sleep(this.rateLimitMs);
          }

          // Use RSS feed if available, otherwise use Playwright
          let content, headlines;
          if (vendor.rssUrl) {
            this.log('debug', `Fetching RSS: ${url}`);
            ({ content, headlines } = await this.fetchRSS(url));
          } else {
            this.log('debug', `Fetching page: ${url}`);
            ({ content, headlines } = await this.fetchPage(url, { extractHeadlines: true }));
          }

          // Canonicalize content for hash comparison (removes dynamic elements)
          // Raw content is still used for Claude analysis
          const canonicalizedContent = canonicalizeContent(content);
          const newHash = this.computeHash(canonicalizedContent);
          const oldHashData = this.hashes[url];
          const oldHashValue = oldHashData?.hash || null;

          pagesProcessed++;

          if (newHash !== oldHashValue) {
            pagesChanged++;
            const isFirstCrawl = !oldHashValue;

            this.log('info', `Content ${isFirstCrawl ? 'captured' : 'changed'}: ${vendor.name}`);

            // Compute diff (returns isFirstCrawl: true if no previous content)
            const previousContent = oldHashData?.content || null;
            const diff = computeDiff(previousContent, content);

            // Store new hash with content snapshot
            this.hashes[url] = {
              hash: newHash,
              content: content.slice(0, MAX_STORED_CONTENT_SIZE),
              fetchedAt: new Date().toISOString(),
            };

            // Only analyze if content changed (not first crawl)
            if (!isFirstCrawl && !diff.isFirstCrawl) {
              // Use Claude for comprehensive intelligence extraction
              const analysis = await this.analyzeCoverageContent(vendor, content, headlines, diff);

              if (analysis) {
                // Create discoveries for each intelligence type
                const vendorDiscoveries = this.createAllDiscoveries(vendor, url, analysis);
                discoveries.push(...vendorDiscoveries);

                // Update stats
                stats.coverage += analysis.announcements?.length || 0;
                stats.plaCodes += analysis.plaCodes?.length || 0;
                stats.clinicalEvidence += analysis.clinicalEvidence?.length || 0;
                stats.performanceData += analysis.performanceData?.length || 0;
                stats.regulatory += analysis.regulatoryUpdates?.length || 0;
                stats.newIndications += analysis.newIndications?.length || 0;
                stats.newTests += analysis.newTests?.length || 0;
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

    // Create proposals for high-confidence discoveries (requires human review)
    let proposals = [];
    let skippedDiscoveries = [];
    if (discoveries.length > 0) {
      try {
        const result = await this.createProposalsFromDiscoveries(discoveries);
        proposals = result.proposals;
        skippedDiscoveries = result.skipped;
        this.log('info', `Created ${proposals.length} proposals for human review, skipped ${skippedDiscoveries.length}`);
      } catch (error) {
        this.log('error', 'Failed to create proposals', { error: error.message });
      }
    }

    this.log('info', 'Vendor intelligence crawl complete', {
      pagesProcessed,
      pagesChanged,
      pagesFailed,
      discoveries: discoveries.length,
      proposalsCreated: proposals.length,
      skipped: skippedDiscoveries.length,
      stats,
    });

    // Resolve vendor publication hints to actual PubMed papers
    let publicationResults = { resolved: [], stats: { total: 0, found: 0 } };
    const clinicalEvidenceItems = discoveries
      .filter(d => d.type === 'vendor_clinical_evidence')
      .map(d => ({
        trialName: d.metadata.trialName,
        nctId: d.metadata.nctId,
        journal: d.metadata.journal,
        pmid: d.metadata.pmid,
        doi: d.metadata.doi,
        firstAuthor: d.metadata.firstAuthor,
        testName: d.metadata.testName,
        cancerType: d.metadata.cancerType,
        publicationDate: d.metadata.publicationDate,
        vendorName: d.metadata.vendorName,
      }));

    if (clinicalEvidenceItems.length > 0) {
      try {
        this.log('info', `Resolving ${clinicalEvidenceItems.length} publication hints to PubMed...`);
        publicationResults = await resolvePublications(clinicalEvidenceItems);
        this.log('info', 'Publication resolution complete', {
          found: publicationResults.stats.found,
          notFound: publicationResults.stats.notFound,
        });
      } catch (error) {
        this.log('warn', 'Publication resolution failed', { error: error.message });
      }
    }

    // Write resolved publications to physician-system database
    let physicianDbWrite = { skipped: true, stats: { total: 0, new: 0 } };
    if (publicationResults.resolved.length > 0 && isPhysicianDbConfigured()) {
      try {
        physicianDbWrite = await writePublicationsToPhysicianDb(publicationResults.resolved);
        if (physicianDbWrite.stats.new > 0) {
          this.log('info', 'Wrote publications to physician-system DB', {
            new: physicianDbWrite.stats.new,
            updated: physicianDbWrite.stats.updated,
            failed: physicianDbWrite.stats.failed,
          });
        }
      } catch (error) {
        this.log('warn', 'Failed to write publications to physician-system DB', { error: error.message });
      }
    } else if (publicationResults.resolved.length > 0) {
      this.log('debug', 'Physician DB not configured - skipping publication export');
    }

    // Return enhanced result with proposals and skipped for email
    return {
      discoveries,
      proposals,
      skippedDiscoveries,
      publicationResults,
      physicianDbWrite,
    };
  }

  /**
   * Create discoveries from financial analysis result
   * @param {Object} vendor - Vendor info
   * @param {string} sourceUrl - Source URL
   * @param {Object} analysis - Financial analysis object
   * @returns {Array} Array of discovery objects
   */
  createFinancialDiscoveries(vendor, sourceUrl, analysis) {
    const discoveries = [];

    // Check for price changes
    const priceChanges = analysis.changes?.filter(c =>
      c.field?.includes('cashPrice') || c.field?.includes('listPrice')
    ) || [];

    if (priceChanges.length > 0) {
      discoveries.push(this.createPriceChangeDiscovery(vendor, analysis, sourceUrl, priceChanges));
    }

    // Check for PAP program info
    if (analysis.papProgram?.name || analysis.papProgram?.eligibility) {
      const papChanges = analysis.changes?.filter(c =>
        c.field?.includes('papProgram')
      ) || [];
      discoveries.push(this.createPAPDiscovery(vendor, analysis, sourceUrl, papChanges));
    }

    // Check for payment plan changes
    const paymentPlanChanges = analysis.changes?.filter(c =>
      c.field?.includes('paymentPlan')
    ) || [];

    if (paymentPlanChanges.length > 0 || (analysis.paymentPlan?.available && !analysis.changes?.length)) {
      discoveries.push(this.createPaymentPlanDiscovery(vendor, analysis, sourceUrl, paymentPlanChanges));
    }

    // PLA codes from financial pages
    if (analysis.plaCodes?.length > 0) {
      for (const plaItem of analysis.plaCodes) {
        discoveries.push(this.createPLACodeDiscovery(vendor, plaItem, sourceUrl));
      }
    }

    return discoveries;
  }

  /**
   * Create discovery for price change
   */
  createPriceChangeDiscovery(vendor, analysis, sourceUrl, changes) {
    const parts = [];
    if (analysis.cashPrice?.amount) {
      parts.push(`Cash: $${analysis.cashPrice.amount}`);
    }
    if (analysis.listPrice?.amount) {
      parts.push(`List: $${analysis.listPrice.amount}`);
    }

    const title = `${vendor.name}: Price Update${parts.length ? ` - ${parts.join(', ')}` : ''}`;

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_PRICE_CHANGE,
      title: title.slice(0, 200),
      summary: changes.map(c => c.description).join('; ') || 'Pricing information updated',
      url: sourceUrl,
      relevance: 'high',
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        cashPrice: analysis.cashPrice,
        listPrice: analysis.listPrice,
        changes,
        rawQuotes: analysis.rawQuotes,
      },
    };
  }

  /**
   * Create discovery for PAP program
   */
  createPAPDiscovery(vendor, analysis, sourceUrl, changes) {
    const pap = analysis.papProgram || {};
    const title = pap.name
      ? `${vendor.name}: ${pap.name} Program${changes.length ? ' Updated' : ''}`
      : `${vendor.name}: Patient Assistance Program${changes.length ? ' Updated' : ''}`;

    const summaryParts = [];
    if (pap.eligibility) summaryParts.push(pap.eligibility);
    if (pap.maxDiscount) summaryParts.push(`Up to ${pap.maxDiscount} off`);
    if (pap.reducedPriceRange) summaryParts.push(`Reduced price: ${pap.reducedPriceRange}`);

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_PAP_UPDATE,
      title: title.slice(0, 200),
      summary: summaryParts.join(' | ') || 'Patient assistance program information',
      url: sourceUrl,
      relevance: 'high',
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        papProgram: pap,
        copayAssistance: analysis.copayAssistance,
        changes,
        rawQuotes: analysis.rawQuotes,
      },
    };
  }

  /**
   * Create discovery for payment plan
   */
  createPaymentPlanDiscovery(vendor, analysis, sourceUrl, changes) {
    const plan = analysis.paymentPlan || {};
    const title = `${vendor.name}: Payment Plan${changes.length ? ' Updated' : ' Available'}`;

    const summaryParts = [];
    if (plan.interestFree) summaryParts.push('Interest-free');
    if (plan.maxMonths) summaryParts.push(`Up to ${plan.maxMonths} months`);
    if (plan.notes) summaryParts.push(plan.notes);

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_PAYMENT_PLAN,
      title: title.slice(0, 200),
      summary: summaryParts.join(' | ') || 'Payment plan options available',
      url: sourceUrl,
      relevance: 'medium',
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        paymentPlan: plan,
        changes,
      },
    };
  }

  /**
   * Create all discovery objects from analysis result
   * @param {Object} vendor - Vendor info
   * @param {string} sourceUrl - Source URL
   * @param {Object} analysis - Full analysis object
   * @returns {Array} Array of discovery objects
   */
  createAllDiscoveries(vendor, sourceUrl, analysis) {
    const discoveries = [];

    // Coverage announcements
    if (analysis.announcements?.length > 0) {
      for (const announcement of analysis.announcements) {
        discoveries.push(this.createCoverageDiscovery(vendor, announcement, sourceUrl, analysis));
      }
    }

    // PLA codes
    if (analysis.plaCodes?.length > 0) {
      for (const plaItem of analysis.plaCodes) {
        discoveries.push(this.createPLACodeDiscovery(vendor, plaItem, sourceUrl));
      }
    }

    // Clinical evidence
    if (analysis.clinicalEvidence?.length > 0) {
      for (const evidence of analysis.clinicalEvidence) {
        discoveries.push(this.createClinicalEvidenceDiscovery(vendor, evidence, sourceUrl));
      }
    }

    // Performance data
    if (analysis.performanceData?.length > 0) {
      for (const perfData of analysis.performanceData) {
        discoveries.push(this.createPerformanceDataDiscovery(vendor, perfData, sourceUrl));
      }
    }

    // Regulatory updates
    if (analysis.regulatoryUpdates?.length > 0) {
      for (const regulatory of analysis.regulatoryUpdates) {
        discoveries.push(this.createRegulatoryDiscovery(vendor, regulatory, sourceUrl));
      }
    }

    // New indications
    if (analysis.newIndications?.length > 0) {
      for (const indication of analysis.newIndications) {
        discoveries.push(this.createNewIndicationDiscovery(vendor, indication, sourceUrl));
      }
    }

    // New tests
    if (analysis.newTests?.length > 0) {
      for (const newTest of analysis.newTests) {
        discoveries.push(this.createNewTestDiscovery(vendor, newTest, sourceUrl));
      }
    }

    return discoveries;
  }

  /**
   * Create discovery from coverage announcement
   * @param {Object} vendor - Vendor info
   * @param {Object} announcement - Coverage announcement from Claude
   * @param {string} sourceUrl - Source URL
   * @param {Object} analysis - Full analysis object including deterministicMatches
   */
  createCoverageDiscovery(vendor, announcement, sourceUrl, analysis = null) {
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
        // Deterministic test matches (high confidence, rule-based)
        deterministicMatches: analysis?.deterministicMatches || [],
        // Tests found by LLM that weren't in deterministic matches
        llmSuggestedTests: analysis?.additionalTestsFound || [],
      },
    };
  }

  /**
   * Create discovery for PLA code
   */
  createPLACodeDiscovery(vendor, plaItem, sourceUrl) {
    const title = plaItem.isNew
      ? `${vendor.name}: New PLA Code ${plaItem.code} for ${plaItem.testName || 'test'}`
      : `${vendor.name}: PLA Code ${plaItem.code} mentioned`;

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_PLA_CODE,
      title: title.slice(0, 200),
      summary: plaItem.context || `PLA code ${plaItem.code} referenced`,
      url: sourceUrl,
      relevance: plaItem.isNew ? 'high' : 'medium',
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        plaCode: plaItem.code,
        testName: plaItem.testName,
        isNew: plaItem.isNew,
        medicareRate: plaItem.medicareRate,
        medicareStatus: plaItem.medicareStatus,
        medicareEffective: plaItem.medicareEffective,
        adltStatus: plaItem.adltStatus,
      },
    };
  }

  /**
   * Create discovery for clinical evidence / publication hint
   * Includes fields needed to resolve to actual PubMed paper
   */
  createClinicalEvidenceDiscovery(vendor, evidence, sourceUrl) {
    const parts = [evidence.trialName || evidence.journal].filter(Boolean);
    const title = `${vendor.name}: ${parts[0] || 'Clinical Evidence'}`;

    // Higher relevance if we have specific identifiers
    const hasSpecificId = evidence.nctId || evidence.pmid || evidence.doi;
    const relevance = hasSpecificId ? 'high' : (evidence.journal ? 'medium' : 'low');

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_CLINICAL_EVIDENCE,
      title: title.slice(0, 200),
      summary: evidence.findings || 'Clinical study results announced',
      url: sourceUrl,
      relevance,
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        // Publication identifiers for PubMed resolution
        trialName: evidence.trialName,
        nctId: evidence.nctId,
        journal: evidence.journal,
        pmid: evidence.pmid,
        doi: evidence.doi,
        firstAuthor: evidence.firstAuthor,
        publicationDate: evidence.publicationDate,
        // Test and context info
        testName: evidence.testName,
        cancerType: evidence.cancerType,
        findings: evidence.findings,
      },
    };
  }

  /**
   * Create discovery for performance data
   */
  createPerformanceDataDiscovery(vendor, perfData, sourceUrl) {
    const title = `${vendor.name}: ${perfData.testName} ${perfData.metric} ${perfData.value}`;

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_PERFORMANCE_DATA,
      title: title.slice(0, 200),
      summary: `${perfData.metric}: ${perfData.value} in ${perfData.cancerType}${perfData.stage ? ` (${perfData.stage})` : ''}`,
      url: sourceUrl,
      relevance: 'medium',
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        testName: perfData.testName,
        metric: perfData.metric,
        value: perfData.value,
        cancerType: perfData.cancerType,
        stage: perfData.stage,
        population: perfData.population,
      },
    };
  }

  /**
   * Create discovery for regulatory update
   */
  createRegulatoryDiscovery(vendor, regulatory, sourceUrl) {
    const title = `${vendor.name}: ${regulatory.testName} ${regulatory.action}`;

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_REGULATORY,
      title: title.slice(0, 200),
      summary: `${regulatory.action} for ${regulatory.indication}`,
      url: sourceUrl,
      relevance: 'high',
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        testName: regulatory.testName,
        action: regulatory.action,
        indication: regulatory.indication,
        date: regulatory.date,
      },
    };
  }

  /**
   * Create discovery for new indication
   */
  createNewIndicationDiscovery(vendor, indication, sourceUrl) {
    const title = `${vendor.name}: ${indication.testName} expands to ${indication.indication}`;

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_NEW_INDICATION,
      title: title.slice(0, 200),
      summary: `New indication: ${indication.indication}`,
      url: sourceUrl,
      relevance: 'high',
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        testName: indication.testName,
        indication: indication.indication,
        date: indication.date,
      },
    };
  }

  /**
   * Create discovery for new test launch
   */
  createNewTestDiscovery(vendor, newTest, sourceUrl) {
    const title = `${vendor.name}: Launches ${newTest.testName}`;

    return {
      source: SOURCES.VENDOR,
      type: DISCOVERY_TYPES.VENDOR_NEW_TEST,
      title: title.slice(0, 200),
      summary: newTest.description || `New ${newTest.category} test launched`,
      url: sourceUrl,
      relevance: 'high',
      metadata: {
        vendorId: vendor.id,
        vendorName: vendor.name,
        testName: newTest.testName,
        category: newTest.category,
        description: newTest.description,
        launchDate: newTest.launchDate,
      },
    };
  }

  /**
   * Create proposals from discoveries for human review
   * Only creates proposals for high-confidence, actionable discoveries
   * Also tracks which discoveries were skipped and why
   *
   * @param {Array} discoveries - Array of discovery objects from createAllDiscoveries
   * @returns {Promise<{proposals: Array, skipped: Array}>} Proposals and skipped discoveries
   */
  async createProposalsFromDiscoveries(discoveries) {
    const proposals = [];
    const skipped = [];

    for (const discovery of discoveries) {
      try {
        // Check relevance first
        if (discovery.relevance !== 'high' && discovery.relevance !== 'medium') {
          skipped.push({
            ...discovery,
            skipReason: `Low relevance (${discovery.relevance || 'unknown'})`,
          });
          continue;
        }

        const proposal = await this.createProposalFromDiscovery(discovery);
        if (proposal) {
          proposals.push(proposal);
          this.log('info', `Created proposal: ${proposal.id}`, {
            type: proposal.type,
            testName: discovery.metadata?.testName,
          });
        } else {
          // Proposal creation returned null - determine why
          const skipReason = this.getSkipReason(discovery);
          skipped.push({
            ...discovery,
            skipReason,
          });
        }
      } catch (error) {
        this.log('warn', `Failed to create proposal for discovery`, {
          title: discovery.title,
          error: error.message,
        });
        skipped.push({
          ...discovery,
          skipReason: `Error: ${error.message}`,
        });
      }
    }

    return { proposals, skipped };
  }

  /**
   * Get reason why a discovery was skipped
   */
  getSkipReason(discovery) {
    const { type, metadata } = discovery;

    // Informational types
    const infoTypes = {
      [DISCOVERY_TYPES.VENDOR_PLA_CODE]: 'PLA code (informational)',
      [DISCOVERY_TYPES.VENDOR_PRICE_CHANGE]: 'Price change (informational)',
      [DISCOVERY_TYPES.VENDOR_PAP_UPDATE]: 'PAP update (informational)',
      [DISCOVERY_TYPES.VENDOR_PAYMENT_PLAN]: 'Payment plan (informational)',
    };
    if (infoTypes[type]) return infoTypes[type];

    // Coverage without test name
    if (type === DISCOVERY_TYPES.VENDOR_COVERAGE_ANNOUNCEMENT) {
      if (!metadata?.testName && (!metadata?.deterministicMatches || metadata.deterministicMatches.length === 0)) {
        return 'Coverage: No test identified';
      }
    }

    // Updates without test name
    if ([DISCOVERY_TYPES.VENDOR_PERFORMANCE_DATA, DISCOVERY_TYPES.VENDOR_CLINICAL_EVIDENCE,
         DISCOVERY_TYPES.VENDOR_REGULATORY, DISCOVERY_TYPES.VENDOR_NEW_INDICATION].includes(type)) {
      if (!metadata?.testName) {
        return 'Update: No test identified';
      }
    }

    // New test without name
    if (type === DISCOVERY_TYPES.VENDOR_NEW_TEST && !metadata?.testName) {
      return 'New test: No name identified';
    }

    return 'Unknown reason';
  }

  /**
   * Create a proposal from a single discovery
   * Maps discovery types to proposal types
   *
   * @param {Object} discovery - Discovery object
   * @returns {Promise<Object|null>} Created proposal or null
   */
  async createProposalFromDiscovery(discovery) {
    const { type, metadata, url, title, summary } = discovery;

    switch (type) {
      case DISCOVERY_TYPES.VENDOR_COVERAGE_ANNOUNCEMENT:
        return this.createCoverageProposalFromDiscovery(discovery);

      case DISCOVERY_TYPES.VENDOR_PERFORMANCE_DATA:
      case DISCOVERY_TYPES.VENDOR_CLINICAL_EVIDENCE:
      case DISCOVERY_TYPES.VENDOR_REGULATORY:
      case DISCOVERY_TYPES.VENDOR_NEW_INDICATION:
        return this.createUpdateProposalFromDiscovery(discovery);

      case DISCOVERY_TYPES.VENDOR_NEW_TEST:
        return this.createNewTestProposalFromDiscovery(discovery);

      // Skip proposal creation for these types (informational only)
      case DISCOVERY_TYPES.VENDOR_PLA_CODE:
      case DISCOVERY_TYPES.VENDOR_PRICE_CHANGE:
      case DISCOVERY_TYPES.VENDOR_PAP_UPDATE:
      case DISCOVERY_TYPES.VENDOR_PAYMENT_PLAN:
        this.log('debug', `Skipping proposal for informational discovery type: ${type}`);
        return null;

      default:
        this.log('debug', `Unknown discovery type for proposal: ${type}`);
        return null;
    }
  }

  /**
   * Create a coverage proposal from a coverage announcement discovery
   */
  async createCoverageProposalFromDiscovery(discovery) {
    const { metadata, url, title, summary } = discovery;

    // Skip if no test name identified
    if (!metadata.testName && (!metadata.deterministicMatches || metadata.deterministicMatches.length === 0)) {
      this.log('debug', 'Skipping coverage proposal: no test identified');
      return null;
    }

    // Use deterministic match if available, otherwise use LLM-identified test
    const testName = metadata.testName ||
      metadata.deterministicMatches?.[0]?.testName ||
      metadata.llmSuggestedTests?.[0];

    const deterministicId = metadata.deterministicMatches?.[0]?.testId || null;
    const matched = testName ? lookupTestByName(testName) : null;
    const testId = deterministicId || matched?.id || null;

    // Calculate confidence based on match type
    let confidence = 0.7; // Base confidence
    if (metadata.deterministicMatches?.length > 0) {
      const bestMatch = metadata.deterministicMatches[0];
      confidence = bestMatch.confidence || 0.85;
    }

    return createProposal(PROPOSAL_TYPES.COVERAGE, {
      testName,
      testId,
      payer: metadata.payerName || 'Unknown Payer',
      payerId: null, // Would need payer matching logic
      coverageStatus: 'covered', // Default assumption from announcement
      conditions: summary,
      effectiveDate: metadata.effectiveDate || null,
      source: url,
      sourceTitle: title,
      confidence,
      snippet: summary?.slice(0, 500),
    });
  }

  /**
   * Create an update proposal from performance/clinical/regulatory discoveries
   */
  async createUpdateProposalFromDiscovery(discovery) {
    const { type, metadata, url, title, summary } = discovery;

    // Skip if no test name identified
    if (!metadata.testName) {
      this.log('debug', 'Skipping update proposal: no test identified');
      return null;
    }

    // Build changes object based on discovery type
    const changes = {};

    if (type === DISCOVERY_TYPES.VENDOR_PERFORMANCE_DATA) {
      changes.performance = {
        [metadata.metric]: metadata.value,
        cancerType: metadata.cancerType,
        stage: metadata.stage,
        population: metadata.population,
      };
    }

    if (type === DISCOVERY_TYPES.VENDOR_CLINICAL_EVIDENCE) {
      changes.clinicalEvidence = {
        trialName: metadata.trialName,
        nctId: metadata.nctId,
        publication: metadata.publication,
        findings: metadata.findings,
        date: metadata.date,
      };
    }

    if (type === DISCOVERY_TYPES.VENDOR_REGULATORY) {
      changes.regulatory = {
        action: metadata.action,
        indication: metadata.indication,
        date: metadata.date,
      };
    }

    if (type === DISCOVERY_TYPES.VENDOR_NEW_INDICATION) {
      changes.newIndication = {
        indication: metadata.indication,
        date: metadata.date,
      };
    }

    const match = lookupTestByName(metadata.testName);

    return createProposal(PROPOSAL_TYPES.UPDATE, {
      testName: metadata.testName,
      testId: match?.id || null,
      changes,
      source: url,
      sourceTitle: title,
      confidence: 0.75,
      snippet: summary?.slice(0, 500),
    });
  }

  /**
   * Create a new test proposal from a new test discovery
   */
  async createNewTestProposalFromDiscovery(discovery) {
    const { metadata, url, title, summary } = discovery;

    if (!metadata.testName) {
      this.log('debug', 'Skipping new test proposal: no test name');
      return null;
    }

    // Map category codes to full category names
    const categoryMap = {
      'mrd': 'Molecular Residual Disease',
      'tds': 'Treatment Decision Support',
      'ecd': 'Early Cancer Detection',
      'hct': 'Hereditary Cancer Testing',
      'trm': 'Treatment Response Monitoring',
      'cgp': 'Comprehensive Genomic Profiling',
    };

    return createProposal(PROPOSAL_TYPES.NEW_TEST, {
      testData: {
        name: metadata.testName,
        vendor: metadata.vendorName,
        category: categoryMap[metadata.category] || metadata.category || 'Unknown',
        description: metadata.description || summary,
        launchDate: metadata.launchDate,
      },
      source: url,
      sourceTitle: title,
      confidence: 0.7, // New test proposals need careful review
      snippet: summary?.slice(0, 500),
    });
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
