# OpenOnco Intelligence Daemon

**Automated intelligence gathering for the world's most comprehensive cancer diagnostics database.**

The OpenOnco Intelligence Daemon is a background service that continuously monitors the landscape of cancer diagnostics—tracking scientific publications, regulatory changes, and insurance coverage updates across dozens of sources. It transforms the overwhelming flood of industry information into a curated weekly digest, enabling the OpenOnco team to keep the database current without manually monitoring every source.

> **Human-in-the-loop by design.** Every discovery is queued for review. Nothing auto-updates the database. The daemon surfaces intelligence; humans make decisions.

---

## Architecture

```
                              EXTERNAL SOURCES
     ┌─────────────────────────────────────────────────────────────────┐
     │                                                                 │
     │   📚 PubMed        📋 medRxiv/bioRxiv      🏥 FDA/CMS          │
     │   Scientific       Preprint research       Regulatory          │
     │   publications     Early findings          approvals           │
     │                                                                 │
     │   💰 Private Payers                    🏢 Vendor Sites          │
     │   UHC, Aetna, Cigna, BCBS             Natera, Guardant, GRAIL  │
     │   coverage policy changes              product updates          │
     │                                                                 │
     └───────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │                        CRAWLER LAYER                            │
     │                                                                 │
     │   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
     │   │ PubMed  │  │Preprints│  │ Payers  │  │Citations│          │
     │   │  Daily  │  │  Wed    │  │  Fri    │  │  Thu    │          │
     │   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘          │
     │        │            │            │            │                 │
     │   ┌────┴────┐  ┌────┴────┐  ┌────┴────┐                        │
     │   │   CMS   │  │   FDA   │  │ Vendor  │  (stub crawlers)      │
     │   │  Sun    │  │  Mon    │  │  Tue    │                        │
     │   └────┬────┘  └────┬────┘  └────┬────┘                        │
     │        └────────────┴────────────┴──────────────────────────────┤
     │                                                                 │
     │   • Rate-limited requests  • Deduplication  • Relevance scoring │
     └───────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │                     DISCOVERY QUEUE                             │
     │                   data/discoveries.json                         │
     │                                                                 │
     │   Each discovery includes:                                      │
     │   • Source (pubmed, payers, citations, etc.)                   │
     │   • Type (publication, policy_change, missing_citation)        │
     │   • Relevance score (high / medium / low)                      │
     │   • Metadata (PMID, authors, policy URLs, etc.)                │
     │   • Status (pending → reviewed → processed)                    │
     └───────────────────────────┬─────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
     ┌──────────────────────────┐  ┌──────────────────────────┐
     │      AI TRIAGE           │  │    MONDAY DIGEST         │
     │     (Claude API)         │  │      (Resend)            │
     │                          │  │                          │
     │  • Classify priority     │  │  • Crawler health        │
     │  • Extract metrics       │  │  • New discoveries       │
     │  • Generate update cmds  │  │  • Triage XML payload    │
     │  • Cost tracking         │  │  • Action items          │
     └────────────┬─────────────┘  └────────────┬─────────────┘
                  │                              │
                  └──────────────┬───────────────┘
                                 ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │                       HUMAN REVIEW                              │
     │                                                                 │
     │   Reviewer receives Monday digest → Reviews discoveries →      │
     │   Approves/discards items → Updates OpenOnco database          │
     └─────────────────────────────────────────────────────────────────┘
```

---

## Crawlers

The daemon runs 7 specialized crawlers, each targeting a different segment of the cancer diagnostics landscape.

| Crawler | Schedule | Sources | What It Finds | Why It Matters |
|---------|----------|---------|---------------|----------------|
| **PubMed** | Daily 6 AM | NCBI E-utilities | New publications on ctDNA, MRD, liquid biopsy, specific tests | Validation studies, clinical trials, and new evidence to update test performance data |
| **Preprints** | Wed 6 AM | medRxiv, bioRxiv | Pre-publication oncology research | Early access to emerging research before peer review (6-12 month lead time) |
| **Citations** | Thu 6 AM | OpenOnco database | Missing citations, broken URLs, invalid PMIDs | Database quality assurance—ensures every claim has supporting evidence |
| **Payers** | Fri 6 AM | UHC, Aetna, Cigna, BCBS, Humana | Coverage policy changes for molecular oncology tests | Critical for patients—coverage determines test accessibility |
| **CMS** | Sun 6 AM | Medicare LCDs/NCDs | National and local coverage determinations | Medicare coverage often sets the precedent for private payers |
| **FDA** | Mon 6 AM | openFDA | 510(k) clearances, PMA approvals, new indications | Regulatory status affects clinical adoption and reimbursement |
| **Vendor** | Tue 6 AM | Test manufacturer sites | Product updates, new test launches, performance claims | First-party data for database updates |

