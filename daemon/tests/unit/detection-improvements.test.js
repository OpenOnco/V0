/**
 * Detection Improvements Test Suite
 *
 * Comprehensive tests for the coverage detection improvements:
 * - canonicalizeContent() - Content normalization for change detection
 * - matchTests() - Deterministic test matching from text
 * - computeDiff() / formatDiffForPrompt() - Diff utilities
 */

import { describe, it, expect } from 'vitest';
import { canonicalizeContent } from '../../src/utils/canonicalize.js';
import { matchTests } from '../../src/data/test-dictionary.js';
import { computeDiff, formatDiffForPrompt } from '../../src/utils/diff.js';

// =============================================================================
// canonicalizeContent() Tests
// =============================================================================
describe('canonicalizeContent', () => {
  describe('date stripping', () => {
    it('strips "Last updated: Jan 28, 2026" patterns', () => {
      const input = 'Policy content. Last updated: Jan 28, 2026. More content.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('last updated');
      expect(result).not.toContain('2026');
      expect(result).toContain('policy content');
      expect(result).toContain('more content');
    });

    it('strips "Last reviewed: January 28, 2026" patterns', () => {
      const input = 'Content here. Last reviewed: January 28, 2026';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('last reviewed');
      expect(result).not.toContain('january 28, 2026');
    });

    it('partially strips numeric date formats (removes year portion)', () => {
      // Note: The regex matches "Last reviewed" followed by text ending in a 4-digit year
      // For "01/28/2026", the slashes aren't in the [\w\s,]+ pattern, so only partial match
      const input = 'Content here. Last reviewed: 01/28/2026';
      const result = canonicalizeContent(input);

      // The year "2026" gets stripped, but the preceding slash pattern remains
      expect(result).not.toContain('2026');
    });

    it('strips "Last modified" and "Last revised" dates', () => {
      const input = 'Last modified: December 15, 2025. Last revised: November 2024.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('last modified');
      expect(result).not.toContain('last revised');
    });
  });

  describe('copyright stripping', () => {
    it('strips "Copyright 2024" patterns', () => {
      const input = 'Content here. Copyright 2024 Company Name.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('copyright');
      expect(result).not.toContain('2024');
    });

    it('strips "© 2026" patterns', () => {
      const input = '© 2026 All content. More text.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('©');
      expect(result).not.toContain('2026');
    });

    it('strips "Copyright 2024-2026" year ranges', () => {
      const input = 'Copyright 2024-2026 Company.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('copyright');
      expect(result).not.toContain('2024-2026');
    });
  });

  describe('boilerplate stripping', () => {
    it('removes "skip to content" text', () => {
      const input = 'Skip to content. Policy information here.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('skip to content');
      expect(result).toContain('policy information');
    });

    it('removes "skip to main content" text', () => {
      const input = 'Skip to main content. Policy information here.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('skip to');
    });

    it('removes "print this page" text', () => {
      const input = 'Print this page. Coverage criteria below.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('print this page');
    });

    it('removes cookie consent text', () => {
      const input = 'Cookie policy. Cookie consent. Accept all cookies. We use cookies to improve your experience.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('cookie');
    });

    it('removes privacy policy and terms text', () => {
      const input = 'Privacy policy. Terms of use. Terms and conditions.';
      const result = canonicalizeContent(input);

      expect(result).not.toContain('privacy policy');
      expect(result).not.toContain('terms of use');
      expect(result).not.toContain('terms and conditions');
    });
  });

  describe('whitespace normalization', () => {
    it('normalizes multiple spaces to single space', () => {
      const input = 'Multiple    spaces     here.';
      const result = canonicalizeContent(input);

      expect(result).toBe('multiple spaces here.');
      expect(result).not.toContain('  ');
    });

    it('normalizes multiple newlines to single space', () => {
      const input = 'Line one.\n\n\nLine two.';
      const result = canonicalizeContent(input);

      expect(result).toBe('line one. line two.');
    });

    it('trims leading and trailing whitespace', () => {
      const input = '   Content here.   ';
      const result = canonicalizeContent(input);

      expect(result).toBe('content here.');
    });
  });

  describe('lowercase conversion', () => {
    it('converts to lowercase', () => {
      const input = 'MixedCase CONTENT Here';
      const result = canonicalizeContent(input);

      expect(result).toBe('mixedcase content here');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(canonicalizeContent('')).toBe('');
    });

    it('handles null input', () => {
      expect(canonicalizeContent(null)).toBe('');
    });

    it('handles undefined input', () => {
      expect(canonicalizeContent(undefined)).toBe('');
    });

    it('preserves policy-relevant content through all transformations', () => {
      const input = `Skip to main content
        Medical Policy
        Last updated: January 15, 2026
        Molecular Residual Disease Testing
        Coverage is provided for FDA-approved MRD tests.
        Print this page
        © 2026 Insurance Company. All rights reserved.
        Privacy policy | Terms of use`;

      const result = canonicalizeContent(input);

      // Should keep policy content
      expect(result).toContain('medical policy');
      expect(result).toContain('molecular residual disease');
      expect(result).toContain('fda-approved');

      // Should strip all boilerplate
      expect(result).not.toContain('skip to');
      expect(result).not.toContain('last updated');
      expect(result).not.toContain('print this');
      expect(result).not.toContain('©');
      expect(result).not.toContain('privacy policy');
    });
  });
});

