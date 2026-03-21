import { describe, it, expect } from 'vitest';
import { tierInfo } from '../src/logic/tierInfo';

describe('tierInfo', () => {
  it('returns green for >50%', () => {
    expect(tierInfo(50.1).color).toBe('#4aba4a');
    expect(tierInfo(80).color).toBe('#4aba4a');
  });

  it('returns amber for 25-50%', () => {
    expect(tierInfo(50).color).toBe('#EF9F27');
    expect(tierInfo(25).color).toBe('#EF9F27');
    expect(tierInfo(37).color).toBe('#EF9F27');
  });

  it('returns red for <25%', () => {
    expect(tierInfo(24.9).color).toBe('#E24B4A');
    expect(tierInfo(10).color).toBe('#E24B4A');
  });

  it('returns red for null (no data)', () => {
    expect(tierInfo(null).color).toBe('#E24B4A');
    expect(tierInfo(undefined).color).toBe('#E24B4A');
  });
});