### Crawler Details

**PubMed Crawler** (`src/crawlers/pubmed.js`)
- Searches 10 specific tests (Signatera, Guardant360, FoundationOne, etc.)
- Searches 6 topic areas (ctDNA detection, MRD monitoring, liquid biopsy)
- Fetches last 7 days, max 20 results per search
- HIGH relevance: test-specific mentions, validation studies, clinical trials
- MEDIUM relevance: ctDNA/liquid biopsy terms, cancer types
- LOW relevance: general oncology content

**Payers Crawler** (`src/crawlers/payers.js`)
- Uses Playwright browser automation (JavaScript-rendered pages)
- Monitors 5 major payers + 6 vendor coverage pages
- SHA256 content hashing for change detection
- Tracks keywords: ctDNA, liquid biopsy, MRD, Signatera, Guardant, etc.

**Citations Crawler** (`src/crawlers/citations.js`)
- Audits 15 citation-required fields (sensitivity, specificity, PPV, NPV, LOD, etc.)
- Validates PubMed URLs via NCBI API
- Follows DOI redirects
- Detects soft 404s on general URLs
- Discovery types: `missing_citation`, `broken_citation`, `invalid_pmid`, `redirect_url`

**Preprints Crawler** (`src/crawlers/preprints.js`)
- bioRxiv REST API for both medRxiv and bioRxiv
- Filters to oncology-related preprints
- Same relevance scoring as PubMed

**Stub Crawlers** (CMS, FDA, Vendor)
- Implemented as placeholders with the full interface
- Ready for activation when API access is configured

---

## AI Triage System

The daemon integrates with Claude API to automatically classify, prioritize, and extract actionable data from discoveries.

