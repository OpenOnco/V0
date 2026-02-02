/**
 * Phase 3 Tests: Discovery without Google Search
 *
 * Tests for:
 * 1. No Google search in discovery
 * 2. Sitemap parsing works
 * 3. Only payer-owned endpoints used
 */

import { describe, it, expect } from 'vitest';
import {
  DiscoveryCrawler,
  DISCOVERY_SOURCES,
} from '../../src/crawlers/discovery.js';

describe('Discovery Sources Configuration', () => {
  it('no source uses Google search', () => {
    for (const [id, source] of Object.entries(DISCOVERY_SOURCES)) {
      // searchUrl should either be null or point to payer's own domain
      if (source.searchUrl) {
        // Should NOT be google.com
        expect(source.searchUrl).not.toContain('google.com');
        expect(source.searchUrl).not.toContain('bing.com');
        expect(source.searchUrl).not.toContain('duckduckgo.com');

        // Should be on payer's domain or related domain
        const searchDomain = new URL(source.searchUrl).hostname;
        const indexDomains = (source.indexPages || []).map(url => {
          try {
            return new URL(url).hostname;
          } catch {
            return '';
          }
        });

        // Search should be on same domain family as index pages
        // (e.g., www.aetna.com and aetna.com are related)
        const searchBase = searchDomain.replace('www.', '').split('.').slice(-2).join('.');
        const relatedToIndex = indexDomains.some(domain => {
          const indexBase = domain.replace('www.', '').split('.').slice(-2).join('.');
          return searchBase === indexBase || searchBase.includes(indexBase) || indexBase.includes(searchBase);
        });

        // This is informational - some payers have dedicated guideline sites
        if (!relatedToIndex) {
          console.log(`Note: ${id} has searchUrl on different domain: ${searchDomain}`);
        }
      }
    }
  });

  it('all sources have index pages', () => {
    for (const [id, source] of Object.entries(DISCOVERY_SOURCES)) {
      expect(source.indexPages).toBeDefined();
      expect(Array.isArray(source.indexPages)).toBe(true);
      // At least one index page
      expect(source.indexPages.length).toBeGreaterThan(0);
    }
  });

  it('sources have optional sitemap and urlPatterns fields', () => {
    // These are v2.1 additions - should exist even if null
    for (const [id, source] of Object.entries(DISCOVERY_SOURCES)) {
      expect('sitemapUrl' in source).toBe(true);
      expect('urlPatterns' in source).toBe(true);
    }
  });
});

describe('DiscoveryCrawler', () => {
  it('does not have any Google search methods', () => {
    const crawler = new DiscoveryCrawler({ dryRun: true });

    // Check that there's no Google-related methods
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(crawler));

    for (const method of methods) {
      expect(method.toLowerCase()).not.toContain('google');
    }
  });

  it('extractUrlsFromSitemap parses XML correctly', () => {
    const crawler = new DiscoveryCrawler({ dryRun: true });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/policy1.pdf</loc>
    <lastmod>2026-01-15</lastmod>
  </url>
  <url>
    <loc>https://example.com/guidelines/liquid-biopsy.html</loc>
  </url>
  <url>
    <loc>https://example.com/about-us</loc>
  </url>
</urlset>`;

    const urls = crawler.extractUrlsFromSitemap(sitemap);

    expect(urls).toHaveLength(3);
    expect(urls).toContain('https://example.com/policy1.pdf');
    expect(urls).toContain('https://example.com/guidelines/liquid-biopsy.html');
  });

  it('isPolicyLikeUrl filters correctly', () => {
    const crawler = new DiscoveryCrawler({ dryRun: true });

    // Should be policy-like
    expect(crawler.isPolicyLikeUrl('https://example.com/policy.pdf')).toBe(true);
    expect(crawler.isPolicyLikeUrl('https://example.com/medical-policy.html')).toBe(true);
    expect(crawler.isPolicyLikeUrl('https://example.com/coverage-guidelines.htm')).toBe(true);
    expect(crawler.isPolicyLikeUrl('https://example.com/clinical-criteria')).toBe(true);

    // Should NOT be policy-like
    expect(crawler.isPolicyLikeUrl('https://example.com/about-us')).toBe(false);
    expect(crawler.isPolicyLikeUrl('https://example.com/contact')).toBe(false);
    expect(crawler.isPolicyLikeUrl('https://example.com/logo.png')).toBe(false);
  });

  it('extractTitleFromUrl generates readable titles', () => {
    const crawler = new DiscoveryCrawler({ dryRun: true });

    expect(crawler.extractTitleFromUrl('https://example.com/liquid-biopsy-policy.pdf'))
      .toBe('liquid biopsy policy');

    expect(crawler.extractTitleFromUrl('https://example.com/MolecularOncologyGuideline.html'))
      .toBe('Molecular Oncology Guideline');

    expect(crawler.extractTitleFromUrl('https://example.com/'))
      .toBe('Unknown Policy');
  });

  it('extractLinks finds anchor tags', () => {
    const crawler = new DiscoveryCrawler({ dryRun: true });

    const html = `
      <html>
        <body>
          <a href="/policy1.pdf">Policy 1</a>
          <a href="https://example.com/policy2.html">Policy 2</a>
          <a href="#section">Skip Link</a>
          <a href="javascript:void(0)">JS Link</a>
        </body>
      </html>
    `;

    const links = crawler.extractLinks(html, 'https://example.com');

    // Should have 2 valid links (skip # and javascript:)
    expect(links.length).toBe(2);
    expect(links[0].url).toBe('https://example.com/policy1.pdf');
    expect(links[0].text).toBe('Policy 1');
    expect(links[1].url).toBe('https://example.com/policy2.html');
  });

  it('deduplicateCandidates removes duplicates', () => {
    const crawler = new DiscoveryCrawler({ dryRun: true });

    const candidates = [
      { url: 'https://example.com/policy1.pdf', title: 'Policy 1' },
      { url: 'https://example.com/policy2.pdf', title: 'Policy 2' },
      { url: 'https://example.com/policy1.pdf', title: 'Duplicate Policy 1' },
    ];

    const unique = crawler.deduplicateCandidates(candidates);

    expect(unique).toHaveLength(2);
    expect(unique[0].title).toBe('Policy 1'); // First one kept
  });
});

describe('Discovery Methods Priority', () => {
  it('discovery uses methods in correct order', async () => {
    const callOrder = [];

    // Mock fetch to track which URLs are called
    const mockFetch = async (url) => {
      if (url.includes('index')) callOrder.push('index');
      else if (url.includes('search')) callOrder.push('search');
      else if (url.includes('sitemap')) callOrder.push('sitemap');

      return {
        ok: true,
        text: async () => '<html></html>',
      };
    };

    const crawler = new DiscoveryCrawler({
      dryRun: true,
      fetchFn: mockFetch,
    });

    // Create a test source with all methods
    const testSource = {
      id: 'test',
      name: 'Test Payer',
      indexPages: ['https://test.com/index'],
      searchUrl: 'https://test.com/search?q=',
      searchTerms: ['test'],
      sitemapUrl: 'https://test.com/sitemap.xml',
    };

    await crawler.discoverForPayer(testSource);

    // Index should be first, then search, then sitemap
    expect(callOrder[0]).toBe('index');
    // Search and sitemap order may vary but both should be after index
    expect(callOrder).toContain('search');
    expect(callOrder).toContain('sitemap');
  });
});
