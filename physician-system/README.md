# OpenOnco Physician System

Clinical decision support service for MRD (Molecular Residual Disease) testing in solid tumors.

## Overview

This is a **separate service** from the OpenOnco test data tracker. It provides:

- **Clinical Evidence Aggregation**: PubMed literature, ClinicalTrials.gov, FDA announcements
- **Guideline Monitoring**: NCCN, ASCO, ESMO, SITC guidelines
- **Payer Coverage Tracking**: Medicare MolDX LCDs, commercial payer policies
- **RAG-based Chat**: Physician query interface with cited evidence

## Architecture

```
physician-system/
├── src/
│   ├── index.js           # Main entry point (starts chat server)
│   ├── cli.js             # CLI for running crawlers
│   ├── chat/
│   │   └── server.js      # MRD Chat API server
│   ├── crawlers/
│   │   ├── pubmed.js      # PubMed literature crawler
│   │   ├── clinicaltrials.js  # ClinicalTrials.gov
│   │   ├── fda.js         # FDA announcements
│   │   ├── cms.js         # CMS MolDX LCD ingest
│   │   └── processors/    # PDF/document processors
│   │       ├── nccn.js    # NCCN guideline PDFs
│   │       ├── society.js # ASCO/ESMO/SITC
│   │       └── payer.js   # Payer policy PDFs
│   ├── db/
│   │   ├── client.js      # PostgreSQL client
│   │   ├── migrate.js     # Migration runner
│   │   └── migrations/    # SQL migrations
│   ├── embeddings/        # Vector embeddings
│   ├── triage/            # AI triage pipeline
│   └── utils/             # Shared utilities
└── package.json
```

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run db:migrate

# Start the chat API server
npm start

# Or run crawlers via CLI
npm run crawl pubmed
npm run crawl clinicaltrials --seed
npm run crawl embed
```

## CLI Commands

```bash
# Literature crawlers
node src/cli.js pubmed --mode=incremental
node src/cli.js pubmed --mode=backfill --from=2023-01-01

# Clinical trials
node src/cli.js clinicaltrials
node src/cli.js clinicaltrials --seed  # Seed priority trials

# CMS MolDX LCDs
node src/cli.js cms --list
node src/cli.js cms

# Embeddings
node src/cli.js embed --limit=100

# Run all crawlers
node src/cli.js all

# Start chat server
node src/cli.js serve
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MRD_DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | For embeddings |
| `ANTHROPIC_API_KEY` | Yes | For AI triage and chat |
| `NCBI_API_KEY` | No | Increases PubMed rate limit |
| `PORT` | No | Server port (default: 3000) |

## API Endpoints

### POST /api/mrd-chat

Query the evidence database with natural language.

```json
{
  "query": "What evidence supports MRD testing in stage III colorectal cancer?",
  "filters": {
    "cancerType": "colorectal"
  }
}
```

Response includes:
- `answer`: AI-generated response with citations [1], [2], etc.
- `sources`: Array of cited evidence with URLs
- `relatedItems`: Related uncited evidence
- `disclaimer`: Medical disclaimer

### GET /health

Health check endpoint.

## Deployment

This service runs on Railway, separate from the Test Data Tracker.

```bash
# Railway deployment
railway up
```

## Relationship to Other Services

| Service | Purpose | Deployment |
|---------|---------|------------|
| **OpenOnco Website** | Test database UI | Vercel |
| **Test Data Tracker** | Test DB monitoring (CMS/vendor/payer) | Railway |
| **Physician System** | Clinical decision support (this) | Railway |

These are **three separate services** with distinct purposes:
1. Website shows the test database to users
2. Test Data Tracker monitors for test database updates
3. Physician System provides clinical guidance for MRD testing