### How It Works

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Discovery   │────▶│ Classification│────▶│   Extraction  │────▶│   Commands    │
│               │     │               │     │               │     │               │
│ Raw finding   │     │ HIGH/MED/LOW  │     │ Metrics, data │     │ data.js       │
│ from crawler  │     │ + confidence  │     │ from papers   │     │ update code   │
└───────────────┘     └───────────────┘     └───────────────┘     └───────────────┘
```

### Triage Functions

| Function | Purpose |
|----------|---------|
| `classifyDiscovery()` | Assigns priority level, confidence score, and identifies affected tests |
| `extractDataFromPaper()` | Pulls performance metrics and citations from publications |
| `generateUpdateCommand()` | Creates copy-paste JavaScript for database updates |
| `triageDiscoveries()` | Batch processes all pending items efficiently |

### Classification Output

```javascript
{
  highPriority: [    // Urgent: new validation data, FDA approvals
    { discovery, confidence: 0.95, affectedTests: ['signatera'], action: '...' }
  ],
  mediumPriority: [ // Review needed: coverage changes, new studies
    { discovery, confidence: 0.80, affectedTests: ['guardant360'] }
  ],
  lowPriority: [    // Monitor: general research, tangential findings
    { discovery, confidence: 0.60 }
  ],
  ignored: [        // Not relevant to OpenOnco
    { discovery, reason: 'Out of scope' }
  ],
  metadata: {
    inputCount: 42,
    processedAt: '2025-01-25T05:00:00.000Z',
    costs: { inputTokens: 15840, outputTokens: 4201, totalCost: '$0.11' }
  }
}
```

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Claude API key (required for triage) |
| `TRIAGE_MODEL` | `claude-sonnet-4-20250514` | Model for classification |
| `TRIAGE_MAX_TOKENS` | `4096` | Maximum response tokens |
| `TRIAGE_TEMPERATURE` | `0.3` | Low for deterministic output |
| `TRIAGE_BATCH_SIZE` | `20` | Discoveries per API call |

### Manual Triage Workflow

When automated triage is disabled, the Monday digest includes structured XML for manual Claude triage:

1. **Receive digest** with XML payload at bottom
2. **Copy XML** (starts with `<openonco_triage_request>`)
3. **Paste into Claude** with triage instructions
4. **Review analysis** and execute approved actions

---

## Monday Digest Email

Every Monday at 6 AM, the daemon sends a comprehensive digest via Resend.

### Email Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  [OpenOnco] Weekly Intelligence Digest — January 27, 2025          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  SUMMARY                                                            │
│  ──────────────────────────────────────────────────────────────    │
│  • 12 new discoveries (5 high, 4 medium, 3 low priority)          │
│  • 47 items pending review                                         │
│  • All crawlers healthy                                            │
│                                                                     │
│  CRAWLER STATUS                                                     │
│  ──────────────────────────────────────────────────────────────    │
│  ┌────────────┬─────────────────┬──────────┬───────────┐          │
│  │ Crawler    │ Last Run        │ Status   │ Found     │          │
│  ├────────────┼─────────────────┼──────────┼───────────┤          │
│  │ PubMed     │ Jan 27, 6:00 AM │ ✓        │ 8 new     │          │
│  │ Payers     │ Jan 24, 6:00 AM │ ✓        │ 2 changes │          │
│  │ Citations  │ Jan 23, 6:00 AM │ ✓        │ 5 issues  │          │
│  │ Preprints  │ Jan 22, 6:00 AM │ ✓        │ 3 new     │          │
│  └────────────┴─────────────────┴──────────┴───────────┘          │
│                                                                     │
│  NEW DISCOVERIES                                                    │
│  ──────────────────────────────────────────────────────────────    │
│                                                                     │
│  PubMed (8)                                                        │
│  • [HIGH] Signatera Validation in Stage II CRC: 97% Sensitivity   │
│  • [HIGH] Guardant360 CDx vs Tissue Biopsy Concordance Study      │
│  • [MEDIUM] Liquid Biopsy for Treatment Response Assessment...    │
│                                                                     │
│  Citations (5)                                                      │
│  • [HIGH] Missing citation: Signatera — sensitivity field         │
│  • [HIGH] Broken URL: Guardant360 — specificity (404 error)       │
│  • [MEDIUM] Invalid PMID: FoundationOne — LOD (PMID not found)    │
│                                                                     │
│  Payers (2)                                                        │
│  • [HIGH] UnitedHealthcare: Molecular Oncology Testing Updated    │
│  • [MEDIUM] Aetna: Liquid Biopsy CPB Policy Revision             │
│                                                                     │
│  ERRORS (if any)                                                   │
│  ──────────────────────────────────────────────────────────────    │
│  (none this week)                                                  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  AI TRIAGE XML                                                      │
│  Copy everything below and paste into Claude for analysis:        │
│                                                                     │
│  <openonco_triage_request week="2025-01-27">                      │
│    <citation_audit>                                                │
│      <missing count="3">...</missing>                              │
│      <broken count="2">...</broken>                                │
│    </citation_audit>                                               │
│    <pubmed_papers count="8">...</pubmed_papers>                   │
│    <payer_updates count="2">...</payer_updates>                   │
│    ...                                                             │
│  </openonco_triage_request>                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Triage XML Schema

```xml
<openonco_triage_request week="2025-01-27">
  <citation_audit>
    <missing count="3">
      <item test="Signatera" field="sensitivity" value="97.2%"/>
    </missing>
    <broken count="2">
      <item test="Guardant360" field="specificity" url="..." error="404"/>
    </broken>
  </citation_audit>

  <pubmed_papers count="8">
    <paper pmid="12345678" relevance="high">
      <title>ctDNA Detection in Stage II Colorectal Cancer...</title>
      <journal>J Clin Oncol</journal>
    </paper>
  </pubmed_papers>

  <payer_updates count="2">
    <update payer="UHC" policy="Molecular Oncology Testing">
      <change_detected>2025-01-24T06:15:00Z</change_detected>
    </update>
  </payer_updates>

  <preprints count="3">...</preprints>
  <fda_updates count="0"/>
  <cms_updates count="0"/>
</openonco_triage_request>
```

### What Claude Does With Each Source

| Source | Triage Actions |
|--------|----------------|
| **Missing Citations** | Search PubMed/Google Scholar, suggest citation URLs |
| **Broken Citations** | Find replacement URLs, flag for removal if unfixable |
| **PubMed/Preprints** | Extract performance metrics, identify affected tests, draft update |
| **Payer Updates** | Classify change type, summarize coverage impact, match to tests |
| **FDA Updates** | Identify test, note new indications/cleared uses |
| **CMS Updates** | Match LCD/NCD to tests, summarize Medicare coverage change |

---

## Setup

### Prerequisites

- Node.js 20+
- npm 9+
- Resend API key (for email)
- Anthropic API key (optional, for AI triage)

### Installation

```bash
cd daemon
npm install

