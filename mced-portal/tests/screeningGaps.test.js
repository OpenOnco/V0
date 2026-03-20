import { describe, it, expect } from 'vitest';
import { identifyScreeningGaps } from '../src/logic/identifyScreeningGaps';

describe('identifyScreeningGaps', () => {
  it('returns all applicable gaps when nothing is screened (female)', () => {
    const form = { sex: 'female', screenings: [] };
    const gaps = identifyScreeningGaps(form);
    expect(gaps).toContain('Colon/Rectum');
    expect(gaps).toContain('Breast');
    expect(gaps).toContain('Cervix');
    expect(gaps.length).toBe(3);
  });

  it('returns only colonoscopy gap for males', () => {
    const form = { sex: 'male', screenings: [] };
    expect(identifyScreeningGaps(form)).toEqual(['Colon/Rectum']);
  });

  it('returns empty when all screenings are complete (female)', () => {
    const form = { sex: 'female', screenings: ['colonoscopy', 'mammogram', 'papHpv'] };
    expect(identifyScreeningGaps(form)).toEqual([]);
  });

  it('returns empty when all screenings are complete (male)', () => {
    const form = { sex: 'male', screenings: ['colonoscopy'] };
    expect(identifyScreeningGaps(form)).toEqual([]);
  });

  it('returns partial gaps', () => {
    const form = { sex: 'female', screenings: ['mammogram'] };
    const gaps = identifyScreeningGaps(form);
    expect(gaps).toContain('Colon/Rectum');
    expect(gaps).toContain('Cervix');
    expect(gaps).not.toContain('Breast');
  });
});
