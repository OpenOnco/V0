/**
 * Publication Index Extraction Prompts
 *
 * Claude prompt templates for extracting publication citations from
 * different types of source pages. Each prompt is tuned for the specific
 * structure and content patterns of that source type.
 */

/**
 * Evidence type mapping for extracted publications
 */
export const EVIDENCE_TYPES = {
  RCT_RESULTS: 'rct_results',
  OBSERVATIONAL: 'observational',
  META_ANALYSIS: 'meta_analysis',
  GUIDELINE: 'guideline',
  CONSENSUS: 'consensus',
  REVIEW: 'review',
  REGULATORY: 'regulatory',
  CASE_SERIES: 'case_series',
};

/**
 * Interpretation guardrails by source type
 */
export const GUARDRAILS = {
  society_editorial: 'Society editorial; reflects expert opinion on evidence interpretation',
  news_review: 'Secondary source; refer to primary publication for clinical decisions',
  vendor_guideline_excerpt: 'Vendor-hosted excerpt; consult full guideline for complete context',
  vendor_publication: 'Vendor-curated evidence; independently verify clinical applicability',
  press_release: 'Press release summary; refer to primary publication for full methodology',
};

/**
 * Base prompt for publication extraction
 */
const BASE_EXTRACTION_PROMPT = `
You are extracting publication citations from a web page. For each publication found, extract:

- title: Full publication title
- authors: First author surname, or "FirstAuthor et al" if multiple authors shown
- journal: Journal name (full or abbreviated)
- year: Publication year (4 digits)
- doi: DOI if present (format: 10.xxxx/xxxxx)
- pmid: PubMed ID if present (numeric only)
- url: Direct link to paper if available
- evidence_type: One of [rct_results, observational, meta_analysis, guideline, consensus, review, case_series]
- cancer_types: Array of cancer types mentioned (e.g., ["colorectal", "breast"])
- clinical_context: Brief description (1-2 sentences) of what the study shows

Rules:
- Only include actual publications (peer-reviewed papers, guidelines)
- Exclude marketing claims, testimonials, or product descriptions
- If DOI/PMID not shown, leave as null
- Infer evidence_type from context (RCT keywords: randomized, phase II/III, trial; observational: cohort, retrospective, registry)
- Return empty array if no publications found

Return as JSON array only, no explanation text.
`;

/**
 * Prompt for vendor publication index pages
 * These pages typically list publications organized by topic or date
 */
export const VENDOR_PUBLICATIONS_INDEX = `
${BASE_EXTRACTION_PROMPT}

Page type: Vendor Publications Index
This is a vendor's official publications page listing studies related to their diagnostic tests.

Additional context:
- Publications may be organized by test name, cancer type, or publication date
- Look for links to PubMed, journal websites, or PDF downloads
- The vendor may highlight key findings - use these to inform clinical_context
- Watch for publication metadata in structured formats (tables, cards)

Extract all publications that are:
1. Peer-reviewed clinical studies
2. Guidelines or consensus statements
3. Real-world evidence studies
4. Regulatory submissions with published data

Page content:
---
{content}
---

Return JSON array of publications:
`;

/**
 * Prompt for vendor evidence overview pages
 * These summarize clinical evidence with embedded citations
 */
export const VENDOR_EVIDENCE_PAGE = `
${BASE_EXTRACTION_PROMPT}

Page type: Vendor Evidence Overview
This page summarizes clinical evidence supporting a diagnostic test, with citations embedded in the text.

Additional context:
- Look for superscript numbers or inline citations
- References may be at the bottom of the page or in footnotes
- Key metrics (sensitivity, specificity, NPV) may be cited
- Trial names (e.g., CIRCULATE, DYNAMIC) often link to publications

Extract publications from:
1. Reference lists or footnotes
2. Inline citations with author/year
3. Links to publications within the evidence text
4. Trial result announcements with publication details

Page content:
---
{content}
---

Return JSON array of publications:
`;

/**
 * Prompt for society editorial/commentary pages
 * These require extra care to distinguish opinion from cited evidence
 */
export const SOCIETY_EDITORIAL = `
${BASE_EXTRACTION_PROMPT}

Page type: Society Editorial/Commentary
This is an editorial or commentary from a medical society (ESMO, ASCO, etc.) discussing MRD/ctDNA evidence.

IMPORTANT: Editorials contain BOTH cited publications AND editorial interpretation.
- Extract only the CITED publications, not the editorial opinions
- Note that the editorial itself is interpreting these publications
- Clinical claims in editorials may not fully represent the cited evidence

Additional extraction rules:
- Focus on numbered references or inline citations
- Include the original trial/study publications being discussed
- If the editorial cites a guideline, include that guideline
- Exclude the editorial itself from the extraction (it's the source, not an extracted item)

Page content:
---
{content}
---

Return JSON array of CITED publications only:
`;

