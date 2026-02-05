# MRD Chat Remediation Plan

**Status:** Planning
**Date:** 2026-02-03
**Priority:** High

Based on third-party diagnosis of NCCN primacy, fabricated quotes, and ineffective query routing.

---

## Executive Summary

Three core failures require four fix categories:

| Failure | Root Cause | Fix Category |
|---------|------------|--------------|
| NCCN-first answers | Content skew + trials not in RAG + embedding trap | Retrieval |
| Fabricated quotes | Insufficient grounding + template pressure | Citation/Grounding |
| Routing doesn't work | Routing is suggestion, not enforcement | Prompting/Control |

**Priority order:** Retrieval → Prompting → Grounding → Monitoring

---

## Phase 1: Retrieval Fixes (Week 1)

### 1.1 Embed All Trials into RAG

**Problem:** Only 13/213 trials are searchable via RAG.

**Files to modify:**
- `physician-system/src/crawlers/clinicaltrials.js`
- `physician-system/src/cli.js`

**Changes:**
```javascript
// New function: syncAllTrialsToGuidance()
// - Query ALL mrd_clinical_trials (not just is_priority_trial=true)
// - Build richer summary including: NCT, disease, setting, endpoints, status, arms
// - Include results summary if has_results=true
```

**CLI command:**
```bash
node src/cli.js clinicaltrials --sync-all
```

**Acceptance criteria:**
- [ ] All 213 trials have corresponding guidance_items
- [ ] All 213 have embeddings
- [ ] Trial content includes: NCT number, endpoints, arms, status
- [ ] Query "CIRCULATE trial results" returns CIRCULATE in top 3

---

### 1.2 Source Diversity Constraints

**Problem:** NCCN can't exceed 30-40% of retrieved context even with high scores.

**Files to modify:**
- `physician-system/src/chat/server.js` (search functions)

**Changes:**
```javascript
// In searchWithPgVector() and searchWithJSONB():

const SOURCE_TYPE_CAPS = {
  nccn: 4,        // Max 4 NCCN sources per query (40% of 10)
  guideline: 3,   // Combined NCCN + ASCO + ESMO
  clinicaltrials: 3,
  pubmed: 4,
};

// After retrieving top-K, apply diversity filtering:
function applySourceDiversity(sources, caps) {
  const counts = {};
  return sources.filter(s => {
    const type = s.source_type;
    counts[type] = (counts[type] || 0) + 1;
    return counts[type] <= (caps[type] || Infinity);
  });
}
```

**Acceptance criteria:**
- [ ] No query returns >4 NCCN sources
- [ ] Trial queries return at least 2 trial sources (when available)
- [ ] Test with 30 representative queries

---

### 1.3 Query-Type Aware Retrieval

**Problem:** Retrieval doesn't match routing intent.

**Files to modify:**
- `physician-system/src/chat/server.js`

**Changes:**
```javascript
// Modify searchSources() to accept query_type from intent extraction

async function searchSources(queryEmbedding, filters = {}, queryType = 'general') {
  // Apply source-type requirements based on query type
  const typeRequirements = {
    'clinical_trials': {
      required: ['clinicaltrials', 'pubmed'],
      minRequired: 3,
      demote: ['nccn']  // Demote guideline "trial caution" language
    },
    'guidelines': {
      required: ['nccn', 'asco', 'esmo'],
      minRequired: 2,
    },
    'coverage_policy': {
      required: ['payer-moldx-palmetto', 'payer-medicare-lcd'],
      minRequired: 1,
    },
    'general': {}
  };

  // Two-stage retrieval:
  // Stage 1: Get top 30 by similarity
  // Stage 2: Rerank with type requirements and diversity
}
```

**Acceptance criteria:**
- [ ] Trial queries return ≥3 trial/pubmed sources
- [ ] Guideline queries return ≥2 guideline sources
- [ ] Query type is logged with each request

---

### 1.4 Demote "Trial Caution" Language

**Problem:** NCCN chunks with "only within clinical trials" rank high for trial queries.

**Files to modify:**
- `physician-system/src/chat/server.js`

