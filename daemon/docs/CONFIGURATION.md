# Configuration Guide

This document covers all configuration options for the OpenOnco Intelligence Daemon.

## Environment Variables

Create a `.env` file in the daemon root directory. See `.env.example` for a template.

---

## Quick Reference: All Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | Yes | - | Resend API key for sending emails |
| `DIGEST_FROM_EMAIL` | No | `OpenOnco Daemon <daemon@openonco.org>` | Sender email address |
| `DIGEST_RECIPIENT_EMAIL` | No | `team@openonco.org` | Primary digest recipient |
| `ALERT_EMAIL` | No | `team@openonco.org` | Alert email recipient |
| `CRAWLER_PUBMED_ENABLED` | No | `true` | Enable PubMed crawler |
| `CRAWLER_CMS_ENABLED` | No | `true` | Enable CMS crawler |
| `CRAWLER_FDA_ENABLED` | No | `true` | Enable FDA crawler |
| `CRAWLER_VENDOR_ENABLED` | No | `true` | Enable Vendor crawler |
| `CRAWLER_PREPRINTS_ENABLED` | No | `true` | Enable Preprints crawler |
| `RATE_LIMIT_PUBMED` | No | `10` | PubMed rate limit (req/min) |
| `RATE_LIMIT_CMS` | No | `5` | CMS rate limit (req/min) |
| `RATE_LIMIT_FDA` | No | `5` | FDA rate limit (req/min) |
| `RATE_LIMIT_VENDOR` | No | `3` | Vendor rate limit (req/min) |
| `RATE_LIMIT_PREPRINTS` | No | `5` | Preprints rate limit (req/min) |
| `SCHEDULE_PUBMED` | No | `0 6 * * *` | PubMed cron schedule |
| `SCHEDULE_CMS` | No | `0 6 * * 0` | CMS cron schedule |
| `SCHEDULE_FDA` | No | `0 6 * * 1` | FDA cron schedule |
| `SCHEDULE_VENDOR` | No | `0 6 * * 2` | Vendor cron schedule |
| `SCHEDULE_PREPRINTS` | No | `0 6 * * 3` | Preprints cron schedule |
| `SCHEDULE_DIGEST` | No | `0 10 * * *` | Daily digest cron schedule |
| `LOG_LEVEL` | No | `info` | Logging level |
| `LOG_DIR` | No | `./logs` | Log directory path |
| `QUEUE_FILE_PATH` | No | `./data/queue.json` | Queue storage file path |
| `NODE_ENV` | No | `development` | Environment mode |
| `API_BASE_URL` | No | `http://localhost:3000` | Base URL for API integration |
| `API_SECRET_KEY` | No | - | Secret key for API authentication |

---

## Detailed Configuration

### Email Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RESEND_API_KEY` | Yes | - | API key from [Resend](https://resend.com) for sending email digests |
| `DIGEST_FROM_EMAIL` | No | `OpenOnco Daemon <daemon@openonco.org>` | Sender email address |
| `DIGEST_RECIPIENT_EMAIL` | No | `team@openonco.org` | Primary recipient for digests |
| `ALERT_EMAIL` | No | `team@openonco.org` | Recipient for alert emails |

**Note:** If `ALERT_EMAIL` is set, it takes precedence over `DIGEST_RECIPIENT_EMAIL` for alerts.

### API Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_BASE_URL` | No | `http://localhost:3000` | Base URL for API integration |
| `API_SECRET_KEY` | No | - | Secret key for API authentication |

### Crawler Enable/Disable

| Variable | Default | Description |
|----------|---------|-------------|
| `CRAWLER_PUBMED_ENABLED` | `true` | Enable PubMed crawler |
| `CRAWLER_CMS_ENABLED` | `true` | Enable CMS/Medicare crawler |
| `CRAWLER_FDA_ENABLED` | `true` | Enable FDA crawler |
| `CRAWLER_VENDOR_ENABLED` | `true` | Enable Vendor website crawler |
| `CRAWLER_PREPRINTS_ENABLED` | `true` | Enable Preprints crawler |

Set to `false` to disable a crawler:
```bash
CRAWLER_VENDOR_ENABLED=false
```

---

## Rate Limits

| Variable | Default | Unit | Description |
|----------|---------|------|-------------|
| `RATE_LIMIT_PUBMED` | `10` | requests/min | PubMed API rate limit |
| `RATE_LIMIT_CMS` | `5` | requests/min | CMS API rate limit |
| `RATE_LIMIT_FDA` | `5` | requests/min | FDA API rate limit |
| `RATE_LIMIT_VENDOR` | `3` | requests/min | Vendor website crawl rate |
| `RATE_LIMIT_PREPRINTS` | `5` | requests/min | Preprints API rate limit |

**Note:** The vendor crawler uses a fixed 3-second delay between requests regardless of this setting.

---

## Schedule Overrides

Override the default cron schedules:

