# Evidence Explorer: Phase B — Physician Query Interface

## Overview

A search-first evidence explorer for physicians. Physician types a natural language question. An LLM router parses it into a structured query against the claims store. Pre-verified claim cards are returned. The LLM never generates clinical content — it only routes.

### Key principle

The LLM writes at most ONE framing sentence. Everything else on screen is pre-verified claim content rendered directly from the evidence store.

### Where it lives

New route on the main site: `openonco.org/evidence`
- Accessible from physician persona navigation
- Separate from the test database (openonco.org with test cards)
- Both linked from shared physician navigation so docs find everything in one place

### What it is NOT

- NOT an AI chat — no multi-turn conversation, no follow-up questions
- NOT a literature search engine — only returns claims from the curated store
- NOT generating clinical guidance — every word of substance traces to a PMID

---

## Architecture

```
Physician types question
        │
        ▼
┌─────────────────────┐
│   LLM Router        │  Lightweight Claude API call
│   (parse only)      │  ~100 tokens output
│                     │
│   Input: free text  │
│   Output: JSON      │
│   {                 │
│     cancer,         │
│     stages,         │
│     test_ids,       │
│     claim_types,    │
│     keywords,       │
│     framing_sentence│
│   }                 │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Deterministic     │  Pure filter/match against
│   Query Engine      │  claims store JSON
│                     │
│   No LLM involved   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   Claim Cards       │  Pre-verified content
│   rendered from     │  rendered as-is
│   claims store      │  No generation
└─────────────────────┘
```

---

## LLM Router Specification

### What the router does

Takes physician's free-text question and outputs a structured JSON query. That's it.

### Router prompt (system)

```
You are a query parser for a clinical evidence database about MRD (Minimal Residual Disease) 
and liquid biopsy testing. Parse the physician's question into structured filters.

You have access to these test names and IDs:
{list of test_name → test_id mappings from the OpenOnco database}

Output JSON only:
{
  "cancer": "colorectal" | "breast" | "lung" | "bladder" | "melanoma" | "hematologic" | null,
  "stages": ["II"] | ["II", "III"] | null,
  "test_ids": ["mrd-1"] | null,
  "test_names": ["Signatera"] | null,
  "claim_types": ["trial_result", "guideline_recommendation"] | null,
  "keywords": ["adjuvant", "de-escalation"] | null,
  "framing": "Showing evidence for Signatera in stage II colorectal cancer"
}

Rules:
- If the physician mentions a specific test by name or vendor, resolve it to test_id
- If they say "MRD test" generically, leave test_ids null (return all)
- "framing" is ONE sentence describing what you're showing, never clinical advice
- When unsure about a field, set it to null (broader results are better than missing results)
- Never add information the physician didn't ask about
```

### Router examples

| Physician types | Router outputs |
|----------------|----------------|
| "Signatera for colon cancer" | `{cancer: "colorectal", test_ids: ["mrd-1"], test_names: ["Signatera"], framing: "Showing evidence for Signatera in colorectal cancer"}` |
| "MRD testing stage II CRC" | `{cancer: "colorectal", stages: ["II"], framing: "Showing evidence for MRD testing in stage II colorectal cancer"}` |
| "what do I do with a positive result?" | `{claim_types: ["clinical_utility"], keywords: ["positive"], framing: "Showing evidence on clinical actions after a positive MRD result"}` |
| "the Natera test for breast cancer" | `{cancer: "breast", test_ids: ["mrd-1"], test_names: ["Signatera"], framing: "Showing evidence for Signatera (Natera) in breast cancer"}` |
| "is ctDNA in NCCN guidelines" | `{claim_types: ["guideline_recommendation"], keywords: ["NCCN"], framing: "Showing NCCN guideline recommendations for ctDNA testing"}` |
| "clonoSEQ" | `{test_ids: ["mrd-5"], test_names: ["clonoSEQ"], framing: "Showing evidence for clonoSEQ"}` |

### Router constraints

- Claude API call with `max_tokens: 200`, `temperature: 0`
- Model: claude-sonnet (fast, cheap, structured output is easy for it)
- Total latency budget: <2 seconds for the router call
- If the API call fails, fall back to keyword search over claim descriptions (no LLM needed)
- The test name → test_id mapping is injected into the system prompt at build time from data.js

---

## Query Engine

### How filtering works

After the router outputs structured JSON, a pure JS function filters claims:

```javascript
function queryEvidence(claims, query) {
  return claims.filter(claim => {
    if (query.cancer && claim.scope.cancer !== query.cancer) return false;
    if (query.stages?.length && !query.stages.some(s => claim.scope.stages?.includes(s))) return false;
    if (query.test_ids?.length) {
      // Include test-specific AND test-agnostic claims
      const isTestSpecific = claim.scope.tests?.some(t => query.test_ids.includes(t.test_id));
      const isTestAgnostic = !claim.scope.tests?.length;
      if (!isTestSpecific && !isTestAgnostic) return false;
    }
    if (query.claim_types?.length && !query.claim_types.includes(claim.type)) return false;
    if (query.keywords?.length) {
      const text = JSON.stringify(claim).toLowerCase();
      if (!query.keywords.some(kw => text.includes(kw.toLowerCase()))) return false;
    }
    return true;
  });
}
```

### Test-specific vs test-agnostic behavior

When a physician asks about a specific test (e.g., "Signatera"), the results include:

1. **Test-specific claims** — trials that used Signatera, Signatera validation data, guidelines naming Signatera
2. **Test-agnostic claims** — general ctDNA/MRD evidence for the same cancer/stage that applies regardless of which test was used

Test-specific claims sort first. Test-agnostic claims follow under a subtle separator: "General ctDNA evidence also relevant to this query"

