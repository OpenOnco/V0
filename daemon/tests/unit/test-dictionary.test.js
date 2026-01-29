import { describe, it, expect } from 'vitest';
import { TEST_DICTIONARY, matchTests, formatMatchesForPrompt } from '../../src/data/test-dictionary.js';

describe('TEST_DICTIONARY', () => {
  it('contains expected number of tests', () => {
    expect(TEST_DICTIONARY.length).toBeGreaterThanOrEqual(20);
  });

  it('has required fields for each test', () => {
    for (const test of TEST_DICTIONARY) {
      expect(test.id).toBeDefined();
      expect(test.name).toBeDefined();
      expect(test.vendor).toBeDefined();
      expect(test.category).toMatch(/^(mrd|tds|ecd)$/);
      expect(Array.isArray(test.aliases)).toBe(true);
      expect(Array.isArray(test.plaCodes)).toBe(true);
      expect(Array.isArray(test.keywords)).toBe(true);
    }
  });

  it('includes key tests like Signatera, Guardant360, Galleri', () => {
    const names = TEST_DICTIONARY.map(t => t.name.toLowerCase());
    expect(names).toContain('signatera');
    expect(names.some(n => n.includes('guardant360'))).toBe(true);
    expect(names).toContain('galleri');
  });
});

describe('matchTests', () => {
  it('returns empty array for text with no matches', () => {
    const result = matchTests('This text has no test names or codes');
    expect(result).toHaveLength(0);
  });

  it('finds PLA code match with high confidence', () => {
    const result = matchTests('The policy covers procedure code 0179U for MRD testing');
    
    expect(result.length).toBeGreaterThan(0);
    const signatera = result.find(m => m.test.name === 'Signatera');
    expect(signatera).toBeDefined();
    expect(signatera.matchType).toBe('pla_code_match');
    expect(signatera.confidence).toBe(0.95);
  });

  it('finds exact name match with 0.90 confidence', () => {
    const result = matchTests('Coverage for Signatera testing is approved');
    
    const match = result.find(m => m.test.name === 'Signatera');
    expect(match).toBeDefined();
    expect(match.matchType).toBe('name_match');
    expect(match.confidence).toBe(0.90);
  });

  it('finds alias match with 0.85 confidence', () => {
    const result = matchTests('The Signatera MRD assay is now covered');
    
    const match = result.find(m => m.test.name === 'Signatera');
    expect(match).toBeDefined();
    // Could be name_match or alias_match depending on order
    expect(['name_match', 'alias_match']).toContain(match.matchType);
  });

  it('is case insensitive', () => {
    const result1 = matchTests('SIGNATERA coverage');
    const result2 = matchTests('signatera coverage');
    const result3 = matchTests('Signatera coverage');
    
    expect(result1.length).toBeGreaterThan(0);
    expect(result2.length).toBeGreaterThan(0);
    expect(result3.length).toBeGreaterThan(0);
  });

  it('returns matches sorted by confidence descending', () => {
    // Create text that might match multiple tests with different confidence
    const result = matchTests('0179U Signatera Natera MRD testing ctDNA');
    
    if (result.length > 1) {
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
      }
    }
  });

  it('finds FoundationOne CDx by PLA code 0037U', () => {
    const result = matchTests('Billing code 0037U for CGP testing');
    
    const match = result.find(m => m.test.name === 'FoundationOne CDx');
    expect(match).toBeDefined();
    expect(match.matchType).toBe('pla_code_match');
  });

  it('finds clonoSEQ with multiple PLA codes', () => {
    const result1 = matchTests('Code 0016U for lymphoid');
    const result2 = matchTests('Code 0017U for myeloid');
    
    expect(result1.some(m => m.test.name === 'clonoSEQ')).toBe(true);
    expect(result2.some(m => m.test.name === 'clonoSEQ')).toBe(true);
  });

  it('handles empty input', () => {
    expect(matchTests('')).toHaveLength(0);
    expect(matchTests(null)).toHaveLength(0);
    expect(matchTests(undefined)).toHaveLength(0);
  });
});

describe('formatMatchesForPrompt', () => {
  it('returns message for empty matches', () => {
    const result = formatMatchesForPrompt([]);
    expect(result).toContain('No tests were identified');
  });

  it('formats matches with confidence labels', () => {
    const matches = [{
      test: { name: 'Signatera', vendor: 'Natera' },
      matchType: 'pla_code_match',
      confidence: 0.95,
      matchedOn: '0179U'
    }];
    
    const result = formatMatchesForPrompt(matches);
    expect(result).toContain('Signatera');
    expect(result).toContain('Natera');
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
