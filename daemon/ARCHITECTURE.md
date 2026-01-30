# OpenOnco Daemon - Architecture & Status Summary
**Date:** January 30, 2026  
**Purpose:** Context for continuing work in a new chat session

---

## Overview

The OpenOnco daemon is an autonomous monitoring system that crawls multiple data sources to detect changes relevant to liquid biopsy and molecular diagnostic tests. It generates weekly digest emails with discoveries for human review.

**Repository:** `/Users/adickinson/Documents/GitHub/V0/daemon/`  
**Deployment:** Railway (not yet deployed to production)  
**Schedule:** Sunday 11 PM crawl → Monday 1 AM digest email

---

## Architecture

### Core Components

```
daemon/
├── src/
│   ├── index.js          # Main entry point, scheduler
│   ├── scheduler.js      # Cron scheduling (Sunday crawl, Monday digest)
│   ├── config.js         # 691 lines - payers, vendors, tests, discovery types
│   ├── crawlers/
│   │   ├── cms.js        # 587 lines - CMS Coverage Database API v1
│   │   ├── vendor.js     # 1469 lines - Press releases + PAP pages
│   │   ├── payers.js     # 1789 lines - Insurance policy pages
│   │   └── index.js      # Crawler orchestration
│   ├── email/
│   │   ├── monday-digest.js  # Weekly digest generation
│   │   └── templates.js      # Email HTML templates
│   ├── queue/
│   │   └── store.js      # Discovery queue management
│   └── utils/
│       ├── medicare-rates.js  # CLFS rate lookup
│       ├── canonicalize.js    # Content normalization
│       └── diff.js            # Change detection
├── data/
│   ├── discoveries.json  # Pending discoveries queue
│   ├── health.json       # Crawler health status
│   ├── vendor-hashes.json    # Content change detection
│   └── payer-hashes.json     # Content change detection
└── logs/                 # Daily rotating logs
```

### Technology Stack

- **Runtime:** Node.js with ES modules
- **Web Scraping:** Playwright (JS-heavy pages), HTTP fetch (APIs)
- **AI Analysis:** Claude Sonnet 4 via Anthropic API
- **Email:** Resend API
- **Scheduling:** node-cron
- **Deployment:** Railway (Docker)

---

## Four Goals Assessment

### Goal (a): CMS/Medicare Coverage Updates
**Status: ✅ FULLY IMPLEMENTED**

- CMS Coverage Database API v1 integration
- Searches NCDs, LCDs, and What's New reports
- Keywords: 'molecular', 'liquid biopsy', 'ctDNA', 'MRD', 'tumor marker', 'genomic'
- AI analysis extracts: coverage decisions, affected tests, PLA codes
- Medicare CLFS rate lookup for PLA codes
- Oncology relevance filtering

### Goal (b): Private Payer Coverage Collection
**Status: ⚠️ PARTIALLY IMPLEMENTED (30% operational)**

Technology complete:
- Playwright scraping with HTTP/1.1 fallback (Anthem)
- Hash-based change detection with content snapshots
- Diff computation for precise change analysis
- Claude AI policy change analysis
- 30+ search keywords for ctDNA/MRD/liquid biopsy

URL coverage gap:
- **Configured:** ~20 payers have crawler URLs
- **TODO:** ~50 payers marked as needing URLs
- Missing: Most regional BCBS plans, Medicare Advantage, Lab Benefit Managers

Configured payers with URLs:
- National: UHC, Anthem, Cigna, Aetna, Humana
- Regional BCBS: MA, MI, TX, IL, Florida Blue, NC, Highmark, CareFirst, Excellus, IBX, Blue Shield CA, Premera, Regence, Horizon, Wellmark
- Medicare Advantage: UHC MA only
- Lab Benefit Managers: Evicore only

### Goal (c): PAP Information Updates
**Status: ✅ FULLY IMPLEMENTED**

11 vendor PAP/billing pages monitored:
- Natera, Guardant Health, Foundation Medicine, GRAIL
- Exact Sciences, Myriad Genetics, Tempus
- Adaptive Biotechnologies, NeoGenomics, Caris Life Sciences, Invitae

Financial intelligence extraction:
- Cash/list prices, PAP program details, payment plans
- Copay assistance, insurance coverage mentions
- PLA codes with Medicare rate lookups

### Goal (d): Vendor Press Release Monitoring
**Status: ✅ FULLY IMPLEMENTED**

20+ vendor news sources monitored:
- Major ctDNA/MRD: Natera, Guardant, Foundation Medicine, Tempus, Caris, GRAIL
- Large reference labs: Exact Sciences, Labcorp, Quest
- Specialized: Adaptive, NeoGenomics, Personalis, Myriad, Invitae, Veracyte, Freenome, BillionToOne, Resolution Bioscience, Burning Rock, Helio Genomics

