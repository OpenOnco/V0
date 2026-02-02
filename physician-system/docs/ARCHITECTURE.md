# OpenOnco Physician System - Architecture & Function Report

**Version:** 1.0
**Date:** February 2, 2026
**Prepared for:** Third-Party Technical Review

---

## Executive Summary

The OpenOnco Physician System is a clinical decision support platform for Molecular Residual Disease (MRD) testing in solid tumors. It aggregates clinical evidence from authoritative medical sources and provides a RAG-based (Retrieval-Augmented Generation) chat interface for oncologists.

**Key Capabilities:**
- Multi-source clinical evidence aggregation (PubMed, ClinicalTrials.gov, FDA, NCCN, CMS)
- AI-powered content triage and classification
- Semantic search with vector embeddings
- Natural language query interface for physicians
- Automated monitoring and alerting

**Technology Stack:**
- Runtime: Node.js 22+
- Database: PostgreSQL with pgvector extension
- AI: Anthropic Claude (triage, classification, chat), OpenAI (embeddings)
- Hosting: Railway (PaaS)
- Email: Resend

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Data Flow](#2-data-flow)
3. [Database Schema](#3-database-schema)
4. [API Specification](#4-api-specification)
5. [Crawler Modules](#5-crawler-modules)
6. [AI Pipeline](#6-ai-pipeline)
7. [Search & Retrieval](#7-search--retrieval)
8. [Scheduler & Automation](#8-scheduler--automation)
9. [Security Considerations](#9-security-considerations)
10. [Dependencies](#10-dependencies)
11. [Configuration Reference](#11-configuration-reference)
12. [Operational Procedures](#12-operational-procedures)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL DATA SOURCES                              │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────────┤
│   PubMed    │ ClinicalTri │    FDA      │  CMS LCD    │  Society RSS        │
│   (NCBI)    │  als.gov    │  RSS Feeds  │   API       │ (JCO/ESMO/JITC)     │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴──────────┬──────────┘
       │             │             │             │                  │
       └─────────────┴─────────────┴─────────────┴──────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      CRAWLER MODULES        │
                    │  ┌────────────────────────┐ │
                    │  │ Pre-filter (Keywords)  │ │
                    │  └───────────┬────────────┘ │
                    │  ┌───────────▼────────────┐ │
                    │  │ Triage (Claude Haiku)  │ │
                    │  └───────────┬────────────┘ │
                    │  ┌───────────▼────────────┐ │
                    │  │ Classify (Claude Sonnet)│ │
                    │  └────────────────────────┘ │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │    POSTGRESQL DATABASE      │
                    │  ┌────────────────────────┐ │
                    │  │  mrd_guidance_items    │ │
                    │  │  mrd_clinical_trials   │ │
                    │  │  mrd_item_embeddings   │ │
                    │  │  mrd_artifacts         │ │
                    │  │  mrd_crawler_runs      │ │
                    │  └────────────────────────┘ │
                    │        (pgvector)           │
                    └──────────────┬──────────────┘
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       │                           │                           │
┌──────▼──────┐         ┌──────────▼──────────┐     ┌──────────▼──────────┐
│  EMBEDDING  │         │    CHAT API         │     │     SCHEDULER       │
│  GENERATOR  │         │  /api/mrd-chat      │     │    (node-cron)      │
│  (OpenAI)   │         │                     │     │                     │
└─────────────┘         │ ┌─────────────────┐ │     │  - Daily crawls     │
                        │ │ Intent Extract  │ │     │  - Weekly reports   │
                        │ │ (Haiku)         │ │     │  - Email digests    │
                        │ └────────┬────────┘ │     │  - Embedding gen    │
                        │ ┌────────▼────────┐ │     └─────────────────────┘
                        │ │ Hybrid Search   │ │
                        │ │ (pgvector+FTS)  │ │
                        │ └────────┬────────┘ │
                        │ ┌────────▼────────┐ │
                        │ │ Response Gen    │ │
                        │ │ (Sonnet)        │ │
                        │ └─────────────────┘ │
                        └──────────┬──────────┘
                                   │
                        ┌──────────▼──────────┐
                        │    PHYSICIAN UI     │
                        │  (External Client)  │
                        └─────────────────────┘
```

### 1.2 Directory Structure

```
physician-system/
├── src/
│   ├── index.js              # Application entry point
│   ├── cli.js                # Command-line interface
│   ├── config.js             # Configuration management
│   ├── scheduler.js          # Cron job scheduler
│   ├── health.js             # Health/status tracking
│   │
│   ├── chat/
│   │   └── server.js         # HTTP server & RAG pipeline
│   │
│   ├── crawlers/
│   │   ├── index.js          # Crawler orchestrator
│   │   ├── pubmed.js         # PubMed API client
│   │   ├── clinicaltrials.js # ClinicalTrials.gov client
│   │   ├── fda.js            # FDA RSS monitor
│   │   ├── cms.js            # CMS LCD API client
│   │   ├── society-monitor.js# Society RSS feeds
│   │   ├── pubmed-queries.js # Query construction
│   │   └── processors/       # Document processors
│   │       ├── nccn.js       # NCCN PDF extraction
│   │       ├── society.js    # Society guideline extraction
│   │       └── payer.js      # Payer policy extraction
│   │
│   ├── db/
│   │   ├── client.js         # PostgreSQL connection pool
│   │   ├── migrate.js        # Migration runner
│   │   └── migrations/       # SQL schema migrations (001-009)
│   │
│   ├── embeddings/
│   │   ├── mrd-embedder.js   # OpenAI embedding generation
│   │   ├── cross-link.js     # Trial-publication linking
│   │   └── duplicate-check.js# Deduplication
│   │
│   ├── triage/
│   │   ├── mrd-prefilter.js  # Keyword pre-filtering
│   │   ├── mrd-triage.js     # AI quick scoring
│   │   └── mrd-classifier.js # AI full classification
│   │
│   ├── email/
│   │   ├── index.js          # Resend email client
│   │   ├── weekly-digest.js  # Weekly summary
│   │   └── daily-ai-report.js# Daily AI ops report
│   │
│   └── utils/
│       ├── logger.js         # Winston logging
│       └── http.js           # HTTP client with rate limiting
│
├── data/
│   ├── guidelines/           # PDF storage
│   └── health.json           # Runtime health state
│
├── logs/                     # Rotating log files
├── tests/                    # Vitest test suite
└── docs/                     # Documentation
```

---

## 2. Data Flow

### 2.1 Ingestion Pipeline

```
External Source → Crawler → Pre-filter → Triage → Classify → Database → Embed
```

**Step 1: Fetch**
- Crawlers query external APIs (PubMed, ClinicalTrials.gov, FDA RSS, CMS)
- Raw data retrieved with rate limiting and retry logic

**Step 2: Pre-filter (Cost: $0)**
- Keyword-based filtering eliminates irrelevant content
- Primary terms required: MRD, ctDNA, liquid biopsy, etc.
- Exclusion terms: leukemia, lymphoma, bone marrow (hematologic)
- Solid tumor terms required for oncology focus

**Step 3: Triage (Cost: ~$0.001/article)**
- Claude 3.5 Haiku scores relevance 1-10
- Fast, cheap initial classification
- Extracts: cancer types, is_guideline, is_trial_result

**Step 4: Classify (Cost: ~$0.01/article)**
- Claude Sonnet performs full classification
- Extracts: evidence_type, evidence_level, clinical_settings
- Generates structured summary and key findings

**Step 5: Store**
- Insert into `mrd_guidance_items` table
- Link cancer types and clinical settings
- Record crawler run statistics

**Step 6: Embed (Cost: ~$0.0001/article)**
- OpenAI text-embedding-ada-002 generates 1536-dim vectors
- Large documents chunked (8000 tokens max)
- Stored in `mrd_item_embeddings` with pgvector

### 2.2 Query Pipeline

```
User Query → Intent Extract → Hybrid Search → Context Build → Response Generate
```

**Step 1: Intent Extraction**
- Claude Haiku analyzes query for:
  - Query type (clinical_guidance, trial_lookup, coverage_check)
  - Cancer types mentioned
  - Clinical settings (surveillance, adjuvant, etc.)
  - Keywords for search

**Step 2: Hybrid Search**
- Vector search: pgvector cosine similarity on embeddings
- Keyword search: PostgreSQL full-text search on title/summary
- Results merged with boosting for NCCN guidelines

**Step 3: Context Building**
- Top 10 sources formatted with citations
- Direct quotes extracted where available
- Related uncited items identified

**Step 4: Response Generation**
- Claude Sonnet generates response with inline citations
- Medical disclaimer appended
- Sources returned with full metadata

---

## 3. Database Schema

### 3.1 Entity-Relationship Overview

```
┌─────────────────────┐     ┌─────────────────────┐
│ mrd_guidance_items  │────<│ mrd_item_embeddings │
│  (PK: id)           │     │  (FK: guidance_id)  │
└─────────┬───────────┘     └─────────────────────┘
          │
          │     ┌─────────────────────────┐
          ├────<│ mrd_guidance_cancer_types│
          │     └─────────────────────────┘
          │
          │     ┌────────────────────────────┐
          ├────<│ mrd_guidance_clinical_settings│
          │     └────────────────────────────┘
          │
          │     ┌─────────────────────┐
          └────<│ mrd_quote_anchors   │
                └─────────────────────┘

┌─────────────────────┐     ┌─────────────────────────┐
│ mrd_clinical_trials │────<│ mrd_trial_status_history│
│  (PK: id)           │     │  (FK: trial_id)         │
│  (UK: nct_number)   │     └─────────────────────────┘
└─────────────────────┘

┌─────────────────────┐     ┌─────────────────────┐
│ mrd_artifacts       │     │ mrd_crawler_runs    │
│  (Document storage) │     │  (Run history)      │
└─────────────────────┘     └─────────────────────┘
```

### 3.2 Core Tables

#### mrd_guidance_items
Primary table for clinical guidance and evidence.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| source_type | VARCHAR(50) | pubmed, nccn, clinicaltrials, cms_lcd, asco, esmo, fda |
| source_id | VARCHAR(100) | PMID, NCT number, LCD ID |
| source_url | TEXT | Original source URL |
| title | TEXT | Article/guideline title |
| authors | JSONB | Array of author names |
| publication_date | DATE | Publication date |
| journal | VARCHAR(255) | Journal name |
| doi | VARCHAR(100) | Digital Object Identifier |
| pmid | VARCHAR(20) | PubMed ID |
| evidence_type | VARCHAR(50) | guideline, rct_results, meta_analysis, etc. |
| evidence_level | VARCHAR(100) | "NCCN Category 2A", "Level I", etc. |
| summary | TEXT | AI-generated summary |
| key_findings | JSONB | Structured findings |
| full_text_excerpt | TEXT | Relevant excerpt |
| is_superseded | BOOLEAN | Replaced by newer version |
| search_vector | TSVECTOR | Full-text search index |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

**Indexes:**
- `idx_guidance_source` - (source_type, source_id) UNIQUE
- `idx_guidance_date` - publication_date DESC
- `idx_guidance_evidence` - evidence_type
- `idx_guidance_search` - search_vector (GIN)

#### mrd_clinical_trials
Clinical trial tracking with status history.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| nct_number | VARCHAR(20) | NCT identifier (unique) |
| brief_title | TEXT | Short title |
| official_title | TEXT | Full official title |
| cancer_types | JSONB | Array of cancer types |
| phase | VARCHAR(20) | Phase 1, 2, 3, 4 |
| status | VARCHAR(50) | recruiting, completed, etc. |
| intervention_summary | TEXT | Treatment description |
| primary_endpoints | JSONB | Primary outcome measures |
| enrollment_target | INTEGER | Target enrollment |
| start_date | DATE | Study start |
| primary_completion_date | DATE | Primary completion |
| has_results | BOOLEAN | Results posted |
| linked_pmids | JSONB | Associated publications |
| lead_sponsor | VARCHAR(255) | Sponsor organization |
| is_priority_trial | BOOLEAN | Landmark MRD trial |

#### mrd_item_embeddings
Vector embeddings for semantic search.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| guidance_id | INTEGER | FK to mrd_guidance_items |
| chunk_index | INTEGER | Chunk number (for large docs) |
| chunk_text | TEXT | Text that was embedded |
| embedding | vector(1536) | OpenAI ada-002 embedding |
| created_at | TIMESTAMP | Creation time |

**Index:** IVFFlat on embedding column (cosine similarity)

#### mrd_crawler_runs
Crawler execution history and high water marks.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| crawler_name | VARCHAR(50) | pubmed, clinicaltrials, fda, cms |
| mode | VARCHAR(20) | seed, backfill, incremental |
| started_at | TIMESTAMP | Run start time |
| completed_at | TIMESTAMP | Run completion time |
| status | VARCHAR(20) | running, completed, failed |
| high_water_mark | JSONB | {last_date, last_id} |
| items_found | INTEGER | Total items fetched |
| items_new | INTEGER | New items added |
| items_duplicate | INTEGER | Duplicates skipped |
| error_message | TEXT | Error details if failed |

---

## 4. API Specification

### 4.1 POST /api/mrd-chat

Main RAG query endpoint for physician queries.

**Request:**
```json
{
  "query": "What is the evidence for MRD testing in stage III colorectal cancer?",
  "filters": {
    "cancerType": "colorectal",
    "sourceTypes": ["nccn", "pubmed"],
    "minEvidenceLevel": "2A"
  },
  "options": {
    "maxSources": 10,
    "includeRelated": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "answer": "Based on current evidence, MRD testing using ctDNA in stage III colorectal cancer is supported by multiple sources [1][2]. The NCCN guidelines recommend ctDNA testing as a Category 2A recommendation for surveillance after curative-intent therapy [1]. The CIRCULATE trial demonstrated that ctDNA-guided adjuvant therapy...",
  "sources": [
    {
      "index": 1,
      "title": "NCCN Clinical Practice Guidelines in Oncology: Colon Cancer",
      "citation": "NCCN Guidelines Version 2.2025",
      "url": "https://www.nccn.org/guidelines/...",
      "sourceType": "nccn",
      "evidenceType": "guideline",
      "evidenceLevel": "Category 2A",
      "similarity": 0.891,
      "directQuote": "ctDNA testing may be considered for surveillance..."
    }
  ],
  "relatedItems": [...],
  "disclaimer": "This information is for educational purposes only...",
  "meta": {
    "model": "claude-sonnet-4-20250514",
    "sourcesRetrieved": 10,
    "searchTime": 234,
    "intent": {
      "type": "clinical_guidance",
      "cancerTypes": ["colorectal"],
      "clinicalSettings": ["surveillance", "adjuvant"]
    }
  }
}
```

**Rate Limit:** 10 requests/minute per IP

### 4.2 GET /health

Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok",
  "service": "mrd-chat-api",
  "database": {
    "guidanceItems": 110,
    "clinicalTrials": 213,
    "embeddings": 93
  }
}
```

### 4.3 Internal Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| /api/import-nccn | POST | X-Crawl-Secret | Import NCCN recommendations |
| /api/trigger-crawl | POST | X-Crawl-Secret | Manually trigger crawler |

---

## 5. Crawler Modules

### 5.1 PubMed Crawler

**Source:** NCBI E-utilities API
**Endpoint:** https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
**Rate Limit:** 3/sec (no key) or 10/sec (with NCBI_API_KEY)

**Search Terms:**
```
("minimal residual disease" OR "molecular residual disease" OR
 "circulating tumor DNA" OR "ctDNA" OR "liquid biopsy")
AND
("colorectal" OR "breast" OR "lung" OR "pancreatic" OR ...)
AND
(solid tumor context terms)
```

**Modes:**
| Mode | Description | Use Case |
|------|-------------|----------|
| seed | Import specific PMIDs | Initial population |
| backfill | Historical crawl from date | Fill gaps |
| incremental | Since last run | Daily updates |
| catchup | Fill detected gaps | Recovery |

### 5.2 ClinicalTrials.gov Crawler

**Source:** ClinicalTrials.gov API v2
**Endpoint:** https://clinicaltrials.gov/api/v2/studies
**Rate Limit:** 5 requests/second

**Search Conditions:**
- minimal residual disease
- molecular residual disease
- circulating tumor DNA
- ctDNA
- liquid biopsy

**Cancer Types:** colorectal, breast, lung/NSCLC, bladder, urothelial, pancreatic, melanoma, ovarian, gastric, esophageal

**Priority Trials (Landmark MRD Studies):**
- NCT04264702 (CIRCULATE-US)
- NCT04089631 (CIRCULATE-Japan)
- NCT03748680 (DYNAMIC)
- NCT04120701 (GALAXY)
- NCT05174169 (COBRA)
- NCT03832569 (BESPOKE)
- NCT04068103 (IMvigor011)

### 5.3 FDA Crawler

**Source:** FDA RSS Feeds
**Feeds:**
- Drug Approvals: https://www.fda.gov/.../drugs/rss.xml
- Press Releases: https://www.fda.gov/.../press-releases/rss.xml
- MedWatch Alerts: https://www.fda.gov/.../medwatch/rss.xml

**Keyword Matching:**
- ctDNA, circulating tumor DNA, cell-free DNA
- liquid biopsy, minimal residual disease
- companion diagnostic, NGS
- Vendor names: Signatera, Guardant, FoundationOne, etc.

### 5.4 CMS LCD Crawler

**Source:** CMS Coverage API
**Endpoint:** https://api.coverage.cms.gov

**Relevant Policies:**
- MolDX: Molecular Diagnostic Services (Palmetto GBA)
- ctDNA/liquid biopsy coverage determinations
- Test-specific LCDs (Signatera, Guardant, etc.)

### 5.5 Society RSS Monitor

**Feeds Monitored:**

| Feed | Society | URL |
|------|---------|-----|
| JCO | ASCO | https://ascopubs.org/.../rss |
| Annals of Oncology | ESMO | https://annalsofoncology.org/current.rss |
| JITC | SITC | https://jitc.bmj.com/rss/current.xml |

**MRD Keywords:** ctDNA, circulating tumor DNA, liquid biopsy, MRD, minimal residual, molecular residual

---

## 6. AI Pipeline

### 6.1 Model Configuration

| Stage | Model | Cost | Purpose |
|-------|-------|------|---------|
| Pre-filter | N/A | $0 | Keyword filtering |
| Triage | claude-3-5-haiku-20241022 | ~$0.001/item | Quick relevance scoring |
| Classify | claude-sonnet-4-20250514 | ~$0.01/item | Full classification |
| Intent | claude-3-5-haiku-20241022 | ~$0.001/query | Query understanding |
| Response | claude-sonnet-4-20250514 | ~$0.02/query | Answer generation |
| Embedding | text-embedding-ada-002 | ~$0.0001/item | Vector generation |

### 6.2 Pre-filter Logic

```javascript
// Primary terms (must match at least one)
PRIMARY_TERMS = [
  'mrd', 'minimal residual disease', 'molecular residual disease',
  'ctdna', 'circulating tumor dna', 'cell-free dna', 'cfdna',
  'liquid biopsy', 'genomic profiling', 'tumor-informed'
]

// Exclusion terms (reject if matched)
EXCLUDE_TERMS = [
  'leukemia', 'lymphoma', 'myeloma', 'bone marrow transplant'
]

// Solid tumor requirement
SOLID_TUMOR_TERMS = [
  'colorectal', 'colon', 'rectal', 'breast', 'lung', 'nsclc',
  'pancreatic', 'melanoma', 'bladder', 'urothelial', 'ovarian'
]
```

### 6.3 Triage Prompt

```
Score this article's relevance to MRD testing in solid tumors (1-10):
- 10: Direct MRD guidance (guidelines, landmark trial results)
- 7-9: High-value evidence (Phase 3 trials, meta-analyses)
- 4-6: Useful context (observational, reviews)
- 1-3: Not relevant

Return JSON: {score, reason, cancer_types, is_guideline, is_trial_result}
```

### 6.4 Classification Schema

**Evidence Types:**
- guideline, consensus, rct_results, observational
- meta_analysis, review, regulatory, coverage_policy

**Evidence Levels:**
- NCCN Category 1, 2A, 2B, 3
- Level I, II, III, IV, V
- Grade A, B, C, D

**Clinical Settings:**
- screening, diagnosis, staging, treatment_selection
- monitoring, surveillance, recurrence, prognosis

---

## 7. Search & Retrieval

### 7.1 Hybrid Search Algorithm

```sql
-- Vector search (semantic similarity)
WITH vector_results AS (
  SELECT
    g.id,
    1 - (e.embedding <=> $query_embedding) as similarity
  FROM mrd_item_embeddings e
  JOIN mrd_guidance_items g ON e.guidance_id = g.id
  WHERE 1 - (e.embedding <=> $query_embedding) > 0.55
  ORDER BY similarity DESC
  LIMIT 20
),

-- Keyword search (full-text)
keyword_results AS (
  SELECT
    id,
    ts_rank(search_vector, plainto_tsquery($query)) as rank
  FROM mrd_guidance_items
  WHERE search_vector @@ plainto_tsquery($query)
  ORDER BY rank DESC
  LIMIT 20
)

-- Merge with boosting
SELECT DISTINCT
  COALESCE(v.id, k.id) as id,
  COALESCE(v.similarity, 0) +
  CASE WHEN k.id IS NOT NULL THEN 0.1 ELSE 0 END as hybrid_score
FROM vector_results v
FULL OUTER JOIN keyword_results k ON v.id = k.id
ORDER BY hybrid_score DESC
LIMIT 10;
```

### 7.2 Source Boosting

| Source Type | Boost Factor | Rationale |
|-------------|--------------|-----------|
| NCCN | 1.15x | Authoritative guidelines |
| cms_lcd | 1.10x | Coverage relevance |
| pubmed (RCT) | 1.05x | Clinical trial results |

### 7.3 Embedding Configuration

- **Model:** text-embedding-ada-002
- **Dimensions:** 1536
- **Chunk Size:** 8000 tokens max
- **Chunk Overlap:** 200 tokens
- **Index:** IVFFlat (pgvector)

---

## 8. Scheduler & Automation

### 8.1 Scheduled Jobs

| Job | Schedule (UTC) | Description |
|-----|----------------|-------------|
| pubmed | 0 6 * * * | Daily PubMed incremental crawl |
| fda | 0 7 * * * | Daily FDA RSS monitoring |
| clinicaltrials | 0 8 * * 1 | Weekly trial updates (Monday) |
| cms | 0 5 * * 0 | Weekly CMS LCD check (Sunday) |
| embed | 0 10 * * * | Daily embedding generation |
| monitor | 0 8 * * * | Daily society RSS monitoring |
| link | 0 12 * * 0 | Weekly trial-publication linking |
| digest | 0 9 * * 1 | Weekly email digest (Monday) |
| daily-report | 0 18 * * * | Daily AI operations report |

### 8.2 Health Tracking

```json
// data/health.json
{
  "version": 1,
  "startedAt": "2026-02-02T00:00:00Z",
  "lastUpdated": "2026-02-02T22:41:00Z",
  "crawlers": {
    "pubmed": {
      "status": "success",
      "lastRun": "2026-02-02T06:00:00Z",
      "lastSuccess": "2026-02-02T06:00:00Z",
      "stats": { "duration": 45000, "items_new": 5 }
    }
  },
  "errors": [],
  "digestsSent": 4,
  "lastDigestSent": "2026-01-27T09:00:00Z"
}
```

---

## 9. Security Considerations

### 9.1 Authentication & Authorization

| Endpoint | Auth Method | Notes |
|----------|-------------|-------|
| /api/mrd-chat | Rate limiting | 10 req/min per IP |
| /health | None | Public health check |
| /api/import-nccn | X-Crawl-Secret header | Internal only |
| /api/trigger-crawl | X-Crawl-Secret header | Internal only |

### 9.2 Data Security

- **Database:** PostgreSQL with SSL (Railway managed)
- **API Keys:** Environment variables only, never in code
- **Logs:** No PII logged, API keys redacted
- **Email:** Resend with domain verification

### 9.3 External API Security

| Service | Auth Method |
|---------|-------------|
| Anthropic | API key (ANTHROPIC_API_KEY) |
| OpenAI | API key (OPENAI_API_KEY) |
| NCBI | API key (NCBI_API_KEY) optional |
| Resend | API key (RESEND_API_KEY) |
| CMS | Public API, no auth |
| FDA | Public RSS, no auth |

### 9.4 Input Validation

- Query length limits enforced
- SQL injection prevented via parameterized queries
- XSS not applicable (API-only, no HTML rendering)

---

## 10. Dependencies

### 10.1 Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @anthropic-ai/sdk | ^0.52.0 | Claude API client |
| openai | ^4.0.0 | OpenAI embeddings |
| pg | ^8.18.0 | PostgreSQL driver |
| axios | ^1.6.0 | HTTP client |
| axios-retry | ^4.0.0 | Retry logic |
| node-cron | ^4.2.1 | Job scheduling |
| resend | ^6.9.1 | Email service |
| winston | ^3.11.0 | Logging |
| winston-daily-rotate-file | ^5.0.0 | Log rotation |
| pdf-parse | ^1.1.1 | PDF extraction |
| dotenv | ^16.3.1 | Environment config |

### 10.2 Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| vitest | ^4.0.17 | Test runner |

### 10.3 System Requirements

- **Node.js:** >=20.0.0
- **PostgreSQL:** 14+ with pgvector extension
- **Memory:** 512MB minimum, 1GB recommended
- **Storage:** 1GB for logs and artifacts

---

## 11. Configuration Reference

### 11.1 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| MRD_DATABASE_URL | Yes | - | PostgreSQL connection string |
| ANTHROPIC_API_KEY | Yes | - | Claude API key |
| OPENAI_API_KEY | Yes | - | OpenAI API key |
| PORT | No | 3000 | HTTP server port |
| NODE_ENV | No | development | Environment |
| LOG_LEVEL | No | info | Logging level |
| NCBI_API_KEY | No | - | PubMed rate limit increase |
| RESEND_API_KEY | No | - | Email notifications |
| EMAIL_FROM | No | mrd@openonco.org | Sender address |
| EMAIL_TO | No | - | Recipient address |
| ENABLE_SCHEDULER | No | true | Enable cron jobs |
| CRAWL_SECRET | No | - | Internal API auth |

### 11.2 Threshold Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| TRIAGE_MIN_SCORE | 5 | Minimum Haiku score to classify |
| PREFILTER_MIN_SCORE | 2 | Minimum keyword score |
| EMBED_SIMILARITY | 0.80 | Min similarity for search |

### 11.3 Schedule Configuration

All schedules use cron format and can be overridden via environment:

| Variable | Default | Description |
|----------|---------|-------------|
| PUBMED_SCHEDULE | 0 6 * * * | PubMed crawl |
| FDA_SCHEDULE | 0 7 * * * | FDA crawl |
| TRIALS_SCHEDULE | 0 8 * * 1 | Trials crawl |
| CMS_SCHEDULE | 0 5 * * 0 | CMS crawl |
| EMBED_SCHEDULE | 0 10 * * * | Embedding gen |
| MONITOR_SCHEDULE | 0 8 * * * | RSS monitor |
| LINK_SCHEDULE | 0 12 * * 0 | Trial linking |
| DIGEST_SCHEDULE | 0 9 * * 1 | Weekly digest |
| DAILY_REPORT_SCHEDULE | 0 18 * * * | Daily report |

---

## 12. Operational Procedures

### 12.1 Starting the Service

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev

# CLI commands
node src/cli.js <command> [options]
```

### 12.2 Database Migrations

```bash
# Run pending migrations
npm run db:migrate

# Check migration status
node src/db/migrate.js status
```

### 12.3 Manual Crawler Execution

```bash
# PubMed incremental
node src/cli.js pubmed

# PubMed backfill from date
node src/cli.js pubmed --mode=backfill --from=2024-01-01

# Clinical trials
node src/cli.js clinicaltrials

# Seed priority trials
node src/cli.js clinicaltrials --seed

# FDA RSS
node src/cli.js fda

# CMS LCDs
node src/cli.js cms

# Generate embeddings
node src/cli.js embed --limit=100

# Link trials to publications
node src/cli.js link --limit=100
```

### 12.4 Monitoring & Debugging

```bash
# Health status
node src/cli.js health

# Send test email
node src/cli.js test-email

# Send weekly digest now
node src/cli.js digest

# Send daily AI report now
node src/cli.js daily-report

# View logs
tail -f logs/combined-*.log
tail -f logs/error-*.log
```

### 12.5 Railway Deployment

```bash
# Link to project
railway link

# Deploy
railway up

# View logs
railway logs

# Run command on deployment
railway run node src/cli.js health

# Set environment variable
railway variables --set "KEY=value"
```

---

## Appendix A: CLI Command Reference

| Command | Description |
|---------|-------------|
| pubmed | Run PubMed crawler |
| clinicaltrials | Run ClinicalTrials.gov crawler |
| fda | Run FDA RSS crawler |
| cms | Run CMS LCD crawler |
| nccn | Process NCCN PDF(s) |
| society | Process society guideline PDF(s) |
| monitor | Check society RSS feeds |
| gaps | Detect and fill crawler gaps |
| embed | Generate missing embeddings |
| link | Link trials to publications |
| all | Run all crawlers sequentially |
| serve | Start HTTP server only |
| scheduler | Start cron scheduler only |
| digest | Send weekly digest email |
| daily-report | Send AI daily report |
| test-email | Send test email |
| health | Show health summary |
| help | Show help |

---

## Appendix B: Evidence Type Definitions

| Type | Definition |
|------|------------|
| guideline | Official clinical practice guideline (NCCN, ASCO, ESMO) |
| consensus | Expert consensus statement |
| rct_results | Randomized controlled trial results |
| observational | Observational study (cohort, case-control) |
| meta_analysis | Systematic review or meta-analysis |
| review | Narrative review article |
| regulatory | FDA approval, clearance, or guidance |
| coverage_policy | Payer coverage determination (LCD, NCD) |

---

## Appendix C: Cancer Type Enum

Standardized cancer types used throughout the system:

- colorectal, colon, rectal
- breast
- lung, nsclc, sclc
- pancreatic
- melanoma
- bladder, urothelial
- ovarian
- gastric, gastroesophageal
- esophageal
- hepatocellular
- cholangiocarcinoma
- head_and_neck
- thyroid
- endometrial
- sarcoma
- prostate
- renal

---

*Document generated: February 2, 2026*
*System Version: 1.0.0*
*Contact: OpenOnco (openonco.org)*
