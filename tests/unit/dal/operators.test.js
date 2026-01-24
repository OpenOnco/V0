/**
 * Unit tests for DAL operators
 */

import { describe, it, expect } from 'vitest';
import {
  contains,
  equals,
  isIn,
  hasAny,
  hasAll,
  arrayContains,
  gt,
  gte,
  lt,
  lte,
  not,
  isNotNull,
  isNull,
  equalsInsensitive,
  startsWith,
  endsWith,
} from '../../../src/dal/operators.js';

describe('DAL Operators', () => {
  describe('contains', () => {
    it('returns true for case-insensitive substring match', () => {
      expect(contains('Hello World', 'world')).toBe(true);
      expect(contains('Hello World', 'HELLO')).toBe(true);
      expect(contains('Hello World', 'lo Wo')).toBe(true);
    });

    it('returns false for no match', () => {
      expect(contains('Hello World', 'foo')).toBe(false);
    });

    it('handles null values', () => {
      expect(contains(null, 'test')).toBe(false);
      expect(contains('test', null)).toBe(false);
    });
  });

  describe('equals', () => {
    it('returns true for strict equality', () => {
      expect(equals('test', 'test')).toBe(true);
      expect(equals(42, 42)).toBe(true);
      expect(equals(null, null)).toBe(true);
    });

    it('returns false for different values', () => {
      expect(equals('test', 'Test')).toBe(false);
      expect(equals(42, '42')).toBe(false);
    });
  });

  describe('isIn', () => {
    it('returns true when value is in array', () => {
      expect(isIn('a', ['a', 'b', 'c'])).toBe(true);
      expect(isIn(2, [1, 2, 3])).toBe(true);
    });

    it('returns false when value is not in array', () => {
      expect(isIn('d', ['a', 'b', 'c'])).toBe(false);
    });

    it('handles invalid inputs', () => {
      expect(isIn('a', null)).toBe(false);
      expect(isIn('a', 'abc')).toBe(false);
    });
  });

  describe('hasAny', () => {
    it('returns true when array has any target values', () => {
      expect(hasAny(['a', 'b', 'c'], ['a', 'd'])).toBe(true);
      expect(hasAny(['a', 'b', 'c'], ['d', 'c'])).toBe(true);
    });

    it('returns false when no overlap', () => {
      expect(hasAny(['a', 'b', 'c'], ['d', 'e'])).toBe(false);
    });

    it('handles invalid inputs', () => {
      expect(hasAny('abc', ['a'])).toBe(false);
      expect(hasAny(['a'], 'a')).toBe(false);
    });
  });

  describe('hasAll', () => {
    it('returns true when array has all target values', () => {
      expect(hasAll(['a', 'b', 'c'], ['a', 'b'])).toBe(true);
      expect(hasAll(['a', 'b', 'c'], ['a'])).toBe(true);
    });

    it('returns false when missing some targets', () => {
      expect(hasAll(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    });
  });

  describe('arrayContains', () => {
    it('returns true for case-insensitive array match', () => {
      expect(arrayContains(['Colon', 'Breast'], 'colon')).toBe(true);
      expect(arrayContains(['Colon', 'Breast'], 'BREAST')).toBe(true);
    });

    it('returns true for partial match', () => {
      expect(arrayContains(['Colorectal', 'Breast'], 'color')).toBe(true);
    });

    it('returns false for no match', () => {
      expect(arrayContains(['Colon', 'Breast'], 'lung')).toBe(false);
    });
  });

  describe('numeric comparisons', () => {
    it('gt works correctly', () => {
      expect(gt(5, 3)).toBe(true);
      expect(gt(3, 5)).toBe(false);
      expect(gt('5', 3)).toBe(true);
    });

    it('gte works correctly', () => {
      expect(gte(5, 5)).toBe(true);
      expect(gte(5, 3)).toBe(true);
      expect(gte(3, 5)).toBe(false);
    });

    it('lt works correctly', () => {
      expect(lt(3, 5)).toBe(true);
      expect(lt(5, 3)).toBe(false);
    });

    it('lte works correctly', () => {
      expect(lte(5, 5)).toBe(true);
      expect(lte(3, 5)).toBe(true);
      expect(lte(5, 3)).toBe(false);
    });

    it('handles invalid numeric values', () => {
      expect(gt('not a number', 5)).toBe(false);
      expect(lt(null, 5)).toBe(false);
    });
  });

  describe('not', () => {
    it('returns true for different values', () => {
      expect(not('a', 'b')).toBe(true);
      expect(not(null, 'a')).toBe(true);
    });

    it('returns false for equal values', () => {
      expect(not('a', 'a')).toBe(false);
    });
  });

  describe('isNotNull / isNull', () => {
    it('isNotNull works correctly', () => {
      expect(isNotNull('value')).toBe(true);
      expect(isNotNull(0)).toBe(true);
      expect(isNotNull('')).toBe(true);
      expect(isNotNull(null)).toBe(false);
      expect(isNotNull(undefined)).toBe(false);
    });

    it('isNull works correctly', () => {
      expect(isNull(null)).toBe(true);
      expect(isNull(undefined)).toBe(true);
      expect(isNull('')).toBe(false);
    });
  });

  describe('equalsInsensitive', () => {
    it('compares case-insensitively', () => {
      expect(equalsInsensitive('Test', 'test')).toBe(true);
      expect(equalsInsensitive('TEST', 'test')).toBe(true);
      expect(equalsInsensitive('test', 'other')).toBe(false);
    });
  });

  describe('startsWith', () => {
    it('checks prefix case-insensitively', () => {
      expect(startsWith('Hello World', 'hello')).toBe(true);
      expect(startsWith('Hello World', 'HELLO')).toBe(true);
      expect(startsWith('Hello World', 'world')).toBe(false);
    });
  });

  describe('endsWith', () => {
    it('checks suffix case-insensitively', () => {
      expect(endsWith('Hello World', 'world')).toBe(true);
      expect(endsWith('Hello World', 'WORLD')).toBe(true);
      expect(endsWith('Hello World', 'hello')).toBe(false);
    });
  });
});