// =============================================================================
// matchTests() Tests
// =============================================================================
describe('matchTests', () => {
  describe('PLA code matching (0.95 confidence)', () => {
    it('returns PLA code match with 0.95 confidence (e.g., "0179U" finds Signatera)', () => {
      const result = matchTests('The policy covers procedure code 0179U for MRD testing');

      expect(result.length).toBeGreaterThan(0);
      const signatera = result.find(m => m.test.name === 'Signatera');
      expect(signatera).toBeDefined();
      expect(signatera.matchType).toBe('pla_code_match');
      expect(signatera.confidence).toBe(0.95);
      expect(signatera.matchedOn).toBe('0179U');
    });

    it('finds FoundationOne CDx by PLA code 0037U', () => {
      const result = matchTests('Billing code 0037U for CGP testing');

      const match = result.find(m => m.test.name === 'FoundationOne CDx');
      expect(match).toBeDefined();
      expect(match.matchType).toBe('pla_code_match');
      expect(match.confidence).toBe(0.95);
    });

    it('finds clonoSEQ with multiple PLA codes (0016U, 0017U)', () => {
      const result1 = matchTests('Code 0016U for lymphoid testing');
      const result2 = matchTests('Code 0017U for myeloid testing');

      expect(result1.some(m => m.test.name === 'clonoSEQ')).toBe(true);
      expect(result2.some(m => m.test.name === 'clonoSEQ')).toBe(true);
    });
  });

  describe('name matching (0.90 confidence)', () => {
    it('returns name match with 0.90 confidence (e.g., "Signatera" text)', () => {
      const result = matchTests('Coverage for Signatera testing is approved');

      const match = result.find(m => m.test.name === 'Signatera');
      expect(match).toBeDefined();
      expect(match.matchType).toBe('name_match');
      expect(match.confidence).toBe(0.90);
      expect(match.matchedOn).toBe('Signatera');
    });

    it('matches exact test names like Guardant360 CDx', () => {
      const result = matchTests('The Guardant360 CDx assay is covered');

      const match = result.find(m => m.test.name === 'Guardant360 CDx');
      expect(match).toBeDefined();
      expect(match.confidence).toBe(0.90);
    });
  });

  describe('alias matching (0.85 confidence)', () => {
    it('returns alias match with 0.85 confidence (e.g., "Reveal MRD" finds Guardant Reveal)', () => {
      const result = matchTests('The Reveal MRD test is now covered under the policy');

      const match = result.find(m => m.test.name === 'Guardant Reveal');
      expect(match).toBeDefined();
      expect(match.matchType).toBe('alias_match');
      expect(match.confidence).toBe(0.85);
      expect(match.matchedOn).toBe('Reveal MRD');
    });

    it('matches F1CDx alias for FoundationOne CDx', () => {
      const result = matchTests('Coverage includes F1CDx testing');

      const match = result.find(m => m.test.name === 'FoundationOne CDx');
      expect(match).toBeDefined();
      expect(match.matchType).toBe('alias_match');
      expect(match.confidence).toBe(0.85);
    });

    it('matches Natera Signatera alias', () => {
      const result = matchTests('Natera Signatera is approved for monitoring');

      const match = result.find(m => m.test.name === 'Signatera');
      expect(match).toBeDefined();
      // Could be name_match (Signatera) or alias_match (Natera Signatera) - name takes priority
      expect(['name_match', 'alias_match']).toContain(match.matchType);
    });
  });

  describe('vendor + keyword matching (0.70 confidence)', () => {
    it('returns vendor+keyword match with 0.70 confidence (e.g., "Natera" + "MRD")', () => {
      // Text mentions vendor and category keyword but not test name
      const result = matchTests('Natera offers molecular residual disease monitoring solutions');

      const match = result.find(m => m.test.vendor === 'Natera');
      expect(match).toBeDefined();
      expect(match.matchType).toBe('vendor_keyword_match');
      expect(match.confidence).toBe(0.70);
      expect(match.matchedOn).toContain('Natera');
    });

    it('matches Guardant Health + screening keywords for Shield', () => {
      // Text mentions vendor and ECD category keyword
      const result = matchTests('Guardant Health colorectal screening blood test');

      const match = result.find(m => m.test.name === 'Shield');
      expect(match).toBeDefined();
      expect(match.matchType).toBe('vendor_keyword_match');
      expect(match.confidence).toBe(0.70);
    });

    it('matches Foundation Medicine + CGP keywords for FoundationOne CDx', () => {
      const result = matchTests('Foundation Medicine comprehensive genomic profiling for tumor analysis');

      const match = result.find(m => m.test.vendor === 'Foundation Medicine');
      expect(match).toBeDefined();
      expect(match.matchType).toBe('vendor_keyword_match');
      expect(match.confidence).toBe(0.70);
    });
  });

  describe('empty/no matches', () => {
    it('returns empty array when no matches', () => {
      const result = matchTests('This text has no test names, codes, or relevant keywords');
      expect(result).toEqual([]);
    });

    it('handles empty string', () => {
      expect(matchTests('')).toHaveLength(0);
    });

    it('handles null input', () => {
      expect(matchTests(null)).toHaveLength(0);
    });

    it('handles undefined input', () => {
      expect(matchTests(undefined)).toHaveLength(0);
    });
  });

  describe('multiple matches and sorting', () => {
    it('returns multiple matches sorted by confidence (highest first)', () => {
      // Text that should match multiple tests with different confidence levels
      const result = matchTests('0179U Signatera and Natera MRD testing');

      expect(result.length).toBeGreaterThanOrEqual(1);

      // Should be sorted by confidence descending
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
      }
    });

    it('deduplicates matches for same test (keeps highest confidence)', () => {
      // Text with both PLA code and name should only return one match per test
      const result = matchTests('Test code 0179U for Signatera MRD monitoring');

      const signatera = result.filter(m => m.test.name === 'Signatera');
      expect(signatera).toHaveLength(1);
      // Should keep the PLA code match (0.95) over name match (0.90)
      expect(signatera[0].matchType).toBe('pla_code_match');
    });

    it('finds multiple different tests in same text', () => {
      const result = matchTests('Coverage for Signatera and Guardant360 CDx testing');

      const names = result.map(m => m.test.name);
      expect(names).toContain('Signatera');
      expect(names).toContain('Guardant360 CDx');
    });
  });

  describe('case insensitivity', () => {
    it('is case insensitive for test names', () => {
      const result1 = matchTests('SIGNATERA coverage');
      const result2 = matchTests('signatera coverage');
      const result3 = matchTests('Signatera coverage');

      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);
      expect(result3.length).toBeGreaterThan(0);

      // All should find Signatera
      expect(result1[0].test.name).toBe('Signatera');
      expect(result2[0].test.name).toBe('Signatera');
      expect(result3[0].test.name).toBe('Signatera');
    });

    it('is case insensitive for PLA codes', () => {
      const result1 = matchTests('Code 0179U');
      const result2 = matchTests('Code 0179u');

      expect(result1.some(m => m.test.name === 'Signatera')).toBe(true);
      expect(result2.some(m => m.test.name === 'Signatera')).toBe(true);
    });
  });
});

