/**
 * Citation Validator
 * Ensures every clinical claim has a citation to prevent hallucination
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../utils/logger.js';
import { STUDY_ASSAY_REGISTRY } from './study-assay-registry.js';

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

// Patterns for sentences that don't need citations (meta-language, connective prose)
const EXEMPT_PATTERNS = [
  /^(however|additionally|furthermore|in summary|to summarize)/i,
  /\b(I don't have|no evidence in|not addressed|cannot determine|insufficient)\b/i,
  /\b(discuss with|consult|speak to|talk to)\b.*\b(physician|oncologist|team)\b/i,
  /^(sources?|references?|citations?):/i,
  /^\*\*?(WHAT|GUIDELINE|CLINICAL|LIMITATION)/i,
  // Interpretive/connective prose — reasoning that follows a cited claim
  /^this (suggests?|implies?|highlights?|supports?|indicates?|means|raises|underscores)/i,
  /^these (data|findings|results|trials?) (suggest|indicate|highlight|support|demonstrate)/i,
  /^(such|given|since|while|although|importantly|notably|critically)\b/i,
  // Cross-indication warnings
  /^⚠️/,
  /CROSS-INDICATION/i,
  // Evidence gap framing (not claims, just noting what's unknown)
  /\b(remains? (unclear|undefined|unstudied|unknown|investigational|unproven))\b/i,
  /\b(no (completed )?(RCT|randomized|prospective|trial) has (yet )?(demonstrated|established|validated|shown))\b/i,
  /\b(may exist outside this database)\b/i,
  /\b(consider a targeted literature search)\b/i,
  // General medical knowledge (physicians know these without citations)
  /\bstandard (of care|approach|surveillance|guidelines?)\b.*\b(remains?|is|are|include)\b/i,
  /\b(established|standard|conventional) (approach|surveillance|therapy|treatment|protocol)\b/i,
  /\bno (specific|established|validated) (guideline|guidance|protocol|recommendation)\b/i,
  /\bclinical (significance|implications?|relevance|utility) of\b.*\b(remains?|is|are) (unclear|uncertain|unknown|undefined|limited)\b/i,
  // Section headers and labels (DECISION:, OPTION A:, EVIDENCE GAPS:)
  /^(DECISION|OPTION\s+[A-Z]|EVIDENCE\s+GAPS|KEY\s+FINDINGS|WHAT\s+THE\s+EVIDENCE):/,
];

const CITATION_PATTERN = /\[\d+\]/g;

// Known landmark MRD trial names for study-name detection
const KNOWN_STUDY_NAMES = [
  'TRACERx', 'DYNAMIC', 'DYNAMIC-III', 'DYNAMIC-Rectal',
  'CIRCULATE-Japan', 'CIRCULATE', 'GALAXY', 'VEGA',
  'BESPOKE', 'COSMOS', 'MERMAID', 'c-TRAK',
  'monarchE', 'IMpower010', 'PEGASUS', 'CheckMate',
  'MEDOCC-CrEATE', 'ACT-3', 'COBRA', 'NRG-GI005',
  'ALTAIR', 'PRODIGE', 'CIRCULATE-US', 'IMPROVE-IT',
  'NivoMRD', 'TRACER', 'BESPOKE-CRC',
];

// Build a regex that matches known study names (case-insensitive, word boundary)
const STUDY_NAME_REGEX = new RegExp(
  '\\b(' + KNOWN_STUDY_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'gi'
);

// Patterns that indicate a study name is already verified
const VERIFIED_NEARBY = /\[\d+\]|PMID[:\s]*\d{7,8}|NCT\d{8}/;

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
 * Detect study names that appear without a citation or PMID nearby
 */
function detectUnverifiedStudyNames(sentence) {
  const matches = [];
  let m;
  STUDY_NAME_REGEX.lastIndex = 0;
  while ((m = STUDY_NAME_REGEX.exec(sentence)) !== null) {
    // Check if there's a citation/PMID/NCT nearby (within the same sentence)
    if (!VERIFIED_NEARBY.test(sentence)) {
      matches.push(m[1]);
    }
  }
  return matches;
}

/**
 * Validate that all clinical claims have citations
 */
