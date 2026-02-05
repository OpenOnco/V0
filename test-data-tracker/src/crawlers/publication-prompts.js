/**
 * Publication Index Extraction Prompts
 *
 * Claude prompt templates for extracting publication citations from different
 * types of vendor and society source pages. Each prompt is tuned for the
 * specific content structure of that source type.
 */

/**
 * Prompt for vendor publications index pages
 * Used for pages that list publications in a dedicated publications/evidence section
 */
export const VENDOR_PUBLICATIONS_INDEX_PROMPT = `Analyze this vendor publications page and extract all cited publications.

For each publication found, extract:
- title: Full title of the publication
- authors: First author surname followed by "et al" if multiple authors
- journal: Journal name (if available)
- year: Publication year (4-digit year)
- doi: DOI if present (format: 10.xxxx/...)
- pmid: PubMed ID if present (numeric only)
- url: Direct link to paper if available
- evidence_type: One of [rct_results, observational, meta_analysis, guideline, consensus, review, case_series]
- cancer_types: Array of cancer types mentioned (e.g., ["colorectal", "breast"])
- clinical_context: Brief description (1-2 sentences) of what the study shows

Return as JSON array. Example format:
{
  "publications": [
    {
      "title": "Circulating Tumor DNA Analysis for Assessment of Recurrence Risk...",
      "authors": "Tie et al",
      "journal": "JAMA Oncology",
      "year": "2024",
      "doi": "10.1001/jamaoncol.2024.1234",
      "pmid": "38765432",
      "url": "https://pubmed.ncbi.nlm.nih.gov/38765432/",
      "evidence_type": "rct_results",
      "cancer_types": ["colorectal"],
      "clinical_context": "Phase III trial demonstrating ctDNA-guided adjuvant therapy reduces overtreatment in stage II colon cancer."
    }
  ],
  "extraction_notes": "Found 12 publications on this page, 8 with sufficient metadata for extraction."
}

Important:
- Only include items that are actual peer-reviewed publications (not marketing claims, product descriptions, or press releases)
- If a citation is incomplete (missing title or journal), still include it with available fields
- For evidence_type, use your judgment based on context clues (trial names, study design mentions)
- Always extract cancer_types when mentioned in the context of the publication`;

/**
 * Prompt for vendor evidence overview pages
 * Used for pages that embed evidence within marketing/product content
 */
export const VENDOR_EVIDENCE_PAGE_PROMPT = `Analyze this vendor evidence page and extract all referenced clinical publications.

This is a product evidence page that may mix marketing content with clinical references.
Focus on extracting actual peer-reviewed publications, not marketing claims.

For each publication reference found, extract:
- title: Full title (or partial if that's all that's visible)
- authors: First author surname (if mentioned)
- journal: Journal name (if available)
- year: Publication year
- doi: DOI if present
- pmid: PubMed ID if present
- evidence_type: One of [rct_results, observational, meta_analysis, guideline, consensus, review]
- cancer_types: Array of cancer types mentioned
- clinical_context: What this evidence demonstrates

Return as JSON:
{
  "publications": [...],
  "vendor_claims": [
    {
      "claim": "98% sensitivity for detecting MRD",
      "supporting_publication": "Title of referenced paper if linked to a publication",
      "unsupported": false
    }
  ],
  "extraction_notes": "Notes about extraction quality or missing information"
}

Important:
- Distinguish between actual publications and vendor claims
- If a claim references a specific study, link them
- Mark claims as "unsupported" if they don't cite specific evidence
- Ignore general marketing language without scientific backing`;

/**
 * Prompt for society editorial pages (ESMO, ASCO, etc.)
 * Used for expert commentary and guideline interpretations
 */
export const SOCIETY_EDITORIAL_PROMPT = `Analyze this society editorial or guideline commentary page and extract cited publications.

Society editorials often interpret primary evidence - extract both the cited studies AND note interpretation caveats.

For each publication cited, extract:
- title: Full title
- authors: Author(s) as cited
- journal: Journal name
- year: Publication year
- doi: DOI if present
- pmid: PubMed ID if present
- evidence_type: One of [rct_results, observational, meta_analysis, guideline, consensus, review]
- cancer_types: Array of cancer types
- clinical_context: What the editorial says this study shows
- interpretation_caveat: How the editorial qualifies or interprets this evidence

Return as JSON:
{
  "publications": [...],
  "editorial_summary": "Brief summary of the editorial's main conclusions",
  "society_position": "Any explicit position statement on the evidence",
  "guardrail_text": "Suggested interpretation guardrail for this source type",
  "extraction_notes": "..."
}

Important:
- Editorials reflect expert opinion on evidence interpretation - note this context
- Look for qualifying language ("suggests but does not prove", "preliminary", "further study needed")
- Extract the interpretation_caveat to help users understand the editorial perspective
- Suggested guardrail_text: "Society editorial; reflects expert opinion on evidence interpretation"`;

/**
 * Prompt for news and review articles
 * Used for secondary sources that summarize primary research
 */
