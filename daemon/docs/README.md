# OpenOnco Intelligence Daemon

A Node.js background service that automatically monitors external data sources for oncology diagnostic testing intelligence. All discoveries are queued for human review before any action is taken.

## What It Does

The daemon runs scheduled crawlers to gather intelligence from five sources:

| Source | Schedule | What It Monitors |
|--------|----------|------------------|
| **PubMed** | Daily 6:00 AM | Scientific publications on ctDNA, MRD, liquid biopsy |
| **CMS** | Weekly Sunday | Medicare coverage determinations and policy updates |
| **FDA** | Weekly Monday | 510(k) clearances and PMA approvals |
| **Vendor** | Weekly Tuesday | Test manufacturer website changes |
| **Preprints** | Weekly Wednesday | medRxiv/bioRxiv pre-publication research |

A **daily digest email** is sent at 10:00 AM summarizing new discoveries and crawler health status.

### Core Principles

- **Human-in-the-loop**: All discoveries are queued for manual review
- **Graceful degradation**: Individual crawler failures don't crash the system
- **Rate limiting**: Respectful crawling with configurable delays per source
- **Comprehensive logging**: Structured JSON logs for monitoring and debugging

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers (for vendor crawler)
npx playwright install chromium

# Create environment file
cp .env.example .env
# Edit .env with your RESEND_API_KEY and email settings

# Run in development mode (with auto-reload)
npm run dev

# Run in production
npm start

# Run all crawlers immediately (manual trigger)
node run-now.js

# Run tests
npm test
```

### Required Environment Variables

```bash
RESEND_API_KEY=re_your_api_key_here
DIGEST_RECIPIENT_EMAIL=team@example.com
```

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, data flow, and component details |
| [CRAWLERS.md](./CRAWLERS.md) | Individual crawler documentation, APIs, and search strategies |
| [CONFIGURATION.md](./CONFIGURATION.md) | Environment variables and settings |
| [OPERATIONS.md](./OPERATIONS.md) | Deployment, monitoring, troubleshooting, Mac launchd setup |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local setup, testing, and adding new crawlers |

## Current Deployment

| Setting | Value |
|---------|-------|
| **Platform** | [Railway](https://railway.app) |
| **Project URL** | https://railway.app/project/openonco-daemon |
| **Service Name** | `openonco-daemon` |
| **Builder** | Nixpacks |
| **Restart Policy** | On failure (max 10 retries) |

### Deployment Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Deploy
railway up

# View logs
railway logs --tail
```

## Project Structure

```
daemon/
├── src/
│   ├── index.js          # Main entry point
│   ├── config.js         # Configuration & monitored tests
│   ├── scheduler.js      # Cron job orchestration
│   ├── health.js         # Health tracking
│   ├── crawlers/         # Crawler implementations
│   ├── queue/            # Discovery queue management
│   ├── email/            # Resend email service
│   └── utils/            # Logger and HTTP client
├── data/                 # Runtime data (discoveries, health)
├── logs/                 # Daily rotating logs
├── docs/                 # Documentation
├── tests/                # Vitest test files
├── railway.json          # Railway deployment config
└── package.json
```

## License

Proprietary - OpenOnco
