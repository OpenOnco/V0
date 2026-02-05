# Physician System Technical Analysis

**Document Purpose:** Third-party analysis of the MRD Chat system architecture, current state, and known issues.

**Date:** February 3, 2026
**System Version:** Production (Railway deployment)

---

## 1. System Overview

### 1.1 Intended Function

The **Physician System** (also called "MRD Chat") is a Retrieval-Augmented Generation (RAG) system designed to help physicians find evidence about **Molecular Residual Disease (MRD)** and **circulating tumor DNA (ctDNA)** testing in solid tumors.

**Primary use cases:**
- Answer clinical questions about MRD/ctDNA testing evidence
- Surface relevant guidelines (NCCN, ASCO, ESMO)
- Provide clinical trial information
- Reference payer coverage policies
- Support evidence-based clinical decision-making

**Key constraints:**
- Must NOT provide treatment recommendations ("you should...")
- Must cite sources for all factual claims
- Must acknowledge evidence limitations
- Solid tumors only (not hematologic malignancies)

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                              │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   PubMed    │ClinicalTrials│    NCCN    │  ASCO/ESMO  │  Payer  │
│  (API)      │   .gov       │   (PDFs)   │  Guidelines │ Policies│
└──────┬──────┴──────┬───────┴──────┬─────┴──────┬──────┴────┬────┘
       │             │              │            │           │
       ▼             ▼              ▼            ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CRAWLERS                                 │
│  pubmed.js │ clinicaltrials.js │ nccn.js │ society.js │ cms.js  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TRIAGE PIPELINE                             │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐     │
│  │  Keyword     │ → │  AI Triage   │ → │ Full Classification│    │
│  │  Pre-filter  │   │  (Haiku)     │   │    (Sonnet)        │    │
│  └──────────────┘   └──────────────┘   └──────────────────┘     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL DATABASE                           │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │ mrd_guidance_items │  │ mrd_item_embeddings │                │
│  │     (191 items)    │  │  (pgvector 1536-d)  │                │
│  └────────────────────┘  └────────────────────┘                 │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │mrd_clinical_trials │  │  mrd_quote_anchors  │                │
│  │    (213 trials)    │  │   (42 anchors)      │                │
│  └────────────────────┘  └────────────────────┘                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CHAT API                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐     │
│  │ Query Intent │ → │ Vector Search│ → │ Response Generation│   │
│  │  Extraction  │   │  (pgvector)  │   │    (Sonnet)        │   │
│  └──────────────┘   └──────────────┘   └──────────────────┘     │
│                                        ┌──────────────────┐     │
│                                        │Citation Validator│     │
│                                        │ + Quote Anchoring│     │
│                                        └──────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Crawlers

### 2.1 Crawler Inventory

| Crawler | Source | Frequency | Status |
|---------|--------|-----------|--------|
| `pubmed.js` | PubMed API | Daily (incremental) | Active |
| `clinicaltrials.js` | ClinicalTrials.gov API | Manual | Active |
| `nccn.js` | NCCN PDF processor | Manual | Active |
| `society.js` | ASCO/ESMO/SITC PDFs | Manual | Active |
| `cms.js` | Medicare LCD policies | Manual | Active |
| `fda.js` | FDA RSS feeds | Scheduled | Active |
| `publication-index.js` | Vendor evidence pages | Weekly | New |

### 2.2 PubMed Crawler Pipeline

The PubMed crawler uses a multi-stage pipeline:

1. **Crawl** - Fetch articles from PubMed API using MRD-related search terms
2. **Keyword Pre-filter** - Fast rejection of obviously irrelevant articles
3. **AI Triage (Haiku)** - Score relevance 1-10, reject < 6
4. **Full Classification (Sonnet)** - Extract structured metadata:
   - Evidence type (RCT, observational, review, etc.)
   - Cancer types mentioned
   - Clinical settings
   - Key findings
5. **Database Insert** - Store in `mrd_guidance_items`

