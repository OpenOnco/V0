# Crawler Documentation

This document provides detailed documentation for each crawler in the OpenOnco Intelligence Daemon.

## Overview

The daemon runs five specialized crawlers, each targeting different data sources:

| Crawler | Schedule | Source | Focus |
|---------|----------|--------|-------|
| PubMed | Daily 6:00 AM | Scientific literature | Validation studies, clinical utility |
| CMS | Weekly Sunday 6:00 AM | Medicare coverage | LCDs, NCDs, coverage changes |
| FDA | Weekly Monday 6:00 AM | Regulatory | 510(k), PMA approvals |
| Vendor | Weekly Tuesday 6:00 AM | Manufacturer sites | Product updates, news |
| Preprints | Weekly Wednesday 6:00 AM | medRxiv/bioRxiv | Pre-publication research |

---

## Monitored Tests

All crawlers use the following lists of monitored diagnostic tests from `src/config.js`:

### MRD (Minimal Residual Disease) Tests
| Test Name |
|-----------|
| Signatera |
| Guardant Reveal |
| FoundationOne Tracker |
| Haystack MRD |
| NeXT Personal Dx |
| Oncomine |
| clonoSEQ |
| NavDx |
| RaDaR |
| PhasED-Seq |
| AVENIO ctDNA |
| Tempus MRD |
| Resolution HRD |
| PredicineATLAS |
| Invitae Personalized Cancer Monitoring |

### TDS (Tumor Detection/Screening) Tests
| Test Name |
|-----------|
| FoundationOne CDx |
| FoundationOne Liquid CDx |
| Guardant360 CDx |
| Guardant360 TissueNext |
| Tempus xT |
| Tempus xF |
| Tempus xR |
| Caris Molecular Intelligence |
| Oncotype DX |
| MammaPrint |
| Prosigna |
| Decipher Prostate |
| SelectMDx |
| ExoDx Prostate |
| Epi proColon |
| Cologuard |
| Galleri |

### ECD (Early Cancer Detection) Tests
| Test Name |
|-----------|
| Galleri |
| CancerSEEK |
| Shield |
| GRAIL Galleri |
| Freenome |
| DELFI |
| Helio Liver Test |
| IvyGene |
| Oncuria |
| ColoSense |

---

## Monitored Vendors

The following vendors are monitored across all crawlers:

| Category | Vendors |
|----------|---------|
| Major ctDNA/MRD | Natera, Guardant Health, Foundation Medicine, Tempus, Caris Life Sciences, NeoGenomics, Personalis |
| Large Reference Labs | Quest Diagnostics, Labcorp, Exact Sciences |
| Specialized | Adaptive Biotechnologies, GRAIL, Freenome, Burning Rock Dx, Resolution Bioscience, Invitae, Myriad Genetics, Genomic Health, Agilent, Illumina |
| Emerging | Veracyte, BillionToOne, DELFI Diagnostics, Helio Genomics, Lucence, Nucleix, Inocras, IMBdx, OncoDNA, Geneoscopy |

---

## PubMed Crawler

**Source file:** `src/crawlers/pubmed.js`

### Purpose
Searches for relevant oncology and ctDNA publications from the last 7 days using the NCBI E-utilities API.

### API Configuration

