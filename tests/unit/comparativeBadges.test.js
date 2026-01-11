/**
 * Unit tests for comparativeBadges utility
 */

import { describe, it, expect, vi } from 'vitest';
import { calculateComparativeBadges } from '../../src/utils/comparativeBadges';

// Mock the MINIMUM_PARAMS config
vi.mock('../../src/config/testFields', () => ({
  MINIMUM_PARAMS: {
    MRD: {
      core: [
        { key: 'sensitivity', label: 'Sensitivity' },
        { key: 'specificity', label: 'Specificity' },
        { key: 'lod', label: 'Limit of Detection' },
        { key: 'numPublications', label: 'Publications' },
        { key: 'totalParticipants', label: 'Study Participants' },
        { key: 'initialTat', label: 'Initial TAT' },
        { key: 'fdaStatus', label: 'FDA Status' },
        { key: 'reimbursement', label: 'Medicare Coverage' },
      ]
    },
    ECD: {
      core: [
        { key: 'sensitivity', label: 'Sensitivity' },
        { key: 'specificity', label: 'Specificity' },
        { key: 'ppv', label: 'PPV' },
        { key: 'npv', label: 'NPV' },
        { key: 'numPublications', label: 'Publications' },
        { key: 'tat', label: 'Turnaround Time' },
        { key: 'fdaStatus', label: 'FDA Status' },
      ]
    }
  }
}));

