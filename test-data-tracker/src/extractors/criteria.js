/**
 * Coverage Criteria Extraction Utilities
 *
 * Extracts the coverage criteria section from policy documents.
 * This is the most important section for determining actual coverage.
 */

/**
 * Section heading patterns that indicate coverage criteria
 */
const CRITERIA_SECTION_HEADERS = [
  // Medical necessity criteria
  /^#+\s*(?:medical\s+necessity\s+)?criteria\s*$/im,
  /^(?:medical\s+necessity\s+)?criteria[:.]?\s*$/im,
  /^\*{1,2}(?:medical\s+necessity\s+)?criteria\*{1,2}[:.]?\s*$/im,

  // Coverage position
  /^#+\s*coverage\s+(?:position|determination|policy)\s*$/im,
  /^coverage\s+(?:position|determination|policy)[:.]?\s*$/im,
  /^\*{1,2}coverage\s+(?:position|determination|policy)\*{1,2}[:.]?\s*$/im,

  // Medically necessary section
  /^#+\s*medically\s+necessary\s*$/im,
  /^medically\s+necessary[:.]?\s*$/im,
  /^\*{1,2}medically\s+necessary\*{1,2}[:.]?\s*$/im,

  // When covered / not covered
  /^#+\s*(?:when\s+)?(?:is\s+)?covered\s*$/im,
  /^(?:when\s+)?(?:is\s+)?covered[:.]?\s*$/im,

  // Policy guidelines
  /^#+\s*policy\s+guidelines?\s*$/im,
  /^policy\s+guidelines?[:.]?\s*$/im,

  // Clinical criteria
  /^#+\s*clinical\s+criteria\s*$/im,
  /^clinical\s+criteria[:.]?\s*$/im,

  // Indications
  /^#+\s*indications?\s*$/im,
  /^indications?[:.]?\s*$/im,
];

/**
 * Section headers that indicate end of criteria section
 */
const CRITERIA_END_HEADERS = [
  /^#+\s*(?:not\s+)?medically\s+necessary\s*$/im,
  /^#+\s*(?:not\s+)?covered\s*$/im,
  /^#+\s*experimental\b/im,
  /^#+\s*investigational\b/im,
  /^#+\s*limitations?\s*$/im,
  /^#+\s*exclusions?\s*$/im,
  /^#+\s*contraindications?\s*$/im,
  /^#+\s*background\s*$/im,
  /^#+\s*description\s*$/im,
  /^#+\s*rationale\s*$/im,
  /^#+\s*references?\s*$/im,
  /^#+\s*coding\s*$/im,
  /^#+\s*billing\s*$/im,
  /^#+\s*appendix\s*$/im,
  /^#+\s*definitions?\s*$/im,
];

/**
 * Stance keywords that indicate coverage position
 */
export const STANCE_PATTERNS = {
  supports: [
    /\b(?:is\s+)?medically\s+necessary\b/i,
    /\b(?:is\s+)?covered\b/i,
    /\b(?:may\s+be\s+)?appropriate\b/i,
    /\bmeets?\s+(?:medical\s+necessity\s+)?criteria\b/i,
  ],
  restricts: [
    /\bcovered\s+(?:only\s+)?(?:when|if|for)\b/i,
    /\blimited\s+(?:to|coverage)\b/i,
    /\bconditional(?:ly)?\s+covered\b/i,
    /\bprior\s+auth(?:orization)?\s+required\b/i,
    /\bwith\s+(?:prior\s+)?auth(?:orization)?\b/i,
  ],
  denies: [
    /\bnot\s+medically\s+necessary\b/i,
    /\bnot\s+covered\b/i,
    /\bexperimental(?:\s+and\/or\s+investigational)?\b/i,
    /\binvestigational\b/i,
    /\bunproven\b/i,
    /\blacks?\s+sufficient\s+evidence\b/i,
    /\binsufficient\s+evidence\b/i,
  ],
  unclear: [
    /\bmay\s+be\s+considered\b/i,
    /\bon\s+a\s+case-by-case\s+basis\b/i,
    /\bcase-by-case\s+review\b/i,
    /\bindividual\s+consideration\b/i,
  ],
};

/**
 * Extract criteria section from content
 * @param {string} content - Document content
 * @param {string} docType - Document type hint
 * @returns {string|null} Criteria section text or null
 */
