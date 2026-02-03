# Publication Index Crawler

Extracts publication citations from vendor evidence pages and society sources, resolves them to PubMed, and writes to the physician-system database.

## What it does

1. Reads crawl targets from `mrd_sources` table (source_type: vendor, guideline, news, society)
2. Fetches page content using Playwright
3. Uses Claude to extract publication citations with source-type-specific prompts
4. Resolves to PubMed for full metadata (title, abstract, PMID)
5. Writes to `mrd_guidance_items` with provenance tracking via `mrd_source_item_edges`
6. Sets interpretation guardrails for society/news sources

## Usage

```bash
cd publication-index

# Check source status
node src/cli.js status

# Run crawl (all sources)
node src/cli.js crawl

# Run crawl on specific source
node src/cli.js crawl --source=natera_signatera_publications

# Dry run (extract but don't write)
node src/cli.js crawl --dry-run

# Run with email notification
npm run crawl:notify
```

## Deployment

### Option 1: Via test-data-tracker (Recommended)

The publication-index crawler is integrated into test-data-tracker's scheduler and runs automatically on **Sunday 9 PM** (before other crawlers).

No additional deployment needed - it runs as part of the existing test-data-tracker Railway service.

### Option 2: Standalone (Advanced)

Can run as a standalone service, but requires:
- Access to test-data-tracker modules (monorepo setup)
- Same environment variables as test-data-tracker

```bash
npm start  # Starts scheduler + health check server on port 3002
```

## Environment Variables

Uses the same `.env` as test-data-tracker:
- `MRD_DATABASE_URL` - PostgreSQL connection string
- `ANTHROPIC_API_KEY` - For Claude extraction
- `RESEND_API_KEY` - For email notifications
- `ALERT_EMAIL` - Email recipient for notifications
- `PUBINDEX_SCHEDULE` - Cron schedule (default: `0 21 * * 0` = Sunday 9 PM)

## Cron Schedule

Default: **Sunday 9 PM PT** (`0 21 * * 0`)

Runs before test-data-tracker crawlers (10-11 PM) so new publications are indexed before coverage crawls.
