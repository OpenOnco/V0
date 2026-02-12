/**
 * Response Template Enforcement
 * Decision-oriented response structures for MRD clinical decision support
 * Routes response format by query type (clinical_guidance, coverage_policy, etc.)
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('response-template');

// ============================================
// QUERY-TYPE RESPONSE TEMPLATES
// ============================================

const CLINICAL_GUIDANCE_TEMPLATE = `
RESPONSE STRUCTURE FOR CLINICAL GUIDANCE QUERIES:

TARGET LENGTH: 350-500 words. Be thorough but precise. Include clinical reasoning that connects evidence to the decision.

DECISION: [One sentence: the clinical decision being faced]

OPTION A: [Most evidence-supported option — 4-6 sentences with inline [N] citations. Include evidence tier: [RCT], [PROSPECTIVE], [RETROSPECTIVE], [GUIDELINE]. Name key trial(s), N, primary endpoint result. Frame how the evidence applies to the clinical context before citing specific data points.]

OPTION B: [Alternative option — 4-6 sentences with inline [N] citations. Same depth as Option A.]

EVIDENCE GAPS: [2-3 sentences: what key questions remain unanswered, what trials may address them, and why the gap matters clinically.]

Style guidance:
- Two options unless a third is clearly distinct (not just "enroll in a trial")
- Write in flowing clinical prose — avoid bullet-point terseness
- Connect evidence to the decision: explain WHY a study matters for this scenario, not just WHAT it found
- Omit TEST-SPECIFIC NOTE unless the test's characteristics directly affect the clinical decision
- Do not repeat the clinical scenario from the query
`;

const COVERAGE_POLICY_TEMPLATE = `
Coverage and insurance questions are outside this system's scope.
Redirect to OpenOnco.org coverage database or the test manufacturer's billing team.
`;

const TEST_COMPARISON_TEMPLATE = `
RESPONSE STRUCTURE FOR TEST COMPARISON QUERIES:

TARGET LENGTH: 300-400 words.

KEY DIFFERENCES: [Direct comparison: approach, tissue requirements, sensitivity, FDA status. Use specific numbers. Explain clinical implications of the differences.]
CLINICAL DATA: [Head-to-head or per-test validation data with citations, 3-5 sentences. Contextualize which differences matter most for the clinical scenario.]
`;

const TRIAL_EVIDENCE_TEMPLATE = `
RESPONSE STRUCTURE FOR TRIAL/EVIDENCE QUERIES:

TARGET LENGTH: 300-400 words.

For each relevant trial (2-3 max): evidence tier, study name, N, primary endpoint, key result, citation [N]. 2-3 sentences per trial — include context on study design and clinical relevance.

KEY FINDINGS: [3-5 sentences synthesizing the evidence direction and clinical implications]
EVIDENCE GAPS: [1-2 sentences if applicable]
`;

const GENERAL_TEMPLATE = `
RESPONSE STRUCTURE FOR GENERAL QUERIES:

TARGET LENGTH: 250-350 words.

WHAT THE EVIDENCE SAYS: [Key findings with citations, 4-6 sentences. Provide enough clinical context for the reader to understand significance.]
LIMITATIONS: [1-2 sentences on evidence gaps, if applicable]
`;

// ============================================
// SAFETY GUARDRAILS (consolidated)
// ============================================

const SAFETY_BLOCK = `
SAFETY RULES (apply to ALL response types):
1. Cite sources using [N] notation for factual claims
2. Present evidence for clinical options — never recommend a specific option
3. Use: "evidence suggests", "guidelines state", "clinicians often consider"
4. Never use: "you should", "I recommend", "we recommend", "you need to"
5. Never interpret individual patient results or make prognosis statements
6. Focus on solid tumors only (not hematologic MRD)
7. Acknowledge evidence gaps honestly — do not overstate certainty

PROSE QUALITY: Write in flowing clinical prose that a physician would find natural to read. Connect evidence to clinical reasoning — don't just list findings. Omit background context the physician already knows. Do not repeat the question. Do not pad with generic disclaimers.
`;

// ============================================
// TEMPLATE ROUTING FUNCTION
// ============================================

/**
 * Returns the appropriate response template based on query type
 * @param {string} queryType - One of: clinical_guidance, coverage_policy, test_comparison, trial_evidence, general
 * @returns {string} - The template prompt string
 */