**Mode options:**
- `incremental` - Since last high water mark
- `backfill` - Full historical crawl from 2023-01-01
- `catchup` - Fill detected gaps

### 2.3 ClinicalTrials.gov Crawler

Fetches clinical trial data and stores in `mrd_clinical_trials` table. Supports:
- Full API search for ctDNA/MRD trials
- Priority trial seeding (13 landmark trials)
- Sync to `mrd_guidance_items` for RAG search

**Priority Trials (hardcoded):**
- CIRCULATE-US (NCT04264702)
- CIRCULATE-Japan (NCT04089631)
- DYNAMIC (NCT04120701)
- DYNAMIC-III (NCT04302025)
- BESPOKE CRC (NCT05078866)
- POTENTIATE/COBRA (NCT05827614)
- MERMAID-1 (NCT05084339)
- MERMAID-2 (NCT04385368)
- GALAXY (NCT03832569)
- c-TRAK TN (NCT04585477)
- DARE (NCT05581134)
- BR.36 (NCT05102045)
- IMPROVE-IT (NCT03748680)

### 2.4 Publication Index Crawler (New)

Extracts publication citations from vendor evidence pages using Claude:
- Crawls sources registered in `mrd_sources` table
- Uses Playwright for JavaScript-rendered pages
- Hash-based change detection for incremental crawling
- Resolves publications to PubMed when possible
- Sets interpretation guardrails for society/news sources

---

## 3. Database

### 3.1 Core Tables

#### `mrd_guidance_items` (191 items)
Primary table for searchable content.

```sql
CREATE TABLE mrd_guidance_items (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL,    -- pubmed, nccn, clinicaltrials, etc.
  source_id VARCHAR(100),               -- PMID, NCT number, etc.
  source_url TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  evidence_type VARCHAR(50),            -- guideline, rct_results, review, etc.
  evidence_level VARCHAR(100),          -- "NCCN Category 2A", "Level I", etc.
  publication_date DATE,
  journal VARCHAR(255),
  authors JSONB,
  full_text_excerpt TEXT,
  is_superseded BOOLEAN DEFAULT FALSE,
  search_vector TSVECTOR,
  UNIQUE(source_type, source_id)
);
```

#### `mrd_item_embeddings` (191 embeddings)
Vector embeddings for semantic search.

```sql
CREATE TABLE mrd_item_embeddings (
  id SERIAL PRIMARY KEY,
  guidance_id INTEGER REFERENCES mrd_guidance_items(id),
  chunk_index INTEGER DEFAULT 0,
  chunk_text TEXT NOT NULL,
  embedding vector(1536),               -- OpenAI text-embedding-ada-002
  UNIQUE(guidance_id, chunk_index)
);
```

Uses pgvector with IVFFlat index for approximate nearest neighbor search.

#### `mrd_clinical_trials` (213 trials)
Separate table for clinical trial metadata (not embedded for RAG by default).

### 3.2 Current Content Distribution

| Source Type | Count | Percentage |
|-------------|-------|------------|
| nccn | 56 | 29.3% |
| pubmed | 46 | 24.1% |
| extracted_publication | 23 | 12.0% |
| clinicaltrials | 13 | 6.8% |
| esmo | 10 | 5.2% |
| rss-asco | 8 | 4.2% |
| seed_publication | 8 | 4.2% |
| asco | 8 | 4.2% |
| payer-moldx-palmetto | 4 | 2.1% |
| fda | 3 | 1.6% |
| Other | 12 | 6.3% |
| **Total** | **191** | **100%** |

**Key Observation:** NCCN content comprises ~29% of the database, which contributes to the NCCN primacy issue described below.

---

## 4. Chat Mechanism

### 4.1 Request Flow