// =============================================================================
// computeDiff() Tests
// =============================================================================
describe('computeDiff', () => {
  describe('first crawl handling', () => {
    it('returns isFirstCrawl: true when oldText is null', () => {
      const result = computeDiff(null, 'New content here');
      expect(result.isFirstCrawl).toBe(true);
      expect(result.diff).toBe(null);
    });

    it('returns isFirstCrawl: true when oldText is undefined', () => {
      const result = computeDiff(undefined, 'New content here');
      expect(result.isFirstCrawl).toBe(true);
    });

    it('returns isFirstCrawl: true when oldText is empty string', () => {
      const result = computeDiff('', 'New content here');
      expect(result.isFirstCrawl).toBe(true);
      expect(result.diff).toBe(null);
    });
  });

  describe('added lines detection', () => {
    it('identifies added lines correctly', () => {
      const oldText = 'Line 1\nLine 2\nLine 3';
      const newText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';

      const result = computeDiff(oldText, newText);

      expect(result.isFirstCrawl).toBe(false);
      expect(result.added).toContain('Line 4');
      expect(result.added).toContain('Line 5');
      expect(result.addedCount).toBe(2);
    });

    it('identifies single added line', () => {
      const oldText = 'First line\nSecond line';
      const newText = 'First line\nSecond line\nThird line';

      const result = computeDiff(oldText, newText);

      expect(result.added).toEqual(['Third line']);
      expect(result.addedCount).toBe(1);
    });
  });

  describe('removed lines detection', () => {
    it('identifies removed lines correctly', () => {
      const oldText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const newText = 'Line 1\nLine 2\nLine 3';

      const result = computeDiff(oldText, newText);

      expect(result.removed).toContain('Line 4');
      expect(result.removed).toContain('Line 5');
      expect(result.removedCount).toBe(2);
    });

    it('identifies single removed line', () => {
      const oldText = 'First line\nMiddle line\nLast line';
      const newText = 'First line\nLast line';

      const result = computeDiff(oldText, newText);

      expect(result.removed).toEqual(['Middle line']);
      expect(result.removedCount).toBe(1);
    });
  });

  describe('identical content', () => {
    it('handles identical content (no changes)', () => {
      const text = 'Line 1\nLine 2\nLine 3';

      const result = computeDiff(text, text);

      expect(result.isFirstCrawl).toBe(false);
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(result.addedCount).toBe(0);
      expect(result.removedCount).toBe(0);
      expect(result.summary).toBe('No significant changes detected');
    });

    it('handles content that differs only in whitespace', () => {
      const oldText = '  Line 1  \n  Line 2  ';
      const newText = 'Line 1\nLine 2';

      const result = computeDiff(oldText, newText);

      // After trimming, these should be identical
      expect(result.added).toEqual([]);
      expect(result.removed).toEqual([]);
    });
  });

  describe('truncation behavior', () => {
    it('truncates when exceeding maxLines', () => {
      const oldLines = Array.from({ length: 100 }, (_, i) => `Old line ${i + 1}`);
      const newLines = Array.from({ length: 100 }, (_, i) => `New line ${i + 1}`);

      const result = computeDiff(oldLines.join('\n'), newLines.join('\n'), 50);

      expect(result.added.length).toBe(50);
      expect(result.removed.length).toBe(50);
      expect(result.addedCount).toBe(100);
      expect(result.removedCount).toBe(100);
      expect(result.truncated).toBe(true);
    });

    it('respects custom maxLines parameter', () => {
      const oldText = 'a\nb\nc\nd\ne';
      const newText = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10';

      const result = computeDiff(oldText, newText, 3);

      expect(result.added.length).toBe(3);
      expect(result.truncated).toBe(true);
    });

    it('does not set truncated flag when within limits', () => {
      const oldText = 'Line 1';
      const newText = 'Line 1\nLine 2';

      const result = computeDiff(oldText, newText, 50);

      expect(result.truncated).toBe(false);
    });
  });

  describe('counts', () => {
    it('returns correct addedCount and removedCount', () => {
      const oldText = 'A\nB\nC';
      const newText = 'A\nD\nE\nF';

      const result = computeDiff(oldText, newText);

      expect(result.addedCount).toBe(3); // D, E, F
      expect(result.removedCount).toBe(2); // B, C
    });
  });
});

