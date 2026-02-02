/**
 * Billing Code Extraction Utilities
 *
 * Deterministic extraction of CPT, PLA, HCPCS, and ICD-10 codes from policy documents.
 * These codes are critical for matching policies to tests and detecting billing changes.
 */

/**
 * Code patterns
 *
 * CPT codes: 5 digits (80000-99999 range for lab/pathology)
 * PLA codes: 4 digits + U suffix (0001U-9999U)
 * HCPCS codes: 1 letter + 4 digits (e.g., G0452, S3870)
 * ICD-10 codes: Letter + digits + optional decimal (e.g., C18.9, Z85.038)
 */

/**
 * CPT code patterns for lab/molecular testing
 * Focus on 81xxx (molecular pathology) and 80xxx (drug testing/lab)
 */
const CPT_PATTERNS = [
  // Standard 5-digit CPT
  /\b(8[0-9]{4})\b/g,
  // Sometimes written with dashes or spaces
  /\bCPT[:\s]*(8[0-9]{4})\b/gi,
];

/**
 * PLA (Proprietary Laboratory Analyses) codes
 * Format: 0001U through 9999U
 */
const PLA_PATTERNS = [
  /\b(0[0-9]{3}U)\b/g,
  /\b([1-9][0-9]{3}U)\b/g,
  /\bPLA[:\s]*([0-9]{4}U)\b/gi,
];

/**
 * HCPCS Level II codes
 * Format: Letter + 4 digits (A0000-Z9999)
 */
const HCPCS_PATTERNS = [
  /\b([A-Z][0-9]{4})\b/g,
  /\bHCPCS[:\s]*([A-Z][0-9]{4})\b/gi,
];

/**
 * ICD-10 diagnosis codes
 * Format: Letter + 2 digits + optional decimal + more digits
 */
const ICD10_PATTERNS = [
  /\b([A-TV-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?)\b/g,
  /\bICD-?10[:\s]*([A-TV-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?)\b/gi,
];

/**
 * Known MRD/liquid biopsy related PLA codes
 */
export const MRD_PLA_CODES = {
  '0239U': 'Signatera',
  '0306U': 'Guardant Reveal',
  '0340U': 'RaDaR',
  '0356U': 'NeXT Personal',
  '0364U': 'NavDx',
  '0421U': 'Oncodetect',
  '0464U': 'Haystack MRD',
  '0569U': 'clonoSEQ',
  '0378U': 'Invitae Personalized Cancer Monitoring',
  '0372U': 'PredicineATLAS',
  '0425U': 'Foresight (Predicine)',
};

/**
 * Known liquid biopsy CPT codes
 */
export const LIQUID_BIOPSY_CPT = {
  '81479': 'Unlisted molecular pathology procedure',
  '81599': 'Unlisted multianalyte assay with algorithmic analysis',
  '0037U': 'Guardant360 (older code)',
  '0048U': 'FoundationOne Liquid',
};

/**
 * Extract all codes of a specific type from content
 * @param {string} content - Document content
 * @param {RegExp[]} patterns - Array of regex patterns
 * @returns {string[]} Unique codes found
 */
function extractCodesWithPatterns(content, patterns) {
  const codes = new Set();

  for (const pattern of patterns) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      codes.add(match[1].toUpperCase());
    }
  }

  return Array.from(codes).sort();
}

/**
 * Extract CPT codes from content
 * @param {string} content - Document content
 * @returns {string[]} CPT codes found
 */
export function extractCPTCodes(content) {
  const codes = extractCodesWithPatterns(content, CPT_PATTERNS);

  // Filter to valid CPT ranges (focus on lab/molecular: 80000-89999)
  return codes.filter(code => {
    const num = parseInt(code, 10);
    return num >= 80000 && num <= 89999;
  });
}

/**
 * Extract PLA codes from content
 * @param {string} content - Document content
 * @returns {string[]} PLA codes found
 */
export function extractPLACodes(content) {
  return extractCodesWithPatterns(content, PLA_PATTERNS);
}

/**
 * Extract HCPCS codes from content
 * @param {string} content - Document content
 * @returns {string[]} HCPCS codes found
 */
export function extractHCPCSCodes(content) {
  const codes = extractCodesWithPatterns(content, HCPCS_PATTERNS);

  // Filter out common false positives (e.g., "A1234" could be section numbers)
  // Keep codes that start with common HCPCS prefixes
  const validPrefixes = ['G', 'S', 'J', 'Q', 'A', 'E', 'K', 'L'];
  return codes.filter(code => validPrefixes.includes(code[0]));
}