| Setting | Value |
|---------|-------|
| Base URL | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils` |
| Search Endpoint | `/esearch.fcgi` |
| Summary Endpoint | `/esummary.fcgi` |
| Database | `pubmed` |
| Results per query | 20 |
| Date type | Publication date (`pdat`) |
| Relative date | Last 7 days |
| Sort | Relevance |

### Rate Limit
10 requests/minute (default), configurable via `RATE_LIMIT_PUBMED`

### Search Strategy

The crawler runs two types of searches:

#### 1. Test Name Searches
Searches for the first 10 monitored test names (from `ALL_TEST_NAMES`):
```
"Signatera"
"Guardant Reveal"
"FoundationOne Tracker"
"Haystack MRD"
"NeXT Personal Dx"
"Oncomine"
"clonoSEQ"
"NavDx"
"RaDaR"
"PhasED-Seq"
```

#### 2. Topic-Based Searches (TOPIC_QUERIES)
```
(ctDNA OR "circulating tumor DNA") AND "minimal residual disease"
"liquid biopsy" AND (MRD OR "molecular residual disease")
ctDNA AND colorectal AND (recurrence OR surveillance)
"clinical utility" AND (ctDNA OR "liquid biopsy")
"validation study" AND ctDNA AND cancer
(Medicare OR "coverage determination") AND (ctDNA OR "liquid biopsy")
```

### Relevance Scoring

**HIGH relevance keywords:**
- signatera, guardant reveal, guardant360, foundationone
- validation study, clinical utility, clinical validation, comparative study
- medicare, coverage
- mrd, minimal residual disease, molecular residual disease
- surveillance, recurrence detection

**HIGH relevance article types:**
- Clinical trial
- Review
- Meta-analysis

**MEDIUM relevance keywords:**
- ctdna, circulating tumor dna, liquid biopsy
- colorectal, colon cancer, breast cancer, lung cancer
- oncology, biomarker

### Discovery Output

```javascript
{
  source: 'pubmed',
  type: 'publication',
  title: "Article title from PubMed",
  summary: "Author et al. - Journal Name (2024 Jan 15)",
  url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
  relevance: 'high' | 'medium' | 'low',
  metadata: {
    pmid: "12345678",
    authors: "Smith J, Jones A, et al.",
    journal: "Journal of Clinical Oncology",
    publicationDate: "2024 Jan 15",
    articleType: ["Journal Article", "Clinical Trial"],
    doi: "10.1000/example.doi"
  }
}
```

---

## CMS/Medicare Crawler

**Source file:** `src/crawlers/cms.js`

### Purpose
Monitors Local Coverage Determinations (LCDs) and National Coverage Determinations (NCDs) for molecular diagnostics updates.

### API Configuration

| Setting | Value |
|---------|-------|
| Base URL | `https://api.coverage.cms.gov` |
| LCD Endpoint | `/service/lcd` |
| NCD Endpoint | `/service/ncd` |
| What's New Endpoint | `/service/whats-new-report` |

### Rate Limit
5 requests/minute (default), configurable via `RATE_LIMIT_CMS`

### Search Strategy

#### 1. What's New Report
Fetches recent LCD/Article changes from the CMS "What's New" report.

#### 2. Keyword Searches (SEARCH_KEYWORDS)
Searches both LCDs and NCDs for each keyword:
| Keyword |
|---------|
| molecular |
| liquid biopsy |
| ctDNA |
| MRD |
| tumor marker |
| genomic |

### Oncology Relevance Filter (ONCOLOGY_KEYWORDS)

Items are filtered by these keywords in the title:
| Keyword |
|---------|
| moldx |
| molecular |
| tumor |
| cancer |
| oncology |
| biopsy |
| genomic |

### Relevance Scoring

**HIGH relevance:**
- moldx, signatera, guardant, foundationone
- minimal residual disease, mrd

**MEDIUM relevance:**
- ctdna, liquid biopsy, circulating tumor
- genomic, molecular diagnostic

### Deduplication
Documents are tracked by `documentId:version` to avoid duplicates across searches.

### Discovery Output

```javascript
{
  source: 'cms',
  type: 'coverage_change',
  title: "MolDX: Minimal Residual Disease Testing",
  summary: "LCD update | Contractor: Palmetto GBA | Effective: 2024-01-01",
  url: "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=L38043",
  relevance: 'high' | 'medium' | 'low',
  metadata: {
    documentId: "L38043",
    documentType: "LCD",
    contractor: "Palmetto GBA",
    effectiveDate: "2024-01-01",
    version: 5
  }
}
```

### URL Patterns

| Document Type | URL Pattern |
|---------------|-------------|
| LCD | `https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid={id}` |
| NCD | `https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid={id}` |
| Article | `https://www.cms.gov/medicare-coverage-database/view/article.aspx?articleid={id}` |

---

## FDA Crawler

**Source file:** `src/crawlers/fda.js`

### Purpose
Monitors device clearances and drug approvals for monitored manufacturers using the openFDA API.

### API Configuration

