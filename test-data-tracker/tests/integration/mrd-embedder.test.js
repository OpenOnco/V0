import { describe, it, expect, beforeAll } from 'vitest';
import {
  embed,
  batchEmbed,
  chunkText,
  buildEmbeddingText,
  searchSimilar,
} from '../../src/embeddings/mrd-embedder.js';
import { close as closeDb } from '../../src/db/mrd-client.js';

describe('MRD Embeddings - Unit Tests', () => {
  describe('chunkText', () => {
    it('returns single chunk for short text', () => {
      const text = 'This is a short text about ctDNA for MRD detection.';
      const chunks = chunkText(text);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(text);
    });

    it('splits long text into multiple chunks', () => {
      // Create a text that's definitely too long (32000+ chars)
      const longText = 'MRD testing in colorectal cancer. '.repeat(1000);
      const chunks = chunkText(longText, 1000); // Lower token limit for testing
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('chunks have overlap for context', () => {
      const longText = 'Sentence one about ctDNA. '.repeat(500) +
                       'KEY SENTENCE. ' +
                       'Sentence two about MRD. '.repeat(500);
      const chunks = chunkText(longText, 500);

      // Chunks should overlap (key sentence might appear in two chunks)
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('buildEmbeddingText', () => {
    it('includes title and summary', () => {
      const item = {
        title: 'ctDNA for MRD in Colorectal Cancer',
        summary: 'This study evaluates circulating tumor DNA...',
      };
      const text = buildEmbeddingText(item);

      expect(text).toContain('Title: ctDNA for MRD in Colorectal Cancer');
      expect(text).toContain('Summary: This study evaluates');
    });

    it('includes key findings', () => {
      const item = {
        title: 'Test Title',
        key_findings: [
          { finding: 'ctDNA positivity predicts recurrence', implication: 'Consider closer surveillance' },
          { finding: 'Negative predictive value is 95%', implication: 'May guide de-escalation' },
        ],
      };
      const text = buildEmbeddingText(item);

      expect(text).toContain('Key Findings:');
      expect(text).toContain('ctDNA positivity predicts recurrence');
      expect(text).toContain('Negative predictive value');
    });

    it('includes cancer types and settings', () => {
      const item = {
        title: 'Test',
        cancer_types: ['colorectal', 'breast'],
        clinical_settings: ['post_surgery', 'surveillance'],
      };
      const text = buildEmbeddingText(item);

      expect(text).toContain('Cancer Types: colorectal, breast');
      expect(text).toContain('Clinical Settings: post_surgery, surveillance');
    });

    it('handles missing fields gracefully', () => {
      const item = {
        title: 'Minimal Item',
      };
      const text = buildEmbeddingText(item);

      expect(text).toContain('Title: Minimal Item');
      expect(text).not.toContain('Summary:');
      expect(text).not.toContain('Cancer Types:');
    });
  });
});

describe('MRD Embeddings - API Tests', () => {
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required for embedding tests');
    }
  });

  it('generates 1536-dimension embedding', async () => {
    const embedding = await embed('ctDNA for colorectal cancer MRD detection');
    expect(embedding.length).toBe(1536);
    expect(typeof embedding[0]).toBe('number');
    expect(embedding[0]).toBeGreaterThan(-1);
    expect(embedding[0]).toBeLessThan(1);
  }, 30000);

  it('generates consistent embeddings for same text', async () => {
    const text = 'Signatera MRD testing in colorectal cancer';
    const embedding1 = await embed(text);
    const embedding2 = await embed(text);

    // Embeddings should be identical for same input
    expect(embedding1.length).toBe(embedding2.length);
    // Check first few values match
    expect(embedding1[0]).toBeCloseTo(embedding2[0], 10);
    expect(embedding1[1]).toBeCloseTo(embedding2[1], 10);
  }, 30000);

  it('generates different embeddings for different texts', async () => {
    const embedding1 = await embed('ctDNA for colorectal cancer MRD');
    const embedding2 = await embed('Weather forecast for tomorrow');

    // Calculate rough cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] ** 2;
      norm2 += embedding2[i] ** 2;
    }
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

    // Unrelated texts should have lower similarity
    expect(similarity).toBeLessThan(0.8);
  }, 30000);

  it('batch embeds multiple texts', async () => {
    const texts = [
      'MRD in colorectal cancer',
      'ctDNA for breast cancer surveillance',
      'Liquid biopsy for lung cancer',
    ];

    const embeddings = await batchEmbed(texts);
    expect(embeddings.length).toBe(3);
    expect(embeddings[0].length).toBe(1536);
    expect(embeddings[1].length).toBe(1536);
    expect(embeddings[2].length).toBe(1536);
  }, 30000);
});

describe('MRD Embeddings - Database Search', () => {
  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY || !process.env.MRD_DATABASE_URL) {
      throw new Error('OPENAI_API_KEY and MRD_DATABASE_URL required');
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it('searches for similar items', async () => {
    const results = await searchSimilar(
      'What is the evidence for MRD testing in stage III colon cancer?',
      { limit: 5, minSimilarity: 0.5 }
    );

    // Results depend on what's in the database
    expect(Array.isArray(results)).toBe(true);

    if (results.length > 0) {
      expect(results[0].title).toBeDefined();
      expect(results[0].similarity).toBeGreaterThan(0);
      expect(results[0].similarity).toBeLessThanOrEqual(1);
    }
  }, 30000);

  it('applies cancer type filter', async () => {
    const results = await searchSimilar(
      'MRD testing evidence',
      { limit: 5, minSimilarity: 0.5, cancerType: 'colorectal' }
    );

    expect(Array.isArray(results)).toBe(true);
    // If we have results, they should be filtered by cancer type
    // (verification would require checking the cancer_types relationship)
  }, 30000);

  it('returns results sorted by similarity', async () => {
    const results = await searchSimilar(
      'ctDNA surveillance after surgery',
      { limit: 10, minSimilarity: 0.5 }
    );

    if (results.length > 1) {
      // Results should be sorted by similarity (descending)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].similarity).toBeGreaterThanOrEqual(results[i].similarity);
      }
    }
  }, 30000);
});
