# MRD Guidance Monitor

## Project Overview

A new capability for the OpenOnco physician portal that helps doctors stay current on MRD (Molecular Residual Disease) testing evidence in solid tumors.

### The Problem

Physicians are ordering MRD tests and receiving results, but formal guidelines lag behind practice:

- **NCCN and ASCO do not currently recommend ctDNA for MRD monitoring** - citing lack of demonstrated "clinical utility"
- **Yet experts are already using MRD in practice** - tests are ordered, results come back positive
- **This creates a guidance vacuum** - "My patient's MRD test came back positive. Now what?"

### Our Solution

Aggregate and organize emerging evidence (guidelines, trial results, publications, regulatory changes) so physicians can find relevant references and **draw their own conclusions**.

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Feature name** | MRD Guidance Monitor | Clear, specific |
| **Scope** | MRD only | Hottest topic, clearest pain point. Expand later. |
| **Authentication** | Newsletter only | Search is open; digest requires email |
| **Editorial stance** | References only, no opinions | Docs draw their own conclusions |
| **Tone** | Non-profit, no marketing, just data | Build trust through neutrality |

### Editorial Principles

1. **No expert opinions or editorializing** - just references and citations
2. **No marketing** - we're a non-profit providing data
3. **Vendor-neutral** - not promoting any specific test
4. **Evidence-graded where available** - report the grade as stated in source, don't assign our own

---

## Page Design

### Location
Top of physician persona page at openonco.org, above existing test search gadgets.

### Hero Section (Option A - Selected)

```
"My patient's MRD test came back positive. Now what?"

Clinical evidence for ctDNA and liquid biopsy is advancing faster 
than formal guidelines. We aggregate the latest research, trial 
results, and consensus statements so you can find the references 
you need.
```

### Layout: Two Panels Side-by-Side

**Left Panel: Search Guidance Database**
```
┌─────────────────────────────────────────┐
│  🔬 Search MRD Guidance                 │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🔍 Search guidelines, trials...   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Filter by cancer:                      │
│  [Colorectal] [Breast] [Lung] [Bladder] │
│                                         │
│  Common searches:                       │
│  • Positive MRD result management       │
│  • Post-surgery testing timing          │
│  • Therapy de-escalation evidence       │
│                                         │
│  ─────────────────────────────────────  │
│  📊 142 references • 47 active trials   │
└─────────────────────────────────────────┘
```

**Right Panel: Weekly Digest Signup**
```
┌─────────────────────────────────────────┐
│  📧 Weekly Digest                       │
│                                         │
│  New MRD evidence, delivered Fridays.   │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ Email address                     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Cancer types (optional):               │
│  ☐ Colorectal  ☐ Breast  ☐ Lung  ☐ All │
│                                         │
│  [ Subscribe - Free ]                   │
│                                         │
│  ─────────────────────────────────────  │
│  ✓ Non-profit • No marketing            │
│  ✓ Just curated references              │
│  ✓ Unsubscribe anytime                  │
└─────────────────────────────────────────┘
```

### Below: Existing Test Search
Section divider, then existing MRD/ECD/TDS/HCT gadgets unchanged.

---

## System Components

### 1. Crawler System ← CURRENT FOCUS
Automated collection from multiple sources. **See CRAWLER.md for detailed spec.**

### 2. Guidance Database
Structured storage with cancer type tagging, clinical setting tags, evidence levels, full-text search. See DATABASE.md.

### 3. Weekly Digest Email
Friday delivery of week's updates. See DIGEST.md.

### 4. Search Interface
Faceted search with filters. See SEARCH-UI.md.

---

## Data Sources (Prioritized)

### 🔴 Critical Priority
1. **PubMed** - Guidelines, consensus statements, trial results
2. **ClinicalTrials.gov** - Interventional MRD trials (50+ active)
3. **NCCN** - Via JNCCN journal monitoring

### 🟠 High Priority
4. **ASCO Meeting Abstracts** - Major conference presentations
5. **CMS Coverage** - NCDs/LCDs (existing MCP integration)
6. **JCO / Annals of Oncology** - Society guidelines

### 🟡 Medium Priority
7. **ESMO Congress Abstracts**
8. **FDA Guidance Documents**
9. **OncLive/Cancer Network** - News (filtered carefully)

### 🟢 Lower Priority
10. medRxiv/bioRxiv preprints (flagged as non-peer-reviewed)
11. FDA device clearances
12. Specialty society position papers

---

## Clinical Questions This Addresses

1. What do I do with a positive MRD result?
2. When should I test for MRD? (timing, frequency)
3. Can I de-escalate therapy based on negative MRD?
4. Which test approach? (tumor-informed vs tumor-naïve)
5. What does the latest trial data show?
6. What do guidelines actually say? (often "not recommended" - but stated clearly with evidence level)

---

## Implementation Phases

### Phase 1: Crawler Foundation ← NOW
- Database schema
- PubMed crawler
- ClinicalTrials.gov crawler
- Basic admin review interface

### Phase 2: Expand Sources
- NCCN/JNCCN monitoring
- CMS coverage integration
- ASCO abstracts
- FDA guidance

### Phase 3: Digest Email
- Template system
- Subscription management
- Weekly generation

### Phase 4: Search Interface
- Physician portal UI
- Filters
- Detail views

### Phase 5: Launch
- Content review
- Gap analysis
- Documentation

---

## Key Named Trials to Track

| Trial | Cancer | Status | Key Question |
|-------|--------|--------|--------------|
| CIRCULATE-US | CRC | Recruiting | ctDNA-guided adjuvant |
| CIRCULATE-Japan/GALAXY | CRC | Ongoing | ctDNA-guided adjuvant |
| DYNAMIC | CRC | Published | ctDNA-guided adjuvant |
| COBRA | CRC | Ongoing | ctDNA-guided adjuvant |
| PEGASUS | CRC | Recruiting | ctDNA-guided adjuvant |
| c-TRAK TN | Breast | Published | ctDNA for intervention |
| ZEST | Breast | Ongoing | ctDNA for intervention |
| IMpower010 | Lung | Published | ctDNA as prognostic |
| MeRmaiD-1/2 | Multi | Ongoing | ctDNA-guided therapy |
| TRACERx | Lung | Ongoing | ctDNA biology |
| BESPOKE CRC | CRC | Registry | Real-world MRD use |

---

## Files

```
docs/mrd-guidance-monitor/
├── README.md           # This file - overview & decisions
├── CRAWLER.md          # Detailed crawler specification
├── SOURCES.md          # Source-by-source mining strategies
├── DATABASE.md         # Database schema
├── DIGEST.md           # Email digest format
└── SEARCH-UI.md        # Search interface design
```