export function getTemplateForQueryType(queryType) {
  switch (queryType) {
    case 'clinical_guidance':
      return CLINICAL_GUIDANCE_TEMPLATE;
    case 'coverage_policy':
      return COVERAGE_POLICY_TEMPLATE;
    case 'test_comparison':
      return TEST_COMPARISON_TEMPLATE;
    case 'trial_evidence':
      return TRIAL_EVIDENCE_TEMPLATE;
    case 'general':
    default:
      return GENERAL_TEMPLATE;
  }
}

/**
 * Full response template prompt — includes all query-type templates and safety rules.
 * Used in the system prompt so the model can route to the appropriate structure.
 * Preserves backward compatibility with the existing import.
 */
export const RESPONSE_TEMPLATE_PROMPT = `
You are a clinical decision support tool. Organize responses around the clinical decisions physicians face, not academic literature review.

QUERY-TYPE ROUTING — Choose the structure that matches the query:

1. CLINICAL GUIDANCE ("should I escalate?", "ctDNA-positive after adjuvant", "MRD-guided therapy")
${CLINICAL_GUIDANCE_TEMPLATE}

2. TEST COMPARISON ("Signatera vs Guardant Reveal", "which MRD test for CRC")
${TEST_COMPARISON_TEMPLATE}

3. TRIAL EVIDENCE ("CIRCULATE trial results", "RCT evidence for ctDNA-guided", "what trials are enrolling")
${TRIAL_EVIDENCE_TEMPLATE}

4. GENERAL (anything else)
${GENERAL_TEMPLATE}

${SAFETY_BLOCK}

Few-shot examples may be provided in a separate message to illustrate expected output quality and structure.
`;

// ============================================
// FORBIDDEN & ALLOWED LANGUAGE
// ============================================

/**
 * Forbidden language patterns (directive/prescriptive)
 */
