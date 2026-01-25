/**
 * Prompt templates for triage classification tasks
 * Domain-specific to OpenOnco: liquid biopsy, MRD, ctDNA, molecular diagnostics
 */

// =============================================================================
// CORE PROMPT TEMPLATES
// =============================================================================

/**
 * Base system prompt establishing the AI's role and domain expertise
 */
export const SYSTEM_PROMPT = `You are an expert analyst for OpenOnco, a platform tracking cancer diagnostic tests including:
- Liquid biopsy tests (ctDNA, cfDNA analysis)
- Molecular Residual Disease (MRD) monitoring
- Early Cancer Detection (ECD) / Multi-Cancer Early Detection (MCED)
- Treatment Response Monitoring (TRM)
- Treatment Decision Support (TDS) / Comprehensive Genomic Profiling (CGP)
- Hereditary Cancer Testing (HCT)

Key vendors in this space include: Guardant Health, Foundation Medicine, Natera, Grail, Tempus, Exact Sciences, Myriad Genetics, Invitae, Ambry Genetics, NeoGenomics, Caris Life Sciences, and others.

You understand clinical performance metrics: sensitivity, specificity, PPV, NPV, ctDNA detection limits (LOD), concordance rates, and clinical utility data.

Always respond with valid JSON as specified in the prompt.`;

/**
 * CLASSIFICATION_PROMPT - Classifies a discovery as high/medium/low/ignore priority
 * Used to quickly triage incoming discoveries before detailed analysis
 */
export const CLASSIFICATION_PROMPT = `Classify this discovery for the OpenOnco cancer diagnostics database.

PRIORITY LEVELS:
- high: FDA approvals, major clinical validation studies with new performance data, new test launches, significant coverage decisions
- medium: Updated performance metrics, comparison studies, minor regulatory updates, payer policy changes
- low: Marketing announcements with some data, minor updates, informational content
- ignore: Job postings, investor relations, general corporate news, unrelated content, marketing without substance

CLASSIFICATION TYPES:
- performance_update: New sensitivity/specificity/PPV/NPV data, LOD improvements
- regulatory_update: FDA approval/clearance, CE marking, LDT status changes
- coverage_update: Insurance coverage, reimbursement, CPT codes, CMS decisions
- new_test: Launch of new test or major version
- clinical_trial: Trial results, enrollment updates
- validation_study: Published validation data
- comparison_study: Head-to-head test comparisons
- vendor_update: Company news affecting tests
- not_relevant: Doesn't affect the database

DISCOVERY TO CLASSIFY:
{{discovery}}

Respond with JSON:
{
  "priority": "high" | "medium" | "low" | "ignore",
  "classification": "classification_type from above",
  "confidence": "high" | "medium" | "low",
  "affectedTests": ["Test Name 1", "Test Name 2"],
  "testCategory": "MRD" | "ECD" | "TRM" | "TDS" | "HCT" | "unknown",
  "reasoning": "Brief explanation of classification decision"
}`;

/**
 * EXTRACTION_PROMPT - Extracts actionable data updates from papers/press releases
 * Used to pull specific metrics and values that should update the database
 */
