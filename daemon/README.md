# OpenOnco Intelligence Daemon

Background daemon for automated intelligence gathering. Monitors external sources for updates relevant to OpenOnco's coverage intelligence platform.

## Overview

The daemon runs on a schedule, crawling various sources for updates:

| Source | Schedule | Description |
|--------|----------|-------------|
| PubMed | Daily 6:00 AM | Scientific publications on ctDNA, MRD, liquid biopsy |
| CMS | Weekly Sunday 6:00 AM | Medicare coverage determinations and policy updates |
| FDA | Weekly Monday 6:00 AM | Drug approvals, device clearances, guidance |
| Vendor | Weekly Tuesday 6:00 AM | Test manufacturer website updates |
| Preprints | Weekly Wednesday 6:00 AM | medRxiv/bioRxiv preprints on oncology diagnostics |
| Citations | Weekly Thursday 6:00 AM | Database citation validation (missing/broken URLs) |
| Payers | Weekly Friday 6:00 AM | Private payer coverage policies (UHC, Aetna, Cigna, etc.) |

A **daily digest email** is sent at 10:00 AM with:
- New discoveries grouped by source
- Crawler health status
- Recent errors
- **Structured XML for AI triage** (see workflow below)

## Key Principles

1. **Human-in-the-loop**: All discoveries go to a queue file for review. Nothing is auto-updated in the main database.
2. **Graceful degradation**: Individual crawler failures don't crash the daemon.
3. **Rate limiting**: Built-in rate limiting per source to be respectful of external APIs.
4. **Comprehensive logging**: Structured JSON logs for debugging and monitoring.
5. **AI-assisted triage**: Weekly emails include structured XML for Claude-based triage workflow.

## Crawlers

### Citations Validator (`citations`)

Validates the test database for citation completeness and URL accessibility.

**What it does:**
- Scans all tests in `src/data.js` for performance fields (sensitivity, specificity, PPV, NPV, LOD)
- Flags fields that have values but no supporting citation
- Checks all citation URLs for accessibility (broken links, redirects)
- Special handling for PubMed IDs via NCBI E-utilities API
- Special handling for DOIs via doi.org resolution

**Discovery types:**
- `missing_citation` - Performance field has value but no citation URL
- `broken_citation` - Citation URL returns error or has moved

**Schedule:** Weekly Thursday 6:00 AM

### Private Payers (`payers`)

Monitors major private insurers for coverage policy updates related to ctDNA/liquid biopsy testing.

**What it does:**
- Uses Playwright to crawl JS-heavy payer policy pages
- Monitors UnitedHealthcare, Aetna, Cigna, Anthem (CA), and Humana
- Hash-based change detection to identify updated policies
- Searches for keywords: ctDNA, liquid biopsy, MRD, molecular residual disease, etc.
- Matches policy changes against monitored test names

**Discovery types:**
- `payer_policy_new` - New policy published
- `payer_policy_update` - Existing policy updated

**Schedule:** Weekly Friday 6:00 AM

## AI Triage Workflow

The daemon supports an AI-assisted triage workflow for processing discoveries.

### How it works

1. **Weekly email arrives** with structured XML embedded at the bottom
2. **Copy the XML section** from the email (starts with `<openonco_triage_request>`)
3. **Paste into Claude** along with the triage instructions included in the email
4. **Claude analyzes** and produces a prioritized action list:
   - HIGH PRIORITY: Items requiring immediate database updates
   - MEDIUM PRIORITY: Items requiring review before update
   - LOW PRIORITY: Items for monitoring/future reference
   - IGNORE: Items not relevant to OpenOnco database
5. **Execute approved actions** using OpenOnco skills or manual edits

### XML Structure

The triage XML includes:

```xml
<openonco_triage_request week="2024-01-15">
  <citation_audit>
    <missing count="5">...</missing>
    <broken count="2">...</broken>
  </citation_audit>
  <vendor_changes count="3">...</vendor_changes>
  <payer_updates count="1">...</payer_updates>
  <pubmed_papers count="10">...</pubmed_papers>
  <cms_updates count="0">...</cms_updates>
  <fda_updates count="1">...</fda_updates>
  <preprints count="4">...</preprints>
</openonco_triage_request>
```

### Triage Actions by Type

| Source | Claude Actions |
|--------|----------------|
| Missing Citations | Search PubMed/Scholar for sources, suggest citation URLs |
| Broken Citations | Find replacement URLs, flag for removal if unfixable |
| Vendor Changes | Classify change type, extract performance metrics |
| Payer Updates | Match to tests, summarize coverage change, extract criteria |
| PubMed/Preprints | Extract metrics, identify affected tests, flag updates |
| CMS Updates | Match LCD/NCD to tests, summarize coverage impact |
| FDA Updates | Identify test, note new indications/labels |

## Project Structure

```
daemon/
├── package.json              # Dependencies and scripts
├── railway.json              # Railway deployment config
├── .env.example              # Environment template
├── run-test-email.js         # Test script for previewing/sending digest emails
├── run-now.js                # Manual script to run all crawlers immediately
├── data/                     # Runtime data (auto-created)
│   ├── queue.json            # Discovery queue
│   ├── health.json           # Health tracking
│   └── payer-hashes.json     # Payer page content hashes for change detection
└── src/
    ├── index.js              # Main entry point
    ├── config.js             # Configuration
    ├── scheduler.js          # Cron job management
    ├── health.js             # Health tracking
    ├── queue/
    │   ├── index.js          # Queue operations
    │   └── store.js          # File-based storage
    ├── crawlers/
    │   ├── index.js          # Crawler registry
    │   ├── base.js           # Base crawler class
    │   ├── pubmed.js         # PubMed crawler (stub)
    │   ├── cms.js            # CMS crawler (stub)
    │   ├── fda.js            # FDA crawler (stub)
    │   ├── vendor.js         # Vendor crawler (stub)
    │   ├── preprints.js      # medRxiv/bioRxiv preprints crawler
    │   ├── citations.js      # Database citation validator
    │   └── payers.js         # Private payer coverage crawler
    ├── email/
    │   ├── index.js          # Resend email service
    │   └── templates.js      # Digest templates
    └── utils/
        ├── logger.js         # Structured logging
        └── http.js           # Rate-limited HTTP client
```

