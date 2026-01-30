# OpenOnco Coverage Intelligence - System Design

## Mission
Keep OpenOnco's database current on Medicare and private insurance coverage for liquid biopsy diagnostic tests.

## System Overview

Three crawlers monitor coverage policy sources weekly. Claude AI analyzes each detected change inline. A Monday email delivers a self-executing review file for human approval.

```
┌─────────────────────────────────────────────────────┐
│           COVERAGE CRAWLER (Railway)                │
├─────────────────────────────────────────────────────┤
│   ┌─────────┐   ┌──────────┐   ┌─────────┐         │
│   │   CMS   │   │  Payers  │   │ Vendors │         │
│   │  (API)  │   │ (Scrape) │   │ (Scrape)│         │
│   └────┬────┘   └────┬─────┘   └────┬────┘         │
│        │             │              │               │
│        └──────── Claude AI ─────────┘               │
│                      │                              │
│              discoveries.json                       │
│                      │                              │
│              Monday Email                           │
│              + attachment                           │
└─────────────────────────────────────────────────────┘
```

## Crawlers

### 1. CMS Medicare (`src/crawlers/cms.js`)
**Goal:** Detect LCD/NCD policy changes affecting tracked tests

**How it works:**
1. Fetch CMS "What's New" reports
2. Search by keywords: molecular, liquid biopsy, ctDNA, MRD, tumor marker, genomic
3. Claude analyzes each document: coverage decision, affected tests, MolDX relevance

**Output:** Policy ID, title, contractor, coverage decision, affected tests, key changes

### 2. Private Payers (`src/crawlers/payers.js`)
**Goal:** Detect coverage policy changes at major insurers

**How it works:**
1. Scrape 26 URLs (16 payers + 6 vendor coverage pages + 4 LBM pages)
2. Hash comparison detects changes
3. Claude classifies: `substantive_policy_change` vs `formatting_only` vs `unknown`
4. Only substantive changes become discoveries

**Tracked payers:**
- National: UHC, Anthem, Cigna, Aetna, Humana
- Regional BCBS: MA, MI, TX, IL, FL, NC, CareFirst, Blue Shield CA, AZ
- Medicare Advantage: UHC MA
- Lab Benefit Managers: Evicore

**Known issue:** Anthem blocks with HTTP2 protocol error

### 3. Vendor News (`src/crawlers/vendor.js`)
**Goal:** Catch coverage announcements from test manufacturers

**How it works:**
1. Scrape 20 vendor news/press pages via RSS or HTML
2. Hash comparison detects new content
3. Claude identifies coverage-related announcements

**Tracked vendors:** Natera, Guardant, Foundation Medicine, Tempus, GRAIL, Exact Sciences, Caris, NeoGenomics, Myriad, Invitae, Veracyte, Adaptive, Freenome, Resolution, Personalis, Illumina, Agilent, Quest, Labcorp, BillionToOne

## Schedule

| Time | Job |
|------|-----|
| Sunday 11 PM | CMS, Payers, Vendor crawlers run |
| Monday 1 AM | Digest email sent with attachment |

## Monday Review Workflow

1. **Email arrives** with:
   - Crawler run stats (duration, discoveries found/added)
   - Summary counts by source
   - Attached `coverage-review.md` file

2. **Human reviews** by uploading attachment to Claude:
   - Claude presents each discovery with its analysis
   - Human responds: approve / skip / questions
   - Approved items get database updates via openonco-submission skill

3. **Database updated** only after human approval

## Data Files

| File | Purpose |
|------|---------|
| `discoveries.json` | Pending coverage changes for review |
| `health.json` | Crawler run stats and status |
| `payer-hashes.json` | Content hashes + snapshots for change detection and diff generation |
| `vendor-hashes.json` | Content hashes + snapshots for change detection and diff generation |

## Environment Variables

```bash
RESEND_API_KEY=re_...           # Email delivery
ANTHROPIC_API_KEY=sk-ant-...    # Claude AI analysis
DIGEST_RECIPIENT_EMAIL=...       # Where to send Monday digest
DIGEST_FROM_EMAIL=daemon@openonco.org
```

## What Was Removed (Jan 2026 Simplification)

Previous system had 6 crawlers and complex batch triage. Removed:
- PubMed crawler (research publications)
- FDA crawler (regulatory approvals)
- Preprints crawler (bioRxiv/medRxiv)
- Citations crawler
- Batch AI triage system
- GitHub export pipeline
- Local file dependencies for review

Now: 3 crawlers, inline Claude analysis, self-contained email attachment.

## Detection Improvements (Jan 2026)

Reduced false positives and improved Claude's analysis accuracy:

**Canonicalization** (`src/utils/canonicalize.js`)
- Strips dates, copyright notices, and boilerplate before hashing
- Prevents false positives from timestamp/footer changes
- Content normalized to lowercase, whitespace collapsed

**Test Dictionary** (`src/data/test-dictionary.js`)
- 24 tests with PLA codes, names, and aliases
- Deterministic test matching runs BEFORE Claude analysis
- Matches by PLA code (e.g., 0239U), test name, or alias
- Reduces Claude token usage for obvious test mentions

**Diff-Based Analysis** (`src/utils/diff.js`)
- Stores previous content snapshots (max 50KB per page)
- Passes line-based diff to Claude instead of full page content
- Claude sees exactly what changed, improving analysis accuracy
- Format: `+added lines` / `-removed lines`

**Hash Storage Format**
- Previously: stored hash string only
- Now: stores `{ hash, content, fetchedAt }` object
- Enables diff generation between crawl runs
- Content truncated at 50KB to limit storage size
