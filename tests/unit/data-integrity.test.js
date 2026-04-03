/**
 * Data Integrity Tests
 *
 * Validates cross-cutting invariants across test data and config:
 * - No duplicate test IDs within or across categories
 * - Vendor names in data.js match keys in vendors.js
 */

import { describe, test, expect } from 'vitest';
import {
  mrdTestData,
  ecdTestData,
  trmTestData,
  hctTestData,
} from '../../src/data.js';
import { cgpTestData } from '../../src/data.js';
import {
  VENDOR_AVAILABILITY_US,
  VENDOR_BADGES,
} from '../../src/config/vendors.js';

const ALL_CATEGORIES = {
  mrd: mrdTestData,
  ecd: ecdTestData,
  tds: cgpTestData,
  hct: hctTestData,
};

// trmTestData is an empty array re-export, skip if empty
if (trmTestData.length > 0) {
  ALL_CATEGORIES.trm = trmTestData;
}

// Flatten all tests with their category for better error messages
const allTests = Object.entries(ALL_CATEGORIES).flatMap(([cat, tests]) =>
  tests.map((t) => ({ ...t, _category: cat }))
);

describe('No duplicate test IDs', () => {
  test('IDs are unique within each category', () => {
    for (const [category, tests] of Object.entries(ALL_CATEGORIES)) {
      const ids = tests.map((t) => t.id);
      const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(
        duplicates,
        `Duplicate IDs in ${category}: ${duplicates.join(', ')}`
      ).toEqual([]);
    }
  });

  test('IDs are unique across all categories', () => {
    const ids = allTests.map((t) => t.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(
      duplicates,
      `Duplicate IDs across categories: ${duplicates.join(', ')}`
    ).toEqual([]);
  });
});

describe('Vendor name consistency', () => {
  // Collect all unique vendor names from test data
  const vendorsInData = [...new Set(allTests.map((t) => t.vendor).filter(Boolean))];

  test('every vendor in VENDOR_AVAILABILITY_US exists in test data', () => {
    const availabilityVendors = Object.keys(VENDOR_AVAILABILITY_US);
    const missing = availabilityVendors.filter((v) => !vendorsInData.includes(v));
    expect(
      missing,
      `VENDOR_AVAILABILITY_US references vendors not in test data: ${missing.join(', ')}`
    ).toEqual([]);
  });

  test('every vendor in VENDOR_BADGES exists in test data', () => {
    const badgeVendors = Object.keys(VENDOR_BADGES);
    const missing = badgeVendors.filter((v) => !vendorsInData.includes(v));
    expect(
      missing,
      `VENDOR_BADGES references vendors not in test data: ${missing.join(', ')}`
    ).toEqual([]);
  });
});

describe('Test data basic schema', () => {
  test('every test has an id and name', () => {
    for (const t of allTests) {
      expect(t.id, `Test missing id in ${t._category}`).toBeTruthy();
      expect(t.name, `Test ${t.id} missing name`).toBeTruthy();
    }
  });

  test('every test has a vendor', () => {
    for (const t of allTests) {
      expect(t.vendor, `Test ${t.id} missing vendor`).toBeTruthy();
    }
  });

  test('test IDs follow expected prefix pattern', () => {
    // mrdTestData contains both mrd- and trm- prefixed tests (shared array)
    const prefixMap = {
      mrd: ['mrd-', 'trm-'],
      ecd: ['ecd-'],
      tds: ['tds-'],
      hct: ['hct-'],
    };
    for (const t of allTests) {
      const allowedPrefixes = prefixMap[t._category];
      if (allowedPrefixes) {
        const valid = allowedPrefixes.some((p) => t.id.startsWith(p));
        expect(
          valid,
          `Test ${t.id} in ${t._category} should start with ${allowedPrefixes.join(' or ')}`
        ).toBe(true);
      }
    }
  });
});
