/**
 * OpenOnco Chat System Prompt Builder
 * 
 * Single entry point for building chat system prompts.
 * Combines base rules + persona-specific config + test data.
 */

import { 
  conversationalRules, 
  scopeLimitations, 
  nccnWarning, 
  performanceClaimsWarning,
  chatKeyLegend 
} from './baseRules';
import { patientConfig } from './patientPrompt';
import { clinicianConfig } from './clinicianPrompt';
import { academicConfig } from './academicPrompt';

// Map persona IDs to configs
const personaConfigs = {
  patient: patientConfig,
  medical: clinicianConfig,
  rnd: academicConfig,
  // Legacy mappings for backwards compatibility
  'Patient': patientConfig,
  'Clinician': clinicianConfig,
  'Academic/Industry': academicConfig
};

/**
 * Get persona config by ID
 */
export const getPersonaConfig = (personaId) => {
  return personaConfigs[personaId] || patientConfig;
};

/**
 * Build few-shot examples section from persona config
 */
const buildExamplesSection = (config) => {
  if (!config.exampleQA || config.exampleQA.length === 0) return '';
  
  const examples = config.exampleQA.map((ex, i) => 
    `Example ${i + 1} (${ex.context}):
User: "${ex.question}"
Good response: "${ex.goodAnswer}"
Bad response (DO NOT DO THIS): "${ex.badAnswer}"`
  ).join('\n\n');
  
  return `\n\nFEW-SHOT EXAMPLES:\n${examples}`;
};

/**
 * Build complete system prompt for a persona
 * 
 * @param {string} personaId - 'patient' | 'medical' | 'rnd'
 * @param {Array} testData - Compressed test data for the database
 * @param {Object} options - Additional options
 * @param {boolean} options.includeKeyLegend - Include field legend (default: true)
 * @param {string} options.category - Category context (e.g., 'MRD', 'ECD')
 * @param {Object} options.meta - Category metadata
 * @param {boolean} options.includeExamples - Include few-shot examples (default: true)
 */
export const buildSystemPrompt = (personaId, testData, options = {}) => {
  const {
    includeKeyLegend = true,
    category = null,
    meta = null,
    includeExamples = true
  } = options;

  const config = getPersonaConfig(personaId);
  const isProPersna = personaId === 'medical' || personaId === 'rnd' || personaId === 'Clinician' || personaId === 'Academic/Industry';
  
  const categoryContext = category && meta 
    ? `focused on ${meta.title} testing` 
    : '';
  const categoryScope = category 
    ? `${category} tests in` 
    : 'tests in';

  const examplesSection = includeExamples ? buildExamplesSection(config) : '';

  // Hard rule for professional personas - goes FIRST
  const noRecommendationsRule = isProPersna ? `
**ABSOLUTE RULE - READ THIS FIRST:**
You are a DATA LOOKUP TOOL, not a clinical advisor. You must NEVER:
- Recommend which test to order for any patient scenario
- Say "you have X options" or "I'd suggest" or "consider using"
- Provide clinical decision guidance for hypothetical or real cases
- Answer "which test should I order for [patient description]" questions

If asked "which test for my patient with X?", you MUST respond:
"I can't recommend specific tests for patient scenarios - that's clinical judgment outside my scope. I can provide factual comparisons: sensitivity/specificity data, NCCN status, Medicare coverage, TAT, or methodology differences. What specific test attributes would help you evaluate your options?"

You provide ONLY: documented specs, validation data, regulatory status, guideline citations, methodology explanations, and head-to-head metric comparisons.
` : '';

  return `You are a conversational liquid biopsy test assistant for OpenOnco${categoryContext ? ', ' + categoryContext : ''}.
${noRecommendationsRule}
AUDIENCE: ${config.audience}
${config.tone}

${conversationalRules}

${scopeLimitations.replace('tests in the database', `${categoryScope} the database`)}

${nccnWarning}

${performanceClaimsWarning}
${examplesSection}

${category ? category + ' ' : ''}DATABASE:
${JSON.stringify(testData)}
${includeKeyLegend ? '\n' + chatKeyLegend : ''}

Remember: SHORT responses (3-4 sentences max), then ask a follow-up question.`;
};

/**
 * Get suggested questions for a persona
 */
export const getSuggestedQuestions = (personaId) => {
  const config = getPersonaConfig(personaId);
  return config.suggestedQuestions || [];
};

/**
 * Get welcome message for a persona
 */
export const getWelcomeMessage = (personaId) => {
  const config = getPersonaConfig(personaId);
  return config.welcomeMessage || "How can I help you today?";
};

export default buildSystemPrompt;