| Setting | Value |
|---------|-------|
| Base URL | `https://api.fda.gov` |
| 510(k) Endpoint | `/device/510k.json` |
| PMA Endpoint | `/device/pma.json` |
| Date Range | Last 90 days |
| Results per query | 100 |

### Rate Limit
5 requests/minute (default), configurable via `RATE_LIMIT_FDA`

### Monitored Manufacturers (MONITORED_MANUFACTURERS)

The crawler queries both 510(k) and PMA databases for these manufacturers:

| # | Manufacturer |
|---|--------------|
| 1 | Natera |
| 2 | Guardant Health |
| 3 | Foundation Medicine |
| 4 | Tempus |
| 5 | Caris Life Sciences |
| 6 | Exact Sciences |
| 7 | GRAIL |
| 8 | Freenome |
| 9 | Adaptive Biotechnologies |
| 10 | Personalis |

### Search Parameters

- **Query format:** `applicant:"{manufacturer}" AND decision_date:[{from} TO {to}]`
- **Date format:** `YYYYMMDD`

### Relevant Product Codes (RELEVANT_PRODUCT_CODES)

These FDA product codes are relevant to liquid biopsy/molecular diagnostics:

| Code | Description |
|------|-------------|
| MYZ | Nucleic acid amplification test |
| PHI | Genetic test for disease |
| PIE | Tumor markers |
| PSZ | Next generation sequencing |
| QJY | Companion diagnostic |

### Search Keywords (SEARCH_KEYWORDS)

| Keyword |
|---------|
| liquid biopsy |
| circulating tumor DNA |
| ctDNA |
| minimal residual disease |
| molecular residual disease |
| next generation sequencing |
| companion diagnostic |
| pan-tumor |

### Relevance Scoring

**HIGH relevance:**
- Manufacturer names: natera, guardant, foundation medicine
- Test names: signatera, guardant360
- Terms: ctdna, liquid biopsy, mrd, minimal residual, companion diagnostic

**MEDIUM relevance:**
- oncology, cancer, tumor, neoplasm

### Discovery Output

#### 510(k) Clearance
```javascript
{
  source: 'fda',
  type: 'fda_approval',
  title: "FDA 510(k) Cleared: Signatera MRD Test",
  summary: "Natera Inc - 510(k) clearance",
  url: "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID=K240001",
  relevance: 'high' | 'medium' | 'low',
  metadata: {
    kNumber: "K240001",
    deviceName: "Signatera MRD Test",
    applicant: "Natera Inc",
    decisionDate: "2024-01-15",
    productCode: "PSZ",
    clearanceType: "510k"
  }
}
```

#### PMA Approval
```javascript
{
  source: 'fda',
  type: 'fda_approval',
  title: "FDA PMA Approved: FoundationOne CDx",
  summary: "Foundation Medicine - PMA approval",
  url: "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id=P170019",
  relevance: 'high' | 'medium' | 'low',
  metadata: {
    pmaNumber: "P170019",
    tradeName: "FoundationOne CDx",
    genericName: "Next generation sequencing oncology panel",
    applicant: "Foundation Medicine Inc",
    decisionDate: "2024-01-15",
    advisoryCommittee: "Clinical Chemistry",
    clearanceType: "pma"
  }
}
```

### Additional FDA Resources (Not Yet Implemented)

The following data sources are documented for future implementation:

| Source | URL | Purpose |
|--------|-----|---------|
| 510(k) Web Interface | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMN/pmn.cfm | Manual search |
| PMA Web Interface | https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfPMA/pma.cfm | Manual search |
| Breakthrough Devices | https://www.fda.gov/medical-devices/how-study-and-market-your-device/breakthrough-devices-program | Expedited pathway |
| Drug Approvals API | https://api.fda.gov/drug/drugsfda.json | Companion diagnostics |
| Guidance Documents | https://www.fda.gov/medical-devices/device-advice-comprehensive-regulatory-assistance/guidance-documents-medical-devices-and-radiation-emitting-products | Regulatory guidance |

---

## Vendor Crawler

**Source file:** `src/crawlers/vendor.js`

### Purpose
Monitors test manufacturer websites for product updates using Playwright for JavaScript-heavy pages.

### Technology

