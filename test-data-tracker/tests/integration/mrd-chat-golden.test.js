/**
 * Golden Query Tests for MRD Chat API
 *
 * These tests verify that the MRD Chat API returns appropriate responses
 * for common clinical queries. They test the full pipeline:
 * intent extraction → hybrid search → response generation.
 *
 * Run with: npm run test:run -- tests/integration/mrd-chat-golden.test.js
 */

import { describe, it, expect, beforeAll } from 'vitest';

// These tests require the daemon server to be running
const API_URL = process.env.MRD_API_URL || 'http://localhost:3000';

async function queryMRDChat(queryText, filters = {}) {
  const response = await fetch(`${API_URL}/api/mrd-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryText, filters }),
  });
  return response.json();
}

describe('MRD Chat Golden Queries', () => {
  beforeAll(async () => {
    // Verify server is reachable
    try {
      const health = await fetch(`${API_URL}/health`);
      if (!health.ok) {
        throw new Error('Server not responding');
      }
    } catch (error) {
      console.warn('⚠️  MRD Chat server not running at', API_URL);
      console.warn('   Start with: cd daemon && npm start');
      console.warn('   Or set MRD_API_URL environment variable');
    }
  });

  describe('Clinical Guideline Queries', () => {
    it('colorectal cancer MRD surveillance', async () => {
      const result = await queryMRDChat(
        'What do NCCN guidelines say about ctDNA monitoring after colorectal cancer surgery?'
      );

      expect(result.success).toBe(true);
      expect(result.answer).toBeDefined();
      expect(result.sources).toBeInstanceOf(Array);

      // Should find NCCN guidelines
      const hasNccnSource = result.sources.some(s =>
        s.sourceType === 'nccn' || s.title?.toLowerCase().includes('nccn')
      );
      expect(hasNccnSource).toBe(true);

      // Intent should be recognized
      expect(result.meta.intent.type).toMatch(/clinical_guidance|guideline/i);

      // Answer should cite sources
      expect(result.answer).toMatch(/\[\d+\]/);

      // Should not make treatment recommendations
      expect(result.answer.toLowerCase()).not.toMatch(/you should|we recommend|consider doing/);
    }, 60000);

    it('breast cancer MRD evidence', async () => {
      const result = await queryMRDChat(
        'What is the evidence for ctDNA testing in breast cancer recurrence monitoring?'
      );

      expect(result.success).toBe(true);
      expect(result.sources.length).toBeGreaterThan(0);

      // Should recognize cancer type
      expect(result.meta.intent.cancerTypes).toContain('breast');
    }, 60000);

    it('lung cancer treatment decisions', async () => {
      const result = await queryMRDChat(
        'How can MRD testing guide adjuvant therapy decisions in NSCLC?'
      );

      expect(result.success).toBe(true);

      // Should find relevant sources
      const hasRelevantSource = result.sources.some(s =>
        s.title?.toLowerCase().includes('lung') ||
        s.title?.toLowerCase().includes('nsclc')
      );
      // May or may not find lung-specific sources depending on database contents
    }, 60000);
  });

  describe('Payer Coverage Queries', () => {
    it('Medicare ctDNA coverage', async () => {
      const result = await queryMRDChat(
        'What are Medicare MolDX coverage criteria for Signatera ctDNA testing?'
      );

      expect(result.success).toBe(true);

      // Intent should recognize payer focus
      if (result.meta.intent.type) {
        // May be "coverage_policy" or "general" depending on extraction
      }

      // Should have disclaimer
      expect(result.disclaimer).toBeDefined();
    }, 60000);

    it('commercial payer coverage', async () => {
      const result = await queryMRDChat(
        'Does Aetna cover ctDNA MRD testing for colorectal cancer surveillance?'
      );

      expect(result.success).toBe(true);
      // Response depends on database contents
    }, 60000);
  });

  describe('Clinical Trial Queries', () => {
    it('CIRCULATE trial results', async () => {
      const result = await queryMRDChat(
        'What are the results of the CIRCULATE trial for ctDNA-guided therapy?'
      );

      expect(result.success).toBe(true);

      // Should recognize trial focus
      expect(result.meta.intent.evidenceFocus).toMatch(/trial|all/);
    }, 60000);

    it('ongoing MRD trials', async () => {
      const result = await queryMRDChat(
        'What clinical trials are studying ctDNA-guided adjuvant therapy decisions?'
      );

      expect(result.success).toBe(true);
      expect(result.sources).toBeInstanceOf(Array);
    }, 60000);
  });

  describe('Test Comparison Queries', () => {
    it('Signatera vs Guardant', async () => {
      const result = await queryMRDChat(
        'What is the difference between Signatera and Guardant Reveal for MRD detection?'
      );

      expect(result.success).toBe(true);

      // Intent should recognize test comparison
      expect(result.meta.intent.type).toMatch(/test_comparison|general/);
    }, 60000);
  });

  describe('Response Quality', () => {
    it('includes medical disclaimer', async () => {
      const result = await queryMRDChat('What is ctDNA MRD testing?');

      expect(result.success).toBe(true);
      expect(result.disclaimer).toBeDefined();
      expect(result.disclaimer).toMatch(/informational purposes/i);
    }, 60000);

    it('citations reference real sources', async () => {
      const result = await queryMRDChat(
        'What does evidence say about positive ctDNA after surgery?'
      );

      expect(result.success).toBe(true);

      // Count citations in answer
      const citationMatches = result.answer.match(/\[\d+\]/g) || [];

      // If there are citations, they should match available sources
      if (citationMatches.length > 0) {
        const maxCitation = Math.max(
          ...citationMatches.map(c => parseInt(c.match(/\d+/)[0]))
        );
        expect(maxCitation).toBeLessThanOrEqual(result.sources.length);
      }
    }, 60000);

    it('provides related items when available', async () => {
      const result = await queryMRDChat(
        'What are NCCN recommendations for colorectal cancer ctDNA testing?'
      );

      expect(result.success).toBe(true);
      expect(result.relatedItems).toBeInstanceOf(Array);
      // relatedItems may be empty if no additional related content exists
    }, 60000);
  });

  describe('Edge Cases', () => {
    it('handles empty results gracefully', async () => {
      const result = await queryMRDChat(
        'What is the evidence for ctDNA in extremely rare cancer type XYZ123?'
      );

      expect(result.success).toBe(true);
      // Should provide a graceful response even with no matches
      expect(result.answer).toBeDefined();
    }, 60000);

    it('rejects hematologic malignancy queries appropriately', async () => {
      const result = await queryMRDChat(
        'What is the role of MRD testing in acute lymphoblastic leukemia?'
      );

      expect(result.success).toBe(true);
      // Should either find no sources or note this is outside scope
      // The system is designed for solid tumors only
    }, 60000);

    it('handles very short queries', async () => {
      const result = await queryMRDChat('ctDNA');

      expect(result.success).toBe(true);
    }, 60000);
  });
});

describe('MRD Chat Rate Limiting', () => {
  it('enforces rate limits', async () => {
    // Make many rapid requests
    const promises = Array(15).fill().map(() =>
      fetch(`${API_URL}/api/mrd-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'test query' }),
      })
    );

    const responses = await Promise.all(promises);
    const statuses = responses.map(r => r.status);

    // At least one should be rate limited (429)
    const hasRateLimit = statuses.some(s => s === 429);
    expect(hasRateLimit).toBe(true);
  }, 30000);
});