export function extractCriteriaSection(content, docType = null) {
  const lines = content.split('\n');
  let criteriaStart = -1;
  let criteriaEnd = -1;

  // Find start of criteria section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of CRITERIA_SECTION_HEADERS) {
      if (pattern.test(line)) {
        criteriaStart = i;
        break;
      }
    }
    if (criteriaStart >= 0) break;
  }

  // If no explicit criteria section found, try to extract based on content
  if (criteriaStart < 0) {
    return extractCriteriaBySentences(content);
  }

  // Find end of criteria section
  for (let i = criteriaStart + 1; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of CRITERIA_END_HEADERS) {
      if (pattern.test(line)) {
        criteriaEnd = i;
        break;
      }
    }
    if (criteriaEnd >= 0) break;
  }

  // If no end found, take next 50 lines or until end
  if (criteriaEnd < 0) {
    criteriaEnd = Math.min(criteriaStart + 50, lines.length);
  }

  // Extract section
  const section = lines.slice(criteriaStart, criteriaEnd).join('\n').trim();
  return section.length > 50 ? section : null;
}

/**
 * Extract criteria by finding sentences with criteria keywords
 * Fallback when no section headers found
 * @param {string} content - Document content
 * @returns {string|null}
 */
function extractCriteriaBySentences(content) {
  const sentences = content.split(/[.!?]+/);
  const criteriaKeywords = [
    'medically necessary',
    'covered when',
    'covered if',
    'covered for',
    'criteria',
    'requirement',
    'indication',
  ];

  const relevantSentences = sentences.filter(sentence => {
    const lower = sentence.toLowerCase();
    return criteriaKeywords.some(kw => lower.includes(kw));
  });

  if (relevantSentences.length > 0) {
    return relevantSentences.slice(0, 10).join('. ').trim();
  }

  return null;
}

/**
 * Detect coverage stance from content
 * @param {string} content - Document content
 * @returns {Object} { stance, confidence, evidence }
 */
export function detectStance(content) {
  const evidence = {
    supports: [],
    restricts: [],
    denies: [],
    unclear: [],
  };

  // Check each stance pattern
  for (const [stance, patterns] of Object.entries(STANCE_PATTERNS)) {
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        evidence[stance].push(match[0]);
      }
    }
  }

  // Determine stance based on evidence
  // Priority: denies > restricts > supports > unclear
  let detectedStance = 'unclear';
  let confidence = 0.3;

  if (evidence.denies.length > 0) {
    detectedStance = 'denies';
    confidence = 0.7 + (Math.min(evidence.denies.length, 3) * 0.1);
  } else if (evidence.restricts.length > 0) {
    detectedStance = 'restricts';
    confidence = 0.6 + (Math.min(evidence.restricts.length, 3) * 0.1);
  } else if (evidence.supports.length > 0) {
    detectedStance = 'supports';
    confidence = 0.6 + (Math.min(evidence.supports.length, 3) * 0.1);
  } else if (evidence.unclear.length > 0) {
    detectedStance = 'unclear';
    confidence = 0.5;
  }

  // Reduce confidence if conflicting signals
  if (evidence.supports.length > 0 && evidence.denies.length > 0) {
    confidence -= 0.2;
  }

  return {
    stance: detectedStance,
    confidence: Math.min(0.95, Math.max(0.1, confidence)),
    evidence,
  };
}

/**
 * Extract cancer types from criteria
 * @param {string} content - Criteria section content
 * @returns {string[]} Cancer types found
 */
export function extractCancerTypes(content) {
  const cancerPatterns = [
    // Specific cancers
    /\b(colorectal|colon|rectal)\s*cancer\b/gi,
    /\b(breast)\s*cancer\b/gi,
    /\b(lung|NSCLC|non-?small\s+cell\s+lung)\s*cancer\b/gi,
    /\b(pancreatic|pancreas)\s*cancer\b/gi,
    /\b(ovarian|ovary)\s*cancer\b/gi,
    /\b(bladder|urothelial)\s*cancer\b/gi,
    /\b(prostate)\s*cancer\b/gi,
    /\b(melanoma)\b/gi,
    /\b(esophageal)\s*cancer\b/gi,
    /\b(gastric|stomach)\s*cancer\b/gi,
    /\b(hepatocellular|liver)\s*(?:cancer|carcinoma)\b/gi,
    /\b(renal|kidney)\s*(?:cell\s+)?cancer\b/gi,
    /\b(thyroid)\s*cancer\b/gi,
    /\b(head\s+and\s+neck)\s*cancer\b/gi,
    /\b(cervical)\s*cancer\b/gi,
    /\b(endometrial|uterine)\s*cancer\b/gi,

    // Hematologic malignancies
    /\b(leukemia|ALL|AML|CLL|CML)\b/gi,
    /\b(lymphoma|NHL|DLBCL)\b/gi,
    /\b(multiple\s+myeloma|myeloma)\b/gi,

    // General
    /\b(solid\s+tumor)s?\b/gi,
  ];

  const found = new Set();

  for (const pattern of cancerPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      // Normalize cancer type
      let type = match[1].toLowerCase()
        .replace(/non-?small\s+cell\s+lung/i, 'NSCLC')
        .replace(/colorectal|colon|rectal/i, 'CRC')
        .replace(/multiple\s+myeloma/i, 'myeloma');

      found.add(type.charAt(0).toUpperCase() + type.slice(1));
    }
  }

  return Array.from(found).sort();
}

