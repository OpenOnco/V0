# MRD Guidance Monitor: Crawler Specification

## Overview

Automated system to collect and curate MRD/ctDNA clinical guidance from authoritative sources. Runs on Railway alongside existing OpenOnco crawlers.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CRAWLER ORCHESTRATOR                       │
│                  (runs on Railway, cron-scheduled)              │
└─────────────────────────────────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────┐       ┌─────────────────┐      ┌─────────────┐
│   PubMed    │       │ ClinicalTrials  │      │    NCCN     │
│   Crawler   │       │     Crawler     │      │   Crawler   │
└─────────────┘       └─────────────────┘      └─────────────┘
       │                       │                       │
       ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DISCOVERY QUEUE                             │
│              (new items awaiting review/triage)                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI TRIAGE (Claude API)                       │
│     - Relevance scoring                                         │
│     - Cancer type extraction                                    │
│     - Clinical setting classification                           │
│     - Evidence level identification                             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   HUMAN REVIEW QUEUE                            │
│              (admin interface for approval)                     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GUIDANCE DATABASE                              │
│              (approved items, searchable)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Source #1: PubMed

### Method
E-utilities API via existing PubMed MCP integration

### Frequency
Weekly (Sunday night)

### Search Strategies

**Strategy A: Guidelines & Consensus**
```
Query: (ctDNA OR "circulating tumor DNA" OR "molecular residual disease" OR MRD)
       AND (guideline[pt] OR consensus[ti] OR "position statement"[ti] 
            OR "clinical practice"[ti] OR recommendation[ti])
       AND solid tumor cancer types
       
Filters: Last 7 days, English
```

**Strategy B: Clinical Trial Results**
```
Query: (ctDNA OR "circulating tumor DNA" OR MRD OR "minimal residual disease")
       AND (adjuvant OR "post-operative" OR surveillance OR recurrence)
       AND (randomized OR "phase 3" OR "phase III" OR "clinical trial")
       AND solid tumor cancer types
       
Filters: Last 7 days, English
```

**Strategy C: Practice-Changing Publications**
```
Query: (ctDNA OR "circulating tumor DNA" OR MRD)
       AND solid tumor cancer types
       
Filters: Last 7 days
Journal filter: Nature Medicine, Nature, NEJM, JCO, JAMA Oncology, 
                Annals of Oncology, Lancet Oncology, Cancer Discovery
```

### Cancer Type Terms
```
colorectal OR colon OR rectal OR CRC
breast
lung OR NSCLC
bladder OR urothelial
pancreatic OR PDAC
melanoma
ovarian
gastric OR gastroesophageal
hepatocellular OR HCC
```

### Data Extraction
- PMID
- Title
- Authors (first, last, all)
- Journal
- Publication date
- Abstract
- DOI
- MeSH terms
- Publication type
- Full text link (if available)

### Relevance Scoring (AI Triage)
High relevance indicators:
- Publication type: guideline, consensus statement, systematic review
- Journal: top-tier oncology journals
- Keywords in title: "guideline", "consensus", "recommendation", "clinical utility"
- MeSH terms: Practice Guideline, Consensus, Meta-Analysis

Lower relevance (but still capture):
- Basic science / biomarker discovery
- Technical assay validation
- Single-institution retrospective

---

## Source #2: ClinicalTrials.gov

### Method
REST API: `https://clinicaltrials.gov/api/v2/studies`

### Frequency
Weekly (Sunday night)

### Search Parameters
```json
{
  "query.cond": "cancer",
  "query.term": "ctDNA OR circulating tumor DNA OR MRD OR minimal residual disease OR molecular residual disease",
  "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING,COMPLETED,ENROLLING_BY_INVITATION",
  "filter.studyType": "INTERVENTIONAL",
  "sort": "LastUpdatePostDate:desc",
  "pageSize": 100
}
```

### Named Trials to Always Track
Priority trials - always fetch full details regardless of update status:

| NCT Number | Trial Name | Cancer |
|------------|------------|--------|
| NCT04089631 | CIRCULATE-US | CRC |
| NCT04120701 | CIRCULATE-Japan/GALAXY | CRC |
| NCT04014920 | DYNAMIC | CRC |
| NCT04068103 | COBRA | CRC |
| NCT04259944 | PEGASUS | CRC |
| NCT03145961 | c-TRAK TN | Breast |
| NCT04915755 | ZEST | Breast |
| NCT02486718 | IMpower010 | Lung |
| NCT04385368 | MeRmaiD-1 | Multi |
| NCT04566536 | MeRmaiD-2 | Multi |
| NCT01888601 | TRACERx | Lung |
| NCT04264702 | BESPOKE CRC | CRC |

