/**
 * Delegation Detection Utilities
 *
 * Detects when payers delegate genetic/molecular testing management
 * to Lab Benefit Managers (LBMs) like Carelon or eviCore.
 *
 * This is critical because:
 * 1. Delegated payers' own policies may become advisory only
 * 2. The LBM's guidelines become operationally authoritative
 * 3. Prior auth requests route through the LBM
 */

import { extractEffectiveDate, normalizeDate } from './dates.js';

/**
 * Known LBM identifiers and their aliases
 */
export const LBM_IDENTIFIERS = {
  carelon: {
    id: 'carelon',
    name: 'Carelon Medical Benefits Management',
    aliases: [
      'carelon',
      'aim specialty health',
      'aim specialty',
      'aim medical benefits',
      'carelon medical benefits',
    ],
  },
  evicore: {
    id: 'evicore',
    name: 'eviCore Healthcare',
    aliases: [
      'evicore',
      'evi-core',
      'evicore healthcare',
      'evernorth',
    ],
  },
  labcorp: {
    id: 'labcorp',
    name: 'LabCorp',
    aliases: [
      'labcorp',
      'lab corp',
      'laboratory corporation',
    ],
  },
  quest: {
    id: 'quest',
    name: 'Quest Diagnostics',
    aliases: [
      'quest',
      'quest diagnostics',
    ],
  },
};

/**
 * Delegation detection patterns
 * Each pattern returns { detected, delegatedTo, effectiveDate, rawMatch }
 */
export const DELEGATION_PATTERNS = [
  // Explicit retirement/replacement
  {
    pattern: /(?:this\s+)?policy\s+(?:is\s+being\s+|has\s+been\s+)?(?:retired|replaced|superseded|transitioned?)(?:[^.]*?)(?:to|with|by)\s+(?:partnership\s+with\s+)?(?:the\s+)?(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)/i,
    type: 'retirement',
    extractLBM: (match) => normalizeLBMName(match[1]),
  },

  // Direct delegation statement
  {
    pattern: /delegat(?:ed?|ing)\s+(?:to|with)\s+(?:the\s+)?(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)/i,
    type: 'delegation',
    extractLBM: (match) => normalizeLBMName(match[1]),
  },

  // LBM will manage/provide
  {
    pattern: /(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)\s+(?:will|shall|now)\s+(?:manage|provide|handle|administer)/i,
    type: 'transfer',
    extractLBM: (match) => normalizeLBMName(match[1]),
  },

  // Partnership announcement
  {
    pattern: /partnership\s+with\s+(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)/i,
    type: 'partnership',
    extractLBM: (match) => normalizeLBMName(match[1]),
  },

  // Transitioning to
  {
    pattern: /transition(?:ing|ed?)?\s+(?:to|over\s+to)\s+(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)/i,
    type: 'transition',
    extractLBM: (match) => normalizeLBMName(match[1]),
  },

  // v2.1: Handled/managed by (passive voice)
  {
    pattern: /(?:is\s+)?(?:now\s+)?(?:handled|managed|administered)\s+by\s+(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)/i,
    type: 'passive_delegation',
    extractLBM: (match) => normalizeLBMName(match[1]),
  },

  // Genetic testing management services
  {
    pattern: /(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)\s+(?:will\s+)?(?:provide|offers?)\s+genetic\s+testing\s+management/i,
    type: 'services',
    extractLBM: (match) => normalizeLBMName(match[1]),
  },

  // Prior auth routing
  {
    pattern: /prior\s+auth(?:orization)?s?\s+(?:requests?\s+)?(?:should\s+be\s+)?(?:submitted|sent|routed|directed)\s+(?:through|via|to)\s+(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)/i,
    type: 'routing',
    extractLBM: (match) => normalizeLBMName(match[1]),
  },

  // Portal/system usage
  {
    pattern: /(?:use|access|submit\s+(?:through|via))\s+(?:the\s+)?(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)\s+(?:portal|system|website)/i,
    type: 'portal',
    extractLBM: (match) => normalizeLBMName(match[1]),
  },

  // Effective date with LBM
  {
    pattern: /effective\s+(\d{1,2}\/\d{1,2}\/\d{4}|\w+\s+\d{1,2},?\s+\d{4})(?:[^.]*?)(carelon|evicore|aim\s*(?:specialty)?(?:\s*health)?)/i,
    type: 'dated',
    extractLBM: (match) => normalizeLBMName(match[2]),
    extractDate: (match) => normalizeDate(match[1]),
  },
];

/**
 * Normalize LBM name to canonical identifier
 * @param {string} name - Raw LBM name from match
 * @returns {string} Canonical LBM ID
 */
export function normalizeLBMName(name) {
  const lower = name.toLowerCase().replace(/\s+/g, ' ').trim();

  for (const [id, info] of Object.entries(LBM_IDENTIFIERS)) {
    for (const alias of info.aliases) {
      if (lower.includes(alias)) {
        return id;
      }
    }
  }

  // Default to cleaned name if not recognized
  return lower.replace(/\s+/g, '_');
}

/**
 * Get full LBM info by ID
 * @param {string} lbmId - LBM identifier
 * @returns {Object|null} LBM info or null
 */
export function getLBMInfo(lbmId) {
  return LBM_IDENTIFIERS[lbmId] || null;
}

/**
 * Detect delegation from document content
 * @param {string} content - Document content
 * @returns {Object} Detection result
 */
