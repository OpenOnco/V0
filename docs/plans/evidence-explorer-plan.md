# Evidence Explorer: Phase B — Physician Query Interface

## Overview

A filter-based evidence explorer for physicians. No LLM involved in the query path — purely deterministic rendering of pre-verified claims from the evidence store (Phase A).

Filters only for v1. Natural language search and LLM routing are future additions.

### Where it lives

New route on the main site: `openonco.org/evidence`
- Accessible from physician persona navigation
- Separate from the test database (openonco.org with test cards)
- Both linked from a shared physician landing page so docs find everything in one place
- Eventually: `openonco.org/tests` (existing) + `openonco.org/evidence` (new) as peer sections

### What it is NOT

- NOT an AI chat interface
- NOT a literature search engine
- NOT a replacement for the test database
- It is a structured, filterable view of peer-reviewed evidence claims

---

## Data Source

Reads from `evidence/claims/*.json` files (built in Phase A).
Each claim has the schema defined in Phase A, with these filterable fields:

```
scope.cancer        → Cancer type filter
scope.stages[]      → Stage filter
scope.setting       → Clinical setting (adjuvant, surveillance, screening)
type                → Claim type (trial_result, guideline_recommendation, diagnostic_performance, clinical_utility)
source.source_type  → Source type (journal-article, conference-abstract, clinical-guideline)
source.year         → Publication year (for recency sorting)
finding.n           → Sample size (for evidence strength sorting)
verification.agreement → Verification status
```

---

## Filter Design

### Primary filters (always visible)

| Filter | Type | Options | Default |
|--------|------|---------|---------|
| Cancer type | Single select dropdown | All cancers, Colorectal, Breast, Lung (NSCLC), Bladder, Melanoma, Hematologic, + any cancer type present in claims | All cancers |
| Stage | Single select dropdown | All stages, Stage I, Stage II, Stage III, Stage IV | All stages |
| Evidence type | Single select dropdown | All types, Trial results, Guidelines, Diagnostic performance, Clinical utility | All types |

### Secondary filters (collapsible "More filters" row)

| Filter | Type | Options | Default |
|--------|------|---------|---------|
| Clinical setting | Single select | All, Adjuvant, Surveillance, Screening, Treatment selection | All |
| Source type | Single select | All, Journal articles, Conference abstracts, Clinical guidelines | All |
| Sort by | Single select | Relevance (default), Newest first, Largest trial first | Relevance |

### Filter behavior

- Filters are AND-combined: selecting "Colorectal" + "Stage II" shows only claims matching both
- Counts update live: each filter option shows the number of matching claims in parentheses, e.g., "Colorectal (24)"
- Empty states: if a filter combination returns 0 claims, show "No evidence found for this combination" with a note about which cancer types have the most coverage
- URL params: filters are reflected in the URL so physicians can bookmark/share filtered views, e.g., `/evidence?cancer=colorectal&stage=II`

---

## Claim Card Rendering

Each claim renders as a card with these sections:

### Card layout

```
┌─────────────────────────────────────────────────┐
│ [Trial result]  [Verified ✓]                    │
│                                                 │
│ DYNAMIC trial: ctDNA-guided approach safely      │
│ reduced chemotherapy in stage II CRC             │
│                                                 │
│ Randomized 455 stage II CRC patients. ctDNA-    │
│ guided arm reduced adjuvant chemo from 28% to   │
│ 15% with non-inferior recurrence-free survival. │
│                                                 │
│ n = 455    HR = 0.92    RFS = non-inferior      │
│                                                 │
│ Tie et al., NEJM 2022 · PMID 35657320          │
└─────────────────────────────────────────────────┘
```

### Card elements

1. **Type badge** — color-coded by claim type:
   - `trial_result` → amber badge
   - `guideline_recommendation` → blue badge
   - `diagnostic_performance` → teal badge
   - `clinical_utility` → purple badge
   - `methodology_note` → gray badge

2. **Verification badge** — green "Verified" if `verification.agreement: true`

3. **Headline** — `finding.description` truncated to ~120 chars, or a generated headline from trial name + key finding

4. **Detail text** — `finding.effect_summary` or the full description

5. **Quantitative metrics row** (only for trial_result and diagnostic_performance):
   - n, HR, CI, p-value, follow-up period, sensitivity, specificity
   - Only show fields that have non-null values

6. **Citation footer** — `source.authors_short`, journal, year, PMID as link to PubMed
   - PMID links to `https://pubmed.ncbi.nlm.nih.gov/{pmid}/`
   - DOI links to `https://doi.org/{doi}`

### Sorting and grouping

**Default sort ("Relevance"):**
1. Guidelines first (these frame the clinical context)
2. Trial results, sorted by sample size descending (largest evidence base first)
3. Diagnostic performance data
4. Clinical utility data
5. Methodology notes last

**Within each group**, sort by publication year descending (newest first).

