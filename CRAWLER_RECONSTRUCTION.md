# Crawler Reconstruction Guide

**Last updated:** March 2026
**Status:** All crawlers shut down. Data monitoring replaced by Claude Code `/schedule` tasks.
**Author:** Alex Dickinson

## Why This Document Exists

In March 2026, we shut down all custom crawler infrastructure (Railway services, Supabase database) and replaced data monitoring with 3 Claude Code `/schedule` tasks. This document captures everything needed to reconstruct any crawler from git history if the `/schedule` approach proves insufficient.

---

## What Was Shut Down

| Service | Platform | Git Source | Purpose |
|---------|----------|------------|---------|
| test-data-tracker | Railway | `OpenOnco/test-data-tracker` (private repo) | CMS, vendor, payer, NIH crawlers + proposal queue |
| physician-system | Railway | `OpenOnco/physician-system` (private repo) | PubMed, FDA, ClinicalTrials, guideline crawlers + RAG pipeline + FAQ generator |
| Supabase project `wwktaeudowiasojodtla` | Supabase Free | physician-system migrations | Postgres DB for embeddings, guidance items, clinical trials, crawler runs |

## Where the Code Lives

### Option A: Standalone repos (most recent code)

The code was split from V0 into private repos on March 22, 2026:

- `github.com/OpenOnco/test-data-tracker` — daemon with all 4 crawlers
- `github.com/OpenOnco/physician-system` — physician RAG system with 11 crawlers

### Option B: V0 git history (full history preserved)

If the standalone repos are unavailable, the complete code exists in V0's git history:

```bash
# Last commit before removal:
git show c4f964a~1:test-data-tracker/   # daemon code
git show c4f964a~1:physician-system/    # physician system code

# To extract the full directory to disk:
git show c4f964a~1:test-data-tracker/src/index.js > index.js  # one file at a time

# Or restore the entire directory:
git checkout c4f964a~1 -- test-data-tracker/   # restores to working tree
git checkout c4f964a~1 -- physician-system/    # restores to working tree

# Key commit reference:
# c4f964a = "chore: remove split-out directories from V0" (March 22, 2026)
# c4f964a~1 = the commit immediately before removal (code intact)
```

---

## Test-Data-Tracker (Daemon)

### Architecture

```
test-data-tracker/
├── src/
│   ├── index.js                    # Entry point (Express health server + scheduler)
│   ├── config.js                   # Master config (~1,000 lines) — crawler URLs, payer policies, vendor sites
│   ├── scheduler.js                # node-cron scheduling, weekly aggregation
│   ├── server.js                   # Health check HTTP server
│   ├── crawlers/
│   │   ├── base.js                 # Base crawler class
│   │   ├── cms.js                  # CMS Medicare API crawler (api.coverage.cms.gov)
│   │   ├── payers.js               # Payer policy Playwright crawler (16 payers)
│   │   ├── discovery.js            # Policy document discovery via Playwright
│   │   ├── playwright-base.js      # Shared Playwright browser management
│   │   ├── nih-reporter.js         # NIH RePORTER API crawler
│   │   ├── publication-resolver.js # PubMed publication lookup
│   │   └── index.js                # Crawler registry and runner
│   ├── proposals/
│   │   ├── queue.js                # Proposal creation and storage
│   │   ├── apply.js                # Apply approved proposals to data.js
│   │   ├── schema.js               # Proposal type definitions
│   │   └── cli.js                  # CLI for proposal management
│   ├── submissions/
│   │   ├── writer.js               # Weekly submission file builder
│   │   └── github-push.js          # Push submissions to GitHub
│   ├── triage/
│   │   ├── mrd-triage.js           # AI triage (Claude Sonnet)
│   │   ├── mrd-classifier.js       # Discovery classification
│   │   └── mrd-prefilter.js        # Noise filtering
│   ├── email/
│   │   └── weekly-summary.js       # Resend email with weekly digest
│   └── utils/
│       ├── hash-store.js           # SQLite-based content hash tracking (change detection)
│       ├── artifact-store.js       # Downloaded document storage
│       ├── http.js                 # Rate-limited HTTP client
│       └── logger.js               # Winston logging
├── data/
│   └── artifacts/                  # Downloaded payer policy PDFs/HTMLs
├── Dockerfile                      # Railway deployment (Node 20 + Playwright Chromium)
├── railway.daemon.json             # Railway service config
└── DAEMON.md                       # Full architecture documentation (489 lines)
```

### Crawlers Detail

**CMS Crawler** (`src/crawlers/cms.js`)
- Hits `api.coverage.cms.gov` REST API
- Searches for LCDs/NCDs mentioning liquid biopsy, ctDNA, MRD terms
- Key MolDX LCDs tracked: L38779, L38822, L38835, L38816
- No browser needed — pure HTTP
- **Replacement:** `/schedule` Task 1 (weekly) uses CMS MCP or direct API calls

