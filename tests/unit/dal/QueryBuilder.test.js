/**
 * Unit tests for DAL QueryBuilder
 */

import { describe, it, expect } from 'vitest';
import {
  matchesWhere,
  applyOrderBy,
  applySelect,
  applyPagination,
  buildResult,
} from '../../../src/dal/QueryBuilder.js';

describe('QueryBuilder', () => {
  const testRecords = [
    { id: 1, name: 'Alice', age: 30, tags: ['a', 'b'] },
    { id: 2, name: 'Bob', age: 25, tags: ['b', 'c'] },
    { id: 3, name: 'Charlie', age: 35, tags: ['a', 'c'] },
  ];

  describe('matchesWhere', () => {
    it('returns true for empty where clause', () => {
      expect(matchesWhere(testRecords[0], {})).toBe(true);
      expect(matchesWhere(testRecords[0], null)).toBe(true);
    });

    it('matches direct value comparison', () => {
      expect(matchesWhere(testRecords[0], { name: 'Alice' })).toBe(true);
      expect(matchesWhere(testRecords[0], { name: 'Bob' })).toBe(false);
    });

    it('matches with operators', () => {
      expect(matchesWhere(testRecords[0], { age: { gt: 25 } })).toBe(true);
      expect(matchesWhere(testRecords[0], { age: { lt: 25 } })).toBe(false);
      expect(matchesWhere(testRecords[0], { name: { contains: 'lic' } })).toBe(true);
    });

    it('handles AND logical operator', () => {
      expect(matchesWhere(testRecords[0], {
        AND: [
          { name: 'Alice' },
          { age: { gte: 30 } },
        ],
      })).toBe(true);

      expect(matchesWhere(testRecords[0], {
        AND: [
          { name: 'Alice' },
          { age: { gt: 30 } },
        ],
      })).toBe(false);
    });

    it('handles OR logical operator', () => {
      expect(matchesWhere(testRecords[1], {
        OR: [
          { name: 'Alice' },
          { name: 'Bob' },
        ],
      })).toBe(true);

      expect(matchesWhere(testRecords[2], {
        OR: [
          { name: 'Alice' },
          { name: 'Bob' },
        ],
      })).toBe(false);
    });

    it('handles NOT logical operator', () => {
      expect(matchesWhere(testRecords[0], {
        NOT: { name: 'Bob' },
      })).toBe(true);

      expect(matchesWhere(testRecords[1], {
        NOT: { name: 'Bob' },
      })).toBe(false);
    });

    it('matches array fields with hasAny', () => {
      expect(matchesWhere(testRecords[0], { tags: { hasAny: ['a', 'd'] } })).toBe(true);
      expect(matchesWhere(testRecords[0], { tags: { hasAny: ['d', 'e'] } })).toBe(false);
    });
  });

  describe('applyOrderBy', () => {
    it('sorts by single field ascending', () => {
      const sorted = applyOrderBy(testRecords, { age: 'asc' });
      expect(sorted.map(r => r.name)).toEqual(['Bob', 'Alice', 'Charlie']);
    });

    it('sorts by single field descending', () => {
      const sorted = applyOrderBy(testRecords, { age: 'desc' });
      expect(sorted.map(r => r.name)).toEqual(['Charlie', 'Alice', 'Bob']);
    });

    it('handles null orderBy', () => {
      const result = applyOrderBy(testRecords, null);
      expect(result).toEqual(testRecords);
    });

    it('sorts by string field', () => {
      const sorted = applyOrderBy(testRecords, { name: 'asc' });
      expect(sorted.map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('does not mutate original array', () => {
      const original = [...testRecords];
      applyOrderBy(testRecords, { age: 'desc' });
      expect(testRecords).toEqual(original);
    });
  });

  describe('applySelect', () => {
    it('selects specified fields', () => {
      const selected = applySelect(testRecords, { id: true, name: true });
      expect(selected[0]).toEqual({ id: 1, name: 'Alice' });
      expect(selected[0]).not.toHaveProperty('age');
    });

    it('returns all fields when select is empty', () => {
      const result = applySelect(testRecords, {});
      expect(result).toEqual(testRecords);
    });

    it('returns all fields when select is null', () => {
      const result = applySelect(testRecords, null);
      expect(result).toEqual(testRecords);
    });
  });

  describe('applyPagination', () => {
    it('applies skip correctly', () => {
      const result = applyPagination(testRecords, 1);
      expect(result.length).toBe(2);
      expect(result[0].name).toBe('Bob');
    });

    it('applies take correctly', () => {
      const result = applyPagination(testRecords, 0, 2);
      expect(result.length).toBe(2);
    });

    it('applies both skip and take', () => {
      const result = applyPagination(testRecords, 1, 1);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Bob');
    });
  });

  describe('buildResult', () => {
    it('builds result with metadata', () => {
      const result = buildResult(testRecords.slice(0, 2), 3, { skip: 0, take: 2 });
      expect(result.data.length).toBe(2);
      expect(result.meta.total).toBe(3);
      expect(result.meta.returned).toBe(2);
      expect(result.meta.hasMore).toBe(true);
    });

    it('hasMore is false when all items returned', () => {
      const result = buildResult(testRecords, 3, { skip: 0, take: 10 });
      expect(result.meta.hasMore).toBe(false);
    });
  });
});