**Changes:**
```javascript
// Pattern detection for restriction language
const RESTRICTION_PATTERNS = [
  /only (within|in) (a )?clinical trial/i,
  /outside of (a )?clinical trial/i,
  /insufficient evidence.*(clinical trial|routine use)/i,
  /not recommended.*(outside|routine)/i,
];

function isRestrictionChunk(chunkText) {
  return RESTRICTION_PATTERNS.some(p => p.test(chunkText));
}

// In ranking: apply -0.1 similarity penalty for restriction chunks
// when query_type === 'clinical_trials'
```

**Acceptance criteria:**
- [ ] "NCCN: insufficient evidence outside clinical trials" demoted for trial queries
- [ ] Actual trial content (NCTs, endpoints) ranks higher
- [ ] Verify with query "What clinical trials are studying MRD de-escalation"

---

## Phase 2: Prompting/Control Flow (Week 1-2)

### 2.1 Query-Type Specific Prompts

**Problem:** Single template encourages NCCN-first regardless of query.

**Files to create:**
- `physician-system/src/chat/prompts/trial-prompt.js`
- `physician-system/src/chat/prompts/guideline-prompt.js`
- `physician-system/src/chat/prompts/coverage-prompt.js`
- `physician-system/src/chat/prompts/general-prompt.js`

**Files to modify:**
- `physician-system/src/chat/server.js`
- `physician-system/src/chat/response-template.js` (deprecate unified template)

**Trial Prompt Example:**
```javascript
export const TRIAL_PROMPT = `You are helping a physician find clinical trial evidence for MRD/ctDNA testing.

STRUCTURE (follow exactly):
1. CLINICAL TRIALS: Lead with trial identifiers (NCT numbers), study design, endpoints, and any results
2. SUPPORTING EVIDENCE: Published literature supporting or challenging trial findings
3. GUIDELINE CONTEXT: (Optional) Brief mention of guideline position ONLY if directly relevant
4. LIMITATIONS: What the evidence doesn't address

FORBIDDEN for trial queries:
- Do NOT lead with "CURRENT GUIDELINE POSITION"
- Do NOT say "NCCN recommends" unless the user asked about guidelines
- Do NOT fabricate trial names or results

REQUIRED:
- Cite NCT numbers when available
- Include enrollment, endpoints, status for each trial mentioned
- Say "no trial data available in sources" if trials aren't in your context
`;
```

**Guideline Prompt Example:**
```javascript
export const GUIDELINE_PROMPT = `You are helping a physician understand guideline recommendations for MRD/ctDNA testing.

STRUCTURE:
1. GUIDELINE RECOMMENDATIONS: Quote specific recommendations with evidence levels
2. CROSS-GUIDELINE COMPARISON: Note differences between NCCN, ASCO, ESMO if present
3. EMERGING EVIDENCE: Trials or studies that may inform future updates
4. LIMITATIONS: What guidelines don't address

REQUIRED:
- State guideline name and version/date when citing
- Include evidence category (e.g., "NCCN Category 2A")
- Only quote text that appears verbatim in sources
`;
```

**Server.js Changes:**
```javascript
import { TRIAL_PROMPT } from './prompts/trial-prompt.js';
import { GUIDELINE_PROMPT } from './prompts/guideline-prompt.js';
// ...

function selectSystemPrompt(queryType) {
  const prompts = {
    'clinical_trials': TRIAL_PROMPT,
    'trial_evidence': TRIAL_PROMPT,
    'guidelines': GUIDELINE_PROMPT,
    'coverage_policy': COVERAGE_PROMPT,
    'general': GENERAL_PROMPT,
  };
  return BASE_RULES + (prompts[queryType] || prompts.general);
}
```

**Acceptance criteria:**
- [ ] Trial queries use TRIAL_PROMPT
- [ ] Trial queries do NOT contain "CURRENT GUIDELINE POSITION" as first section
- [ ] Guideline queries properly cite evidence levels
- [ ] Query type selection logged

---

### 2.2 Few-Shot Examples Per Query Type

**Problem:** Model needs examples of correct structure.

**Files to modify:**
- Each prompt file in `physician-system/src/chat/prompts/`

**Example for Trial Prompt:**
```javascript
export const TRIAL_EXAMPLES = `
EXAMPLE - Trial Query:
User: "What trials are studying ctDNA-guided adjuvant therapy in colon cancer?"

Good Response:
CLINICAL TRIALS:
Several trials are investigating ctDNA-guided adjuvant therapy decisions in colon cancer:

1. **DYNAMIC (NCT04120701)**: Randomized Phase 2 trial in stage II colon cancer comparing ctDNA-guided vs standard adjuvant therapy using Signatera. Primary endpoint: recurrence-free survival. Enrollment: 455 patients. Status: Results published 2022 showing ctDNA-guided approach reduced adjuvant chemotherapy use by 50% without compromising outcomes [1].

2. **CIRCULATE (NCT04264702, NCT04089631)**: International Phase 3 program in stage II-III colon cancer. Tests ctDNA-guided treatment intensification and de-escalation. Enrollment: 1,980 planned. Status: Recruiting [2].

SUPPORTING EVIDENCE:
Retrospective analyses suggest ctDNA positivity post-surgery identifies patients at high recurrence risk who may benefit most from adjuvant therapy [3].

LIMITATIONS:
Long-term overall survival data from randomized trials are not yet mature.

---

Bad Response (DO NOT DO THIS):
CURRENT GUIDELINE POSITION:
NCCN states there is insufficient evidence for ctDNA outside clinical trials...
[This is wrong because it leads with guidelines for a trial question]
`;
```

**Acceptance criteria:**
- [ ] Each prompt file includes 1-2 few-shot examples
- [ ] Examples demonstrate correct section ordering
- [ ] Examples show how to handle "insufficient data" gracefully

---

## Phase 3: Citation & Quote Grounding (Week 2)

### 3.1 Claim-Level Citation Verification

**Problem:** Citations exist but don't semantically support claims.

**Files to create:**
- `physician-system/src/chat/claim-verifier.js`

**Files to modify:**
- `physician-system/src/chat/server.js`

**Implementation:**
```javascript
// claim-verifier.js

import Anthropic from '@anthropic-ai/sdk';

const VERIFY_PROMPT = `You are verifying whether a cited source supports a claim.

Claim: "{claim}"
Citation [N] content: "{source_content}"

Does the source EXPLICITLY support this claim?
- "SUPPORTED": The source directly states or clearly implies this claim
- "PARTIAL": The source discusses the topic but doesn't fully support the claim
- "UNSUPPORTED": The source does not support this claim

Also flag if the claim contains a "quote" that doesn't appear verbatim in the source.

Return JSON: { "verdict": "SUPPORTED|PARTIAL|UNSUPPORTED", "fabricated_quote": boolean, "explanation": "..." }
`;

export async function verifyClaims(response, sources) {
  // 1. Split response into atomic claims (sentences with citations)
  // 2. For each claim + citation, run verification
  // 3. Return report: { supported: N, partial: N, unsupported: N, fabricated_quotes: [...] }
}

export async function rewriteUnsupportedClaims(response, verificationReport, sources) {
  // For UNSUPPORTED claims, rewrite to:
  // "The source discusses X, but does not specifically address Y"
  // For fabricated quotes, remove quotation marks
}
```

**Server.js Integration:**
```javascript
// After response generation, before returning:
const verification = await verifyClaims(answer, sources);
if (verification.unsupported > 0 || verification.fabricated_quotes.length > 0) {
  answer = await rewriteUnsupportedClaims(answer, verification, sources);
  logger.warn('Claims rewritten', { verification });
}
```

**Acceptance criteria:**
- [ ] 100% of claims with citations are verified
- [ ] Unsupported claims are rewritten with hedging language
- [ ] Fabricated quotes have quotation marks removed
- [ ] Verification results logged

---

### 3.2 Quote Policy: Only Anchored Quotes

**Problem:** Model generates "quotes" that don't exist in sources.

**Files to modify:**
- `physician-system/src/chat/response-template.js`
- `physician-system/src/chat/quote-extractor.js`

**Changes to prompts:**
```javascript
// Add to all system prompts:
QUOTE RULES:
- NEVER use quotation marks unless quoting verbatim text from a source
- Paraphrase instead: "NCCN indicates that..." not "NCCN states 'exact words'"
- If you must quote, the exact text MUST appear in the source content provided
- Violation of this rule is a critical failure
```