**Vendor Crawler** (`config.js` has all 37 vendor URLs)
- Playwright-based — visits vendor websites, extracts FDA status, PAP programs, pricing
- RSS fallback for vendors that block scrapers (Adaptive Biotechnologies, Veracyte)
- 20 vendors crawled successfully; Anthem HTTP2 block unresolved
- **Replacement:** `/schedule` Task 1 (weekly) uses web search for vendor press releases

**Payer Crawler** (`src/crawlers/payers.js` + `src/crawlers/discovery.js`)
- Playwright-based — renders JS-heavy payer policy portals
- Hash-based change detection via SQLite (`src/utils/hash-store.js`)
- Monitors 16 commercial payers: Aetna, Anthem, BCBS, Cigna, UHC, Humana, etc.
- Downloads and stores policy PDFs/HTMLs in `data/artifacts/`
- **Replacement:** `/schedule` Task 2 (monthly) uses web search for policy page changes

**NIH Crawler** (`src/crawlers/nih-reporter.js`)
- Hits NIH RePORTER API for grant funding data
- Marginal value — data rarely applied, no end user saw it
- **Replacement:** None. Not worth monitoring.

### Cron Schedules (original)

```
Sunday 10:00 PM PT — Discovery crawl
Sunday 11:00 PM PT — CMS, Vendor, NIH crawlers
Sunday 11:30 PM PT — Payer crawler
Monday 12:30 AM PT — Weekly aggregation + email + GitHub push
```

### Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.52.0",
  "axios": "^1.6.0",
  "axios-retry": "^4.0.0",
  "better-sqlite3": "^12.6.2",
  "dotenv": "^16.3.1",
  "node-cron": "^3.0.3",
  "openai": "^4.0.0",
  "pdf-parse": "^1.1.1",
  "pg": "^8.18.0",
  "playwright": "^1.57.0",
  "resend": "^2.1.0",
  "winston": "^3.11.0"
}
```

### Environment Variables

```bash
# Required
RESEND_API_KEY=re_...          # Email delivery (Resend)
DIGEST_RECIPIENT_EMAIL=...     # Where weekly summaries go
DIGEST_FROM_EMAIL=daemon@openonco.org
ANTHROPIC_API_KEY=sk-ant-...   # Claude AI for triage/analysis

# Optional
CRAWLER_CMS_ENABLED=true
CRAWLER_PAYERS_ENABLED=true
CRAWLER_VENDORS_ENABLED=true
RATE_LIMIT_CMS=5               # Requests per second
RATE_LIMIT_PAYERS=0.2
RATE_LIMIT_VENDORS=3
LOG_LEVEL=info
```

### To Reconstruct

```bash
# 1. Clone the standalone repo (if still exists)
git clone git@github.com:OpenOnco/test-data-tracker.git
cd test-data-tracker

# OR extract from V0 history:
cd /path/to/V0
git checkout c4f964a~1 -- test-data-tracker/
cd test-data-tracker

# 2. Install dependencies
npm install
npx playwright install chromium

# 3. Set env vars (see .env.example)
cp .env.example .env
# Fill in RESEND_API_KEY, ANTHROPIC_API_KEY

# 4. Run locally
npm start          # starts health server + scheduler
npm run run:crawl  # run all crawlers immediately

