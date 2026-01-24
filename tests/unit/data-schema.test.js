/**
 * Data Schema Validation Tests
 *
 * These tests validate the structure of raw data exports from data.js
 * before they are processed by the DAL. This ensures data integrity
 * at the source level.
 */

import { describe, test, expect } from 'vitest';
import {
  VENDOR_ASSISTANCE_PROGRAMS,
  VENDOR_VERIFIED,
  COMPANY_CONTRIBUTIONS,
  DATABASE_CHANGELOG,
  GLOSSARY,
  INSURANCE_PROVIDERS,
} from '../../src/data.js';

describe('VENDOR_ASSISTANCE_PROGRAMS schema', () => {
  test('has required fields for all entries', () => {
    for (const [vendor, program] of Object.entries(VENDOR_ASSISTANCE_PROGRAMS)) {
      expect(program, `${vendor} missing hasProgram`).toHaveProperty('hasProgram');
      expect(program, `${vendor} missing tests`).toHaveProperty('tests');
      expect(program, `${vendor} missing lastVerified`).toHaveProperty('lastVerified');

      if (program.hasProgram) {
        expect(program, `${vendor} with program missing programName`).toHaveProperty('programName');
        expect(program, `${vendor} with program missing description`).toHaveProperty('description');
        expect(program, `${vendor} with program missing eligibility`).toHaveProperty('eligibility');
      }
    }
  });

  test('has at least 10 vendors with programs', () => {
    const vendorsWithPrograms = Object.entries(VENDOR_ASSISTANCE_PROGRAMS)
      .filter(([_, program]) => program.hasProgram);
    expect(vendorsWithPrograms.length).toBeGreaterThanOrEqual(10);
  });

  test('includes major vendors', () => {
    const vendorNames = Object.keys(VENDOR_ASSISTANCE_PROGRAMS);
    expect(vendorNames).toContain('Natera');
    expect(vendorNames).toContain('Guardant Health');
    expect(vendorNames).toContain('Foundation Medicine');
  });

  test('tests array contains valid test IDs', () => {
    for (const [vendor, program] of Object.entries(VENDOR_ASSISTANCE_PROGRAMS)) {
      expect(Array.isArray(program.tests), `${vendor}.tests should be array`).toBe(true);
      for (const testId of program.tests) {
        expect(typeof testId, `${vendor} test ID should be string`).toBe('string');
        expect(testId.length, `${vendor} test ID should not be empty`).toBeGreaterThan(0);
      }
    }
  });

  test('lastVerified is valid date format', () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const [vendor, program] of Object.entries(VENDOR_ASSISTANCE_PROGRAMS)) {
      expect(
        dateRegex.test(program.lastVerified),
        `${vendor}.lastVerified should be YYYY-MM-DD format`
      ).toBe(true);
    }
  });
});

describe('VENDOR_VERIFIED schema', () => {
  test('has required fields for all entries', () => {
    for (const [testId, verification] of Object.entries(VENDOR_VERIFIED)) {
      expect(verification, `${testId} missing name`).toHaveProperty('name');
      expect(verification, `${testId} missing company`).toHaveProperty('company');
      expect(verification, `${testId} missing verifiedDate`).toHaveProperty('verifiedDate');
    }
  });

  test('verifiedDate is valid date format', () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const [testId, verification] of Object.entries(VENDOR_VERIFIED)) {
      expect(
        dateRegex.test(verification.verifiedDate),
        `${testId}.verifiedDate should be YYYY-MM-DD format`
      ).toBe(true);
    }
  });
});

describe('COMPANY_CONTRIBUTIONS schema', () => {
  test('has required fields for all entries', () => {
    for (const [testId, contribution] of Object.entries(COMPANY_CONTRIBUTIONS)) {
      expect(contribution, `${testId} missing name`).toHaveProperty('name');
      expect(contribution, `${testId} missing company`).toHaveProperty('company');
      expect(contribution, `${testId} missing date`).toHaveProperty('date');
    }
  });

  test('date is valid date format', () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const [testId, contribution] of Object.entries(COMPANY_CONTRIBUTIONS)) {
      expect(
        dateRegex.test(contribution.date),
        `${testId}.date should be YYYY-MM-DD format`
      ).toBe(true);
    }
  });
});

describe('DATABASE_CHANGELOG schema', () => {
  test('is an array', () => {
    expect(Array.isArray(DATABASE_CHANGELOG)).toBe(true);
  });

  test('has entries', () => {
    expect(DATABASE_CHANGELOG.length).toBeGreaterThan(0);
  });

  test('entries have required fields', () => {
    // Check first 10 entries as a sample
    const sample = DATABASE_CHANGELOG.slice(0, 10);
    for (const entry of sample) {
      expect(entry).toHaveProperty('date');
      expect(entry).toHaveProperty('type');
      expect(entry).toHaveProperty('description');
    }
  });
});

describe('GLOSSARY schema', () => {
  test('is an object with terms', () => {
    expect(typeof GLOSSARY).toBe('object');
    expect(Object.keys(GLOSSARY).length).toBeGreaterThan(0);
  });

  test('terms have required fields', () => {
    for (const [key, term] of Object.entries(GLOSSARY)) {
      expect(term, `${key} missing term`).toHaveProperty('term');
      expect(term, `${key} missing definition`).toHaveProperty('definition');
      expect(term, `${key} missing source`).toHaveProperty('source');
      expect(term, `${key} missing sourceUrl`).toHaveProperty('sourceUrl');
    }
  });
});

describe('INSURANCE_PROVIDERS schema', () => {
  test('is an object with provider categories', () => {
    expect(typeof INSURANCE_PROVIDERS).toBe('object');
    expect(Object.keys(INSURANCE_PROVIDERS).length).toBeGreaterThan(0);
  });

  test('has expected categories', () => {
    expect(INSURANCE_PROVIDERS).toHaveProperty('government');
    expect(INSURANCE_PROVIDERS).toHaveProperty('national');
    expect(INSURANCE_PROVIDERS).toHaveProperty('regional');
  });

  test('providers in each category have required fields', () => {
    for (const [category, providers] of Object.entries(INSURANCE_PROVIDERS)) {
      expect(Array.isArray(providers), `${category} should be an array`).toBe(true);
      for (const provider of providers) {
        expect(provider, `${category} provider missing id`).toHaveProperty('id');
        expect(provider, `${category} provider missing label`).toHaveProperty('label');
      }
    }
  });
});
