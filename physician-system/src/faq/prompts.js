/**
 * FAQ Generation Prompts
 *
 * Structured prompts for Claude Sonnet to generate personalized FAQ answers
 * from retrieved evidence. Each concern type has a tailored prompt.
 */

// Map concern IDs to DB question tags for evidence retrieval
export const CONCERN_QUERY_MAP = {
  'no-evidence': {
    questions: ['positive_result_action', 'de_escalation', 'prognosis'],
    evidenceTypes: ['rct_results', 'meta_analysis', 'guideline'],
    searchQueries: [
      'ctDNA MRD guided treatment outcomes clinical trial',
      'circulating tumor DNA adjuvant therapy decisions evidence',
    ],
  },
  'not-in-guidelines': {
    questions: ['when_to_test'],
    evidenceTypes: ['guideline', 'consensus'],
    searchQueries: [
      'NCCN ctDNA MRD guideline recommendation',
      'ASCO ESMO circulating tumor DNA clinical practice guideline',
    ],
  },
  'what-to-do-positive': {
    questions: ['positive_result_action', 'escalation', 'clinical_trial_eligibility'],
    evidenceTypes: ['rct_results', 'guideline', 'consensus'],
    searchQueries: [
      'ctDNA positive post-surgery actionable treatment escalation',
      'MRD positive result clinical management adjuvant therapy',
    ],
  },
  'not-validated': {
    questions: ['which_test'],
    evidenceTypes: ['rct_results', 'observational', 'regulatory'],
    searchQueries: [
      'ctDNA assay validation tumor type clinical sensitivity',
      'MRD test analytical validation Medicare coverage',
    ],
  },
};

// Cancer types to generate (must match physicianFAQ.js keys)
export const FAQ_CANCER_TYPES = [
  { id: 'colorectal', dbType: 'colorectal', tier: 1 },
  { id: 'breast', dbType: 'breast', tier: 1 },
  { id: 'lung', dbType: 'lung_nsclc', tier: 1 },
  { id: 'bladder', dbType: 'bladder', tier: 2 },
  { id: 'melanoma', dbType: 'melanoma', tier: 2 },
];

// Stages to generate notes for
export const STAGES = ['stage-1', 'stage-2', 'stage-3', 'stage-4'];

/**
 * Build the generation prompt for a specific (cancerType, concern) pair
 */
export function buildGenerationPrompt({ cancerType, concernId, evidence, currentAnswer }) {
  const evidenceBlock = evidence.map((e, i) =>
    `[${i + 1}] ${e.title}\n` +
    `    Source: ${e.source_type} | ${e.source_id || ''}\n` +
    `    Date: ${e.publication_date || 'unknown'}\n` +
    `    Evidence: ${e.evidence_type || 'unknown'}\n` +
    `    Summary: ${(e.summary || e.chunk_text || '').slice(0, 800)}`
  ).join('\n\n');

  const currentBlock = currentAnswer
    ? `\n\nCURRENT ANSWER (for continuity — preserve tone and structure if evidence unchanged):\nPatient: ${currentAnswer.forPatient}\nDoctor: ${currentAnswer.forDoctor}\nGuidelines: ${currentAnswer.guidelines || 'none'}`
    : '';

  return `You are generating a personalized FAQ answer for cancer patients advocating for MRD (ctDNA) testing with their doctors.

CANCER TYPE: ${cancerType}
CONCERN: ${getConcernLabel(concernId)}
${currentBlock}

RETRIEVED EVIDENCE (${evidence.length} sources):
${evidenceBlock}

Generate a JSON object with these fields:

{
  "forPatient": "2-4 sentence answer in plain, empathetic language a patient can understand. No jargon. Focus on reassurance and empowerment.",
  "forDoctor": "Detailed clinical evidence paragraph (150-250 words) with specific trial names, patient counts, hazard ratios, and survival data. Use precise clinical language an oncologist expects. Reference specific publications by author and year.",
  "stageNotes": {
    "stage-1": "1-2 sentences on how this concern applies specifically to stage I, or null if not relevant",
    "stage-2": "1-2 sentences for stage II",
    "stage-3": "1-2 sentences for stage III",
    "stage-4": "1-2 sentences for stage IV"
  },
  "sources": [
    {"label": "Author et al., Journal Year — brief description", "pmid": "12345678"}
  ],
  "guidelines": "One sentence summarizing current guideline status (NCCN, ASCO, ESMO) with version numbers."
}

RULES:
- Every claim in forDoctor MUST be traceable to the retrieved evidence. Do not fabricate data.
- Sources array: include only PMIDs/URLs from the retrieved evidence. Max 4 sources.
- If a stage has no relevant evidence, set its stageNote to null.
- For sources without a PMID, use {"label": "...", "url": "..."} instead.
- Keep forPatient warm and accessible. Keep forDoctor precise and clinical.
- If evidence is thin for this cancer type, acknowledge limitations honestly.

Return ONLY the JSON object, no markdown fences or explanation.`;
}

function getConcernLabel(id) {
  const labels = {
    'no-evidence': '"There\'s no evidence MRD results change outcomes."',
    'not-in-guidelines': '"It\'s not in the guidelines yet."',
    'what-to-do-positive': '"What would I even do with a positive result?"',
    'not-validated': '"The test isn\'t validated for your cancer type."',
  };
  return labels[id] || id;
}