/**
 * Extract ICD-10 codes from content
 * @param {string} content - Document content
 * @returns {string[]} ICD-10 codes found
 */
export function extractICD10Codes(content) {
  const codes = extractCodesWithPatterns(content, ICD10_PATTERNS);

  // Filter to likely diagnosis codes (exclude section references)
  // Valid ICD-10 starts with A-T or V-Z (U is reserved)
  return codes.filter(code => /^[A-TV-Z]/.test(code));
}

/**
 * Extract all billing codes from content
 * @param {string} content - Document content
 * @returns {Object} { cpt, pla, hcpcs, icd10 }
 */
export function extractAllCodes(content) {
  return {
    cpt: extractCPTCodes(content),
    pla: extractPLACodes(content),
    hcpcs: extractHCPCSCodes(content),
    icd10: extractICD10Codes(content),
  };
}

/**
 * Check if content contains MRD-related codes
 * @param {string} content - Document content
 * @returns {Object} { hasMRDCodes, codes, tests }
 */
export function detectMRDCodes(content) {
  const plaCodes = extractPLACodes(content);
  const cptCodes = extractCPTCodes(content);

  const mrdPLAs = plaCodes.filter(code => MRD_PLA_CODES[code]);
  const mrdCPTs = cptCodes.filter(code => LIQUID_BIOPSY_CPT[code]);

  const detectedTests = mrdPLAs.map(code => MRD_PLA_CODES[code]);

  return {
    hasMRDCodes: mrdPLAs.length > 0 || mrdCPTs.length > 0,
    plaCodes: mrdPLAs,
    cptCodes: mrdCPTs,
    detectedTests: [...new Set(detectedTests)],
  };
}

/**
 * Extract code table from structured content
 * Looks for tables with code columns
 * @param {string} content - Document content
 * @returns {Object[]} Array of { code, description } objects
 */
export function extractCodeTable(content) {
  const entries = [];

  // Pattern: code followed by description on same line or nearby
  // "0239U  Signatera, Natera, Inc"
  // "81479 - Unlisted molecular pathology"
  const tablePatterns = [
    /([0-9]{4}U)\s+[-–]?\s*([^\n]{10,80})/g,
    /(8[0-9]{4})\s+[-–]?\s*([^\n]{10,80})/g,
    /([A-Z][0-9]{4})\s+[-–]?\s*([^\n]{10,80})/g,
  ];

  for (const pattern of tablePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      entries.push({
        code: match[1].toUpperCase(),
        description: match[2].trim(),
      });
    }
  }

  return entries;
}

/**
 * Get test name for a PLA code
 * @param {string} plaCode - PLA code (e.g., "0239U")
 * @returns {string|null} Test name or null
 */
export function getTestForPLACode(plaCode) {
  return MRD_PLA_CODES[plaCode.toUpperCase()] || null;
}

/**
 * Check if codes indicate the document is relevant to liquid biopsy/MRD
 * @param {Object} codes - Extracted codes object
 * @returns {boolean}
 */
export function isLiquidBiopsyRelevant(codes) {
  // Check for known MRD PLA codes
  const hasMRDPLA = codes.pla?.some(code => MRD_PLA_CODES[code]);
  if (hasMRDPLA) return true;

  // Check for liquid biopsy CPT codes
  const hasLBCPT = codes.cpt?.some(code => LIQUID_BIOPSY_CPT[code]);
  if (hasLBCPT) return true;

  // Check for unlisted molecular pathology (often used for newer tests)
  if (codes.cpt?.includes('81479') || codes.cpt?.includes('81599')) {
    return true;
  }

  return false;
}

/**
 * Generate a stable hash key from codes
 * Used for detecting code table changes
 * @param {Object} codes - Extracted codes object
 * @returns {string} Sorted, concatenated code string
 */
export function getCodesFingerprint(codes) {
  const all = [
    ...(codes.cpt || []),
    ...(codes.pla || []),
    ...(codes.hcpcs || []),
  ].sort();

  return all.join(',');
}

export default {
  extractCPTCodes,
  extractPLACodes,
  extractHCPCSCodes,
  extractICD10Codes,
  extractAllCodes,
  detectMRDCodes,
  extractCodeTable,
  getTestForPLACode,
  isLiquidBiopsyRelevant,
  getCodesFingerprint,
  MRD_PLA_CODES,
  LIQUID_BIOPSY_CPT,
};
