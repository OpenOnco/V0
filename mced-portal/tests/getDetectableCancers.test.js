import { describe, it, expect } from 'vitest';
import { getDetectableCancers } from '../src/logic/getDetectableCancers';

describe('getDetectableCancers', () => {
  it('returns only cancers where at least one test has data', () => {
    const cancers = getDetectableCancers();
    expect(cancers).toContain('Lung');
    expect(cancers).toContain('Breast');
    expect(cancers).toContain('Pancreas');
  });

  it('excludes cancers no test covers', () => {
    const cancers = getDetectableCancers();
    expect(cancers).not.toContain('Brain');
    expect(cancers).not.toContain('Gallbladder');
    expect(cancers).not.toContain('Leukemia');
    expect(cancers).not.toContain('Small Intestine');
  });

  it('returns sorted array', () => {
    const cancers = getDetectableCancers();
    const sorted = [...cancers].sort();
    expect(cancers).toEqual(sorted);
  });
});
