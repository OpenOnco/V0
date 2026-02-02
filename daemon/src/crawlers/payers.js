/**
 * Payer Policy Crawler (v2)
 *
 * Monitors specific ctDNA/MRD policy URLs from the policy registry.
 * These are manually researched policy document URLs, not generic payer sites.
 *
 * v2 enhancements:
 * - Multi-hash change detection (content, metadata, criteria, codes)
 * - Deterministic extraction before LLM analysis
 * - Delegation detection (payer→LBM)
 * - Layered coverage assertions
 *
 * Architecture:
 * - POLICY_REGISTRY contains known policy URLs (manually curated)
 * - This crawler checks those URLs for content changes
 * - Changes are analyzed by Claude and turned into discoveries/proposals
 */

import { createHash } from 'crypto';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { PlaywrightCrawler } from './playwright-base.js';
import { config, SOURCES, DISCOVERY_TYPES } from '../config.js';
import { createLogger } from '../utils/logger.js';
import { getAllPolicies } from '../data/policy-registry.js';
import { initializeTestDictionary, matchTests } from '../data/test-dictionary.js';
import { addDiscoveries } from '../queue/index.js';
import { updateCrawlerHealth, recordCrawlerError } from '../health.js';
import { createProposal } from '../proposals/queue.js';
import { PROPOSAL_TYPES, COVERAGE_LAYERS, ASSERTION_STATUS } from '../proposals/schema.js';
import {
  initHashStore,
  getHash,
  setHash,
  recordSuccess,
  recordFailure,
  upsertPolicyHashes,
  getPolicyHashes,
  upsertCoverageAssertion,
} from '../utils/hash-store.js';

// v2: Import extraction and analysis modules
import { extractStructuredData, quickRelevanceCheck, buildLLMContext, prepareForMultiHash } from '../extractors/index.js';
import { computeMultiHash, compareMultiHash, shouldAnalyze, getChangeSummary } from '../utils/multi-hash.js';
import { detectDelegation, buildDelegationProposal } from '../extractors/delegation.js';
import { getDelegation } from '../data/delegation-map.js';

const logger = createLogger('payer-crawler');

const PAGE_TIMEOUT_MS = 60000;
const RATE_LIMIT_MS = 3000;

export class PayerCrawler extends PlaywrightCrawler {
  constructor() {
    super({
      name: 'Payer Policies',
      source: SOURCES.PAYERS,
      description: 'Payer ctDNA/MRD policy documents',
      rateLimit: 3,
      enabled: true,
      rateLimitMs: RATE_LIMIT_MS,
    });

    this.anthropic = new Anthropic();
    this.policies = [];
  }

  /**
   * Main crawl entry point
   */
  async crawl() {
    const startTime = Date.now();
    logger.info('Starting payer policy crawl');

    try {
      // Initialize resources
      await initHashStore();
      await initializeTestDictionary();
      this.policies = getAllPolicies();

      logger.info(`Found ${this.policies.length} policies to check`);

      if (this.policies.length === 0) {
        logger.warn('No policies in registry');
        return [];
      }

      // Launch browser
      await this.launchBrowser();

      const discoveries = [];
      let checked = 0;
      let changed = 0;

      for (const policy of this.policies) {
        try {
          const result = await this.checkPolicy(policy);
          checked++;

          if (result.changed) {
            changed++;
            const discovery = await this.createDiscovery(policy, result);
            if (discovery) {
              discoveries.push(discovery);
            }
          }

          // Rate limit
          await this.sleep(RATE_LIMIT_MS);
        } catch (error) {
          logger.error(`Error checking policy ${policy.id}`, { error: error.message });
          await recordFailure(policy.url, policy.payerId, error.message);
        }
      }

      // Add discoveries to queue
      const added = await addDiscoveries(discoveries);

      // Create proposals for discoveries
      let proposalsCreated = 0;
      for (const discovery of discoveries) {
        try {
          const proposal = await this.createProposalFromDiscovery(discovery);
          if (proposal) proposalsCreated++;
        } catch (error) {
          logger.warn('Failed to create proposal', { error: error.message });
        }
      }

      // Update health
      const duration = Date.now() - startTime;
      await updateCrawlerHealth(SOURCES.PAYERS, {
        lastRun: new Date().toISOString(),
        lastSuccess: new Date().toISOString(),
        discoveriesFound: changed,
        discoveriesAdded: added.length,
        duration,
        status: 'success',
      });

      logger.info('Payer policy crawl completed', {
        checked,
        changed,
        discoveries: discoveries.length,
        added: added.length,
        proposalsCreated,
        duration,
      });

      return discoveries;

    } catch (error) {
      logger.error('Payer policy crawl failed', { error });
      await recordCrawlerError(SOURCES.PAYERS, error);
      throw error;
    } finally {
      await this.closeBrowser();
    }
  }

