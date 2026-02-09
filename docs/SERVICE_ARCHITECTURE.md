# Service Architecture

**Date:** February 6, 2026

This document describes the backend services for OpenOnco.

---

## Overview

OpenOnco has two backend services, each with distinct responsibilities:

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenOnco Frontend                         │
│                      (Vercel - openonco.org)                     │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    ▼                           ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│      test-data-tracker      │   │      physician-system       │
│         (Railway)           │   │         (Railway)           │
│                             │   │                             │
│  • Test database crawling   │   │  • MRD Chat API             │
│  • Vendor monitoring        │   │  • RAG retrieval            │
│  • Payer policy tracking    │   │  • Guidance database        │
│  • CMS coverage updates     │   │  • Clinical trials          │
│  • Proposal generation      │   │  • Literature crawling      │
└─────────────────────────────┘   └─────────────────────────────┘
            │                                   │
            ▼                                   ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│   OpenOnco Test Database    │   │   MRD Guidance Database     │
│      (Supabase/Postgres)    │   │      (Railway Postgres)     │
└─────────────────────────────┘   └─────────────────────────────┘
```

---

## Services

### 1. physician-system

**Purpose:** MRD (Minimal Residual Disease) clinical decision support

**URL:** https://physician-system-production.up.railway.app

**Responsibilities:**
- MRD Chat API (RAG-based Q&A for physicians)
- Guidance database (NCCN, ASCO, ESMO, SITC guidelines)
- Literature crawling (PubMed, FDA, CMS LCD)
- Clinical trials tracking (ClinicalTrials.gov)
- Embedding generation and semantic search
- Citation validation and quote anchoring

**Key Endpoints:**
- `POST /api/mrd-chat` - Chat API for MRD queries
- `GET /health` - Health check with database stats

**Scheduled Jobs (11):**
| Job | Schedule | Description |
|-----|----------|-------------|
| pubmed | Daily 6 AM | Literature crawl |
| fda | Daily 7 AM | FDA RSS feeds |
| clinicaltrials | Daily 8 AM | Trial updates |
| cms | Weekly Sunday | CMS LCD data |
| embed | Daily 10 AM | Generate embeddings |
| monitor | Daily 9 AM | RSS monitoring |
| link | Weekly Sunday | Cross-link trials |
| digest | Weekly Monday | Email digest |
| daily-report | Daily 6 PM | AI daily report |
| version-watch | Daily noon | NCCN version check |
| guideline-scan | Every 4h | PDF folder scan |

**Database Tables:**
- `mrd_guidance_items` - Extracted recommendations
- `mrd_clinical_trials` - Trial tracking
- `mrd_item_embeddings` - Vector embeddings
- `mrd_quote_anchors` - Citation positions
- `mrd_sources` - Source registry
- `mrd_source_releases` - Release tracking
- `mrd_crawler_runs` - Job history

---

### 2. test-data-tracker

**Purpose:** OpenOnco test database maintenance, monitoring, and physician digest

**URL:** https://daemon-production-5ed1.up.railway.app

**Responsibilities:**
- Vendor website monitoring (test availability, pricing)
- Payer policy tracking (coverage changes)
- CMS reimbursement updates
- NIH RePORTER grant tracking (MRD/ctDNA research funding)
- Proposal generation for data updates
- Test database reconciliation
- Physician digest email system (subscribe, curate, send)

**Key Endpoints:**
- `GET /health` — Health check with queue/scheduler status
- `GET /api/queue` — Queue status
- `GET /api/scheduler` — Scheduler status
- `POST /api/digest/subscribe` — Subscribe to physician digest
- `POST /api/digest/confirm` — Confirm subscription
- `GET /api/digest/unsubscribe?token=` — One-click unsubscribe
- `GET /api/digest/preferences?token=` — Get subscriber preferences
- `POST /api/digest/preferences` — Update subscriber preferences

**Scheduled Jobs:**
| Job | Schedule | Description |
|-----|----------|-------------|
| Publication Index | Sunday 9 PM | Publication index crawl |
| Discovery | Sunday 10 PM | Policy discovery |
| CMS | Sunday 11 PM | CMS coverage crawl |
| Vendor | Sunday 11 PM | Vendor website crawl |
| NIH RePORTER | Sunday 11 PM | NIH grant tracking |
| Payers | Sunday 11:30 PM | Payer policy crawl |
| Queue Cleanup | Daily midnight | Remove old discoveries |
| Physician Digest Draft | Monday 5 AM | AI-curated digest draft |
| Physician Digest Send | Monday 10 AM | Auto-send if not reviewed |

**Crawlers:**
- `cms` — CMS reimbursement/coverage updates
- `vendor` — Vendor website changes
- `payers` — Payer policy monitoring
- `nih` — NIH RePORTER API (MRD/ctDNA research grants)
- `discovery` — Automated policy discovery

**Physician Digest Pipeline:**
```
Crawlers (Sun night) → curate.js (aggregate week's findings)
  → generateDraft() → mrd_digest_history (status: draft)
  → Admin preview email → manual approve or auto-send at 10 AM
  → Resend API → all active subscribers
```

**Database:** Connects to main OpenOnco Supabase database
- `mrd_digest_subscribers` — Email subscribers with preferences
- `mrd_digest_history` — Digest drafts and send history

---

## Key Differences

| Aspect | physician-system | test-data-tracker |
|--------|------------------|-------------------|
| **Focus** | MRD clinical guidance | Test database maintenance + digest |
| **Chat API** | Yes (RAG-based) | No |
| **Email digest** | No | Yes (weekly physician digest) |
| **Database** | Railway Postgres (MRD) | Supabase (OpenOnco tests) |
| **Crawl targets** | PubMed, FDA, NCCN, trials | Vendor sites, payer policies, NIH grants |
| **Output** | Chat responses, guidance | Proposals, data updates, digest emails |

---

## Development

### physician-system
```bash
cd physician-system
npm install
npm run dev          # Start with auto-reload
npm run test         # Run tests
node src/cli.js      # CLI commands
```

### test-data-tracker
```bash
cd test-data-tracker
npm install
npm run dev          # Start with auto-reload
node src/cli.js      # CLI commands
```

---

## Deployment

Both services deploy to Railway from the same monorepo:

```bash
# physician-system
cd physician-system
railway up

# test-data-tracker
cd test-data-tracker
railway up
```

Each has its own `railway.json` configuration.

---

## Historical Note

Both services evolved from the original `daemon/` directory. During the February 2026 reorg:
- MRD-specific code moved to `physician-system/`
- Test database code moved to `test-data-tracker/`
- The old `daemon/` directory was deleted

The MRD Chat API exists only in `physician-system/src/chat/server.js`. Any duplicate in `test-data-tracker` should be removed.

---

*Last updated: February 6, 2026*
