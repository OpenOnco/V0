# OpenOnco Intelligence Daemon - Architecture

A background service that crawls external sources (PubMed, CMS, FDA, vendor websites, preprints) for oncology-related intelligence relevant to liquid biopsy and ctDNA diagnostic tests.

**Key Philosophy**: Human-in-the-loop—all discoveries must be reviewed before any database updates.

---

## Components

### Core Modules

| Module | File | Purpose |
|--------|------|---------|
| **Entry Point** | `src/index.js` | Daemon startup, signal handling, graceful shutdown |
| **Configuration** | `src/config.js` | Environment variables, cron schedules, monitored tests/vendors |
| **Scheduler** | `src/scheduler.js` | Node-cron job management, manual triggers |
| **Health** | `src/health.js` | Per-crawler status tracking, error history, uptime |

### Crawlers

All crawlers extend `BaseCrawler` (`src/crawlers/base.js`) which provides:
- Standardized `run()` method with error handling
- Rate-limited HTTP client integration
- Health tracking on success/failure
- Concurrency protection (prevents duplicate runs)

| Crawler | File | Source | Method |
|---------|------|--------|--------|
| **PubMed** | `pubmed.js` | NCBI E-utilities API | REST API (esearch → esummary) |
| **Preprints** | `preprints.js` | medRxiv/bioRxiv | REST API with pagination |
| **CMS** | `cms.js` | CMS Coverage Database | REST API (LCDs/NCDs) |
| **FDA** | `fda.js` | openFDA | REST API (510k/PMA) |
| **Vendor** | `vendor.js` | Manufacturer websites | Playwright (change detection via SHA256) |

### Supporting Modules

| Module | Path | Purpose |
|--------|------|---------|
| **Queue** | `src/queue/` | Discovery storage and management |
| **Email** | `src/email/` | Daily digest via Resend API |
| **HTTP Client** | `src/utils/http.js` | Axios with rate limiting, retries |
| **Logger** | `src/utils/logger.js` | Winston with daily rotation |

---

## Data Flow

```
┌─────────────────┐
│  Cron Schedule  │
└────────┬────────┘
         ▼
┌─────────────────┐
│    Scheduler    │
└────────┬────────┘
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Crawler.run()  │────▶│  External API    │
└────────┬────────┘     └──────────────────┘
         ▼
┌─────────────────┐
│  Relevance      │
│  Filtering      │
└────────┬────────┘
         ▼
┌─────────────────┐
│  Deduplication  │
└────────┬────────┘
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Queue.add()    │────▶│  discoveries.json│
└────────┬────────┘     └──────────────────┘
         ▼
┌─────────────────┐
│  Health Update  │
└─────────────────┘
```

### Daily Digest Flow

```
10:00 AM Trigger → Gather health + queue data → Generate HTML/text → Resend API → Record sent
```

---

## File Structure

```
daemon/
├── src/
│   ├── index.js              # Entry point
│   ├── config.js             # Configuration
│   ├── scheduler.js          # Cron management
│   ├── health.js             # Health tracking
│   │
│   ├── crawlers/
│   │   ├── index.js          # Registry & factory
│   │   ├── base.js           # Base class
│   │   ├── pubmed.js         # PubMed NCBI
│   │   ├── preprints.js      # medRxiv/bioRxiv
│   │   ├── cms.js            # CMS Coverage
│   │   ├── fda.js            # openFDA
│   │   └── vendor.js         # Playwright scraping
│   │
│   ├── queue/
│   │   ├── index.js          # Queue logic
│   │   └── store.js          # File persistence
│   │
│   ├── email/
│   │   ├── index.js          # Resend service
│   │   └── templates.js      # Digest templates
│   │
│   └── utils/
│       ├── http.js           # HTTP client
│       └── logger.js         # Logging
│
├── data/                      # Runtime (auto-created)
│   ├── discoveries.json      # Discovery queue
│   ├── health.json           # Crawler health
│   └── vendor-hashes.json    # Change detection
│
├── logs/                      # Rotated logs
│   ├── daemon-YYYY-MM-DD.log
│   └── daemon-error-YYYY-MM-DD.log
│
├── package.json
└── railway.json              # Deployment config
```

---

## Scheduled Tasks

| Task | Schedule | Purpose |
|------|----------|---------|
| PubMed | Daily 6:00 AM | Search recent publications |
| CMS | Weekly Sun 6:00 AM | Monitor coverage determinations |
| FDA | Weekly Mon 6:00 AM | Track device approvals |
| Vendor | Weekly Tue 6:00 AM | Monitor manufacturer sites |
| Preprints | Weekly Wed 6:00 AM | Search preprint servers |
| Digest | Daily 10:00 AM | Email summary |
| Cleanup | Daily Midnight | Remove items >30 days old |

---

## Discovery Schema

```json
{
  "id": "pubmed-1705312800000-abc123",
  "source": "pubmed|cms|fda|vendor|preprints",
  "type": "publication|preprint|policy_update|fda_approval|vendor_update",
  "title": "string",
  "summary": "string",
  "url": "string",
  "relevance": "high|medium|low",
  "metadata": {},
  "discoveredAt": "ISO8601",
  "status": "pending|reviewed"
}
```

---

## External Integrations

| Service | Purpose | Rate Limit |
|---------|---------|------------|
| PubMed (NCBI) | Publications | 10/min (with API key) |
| CMS Coverage API | Policy updates | 5/min |
| openFDA | Device approvals | 5/min |
| bioRxiv/medRxiv | Preprints | 5/min |
| Resend | Email delivery | API-based |
| Vendor Sites | Product updates | 3/min (Playwright) |

---

## Key Design Patterns

- **Singleton Crawlers**: Each crawler is a single instance managed by registry
- **File-Based Persistence**: JSON files with atomic writes (temp + rename)
- **Token Bucket Rate Limiting**: Per-source, configurable via env vars
- **Deduplication**: Source + URL combination prevents duplicates
- **Graceful Degradation**: Individual crawler failures don't affect others
- **Exponential Backoff**: Automatic retries (1s, 2s, 4s) on transient failures

---

## Error Handling

- Automatic retries on network errors and 5xx/429 responses
- Errors tracked in `health.json` (max 100 entries)
- Recent errors included in daily digest
- SIGTERM/SIGINT handlers for graceful shutdown
