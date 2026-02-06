# Physician System Transformation Plan
## Literature Review → Clinical Decision Support

**Date:** February 6, 2026
**Status:** Planning complete, implementation pending

---

## Core Problem

Third-party architecture review revealed fundamental misalignment: System answers "what does literature say about MRD?" when physicians need "my patient's MRD test is positive, now what?" The 191-item database (29% NCCN, 24% PubMed) is too academic, not clinically actionable.

## Current System State

**Architecture:** RAG pipeline with intent extraction (Haiku) → ada-002 embedding → hybrid search (vector + keyword) → Sonnet response. Response template forces academic structure (EVIDENCE → GUIDELINES → CONSIDERATIONS → LIMITATIONS). System prompt contains 18 variants of "no treatment recommendations" but lacks positive framing.

**Content gaps:**
- No structured clinical decision pathways (e.g., "CRC stage III, MRD+, post-resection → 4 decision options")
- No test-specific interpretation (Signatera ≠ Guardant Reveal)
- No temporal guidance (retest timing, trajectory interpretation)
- No conference abstracts (ASCO, ESMO, SABCS)
- No NCCN version monitoring automation
- No bridge from test-data-tracker coverage data
- No trial-results watcher for 13 priority trials

**Existing infrastructure:** PostgreSQL with pgvector, mrd_guidance_items table with decision_context JSONB column (migration 009), quote anchors, source registry, job locks already implemented from previous improvement plan.

---

## 7-Week Phased Implementation Plan

### Phase 0: Content Audit & Tagging (Week 1)
**No code changes. Understand current state.**

#### 0.1 Content Audit Script
`physician-system/scripts/audit-content.js`
- Classify all items: decision_support | background | data_point | policy
- Tag with: decision_point, cancer_type_stage, test_specific
- Output: CSV/JSON showing distribution, gaps (which cancer × decision combos have zero items)

#### 0.2 Manual Decision Tree Mapping (4-6 hours with Claude)
Create `physician-system/data/decision-trees.json` mapping top 5 scenarios:

1. **CRC stage III MRD+ post-resection** → decisions: escalate adjuvant? retest when? trial enrollment? imaging acceleration?
2. **CRC stage III MRD- post-resection** → de-escalate? retest interval? confidence by test?
3. **CRC stage III MRD+ during adjuvant** → switch regimen? add agent? retest timing?
4. **Breast I-III MRD+ post-resection** → test sensitivity differences, TNBC vs HR+ implications
5. **NSCLC I-III MRD+ post-resection** → limited trial data, what exists?

Structure:
```json
{
  "CRC_III_post_resection_MRD_positive": {
    "decisions": [
      {
        "id": "escalate_adjuvant",
        "question": "Should adjuvant therapy be intensified?",
        "evidence_tags": ["CIRCULATE", "DYNAMIC", "NCCN_CRC_surveillance"],
        "key_trials": ["NCT04120701", "NCT04089631"],
        "evidence_strength": "emerging"
      }
    ],
    "test_considerations": {
      "signatera": "Tumor-informed, most CRC validation data",
      "guardant_reveal": "Tumor-naive, no prior tissue needed"
    }
  }
}
```

This becomes routing map for Phase 2 structured intake and Phase 3 retrieval splitting.

---

### Phase 1: Reframe Content & Prompt (Week 2)
**Enriching data + rewriting prompts. Minimal code changes.**

#### 1.1 Backfill decision_context
`physician-system/scripts/backfill-decision-context.js`
- Use Claude Haiku batch to generate decision_context JSON for items classified as decision_support/data_point
- Populate: decision_point, population, test_context, options_discussed, limitations_noted
- Target: ≥60% of items with non-null decision_context

#### 1.2 Rewrite System Prompt
Files: `src/chat/server.js`, `src/chat/response-template.js`

**Current approach:** "Here's what literature says" with rigid academic structure
**New approach:** Route based on physician workflow — present evidence FOR EACH clinical option

**New response structure:**
```
CLINICAL SCENARIO: [extracted from query]
DECISION: [e.g., "Whether to intensify adjuvant therapy"]

OPTION A: Intensify based on MRD positivity
- Evidence: [trial data with citations]
- Guidelines: [if they address this]
- Caveats: [what we don't know]

OPTION B: Serial monitoring with repeat testing
- Evidence: [ctDNA kinetics, retest intervals]
- Guidelines: [if applicable]
- Caveats: [...]

OPTION C: Clinical trial enrollment
- Relevant trials: [active enrolling trials]
- Rationale: [why worth considering]

WHAT THE EVIDENCE DOESN'T ADDRESS: [honest gaps]
TEST-SPECIFIC NOTE: [if relevant]
```

**Key changes:**
- Remove rigid EVIDENCE → GUIDELINES → CONSIDERATIONS → LIMITATIONS
- Replace negative constraints with positive framing
- Add 5 few-shot examples (currently zero)
- Remove duplicative "no recommendations" language (currently 18 variants)

#### 1.3 Few-Shot Examples
`physician-system/src/chat/few-shot-examples.js`
Create 5 example query→response pairs:
1. MRD+ CRC post-resection (most common)
2. MRD- CRC post-adjuvant (de-escalation)
3. Test comparison (Signatera vs Guardant Reveal for CRC)
4. Coverage/access ("Is MRD testing covered?")
5. General NCCN query

#### 1.4 New Eval Set
`physician-system/eval/physician-questions.json`
- 10 clinical scenario questions
- 5 test-specific interpretation
- 5 guideline questions
- 5 trial evidence questions
- 5 coverage/access questions

---

### Phase 2: Content Strategy & Crawlers (Weeks 3-4)

