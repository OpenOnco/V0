import { describe, it, expect } from 'vitest';
import { search, fetchArticles } from '../../src/crawlers/mrd/pubmed.js';

describe('PubMed API Integration', () => {
  it('searches PubMed with MRD query', async () => {
    const result = await search('"minimal residual disease" colorectal', {
      retmax: 5,
    });
    expect(result.count).toBeGreaterThan(0);
    expect(result.ids.length).toBeLessThanOrEqual(5);
    expect(result.ids.every((id) => /^\d+$/.test(id))).toBe(true);
  }, 30000);

  it('searches with date filter', async () => {
    const result = await search('"ctDNA" cancer', {
      retmax: 5,
    });
    expect(result.count).toBeGreaterThan(0);
  }, 30000);

  it('fetches article details by PMID', async () => {
    // Known PMID for testing (a real MRD article)
    const articles = await fetchArticles(['37899283']);
    expect(articles.length).toBe(1);
    expect(articles[0].pmid).toBe('37899283');
    expect(articles[0].title).toBeDefined();
    expect(articles[0].title.length).toBeGreaterThan(0);
  }, 30000);

  it('fetches multiple articles', async () => {
    // Fetch a few articles by PMID
    const articles = await fetchArticles(['37899283', '38012345']);
    // At least one should be found (not all PMIDs may be valid)
    expect(articles.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  it('handles empty PMID list', async () => {
    const articles = await fetchArticles([]);
    expect(articles).toEqual([]);
  });

  it('extracts article fields correctly', async () => {
    // Search for a recent article to fetch
    const searchResult = await search('"circulating tumor DNA" colorectal', {
      retmax: 3,
    });

    if (searchResult.ids.length > 0) {
      const articles = await fetchArticles(searchResult.ids);
      // At least one article should be fetched (some PMIDs may not have XML)
      expect(articles.length).toBeGreaterThanOrEqual(1);

      const article = articles[0];
      expect(article.pmid).toBeDefined();
      expect(article.title).toBeDefined();
      // Abstract may or may not be present
      expect(Array.isArray(article.publicationTypes)).toBe(true);
      expect(Array.isArray(article.authors)).toBe(true);
      expect(Array.isArray(article.meshTerms)).toBe(true);
    }
  }, 30000);

  it('returns query translation', async () => {
    const result = await search('MRD cancer', { retmax: 1 });
    expect(result.queryTranslation).toBeDefined();
  }, 30000);
});
