# Physician System Improvement Plan

**Based on:** Third-party architecture review feedback
**Date:** February 2, 2026
**Status:** Planning

---

## Executive Summary

This plan addresses five key areas identified in the architecture review:
1. **Sources & Automation** - Formalize source registry, reduce manual work
2. **Release Tracking** - Track what changed, not just what ran
3. **Extraction Quality** - Better filtering, gold sets, quote anchoring
4. **Operational Cadence** - Locks, alerts, dashboard metrics
5. **Chat Guardrails** - Citation enforcement, non-diagnosis constraints

Priority levels:
- **P0**: Safety + reliability (must do)
- **P1**: Automation + freshness (high value)
- **P2**: Quality + coverage (important)

---

## P0: Safety & Reliability

### P0.1: Citation Validator + Rewrite Loop

**Problem:** Currently, the chat response may contain claims not backed by retrieved sources. The disclaimer is passive, not enforced.

**Solution:** Add post-generation validation that ensures every clinical claim has a citation.

**Implementation:**

```javascript
// src/chat/citation-validator.js

const CLINICAL_CLAIM_PATTERNS = [
  /\b(recommend|should|indicated|suggests?|evidence shows?)\b/i,
  /\b(treatment|therapy|regimen|protocol)\b.*\b(effective|superior|preferred)\b/i,
  /\b(\d+%|\d+ percent|hazard ratio|odds ratio|p\s*[<=]\s*0\.\d+)\b/i,
  /\b(survival|recurrence|response rate|sensitivity|specificity)\b.*\b\d+/i,
];

const CITATION_PATTERN = /\[\d+\]/g;

export function validateCitations(response, sources) {
  const sentences = response.split(/(?<=[.!?])\s+/);
  const violations = [];

  for (const sentence of sentences) {
    const hasClinicalClaim = CLINICAL_CLAIM_PATTERNS.some(p => p.test(sentence));
    const hasCitation = CITATION_PATTERN.test(sentence);

    if (hasClinicalClaim && !hasCitation) {
      violations.push({
        sentence,
        reason: 'Clinical claim without citation',
      });
    }
  }

  return { valid: violations.length === 0, violations };
}

export async function rewriteWithCitations(response, violations, sources, anthropic) {
  const prompt = `The following response contains clinical claims without citations.

RESPONSE:
${response}

VIOLATIONS (sentences needing citations or rewording):
${violations.map(v => `- "${v.sentence}"`).join('\n')}

AVAILABLE SOURCES:
${sources.map((s, i) => `[${i+1}] ${s.title} (${s.sourceType})`).join('\n')}

Rewrite the response so that:
1. Every clinical claim has a citation [N] to an available source
2. If no source supports a claim, rephrase as uncertainty: "The indexed evidence does not specifically address..."
3. Keep the same overall structure and information

Return only the rewritten response.`;

  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  return result.content[0].text;
}
```

**Integration in chat/server.js:**
```javascript
// After initial response generation
const validation = validateCitations(response, sources);
if (!validation.valid) {
  logger.warn('Citation violations detected', { count: validation.violations.length });
  response = await rewriteWithCitations(response, validation.violations, sources, anthropic);
}
```

**Acceptance Criteria:**
- [ ] No response contains uncited clinical claims
- [ ] Uncertain claims explicitly state uncertainty
- [ ] Rewrite loop adds <500ms latency on average

---

### P0.2: Distributed Locks + Stuck-Run Detection

**Problem:** Long-running crawlers could overlap with next scheduled run. Failed runs could stay in "running" state indefinitely.

**Solution:** PostgreSQL advisory locks + stuck detection.

**Implementation:**

```sql
-- Add to migrations
ALTER TABLE mrd_crawler_runs ADD COLUMN lock_acquired_at TIMESTAMP;
ALTER TABLE mrd_crawler_runs ADD COLUMN heartbeat_at TIMESTAMP;
```

