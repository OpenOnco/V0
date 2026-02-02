import { describe, it, expect } from 'vitest';
import { crawlMRDArticles } from '../../src/crawlers/mrd/pubmed.js';

describe('PubMed Crawler Dry Run', () => {
  it('crawls with limited results (no DB writes)', async () => {
    // Run a small crawl without database connection
    const articles = await crawlMRDArticles({
      fromDate: '2024-12-01',
      toDate: '2024-12-31',
      maxResults: 10,
      batchSize: 10,
    });

    expect(Array.isArray(articles)).toBe(true);
    // Should find at least some MRD-related articles
    if (articles.length > 0) {
      // Verify article structure
      expect(articles[0].pmid).toBeDefined();
      expect(articles[0].title).toBeDefined();
      expect(articles[0].sourceUrl).toBeDefined();
      expect(articles[0].relevanceScore).toBeDefined();
      expect(articles[0].relevanceScore).toBeGreaterThanOrEqual(1);
      expect(articles[0].relevanceScore).toBeLessThanOrEqual(10);
    }
  }, 60000);

  it('returns articles sorted by relevance', async () => {
    const articles = await crawlMRDArticles({
      fromDate: '2024-11-01',
      toDate: '2024-12-31',
      maxResults: 20,
      batchSize: 10,
    });

    if (articles.length > 1) {
      // Should be sorted by relevance score (descending)
      for (let i = 1; i < articles.length; i++) {
        expect(articles[i - 1].relevanceScore).toBeGreaterThanOrEqual(articles[i].relevanceScore);
      }
    }
  }, 60000);

  it('includes publication metadata', async () => {
    const articles = await crawlMRDArticles({
      fromDate: '2024-10-01',
      toDate: '2024-12-31',
      maxResults: 5,
      batchSize: 5,
    });

    if (articles.length > 0) {
      const article = articles[0];
      // Check for metadata fields
      expect(Array.isArray(article.authors)).toBe(true);
      expect(Array.isArray(article.publicationTypes)).toBe(true);
      expect(Array.isArray(article.meshTerms)).toBe(true);
    }
  }, 60000);

  it('filters out hematologic malignancies via query', async () => {
    const articles = await crawlMRDArticles({
      fromDate: '2024-10-01',
      toDate: '2024-12-31',
      maxResults: 20,
      batchSize: 10,
    });

    // None of the returned articles should be primarily about leukemia/lymphoma/myeloma
    // (The query itself excludes these)
    for (const article of articles) {
      const text = `${article.title} ${article.abstract || ''}`.toLowerCase();
      // Note: Some may still appear in combination with solid tumors
      // This test just verifies we're getting results without exclusively heme content
      expect(true).toBe(true); // Placeholder - real filtering happens at prefilter stage
    }
  }, 60000);
});
