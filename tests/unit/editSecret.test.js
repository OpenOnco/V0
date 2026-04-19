import { describe, expect, it } from 'vitest';

import { matchesEditSecret, normalizeEditSecret } from '../../src/utils/editSecret';

describe('edit secret helpers', () => {
  it('trims trailing newlines from the configured secret', () => {
    expect(normalizeEditSecret('abc123\n')).toBe('abc123');
    expect(normalizeEditSecret('  abc123  ')).toBe('abc123');
  });

  it('matches the route secret even when the configured value has trailing whitespace', () => {
    expect(matchesEditSecret('f0472ddb92fd920dc406dd908df893d192a3cbd720d5dfb8', 'f0472ddb92fd920dc406dd908df893d192a3cbd720d5dfb8\n')).toBe(true);
  });

  it('rejects empty configured secrets', () => {
    expect(matchesEditSecret('abc123', '')).toBe(false);
    expect(matchesEditSecret('abc123', '\n')).toBe(false);
  });
});
