/**
 * Extraction Quality Tests
 * Validates that extraction from sources meets gold set standards
 *
 * These tests are designed to:
 * 1. Ensure extraction quality doesn't regress
 * 2. Measure accuracy against known good extractions
 * 3. Catch issues with parsing or term matching
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadGoldSets, validateAgainstGoldSet, generateReport } from './gold-sets/index.js';
import { query, close } from '../src/db/client.js';

describe('Extraction Quality', () => {
  let goldSets;

  beforeAll(() => {
    goldSets = loadGoldSets();
  });

  describe('Gold Set Loading', () => {
    it('should load at least one gold set', () => {
      expect(Object.keys(goldSets).length).toBeGreaterThan(0);
    });

    it('should have valid structure for each gold set', () => {
      for (const [name, goldSet] of Object.entries(goldSets)) {
        expect(goldSet.source).toBeDefined();
        expect(goldSet.expectedExtractions).toBeDefined();
        expect(Array.isArray(goldSet.expectedExtractions)).toBe(true);
        expect(goldSet.expectedExtractions.length).toBeGreaterThan(0);

        // Each expected extraction should have required fields
        for (const expected of goldSet.expectedExtractions) {
          expect(expected.id).toBeDefined();
          expect(expected.mustContain).toBeDefined();
          expect(Array.isArray(expected.mustContain)).toBe(true);
        }
      }
    });
  });

  describe('NCCN Colorectal Extractions', () => {
    it('should extract expected recommendations from database', async () => {
      const goldSet = goldSets['nccn-colorectal'];
      if (!goldSet) {
        console.warn('Skipping: nccn-colorectal gold set not found');
        return;
      }

      try {
        // Fetch NCCN colorectal items from database
        const result = await query(`
          SELECT
            id,
            title,
            summary,
            key_findings,
            direct_quote,
            cancer_types,
            clinical_setting,
            evidence_level
          FROM mrd_guidance_items
          WHERE source_type = 'nccn'
            AND (cancer_types::text ILIKE '%colorectal%' OR cancer_types::text ILIKE '%colon%')
          ORDER BY created_at DESC
          LIMIT 50
        `);

        if (result.rows.length === 0) {
          console.warn('Skipping: No NCCN colorectal items in database');
          return;
        }

        // Transform database rows to extraction format
        const extractedItems = result.rows.map(row => ({
          id: row.id,
          title: row.title,
          summary: row.summary,
          keyFindings: row.key_findings,
          directQuote: row.direct_quote,
          cancerType: row.cancer_types,
          clinicalSetting: row.clinical_setting,
          evidenceLevel: row.evidence_level,
        }));

        // Validate against gold set
        const validation = validateAgainstGoldSet(extractedItems, goldSet);
        const accuracy = validation.passed / (validation.passed + validation.failed);

        // Log report
        console.log(generateReport(validation, goldSet));

        // Target: 60% accuracy (relaxed for initial testing)
        expect(accuracy).toBeGreaterThanOrEqual(0.6);

      } catch (error) {
        if (error.message.includes('MRD_DATABASE_URL')) {
          console.warn('Skipping: Database not configured');
          return;
        }
        throw error;
      }
    });
  });

  describe('Quote Anchoring Quality', () => {
    it('should have high confidence quote anchors', async () => {
      try {
        const result = await query(`
          SELECT
            AVG(extraction_confidence) as avg_confidence,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE extraction_confidence >= 0.8) as high_confidence,
            COUNT(*) FILTER (WHERE extraction_confidence < 0.5) as low_confidence
          FROM mrd_quote_anchors
          WHERE created_at > NOW() - INTERVAL '30 days'
        `);

        if (result.rows.length === 0 || !result.rows[0].total) {
          console.warn('Skipping: No quote anchors in database');
          return;
        }

        const stats = result.rows[0];
        const highConfidenceRate = stats.high_confidence / stats.total;

        console.log(`Quote Anchor Stats:
  Total: ${stats.total}
  Avg Confidence: ${(stats.avg_confidence * 100).toFixed(1)}%
  High Confidence (>=80%): ${stats.high_confidence} (${(highConfidenceRate * 100).toFixed(1)}%)
  Low Confidence (<50%): ${stats.low_confidence}`);

        // Target: at least 70% of anchors should have high confidence
        expect(highConfidenceRate).toBeGreaterThanOrEqual(0.7);

      } catch (error) {
        if (error.message.includes('MRD_DATABASE_URL')) {
          console.warn('Skipping: Database not configured');
          return;
        }
        throw error;
      }
    });
  });

  describe('Cancer Type Extraction', () => {
    it('should correctly identify cancer types from text', async () => {
      // Import the extraction function
      const { extractCancerTypes } = await import('../src/config/oncology-terms.js');

      const testCases = [
        {
          text: 'ctDNA testing in colorectal cancer patients after curative resection',
          expected: ['colorectal'],
        },
        {
          text: 'MRD detection in breast cancer and NSCLC',
          expected: ['breast', 'lung'],
        },
        {
          text: 'Liquid biopsy for bladder and urothelial carcinoma',
          expected: ['bladder'],
        },
        {
          text: 'ctDNA surveillance in triple-negative breast cancer',
          expected: ['breast'],
        },
        {
          text: 'Minimal residual disease in gastroesophageal junction tumors',
          expected: ['gastric'],
        },
      ];

      for (const { text, expected } of testCases) {
        const extracted = extractCancerTypes(text);

        for (const exp of expected) {
          expect(extracted).toContain(exp);
        }
      }
    });
  });

  describe('Prefilter Accuracy', () => {
    it('should correctly filter MRD-relevant articles', async () => {
      const { prefilter } = await import('../src/triage/mrd-prefilter.js');

      // Positive cases (should pass)
      const positiveCases = [
        {
          title: 'ctDNA-guided adjuvant therapy in colorectal cancer: CIRCULATE-US trial',
          abstract: 'Circulating tumor DNA (ctDNA) testing can detect minimal residual disease after surgery.',
        },
        {
          title: 'Liquid biopsy for surveillance in breast cancer',
          abstract: 'This study evaluates ctDNA monitoring for recurrence detection.',
        },
        {
          title: 'Signatera MRD testing in bladder cancer',
          abstract: 'Tumor-informed assay for molecular residual disease detection.',
        },
      ];

      for (const testCase of positiveCases) {
        const result = prefilter(testCase.title, testCase.abstract);
        expect(result.passes).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(3);
      }

      // Negative cases (should fail - hematologic)
      const negativeCases = [
        {
          title: 'MRD detection in acute lymphoblastic leukemia',
          abstract: 'Flow cytometry for minimal residual disease in ALL.',
        },
        {
          title: 'ctDNA in diffuse large B-cell lymphoma',
          abstract: 'Liquid biopsy for lymphoma monitoring.',
        },
      ];

      for (const testCase of negativeCases) {
        const result = prefilter(testCase.title, testCase.abstract);
        expect(result.passes).toBe(false);
      }
    });
  });
});

// Cleanup
afterAll(async () => {
  try {
    await close();
  } catch (e) {
    // Ignore if already closed
  }
});