| Setting | Value |
|---------|-------|
| Browser | Playwright (headless Chromium) |
| Change detection | SHA256 content hashing |
| Hash storage | `data/vendor-hashes.json` |
| User Agent | `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36` |
| Rate limit delay | 3000ms between requests |

### Rate Limit
3 seconds between requests (fixed), configurable via `RATE_LIMIT_VENDOR`

### Monitored Vendor URLs (VENDOR_SOURCES)

#### Natera
| URL | Description | Type |
|-----|-------------|------|
| https://www.natera.com/oncology | Oncology landing page | product |
| https://www.natera.com/company/news | News and press releases | news |

#### Guardant Health
| URL | Description | Type |
|-----|-------------|------|
| https://guardanthealth.com/products/tests-for-cancer-screening | Shield Blood Test | product |
| https://guardanthealth.com/products/tests-for-patients-with-early-and-advanced-stage-cancer | Guardant Complete | product |
| https://guardanthealth.com/newsroom/press-releases | Press releases | news |

#### Foundation Medicine
| URL | Description | Type |
|-----|-------------|------|
| https://www.foundationmedicine.com/genomic-testing/foundation-one-cdx | FoundationOne CDx | product |
| https://www.foundationmedicine.com/test/foundationone-liquid-cdx | FoundationOne Liquid CDx | product |
| https://www.foundationmedicine.com/press-releases | Press releases | news |

#### Tempus
| URL | Description | Type |
|-----|-------------|------|
| https://www.tempus.com/oncology/genomic-profiling | Genomic profiling services | product |
| https://www.tempus.com/news | News | news |

#### Caris Life Sciences
| URL | Description | Type |
|-----|-------------|------|
| https://www.carislifesciences.com/products-and-services/molecular-profiling | Molecular profiling | product |
| https://www.carislifesciences.com/news-and-events/news | News | news |

#### GRAIL
| URL | Description | Type |
|-----|-------------|------|
| https://www.grail.com/galleri | Galleri test page | product |
| https://www.grail.com/press-releases | Press releases | news |

### Page Extraction

The crawler extracts:

| Data | Extraction Method |
|------|-------------------|
| Text content | Body text with scripts/styles removed |
| Headings | h1, h2, h3 elements |
| Versions | Regex: `(?:v\|version\s*)(\d+(?:\.\d+)*)` |
| Pricing | Dollar amounts (`$[\d,]+`), price/cost/fee mentions, coverage/reimbursement mentions |
| Features | "New/Introducing/Announcing/Launch", "Now available/offering", "FDA approved/cleared/CE marked" |

### Change Detection Flow

1. Fetch page via Playwright (30s timeout, `networkidle` wait)
2. Extract body text (scripts/styles removed)
3. Compute SHA256 hash of body text
4. Compare to stored hash in `data/vendor-hashes.json`
5. If different and not first crawl, create discovery
6. Update stored hash

### Relevance Scoring

**HIGH relevance keywords:**
- coverage, medicare, cms, fda
- approval, cleared
- clinical data, study results, trial results
- guideline, nccn
- indication, expanded

**MEDIUM relevance keywords:**
- update, launch, new
- partnership, collaboration
- pricing

### Discovery Output

```javascript
{
  source: 'vendor',
  type: 'vendor_update',
  title: "Natera: Product Page Updated - Oncology landing page",
  summary: "Changes detected on Natera Oncology landing page. Notable: Now FDA approved for...",
  url: "https://www.natera.com/oncology",
  relevance: 'high' | 'medium' | 'low',
  metadata: {
    vendorId: "natera",
    vendorName: "Natera",
    pageType: "product",
    pagePath: "/oncology",
    changeType: "product_update"
  }
}
```

### Change Types

| Type | Description |
|------|-------------|
| `product_update` | Changes to product pages |
| `press_release` | News and press release pages |
| `documentation_update` | Technical documentation changes |

---

## Preprints Crawler

**Source file:** `src/crawlers/preprints.js`

### Purpose
Searches medRxiv and bioRxiv for oncology diagnostic test-related preprints from the last 7 days.

### API Configuration

