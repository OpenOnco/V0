import { describe, it, expect } from 'vitest';
import { buildConcernList } from '../src/logic/buildConcernList';

describe('buildConcernList', () => {
  it('returns empty array when no concerns', () => {
    const form = {
      familyHistory: [],
      smokingStatus: 'never',
      personalCancerDiagnosis: false,
      continueAfterDiagnosis: false,
      personalCancerType: '',
    };
    expect(buildConcernList(form)).toEqual([]);
  });

  it('includes family history selections', () => {
    const form = {
      familyHistory: ['Lung', 'Breast'],
      smokingStatus: 'never',
      personalCancerDiagnosis: false,
      continueAfterDiagnosis: false,
      personalCancerType: '',
    };
    const result = buildConcernList(form);
    expect(result).toContain('Lung');
    expect(result).toContain('Breast');
  });

  it('adds smoking cancers for former smokers', () => {
    const form = {
      familyHistory: [],
      smokingStatus: 'former',
      personalCancerDiagnosis: false,
      continueAfterDiagnosis: false,
      personalCancerType: '',
    };
    const result = buildConcernList(form);
    expect(result).toContain('Lung');
    expect(result).toContain('Bladder');
    expect(result).toContain('Pancreas');
    expect(result).toContain('Head and Neck');
    expect(result).toContain('Kidney');
    expect(result).toContain('Esophagus');
  });

  it('adds smoking cancers for current smokers', () => {
    const form = {
      familyHistory: [],
      smokingStatus: 'current',
      personalCancerDiagnosis: false,
      continueAfterDiagnosis: false,
      personalCancerType: '',
    };
    expect(buildConcernList(form).length).toBe(6);
  });

  it('does not add smoking cancers for never smokers', () => {
    const form = {
      familyHistory: [],
      smokingStatus: 'never',
      personalCancerDiagnosis: false,
      continueAfterDiagnosis: false,
      personalCancerType: '',
    };
    expect(buildConcernList(form)).toEqual([]);
  });

  it('includes personal cancer history when user continues', () => {
    const form = {
      familyHistory: [],
      smokingStatus: 'never',
      personalCancerDiagnosis: true,
      continueAfterDiagnosis: true,
      personalCancerType: 'Ovary',
    };
    expect(buildConcernList(form)).toEqual(['Ovary']);
  });

  it('excludes personal history when user did not continue', () => {
    const form = {
      familyHistory: [],
      smokingStatus: 'never',
      personalCancerDiagnosis: true,
      continueAfterDiagnosis: false,
      personalCancerType: 'Ovary',
    };
    expect(buildConcernList(form)).toEqual([]);
  });

  it('deduplicates across sources', () => {
    const form = {
      familyHistory: ['Lung', 'Pancreas'],
      smokingStatus: 'current',
      personalCancerDiagnosis: false,
      continueAfterDiagnosis: false,
      personalCancerType: '',
    };
    const result = buildConcernList(form);
    const lungCount = result.filter((c) => c === 'Lung').length;
    expect(lungCount).toBe(1);
  });

  it('returns sorted results', () => {
    const form = {
      familyHistory: ['Pancreas', 'Breast', 'Anus'],
      smokingStatus: 'never',
      personalCancerDiagnosis: false,
      continueAfterDiagnosis: false,
      personalCancerType: '',
    };
    expect(buildConcernList(form)).toEqual(['Anus', 'Breast', 'Pancreas']);
  });
});