#### 2.1 Conference Abstract Crawler ✅ DONE
`test-data-tracker/src/crawlers/mrd/conference-abstracts.js`

#### 2.2 NCCN Version Monitoring ✅ DONE
`physician-system/src/crawlers/version-watcher.js`

#### 2.3 Trial Results Watcher
`physician-system/src/crawlers/trial-results.js`
For 13 priority trials (CIRCULATE-Japan, DYNAMIC-III, DYNAMIC-Rectal, GALAXY/VEGA, MEDOCC-CrEATE, COBRA, ACT3, TRACC, c-TRAK TN, IMvigor011, MERMAID-1, BESPOKE, NRG-GI005).

Two detection mechanisms:
1. ClinicalTrials.gov: Check resultsFirstSubmitDate/resultsPostedDate via v2 API
2. PubMed: Search for publications linked to NCT numbers

#### 2.4 Coverage Bridge
`physician-system/src/crawlers/coverage-bridge.js`
Flow coverage data from main OpenOnco database → physician guidance items.

---

### Phase 3: Chat Architecture (Weeks 5-6)

#### 3.1 Structured Intake Flow
Add optional structured fields to /api/mrd-chat:
```json
{
  "query": "What should I consider next?",
  "context": {
    "cancerType": "colorectal",
    "stage": "III",
    "setting": "post_resection_surveillance",
    "test": "signatera",
    "result": "positive",
    "timepoint": "3_months_post_surgery"
  }
}
```

#### 3.2 Split Retrieval by Query Type
`physician-system/src/chat/retrieval-strategies.js` (new file)
- **clinical_guidance** → Decision-tree items first, then guidelines, then trials
- **trial_evidence** → Clinical trials + pubmed
- **coverage_policy** → Coverage items + live OpenOnco data
- **test_comparison** → Structured test data + head-to-head studies

#### 3.3 Embedding Model Upgrade
Current: text-embedding-ada-002 → Proposed: text-embedding-3-small (same dims, cheaper, better)

---

### Phase 4: Validation & Launch (Week 7)

#### 4.1 Full Eval Suite — Target ≥80% "clinically useful"
#### 4.2 A/B Comparison — Old vs new for 10 key scenarios
#### 4.3 Soft Launch — Deploy, monitor, collect 50+ real queries

---

## Dependency Graph

```
Phase 0.1 (Content Audit) → Phase 1.1 (Backfill decision_context)
Phase 0.2 (Decision Tree) → Phase 1.2 (Rewrite prompt)
                          → Phase 3.1 (Structured intake)
                          → Phase 3.2 (Split retrieval)

Phase 1.2 (New prompt) → Phase 1.3 (Few-shot examples) → Phase 1.4 (Eval set)
Phase 2.1-2.4 can run in parallel with Phase 1
Phase 3.1-3.3 depend on Phase 1 completion
Phase 4 depends on everything
```

---

## Effort Estimates (~65-85 hours total)

| Phase | Task | Hours | Risk |
|-------|------|-------|------|
| 0.1 | Content audit script | 3-4 | Low |
| 0.2 | Decision tree mapping | 4-6 | Low |
| 1.1 | Backfill decision_context | 3-4 | Low |
| 1.2 | Rewrite system prompt | 4-6 | Medium |
| 1.3 | Few-shot examples | 3-4 | Low |
| 1.4 | New eval set | 3-4 | Low |
| 2.1 | Conference crawler | ✅ DONE | — |
| 2.2 | NCCN version monitoring | ✅ DONE | — |
| 2.3 | Trial results watcher | 4-6 | Low |
| 2.4 | Coverage bridge | 4-6 | Low |
| 3.1 | Structured intake | 6-8 | Medium |
| 3.2 | Split retrieval | 8-10 | Medium |
| 3.3 | Embedding upgrade | 3-4 | Low |
| 4.1-4.3 | Validation & launch | 6-8 | Low |

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Eval score (clinically useful) | Not measured | ≥80% |
| Decision-oriented structure | 0% | ≥90% |
| Content coverage (cancer × decision) | Sparse | ≥3 items per top-10 scenario |
| Conference abstracts | 0 | ≥50 |
| Coverage policy items | ~10 generic | ≥30 test-specific |
| NCCN update detection | Days-weeks | <24 hours |
| Trial results detection | Weeks | <48 hours |

---

## Implementation Status (as of Feb 6, 2026)

### ✅ Done
- 2.1 Conference Abstract Crawler (in test-data-tracker)
- 2.2 NCCN Version Monitoring
- Journal RSS Crawler, Source Discovery, Publication Bridge (bonus)
- Intent Extraction (Haiku-based query classification)
- Hybrid Search (vector + keyword with intent-based source filtering)
- Query-type routing in prompt (partial — 4 query types)

### ❌ Not Started
- 0.1 Content Audit Script
- 0.2 Decision Tree Mapping ← CRITICAL, load-bearing foundation
- 1.1 Backfill decision_context
- 1.2 Decision-Oriented Prompt (still academic structure)
- 1.3 Few-Shot Examples (zero examples in prompt)
- 1.4 Physician Eval Set
- 2.3 Trial Results Watcher
- 2.4 Coverage Bridge
- 3.1 Structured Intake
- 3.2 Split Retrieval Strategies
- 3.3 Embedding Upgrade
- 4.1-4.3 Eval & Validation

---

## What NOT to Do (Yet)
1. Don't build full UI — mrd-chat.html is fine
2. Don't automate NCCN PDF processing — ToS prohibits it
3. Don't build multi-turn conversation — single query → structured response is right UX
4. Don't pursue payer API integrations — test-data-tracker already handles scraping
5. Don't switch vector database — PostgreSQL + pgvector fine for current scale
