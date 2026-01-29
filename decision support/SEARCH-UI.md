# MRD Guidance Monitor: Search Interface

## Overview

Faceted search interface for physicians to find relevant MRD guidance references.

---

## Design Principles

1. **Fast to relevant results** - Common searches pre-built
2. **Filter-first** - Most users will filter by cancer type first
3. **Reference-focused** - Clear links to sources (PubMed, NCT, etc.)
4. **No opinions** - Present facts, let physicians conclude

---

## Search Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  MRD Guidance Monitor                              [Subscribe to Digest]    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search guidelines, trials, publications...                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐  ┌───────────────────────────────────────────────┐ │
│  │                     │  │                                               │ │
│  │  FILTERS            │  │  RESULTS                                      │ │
│  │                     │  │                                               │ │
│  │  Cancer Type        │  │  Showing 24 of 142 items                      │ │
│  │  ☑ Colorectal       │  │  Sort: [Relevance ▼]                          │ │
│  │  ☐ Breast           │  │                                               │ │
│  │  ☐ Lung             │  │  ┌─────────────────────────────────────────┐  │ │
│  │  ☐ Bladder          │  │  │ 📋 GUIDELINE                            │  │ │
│  │  ☐ Other...         │  │  │                                         │  │ │
│  │                     │  │  │ NCCN Colon Cancer Guidelines v2.2026    │  │ │
│  │  Clinical Setting   │  │  │ Updated Jan 24, 2026                    │  │ │
│  │  ☑ Post-surgery     │  │  │                                         │  │ │
│  │  ☐ Surveillance     │  │  │ MRD: "ctDNA may be considered..."       │  │ │
│  │  ☐ Adjuvant         │  │  │ Evidence: Category 2A                   │  │ │
│  │  ☐ Metastatic       │  │  │                                         │  │ │
│  │                     │  │  │ [Colorectal] [Post-surgery]             │  │ │
│  │  Question           │  │  │                                         │  │ │
│  │  ☐ When to test     │  │  │ → View source                           │  │ │
│  │  ☑ Positive result  │  │  └─────────────────────────────────────────┘  │ │
│  │  ☐ De-escalation    │  │                                               │ │
│  │                     │  │  ┌─────────────────────────────────────────┐  │ │
│  │  Source Type        │  │  │ 🔬 TRIAL RESULTS                        │  │ │
│  │  ☑ Guidelines       │  │  │                                         │  │ │
│  │  ☑ Trial results    │  │  │ CIRCULATE-Japan: Primary endpoint...    │  │ │
│  │  ☐ Consensus        │  │  │ JCO, Jan 22, 2026 | NCT04120701         │  │ │
│  │  ☐ Coverage         │  │  │                                         │  │ │
│  │                     │  │  │ Finding: ctDNA-guided approach...       │  │ │
│  │  Date Range         │  │  │                                         │  │ │
│  │  [Last 6 months ▼]  │  │  │ [Colorectal] [Post-surgery] [Adjuvant]  │  │ │
│  │                     │  │  │                                         │  │ │
│  │  [Clear filters]    │  │  │ → PubMed | → NCT                        │  │ │
│  │                     │  │  └─────────────────────────────────────────┘  │ │
│  └─────────────────────┘  │                                               │ │
│                           │  [Load more...]                               │ │
│                           │                                               │ │
│                           └───────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Filter Options

### Cancer Type
- Colorectal
- Breast  
- Lung (NSCLC)
- Bladder
- Pancreatic
- Melanoma
- Other solid tumors
- Multi-cancer / Pan-solid

### Clinical Setting
- Post-surgery (primary)
- During adjuvant therapy
- Post-adjuvant (surveillance)
- Recurrence/progression
- Metastatic

### Clinical Question
- When to test for MRD?
- Which test to use?
- What to do with positive result?
- What to do with negative result?
- Can I de-escalate therapy?
- Can I escalate therapy?
- Prognosis/risk stratification

### Source Type
- Guidelines (NCCN, ASCO, ESMO)
- Clinical trial results
- Consensus statements
- Coverage policies (LCD/NCD)
- Regulatory (FDA)

### Date Range
- Last 30 days
- Last 6 months
- Last year
- All time
- Custom range

---

## Result Card Design

```
┌─────────────────────────────────────────────────────────────┐
│ [Type Badge]                           [Evidence Level]     │
│                                                             │
│ Title (linked to detail view)                               │
│ Source • Date • Authors (if applicable)                     │
│                                                             │
│ Summary snippet (2-3 lines)                                 │
│                                                             │
│ [Tag] [Tag] [Tag]                                           │
│                                                             │
│ → Primary source link  |  → Secondary link (if applicable)  │
└─────────────────────────────────────────────────────────────┘
```

Type badges:
- 📋 GUIDELINE (blue)
- 🔬 TRIAL (green)
- 📄 CONSENSUS (purple)
- 💰 COVERAGE (orange)
- ⚖️ REGULATORY (gray)

---

## Pre-Built Searches (Common Questions)

Display as clickable links below search box:

- "Positive MRD result in colorectal cancer"
- "Post-surgery testing timing"
- "De-escalation based on negative ctDNA"
- "NCCN guidelines mentioning MRD"
- "Active interventional MRD trials"

---

## Detail View

When clicking a result, expand or navigate to detail view:

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to results                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ NCCN Colon Cancer Guidelines v2.2026                        │
│ 📋 Guideline | Evidence: Category 2A                        │
│                                                             │
│ Updated: January 24, 2026                                   │
│ Source: NCCN.org                                            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Summary                                                     │
│ ───────                                                     │
│ The v2.2026 update includes updated language on ctDNA       │
│ testing post-surgery. Key statement: "Circulating tumor     │
│ DNA (ctDNA) testing may be considered to assess risk of     │
│ recurrence in patients with stage II-III colon cancer       │
│ following curative intent surgery."                         │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Applies to                                                  │
│ ──────────                                                  │
│ Cancer: Colorectal                                          │
│ Setting: Post-surgery, Surveillance                         │
│ Questions: When to test, Prognosis                          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Source Links                                                │
│ ────────────                                                │
│ → NCCN Guidelines (requires login)                          │
│ → JNCCN Insights article (PMID: 12345678)                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Related Items                                               │
│ ─────────────                                               │
│ • NCCN Colon Cancer v1.2026 (superseded)                    │
│ • CIRCULATE-Japan trial (cited as evidence)                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

```
GET /api/mrd-guidance/search
  ?q=positive%20MRD
  &cancer_types=colorectal,breast
  &clinical_settings=post_surgery
  &questions=positive_result_action
  &source_types=guideline,trial
  &date_from=2025-01-01
  &sort=relevance|date
  &limit=20
  &offset=0

GET /api/mrd-guidance/:id
  → Full detail for single item

GET /api/mrd-guidance/filters
  → Available filter options with counts

GET /api/mrd-trials
  ?status=recruiting
  &cancer_types=colorectal
  &is_priority=true
```

---

## Mobile Considerations

- Filters collapse to bottom sheet
- Cards stack vertically
- Type badge becomes icon only
- Search prominent at top