This way a doc asking about Signatera gets the full picture without us making the generalization for them.

---

## Page Layout

```
┌─────────────────────────────────────────────────┐
│  OpenOnco                    [Tests] [Evidence]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Evidence explorer                              │
│  Peer-reviewed evidence on cancer diagnostic    │
│  testing. Updated weekly from published         │
│  literature.                                    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Ask a question about MRD or liquid      │    │
│  │ biopsy testing...                       │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Example questions:                             │
│  "Signatera for stage II colon cancer"          │
│  "Is MRD testing in NCCN guidelines?"           │
│  "What to do with a positive ctDNA result"      │
│                                                 │
│  ─ ─ ─ ─ (after query) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                 │
│  Showing evidence for Signatera in stage II     │
│  colorectal cancer                              │
│  8 claims from 5 peer-reviewed sources          │
│                                                 │
│  ── Signatera-specific evidence ──              │
│                                                 │
│  ┌─ Claim card ─────────────────────────────┐   │
│  │ [Guideline] [Signatera] [Verified]       │   │
│  │ NCCN names Signatera for CRC...          │   │
│  └──────────────────────────────────────────┘   │
│  ┌─ Claim card ─────────────────────────────┐   │
│  │ [Trial result] [Signatera] [Verified]    │   │
│  │ DYNAMIC trial...                         │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ── General ctDNA evidence ──                   │
│                                                 │
│  ┌─ Claim card ─────────────────────────────┐   │
│  │ [Guideline] [Verified]                   │   │
│  │ ASCO endorses ctDNA for stage II-III...  │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌─ Provenance footer ──────────────────────┐   │
│  │ All claims from peer-reviewed sources.  │   │
│  │ Not medical advice. How we verify →     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## Claim Card Rendering

(Same as before — see Phase A claim schema for fields)

### Card elements

1. **Type badge** — amber (trial), blue (guideline), teal (diagnostic performance), purple (clinical utility), gray (methodology)
2. **Test badge** (when scope.tests populated) — shows test name, links to OpenOnco test detail page
3. **Verification badge** — green "Verified"
4. **Headline** — finding description
5. **Detail text** — effect summary
6. **Metrics row** (trial/performance claims only) — n, HR, CI, p-value, follow-up
7. **Citation footer** — authors, journal, year, PMID link
8. **View test link** — when test-linked, links to test detail page

### Sorting

1. Guidelines first
2. Trial results by sample size (largest first)
3. Diagnostic performance
4. Clinical utility
5. Methodology notes

Within each group: newest first.

---

## Technical Implementation

### API endpoint

New Vercel serverless function: `/api/evidence-query.js`

1. Receives physician's question as POST body
2. Calls Claude API (Sonnet) with the router prompt + question
3. Parses the structured JSON response
4. Loads compiled claims from `evidenceClaims.js`
5. Runs the deterministic query engine
6. Returns filtered + sorted claims to the frontend

The router call happens server-side so the Anthropic API key stays on the server.

### Fallback (no LLM)

If the Claude API call fails (timeout, rate limit, error):
1. Extract simple keywords from the question via regex (split on spaces, filter stop words)
2. Run keyword match against claim descriptions
3. Return results with a note: "Showing keyword-matched results"

This ensures the page always returns something even if the LLM is down.

### Component structure

```
src/
  pages/
    EvidencePage.jsx              # Search bar + results display
  components/
    evidence/
      EvidenceSearchBar.jsx       # Input + example questions
      EvidenceResults.jsx         # Framing sentence + claim list with sections
      EvidenceClaimCard.jsx       # Individual claim card
      EvidenceClaimMetrics.jsx    # n, HR, CI row
      EvidenceCitation.jsx        # PMID/DOI link footer
      EvidenceEmptyState.jsx      # "No claims found" messaging
api/
  evidence-query.js               # Serverless function (router + query)
```

### Route

```jsx
<Route path="/evidence" element={<EvidencePage />} />
```

---

## Implementation Order for CC

**Prerequisites:** Phase A steps 1-3 complete (claims store has data).

1. **Build compile-claims script** — `evidence/scripts/compile-claims.js` → `src/config/evidenceClaims.js`
2. **Build evidence-query API** — `/api/evidence-query.js` with Claude router + deterministic query engine + keyword fallback
3. **Build EvidenceClaimCard** — renders one claim with all badges, metrics, citation
4. **Build EvidenceResults** — framing sentence + test-specific/test-agnostic sections + claim list
5. **Build EvidenceSearchBar** — input + example questions (clickable)
6. **Build EvidencePage** — assembles search bar + results, manages query state
7. **Add route** — `/evidence` in App.jsx
8. **Add navigation** — "Evidence" tab in physician persona header
9. **Empty/error states** — no results, API failure fallback, loading state
10. **Provenance footer** — "How we verify evidence" explanation

## Design Principles

- **Every word of substance traces to a PMID.** The LLM contributes only the framing sentence.
- **Test-specific results come first, general evidence follows.** Doc sees what's specific to their test, then what applies broadly.
- **Honest about gaps.** 0 results is a valid answer. Don't pad with loosely related content.
- **Fast.** Router call <2s, page render <500ms after that. Total <3s.
- **Graceful degradation.** API down → keyword fallback. No claims → clear empty state. Always functional.

## Future Enhancements (not in v1)

- **Multi-turn refinement** — "Show me just the guideline recommendations" as a follow-up
- **Cross-link from test database** — "View evidence" button on each test's detail page, pre-populates search with that test
- **Shareable URLs** — encode query in URL params for bookmarking/sharing
- **Export** — download filtered claims as PDF for tumor boards
- **"What's new" mode** — show only claims added in the last 30 days
- **Coverage comparison** — side-by-side claim cards for two tests
