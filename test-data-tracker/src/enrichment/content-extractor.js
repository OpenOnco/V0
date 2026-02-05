/**
 * Content Extractor
 *
 * Uses Claude to extract structured clinical information from
 * full text papers. Extracts study design, key findings,
 * cancer types, and clinical implications.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';
import { extractCancerTypes, extractClinicalSettings } from './cancer-type-extractor.js';

const logger = createLogger('content-extractor');

let anthropic = null;

function getAnthropic() {
  if (!anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required for content extraction');
    }
    anthropic = new Anthropic();
  }
  return anthropic;
}

const EXTRACTION_PROMPT = `Analyze this clinical research paper about ctDNA/MRD testing and extract structured information.

Paper content:
---
{content}
---

Extract and return JSON with these fields:
{{
  "summary": "2-3 sentence summary of the study design and key findings",
  "study_design": "One of: RCT | prospective_cohort | retrospective_cohort | meta_analysis | case_series | review",
  "patient_population": "Brief description of enrolled patients (e.g., 'Stage II-III colon cancer patients post-resection')",
  "sample_size": <number or null>,
  "cancer_types": ["Array of specific cancer types from this list: colorectal, bladder, breast, lung_nsclc, lung_sclc, pancreatic, gastric, ovarian, prostate, melanoma, head_and_neck, esophageal, renal, liver, endometrial, cervical, thyroid, sarcoma, glioblastoma, merkel"],
  "clinical_settings": ["Array from: adjuvant, neoadjuvant, surveillance, metastatic, recurrence_detection, treatment_response, treatment_selection"],
  "mrd_test_used": "Name of ctDNA/MRD assay if mentioned (e.g., Signatera, Guardant Reveal, FoundationOne Tracker)",
  "key_findings": [
    "Finding 1 with specific statistics if available",
    "Finding 2",
    "Finding 3"
  ],
  "clinical_implications": "How this evidence could inform clinical decisions about ctDNA/MRD testing",
  "evidence_level": "One of: high (large RCT), moderate (small RCT or large cohort), low (retrospective or case series)"
}}

Important:
- Focus on information relevant to MRD/ctDNA clinical utility
- Include specific numbers (sensitivity, specificity, hazard ratios) when available
- For cancer_types, use exact values from the allowed list
- If information is not available, use null for that field
- Return ONLY the JSON object, no other text`;

/**
 * Extract structured content from full text using Claude
 * @param {string} fullText - Full paper text
 * @param {string} title - Paper title
 * @returns {Object|null} - Structured extraction
 */
export async function extractStructuredContent(fullText, title) {
  if (!fullText || fullText.length < 500) {
    logger.debug('Text too short for extraction', { length: fullText?.length });
    return null;
  }

  // Truncate if too long (Claude context limits)
  const maxLength = 25000;
  let content = fullText;
  if (content.length > maxLength) {
    // Try to keep beginning (abstract/intro) and end (results/conclusions)
    const halfMax = maxLength / 2;
    content = content.substring(0, halfMax) + '\n\n[...content truncated...]\n\n' + content.substring(content.length - halfMax);
  }

  try {
    const client = getAnthropic();

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: EXTRACTION_PROMPT
          .replace('{content}', `Title: ${title}\n\n${content}`)
      }]
    });

    const text = response.content[0].text;

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('No JSON found in extraction response');
      return null;
    }

    const extracted = JSON.parse(jsonMatch[0]);
    logger.debug('Extracted structured content', {
      title: title.substring(0, 50),
      cancerTypes: extracted.cancer_types,
      hasFindings: !!extracted.key_findings?.length
    });

    return extracted;

  } catch (error) {
    logger.error('Content extraction failed', { error: error.message });
    return null;
  }
}

/**
 * Extract content from abstract only (faster, no Claude needed)
 * @param {string} abstract - Paper abstract
 * @param {string} title - Paper title
 * @returns {Object} - Basic extraction
 */