/**
 * Extract cancer stages from criteria
 * @param {string} content - Criteria section content
 * @returns {string[]} Stages found
 */
export function extractStages(content) {
  const stagePatterns = [
    /\bstage\s+([I]{1,3}V?|[1-4])\b/gi,
    /\bstage\s+([I]{1,3}V?[ABC]?)\b/gi,
    /\b([I]{1,3}V?)\s+(?:cancer|disease|tumor)\b/gi,
    /\bmetastatic\b/gi,
    /\blocally\s+advanced\b/gi,
    /\bearly[- ]?stage\b/gi,
    /\blate[- ]?stage\b/gi,
    /\badvanced\s+(?:stage\s+)?(?:cancer|disease)\b/gi,
  ];

  const found = new Set();

  for (const pattern of stagePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) {
        // Normalize stage format
        const stage = match[1].toUpperCase()
          .replace(/1/g, 'I')
          .replace(/2/g, 'II')
          .replace(/3/g, 'III')
          .replace(/4/g, 'IV');
        found.add(`Stage ${stage}`);
      } else {
        // Keywords like "metastatic"
        found.add(match[0].toLowerCase());
      }
    }
  }

  return Array.from(found).sort();
}

/**
 * Extract clinical settings from criteria
 * @param {string} content - Criteria section content
 * @returns {string[]} Settings found
 */
export function extractSettings(content) {
  const settingPatterns = [
    /\bpost-?surgical\b/gi,
    /\bpost-?operative\b/gi,
    /\bpost-?resection\b/gi,
    /\bsurveillance\b/gi,
    /\bmonitoring\b/gi,
    /\brecurrence\s+(?:detection|monitoring)\b/gi,
    /\bneoadjuvant\b/gi,
    /\badjuvant\b/gi,
    /\bpre-?surgical\b/gi,
    /\bpre-?operative\b/gi,
    /\btreatment\s+response\b/gi,
    /\btherapy\s+selection\b/gi,
    /\btreatment\s+planning\b/gi,
    /\bbaseline\b/gi,
    /\binitial\s+(?:diagnosis|staging)\b/gi,
  ];

  const found = new Set();

  for (const pattern of settingPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      found.add(match[0].toLowerCase().replace(/-/g, '-'));
    }
  }

  return Array.from(found).sort();
}

/**
 * Extract prior authorization requirements
 * @param {string} content - Criteria section content
 * @returns {Object} { required, details }
 */
export function extractPriorAuthRequirement(content) {
  const requiresAuth = [
    /\bprior\s+auth(?:orization)?\s+(?:is\s+)?required\b/i,
    /\brequires?\s+prior\s+auth(?:orization)?\b/i,
    /\bmust\s+(?:obtain|have)\s+prior\s+auth/i,
  ];

  const noAuth = [
    /\bno\s+prior\s+auth(?:orization)?\s+(?:is\s+)?required\b/i,
    /\bprior\s+auth(?:orization)?\s+(?:is\s+)?not\s+required\b/i,
    /\bwithout\s+prior\s+auth/i,
  ];

  for (const pattern of requiresAuth) {
    if (pattern.test(content)) {
      return { required: 'required', details: 'Prior authorization required' };
    }
  }

  for (const pattern of noAuth) {
    if (pattern.test(content)) {
      return { required: 'not_required', details: 'No prior authorization required' };
    }
  }

  return { required: 'unknown', details: null };
}

/**
 * Extract all criteria information
 * @param {string} content - Document content
 * @param {string} docType - Document type hint
 * @returns {Object} Comprehensive criteria extraction
 */
export function extractAllCriteria(content, docType = null) {
  const criteriaSection = extractCriteriaSection(content, docType);
  const stanceResult = detectStance(content);
  const priorAuth = extractPriorAuthRequirement(content);

  // Use criteria section for detailed extraction if available
  const analysisContent = criteriaSection || content;

  return {
    criteriaSection,
    stance: stanceResult.stance,
    stanceConfidence: stanceResult.confidence,
    stanceEvidence: stanceResult.evidence,
    cancerTypes: extractCancerTypes(analysisContent),
    stages: extractStages(analysisContent),
    settings: extractSettings(analysisContent),
    priorAuth: priorAuth.required,
    priorAuthDetails: priorAuth.details,
  };
}

export default {
  extractCriteriaSection,
  detectStance,
  extractCancerTypes,
  extractStages,
  extractSettings,
  extractPriorAuthRequirement,
  extractAllCriteria,
  STANCE_PATTERNS,
};
