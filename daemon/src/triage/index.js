/**
 * Main triage orchestrator for OpenOnco intelligence daemon
 * Processes discoveries from various crawlers and produces prioritized actions
 *
 * Key functions:
 * - triageDiscoveries(discoveries) - main entry point for batch processing
 * - classifyDiscovery(discovery) - classify single item
 * - extractDataFromPaper(discovery) - extract metrics from PubMed paper
 * - generateUpdateCommand(discovery, extractedData) - create copy-paste command
 */

import { getUnreviewed, loadDiscoveries } from '../queue/index.js';
import { callClaude, parseJsonResponse } from './client.js';
import {
  classifyVendorChanges,
  classifyPapers,
  classifyPayerUpdates,
  generateUpdateCommands,
  generateDigestSummary,
  buildClassificationPrompt,
  buildExtractionPrompt,
  buildActionPrompt
} from './prompts.js';

// =============================================================================
// COST TRACKING
// =============================================================================

/**
 * Cost tracking for Claude API usage
 * Prices per 1M tokens (as of 2025)
 */
const PRICING = {
  inputPerMillion: 3.00,   // $3.00 per 1M input tokens
  outputPerMillion: 15.00  // $15.00 per 1M output tokens
};

/**
 * Track cumulative token usage and costs
 */
class CostTracker {
  constructor() {
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.calls = 0;
  }

  add(usage) {
    if (usage) {
      this.inputTokens += usage.inputTokens || 0;
      this.outputTokens += usage.outputTokens || 0;
      this.calls += 1;
    }
  }