**Post-processing enforcement:**
```javascript
// In quote-extractor.js, add:
export function detectUnanchoredQuotes(response, sources) {
  // Find all quoted strings in response
  const quotes = response.match(/"[^"]+"/g) || [];

  // Check if each quote appears verbatim in any source
  const unanchored = quotes.filter(q => {
    const text = q.replace(/"/g, '');
    return !sources.some(s =>
      s.chunk_text?.includes(text) ||
      s.summary?.includes(text)
    );
  });

  return unanchored;
}

export function removeUnanchoredQuotes(response, unanchored) {
  let fixed = response;
  for (const quote of unanchored) {
    // Replace "quoted text" with: quoted text (remove quotes)
    fixed = fixed.replace(quote, quote.replace(/"/g, ''));
  }
  return fixed;
}
```

**Acceptance criteria:**
- [ ] Responses contain no fabricated quotes
- [ ] Unanchored quotes are automatically de-quoted
- [ ] Metric: unanchored quote rate logged

---

### 3.3 Increase Quote Anchor Coverage

**Problem:** Only 42 anchors for 191 items.

**Files to modify:**
- `physician-system/src/embeddings/mrd-embedder.js`
- `physician-system/src/crawlers/processors/nccn.js`

**Auto-generate anchors during ingestion:**
```javascript
// In embedder or during ingestion:
export function extractHighSignalSentences(text, maxSentences = 5) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

  // Score sentences by signal indicators
  const scored = sentences.map(s => ({
    text: s.trim(),
    score: scoreSignal(s)
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map(s => s.text);
}

function scoreSignal(sentence) {
  let score = 0;
  // High-signal patterns
  if (/recommend|should|must|required/i.test(sentence)) score += 2;
  if (/category\s*\d|level\s*[iI]/i.test(sentence)) score += 3;  // Evidence levels
  if (/\d+%|\d+\s*(patients|months|years)/i.test(sentence)) score += 2;  // Statistics
  if (/NCT\d+/i.test(sentence)) score += 3;  // Trial IDs
  if (/endpoint|primary|secondary/i.test(sentence)) score += 2;
  if (/insufficient|not recommended|limited/i.test(sentence)) score += 1;
  return score;
}
```

**CLI command:**
```bash
node src/cli.js anchors --generate-all
```

**Acceptance criteria:**
- [ ] ≥3 anchors per guidance item (target: 573+ anchors)
- [ ] Anchors include evidence levels, statistics, recommendations
- [ ] NCCN items have specific recommendation text anchored

---

## Phase 4: Monitoring (Week 2-3)

### 4.1 Enhanced Health Metrics

**Files to modify:**
- `physician-system/src/chat/server.js` (health endpoint)

**New metrics:**
```javascript
// Add to /health response:
{
  "retrieval_quality": {
    "avg_nccn_share_trial_queries": 0.35,  // Target: <0.30
    "avg_trial_sources_trial_queries": 2.1, // Target: ≥3
    "routing_compliance_rate": 0.72,        // Target: ≥0.90
  },
  "grounding_quality": {
    "supported_claim_rate": 0.85,           // Target: ≥0.95
    "unanchored_quote_rate": 0.12,          // Target: <0.05
    "citations_per_response": 4.2,
  },
  "last_24h": {
    "queries_by_type": {
      "clinical_trials": 12,
      "guidelines": 8,
      "general": 15,
    }
  }
}
```

### 4.2 Per-Query Logging

**Files to modify:**
- `physician-system/src/chat/server.js`

**Log structure:**
```javascript
// After each query, log:
logger.info('chat_request_complete', {
  query_type: intent.query_type,
  sources_retrieved: sources.length,
  source_types: sources.map(s => s.source_type),
  nccn_count: sources.filter(s => s.source_type === 'nccn').length,
  trial_count: sources.filter(s => s.source_type === 'clinicaltrials').length,
  first_section: extractFirstSection(answer),  // "CLINICAL TRIALS" vs "CURRENT GUIDELINE POSITION"
  routing_compliant: checkRoutingCompliance(intent.query_type, answer),
  claim_verification: verification?.summary,
  unanchored_quotes: unanchoredQuotes.length,
  response_time_ms: elapsed,
});
```

**Acceptance criteria:**
- [ ] All queries logged with retrieval breakdown
- [ ] Routing compliance tracked
- [ ] Weekly report shows trends

---

## Implementation Schedule