```
User Query
    │
    ▼
┌─────────────────────────────────┐
│ 1. Intent Extraction (Haiku)    │
│    - query_type                 │
│    - cancer_types               │
│    - evidence_focus             │
│    - keywords                   │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 2. Query Embedding              │
│    - text-embedding-ada-002     │
│    - 1536-dimensional vector    │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 3. Semantic Search (pgvector)   │
│    - Cosine similarity          │
│    - MIN_SIMILARITY = 0.55      │
│    - MAX_SOURCES = 10           │
│    - Filter by evidence_focus   │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 4. Response Generation (Sonnet) │
│    - System prompt + sources    │
│    - RESPONSE_TEMPLATE_PROMPT   │
│    - Citation requirements      │
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│ 5. Post-Processing              │
│    - Citation validation        │
│    - Quote anchoring            │
│    - Template enforcement       │
└─────────────┬───────────────────┘
              │
              ▼
         Response
```

### 4.2 System Prompt Structure

The system prompt combines:

1. **Base instructions** - No treatment recommendations, cite sources, acknowledge limitations
2. **Response template** - Query-type routing, section structure
3. **Forbidden patterns** - Regex patterns for prohibited language

```javascript
const MRD_CHAT_SYSTEM_PROMPT = `You are a medical literature assistant...

CRITICAL RULES:
1. NEVER make treatment recommendations
2. EVERY factual claim MUST cite a source using [1], [2], etc.
...

${RESPONSE_TEMPLATE_PROMPT}  // <-- This is where issues arise
`;
```

### 4.3 Citation Validation

Post-processing step that:
- Extracts citation numbers from response ([1], [2], etc.)
- Verifies each citation references a provided source
- Removes or flags unsupported citations
- Logs citation compliance rate

---

## 5. Known Issues

### 5.1 NCCN Primacy Problem

**Description:** The system disproportionately leads with NCCN guideline content regardless of query type. When asked about clinical trials, the response still starts with "CURRENT GUIDELINE POSITION: NCCN states..."

**Root Causes Identified:**

1. **Database Composition Skew**
   - NCCN comprises 29% of content (56/191 items)
   - Other source types are underrepresented
   - Trial content was stored in separate table, not searchable via RAG

2. **Historical Search Boost (FIXED)**
   ```javascript
   // Previously in server.js
   const NCCN_BOOST = 1.15;  // Artificially boosted NCCN similarity by 15%
   ```
   This was removed on 2026-02-03.

3. **System Prompt Bias (PARTIALLY FIXED)**
   The original prompt contained:
   ```
   - ALWAYS start with NCCN if available in sources
   - Always lead with NCCN for general queries
   ```
   Replaced with query-type routing, but behavior persists.

4. **Semantic Similarity Issue**
   NCCN content frequently mentions "clinical trials" in the context of "use only within clinical trials," causing high similarity scores for trial-related queries despite not containing actual trial data.

**Current State:**
- NCCN_BOOST removed
- System prompt updated for query-type routing
- 13 priority trials synced to guidance_items and embedded
- Trials now appear in search results (position 8-10) but still ranked below NCCN

### 5.2 Fabricated Quotes Problem

**Description:** The system occasionally generates quotes or claims attributed to sources that don't actually contain that information.

**Examples Observed:**

1. **Fabricated NCCN Statement:**
   - Query: "What clinical trials are studying MRD-guided treatment de-escalation?"
   - Response claimed: "NCCN states that 'ctDNA testing should be limited to clinical trial settings'"
   - Reality: NCCN never made this exact statement; this was a hallucinated paraphrase

2. **Incorrect Citation Attribution:**
   - Response cited [5] for a specific claim
   - Source [5] contained related but different information

**Contributing Factors:**

1. **Insufficient Source Context**
   - Sources provide only title + summary + chunk_text
   - Full text not always available
   - Model extrapolates beyond source content

2. **Prompt Encourages Synthesis**
   - Template encourages "pivot with 'However...'" and transitions
   - Model generates plausible-sounding content to fill gaps

