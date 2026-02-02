# Daemon Refactor Plan

**Note:** The daemon was split in the 2026 reorg. This plan now applies to the `test-data-tracker/` service (coverage/vendor monitoring). MRD clinical guidance now lives in `physician-system/`.

## Overview

This plan covers two initiatives:
1. **Refactoring** — Consolidate overlapping crawler code and standardize infrastructure
2. **Expansion** — Extend VendorCrawler to automatically maintain test records

### Decisions

| Question | Decision |
|----------|----------|
| Approval workflow | Weekly email with proposals → Web UI or load to Claude for review |
| Notifications | Email |
| Auto-approve | No auto-approve initially; all proposals require human review |
| Rollback | Git-based (proposals create commits that can be reverted) |

---

## Part 1: Refactoring

### 1.1 Extract PlaywrightCrawler Base Class

**Goal:** Eliminate duplicated Playwright + hash + diff + Claude logic between VendorCrawler and PayerCrawler.

**New class hierarchy:**
```
BaseCrawler (HTTP-based crawling, shared interface)
    └── PlaywrightCrawler (browser rendering, hash detection, AI analysis)
            ├── VendorCrawler (vendor news, PAP, product pages)
            └── PayerCrawler (insurer policy portals)
```

**PlaywrightCrawler provides:**
- `launchBrowser()` / `closeBrowser()` — lifecycle management with retry logic
- `fetchPage(url, options)` — renders page, returns content + screenshot
- `detectChange(url, content)` — canonicalize, hash, compare to stored
- `computeDiff(oldContent, newContent)` — text diff with truncation
- `analyzeWithClaude(prompt, context)` — shared Claude API wrapper
- `recordUrlHealth(url, success)` — track URL reliability

**Files:**
- Create `test-data-tracker/src/crawlers/playwright-base.js`
- Refactor `vendor.js` and `payers.js` to extend it

---

### 1.2 Standardize Hash Storage on SQLite

**Goal:** Single storage backend with URL health tracking.

**Changes:**
- Migrate VendorCrawler from `vendor-hashes.json` to SQLite via `hash-store.js`
- Add vendor-specific table or use same table with `source` column
- Remove JSON file logic from VendorCrawler

**Schema update to hash-store.js:**
```sql
CREATE TABLE IF NOT EXISTS content_hashes (
    url TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    content TEXT,
    source TEXT NOT NULL,  -- 'vendor' | 'payer'
    last_checked TEXT,
    last_changed TEXT,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    last_error TEXT
);
```

---

### 1.3 Consolidate Vendor Coverage Monitoring

**Goal:** All vendor website crawling lives in VendorCrawler.

