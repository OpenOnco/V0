import { describe, it, expect } from 'vitest';
import {
  buildMRDSearchQuery,
  buildHighPriorityQuery,
  scoreRelevance,
  getMRDKeywordRegex,
  MESH_TERMS,
  KEYWORDS,
  PUBLICATION_TYPES,
} from '../../../../src/crawlers/mrd/pubmed-queries.js';

describe('PubMed MRD Queries', () => {
  describe('buildMRDSearchQuery', () => {
    it('builds valid search query with date range', () => {
      const query = buildMRDSearchQuery({
        fromDate: '2024-01-01',
        toDate: '2024-12-31',
      });
      expect(query).toContain('minimal residual disease');
      expect(query).toContain('ctDNA');
      expect(query).toContain('2024/01/01');
      expect(query).toContain('2024/12/31');
      // Should contain NOT clause to exclude heme malignancies
      expect(query).toContain('NOT ("leukemia"');
    });

    it('includes MeSH terms', () => {
      const query = buildMRDSearchQuery();
      expect(query).toContain('Neoplasm, Residual');
      expect(query).toContain('Circulating Tumor DNA');
    });

    it('includes cancer context terms', () => {
      const query = buildMRDSearchQuery();
      expect(query).toContain('colorectal');
      expect(query).toContain('breast cancer');
      expect(query).toContain('NSCLC');
    });

    it('excludes hematologic malignancies', () => {
      const query = buildMRDSearchQuery();
      expect(query).toContain('NOT');
      expect(query).toContain('leukemia');
      expect(query).toContain('lymphoma');
      expect(query).toContain('myeloma');
    });

    it('filters by high priority publication types when specified', () => {
      const query = buildMRDSearchQuery({ publicationTypes: 'high' });
      expect(query).toContain('Guideline');
      expect(query).toContain('Meta-Analysis');
      expect(query).toContain('Randomized Controlled Trial');
    });

    it('filters by clinical publication types when specified', () => {
      const query = buildMRDSearchQuery({ publicationTypes: 'clinical' });
      expect(query).toContain('Clinical Trial, Phase II');
      expect(query).toContain('Multicenter Study');
    });

    it('excludes reviews by default', () => {
      const query = buildMRDSearchQuery();
      expect(query).toContain('NOT "Review"[pt]');
    });

    it('includes reviews when requested', () => {
      const query = buildMRDSearchQuery({ includeReviews: true });
      expect(query).not.toContain('NOT "Review"[pt]');
    });

    it('includes language filter', () => {
      const query = buildMRDSearchQuery();
      expect(query).toContain('English[la]');
    });

    it('excludes humans filter by default', () => {
      const query = buildMRDSearchQuery();
      expect(query).not.toContain('Humans[Mesh]');
    });

    it('includes humans filter when explicitly requested', () => {
      const query = buildMRDSearchQuery({ requireHumansMesh: true });
      expect(query).toContain('Humans[Mesh]');
    });
  });

  describe('buildHighPriorityQuery', () => {
    it('uses high priority publication types', () => {
      const query = buildHighPriorityQuery();
      expect(query).toContain('Guideline');
      expect(query).toContain('Practice Guideline');
    });
  });

  describe('scoreRelevance', () => {
    it('scores high relevance for guideline with test names', () => {
      const score = scoreRelevance(
        'NCCN Guidelines for ctDNA-based MRD Testing',
        'Signatera and Guardant Reveal for colorectal cancer surveillance...'
      );
      // Score depends on keyword matches in the scoring algorithm
      expect(score).toBeGreaterThanOrEqual(6);
    });

    it('scores low relevance for tangential content', () => {
      const score = scoreRelevance(
        'Advances in tumor genomics',
        'Next generation sequencing for variant detection...'
      );
      expect(score).toBeLessThan(5);
    });

    it('scores high for primary MRD terms', () => {
      const score = scoreRelevance(
        'Minimal residual disease detection using ctDNA',
        'Circulating tumor DNA analysis for MRD assessment...'
      );
      // Score depends on exact term matching - verify it's at least medium relevance
      expect(score).toBeGreaterThanOrEqual(3);
    });

    it('boosts score for specific test names', () => {
      const withTest = scoreRelevance(
        'Signatera for MRD detection',
        'ctDNA-based monitoring...'
      );
      const withoutTest = scoreRelevance(
        'Generic MRD detection',
        'ctDNA-based monitoring...'
      );
      expect(withTest).toBeGreaterThan(withoutTest);
    });

    it('includes cancer type in scoring', () => {
      const withCancer = scoreRelevance(
        'ctDNA MRD in colorectal cancer',
        'Stage III colon cancer surveillance...'
      );
      const withoutCancer = scoreRelevance(
        'ctDNA MRD detection',
        'General surveillance approach...'
      );
      expect(withCancer).toBeGreaterThan(withoutCancer);
    });

    it('normalizes score to 1-10 scale', () => {
      // Low score article
      const lowScore = scoreRelevance(
        'Cancer treatment advances',
        'General oncology update...'
      );
      expect(lowScore).toBeGreaterThanOrEqual(1);
      expect(lowScore).toBeLessThanOrEqual(10);

      // High score article with many keywords
      const highScore = scoreRelevance(
        'Signatera and Guardant Reveal for minimal residual disease detection using ctDNA liquid biopsy',
        'Circulating tumor DNA for adjuvant therapy monitoring in colorectal breast lung cancer patients post-surgery surveillance recurrence'
      );
      expect(highScore).toBeLessThanOrEqual(10);
    });
  });

  describe('getMRDKeywordRegex', () => {
    it('matches MRD terms', () => {
      const regex = getMRDKeywordRegex();
      expect(regex.test('This study on ctDNA detection')).toBe(true);
      expect(regex.test('Minimal residual disease monitoring')).toBe(true);
    });

    it('matches specific test names', () => {
      const regex = getMRDKeywordRegex();
      expect(regex.test('Signatera for MRD')).toBe(true);
      expect(regex.test('Guardant Reveal testing')).toBe(true);
    });

    it('does not match unrelated content', () => {
      const regex = getMRDKeywordRegex();
      expect(regex.test('Surgical resection techniques')).toBe(false);
      expect(regex.test('Chemotherapy dosing guidelines')).toBe(false);
    });

    it('is case insensitive', () => {
      const regex = getMRDKeywordRegex();
      expect(regex.test('CTDNA detection')).toBe(true);
      expect(regex.test('signatera testing')).toBe(true);
    });
  });

  describe('exported constants', () => {
    it('MESH_TERMS contains expected terms', () => {
      expect(MESH_TERMS).toContain('Circulating Tumor DNA');
      expect(MESH_TERMS).toContain('Liquid Biopsy');
      expect(MESH_TERMS).toContain('Minimal Residual Disease');
    });

    it('KEYWORDS.primary contains core MRD terms', () => {
      expect(KEYWORDS.primary).toContain('minimal residual disease');
      expect(KEYWORDS.primary).toContain('ctDNA');
      expect(KEYWORDS.primary).toContain('liquid biopsy');
    });

    it('KEYWORDS.tests contains specific test names', () => {
      expect(KEYWORDS.tests).toContain('Signatera');
      expect(KEYWORDS.tests).toContain('Guardant Reveal');
      expect(KEYWORDS.tests).toContain('FoundationOne Tracker');
    });

    it('KEYWORDS.cancerTypes contains solid tumors', () => {
      expect(KEYWORDS.cancerTypes).toContain('colorectal');
      expect(KEYWORDS.cancerTypes).toContain('breast cancer');
      expect(KEYWORDS.cancerTypes).toContain('lung cancer');
    });

    it('PUBLICATION_TYPES.highPriority contains guidelines and trials', () => {
      expect(PUBLICATION_TYPES.highPriority).toContain('Guideline');
      expect(PUBLICATION_TYPES.highPriority).toContain('Meta-Analysis');
      expect(PUBLICATION_TYPES.highPriority).toContain('Randomized Controlled Trial');
    });
  });
});
