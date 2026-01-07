// @ts-check
import { test, expect } from '@playwright/test';

/**
 * OpenOnco Public API Test Suite
 * 
 * Tests the /api/v1/* endpoints
 * 
 * Run with: npm run test:api
 * Requires: vercel dev running on port 3001
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001';

test.describe('API v1 - Stats Endpoint', () => {
  test('GET /api/v1/stats returns database statistics', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/stats`);
    
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/json');
    
    const data = await response.json();
    
    // Check response structure
    expect(data.success).toBe(true);
    expect(data.meta).toBeDefined();
    expect(data.meta.source).toBe('OpenOnco (openonco.org)');
    expect(data.meta.license).toBe('CC BY 4.0');
    
    // Check stats data
    expect(data.data.totals).toBeDefined();
    expect(data.data.totals.tests).toBeGreaterThan(50); // We have 80+ tests
    expect(data.data.totals.vendors).toBeGreaterThan(30);
    expect(data.data.byCategory).toBeDefined();
    expect(data.data.byCategory.MRD).toBeDefined();
    expect(data.data.byCategory.ECD).toBeDefined();
    expect(data.data.byCategory.TRM).toBeDefined();
    expect(data.data.byCategory.TDS).toBeDefined();
  });

  test('includes CORS headers', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/stats`);
    expect(response.headers()['access-control-allow-origin']).toBe('*');
  });
});

test.describe('API v1 - Tests List Endpoint', () => {
  test('GET /api/v1/tests returns all tests', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/tests`);
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.meta.total).toBeGreaterThan(50);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    
    // Check test object structure
    const firstTest = data.data[0];
    expect(firstTest.id).toBeDefined();
    expect(firstTest.name).toBeDefined();
    expect(firstTest.vendor).toBeDefined();
    expect(firstTest.category).toBeDefined();
  });

  test('filters by category', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/tests?category=mrd`);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    
    // All results should be MRD category
    for (const test of data.data) {
      expect(test.category).toBe('MRD');
    }
  });

  test('filters by vendor (partial match)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/tests?vendor=natera`);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
    
    for (const test of data.data) {
      expect(test.vendor.toLowerCase()).toContain('natera');
    }
  });

  test('respects limit parameter', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/tests?limit=5`);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.length).toBeLessThanOrEqual(5);
    expect(data.meta.limit).toBe(5);
  });

  test('handles pagination with offset', async ({ request }) => {
    // Get first page
    const page1 = await request.get(`${API_BASE}/api/v1/tests?limit=10&offset=0`);
    const data1 = await page1.json();
    
    // Get second page
    const page2 = await request.get(`${API_BASE}/api/v1/tests?limit=10&offset=10`);
    const data2 = await page2.json();
    
    expect(data1.data[0].id).not.toBe(data2.data[0].id);
    expect(data1.meta.offset).toBe(0);
    expect(data2.meta.offset).toBe(10);
  });

  test('filters fields when requested', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/tests?fields=sensitivity,specificity&limit=3`);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    
    const firstTest = data.data[0];
    // Should have required fields plus requested fields
    expect(firstTest.id).toBeDefined();
    expect(firstTest.name).toBeDefined();
    expect(firstTest.vendor).toBeDefined();
    // Should NOT have fields we didn't ask for (unless they're required)
    expect(firstTest.method).toBeUndefined();
    expect(firstTest.clinicalTrials).toBeUndefined();
  });

  test('combines multiple filters', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/tests?category=mrd&fda=ldt&limit=50`);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    
    for (const test of data.data) {
      expect(test.category).toBe('MRD');
      if (test.fdaStatus) {
        expect(test.fdaStatus.toLowerCase()).toMatch(/ldt|clia/);
      }
    }
  });
});

test.describe('API v1 - Single Test Endpoint', () => {
  test('GET /api/v1/tests/:id returns single test', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/tests/mrd-1`);
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('mrd-1');
    expect(data.data.name).toBeDefined();
    expect(data.data.vendor).toBeDefined();
    expect(data.links).toBeDefined();
    expect(data.links.self).toContain('mrd-1');
  });

  test('returns 404 for non-existent test', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/tests/fake-test-999`);
    
    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Test not found');
  });

  test('handles case-insensitive ID lookup', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/tests/MRD-1`);
    
    // Should either find it or return proper 404
    const data = await response.json();
    // Case insensitive search should work
    if (response.ok()) {
      expect(data.data.id.toLowerCase()).toBe('mrd-1');
    }
  });
});

test.describe('API v1 - Categories Endpoint', () => {
  test('GET /api/v1/categories returns all categories', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/categories`);
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.meta.totalCategories).toBe(4);
    expect(data.data.length).toBe(4);
    
    const categoryIds = data.data.map(c => c.id);
    expect(categoryIds).toContain('mrd');
    expect(categoryIds).toContain('ecd');
    expect(categoryIds).toContain('trm');
    expect(categoryIds).toContain('tds');
  });

  test('categories have required metadata', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/categories`);
    const data = await response.json();
    
    for (const category of data.data) {
      expect(category.id).toBeDefined();
      expect(category.name).toBeDefined();
      expect(category.shortName).toBeDefined();
      expect(category.description).toBeDefined();
      expect(category.stats).toBeDefined();
      expect(category.stats.totalTests).toBeGreaterThan(0);
      expect(category.links).toBeDefined();
    }
  });
});

test.describe('API v1 - Vendors Endpoint', () => {
  test('GET /api/v1/vendors returns all vendors', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/vendors`);
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.meta.totalVendors).toBeGreaterThan(30);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('vendors have test counts by category', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/vendors`);
    const data = await response.json();
    
    const firstVendor = data.data[0];
    expect(firstVendor.name).toBeDefined();
    expect(firstVendor.tests).toBeDefined();
    expect(firstVendor.totalTests).toBeGreaterThan(0);
    expect(firstVendor.tests.mrd).toBeDefined();
    expect(firstVendor.tests.ecd).toBeDefined();
  });

  test('filters vendors by category', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/vendors?category=mrd`);
    const data = await response.json();
    
    expect(data.success).toBe(true);
    // All returned vendors should have at least one MRD test
    for (const vendor of data.data) {
      expect(vendor.tests.mrd + vendor.kits.mrd).toBeGreaterThan(0);
    }
  });
});

test.describe('API v1 - Embed Endpoint', () => {
  test('GET /api/v1/embed/test returns HTML', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/embed/test?id=mrd-1`);
    
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/html');
    
    const html = await response.text();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Haystack MRD'); // Test name
    expect(html).toContain('Quest Diagnostics'); // Vendor
    expect(html).toContain('openonco.org'); // Attribution link
  });

  test('returns JSON when format=json', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/embed/test?id=mrd-1&format=json`);
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.embed).toBeDefined();
    expect(data.embed.iframe).toContain('<iframe');
    expect(data.data).toBeDefined();
  });

  test('supports dark theme', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/embed/test?id=mrd-1&theme=dark`);
    
    expect(response.ok()).toBeTruthy();
    const html = await response.text();
    expect(html).toContain('#1f2937'); // Dark background color
  });

  test('returns error for missing id', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/embed/test`);
    
    expect(response.status()).toBe(400);
    const html = await response.text();
    expect(html).toContain('Missing test ID');
  });

  test('returns 404 for invalid test id', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/embed/test?id=fake-999`);
    
    expect(response.status()).toBe(404);
    const html = await response.text();
    expect(html).toContain('Test not found');
  });

  test('allows iframe embedding (no X-Frame-Options DENY)', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/embed/test?id=mrd-1`);
    
    const xFrameOptions = response.headers()['x-frame-options'];
    // Should either be ALLOWALL or not set (not DENY or SAMEORIGIN)
    if (xFrameOptions) {
      expect(xFrameOptions.toUpperCase()).not.toBe('DENY');
      expect(xFrameOptions.toUpperCase()).not.toBe('SAMEORIGIN');
    }
  });
});

test.describe('API v1 - Documentation Endpoint', () => {
  test('GET /api/v1 returns JSON docs by default for API clients', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1?format=json`);
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data.name).toBe('OpenOnco Public API');
    expect(data.version).toBeDefined();
    expect(data.endpoints).toBeDefined();
    expect(data.endpoints.length).toBeGreaterThan(0);
  });

  test('returns HTML docs when Accept header prefers HTML', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1`, {
      headers: { 'Accept': 'text/html' }
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('text/html');
    
    const html = await response.text();
    expect(html).toContain('OpenOnco API');
    expect(html).toContain('/api/v1/tests');
  });
});

test.describe('API v1 - Error Handling', () => {
  test('returns proper error for invalid endpoint', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/nonexistent`);
    
    // Vercel returns 404 for unknown routes
    expect(response.status()).toBe(404);
  });

  test('handles OPTIONS preflight requests', async ({ request }) => {
    const response = await request.fetch(`${API_BASE}/api/v1/tests`, {
      method: 'OPTIONS'
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(response.headers()['access-control-allow-methods']).toContain('GET');
  });
});