  getCost() {
    const inputCost = (this.inputTokens / 1_000_000) * PRICING.inputPerMillion;
    const outputCost = (this.outputTokens / 1_000_000) * PRICING.outputPerMillion;
    return {
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      totalTokens: this.inputTokens + this.outputTokens,
      inputCost: inputCost.toFixed(4),
      outputCost: outputCost.toFixed(4),
      totalCost: (inputCost + outputCost).toFixed(4),
      apiCalls: this.calls
    };
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Group discoveries by their type/source for batch processing
 * @param {Array} discoveries - Raw discoveries from crawlers
 * @returns {Object} Grouped discoveries
 */
function groupDiscoveries(discoveries) {
  const grouped = {
    vendor: [],
    papers: [],
    payer: [],
    other: []
  };

  for (const discovery of discoveries) {
    const type = (discovery.type || '').toLowerCase();
    const source = (discovery.source || '').toLowerCase();

    if (type === 'vendor_update' || type === 'vendor' || type === 'company' || type === 'news' || source === 'vendor') {
      grouped.vendor.push(discovery);
    } else if (type === 'publication' || type === 'preprint' || type === 'paper' || type === 'research' || source === 'pubmed' || source === 'preprints') {
      grouped.papers.push(discovery);
    } else if (type.includes('payer') || type.includes('coverage') || type === 'policy_update' || source === 'payers' || source === 'cms') {
      grouped.payer.push(discovery);
    } else {
      grouped.other.push(discovery);
    }
  }

  return grouped;
}

/**
 * Batch items into chunks for API calls
 * @param {Array} items - Items to batch
 * @param {number} batchSize - Maximum items per batch
 * @returns {Array<Array>} Batched items
 */
function batchItems(items, batchSize = 10) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Prioritize classified discoveries using local heuristics instead of Claude API.
 * Mirrors the inferPriority logic from markdown-export.js but operates on
 * already-classified items from the batch processors.
 *
 * Rules:
 *   HIGH:   FDA approvals, vendor updates with high relevance, high-relevance items
 *   MEDIUM: CMS/payer policy changes, publications, vendor updates
 *   LOW:    Citations audit, everything else
 *   IGNORED: Items the classifiers already tagged as irrelevant (relevance_score === 0)
 *
 * @param {Object} allClassified - { vendor: [], papers: [], payer: [], other: [] }
 * @returns {{ highPriority: Array, mediumPriority: Array, lowPriority: Array, ignored: Array }}
 */
function prioritizeLocally(allClassified) {
  const highPriority = [];
  const mediumPriority = [];
  const lowPriority = [];
  const ignored = [];

  function bucketItem(item, sourceType) {
    // Items the classifier already flagged as irrelevant
    if (item.relevance_score === 0 || item.category === 'irrelevant' || item.priority === 'ignore') {
      ignored.push({ ...item, _sourceType: sourceType, reason: item.reasoning || 'Classified as irrelevant' });
      return;
    }

    // If the classifier already assigned a priority, trust it
    const classifiedPriority = (item.priority || '').toLowerCase();
    if (classifiedPriority === 'high') { highPriority.push({ ...item, _sourceType: sourceType }); return; }
    if (classifiedPriority === 'medium') { mediumPriority.push({ ...item, _sourceType: sourceType }); return; }
    if (classifiedPriority === 'low') { lowPriority.push({ ...item, _sourceType: sourceType }); return; }

    // Fallback: infer from source type and signals
    const type = (item.type || item.category || '').toLowerCase();
    const relevance = (item.relevance || '').toLowerCase();

    if (type === 'fda_approval' || type === 'regulatory') {
      highPriority.push({ ...item, _sourceType: sourceType });
    } else if (relevance === 'high') {
      highPriority.push({ ...item, _sourceType: sourceType });
    } else if (sourceType === 'vendor' && relevance !== 'low') {
      highPriority.push({ ...item, _sourceType: sourceType });
    } else if (sourceType === 'payer') {
      mediumPriority.push({ ...item, _sourceType: sourceType });
    } else if (sourceType === 'papers') {
      mediumPriority.push({ ...item, _sourceType: sourceType });
    } else if (sourceType === 'vendor') {
      mediumPriority.push({ ...item, _sourceType: sourceType });
    } else {
      lowPriority.push({ ...item, _sourceType: sourceType });
    }
  }

  for (const item of (allClassified.vendor || [])) bucketItem(item, 'vendor');
  for (const item of (allClassified.papers || [])) bucketItem(item, 'papers');
  for (const item of (allClassified.payer || []))  bucketItem(item, 'payer');
  for (const item of (allClassified.other || []))  bucketItem(item, 'other');

  return { highPriority, mediumPriority, lowPriority, ignored };
}

/**
 * Safe API call wrapper - returns null on error instead of throwing
 * @param {Function} apiCall - Async function to call
 * @param {string} context - Context for error logging
 * @returns {Promise<any|null>}
 */
async function safeApiCall(apiCall, context = 'API call') {
  try {
    return await apiCall();
  } catch (error) {
    console.error(`[Triage] ${context} failed:`, error.message);
    return null;
  }
}

// =============================================================================
// SINGLE ITEM PROCESSING FUNCTIONS
// =============================================================================

/**
 * Classify a single discovery
 * Returns priority and classification without detailed extraction
 *
 * @param {Object} discovery - Single discovery object
 * @returns {Promise<Object>} Classification result with priority, classification, reasoning
 */
export async function classifyDiscovery(discovery) {
  const costTracker = new CostTracker();

  try {
    const { systemPrompt, userPrompt } = buildClassificationPrompt(discovery);
    const response = await callClaude(systemPrompt, userPrompt, { maxTokens: 1024 });
    costTracker.add(response.usage);

    const classification = parseJsonResponse(response.content);

    return {
      ...discovery,
      priority: classification.priority || 'low',
      classification: classification.classification || 'unknown',
      confidence: classification.confidence || 'low',
      affectedTests: classification.affectedTests || [],
      testCategory: classification.testCategory || 'unknown',
      reasoning: classification.reasoning || '',
      costs: costTracker.getCost()
    };
  } catch (error) {
    console.error('[Triage] classifyDiscovery failed:', error.message);
    // Return discovery unclassified rather than crashing
    return {
      ...discovery,
      priority: 'low',
      classification: 'error',
      confidence: 'low',
      affectedTests: [],
      testCategory: 'unknown',
      reasoning: `Classification failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Extract actionable data from a paper or press release
 * Pulls specific metrics, values, and citations
 *
 * @param {Object} discovery - Discovery object with content/abstract
 * @returns {Promise<Object>} Extracted data including metrics, citation info
 */
export async function extractDataFromPaper(discovery) {
  const costTracker = new CostTracker();

  try {
    // Build content from discovery - use abstract, summary, or data
    const content = discovery.data?.abstract ||
      discovery.summary ||
      discovery.data?.content ||
      JSON.stringify(discovery.data || {});

    const { systemPrompt, userPrompt } = buildExtractionPrompt(content);
    const response = await callClaude(systemPrompt, userPrompt, { maxTokens: 2048 });
    costTracker.add(response.usage);

    const extracted = parseJsonResponse(response.content);

    return {
      discoveryId: discovery.id,
      testName: extracted.testName,
      testId: extracted.testId,
      vendor: extracted.vendor,
      extractedData: extracted.extractedData || {},
      citation: extracted.citation || {},
      dataQuality: extracted.dataQuality || 'low',
      notes: extracted.notes || '',
      costs: costTracker.getCost()
    };
  } catch (error) {
    console.error('[Triage] extractDataFromPaper failed:', error.message);
    // Return empty extraction rather than crashing
    return {
      discoveryId: discovery.id,
      testName: null,
      testId: null,
      vendor: null,
      extractedData: {},
      citation: {},
      dataQuality: 'error',
      notes: `Extraction failed: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Generate a copy-paste update command for the openonco-submission skill
 *
 * @param {Object} discovery - Original discovery object
 * @param {Object} extractedData - Data extracted from extractDataFromPaper
 * @returns {Promise<Object>} Action command and metadata
 */
export async function generateUpdateCommand(discovery, extractedData) {
  const costTracker = new CostTracker();

  try {
    const { systemPrompt, userPrompt } = buildActionPrompt(discovery, extractedData);
    const response = await callClaude(systemPrompt, userPrompt, { maxTokens: 1024 });
    costTracker.add(response.usage);

    const action = parseJsonResponse(response.content);

    return {
      discoveryId: discovery.id,
      actionCommand: action.actionCommand || null,
      testId: action.testId || extractedData.testId,
      testName: action.testName || extractedData.testName,
      fieldUpdates: action.fieldUpdates || {},
      citationText: action.citationText || '',
      requiresVerification: action.requiresVerification !== false,
      confidence: action.confidence || 'medium',
      notes: action.notes || '',
      costs: costTracker.getCost()
    };
  } catch (error) {
    console.error('[Triage] generateUpdateCommand failed:', error.message);
    // Return null command rather than crashing
    return {
      discoveryId: discovery.id,
      actionCommand: null,
      testId: extractedData?.testId || null,
      testName: extractedData?.testName || null,
      fieldUpdates: {},
      citationText: '',
      requiresVerification: true,
      confidence: 'low',
      notes: `Command generation failed: ${error.message}`,
      error: error.message
    };
  }
}

// =============================================================================
// BATCH PROCESSING FUNCTIONS
// =============================================================================

/**
 * Process vendor changes through classification
 * @param {Array} changes - Vendor change items
 * @param {CostTracker} costTracker - Cost tracking instance
 * @returns {Promise<Array>} Classified changes
 */
async function processVendorChanges(changes, costTracker) {
  if (changes.length === 0) return [];

  const results = [];
  const batches = batchItems(changes, 15);

  for (const batch of batches) {
    const result = await safeApiCall(async () => {
      const { systemPrompt, userPrompt } = classifyVendorChanges(batch);
      const response = await callClaude(systemPrompt, userPrompt);
      costTracker.add(response.usage);
      return parseJsonResponse(response.content);
    }, 'Vendor classification');

    if (result) {
      results.push(...result);
    } else {
      // Return unclassified items on failure
      results.push(...batch.map((item, idx) => ({
        id: item.id || idx,
        category: 'unclassified',
        priority: 'low',
        relevance_score: 0,
        affected_tests: [],
        reasoning: 'Classification failed'
      })));
    }
  }

  return results;
}

/**
 * Process papers through classification
 * @param {Array} papers - Paper items
 * @param {CostTracker} costTracker - Cost tracking instance
 * @returns {Promise<Array>} Classified papers
 */
async function processPapers(papers, costTracker) {
  if (papers.length === 0) return [];

  const results = [];
  const batches = batchItems(papers, 10);

  for (const batch of batches) {
    const result = await safeApiCall(async () => {
      const { systemPrompt, userPrompt } = classifyPapers(batch);
      const response = await callClaude(systemPrompt, userPrompt);
      costTracker.add(response.usage);
      return parseJsonResponse(response.content);
    }, 'Paper classification');

    if (result) {
      results.push(...result);
    } else {
      // Return unclassified items on failure
      results.push(...batch.map((item, idx) => ({
        id: item.id || idx,
        title: item.title || 'Unknown',
        priority: 'low',
        relevance_score: 0,
        category: 'unclassified',
        affected_tests: [],
        key_finding: 'Classification failed'
      })));
    }
  }

  return results;
}

/**
 * Process payer updates through classification
 * @param {Array} updates - Payer update items
 * @param {CostTracker} costTracker - Cost tracking instance
 * @returns {Promise<Array>} Classified updates
 */
async function processPayerUpdates(updates, costTracker) {
  if (updates.length === 0) return [];

  const results = [];
  const batches = batchItems(updates, 10);

  for (const batch of batches) {
    const result = await safeApiCall(async () => {
      const { systemPrompt, userPrompt } = classifyPayerUpdates(batch);
      const response = await callClaude(systemPrompt, userPrompt);
      costTracker.add(response.usage);
      return parseJsonResponse(response.content);
    }, 'Payer classification');

    if (result) {
      results.push(...result);
    } else {
      // Return unclassified items on failure
      results.push(...batch.map((item, idx) => ({
        id: item.id || idx,
        priority: 'low',
        category: 'unclassified',
        impact_level: 'low',
        affected_tests: [],
        action_required: false,
        summary: 'Classification failed'
      })));
    }
  }

  return results;
}

// =============================================================================
// MAIN TRIAGE FUNCTION
// =============================================================================

/**
 * Main triage function - orchestrates the full triage pipeline
 *
 * @param {Array} discoveries - Array of discovery objects from crawlers
 *   Each discovery should have: { id, type, source, title, summary, data, ... }
 * @param {Object} options - Configuration options
 * @param {boolean} options.generateCommands - Whether to generate data.js update commands (default: true)
 * @param {boolean} options.verbose - Enable verbose logging (default: false)
 * @param {boolean} options.loadFromQueue - Load discoveries from queue if none provided (default: false)
 * @returns {Promise<Object>} Triaged results with priorities and actions
 */
export async function triageDiscoveries(discoveries, options = {}) {
  const {
    generateCommands = true,
    verbose = false,
    loadFromQueue = false
  } = options;

  const costTracker = new CostTracker();
  const startTime = Date.now();

  // Load from queue if no discoveries provided and loadFromQueue is true
  let items = discoveries;
  if ((!items || items.length === 0) && loadFromQueue) {
    items = getUnreviewed();
    if (verbose) {
      console.log(`[Triage] Loaded ${items.length} unreviewed discoveries from queue`);
    }
  }

  if (!items || items.length === 0) {
    return {
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
      ignored: [],
      actions: [],
      metadata: {
        inputCount: 0,
        processedAt: new Date().toISOString(),
        durationMs: 0,
        costs: costTracker.getCost()
      },
      classified: {
        vendor: [],
        papers: [],
        payer: []
      }
    };
  }

  if (verbose) {
    console.log(`[Triage] Starting triage of ${items.length} discoveries`);
  }

  // Group discoveries by type for efficient batch processing
  const grouped = groupDiscoveries(items);

  if (verbose) {
    console.log(`[Triage] Grouped: ${grouped.vendor.length} vendor, ${grouped.papers.length} papers, ${grouped.payer.length} payer, ${grouped.other.length} other`);
  }

  // Process each category in parallel where possible
  const [classifiedVendor, classifiedPapers, classifiedPayer] = await Promise.all([
    processVendorChanges(grouped.vendor, costTracker),
    processPapers(grouped.papers, costTracker),
    processPayerUpdates(grouped.payer, costTracker)
  ]);

  if (verbose) {
    console.log(`[Triage] Classification complete. Prioritizing...`);
  }

  // Combine all classified items for prioritization
  const allClassified = {
    vendor: classifiedVendor,
    papers: classifiedPapers,
    payer: classifiedPayer,
    other: grouped.other
  };

  // Prioritize all discoveries using local heuristics (no API call).
  // This avoids sending all 400+ discoveries to Claude in a single prompt,
  // which was hitting token limits. The classifiers already assigned priorities
  // per-batch; we just bucket them here.
  const prioritized = prioritizeLocally(allClassified);

  // Generate update commands if requested and there are actionable items
  let actions = [];
  if (generateCommands && (prioritized.highPriority?.length > 0 || prioritized.mediumPriority?.length > 0)) {
    const actionsToProcess = [
      ...(prioritized.highPriority || []),
      ...(prioritized.mediumPriority || []).slice(0, 10) // Limit medium priority for cost
    ];

    if (actionsToProcess.length > 0) {
      const commandResult = await safeApiCall(async () => {
        const { systemPrompt: cmdSystem, userPrompt: cmdUser } = generateUpdateCommands(actionsToProcess);
        const cmdResponse = await callClaude(cmdSystem, cmdUser);
        costTracker.add(cmdResponse.usage);
        return parseJsonResponse(cmdResponse.content);
      }, 'Command generation');

      if (commandResult) {
        actions = commandResult;
      }
    }
  }

  const duration = Date.now() - startTime;
  const costs = costTracker.getCost();

  if (verbose) {
    console.log(`[Triage] Complete in ${duration}ms. Cost: $${costs.totalCost}`);
    console.log(`[Triage] Results: ${prioritized.highPriority?.length || 0} high, ${prioritized.mediumPriority?.length || 0} medium, ${prioritized.lowPriority?.length || 0} low, ${prioritized.ignored?.length || 0} ignored`);
  }

  return {
    highPriority: prioritized.highPriority || [],
    mediumPriority: prioritized.mediumPriority || [],
    lowPriority: prioritized.lowPriority || [],
    ignored: prioritized.ignored || [],
    actions,
    metadata: {
      inputCount: items.length,
      processedAt: new Date().toISOString(),
      durationMs: duration,
      costs
    },
    classified: {
      vendor: classifiedVendor,
      papers: classifiedPapers,
      payer: classifiedPayer
    }
  };
}

/**
 * Generate a digest summary suitable for email
 * @param {Object} triageResults - Results from triageDiscoveries
 * @returns {Promise<Object>} Digest summary
 */
export async function generateDigest(triageResults) {
  const costTracker = new CostTracker();

  try {
    const { systemPrompt, userPrompt } = generateDigestSummary(triageResults);
    const response = await callClaude(systemPrompt, userPrompt);
    costTracker.add(response.usage);

    const digest = parseJsonResponse(response.content);

    return {
      ...digest,
      costs: costTracker.getCost()
    };
  } catch (error) {
    console.error('[Triage] generateDigest failed:', error.message);
    // Return minimal digest on failure
    return {
      executive_summary: 'Digest generation failed. Please review triage results directly.',
      high_priority_summary: [],
      notable_items: [],
      stats: {
        total_processed: triageResults?.metadata?.inputCount || 0,
        high_priority: triageResults?.highPriority?.length || 0,
        medium_priority: triageResults?.mediumPriority?.length || 0,
        low_priority: triageResults?.lowPriority?.length || 0,
        ignored: triageResults?.ignored?.length || 0
      },
      recommended_actions: [],
      error: error.message,
      costs: costTracker.getCost()
    };
  }
}

/**
 * Quick classification of a single discovery (alias for classifyDiscovery)
 * Useful for real-time processing during crawling
 * @param {Object} discovery - Single discovery object
 * @returns {Promise<Object>} Classification result
 */
export async function classifySingle(discovery) {
  return classifyDiscovery(discovery);
}

/**
 * Process a single discovery through the full pipeline:
 * classify -> extract -> generate command
 *
 * @param {Object} discovery - Single discovery object
 * @returns {Promise<Object>} Full triage result with action command
 */
export async function processDiscoveryFull(discovery) {
  // Step 1: Classify
  const classification = await classifyDiscovery(discovery);

  // Skip further processing if ignored or low priority
  if (classification.priority === 'ignore') {
    return {
      ...classification,
      extractedData: null,
      actionCommand: null,
      skipped: true,
      skipReason: 'Classified as ignore'
    };
  }

  // Step 2: Extract data (only for papers/publications)
  let extractedData = null;
  if (classification.classification === 'validation_study' ||
      classification.classification === 'performance_update' ||
      discovery.source === 'pubmed' ||
      discovery.source === 'preprints') {
    extractedData = await extractDataFromPaper(discovery);
  }

  // Step 3: Generate update command (only for high/medium priority)
  let actionResult = null;
  if (classification.priority === 'high' || classification.priority === 'medium') {
    actionResult = await generateUpdateCommand(discovery, extractedData || {});
  }

  return {
    ...classification,
    extractedData,
    actionCommand: actionResult?.actionCommand || null,
    fieldUpdates: actionResult?.fieldUpdates || {},
    citationText: actionResult?.citationText || '',
    requiresVerification: actionResult?.requiresVerification ?? true,
    commandConfidence: actionResult?.confidence || null
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Main entry point
  triageDiscoveries,

  // Single item processing
  classifyDiscovery,
  extractDataFromPaper,
  generateUpdateCommand,
  processDiscoveryFull,

  // Aliases for compatibility
  classifySingle,
  generateDigest
};