describe('calculateComparativeBadges', () => {
  it('returns empty badges for single test', () => {
    const tests = [
      { name: 'Test A', sensitivity: 95, specificity: 99 }
    ];

    const result = calculateComparativeBadges(tests, 'mrd');

    expect(result).toHaveLength(1);
    expect(result[0].comparativeBadges).toEqual([]);
  });

  it('returns empty badges for empty array', () => {
    const result = calculateComparativeBadges([], 'mrd');

    expect(result).toEqual([]);
  });

  it("awards 'Highest Sensitivity' to test with highest sensitivity", () => {
    const tests = [
      { name: 'Test A', sensitivity: 95 },
      { name: 'Test B', sensitivity: 90 },
      { name: 'Test C', sensitivity: 85 }
    ];

    const result = calculateComparativeBadges(tests, 'mrd');

    const testA = result.find(t => t.name === 'Test A');
    const testB = result.find(t => t.name === 'Test B');
    const testC = result.find(t => t.name === 'Test C');

    expect(testA.comparativeBadges).toContain('Highest Sensitivity');
    expect(testB.comparativeBadges).not.toContain('Highest Sensitivity');
    expect(testC.comparativeBadges).not.toContain('Highest Sensitivity');
  });

  it("awards 'Best Detection Limit' to test with lowest LOD", () => {
    const tests = [
      { name: 'Test A', lod: '0.01%' },
      { name: 'Test B', lod: '0.1%' },
      { name: 'Test C', lod: '1%' }
    ];

    const result = calculateComparativeBadges(tests, 'mrd');

    const testA = result.find(t => t.name === 'Test A');
    const testB = result.find(t => t.name === 'Test B');
    const testC = result.find(t => t.name === 'Test C');

    expect(testA.comparativeBadges).toContain('Best Detection Limit');
    expect(testB.comparativeBadges).not.toContain('Best Detection Limit');
    expect(testC.comparativeBadges).not.toContain('Best Detection Limit');
  });

  it('handles ties by awarding badge to both tests', () => {
    const tests = [
      { name: 'Test A', sensitivity: 95 },
      { name: 'Test B', sensitivity: 95 },
      { name: 'Test C', sensitivity: 85 }
    ];

    const result = calculateComparativeBadges(tests, 'mrd');

    const testA = result.find(t => t.name === 'Test A');
    const testB = result.find(t => t.name === 'Test B');
    const testC = result.find(t => t.name === 'Test C');

    expect(testA.comparativeBadges).toContain('Highest Sensitivity');
    expect(testB.comparativeBadges).toContain('Highest Sensitivity');
    expect(testC.comparativeBadges).not.toContain('Highest Sensitivity');
  });

  it('handles missing data gracefully', () => {
    const tests = [
      { name: 'Test A', sensitivity: 95 },
      { name: 'Test B' }, // No sensitivity data
      { name: 'Test C', sensitivity: null }
    ];

    const result = calculateComparativeBadges(tests, 'mrd');

    // Should not throw and should still calculate badges for tests with data
    expect(result).toHaveLength(3);
    const testA = result.find(t => t.name === 'Test A');
    // Test A should not get badge since there's only one test with valid data
    expect(testA.comparativeBadges).toEqual([]);
  });

  it("awards 'FDA Cleared' badge appropriately", () => {
    const tests = [
      { name: 'Test A', fdaStatus: 'FDA Approved', sensitivity: 90 },
      { name: 'Test B', fdaStatus: 'LDT', sensitivity: 95 },
      { name: 'Test C', fdaStatus: '510(k) Cleared', sensitivity: 85 }
    ];

    const result = calculateComparativeBadges(tests, 'mrd');

    const testA = result.find(t => t.name === 'Test A');
    const testB = result.find(t => t.name === 'Test B');
    const testC = result.find(t => t.name === 'Test C');

    expect(testA.comparativeBadges).toContain('FDA Cleared');
    expect(testB.comparativeBadges).not.toContain('FDA Cleared');
    expect(testC.comparativeBadges).toContain('FDA Cleared');
  });

  it("awards 'Medicare Covered' badge appropriately", () => {
    const tests = [
      { name: 'Test A', reimbursement: 'Medicare covered', sensitivity: 90 },
      { name: 'Test B', reimbursement: 'No coverage', sensitivity: 95 },
      { name: 'Test C', reimbursement: 'Medicare approved for specific indications', sensitivity: 85 }
    ];

    const result = calculateComparativeBadges(tests, 'mrd');

    const testA = result.find(t => t.name === 'Test A');
    const testB = result.find(t => t.name === 'Test B');
    const testC = result.find(t => t.name === 'Test C');

    expect(testA.comparativeBadges).toContain('Medicare Covered');
    expect(testB.comparativeBadges).not.toContain('Medicare Covered');
    expect(testC.comparativeBadges).toContain('Medicare Covered');
  });

  it('handles null/undefined tests array', () => {
    const resultNull = calculateComparativeBadges(null, 'mrd');
    const resultUndefined = calculateComparativeBadges(undefined, 'mrd');

    expect(resultNull).toEqual([]);
    expect(resultUndefined).toEqual([]);
  });

  it('handles LOD values in different formats', () => {
    const tests = [
      { name: 'Test A', lod: '6 ppm' },
      { name: 'Test B', lod: '10 ppm' },
      { name: 'Test C', lod: '0.001%' }
    ];

    const result = calculateComparativeBadges(tests, 'mrd');

    // Lower is better for LOD, 6 ppm < 10 ppm
    const testA = result.find(t => t.name === 'Test A');
    expect(testA.comparativeBadges).toContain('Best Detection Limit');
  });

  it('awards multiple badges to a single test', () => {
    const tests = [
      { name: 'Test A', sensitivity: 99, specificity: 99, lod: '0.001%', fdaStatus: 'FDA Approved' },
      { name: 'Test B', sensitivity: 85, specificity: 85, lod: '1%', fdaStatus: 'LDT' }
    ];

    const result = calculateComparativeBadges(tests, 'mrd');

    const testA = result.find(t => t.name === 'Test A');

    expect(testA.comparativeBadges).toContain('Highest Sensitivity');
    expect(testA.comparativeBadges).toContain('Highest Specificity');
    expect(testA.comparativeBadges).toContain('Best Detection Limit');
    expect(testA.comparativeBadges).toContain('FDA Cleared');
  });

  it('uses category-specific parameters', () => {
    const tests = [
      { name: 'Test A', ppv: 90, npv: 95 },
      { name: 'Test B', ppv: 85, npv: 90 }
    ];

    // ECD category includes ppv and npv
    const result = calculateComparativeBadges(tests, 'ecd');

    const testA = result.find(t => t.name === 'Test A');

    expect(testA.comparativeBadges).toContain('Highest PPV');
    expect(testA.comparativeBadges).toContain('Highest NPV');
  });
});