  /**
   * Check a single policy for changes (v2: multi-hash)
   */
  async checkPolicy(policy) {
    logger.debug(`Checking policy: ${policy.id}`);

    // Fetch current content
    const content = await this.fetchPolicyContent(policy);
    if (!content) {
      return { changed: false, error: 'Failed to fetch content' };
    }

    // v2: Extract structured data BEFORE hashing
    const extraction = await extractStructuredData(content, {
      docType: policy.docType,
      payerId: policy.payerId,
    });

    // v2: Compute multi-hash
    const hashData = prepareForMultiHash(extraction);
    const newHashes = computeMultiHash(content, hashData);

    // Get previous hash data (v2: multi-hash)
    const previousRecord = getPolicyHashes(policy.id);
    const previousHashes = previousRecord?.hashes || null;

    // v2: Compare multi-hashes
    const comparison = compareMultiHash(previousHashes, newHashes);

    // v2: Check if change warrants analysis
    if (!comparison.changed) {
      logger.debug(`No change: ${policy.id}`);
      await recordSuccess(policy.url, policy.payerId);
      return { changed: false };
    }

    // v2: Store multi-hash record
    upsertPolicyHashes({
      policyId: policy.id,
      payerId: policy.payerId,
      url: policy.url,
      docType: policy.docType,
      hashes: newHashes,
      metadata: {
        effectiveDate: extraction.effectiveDate,
        revisionDate: extraction.revisionDate,
        policyNumber: null,
        version: null,
      },
      codes: extraction.codes,
      namedTests: extraction.testIds,
      stance: extraction.stance,
      contentSnippet: content.substring(0, 5000),
      criteriaSection: extraction.criteriaSection,
    });

    // Also update legacy hash for backwards compatibility
    const hashKey = `${policy.payerId}:policy:${policy.url}`;
    setHash(hashKey, { hash: newHashes.contentHash, content: content.substring(0, 50000) });
    await recordSuccess(policy.url, policy.payerId);

    const changeSummary = getChangeSummary(comparison);
    logger.info(`Policy changed: ${policy.id}`, {
      payerId: policy.payerId,
      priority: comparison.priority,
      changedHashes: comparison.changedHashes,
    });

    // v2: Check if change is significant enough to analyze
    const shouldAnalyzeChange = shouldAnalyze(comparison, 'medium');

    return {
      changed: true,
      content,
      extraction,
      comparison,
      changeSummary,
      shouldAnalyze: shouldAnalyzeChange,
      isNew: !previousHashes,
    };
  }

  /**
   * Fetch policy content (HTML or PDF)
   */
  async fetchPolicyContent(policy) {
    // PDFs use direct HTTP fetch (no Playwright needed)
    if (policy.contentType === 'pdf') {
      return await this.fetchPdfContent(policy.url);
    }

    // HTML pages use Playwright for JS rendering
    const page = await this.browser.newPage();
    try {
      return await this.fetchHtmlContent(page, policy.url);
    } finally {
      await page.close();
    }
  }

  /**
   * Fetch HTML page content
   */
  async fetchHtmlContent(page, url) {
    try {
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: PAGE_TIMEOUT_MS,
      });

      // Extract main content
      const content = await page.evaluate(() => {
        // Try to find main content area
        const main = document.querySelector('main, article, .content, #content, .policy-content');
        if (main) return main.innerText;

        // Fall back to body
        return document.body.innerText;
      });

