/**
 * Document Classifier Tests
 */

import { describe, it, expect } from 'vitest';
import {
  DOC_TYPES,
  classifyDocument,
  isLikelyIndexPage,
  isLikelyPolicy,
} from '../../src/extractors/doc-classifier.js';

describe('Document Classifier', () => {
  describe('classifyDocument', () => {
    it('identifies policy documents with coverage criteria', () => {
      const policyContent = `
        Medical Policy: Liquid Biopsy Testing
        Policy Number: MP-123
        Effective Date: January 1, 2026
        Last Reviewed: December 15, 2025

        Coverage Criteria:
        Signatera MRD testing is considered medically necessary for monitoring
        minimal residual disease in Stage II-III colorectal cancer patients
        who have completed curative-intent therapy.

        Prior authorization is required.

        CPT Code: 0239U
      `;

      const result = classifyDocument(policyContent);

      expect(result.docType).toBe(DOC_TYPES.POLICY);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.signals.positive.length).toBeGreaterThan(3);
    });

    it('identifies index/listing pages', () => {
      const indexContent = `
        Medical Policy Library

        Browse all policies by category:
        - Oncology Policies
        - Genetic Testing Policies
        - Lab Services Policies

        Click here to view full policy
        Select a policy from the list below

        Search for policies:
        Filter by: Category | Date | Status
        Sort by: Name | Date
      `;

      const result = classifyDocument(indexContent);

      expect(result.docType).toBe(DOC_TYPES.INDEX);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.signals.negative.length).toBeGreaterThan(2);
    });

    it('handles mixed content with policy indicators winning', () => {
      const mixedContent = `
        Policy Index - Liquid Biopsy

        Effective Date: March 1, 2026

        Coverage Criteria:
        Guardant360 CDx is covered for the following indications:
        - Advanced NSCLC
        - Metastatic breast cancer

        Prior authorization required.

        See also: Related policies
      `;

      const result = classifyDocument(mixedContent);

      // Policy signals should win because we have specific coverage language
      expect(result.docType).toBe(DOC_TYPES.POLICY);
    });

    it('returns low confidence for minimal content', () => {
      const minimalContent = 'Some random text without clear signals.';

      const result = classifyDocument(minimalContent);

      // Short content gets flagged as INDEX with borderline confidence
      expect(result.confidence).toBeLessThanOrEqual(0.5);
      expect(result.signals.negative).toContain('short_content');
    });

    it('handles empty/null content', () => {
      expect(classifyDocument(null).docType).toBe(DOC_TYPES.UNKNOWN);
      expect(classifyDocument('').docType).toBe(DOC_TYPES.UNKNOWN);
      expect(classifyDocument(undefined).docType).toBe(DOC_TYPES.UNKNOWN);
    });

    it('considers URL hints', () => {
      const content = 'Some policy content with coverage criteria.';

      const indexUrl = classifyDocument(content, {
        url: 'https://payer.com/policies/index.html',
      });

      const policyUrl = classifyDocument(content, {
        url: 'https://payer.com/medical-policy/liquid-biopsy.pdf',
      });

      // URL hints should influence classification
      expect(indexUrl.signals.negative).toContain('url_suggests_index');
      expect(policyUrl.signals.positive).toContain('url_suggests_policy');
    });

    it('flags short content as likely index', () => {
      const shortContent = 'Policy list. Click to view.';

      const result = classifyDocument(shortContent);

      expect(result.signals.negative).toContain('short_content');
    });
  });

  describe('isLikelyIndexPage', () => {
    it('returns true for clear index pages', () => {
      const indexContent = `
        Policy Library
        Browse policies
        Click to view
        Search results
        Filter by category
      `;

      expect(isLikelyIndexPage(indexContent)).toBe(true);
    });

    it('returns false for policy documents', () => {
      const policyContent = `
        Coverage Criteria
        Effective Date: January 1, 2026
        Signatera is medically necessary
        Prior authorization required
        CPT: 0239U
      `;

      expect(isLikelyIndexPage(policyContent)).toBe(false);
    });
  });

  describe('isLikelyPolicy', () => {
    it('returns true for clear policy documents', () => {
      const policyContent = `
        Medical Policy
        Effective Date: January 1, 2026
        Coverage Criteria:
        Test is considered medically necessary when...
        Prior authorization is required.
      `;

      expect(isLikelyPolicy(policyContent)).toBe(true);
    });

    it('returns false for index pages', () => {
      const indexContent = `
        Browse all medical policies
        Click here to view
        Policy library
        Search policies
      `;

      expect(isLikelyPolicy(indexContent)).toBe(false);
    });
  });

  describe('Signal Detection', () => {
    it('detects CPT codes as positive signal', () => {
      const content = 'Covered codes: CPT 0239U, 81479';
      const result = classifyDocument(content);

      expect(result.signals.positive.some(s => s.includes('cpt') || s.includes('0239u'))).toBe(true);
    });

    it('detects effective date as positive signal', () => {
      const content = 'Effective Date: January 15, 2026';
      const result = classifyDocument(content);

      expect(result.signals.positive.some(s => s.includes('effective'))).toBe(true);
    });

    it('detects coverage language as positive signal', () => {
      const content = 'This test is considered medically necessary for...';
      const result = classifyDocument(content);

      expect(result.signals.positive.some(s => s.includes('medically'))).toBe(true);
    });

    it('detects "click to view" as negative signal', () => {
      const content = 'Click here to view the full policy document.';
      const result = classifyDocument(content);

      expect(result.signals.negative.some(s => s.includes('click') || s.includes('view'))).toBe(true);
    });
  });
});
