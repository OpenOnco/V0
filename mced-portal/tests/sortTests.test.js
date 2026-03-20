import { describe, it, expect } from 'vitest';
import { sortTests, sortByTotalCancers } from '../src/logic/sortTests';

const makeTest = (id, name, cancerTypeSensitivity, detectedCount = 10) => ({
  id,
  name,
  vendor: 'Test',
  detectedCancerTypes: Array(detectedCount).fill('X'),
  cancerTypeSensitivity,
});

// Sensitivity data: detected/total → sensitivity %
const lungGood = { cancerType: 'Lung', overall: { detected: 75, total: 100 } };     // 75% → good
const lungBad = { cancerType: 'Lung', overall: { detected: 10, total: 100 } };      // 10% → bad
const breastOk = { cancerType: 'Breast', overall: { detected: 35, total: 100 } };   // 35% → ok
const breastGood = { cancerType: 'Breast', overall: { detected: 60, total: 100 } }; // 60% → good
const kidneyBad = { cancerType: 'Kidney', overall: { detected: 15, total: 100 } };  // 15% → bad

describe('sortTests', () => {
  it('sorts by green count descending', () => {
    const tests = [
      makeTest('a', 'A', [lungBad, breastOk]),        // 0 green
      makeTest('b', 'B', [lungGood, breastGood]),      // 2 green
      makeTest('c', 'C', [lungGood, breastOk]),        // 1 green
    ];
    const sorted = sortTests(tests, ['Lung', 'Breast'], []);
    expect(sorted[0].test.id).toBe('b'); // 2 green
    expect(sorted[1].test.id).toBe('c'); // 1 green
    expect(sorted[2].test.id).toBe('a'); // 0 green
  });

  it('breaks ties with amber count', () => {
    const tests = [
      makeTest('a', 'A', [lungGood, kidneyBad]),     // 1 green, 0 amber
      makeTest('b', 'B', [lungGood, breastOk]),       // 1 green, 1 amber
    ];
    const sorted = sortTests(tests, ['Lung', 'Breast', 'Kidney'], []);
    expect(sorted[0].test.id).toBe('b'); // same green, more amber
    expect(sorted[1].test.id).toBe('a');
  });

  it('tests without sensitivity data sort to bottom', () => {
    const tests = [
      makeTest('no-data', 'No Data', null),
      makeTest('has-data', 'Has Data', [lungGood]),
    ];
    const sorted = sortTests(tests, ['Lung'], []);
    expect(sorted[0].test.id).toBe('has-data');
    expect(sorted[1].test.id).toBe('no-data');
  });

  it('includes screening gaps in sorting', () => {
    const tests = [
      makeTest('a', 'A', [lungGood]),                                  // Lung good, Colon/Rectum no-data
      makeTest('b', 'B', [lungGood, { cancerType: 'Colon/Rectum', overall: { detected: 80, total: 100 } }]),
    ];
    const sorted = sortTests(tests, ['Lung'], ['Colon/Rectum']);
    expect(sorted[0].test.id).toBe('b'); // 2 green vs 1 green
  });

  it('handles empty concern + gap lists', () => {
    const tests = [
      makeTest('a', 'A', [lungGood]),
      makeTest('b', 'B', [lungGood]),
    ];
    const sorted = sortTests(tests, [], []);
    expect(sorted).toHaveLength(2);
  });
});

describe('sortByTotalCancers', () => {
  it('sorts by detectedCancerTypes length descending', () => {
    const tests = [
      makeTest('small', 'Small', null, 5),
      makeTest('large', 'Large', null, 20),
      makeTest('medium', 'Medium', null, 12),
    ];
    const sorted = sortByTotalCancers(tests);
    expect(sorted[0].id).toBe('large');
    expect(sorted[1].id).toBe('medium');
    expect(sorted[2].id).toBe('small');
  });
});