export function detectDelegation(content) {
  const detections = [];

  for (const patternDef of DELEGATION_PATTERNS) {
    const match = content.match(patternDef.pattern);
    if (match) {
      const detection = {
        detected: true,
        type: patternDef.type,
        delegatedTo: patternDef.extractLBM(match),
        delegatedToName: null,
        rawMatch: match[0],
        matchIndex: match.index,
      };

      // Get full LBM name
      const lbmInfo = getLBMInfo(detection.delegatedTo);
      if (lbmInfo) {
        detection.delegatedToName = lbmInfo.name;
      }

      // Extract effective date if pattern supports it
      if (patternDef.extractDate) {
        detection.effectiveDate = patternDef.extractDate(match);
      }

      detections.push(detection);
    }
  }

  if (detections.length === 0) {
    return { detected: false };
  }

  // Return most specific/confident detection
  // Prefer dated > retirement > delegation > others
  const priorityOrder = ['dated', 'retirement', 'delegation', 'transition', 'transfer', 'partnership', 'services', 'routing', 'portal'];
  detections.sort((a, b) => {
    return priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type);
  });

  const best = detections[0];

  // Try to extract effective date if not already found
  if (!best.effectiveDate) {
    // Look for effective date in surrounding context
    const context = content.slice(
      Math.max(0, best.matchIndex - 200),
      Math.min(content.length, best.matchIndex + best.rawMatch.length + 200)
    );
    best.effectiveDate = extractEffectiveDate(context);
  }

  return {
    ...best,
    allDetections: detections,
    confidence: calculateDelegationConfidence(detections),
  };
}

/**
 * Calculate confidence in delegation detection
 * @param {Object[]} detections - All detections found
 * @returns {number} 0-1 confidence score
 */
function calculateDelegationConfidence(detections) {
  let score = 0.5;

  // Multiple detections increase confidence
  score += Math.min(detections.length * 0.1, 0.2);

  // Certain types are higher confidence
  const types = new Set(detections.map(d => d.type));
  if (types.has('retirement')) score += 0.2;
  if (types.has('dated')) score += 0.15;
  if (types.has('delegation')) score += 0.1;

  // Having an effective date increases confidence
  if (detections.some(d => d.effectiveDate)) {
    score += 0.1;
  }

  return Math.min(0.95, score);
}

/**
 * Extract delegation scope from content
 * @param {string} content - Document content
 * @returns {Object} { scope, scopeDescription }
 */
export function extractDelegationScope(content) {
  const scopePatterns = [
    { pattern: /genetic\s+testing/i, scope: 'genetic_testing', description: 'Genetic testing' },
    { pattern: /molecular\s+(?:and\s+)?genomic\s+testing/i, scope: 'molecular_genomic_testing', description: 'Molecular and genomic testing' },
    { pattern: /molecular\s+testing/i, scope: 'molecular_testing', description: 'Molecular testing' },
    { pattern: /lab(?:oratory)?\s+benefit/i, scope: 'lab_benefits', description: 'Laboratory benefits' },
    { pattern: /specialty\s+lab/i, scope: 'specialty_lab', description: 'Specialty laboratory services' },
    { pattern: /oncology\s+testing/i, scope: 'oncology_testing', description: 'Oncology testing' },
  ];

  for (const scopeDef of scopePatterns) {
    if (scopeDef.pattern.test(content)) {
      return {
        scope: scopeDef.scope,
        scopeDescription: scopeDef.description,
      };
    }
  }

  return {
    scope: 'unknown',
    scopeDescription: 'Scope not specified',
  };
}

/**
 * Build a delegation change proposal from detection
 * @param {Object} detection - Detection result
 * @param {Object} policyInfo - { payerId, payerName, url }
 * @returns {Object} Delegation change proposal data
 */
export function buildDelegationProposal(detection, policyInfo) {
  const scope = extractDelegationScope(detection.rawMatch);

  return {
    type: 'delegation-change',
    payerId: policyInfo.payerId,
    payerName: policyInfo.payerName,
    delegatedTo: detection.delegatedTo,
    delegatedToName: detection.delegatedToName,
    effectiveDate: detection.effectiveDate,
    scope: scope.scope,
    scopeDescription: scope.scopeDescription,
    sourceUrl: policyInfo.url,
    sourceQuote: detection.rawMatch,
    confidence: detection.confidence,
    recommendation: `Monitor ${detection.delegatedToName || detection.delegatedTo} guidelines for ${policyInfo.payerName} coverage`,
    lbmGuidelinesToMonitor: getLBMGuidelineSuggestions(detection.delegatedTo),
  };
}

/**
 * Get suggested LBM guidelines to monitor
 * @param {string} lbmId - LBM identifier
 * @returns {string[]} Guideline IDs to monitor
 */
function getLBMGuidelineSuggestions(lbmId) {
  const suggestions = {
    carelon: ['carelon-liquid-biopsy-2025', 'carelon-genetic-testing-2025'],
    evicore: ['evicore-liquid-biopsy-2026', 'evicore-molecular-testing-2026'],
  };

  return suggestions[lbmId] || [];
}

/**
 * Check if payer is known to be delegated
 * @param {string} payerId - Payer ID
 * @param {Object} delegationMap - Known delegations
 * @returns {Object|null} Delegation info or null
 */
export function checkKnownDelegation(payerId, delegationMap) {
  // Check direct match
  for (const [, delegation] of Object.entries(delegationMap)) {
    if (delegation.payerId === payerId) {
      return delegation;
    }
  }

  return null;
}

export default {
  LBM_IDENTIFIERS,
  DELEGATION_PATTERNS,
  normalizeLBMName,
  getLBMInfo,
  detectDelegation,
  extractDelegationScope,
  buildDelegationProposal,
  checkKnownDelegation,
};
