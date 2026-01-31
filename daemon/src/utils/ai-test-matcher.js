/**
 * AI-Based Test Matcher
 *
 * Uses Claude Haiku 3.5 to intelligently identify diagnostic tests
 * mentioned in payer policy content, avoiding false positives from
 * coincidental word matches.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from './logger.js';

// Configuration
const CLAUDE_MODEL = 'claude-3-5-haiku-latest';
const MAX_TOKENS = 1024;
const MAX_CONTENT_CHARS = 100000;  // ~25K tokens for Haiku
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// US-based vendors (widespread or moderate availability in US market)
// Filters out international vendors to reduce token usage
const US_BASED_VENDORS = new Set([
  // Tier 1: Widespread US availability
  'Guardant Health',
  'Foundation Medicine',
  'Natera',
  'Exact Sciences',
  'Labcorp',
  'Labcorp (Invitae)',
  'Labcorp/PGDx',
  'Tempus AI',
  'Tempus',
  'Quest Diagnostics',
  'Myriad Genetics',
  'Invitae',
  'GRAIL',
  'Freenome',
  'Caris Life Sciences',

  // Tier 2: Moderate US availability
  'Adaptive Biotechnologies',
  'BillionToOne',
  'NeoGenomics',
  'Personalis',
  'Genomic Testing Cooperative (GTC)',
  'Cleveland Diagnostics',
  'Veracyte',
  'Veracyte (C2i Genomics)',
  'SAGA Diagnostics',
  'Helio Genomics, Exact Sciences',
  'Foundation Medicine / Natera',
]);

/**
 * Filter test list to only include tests from US-based vendors
 * This reduces token usage significantly for payer policy analysis
 *
 * @param {Array<{name: string, vendor: string, id: string}>} testList - Full test list
 * @returns {Array<{name: string, vendor: string, id: string}>} Filtered list
 */