export const NEWS_REVIEW_PROMPT = `Analyze this news article or review about clinical evidence and extract the primary publications it references.

This is a secondary source - extract the original studies it discusses.

For each primary publication referenced, extract:
- title: Title of the original study (not the news article)
- authors: Authors of the original study
- journal: Journal where originally published
- year: Publication year
- doi: DOI if available
- pmid: PubMed ID if available
- evidence_type: One of [rct_results, observational, meta_analysis, guideline, consensus, review]
- cancer_types: Array of cancer types
- clinical_context: What the news article says about this study

Return as JSON:
{
  "publications": [...],
  "article_summary": "Brief summary of what this news article covers",
  "primary_vs_secondary": {
    "primary_sources_found": 3,
    "direct_links_available": 2
  },
  "guardrail_text": "Suggested interpretation guardrail",
  "extraction_notes": "..."
}

Important:
- The goal is to identify PRIMARY publications, not to extract the news article itself
- If the news article quotes researchers, try to identify the study being discussed
- Suggested guardrail_text: "Secondary source; refer to primary publication for clinical decisions"
- Note if any claims lack traceable primary sources`;

/**
 * Prompt for guideline excerpt pages
 * Used when vendors host excerpts from NCCN or other guidelines
 */
export const GUIDELINE_EXCERPT_PROMPT = `Analyze this guideline excerpt page and extract publications cited within the guideline text.

Guidelines often cite evidence supporting recommendations. Extract:

For each publication cited:
- title: Full title if available
- authors: Authors as cited
- journal: Journal name
- year: Publication year
- doi: DOI if present
- pmid: PubMed ID if present
- evidence_type: Type of evidence
- cancer_types: Cancer types relevant to this citation
- recommendation_context: What guideline recommendation this evidence supports
- evidence_level: If the guideline assigns an evidence level (e.g., "Category 1", "Level A")

Return as JSON:
{
  "publications": [...],
  "guideline_source": "Name of the full guideline (e.g., NCCN Colon Cancer)",
  "guideline_version": "Version if mentioned",
  "excerpt_context": "What section of the guideline is excerpted",
  "guardrail_text": "Suggested interpretation guardrail",
  "extraction_notes": "..."
}

Important:
- Note that excerpts may not reflect full guideline context
- Suggested guardrail_text: "Excerpt may not reflect full guideline context; consult full NCCN guidelines"
- Extract evidence levels when available (these help with clinical interpretation)`;

/**
 * Prompt for conference abstract pages (ASCO, ESMO, etc.)
 * Used for extracting structured data from conference abstract search results
 */
export const CONFERENCE_ABSTRACT_PROMPT = `Analyze this conference abstract search results page and extract all MRD/ctDNA-related abstracts.

For each abstract found, extract:
- title: Full title of the abstract/presentation
- authors: Authors as listed (first author et al if long)
- abstract_number: Abstract/poster number (e.g., "Abstract 3500", "Poster P-123")
- presentation_type: oral, poster, or plenary (if indicated)
- year: Year of the conference
- doi: DOI if present
- url: Direct link to the abstract if available
- evidence_type: One of [rct_results, observational, meta_analysis, review, case_series]
- cancer_types: Array of cancer types mentioned (e.g., ["colorectal", "breast"])
- clinical_context: Brief description (1-2 sentences) of the main finding
- conclusions: Key conclusions from the abstract
- trial_ids: Any clinical trial IDs mentioned (NCT numbers)
- test_names: Specific diagnostic test names mentioned (e.g., "Signatera", "Guardant360")

Return as JSON:
{
  "publications": [
    {
      "title": "ctDNA-guided adjuvant therapy in stage III colon cancer: CIRCULATE trial results",
      "authors": "Smith et al",
      "abstract_number": "Abstract 3500",
      "presentation_type": "oral",
      "year": "2025",
      "doi": null,
      "url": "https://meetings.asco.org/abstracts/...",
      "evidence_type": "rct_results",
      "cancer_types": ["colorectal"],
      "clinical_context": "Phase III trial showing ctDNA-guided approach reduced unnecessary chemotherapy by 50% in stage III CRC.",
      "conclusions": "ctDNA-guided adjuvant therapy is non-inferior to standard of care with significantly less overtreatment.",
      "trial_ids": ["NCT04120701"],
      "test_names": ["Signatera"]
    }
  ],
  "extraction_notes": "Found 5 abstracts related to MRD/ctDNA on this page."
}

Important:
- Only include abstracts that specifically discuss ctDNA, liquid biopsy, MRD, or named diagnostic tests
- Conference abstracts are preliminary results - note this in clinical_context when appropriate
- Extract trial NCT IDs when mentioned - these help link to ClinicalTrials.gov records
- Extract specific test names to enable matching to our test database
- If abstract text is not visible (only titles shown), extract what's available and note in extraction_notes`;

/**
 * Get the appropriate prompt for a source type
 * @param {string} sourceType - Type of source being crawled
 * @returns {string} - The prompt template
 */