export const FORBIDDEN_PATTERNS = [
  // Direct recommendations
  /you should (start|stop|begin|discontinue|continue|switch|add|remove)/i,
  /I recommend/i,
  /we recommend/i,
  /you must/i,
  /you need to/i,
  /consider doing/i,

  // Interpretation of individual results
  /your (tumor|cancer|result|test|mrd|ctdna) (shows|indicates|means|suggests)/i,
  /this means (you|your)/i,
  /based on your results?/i,

  // Prescriptive treatment language
  // These patterns only match prescriptive uses, not analytical/caveat contexts
  // e.g., "start treatment" is directive, but "demonstrated that starting therapy..." is analysis
  // "Consider stopping" is option-naming in decision-oriented format, not directive
  // "validate stopping therapy" is analytical — not directive
  /(?<!\bthat\s)(?<!\bwhether\s)(?<!\bof\s)(?<!\bfor\s)(?<!\babout\s)(?<!\bconsider\s)(?<!\bversus\s)(?<!\bvalidate\s)(?<!\bsupport\s)(?<!\bjustify\s)(?<!\bguide\s)\bstart(ing)? (treatment|therapy|chemo)/i,
  /(?<!\bthat\s)(?<!\bwhether\s)(?<!\bof\s)(?<!\bfor\s)(?<!\babout\s)(?<!\bconsider\s)(?<!\bversus\s)(?<!\bvalidate\s)(?<!\bsupport\s)(?<!\bjustify\s)(?<!\bguide\s)\bstop(ping)? (treatment|therapy|chemo)/i,
  /(should|would) (receive|get|have) (treatment|therapy|chemo)/i,

  // Definitive prognosis
  /you (will|won't) (survive|live|die)/i,
  /your prognosis is/i,
  /your chances (of|are)/i,
];

/**
 * Allowed phrases for clinical information delivery
 */
export const ALLOWED_PHRASES = [
  'Evidence suggests',
  'Studies show',
  'Guidelines state',
  'Guidelines recommend',
  'Research indicates',
  'Data demonstrate',
  'Clinicians often consider',
  'Clinical teams typically',
  'Discuss with the treating team',
  'Further discussion with your physician',
  'The indexed evidence',
  'Based on available evidence',
  'Published literature suggests',
];

// ============================================
// REQUIRED/OPTIONAL SECTIONS (updated for decision-oriented format)
// ============================================

/**
 * Required sections vary by query type. For validation, we check that
 * the response contains at least one recognized section header.
 */
export const RECOGNIZED_SECTIONS = [
  // Clinical guidance
  'CLINICAL SCENARIO:',
  'DECISION:',
  'OPTION A:',
  'OPTION B:',
  'WHAT THE EVIDENCE DOESN\'T ADDRESS:',
  // Coverage
  'COVERAGE SUMMARY:',
  'MEDICARE:',
  // Test comparison
  'COMPARISON:',
  'KEY DIFFERENCES:',
  // Trial evidence
  'TRIAL OVERVIEW:',
  'KEY FINDINGS:',
  // General
  'CONTEXT:',
  'WHAT THE EVIDENCE SAYS:',
  'LIMITATIONS:',
  'CURRENT CLINICAL LANDSCAPE:',
  // Shared
  'TEST-SPECIFIC NOTE:',
];

// Backward compatibility — these were previously required for all responses
export const REQUIRED_SECTIONS = [
  'WHAT THE EVIDENCE SAYS:',
  'LIMITATIONS:',
];

export const OPTIONAL_SECTIONS = [
  'GUIDELINE RECOMMENDATIONS:',
  'CLINICAL CONSIDERATIONS:',
];

// ============================================
// VALIDATION
// ============================================

/**
 * Validate that response follows a recognized template structure
 * @param {string} response - The chat response text
 * @param {string} [queryType] - Optional query type for stricter validation
 * @returns {{valid: boolean, issues: string[]}}
 */
export function validateResponseStructure(response, queryType) {
  const issues = [];

  // Check that at least one recognized section header is present
  const hasAnySection = RECOGNIZED_SECTIONS.some(section => response.includes(section));
  if (!hasAnySection) {
    issues.push('Response lacks any recognized section headers');
  }

  // Query-type-specific validation
  if (queryType === 'clinical_guidance') {
    if (!response.includes('OPTION A:') && !response.includes('CLINICAL SCENARIO:')) {
      issues.push('Clinical guidance response should include CLINICAL SCENARIO or OPTION sections');
    }
  } else if (queryType === 'coverage_policy') {
    if (!response.includes('COVERAGE SUMMARY:') && !response.includes('MEDICARE:')) {
      issues.push('Coverage response should include COVERAGE SUMMARY or MEDICARE sections');
    }
  } else if (queryType === 'test_comparison') {
    if (!response.includes('COMPARISON:') && !response.includes('KEY DIFFERENCES:')) {
      issues.push('Test comparison response should include COMPARISON or KEY DIFFERENCES sections');
    }
  } else if (queryType === 'guideline_summary') {
    // Guideline summaries don't require OPTION or CLINICAL SCENARIO structure —
    // they present what guidelines say, not clinical decision options
    if (!response.includes('WHAT THE EVIDENCE') && !response.includes('POSITION:') && !response.includes('GUIDELINE') && !response.includes('LIMITATIONS:') && !response.includes('CURRENT CLINICAL LANDSCAPE:')) {
      issues.push('Guideline summary response should include evidence/guideline/limitations sections');
    }
  }

  // Check for forbidden language patterns
  // Strip OPTION header lines — these name clinical choices, not directives
  const strippedForForbidden = response.replace(/^(?:\*{0,2})OPTION\s+[A-Z]:.*$/gm, '');
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = strippedForForbidden.match(pattern);
    if (match) {
      issues.push(`Contains forbidden language: "${match[0]}"`);
    }
  }

  // Check that citations are present
  const citationPattern = /\[\d+\]/g;
  const citations = response.match(citationPattern);
  if (!citations || citations.length === 0) {
    issues.push('No citations found in response');
  }

  // Check for evidence levels mention
  const evidencePatterns = [
    /category\s*\d+[ab]?/i,
    /level\s*[iI]+/i,
    /grade\s*[abc]/i,
    /phase\s*\d/i,
    /randomized/i,
    /prospective/i,
    /retrospective/i,
  ];

  const hasEvidenceLevel = evidencePatterns.some(p => p.test(response));
  if (!hasEvidenceLevel) {
    issues.push('No evidence levels mentioned');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate and potentially flag issues in a response
 * Does not rewrite but provides actionable feedback
 * @param {string} response - The response to validate
 * @param {string} [queryType] - Optional query type for stricter validation
 * @returns {{response: string, warnings: string[], isValid: boolean}}
 */
export function enforceTemplate(response, queryType) {
  const validation = validateResponseStructure(response, queryType);

  if (validation.valid) {
    return {
      response,
      warnings: [],
      isValid: true,
    };
  }

  // Log warnings but don't block the response
  logger.warn('Response template issues detected', {
    issueCount: validation.issues.length,
    issues: validation.issues,
    queryType,
  });

  return {
    response,
    warnings: validation.issues,
    isValid: false,
  };
}

/**
 * Check if a specific phrase uses allowed language
 * @param {string} phrase - Phrase to check
 * @returns {boolean}
 */
export function isAllowedLanguage(phrase) {
  // Check against forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(phrase)) {
      return false;
    }
  }

  return true;
}