3. **Citation Validation Limitations**
   - Validates that citation numbers exist
   - Does NOT validate that cited content matches claims
   - Quote anchoring only works when `mrd_quote_anchors` has exact matches

**Mitigation Attempts:**
- Added quote anchoring system (42 anchors in database)
- Added citation compliance logging
- Responses now include "Based on the available sources, it is unclear..." when appropriate

### 5.3 Query-Type Routing Not Fully Effective

**Description:** Despite prompt updates to route by query type, the model still defaults to NCCN-first structure.

**Prompt States:**
```
QUERY-TYPE ROUTING (choose ONE approach based on the question):

1. GUIDELINE QUESTIONS → Lead with guidelines
2. CLINICAL TRIAL QUESTIONS → Lead with trial data
3. EVIDENCE QUESTIONS → Lead with strongest evidence
4. PRACTICE QUESTIONS → Describe clinical adoption
```

**Actual Behavior:**
- All query types still produce "CURRENT GUIDELINE POSITION" as first section
- Trial questions mention NCCN before trials
- Model appears to have strong prior toward guideline-first structure

**Possible Solutions (Not Yet Implemented):**
1. Few-shot examples showing correct routing
2. Pre-processing step to modify prompt based on detected query type
3. Separate prompts per query type
4. Fine-tuning on correctly structured responses

---

## 6. Metrics and Monitoring

### 6.1 Current Health Endpoint Output

```json
{
  "database": {
    "guidanceItems": 191,
    "clinicalTrials": 213,
    "embeddings": 191,
    "quoteAnchors": 42
  },
  "backlog": {
    "embeddingsMissing": 0
  },
  "quality": {
    "recentAnswersWithCitations": 88,
    "chatLogsLast24h": 24
  }
}
```

### 6.2 Quality Indicators

| Metric | Current Value | Target |
|--------|---------------|--------|
| Responses with citations | 88% | >95% |
| Embeddings coverage | 100% | 100% |
| Quote anchors | 42 | Increase |
| Source diversity | 29% NCCN | <20% NCCN |

---

## 7. Recommendations

### 7.1 Immediate (High Priority)

1. **Increase non-NCCN content** - Run publication index crawler on more vendor sources to dilute NCCN concentration
2. **Add example responses to prompt** - Show correct query-type routing behavior
3. **Implement citation-claim validation** - Verify that claims actually appear in cited sources

### 7.2 Medium Term

4. **Expand quote anchors** - Extract more verbatim quotes from sources for grounding
5. **Add query rewriting** - Detect query type and modify system prompt accordingly
6. **Separate retrieval strategies** - Use different search approaches for different query types

### 7.3 Long Term

7. **Fine-tune on correct examples** - Create training set of properly structured responses
8. **Implement retrieval fusion** - Combine semantic + keyword + metadata filtering
9. **Add source quality scoring** - Weight recent RCTs higher than older reviews

---

## Appendix A: File Locations

| Component | Path |
|-----------|------|
| Chat Server | `physician-system/src/chat/server.js` |
| Response Template | `physician-system/src/chat/response-template.js` |
| Citation Validator | `physician-system/src/chat/citation-validator.js` |
| PubMed Crawler | `physician-system/src/crawlers/pubmed.js` |
| Trials Crawler | `physician-system/src/crawlers/clinicaltrials.js` |
| NCCN Processor | `physician-system/src/crawlers/processors/nccn.js` |
| Embedder | `physician-system/src/embeddings/mrd-embedder.js` |
| Database Migrations | `physician-system/src/db/migrations/` |
| CLI | `physician-system/src/cli.js` |

## Appendix B: API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mrd-chat` | POST | Main chat endpoint |
| `/health` | GET | System health check |
| `/api/admin/embed` | POST | Trigger embedding generation |
| `/api/admin/crawl` | POST | Trigger crawlers |

## Appendix C: Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API access |
| `OPENAI_API_KEY` | Embeddings (text-embedding-ada-002) |
| `PORT` | Server port (default: 3000) |
