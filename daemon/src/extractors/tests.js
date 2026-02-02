/**
 * Test Name Extraction Utilities
 *
 * Deterministic extraction of named diagnostic tests from policy documents.
 * Maps test mentions to our database test IDs.
 */

/**
 * Known MRD/liquid biopsy tests
 * Maps variations to canonical test ID
 */
export const TEST_NAME_PATTERNS = {
  // Natera Signatera
  signatera: {
    id: 'signatera',
    vendor: 'Natera',
    patterns: [
      /\bSignatera\b/gi,
      /\bSignatera\s*(?:MRD|ctDNA)?\s*(?:Test|Assay)?\b/gi,
      /\bNatera\s+Signatera\b/gi,
    ],
    plaCode: '0239U',
  },

  // Guardant Health Reveal
  'guardant-reveal': {
    id: 'guardant-reveal',
    vendor: 'Guardant Health',
    patterns: [
      /\bGuardant\s*Reveal\b/gi,
      /\bGuardant\s+Health\s+Reveal\b/gi,
      /\bReveal\s+(?:MRD|ctDNA)\b/gi,
    ],
    plaCode: '0306U',
  },

  // Invitae RaDaR
  radar: {
    id: 'radar',
    vendor: 'Invitae',
    patterns: [
      /\bRaDaR\b/gi,
      /\bInvitae\s+RaDaR\b/gi,
      /\bPersonalis\s+RaDaR\b/gi,  // Originally from Personalis
    ],
    plaCode: '0340U',
  },

  // Tempus NeXT Personal
  'next-personal': {
    id: 'next-personal',
    vendor: 'Tempus',
    patterns: [
      /\bNeXT\s*Personal\b/gi,
      /\bTempus\s+NeXT\s*Personal\b/gi,
      /\bTempus\s+xF\+?\b/gi,
    ],
    plaCode: '0356U',
  },

  // Biodesix NavDx
  navdx: {
    id: 'navdx',
    vendor: 'Biodesix',
    patterns: [
      /\bNavDx\b/gi,
      /\bBiodesix\s+NavDx\b/gi,
    ],
    plaCode: '0364U',
  },

  // Adaptive clonoSEQ
  clonoseq: {
    id: 'clonoseq',
    vendor: 'Adaptive Biotechnologies',
    patterns: [
      /\bclonoSEQ\b/gi,
      /\bAdaptive\s+clonoSEQ\b/gi,
      /\bAdaptive\s+Biotechnologies?\s+clonoSEQ\b/gi,
    ],
    plaCode: '0569U',
  },

  // C2i Genomics Oncodetect
  oncodetect: {
    id: 'oncodetect',
    vendor: 'C2i Genomics',
    patterns: [
      /\bOncodetect\b/gi,
      /\bC2i\s+Genomics?\s+Oncodetect\b/gi,
      /\bC2i\s+Oncodetect\b/gi,
    ],
    plaCode: '0421U',
  },

  // NeoGenomics Haystack
  'haystack-mrd': {
    id: 'haystack-mrd',
    vendor: 'NeoGenomics',
    patterns: [
      /\bHaystack\s*(?:MRD)?\b/gi,
      /\bNeoGenomics?\s+Haystack\b/gi,
    ],
    plaCode: '0464U',
  },

  // Guardant360
  guardant360: {
    id: 'guardant360',
    vendor: 'Guardant Health',
    patterns: [
      /\bGuardant\s*360\b/gi,
      /\bGuardant\s+Health\s+360\b/gi,
      /\bG360\b/g,
    ],
    plaCode: null, // Uses CPT 81479
  },

  // Foundation Medicine
  'foundationone-liquid': {
    id: 'foundationone-liquid',
    vendor: 'Foundation Medicine',
    patterns: [
      /\bFoundationOne\s*(?:Liquid)?\s*CDx\b/gi,
      /\bF1\s*(?:Liquid)?\s*CDx\b/gi,
      /\bFoundation\s+Medicine\s+Liquid\b/gi,
    ],
    plaCode: '0048U',
  },

  // Predicine Foresight
  foresight: {
    id: 'foresight',
    vendor: 'Predicine',
    patterns: [
      /\bForesight\s*(?:MRD)?\b/gi,
      /\bPredicine\s+Foresight\b/gi,
    ],
    plaCode: '0425U',
  },

  // Predicine PredicineATLAS
  'predicine-atlas': {
    id: 'predicine-atlas',
    vendor: 'Predicine',
    patterns: [
      /\bPredicineATLAS\b/gi,
      /\bPredicine\s+ATLAS\b/gi,
    ],
    plaCode: '0372U',
  },

  // Resolution Bioscience ctDx
  ctdx: {
    id: 'ctdx',
    vendor: 'Resolution Bioscience',
    patterns: [
      /\bctDx\s*(?:Lung|Resolve)?\b/gi,
      /\bResolution\s+Bioscience\s+ctDx\b/gi,
    ],
    plaCode: null,
  },

  // Grail Galleri (early detection, not MRD)
  galleri: {
    id: 'galleri',
    vendor: 'Grail',
    patterns: [
      /\bGalleri\b/gi,
      /\bGrail\s+Galleri\b/gi,
    ],
    plaCode: '0343U',
  },

  // MCED tests as a category
  mced: {
    id: 'mced',
    vendor: null,
    patterns: [
      /\bMCED\s*(?:test|assay)?\b/gi,
      /\bmulti-?cancer\s+early\s+detection\b/gi,
    ],
    plaCode: null,
  },
};