export function validateCitations(response, sources) {
  // Strip REFERENCES section — study names in ref titles are not violations
  const mainBody = response.replace(/\nREFERENCES:\n[\s\S]*$/, '');

  // Split into sentences, preserving structure
  const sentences = mainBody.split(/(?<=[.!?])\s+/);
  const violations = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (sentence.length < 10) continue; // Skip very short fragments

    const hasClinicalClaim = needsCitation(sentence);
    const hasCitation = CITATION_PATTERN.test(sentence);

    if (hasClinicalClaim && !hasCitation) {
      // Adjacency check: if the previous or next sentence cites a source,
      // this sentence may be interpreting that cited finding — don't flag it
      const prevHasCitation = i > 0 && CITATION_PATTERN.test(sentences[i - 1]);
      const nextHasCitation = i < sentences.length - 1 && CITATION_PATTERN.test(sentences[i + 1]);
      if (prevHasCitation || nextHasCitation) {
        continue; // Citation by proximity — common in medical prose
      }

      violations.push({
        sentence: sentence.trim(),
        reason: 'Clinical claim without citation',
        patterns: CLINICAL_CLAIM_PATTERNS
          .filter(p => p.test(sentence))
          .map(p => p.source.substring(0, 30)),
      });
    }

    // Second pass: detect unverified study names
    const unverifiedStudies = detectUnverifiedStudyNames(sentence);
    if (unverifiedStudies.length > 0) {
      violations.push({
        sentence: sentence.trim(),
        reason: 'Study name without citation or PMID',
        studyNames: unverifiedStudies,
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

  const prompt = `You are editing a medical information response to add inline citations where a source clearly supports the claim.

ORIGINAL RESPONSE:
${response}

SENTENCES THAT MAY NEED CITATIONS:
${violationList}

AVAILABLE SOURCES:
${sourceSummary}

RULES:
1. For each flagged sentence: add a citation [N] ONLY if a source clearly supports the specific claim
2. If no source supports the claim, LEAVE THE SENTENCE UNCHANGED — do not hedge, rephrase to uncertainty, or add qualifiers
3. Do NOT invent claims or citations
4. Do NOT remove valid information
5. Do NOT add phrases like "The indexed evidence does not specifically address" or "Based on the available sources, it is unclear"
6. Keep the same overall structure
7. Preserve all existing citations

Return ONLY the revised response, no explanations.`;

  try {
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    let rewritten = result.content[0].text;

    // Strip any prompt scaffolding that the LLM may have echoed back.
    // The rewrite prompt contains "SENTENCES NEEDING CITATIONS OR REWORDING:"
    // and "AVAILABLE SOURCES:" — if present in the output, truncate there.
    const scaffoldMarkers = [
      'SENTENCES NEEDING CITATIONS',
      'AVAILABLE SOURCES:',
      'RULES:\n1. For each flagged sentence',
    ];
    for (const marker of scaffoldMarkers) {
      const idx = rewritten.indexOf(marker);
      if (idx > 0) {
        logger.warn('Rewrite contained prompt scaffolding, truncating', { marker });
        rewritten = rewritten.substring(0, idx).trimEnd();
      }
    }

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
 * Validate and fix response citations.
 * Pipeline: LLM rewrite → deterministic injection → coverage score.
 * Returns the validated (and possibly rewritten) response.
 */
export async function ensureCitationCompliance(response, sources) {
  const validation = validateCitations(response, sources);

  let current = response;
  let wasRewritten = false;

  // Phase 1: LLM-based rewrite if violations found
  if (!validation.valid) {
    logger.info('Citation violations detected, rewriting', {
      violations: validation.violations.length,
    });
    current = await rewriteWithCitations(current, validation.violations, sources);
    wasRewritten = true;
  }

  // Phase 2: Deterministic citation injection (high-precision fallback)
  const injection = injectDeterministicCitations(current, sources);
  if (injection.injected > 0) {
    current = injection.answer;
    wasRewritten = true;
  }

  // Phase 2b: Strip "[test data]" pseudo-citations
  // These come from vendor-reported performance metrics injected via OpenOnco
  // test data — they have no PMID and make the system look unreliable.
  const beforeTestDataStrip = current;
  current = current.replace(/\s*\[test\s*data\]/gi, '');
  if (current !== beforeTestDataStrip) {
    logger.info('Stripped [test data] pseudo-citations');
    wasRewritten = true;
  }

  // Phase 2c: Quantitative citation injection
  // Inject [N] citations into uncited sentences with HRs, percentages, p-values
  const quantInjection = injectQuantitativeCitations(current, sources);
  if (quantInjection.injected > 0) {
    current = quantInjection.answer;
    wasRewritten = true;
  }

  // Phase 3: Strip out-of-scope content (insurance, coverage, payer details)
  current = stripOutOfScopeContent(current);

  // Phase 4: Compute coverage score
  const coverage = citationCoverageScore(current);

  const finalStats = validateCitations(current, sources).stats;

  return {
    response: current,
    wasRewritten,
    originalViolations: validation.violations.length,
    stats: finalStats,
    citationCoverage: coverage,
    deterministicInjections: injection.injected,
  };
}

// ============================================
// OUT-OF-SCOPE CONTENT STRIPPING
// ============================================

const INSURANCE_PATTERNS = [
  /\bmedicare\b/i,
  /\bLCD\b/,
  /\bL38\d{3}\b/,
  /\breimburse/i,
  /\bprior auth/i,
  /\bcommercial (coverage|payer)/i,
  /\bpayer[\s-]specific/i,
  /\bcoverage varies by payer/i,
  /\bcovered (by|under)\b/i,
  /\bcoverage (include|established|from|through|landscape)/i,
];

/**
 * Strip sentences containing insurance/coverage/payer content.
 * These details are out of scope for clinical decision support.
 */
export function stripOutOfScopeContent(answer) {
  // Don't touch REFERENCES section
  const refsMatch = answer.match(/\nREFERENCES:\n[\s\S]*$/);
  const mainBody = refsMatch ? answer.substring(0, answer.indexOf(refsMatch[0])) : answer;
  const refs = refsMatch ? refsMatch[0] : '';

  const sentences = mainBody.split(/(?<=[.!?])\s+/);
  let stripped = 0;

  const filtered = sentences.filter(s => {
    if (s.length < 15) return true; // Keep short fragments (headers, etc.)
    const isInsurance = INSURANCE_PATTERNS.some(p => p.test(s));
    if (isInsurance) {
      stripped++;
      return false;
    }
    return true;
  });

  if (stripped > 0) {
    logger.info('Stripped out-of-scope content', { sentencesRemoved: stripped });
  }

  return filtered.join(' ') + refs;
}

// ============================================
// DETERMINISTIC CITATION INJECTION (Step 2a)
// ============================================

// Build anchor terms from study-assay registry
const REGISTRY_ANCHORS = STUDY_ASSAY_REGISTRY.map(entry => ({
  term: entry.study,
  regex: new RegExp(`\\b${entry.study.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  fullName: entry.fullName,
}));

// Guideline anchor terms
const GUIDELINE_ANCHORS = [
  { term: 'NCCN', regex: /\bNCCN\b/i },
  { term: 'ASCO', regex: /\bASCO\b/i },
  { term: 'ESMO', regex: /\bESMO\b/i },
  { term: 'SITC', regex: /\bSITC\b/i },
  { term: 'CAP/AMP', regex: /\bCAP[/]AMP\b/i },
];

/**
 * Extract anchor terms from a sentence — trial names, guideline names,
 * drug+setting phrases that can be matched to sources.
 */
function extractAnchorTerms(sentence) {
  const anchors = [];

  // Check registry trial names
  for (const anchor of REGISTRY_ANCHORS) {
    if (anchor.regex.test(sentence)) {
      anchors.push({ type: 'trial', term: anchor.term });
    }
  }

  // Check guideline names
  for (const anchor of GUIDELINE_ANCHORS) {
    if (anchor.regex.test(sentence)) {
      anchors.push({ type: 'guideline', term: anchor.term });
    }
  }

  return anchors;
}

/**
 * Check if a source matches an anchor term (title or trial_acronym contains the term).
 */
function sourceMatchesAnchor(source, anchor) {
  const titleLower = (source.title || '').toLowerCase();
  const acronymLower = (source.trial_acronym || '').toLowerCase();
  const termLower = anchor.term.toLowerCase();
  const summaryLower = (source.summary || source.chunk_text || '').toLowerCase().substring(0, 500);

  if (anchor.type === 'trial') {
    return titleLower.includes(termLower) || acronymLower === termLower || summaryLower.includes(termLower);
  }
  if (anchor.type === 'guideline') {
    return titleLower.includes(termLower) || (source.source_type || '').toLowerCase() === termLower.toLowerCase();
  }
  return false;
}

/**
 * High-precision deterministic citation injection.
 * Runs AFTER the LLM rewriter as a fallback — only inserts citations
 * when the match is unambiguous (one source matches the anchor term).
 *
 * Wrong citations are worse than missing ones, so this is conservative.
 */
export function injectDeterministicCitations(answer, sources) {
  const sentences = answer.split(/(?<=[.!?])\s+/);
  let injected = 0;
  let skippedAmbiguous = 0;

  const result = sentences.map(sentence => {
    // Skip short fragments, already-cited sentences, exempt sentences
    if (sentence.length < 10) return sentence;
    if (CITATION_PATTERN.test(sentence)) return sentence;
    if (!needsCitation(sentence)) return sentence;

    // Extract anchor terms from this sentence
    const anchors = extractAnchorTerms(sentence);
    if (anchors.length === 0) return sentence;

    // For each anchor, find matching sources
    for (const anchor of anchors) {
      const matchingSources = sources
        .map((s, i) => ({ source: s, index: i + 1 }))
        .filter(({ source }) => sourceMatchesAnchor(source, anchor));

      // Only inject if exactly one source matches (unambiguous)
      if (matchingSources.length === 1) {
        const citationTag = `[${matchingSources[0].index}]`;
        // Insert citation at end of sentence (before period)
        const trimmed = sentence.trimEnd();
        const lastChar = trimmed[trimmed.length - 1];
        if ('.!?'.includes(lastChar)) {
          sentence = trimmed.slice(0, -1) + ' ' + citationTag + lastChar;
        } else {
          sentence = trimmed + ' ' + citationTag;
        }
        injected++;
        break; // One citation per sentence is enough
      } else if (matchingSources.length > 1) {
        skippedAmbiguous++;
      }
    }

    return sentence;
  });

  const modified = result.join(' ');

  if (injected > 0 || skippedAmbiguous > 0) {
    logger.info('Deterministic citation injection', {
      injected,
      skippedAmbiguous,
    });
  }

  return { answer: modified, injected, skippedAmbiguous };
}

// ============================================
// QUANTITATIVE CITATION INJECTION (Step 2b)
// ============================================

// Patterns for quantitative claims that should be cited
const QUANTITATIVE_PATTERNS = [
  /HR\s*(?:=|of)\s*(\d+\.\d+)/gi,           // Hazard ratios: HR = 0.47, HR of 0.58
  /(\d+(?:\.\d+)?)\s*%/g,                     // Percentages: 73.5%, 95%
  /p\s*[<=]\s*(0\.\d+)/gi,                    // P-values: p < 0.001, p = 0.03
  /N\s*=\s*(\d+)/gi,                          // Enrollment: N = 455
  /(\d+(?:\.\d+)?)\s*months?\b/gi,            // Durations: 28.4 months, 3 months
];

/**
 * Extract all numeric tokens from a sentence for matching against sources.
 */
function extractNumericTokens(text) {
  const tokens = new Set();
  for (const pattern of QUANTITATIVE_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      tokens.add(m[1] || m[0]);
    }
  }
  return tokens;
}

/**
 * Check if a sentence contains quantitative claims (HRs, percentages, p-values, etc.)
 */
function hasQuantitativeClaim(sentence) {
  return QUANTITATIVE_PATTERNS.some(p => {
    p.lastIndex = 0;
    return p.test(sentence);
  });
}

/**
 * Inject citations into uncited sentences that contain quantitative claims
 * (HR, %, p-values, months, N=). Conservative: only injects when exactly
 * one source contains matching numbers to avoid wrong citations.
 */
export function injectQuantitativeCitations(answer, sources) {
  // Split body from REFERENCES block
  const refsMatch = answer.match(/\nREFERENCES:\n[\s\S]*$/);
  const mainBody = refsMatch ? answer.substring(0, answer.indexOf(refsMatch[0])) : answer;
  const refs = refsMatch ? refsMatch[0] : '';

  const sentences = mainBody.split(/(?<=[.!?])\s+/);
  let injected = 0;

  const result = sentences.map(sentence => {
    // Skip short fragments, already-cited sentences, non-quantitative sentences
    if (sentence.length < 15) return sentence;
    if (CITATION_PATTERN.test(sentence)) return sentence;
    if (!hasQuantitativeClaim(sentence)) return sentence;

    // Extract numeric tokens from this sentence
    const sentenceTokens = extractNumericTokens(sentence);
    if (sentenceTokens.size === 0) return sentence;

    // Find sources that contain at least one matching numeric token
    const matchingSources = [];
    for (let i = 0; i < sources.length; i++) {
      const sourceText = [
        sources[i].summary || '',
        sources[i].chunk_text || '',
        sources[i].title || '',
        ...(Array.isArray(sources[i].key_findings)
          ? sources[i].key_findings.map(f => typeof f === 'string' ? f : f.finding || '')
          : typeof sources[i].key_findings === 'string' ? [sources[i].key_findings] : []),
      ].join(' ');

      const sourceTokens = extractNumericTokens(sourceText);
      // Check overlap — at least one specific numeric token must match
      let matches = 0;
      for (const token of sentenceTokens) {
        if (sourceTokens.has(token)) matches++;
      }
      if (matches > 0) {
        matchingSources.push({ index: i + 1, matches });
      }
    }

    // Only inject if exactly one source matches (unambiguous)
    if (matchingSources.length === 1) {
      const citationTag = `[${matchingSources[0].index}]`;
      const trimmed = sentence.trimEnd();
      const lastChar = trimmed[trimmed.length - 1];
      if ('.!?'.includes(lastChar)) {
        sentence = trimmed.slice(0, -1) + ' ' + citationTag + lastChar;
      } else {
        sentence = trimmed + ' ' + citationTag;
      }
      injected++;
    }

    return sentence;
  });

  const modified = result.join(' ') + refs;

  if (injected > 0) {
    logger.info('Quantitative citation injection', { injected });
  }

  return { answer: modified, injected };
}

// ============================================
// CITATION COVERAGE SCORE (Step 2c)
// ============================================

/**
 * Compute citation coverage ratio: how many factual sentences have [N] tokens.
 * Returns { factualSentences, citedSentences, ratio }.
 */
export function citationCoverageScore(answer) {
  // Strip REFERENCES section before scoring
  const mainBody = answer.replace(/\nREFERENCES:\n[\s\S]*$/, '');
  const sentences = mainBody.split(/(?<=[.!?])\s+/).filter(s => s.length >= 10);

  // Count factual sentences, but apply adjacency exemption:
  // sentences adjacent to cited sentences are considered "covered"
  let factualCount = 0;
  let citedCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (!needsCitation(s)) continue;

    factualCount++;
    if (CITATION_PATTERN.test(s)) {
      citedCount++;
    } else {
      // Adjacency: if previous or next sentence has a citation, count as covered
      const prevCited = i > 0 && CITATION_PATTERN.test(sentences[i - 1]);
      const nextCited = i < sentences.length - 1 && CITATION_PATTERN.test(sentences[i + 1]);
      if (prevCited || nextCited) {
        citedCount++;
      }
    }
  }

  const ratio = factualCount > 0
    ? citedCount / factualCount
    : 1.0; // No factual claims = perfect coverage

  if (ratio < 0.25 && factualCount >= 3) {
    logger.warn('Low citation coverage', {
      factual: factualCount,
      cited: citedCount,
      ratio: ratio.toFixed(2),
    });
  }

  return {
    factualSentences: factualCount,
    citedSentences: citedCount,
    ratio,
  };
}

/**
 * Check wrong citation rate: sample sentences with [N] and verify the
 * cited source contains at least one anchor term from the citing sentence.
 * Returns { sampled, wrong, rate }.
 */
export function checkWrongCitationRate(answer, sources) {
  const mainBody = answer.replace(/\nREFERENCES:\n[\s\S]*$/, '');
  const sentences = mainBody.split(/(?<=[.!?])\s+/).filter(s => s.length >= 10);

  let sampled = 0;
  let wrong = 0;

  for (const sentence of sentences) {
    // Find all [N] citations in this sentence
    const citations = [];
    let match;
    const citationRe = /\[(\d+)\]/g;
    while ((match = citationRe.exec(sentence)) !== null) {
      citations.push(parseInt(match[1]));
    }
    if (citations.length === 0) continue;

    // Extract anchor terms from this sentence
    const anchors = extractAnchorTerms(sentence);
    if (anchors.length === 0) continue; // Can't verify without anchor terms

    sampled++;

    // Check: does at least one cited source match at least one anchor term?
    let anySourceMatches = false;
    for (const citNum of citations) {
      const source = sources[citNum - 1];
      if (!source) continue;
      for (const anchor of anchors) {
        if (sourceMatchesAnchor(source, anchor)) {
          anySourceMatches = true;
          break;
        }
      }
      if (anySourceMatches) break;
    }

    if (!anySourceMatches) {
      wrong++;
    }
  }

  return {
    sampled,
    wrong,
    rate: sampled > 0 ? wrong / sampled : 0,
  };
}

// ============================================
// UNIT INTEGRITY CHECK
// ============================================

/**
 * Detects VAF ↔ MTM/mL conflation in answer text.
 * VAF (variant allele frequency, %) and MTM/mL (mean tumor molecules/mL)
 * are fundamentally different measurements. MTM/mL is Signatera-specific.
 *
 * Returns array of violations.
 */
export function checkUnitIntegrity(answer) {
  const violations = [];
  const sentences = answer.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();

    // Pattern 1: Equating VAF and MTM/mL
    if (/vaf/i.test(sentence) && /mtm\/ml|mean tumor molecule/i.test(sentence)) {
      // Check for equivalence language
      if (/equivalent|equal|same as|corresponds? to|convert/i.test(sentence)) {
        violations.push({
          type: 'vaf_mtm_equivalence',
          sentence: sentence.substring(0, 150),
          detail: 'VAF and MTM/mL are different measurements and cannot be equated or converted',
        });
      }
    }

    // Pattern 2: Using % units with MTM/mL or vice versa
    if (/mtm\/ml|mean tumor molecule/i.test(sentence) && /\d+(\.\d+)?%/.test(sentence)) {
      violations.push({
        type: 'mtm_with_percent',
        sentence: sentence.substring(0, 150),
        detail: 'MTM/mL should not be expressed as a percentage (that is VAF)',
      });
    }

    // Pattern 3: Attributing MTM/mL to a non-Signatera assay
    const nonSignateraAssays = /guardant reveal|foundationone|radar|navdx|guardant360/i;
    if (/mtm\/ml|mean tumor molecule/i.test(sentence) && nonSignateraAssays.test(sentence)) {
      violations.push({
        type: 'mtm_wrong_assay',
        sentence: sentence.substring(0, 150),
        detail: 'MTM/mL is a Signatera-specific metric, not used by other assays',
      });
    }

    // Pattern 4: Claiming a VAF threshold for Signatera (Signatera reports MTM/mL, not VAF)
    if (/signatera/i.test(sentence) && /vaf/i.test(sentence) && /threshold|cutoff|limit|detect/i.test(sentence)) {
      violations.push({
        type: 'signatera_vaf_threshold',
        sentence: sentence.substring(0, 150),
        detail: 'Signatera reports MTM/mL, not VAF. Do not specify VAF thresholds for Signatera.',
      });
    }
  }

  return violations;
}

export default {
  validateCitations,
  rewriteWithCitations,
  ensureCitationCompliance,
  injectDeterministicCitations,
  citationCoverageScore,
  checkWrongCitationRate,
  checkUnitIntegrity,
  stripOutOfScopeContent,
};
