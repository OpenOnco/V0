/**
 * Response Template Enforcement
 * Ensures chat responses follow a consistent clinical format
 * Separates evidence from considerations, enforces non-directive language
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('response-template');

/**
 * Required sections in responses
 */
export const REQUIRED_SECTIONS = [
  'WHAT THE EVIDENCE SAYS:',
  'LIMITATIONS:',
];

/**
 * Optional sections (included when relevant)
 */
export const OPTIONAL_SECTIONS = [
  'GUIDELINE RECOMMENDATIONS:',
  'CLINICAL CONSIDERATIONS:',
];

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

  // Interpretation of individual results
  /your (tumor|cancer|result|test|mrd|ctdna) (shows|indicates|means|suggests)/i,
  /this means (you|your)/i,
  /based on your results?/i,

  // Prescriptive treatment language
  /start(ing)? (treatment|therapy|chemo)/i,
  /stop(ping)? (treatment|therapy|chemo)/i,
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

/**
 * System prompt addition for response template
 */
export const RESPONSE_TEMPLATE_PROMPT = `
IMPORTANT CONTEXT:
You help physicians understand ctDNA/MRD evidence. Match your response structure to the query type.
MRD is an emerging field - guidelines often lag behind trial evidence, and some topics aren't yet addressed by guidelines.

QUERY-TYPE ROUTING (choose ONE approach based on the question):

1. GUIDELINE QUESTIONS ("What does NCCN say?", "current recommendations for...")
   → Lead with guidelines, then mention supporting/emerging evidence
   → If NCCN has no recommendation on this topic, say so clearly and pivot to other evidence

2. CLINICAL TRIAL QUESTIONS ("trials studying...", "what research shows...", "RCT evidence for...")
   → Lead with trial data: study names, designs, sample sizes, key outcomes
   → Guidelines are optional context, not the focus
   → Include: CIRCULATE, DYNAMIC, GALAXY, MEDOCC-CrEATE, etc. when relevant

3. EVIDENCE QUESTIONS ("what's the evidence for...", "data on...")
   → Lead with the strongest evidence (usually trials and cohort studies)
   → Include publication details and key metrics
   → Guidelines as supporting context if they've addressed the topic

4. PRACTICE QUESTIONS ("how is ctDNA used in...", "clinical utility of...")
   → Describe current clinical adoption and practice patterns
   → Reference both guidelines AND real-world evidence
   → Include payer/coverage context if relevant

RESPONSE STRUCTURE:

WHAT THE EVIDENCE SAYS:
- Lead with evidence most relevant to the query type
- Include study names, sample sizes, key outcomes
- Cite with [N] notation

GUIDELINE RECOMMENDATIONS: (include when relevant, skip if guidelines haven't addressed the topic)
- Only include if guidelines have something substantive to say on this topic
- Specify source: NCCN, ASCO, ESMO, etc.
- Quote evidence level (e.g., "Category 2A") when available
- If guidelines are silent on this topic, omit this section entirely

CLINICAL CONSIDERATIONS: (optional)
- 2-3 factors clinicians often weigh, phrased as questions
- Do NOT give directives

LIMITATIONS:
- State what evidence does not address
- Be honest about gaps and uncertainty

CRITICAL RULES:
- No patient-specific treatment recommendations
- No "you should start/stop therapy" language
- No interpretation of individual MRD results
- No claims without citations [N]
- Don't force guideline discussion when the question doesn't call for it
- Don't say "NCCN doesn't address this" and then repeat that multiple times
`;

/**
 * Validate that response follows the required template structure
 * @param {string} response - The chat response text
 * @returns {{valid: boolean, issues: string[]}}
 */
export function validateResponseStructure(response) {
  const issues = [];

  // Check for required sections
  for (const section of REQUIRED_SECTIONS) {
    if (!response.includes(section)) {
      issues.push(`Missing required section: ${section}`);
    }
  }

  // Check for forbidden language patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = response.match(pattern);
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
 * @returns {{response: string, warnings: string[], isValid: boolean}}
 */
export function enforceTemplate(response) {
  const validation = validateResponseStructure(response);

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
  const lower = phrase.toLowerCase();

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
 * @returns {string} - Restructured response
 */
export function addTemplateStructure(response) {
  // Check if already has structure
  if (response.includes('WHAT THE EVIDENCE SAYS:')) {
    return response;
  }

  // Try to intelligently restructure
  const lines = response.split('\n');
  let restructured = '';
  let currentSection = 'evidence';

  restructured += 'WHAT THE EVIDENCE SAYS:\n';

  for (const line of lines) {
    const lower = line.toLowerCase();

    // Detect transitions
    if (lower.includes('limitation') || lower.includes('the evidence does not')) {
      if (currentSection !== 'limitations') {
        restructured += '\nLIMITATIONS:\n';
        currentSection = 'limitations';
      }
    } else if (lower.includes('guideline') || lower.includes('nccn') || lower.includes('asco')) {
      if (currentSection === 'evidence') {
        restructured += '\nGUIDELINE RECOMMENDATIONS:\n';
        currentSection = 'guidelines';
      }
    } else if (lower.includes('consider') || lower.includes('clinical team') || lower.includes('discuss')) {
      if (currentSection !== 'considerations' && currentSection !== 'limitations') {
        restructured += '\nCLINICAL CONSIDERATIONS:\n';
        currentSection = 'considerations';
      }
    }

    restructured += line + '\n';
  }

  // Ensure LIMITATIONS section exists at the end
  if (!restructured.includes('LIMITATIONS:')) {
    restructured += '\nLIMITATIONS:\nPlease note that this response is based on indexed literature and may not capture all relevant evidence. Discuss with your treatment team for personalized guidance.\n';
  }

  return restructured.trim();
}

export default {
  REQUIRED_SECTIONS,
  OPTIONAL_SECTIONS,
  FORBIDDEN_PATTERNS,
  ALLOWED_PHRASES,
  RESPONSE_TEMPLATE_PROMPT,
  validateResponseStructure,
  enforceTemplate,
  isAllowedLanguage,
  suggestAlternative,
  addTemplateStructure,
};
