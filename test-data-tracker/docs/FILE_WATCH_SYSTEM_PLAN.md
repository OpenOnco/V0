# MRD Guidance Monitor — File Watch System & Source Expansion Plan

## Overview

Based on the architecture review, we need to:
1. Add a **watched files system** for manually-downloaded guideline PDFs (NCCN, ASCO, ESMO, etc.)
2. Expand **source coverage** to society guidelines and payer criteria
3. Add **raw artifact storage + versioning** for auditability
4. Improve **query understanding** and **non-prescriptive response formatting**

---

## Part 1: Watched Files System

### 1.1 Directory Structure

```
daemon/
├── watched-files/                    # Git-ignored, local storage for licensed/downloaded content
│   ├── nccn/                         # NCCN guidelines (licensed PDFs)
│   │   ├── colon-2024-v2.pdf
│   │   ├── breast-2024-v3.pdf
│   │   └── ...
│   ├── asco/                         # ASCO guidelines
│   ├── esmo/                         # ESMO consensus statements
│   ├── sitc/                         # SITC consensus documents
│   ├── cap-amp/                      # CAP/AMP laboratory guidance
│   └── payer-criteria/               # Carelon/eviCore UM PDFs
│       ├── carelon/
│       └── moldx/
│
├── data/
│   └── file-manifest.json            # Tracks processed files (committed)
```

### 1.2 File Manifest Schema

```json
{
  "version": "1.0",
  "lastScan": "2026-02-02T16:00:00Z",
  "files": {
    "nccn/colon-2024-v2.pdf": {
      "sha256": "abc123...",
      "size": 2456789,
      "lastModified": "2026-01-15T00:00:00Z",
      "processedAt": "2026-01-20T10:30:00Z",
      "sourceType": "nccn",
      "metadata": {
        "cancerType": "colorectal",
        "guidelineVersion": "2.2024",
        "effectiveDate": "2024-03-15",
        "itemsExtracted": 8,
        "guidanceItemIds": [9, 10, 11, 12, 32, 33, 34]
      }
    }
  },
  "sourceConfigs": {
    "nccn": {
      "processor": "nccn-processor",
      "requiresLicense": true,
      "autoProcess": true
    },
    "asco": {
      "processor": "society-guideline-processor",
      "requiresLicense": false,
      "autoProcess": true
    }
  }
}
```

### 1.3 File Watcher CLI Commands

```bash
# Scan for new/changed files (dry run)
npm run mrd:files -- scan --dry-run

# Process new/changed files
npm run mrd:files -- scan

# Force reprocess specific file
npm run mrd:files -- process nccn/colon-2024-v2.pdf --force

# List tracked files and status
npm run mrd:files -- list

# Show diff for changed file
npm run mrd:files -- diff nccn/colon-2024-v2.pdf
```

### 1.4 Implementation: `daemon/src/crawlers/mrd/file-watcher.js`

