# Payer Coverage Intelligence Crawler

**Version:** 2.1.1
**Last Updated:** 2026-02-02
**Purpose:** Monitor private payer policy documents for ctDNA/MRD/liquid biopsy coverage changes

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Policy Registry](#3-policy-registry)
4. [Change Detection](#4-change-detection)
5. [Extraction Pipeline](#5-extraction-pipeline)
6. [Delegation Tracking](#6-delegation-tracking)
7. [Coverage Assertions](#7-coverage-assertions)
8. [Operations](#8-operations)
9. [Data Files](#9-data-files)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

### 1.1 Purpose

The Payer Crawler monitors insurance company policy documents for coverage changes affecting ctDNA, MRD (Molecular Residual Disease), and liquid biopsy diagnostic tests. It detects policy updates, extracts coverage details, and creates human-reviewable proposals for database updates.

### 1.2 Key Capabilities

| Capability | Description |
|------------|-------------|
| **Multi-hash Detection** | 4 independent hashes detect meaningful vs cosmetic changes |
| **Deterministic Extraction** | Extracts dates, codes, tests, criteria without LLM calls |
| **Delegation Detection** | Identifies when payers delegate to Lab Benefit Managers |
| **Layered Coverage** | Tracks policy stance, UM criteria, and LBM guidelines separately |
| **Artifact Storage** | Stores raw documents for audit trail |

### 1.3 Monitored Payers

**Tier 1 National (~80% market):**
- UnitedHealthcare, Aetna, Cigna, Anthem/Elevance, Humana

**Regional BCBS:**
- Blue Cross Massachusetts, Michigan, Texas, Illinois, Florida Blue, North Carolina, CareFirst, Excellus, Independence Blue Cross, Blue Shield CA, Premera, Regence, Horizon, Wellmark

**Lab Benefit Managers:**
- Carelon (formerly AIM), eviCore

---

## 2. Architecture

### 2.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PAYER CRAWLER v2                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────┐         ┌───────────────┐         ┌───────────────┐  │
│  │Policy Registry│────────▶│  Playwright   │────────▶│   Content     │  │
│  │ (known URLs)  │         │  Browser      │         │   Fetch       │  │
│  └───────────────┘         └───────────────┘         └───────┬───────┘  │
│                                                              │          │
│                                                              ▼          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    EXTRACTION PIPELINE                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │  dates   │ │  codes   │ │  tests   │ │ criteria │            │   │
│  │  │ extractor│ │ extractor│ │ extractor│ │ extractor│            │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘            │   │
│  │       │            │            │            │                   │   │
│  │       └────────────┴────────────┴────────────┘                   │   │
│  │                           │                                      │   │
│  └───────────────────────────┼──────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    MULTI-HASH COMPARISON                         │   │
│  │                                                                  │   │
│  │   contentHash    metadataHash    criteriaHash    codesHash      │   │
│  │   (catch-all)    (dates/IDs)     (coverage)      (billing)      │   │
│  │                                                                  │   │
│  │   Changes detected? ──────────────────▶ Priority assignment     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                   ┌──────────┴──────────┐                              │
│                   │ shouldAnalyze()?    │                              │
│                   └──────────┬──────────┘                              │
│                              │ YES                                      │
│                              ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    CLAUDE SONNET 4 ANALYSIS                      │   │
│  │  • Coverage status (supports/restricts/denies)                   │   │
│  │  • Cancer type restrictions                                      │   │
│  │  • Clinical settings (MRD, surveillance, etc.)                   │   │
│  │  • Test-specific coverage details                                │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐          │
│  │  Discoveries  │    │   Proposals   │    │   Artifact    │          │
│  │    Queue      │    │    Queue      │    │    Store      │          │
│  └───────────────┘    └───────────────┘    └───────────────┘          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ (ES Modules) |
| Browser | Playwright + Chromium |
| AI Analysis | Claude Sonnet 4 (Anthropic SDK) |
| Storage | SQLite (better-sqlite3) + JSON |
| PDF Parsing | pdf-parse |
| Logging | Winston |

### 2.3 Source Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/crawlers/payers.js` | ~800 | Main crawler class |
| `src/crawlers/playwright-base.js` | ~700 | Browser automation utilities |
| `src/data/policy-registry.js` | ~400 | Known policy URLs |
| `src/data/payer-index-registry.js` | ~400 | Index page metadata |
| `src/data/delegation-map.js` | ~200 | Payer→LBM delegation data |
| `src/utils/multi-hash.js` | ~250 | 4-hash change detection |
| `src/utils/hash-store.js` | ~500 | SQLite storage layer |
| `src/utils/artifact-store.js` | ~150 | Raw document storage |
| `src/extractors/*.js` | ~1,500 | Deterministic extractors |

---

## 3. Policy Registry

### 3.1 Structure

The policy registry (`src/data/policy-registry.js`) maps payers to their known policy documents:

```javascript
export const POLICY_REGISTRY = {
  aetna: {
    name: 'Aetna',
    tier: 1,
    policies: [
      {
        id: 'aetna-cpb-0352',
        name: 'Tumor Markers (CPB 0352)',
        url: 'https://www.aetna.com/cpb/medical/data/300_399/0352.html',
        contentType: 'html',      // 'html' | 'pdf'
        policyType: 'tumor_markers',
        docType: 'medical_policy', // See 3.2
        discoveryMethod: 'manual',
        lastVerified: '2026-02-01',
        notes: 'Primary ctDNA/liquid biopsy policy',
      },
    ],
  },
};
```

### 3.2 Document Types (docType)

| docType | Description | Weight in Reconciliation |
|---------|-------------|-------------------------|
| `medical_policy` | Evidence review stance ("investigational", "unproven") | Medium |
| `um_criteria` | Operational prior auth rules | High (authoritative) |
| `lbm_guideline` | Lab Benefit Manager guidelines | High (if delegated) |
| `provider_bulletin` | Delegation announcements, code changes | Low |
| `index_page` | Policy search/index page (not crawled for content) | N/A |

### 3.3 Policy Types

| policyType | Coverage Focus |
|------------|----------------|
| `ctdna` | Circulating tumor DNA testing specifically |
| `liquid_biopsy` | Broader liquid biopsy policies |
| `molecular_oncology` | General molecular/genomic testing |
| `mrd` | Minimal/Molecular residual disease |
| `tumor_markers` | Tumor marker testing (often includes ctDNA) |

### 3.4 Adding New Policies

1. Research the payer's policy portal
2. Find direct URL to ctDNA/liquid biopsy policy (PDF or HTML)
3. Verify URL loads in browser (some have bot protection)
4. Add entry to `POLICY_REGISTRY` with all fields
5. Run `node scripts/test-policy-fetch.js <policy-id>` to verify

---

## 4. Change Detection

### 4.1 Multi-Hash System

The crawler computes 4 independent hashes to detect different types of changes:

| Hash | Computes | Triggers Analysis |
|------|----------|-------------------|
| `contentHash` | SHA256 of full canonicalized text | Catches everything, including boilerplate |
| `metadataHash` | Hash of dates, policy ID, version | Effective date changes |
| `criteriaHash` | Hash of coverage criteria section | **HIGH** - Coverage stance changes |
| `codesHash` | Hash of CPT/PLA/HCPCS code tables | **HIGH** - Billing code changes |

### 4.2 Priority Assignment

```javascript
function shouldAnalyze(comparison) {
  // Always analyze if criteria or codes changed
  if (comparison.criteriaHashChanged || comparison.codesHashChanged) {
    return { analyze: true, priority: 'high' };
  }

  // Analyze metadata changes (effective dates)
  if (comparison.metadataHashChanged) {
    return { analyze: true, priority: 'medium' };
  }

  // Skip content-only changes (likely boilerplate)
  if (comparison.contentHashChanged) {
    return { analyze: false, priority: 'low', reason: 'content-only' };
  }

  return { analyze: false, reason: 'no-change' };
}
```

### 4.3 Section Slicer Fallback

If the criteria extractor fails (badly formatted document), the section slicer provides a fallback by extracting text under coverage-related headings:

```javascript
const CRITERIA_HEADINGS = [
  /coverage\s*(criteria|policy|position)/i,
  /medical\s*necessity/i,
  /policy\s*(statement|position)/i,
  /limitations?\s*(and\s*exclusions?)?/i,
  /when\s*(is\s*)?(it\s*)?covered/i,
];
```

---

## 5. Extraction Pipeline

### 5.1 Extractors

Five specialized extractors run deterministically (no LLM calls):

#### `dates.js` - Date Extraction
- Extracts effective, revision, review dates
- Handles 15+ date format patterns
- Normalizes to ISO 8601
- Returns date precision (day/month/quarter/year)

#### `codes.js` - Billing Code Extraction
- Extracts CPT, PLA, HCPCS, ICD-10 codes
- Pre-mapped MRD test PLA codes (Signatera=0239U, etc.)
- Detects code tables in documents

#### `tests.js` - Test Name Extraction
- Identifies mentioned MRD/ctDNA tests
- Context-aware scoring (downweights bibliography mentions)
- 13+ tests with aliases mapped

#### `criteria.js` - Coverage Criteria Extraction
- Detects policy stance: `supports`, `restricts`, `denies`, `unclear`
- Extracts inclusion/exclusion criteria
- Identifies cancer type restrictions

#### `delegation.js` - Delegation Detection
- Detects Lab Benefit Manager delegations
- Recognizes Carelon, eviCore references
- Creates delegation change proposals

### 5.2 Extraction Flow

```
Raw Content
     │
     ▼
┌────────────────────────────────────────────────┐
│  extractStructuredData(content, options)       │
│                                                │
│  ├── extractAllDates()      → effectiveDate   │
│  ├── extractAllCodes()      → CPT/PLA codes   │
│  ├── extractNamedTests()    → test mentions   │
│  ├── extractAllCriteria()   → stance, criteria│
│  └── computeRelevanceScore()→ 0-1 score       │
│                                                │
│  Returns: comprehensive extraction result      │
└────────────────────────────────────────────────┘
     │
     ▼
Multi-hash computation uses extracted data
```

---

## 6. Delegation Tracking

### 6.1 What is Delegation?

Many payers delegate genetic/molecular testing management to Lab Benefit Managers (LBMs):

| LBM | Parent Company | Payers Using |
|-----|----------------|--------------|
| **Carelon** | Elevance/Anthem | Anthem, Wellmark, some BCBS plans |
| **eviCore** | Cigna | Cigna, some regional payers |

When delegated:
- Payer's policy becomes advisory only
- LBM's guidelines are operationally authoritative
- Prior auth routes through LBM

### 6.2 Delegation Map

```javascript
// src/data/delegation-map.js
export const PAYER_DELEGATIONS = {
  anthem: {
    delegatesTo: 'carelon',
    program: 'Carelon Insights',
    scope: 'oncology_molecular',
    evidence: 'suspected',      // suspected | confirmed
    effectiveness: 'effective', // pending | effective | expired
    lineOfBusiness: ['commercial', 'medicare_advantage'],
  },
};
```

### 6.3 Evidence-Gated Status

Delegations have evidence levels (v2.1):

| Status | Meaning | Action |
|--------|---------|--------|
| `suspected` | In static map, no recent document evidence | Monitor, lower confidence |
| `confirmed` | Document evidence detected or manually verified | High confidence |

Delegations without evidence within 90 days become `suspected`.

### 6.4 Delegation Detection

The crawler detects delegation announcements in policy documents:

```javascript
// Patterns that trigger delegation detection
const DELEGATION_PATTERNS = [
  /(?:retired|replaced|superseded).*(?:carelon|evicore)/i,
  /delegated?\s+to\s+(?:carelon|evicore|aim)/i,
  /(?:carelon|evicore)\s+(?:will|now)\s+(?:manage|provide)/i,
];
```

When detected, creates a `delegation_change` proposal for human review.

---

## 7. Coverage Assertions

### 7.1 Assertion Schema

Each coverage finding creates a CoverageAssertion:

```javascript
{
  type: 'coverage_assertion',
  testId: 'signatera',
  payerId: 'aetna',
  payerName: 'Aetna',
  layer: 'policy_stance',       // Layer type (see 7.2)
  assertionStatus: 'restricts', // supports | restricts | denies | unclear
  conditions: ['Stage II-III CRC', 'post-surgical surveillance'],
  confidence: 0.85,
  sourceUrl: 'https://...',
  sourceCitation: 'Page 12, Medical Necessity section',
  artifactId: 'aetna_cpb-0352_2026-02-01_abc123',
  effectiveDate: '2026-01-01',
}
```

### 7.2 Coverage Layers

| Layer | Weight | Description |
|-------|--------|-------------|
| `um_criteria` | 100 | UM criteria documents (most specific) |
| `lbm_guideline` | 90 | LBM guidelines (Carelon, eviCore) |
| `policy_stance` | 70 | General policy statements |
| `overlay` | 50 | State/regional overlays |

### 7.3 Reconciliation

When multiple assertions exist for the same test+payer, the reconciliation engine resolves conflicts:

```javascript
const result = reconcileCoverage(assertions, { payerId, testId });
// Returns: {
//   finalStatus: 'restricts',
//   confidence: 0.87,
//   winningLayer: 'um_criteria',
//   hasConflict: false,
// }
```

---

## 8. Operations

### 8.1 Schedule

| Job | Schedule | Description |
|-----|----------|-------------|
| Payer Crawler | Sunday 11:30 PM | Crawl all policies in registry |
| Cleanup | Daily midnight | Remove stale discoveries >30 days |

### 8.2 Commands

```bash
# Run payer crawler manually
node scripts/run-crawler.js payers

# Test single policy fetch
node scripts/test-policy-fetch.js aetna-cpb-0352

# Collect baseline for all payers
node scripts/collect-payer-baseline.js

# Review pending proposals
npm run proposals

# Apply approved proposals
npm run proposals:apply
```

### 8.3 Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...     # Claude AI analysis
RESEND_API_KEY=re_...            # Email notifications

# Optional
CRAWLER_PAYERS_ENABLED=true      # Enable/disable payer crawler
RATE_LIMIT_PAYERS=3              # Seconds between requests
LOG_LEVEL=info
```

---

## 9. Data Files

### 9.1 Runtime Data

| File | Purpose |
|------|---------|
| `data/payer-hashes.db` | SQLite database with hashes, assertions |
| `data/payer-hashes.json` | JSON fallback for hash storage |
| `data/discoveries.json` | Pending discoveries for review |
| `data/health.json` | Crawler health status |
| `data/artifacts/{payerId}/` | Raw document snapshots |

### 9.2 Proposal Storage

| Directory | Content |
|-----------|---------|
| `data/proposals/coverage/` | Coverage assertion proposals |
| `data/proposals/updates/` | Test record update proposals |
| `data/proposals/new-tests/` | New test discovery proposals |

### 9.3 Logs

```
logs/
├── daemon-2026-02-02.log      # Daily rotating logs
├── daemon-2026-02-01.log
└── ...
```

---

## 10. Troubleshooting

### 10.1 Common Issues

**Policy URL returns 403/blocked:**
- Many payers have bot protection
- Try with Playwright browser (loads JavaScript)
- Check if PDF vs HTML requires different handling
- Some URLs work only during business hours

**Hash computation fails:**
- PDF parsing may fail on scanned documents
- HTML may require JavaScript rendering
- Check `contentType` in policy registry

**Claude analysis timeout:**
- Long documents may exceed context limits
- Extraction pipeline now provides context to reduce token usage

**Delegation not detected:**
- Static map may be outdated
- Check `delegation.js` patterns
- Submit manual update to delegation-map.js

### 10.2 Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug node scripts/run-crawler.js payers

# Test extraction pipeline
node -e "
  import { extractStructuredData } from './src/extractors/index.js';
  const text = 'Signatera is covered for Stage III CRC...';
  console.log(await extractStructuredData(text));
"

# Check hash store
sqlite3 data/payer-hashes.db "SELECT * FROM policy_hashes LIMIT 5;"
```

### 10.3 Adding New Payers

1. Research payer's policy portal
2. Find ctDNA/liquid biopsy/molecular oncology policies
3. Verify URLs are accessible (check for bot protection)
4. Add to `POLICY_REGISTRY` with correct `docType`
5. Check if payer delegates to an LBM
6. Add delegation entry if applicable
7. Test with `node scripts/test-policy-fetch.js <policy-id>`
8. Run baseline collection for initial hashes

---

## Document Control

| Version | Date | Changes |
|---------|------|---------|
| 2.1.1 | 2026-02-02 | Initial documentation |

---

*End of Document*