**Changes:**
- Move `VENDOR_COVERAGE_SOURCES` from `payers.js` to `vendor.js`
- Merge with existing `VENDOR_PAP_SOURCES` (they're largely the same)
- PayerCrawler focuses exclusively on payer portals

---

### 1.4 Fix Broken Payer URLs

**Goal:** Update stale/broken URLs identified in audit.

| Payer | Current (broken) | Corrected |
|-------|------------------|-----------|
| UHC | `uhc.com/resources/policies` | `uhcprovider.com/en/policies-protocols.html` |
| Anthem | `/provider/policies` | `/{state}/provider/individual-commercial/policies` |
| Florida Blue | `/providers/medical-policies` | `/providers/medical-pharmacy-info` |

**Additional work:**
- Anthem needs per-state URL generation (CA, IN, GA, etc.)
- Add URL validation on test-data-tracker startup (warn on 404s)

---

## Part 2: Regex vs AI Hybrid Approach

### Philosophy

Use **regex for fast filtering**, **AI for understanding**. This mirrors the payer crawler's current approach.

### Three-Stage Pipeline

```
Stage 1: Regex Filter (fast, cheap)
    ↓ pages with keyword matches
Stage 2: Change Detection (hash comparison)
    ↓ pages that actually changed
Stage 3: AI Analysis (Claude, expensive)
    ↓ structured proposals
```

### Stage 1: Regex Patterns

**Coverage keywords** (case-insensitive):
```javascript
const COVERAGE_PATTERNS = [
  /cover(age|ed|s)/i,
  /reimburse?ment/i,
  /prior\s*auth/i,
  /medical\s*policy/i,
  /LCD|NCD|MolDX/i,
  /medicare|medicaid|CMS/i,
  /in-network|out-of-network/i,
  // Payer names
  /UnitedHealth|Aetna|Cigna|Anthem|BCBS|Humana/i,
];
```

**Performance keywords:**
```javascript
const PERFORMANCE_PATTERNS = [
  /sensitiv(ity|e)/i,
  /specific(ity|)/i,
  /PPV|NPV/i,
  /accuracy/i,
  /turnaround|TAT/i,
  /clinical\s*(validation|trial|study)/i,
  /FDA\s*(approv|clear|grant)/i,
];
```

**New test keywords:**
```javascript
const NEW_TEST_PATTERNS = [
  /launch(es|ed|ing)?/i,
  /announc(e|es|ed|ing)/i,
  /introduc(e|es|ed|ing)/i,
  /now\s*available/i,
  /new\s*(test|assay|product)/i,
  /FDA\s*(approv|clear)/i,
];
```

### Stage 2: Change Detection

Only send to Claude if:
1. Page content hash differs from stored hash
2. Diff size > threshold (e.g., > 100 chars changed)
3. Diff contains relevant keywords (from Stage 1 patterns)

### Stage 3: AI Analysis

Claude receives:
- The diff (truncated to ~10KB)
- Context about what we're looking for
- Structured output format

**Benefits of hybrid:**
- Cost: ~90% of pages filtered before Claude
- Speed: Regex runs in <1ms vs Claude ~2-5s
- Reliability: Regex never hallucinates

---

## Part 3: Vendor URL Inventory

Each vendor needs multiple page types monitored. URLs verified January 2026.

### Natera

| Page Type | URL | Purpose |
|-----------|-----|---------|
| News | `/company/news/` | Coverage announcements, new products |
| Billing | `/oncology/billing/` | Patient pricing, PAP info |
| Signatera Main | `/oncology/signatera-advanced-cancer-detection/` | Product overview |
| Signatera Clinicians | `/oncology/signatera-advanced-cancer-detection/clinicians/` | Clinical details, ordering |
| Signatera Research | `/oncology/signatera-advanced-cancer-detection/research-pipeline/` | Ongoing trials |
| Signatera Publications | `/resource-library/natera-publications/signatera-publications/` | Peer-reviewed papers |
| Latitude (tfMRD) | `/oncology/latitude-tissue-free-mrd/` | New tissue-free MRD test |
| Altera | `/oncology/signatera-advanced-cancer-detection/clinicians/altera/` | CGP test |
| Empower | `/oncology/empower-hereditary-cancer-test/` | HCT test |
| Sponsored Trials | `/info/onctrials/` | Clinical trial listings |

**Tests:** Signatera, Latitude, Altera, Empower

---

### Guardant Health

| Page Type | URL | Purpose |
|-----------|-----|---------|
| Press Releases | `/newsroom/press-releases/` | Coverage, FDA approvals |
| For Patients | `/precision-oncology/for-patients/` | Billing, coverage info |
| For Providers | `/precision-oncology/for-healthcare-providers/` | Ordering, clinical info |
| Clinical Studies | `/clinical-studies/` | Ongoing research |
| Key Publications | `/clinical-studies/key-publications/` | Peer-reviewed papers |
| Guardant360/Reveal | `/products/tests-for-patients-with-early-and-advanced-stage-cancer/` | CGP + MRD products |
| Shield (ECD) | `/products/tests-for-cancer-screening/` | CRC screening |
| Guardant Infinity | `/guardant-infinity/` | Platform technology |
| **Separate sites:** | | |
| Shield site | `shieldcancerscreen.com` | Dedicated Shield info |
| Guardant Complete | `guardantcomplete.com` | Patient portal |

**Tests:** Guardant360 CDx, Guardant360 TissueNext, Guardant Reveal, Shield

---

### Foundation Medicine

| Page Type | URL | Purpose |
|-----------|-----|---------|
| Press Releases | `/press-releases` | Coverage, approvals |
| Blog | `/blog` | Clinical insights |
| Products Overview | `/info/about-our-products-and-services` | Product lineup |
| FoundationOne CDx | `/test/foundationone-cdx` | Tissue CGP |
| FoundationOne Liquid CDx | `/test/foundationone-liquid-cdx` | Liquid CGP |
| For Patients | `/patient` | Billing, PAP |
| For Providers | `/info/provider-overview` | Ordering info |
| Provider FAQs | `/faq/provider-faqs` | Coverage Q&A |
| Resource Center | `/resources` | Clinical resources |
| Knowledge Center | `/resources/knowledge-center` | Educational content |

**Tests:** FoundationOne CDx, FoundationOne Liquid CDx, FoundationOne Heme

---

### GRAIL (Galleri)

| Page Type | URL | Purpose |
|-----------|-----|---------|
| Press Releases | `grail.com/press-releases` | Coverage, studies |
| **Separate site:** | | |
| Galleri main | `galleri.com` | Patient-facing |
| Coverage/Cost | `galleri.com/patient/coverage-cost` | Billing info |
| For Providers | `galleri.com/hcp` | Clinical info |
| Clinical Evidence | `galleri.com/hcp/clinical-evidence` | Publications |

**Tests:** Galleri

---

### Exact Sciences

| Page Type | URL | Purpose |
|-----------|-----|---------|
| Newsroom | `/newsroom` | Coverage, approvals |
| Patient Assistance | `/patients/patient-assistance` | PAP info |
| **Product sites:** | | |
| Oncotype DX | `oncotypeiq.com` | Breast/prostate tests |
| Cologuard | `cologuard.com` | CRC screening |
| OncoExTra | `oncoextra.com` | CGP test |

**Tests:** Oncotype DX Breast, Oncotype DX Prostate, Cologuard, OncoExTra

---

### Tempus

| Page Type | URL | Purpose |
|-----------|-----|---------|
| News | `/news` | Coverage, partnerships |
| Patients Billing | `/patients/billing/` | Cost, PAP |
| Products | `/genomic-profiling/` | Test portfolio |
| xT CDx | `/genomic-profiling/xt/` | Tissue CGP |
| xF | `/genomic-profiling/xf/` | Liquid biopsy |
| xM MRD | `/oncology/mrd/` | MRD test |

**Tests:** Tempus xT CDx, Tempus xF, Tempus xR, Tempus xM MRD

---

### Myriad Genetics

| Page Type | URL | Purpose |
|-----------|-----|---------|
| News | `investor.myriad.com/news` | Coverage, approvals |
| Patient Financial | `/patients/patient-financial-assistance/` | PAP info |
| myRisk | `/genetic-tests/myrisk-hereditary-cancer/` | HCT panel |
| MyChoice CDx | `/genetic-tests/mychoice-cdx/` | HRD test |
| BRACAnalysis CDx | `/genetic-tests/bracanalysis-cdx/` | BRCA test |
| Precise MRD | `/genetic-tests/precise-mrd/` | MRD test |

**Tests:** myRisk, MyChoice CDx, BRACAnalysis CDx, Precise MRD

---

### Other Key Vendors (Abbreviated)

| Vendor | News URL | Key Products |
|--------|----------|--------------|
| **Caris** | `/news-and-events/news` | MI Profile, Assure |
| **NeoGenomics** | `/about-neogenomics/news/` | RaDaR |
| **Adaptive** | `/about-adaptive/news/` | clonoSEQ |
| **Invitae** | `/about-us/press/` | Invitae PCM |
| **Labcorp** | `/newsroom` | IntelliGEN, OmniSeq |
| **Quest** | `/newsroom` | QHerit, myChoice |

---

## Part 4: Expansion — Vendor Crawler Intelligence

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        VendorCrawler                            │
├─────────────────────────────────────────────────────────────────┤
│  News Pages ──────► Coverage Announcements ──► Update coverage  │
│  Product Pages ───► Performance/Specs ──────► Update test data  │
│  Clinical Pages ──► Trial Updates ──────────► Update trials     │
│  New Products ────► Test Detection ─────────► Submission queue  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Proposal Queue │ (human review)
                    └────────┬────────┘
                             │ approve
                             ▼
                    ┌─────────────────┐
                    │    data.js      │
                    └─────────────────┘
```

---

### 4.2 Feature A: Coverage Information Updates

**What it does:**
- Detects coverage announcements from vendor news/billing pages
- Parses payer + coverage status (covered, prior auth, not covered)
- Proposes updates to test's `coverage` field in data.js

**Implementation:**

1. **Detection** — Regex filter for coverage keywords, then hash-based change detection

2. **Extraction** — Claude prompt to extract structured data:
   ```javascript
   {
     test: "Signatera",
     payer: "UnitedHealthcare",
     status: "covered",
     conditions: "Stage II-III CRC, post-surgery",
     effectiveDate: "2024-01-01",
     source: "https://...",
     confidence: 0.92
   }
   ```

3. **Proposal creation** — Write to `test-data-tracker/data/proposals/coverage/`

4. **Review** — Weekly email with pending proposals; review via web UI or Claude conversation

5. **Application** — Approved proposals auto-update data.js, committed to git

---

### 4.3 Feature B: Test Record Updates (Performance & Trials)

**What it does:**
- Monitors vendor product pages for spec changes
- Monitors clinical trial registries for new/updated trials
- Proposes updates to test fields: `sensitivity`, `specificity`, `turnaroundTime`, `clinicalTrials`

**Extraction prompts:**

For **performance data**:
```
Extract test performance metrics from this page:
- Sensitivity (% and context, e.g., "99% for Stage II CRC")
- Specificity
- PPV/NPV
- Turnaround time
- Sample requirements
Return as structured JSON with source quotes.
```

For **clinical trials** (via clinicaltrials.gov API):
```
GET https://clinicaltrials.gov/api/v2/studies?query.term=Signatera&filter.overallStatus=RECRUITING
```

**Diff detection:**
- Compare extracted values to current data.js values
- Only propose changes when meaningfully different
- Track confidence scores

---

### 4.4 Feature C: New Test Detection & Submission

**What it does:**
- Detects when a monitored vendor announces a new test
- Auto-generates a draft submission following SUBMISSION_PROCESS.md
- Queues for human review before adding to database

**Detection signals (regex-first):**
- News headline contains "launch", "announce", "introduce", "new test"
- Product page appears that wasn't previously tracked
- FDA clearance announcements

**Workflow:**
1. Crawler detects new test announcement (regex match)
2. Claude extracts test details
3. Creates draft in `test-data-tracker/data/proposals/new-tests/`
4. Sends notification email
5. Human reviews via web UI or Claude conversation, fills gaps, approves
6. Test added to data.js with `vendorVerified: false`
7. Separate verification workflow to confirm with vendor

---

### 4.5 Proposal Queue System

**Central queue for all proposed changes:**

```
test-data-tracker/data/proposals/
├── coverage/
│   ├── cov-2024-001.json
│   └── cov-2024-002.json
├── updates/
│   ├── upd-2024-001.json  (performance update)
│   └── upd-2024-002.json  (trial update)
└── new-tests/
    └── new-2024-001.json
```

**Proposal states:**
- `pending` — awaiting review
- `approved` — ready to apply
- `applied` — changes committed to data.js
- `rejected` — discarded with reason

**Review options:**
1. **Email + Claude**: Weekly email with JSON attachment, load into Claude for interactive approval
2. **Web UI**: Simple approval interface at `/admin/proposals`

**CLI commands:**
```bash
npm run proposals:list           # Show pending proposals
npm run proposals:review <id>    # Interactive review
npm run proposals:approve <id>   # Approve proposal
npm run proposals:apply          # Apply all approved to data.js
npm run proposals:reject <id>    # Reject with reason
```

---

## Part 5: Implementation Phases

### Phase 1: Refactoring (Week 1)
- [ ] Create PlaywrightCrawler base class
- [ ] Migrate VendorCrawler to extend PlaywrightCrawler
- [ ] Migrate PayerCrawler to extend PlaywrightCrawler
- [ ] Standardize on SQLite hash storage
- [ ] Consolidate vendor sources in VendorCrawler
- [ ] Fix broken payer URLs

### Phase 2: Vendor URL Inventory (Week 1-2)
- [ ] Verify all URLs in inventory above
- [ ] Add page type classification to vendor sources
- [ ] Implement per-page-type crawl scheduling
- [ ] Add regex pre-filters for each page type

### Phase 3: Proposal Infrastructure (Week 2)
- [ ] Design proposal JSON schema
- [ ] Create proposal queue directory structure
- [ ] Build CLI for listing/reviewing proposals
- [ ] Build proposal application logic (AST-based data.js updates)
- [ ] Add proposal creation to discovery pipeline
- [ ] Set up weekly email digest

### Phase 4: Coverage Updates (Week 3)
- [ ] Add coverage extraction prompt
- [ ] Map vendor announcements to payer names
- [ ] Generate coverage proposals
- [ ] Test with historical announcements
- [ ] Add to production crawl

### Phase 5: Performance & Trial Updates (Week 4)
- [ ] Add product page URLs to vendor sources
- [ ] Add performance extraction prompt
- [ ] Integrate clinicaltrials.gov API
- [ ] Generate update proposals
- [ ] Diff against current data.js values

### Phase 6: New Test Detection (Week 5)
- [ ] Add new test detection signals (regex patterns)
- [ ] Build draft submission generator
- [ ] Map to SUBMISSION_PROCESS.md workflow
- [ ] Email notification on new test detection
- [ ] End-to-end test with mock announcement

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Manual coverage updates/month | ~10 | < 2 |
| Time to add new test | 2-3 days | < 4 hours |
| Stale test data (>6mo old) | ~30% | < 10% |
| Payer URL success rate | ~70% | > 95% |
| Claude API cost/month | — | < $50 |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI extraction errors | Confidence thresholds + human review (no auto-approve) |
| Vendor site structure changes | Hash detection catches changes; alert on failures |
| Over-automation trust issues | All changes go through proposal queue |
| Rate limiting/blocking | Conservative delays, rotate user agents |
| High Claude costs | Regex pre-filtering reduces AI calls by ~90% |

---

## Appendix: Unified Vendor Source Schema

```javascript
const VENDOR_SOURCES = [
  {
    id: 'natera',
    name: 'Natera',
    tests: ['Signatera', 'Latitude', 'Altera', 'Empower'],
    pages: [
      { type: 'news', url: 'https://www.natera.com/company/news/', priority: 1 },
      { type: 'billing', url: 'https://www.natera.com/oncology/billing/', priority: 1 },
      { type: 'product', url: 'https://www.natera.com/oncology/signatera-advanced-cancer-detection/', test: 'Signatera', priority: 2 },
      { type: 'clinical', url: 'https://www.natera.com/oncology/signatera-advanced-cancer-detection/clinicians/', test: 'Signatera', priority: 2 },
      { type: 'research', url: 'https://www.natera.com/oncology/signatera-advanced-cancer-detection/research-pipeline/', test: 'Signatera', priority: 3 },
      { type: 'publications', url: 'https://www.natera.com/resource-library/natera-publications/signatera-publications/', test: 'Signatera', priority: 3 },
      { type: 'product', url: 'https://www.natera.com/oncology/latitude-tissue-free-mrd/', test: 'Latitude', priority: 2 },
      { type: 'trials', url: 'https://www.natera.com/info/onctrials/', priority: 3 },
    ],
    regexFilters: {
      coverage: /cover|reimburse|medicare|medicaid|prior\s*auth/i,
      performance: /sensitiv|specific|PPV|NPV|accuracy/i,
      newTest: /launch|announc|introduc|now\s*available/i,
    },
  },
  // ... other vendors follow same schema
];
```

**Page type priorities:**
- Priority 1: Crawl daily (news, billing)
- Priority 2: Crawl weekly (product pages)
- Priority 3: Crawl monthly (research, publications)
