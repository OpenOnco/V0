import { describe, it, expect } from 'vitest';
import {
  parseSensitivityData,
  getTier,
  buildTrafficLight,
} from '../src/logic/buildTrafficLight';

describe('parseSensitivityData', () => {
  it('converts raw array to sensitivity map', () => {
    const raw = [
      { cancerType: 'Lung', overall: { detected: 302, total: 404 } },
      { cancerType: 'Breast', overall: { detected: 160, total: 524 } },
    ];
    const map = parseSensitivityData(raw);
    expect(map.Lung.sensitivity).toBeCloseTo(74.8, 0);
    expect(map.Lung.sampleSize).toBe(404);
    expect(map.Breast.sensitivity).toBeCloseTo(30.5, 0);
    expect(map.Breast.sampleSize).toBe(524);
  });

  it('canonicalizes cancer type names', () => {
    const raw = [
      { cancerType: 'Liver/Bile-duct', overall: { detected: 43, total: 46 } },
      { cancerType: 'Stomach', overall: { detected: 20, total: 30 } },
      { cancerType: 'Non-Hodgkin Lymphoma', overall: { detected: 4, total: 7 } },
    ];
    const map = parseSensitivityData(raw);
    expect(map.Liver).toBeDefined();
    expect(map.Gastric).toBeDefined();
    expect(map.Lymphoma).toBeDefined();
    expect(map['Liver/Bile-duct']).toBeUndefined();
    expect(map.Stomach).toBeUndefined();
  });

  it('keeps larger sample when aliases collide', () => {
    const raw = [
      { cancerType: 'Lymphoid Leukemia', overall: { detected: 21, total: 51 } },
      { cancerType: 'Myeloid Neoplasm', overall: { detected: 2, total: 10 } },
    ];
    const map = parseSensitivityData(raw);
    // Both map to Leukemia — should keep the one with larger total (51)
    expect(map.Leukemia.sampleSize).toBe(51);
  });

  it('returns empty object for null input', () => {
    expect(parseSensitivityData(null)).toEqual({});
    expect(parseSensitivityData(undefined)).toEqual({});
  });

  it('skips entries without overall data', () => {
    const raw = [
      { cancerType: 'Lung' }, // no overall
    ];
    const map = parseSensitivityData(raw);
    expect(Object.keys(map)).toHaveLength(0);
  });
});

describe('getTier', () => {
  it('returns good for >50%', () => {
    expect(getTier(50.1, 100)).toBe('good');
    expect(getTier(75, 50)).toBe('good');
  });

  it('returns ok for 25-50%', () => {
    expect(getTier(50, 100)).toBe('ok');
    expect(getTier(25, 100)).toBe('ok');
    expect(getTier(37.5, 100)).toBe('ok');
  });

  it('returns bad for <25%', () => {
    expect(getTier(24.9, 100)).toBe('bad');
    expect(getTier(5, 100)).toBe('bad');
  });

  it('returns no-data for null sensitivity', () => {
    expect(getTier(null, 100)).toBe('no-data');
  });

  it('returns no-data for small sample size', () => {
    expect(getTier(90, 4)).toBe('no-data');
    expect(getTier(90, 3)).toBe('no-data');
  });

  it('accepts sample size of exactly 5', () => {
    expect(getTier(90, 5)).toBe('good');
  });
});

describe('buildTrafficLight', () => {
  const testWithData = {
    cancerTypeSensitivity: [
      { cancerType: 'Lung', overall: { detected: 302, total: 404 } },     // 74.8% → good
      { cancerType: 'Breast', overall: { detected: 160, total: 524 } },   // 30.5% → ok
      { cancerType: 'Kidney', overall: { detected: 18, total: 99 } },     // 18.2% → bad
    ],
  };

  const testWithoutData = {
    cancerTypeSensitivity: null,
  };

  it('builds concern rows with correct tiers', () => {
    const { concernRows } = buildTrafficLight(
      testWithData,
      ['Lung', 'Breast', 'Kidney'],
      []
    );
    expect(concernRows).toHaveLength(3);
    expect(concernRows[0]).toEqual(
      expect.objectContaining({ cancer: 'Lung', tier: 'good' })
    );
    expect(concernRows[1]).toEqual(
      expect.objectContaining({ cancer: 'Breast', tier: 'ok' })
    );
    expect(concernRows[2]).toEqual(
      expect.objectContaining({ cancer: 'Kidney', tier: 'bad' })
    );
  });

  it('marks cancers not in test data as no-data', () => {
    const { concernRows } = buildTrafficLight(
      testWithData,
      ['Pancreas'],
      []
    );
    expect(concernRows[0].tier).toBe('no-data');
    expect(concernRows[0].sensitivity).toBeNull();
  });

  it('builds gap rows', () => {
    const { gapRows } = buildTrafficLight(
      testWithData,
      [],
      ['Breast']
    );
    expect(gapRows).toHaveLength(1);
    expect(gapRows[0].tier).toBe('ok');
  });

  it('returns hasAnySensitivityData=false for null data', () => {
    const { hasAnySensitivityData, concernRows } = buildTrafficLight(
      testWithoutData,
      ['Lung'],
      []
    );
    expect(hasAnySensitivityData).toBe(false);
    expect(concernRows[0].tier).toBe('no-data');
  });

  it('returns hasAnySensitivityData=true when data exists', () => {
    const { hasAnySensitivityData } = buildTrafficLight(
      testWithData,
      ['Lung'],
      []
    );
    expect(hasAnySensitivityData).toBe(true);
  });

  it('excludes small sample size entries', () => {
    const test = {
      cancerTypeSensitivity: [
        { cancerType: 'Testis', overall: { detected: 1, total: 2 } }, // n=2 < 5
      ],
    };
    const { concernRows } = buildTrafficLight(test, ['Testis'], []);
    expect(concernRows[0].tier).toBe('no-data');
  });
});
