/**
 * Unit tests for PublicationIndexCrawler utility methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicationIndexCrawler } from '../src/index.js';

// Mock all external dependencies
vi.mock('../../test-data-tracker/src/crawlers/playwright-base.js', () => ({
  PlaywrightCrawler: class MockPlaywrightCrawler {
    constructor() {
      this.rateLimitMs = 1000;
    }
    async loadHashes() {}
    async saveHashes() {}
    async closeBrowser() {}
    closeHashStore() {}
    getStatus() { return {}; }
    recordPageSuccess() {}
    recordPageFailure() {}
    detectChange() { return { hasChanged: true, isFirstCrawl: true, newHash: 'abc123' }; }
    storeHash() {}
    sleep(ms) { return Promise.resolve(); }
  }
}));

vi.mock('../../test-data-tracker/src/crawlers/publication-resolver.js', () => ({
  resolvePublication: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../test-data-tracker/src/crawlers/physician-db-writer.js', () => ({
  writePublicationToPhysicianDb: vi.fn().mockResolvedValue({ id: 1, isNew: true }),
  writeSourceItemEdge: vi.fn().mockResolvedValue({}),
  setInterpretationGuardrail: vi.fn().mockResolvedValue({}),
  isPhysicianDbConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock('../../test-data-tracker/src/db/mrd-client.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
}));

vi.mock('../../test-data-tracker/src/utils/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('PublicationIndexCrawler', () => {
  let crawler;

  beforeEach(() => {
    crawler = new PublicationIndexCrawler({ dryRun: true });
  });

  describe('cleanDoi', () => {
    it('should return null for empty input', () => {
      expect(crawler.cleanDoi(null)).toBeNull();
      expect(crawler.cleanDoi(undefined)).toBeNull();
      expect(crawler.cleanDoi('')).toBeNull();
    });

    it('should extract valid DOI from standard format', () => {
      expect(crawler.cleanDoi('10.1056/NEJMoa2312356')).toBe('10.1056/NEJMoa2312356');
    });

    it('should extract DOI from URL format', () => {
      expect(crawler.cleanDoi('https://doi.org/10.1056/NEJMoa2312356')).toBe('10.1056/NEJMoa2312356');
    });

    it('should extract DOI from doi: prefix format', () => {
      expect(crawler.cleanDoi('doi:10.1056/NEJMoa2312356')).toBe('10.1056/NEJMoa2312356');
    });

    it('should remove trailing punctuation', () => {
      expect(crawler.cleanDoi('10.1056/NEJMoa2312356.')).toBe('10.1056/NEJMoa2312356');
      expect(crawler.cleanDoi('10.1056/NEJMoa2312356,')).toBe('10.1056/NEJMoa2312356');
      expect(crawler.cleanDoi('10.1056/NEJMoa2312356;')).toBe('10.1056/NEJMoa2312356');
    });

    it('should handle complex DOIs with special characters', () => {
      expect(crawler.cleanDoi('10.1002/cncr.30720')).toBe('10.1002/cncr.30720');
      expect(crawler.cleanDoi('10.1038/s41586-022-05202-1')).toBe('10.1038/s41586-022-05202-1');
    });

    it('should return null for invalid DOI', () => {
      expect(crawler.cleanDoi('not-a-doi')).toBeNull();
      expect(crawler.cleanDoi('PMID:12345678')).toBeNull();
    });
  });

  describe('cleanPmid', () => {
    it('should return null for empty input', () => {
      expect(crawler.cleanPmid(null)).toBeNull();
      expect(crawler.cleanPmid(undefined)).toBeNull();
      expect(crawler.cleanPmid('')).toBeNull();
    });

    it('should extract numeric PMID', () => {
      expect(crawler.cleanPmid('12345678')).toBe('12345678');
    });

    it('should handle numeric input', () => {
      expect(crawler.cleanPmid(12345678)).toBe('12345678');
    });

    it('should remove PMID: prefix', () => {
      expect(crawler.cleanPmid('PMID:12345678')).toBe('12345678');
      expect(crawler.cleanPmid('PMID: 12345678')).toBe('12345678');
    });

    it('should extract PMID from URL', () => {
      expect(crawler.cleanPmid('https://pubmed.ncbi.nlm.nih.gov/12345678/')).toBe('12345678');
    });

    it('should return null for non-numeric input', () => {
      expect(crawler.cleanPmid('abc')).toBeNull();
      expect(crawler.cleanPmid('   ')).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should include publication-index source', () => {
      const status = crawler.getStatus();
      expect(status.source).toBe('publication-index');
    });

    it('should include dryRun flag', () => {
      const status = crawler.getStatus();
      expect(status.dryRun).toBe(true);
    });

    it('should include sourceFilter when set', () => {
      const filteredCrawler = new PublicationIndexCrawler({
        sourceKey: 'test_source',
        dryRun: true
      });
      const status = filteredCrawler.getStatus();
      expect(status.sourceFilter).toBe('test_source');
    });
  });
});

describe('JSON parsing in extractPublications', () => {
  // Test the JSON parsing logic separately

  function parseClaudeResponse(responseText) {
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);

    let publications;
    if (arrayMatch) {
      publications = JSON.parse(arrayMatch[0]);
    } else if (objectMatch) {
      const obj = JSON.parse(objectMatch[0]);
      publications = obj.publications || [obj];
    } else {
      return [];
    }

    if (!Array.isArray(publications)) {
      publications = [publications];
    }

    return publications;
  }

  it('should parse JSON array response', () => {
    const response = `[
      {"title": "Study 1", "authors": "Smith et al"},
      {"title": "Study 2", "authors": "Jones et al"}
    ]`;
    const result = parseClaudeResponse(response);
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Study 1');
    expect(result[1].title).toBe('Study 2');
  });

  it('should parse JSON object with publications array', () => {
    const response = `{"publications": [
      {"title": "Study 1", "authors": "Smith et al"}
    ]}`;
    const result = parseClaudeResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Study 1');
  });

  it('should parse single object as array', () => {
    const response = `{"title": "Single Study", "authors": "Smith et al"}`;
    const result = parseClaudeResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Single Study');
  });

  it('should handle markdown code fences', () => {
    const response = '```json\n[{"title": "Fenced Study"}]\n```';
    const result = parseClaudeResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Fenced Study');
  });

  it('should handle code fences without json specifier', () => {
    const response = '```\n[{"title": "Plain Fenced"}]\n```';
    const result = parseClaudeResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Plain Fenced');
  });

  it('should handle explanatory text before JSON', () => {
    const response = `Here are the publications I found:

    [{"title": "After Text"}]`;
    const result = parseClaudeResponse(response);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('After Text');
  });

  it('should return empty array for invalid JSON', () => {
    const response = 'No valid JSON here';
    const result = parseClaudeResponse(response);
    expect(result).toEqual([]);
  });

  it('should handle empty array', () => {
    const response = '[]';
    const result = parseClaudeResponse(response);
    expect(result).toEqual([]);
  });
});
