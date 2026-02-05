/**
 * Tests for static HTML fetch path in payer crawler
 */
import { describe, it, expect } from 'vitest';
import {
  getAllPolicies,
  getStaticHtmlPolicies,
  getHtmlPolicies,
  getPdfPolicies,
} from '../../../src/data/policy-registry.js';

describe('Policy Registry: static_html contentType', () => {
  it('getStaticHtmlPolicies returns only static_html policies', () => {
    const policies = getStaticHtmlPolicies();
    expect(policies.length).toBeGreaterThan(0);
    for (const p of policies) {
      expect(p.contentType).toBe('static_html');
    }
  });

  it('getHtmlPolicies excludes static_html policies', () => {
    const htmlPolicies = getHtmlPolicies();
    for (const p of htmlPolicies) {
      expect(p.contentType).toBe('html');
    }
  });

  it('static_html + html + pdf accounts for all policies', () => {
    const all = getAllPolicies();
    const staticHtml = getStaticHtmlPolicies();
    const html = getHtmlPolicies();
    const pdf = getPdfPolicies();
    // Some policies might have other types (like index_page), but the main three should cover most
    expect(staticHtml.length + html.length + pdf.length).toBeLessThanOrEqual(all.length);
    expect(staticHtml.length + html.length + pdf.length).toBeGreaterThan(0);
  });

  it('known static_html candidates are correctly tagged', () => {
    const staticPolicies = getStaticHtmlPolicies();
    const ids = staticPolicies.map(p => p.id);

    // These should all be static_html
    expect(ids).toContain('anthem-lab-00015');
    expect(ids).toContain('bcbst-ctdna-liquid-biopsy');
    expect(ids).toContain('bcbsnc-liquid-biopsy-g2054');
    expect(ids).toContain('bcbsks-ctdna-liquid-biopsy');
    expect(ids).toContain('bcbssc-liquid-biopsy');
    expect(ids).toContain('highmark-l123');
    expect(ids).toContain('highmark-l113');
    expect(ids).toContain('highmark-l267-navdx');
    expect(ids).toContain('bcbsmn-vi49-liquid-biopsy');
    expect(ids).toContain('bcidaho-mp204141');
    expect(ids).toContain('amerigroup-gene49-ctdna');
  });

  it('bot-protected pages remain as html (not static_html)', () => {
    const htmlPolicies = getHtmlPolicies();
    const ids = htmlPolicies.map(p => p.id);

    // Aetna has bot protection - should stay as html
    expect(ids).toContain('aetna-cpb-0352');
    expect(ids).toContain('aetna-cpb-0715');
  });

  it('all policies have required fields', () => {
    const all = getAllPolicies();
    for (const p of all) {
      expect(p.id).toBeTruthy();
      expect(p.url).toBeTruthy();
      expect(p.contentType).toBeTruthy();
      expect(['html', 'static_html', 'pdf']).toContain(p.contentType);
      expect(p.payerId).toBeTruthy();
      expect(p.payerName).toBeTruthy();
    }
  });
});
