/**
 * OpenOnco Persona Content Configuration
 * 
 * R&D (technical) = current baseline, shows everything
 * Medical and Patient = filtered subsets
 * 
 * Three key areas:
 * 1. Section/field visibility in test details
 * 2. Header navigation tabs
 * 3. Chatbot prompts and suggestions
 */

// ============================================
// 1. HEADER NAVIGATION BY PERSONA
// ============================================

/**
 * Which nav items each persona sees
 * R&D sees all, others see subsets
 */
export const NAV_ITEMS = {
  patient: ['home', 'learn', 'faq', 'about'],
  medical: ['home', 'learn', 'how-it-works', 'faq', 'about'],
  rnd: ['home', 'submissions', 'how-it-works', 'data-sources', 'faq', 'learn', 'about'],
};

/**
 * Get nav items for a persona (defaults to R&D)
 */
export const getNavItems = (persona) => {
  return NAV_ITEMS[persona] || NAV_ITEMS.rnd;
};


// ============================================
// 2. TEST DETAIL SECTION VISIBILITY
// ============================================

/**
 * Which sections to show in TestDetailModal
 * Listed by section name as they appear in the modal
 * true = show, false = hide
 */
export const TEST_SECTIONS = {
  // Header badges and basic info - always shown
  headerBadges: { patient: true, medical: true, rnd: true },
  
  // Main content sections for non-TDS categories
  testPerformance: { patient: true, medical: true, rnd: true },
  sampleAndTurnaround: { patient: true, medical: true, rnd: true },
  stageSpecificPerformance: { patient: false, medical: true, rnd: true },
  regulatoryAndCoverage: { patient: true, medical: true, rnd: true },
  clinicalEvidence: { patient: false, medical: true, rnd: true },
  technicalDetails: { patient: false, medical: true, rnd: true },
  orderingInfo: { patient: true, medical: true, rnd: true },
  
  // TDS-specific sections
  genomicCoverage: { patient: false, medical: true, rnd: true },
  fdaCompanionDx: { patient: true, medical: true, rnd: true },
  guidelinesAndCoverage: { patient: true, medical: true, rnd: true },
};

/**
 * Which specific fields to hide within visible sections
 * Only need to list fields that should be hidden for patient/medical
 * (R&D sees everything by default)
 */
export const HIDDEN_FIELDS = {
  patient: [
    // Performance section
    'ppv', 'npv', 'lod', 'lod95', 'analyticalSpecificity', 'clinicalSpecificity',
    'advancedAdenomaSensitivity', 'landmarkSensitivity', 'landmarkSpecificity',
    'longitudinalSensitivity', 'longitudinalSpecificity',
    // Sample section
    'cfdnaInput', 'bloodVolume',
    // Regulatory section  
    'cptCodes', 'cptCode', 'codeType', 'adltStatus', 'medicareRate',
    'clinicalAvailability', 'availableRegions',
    // Clinical evidence
    'numPublications', 'validationCohortSize', 'validationCohortStudy',
    // TDS fields
    'biomarkersReported', 'method', 'sampleRequirements',
  ],
  medical: [
    // Medical sees almost everything, just hide deep technical details
    'lod95', 'cfdnaInput', 'analyticalSpecificity',
  ],
  rnd: [], // R&D sees everything
};

/**
 * Check if a section should be visible for persona
 */
export const isSectionVisible = (sectionKey, persona) => {
  return TEST_SECTIONS[sectionKey]?.[persona] ?? true;
};

/**
 * Check if a field should be hidden for persona
 */
export const isFieldHidden = (fieldKey, persona) => {
  return HIDDEN_FIELDS[persona]?.includes(fieldKey) ?? false;
};


// ============================================
// 3. CHATBOT PROMPTS BY PERSONA
// ============================================

/**
 * Initial suggested prompts shown in chat interface
 */
export const CHAT_SUGGESTIONS = {
  patient: [
    "What test is best for my situation?",
    "How do I talk to my doctor about testing?",
    "Will my insurance cover this test?",
    "What is an MRD test?",
  ],
  medical: [
    "Compare sensitivity across MRD tests",
    "Which tests have NCCN recommendations?",
    "Medicare coverage for liquid biopsy",
    "Clinical validation data for [test name]",
  ],
  rnd: [
    "Compare analytical performance metrics",
    "FDA regulatory pathway for [test]",
    "LOD and technical specifications",
    "Export comparison data to CSV",
  ],
};

/**
 * System prompt additions for chatbot tone
 * These get appended to the base system prompt
 */
export const CHAT_TONE = {
  patient: `
You are speaking with a patient or caregiver. Use warm, supportive language.
- Avoid medical jargon; if you must use a technical term, explain it simply
- Focus on what matters to patients: "Will this help me?", "Is it covered?", "What should I ask my doctor?"
- Be empathetic and acknowledge that navigating cancer testing is overwhelming
- Always suggest they discuss options with their healthcare provider
- When comparing tests, focus on practical differences (blood draw vs tissue, turnaround time, cost)
`,
  medical: `
You are speaking with a healthcare professional. Use clinical language appropriately.
- Include relevant clinical performance metrics (sensitivity, specificity, PPV/NPV)
- Reference guideline recommendations (NCCN, ESMO) when applicable
- Discuss clinical utility and how results inform treatment decisions
- Be concise and evidence-based
- You can assume familiarity with oncology terminology
`,
  rnd: `
You are speaking with a researcher, industry professional, or technical user.
- Include detailed technical specifications (LOD, analytical validation, methodology)
- Discuss regulatory pathways and approval status in detail
- Reference publications and clinical trial data
- Be precise about data sources and limitations
- Include nuances about different testing approaches and their tradeoffs
`,
};

/**
 * Get chat suggestions for persona
 */
export const getChatSuggestions = (persona) => {
  return CHAT_SUGGESTIONS[persona] || CHAT_SUGGESTIONS.rnd;
};

/**
 * Get chat tone instructions for persona
 */
export const getChatTone = (persona) => {
  return CHAT_TONE[persona] || CHAT_TONE.rnd;
};


// ============================================
// 4. PATIENT-SPECIFIC HELPERS
// ============================================

/**
 * "Questions to Ask Your Doctor" by test category
 * Shown only for patient persona
 */
export const QUESTIONS_FOR_DOCTOR = {
  MRD: [
    "Is MRD testing right for my type of cancer?",
    "How will MRD results change my treatment plan?",
    "How often should I have this test done?",
    "What does a positive vs negative result mean for me?",
  ],
  ECD: [
    "Am I a good candidate for early detection testing?",
    "What happens if the test finds something?",
    "How accurate is this test for my risk factors?",
    "What other screenings should I still do?",
  ],
  TRM: [
    "How will this test help monitor my treatment?",
    "What changes in results should concern me?",
    "How does this compare to imaging scans?",
  ],
  TDS: [
    "Will this test help find targeted therapies for my cancer?",
    "What if no targetable mutations are found?",
    "Are there clinical trials that match my results?",
  ],
};

/**
 * Get questions for doctor by category
 */
export const getQuestionsForDoctor = (category) => {
  return QUESTIONS_FOR_DOCTOR[category] || [];
};
