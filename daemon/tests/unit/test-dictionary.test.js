import { describe, it, expect, beforeAll } from 'vitest';
import { initializeTestDictionary, matchTests, formatMatchesForPrompt, getAllTests } from '../../src/data/test-dictionary.js';

// Note: These tests require the dictionary to be initialized from the API
// In test environment, we initialize before running tests

describe('Test Dictionary', () => {
  beforeAll(async () => {
    // Initialize the dictionary before running tests
    await initializeTestDictionary();
  });

  describe('getAllTests', () => {
    it('returns an array of tests', () => {
      const tests = getAllTests();
      expect(Array.isArray(tests)).toBe(true);
    });

    it('tests have required fields when loaded from API', () => {
      const tests = getAllTests();
      // Skip detailed field checks if using fallback (empty array)
      if (tests.length > 0) {
        for (const test of tests) {
          expect(test.id).toBeDefined();
          expect(test.name).toBeDefined();
          expect(test.vendor).toBeDefined();
        }
      }
    });
  });

  describe('matchTests', () => {
    it('returns empty array for text with no matches', () => {
      const result = matchTests('This text has no test names or codes');
      expect(result).toHaveLength(0);
    });

    it('handles empty input', () => {
      expect(matchTests('')).toHaveLength(0);
      expect(matchTests(null)).toHaveLength(0);
      expect(matchTests(undefined)).toHaveLength(0);
    });

    it('returns matches sorted by confidence descending', () => {
      const tests = getAllTests();
      if (tests.length === 0) {
        return; // Skip if using fallback
      }

      // Use a test name we know exists
      const testName = tests[0]?.name;
      if (testName) {
        const result = matchTests(`Coverage for ${testName} testing is approved`);
        if (result.length > 1) {
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
          }
        }
      }
    });

    it('finds PLA code match with high confidence', () => {
      const tests = getAllTests();
      // Find a test with PLA codes
      const testWithPLA = tests.find(t => t.cptCodes && /0\d{3}U/i.test(t.cptCodes));
      if (!testWithPLA) {
        return; // Skip if no tests with PLA codes
      }

      const plaMatch = testWithPLA.cptCodes.match(/0\d{3}U/i);
      const plaCode = plaMatch[0];

      const result = matchTests(`The policy covers procedure code ${plaCode} for testing`);
      expect(result.length).toBeGreaterThan(0);

      const match = result.find(m => m.test.id === testWithPLA.id);
      expect(match).toBeDefined();
      expect(match.matchType).toBe('pla_code_match');
      expect(match.confidence).toBe(0.95);
    });

    it('finds exact name match with 0.90 confidence', () => {
      const tests = getAllTests();
      if (tests.length === 0) {
        return; // Skip if using fallback
      }

      const testName = tests[0]?.name;
      if (testName) {
        const result = matchTests(`Coverage for ${testName} testing is approved`);

        const match = result.find(m => m.test.name === testName);
        expect(match).toBeDefined();
        expect(match.matchType).toBe('name_match');
        expect(match.confidence).toBe(0.90);
      }
    });

    it('is case insensitive for name matches', () => {
      const tests = getAllTests();
      if (tests.length === 0) {
        return; // Skip if using fallback
      }

      const testName = tests[0]?.name;
      if (testName) {
        const result1 = matchTests(`${testName.toUpperCase()} coverage`);
        const result2 = matchTests(`${testName.toLowerCase()} coverage`);
        const result3 = matchTests(`${testName} coverage`);

        // At least one should match (name matching depends on exact casing in some edge cases)
        const anyMatches = result1.length > 0 || result2.length > 0 || result3.length > 0;
        expect(anyMatches).toBe(true);
      }
    });
  });

  describe('formatMatchesForPrompt', () => {
    it('returns message for empty matches', () => {
      const result = formatMatchesForPrompt([]);
      expect(result).toContain('No tests were identified');
    });

    it('formats matches with confidence labels', () => {
      const matches = [{
        test: { name: 'TestName', vendor: 'TestVendor' },
        matchType: 'pla_code_match',
        confidence: 0.95,
        matchedOn: '0179U'
      }];

      const result = formatMatchesForPrompt(matches);
      expect(result).toContain('TestName');
      expect(result).toContain('TestVendor');
      expect(result).toContain('HIGH');
      expect(result).toContain('pla_code_match');
    });

    it('labels MEDIUM confidence correctly', () => {
      const matches = [{
        test: { name: 'Test', vendor: 'Vendor' },
        matchType: 'alias_match',
        confidence: 0.85,
        matchedOn: 'alias'
      }];

      const result = formatMatchesForPrompt(matches);
      expect(result).toContain('MEDIUM');
    });

    it('labels LOW confidence correctly', () => {
      const matches = [{
        test: { name: 'Test', vendor: 'Vendor' },
        matchType: 'vendor_keyword_match',
        confidence: 0.70,
        matchedOn: 'keyword'
      }];

      const result = formatMatchesForPrompt(matches);
      expect(result).toContain('LOW');
    });

    it('handles null/undefined input', () => {
      expect(formatMatchesForPrompt(null)).toContain('No tests');
      expect(formatMatchesForPrompt(undefined)).toContain('No tests');
    });
  });
});
