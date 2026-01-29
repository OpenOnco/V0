import { describe, it, expect } from 'vitest';
import { computeDiff, formatDiffForPrompt, truncateDiff } from '../../src/utils/diff.js';

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
      expect(result.diff).toBe(null);
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
      const lines = [];
      for (let i = 1; i <= 100; i++) {
        lines.push(`Old line ${i}`);
      }
      const oldText = lines.join('\n');

      const newLines = [];
      for (let i = 1; i <= 100; i++) {
        newLines.push(`New line ${i}`);
      }
      const newText = newLines.join('\n');

      const result = computeDiff(oldText, newText, 50);

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

  describe('summary generation', () => {
    it('generates summary with added lines count', () => {
      const result = computeDiff('Old', 'Old\nNew 1\nNew 2');
      expect(result.summary).toContain('2 lines added');
    });

    it('generates summary with removed lines count', () => {
      const result = computeDiff('Old 1\nOld 2\nOld 3', 'Old 1');
      expect(result.summary).toContain('2 lines removed');
    });

    it('generates combined summary for adds and removes', () => {
      const result = computeDiff('Old line', 'New line');
      expect(result.summary).toContain('added');
      expect(result.summary).toContain('removed');
    });
  });

  describe('edge cases', () => {
    it('handles empty lines in content', () => {
      const oldText = 'Line 1\n\nLine 3';
      const newText = 'Line 1\n\nLine 3\n\nLine 5';

      const result = computeDiff(oldText, newText);

      // Empty lines are filtered out, so only Line 5 should be added
      expect(result.added).toContain('Line 5');
    });
  });
});

describe('formatDiffForPrompt', () => {
  it('returns null for first crawl', () => {
    const diff = { isFirstCrawl: true, diff: null };
    const result = formatDiffForPrompt(diff);
    expect(result).toBe(null);
  });

  it('formats removed content with - prefix', () => {
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

  it('formats added content with + prefix', () => {
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

  it('truncates to maxChars when content is too long', () => {
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

describe('truncateDiff', () => {
  it('returns first crawl message when isFirstCrawl is true', () => {
    const diff = { isFirstCrawl: true };
    const result = truncateDiff(diff);
    expect(result).toBe('First crawl - no previous content to compare');
  });

  it('includes summary in output', () => {
    const diff = {
      isFirstCrawl: false,
      added: ['New line'],
      removed: ['Old line'],
      changed: [],
      addedCount: 1,
      removedCount: 1,
      summary: '1 lines added, 1 lines removed',
    };

    const result = truncateDiff(diff);

    expect(result).toContain('CHANGES SUMMARY:');
    expect(result).toContain('1 lines added, 1 lines removed');
  });

  it('formats removed section', () => {
    const diff = {
      isFirstCrawl: false,
      added: [],
      removed: ['Removed content here'],
      changed: [],
      addedCount: 0,
      removedCount: 1,
      summary: '1 lines removed',
    };

    const result = truncateDiff(diff);

    expect(result).toContain('REMOVED:');
    expect(result).toContain('- Removed content here');
  });

  it('formats added section', () => {
    const diff = {
      isFirstCrawl: false,
      added: ['Added content here'],
      removed: [],
      changed: [],
      addedCount: 1,
      removedCount: 0,
      summary: '1 lines added',
    };

    const result = truncateDiff(diff);

    expect(result).toContain('ADDED:');
    expect(result).toContain('+ Added content here');
  });

  it('formats modified section with old and new', () => {
    const diff = {
      isFirstCrawl: false,
      added: [],
      removed: [],
      changed: [
        { old: 'Status: pending', new: 'Status: approved' },
      ],
      addedCount: 0,
      removedCount: 0,
      summary: '1 lines modified',
    };

    const result = truncateDiff(diff);

    expect(result).toContain('MODIFIED:');
    expect(result).toContain('- Status: pending');
    expect(result).toContain('+ Status: approved');
  });

  it('limits removed lines to 50 and shows count', () => {
    const removed = [];
    for (let i = 1; i <= 60; i++) {
      removed.push(`Removed line ${i}`);
    }

    const diff = {
      isFirstCrawl: false,
      added: [],
      removed,
      changed: [],
      addedCount: 0,
      removedCount: 60,
      summary: '60 lines removed',
    };

    const result = truncateDiff(diff);

    // Should only show 50 lines
    expect(result).toContain('- Removed line 1');
    expect(result).toContain('- Removed line 50');
    expect(result).not.toContain('- Removed line 51');
    expect(result).toContain('... and 10 more removed lines');
  });

  it('limits added lines to 50 and shows count', () => {
    const added = [];
    for (let i = 1; i <= 60; i++) {
      added.push(`Added line ${i}`);
    }

    const diff = {
      isFirstCrawl: false,
      added,
      removed: [],
      changed: [],
      addedCount: 60,
      removedCount: 0,
      summary: '60 lines added',
    };

    const result = truncateDiff(diff);

    expect(result).toContain('+ Added line 50');
    expect(result).not.toContain('+ Added line 51');
    expect(result).toContain('... and 10 more added lines');
  });

  it('limits modified lines to 20 and shows count', () => {
    const changed = [];
    for (let i = 1; i <= 25; i++) {
      changed.push({ old: `Old ${i}`, new: `New ${i}` });
    }

    const diff = {
      isFirstCrawl: false,
      added: [],
      removed: [],
      changed,
      addedCount: 0,
      removedCount: 0,
      summary: '25 lines modified',
    };

    const result = truncateDiff(diff);

    expect(result).toContain('- Old 1');
    expect(result).toContain('+ New 1');
    expect(result).toContain('- Old 20');
    expect(result).toContain('+ New 20');
    expect(result).not.toContain('Old 21');
    expect(result).toContain('... and 5 more modified lines');
  });

  it('truncates overall output to maxChars', () => {
    const longContent = [];
    for (let i = 1; i <= 200; i++) {
      longContent.push(`This is a very long line of content number ${i} with lots of text`);
    }

    const diff = {
      isFirstCrawl: false,
      added: longContent,
      removed: [],
      changed: [],
      addedCount: 200,
      removedCount: 0,
      summary: '200 lines added',
    };

    const result = truncateDiff(diff, 1000);

    expect(result.length).toBeLessThanOrEqual(1000);
    expect(result).toContain('[diff truncated]');
  });

  it('handles diff with no changes', () => {
    const diff = {
      isFirstCrawl: false,
      added: [],
      removed: [],
      changed: [],
      addedCount: 0,
      removedCount: 0,
      summary: 'No significant changes detected',
    };

    const result = truncateDiff(diff);

    expect(result).toContain('CHANGES SUMMARY:');
    expect(result).toContain('No significant changes detected');
  });
});