/**
 * Generic test category patterns
 */
export const CATEGORY_PATTERNS = {
  mrd: [
    /\bminimal\s+residual\s+disease\b/gi,
    /\bmolecular\s+residual\s+disease\b/gi,
    /\bMRD\s+(?:test|testing|assay|detection)\b/gi,
  ],
  ctdna: [
    /\bcirculating\s+tumor\s+DNA\b/gi,
    /\bctDNA\s+(?:test|testing|assay|analysis)\b/gi,
    /\bcell-?free\s+(?:tumor\s+)?DNA\b/gi,
    /\bcfDNA\b/gi,
  ],
  liquidBiopsy: [
    /\bliquid\s+biopsy\b/gi,
    /\bblood-?based\s+(?:tumor\s+)?(?:test|testing|marker)\b/gi,
  ],
  tumorInformed: [
    /\btumor-?informed\b/gi,
    /\btumor-?naive\b/gi,
    /\btumor-?agnostic\b/gi,
  ],
};

/**
 * Extract named tests from content
 * @param {string} content - Document content
 * @returns {Object[]} Array of { id, name, vendor, matches, plaCode }
 */
export function extractNamedTests(content) {
  const found = [];

  for (const [testId, testInfo] of Object.entries(TEST_NAME_PATTERNS)) {
    const matches = [];

    for (const pattern of testInfo.patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        matches.push({
          text: match[0],
          index: match.index,
        });
      }
    }

    if (matches.length > 0) {
      found.push({
        id: testInfo.id,
        name: testId,
        vendor: testInfo.vendor,
        matchCount: matches.length,
        plaCode: testInfo.plaCode,
        firstMatch: matches[0].text,
      });
    }
  }

  return found;
}

/**
 * Check if content mentions MRD testing
 * @param {string} content - Document content
 * @returns {Object} { isMRDRelated, categories, namedTests }
 */
export function detectMRDContent(content) {
  const namedTests = extractNamedTests(content);
  const categories = [];

  // Check category patterns
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(content)) {
        categories.push(category);
        break;
      }
    }
  }

  const isMRDRelated = namedTests.length > 0 ||
    categories.includes('mrd') ||
    categories.includes('ctdna') ||
    categories.includes('liquidBiopsy');

  return {
    isMRDRelated,
    categories: [...new Set(categories)],
    namedTests,
  };
}

/**
 * Get test ID for a name (fuzzy match)
 * @param {string} name - Test name
 * @returns {string|null} Test ID or null
 */
export function getTestId(name) {
  const lowerName = name.toLowerCase().trim();

  // Direct match on ID
  if (TEST_NAME_PATTERNS[lowerName]) {
    return TEST_NAME_PATTERNS[lowerName].id;
  }

  // Check patterns
  for (const [, testInfo] of Object.entries(TEST_NAME_PATTERNS)) {
    for (const pattern of testInfo.patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(name)) {
        return testInfo.id;
      }
    }
  }

  return null;
}

/**
 * Get test info by PLA code
 * @param {string} plaCode - PLA code
 * @returns {Object|null} Test info or null
 */
export function getTestByPLACode(plaCode) {
  const upperCode = plaCode.toUpperCase();

  for (const [, testInfo] of Object.entries(TEST_NAME_PATTERNS)) {
    if (testInfo.plaCode === upperCode) {
      return testInfo;
    }
  }

  return null;
}

/**
 * Extract test names as simple string array
 * @param {string} content - Document content
 * @returns {string[]} Test IDs found
 */
export function extractTestIds(content) {
  const tests = extractNamedTests(content);
  return tests.map(t => t.id);
}

/**
 * Check if a specific test is mentioned
 * @param {string} content - Document content
 * @param {string} testId - Test ID to look for
 * @returns {boolean}
 */
export function isTestMentioned(content, testId) {
  const testInfo = TEST_NAME_PATTERNS[testId];
  if (!testInfo) return false;

  for (const pattern of testInfo.patterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Get context around test mention
 * @param {string} content - Document content
 * @param {string} testId - Test ID
 * @param {number} contextChars - Characters of context (default 200)
 * @returns {string[]} Array of context snippets
 */
export function getTestMentionContext(content, testId, contextChars = 200) {
  const testInfo = TEST_NAME_PATTERNS[testId];
  if (!testInfo) return [];

  const contexts = [];

  for (const pattern of testInfo.patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const start = Math.max(0, match.index - contextChars);
      const end = Math.min(content.length, match.index + match[0].length + contextChars);
      const context = content.slice(start, end).trim();
      contexts.push(context);
    }
  }

  return contexts;
}

export default {
  TEST_NAME_PATTERNS,
  CATEGORY_PATTERNS,
  extractNamedTests,
  detectMRDContent,
  getTestId,
  getTestByPLACode,
  extractTestIds,
  isTestMentioned,
  getTestMentionContext,
};