| Variable | Default | Description |
|----------|---------|-------------|
| `SCHEDULE_PUBMED` | `0 6 * * *` | PubMed crawl schedule |
| `SCHEDULE_CMS` | `0 6 * * 0` | CMS crawl schedule |
| `SCHEDULE_FDA` | `0 6 * * 1` | FDA crawl schedule |
| `SCHEDULE_VENDOR` | `0 6 * * 2` | Vendor crawl schedule |
| `SCHEDULE_PREPRINTS` | `0 6 * * 3` | Preprints crawl schedule |
| `SCHEDULE_DIGEST` | `0 10 * * *` | Daily digest schedule |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `LOG_DIR` | `./logs` | Directory for log files |

### Other Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment: `development` or `production` |
| `QUEUE_FILE_PATH` | `./data/queue.json` | Path to queue storage file |

---

## Cron Schedule Reference

Schedules use standard cron syntax: `minute hour day month day-of-week`

### Default Schedules

| Task | Env Variable | Default Cron | Human Readable | Frequency |
|------|--------------|--------------|----------------|-----------|
| PubMed Crawler | `SCHEDULE_PUBMED` | `0 6 * * *` | 6:00 AM UTC daily | Daily |
| CMS Crawler | `SCHEDULE_CMS` | `0 6 * * 0` | 6:00 AM UTC Sunday | Weekly |
| FDA Crawler | `SCHEDULE_FDA` | `0 6 * * 1` | 6:00 AM UTC Monday | Weekly |
| Vendor Crawler | `SCHEDULE_VENDOR` | `0 6 * * 2` | 6:00 AM UTC Tuesday | Weekly |
| Preprints Crawler | `SCHEDULE_PREPRINTS` | `0 6 * * 3` | 6:00 AM UTC Wednesday | Weekly |
| Daily Digest Email | `SCHEDULE_DIGEST` | `0 10 * * *` | 10:00 AM UTC daily | Daily |
| Queue Cleanup | *(hardcoded)* | `0 0 * * *` | Midnight UTC daily | Daily |

**Note:** Queue cleanup schedule is hardcoded in `src/scheduler.js` and removes discoveries older than 30 days.

### Cron Syntax

```
┌──────────── minute (0-59)
│ ┌────────── hour (0-23)
│ │ ┌──────── day of month (1-31)
│ │ │ ┌────── month (1-12)
│ │ │ │ ┌──── day of week (0-7, 0 and 7 are Sunday)
│ │ │ │ │
* * * * *
```

### Common Patterns

| Pattern | Description |
|---------|-------------|
| `0 6 * * *` | Daily at 6:00 AM |
| `0 6 * * 0` | Weekly on Sunday at 6:00 AM |
| `0 6 * * 1-5` | Weekdays at 6:00 AM |
| `0 */4 * * *` | Every 4 hours |
| `*/30 * * * *` | Every 30 minutes |
| `0 9 1 * *` | Monthly on the 1st at 9:00 AM |

### Example: Run All Crawlers Daily

```bash
SCHEDULE_PUBMED=0 6 * * *
SCHEDULE_CMS=0 7 * * *
SCHEDULE_FDA=0 8 * * *
SCHEDULE_VENDOR=0 9 * * *
SCHEDULE_PREPRINTS=0 10 * * *
```

---

## Monitored Tests Configuration

Tests are configured in `src/config.js`. The configuration is organized by category:

### MRD (Minimal Residual Disease) Tests

```javascript
mrd: [
  'Signatera',
  'Guardant Reveal',
  'FoundationOne Tracker',
  'Haystack MRD',
  'NeXT Personal Dx',
  'Oncomine',
  'clonoSEQ',
  'NavDx',
  'RaDaR',
  'PhasED-Seq',
  'AVENIO ctDNA',
  'Tempus MRD',
  'Resolution HRD',
  'PredicineATLAS',
  'Invitae Personalized Cancer Monitoring',
]
```

### TDS (Tumor Detection/Screening) Tests

```javascript
tds: [
  'FoundationOne CDx',
  'FoundationOne Liquid CDx',
  'Guardant360 CDx',
  'Guardant360 TissueNext',
  'Tempus xT',
  'Tempus xF',
  'Tempus xR',
  'Caris Molecular Intelligence',
  'Oncotype DX',
  'MammaPrint',
  'Prosigna',
  'Decipher Prostate',
  'SelectMDx',
  'ExoDx Prostate',
  'Epi proColon',
  'Cologuard',
  'Galleri',
]
```

### ECD (Early Cancer Detection) Tests

```javascript
ecd: [
  'Galleri',
  'CancerSEEK',
  'Shield',
  'GRAIL Galleri',
  'Freenome',
  'DELFI',
  'Helio Liver Test',
  'IvyGene',
  'Oncuria',
  'ColoSense',
]
```

---

## Monitored Vendors Configuration

Vendors are configured in `src/config.js`:

```javascript
export const MONITORED_VENDORS = [
  // Major ctDNA/MRD vendors
  'Natera',
  'Guardant Health',
  'Foundation Medicine',
  'Tempus',
  'Caris Life Sciences',
  'NeoGenomics',
  'Personalis',

  // Large reference labs
  'Quest Diagnostics',
  'Labcorp',
  'Exact Sciences',

  // Specialized vendors
  'Adaptive Biotechnologies',
  'GRAIL',
  'Freenome',
  'Burning Rock Dx',
  'Resolution Bioscience',
  'Invitae',
  'Myriad Genetics',
  'Genomic Health',
  'Agilent',
  'Illumina',

  // Emerging vendors
  'Veracyte',
  'BillionToOne',
  'DELFI Diagnostics',
  'Helio Genomics',
  'Lucence',
  'Nucleix',
  'Inocras',
  'IMBdx',
  'OncoDNA',
  'Geneoscopy',
];
```

---

## Discovery Types

```javascript
export const DISCOVERY_TYPES = {
  PUBLICATION: 'publication',        // PubMed articles
  PREPRINT: 'preprint',              // medRxiv/bioRxiv preprints
  POLICY_UPDATE: 'policy_update',    // Policy changes
  COVERAGE_CHANGE: 'coverage_change', // CMS coverage updates
  FDA_APPROVAL: 'fda_approval',      // FDA 510(k) and PMA
  FDA_GUIDANCE: 'fda_guidance',      // FDA guidance documents
  VENDOR_UPDATE: 'vendor_update',    // Vendor website changes
  TEST_DOCUMENTATION: 'test_documentation', // Test documentation updates
};
```

---

## Sources

```javascript
export const SOURCES = {
  PUBMED: 'pubmed',
  CMS: 'cms',
  FDA: 'fda',
  VENDOR: 'vendor',
  PREPRINTS: 'preprints',
};
```

---

## Helper Functions

The config module exports helper functions:

### `isMonitoredTest(testName)`

Check if a test name matches any monitored test:

```javascript
import { isMonitoredTest } from './config.js';

isMonitoredTest('Signatera MRD Test');  // true
isMonitoredTest('Random Test');          // false
```

### `isMonitoredVendor(vendorName)`

Check if a vendor name matches any monitored vendor:

```javascript
import { isMonitoredVendor } from './config.js';

isMonitoredVendor('Natera Inc');         // true
isMonitoredVendor('Unknown Company');     // false
```

### `getTestCategory(testName)`

Get the category for a test name:

```javascript
import { getTestCategory } from './config.js';

getTestCategory('Signatera');            // 'mrd'
getTestCategory('Galleri');              // 'tds' or 'ecd' (first match)
getTestCategory('Unknown Test');          // null
```

---

## File Paths

| Path | Description |
|------|-------------|
| `./data/discoveries.json` | Discovery queue storage |
| `./data/health.json` | Crawler health status |
| `./data/vendor-hashes.json` | Vendor page content hashes |
| `./logs/` | Log file directory |

These paths are relative to the daemon root directory. The `data/` and `logs/` directories are created automatically on first run.

---

## Example .env File

```bash
# Required
RESEND_API_KEY=re_your_api_key_here

# API Configuration (optional)
API_BASE_URL=http://localhost:3000
API_SECRET_KEY=your-api-secret-key

# Email (optional)
DIGEST_FROM_EMAIL=OpenOnco Daemon <daemon@openonco.org>
DIGEST_RECIPIENT_EMAIL=team@yourdomain.com
ALERT_EMAIL=alerts@yourdomain.com

# Crawler toggles (all default to true)
CRAWLER_PUBMED_ENABLED=true
CRAWLER_CMS_ENABLED=true
CRAWLER_FDA_ENABLED=true
CRAWLER_VENDOR_ENABLED=true
CRAWLER_PREPRINTS_ENABLED=true

# Rate limits (requests per minute)
RATE_LIMIT_PUBMED=10
RATE_LIMIT_CMS=5
RATE_LIMIT_FDA=5
RATE_LIMIT_VENDOR=3
RATE_LIMIT_PREPRINTS=5

# Schedules (cron syntax, all times UTC)
SCHEDULE_PUBMED=0 6 * * *
SCHEDULE_CMS=0 6 * * 0
SCHEDULE_FDA=0 6 * * 1
SCHEDULE_VENDOR=0 6 * * 2
SCHEDULE_PREPRINTS=0 6 * * 3
SCHEDULE_DIGEST=0 10 * * *

# Logging
LOG_LEVEL=info
LOG_DIR=./logs

# Storage
QUEUE_FILE_PATH=./data/queue.json

# Environment
NODE_ENV=production
```

---

## Configuration Validation

The daemon performs basic validation on startup:

1. **RESEND_API_KEY** - Warning logged if not set (email will fail)
2. **Cron schedules** - Validated by node-cron library
3. **Rate limits** - Parsed as integers, defaults used if invalid

Validation errors are logged but don't prevent startup (graceful degradation).