```javascript
// src/utils/job-lock.js

import { query, getClient } from '../db/client.js';
import { createLogger } from './logger.js';

const logger = createLogger('job-lock');
const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute

export async function acquireJobLock(jobName) {
  const lockKey = hashJobName(jobName); // Convert to integer for pg_advisory_lock

  // Check for stuck runs first
  const stuckRuns = await query(`
    UPDATE mrd_crawler_runs
    SET status = 'failed', error_message = 'Stuck run detected and terminated'
    WHERE crawler_name = $1
      AND status = 'running'
      AND heartbeat_at < NOW() - INTERVAL '30 minutes'
    RETURNING id
  `, [jobName]);

  if (stuckRuns.rows.length > 0) {
    logger.warn(`Terminated ${stuckRuns.rows.length} stuck runs for ${jobName}`);
  }

  // Try to acquire advisory lock (non-blocking)
  const lockResult = await query(
    'SELECT pg_try_advisory_lock($1) as acquired',
    [lockKey]
  );

  if (!lockResult.rows[0].acquired) {
    logger.info(`Job ${jobName} already running, skipping`);
    return null;
  }

  // Create run record
  const run = await query(`
    INSERT INTO mrd_crawler_runs (crawler_name, status, started_at, lock_acquired_at, heartbeat_at)
    VALUES ($1, 'running', NOW(), NOW(), NOW())
    RETURNING id
  `, [jobName]);

  const runId = run.rows[0].id;

  // Start heartbeat
  const heartbeatInterval = setInterval(async () => {
    try {
      await query(
        'UPDATE mrd_crawler_runs SET heartbeat_at = NOW() WHERE id = $1',
        [runId]
      );
    } catch (e) {
      logger.error('Heartbeat failed', { runId, error: e.message });
    }
  }, HEARTBEAT_INTERVAL_MS);

  return {
    runId,
    lockKey,
    release: async (status, stats = {}, error = null) => {
      clearInterval(heartbeatInterval);
      await query(`
        UPDATE mrd_crawler_runs
        SET status = $2, completed_at = NOW(),
            items_found = $3, items_new = $4, items_duplicate = $5,
            error_message = $6
        WHERE id = $1
      `, [runId, status, stats.found || 0, stats.new || 0, stats.duplicate || 0, error]);
      await query('SELECT pg_advisory_unlock($1)', [lockKey]);
    }
  };
}

function hashJobName(name) {
  // Simple hash to convert job name to integer for pg_advisory_lock
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

**Acceptance Criteria:**
- [ ] Overlapping job runs are prevented
- [ ] Stuck runs (>30min no heartbeat) auto-terminate
- [ ] Lock release is guaranteed (even on crash via advisory lock timeout)

---

### P0.3: Anchored Quote Storage

**Problem:** Citations point to documents but not specific locations. Makes verification harder and increases hallucination risk.

**Solution:** Operationalize `mrd_quote_anchors` table for every cited snippet.

**Implementation:**

```sql
-- Ensure mrd_quote_anchors is properly structured
CREATE TABLE IF NOT EXISTS mrd_quote_anchors (
  id SERIAL PRIMARY KEY,
  guidance_id INTEGER REFERENCES mrd_guidance_items(id),
  quote_text TEXT NOT NULL,
  chunk_index INTEGER,
  char_start INTEGER,
  char_end INTEGER,
  page_number INTEGER,  -- For PDFs
  confidence DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quote_anchors_guidance ON mrd_quote_anchors(guidance_id);
```

```javascript
// src/chat/quote-extractor.js

export async function extractAndStoreQuote(guidanceId, chunkText, quoteText) {
  // Find quote position in chunk
  const charStart = chunkText.indexOf(quoteText);
  const charEnd = charStart >= 0 ? charStart + quoteText.length : null;

  // Get chunk index from embeddings
  const chunkResult = await query(`
    SELECT chunk_index FROM mrd_item_embeddings
    WHERE guidance_id = $1 AND chunk_text LIKE $2
    LIMIT 1
  `, [guidanceId, `%${quoteText.substring(0, 50)}%`]);

  const chunkIndex = chunkResult.rows[0]?.chunk_index || 0;

  // Store anchor
  const result = await query(`
    INSERT INTO mrd_quote_anchors (guidance_id, quote_text, chunk_index, char_start, char_end)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [guidanceId, quoteText, chunkIndex, charStart, charEnd]);

  return result.rows[0]?.id;
}
```

**Response format update:**
```javascript
// In chat response, sources now include:
{
  "index": 1,
  "title": "...",
  "directQuote": "ctDNA testing may be considered for surveillance...",
  "quoteAnchor": {
    "chunkIndex": 2,
    "charStart": 1547,
    "charEnd": 1612,
    "pageNumber": 15  // if PDF
  }
}
```

**Acceptance Criteria:**
- [ ] Every directQuote has a stored anchor
- [ ] Anchor includes position (chunk + character offset)
- [ ] PDF sources include page number when available

---

## P1: Automation & Freshness

### P1.1: Source Registry + Release Ledger

**Problem:** Sources are implicit in crawlers. No way to track "what releases exist" vs "what we've processed".

**Solution:** Create `mrd_sources` registry and `mrd_source_releases` ledger.

**Implementation:**

```sql
-- New migration: 010_source_registry.sql

CREATE TABLE mrd_sources (
  id SERIAL PRIMARY KEY,
  source_key VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'pubmed', 'nccn-colorectal'
  source_type VARCHAR(50) NOT NULL,        -- api, rss, pdf, html
  display_name VARCHAR(255) NOT NULL,

  -- Access configuration
  base_url TEXT,
  access_method VARCHAR(20) NOT NULL,      -- api, rss, scrape, manual
  auth_required BOOLEAN DEFAULT FALSE,
  tos_constraints TEXT,

  -- Change detection
  change_detector VARCHAR(50),             -- etag, last-modified, hash, version-string, guid
  expected_cadence VARCHAR(50),            -- daily, weekly, monthly, quarterly

  -- Ownership
  owner_email VARCHAR(255),
  alert_on_stale BOOLEAN DEFAULT TRUE,
  stale_threshold_days INTEGER DEFAULT 7,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_checked_at TIMESTAMP,
  last_release_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE mrd_source_releases (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES mrd_sources(id),

  -- Release identification
  release_key VARCHAR(255) NOT NULL,       -- guid, version, date, hash
  release_date DATE,

  -- Detection
  observed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  detector VARCHAR(50),                    -- how we detected: rss-guid, etag, hash, manual
  etag VARCHAR(255),
  last_modified TIMESTAMP,
  content_hash VARCHAR(64),                -- sha256
  version_string VARCHAR(100),

  -- Processing status
  status VARCHAR(20) DEFAULT 'observed',   -- observed, fetched, processed, embedded, failed
  fetched_at TIMESTAMP,
  processed_at TIMESTAMP,
  embedded_at TIMESTAMP,

  -- Results
  items_extracted INTEGER,
  artifact_id INTEGER REFERENCES mrd_artifacts(id),
  error_message TEXT,

  -- Diff tracking
  diff_summary JSONB,                      -- {added: N, updated: N, removed: N}

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, release_key)
);

CREATE INDEX idx_releases_source_status ON mrd_source_releases(source_id, status);
CREATE INDEX idx_releases_observed ON mrd_source_releases(observed_at DESC);

-- View for stale sources
CREATE VIEW v_stale_sources AS
SELECT
  s.*,
  EXTRACT(DAYS FROM NOW() - COALESCE(s.last_release_at, s.created_at)) as days_since_release,
  CASE
    WHEN s.last_release_at IS NULL THEN 'never_released'
    WHEN EXTRACT(DAYS FROM NOW() - s.last_release_at) > s.stale_threshold_days THEN 'stale'
    ELSE 'ok'
  END as freshness_status
FROM mrd_sources s
WHERE s.is_active = TRUE;
```

**Seed data for sources:**
```javascript
// src/db/seed-sources.js

const SOURCES = [
  {
    source_key: 'pubmed',
    source_type: 'literature',
    display_name: 'PubMed (NCBI)',
    base_url: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
    access_method: 'api',
    change_detector: 'last-modified',
    expected_cadence: 'daily',
    stale_threshold_days: 2,
  },
  {
    source_key: 'clinicaltrials',
    source_type: 'trials',
    display_name: 'ClinicalTrials.gov',
    base_url: 'https://clinicaltrials.gov/api/v2/',
    access_method: 'api',
    change_detector: 'last-modified',
    expected_cadence: 'daily',
    stale_threshold_days: 2,
  },
  {
    source_key: 'fda-drugs',
    source_type: 'regulatory',
    display_name: 'FDA Drug Approvals',
    base_url: 'https://www.fda.gov/.../drugs/rss.xml',
    access_method: 'rss',
    change_detector: 'guid',
    expected_cadence: 'daily',
    stale_threshold_days: 3,
  },
  {
    source_key: 'nccn-colorectal',
    source_type: 'guideline',
    display_name: 'NCCN Colorectal Cancer',
    base_url: 'https://www.nccn.org/guidelines/...',
    access_method: 'manual',
    change_detector: 'version-string',
    expected_cadence: 'quarterly',
    stale_threshold_days: 120,
    tos_constraints: 'Requires authenticated download, redistribution prohibited',
  },
  // ... more sources
];
```

**Acceptance Criteria:**
- [ ] All sources have registry entries
- [ ] Releases are tracked separately from crawler runs
- [ ] Stale source alerts can fire based on threshold

---

### P1.2: Drop-to-Ingest for Guidelines

**Problem:** NCCN and other PDF guidelines require manual download due to ToS. Current workflow is ad-hoc.

**Solution:** Watch folder + auto-detect + version + supersede.

**Implementation:**

```javascript
// src/crawlers/guideline-watcher.js

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from '../db/client.js';
import { processNccnPdf } from './processors/nccn.js';
import { processSocietyGuideline } from './processors/society.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('guideline-watcher');

const WATCH_DIRS = {
  nccn: './data/guidelines/nccn/',
  asco: './data/guidelines/asco/',
  esmo: './data/guidelines/esmo/',
};

export async function scanForNewGuidelines() {
  const results = { processed: 0, skipped: 0, errors: [] };

  for (const [sourceType, dir] of Object.entries(WATCH_DIRS)) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = fs.statSync(filePath);
      const content = fs.readFileSync(filePath);
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      // Check if already processed
      const existing = await query(
        'SELECT id FROM mrd_artifacts WHERE sha256 = $1',
        [hash]
      );

      if (existing.rows.length > 0) {
        results.skipped++;
        continue;
      }

      try {
        // Extract version from filename or content
        const version = extractVersionFromFilename(file);

        // Find and supersede previous version
        const previousVersion = await query(`
          SELECT id FROM mrd_artifacts
          WHERE source_type = $1
            AND source_identifier LIKE $2
            AND is_current = TRUE
          ORDER BY created_at DESC
          LIMIT 1
        `, [sourceType, `%${getBaseGuideline(file)}%`]);

        if (previousVersion.rows.length > 0) {
          await query(`
            UPDATE mrd_artifacts SET is_current = FALSE, superseded_by_id = NULL
            WHERE id = $1
          `, [previousVersion.rows[0].id]);
        }

        // Process the guideline
        let result;
        if (sourceType === 'nccn') {
          result = await processNccnPdf(filePath);
        } else {
          result = await processSocietyGuideline(filePath);
        }

        // Record artifact
        await query(`
          INSERT INTO mrd_artifacts (
            source_type, source_identifier, sha256, file_size, content_type,
            version_string, is_current, processed_at, items_extracted
          ) VALUES ($1, $2, $3, $4, 'application/pdf', $5, TRUE, NOW(), $6)
        `, [sourceType, file, hash, stats.size, version, result.itemsAdded || 0]);

        // Record release
        await recordRelease(sourceType, version, hash, result.itemsAdded);

        logger.info(`Processed guideline: ${file}`, { version, items: result.itemsAdded });
        results.processed++;

      } catch (error) {
        logger.error(`Failed to process guideline: ${file}`, { error: error.message });
        results.errors.push({ file, error: error.message });
      }
    }
  }

  return results;
}

function extractVersionFromFilename(filename) {
  // Match patterns like "v2.2025", "Version 3.2024", "2025-v1"
  const patterns = [
    /v(\d+\.\d{4})/i,
    /version[_\s-]?(\d+\.\d{4})/i,
    /(\d{4})[_\s-]v(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) return match[1];
  }

  // Fall back to modification date
  return new Date().toISOString().split('T')[0];
}

function getBaseGuideline(filename) {
  // Extract base guideline name (e.g., "colon" from "nccn-colon-v2.2025.pdf")
  return filename.replace(/[-_]v?\d+\.?\d*\.pdf$/i, '');
}
```

**Add to scheduler:**
```javascript
// In scheduler.js
scheduleJob('guideline-scan', '0 */4 * * *', scanForNewGuidelines); // Every 4 hours
```

**Acceptance Criteria:**
- [ ] Dropping PDF into folder triggers processing within 4 hours
- [ ] Previous versions auto-superseded
- [ ] Duplicate files (same hash) skipped
- [ ] Alert when expected update is overdue

---

### P1.3: Tighten ClinicalTrials.gov Cadence

**Problem:** Weekly crawl misses status changes that can happen any day.

**Solution:** Change to daily incremental with lastUpdatePostDate filter.

**Implementation:**

```javascript
// In src/config.js
schedules: {
  // Change from weekly to daily
  clinicaltrials: process.env.TRIALS_SCHEDULE || '0 8 * * *', // Daily 8 AM (was '0 8 * * 1')
}

// In src/crawlers/clinicaltrials.js - add incremental mode
export async function crawlClinicalTrials(options = {}) {
  const { maxResults = 200, mode = 'incremental' } = options;

  // Get high water mark for incremental crawl
  let lastUpdateFilter = '';
  if (mode === 'incremental') {
    const hwm = await getHighWaterMark('clinicaltrials');
    if (hwm?.last_date) {
      lastUpdateFilter = `&filter.advanced=AREA[LastUpdatePostDate]RANGE[${hwm.last_date},MAX]`;
    }
  }

  // ... rest of crawl logic
}
```

**Acceptance Criteria:**
- [ ] Daily incremental pulls for status changes
- [ ] Only fetches trials updated since last run
- [ ] Priority trials checked more frequently if desired

---

## P2: Extraction Quality & Coverage

### P2.1: Expand Tumor/Term Ontology

**Problem:** Hardcoded term lists miss synonyms and variants.

**Solution:** External config file + synonym mapping.

**Implementation:**

```javascript
// src/config/oncology-terms.js

export const CANCER_TYPE_ONTOLOGY = {
  colorectal: {
    canonical: 'colorectal',
    synonyms: ['colon', 'rectal', 'crc', 'colorectal cancer', 'colon cancer', 'rectal cancer'],
    icd10: ['C18', 'C19', 'C20'],
  },
  breast: {
    canonical: 'breast',
    synonyms: ['breast cancer', 'mammary', 'triple negative', 'tnbc', 'her2+', 'hr+'],
    icd10: ['C50'],
  },
  lung: {
    canonical: 'lung',
    synonyms: ['nsclc', 'non-small cell', 'sclc', 'small cell', 'lung cancer', 'pulmonary'],
    icd10: ['C34'],
  },
  bladder: {
    canonical: 'bladder',
    synonyms: ['urothelial', 'transitional cell', 'bladder cancer', 'uc'],
    icd10: ['C67'],
  },
  gastric: {
    canonical: 'gastric',
    synonyms: ['stomach', 'gastroesophageal', 'gej', 'gastric cancer', 'esophagogastric'],
    icd10: ['C16'],
  },
  // ... more types
};

export const MRD_TERM_ONTOLOGY = {
  primary: [
    'minimal residual disease', 'molecular residual disease', 'mrd',
    'circulating tumor dna', 'ctdna', 'ct-dna',
    'cell-free dna', 'cfdna', 'cf-dna',
    'liquid biopsy', 'liquid biopsies',
    'tumor-informed', 'tumor informed',
    'molecular relapse', 'molecular recurrence',
  ],
  context: [
    'surveillance', 'monitoring', 'recurrence detection',
    'adjuvant', 'neoadjuvant', 'treatment response',
    'detectable', 'undetectable', 'clearance',
  ],
  tests: [
    'signatera', 'guardant reveal', 'foundationone tracker',
    'caris assure', 'tempus', 'personalis',
  ],
};

export function normalizeCancerType(text) {
  const lower = text.toLowerCase();
  for (const [canonical, { synonyms }] of Object.entries(CANCER_TYPE_ONTOLOGY)) {
    if (synonyms.some(s => lower.includes(s))) {
      return canonical;
    }
  }
  return null;
}

export function expandSearchTerms(term) {
  // Return term + all synonyms for broader search
  const entry = Object.values(CANCER_TYPE_ONTOLOGY).find(
    e => e.canonical === term || e.synonyms.includes(term)
  );
  return entry ? [entry.canonical, ...entry.synonyms] : [term];
}
```

**Update prefilter to use ontology:**
```javascript
// In src/triage/mrd-prefilter.js
import { CANCER_TYPE_ONTOLOGY, MRD_TERM_ONTOLOGY, normalizeCancerType } from '../config/oncology-terms.js';

const PRIMARY_TERMS = MRD_TERM_ONTOLOGY.primary;
const CONTEXT_TERMS = MRD_TERM_ONTOLOGY.context;
const SOLID_TUMOR_TERMS = Object.values(CANCER_TYPE_ONTOLOGY).flatMap(e => e.synonyms);
```

**Acceptance Criteria:**
- [ ] Ontology is external config, not hardcoded
- [ ] Synonyms expand search coverage
- [ ] Cancer types normalize to canonical form
- [ ] Easy to add new terms without code changes

---

### P2.2: Gold-Set Extraction Tests

**Problem:** No way to measure extraction quality over time.

**Solution:** Curated test sets with expected outputs.

**Implementation:**

```javascript
// tests/gold-sets/nccn-colorectal.json
{
  "source": "nccn-colorectal-v2.2025.pdf",
  "expectedExtractions": [
    {
      "type": "recommendation",
      "cancerType": "colorectal",
      "clinicalSetting": "surveillance",
      "evidenceLevel": "2A",
      "keyQuote": "ctDNA testing may be considered for surveillance",
      "mustContain": ["ctDNA", "surveillance", "Category 2A"]
    },
    {
      "type": "recommendation",
      "cancerType": "colorectal",
      "clinicalSetting": "adjuvant",
      "evidenceLevel": "2A",
      "keyQuote": "ctDNA may be used to identify patients",
      "mustContain": ["adjuvant", "therapy", "ctDNA"]
    }
  ]
}

// tests/extraction-quality.test.js
import { describe, it, expect } from 'vitest';
import { processNccnPdf } from '../src/crawlers/processors/nccn.js';
import goldSets from './gold-sets/index.js';

describe('Extraction Quality', () => {
  for (const [sourceName, goldSet] of Object.entries(goldSets)) {
    describe(sourceName, () => {
      it('extracts expected recommendations', async () => {
        const result = await processNccnPdf(goldSet.source);

        for (const expected of goldSet.expectedExtractions) {
          const found = result.items.find(item =>
            expected.mustContain.every(term =>
              item.summary?.toLowerCase().includes(term.toLowerCase()) ||
              item.keyFindings?.some(f => f.toLowerCase().includes(term.toLowerCase()))
            )
          );

          expect(found, `Missing: ${expected.keyQuote}`).toBeDefined();
          expect(found.cancerType).toBe(expected.cancerType);
          expect(found.clinicalSetting).toBe(expected.clinicalSetting);
        }
      });

      it('captures anchored quotes', async () => {
        const result = await processNccnPdf(goldSet.source);

        for (const expected of goldSet.expectedExtractions) {
          if (expected.keyQuote) {
            const hasQuote = result.items.some(item =>
              item.directQuote?.includes(expected.keyQuote.substring(0, 30))
            );
            expect(hasQuote, `Missing quote: ${expected.keyQuote}`).toBe(true);
          }
        }
      });
    });
  }
});
```

**Gold set targets:**
- 25 NCCN recommendations (across 5 cancer types)
- 25 PubMed abstracts (mix of RCTs, meta-analyses, reviews)
- 10 CMS LCD coverage statements
- 10 FDA approval items

**Acceptance Criteria:**
- [ ] Gold sets cover all major source types
- [ ] Tests run in CI
- [ ] Extraction accuracy >90% on gold set
- [ ] Quote anchoring accuracy >85%

---

### P2.3: Open-Access Full Text Ingestion

**Problem:** Abstract-only limits quote coverage and retrieval specificity.

**Solution:** Fetch PMC full text when available.

**Implementation:**

```javascript
// src/crawlers/pubmed.js - add full text fetching

async function fetchFullTextIfAvailable(pmid) {
  // Check for PMC ID
  const linkUrl = `${EUTILS_BASE}/elink.fcgi?dbfrom=pubmed&db=pmc&id=${pmid}&retmode=json`;
  const linkResponse = await axios.get(linkUrl);

  const pmcId = linkResponse.data?.linksets?.[0]?.linksetdbs
    ?.find(db => db.dbto === 'pmc')?.links?.[0];

  if (!pmcId) return null;

  // Fetch full text XML from PMC
  const fullTextUrl = `https://www.ncbi.nlm.nih.gov/pmc/oai/oai.cgi?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:${pmcId}&metadataPrefix=pmc`;

  try {
    const response = await axios.get(fullTextUrl, { timeout: 30000 });
    const bodyMatch = response.data.match(/<body>([\s\S]*?)<\/body>/i);

    if (bodyMatch) {
      // Strip XML tags, keep text
      const fullText = bodyMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        pmcId: `PMC${pmcId}`,
        fullText: fullText.substring(0, 50000), // Limit size
        isOpenAccess: true,
      };
    }
  } catch (error) {
    // Full text not available or error - continue with abstract only
  }

  return null;
}

// In article processing
if (article.pmid) {
  const fullText = await fetchFullTextIfAvailable(article.pmid);
  if (fullText) {
    article.fullTextExcerpt = fullText.fullText;
    article.pmcId = fullText.pmcId;
    article.isOpenAccess = true;
  }
}
```

**Acceptance Criteria:**
- [ ] PMC full text fetched when available
- [ ] Full text stored in `full_text_excerpt` column
- [ ] Embeddings generated from full text (better retrieval)
- [ ] Respects rate limits and ToS

---

## P1.4: Version Watch + Nag for Guidelines

**Problem:** We don't know when NCCN/ASCO update until someone manually checks.

**Solution:** Scrape version strings from public landing pages, alert when changed.

**Implementation:**

```javascript
// src/crawlers/version-watcher.js

import axios from 'axios';
import * as cheerio from 'cheerio';
import { query } from '../db/client.js';
import { sendEmail } from '../email/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('version-watcher');

const GUIDELINE_PAGES = [
  {
    source_key: 'nccn-colorectal',
    url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1428',
    versionSelector: '.guideline-version',
    versionPattern: /Version\s*(\d+\.\d{4})/i,
  },
  {
    source_key: 'nccn-breast',
    url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419',
    versionSelector: '.guideline-version',
    versionPattern: /Version\s*(\d+\.\d{4})/i,
  },
  // ... more guidelines
];

export async function checkGuidelineVersions() {
  const results = { checked: 0, changed: 0, alerts: [] };

  for (const config of GUIDELINE_PAGES) {
    try {
      const response = await axios.get(config.url, {
        timeout: 30000,
        headers: { 'User-Agent': 'OpenOnco-Version-Watcher/1.0' },
      });

      const $ = cheerio.load(response.data);
      const versionText = $(config.versionSelector).text();
      const match = versionText.match(config.versionPattern);
      const currentVersion = match ? match[1] : null;

      if (!currentVersion) {
        logger.warn(`Could not extract version for ${config.source_key}`);
        continue;
      }

      // Check against stored version
      const source = await query(
        'SELECT id, version_string FROM mrd_sources WHERE source_key = $1',
        [config.source_key]
      );

      const storedVersion = source.rows[0]?.version_string;

      if (storedVersion && storedVersion !== currentVersion) {
        // Version changed!
        results.changed++;
        results.alerts.push({
          source: config.source_key,
          oldVersion: storedVersion,
          newVersion: currentVersion,
        });

        // Update source and send alert
        await query(
          'UPDATE mrd_sources SET version_string = $1, last_checked_at = NOW() WHERE source_key = $2',
          [currentVersion, config.source_key]
        );

        await sendEmail({
          subject: `🔔 New guideline version: ${config.source_key} ${currentVersion}`,
          text: `A new version of ${config.source_key} is available.\n\nOld: ${storedVersion}\nNew: ${currentVersion}\n\nPlease download and place in the guidelines folder.`,
          html: `<p>A new version of <strong>${config.source_key}</strong> is available.</p>
                 <p>Old: ${storedVersion}<br>New: ${currentVersion}</p>
                 <p>Please download and place in the guidelines folder.</p>`,
        });

        logger.info(`Version change detected: ${config.source_key} ${storedVersion} → ${currentVersion}`);
      } else {
        // No change, update last checked
        await query(
          'UPDATE mrd_sources SET last_checked_at = NOW() WHERE source_key = $1',
          [config.source_key]
        );
      }

      results.checked++;

    } catch (error) {
      logger.error(`Failed to check version for ${config.source_key}`, { error: error.message });
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return results;
}
```

**Add to scheduler:**
```javascript
scheduleJob('version-watch', '0 12 * * *', checkGuidelineVersions); // Daily noon
```

**Acceptance Criteria:**
- [ ] Public landing pages checked daily
- [ ] Email alert when version changes
- [ ] Human downloads PDF, drops in folder
- [ ] Total time from release to ingestion: <24 hours

---

## P1.5: Enhanced /health Endpoint

**Problem:** Current /health just shows counts. Need freshness, backlog, quality metrics.

**Solution:** Expand health endpoint with operational metrics.

**Implementation:**

```javascript
// In src/chat/server.js - enhance /health

app.get('/health', async (req, res) => {
  try {
    const [
      counts,
      crawlerStatus,
      embedBacklog,
      staleSources,
      recentQuality,
    ] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*) FROM mrd_guidance_items) as guidance_items,
          (SELECT COUNT(*) FROM mrd_clinical_trials) as clinical_trials,
          (SELECT COUNT(*) FROM mrd_item_embeddings) as embeddings
      `),
      query(`
        SELECT
          crawler_name,
          status,
          completed_at,
          items_new,
          error_message
        FROM mrd_crawler_runs
        WHERE id IN (
          SELECT MAX(id) FROM mrd_crawler_runs GROUP BY crawler_name
        )
      `),
      query(`
        SELECT COUNT(*) as count
        FROM mrd_guidance_items g
        LEFT JOIN mrd_item_embeddings e ON g.id = e.guidance_id
        WHERE e.id IS NULL
      `),
      query(`SELECT * FROM v_stale_sources WHERE freshness_status != 'ok'`),
      // Quality: % of recent answers with 3+ citations
      query(`
        SELECT
          COUNT(*) FILTER (WHERE jsonb_array_length(sources) >= 3) as good,
          COUNT(*) as total
        FROM mrd_chat_logs
        WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
    ]);

    const crawlers = {};
    for (const row of crawlerStatus.rows) {
      const ageHours = row.completed_at
        ? Math.round((Date.now() - new Date(row.completed_at).getTime()) / 3600000)
        : null;

      crawlers[row.crawler_name] = {
        status: row.status,
        lastRun: row.completed_at,
        ageHours,
        itemsNew: row.items_new,
        isStale: ageHours > 48,
        error: row.error_message,
      };
    }

    const qualityPercent = recentQuality.rows[0]?.total > 0
      ? Math.round((recentQuality.rows[0].good / recentQuality.rows[0].total) * 100)
      : null;

    res.json({
      status: 'ok',
      service: 'mrd-chat-api',
      database: counts.rows[0],
      crawlers,
      backlog: {
        embeddingsMissing: parseInt(embedBacklog.rows[0]?.count || 0),
      },
      staleSources: staleSources.rows.map(s => ({
        key: s.source_key,
        daysSinceRelease: s.days_since_release,
      })),
      quality: {
        recentAnswersWithCitations: qualityPercent,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});
```

**Acceptance Criteria:**
- [ ] Per-crawler last run + staleness flag
- [ ] Embedding backlog count
- [ ] Stale sources list
- [ ] Quality metric (% answers with citations)

---

## P2.4: Chat Response Template Enforcement

**Problem:** Response format varies; not consistently separating evidence from advice.

**Solution:** Enforce structured template in prompt and post-processing.

**Implementation:**

```javascript
// src/chat/response-template.js

export const RESPONSE_TEMPLATE = `
WHAT THE EVIDENCE SAYS:
{evidence_summary_with_citations}

GUIDELINE RECOMMENDATIONS:
{guideline_summary_if_present}

CLINICAL CONSIDERATIONS:
{considerations_as_questions_not_directives}

LIMITATIONS:
{what_evidence_does_not_address}

---
Evidence levels: {evidence_levels_cited}
Most recent source: {most_recent_date}
`;

export const RESPONSE_PROMPT_ADDITION = `
Structure your response using this exact format:

WHAT THE EVIDENCE SAYS:
Summarize key findings with inline citations [1], [2]. Every clinical claim must have a citation.

GUIDELINE RECOMMENDATIONS:
If NCCN or other guidelines are in sources, quote their specific recommendations. If no guidelines, state "No guideline recommendations in indexed sources."

CLINICAL CONSIDERATIONS:
List 2-3 considerations clinicians often weigh, phrased as questions:
- "What is the patient's baseline recurrence risk?"
- "Are there contraindications to adjuvant therapy?"
Do NOT give directives like "you should" or "recommend starting".

LIMITATIONS:
Explicitly state what the indexed evidence does not address for this query.

At the end, include:
- Evidence levels for key claims (e.g., "NCCN Category 2A", "Phase 3 RCT")
- Date of most recent cited source

FORBIDDEN:
- No patient-specific treatment recommendations
- No "you should start/stop therapy" language
- No interpretation of individual MRD results without clinical context
- No claims without citations

ALLOWED:
- "Evidence suggests..."
- "Guidelines state..."
- "Clinicians often consider..."
- "Discuss with the treating team..."
`;
```

**Post-processing validation:**
```javascript
export function validateResponseStructure(response) {
  const required = [
    'WHAT THE EVIDENCE SAYS:',
    'LIMITATIONS:',
  ];

  const forbidden = [
    /you should (start|stop|begin|discontinue)/i,
    /I recommend/i,
    /your (tumor|cancer|result|test) (shows|indicates|means)/i,
  ];

  const issues = [];

  for (const section of required) {
    if (!response.includes(section)) {
      issues.push(`Missing required section: ${section}`);
    }
  }

  for (const pattern of forbidden) {
    if (pattern.test(response)) {
      issues.push(`Contains forbidden language: ${pattern}`);
    }
  }

  return { valid: issues.length === 0, issues };
}
```

**Acceptance Criteria:**
- [ ] All responses follow template
- [ ] No directive language passes validation
- [ ] Evidence separated from considerations
- [ ] Limitations explicitly stated

---

## Implementation Roadmap

### Week 1: P0 (Safety)
- [ ] P0.1: Citation validator + rewrite loop
- [ ] P0.2: Distributed locks + stuck detection
- [ ] P0.3: Anchored quote storage

### Week 2: P1 Core (Automation)
- [ ] P1.1: Source registry + release ledger (migrations + seed)
- [ ] P1.2: Drop-to-ingest folder watcher
- [ ] P1.3: Daily ClinicalTrials.gov incremental

### Week 3: P1 Extended (Monitoring)
- [ ] P1.4: Version watcher for guidelines
- [ ] P1.5: Enhanced /health endpoint
- [ ] Update daily AI report to use new metrics

### Week 4: P2 (Quality)
- [ ] P2.1: Ontology config file
- [ ] P2.2: Gold set tests (start with 10 per type)
- [ ] P2.3: PMC full text ingestion
- [ ] P2.4: Response template enforcement

### Ongoing
- [ ] Expand gold sets
- [ ] Add more sources to registry
- [ ] Monitor quality metrics
- [ ] Refine ontology based on misses

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Sources with registry entry | 0 | 15+ |
| Releases tracked (not just runs) | 0 | All |
| Citation compliance | Unknown | 100% |
| Anchored quotes | ~0% | >80% |
| Extraction accuracy (gold set) | Unknown | >90% |
| Stale source alerts | None | Within 24h |
| Time guideline→ingested | Days | <24h |
| Overlapping job runs | Possible | 0 |

---

*Plan created: February 2, 2026*
*Next review: After Week 1 implementation*