export function extractFromAbstract(abstract, title) {
  const combinedText = `${title} ${abstract}`;

  return {
    summary: abstract.length > 500 ? abstract.substring(0, 500) + '...' : abstract,
    study_design: detectStudyDesign(combinedText),
    cancer_types: extractCancerTypes(combinedText),
    clinical_settings: extractClinicalSettings(combinedText),
    mrd_test_used: detectMRDTest(combinedText),
    key_findings: null,
    clinical_implications: null,
    evidence_level: null,
  };
}

/**
 * Detect study design from text
 */
function detectStudyDesign(text) {
  const textLower = text.toLowerCase();

  if (/randomized|randomised|rct\b|phase\s*(2|3|ii|iii)/i.test(text)) {
    return 'RCT';
  }
  if (/meta.analysis|systematic.review|pooled.analysis/i.test(text)) {
    return 'meta_analysis';
  }
  if (/prospective.cohort|prospective.study|prospectively/i.test(text)) {
    return 'prospective_cohort';
  }
  if (/retrospective|chart.review/i.test(text)) {
    return 'retrospective_cohort';
  }
  if (/case.series|case.report/i.test(text)) {
    return 'case_series';
  }
  if (/review\b/i.test(text)) {
    return 'review';
  }

  return null;
}

/**
 * Detect MRD test name from text
 */
function detectMRDTest(text) {
  const tests = {
    'Signatera': /signatera/i,
    'Guardant Reveal': /guardant\s*reveal/i,
    'Guardant360': /guardant\s*360/i,
    'FoundationOne Tracker': /foundation\s*one\s*tracker/i,
    'FoundationOne Liquid CDx': /foundation\s*one\s*liquid/i,
    'Tempus xF': /tempus\s*xf/i,
    'RaDaR': /\bradar\b/i,
    'clonoSEQ': /clonoseq/i,
    'Safe-SeqS': /safe.seqs/i,
    'TRACERx': /tracerx/i,
  };

  for (const [name, pattern] of Object.entries(tests)) {
    if (pattern.test(text)) {
      return name;
    }
  }

  return null;
}

/**
 * Build enriched content string for embedding
 * @param {Object} extracted - Extracted structured content
 * @param {string} abstract - Original abstract
 * @param {Object} sections - Paper sections (methods, results, conclusions)
 * @returns {string} - Enriched content for embedding
 */
export function buildEnrichedContent(extracted, abstract, sections = null) {
  const parts = [];

  // Summary (either extracted or from abstract)
  if (extracted?.summary) {
    parts.push(`Summary: ${extracted.summary}`);
  } else if (abstract) {
    parts.push(`Abstract: ${abstract}`);
  }

  // Study design and population
  if (extracted?.study_design) {
    parts.push(`Study Design: ${extracted.study_design}`);
  }
  if (extracted?.patient_population) {
    parts.push(`Patient Population: ${extracted.patient_population}${extracted.sample_size ? ` (n=${extracted.sample_size})` : ''}`);
  }

  // MRD test
  if (extracted?.mrd_test_used) {
    parts.push(`MRD Test: ${extracted.mrd_test_used}`);
  }

  // Key findings
  if (extracted?.key_findings?.length) {
    parts.push(`Key Findings:\n- ${extracted.key_findings.join('\n- ')}`);
  }

  // Clinical implications
  if (extracted?.clinical_implications) {
    parts.push(`Clinical Implications: ${extracted.clinical_implications}`);
  }

  // Paper sections (if available and not too long)
  if (sections?.results && parts.join('\n\n').length < 8000) {
    const resultsExcerpt = sections.results.substring(0, 2000);
    parts.push(`Results Excerpt: ${resultsExcerpt}`);
  }

  if (sections?.conclusions && parts.join('\n\n').length < 10000) {
    parts.push(`Conclusions: ${sections.conclusions}`);
  }

  // Cancer types and clinical settings for semantic matching
  if (extracted?.cancer_types?.length) {
    parts.push(`Cancer Types: ${extracted.cancer_types.join(', ')}`);
  }
  if (extracted?.clinical_settings?.length) {
    parts.push(`Clinical Settings: ${extracted.clinical_settings.join(', ')}`);
  }

  return parts.join('\n\n');
}

export default {
  extractStructuredContent,
  extractFromAbstract,
  buildEnrichedContent,
};
