# Development Guide

This document covers local development setup, testing, and how to add new crawlers to the OpenOnco Intelligence Daemon.

## Prerequisites

- **Node.js 20.x or higher** (check with `node --version`)
- **npm** (comes with Node.js)
- **Git** for version control

## Local Setup

### 1. Clone and Install

```bash
# Navigate to daemon directory
cd daemon

# Install dependencies
npm install

# Install Playwright browsers (required for vendor crawler)
npx playwright install chromium
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
```

Required for full functionality:
```bash
# .env
RESEND_API_KEY=re_your_api_key_here
DIGEST_RECIPIENT_EMAIL=your-email@example.com
```

Minimal configuration for testing crawlers (email disabled):
```bash
# .env
LOG_LEVEL=debug
NODE_ENV=development
```

### 3. Run the Daemon

```bash
# Development mode (auto-reload on file changes)
npm run dev

# Production mode
npm start
```

### 4. Run Crawlers Manually

```bash
# Run all crawlers immediately
node run-now.js
```

Or run a specific crawler programmatically:

```javascript
// test-crawler.js
import 'dotenv/config';
import { PubMedCrawler } from './src/crawlers/pubmed.js';

const crawler = new PubMedCrawler();
const discoveries = await crawler.crawl();
console.log(`Found ${discoveries.length} discoveries`);
discoveries.forEach(d => console.log(`- ${d.title}`));
```

```bash
node test-crawler.js
```

---

## Testing

The project uses [Vitest](https://vitest.dev/) for testing.

### Running Tests

```bash
# Run tests in watch mode (default)
npm test

# Run tests once
npm run test:run

# Run tests with coverage
npm run test:coverage
```

### Test Structure

```
tests/
├── unit/
│   ├── config.test.js        # Configuration tests
│   └── crawlers/
│       ├── cms.test.js       # CMS crawler tests
│       └── fda.test.js       # FDA crawler tests
```

### Writing Tests

Tests use Vitest syntax (compatible with Jest):

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SomeCrawler } from '../../src/crawlers/some.js';

describe('SomeCrawler', () => {
  let crawler;

  beforeEach(() => {
    crawler = new SomeCrawler();
  });

  it('should return discoveries', async () => {
    const discoveries = await crawler.crawl();
    expect(discoveries).toBeInstanceOf(Array);
  });

  it('should filter by relevance', () => {
    const relevance = crawler.calculateRelevance({ title: 'MRD study' });
    expect(relevance).toBe('high');
  });
});
```

### Mocking HTTP Requests

```javascript
import { vi } from 'vitest';

// Mock the HTTP client
vi.mock('../../src/utils/http.js', () => ({
  createHttpClient: () => ({
    getJson: vi.fn().mockResolvedValue({
      results: [{ id: '123', title: 'Test' }]
    }),
  }),
}));
```

### Test Configuration

`vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

---

## Code Structure

### Source Files

```
src/
├── index.js          # Main entry point, daemon lifecycle
├── config.js         # Configuration, monitored tests/vendors
├── scheduler.js      # Cron job management
├── health.js         # Health tracking
├── crawlers/
│   ├── index.js      # Crawler registry
│   ├── base.js       # Base crawler class
│   ├── pubmed.js     # PubMed crawler
│   ├── cms.js        # CMS crawler
│   ├── fda.js        # FDA crawler
│   ├── vendor.js     # Vendor crawler
│   └── preprints.js  # Preprints crawler
├── queue/
│   ├── index.js      # Queue operations
│   └── store.js      # File-based storage
├── email/
│   ├── index.js      # Resend email service
│   └── templates.js  # Email templates
└── utils/
    ├── logger.js     # Winston logging
    └── http.js       # Rate-limited HTTP client
```

### Key Module Responsibilities

| Module | Purpose |
|--------|---------|
| `config.js` | Central configuration, monitored entities |
| `scheduler.js` | Cron job scheduling, manual triggers |
| `health.js` | Crawler health tracking |
| `crawlers/base.js` | Abstract base class for all crawlers |
| `queue/index.js` | Discovery queue operations |
| `utils/http.js` | Rate-limited HTTP client |
| `utils/logger.js` | Structured logging |

---

## Adding a New Crawler

Follow these steps to add a new data source crawler.

### Step 1: Create the Crawler File

Create `src/crawlers/newcrawler.js`:

```javascript
/**
 * New Source Crawler
 * Description of what this crawler does
 *
 * API Documentation: https://...
 */

import { BaseCrawler } from './base.js';
import { config, DISCOVERY_TYPES, SOURCES } from '../config.js';

// Keywords for searching/filtering
const SEARCH_KEYWORDS = [
  'ctDNA',
  'liquid biopsy',
  'MRD',
];

export class NewCrawler extends BaseCrawler {
  constructor() {
    super({
      name: config.crawlers.newsource.name,
      source: SOURCES.NEWSOURCE,
      description: config.crawlers.newsource.description,
      rateLimit: config.crawlers.newsource.rateLimit,
      enabled: config.crawlers.newsource.enabled,
    });

    this.baseUrl = 'https://api.example.com';
  }

  /**
   * Main crawl implementation
   * @returns {Promise<Array>} Array of discovery objects
   */
  async crawl() {
    this.log('info', 'Starting new source crawl');
    const discoveries = [];

    try {
      // Fetch data from API
      const response = await this.http.getJson(`${this.baseUrl}/search`);

      // Process results
      for (const item of response.results || []) {
        const relevance = this.calculateRelevance(item);

        if (relevance !== 'low') {
          discoveries.push(this.createDiscovery(item, relevance));
        }
      }
    } catch (error) {
      this.log('error', 'Failed to fetch from API', { error: error.message });
      throw error;
    }

    this.log('info', 'New source crawl complete', {
      discoveries: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Calculate relevance score
   */
  calculateRelevance(item) {
    const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();

    // High relevance: specific test names
    if (text.includes('signatera') || text.includes('guardant')) {
      return 'high';
    }

    // Medium relevance: general terms
    if (text.includes('ctdna') || text.includes('liquid biopsy')) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Create discovery object
   */
  createDiscovery(item, relevance) {
    return {
      source: SOURCES.NEWSOURCE,
      type: DISCOVERY_TYPES.PUBLICATION, // or appropriate type
      title: item.title,
      summary: item.description || '',
      url: item.url,
      relevance,
      metadata: {
        id: item.id,
        // Add source-specific fields
      },
    };
  }
}

export default NewCrawler;
```

### Step 2: Update Configuration

Edit `src/config.js`:

```javascript
// Add source constant
export const SOURCES = {
  PUBMED: 'pubmed',
  CMS: 'cms',
  FDA: 'fda',
  VENDOR: 'vendor',
  PREPRINTS: 'preprints',
  NEWSOURCE: 'newsource',  // Add this
};

// Add crawler config
export const config = {
  // ...
  crawlers: {
    // ...existing crawlers...
    newsource: {
      enabled: process.env.CRAWLER_NEWSOURCE_ENABLED !== 'false',
      name: 'New Source',
      description: 'Description of data source',
      rateLimit: parseInt(process.env.RATE_LIMIT_NEWSOURCE || '5', 10),
    },
  },
  schedules: {
    // ...existing schedules...
    newsource: process.env.SCHEDULE_NEWSOURCE || '0 6 * * 4', // Thursday 6 AM
  },
};
```

### Step 3: Register the Crawler

Edit `src/crawlers/index.js`:

```javascript
import { NewCrawler } from './newcrawler.js';

// Add to crawler map
const crawlerClasses = {
  pubmed: PubMedCrawler,
  cms: CMSCrawler,
  fda: FDACrawler,
  vendor: VendorCrawler,
  preprints: PreprintsCrawler,
  newsource: NewCrawler,  // Add this
};
```

### Step 4: Add to Scheduler

Edit `src/scheduler.js`:

```javascript
export function startScheduler() {
  // ...existing crawlers...
  scheduleCrawler(SOURCES.NEWSOURCE, config.schedules.newsource);
}

export async function runAllCrawlersNow() {
  const sources = [
    SOURCES.PUBMED,
    SOURCES.CMS,
    SOURCES.FDA,
    SOURCES.VENDOR,
    SOURCES.PREPRINTS,
    SOURCES.NEWSOURCE,  // Add this
  ];
  // ...
}
```

### Step 5: Write Tests

Create `tests/unit/crawlers/newcrawler.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewCrawler } from '../../../src/crawlers/newcrawler.js';

describe('NewCrawler', () => {
  let crawler;

  beforeEach(() => {
    crawler = new NewCrawler();
  });

  describe('calculateRelevance', () => {
    it('returns high for specific test names', () => {
      expect(crawler.calculateRelevance({ title: 'Signatera MRD' })).toBe('high');
    });

    it('returns medium for general terms', () => {
      expect(crawler.calculateRelevance({ title: 'ctDNA analysis' })).toBe('medium');
    });

    it('returns low for unrelated content', () => {
      expect(crawler.calculateRelevance({ title: 'Unrelated topic' })).toBe('low');
    });
  });

  describe('createDiscovery', () => {
    it('creates valid discovery object', () => {
      const item = { id: '123', title: 'Test', url: 'https://...' };
      const discovery = crawler.createDiscovery(item, 'high');

      expect(discovery.source).toBe('newsource');
      expect(discovery.title).toBe('Test');
      expect(discovery.relevance).toBe('high');
    });
  });
});
```

### Step 6: Update Documentation

Add crawler documentation to `docs/CRAWLERS.md` with:
- API details
- Search strategy
- Relevance scoring criteria
- Discovery output format

---

## Debugging Tips

### Enable Debug Logging

```bash
LOG_LEVEL=debug npm run dev
```

### Test a Single Crawler