# Install Playwright browsers (required for payers crawler)
npx playwright install chromium
```

### Configuration

```bash
cp .env.example .env
```

**Required variables:**

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | Resend API key for email delivery |
| `DIGEST_RECIPIENT_EMAIL` | Where to send weekly digests |
| `DIGEST_FROM_EMAIL` | Sender email (verified in Resend) |

**Optional variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Claude API key for AI triage |
| `LOG_LEVEL` | `info` | Logging verbosity (debug/info/warn/error) |
| `NODE_ENV` | `development` | Environment mode |

**Crawler toggles** (all default to `true`):

```bash
CRAWLER_PUBMED_ENABLED=true
CRAWLER_PREPRINTS_ENABLED=true
CRAWLER_CITATIONS_ENABLED=true
CRAWLER_PAYERS_ENABLED=true
CRAWLER_CMS_ENABLED=true
CRAWLER_FDA_ENABLED=true
CRAWLER_VENDOR_ENABLED=true
CRAWLER_TRIAGE_ENABLED=true
```

**Schedule overrides** (cron syntax):

```bash
SCHEDULE_PUBMED=0 6 * * *       # Daily 6 AM
SCHEDULE_PREPRINTS=0 6 * * 3    # Wednesday 6 AM
SCHEDULE_CITATIONS=0 6 * * 4    # Thursday 6 AM
SCHEDULE_PAYERS=0 6 * * 5       # Friday 6 AM
SCHEDULE_CMS=0 6 * * 0          # Sunday 6 AM
SCHEDULE_FDA=0 6 * * 1          # Monday 6 AM
SCHEDULE_VENDOR=0 6 * * 2       # Tuesday 6 AM
SCHEDULE_TRIAGE=0 5 * * 0       # Sunday 5 AM
SCHEDULE_DIGEST=0 6 * * 1       # Monday 6 AM
```

**Rate limits** (requests per minute):

```bash
RATE_LIMIT_PUBMED=10     # NCBI allows 10/sec with API key
RATE_LIMIT_PREPRINTS=5   # bioRxiv API
RATE_LIMIT_CITATIONS=2   # URL validation
RATE_LIMIT_PAYERS=0.2    # Playwright (slow, respectful)
RATE_LIMIT_CMS=5         # Government site
RATE_LIMIT_FDA=5         # openFDA
RATE_LIMIT_VENDOR=3      # Vendor sites
```

---

## Local Development

### Running

```bash
# Development with auto-reload
npm run dev

# Production mode
npm start
```

### Testing

```bash
# Preview digest email (console output)
node run-test-email.js

# Send actual test email
node run-test-email.js --send

# Run all crawlers immediately
node run-now.js

# Test individual crawlers
node test-citations.js
node test-payers.js
node test-triage.js

# Full E2E pipeline test
node test-e2e-pipeline.js

# Unit tests
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # Coverage report
```

### Triggering Crawlers Programmatically

```javascript
import { triggerCrawler } from './src/scheduler.js';

await triggerCrawler('pubmed');
await triggerCrawler('citations');
await triggerCrawler('payers');
```

### Monitoring

```bash
# Discovery queue status
cat data/discoveries.json | jq '.items | length'

# Health status
cat data/health.json | jq '.crawlers'

# Live logs
tail -f logs/daemon-$(date +%Y-%m-%d).log
```

---

## Deployment

The daemon is deployed to [Railway](https://railway.app).

### Setup

1. Connect repository in Railway dashboard
2. Set root directory to `/daemon`
3. Configure environment variables
4. Deploy

### railway.json

```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Required Environment Variables

```bash
NODE_ENV=production
LOG_LEVEL=info
RESEND_API_KEY=re_...
ANTHROPIC_API_KEY=sk-ant-...
DIGEST_RECIPIENT_EMAIL=team@openonco.org
DIGEST_FROM_EMAIL=OpenOnco Daemon <daemon@openonco.org>
```

### Health Monitoring

Railway provides:
- Automatic restarts on failure
- Log aggregation
- Resource monitoring

The daemon logs status hourly and includes health data in weekly digests.

---

## Data Storage

All runtime data is stored in `data/` (auto-created on first run).

### discoveries.json

```json
{
  "version": 1,
  "lastUpdated": "2025-01-25T14:30:00.000Z",
  "items": [
    {
      "id": "pubmed-1705312800000-abc123",
      "source": "pubmed",
      "type": "publication",
      "title": "ctDNA Detection in Colorectal Cancer...",
      "url": "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      "relevance": "high",
      "metadata": { "pmid": "12345678", "journal": "J Clin Oncol" },
      "discoveredAt": "2025-01-25T06:00:00.000Z",
      "status": "pending"
    }
  ],
  "stats": { "totalAdded": 150, "totalProcessed": 120 }
}
```

