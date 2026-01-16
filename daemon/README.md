# OpenOnco Intelligence Daemon

Background daemon for automated intelligence gathering. Monitors external sources for updates relevant to OpenOnco's coverage intelligence platform.

## Overview

The daemon runs on a schedule, crawling various sources for updates:

| Source | Schedule | Description |
|--------|----------|-------------|
| PubMed | Daily 6:00 AM | Scientific publications on ctDNA, MRD, liquid biopsy |
| CMS | Weekly Sunday 7:00 AM | Medicare coverage determinations and policy updates |
| FDA | Weekly Sunday 8:00 AM | Drug approvals, device clearances, guidance |
| Vendor | Weekly Sunday 9:00 AM | Test manufacturer website updates |

A **daily digest email** is sent at 10:00 AM with:
- New discoveries grouped by source
- Crawler health status
- Recent errors

## Key Principles

1. **Human-in-the-loop**: All discoveries go to a queue file for review. Nothing is auto-updated in the main database.
2. **Graceful degradation**: Individual crawler failures don't crash the daemon.
3. **Rate limiting**: Built-in rate limiting per source to be respectful of external APIs.
4. **Comprehensive logging**: Structured JSON logs for debugging and monitoring.

## Project Structure

```
daemon/
├── package.json              # Dependencies and scripts
├── railway.json              # Railway deployment config
├── .env.example              # Environment template
├── data/                     # Runtime data (auto-created)
│   ├── queue.json            # Discovery queue
│   └── health.json           # Health tracking
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
    │   └── vendor.js         # Vendor crawler (stub)
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

### Running Locally

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

### Testing

```bash
# Send a test email
npm run test:email

# Run all crawlers once
npm run test:crawlers

# Check queue status
npm run queue:status
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

## Monitoring

- Logs are structured JSON for easy parsing
- Health data persists to `data/health.json`
- Status logged hourly
- Errors are captured and included in digests

## License

Proprietary - OpenOnco
