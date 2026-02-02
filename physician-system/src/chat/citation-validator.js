/**
 * Citation Validator
 * Ensures every clinical claim has a citation to prevent hallucination
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('citation-validator');

// Patterns that indicate clinical claims requiring citations
const CLINICAL_CLAIM_PATTERNS = [
  // Recommendation language
  /\b(recommend|should|indicated|suggests?|evidence shows?|studies show)\b/i,
  // Efficacy claims
  /\b(effective|superior|preferred|first-line|standard of care)\b/i,
  // Outcome data
  /\b(\d+%|\d+ percent|hazard ratio|odds ratio|p\s*[<=]\s*0\.\d+)\b/i,
  // Clinical metrics
  /\b(survival|recurrence|response rate|sensitivity|specificity|progression)\b.*\b\d/i,
  // Treatment recommendations
  /\b(treatment|therapy|regimen|protocol)\b.*\b(improve|benefit|reduce)\b/i,
  // Guideline references without citation
  /\b(guideline|nccn|asco|esmo)\b.*\b(state|recommend|suggest)\b/i,
];

// Patterns for sentences that don't need citations (meta-language)
const EXEMPT_PATTERNS = [
  /^(however|additionally|furthermore|in summary|to summarize)/i,
  /\b(I don't have|no evidence in|not addressed|cannot determine|insufficient)\b/i,
  /\b(discuss with|consult|speak to|talk to)\b.*\b(physician|oncologist|team)\b/i,
  /^(sources?|references?|citations?):/i,
  /^\*\*?(WHAT|GUIDELINE|CLINICAL|LIMITATION)/i,
];

const CITATION_PATTERN = /\[\d+\]/g;

/**
 * Check if a sentence contains a clinical claim that needs citation
 */
function needsCitation(sentence) {
  // Skip exempt patterns
  if (EXEMPT_PATTERNS.some(p => p.test(sentence))) {
    return false;
  }

  // Check for clinical claims
  return CLINICAL_CLAIM_PATTERNS.some(p => p.test(sentence));
}

/**
 * Validate that all clinical claims have citations
 */
export function validateCitations(response, sources) {
  // Split into sentences, preserving structure
  const sentences = response.split(/(?<=[.!?])\s+/);
  const violations = [];

  for (const sentence of sentences) {
    if (sentence.length < 10) continue; // Skip very short fragments

    const hasClinicalClaim = needsCitation(sentence);
    const hasCitation = CITATION_PATTERN.test(sentence);

    if (hasClinicalClaim && !hasCitation) {
      violations.push({
        sentence: sentence.trim(),
        reason: 'Clinical claim without citation',
        patterns: CLINICAL_CLAIM_PATTERNS
          .filter(p => p.test(sentence))
          .map(p => p.source.substring(0, 30)),
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    stats: {
      totalSentences: sentences.length,
      clinicalClaims: sentences.filter(needsCitation).length,
      citedClaims: sentences.filter(s => needsCitation(s) && CITATION_PATTERN.test(s)).length,
    },
  };
}

/**
 * Rewrite response to add citations or express uncertainty
 */
export async function rewriteWithCitations(response, violations, sources) {
  const anthropic = new Anthropic();

  const sourceSummary = sources.map((s, i) =>
    `[${i + 1}] ${s.title} (${s.sourceType}, ${s.evidenceType || 'unknown'})`
  ).join('\n');

  const violationList = violations.map(v => `- "${v.sentence}"`).join('\n');

  const prompt = `You are editing a medical information response to ensure every clinical claim has a citation.

ORIGINAL RESPONSE:
${response}

SENTENCES NEEDING CITATIONS OR REWORDING:
${violationList}

AVAILABLE SOURCES:
${sourceSummary}

RULES:
1. For each flagged sentence, either:
   a) Add a citation [N] if a source supports the claim
   b) Rephrase to express uncertainty: "The indexed evidence does not specifically address..." or "Based on the available sources, it is unclear whether..."
2. Do NOT invent claims or citations
3. Do NOT remove valid information
4. Keep the same overall structure
5. Preserve all existing citations

Return ONLY the revised response, no explanations.`;

  try {
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const rewritten = result.content[0].text;

    // Validate the rewrite
    const revalidation = validateCitations(rewritten, sources);

    if (!revalidation.valid) {
      logger.warn('Rewrite still has violations', {
        remaining: revalidation.violations.length,
      });
    }

    return rewritten;
  } catch (error) {
    logger.error('Failed to rewrite response', { error: error.message });
    // Return original with warning prepended
    return `**Note: Some claims may not have citations in the indexed sources.**\n\n${response}`;
  }
}

/**
 * Validate and fix response citations
 * Returns the validated (and possibly rewritten) response
 */
export async function ensureCitationCompliance(response, sources) {
  const validation = validateCitations(response, sources);

  if (validation.valid) {
    logger.debug('Citation validation passed', validation.stats);
    return { response, wasRewritten: false, stats: validation.stats };
  }

  logger.info('Citation violations detected, rewriting', {
    violations: validation.violations.length,
  });

  const rewritten = await rewriteWithCitations(response, validation.violations, sources);

  return {
    response: rewritten,
    wasRewritten: true,
    originalViolations: validation.violations.length,
    stats: validateCitations(rewritten, sources).stats,
  };
}

export default {
  validateCitations,
  rewriteWithCitations,
  ensureCitationCompliance,
};
