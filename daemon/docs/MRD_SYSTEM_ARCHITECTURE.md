# MRD Guidance Monitor - System Architecture Document

**Version:** 1.0
**Last Updated:** 2026-02-02
**Status:** Production
**Prepared for:** Third-Party Technical Review

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Data Sources & Crawlers](#3-data-sources--crawlers)
4. [AI Processing Pipeline](#4-ai-processing-pipeline)
5. [Vector Embedding System](#5-vector-embedding-system)
6. [Database Architecture](#6-database-architecture)
7. [Cross-Linking & Deduplication](#7-cross-linking--deduplication)
8. [Query & Retrieval System](#8-query--retrieval-system)
9. [Security & Compliance](#9-security--compliance)
10. [Cost Analysis](#10-cost-analysis)
11. [Appendices](#11-appendices)

---

## 1. Executive Summary

### 1.1 Purpose

The MRD Guidance Monitor is an automated clinical intelligence system that continuously monitors, extracts, classifies, and indexes medical literature and regulatory guidance related to **Molecular Residual Disease (MRD)** testing in solid tumors. It provides healthcare professionals and researchers with semantically-searchable access to clinical evidence for ctDNA-based cancer monitoring.

### 1.2 Key Capabilities

| Capability | Description |
|------------|-------------|
| **Multi-Source Crawling** | Automated collection from PubMed, ClinicalTrials.gov, FDA, and NCCN guidelines |
| **AI-Powered Triage** | Three-stage filtering pipeline using Claude AI for relevance scoring |
| **Semantic Search** | Vector embedding-based retrieval using OpenAI ada-002 and pgvector |
| **Cross-Source Linking** | Automatic detection of relationships between trials and publications |
| **Deduplication** | Semantic similarity-based detection of duplicate content across sources |

### 1.3 Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20+ (ES Modules) |
| Database | PostgreSQL 15+ with pgvector extension (Supabase) |
| AI Classification | Anthropic Claude (Haiku + Sonnet) |
| Embeddings | OpenAI text-embedding-ada-002 (1536 dimensions) |
| HTTP Client | Axios with rate limiting |
| Logging | Winston with daily rotation |

---

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                    │
├─────────────────┬─────────────────┬─────────────────┬───────────────────────┤
│    PubMed       │ ClinicalTrials  │    FDA RSS      │    NCCN PDFs          │
│  (E-utilities)  │   (v2 API)      │    (Feeds)      │   (Local files)       │
└────────┬────────┴────────┬────────┴────────┬────────┴───────────┬───────────┘
         │                 │                 │                    │
         ▼                 ▼                 ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CRAWLER LAYER                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐    │
│  │ pubmed.js    │ │clinicaltrials│ │   fda.js     │ │ nccn-processor   │    │
│  │              │ │    .js       │ │              │ │      .js         │    │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘    │
│         │                │                │                   │              │
│         └────────────────┴────────────────┴───────────────────┘              │
│                                   │                                          │
│                                   ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                     ORCHESTRATOR (index.js)                            │  │
│  │   • High-water mark tracking  • Gap detection  • Run logging          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      AI PROCESSING PIPELINE                                  │
│                                                                              │
│  Stage 1: KEYWORD PREFILTER (mrd-prefilter.js)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • PRIMARY_TERMS: MRD, ctDNA, liquid biopsy, cfDNA                   │    │
│  │ • EXCLUDE_TERMS: leukemia, lymphoma, myeloma (hematologic)          │    │
│  │ • SOLID_TUMOR_TERMS: colorectal, breast, lung, bladder, etc.        │    │
│  │ • Cost: $0 (no AI calls)                                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼ (~35% pass rate)                        │
│  Stage 2: AI TRIAGE (mrd-triage.js)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Model: Claude 3.5 Haiku (fast, cheap)                             │    │
│  │ • Output: Relevance score 1-10, cancer types, is_guideline flag     │    │
│  │ • Threshold: Score ≥ 6 passes                                       │    │
│  │ • Cost: ~$0.0003 per article                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼ (~30% of triaged pass)                  │
│  Stage 3: FULL CLASSIFICATION (mrd-classifier.js)                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ • Model: Claude Sonnet 4                                            │    │
│  │ • Output: Structured JSON with evidence_type, clinical_settings,   │    │
│  │   questions_addressed, key_findings, tests_mentioned               │    │
│  │ • Cost: ~$0.01 per article                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                                       │
│                    PostgreSQL + pgvector (Supabase)                         │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │ mrd_guidance_items  │  │ mrd_clinical_trials │  │ mrd_discovery_queue │  │
│  │ (approved guidance) │  │ (tracked trials)    │  │ (staging for triage)│  │
│  └──────────┬──────────┘  └──────────┬──────────┘  └─────────────────────┘  │
│             │                        │                                       │
│             ▼                        ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     mrd_item_embeddings                              │    │
│  │  • guidance_id (FK)  • chunk_index  • chunk_text  • embedding(1536) │    │
│  │  • IVFFlat index with cosine similarity                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐    │
│  │ Junction Tables   │  │ mrd_crawler_runs  │  │ mrd_trial_publications│    │
│  │ • cancer_types    │  │ (audit trail)     │  │ (cross-linking)       │    │
│  │ • clinical_setting│  │                   │  │                       │    │
│  │ • questions       │  │                   │  │                       │    │
│  └───────────────────┘  └───────────────────┘  └───────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUERY LAYER                                          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  searchSimilar() │  │ checkDuplicate() │  │ linkTrialToPublications()│   │
│  │  RAG retrieval   │  │ dedup at ingest  │  │ cross-source linking     │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Summary

| Phase | Input | Processing | Output |
|-------|-------|------------|--------|
| Collection | API queries with date range | Fetch + parse | Raw articles/trials |
| Prefilter | Raw articles | Keyword matching | ~35% pass |
| Triage | Prefiltered articles | Claude Haiku scoring | ~10% of original |
| Classification | Triaged articles | Claude Sonnet extraction | Structured metadata |
| Embedding | Classified articles | OpenAI ada-002 | 1536-dim vectors |
| Storage | Embeddings + metadata | PostgreSQL insert | Searchable index |
| Linking | New items | NCT match + embedding similarity | Trial-publication links |

---

## 3. Data Sources & Crawlers

### 3.1 PubMed Crawler

**File:** `src/crawlers/mrd/pubmed.js`
**API:** NCBI E-utilities (https://eutils.ncbi.nlm.nih.gov/entrez/eutils)

#### 3.1.1 Query Construction

The search query combines MeSH terms and title/abstract keywords:

```
("minimal residual disease"[tiab] OR "molecular residual disease"[tiab] OR
 "ctDNA"[tiab] OR "Circulating Tumor DNA"[Mesh] OR "liquid biopsy"[tiab])
AND
("neoplasms"[Mesh:NoExp] OR "carcinoma"[tiab] OR "colorectal"[tiab] OR ...)
AND NOT
("leukemia"[tiab] OR "lymphoma"[tiab] OR "myeloma"[tiab])
AND
Humans[Mesh] AND English[la]
```

#### 3.1.2 Rate Limiting

| Configuration | Value |
|---------------|-------|
| With API key | 10 requests/second (600/min) |
| Without API key | 3 requests/second (180/min) |
| Batch fetch size | 20 articles per request |
| Inter-batch delay | 100ms |

#### 3.1.3 Data Extraction

| Field | Source | Notes |
|-------|--------|-------|
| pmid | `<PMID>` | Primary identifier |
| title | `<ArticleTitle>` | May contain markup |
| abstract | `<AbstractText>` | May be structured with labels |
| authors | `<Author>` elements | First/last author flagged |
| publicationDate | `<PubDate>` | Normalized to YYYY-MM-DD |
| doi | `<ArticleId IdType="doi">` | For external linking |
| meshTerms | `<DescriptorName>` | Controlled vocabulary |
| publicationTypes | `<PublicationType>` | For priority filtering |

#### 3.1.4 Known Limitations

- XML parsing uses regex (not a proper XML parser)
- No retry logic for transient failures
- Structured abstracts may lose section labels

---

### 3.2 ClinicalTrials.gov Crawler

**File:** `src/crawlers/mrd/clinicaltrials.js`
**API:** ClinicalTrials.gov v2 API (https://clinicaltrials.gov/api/v2)

#### 3.2.1 Search Strategy

```javascript
const searchQuery = 'ctDNA cancer';  // Broad initial query
// Post-filtered to exclude hematologic malignancies
// Post-filtered to include only INTERVENTIONAL studies
```

#### 3.2.2 Priority Trials

The system maintains a curated list of landmark MRD trials for priority tracking:

| NCT Number | Trial Name | Cancer Type |
|------------|------------|-------------|
| NCT04264702 | CIRCULATE-US | Colorectal |
| NCT04120701 | DYNAMIC | Colorectal |
| NCT05078866 | BESPOKE CRC | Colorectal |
| NCT03748680 | IMvigor 011 | Bladder |
| NCT05084339 | MERMAID-1 | Bladder |
| NCT04585477 | c-TRAK TN | Breast |
| NCT05102045 | BR.36 | Lung |

#### 3.2.3 Data Model

```javascript
{
  nct_number: 'NCT04264702',
  brief_title: 'Circulating Tumor DNA...',
  official_title: '...',
  acronym: 'CIRCULATE-US',
  cancer_types: ['colorectal'],
  phase: 'Phase 2, Phase 3',
  status: 'recruiting',
  enrollment_target: 1000,
  start_date: '2020-03-01',
  primary_completion_date: '2026-12-01',
  lead_sponsor: 'NCI',
  is_priority_trial: true
}
```

---

### 3.3 FDA Crawler

**File:** `src/crawlers/mrd/fda.js`
**Sources:** FDA RSS Feeds

#### 3.3.1 Monitored Feeds

| Feed | URL | Content |
|------|-----|---------|
| Drug Approvals | `fda.gov/.../drugs-rss-feed/rss.xml` | New drug approvals |
| Device Approvals | `fda.gov/.../medical-devices-rss-feed/rss.xml` | 510(k), PMA |
| Guidance Documents | `fda.gov/.../cdrh-guidance-documents-rss-feed/rss.xml` | Draft/final guidance |

#### 3.3.2 Relevance Keywords

```javascript
const MRD_KEYWORDS = [
  'ctdna', 'circulating tumor dna', 'cell-free dna', 'liquid biopsy',
  'minimal residual disease', 'companion diagnostic', 'tumor marker',
  'genomic profiling', 'next generation sequencing', 'ngs'
];

const MRD_TESTS_VENDORS = [
  'signatera', 'guardant', 'foundationone', 'tempus', 'caris',
  'natera', 'grail', 'exact sciences'
];
```

---

### 3.4 NCCN Processor

**File:** `src/crawlers/mrd/nccn-processor.js`
**Input:** Local PDF files (NCCN guidelines are not publicly crawlable)

#### 3.4.1 Processing Pipeline

```
PDF File → pdf-parse → Text Extraction → Keyword Section Detection →
Claude Sonnet → Structured Recommendations → Database Insert
```

#### 3.4.2 Section Detection

Windows of ~2000 characters around MRD keywords are extracted:

```javascript
const MRD_KEYWORDS = [
  'ctDNA', 'circulating tumor DNA', 'cell-free DNA', 'cfDNA',
  'liquid biopsy', 'minimal residual disease', 'MRD',
  'Signatera', 'Guardant', 'FoundationOne', 'tumor-informed'
];
```

#### 3.4.3 Output Structure

```javascript
{
  recommendation: 'ctDNA testing may be considered for surveillance...',
  evidence_category: '2A',  // NCCN Category
  clinical_setting: 'post-surgical surveillance',
  test_timing: 'Every 3-6 months for 2 years',
  key_quote: 'In patients with stage III colon cancer...'
}
```

---

## 4. AI Processing Pipeline

### 4.1 Stage 1: Keyword Prefilter

**File:** `src/triage/mrd-prefilter.js`
**Cost:** $0 (no AI calls)
**Pass Rate:** ~35%

#### 4.1.1 Term Categories

| Category | Examples | Effect |
|----------|----------|--------|
| PRIMARY_TERMS | mrd, ctdna, liquid biopsy | Must match ≥1 |
| EXCLUDE_TERMS | leukemia, lymphoma | Immediate reject |
| SOLID_TUMOR_TERMS | colorectal, breast, lung | Boosts score |
| CONTEXT_TERMS | surveillance, adjuvant | Boosts score |

#### 4.1.2 Scoring Algorithm

```javascript
let score = 1;
if (hasPrimaryTerm) score += 2;
if (hasSolidTumor) score += 2;
score += Math.min(contextMatches, 3);  // Max +3 for context
return Math.min(score, 10);
```

---

### 4.2 Stage 2: AI Triage

**File:** `src/triage/mrd-triage.js`
**Model:** Claude 3.5 Haiku (`claude-3-5-haiku-20241022`)
**Cost:** ~$0.0003 per article
**Pass Rate:** ~30% of prefiltered

#### 4.2.1 Prompt Design

```
You are a medical literature classifier specializing in MRD for solid tumors.

Evaluate this article for relevance to MRD clinical guidance. Score 1-10 where:
- 10: Directly actionable MRD guidance (guidelines, landmark trials, consensus)
- 7-9: High-value clinical evidence (Phase 3 trials, meta-analyses)
- 4-6: Useful context (observational studies, reviews with novel insights)
- 1-3: Tangentially related or not relevant

Focus on:
- Solid tumors (colorectal, breast, lung, bladder) - NOT hematologic
- Clinical utility of ctDNA/MRD testing
- Treatment decisions based on MRD status
```

#### 4.2.2 Output Schema

```json
{
  "score": 8,
  "reason": "Phase III RCT results for ctDNA-guided adjuvant therapy",
  "cancer_types": ["colorectal"],
  "is_guideline": false,
  "is_trial_result": true
}
```

---

### 4.3 Stage 3: Full Classification

**File:** `src/triage/mrd-classifier.js`
**Model:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)
**Cost:** ~$0.01 per article

#### 4.3.1 Extracted Fields

| Field | Type | Description |
|-------|------|-------------|
| evidence_type | enum | guideline, consensus, rct_results, observational, meta_analysis, review, regulatory, coverage_policy |
| evidence_level | string | As stated (e.g., "NCCN Category 2A", "Level I") |
| relevance_score | int | 1-10 |
| cancer_types | array | colorectal, breast, lung_nsclc, bladder, etc. |
| clinical_settings | array | screening, post_surgery, surveillance, metastatic, etc. |
| questions_addressed | array | when_to_test, which_test, positive_result_action, etc. |
| summary | string | 2-3 sentence clinical summary |
| key_findings | array | [{finding, implication}] |
| tests_mentioned | array | Signatera, Guardant Reveal, etc. |
| is_practice_changing | boolean | Landmark evidence flag |

#### 4.3.2 Validation

All enum fields are validated against allowed values:

```javascript
const validCancerTypes = [
  'colorectal', 'breast', 'lung_nsclc', 'lung_sclc', 'bladder',
  'pancreatic', 'melanoma', 'ovarian', 'gastric', 'esophageal',
  'hepatocellular', 'prostate', 'renal', 'multi_solid'
];
```

---

## 5. Vector Embedding System

### 5.1 Embedding Generation

**File:** `src/embeddings/mrd-embedder.js`
**Model:** OpenAI `text-embedding-ada-002`
**Dimensions:** 1536

#### 5.1.1 Text Construction

Guidance items are converted to embedding-friendly text:

```javascript
function buildEmbeddingText(item) {
  const parts = [];

  // Source context for NCCN boost
  if (item.source_type === 'nccn') {
    parts.push('Source: NCCN Clinical Practice Guidelines...');
  }

  parts.push(`Title: ${item.title}`);
  parts.push(`Evidence Level: ${item.evidence_level}`);
  parts.push(`Summary: ${item.summary}`);
  parts.push(`Key Findings: ${formatFindings(item.key_findings)}`);
  parts.push(`Cancer Types: ${item.cancer_types.join(', ')}`);
  parts.push(`Clinical Settings: ${item.clinical_settings.join(', ')}`);

  // Keyword enrichment for NCCN
  if (item.source_type === 'nccn') {
    parts.push('Keywords: NCCN guidelines, clinical practice...');
  }

  return parts.join('\n\n');
}
```

#### 5.1.2 Chunking Strategy

Long documents are split with overlap:

| Parameter | Value | Notes |
|-----------|-------|-------|
| Max tokens per chunk | 8000 | ada-002 supports 8191 |
| Overlap | 200 tokens | Preserves cross-boundary context |
| Break preference | Sentence boundaries | Avoids mid-word splits |

#### 5.1.3 Batch Processing

```javascript
const BATCH_SIZE = 100;  // OpenAI batch limit
// Rate limiting: 100ms between batches
```

---

### 5.2 Vector Storage

**Table:** `mrd_item_embeddings`

```sql
CREATE TABLE mrd_item_embeddings (
  id SERIAL PRIMARY KEY,
  guidance_id INTEGER REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  chunk_index INTEGER DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guidance_id, chunk_index)
);

-- IVFFlat index for approximate nearest neighbor
CREATE INDEX idx_embedding_vector ON mrd_item_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

#### 5.2.1 Index Selection

| Index Type | Use Case | Trade-offs |
|------------|----------|------------|
| IVFFlat | <100K vectors | Fast build, good recall |
| HNSW | >100K vectors | Better recall, slower build |

Current configuration uses IVFFlat with 100 lists (optimal for ~10K vectors).

---

## 6. Database Architecture

### 6.1 Entity-Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CORE ENTITIES                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐         ┌─────────────────────────┐
│   mrd_guidance_items    │         │   mrd_clinical_trials   │
├─────────────────────────┤         ├─────────────────────────┤
│ id (PK)                 │         │ id (PK)                 │
│ source_type             │         │ nct_number (UNIQUE)     │
│ source_id               │         │ brief_title             │
│ source_url              │         │ official_title          │
│ title                   │         │ acronym                 │
│ authors (JSONB)         │         │ cancer_types (JSONB)    │
│ publication_date        │         │ phase                   │
│ journal                 │         │ status                  │
│ doi                     │         │ enrollment_target       │
│ evidence_type           │         │ start_date              │
│ evidence_level          │         │ primary_completion_date │
│ relevance_score         │         │ lead_sponsor            │
│ summary                 │         │ is_priority_trial       │
│ key_findings (JSONB)    │         │ has_results             │
│ is_superseded           │         │ created_at              │
│ superseded_by (FK→self) │         │ updated_at              │
│ search_vector (TSVECTOR)│         └───────────┬─────────────┘
│ created_at              │                     │
│ updated_at              │                     │
└───────────┬─────────────┘                     │
            │                                   │
            │  1:N                              │
            ▼                                   │
┌─────────────────────────┐                     │
│  mrd_item_embeddings    │                     │
├─────────────────────────┤                     │
│ id (PK)                 │                     │
│ guidance_id (FK)        │                     │
│ chunk_index             │                     │
│ chunk_text              │                     │
│ embedding (vector 1536) │                     │
│ created_at              │                     │
└─────────────────────────┘                     │
                                                │
┌───────────────────────────────────────────────┘
│
│  N:M (via junction)
▼
┌─────────────────────────┐
│ mrd_trial_publications  │
├─────────────────────────┤
│ trial_id (FK)           │
│ guidance_id (FK)        │
│ match_confidence        │
│ match_method            │
│ created_at              │
└─────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         JUNCTION TABLES                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────┐  ┌───────────────────┐
│ mrd_guidance_cancer_    │  │ mrd_guidance_clinical_  │  │ mrd_guidance_     │
│        types            │  │       settings          │  │    questions      │
├─────────────────────────┤  ├─────────────────────────┤  ├───────────────────┤
│ guidance_id (FK)        │  │ guidance_id (FK)        │  │ guidance_id (FK)  │
│ cancer_type             │  │ clinical_setting        │  │ question          │
│ (PK: both)              │  │ (PK: both)              │  │ (PK: both)        │
└─────────────────────────┘  └─────────────────────────┘  └───────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                         OPERATIONAL TABLES                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────┐
│   mrd_discovery_queue   │  │    mrd_crawler_runs     │
├─────────────────────────┤  ├─────────────────────────┤
│ id (PK)                 │  │ id (PK)                 │
│ source_type             │  │ crawler_name            │
│ source_id               │  │ mode                    │
│ source_url              │  │ started_at              │
│ raw_data (JSONB)        │  │ completed_at            │
│ ai_processed_at         │  │ status                  │
│ ai_relevance_score      │  │ items_found             │
│ ai_classification       │  │ items_new               │
│ ai_summary              │  │ items_duplicate         │
│ ai_model                │  │ items_rejected          │
│ status                  │  │ high_water_mark (JSONB) │
│ priority                │  │ error_message           │
│ crawler_run_id          │  │ duration_seconds        │
└─────────────────────────┘  └─────────────────────────┘
```

### 6.2 Key Indexes

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| mrd_guidance_items | source_type, source_id | UNIQUE | Deduplication |
| mrd_guidance_items | search_vector | GIN | Full-text search |
| mrd_guidance_items | publication_date | BTREE | Chronological queries |
| mrd_item_embeddings | embedding | IVFFlat | Vector similarity |
| mrd_discovery_queue | status, priority | BTREE | Queue processing |

### 6.3 Full-Text Search

PostgreSQL tsvector with weighted fields:

```sql
search_vector :=
  setweight(to_tsvector('english', title), 'A') ||
  setweight(to_tsvector('english', summary), 'B') ||
  setweight(to_tsvector('english', full_text_excerpt), 'C');
```

---

## 7. Cross-Linking & Deduplication

### 7.1 Duplicate Detection

**File:** `src/embeddings/duplicate-check.js`

#### 7.1.1 Thresholds

| Threshold | Value | Interpretation |
|-----------|-------|----------------|
| DUPLICATE_THRESHOLD | 0.92 | Very high similarity → block insertion |
| RELATED_THRESHOLD | 0.85 | High similarity → related but distinct |

#### 7.1.2 Algorithm

```javascript
async function checkDuplicate(text) {
  const embedding = await embed(text);

  // Query pgvector for similar items
  const result = await query(
    `SELECT * FROM check_duplicate_embedding($1::vector, $2)`,
    [JSON.stringify(embedding), DUPLICATE_THRESHOLD]
  );

  return {
    isDuplicate: result.rows.length > 0,
    matches: result.rows
  };
}
```

### 7.2 Cross-Source Linking

**File:** `src/embeddings/cross-link.js`

Links clinical trials to their publications using dual matching:

#### 7.2.1 Method 1: NCT Number Mention

```sql
SELECT id, title FROM mrd_guidance_items
WHERE full_text_excerpt ILIKE '%NCT04264702%'
-- Confidence: 1.0 (explicit reference)
```

#### 7.2.2 Method 2: Embedding Similarity

```sql
SELECT g.id, g.title, 1 - (e.embedding <=> $1::vector) as similarity
FROM mrd_item_embeddings e
JOIN mrd_guidance_items g ON e.guidance_id = g.id
WHERE g.evidence_type IN ('rct_results', 'observational', 'meta_analysis')
  AND 1 - (e.embedding <=> $1::vector) >= 0.82
-- Confidence: similarity × 0.85
```

---

## 8. Query & Retrieval System

### 8.1 Semantic Search

**Function:** `searchSimilar(queryText, options)`

```javascript
const results = await searchSimilar(
  'What is the evidence for MRD testing in stage III colon cancer?',
  {
    limit: 10,
    minSimilarity: 0.7,
    cancerType: 'colorectal'
  }
);
```

#### 8.1.1 Query Flow

```
User Query → OpenAI Embedding → pgvector Similarity Search →
Filter by cancer_type → Rank by similarity → Return top N
```

#### 8.1.2 Response Format

```javascript
{
  id: 123,
  title: 'DYNAMIC Trial: ctDNA-guided management...',
  summary: 'In patients with stage II colon cancer...',
  sourceType: 'pubmed',
  sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/...',
  evidenceType: 'rct_results',
  matchedText: 'ctDNA positivity at 4 weeks post-surgery...',
  similarity: 0.89
}
```

### 8.2 Filter Dimensions

| Dimension | Table | Values |
|-----------|-------|--------|
| Cancer Type | mrd_guidance_cancer_types | colorectal, breast, lung_nsclc, etc. |
| Clinical Setting | mrd_guidance_clinical_settings | post_surgery, surveillance, metastatic |
| Evidence Type | mrd_guidance_items.evidence_type | guideline, rct_results, meta_analysis |
| Question | mrd_guidance_questions | when_to_test, positive_result_action |

---

## 9. Security & Compliance

### 9.1 Data Classification

| Data Type | Classification | Notes |
|-----------|----------------|-------|
| Published literature | Public | PubMed abstracts |
| Clinical trial data | Public | ClinicalTrials.gov |
| FDA announcements | Public | Public RSS feeds |
| NCCN guidelines | Licensed | Requires institutional access |
| AI-generated summaries | Derived | Based on public sources |

### 9.2 API Security

| Service | Authentication | Rate Limits |
|---------|----------------|-------------|
| PubMed E-utilities | API key (optional) | 10 req/sec with key |
| ClinicalTrials.gov | None | 10 req/sec |
| OpenAI | API key (required) | Tier-based |
| Anthropic | API key (required) | Tier-based |
| PostgreSQL | Connection string | Pool: 10 max |

### 9.3 Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=     # Claude AI for triage/classification
OPENAI_API_KEY=        # Embeddings
MRD_DATABASE_URL=      # PostgreSQL connection (Supabase format)

# Optional
NCBI_API_KEY=          # Higher PubMed rate limits
MRD_DATABASE_SSL=      # SSL configuration
```

---

## 10. Cost Analysis

### 10.1 Per-Article Costs

| Stage | Model | Cost per Article |
|-------|-------|------------------|
| PubMed API | Free | $0 |
| Prefilter | None | $0 |
| Haiku Triage | Claude 3.5 Haiku | $0.0003 |
| Sonnet Classification | Claude Sonnet 4 | $0.01 |
| Embedding | ada-002 | $0.00002 |
| **Total (if passes all stages)** | | **~$0.01** |

### 10.2 Monthly Cost Estimate

Assuming 500 articles/day processed:

| Component | Calculation | Monthly Cost |
|-----------|-------------|--------------|
| PubMed crawl | 500 × 30 × $0 | $0 |
| Prefilter (35% pass) | 175 articles | $0 |
| Haiku triage | 175 × $0.0003 × 30 | $1.58 |
| Sonnet classification (~50/day) | 50 × $0.01 × 30 | $15 |
| Embeddings | 50 × $0.00002 × 30 | $0.03 |
| Database (Supabase) | Fixed | ~$25 |
| **Total** | | **~$42/month** |

### 10.3 Cost Optimization Strategies

1. **Tiered AI Models:** Cheap Haiku for triage, expensive Sonnet only for high-value items
2. **Keyword Prefilter:** Eliminates ~65% before any AI calls
3. **Incremental Crawling:** High-water marks avoid reprocessing
4. **Batch Embedding:** OpenAI batch API reduces overhead

---

## 11. Appendices

### Appendix A: Crawler Run Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `seed` | Manual import without crawling | Initial data load |
| `backfill` | Historical crawl with full pipeline | Populate past data |
| `incremental` | Crawl since last high-water mark | Daily operation |
| `catchup` | Fill detected gaps | Recovery from downtime |

### Appendix B: Discovery Queue Status Flow

```
pending → ai_triaged → approved → (moved to mrd_guidance_items)
                    ↘ rejected
                    ↘ duplicate
                    ↘ deferred
```

### Appendix C: Evidence Type Definitions

| Type | Definition |
|------|------------|
| guideline | Official clinical practice guideline (NCCN, ASCO, ESMO) |
| consensus | Expert consensus statement |
| rct_results | Randomized controlled trial results |
| observational | Observational/cohort study |
| meta_analysis | Meta-analysis or systematic review |
| review | Narrative review |
| regulatory | FDA approval, clearance, or guidance |
| coverage_policy | Payer coverage determination |

### Appendix D: Cancer Type Codes

| Code | Cancer Type |
|------|-------------|
| colorectal | Colorectal (colon + rectal) |
| breast | Breast |
| lung_nsclc | Non-small cell lung cancer |
| lung_sclc | Small cell lung cancer |
| bladder | Bladder/urothelial |
| pancreatic | Pancreatic |
| melanoma | Melanoma |
| ovarian | Ovarian |
| gastric | Gastric/stomach |
| esophageal | Esophageal |
| hepatocellular | Hepatocellular carcinoma |
| prostate | Prostate |
| renal | Renal cell carcinoma |
| multi_solid | Pan-solid tumor |

### Appendix E: Clinical Setting Codes

| Code | Setting |
|------|---------|
| screening | Early cancer detection |
| diagnosis | Initial diagnosis |
| pre_surgery | Neoadjuvant setting |
| post_surgery | Post-resection (acute) |
| neoadjuvant | During neoadjuvant therapy |
| during_adjuvant | During adjuvant therapy |
| post_adjuvant | After completing adjuvant therapy |
| surveillance | Long-term monitoring |
| recurrence | At recurrence detection |
| metastatic | Metastatic disease |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-02 | System | Initial document |

---

*End of Document*