# 5. Deploy to Railway
railway login
railway init
railway up
```

---

## Physician-System

### Architecture

```
physician-system/
├── src/
│   ├── index.js                    # Entry point (health server + scheduler)
│   ├── config.js                   # Config with all cron schedules
│   ├── scheduler.js                # 11 scheduled jobs with distributed locking
│   ├── health.js                   # Health check endpoint
│   ├── crawlers/
│   │   ├── pubmed.js               # PubMed NCBI E-utilities crawler
│   │   ├── pubmed-queries.js       # Search queries per test/topic
│   │   ├── clinicaltrials.js       # ClinicalTrials.gov API crawler
│   │   ├── fda.js                  # FDA.gov scraper (510k, PMA, breakthroughs)
│   │   ├── cms.js                  # CMS LCD ingestion into guidance DB
│   │   ├── society-monitor.js      # RSS feeds from oncology societies
│   │   ├── version-watcher.js      # ETag/hash change detection on source docs
│   │   ├── guideline-watcher.js    # Filesystem watch on local NCCN PDFs
│   │   ├── seed-ingest.js          # Initial data import from data.js
│   │   ├── vendor-ingest.js        # Import vendor test metadata
│   │   └── processors/
│   │       ├── nccn.js             # NCCN guideline PDF parser
│   │       ├── payer.js            # Payer policy document parser
│   │       └── society.js          # Society guideline parser
│   ├── db/
│   │   ├── client.js               # Postgres (pg) connection
│   │   ├── migrate.js              # Migration runner
│   │   ├── migrations/             # 14 SQL migrations (001–014)
│   │   └── seed-sources.js         # Seed data for source registry
│   ├── embeddings/
│   │   ├── mrd-embedder.js         # OpenAI ada-002 embedding generation
│   │   ├── cross-link.js           # Link trials ↔ guidance items
│   │   └── duplicate-check.js      # Deduplication via cosine similarity
│   ├── faq/
│   │   ├── generator.js            # Reads DB → generates physicianFAQ.js
│   │   ├── prompts.js              # Claude prompts for FAQ generation
│   │   └── diff.js                 # Diff old vs new FAQs
│   ├── triage/
│   │   ├── mrd-triage.js           # AI triage (Claude Sonnet)
│   │   ├── mrd-classifier.js       # Discovery classification
│   │   └── mrd-prefilter.js        # Noise filtering
│   └── utils/
│       ├── job-lock.js             # Distributed locking via Postgres
│       ├── http.js                 # Rate-limited HTTP client
│       └── logger.js               # Winston logging
├── data/
│   └── guidelines/nccn/            # Local NCCN PDF files for parsing
├── eval/                           # Evaluation framework
├── Dockerfile
└── railway.json
```

### Crawlers Detail

**PubMed** (`src/crawlers/pubmed.js`)
- NCBI E-utilities API (eutils.ncbi.nlm.nih.gov)
- Searches for new papers on each MRD/ctDNA test by name
- Stores results in `mrd_guidance_items` table
- NCBI_API_KEY increases rate limit (optional)
- **Replacement:** `/schedule` Task 2 (monthly)

**ClinicalTrials** (`src/crawlers/clinicaltrials.js`)
- ClinicalTrials.gov v2 API
- Searches for new/updated MRD-related trials
- Stores in `mrd_clinical_trials` table, syncs to guidance items
- **Replacement:** `/schedule` Task 2 (monthly)

**FDA** (`src/crawlers/fda.js`)
- Scrapes FDA.gov for 510(k), PMA, breakthrough designations
- Adds to `discovery_queue` for AI triage
- **Replacement:** `/schedule` Task 2 (monthly)

**CMS LCD Ingest** (`src/crawlers/cms.js`)
- Pulls MolDX LCD coverage criteria into guidance DB
- Different from test-data-tracker's CMS crawler (this one feeds the RAG DB)
- **Replacement:** `/schedule` Task 1 (weekly) covers the same ground

**Society Monitor** (`src/crawlers/society-monitor.js`)
- RSS feeds from ASCO, ESMO, SITC, CAP
- Minimal value — rarely produced actionable results
- **Replacement:** None needed

**Version Watcher** (`src/crawlers/version-watcher.js`)
- ETag/hash change detection on source documents
- Weekly Monday noon check
- **Replacement:** `/schedule` Task 1 (weekly) web searches for new NCCN guideline versions

**Guideline Watcher** (`src/crawlers/guideline-watcher.js`)
- Filesystem watch on `data/guidelines/nccn/` directory
- Fires NCCN processor when new PDF is placed there
- **Replacement:** `/schedule` Task 1 flags new versions; Alex downloads and reviews manually

**FAQ Generator** (`src/faq/generator.js`)
- Reads all crawled evidence from Postgres
- Uses Claude to generate patient-facing FAQ answers
- Writes `physicianFAQ.js` and commits to V0 repo
- **Replacement:** `/schedule` Task 3 (monthly) — generates FAQs directly without DB

### Cron Schedules (original)

```
1st of month, 5:00 AM PT  — CMS LCD ingest
1st of month, 6:00 AM PT  — PubMed crawler
1st of month, 7:00 AM PT  — FDA crawler
1st of month, 8:00 AM PT  — ClinicalTrials crawler
1st of month, 9:00 AM PT  — Society monitor (RSS)
1st of month, 12:00 PM PT — Embedding generation + guideline scan
1st of month, 1:00 PM PT  — Cross-linking (trials ↔ guidance)
2nd of month, 10:00 AM PT — FAQ refresh (after all evidence embedded)
Weekly Monday, 12:00 PM PT — Version watcher (source doc changes)
```

### Dependencies

```json
{
  "@anthropic-ai/sdk": "^0.52.0",
  "axios": "^1.6.0",
  "axios-retry": "^4.0.0",
  "cheerio": "^1.2.0",
  "csv-parse": "^6.1.0",
  "dotenv": "^16.3.1",
  "node-cron": "^4.2.1",
  "openai": "^4.0.0",
  "pdf-parse": "^1.1.1",
  "pg": "^8.18.0",
  "resend": "^6.9.1",
  "winston": "^3.11.0"
}
```

### Environment Variables

```bash
# Required
MRD_DATABASE_URL=postgresql://user:password@host:port/database
OPENAI_API_KEY=sk-...          # For ada-002 embeddings
ANTHROPIC_API_KEY=sk-ant-...   # For Claude triage and FAQ generation