```javascript
// debug-crawler.js
import 'dotenv/config';
import { CMSCrawler } from './src/crawlers/cms.js';

process.env.LOG_LEVEL = 'debug';

async function debug() {
  const crawler = new CMSCrawler();

  console.log('Crawler config:', crawler.getStatus());

  try {
    const discoveries = await crawler.crawl();
    console.log(`\nFound ${discoveries.length} discoveries:\n`);

    discoveries.forEach((d, i) => {
      console.log(`${i + 1}. [${d.relevance}] ${d.title}`);
      console.log(`   URL: ${d.url}`);
      console.log('');
    });
  } catch (error) {
    console.error('Crawl failed:', error);
  }
}

debug();
```

```bash
node debug-crawler.js
```

### Inspect Queue Data

```bash
# Count discoveries by source
cat data/discoveries.json | jq 'group_by(.source) | map({source: .[0].source, count: length})'

# View recent discoveries
cat data/discoveries.json | jq 'sort_by(.discoveredAt) | reverse | .[0:5]'

# Find high relevance items
cat data/discoveries.json | jq '[.[] | select(.relevance == "high")] | length'
```

### Test HTTP Requests

```javascript
// test-http.js
import { createHttpClient } from './src/utils/http.js';

const client = createHttpClient('test', { rateLimitMs: 1000 });

async function test() {
  const response = await client.getJson('https://api.example.com/endpoint');
  console.log(response);
}

test();
```

---

## Code Style Guidelines

### General

- Use ES modules (`import`/`export`)
- Async/await for asynchronous code
- JSDoc comments for public functions
- Consistent error handling with try/catch

### Crawler Conventions

- Extend `BaseCrawler`
- Implement `crawl()` returning array of discoveries
- Use `this.log()` for logging (not console.log)
- Use `this.http` for API requests
- Filter discoveries by relevance before returning

### Discovery Object Format

Every discovery must include:

```javascript
{
  source: 'source_id',      // From SOURCES constant
  type: 'discovery_type',   // From DISCOVERY_TYPES constant
  title: 'Display title',   // Human-readable title
  summary: 'Brief summary', // 1-2 sentence description
  url: 'https://...',       // Link to source
  relevance: 'high',        // 'high', 'medium', or 'low'
  metadata: {               // Source-specific data
    // ...
  },
}
```

---

## Environment Variables Reference

### Development

```bash
NODE_ENV=development
LOG_LEVEL=debug
```

### Crawlers

```bash
CRAWLER_PUBMED_ENABLED=true
CRAWLER_CMS_ENABLED=true
CRAWLER_FDA_ENABLED=true
CRAWLER_VENDOR_ENABLED=true
CRAWLER_PREPRINTS_ENABLED=true
```

### Rate Limits (requests/minute)

```bash
RATE_LIMIT_PUBMED=10
RATE_LIMIT_CMS=5
RATE_LIMIT_FDA=5
RATE_LIMIT_VENDOR=3
RATE_LIMIT_PREPRINTS=5
```

### Schedules (cron syntax)

```bash
SCHEDULE_PUBMED=0 6 * * *
SCHEDULE_CMS=0 6 * * 0
SCHEDULE_FDA=0 6 * * 1
SCHEDULE_VENDOR=0 6 * * 2
SCHEDULE_PREPRINTS=0 6 * * 3
SCHEDULE_DIGEST=0 10 * * *
```

See [CONFIGURATION.md](./CONFIGURATION.md) for complete reference.

---

## Common Development Tasks

### Add a New Monitored Test

Edit `src/config.js`, add to appropriate category:

```javascript
export const MONITORED_TESTS = {
  mrd: [
    // ...existing tests...
    'New Test Name',
  ],
  // ...
};
```

### Add a New Vendor

Edit `src/config.js`:

```javascript
export const MONITORED_VENDORS = [
  // ...existing vendors...
  'New Vendor Name',
];
```

### Add Vendor Website to Monitor

Edit `src/crawlers/vendor.js`, add to `VENDOR_SOURCES`:

```javascript
const VENDOR_SOURCES = [
  // ...existing vendors...
  {
    name: 'New Vendor',
    id: 'newvendor',
    baseUrl: 'https://www.newvendor.com',
    pages: [
      { path: '/products', description: 'Product page', type: 'product' },
      { path: '/news', description: 'News', type: 'news' },
    ],
  },
];
```

### Modify Relevance Scoring

Each crawler has a `calculateRelevance()` method. Edit the keywords:

```javascript
calculateRelevance(item) {
  const text = `${item.title}`.toLowerCase();

  // Add new high-relevance keywords
  const highKeywords = [
    'signatera',
    'mrd',
    'new_important_term',  // Add here
  ];

  // ...
}
```

---

## Useful Commands

```bash
# Development
npm run dev                # Start with auto-reload
npm test                   # Run tests in watch mode
npm run test:run           # Run tests once
npm run test:coverage      # Run tests with coverage

# Production
npm start                  # Start daemon

# Manual operations
node run-now.js           # Run all crawlers immediately

# Debugging
LOG_LEVEL=debug npm start # Start with debug logging

# Data inspection
cat data/discoveries.json | jq length
cat data/health.json | jq '.crawlers'
```
