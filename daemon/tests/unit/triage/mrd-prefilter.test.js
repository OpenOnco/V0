import { describe, it, expect } from 'vitest';
import { prefilter, batchPrefilter, getPrefilterStats } from '../../../src/triage/mrd-prefilter.js';

describe('MRD Pre-filter', () => {
  describe('prefilter', () => {
    it('passes articles with MRD keywords', () => {
      const result = prefilter(
        'Circulating tumor DNA as a marker for minimal residual disease',
        'This study evaluates ctDNA in colorectal cancer surveillance...'
      );
      expect(result.passes).toBe(true);
      expect(result.score).toBeGreaterThan(5);
    });

    it('rejects hematologic malignancies', () => {
      const result = prefilter(
        'MRD in acute lymphoblastic leukemia',
        'Flow cytometry for MRD detection in ALL patients...'
      );
      expect(result.passes).toBe(false);
      expect(result.reason).toContain('leukemia');
    });

    it('rejects lymphoma articles', () => {
      const result = prefilter(
        'Minimal residual disease monitoring in lymphoma',
        'Assessment of treatment response in diffuse large B-cell lymphoma...'
      );
      expect(result.passes).toBe(false);
      expect(result.reason).toContain('lymphoma');
    });

    it('rejects myeloma articles', () => {
      const result = prefilter(
        'ctDNA detection in multiple myeloma',
        'Liquid biopsy approaches for myeloma surveillance...'
      );
      expect(result.passes).toBe(false);
      expect(result.reason).toContain('myeloma');
    });

    it('rejects articles without MRD terms', () => {
      const result = prefilter(
        'Surgical techniques for colon cancer',
        'This review covers laparoscopic approaches...'
      );
      expect(result.passes).toBe(false);
      expect(result.reason).toContain('No primary MRD terms');
    });

    it('passes ctDNA articles', () => {
      const result = prefilter(
        'ctDNA monitoring for recurrence detection',
        'Postoperative ctDNA analysis in breast cancer patients...'
      );
      expect(result.passes).toBe(true);
    });

    it('passes liquid biopsy articles', () => {
      const result = prefilter(
        'Liquid biopsy for colorectal cancer surveillance',
        'This study evaluates serial liquid biopsy for recurrence detection...'
      );
      expect(result.passes).toBe(true);
    });

    it('gives higher score for solid tumor mentions', () => {
      const withTumor = prefilter(
        'ctDNA in colorectal cancer MRD',
        'Postoperative surveillance in stage III colon cancer...'
      );
      const withoutTumor = prefilter(
        'ctDNA for MRD detection',
        'Generic surveillance approaches...'
      );
      expect(withTumor.score).toBeGreaterThan(withoutTumor.score);
    });

    it('gives higher score for context terms', () => {
      const withContext = prefilter(
        'ctDNA for adjuvant therapy monitoring',
        'Postoperative surveillance after curative resection...'
      );
      const minimal = prefilter(
        'ctDNA detection method',
        'Technical validation study...'
      );
      expect(withContext.score).toBeGreaterThan(minimal.score);
    });
  });

  describe('batchPrefilter', () => {
    it('handles batch filtering', () => {
      const articles = [
        { title: 'ctDNA monitoring in breast cancer', abstract: 'Liquid biopsy surveillance...' },
        { title: 'Radiation therapy protocols', abstract: 'Dosing guidelines...' },
        { title: 'Signatera for MRD detection', abstract: 'Colorectal cancer post-surgery...' },
      ];
      const { passed, rejected } = batchPrefilter(articles);
      expect(passed.length).toBe(2);
      expect(rejected.length).toBe(1);
    });

    it('includes prefilter score on passed articles', () => {
      const articles = [
        { title: 'Minimal residual disease in colorectal cancer', abstract: 'ctDNA surveillance after surgery...' },
      ];
      const { passed } = batchPrefilter(articles);
      expect(passed[0].prefilterScore).toBeDefined();
      expect(passed[0].prefilterReason).toBeDefined();
    });

    it('includes rejection reason on rejected articles', () => {
      const articles = [
        { title: 'MRD in acute myeloid leukemia', abstract: 'Flow cytometry analysis...' },
      ];
      const { rejected } = batchPrefilter(articles);
      expect(rejected[0].prefilterReason).toContain('leukemia');
    });

    it('handles empty input', () => {
      const { passed, rejected } = batchPrefilter([]);
      expect(passed).toEqual([]);
      expect(rejected).toEqual([]);
    });
  });

  describe('getPrefilterStats', () => {
    it('returns correct stats', () => {
      const articles = [
        { title: 'ctDNA in colorectal cancer', abstract: 'MRD detection...' },
        { title: 'Unrelated surgery paper', abstract: 'Technical notes...' },
        { title: 'Liquid biopsy for lung cancer', abstract: 'NSCLC surveillance...' },
        { title: 'MRD in leukemia', abstract: 'Hematologic malignancy...' },
      ];

      const stats = getPrefilterStats(articles);
      expect(stats.total).toBe(4);
      expect(stats.passed).toBe(2);
      expect(stats.rejected).toBe(2);
      expect(stats.passRate).toBe('50.0%');
    });
  });
});
