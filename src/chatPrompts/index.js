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
  
  const categoryContext = category && meta 
    ? `focused on ${meta.title} testing` 
    : '';
  const categoryScope = category 
    ? `${category} tests in` 
    : 'tests in';

  const examplesSection = includeExamples ? buildExamplesSection(config) : '';

  return `You are a conversational liquid biopsy test assistant for OpenOnco${categoryContext ? ', ' + categoryContext : ''}.

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