| Setting | Value |
|---------|-------|
| medRxiv URL | `https://api.biorxiv.org/details/medrxiv` |
| bioRxiv URL | `https://api.biorxiv.org/details/biorxiv` |
| Endpoint pattern | `/{baseUrl}/{interval}/{cursor}` |
| Interval format | `YYYY-MM-DD/YYYY-MM-DD` |
| Results per page | 100 |
| Max cursor | 1000 (safety limit) |

### Rate Limit
5 requests/minute (default), configurable via `RATE_LIMIT_PREPRINTS`

### Search Strategy

1. Query both servers with 7-day date range
2. Paginate through results (100 per page, max 1000)
3. Filter for oncology-related preprints
4. Score relevance based on keywords

### Oncology Filter Keywords

Preprints are included if title, abstract, or category contains:
- cancer, tumor, tumour, oncology, carcinoma
- neoplasm, malignant, metastasis, metastatic
- ctdna, liquid biopsy, circulating tumor
- cell-free dna, mrd, minimal residual
- biopsy, diagnostic, biomarker, methylation
- Any monitored test name from `ALL_TEST_NAMES`

### Relevance Scoring

#### HIGH Relevance Keywords (HIGH_RELEVANCE_KEYWORDS)

| Category | Keywords |
|----------|----------|
| Test names | signatera, guardant reveal, guardant360, foundationone, foundationone cdx, foundationone liquid, tempus xt, tempus xf, galleri, grail, clonoseq, clonoséq |
| MRD terms | minimal residual disease, molecular residual disease, mrd detection, mrd monitoring, mrd-guided |
| Clinical | clinical utility, clinical validation, validation study, surveillance ctdna, recurrence detection, recurrence monitoring |

#### MEDIUM Relevance Keywords (MEDIUM_RELEVANCE_KEYWORDS)

| Category | Keywords |
|----------|----------|
| ctDNA/liquid biopsy | ctdna, circulating tumor dna, cell-free dna, cfdna, liquid biopsy, cell-free tumor dna |
| Methylation | methylation cancer, methylation detection, methylation-based, cancer methylation |
| Cancer types | colorectal cancer, colon cancer, breast cancer, lung cancer, pancreatic cancer |
| Detection | early detection cancer, multi-cancer early detection, mced |
| Biomarkers | tumor biomarker, cancer biomarker, circulating biomarker |

### Search Collections (SEARCH_COLLECTIONS)

| Collection |
|------------|
| oncology |
| cancer biology |
| genetic and genomic medicine |

### Discovery Output

```javascript
{
  source: 'preprints',
  type: 'preprint',
  title: "Clinical validation of ctDNA-based MRD detection in colorectal cancer",
  summary: "Smith J, Jones A, et al. - medRxiv (2024-01-15)",
  url: "https://doi.org/10.1101/2024.01.15.12345678",
  relevance: 'high' | 'medium' | 'low',
  metadata: {
    doi: "10.1101/2024.01.15.12345678",
    authors: "Smith, J; Jones, A; Williams, B",
    authorFormatted: "Smith J et al.",
    server: "medRxiv",
    category: "Oncology",
    publishedDate: "2024-01-15",
    abstract: "Background: Circulating tumor DNA (ctDNA)...",
    version: "1",
    license: "CC-BY-NC-ND 4.0"
  }
}
```

---

## Base Crawler Class

**Source file:** `src/crawlers/base.js`

All crawlers extend `BaseCrawler` which provides:

### Common Properties
- `name` - Crawler display name
- `source` - Source identifier (pubmed, cms, fda, vendor, preprints)
- `description` - Human-readable description
- `rateLimit` - Requests per minute
- `enabled` - Whether crawler is active

### Common Methods

| Method | Purpose |
|--------|---------|
| `crawl()` | Main crawl implementation (override in subclass) |
| `log(level, message, meta)` | Structured logging |
| `createDiscovery(data)` | Create discovery object with standard fields |

### HTTP Client

Each crawler has an `http` property with rate-limited methods:
- `get(url, config)` - GET request
- `getJson(url, config)` - GET returning JSON
- `getText(url, config)` - GET returning text
- `post(url, data, config)` - POST request

---

## Crawler Registry