| Week | Phase | Tasks | Deliverable |
|------|-------|-------|-------------|
| 1 | Retrieval | 1.1 Embed all trials | 213 trials searchable |
| 1 | Retrieval | 1.2 Source diversity | Max 40% NCCN |
| 1 | Retrieval | 1.3-1.4 Query-aware retrieval | Trial queries get trials |
| 1-2 | Prompting | 2.1-2.2 Query-type prompts | 4 separate prompts |
| 2 | Grounding | 3.1 Claim verification | No unsupported claims |
| 2 | Grounding | 3.2-3.3 Quote policy | No fabricated quotes |
| 2-3 | Monitoring | 4.1-4.2 Metrics | Dashboard ready |

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| NCCN share in trial queries | ~80% | <30% | Log analysis |
| Trial sources in trial queries | 0-1 | ≥3 | Log analysis |
| Routing compliance | ~20% | ≥90% | First section matches query type |
| Supported claim rate | Unknown | ≥95% | Claim verifier |
| Unanchored quote rate | Unknown | <5% | Quote detector |
| Quote anchor coverage | 42 | ≥500 | Database count |

---

## Testing Plan

### Regression Test Suite (30 queries)

**Trial queries (10):**
1. "What clinical trials are studying MRD-guided treatment de-escalation?"
2. "Tell me about the CIRCULATE and DYNAMIC trials"
3. "What are the endpoints of the MERMAID trial?"
4. "Are there any Phase 3 trials for ctDNA in lung cancer?"
5. "What trials are comparing ctDNA-guided vs standard adjuvant therapy?"
6. "Has any trial shown survival benefit from ctDNA-guided treatment?"
7. "What is the enrollment status of GALAXY trial?"
8. "Which trials use Signatera for MRD detection?"
9. "What are the interim results from BESPOKE CRC?"
10. "Are there MRD trials in breast cancer?"

**Expected:** Lead with CLINICAL TRIALS section, cite NCT numbers, no NCCN-first

**Guideline queries (10):**
1. "What does NCCN say about ctDNA in colorectal cancer?"
2. "What is the ASCO recommendation for MRD testing?"
3. "How do NCCN and ESMO guidelines differ on ctDNA?"
4. "What evidence level does NCCN assign to Signatera?"
5. "Does NCCN recommend ctDNA for surveillance?"
6. "What is the current NCCN position on MRD in bladder cancer?"
7. "Has ASCO updated their ctDNA guidelines recently?"
8. "What do guidelines say about tumor-informed vs tumor-agnostic?"
9. "Is ctDNA testing guideline-recommended for lung cancer?"
10. "What limitations do guidelines note for MRD testing?"

**Expected:** Lead with guidelines, cite evidence levels, include verbatim recommendations

**General/comparison queries (10):**
1. "What is the evidence for ctDNA in stage III colon cancer?"
2. "How does Signatera compare to Guardant Reveal?"
3. "What is the sensitivity of MRD assays?"
4. "When should ctDNA be tested after surgery?"
5. "What is the clinical utility of serial ctDNA monitoring?"
6. "Is there evidence ctDNA improves survival?"
7. "What cancers have the most MRD evidence?"
8. "How accurate is ctDNA for detecting recurrence?"
9. "What are the limitations of current MRD tests?"
10. "What's the lead time advantage of ctDNA over imaging?"

**Expected:** Balanced response, appropriate section ordering, no fabricated quotes

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Claim verifier adds latency | Run async, log results, don't block response initially |
| Over-constrained retrieval returns nothing | Fallback to unconstrained if <3 sources |
| Few-shot examples become stale | Review quarterly, update with new trial data |
| Prompt switching causes inconsistency | A/B test before full rollout |

---

## Appendix: File Change Summary

| File | Changes |
|------|---------|
| `src/chat/server.js` | Query-type retrieval, diversity caps, prompt selection |
| `src/chat/response-template.js` | Deprecate unified template |
| `src/chat/prompts/*.js` | NEW: Per-type prompts with examples |
| `src/chat/claim-verifier.js` | NEW: Semantic verification |
| `src/chat/quote-extractor.js` | Add unanchored quote detection |
| `src/crawlers/clinicaltrials.js` | Sync all trials function |
| `src/embeddings/mrd-embedder.js` | Auto-generate quote anchors |
| `src/cli.js` | New commands: --sync-all, anchors --generate-all |