export function getPromptForSourceType(sourceType) {
  const prompts = {
    vendor_publications_index: VENDOR_PUBLICATIONS_INDEX_PROMPT,
    vendor_evidence_page: VENDOR_EVIDENCE_PAGE_PROMPT,
    vendor: VENDOR_EVIDENCE_PAGE_PROMPT,
    society_editorial: SOCIETY_EDITORIAL_PROMPT,
    society: SOCIETY_EDITORIAL_PROMPT,
    news_review: NEWS_REVIEW_PROMPT,
    news: NEWS_REVIEW_PROMPT,
    guideline_excerpt: GUIDELINE_EXCERPT_PROMPT,
    guideline: GUIDELINE_EXCERPT_PROMPT,
    conference: CONFERENCE_ABSTRACT_PROMPT,
    conference_abstract: CONFERENCE_ABSTRACT_PROMPT,
  };

  return prompts[sourceType] || VENDOR_PUBLICATIONS_INDEX_PROMPT;
}

/**
 * Get interpretation guardrail text for a source type
 * @param {string} sourceType - Type of source
 * @returns {string|null} - Guardrail text or null
 */
export function getDefaultGuardrail(sourceType) {
  const guardrails = {
    society_editorial: 'Society editorial; reflects expert opinion on evidence interpretation',
    society: 'Society editorial; reflects expert opinion on evidence interpretation',
    news_review: 'Secondary source; refer to primary publication for clinical decisions',
    news: 'Secondary source; refer to primary publication for clinical decisions',
    guideline_excerpt: 'Excerpt may not reflect full guideline context; consult full NCCN guidelines',
    guideline: 'Excerpt may not reflect full guideline context; consult full guidelines',
    conference: 'Conference abstract; preliminary results not yet peer-reviewed',
    conference_abstract: 'Conference abstract; preliminary results not yet peer-reviewed',
    vendor_publications_index: null, // Primary sources, no guardrail needed
    vendor_evidence_page: null,
    vendor: null,
  };

  return guardrails[sourceType] || null;
}

/**
 * Map evidence type strings to canonical values
 * @param {string} rawType - Raw evidence type from extraction
 * @returns {string} - Canonical evidence type
 */
export function normalizeEvidenceType(rawType) {
  if (!rawType) return 'observational';

  const normalized = rawType.toLowerCase().replace(/[_\s-]+/g, '_');

  const typeMap = {
    rct_results: 'rct_results',
    rct: 'rct_results',
    randomized_controlled_trial: 'rct_results',
    randomized_trial: 'rct_results',
    phase_3: 'rct_results',
    phase_iii: 'rct_results',
    observational: 'observational',
    cohort: 'observational',
    prospective: 'observational',
    retrospective: 'observational',
    meta_analysis: 'meta_analysis',
    systematic_review: 'meta_analysis',
    pooled_analysis: 'meta_analysis',
    guideline: 'guideline',
    guidelines: 'guideline',
    practice_guideline: 'guideline',
    consensus: 'consensus',
    expert_consensus: 'consensus',
    review: 'review',
    narrative_review: 'review',
    case_series: 'case_series',
    case_report: 'case_series',
  };

  return typeMap[normalized] || 'observational';
}

/**
 * Normalize cancer type strings
 * @param {string|string[]} rawTypes - Raw cancer type(s)
 * @returns {string[]} - Array of canonical cancer type values
 */
export function normalizeCancerTypes(rawTypes) {
  if (!rawTypes) return [];

  const types = Array.isArray(rawTypes) ? rawTypes : [rawTypes];

  const typeMap = {
    colorectal: 'colorectal',
    colon: 'colorectal',
    rectal: 'colorectal',
    crc: 'colorectal',
    breast: 'breast',
    lung: 'lung_nsclc',
    nsclc: 'lung_nsclc',
    non_small_cell: 'lung_nsclc',
    sclc: 'lung_sclc',
    small_cell: 'lung_sclc',
    bladder: 'bladder',
    urothelial: 'bladder',
    pancreatic: 'pancreatic',
    pancreas: 'pancreatic',
    melanoma: 'melanoma',
    ovarian: 'ovarian',
    ovary: 'ovarian',
    gastric: 'gastric',
    stomach: 'gastric',
    esophageal: 'esophageal',
    esophagus: 'esophageal',
    prostate: 'prostate',
    head_and_neck: 'head_and_neck',
    hnsc: 'head_and_neck',
    hcc: 'liver',
    hepatocellular: 'liver',
    liver: 'liver',
    renal: 'renal',
    kidney: 'renal',
    solid_tumor: 'multi_solid',
    solid_tumors: 'multi_solid',
    pan_cancer: 'multi_solid',
    multiple: 'multi_solid',
  };

  return types.map((type) => {
    const normalized = type.toLowerCase().replace(/[_\s-]+/g, '_');
    return typeMap[normalized] || 'multi_solid';
  });
}

export default {
  VENDOR_PUBLICATIONS_INDEX_PROMPT,
  VENDOR_EVIDENCE_PAGE_PROMPT,
  SOCIETY_EDITORIAL_PROMPT,
  NEWS_REVIEW_PROMPT,
  GUIDELINE_EXCERPT_PROMPT,
  CONFERENCE_ABSTRACT_PROMPT,
  getPromptForSourceType,
  getDefaultGuardrail,
  normalizeEvidenceType,
  normalizeCancerTypes,
};
