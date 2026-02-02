import { describe, it, expect, beforeAll } from 'vitest';
import { triageArticle, batchTriage, isRelevant } from '../../src/triage/mrd-triage.js';

describe('MRD AI Triage', () => {
  beforeAll(() => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY required for triage tests');
    }
  });

  it('scores high-relevance MRD article correctly', async () => {
    const article = {
      pmid: '12345678',
      title: 'Circulating Tumor DNA for Minimal Residual Disease Detection in Colorectal Cancer',
      abstract: 'This phase III randomized trial evaluated ctDNA-guided adjuvant therapy decisions in stage III colorectal cancer patients. ctDNA-positive patients had significantly worse outcomes. Signatera testing was used for MRD detection.',
      publicationTypes: ['Randomized Controlled Trial'],
      meshTerms: ['Colorectal Neoplasms', 'Circulating Tumor DNA', 'Neoplasm, Residual'],
    };

    const result = await triageArticle(article);
    expect(result.score).toBeGreaterThanOrEqual(7);
    expect(result.cancer_types).toContain('colorectal');
    expect(result.is_trial_result).toBe(true);
    expect(result.reason).toBeDefined();
    expect(result.model).toBeDefined();
    expect(result.triaged_at).toBeDefined();
  }, 30000);

  it('scores low-relevance article correctly', async () => {
    const article = {
      pmid: '99999999',
      title: 'Surgical Techniques in Breast Cancer',
      abstract: 'This review discusses various surgical approaches for breast-conserving therapy and mastectomy techniques.',
      publicationTypes: ['Review'],
      meshTerms: ['Breast Neoplasms', 'Surgery'],
    };

    const result = await triageArticle(article);
    expect(result.score).toBeLessThan(6);
  }, 30000);

  it('identifies guidelines correctly', async () => {
    const article = {
      pmid: '11111111',
      title: 'NCCN Guidelines for MRD Testing in Solid Tumors',
      abstract: 'The National Comprehensive Cancer Network presents updated recommendations for circulating tumor DNA-based minimal residual disease testing in stage III colorectal cancer patients following curative-intent surgery.',
      publicationTypes: ['Guideline', 'Practice Guideline'],
      meshTerms: ['Practice Guidelines as Topic', 'Colorectal Neoplasms', 'Circulating Tumor DNA'],
    };

    const result = await triageArticle(article);
    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.is_guideline).toBe(true);
  }, 30000);

  it('handles meta-analysis appropriately', async () => {
    const article = {
      pmid: '22222222',
      title: 'Prognostic Value of ctDNA for Recurrence in Early-Stage Colorectal Cancer: A Meta-Analysis',
      abstract: 'We performed a systematic review and meta-analysis of studies evaluating circulating tumor DNA as a biomarker for recurrence prediction in stage II-III colorectal cancer patients after curative surgery. Pooled analysis showed ctDNA positivity is associated with significantly higher recurrence rates.',
      publicationTypes: ['Meta-Analysis', 'Systematic Review'],
      meshTerms: ['Colorectal Neoplasms', 'Circulating Tumor DNA', 'Prognosis'],
    };

    const result = await triageArticle(article);
    expect(result.score).toBeGreaterThanOrEqual(7);
  }, 30000);

  it('rejects hematologic malignancy content', async () => {
    const article = {
      pmid: '33333333',
      title: 'MRD Assessment in Acute Lymphoblastic Leukemia',
      abstract: 'Flow cytometry-based minimal residual disease detection in pediatric ALL patients...',
      publicationTypes: ['Clinical Trial'],
      meshTerms: ['Leukemia, Lymphoid', 'Minimal Residual Disease'],
    };

    const result = await triageArticle(article);
    expect(result.score).toBeLessThan(4);
  }, 30000);
});

describe('Batch Triage', () => {
  beforeAll(() => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY required for triage tests');
    }
  });

  it('processes batch of articles', async () => {
    const articles = [
      {
        pmid: '44444444',
        title: 'ctDNA surveillance after colorectal cancer surgery',
        abstract: 'Prospective study of ctDNA monitoring in stage III CRC...',
        publicationTypes: ['Clinical Trial'],
        meshTerms: ['Colorectal Neoplasms', 'Circulating Tumor DNA'],
      },
      {
        pmid: '55555555',
        title: 'Dietary factors in cancer prevention',
        abstract: 'Review of nutritional approaches to reduce cancer risk...',
        publicationTypes: ['Review'],
        meshTerms: ['Diet', 'Neoplasms'],
      },
    ];

    const result = await batchTriage(articles, { minScore: 5 });

    expect(result.stats.total).toBe(2);
    expect(result.passed.length + result.failed.length +
           (result.results.length - result.passed.length)).toBe(2);
    expect(result.stats.avgScore).toBeDefined();
  }, 60000);
});

describe('Quick Relevance Check', () => {
  beforeAll(() => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY required for triage tests');
    }
  });

  it('returns boolean for relevance check', async () => {
    const article = {
      pmid: '66666666',
      title: 'Signatera for MRD Detection in Colon Cancer',
      abstract: 'ctDNA-based tumor-informed approach for surveillance...',
      publicationTypes: ['Clinical Trial'],
      meshTerms: ['Colorectal Neoplasms', 'Circulating Tumor DNA'],
    };

    const result = await isRelevant(article, 5);
    expect(typeof result).toBe('boolean');
  }, 30000);
});