Intelligence extraction categories:
- Coverage announcements, PLA/CPT codes
- Clinical evidence (trials, publications)
- Performance data (sensitivity, specificity)
- Regulatory updates (FDA actions)
- New indications, new test launches

RSS fallbacks for anti-bot sites: Adaptive, Veracyte

---

## Current State (as of Jan 30, 2026)

### Crawler Health

| Crawler | Status | Last Run | Result |
|---------|--------|----------|--------|
| CMS | ✅ Working | 12:37 PM | 1 discovery (MolDX article) |
| Vendors | ✅ Working | 12:20 PM | 31 pages crawled, 0 new discoveries |
| Payers | ⚠️ Not scheduled | - | Technology ready, not in cron |
| Digest | ✅ Working | 12:51 PM | Successfully sent |

### Pending Discoveries (2 items)

1. **CMS MolDX Article** (Jan 30, 04:30 UTC)
   - Title: "Billing and Coding: MolDX: Lab-Developed Tests for Inherited Cancer Syndromes"
   - Affected tests: FoundationOne CDx, Guardant360 CDx, Tempus xT, Caris MI, Oncotype DX
   - Effective: January 1, 2026

2. **Exact Sciences CRANE Study** (Jan 30, 18:09 UTC)
   - Title: "First participant enrolled in multi-cancer early detection clinical evaluation in Japan"
   - Test: Multi-Cancer Early Detection test
   - Date: December 18, 2025

### Database Stats (from main V0 repo)
- **Total tests:** 148
- **Tests with CPT/PLA codes:** 37 (25%)
- **PAP vendors in database:** 15 with detailed eligibility rules

---

## Key Configuration (src/config.js)

### Monitored Tests by Category

**MRD (15 tests):**
Signatera, Guardant Reveal, FoundationOne Tracker, clonoSEQ, Tempus xM MRD, RaDaR, Oncodetect, Invitae PCM, Resolution ctDx Lung MRD, PhasED-seq, C2inform, NeXT Personal, TrueBlood, AVENIO, CancerIntercept

**TDS/CGP (17 tests):**
FoundationOne CDx, FoundationOne Liquid CDx, Guardant360 CDx, Guardant360 TissueNext, Tempus xT, Tempus xF, Caris MI Profile, Oncotype DX, Prosigna, MammaPrint, EndoPredict, Decipher, GPS, Afirma, ThyroSeq, Percepta, Envisia

**ECD (10 tests):**
Galleri, Shield, Freenome, CancerSEEK, DELFI, PanSeer, OverC, CancerIntercept Detect, Cologuard Plus, FirstLook Lung

### Discovery Types
- MEDICARE_LCD_UPDATE, MEDICARE_NCD_UPDATE
- PAYER_POLICY_UPDATE, PAYER_POLICY_NEW, COVERAGE_CHANGE
- VENDOR_COVERAGE_ANNOUNCEMENT, VENDOR_PAP_UPDATE
- VENDOR_PRICE_CHANGE, VENDOR_PAYMENT_PLAN, VENDOR_PLA_CODE
- CMS_PLA_REFERENCE, VENDOR_CLINICAL_EVIDENCE
- VENDOR_PERFORMANCE_DATA, VENDOR_REGULATORY
- VENDOR_NEW_INDICATION, VENDOR_NEW_TEST

---

## Pending Work

### High Priority
1. **Enable payer crawler in scheduler** - Currently not running on cron
2. **Add payer URLs** - ~50 payers missing URLs (marked TODO in payers.js)
3. **Deploy to Railway** - Push daemon to production

### Medium Priority
4. **Process pending discoveries** - 2 items in queue
5. **Add approval CLI** - Streamline discovery review workflow
6. **Test end-to-end** - Full Sunday→Monday cycle

### Payer URL Gaps (partial list)
- Regional BCBS: AZ, MN, TN, KC, LA (URLs marked TODO)
- Medicare Advantage: Humana MA, Aetna MA (URLs marked TODO)
- Lab Benefit Managers: AIM, Avalon (URLs marked TODO)
- Other Large: Kaiser, Molina, Centene, HCSC (URLs marked TODO)

---

## Quick Commands

```bash
# Navigate to daemon
cd /Users/adickinson/Documents/GitHub/V0/daemon

# Run specific crawler
node run-now.js --crawler=cms
node run-now.js --crawler=vendors
node run-now.js --crawler=payers

# Send test digest
node send-digest.js

# Run tests
npm test

# View logs
tail -f logs/daemon-$(date +%Y-%m-%d).log

# Check discoveries
cat data/discoveries.json | jq '.[] | {title, status}'
```

---

## Related Files in Main V0 Repo

- `src/data.js` - Main database with tests and PAP programs
- `api/v1/index.js` - REST API including /assistance endpoints
- `scripts/update-medicare-rates.js` - CLFS rate updates
- `scripts/export-mcp-data.js` - Exports data for MCP tools

---

*Last updated: January 30, 2026, 2:45 PM PST*
