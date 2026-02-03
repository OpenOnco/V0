/**
 * Unit tests for publication extraction prompts
 */

import { describe, it, expect } from 'vitest';
import {
  EVIDENCE_TYPES,
  GUARDRAILS,
  getPromptForSourceType,
  getGuardrailForSourceType,
  formatContentForPrompt,
  VENDOR_PUBLICATIONS_INDEX,
  VENDOR_EVIDENCE_PAGE,
  SOCIETY_EDITORIAL,
  NEWS_REVIEW,
  GUIDELINE_REFERENCES,
} from '../src/prompts.js';

describe('EVIDENCE_TYPES', () => {
  it('should have all required evidence types', () => {
    expect(EVIDENCE_TYPES).toHaveProperty('RCT_RESULTS', 'rct_results');
    expect(EVIDENCE_TYPES).toHaveProperty('OBSERVATIONAL', 'observational');
    expect(EVIDENCE_TYPES).toHaveProperty('META_ANALYSIS', 'meta_analysis');
    expect(EVIDENCE_TYPES).toHaveProperty('GUIDELINE', 'guideline');
    expect(EVIDENCE_TYPES).toHaveProperty('CONSENSUS', 'consensus');
    expect(EVIDENCE_TYPES).toHaveProperty('REVIEW', 'review');
  });
});

describe('GUARDRAILS', () => {
  it('should have guardrails for society editorials', () => {
    expect(GUARDRAILS.society_editorial).toContain('Society editorial');
  });

  it('should have guardrails for news reviews', () => {
    expect(GUARDRAILS.news_review).toContain('Secondary source');
  });

  it('should have guardrails for vendor guideline excerpts', () => {
    expect(GUARDRAILS.vendor_guideline_excerpt).toContain('Vendor-hosted');
  });
});

describe('getPromptForSourceType', () => {
  it('should return vendor publications index prompt for vendor_publications_index', () => {
    const prompt = getPromptForSourceType('vendor_publications_index');
    expect(prompt).toBe(VENDOR_PUBLICATIONS_INDEX);
    expect(prompt).toContain('Vendor Publications Index');
  });

  it('should return vendor evidence page prompt for vendor_evidence_page', () => {
    const prompt = getPromptForSourceType('vendor_evidence_page');
    expect(prompt).toBe(VENDOR_EVIDENCE_PAGE);
    expect(prompt).toContain('Vendor Evidence Overview');
  });

  it('should return society editorial prompt for society_editorial', () => {
    const prompt = getPromptForSourceType('society_editorial');
    expect(prompt).toBe(SOCIETY_EDITORIAL);
    expect(prompt).toContain('Society Editorial');
  });

  it('should return news review prompt for news_review', () => {
    const prompt = getPromptForSourceType('news_review');
    expect(prompt).toBe(NEWS_REVIEW);
    expect(prompt).toContain('News Article or Review');
  });

  it('should return guideline references prompt for guideline_references', () => {
    const prompt = getPromptForSourceType('guideline_references');
    expect(prompt).toBe(GUIDELINE_REFERENCES);
    expect(prompt).toContain('Clinical Guideline');
  });

  it('should default to vendor publications index for unknown types', () => {
    const prompt = getPromptForSourceType('unknown_type');
    expect(prompt).toBe(VENDOR_PUBLICATIONS_INDEX);
  });
});

describe('getGuardrailForSourceType', () => {
  it('should return guardrail for society_editorial', () => {
    const guardrail = getGuardrailForSourceType('society_editorial');
    expect(guardrail).toBe(GUARDRAILS.society_editorial);
  });

  it('should return guardrail for news_review', () => {
    const guardrail = getGuardrailForSourceType('news_review');
    expect(guardrail).toBe(GUARDRAILS.news_review);
  });

  it('should return null for unknown source types', () => {
    const guardrail = getGuardrailForSourceType('vendor');
    expect(guardrail).toBeNull();
  });

  it('should return null for undefined', () => {
    const guardrail = getGuardrailForSourceType(undefined);
    expect(guardrail).toBeNull();
  });
});

describe('formatContentForPrompt', () => {
  it('should return empty string for empty input', () => {
    expect(formatContentForPrompt('')).toBe('');
    expect(formatContentForPrompt(null)).toBe('');
    expect(formatContentForPrompt(undefined)).toBe('');
  });

  it('should collapse multiple whitespace', () => {
    const input = 'Hello    world   test';
    const result = formatContentForPrompt(input);
    expect(result).toBe('Hello world test');
  });

  it('should collapse multiple whitespace including newlines', () => {
    const input = 'Hello\n\n\n\n\nworld';
    const result = formatContentForPrompt(input);
    // The function collapses all whitespace, including newlines
    expect(result).toBe('Hello world');
  });

  it('should trim content', () => {
    const input = '   Hello world   ';
    const result = formatContentForPrompt(input);
    expect(result).toBe('Hello world');
  });

  it('should truncate content exceeding maxLength', () => {
    const input = 'a'.repeat(20000);
    const result = formatContentForPrompt(input, 15000);
    expect(result.length).toBeLessThan(input.length);
    expect(result).toContain('[Content truncated...]');
  });

  it('should not truncate content within maxLength', () => {
    const input = 'a'.repeat(1000);
    const result = formatContentForPrompt(input, 15000);
    expect(result).toBe(input);
    expect(result).not.toContain('[Content truncated...]');
  });

  it('should use custom maxLength', () => {
    const input = 'a'.repeat(500);
    const result = formatContentForPrompt(input, 100);
    expect(result.length).toBeLessThan(input.length);
    expect(result).toContain('[Content truncated...]');
  });
});

describe('Prompt templates', () => {
  it('all prompts should contain {content} placeholder', () => {
    expect(VENDOR_PUBLICATIONS_INDEX).toContain('{content}');
    expect(VENDOR_EVIDENCE_PAGE).toContain('{content}');
    expect(SOCIETY_EDITORIAL).toContain('{content}');
    expect(NEWS_REVIEW).toContain('{content}');
    expect(GUIDELINE_REFERENCES).toContain('{content}');
  });

  it('all prompts should request JSON array output', () => {
    expect(VENDOR_PUBLICATIONS_INDEX).toContain('JSON array');
    expect(VENDOR_EVIDENCE_PAGE).toContain('JSON array');
    expect(SOCIETY_EDITORIAL).toContain('JSON array');
    expect(NEWS_REVIEW).toContain('JSON array');
    expect(GUIDELINE_REFERENCES).toContain('JSON array');
  });

  it('all prompts should include extraction fields', () => {
    const requiredFields = ['title', 'authors', 'journal', 'year', 'doi', 'pmid'];
    for (const field of requiredFields) {
      expect(VENDOR_PUBLICATIONS_INDEX).toContain(field);
    }
  });
});