// =============================================================================
// formatDiffForPrompt() Tests
// =============================================================================
describe('formatDiffForPrompt', () => {
  it('returns null for first crawl', () => {
    const diff = { isFirstCrawl: true, diff: null };
    const result = formatDiffForPrompt(diff);
    expect(result).toBe(null);
  });

  it('formats removed content section', () => {
    const diff = {
      isFirstCrawl: false,
      added: [],
      removed: ['Old line 1', 'Old line 2'],
      truncated: false,
      addedCount: 0,
      removedCount: 2,
    };

    const result = formatDiffForPrompt(diff);

    expect(result).toContain('REMOVED CONTENT:');
    expect(result).toContain('- Old line 1');
    expect(result).toContain('- Old line 2');
  });

  it('formats added content section', () => {
    const diff = {
      isFirstCrawl: false,
      added: ['New line 1', 'New line 2'],
      removed: [],
      truncated: false,
      addedCount: 2,
      removedCount: 0,
    };

    const result = formatDiffForPrompt(diff);

    expect(result).toContain('ADDED CONTENT:');
    expect(result).toContain('+ New line 1');
    expect(result).toContain('+ New line 2');
  });

  it('includes truncation notice when diff was truncated', () => {
    const diff = {
      isFirstCrawl: false,
      added: ['Line 1'],
      removed: ['Line 2'],
      truncated: true,
      addedCount: 100,
      removedCount: 50,
    };

    const result = formatDiffForPrompt(diff);

    expect(result).toContain('[Diff truncated');
    expect(result).toContain('100 added');
    expect(result).toContain('50 removed');
  });

  it('truncates to maxChars', () => {
    const longLine = 'x'.repeat(1000);
    const diff = {
      isFirstCrawl: false,
      added: [longLine, longLine, longLine, longLine, longLine],
      removed: [],
      truncated: false,
      addedCount: 5,
      removedCount: 0,
    };

    const result = formatDiffForPrompt(diff, 500);

    expect(result.length).toBeLessThanOrEqual(520); // 500 + some overflow for truncation text
    expect(result).toContain('[...truncated]');
  });

  it('handles empty diff (no changes)', () => {
    const diff = {
      isFirstCrawl: false,
      added: [],
      removed: [],
      truncated: false,
      addedCount: 0,
      removedCount: 0,
    };

    const result = formatDiffForPrompt(diff);

    expect(result).toBe('');
  });
});