```javascript
/**
 * File Watcher for MRD Guidance Monitor
 *
 * Scans watched-files/ directory for new or changed PDFs,
 * processes them through appropriate extractors, and updates manifest.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { processNccnPdf } from './nccn-processor.js';
import { processSocietyGuideline } from './society-processor.js';
// ... other processors

const WATCHED_DIR = path.join(process.cwd(), 'watched-files');
const MANIFEST_PATH = path.join(process.cwd(), 'data', 'file-manifest.json');

const PROCESSORS = {
  nccn: processNccnPdf,
  asco: processSocietyGuideline,
  esmo: processSocietyGuideline,
  sitc: processSocietyGuideline,
  'cap-amp': processSocietyGuideline,
  'payer-criteria': processPayerCriteria,
};

export async function scanWatchedFiles(options = {}) {
  const { dryRun = false, force = false } = options;
  const manifest = loadManifest();
  const results = { new: [], changed: [], unchanged: [], processed: [] };

  // Recursively find all PDFs
  const files = findPdfFiles(WATCHED_DIR);

  for (const filePath of files) {
    const relativePath = path.relative(WATCHED_DIR, filePath);
    const sourceType = relativePath.split(path.sep)[0];
    const stats = fs.statSync(filePath);
    const hash = computeFileHash(filePath);

    const existing = manifest.files[relativePath];

    if (!existing) {
      results.new.push(relativePath);
    } else if (existing.sha256 !== hash) {
      results.changed.push(relativePath);
    } else if (!force) {
      results.unchanged.push(relativePath);
      continue;
    }

    if (!dryRun) {
      const processor = PROCESSORS[sourceType];
      if (processor) {
        const result = await processor(filePath, { sourceType });
        manifest.files[relativePath] = {
          sha256: hash,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          processedAt: new Date().toISOString(),
          sourceType,
          metadata: result,
        };
        results.processed.push(relativePath);
      }
    }
  }

  if (!dryRun) {
    manifest.lastScan = new Date().toISOString();
    saveManifest(manifest);
  }

  return results;
}

function computeFileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}
```

---

## Part 2: Source Expansion Priority

### Sources Best Served by File Downloads

| Source | Type | Access | Priority |
|--------|------|--------|----------|
| **NCCN** | Guidelines | Licensed PDFs (have) | ✅ Done |
| **ESMO** | Consensus PDFs | Public download | High |
| **ASCO** | Practice guidelines | Public PDFs | High |
| **SITC** | Consensus statements | Public PDFs | Medium |
| **CAP/AMP** | Lab guidance | Public PDFs | Medium |
| **Carelon/eviCore** | UM criteria | Public PDFs | Medium |
| **Medicare LCDs** | Coverage policy | CMS downloads | Medium |

### Sources Best Served by API/Web Crawling

| Source | Type | Access | Priority |
|--------|------|--------|----------|
| **PubMed** | Research | E-utilities API | ✅ Done |
| **ClinicalTrials.gov** | Trials | v2 API | ✅ Done |
| **FDA** | Approvals | RSS/API | Needs fix |
| **PubMed Central** | Full text | API | Add |
| **ASCO Post** | News/summaries | Web scrape | Low |

---

## Part 3: Raw Artifact Storage + Versioning

### 3.1 New Database Tables

```sql
-- Raw artifact storage for auditability
CREATE TABLE mrd_artifacts (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL,
  source_path TEXT NOT NULL,           -- Original file path or URL
  sha256 VARCHAR(64) NOT NULL,
  content_type VARCHAR(50),            -- application/pdf, text/html
  raw_content BYTEA,                   -- Stored if permitted by license
  text_content TEXT,                   -- Extracted text
  effective_date DATE,
  revision_date DATE,
  version_string VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_type, sha256)
);

-- Link guidance items to source artifacts
ALTER TABLE mrd_guidance_items ADD COLUMN artifact_id INTEGER REFERENCES mrd_artifacts(id);

-- Quote anchors for attribution
CREATE TABLE mrd_quote_anchors (
  id SERIAL PRIMARY KEY,
  guidance_id INTEGER REFERENCES mrd_guidance_items(id),
  artifact_id INTEGER REFERENCES mrd_artifacts(id),
  quote_text TEXT NOT NULL,
  page_number INTEGER,
  section_heading TEXT,
  char_offset INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Version Detection Pattern

```javascript
// Extract version info from PDF metadata and content
function extractVersionInfo(pdfText, filename) {
  const patterns = {
    // "Version 2.2024" or "V2.2024"
    version: /(?:version|v)\s*(\d+\.?\d*)/i,
    // "Effective: March 15, 2024"
    effectiveDate: /effective[:\s]+(\w+\s+\d{1,2},?\s+\d{4})/i,
    // "Last revised: January 2024"
    revisionDate: /(?:revised|updated|last\s+review)[:\s]+(\w+\s+\d{4})/i,
    // NCCN specific: "NCCN Guidelines Version 2.2024"
    nccnVersion: /NCCN\s+Guidelines?\s+Version\s+(\d+\.\d{4})/i,
  };

  return {
    version: match(pdfText, patterns.version) || extractFromFilename(filename),
    effectiveDate: parseDate(match(pdfText, patterns.effectiveDate)),
    revisionDate: parseDate(match(pdfText, patterns.revisionDate)),
  };
}
```

---

## Part 4: Decision-Support Data Model Enhancement

### 4.1 Schema Additions

```sql
ALTER TABLE mrd_guidance_items ADD COLUMN decision_context JSONB;
-- Structure:
-- {
--   "decision_point": "MRD positive post-resection",
--   "population": {"stage": "III", "tumor_type": "colorectal", "setting": "adjuvant"},
--   "test_context": {"assay_type": "tumor-informed", "timepoint": "4 weeks post-surgery"},
--   "options_discussed": ["intensified surveillance", "clinical trial enrollment", "adjuvant therapy consideration"],
--   "limitations": ["assay sensitivity varies", "lead time benefit unproven"],
--   "strength_of_evidence": "Category 2A"
-- }