export function filterUSBasedTests(testList) {
  return testList.filter(test => {
    if (!test.vendor) return true; // Include tests without vendor info
    // Check if vendor matches any US-based vendor (case-insensitive partial match)
    const vendorLower = test.vendor.toLowerCase();
    for (const usVendor of US_BASED_VENDORS) {
      if (vendorLower.includes(usVendor.toLowerCase()) ||
          usVendor.toLowerCase().includes(vendorLower)) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Extract diagnostic tests from page content using AI
 *
 * @param {string} pageContent - The text content of the page to analyze
 * @param {Array<{name: string, vendor: string, id: string}>} testList - List of known tests to match against
 * @param {Object} options - Optional configuration
 * @param {boolean} options.filterUSOnly - Filter to US-based vendors only (default: true)
 * @returns {Promise<{tests: string[], uncertain: string[], error: string|null}>}
 */
export async function extractTestsWithAI(pageContent, testList, options = {}) {
  const { filterUSOnly = true } = options;
  // Validate inputs
  if (!pageContent || typeof pageContent !== 'string') {
    return { tests: [], uncertain: [], error: 'Invalid page content' };
  }

  if (!testList || !Array.isArray(testList) || testList.length === 0) {
    return { tests: [], uncertain: [], error: 'Invalid test list' };
  }

  // Check API key
  if (!config.anthropic?.apiKey) {
    return { tests: [], uncertain: [], error: 'Anthropic API key not configured' };
  }

  // Filter to US-based vendors if requested (reduces tokens significantly)
  const filteredTestList = filterUSOnly ? filterUSBasedTests(testList) : testList;

  if (filteredTestList.length === 0) {
    return { tests: [], uncertain: [], error: 'No tests after filtering' };
  }

  logger.debug(`AI test matcher: ${filteredTestList.length} tests after US filter (${testList.length} total)`);

  // Truncate content if needed
  const truncatedContent = pageContent.length > MAX_CONTENT_CHARS
    ? pageContent.slice(0, MAX_CONTENT_CHARS) + '\n\n[... content truncated ...]'
    : pageContent;

  // Format test list for prompt
  const testListFormatted = filteredTestList.map(t => `- ${t.name} (${t.vendor})`).join('\n');

  const systemPrompt = `You are an expert at identifying medical diagnostic tests in insurance policy documents.

CRITICAL DISAMBIGUATION RULES:
- "Shield" by itself or "Blue Shield" refers to the Blue Shield insurance company, NOT Guardant Health's "Guardant Shield" test
- Only match "Guardant Shield" or "Shield" when clearly in context of Guardant Health's ctDNA test product
- "Foundation" alone refers to Foundation Medicine company, look for specific test names like "FoundationOne CDx"
- Be cautious with partial name matches - require clear diagnostic test context

Your task: Identify which diagnostic tests from the provided list are ACTUALLY mentioned in the document content.

A test is MENTIONED if:
1. The exact test name appears (e.g., "Signatera", "FoundationOne CDx")
2. A PLA/CPT code associated with the test appears (e.g., "0239U")
3. The test is clearly referenced by vendor + product context (e.g., "Guardant's liquid biopsy monitoring test")

A test is NOT mentioned if:
1. Only the vendor name appears without specific test context
2. Similar but different words appear (e.g., "shield" in "Blue Shield" is NOT "Guardant Shield")
3. Generic category terms appear without specific test references

Respond ONLY with valid JSON in this exact format:
{
  "tests": ["TestName1", "TestName2"],
  "uncertain": ["TestName3"],
  "reasoning": "Brief explanation of key matches and rejections"
}

- "tests": Tests that are DEFINITELY mentioned (high confidence)
- "uncertain": Tests that MIGHT be mentioned but context is ambiguous
- Keep reasoning under 100 words`;

  const userPrompt = `KNOWN DIAGNOSTIC TESTS:
${testListFormatted}

DOCUMENT CONTENT:
${truncatedContent}

Identify which tests from the list above are mentioned in this document. Remember:
- "Blue Shield" = insurance company, NOT Guardant Shield test
- Require specific test names or clear product context, not just vendor names
- Return JSON only.`;

  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
        logger.debug(`AI test matcher retry attempt ${attempt}`);
      }

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const responseText = response.content[0]?.text?.trim();
      if (!responseText) {
        throw new Error('Empty response from Claude');
      }

      // Parse JSON response - handle potential markdown code fences
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      // Also try to extract just the JSON object if there's extra text
      const objectMatch = jsonText.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonText = objectMatch[0];
      }

      const result = JSON.parse(jsonText);

      // Validate response structure
      const tests = Array.isArray(result.tests) ? result.tests : [];
      const uncertain = Array.isArray(result.uncertain) ? result.uncertain : [];

      // Filter to only include tests that are in our filtered list
      const knownTestNames = new Set(filteredTestList.map(t => t.name.toLowerCase()));
      const validTests = tests.filter(t =>
        typeof t === 'string' && knownTestNames.has(t.toLowerCase())
      );
      const validUncertain = uncertain.filter(t =>
        typeof t === 'string' && knownTestNames.has(t.toLowerCase())
      );

      logger.debug(`AI test matcher found ${validTests.length} tests, ${validUncertain.length} uncertain`);

      return {
        tests: validTests,
        uncertain: validUncertain,
        error: null,
        reasoning: result.reasoning || null
      };

    } catch (error) {
      const isRetryable = error.status === 429 || error.status === 529 ||
                          error.message?.includes('overloaded');

      if (attempt === MAX_RETRIES || !isRetryable) {
        logger.warn(`AI test matcher failed: ${error.message}`);
        return {
          tests: [],
          uncertain: [],
          error: error.message || 'Unknown error'
        };
      }
    }
  }

  return { tests: [], uncertain: [], error: 'Max retries exceeded' };
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  extractTestsWithAI,
  filterUSBasedTests,
  US_BASED_VENDORS
};