### Data Extraction
- NCT number
- Brief title
- Official title
- Cancer type(s)
- Phase
- Status
- Study type
- Primary endpoints
- Secondary endpoints
- Enrollment (actual/target)
- Start date
- Primary completion date
- Results posted? (boolean)
- Last update date
- Sponsor
- Collaborators
- Linked publications (PMIDs)
- Study arms / interventions

### Change Detection
Track changes in:
- Status (recruiting → active → completed)
- Results posted
- Primary completion date
- Enrollment numbers
- Linked publications added

---

## Source #3: NCCN Guidelines

### Challenge
No public API. PDFs require registration. Guidelines updated frequently but unpredictably.

### Method: Multi-Pronged

**A. JNCCN Journal RSS**
```
URL: https://jnccn.org/rss/current.xml
Filter: "NCCN Guidelines" in title
```
Captures "NCCN Guidelines Insights" articles that summarize updates.

**B. Recently Published Page (Playwright)**
```
URL: https://www.nccn.org/guidelines/recently-published-guidelines
Scrape: Table of recently updated guidelines
Track: Version numbers, dates
```

**C. Manual Quarterly Deep-Dive**
Key guidelines to review manually each quarter:
- Colon Cancer (NCCN.org/colon)
- Rectal Cancer (NCCN.org/rectal)
- Breast Cancer (NCCN.org/breast)
- Non-Small Cell Lung Cancer (NCCN.org/nsclc)
- Bladder Cancer (NCCN.org/bladder)
- Genetic/Familial High-Risk Assessment: Colorectal

### Data Extraction
- Guideline name
- Version number
- Update date
- Summary of changes (from "What's New" or JNCCN article)
- MRD/ctDNA specific mentions
- Evidence category/level for any MRD recommendations
- Direct quotes (with page numbers)

---

## Source #4: CMS Coverage (NCDs/LCDs)

### Method
Existing CMS MCP integration

### Frequency
Weekly

### Searches
```javascript
// National Coverage Determinations
search_national_coverage({ keyword: "ctDNA" })
search_national_coverage({ keyword: "circulating tumor DNA" })
search_national_coverage({ keyword: "liquid biopsy" })

// Local Coverage Determinations
search_local_coverage({ keyword: "ctDNA", document_type: "lcd" })
search_local_coverage({ keyword: "MRD", document_type: "lcd" })

// What's New Report
get_whats_new_report({ scope: "national", timeframe: 7 })
get_whats_new_report({ scope: "local", timeframe: 7 })
```

### Data Extraction
- LCD/NCD number
- Title
- Contractor (for LCDs)
- Effective date
- Coverage criteria summary
- Covered indications
- Non-covered indications
- Coding (CPT/HCPCS)
- Changes from prior version

---

## Source #5: ASCO Meeting Abstracts

### Method
Playwright-based scraping of `https://meetings.asco.org/abstracts-presentations/search`

### Frequency
- 2 weeks before major meetings: daily
- During meeting season: daily
- Off-season: weekly

### Meeting Calendar
| Meeting | Typical Dates | Abstract Release |
|---------|---------------|------------------|
| GI Symposium | Mid-January | ~2 weeks before |
| GU Symposium | February | ~2 weeks before |
| Annual Meeting | Late May/Early June | ~2 weeks before |
| Breast Cancer Symposium | September | ~2 weeks before |

### Search Terms
```
"circulating tumor DNA"
"ctDNA MRD"
"minimal residual disease" AND solid tumor
"molecular residual disease"
"liquid biopsy" AND adjuvant
"ctDNA-guided"
```

### Data Extraction
- Abstract number
- Title
- Authors (first author, last/senior author = likely KOLs)
- Meeting name and year
- Session type (oral, poster, etc.)
- Cancer type
- Trial name (if applicable)
- Key findings (from abstract text)

---

## Source #6: FDA Guidance Documents

### Method
RSS feed monitoring + periodic scrape