ALTER TABLE mrd_guidance_items ADD COLUMN direct_quotes JSONB DEFAULT '[]';
-- Array of: {"text": "...", "page": 5, "section": "Surveillance"}
```

### 4.2 Extraction Template for Society Guidelines

```javascript
const DECISION_EXTRACTION_PROMPT = `
Extract clinical decision support information from this guideline section.
Focus on MRD/ctDNA-related content only.

For each recommendation found, extract:
1. decision_point: The clinical scenario (e.g., "MRD positive after curative resection")
2. population: Stage, tumor type, treatment setting
3. test_context: Assay type, timing, limitations mentioned
4. options_discussed: Actions mentioned (neutral list, not prescriptive)
5. direct_quote: Exact text supporting the finding
6. strength_of_evidence: As stated (e.g., "Category 2A", "Level I", "Expert consensus")

Return as JSON array. Do NOT add recommendations not in the source.
`;
```

---

## Part 5: Query Understanding Enhancement

### 5.1 Pre-Retrieval Intent Extraction

```javascript
// Before vector search, extract structured query intent
async function extractQueryIntent(userQuery) {
  const prompt = `
Analyze this clinical query and extract structured intent:
Query: "${userQuery}"

Return JSON:
{
  "cancer_type": "colorectal|breast|lung|bladder|...|unspecified",
  "clinical_setting": "post-surgery|adjuvant|surveillance|metastatic|unspecified",
  "stage": "I|II|III|IV|unspecified",
  "question_type": "positive_result_action|when_to_test|evidence_strength|payer_requirements|general",
  "source_preference": "guidelines_first|trials_first|balanced",
  "key_terms": ["ctDNA", "MRD", ...]
}`;

  return await extractWithHaiku(prompt);
}
```

### 5.2 Hybrid Retrieval Strategy

```javascript
async function hybridSearch(query, intent) {
  // 1. Vector similarity search
  const vectorResults = await vectorSearch(query, { limit: 20 });

  // 2. BM25 keyword search for exact terms
  const keywordResults = await keywordSearch(intent.key_terms, { limit: 20 });

  // 3. Merge and rerank
  const merged = mergeResults(vectorResults, keywordResults);

  // 4. Apply evidence tier boosting
  const reranked = applyEvidenceTierBoost(merged, intent.source_preference);
  // Guidelines: 1.5x, RCTs: 1.3x, Observational: 1.1x, Reviews: 1.0x

  // 5. Filter by intent
  return filterByIntent(reranked, intent);
}
```

---

## Part 6: Non-Prescriptive Response Contract

### 6.1 Output Schema

```javascript
const RESPONSE_SCHEMA = {
  query_restatement: "string",           // What you asked
  evidence_summary: [{                   // What sources say (bulleted, attributed)
    source: "string",
    source_type: "guideline|trial|study",
    finding: "string",                   // No imperatives unless quoting
    quote: "string",
    citation: "string"
  }],
  evidence_tiers: {                      // Grouped by strength
    guidelines: [],
    rcts: [],
    observational: [],
    reviews: []
  },
  operational_considerations: {          // Payer/UM as separate section
    coverage_notes: "string",
    documentation_requirements: "string"
  },
  uncertainties: ["string"],             // What's not clear
  discussion_prompts: ["string"],        // Questions clinicians commonly consider
  citations: [{ index, title, url, quote_anchor }],
  disclaimer: "string"
};
```

### 6.2 Response Validation Rules

```javascript
const RESPONSE_RULES = [
  // Ban prescriptive verbs unless in quotes
  {
    pattern: /\b(you should|must|recommend|start|stop|administer)\b/gi,
    allowed_in: 'quotes_only',
    replacement: 'Source X states that...'
  },
  // Require attribution for action claims
  {
    pattern: /\b(consider|may|option|approach)\b/gi,
    requires: 'citation_within_sentence'
  },
  // Minimum quote anchors for action questions
  {
    question_type: 'positive_result_action',
    min_quote_anchors: 2
  }
];
```

---

## Part 7: Implementation Phases

### Phase 1: File Watch System (This Week)
- [ ] Create `watched-files/` directory structure
- [ ] Implement file manifest system
- [ ] Create `file-watcher.js` with scan/process commands
- [ ] Add to existing NCCN processor
- [ ] Migration: add `artifact_id` to guidance items

### Phase 2: Artifact Storage (Next)
- [ ] Create `mrd_artifacts` table
- [ ] Create `mrd_quote_anchors` table
- [ ] Update processors to store raw artifacts
- [ ] Extract and store direct quotes with page numbers

### Phase 3: Society Guidelines (Week 2)
- [ ] Create `society-processor.js` for ASCO/ESMO/SITC
- [ ] Download and process initial ESMO MRD consensus
- [ ] Download and process ASCO ctDNA guidance
- [ ] Add decision_context extraction

### Phase 4: Query Enhancement (Week 3)
- [ ] Implement query intent extraction
- [ ] Add hybrid BM25 + vector search
- [ ] Implement evidence tier boosting
- [ ] Update response formatting

### Phase 5: Payer Criteria (Week 4)
- [ ] Create `payer-criteria-processor.js`
- [ ] Process Carelon oncology criteria
- [ ] Process relevant Medicare LCDs
- [ ] Separate operational vs clinical layers

---

## Part 8: Acceptance Tests

### Golden Query Set

```javascript
const GOLDEN_QUERIES = [
  {
    query: "Stage III colon cancer, ctDNA positive after adjuvant—what management options are discussed?",
    expected: {
      must_cite: ['NCCN Colorectal'],
      must_not_contain: ['you should', 'must start', 'recommend'],
      min_quotes: 2
    }
  },
  {
    query: "Bladder cancer post-cystectomy MRD positive—what evidence for adjuvant immunotherapy?",
    expected: {
      must_cite: ['NCCN Bladder'],
      evidence_types: ['guideline', 'trial']
    }
  },
  {
    query: "What do payer UM criteria require for MRD testing in solid tumors?",
    expected: {
      section: 'operational_considerations',
      must_distinguish: 'clinical vs coverage'
    }
  }
];
```

---

## Summary

This plan addresses the review's key gaps:
1. **Gap A (Missing guidelines)**: File watch system + society guideline processors
2. **Gap B (Action questions)**: Decision-support schema + query intent + non-prescriptive contract
3. **Gap C (No versioning)**: Artifact storage + hash tracking + quote anchors

Priority order: File watch → Artifact storage → Society guidelines → Query enhancement → Payer criteria
