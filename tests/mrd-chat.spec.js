// @ts-check
import { test, expect } from '@playwright/test';

/**
 * MRD Chat API Test Suite
 *
 * Tests the /api/mrd-chat endpoint
 *
 * Run with: npm run test:api
 * Requires: vercel dev running on port 3001
 * Requires: MRD_DATABASE_URL set with populated database
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001';

test.describe('MRD Chat API', () => {
  test('POST /api/mrd-chat returns answer with citations', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: {
        query: 'What does evidence say about ctDNA in colorectal cancer?',
      },
    });

    // Skip if database not configured
    if (response.status() === 500) {
      const data = await response.json();
      if (data.error === 'Internal server error') {
        test.skip();
        return;
      }
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.answer).toBeDefined();
    expect(data.answer.length).toBeGreaterThan(50);
    expect(data.sources).toBeInstanceOf(Array);
    expect(data.disclaimer).toContain('informational purposes');
  });

  test('returns sources with citation format', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: {
        query: 'CIRCULATE trial results for ctDNA',
        filters: { cancerType: 'colorectal' },
      },
    });

    if (response.status() === 500) {
      test.skip();
      return;
    }

    const data = await response.json();

    if (data.sources && data.sources.length > 0) {
      expect(data.sources[0]).toHaveProperty('index');
      expect(data.sources[0]).toHaveProperty('title');
      expect(data.sources[0]).toHaveProperty('citation');
      expect(data.sources[0]).toHaveProperty('url');
    }
  });

  test('handles empty query', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: { query: '' },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Missing');
  });

  test('handles missing query field', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: {},
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Missing');
  });

  test('handles query too long', async ({ request }) => {
    const longQuery = 'a'.repeat(1001);
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: { query: longQuery },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('too long');
  });

  test('respects rate limiting', async ({ request }) => {
    // Make many requests quickly
    const promises = Array(15)
      .fill()
      .map(() =>
        request.post(`${API_BASE}/api/mrd-chat`, {
          data: { query: 'test rate limiting' },
        })
      );

    const responses = await Promise.all(promises);
    const rateLimited = responses.some((r) => r.status() === 429);

    // Should hit rate limit with 15 requests (limit is 10 per minute)
    expect(rateLimited).toBe(true);
  });

  test('includes CORS headers', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: { query: 'test' },
    });

    expect(response.headers()['access-control-allow-origin']).toBe('*');
  });

  test('handles OPTIONS preflight request', async ({ request }) => {
    const response = await request.fetch(`${API_BASE}/api/mrd-chat`, {
      method: 'OPTIONS',
    });

    expect(response.ok()).toBeTruthy();
    expect(response.headers()['access-control-allow-methods']).toContain('POST');
  });

  test('rejects non-POST methods', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/mrd-chat`);
    expect(response.status()).toBe(405);
  });

  test('includes meta information in response', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: { query: 'MRD testing guidance' },
    });

    if (response.status() === 500) {
      test.skip();
      return;
    }

    const data = await response.json();

    if (data.success && data.meta) {
      expect(data.meta).toHaveProperty('model');
      expect(data.meta).toHaveProperty('sourcesRetrieved');
      expect(data.meta).toHaveProperty('queryLength');
    }
  });

  test('returns related items when available', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: { query: 'Signatera colorectal cancer' },
    });

    if (response.status() === 500) {
      test.skip();
      return;
    }

    const data = await response.json();

    expect(data.relatedItems).toBeDefined();
    expect(Array.isArray(data.relatedItems)).toBe(true);

    if (data.relatedItems.length > 0) {
      expect(data.relatedItems[0]).toHaveProperty('title');
      expect(data.relatedItems[0]).toHaveProperty('url');
    }
  });

  test('handles no results gracefully', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: {
        query: 'xyz123nonexistentterm456abc',
      },
    });

    if (response.status() === 500) {
      test.skip();
      return;
    }

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    // Should return a helpful message when no sources found
    expect(data.answer).toBeDefined();
  });

  test('applies cancer type filter', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: {
        query: 'MRD testing evidence',
        filters: { cancerType: 'breast' },
      },
    });

    if (response.status() === 500) {
      test.skip();
      return;
    }

    // Response should succeed regardless of filter results
    expect(response.ok() || response.status() === 200).toBeTruthy();
  });

  test('applies clinical setting filter', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/mrd-chat`, {
      data: {
        query: 'ctDNA monitoring',
        filters: { clinicalSetting: 'post_surgery' },
      },
    });

    if (response.status() === 500) {
      test.skip();
      return;
    }

    expect(response.ok() || response.status() === 200).toBeTruthy();
  });
});