export const EXTRACTION_PROMPT = `Extract actionable data from this scientific paper or press release for updating the OpenOnco cancer diagnostics database.

FIELDS TO EXTRACT (if present):
- Performance metrics: sensitivity, specificity, PPV, NPV, accuracy
- Detection limits: LOD (limit of detection), VAF thresholds, ctDNA detection limits
- Clinical metrics: lead time, concordance rates, clinical utility data
- Study details: sample size, cancer types, patient population, study design
- Regulatory: FDA status changes, clearance dates, indication expansions
- Coverage: payer decisions, CPT codes, reimbursement rates
- Technical: turnaround time, sample requirements, gene panel size

KNOWN TEST IDENTIFIERS (use exact IDs when matching):
- MRD tests: mrd-1 (Signatera), mrd-2 (Guardant Reveal), mrd-3 (FoundationOne Tracker), mrd-4 (RaDaR), mrd-5 (clonoSEQ)
- ECD tests: ecd-1 (Galleri), ecd-2 (Shield), ecd-3 (CancerSEEK)
- TDS tests: tds-1 (FoundationOne CDx), tds-2 (Guardant360 CDx), tds-3 (Tempus xT)
- HCT tests: hct-1 (myRisk), hct-2 (BRACAnalysis)

SOURCE CONTENT:
{{content}}

Respond with JSON:
{
  "testName": "Exact test name",
  "testId": "test-id if known (e.g., mrd-1)",
  "vendor": "Vendor name",
  "extractedData": {
    "sensitivity": "value with % if applicable",
    "specificity": "value with % if applicable",
    "ppv": "positive predictive value",
    "npv": "negative predictive value",
    "detectionLimit": "LOD value",
    "sampleSize": number,
    "cancerTypes": ["cancer type 1", "cancer type 2"],
    "otherMetrics": {}
  },
  "citation": {
    "pmid": "PubMed ID if available",
    "doi": "DOI if available",
    "title": "Publication title",
    "journal": "Journal name",
    "year": "Publication year"
  },
  "dataQuality": "high" | "medium" | "low",
  "notes": "Any important context or caveats"
}`;

/**
 * ACTION_PROMPT - Generates copy-paste commands for data.js updates
 * Formats output for use with the openonco-submission skill
 */
export const ACTION_PROMPT = `Generate a copy-paste ready update command for the OpenOnco database.

DATABASE STRUCTURE:
- Tests are stored in src/data.js in arrays: mrdTestData, ecdTestData, trmTestData, tdsTestData, hctTestData
- Each test has an id (e.g., "mrd-1") and various category-specific fields
- Updates should reference the test id and specify exact field changes

COMMAND FORMAT:
Commands should be formatted for the openonco-submission skill, like:
"Update [test-id] ([Test Name]): Set [field] to [value], citation: [PMID or DOI]"

Examples:
- "Update mrd-1 (Signatera): Set sensitivity to 97.8%, citation: PMID 39847562"
- "Update ecd-1 (Galleri): Set specificity to 99.5%, set cancersDetected to 50, citation: DOI 10.1056/NEJMoa2105..."
- "Update tds-2 (Guardant360 CDx): Set fdaStatus to 'FDA approved', set approvalDate to '2024-08-15', citation: FDA approval letter"

DISCOVERY DATA:
{{discovery}}

EXTRACTED DATA:
{{extractedData}}

Respond with JSON:
{
  "actionCommand": "The formatted update command for openonco-submission skill",
  "testId": "test-id (e.g., mrd-1)",
  "testName": "Human-readable test name",
  "fieldUpdates": {
    "fieldName": "newValue"
  },
  "citationText": "PMID XXXXX or DOI or source URL",
  "requiresVerification": true | false,
  "confidence": "high" | "medium" | "low",
  "notes": "Any important context for the reviewer"
}`;

// =============================================================================
// BATCH PROCESSING PROMPTS
// =============================================================================

/**
 * Classify vendor/company changes by type and importance
 * @param {Array} changes - Array of change objects from vendor crawlers
 * @returns {Object} Prompt configuration for classification
 */
