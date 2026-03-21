import { describe, it, expect } from 'vitest';
import { sortDefault, sortBySelection } from '../src/logic/sortTests';

const makeTest = (name, cancers) => ({ name, vendor: 'V', price: 100, source: '', cancers });

describe('sortDefault', () => {
  it('sorts by total cancer count descending', () => {
    const tests = [
      makeTest('Small', { Lung: 80 }),
      makeTest('Large', { Lung: 80, Breast: 60, Liver: 40 }),
      makeTest('Medium', { Lung: 80, Breast: 60 }),
    ];
    const sorted = sortDefault(tests);
    expect(sorted[0].name).toBe('Large');
    expect(sorted[1].name).toBe('Medium');
    expect(sorted[2].name).toBe('Small');
  });

  it('breaks ties by count of >50% cancers', () => {
    const tests = [
      makeTest('B', { Lung: 30, Breast: 40 }),   // 0 greens
      makeTest('A', { Lung: 80, Breast: 60 }),    // 2 greens
    ];
    const sorted = sortDefault(tests);
    expect(sorted[0].name).toBe('A');
  });

  it('puts empty-data tests last', () => {
    const tests = [
      makeTest('Empty', {}),
      makeTest('HasData', { Lung: 80 }),
    ];
    const sorted = sortDefault(tests);
    expect(sorted[0].name).toBe('HasData');
    expect(sorted[1].name).toBe('Empty');
  });
});

describe('sortBySelection', () => {
  it('sorts by green count descending', () => {
    const tests = [
      makeTest('A', { Lung: 30, Breast: 20 }),       // 0 green
      makeTest('B', { Lung: 80, Breast: 60 }),        // 2 green
      makeTest('C', { Lung: 80, Breast: 20 }),        // 1 green
    ];
    const sorted = sortBySelection(tests, ['Lung', 'Breast']);
    expect(sorted[0].name).toBe('B');
    expect(sorted[1].name).toBe('C');
    expect(sorted[2].name).toBe('A');
  });

  it('puts no-data tests at bottom', () => {
    const tests = [
      makeTest('Empty', {}),
      makeTest('Has', { Lung: 80 }),
    ];
    const sorted = sortBySelection(tests, ['Lung']);
    expect(sorted[0].name).toBe('Has');
    expect(sorted[1].name).toBe('Empty');
  });

  it('breaks ties with amber count', () => {
    const tests = [
      makeTest('A', { Lung: 80, Breast: 10 }),    // 1 green, 0 amber
      makeTest('B', { Lung: 80, Breast: 30 }),     // 1 green, 1 amber
    ];
    const sorted = sortBySelection(tests, ['Lung', 'Breast']);
    expect(sorted[0].name).toBe('B');
  });
});
