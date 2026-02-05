/**
 * Tests for PDF structured data extraction and diffing
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PayerCrawler } from '../../../src/crawlers/payers.js';

// Create a crawler instance to test methods
let crawler;
beforeAll(() => {
  crawler = new PayerCrawler();
});

describe('extractPdfStructuredData', () => {
  it('extracts PLA codes from text', () => {
    const text = `
      The following PLA codes are covered:
      0239U - Signatera
      0240U - Guardant360 CDx
      Regular text here 0500U another code.
    `;
    const result = crawler.extractPdfStructuredData(text);
    expect(result.plaCodes).toContain('0239U');
    expect(result.plaCodes).toContain('0240U');
    expect(result.plaCodes).toContain('0500U');
    expect(result.plaCodes.length).toBe(3);
  });

  it('extracts CPT codes (8XXXX pattern)', () => {
    const text = `
      CPT codes: 81479 (unlisted molecular pathology procedure)
      Also covered: 81455, 81450
      Not a CPT: 12345
    `;
    const result = crawler.extractPdfStructuredData(text);
    expect(result.cptCodes).toContain('81479');
    expect(result.cptCodes).toContain('81455');
    expect(result.cptCodes).toContain('81450');
    expect(result.cptCodes).not.toContain('12345');
  });

  it('extracts HCPCS codes', () => {
    const text = `
      HCPCS: G0452 molecular pathology interpretation
      S3854 gene expression profiling
    `;
    const result = crawler.extractPdfStructuredData(text);
    expect(result.hcpcsCodes).toContain('G0452');
    expect(result.hcpcsCodes).toContain('S3854');
  });

  it('deduplicates codes', () => {
    const text = `
      PLA: 0239U is covered. Per section 3, 0239U is also listed.
      CPT: 81479 and 81479 repeated.
    `;
    const result = crawler.extractPdfStructuredData(text);
    expect(result.plaCodes.filter(c => c === '0239U').length).toBe(1);
    expect(result.cptCodes.filter(c => c === '81479').length).toBe(1);
  });

  it('extracts coverage criteria sentences', () => {
    const text = `
      Signatera is considered medically necessary when used for surveillance of colorectal cancer.
      Multi-cancer early detection testing is considered investigational for all indications.
      Prior authorization required for all ctDNA panel tests.
      FoundationOne Liquid CDx is not covered for screening purposes.
    `;
    const result = crawler.extractPdfStructuredData(text);
    expect(result.coverageCriteria.length).toBeGreaterThan(0);
    expect(result.coverageCriteria.some(c => c.includes('medically necessary'))).toBe(true);
    expect(result.coverageCriteria.some(c => c.includes('investigational'))).toBe(true);
  });

  it('returns null for null/empty input', () => {
    expect(crawler.extractPdfStructuredData(null)).toBeNull();
    expect(crawler.extractPdfStructuredData('')).toBeNull();
  });

  it('handles text with no codes gracefully', () => {
    const text = 'This policy covers general testing procedures without specific codes.';
    const result = crawler.extractPdfStructuredData(text);
    expect(result.plaCodes).toEqual([]);
    expect(result.cptCodes).toEqual([]);
    expect(result.codeCount).toBe(0);
  });

  it('computes codeCount correctly', () => {
    const text = '0239U 0240U 81479 G0452';
    const result = crawler.extractPdfStructuredData(text);
    expect(result.codeCount).toBe(result.plaCodes.length + result.cptCodes.length + result.hcpcsCodes.length);
  });
});

describe('diffPdfStructuredData', () => {
  it('reports new document when previous is null', () => {
    const current = {
      plaCodes: ['0239U', '0240U'],
      cptCodes: ['81479'],
      hcpcsCodes: ['G0452'],
      namedTests: [{ id: 'mrd-7', name: 'Signatera', confidence: 0.9 }],
      coverageCriteria: ['Medically necessary for CRC.'],
      sections: [],
      codeCount: 4,
    };

    const diff = crawler.diffPdfStructuredData(null, current);
    expect(diff.isNew).toBe(true);
    expect(diff.addedCodes.pla).toEqual(['0239U', '0240U']);
    expect(diff.addedCodes.cpt).toEqual(['81479']);
    expect(diff.removedCodes.pla).toEqual([]);
    expect(diff.summary).toContain('New document');
  });

  it('detects added PLA codes', () => {
    const previous = {
      plaCodes: ['0239U'],
      cptCodes: ['81479'],
      hcpcsCodes: [],
      namedTests: [],
      coverageCriteria: [],
      sections: [],
    };
    const current = {
      plaCodes: ['0239U', '0240U', '0500U'],
      cptCodes: ['81479'],
      hcpcsCodes: [],
      namedTests: [],
      coverageCriteria: [],
      sections: [],
    };

    const diff = crawler.diffPdfStructuredData(previous, current);
    expect(diff.isNew).toBe(false);
    expect(diff.addedCodes.pla).toEqual(['0240U', '0500U']);
    expect(diff.removedCodes.pla).toEqual([]);
    expect(diff.summary).toContain('+2 PLA codes');
    expect(diff.summary).toContain('0240U');
  });

  it('detects removed PLA codes', () => {
    const previous = {
      plaCodes: ['0239U', '0240U', '0500U'],
      cptCodes: [],
      hcpcsCodes: [],
      namedTests: [],
      coverageCriteria: [],
      sections: [],
    };
    const current = {
      plaCodes: ['0239U'],
      cptCodes: [],
      hcpcsCodes: [],
      namedTests: [],
      coverageCriteria: [],
      sections: [],
    };

    const diff = crawler.diffPdfStructuredData(previous, current);
    expect(diff.removedCodes.pla).toEqual(['0240U', '0500U']);
    expect(diff.summary).toContain('-2 PLA codes');
  });

  it('detects added named tests', () => {
    const previous = {
      plaCodes: [],
      cptCodes: [],
      hcpcsCodes: [],
      namedTests: [{ id: 'mrd-7', name: 'Signatera', confidence: 0.9 }],
      coverageCriteria: [],
      sections: [],
    };
    const current = {
      plaCodes: [],
      cptCodes: [],
      hcpcsCodes: [],
      namedTests: [
        { id: 'mrd-7', name: 'Signatera', confidence: 0.9 },
        { id: 'mrd-6', name: 'Guardant Reveal', confidence: 0.85 },
      ],
      coverageCriteria: [],
      sections: [],
    };

    const diff = crawler.diffPdfStructuredData(previous, current);
    expect(diff.addedTests).toHaveLength(1);
    expect(diff.addedTests[0].name).toBe('Guardant Reveal');
    expect(diff.summary).toContain('+1 named tests');
  });

  it('reports no changes for identical extractions', () => {
    const data = {
      plaCodes: ['0239U'],
      cptCodes: ['81479'],
      hcpcsCodes: [],
      namedTests: [{ id: 'mrd-7', name: 'Signatera' }],
      coverageCriteria: ['Covered for CRC.'],
      sections: [],
    };

    const diff = crawler.diffPdfStructuredData(data, data);
    expect(diff.addedCodes.pla).toEqual([]);
    expect(diff.removedCodes.pla).toEqual([]);
    expect(diff.addedTests).toEqual([]);
    expect(diff.removedTests).toEqual([]);
    expect(diff.summary).toContain('no code or named test differences');
  });

  it('detects mixed adds and removes across code types', () => {
    const previous = {
      plaCodes: ['0239U'],
      cptCodes: ['81479', '81455'],
      hcpcsCodes: ['G0452'],
      namedTests: [],
      coverageCriteria: [],
      sections: [],
    };
    const current = {
      plaCodes: ['0239U', '0500U'],
      cptCodes: ['81479'],
      hcpcsCodes: ['G0452', 'S3854'],
      namedTests: [],
      coverageCriteria: [],
      sections: [],
    };

    const diff = crawler.diffPdfStructuredData(previous, current);
    expect(diff.addedCodes.pla).toEqual(['0500U']);
    expect(diff.removedCodes.cpt).toEqual(['81455']);
    expect(diff.addedCodes.hcpcs).toEqual(['S3854']);
    expect(diff.summary).toContain('+1 PLA codes');
    expect(diff.summary).toContain('-1 CPT codes');
    expect(diff.summary).toContain('+1 HCPCS codes');
  });
});