### health.json

```json
{
  "version": 1,
  "startedAt": "2025-01-15T08:00:00.000Z",
  "crawlers": {
    "pubmed": {
      "lastRun": "2025-01-25T06:00:00.000Z",
      "lastSuccess": "2025-01-25T06:00:00.000Z",
      "discoveriesFound": 42,
      "discoveriesAdded": 38,
      "duration": 3245,
      "status": "success"
    }
  },
  "errors": [],
  "digestsSent": 10
}
```

### payer-hashes.json

SHA256 hashes for content change detection:

```json
{
  "uhc:policy:https://www.uhcprovider.com/.../molecular.html": "a1b2c3...",
  "aetna:policy:https://www.aetna.com/cpb/...": "d4e5f6..."
}
```

### logs/

Winston daily rotation logs:
- `daemon-YYYY-MM-DD.log` — All logs
- `daemon-error-YYYY-MM-DD.log` — Errors only

---

## Extending the Daemon

### Adding a New Crawler

1. **Create crawler file** (`src/crawlers/mySource.js`):

```javascript
import BaseCrawler from './base.js';
import { DISCOVERY_TYPES } from './index.js';

export default class MySourceCrawler extends BaseCrawler {
  constructor() {
    super('mySource', { rateLimit: 5, timeout: 30000 });
  }

  async crawl() {
    const discoveries = [];
    const results = await this.http.getJson('https://api.example.com/search');

    for (const item of results) {
      discoveries.push({
        source: 'mySource',
        type: DISCOVERY_TYPES.PUBLICATION,
        title: item.title,
        url: item.url,
        relevance: this.calculateRelevance(item),
        metadata: { /* source-specific */ }
      });
    }
    return discoveries;
  }

  calculateRelevance(item) {
    if (item.title.includes('validation')) return 'high';
    if (item.title.includes('ctDNA')) return 'medium';
    return 'low';
  }
}
```

2. **Register** in `src/crawlers/index.js`
3. **Add schedule** in `src/config.js`
4. **Add env vars** to `.env.example`

### Adding Discovery Types

Update `src/crawlers/index.js`:

```javascript
export const DISCOVERY_TYPES = {
  PUBLICATION: 'publication',
  POLICY_CHANGE: 'policy_change',
  MY_NEW_TYPE: 'my_new_type'
};
```

### Customizing Email Templates

Edit `src/email/templates.js`:
- `generateDigestHTML()` — HTML email body
- `generateDigestText()` — Plain text fallback
- `generateTriageXML()` — Structured triage payload

---

## Project Structure

```
daemon/
├── package.json
├── railway.json
├── .env.example
├── README.md
│
├── run-test-email.js      # Test digest email
├── run-now.js             # Run all crawlers
├── test-*.js              # Individual test scripts
│
├── data/                  # Runtime data (auto-created)
│   ├── discoveries.json
│   ├── health.json
│   └── payer-hashes.json
│
├── logs/                  # Log files (auto-created)
│
└── src/
    ├── index.js           # Entry point
    ├── config.js          # Configuration
    ├── scheduler.js       # Cron management
    ├── health.js          # Health tracking
    │
    ├── queue/
    │   ├── index.js       # Queue operations
    │   └── store.js       # File storage
    │
    ├── crawlers/
    │   ├── index.js       # Registry
    │   ├── base.js        # Base class
    │   ├── pubmed.js      # ✅ Scientific publications
    │   ├── preprints.js   # ✅ medRxiv/bioRxiv
    │   ├── citations.js   # ✅ Database audit
    │   ├── payers.js      # ✅ Insurance coverage
    │   ├── cms.js         # ⏳ Medicare (stub)
    │   ├── fda.js         # ⏳ FDA (stub)
    │   └── vendor.js      # ⏳ Vendor sites (stub)
    │
    ├── triage/
    │   ├── index.js       # Orchestrator
    │   ├── client.js      # Claude API
    │   └── prompts.js     # System prompts
    │
    ├── email/
    │   ├── index.js       # Resend service
    │   └── templates.js   # Email templates
    │
    └── utils/
        ├── logger.js      # Winston logging
        └── http.js        # Rate-limited HTTP
```

---

## License

Proprietary — OpenOnco