## Setup

### Prerequisites

- Node.js 20+
- Resend API key for email

### Installation

```bash
cd daemon
npm install
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `RESEND_API_KEY` - Your Resend API key
- `DIGEST_RECIPIENT_EMAIL` - Where to send daily digests
- `DIGEST_FROM_EMAIL` - Sender email (must be verified in Resend)

Optional variables:
- `LOG_LEVEL` - debug, info, warn, error (default: info)
- `SCHEDULE_*` - Override default cron schedules
- `CRAWLER_*_ENABLED` - Enable/disable specific crawlers
- `RATE_LIMIT_*` - Requests per minute per source

Preprints crawler variables:
- `CRAWLER_PREPRINTS_ENABLED` - Enable/disable preprints crawler (default: true)
- `SCHEDULE_PREPRINTS` - Cron schedule (default: `0 6 * * 3` - Wednesday 6:00 AM)
- `RATE_LIMIT_PREPRINTS` - Requests per minute (default: 5)

Citations crawler variables:
- `CRAWLER_CITATIONS_ENABLED` - Enable/disable citations crawler (default: true)
- `SCHEDULE_CITATIONS` - Cron schedule (default: `0 6 * * 4` - Thursday 6:00 AM)
- `RATE_LIMIT_CITATIONS` - Requests per minute (default: 2)

Payers crawler variables:
- `CRAWLER_PAYERS_ENABLED` - Enable/disable payers crawler (default: true)
- `SCHEDULE_PAYERS` - Cron schedule (default: `0 6 * * 5` - Friday 6:00 AM)
- `RATE_LIMIT_PAYERS` - Requests per minute (default: 2)

### Running Locally

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

### Testing

```bash
# Preview digest email in console (includes AI triage XML)
node run-test-email.js

# Actually send a test digest email
node run-test-email.js --send

# Run all crawlers once (outputs discoveries to console)
node run-now.js

# Check queue status
npm run queue:status
```

**Test email script (`run-test-email.js`):**
- Fetches current health summary and discoveries
- Generates the full digest HTML including AI triage XML
- Preview mode (default): prints HTML to console
- Send mode (`--send`): sends actual email via Resend

**Manual crawl script (`run-now.js`):**
- Runs all crawlers immediately (bypasses schedule)
- Outputs discoveries to console
- Useful for testing crawler changes locally

To run a specific crawler individually, use the scheduler's `triggerCrawler` function:

```javascript
// Example: Run only the citations crawler
import { triggerCrawler } from './src/scheduler.js';
await triggerCrawler('citations');

// Example: Run only the payers crawler
await triggerCrawler('payers');
```

## Deployment (Railway)

1. Connect this directory as a Railway service
2. Set environment variables in Railway dashboard
3. Deploy

The `railway.json` configures:
- Nixpacks builder
- Auto-restart on failure
- `npm start` as entry point

## Queue File Format

Discoveries are stored in `data/queue.json`:

```json
{
  "version": 1,
  "lastUpdated": "2024-01-15T10:00:00Z",
  "items": [
    {
      "id": "pubmed-1705312800000-abc123",
      "source": "pubmed",
      "type": "publication",
      "title": "ctDNA Detection in Colorectal Cancer...",
      "summary": "Abstract text...",
      "url": "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      "relevance": "high",
      "metadata": {
        "pmid": "12345678",
        "authors": ["Smith J", "Jones K"],
        "journal": "J Clin Oncol"
      },
      "discoveredAt": "2024-01-15T06:00:00Z",
      "status": "pending",
      "reviewedAt": null,
      "reviewedBy": null,
      "notes": null
    }
  ],
  "stats": {
    "totalAdded": 150,
    "totalProcessed": 120,
    "totalDiscarded": 30
  }
}
```

## Implementing Crawlers

The crawlers are currently stubs. To implement one:

1. Open the crawler file (e.g., `src/crawlers/pubmed.js`)
2. Implement the `crawl()` method using `this.http` for rate-limited requests
3. Return an array of discovery objects

Example:

```javascript
async crawl() {
  const discoveries = [];

  // Use rate-limited HTTP client
  const results = await this.http.getJson('https://api.example.com/search');

  for (const item of results) {
    discoveries.push({
      source: SOURCES.PUBMED,
      type: DISCOVERY_TYPES.PUBLICATION,
      title: item.title,
      summary: item.abstract,
      url: item.url,
      relevance: this.calculateRelevance(item),
      metadata: { ... }
    });
  }

  return discoveries;
}
```

## Email Digest Format

The daily digest includes:

1. **Summary stats**: New discoveries, pending review count, health status
2. **Crawler status**: Last successful run per source
3. **New discoveries**: Grouped by source with relevance badges
4. **Recent errors**: If any crawlers failed
5. **AI Triage XML**: Structured XML block for pasting into Claude (see [AI Triage Workflow](#ai-triage-workflow))

## Monitoring

- Logs are structured JSON for easy parsing
- Health data persists to `data/health.json`
- Status logged hourly
- Errors are captured and included in digests

## License

Proprietary - OpenOnco
