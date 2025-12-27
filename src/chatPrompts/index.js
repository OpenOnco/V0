/**
 * OpenOnco Chat UI Configuration
 * 
 * This module provides UI-ONLY configuration for the chat interface:
 * - Suggested questions (starter prompts shown to users)
 * - Welcome messages (initial greeting per persona)
 * 
 * ⚠️  IMPORTANT: This is NOT where system prompts live!
 * The actual system prompts sent to Claude are in /api/chat.js
 * That file is the single source of truth for prompt engineering.
 */

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
 * Get suggested questions for a persona (displayed as starter prompts in UI)
 */
export const getSuggestedQuestions = (personaId) => {
  const config = getPersonaConfig(personaId);
  return config.suggestedQuestions || [];
};

/**
 * Get welcome message for a persona (displayed as initial chat message)
 */
export const getWelcomeMessage = (personaId) => {
  const config = getPersonaConfig(personaId);
  return config.welcomeMessage || "How can I help you today?";
};
