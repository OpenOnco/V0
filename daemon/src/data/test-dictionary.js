/**
 * Test Dictionary for OpenOnco
 *
 * Fetches test metadata from the API and provides lookup functions
 * for matching tests by PLA codes, names, and vendors.
 */

import { logger } from '../utils/logger.js';

// Configuration
const API_URL = 'https://openonco.org/api/v1/tests-meta';
const FALLBACK_SNAPSHOT = [];

// Module-level state
let dictionary = null;
const lookupByName = new Map();
const lookupByPLA = new Map();
const lookupByVendor = new Map();

/**
 * Initialize the test dictionary by fetching from API
 * @returns {Promise<void>}
 */
export async function initializeTestDictionary() {
  if (dictionary !== null) {
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(API_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();
    dictionary = data.tests || [];
    logger.info(`Test dictionary loaded: ${dictionary.length} tests from API`);
  } catch (error) {
    logger.warn(`Failed to fetch test dictionary from API: ${error.message}. Using fallback snapshot.`);
    dictionary = FALLBACK_SNAPSHOT;
  }

  buildLookupTables();
}

/**
 * Build lookup tables for fast matching
 */
function buildLookupTables() {
  lookupByName.clear();
  lookupByPLA.clear();
  lookupByVendor.clear();

  for (const test of dictionary) {
    // Index by lowercase name
    if (test.name) {
      lookupByName.set(test.name.toLowerCase(), test);
    }

    // Index by PLA codes
    const plaCodes = extractPLACodes(test.cptCodes);
    for (const code of plaCodes) {
      lookupByPLA.set(code, test);
    }

    // Index by vendor (multiple tests per vendor)
    if (test.vendor) {
      const vendorKey = test.vendor.toLowerCase();
      if (!lookupByVendor.has(vendorKey)) {
        lookupByVendor.set(vendorKey, []);
      }
      lookupByVendor.get(vendorKey).push(test);
    }
  }
}

/**
 * Extract PLA codes from a cptCodes string
 * PLA codes match pattern 0###U (4 digits starting with 0, ending with U)
 * @param {string|null} cptCodes - CPT codes string
 * @returns {string[]} Array of unique uppercase PLA codes
 */
function extractPLACodes(cptCodes) {
  if (!cptCodes) {
    return [];
  }

  const matches = cptCodes.match(/\b(0\d{3}U)\b/gi);
  if (!matches) {
    return [];
  }

  // Return unique uppercase codes
  return [...new Set(matches.map(code => code.toUpperCase()))];
}

/**
 * Match a test based on text content
 * @param {string} text - Text to search for test references
 * @param {string|null} vendor - Optional vendor name to narrow search
 * @returns {{ test: Object, confidence: number, matchType: string }|null}
 */
export function matchTest(text, vendor = null) {
  if (dictionary === null) {
    return null;
  }

  const textLower = text.toLowerCase();

  // Check PLA codes first (95% confidence)
  const plaCodes = extractPLACodes(text);
  for (const code of plaCodes) {
    const test = lookupByPLA.get(code);
    if (test) {
      return {
        test,
        confidence: 0.95,
        matchType: 'pla_code'
      };
    }
  }

  // Check exact name match (90% confidence)
  for (const [name, test] of lookupByName) {
    if (textLower.includes(name)) {
      return {
        test,
        confidence: 0.90,
        matchType: 'exact_name'
      };
    }
  }

  // Check vendor + partial name match (70% confidence)
  if (vendor) {
    const vendorKey = vendor.toLowerCase();
    const vendorTests = lookupByVendor.get(vendorKey);
    if (vendorTests) {
      for (const test of vendorTests) {
        // Check if any significant part of the test name appears in text
        const nameParts = test.name.toLowerCase().split(/\s+/);
        for (const part of nameParts) {
          if (part.length > 3 && textLower.includes(part)) {
            return {
              test,
              confidence: 0.70,
              matchType: 'vendor_partial'
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Get all tests in the dictionary
 * @returns {Array} Array of test objects
 */
export function getAllTests() {
  return dictionary || [];
}

/**
 * Find a test by its ID
 * @param {string} id - Test ID
 * @returns {Object|undefined} Test object or undefined
 */
export function findTestById(id) {
  if (!dictionary) {
    return undefined;
  }
  return dictionary.find(test => test.id === id);
}

// =============================================================================
// Backwards-compatible exports (legacy API)
// These match the original API used by crawlers
// =============================================================================

/**
 * Match all tests mentioned in text content
 * @param {string} text - Text content to search
 * @returns {Array<{test: Object, matchType: string, confidence: number, matchedOn: string}>}
 */
export function matchTests(text) {
  if (!text || typeof text !== 'string' || dictionary === null) {
    return [];
  }

  const textLower = text.toLowerCase();
  const matches = new Map();

  for (const test of dictionary) {
    let bestMatch = null;

    // Priority 1: PLA code match (confidence 0.95)
    const plaCodes = extractPLACodes(test.cptCodes);
    for (const code of plaCodes) {
      const codePatterns = [
        new RegExp(`\\b${code}\\b`, 'i'),
        new RegExp(`cpt[:\\s]*${code}`, 'i'),
        new RegExp(`pla[:\\s]*${code}`, 'i')
      ];

      for (const pattern of codePatterns) {
        if (pattern.test(text)) {
          bestMatch = {
            test,
            matchType: 'pla_code_match',
            confidence: 0.95,
            matchedOn: code
          };
          break;
        }
      }
      if (bestMatch) break;
    }

    // Priority 2: Exact test name match (confidence 0.90)
    if (!bestMatch && test.name) {
      const namePattern = new RegExp(`\\b${escapeRegex(test.name)}\\b`, 'i');
      if (namePattern.test(text)) {
        bestMatch = {
          test,
          matchType: 'name_match',
          confidence: 0.90,
          matchedOn: test.name
        };
      }
    }

    // Priority 3: Vendor + category keyword match (confidence 0.70)
    if (!bestMatch && test.vendor) {
      const vendorPattern = new RegExp(`\\b${escapeRegex(test.vendor.split('/')[0])}\\b`, 'i');
      const vendorMatch = vendorPattern.test(text);

      if (vendorMatch) {
        const categoryTerms = {
          MRD: ['mrd', 'minimal residual disease', 'residual disease', 'monitoring', 'recurrence', 'ctdna'],
          TDS: ['cgp', 'comprehensive genomic', 'tumor profiling', 'companion diagnostic', 'cdx', 'treatment', 'therapy selection'],
          ECD: ['screening', 'early detection', 'multi-cancer', 'mced'],
          HCT: ['hereditary', 'germline', 'genetic testing', 'cancer risk'],
          TRM: ['response monitoring', 'treatment response', 'therapy monitoring']
        };

        const relevantTerms = categoryTerms[test.category] || [];
        for (const term of relevantTerms) {
          if (textLower.includes(term)) {
            bestMatch = {
              test,
              matchType: 'vendor_keyword_match',
              confidence: 0.70,
              matchedOn: `${test.vendor} + ${term}`
            };
            break;
          }
        }
      }
    }

    if (bestMatch) {
      const existing = matches.get(test.id);
      if (!existing || bestMatch.confidence > existing.confidence) {
        matches.set(test.id, bestMatch);
      }
    }
  }

  return Array.from(matches.values())
    .sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return a.test.name.localeCompare(b.test.name);
    });
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format deterministic matches for inclusion in Claude prompts
 * @param {Array} matches - Array of match objects from matchTests()
 * @returns {string} Formatted string for prompt inclusion
 */
export function formatMatchesForPrompt(matches) {
  if (!matches || matches.length === 0) {
    return 'No tests were identified by deterministic matching.';
  }

  const lines = matches.map(m => {
    const confidenceLabel = m.confidence >= 0.9 ? 'HIGH' : m.confidence >= 0.75 ? 'MEDIUM' : 'LOW';
    return `- ${m.test.name} (${m.test.vendor}) [${confidenceLabel} confidence: ${m.matchType}, matched on: "${m.matchedOn}"]`;
  });

  return `The following tests were identified by deterministic code/name matching:\n${lines.join('\n')}`;
}

export default {
  initializeTestDictionary,
  matchTest,
  matchTests,
  formatMatchesForPrompt,
  getAllTests,
  findTestById
};
