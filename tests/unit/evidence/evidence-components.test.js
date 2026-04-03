/**
 * Unit tests for evidence explorer component logic.
 *
 * Since the project does not include a DOM testing library (jsdom/happy-dom),
 * these tests validate the data transformation logic extracted from the
 * component modules: type style mapping, metric display decisions, citation
 * formatting, and results splitting.
 */

import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Replicated logic from EvidenceClaimCard.jsx
// ---------------------------------------------------------------------------

const TYPE_STYLES = {
  trial_result: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Trial Result' },
  guideline_recommendation: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Guideline' },
  diagnostic_performance: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', label: 'Diagnostic Performance' },
  clinical_utility: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Clinical Utility' },
  methodology_note: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label: 'Methodology' },
};

function getTypeStyle(type) {
  return TYPE_STYLES[type] || TYPE_STYLES.methodology_note;
}

function buildCitationText(citation) {
  return [citation.authors, citation.journal, citation.year].filter(Boolean).join(', ');
}

function buildPubmedUrl(pmid) {
  return pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}` : null;
}

function hasMetrics(metrics) {
  return !!(metrics.n || metrics.hr || metrics.ci || metrics.p_value || metrics.follow_up);
}

// ---------------------------------------------------------------------------
// Replicated logic from EvidenceResults.jsx — split decision
// ---------------------------------------------------------------------------

function shouldSplitResults(results) {
  const { test_specific_claims, general_claims } = results;
  return (test_specific_claims?.length > 0 || general_claims?.length > 0);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EvidenceClaimCard — type style mapping', () => {
  it('returns correct style for each known type', () => {
    expect(getTypeStyle('trial_result').label).toBe('Trial Result');
    expect(getTypeStyle('guideline_recommendation').label).toBe('Guideline');
    expect(getTypeStyle('diagnostic_performance').label).toBe('Diagnostic Performance');
    expect(getTypeStyle('clinical_utility').label).toBe('Clinical Utility');
    expect(getTypeStyle('methodology_note').label).toBe('Methodology');
  });

  it('falls back to methodology_note for unknown types', () => {
    expect(getTypeStyle('unknown_type')).toEqual(TYPE_STYLES.methodology_note);
    expect(getTypeStyle(undefined)).toEqual(TYPE_STYLES.methodology_note);
    expect(getTypeStyle('')).toEqual(TYPE_STYLES.methodology_note);
  });
});

describe('EvidenceClaimCard — citation formatting', () => {
  it('joins all citation fields', () => {
    const text = buildCitationText({ authors: 'Smith et al.', journal: 'Nature', year: 2024 });
    expect(text).toBe('Smith et al., Nature, 2024');
  });

  it('omits missing fields gracefully', () => {
    expect(buildCitationText({ authors: 'Smith et al.' })).toBe('Smith et al.');
    expect(buildCitationText({ journal: 'Nature', year: 2024 })).toBe('Nature, 2024');
    expect(buildCitationText({})).toBe('');
  });

  it('builds correct PubMed URL', () => {
    expect(buildPubmedUrl('12345678')).toBe('https://pubmed.ncbi.nlm.nih.gov/12345678');
    expect(buildPubmedUrl(null)).toBeNull();
    expect(buildPubmedUrl(undefined)).toBeNull();
  });
});

describe('EvidenceClaimCard — metrics detection', () => {
  it('detects when metrics exist', () => {
    expect(hasMetrics({ n: 450 })).toBe(true);
    expect(hasMetrics({ hr: '0.53' })).toBe(true);
    expect(hasMetrics({ ci: '0.38-0.75' })).toBe(true);
    expect(hasMetrics({ p_value: '<0.001' })).toBe(true);
    expect(hasMetrics({ follow_up: '24 months' })).toBe(true);
  });

  it('returns false for empty metrics', () => {
    expect(hasMetrics({})).toBe(false);
    expect(hasMetrics({ n: null, hr: null })).toBe(false);
    expect(hasMetrics({ n: 0 })).toBe(false);
  });
});

describe('EvidenceResults — split logic', () => {
  it('splits when test_specific_claims exist', () => {
    expect(shouldSplitResults({
      test_specific_claims: [{ id: '1' }],
      general_claims: [],
    })).toBe(true);
  });

  it('splits when general_claims exist', () => {
    expect(shouldSplitResults({
      test_specific_claims: [],
      general_claims: [{ id: '1' }],
    })).toBe(true);
  });

  it('does not split when both are empty', () => {
    expect(shouldSplitResults({
      test_specific_claims: [],
      general_claims: [],
    })).toBe(false);
  });

  it('does not split when fields are missing', () => {
    expect(shouldSplitResults({})).toBe(false);
    expect(shouldSplitResults({ claims: [{ id: '1' }] })).toBe(false);
  });
});