**Source file:** `src/crawlers/index.js`

### Available Functions

```javascript
import {
  runCrawler,           // Run a specific crawler
  getCrawlerStatuses,   // Get status of all crawlers
  getAllCrawlers        // Get crawler instances
} from './crawlers/index.js';

// Run a crawler
const result = await runCrawler('pubmed');
// Returns: { success: true, discoveries: [...], duration: 5432 }

// Get statuses
const statuses = getCrawlerStatuses();
// Returns: { pubmed: { enabled: true, name: 'PubMed' }, ... }
```

---

## Discovery Types and Sources

### Discovery Types (`DISCOVERY_TYPES`)

| Type | Value | Used By |
|------|-------|---------|
| PUBLICATION | `publication` | PubMed |
| PREPRINT | `preprint` | Preprints |
| POLICY_UPDATE | `policy_update` | CMS |
| COVERAGE_CHANGE | `coverage_change` | CMS |
| FDA_APPROVAL | `fda_approval` | FDA |
| FDA_GUIDANCE | `fda_guidance` | FDA |
| VENDOR_UPDATE | `vendor_update` | Vendor |
| TEST_DOCUMENTATION | `test_documentation` | Vendor |

### Sources (`SOURCES`)

| Source | Value |
|--------|-------|
| PUBMED | `pubmed` |
| CMS | `cms` |
| FDA | `fda` |
| VENDOR | `vendor` |
| PREPRINTS | `preprints` |

---

## Error Handling

All crawlers implement graceful error handling:

1. **Individual failures don't crash the daemon** - If one search query fails, continue with others
2. **Errors are logged** - Full error details in logs
3. **Health tracking** - Failed runs recorded in `data/health.json`
4. **Retry on next schedule** - Failed crawlers run again on next scheduled time

### Error Logging

```javascript
this.log('warn', 'Failed to search query: ctDNA', { error: error.message });
this.log('error', 'Crawler failed completely', { error: error.stack });
```

---

## Running Crawlers Manually

### Via Scheduler

```javascript
import { triggerCrawler, runAllCrawlersNow } from './scheduler.js';

// Run single crawler
await triggerCrawler('pubmed');

// Run all crawlers
const results = await runAllCrawlersNow();
```

### Direct Invocation

```javascript
import { PubMedCrawler } from './crawlers/pubmed.js';

const crawler = new PubMedCrawler();
const discoveries = await crawler.crawl();
```

---

## Environment Variables

### Crawler Enable/Disable

| Variable | Default | Description |
|----------|---------|-------------|
| `CRAWLER_PUBMED_ENABLED` | `true` | Enable PubMed crawler |
| `CRAWLER_CMS_ENABLED` | `true` | Enable CMS crawler |
| `CRAWLER_FDA_ENABLED` | `true` | Enable FDA crawler |
| `CRAWLER_VENDOR_ENABLED` | `true` | Enable Vendor crawler |
| `CRAWLER_PREPRINTS_ENABLED` | `true` | Enable Preprints crawler |

### Rate Limits

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_PUBMED` | `10` | PubMed requests/minute |
| `RATE_LIMIT_CMS` | `5` | CMS requests/minute |
| `RATE_LIMIT_FDA` | `5` | FDA requests/minute |
| `RATE_LIMIT_VENDOR` | `3` | Vendor requests/minute |
| `RATE_LIMIT_PREPRINTS` | `5` | Preprints requests/minute |

### Schedules (Cron Syntax)

| Variable | Default | Description |
|----------|---------|-------------|
| `SCHEDULE_PUBMED` | `0 6 * * *` | Daily at 6:00 AM |
| `SCHEDULE_CMS` | `0 6 * * 0` | Weekly Sunday 6:00 AM |
| `SCHEDULE_FDA` | `0 6 * * 1` | Weekly Monday 6:00 AM |
| `SCHEDULE_VENDOR` | `0 6 * * 2` | Weekly Tuesday 6:00 AM |
| `SCHEDULE_PREPRINTS` | `0 6 * * 3` | Weekly Wednesday 6:00 AM |
| `SCHEDULE_DIGEST` | `0 10 * * *` | Daily digest at 10:00 AM |