/**
 * Suggest alternative phrasing for forbidden language
 * @param {string} forbiddenPhrase - The problematic phrase
 * @returns {string} - Suggested alternative
 */
export function suggestAlternative(forbiddenPhrase) {
  const alternatives = {
    'you should start': 'Evidence suggests that',
    'you should stop': 'Guidelines indicate that discontinuation may be considered when',
    'i recommend': 'Based on the evidence, clinicians often consider',
    'we recommend': 'Guidelines state that',
    'you need to': 'Clinical teams typically evaluate',
    'your results show': 'MRD testing results are generally interpreted by the treating physician in the context of',
    'this means you': 'Such findings are typically discussed with the treatment team to determine',
  };

  const lower = forbiddenPhrase.toLowerCase();
  for (const [forbidden, allowed] of Object.entries(alternatives)) {
    if (lower.includes(forbidden)) {
      return allowed;
    }
  }

  return 'Evidence suggests that...';
}

/**
 * Add template structure to a response that lacks it
 * Used when response is good content but missing section headers
 * @param {string} response - Original response
 * @param {string} [queryType] - Query type for appropriate structure
 * @returns {string} - Restructured response
 */
export function addTemplateStructure(response, queryType) {
  // Check if already has any recognized structure
  const hasStructure = RECOGNIZED_SECTIONS.some(section => response.includes(section));
  if (hasStructure) {
    return response;
  }

  // For clinical_guidance, try to add decision-oriented structure
  if (queryType === 'clinical_guidance') {
    return addClinicalGuidanceStructure(response);
  }

  // Default: add general evidence structure
  return addGeneralStructure(response);
}

function addClinicalGuidanceStructure(response) {
  const lines = response.split('\n');
  let restructured = '';
  let currentSection = 'scenario';

  restructured += 'CLINICAL SCENARIO:\n';

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.includes('option') || lower.includes('alternative') || lower.includes('approach')) {
      if (currentSection === 'scenario') {
        restructured += '\nDECISION:\n';
        currentSection = 'decision';
      }
    } else if (lower.includes('limitation') || lower.includes('the evidence does not') || lower.includes('gap')) {
      if (currentSection !== 'gaps') {
        restructured += '\nWHAT THE EVIDENCE DOESN\'T ADDRESS:\n';
        currentSection = 'gaps';
      }
    }

    restructured += line + '\n';
  }

  if (!restructured.includes('WHAT THE EVIDENCE DOESN\'T ADDRESS:')) {
    restructured += '\nWHAT THE EVIDENCE DOESN\'T ADDRESS:\nThis response is based on indexed literature and may not capture all relevant evidence. Discuss with your treatment team for patient-specific guidance.\n';
  }

  return restructured.trim();
}

function addGeneralStructure(response) {
  const lines = response.split('\n');
  let restructured = '';
  let currentSection = 'evidence';

  restructured += 'WHAT THE EVIDENCE SAYS:\n';

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.includes('limitation') || lower.includes('the evidence does not')) {
      if (currentSection !== 'limitations') {
        restructured += '\nLIMITATIONS:\n';
        currentSection = 'limitations';
      }
    } else if (lower.includes('guideline') || lower.includes('nccn') || lower.includes('asco')) {
      if (currentSection === 'evidence') {
        restructured += '\nCURRENT CLINICAL LANDSCAPE:\n';
        currentSection = 'landscape';
      }
    }

    restructured += line + '\n';
  }

  if (!restructured.includes('LIMITATIONS:')) {
    restructured += '\nLIMITATIONS:\nThis response is based on indexed literature and may not capture all relevant evidence. Discuss with your treatment team for patient-specific guidance.\n';
  }

  return restructured.trim();
}

export default {
  RECOGNIZED_SECTIONS,
  REQUIRED_SECTIONS,
  OPTIONAL_SECTIONS,
  FORBIDDEN_PATTERNS,
  ALLOWED_PHRASES,
  RESPONSE_TEMPLATE_PROMPT,
  getTemplateForQueryType,
  validateResponseStructure,
  enforceTemplate,
  isAllowedLanguage,
  suggestAlternative,
  addTemplateStructure,
};
