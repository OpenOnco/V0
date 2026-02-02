# OpenOnco Intelligence Daemon

Background service that monitors insurance coverage changes for cancer diagnostic tests.

## What It Does

- **3 crawlers** monitor CMS Medicare, private payers, and vendor sites for policy changes
- **Claude AI** analyzes each change to filter noise and extract relevant details  
- **Weekly email** with self-executing attachment for human review
- **Simple storage** — discoveries saved to JSON, no auto-updates to database

> **Human-in-the-loop.** The daemon surfaces coverage changes; a human reviews and approves database updates.

## Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Quick start (this file) |
| [DAEMON.md](DAEMON.md) | Comprehensive architecture, all crawlers |
| [docs/PAYER_CRAWLER.md](docs/PAYER_CRAWLER.md) | Payer crawler deep-dive (v2.1.1) |
| [docs/MRD_SYSTEM_ARCHITECTURE.md](docs/MRD_SYSTEM_ARCHITECTURE.md) | MRD guidance monitor system |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   CRAWLERS (Sunday 11 PM)                   │
├─────────────────────────────────────────────────────────────┤
│  CMS Crawler        Payers Crawler       Vendor Crawler     │
│  Medicare LCDs      16 private payers    20 vendor news     │
│  via keywords       + 6 vendor coverage  pages monitored    │
│                     pages (26 total)                        │
│                                                             │
│  Claude analyzes    Claude filters       Claude detects     │
│  coverage impact    formatting-only      coverage           │
│  + affected tests   changes              announcements      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 data/discoveries.json                       │
│  Policy changes with Claude's analysis stored for review    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               MONDAY DIGEST (1 AM via Resend)               │
│  • Crawler run stats (duration, counts)                     │
│  • Attached coverage-review.md file                         │
│  • Upload to Claude → approve/skip each item                │
└─────────────────────────────────────────────────────────────┘
```

## Schedule

| Time | Job |
|------|-----|
| Sunday 11:00 PM | All 3 crawlers run |
| Monday 1:00 AM | Digest email sent |

## Quick Start

```bash
cd test-data-tracker
npm install
npx playwright install chromium  # Required for payers crawler

cp .env.example .env
# Add RESEND_API_KEY, ANTHROPIC_API_KEY

npm run dev  # Development with auto-reload
```

## Environment Variables

```bash
# Required
RESEND_API_KEY=re_...
ANTHROPIC_API_KEY=sk-ant-...
DIGEST_RECIPIENT_EMAIL=you@example.com

# Optional
LOG_LEVEL=info
NODE_ENV=production
```

## Commands

```bash
npm run dev          # Run with auto-reload
npm start            # Production mode
npm test             # Unit tests

# Manual triggers
node run-now.js                    # Run all crawlers now
node -e "import('./src/email/monday-digest.js').then(m => m.sendMondayDigest())"  # Send digest
```

## Monday Review Workflow

1. Email arrives Monday morning with crawler stats
2. Download attached `coverage-review.md`
3. Upload to Claude and hit send
4. Claude walks through each discovery: approve / skip
5. Approved items get applied via openonco-submission skill

## Deployment

Runs on [Railway](https://railway.app). Auto-deploys from `develop` branch.

## Files

```
test-data-tracker/
├── src/
│   ├── config.js           # Payers, tests, vendors, schedules
│   ├── scheduler.js        # Cron jobs
│   ├── crawlers/
│   │   ├── cms.js          # Medicare coverage (Claude: analyze impact)
│   │   ├── payers.js       # Private insurance (Claude: filter noise)
│   │   └── vendor.js       # Press releases (Claude: detect coverage news)
│   ├── data/
│   │   └── test-dictionary.js  # 24 tests with PLA codes, aliases for deterministic matching
│   ├── utils/
│   │   ├── canonicalize.js # Content normalization before hashing
│   │   └── diff.js         # Line-based diff for Claude analysis
│   ├── email/
│   │   └── monday-digest.js # Weekly email + attachment
│   └── queue/
│       └── store.js        # File-based storage
├── data/
│   ├── discoveries.json    # Pending coverage changes
│   ├── payer-hashes.json   # Change detection baseline + content snapshots
│   └── vendor-hashes.json  # Change detection baseline + content snapshots
└── run-now.js              # Manual crawler trigger
```
