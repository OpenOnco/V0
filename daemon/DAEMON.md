# OpenOnco Intelligence Daemon

The OpenOnco daemon is an autonomous background intelligence system that monitors multiple data sources for changes relevant to liquid biopsy and molecular diagnostic tests. It runs scheduled crawls, detects changes, analyzes them with AI, and generates human-reviewable proposals for database updates.

**Key Principle:** All discoveries go through a proposal queue for human review before any changes are applied to the main database.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Crawlers](#crawlers)
  - [CMS/Medicare Crawler](#cmsmedicare-crawler)
  - [Vendor Crawler](#vendor-crawler)
  - [Payer Policy Crawler](#payer-policy-crawler)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Test Coverage Database](#test-coverage-database)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      SCHEDULER (Cron)                           │
│           Sunday 11 PM → 11:30 PM → Monday 1 AM                │
└──────────┬────────────────────────────────────────────────────────┘
           │
           ├─→ CMS Crawler (11:00 PM Sun)
           │   └─→ Medicare LCD/NCD coverage determinations
           │
           ├─→ Vendor Crawler (11:00 PM Sun)
           │   └─→ PAP pages, billing info, press releases
           │
           ├─→ Payer Crawler (11:30 PM Sun)
           │   └─→ Commercial policy documents (PDF/HTML)
           │
           └─→ Digest Email (1:00 AM Mon)
               └─→ Weekly summary of all discoveries

           All crawlers:
           ├─ Add discoveries to queue (discoveries.json)
           ├─ Generate proposals (if high confidence)
           ├─ Update health tracking
           └─ Send crawl-complete email with summary
```

---

## Directory Structure

```
daemon/
├── src/
│   ├── index.js                      # Main entry point
│   ├── config.js                     # Master configuration (~1,000 lines)
│   ├── scheduler.js                  # Cron scheduling
│   ├── health.js                     # Uptime/error tracking
│   │
│   ├── crawlers/                     # Web scraping & data collection
│   │   ├── index.js                  # Crawler factory & orchestration
│   │   ├── base.js                   # Base class for all crawlers
│   │   ├── cms.js                    # CMS Coverage Database API
│   │   ├── vendor.js                 # Vendor website crawler
│   │   ├── payers.js                 # Payer policy crawler
│   │   └── playwright-base.js        # Shared Playwright utilities
│   │
│   ├── queue/
│   │   ├── index.js                  # Discovery queue management
│   │   └── store.js                  # File-based storage
│   │
│   ├── proposals/                    # Human-review workflow
│   │   ├── schema.js                 # Proposal types & validation
│   │   ├── queue.js                  # CRUD operations
│   │   ├── cli.js                    # CLI for reviewing
│   │   └── apply.js                  # Apply approved proposals
│   │
│   ├── email/
│   │   ├── index.js                  # Resend API client
│   │   ├── crawl-complete.js         # Per-crawl notifications
│   │   └── templates.js              # Email HTML templates
│   │
│   ├── triage/                       # AI-powered filtering
│   │   ├── mrd-triage.js             # Claude Haiku relevance scoring
│   │   ├── mrd-classifier.js         # Detailed classification
│   │   └── mrd-prefilter.js          # Basic filtering rules
│   │
│   ├── data/
│   │   ├── test-dictionary.js        # Test name matching
│   │   ├── policy-registry.js        # Known payer policy URLs
│   │   └── payer-index-registry.js   # Payer metadata
│   │
│   └── utils/
│       ├── http.js                   # HTTP client with rate limiting
│       ├── canonicalize.js           # Content normalization
│       ├── diff.js                   # Line-based diff computation
│       ├── hash-store.js             # SQLite-based change detection
│       └── logger.js                 # Winston logging
│
├── data/                             # Runtime data
│   ├── discoveries.json              # Pending discoveries queue
│   ├── health.json                   # Crawler health status
│   ├── payer-hashes.db               # SQLite content hashes
│   ├── proposals/                    # Proposal files by type
│   │   ├── coverage/                 # Payer coverage proposals
│   │   ├── updates/                  # Test record updates
│   │   └── new-tests/                # New test submissions
│   └── logs/                         # Daily rotating log files
│
└── tests/                            # Test suite
```

---

## Crawlers

### CMS/Medicare Crawler

**File:** `src/crawlers/cms.js` (~587 lines)

**Purpose:** Monitor Medicare/CMS coverage determinations (NCDs and LCDs)

**Data Access Method:**
1. Fetch license token from CMS Coverage API: `https://api.coverage.cms.gov/v1/metadata/license-agreement`
2. Search NCDs and LCDs via API with keywords:
   - `molecular`, `liquid biopsy`, `ctDNA`, `MRD`, `tumor marker`, `genomic`
3. Filter results for oncology relevance (MolDX, tumor, cancer, biopsy, genomic)
4. Extract PLA codes and look up Medicare CLFS rates
5. Send to Claude Sonnet 4 for analysis of affected tests and coverage implications

**Discovery Types Generated:**
- `MEDICARE_LCD_UPDATE` - Local Coverage Determination changes
- `MEDICARE_NCD_UPDATE` - National Coverage Determination changes
- `CMS_PLA_REFERENCE` - PLA code references found in documents

**Key Features:**
- Deduplicated by "lcdid:version"
- Maintains track of previously seen documents
- Rate limited to 5 requests/minute for .gov sites

---

### Vendor Crawler

**File:** `src/crawlers/vendor.js` (~1,469 lines)

**Purpose:** Monitor vendor websites for coverage, pricing, PAP, and clinical evidence announcements

**Data Access Method:**
1. Uses **Playwright** to render JavaScript-heavy pages
2. Monitors two types of pages:

**PAP/Billing Pages (Priority 1):**
| Vendor | URL Target |
|--------|------------|
| Natera | oncology/billing page |
| Guardant | patient billing page |
| Foundation Medicine | billing resources |
| GRAIL | coverage information |
| Exact Sciences | patient assistance |
| Myriad | affordability page |
| Tempus | billing information |
| Adaptive | patient resources |
| NeoGenomics | patient services |
| Caris | patient support |
| Invitae | patient resources |

**News/Press Release Pages (Priority 2):**
- ~20 vendor newsrooms monitored for announcements

**Scraping Process:**
1. Hash canonicalized content (removes dates, boilerplate)
2. On content change, fetch full page with Playwright
3. Extract with Claude: coverage announcements, pricing, PAP details, PLA codes
4. Match extracted tests to monitored test database

**Discovery Types Generated:**
- `VENDOR_PAP_UPDATE` - Patient assistance program changes
- `VENDOR_PRICE_CHANGE` - Pricing updates
- `VENDOR_PAYMENT_PLAN` - Payment plan offerings
- `VENDOR_PLA_CODE` - New PLA codes announced
- `VENDOR_CLINICAL_EVIDENCE` - New clinical data
- `VENDOR_PERFORMANCE_DATA` - Sensitivity/specificity updates
- `VENDOR_REGULATORY` - FDA status changes
- `VENDOR_NEW_INDICATION` - New cancer type coverage
- `VENDOR_NEW_TEST` - Entirely new test launches

**Rate Limiting:**
- 1 request per 3 seconds
- Max content size: 50KB
- HTTP/1.1 fallback for anti-bot sites
- Retry logic: 3 attempts with 2-4s delays

---

### Payer Policy Crawler

**File:** `src/crawlers/payers.js` (~1,789 lines)

**Purpose:** Monitor insurance payer policy documents for ctDNA/MRD coverage changes

**Data Access Method:**
1. Load policy URLs from `POLICY_REGISTRY` (manually curated)
2. For each policy URL:
   - Fetch with **Playwright** (handles JS-heavy sites, bot protection)
   - Supports both HTML pages and PDF documents
   - Hash canonicalized content
3. On change, compute line-based diff
4. Send to Claude Sonnet 4 for policy analysis
5. Extract: affected tests, coverage status, conditions, effective date

**Policy Registry Structure:**
```javascript
{
  payerId: {
    name: 'Payer Name',
    tier: 1,  // 1=national, 2=regional
    policies: [{
      id: 'policy-id',
      name: 'Policy Title',
      url: 'https://...',
      contentType: 'pdf' | 'html',
      policyType: 'liquid_biopsy' | 'ctdna' | 'molecular_oncology',
      lastVerified: 'YYYY-MM-DD',
    }]
  }
}
```

**Monitored Payers (Tier 1 - ~80% market):**

| Payer | Policy Focus |
|-------|--------------|
| UnitedHealthcare | Molecular Oncology Testing for Cancer |
| Aetna | Tumor Markers (CPB 0352) |
| Cigna | Tumor Profiling (Policy 0520) |
| Anthem/Elevance | Circulating Tumor DNA Panel Testing |
| Humana | Liquid Biopsy, CGP for Solid Tumors |
| Kaiser | Internal policies (limited public) |
| Molina | Medicaid managed care policies |
| Centene/Ambetter | ACA marketplace policies |

**Lab Benefit Managers:**
| LBM | Coverage |
|-----|----------|
| EviCore | Liquid Biopsy Testing (MOL.TS.194.A) |
| AIM Specialty | Molecular Testing Guidelines |
| Carelon | Genetic/Genomic Testing |

**Discovery Types Generated:**
- `PAYER_POLICY_UPDATE` - Existing policy modified
- `PAYER_POLICY_NEW` - New policy document found
- `COVERAGE_CHANGE` - Coverage status changed for a test

**Key Features:**
- SQLite-based hash storage for durability
- URL health tracking (skips repeated failures)
- Test matching via vector embeddings
- Rate limited to 3 requests/minute

---

## Data Flow

```
Scheduled Crawler
       │
       ▼
┌──────────────────────┐
│  Fetch Content       │  HTTP/Playwright
│  (rate limited)      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Canonicalize        │  Remove dates, boilerplate
│  + Hash              │  SHA256
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Compare to          │  SQLite hash store
│  Previous Hash       │
└──────────┬───────────┘
           │ (if changed)
           ▼
┌──────────────────────┐
│  Compute Diff        │  Line-based diff
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  AI Analysis         │  Claude Sonnet 4
│  (extract coverage)  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Create Discovery    │  discoveries.json
└──────────┬───────────┘
           │ (if high confidence)
           ▼
┌──────────────────────┐
│  Create Proposal     │  proposals/{type}/*.json
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Human Review        │  npm run proposals
│  Approve/Reject      │
└──────────┬───────────┘
           │ (if approved)
           ▼
┌──────────────────────┐
│  Apply to data.js    │  Update main database
│  Push to repo        │
└──────────────────────┘
```

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ (ES modules) |
| Web Automation | Playwright + Chromium |
| HTTP Client | Axios + axios-retry |
| Database | SQLite (better-sqlite3) |
| AI Analysis | Claude Sonnet 4 (Anthropic SDK) |
| Email | Resend API |
| Scheduling | node-cron |
| Logging | Winston (daily rotation) |

---

## Test Coverage Database

The following tests have Medicare and/or private insurer coverage information in the OpenOnco database:

### MRD (Molecular Residual Disease) Tests

| Test Name | Vendor | Medicare Status | Medicare Indications | Private Payers |
|-----------|--------|-----------------|---------------------|----------------|
| **Signatera** | Natera | COVERED (LCD L38779) | CRC Stage II-IV, Breast Stage IIb+, NSCLC Stage I-III, Bladder MIBC, Ovarian, ICI monitoring | UHC, Cigna, Anthem BCBS, BCBS Louisiana, Blue Shield CA |
| **Signatera Genome** | Natera | COVERED (LCD L38779) | Same as Signatera (WGS-enhanced) | Same as Signatera |
| **Guardant Reveal MRD** | Guardant Health | COVERED (LCD L38779) | CRC Stage II-III post-surgical, CRC surveillance | BCBS Louisiana, Geisinger, Blue Shield CA |
| **Haystack MRD** | Quest Diagnostics | COVERED (LCD L38779) | CRC Stage II-III | Aetna (CRC only) |
| **NeXT Personal Dx** | Personalis | COVERED (LCD L38822) | Breast Stage II-III surveillance | Aetna (CRC only) |
| **Oncodetect** | Exact Sciences | COVERED (LCD L38779) | CRC Stage II-III | Aetna (CRC only) |
| **Pathlight** | SAGA Diagnostics | COVERED (LCD L38822) | Breast cancer (all subtypes) | Limited commercial |
| **RaDaR ST** | NeoGenomics | COVERED (LCD L38779) | HR+/HER2- breast, HPV-negative H&N | Blue Shield CA |
| **NavDx** | Naveris | COVERED (MolDX) | HPV+ oropharyngeal, HPV+ anal SCC | Highmark, Blue Shield CA |
| **clonoSEQ** | Adaptive Biotechnologies | COVERED (LCD L38779) | MM, B-ALL, CLL, DLBCL, MCL | Broad coverage (FDA-cleared) |
| **Labcorp Plasma Detect** | Labcorp | PARTIAL (emerging) | Stage III colon cancer | Coverage emerging |
| **Caris Assure** | Caris Life Sciences | PARTIAL (MolDX) | Selected solid tumor MRD | Aetna (CRC only) |
| **Tempus xM MRD** | Tempus | PARTIAL (L38779) | CRC MRD detection | Aetna (CRC only) |
| **Invitae PCM** | Labcorp (ex-Invitae) | PARTIAL (L38779) | Selected solid tumors | Coverage emerging |
| **Latitude** | Natera | PARTIAL (L38779) | CRC (tissue-free) | Aetna (CRC only) |
| **FoundationOne Tracker (MRD)** | Foundation Medicine | NOT COVERED | MRD investigational | Not covered |
| **Veracyte MRD** | Veracyte | NOT COVERED | Pre-commercial | Not covered |
| **Guardant LUNAR** | Guardant Health | NOT COVERED | Research Use Only | Not covered |

### TRM (Treatment Response Monitoring) Tests

| Test Name | Vendor | Medicare Status | Medicare Indications | Private Payers |
|-----------|--------|-----------------|---------------------|----------------|
| **Signatera (IO Monitoring)** | Natera | COVERED (LCD L38779) | Pan-solid tumor ICI response | UHC, Cigna, Anthem BCBS, BCBS Louisiana, Blue Shield CA |
| **FoundationOne Tracker (TRM)** | Foundation Medicine | COVERED (LCD L38779) | Solid tumor ICI response monitoring | Not covered (commercial) |
| **NeXT Personal (TRM)** | Personalis | COVERED (LCD L38822) | Breast Stage II-III, select solid tumors | Aetna (CRC only) |
| **clonoSEQ Assay** | Adaptive Biotechnologies | COVERED (LCD L38779) | MM, B-ALL, CLL, MCL | Broad coverage (FDA-cleared) |
| **Liquid Trace (TRM)** | Genomic Testing Coop | COVERED (L38779) | Solid and heme tumors | Not covered |
| **RaDaR (TRM)** | NeoGenomics | LIMITED | Case-by-case | Blue Shield CA |
| **Reveal TRM** | Guardant Health | LIMITED | Pan-cancer (emerging) | Blue Shield CA |
| **Caris Assure (TRM)** | Caris Life Sciences | LIMITED | Case-by-case | Coverage varies |
| **Northstar Response** | BillionToOne | NOT COVERED | Self-pay model | Not covered |
| **Tempus xM for TRM** | Tempus | LIMITED | RUO status | Not covered |

### TDS (Treatment Decision Support) Tests

| Test Name | Vendor | Medicare Status | Medicare Indications | Private Payers |
|-----------|--------|-----------------|---------------------|----------------|
| **FoundationOne CDx** | Foundation Medicine | COVERED | Advanced solid tumors (FDA-approved CDx) | Aetna, Anthem BCBS, Blue Shield CA |
| **FoundationOne Liquid CDx** | Foundation Medicine | COVERED | Advanced solid tumors when tissue unavailable | Anthem BCBS, Humana, Blue Shield CA, Aetna |
| **FoundationOne Heme** | Foundation Medicine | COVERED | Hematologic malignancies | Anthem BCBS, Humana, Blue Shield CA, Aetna |
| **Guardant360 CDx** | Guardant Health | COVERED | Advanced solid tumors (FDA-approved CDx) | Anthem BCBS, Humana, Blue Shield CA, Aetna |
| **Guardant360 Liquid** | Guardant Health | COVERED | Pan-solid tumor profiling | Blue Shield CA |
| **Tempus xT CDx** | Tempus | COVERED | Solid tumor CGP | Blue Shield CA |
| **Tempus xF / xF+** | Tempus | COVERED | Liquid biopsy profiling | Blue Shield CA |
| **MSK-IMPACT** | Memorial Sloan Kettering | COVERED | Pan-cancer profiling | MSKCC patients |
| **Oncotype DX Breast** | Exact Sciences | COVERED | ER+/HER2- breast cancer | UHC, Aetna, Cigna |
| **Liquid Trace Solid Tumor** | Genomic Testing Coop | COVERED | Pan-solid profiling | Blue Shield CA, Aetna |
| **LiquidHALLMARK** | Resolution Bio | COVERED | Pan-cancer profiling | Blue Shield CA, Aetna |

### ECD (Early Cancer Detection) Tests

| Test Name | Vendor | Medicare Status | Medicare Indications | Private Payers |
|-----------|--------|-----------------|---------------------|----------------|
| **Galleri** | GRAIL | NOT COVERED (Medicare evaluation) | Multi-cancer detection (50+) | Curative, Fountain Health, Alignment Health |
| **Shield** | Guardant Health | COVERED (MolDX) | Colorectal cancer screening (45+) | Humana |
| **Cologuard Plus** | Exact Sciences | COVERED | Colorectal cancer screening | UHC, Aetna, Cigna, BCBS, Humana |
| **Cologuard** | Exact Sciences | COVERED | CRC screening (45+) | Broad coverage |
| **ColoSense** | Geneoscopy | COVERED | CRC screening | Coverage emerging |
| **Epi proColon** | Epigenomics | COVERED | CRC screening | Limited |

### HCT (Hereditary Cancer Testing) Tests

| Test Name | Vendor | Medicare Status | Medicare Indications | Private Payers |
|-----------|--------|-----------------|---------------------|----------------|
| Multiple panels | Myriad, Invitae, Ambry, Color, GeneDx | COVERED | BRCA1/2, Lynch syndrome, multi-gene panels | Broad coverage when criteria met |

---

## Medicare Coverage Summary by LCD

| LCD Number | Coverage Area | Tests Covered |
|------------|---------------|---------------|
| **L38779** | Solid Tumor MRD | Signatera, Guardant Reveal, Haystack, Oncodetect, NavDx, clonoSEQ, Caris Assure |
| **L38822** | Breast Cancer MRD | NeXT Personal Dx, Pathlight, RaDaR ST |
| **L38835** | NSCLC MRD | Signatera (Stage I-III surveillance) |
| **L38816** | Ovarian Cancer | Signatera (adjuvant/recurrence) |
| **MolDX** | Various | NavDx (HPV cancers), Shield (CRC screening), Liquid Trace |

---

## Private Payer Coverage Summary

| Payer | Coverage Stance | Tests Explicitly Covered |
|-------|-----------------|--------------------------|
| **Aetna** | Conservative | Signatera (CRC only), FoundationOne CDx, Guardant360 CDx |
| **UnitedHealthcare** | Very Conservative | Lists most MRD as "Unproven" per 2026 policy |
| **Cigna** | Moderate | Signatera (in-network), profiling tests |
| **Anthem BCBS** | Moderate | Signatera, FoundationOne, Guardant360 |
| **Blue Shield CA** | Progressive | Broad MRD and profiling coverage (conditional) |
| **BCBS Louisiana** | Progressive | Guardant Reveal (first commercial MRD coverage) |
| **Humana** | Moderate | Shield, liquid biopsy profiling |
| **Geisinger** | Progressive | Guardant Reveal |
| **Highmark** | Progressive | NavDx |

---

## Running the Daemon

```bash
# Development
npm run dev              # Run with auto-reload

# Manual crawl triggers
npm run crawl:cms        # CMS/Medicare crawler
npm run crawl:vendor     # Vendor crawler
npm run crawl:payers     # Payer policy crawler

# Proposal management
npm run proposals        # Review pending proposals
npm run proposals:apply  # Apply approved proposals

# Testing
npm run test:email       # Test digest email
```

---

## Configuration

Key environment variables:

```bash
# Required
ANTHROPIC_API_KEY=      # Claude API for analysis
RESEND_API_KEY=         # Email notifications

# Optional
CRAWLER_CMS_ENABLED=true
CRAWLER_VENDORS_ENABLED=true
CRAWLER_PAYERS_ENABLED=true
LOG_LEVEL=info
```

---

## Scheduling

| Job | Schedule | Description |
|-----|----------|-------------|
| CMS Crawler | Sunday 11:00 PM | Medicare coverage determinations |
| Vendor Crawler | Sunday 11:00 PM | PAP and press releases |
| Payer Crawler | Sunday 11:30 PM | Commercial policy documents |
| Digest Email | Monday 1:00 AM | Weekly summary |
| Cleanup | Daily midnight | Remove discoveries > 30 days |
