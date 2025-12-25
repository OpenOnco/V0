import { PERSONA_STORAGE_KEY, VALID_PERSONA_IDS } from '../personaConfig';

// Helper to get persona from localStorage
export const getStoredPersona = () => {
  try {
    const stored = localStorage.getItem(PERSONA_STORAGE_KEY);
    // Validate it's a valid persona ID
    if (stored && VALID_PERSONA_IDS.includes(stored)) {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
};

// Helper to save persona to localStorage
export const savePersona = (personaId) => {
  try {
    localStorage.setItem(PERSONA_STORAGE_KEY, personaId);
  } catch {
    // localStorage not available
  }
};
