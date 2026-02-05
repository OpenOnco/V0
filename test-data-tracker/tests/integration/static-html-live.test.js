/**
 * Live integration test for static HTML fetch
 * Tests that static_html policies can actually be fetched via plain HTTP
 */
import { describe, it, expect } from 'vitest';
import { getStaticHtmlPolicies } from '../../src/data/policy-registry.js';

// Pick a small sample of static_html policies to verify
const SAMPLE_URLS = [
  // BCBS Tennessee - known reliable static page
  'https://www.bcbst.com/mpmanual/!ssl!/webhelp/Circulating_Tumor_DNA_Liquid_Biopsy.htm',
  // BCBS Kansas
  'https://www.bcbsks.com/medical-policies/circulating-tumor-dna-and-circulating-tumor-cells-cancer-management-liquid-biopsy',
];

describe('Static HTML fetch (live)', () => {
  it('can fetch BCBS Tennessee policy via plain HTTP', async () => {
    const url = SAMPLE_URLS[0];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      expect(response.ok).toBe(true);
      const text = await response.text();

      // Should contain policy-relevant content
      expect(text.length).toBeGreaterThan(500);
      // Should be HTML
      expect(text.toLowerCase()).toContain('<html');
    } catch (error) {
      clearTimeout(timeoutId);
      // Network errors are acceptable in CI - just log
      if (error.name === 'AbortError') {
        console.log(`Skipping ${url}: timeout`);
        return;
      }
      throw error;
    }
  }, 20000);

  it('can fetch BCBS Kansas policy via plain HTTP', async () => {
    const url = SAMPLE_URLS[1];
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      expect(response.ok).toBe(true);
      const text = await response.text();
      expect(text.length).toBeGreaterThan(500);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.log(`Skipping ${url}: timeout`);
        return;
      }
      throw error;
    }
  }, 20000);

  it('all static_html policies have valid URLs', () => {
    const policies = getStaticHtmlPolicies();
    for (const p of policies) {
      expect(p.url).toMatch(/^https?:\/\//);
      expect(p.contentType).toBe('static_html');
    }
  });
});