      return content;
    } catch (error) {
      logger.error(`Failed to fetch HTML: ${url}`, { error: error.message });
      return null;
    }
  }

  /**
   * Fetch PDF content using direct HTTP (Playwright triggers downloads for PDFs)
   */
  async fetchPdfContent(url) {
    try {
      // Use fetch() directly - Playwright page.goto() triggers downloads for PDFs
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/pdf,*/*',
        },
        timeout: PAGE_TIMEOUT_MS,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Parse PDF - import inner module to avoid test code that runs on module load
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const pdf = await pdfParse(buffer);

      return pdf.text;
    } catch (error) {
      logger.error(`Failed to fetch PDF: ${url}`, { error: error.message });
      return null;
    }
  }

  /**
   * Create a discovery from a policy change (v2: uses extraction data)
   */
  async createDiscovery(policy, result) {
    const { extraction, comparison, changeSummary, shouldAnalyze: shouldDoAnalysis } = result;

    // v2: Use pre-extracted test matches
    const testMatches = extraction?.namedTests || matchTests(result.content);

    // v2: Detect delegation announcements
    const delegationDetection = detectDelegation(result.content);
    if (delegationDetection.detected) {
      await this.handleDelegationDetection(policy, delegationDetection);
    }

    // v2: Skip LLM analysis for low-priority changes
    let analysis = null;
    if (shouldDoAnalysis && (testMatches.length > 0 || result.isNew)) {
      analysis = await this.analyzeChange(policy, result.content, testMatches, extraction);
    }

    // v2: Create coverage assertions for each test
    if (analysis?.testsExplicitlyMentioned?.length > 0 || extraction?.testIds?.length > 0) {
      await this.createCoverageAssertions(policy, extraction, analysis);
    }

    const discovery = {
      source: SOURCES.PAYERS,
      type: DISCOVERY_TYPES.PAYER_POLICY_UPDATE,
      title: `${policy.payerName}: ${policy.name} Updated`,
      summary: analysis?.summary || `Policy document has been updated. ${testMatches.length} monitored tests mentioned.`,
      url: policy.url,
      relevance: this.calculateRelevance(testMatches, analysis),
      discoveredAt: new Date().toISOString(),
      metadata: {
        payerId: policy.payerId,
        payerName: policy.payerName,
        policyId: policy.id,
        policyName: policy.name,
        policyType: policy.policyType,
        docType: policy.docType,
        contentType: policy.contentType,
        testsFound: testMatches.map(t => t.id || t.name),
        isNewPolicy: result.isNew,
        analysis: analysis,
        // v2: Include extraction and change data
        extraction: {
          stance: extraction?.stance,
          stanceConfidence: extraction?.stanceConfidence,
          cancerTypes: extraction?.cancerTypes,
          priorAuth: extraction?.priorAuth,
          effectiveDate: extraction?.effectiveDate,
        },
        change: {
          priority: comparison?.priority,
          changedHashes: comparison?.changedHashes,
          summary: changeSummary,
        },
        delegationDetected: delegationDetection.detected,
      },
    };

    return discovery;
  }

  /**
   * v2: Handle detected delegation announcement
   */
  async handleDelegationDetection(policy, detection) {
    logger.info(`Delegation detected: ${policy.payerName} → ${detection.delegatedTo}`, {
      policyId: policy.id,
      confidence: detection.confidence,
    });

    // Check if already known
    const knownDelegation = getDelegation(policy.payerId);
    if (knownDelegation && knownDelegation.delegatedTo === detection.delegatedTo) {
      logger.debug('Delegation already known, skipping proposal');
      return;
    }

    // Create delegation change proposal
    const proposalData = buildDelegationProposal(detection, {
      payerId: policy.payerId,
      payerName: policy.payerName,
      url: policy.url,
    });

    try {
      await createProposal(PROPOSAL_TYPES.DELEGATION_CHANGE, {
        ...proposalData,
        source: policy.url,
      });
      logger.info('Created delegation change proposal');
    } catch (error) {
      logger.warn('Failed to create delegation proposal', { error: error.message });
    }
  }

  /**
   * v2: Create coverage assertions from analysis
   */
  async createCoverageAssertions(policy, extraction, analysis) {
    const testIds = [
      ...(extraction?.testIds || []),
      ...(analysis?.testsExplicitlyMentioned || []).map(t => t.toLowerCase().replace(/\s+/g, '-')),
    ];
    const uniqueTestIds = [...new Set(testIds)];

    // Determine layer based on docType
    const layerMap = {
      medical_policy: COVERAGE_LAYERS.POLICY_STANCE,
      um_criteria: COVERAGE_LAYERS.UM_CRITERIA,
      lbm_guideline: COVERAGE_LAYERS.LBM_GUIDELINE,
      provider_bulletin: COVERAGE_LAYERS.OVERLAY,
    };
    const layer = layerMap[policy.docType] || COVERAGE_LAYERS.POLICY_STANCE;

    // Determine status from extraction/analysis
    const statusMap = {
      supports: ASSERTION_STATUS.SUPPORTS,
      restricts: ASSERTION_STATUS.RESTRICTS,
      denies: ASSERTION_STATUS.DENIES,
      unclear: ASSERTION_STATUS.UNCLEAR,
    };
    const status = statusMap[extraction?.stance] || statusMap[analysis?.coverageStatus] || ASSERTION_STATUS.UNCLEAR;

    for (const testId of uniqueTestIds) {
      try {
        upsertCoverageAssertion({
          payerId: policy.payerId,
          testId,
          layer,
          status,
          criteria: {
            cancerTypes: extraction?.cancerTypes || [],
            stages: extraction?.stages || [],
            settings: extraction?.settings || [],
            priorAuth: extraction?.priorAuth,
          },
          sourcePolicyId: policy.id,
          sourceUrl: policy.url,
          sourceQuote: extraction?.criteriaSection?.substring(0, 500),
          effectiveDate: extraction?.effectiveDate,
          confidence: extraction?.stanceConfidence || analysis?.confidence || 0.5,
        });
      } catch (error) {
        logger.warn(`Failed to create assertion for ${testId}`, { error: error.message });
      }
    }
  }

  /**
   * Analyze policy change with Claude (v2: includes extraction context)
   */
  async analyzeChange(policy, content, testMatches, extraction = null) {
    try {
      // v2: Build context from extraction
      const extractionContext = extraction ? buildLLMContext(extraction) : '';

      const prompt = `Analyze this insurance policy document for coverage changes related to ctDNA, liquid biopsy, and MRD testing.

Policy: ${policy.name}
Payer: ${policy.payerName}
Document Type: ${policy.docType || 'unknown'}
Tests found: ${testMatches.map(t => t.id || t.name).join(', ') || 'None from our watchlist'}

${extractionContext}

Content (truncated):
${content.substring(0, 12000)}

Provide a JSON response:
{
  "summary": "2-3 sentence summary of coverage position for ctDNA/liquid biopsy tests",
  "coverageStatus": "supports | restricts | denies | unclear",
  "keyConditions": ["list of key coverage conditions or criteria"],
  "testsExplicitlyMentioned": ["tests from our list explicitly mentioned with coverage decision"],
  "significantChanges": ["any notable changes if this appears to be an update"],
  "confidence": 0.0-1.0
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      logger.error('Claude analysis failed', { error: error.message });
    }

    return null;
  }

  /**
   * Calculate discovery relevance
   */
  calculateRelevance(testMatches, analysis) {
    // High if specific tests mentioned with coverage decision
    if (analysis?.testsExplicitlyMentioned?.length > 0) {
      return 'high';
    }

    // High if multiple monitored tests found
    if (testMatches.length >= 3) {
      return 'high';
    }

    // Medium if some tests found
    if (testMatches.length > 0) {
      return 'medium';
    }

    // Low otherwise
    return 'low';
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a proposal from a payer policy discovery
   */
  async createProposalFromDiscovery(discovery) {
    const { metadata, url, title, summary } = discovery;
    const analysis = metadata?.analysis;

    // Get tests explicitly mentioned with coverage decisions
    const testsWithCoverage = analysis?.testsExplicitlyMentioned || [];

    // Also include tests found in content
    const testsFound = metadata?.testsFound || [];

    // Combine, dedupe, and filter out undefined/null/empty values
    const allTests = [...new Set([...testsWithCoverage, ...testsFound])]
      .filter(name => name && typeof name === 'string' && name.trim().length > 0);

    if (allTests.length === 0) {
      return null; // No specific tests to create proposals for
    }

    // Create a proposal for each test
    let created = 0;
    for (const testName of allTests) {
      try {
        await createProposal(PROPOSAL_TYPES.COVERAGE, {
          testName,
          testId: testName.toLowerCase().replace(/\s+/g, '-'),
          payer: metadata.payerName,
          payerId: metadata.payerId,
          coverageStatus: analysis?.coverageStatus || 'conditional',
          conditions: analysis?.keyConditions?.join('; ') || summary,
          effectiveDate: null,
          source: url,
          sourceTitle: title,
          confidence: analysis?.confidence || 0.7,
          snippet: summary,
        });
        created++;
      } catch (error) {
        logger.warn(`Failed to create proposal for ${testName}`, { error: error.message });
      }
    }

    return created > 0 ? { created } : null;
  }
}

export default PayerCrawler;