export function classifyVendorChanges(changes) {
  const userPrompt = `Classify each of the following vendor updates into one of these categories:

CATEGORIES:
- performance_update: New clinical data, sensitivity/specificity updates, LOD improvements, concordance data
- new_test: Launch of a new test product or significant new version
- regulatory_update: FDA approval/clearance, CE marking, LDT status changes, CMS coverage decisions
- coverage_update: Insurance coverage changes, reimbursement updates, CPT code changes
- marketing: Press releases without substantive data, promotional content, awards/recognition
- ignore: Job postings, general corporate news, investor relations, unrelated content

For each update, also assess:
- relevance_score: 1-10 (10 = highly relevant to test database)
- affected_tests: Array of test names that might be affected (if identifiable)
- key_data: Any specific metrics or data points mentioned

VENDOR UPDATES TO CLASSIFY:
${JSON.stringify(changes, null, 2)}

Respond with JSON array:
[
  {
    "id": "original id or index",
    "category": "category_name",
    "priority": "high" | "medium" | "low" | "ignore",
    "relevance_score": 8,
    "affected_tests": ["Test Name"],
    "key_data": {"metric": "value"},
    "reasoning": "brief explanation"
  }
]`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

/**
 * Classify academic papers for relevance and extract performance metrics
 * @param {Array} papers - Array of paper objects (title, abstract, source)
 * @returns {Object} Prompt configuration for classification
 */
export function classifyPapers(papers) {
  const userPrompt = `Analyze these academic papers for relevance to cancer diagnostic tests.

FOCUS ON:
- Clinical validation studies for liquid biopsy tests
- Performance data (sensitivity, specificity, PPV, NPV)
- ctDNA detection limits and technical performance
- Comparison studies between tests
- Real-world evidence and clinical utility data
- Regulatory submission supporting data

IGNORE:
- Basic science without clinical application
- Reviews without new data
- Case reports (unless notable)
- Non-cancer liquid biopsy applications

PAPERS TO ANALYZE:
${JSON.stringify(papers, null, 2)}

For each paper, provide:
- priority: "high" | "medium" | "low" | "ignore"
- relevance_score: 1-10 (10 = directly updates a test's performance data)
- category: "validation_study" | "comparison_study" | "real_world_evidence" | "technical_performance" | "regulatory_support" | "not_relevant"
- affected_tests: Test names mentioned or likely affected
- extracted_metrics: Any performance metrics mentioned (be specific with values)
- cancer_types: Cancer types studied
- sample_size: If mentioned
- key_finding: One sentence summary of main finding

Respond with JSON array:
[
  {
    "id": "original id or index",
    "title": "paper title",
    "priority": "high",
    "relevance_score": 7,
    "category": "validation_study",
    "affected_tests": ["Signatera", "Guardant Reveal"],
    "extracted_metrics": {
      "sensitivity": "91.3%",
      "specificity": "98.2%",
      "sample_size": 250
    },
    "cancer_types": ["colorectal", "breast"],
    "key_finding": "Demonstrated 91.3% sensitivity for MRD detection in stage III CRC"
  }
]`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

/**
 * Classify payer/coverage updates and match to specific tests
 * @param {Array} updates - Array of payer policy updates
 * @returns {Object} Prompt configuration for classification
 */
export function classifyPayerUpdates(updates) {
  const userPrompt = `Analyze these payer/insurance coverage updates for cancer diagnostic tests.

COVERAGE CATEGORIES:
- positive_coverage: New coverage, expanded indications, favorable LCD/NCD
- negative_coverage: Coverage denial, restriction, unfavorable policy
- coverage_update: Changes to existing coverage (limits, criteria)
- reimbursement_change: Payment rate changes, CPT code updates
- policy_draft: Proposed policy open for comment
- not_applicable: Not related to cancer diagnostics

KNOWN TESTS TO MATCH:
- MRD: Signatera (mrd-1), Guardant Reveal (mrd-2), FoundationOne Tracker (mrd-3), RaDaR (mrd-4), clonoSEQ (mrd-5)
- ECD/MCED: Galleri (ecd-1), Shield (ecd-2), CancerSEEK (ecd-3)
- TDS/CGP: FoundationOne CDx (tds-1), Guardant360 CDx (tds-2), Tempus xT (tds-3), Caris MI Profile (tds-4)
- HCT: myRisk (hct-1), BRACAnalysis (hct-2), GeneSight (hct-3)

PAYER UPDATES TO ANALYZE:
${JSON.stringify(updates, null, 2)}

For each update, provide:
- priority: "high" | "medium" | "low" | "ignore"
- category: coverage category from above
- impact_level: "high" | "medium" | "low"
- affected_tests: Specific test names affected with IDs
- payer_name: Insurance company or CMS/Medicare
- effective_date: If mentioned
- coverage_criteria: Key coverage requirements mentioned
- action_required: Boolean - does this need database update?

Respond with JSON array:
[
  {
    "id": "original id or index",
    "priority": "high",
    "category": "positive_coverage",
    "impact_level": "high",
    "affected_tests": [{"name": "Signatera", "id": "mrd-1"}],
    "payer_name": "UnitedHealthcare",
    "effective_date": "2025-01-01",
    "coverage_criteria": "Stage III CRC post-surgery, every 3 months",
    "action_required": true,
    "summary": "UHC now covers Signatera for stage III CRC MRD monitoring"
  }
]`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

/**
 * Prioritize all discoveries into actionable items
 * @param {Object} allDiscoveries - Combined classified discoveries from all sources
 * @returns {Object} Prompt configuration for prioritization
 */
export function prioritizeActions(allDiscoveries) {
  const userPrompt = `Given all these classified discoveries, create a prioritized action list for updating the OpenOnco database.

DATABASE UPDATE TYPES:
1. Performance metrics: sensitivity, specificity, PPV, NPV, LOD
2. Coverage/availability: FDA status, insurance coverage, availability
3. New tests: Adding entirely new tests to database
4. Regulatory: FDA approvals, clearances, label expansions
5. Pricing: Test pricing updates

PRIORITY CRITERIA:
- HIGH: FDA approvals, major performance updates with published data, new test launches
- MEDIUM: Coverage changes, minor metric updates, comparison study results
- LOW: Informational updates, marketing materials with some data

CLASSIFIED DISCOVERIES:
${JSON.stringify(allDiscoveries, null, 2)}

Create a prioritized action list. For each action:
- priority: "high" | "medium" | "low"
- action_type: "update_metrics" | "update_coverage" | "add_test" | "update_regulatory" | "update_pricing" | "review_needed"
- test_id: Test ID (e.g., "mrd-1") if known
- test_name: Specific test affected
- test_category: "MRD" | "ECD" | "TRM" | "TDS" | "HCT"
- field_updates: Object with field names and new values
- source: Where this information came from
- confidence: "high" | "medium" | "low" - how confident in the data
- verification_needed: Boolean - should be vendor-verified before updating

Also identify items to ignore (marketing fluff, duplicates, irrelevant).

Respond with JSON:
{
  "highPriority": [...],
  "mediumPriority": [...],
  "lowPriority": [...],
  "ignored": [{"id": "...", "reason": "..."}]
}`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

/**
 * Generate specific update commands for data.js
 * Formats output for the openonco-submission skill
 * @param {Array} prioritizedActions - Prioritized actions from previous step
 * @returns {Object} Prompt configuration for command generation
 */
export function generateUpdateCommands(prioritizedActions) {
  const userPrompt = `Generate specific, copy-paste ready commands for updating src/data.js based on these prioritized actions.

COMMAND FORMAT FOR OPENONCO-SUBMISSION SKILL:
Each command should be a single line in this format:
"Update [test-id] ([Test Name]): Set [field] to [value], citation: [PMID or source]"

Examples:
- "Update mrd-1 (Signatera): Set sensitivity to 97.8%, citation: PMID 39847562"
- "Update ecd-1 (Galleri): Set specificity to 99.5%, set cancersDetected to 50, citation: DOI 10.1056/NEJMoa2105..."
- "Update tds-2 (Guardant360 CDx): Set fdaStatus to 'FDA approved', citation: FDA approval letter"

For multiple field updates, combine them in one command:
- "Update mrd-1 (Signatera): Set sensitivity to 95.3%, set specificity to 99.8%, citation: NEJM 2025 (PMID 12345678)"

DATA.JS STRUCTURE:
- Tests are in arrays: mrdTestData, ecdTestData, trmTestData, tdsTestData, hctTestData
- Each test has: id, name, slug, vendor, vendorVerified, and category-specific fields

EXAMPLE MRD TEST FIELDS:
{
  sensitivity: "95%",
  specificity: "99.5%",
  detectionLimit: "0.01% VAF",
  turnaroundTime: "7-10 days",
  fdaStatus: "FDA cleared",
  cancerTypes: ["colorectal", "breast", "lung"]
}

EXAMPLE ECD TEST FIELDS:
{
  sensitivity: "51.5%",
  specificity: "99.5%",
  cancersDetected: 50,
  fdaStatus: "LDT",
  targetPopulation: "Adults 50+"
}

PRIORITIZED ACTIONS:
${JSON.stringify(prioritizedActions, null, 2)}

For each action, generate:
1. actionCommand: The formatted command for openonco-submission skill
2. test_id: Test ID (e.g., "mrd-1")
3. test_name: Human-readable name
4. updates: Object with field names and new values
5. citation: Source reference
6. requires_verification: Boolean
7. confidence: "high" | "medium" | "low"

Format as JSON array:
[
  {
    "actionCommand": "Update mrd-1 (Signatera): Set sensitivity to 95.3%, set specificity to 99.8%, citation: PMID 12345678",
    "test_id": "mrd-1",
    "test_name": "Signatera",
    "array_name": "mrdTestData",
    "updates": {
      "sensitivity": "95.3%",
      "specificity": "99.8%"
    },
    "citation": "PMID 12345678",
    "requires_verification": true,
    "confidence": "high"
  }
]

Only generate commands for actions with sufficient data. Skip if information is incomplete or unreliable.`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

/**
 * Generate a summary digest of all triage results
 * @param {Object} triageResults - Complete triage results
 * @returns {Object} Prompt configuration for summary generation
 */
export function generateDigestSummary(triageResults) {
  const userPrompt = `Generate a concise summary digest of these triage results for email notification.

TRIAGE RESULTS:
${JSON.stringify(triageResults, null, 2)}

Create a summary with:
1. Executive summary (2-3 sentences)
2. High priority items requiring immediate attention
3. Notable medium priority items
4. Statistics (items processed, by category, etc.)

Format as JSON:
{
  "executive_summary": "...",
  "high_priority_summary": [
    {"test": "...", "update": "...", "source": "...", "actionCommand": "..."}
  ],
  "notable_items": [...],
  "stats": {
    "total_processed": 0,
    "high_priority": 0,
    "medium_priority": 0,
    "low_priority": 0,
    "ignored": 0
  },
  "recommended_actions": ["..."]
}`;

  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Build a classification prompt for a single discovery
 * @param {Object} discovery - Discovery object to classify
 * @returns {Object} System and user prompts
 */
export function buildClassificationPrompt(discovery) {
  const userPrompt = CLASSIFICATION_PROMPT.replace('{{discovery}}', JSON.stringify(discovery, null, 2));
  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

/**
 * Build an extraction prompt for paper/press release content
 * @param {string} content - The content to extract data from
 * @returns {Object} System and user prompts
 */
export function buildExtractionPrompt(content) {
  const userPrompt = EXTRACTION_PROMPT.replace('{{content}}', content);
  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

/**
 * Build an action prompt for generating update commands
 * @param {Object} discovery - Original discovery
 * @param {Object} extractedData - Data extracted from the content
 * @returns {Object} System and user prompts
 */
export function buildActionPrompt(discovery, extractedData) {
  const userPrompt = ACTION_PROMPT
    .replace('{{discovery}}', JSON.stringify(discovery, null, 2))
    .replace('{{extractedData}}', JSON.stringify(extractedData, null, 2));
  return { systemPrompt: SYSTEM_PROMPT, userPrompt };
}

export default {
  // Core prompt templates
  SYSTEM_PROMPT,
  CLASSIFICATION_PROMPT,
  EXTRACTION_PROMPT,
  ACTION_PROMPT,

  // Batch processing functions
  classifyVendorChanges,
  classifyPapers,
  classifyPayerUpdates,
  prioritizeActions,
  generateUpdateCommands,
  generateDigestSummary,

  // Helper functions for single-item processing
  buildClassificationPrompt,
  buildExtractionPrompt,
  buildActionPrompt
};