# Optional
NCBI_API_KEY=...               # Increases PubMed rate limit
PORT=3000
LOG_LEVEL=info
```

### To Reconstruct

```bash
# 1. Clone the standalone repo (if still exists)
git clone git@github.com:OpenOnco/physician-system.git
cd physician-system

# OR extract from V0 history:
cd /path/to/V0
git checkout c4f964a~1 -- physician-system/
cd physician-system

# 2. Install dependencies
npm install

# 3. Reconstruct the Supabase database
#    The 14 migrations are in src/db/migrations/ (001–014)
#    Create a new Supabase project, get the connection string, then:
npm run db:migrate

# 4. Seed initial data
node src/db/seed-sources.js
node src/crawlers/seed-ingest.js   # imports from data.js

# 5. Set env vars
cp .env.example .env
# Fill in MRD_DATABASE_URL, OPENAI_API_KEY, ANTHROPIC_API_KEY

# 6. Run locally
npm start

# 7. Deploy to Railway
railway login
railway init
railway up
```

---

## Supabase Database Schema

The physician-system Postgres database had 14 tables created by sequential migrations. Key tables:

| Table | Purpose | Migration |
|-------|---------|-----------|
| `mrd_guidance_items` | Evidence items from PubMed, FDA, CMS, guidelines | 001 |
| `mrd_clinical_trials` | ClinicalTrials.gov trial data | 002 |
| `mrd_discovery_queue` | Raw discoveries awaiting AI triage | 003 |
| `mrd_embeddings` | OpenAI ada-002 vectors for RAG search | 004 |
| `mrd_crawler_runs` | Crawler execution history and health | 005 |
| `mrd_trial_publications` | Trial ↔ publication links | 006 |
| `mrd_artifacts` | Downloaded guideline documents | 007 |
| `mrd_quote_anchors` | Citation anchor points | 008 |
| `mrd_sources` | Source document registry | 011 |
| `source_item_edges` | Source ↔ item relationship graph | 012 |
| `interpretation_guardrail` | Evidence interpretation rules R0–R3 | 013 |

All migrations are in `physician-system/src/db/migrations/` and can be re-run in order.

---

## Current Replacement: Claude Code /schedule Tasks

Three scheduled tasks replaced all 15 crawlers as of March 2026:

| # | Task | Schedule | Replaces |
|---|------|----------|----------|
| 1 | Weekly Data Monitor | Monday 9 AM PT | CMS crawler, vendor crawler, CMS LCD ingest, NCCN version watcher |
| 2 | Monthly Data Scan | 1st of month 8 AM PT | PubMed, FDA, ClinicalTrials, payer, society, version watcher |
| 3 | Monthly FAQ Refresh | 1st of month 10 AM PT | FAQ generator (entire physician-system pipeline) |

### How they work

- Tasks run on Anthropic's cloud infrastructure (not your Mac)
- Each task clones the V0 repo, uses web search / public APIs / MCP tools to find updates
- If changes found: creates branch `auto/{task-name}-YYYY-MM-DD`, commits edits to `src/data.js` or `src/physicianFAQ.js`, pushes, creates PR
- If no changes: does nothing
- You review PRs and merge — same human-in-the-loop principle as the old proposal queue

### Trigger IDs (for management in Claude Code)

Run `/schedule` in Claude Code to list, edit, pause, or delete these tasks.
The task prompts are documented in `SCHEDULE_TASK_SPECS.md` in this repo.

---

## Decision Framework: When to Reconstruct

**Reconstruct test-data-tracker if:**
- `/schedule` tasks consistently miss payer policy changes that require Playwright rendering
- You need hash-based change detection (detecting subtle edits, not just new pages)
- Volume of changes exceeds what a weekly Claude Code session can process

**Reconstruct physician-system if:**
- You restart the physician chat / MRD Evidence Navigator
- You need vector embeddings for semantic search over evidence
- FAQ generation needs to reference the full evidence graph (not just recent publications)

**Don't reconstruct if:**
- `/schedule` is finding updates reliably (check PR history on `auto/*` branches)
- Data.js is staying current through manual updates + `/schedule`
- Patient FAQs are being refreshed monthly

---

## Known Issues at Time of Shutdown

- Anthem payer crawler never worked (HTTP2 block, unresolved)
- test-data-tracker had a `testId` mapping catch-all bug (defaulting to `mrd-1` for unmatched discoveries)
- Railway deployment drift was recurring — deployed commit sometimes lagged behind `main`
- Supabase free tier required keepalive workaround (REST API ping every 3 days)
- Physician chat was already dead — all 11 crawlers were feeding a product nobody used