### RSS Feeds
```
https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds
  - Medical Devices guidance
  - CDRH guidance
```

### Backup: Periodic Scrape
```
URL: https://www.fda.gov/regulatory-information/search-fda-guidance-documents
Filters: Topic = oncology, device
Keywords: "circulating tumor DNA", "liquid biopsy", "minimal residual disease"
```

### Frequency
Monthly

### Data Extraction
- Guidance title
- Document number
- Status (draft vs final)
- Issue date
- Relevant excerpts mentioning ctDNA/MRD
- Link to PDF

---

## Source #7: ESMO Congress / Annals of Oncology

### Method
PubMed search with journal filter

### Search
```
Journal: "Annals of oncology"
Query: (ctDNA OR MRD OR "circulating tumor DNA")
Date: Conference supplement issues (September/October)
      + regular issues year-round
```

### Also Monitor
ESMO Guidelines via their website: `https://www.esmo.org/guidelines`
- Look for "eUpdate" annotations
- Track guideline version numbers

---

## AI Triage Prompt

When new items enter the discovery queue, use Claude API to classify:

```
You are reviewing a newly discovered publication/resource for the MRD Guidance Monitor database.

Analyze this item and extract:

1. RELEVANCE_SCORE (1-10): How relevant is this to clinical MRD guidance?
   - 10: Direct clinical guideline or recommendation
   - 8-9: Practice-changing trial results, consensus statement
   - 6-7: Relevant clinical data, expert review
   - 4-5: Supportive/background information
   - 1-3: Tangentially related or basic science only

2. CANCER_TYPES: List all applicable (or "multi" if pan-cancer)
   Options: colorectal, breast, lung_nsclc, lung_sclc, bladder, pancreatic, 
            melanoma, ovarian, gastric, hepatocellular, multi_solid

3. CLINICAL_SETTINGS: List all applicable
   Options: post_surgery, surveillance, during_adjuvant, post_adjuvant, 
            neoadjuvant, metastatic, recurrence_detection

4. QUESTIONS_ADDRESSED: Which clinical questions does this help answer?
   Options: when_to_test, which_test, positive_result_action, 
            negative_result_action, de_escalation, escalation, prognosis

5. EVIDENCE_TYPE: 
   Options: guideline, consensus, rct_results, observational, review, 
            meta_analysis, expert_opinion, regulatory

6. EVIDENCE_LEVEL: If stated in source, extract verbatim (e.g., "NCCN Category 2A")

7. SUMMARY: 2-3 sentence summary of key findings relevant to MRD clinical practice

8. KEY_QUOTES: Any direct quotes that are particularly important (with attribution)

Return as JSON.
```

---

## Database Tables

### `mrd_guidance_items`
Main table for approved guidance items.

```sql
CREATE TABLE mrd_guidance_items (
  id SERIAL PRIMARY KEY,
  
  -- Source identification
  source_type VARCHAR(50) NOT NULL,  -- pubmed, clinicaltrials, nccn, cms, asco, fda
  source_id VARCHAR(100),            -- PMID, NCT number, LCD number, etc.
  source_url TEXT,
  
  -- Bibliographic
  title TEXT NOT NULL,
  authors JSONB,                     -- [{name, affiliation}]
  publication_date DATE,
  journal VARCHAR(255),
  doi VARCHAR(100),
  
  -- Classification
  evidence_type VARCHAR(50),
  evidence_level VARCHAR(100),       -- As stated in source
  relevance_score INTEGER,
  
  -- Content
  summary TEXT,
  key_findings JSONB,
  full_text_excerpt TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  reviewed_by VARCHAR(100),
  is_superseded BOOLEAN DEFAULT FALSE,
  superseded_by INTEGER REFERENCES mrd_guidance_items(id),
  
  -- Search
  search_vector TSVECTOR
);

CREATE INDEX idx_guidance_source ON mrd_guidance_items(source_type, source_id);
CREATE INDEX idx_guidance_date ON mrd_guidance_items(publication_date DESC);
CREATE INDEX idx_guidance_search ON mrd_guidance_items USING GIN(search_vector);
```

### `mrd_guidance_cancer_types`
```sql
CREATE TABLE mrd_guidance_cancer_types (
  guidance_id INTEGER REFERENCES mrd_guidance_items(id),
  cancer_type VARCHAR(50),
  PRIMARY KEY (guidance_id, cancer_type)
);

CREATE INDEX idx_cancer_type ON mrd_guidance_cancer_types(cancer_type);
```

