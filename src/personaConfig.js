/**
 * OpenOnco Persona Configuration
 * Single source of truth for persona definitions used by both frontend and API.
 */

export const PERSONAS = {
  patient: {
    id: 'patient',
    label: 'Patient / Caregiver',
    shortLabel: 'Patient',
    icon: null,  // Uses custom image: /patient-icon.png
    iconImage: '/patient-icon.png',
    color: '#e11d48',      // rose-600
    bgColor: '#fef2f2',    // rose-50
    borderColor: '#fecdd3', // rose-200
    description: 'Plain-language explanations, what to ask your doctor',
    chatTone: 'Warm, supportive, simple language. Avoid medical jargon - if you must use a technical term, explain it simply.',
    guiMode: 'simplified',
  },
  medical: {
    id: 'medical',
    label: 'Medical Professional',
    shortLabel: 'Clinician',
    icon: '🩺',
    color: '#0891b2',      // cyan-600
    bgColor: '#ecfeff',    // cyan-50
    borderColor: '#a5f3fc', // cyan-200
    description: 'Clinical validity, guidelines, ordering information',
    chatTone: 'Direct, collegial. Clinical terminology is fine. Focus on actionable metrics and guidelines.',
    guiMode: 'clinical',
  },
  rnd: {
    id: 'rnd',
    label: 'R&D / Industry',
    shortLabel: 'R&D',
    icon: '🔬',
    color: '#7c3aed',      // violet-600
    bgColor: '#f5f3ff',    // violet-50
    borderColor: '#ddd6fe', // violet-200
    description: 'Technical specs, regulatory status, methodology details',
    chatTone: 'Technical and precise. Include methodology details, analytical validation, and regulatory nuances.',
    guiMode: 'technical',
  }
};

// Valid persona IDs for API validation
export const VALID_PERSONA_IDS = Object.keys(PERSONAS);

// Default persona for new users (null means they must choose)
export const DEFAULT_PERSONA = null;

// LocalStorage key
export const PERSONA_STORAGE_KEY = 'openonco-persona';

/**
 * Get persona config by ID, with fallback
 */
export const getPersonaConfig = (personaId) => {
  return PERSONAS[personaId] || PERSONAS.patient;
};

/**
 * Build chat system prompt style section for a persona
 */
export const getPersonaChatStyle = (personaId) => {
  const config = getPersonaConfig(personaId);
  return `AUDIENCE: ${config.label}
TONE: ${config.chatTone}`;
};