**Grouping (v1):** Flat list, no grouping headers. Future enhancement: group by source paper ("From the DYNAMIC trial: 3 claims").

---

## Page Structure

```
┌─────────────────────────────────────────────────┐
│  OpenOnco                    [Tests] [Evidence]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Evidence explorer                              │
│  Peer-reviewed evidence on MRD and liquid       │
│  biopsy testing, updated weekly.                │
│                                                 │
│  [Cancer type ▾] [Stage ▾] [Evidence type ▾]    │
│  More filters ▾                                 │
│                                                 │
│  24 claims from 12 sources                      │
│                                                 │
│  ┌─ Claim card ─────────────────────────────┐   │
│  │ ...                                      │   │
│  └──────────────────────────────────────────┘   │
│  ┌─ Claim card ─────────────────────────────┐   │
│  │ ...                                      │   │
│  └──────────────────────────────────────────┘   │
│  ...                                            │
│                                                 │
│  ┌─ Provenance footer ──────────────────────┐   │
│  │ All claims extracted from peer-reviewed  │   │
│  │ publications and verified by independent │   │
│  │ AI cross-check. Not medical advice.      │   │
│  │ How we verify evidence →                 │   │
│  │ Last updated: April 3, 2026              │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Navigation integration

The physician persona header gets two peer tabs:
- **Tests** → existing test card grid (openonco.org or /tests)
- **Evidence** → new evidence explorer (/evidence)

Both accessible from the same navigation. A physician landing page can link to both with clear descriptions of what each provides.

---

## Technical Implementation

### Data loading

**Option A (simpler, recommended for v1):** At build time, a script compiles all `evidence/claims/*.json` files into a single `src/config/evidenceClaims.js` export, similar to how data.js works. The evidence page imports this directly. No API needed.

**Option B (future):** Serve claims via an API endpoint (`/api/v1/evidence?cancer=colorectal&stage=II`). Useful when the claims store grows large or if the evidence explorer becomes a standalone app.

Start with Option A. The claims store is unlikely to exceed a few hundred claims in the near term, which is fine as a static import.

### Build script

`evidence/scripts/compile-claims.js`:
1. Reads all `evidence/claims/*.json` files
2. Validates each claim against `evidence/schema/claim.schema.json`
3. Outputs `src/config/evidenceClaims.js` as a single export
4. This file is gitignored and regenerated as part of the build pipeline
5. The render-faq.js script (Phase A step 9) can also trigger this compilation

### Component structure

```
src/
  pages/
    EvidencePage.jsx              # Main page with filters + claim list
  components/
    evidence/
      EvidenceFilters.jsx         # Filter dropdowns
      EvidenceClaimCard.jsx       # Individual claim card
      EvidenceClaimMetrics.jsx    # Quantitative metrics row (n, HR, CI)
      EvidenceCitation.jsx        # Citation footer with PMID link
      EvidenceEmptyState.jsx      # "No claims found" with guidance
```

### Route

Add to App.jsx router:
```jsx
<Route path="/evidence" element={<EvidencePage />} />
```

---

## Implementation Order for CC

**Prerequisites:** Phase A steps 1-3 must be complete (directory structure, schema, seed from FAQ). The claims store needs data in it before the explorer has anything to show.

1. **Build compile-claims script** — `evidence/scripts/compile-claims.js` → outputs `src/config/evidenceClaims.js`
2. **Create EvidenceClaimCard component** — renders a single claim with type badge, verification badge, headline, detail, metrics, citation
3. **Create EvidenceFilters component** — three primary dropdowns with live count updates
4. **Create EvidencePage** — assembles filters + claim list, handles filter state, URL params
5. **Add route** — `/evidence` in App.jsx
6. **Add navigation** — "Evidence" tab in physician persona header alongside existing "Tests"
7. **Style consistency** — match existing site design language (Tailwind classes, color palette, card styles)
8. **Empty states** — handle 0-result filter combinations gracefully
9. **Provenance footer** — "How we verify evidence" link (can point to a simple markdown page explaining the cross-model verification process)

## Design Principles

- **Every word on screen traces to a PMID or DOI.** No generated text, no summaries, no interpretations.
- **Transparency over polish.** Show claim IDs, verification status, extraction dates. Physicians should be able to audit the data.
- **Honest about gaps.** If we have 0 claims for pancreatic cancer, say so clearly. Don't hide empty categories.
- **Bookmarkable.** Filter state in URL params so physicians can share specific views with colleagues.

---

## Future Enhancements (not in v1)

- **Search bar** with LLM-as-router (natural language → structured filter query)
- **Claim grouping** by source paper
- **Cross-reference to test database** — "Tests relevant to this evidence" links
- **Claim detail view** — click a claim card to see full extraction details, source quote, verification log
- **Export** — download filtered claims as PDF or CSV for presentations/tumor boards
- **"How we verify" page** — detailed explanation of cross-model extraction, peer-review-only gate, dispute resolution
- **Notification signup** — physicians can subscribe to updates for specific cancer types