/**
 * Prompt for news/review article pages
 * Secondary sources that summarize primary research
 */
export const NEWS_REVIEW = `
${BASE_EXTRACTION_PROMPT}

Page type: News Article or Review Summary
This is a news article or review summarizing recent MRD/ctDNA research.

IMPORTANT: This is a SECONDARY source. Extract the PRIMARY publications it references.
- News articles often paraphrase or simplify findings
- Look for the original study being discussed
- Conference presentations may be mentioned - include if publication details given

Additional extraction rules:
- Find the original publication(s) being reported on
- Look for author names, journal names, and DOIs in the text
- Conference abstracts may be referenced (ASCO, ESMO, AACR)
- If only a trial name is given without publication details, still extract with available info

Page content:
---
{content}
---

Return JSON array of PRIMARY publications referenced:
`;

/**
 * Prompt for guideline pages with publication references
 */
export const GUIDELINE_REFERENCES = `
${BASE_EXTRACTION_PROMPT}

Page type: Clinical Guideline
This is a clinical guideline or guideline summary with supporting references.

Additional context:
- Guidelines cite supporting evidence with specific recommendation levels
- Reference lists are typically numbered and detailed
- Some guidelines cite other guidelines (NCCN citing ASCO, etc.)
- Evidence grades (1A, 2B, etc.) may accompany citations

Extract:
1. All publications in the reference list
2. Inline citations with publication details
3. Other guidelines cited as supporting evidence

For evidence_type:
- The guideline itself is type "guideline"
- Cited trials are "rct_results" or "observational"
- Cited systematic reviews are "meta_analysis"

Page content:
---
{content}
---

Return JSON array of referenced publications:
`;

/**
 * Map coarse source_type (from DB) to detailed prompt key
 * DB stores: vendor, guideline, news, society
 * Prompts expect: vendor_publications_index, society_editorial, etc.
 */
const SOURCE_TYPE_TO_PROMPT_KEY = {
  vendor: 'vendor_publications_index',
  guideline: 'guideline_references',
  news: 'news_review',
  society: 'society_editorial',
};

/**
 * Get the appropriate prompt for a source type
 * @param {string} sourceType - The type of source page (coarse or detailed)
 * @returns {string} The prompt template
 */
export function getPromptForSourceType(sourceType) {
  const prompts = {
    vendor_publications_index: VENDOR_PUBLICATIONS_INDEX,
    vendor_evidence_page: VENDOR_EVIDENCE_PAGE,
    society_editorial: SOCIETY_EDITORIAL,
    news_review: NEWS_REVIEW,
    guideline_references: GUIDELINE_REFERENCES,
  };

  // First check if it's a detailed key, then map from coarse type
  const promptKey = prompts[sourceType] ? sourceType : SOURCE_TYPE_TO_PROMPT_KEY[sourceType];
  return prompts[promptKey] || VENDOR_PUBLICATIONS_INDEX;
}

/**
 * Map coarse source_type to guardrail key
 */
const SOURCE_TYPE_TO_GUARDRAIL_KEY = {
  society: 'society_editorial',
  news: 'news_review',
  // vendor and guideline don't have default guardrails
};

/**
 * Get the interpretation guardrail for a source type
 * @param {string} sourceType - The type of source page (coarse or detailed)
 * @returns {string|null} The guardrail text, or null if not needed
 */
export function getGuardrailForSourceType(sourceType) {
  // First check if it's a detailed key, then map from coarse type
  const guardrailKey = GUARDRAILS[sourceType] ? sourceType : SOURCE_TYPE_TO_GUARDRAIL_KEY[sourceType];
  return GUARDRAILS[guardrailKey] || null;
}

/**
 * Format content for prompt injection
 * Truncates and cleans content for Claude analysis
 * @param {string} content - Raw page content
 * @param {number} maxLength - Maximum content length (default: 15000)
 * @returns {string} Formatted content
 */
export function formatContentForPrompt(content, maxLength = 15000) {
  if (!content) return '';

  // Clean up whitespace
  let cleaned = content
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Truncate if needed
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength) + '\n\n[Content truncated...]';
  }

  return cleaned;
}

export default {
  EVIDENCE_TYPES,
  GUARDRAILS,
  VENDOR_PUBLICATIONS_INDEX,
  VENDOR_EVIDENCE_PAGE,
  SOCIETY_EDITORIAL,
  NEWS_REVIEW,
  GUIDELINE_REFERENCES,
  getPromptForSourceType,
  getGuardrailForSourceType,
  formatContentForPrompt,
};