### `mrd_guidance_clinical_settings`
```sql
CREATE TABLE mrd_guidance_clinical_settings (
  guidance_id INTEGER REFERENCES mrd_guidance_items(id),
  clinical_setting VARCHAR(50),
  PRIMARY KEY (guidance_id, clinical_setting)
);
```

### `mrd_guidance_questions`
```sql
CREATE TABLE mrd_guidance_questions (
  guidance_id INTEGER REFERENCES mrd_guidance_items(id),
  question VARCHAR(50),
  PRIMARY KEY (guidance_id, question)
);
```

### `mrd_clinical_trials`
Detailed tracking of interventional MRD trials.

```sql
CREATE TABLE mrd_clinical_trials (
  id SERIAL PRIMARY KEY,
  nct_number VARCHAR(20) UNIQUE NOT NULL,
  
  -- Basic info
  brief_title TEXT,
  official_title TEXT,
  acronym VARCHAR(50),              -- e.g., "CIRCULATE", "DYNAMIC"
  
  -- Classification
  cancer_types JSONB,
  phase VARCHAR(20),
  status VARCHAR(50),
  study_type VARCHAR(50),
  
  -- Design
  intervention_description TEXT,
  primary_endpoints JSONB,
  secondary_endpoints JSONB,
  arms JSONB,
  
  -- Enrollment
  enrollment_target INTEGER,
  enrollment_actual INTEGER,
  
  -- Dates
  start_date DATE,
  primary_completion_date DATE,
  study_completion_date DATE,
  last_update_date DATE,
  
  -- Results
  has_results BOOLEAN DEFAULT FALSE,
  results_summary TEXT,
  linked_pmids JSONB,
  
  -- Sponsor
  lead_sponsor VARCHAR(255),
  collaborators JSONB,
  
  -- OpenOnco enrichment
  clinical_significance TEXT,        -- Our summary of why this matters
  is_priority_trial BOOLEAN,         -- Named trials we track closely
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `mrd_discovery_queue`
Staging table for items awaiting review.

```sql
CREATE TABLE mrd_discovery_queue (
  id SERIAL PRIMARY KEY,
  
  source_type VARCHAR(50),
  source_id VARCHAR(100),
  raw_data JSONB,                    -- Full response from source
  
  -- AI triage results
  ai_relevance_score INTEGER,
  ai_classification JSONB,
  ai_summary TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected, duplicate
  reviewed_at TIMESTAMP,
  reviewed_by VARCHAR(100),
  rejection_reason TEXT,
  
  -- Linking
  guidance_item_id INTEGER REFERENCES mrd_guidance_items(id),
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Cron Schedule

```
# PubMed - Sunday 2am
0 2 * * 0 /app/crawlers/pubmed.js

# ClinicalTrials.gov - Sunday 3am  
0 3 * * 0 /app/crawlers/clinicaltrials.js

# CMS Coverage - Sunday 4am
0 4 * * 0 /app/crawlers/cms.js

# NCCN (JNCCN RSS) - Daily 6am
0 6 * * * /app/crawlers/nccn.js

# FDA Guidance - 1st of month
0 5 1 * * /app/crawlers/fda.js

# ASCO Abstracts - varies by meeting season
# (managed via config, not fixed cron)
```

---

## Error Handling & Monitoring

### Alerts
- Crawler failure (non-zero exit)
- Zero results from expected source
- API rate limit hit
- Discovery queue > 100 items (backlog building)

### Logging
- Items discovered per run
- Items passed to AI triage
- AI triage results distribution
- Items approved/rejected in review

### Health Checks
- Last successful run per crawler
- Database connection
- Claude API availability (for triage)

---

## Future Enhancements

1. **Deduplication**: Detect when same study appears in multiple sources (e.g., ClinicalTrials.gov + PubMed publication)

2. **Citation Tracking**: When a trial publishes results, link the publication back to the trial record

3. **Supersession Detection**: When new guideline version released, mark old version as superseded

4. **KOL Tracking**: Build list of key opinion leaders from author patterns, track their publications

5. **Alert System**: Let physicians set alerts for specific trials or cancer types
