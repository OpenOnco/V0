# MRD Guidance Monitor: Database Schema

## Overview

PostgreSQL database storing curated MRD guidance items, clinical trials, and discovery queue.

---

## Entity Relationship Diagram

```
┌─────────────────────┐       ┌─────────────────────────┐
│  mrd_guidance_items │───┬───│ mrd_guidance_cancer_types│
│                     │   │   └─────────────────────────┘
│  • source_type      │   │   
│  • source_id        │   ├───┌─────────────────────────────┐
│  • title            │   │   │mrd_guidance_clinical_settings│
│  • publication_date │   │   └─────────────────────────────┘
│  • evidence_type    │   │
│  • summary          │   └───┌─────────────────────────┐
│                     │       │ mrd_guidance_questions  │
└─────────────────────┘       └─────────────────────────┘
          │
          │ superseded_by
          ▼
┌─────────────────────┐
│  (self-reference)   │
└─────────────────────┘

┌─────────────────────┐       ┌─────────────────────────┐
│ mrd_clinical_trials │───────│ mrd_trial_publications  │
│                     │       └─────────────────────────┘
│  • nct_number       │
│  • status           │
│  • cancer_types     │
│  • has_results      │
└─────────────────────┘

┌─────────────────────┐
│ mrd_discovery_queue │
│                     │
│  • raw_data         │
│  • ai_classification│
│  • status           │
└─────────────────────┘

┌─────────────────────┐
│ mrd_digest_subscribers│
│                     │
│  • email            │
│  • cancer_prefs     │
│  • frequency        │
└─────────────────────┘
```

---

## Core Tables

### `mrd_guidance_items`

Main table for approved, searchable guidance.

```sql
CREATE TABLE mrd_guidance_items (
  id SERIAL PRIMARY KEY,
  
  -- Source identification
  source_type VARCHAR(50) NOT NULL,
    -- Values: pubmed, clinicaltrials, nccn, cms_ncd, cms_lcd, asco, esmo, fda
  source_id VARCHAR(100),
    -- PMID, NCT number, LCD number, etc.
  source_url TEXT,
  
  -- Bibliographic metadata
  title TEXT NOT NULL,
  authors JSONB,
    -- Format: [{"name": "Smith J", "affiliation": "Mayo Clinic", "is_first": true, "is_last": false}]
  publication_date DATE,
  journal VARCHAR(255),
  doi VARCHAR(100),
  pmid VARCHAR(20),
  
  -- Classification
  evidence_type VARCHAR(50) NOT NULL,
    -- Values: guideline, consensus, rct_results, observational, 
    --         meta_analysis, review, regulatory, coverage_policy
  evidence_level VARCHAR(100),
    -- As stated in source, e.g., "NCCN Category 2A", "Level I", "Grade A"
  relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 10),
  
  -- Content
  summary TEXT,                      -- 2-3 sentence summary
  key_findings JSONB,                -- Structured findings
    -- Format: [{"finding": "...", "implication": "..."}]
  full_text_excerpt TEXT,            -- Relevant excerpt if available
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by VARCHAR(100),
  review_notes TEXT,
  
  -- Versioning / supersession
  is_superseded BOOLEAN DEFAULT FALSE,
  superseded_by INTEGER REFERENCES mrd_guidance_items(id),
  supersedes INTEGER REFERENCES mrd_guidance_items(id),
  
  -- Full-text search
  search_vector TSVECTOR,
  
  -- Constraints
  UNIQUE(source_type, source_id)
);

-- Indexes
CREATE INDEX idx_guidance_source ON mrd_guidance_items(source_type);
CREATE INDEX idx_guidance_date ON mrd_guidance_items(publication_date DESC);
CREATE INDEX idx_guidance_evidence ON mrd_guidance_items(evidence_type);
CREATE INDEX idx_guidance_relevance ON mrd_guidance_items(relevance_score DESC);
CREATE INDEX idx_guidance_search ON mrd_guidance_items USING GIN(search_vector);
CREATE INDEX idx_guidance_superseded ON mrd_guidance_items(is_superseded) WHERE is_superseded = FALSE;

-- Trigger to update search vector
CREATE OR REPLACE FUNCTION update_guidance_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.full_text_excerpt, '')), 'C');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guidance_search_vector_trigger
  BEFORE INSERT OR UPDATE ON mrd_guidance_items
  FOR EACH ROW EXECUTE FUNCTION update_guidance_search_vector();
```

### `mrd_guidance_cancer_types`

Many-to-many: guidance items to cancer types.

```sql
CREATE TABLE mrd_guidance_cancer_types (
  guidance_id INTEGER NOT NULL REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  cancer_type VARCHAR(50) NOT NULL,
    -- Values: colorectal, breast, lung_nsclc, lung_sclc, bladder, 
    --         pancreatic, melanoma, ovarian, gastric, esophageal,
    --         hepatocellular, prostate, renal, multi_solid
  PRIMARY KEY (guidance_id, cancer_type)
);

CREATE INDEX idx_guidance_cancer ON mrd_guidance_cancer_types(cancer_type);
```

### `mrd_guidance_clinical_settings`

Many-to-many: guidance items to clinical settings.

```sql
CREATE TABLE mrd_guidance_clinical_settings (
  guidance_id INTEGER NOT NULL REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  clinical_setting VARCHAR(50) NOT NULL,
    -- Values: screening, diagnosis, pre_surgery, post_surgery, 
    --         neoadjuvant, during_adjuvant, post_adjuvant, 
    --         surveillance, recurrence, metastatic
  PRIMARY KEY (guidance_id, clinical_setting)
);

CREATE INDEX idx_guidance_setting ON mrd_guidance_clinical_settings(clinical_setting);
```

### `mrd_guidance_questions`

Many-to-many: guidance items to clinical questions addressed.

```sql
CREATE TABLE mrd_guidance_questions (
  guidance_id INTEGER NOT NULL REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  question VARCHAR(50) NOT NULL,
    -- Values: when_to_test, which_test, positive_result_action,
    --         negative_result_action, test_frequency, de_escalation,
    --         escalation, prognosis, clinical_trial_eligibility
  PRIMARY KEY (guidance_id, question)
);

CREATE INDEX idx_guidance_question ON mrd_guidance_questions(question);
```

---

## Clinical Trials Table

### `mrd_clinical_trials`

Detailed tracking of interventional MRD trials.

```sql
CREATE TABLE mrd_clinical_trials (
  id SERIAL PRIMARY KEY,
  nct_number VARCHAR(20) UNIQUE NOT NULL,
  
  -- Basic info
  brief_title TEXT NOT NULL,
  official_title TEXT,
  acronym VARCHAR(100),              -- e.g., "CIRCULATE", "DYNAMIC"
  
  -- Classification
  cancer_types JSONB NOT NULL,       -- ["colorectal", "breast"]
  phase VARCHAR(20),                 -- "Phase 2", "Phase 3", etc.
  status VARCHAR(50) NOT NULL,
    -- Values: not_yet_recruiting, recruiting, enrolling_by_invitation,
    --         active_not_recruiting, suspended, terminated, 
    --         completed, withdrawn, unknown
  study_type VARCHAR(50),            -- "Interventional"
  
  -- Design
  intervention_summary TEXT,
  primary_endpoints JSONB,           -- [{"measure": "...", "timeframe": "..."}]
  secondary_endpoints JSONB,
  arms JSONB,                        -- [{"name": "...", "description": "..."}]
  masking VARCHAR(50),               -- "Open Label", "Double Blind", etc.
  allocation VARCHAR(50),            -- "Randomized", "Non-Randomized"
  
  -- Enrollment
  enrollment_target INTEGER,
  enrollment_actual INTEGER,
  
  -- Key dates
  start_date DATE,
  primary_completion_date DATE,
  primary_completion_type VARCHAR(20), -- "Actual" or "Anticipated"
  study_completion_date DATE,
  last_update_date DATE NOT NULL,
  
  -- Results
  has_results BOOLEAN DEFAULT FALSE,
  results_first_posted DATE,
  results_summary TEXT,              -- Our summary if results posted
  
  -- Publications
  linked_pmids JSONB,                -- ["12345678", "87654321"]
  
  -- Sponsor
  lead_sponsor VARCHAR(255),
  lead_sponsor_type VARCHAR(50),     -- "Industry", "Academic", "NIH", etc.
  collaborators JSONB,               -- ["NCI", "SWOG", ...]
  
  -- Contact
  overall_contact JSONB,             -- {name, email, phone}
  locations_count INTEGER,
  
  -- OpenOnco enrichment
  is_priority_trial BOOLEAN DEFAULT FALSE,
  clinical_significance TEXT,        -- Why this trial matters
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trial_status ON mrd_clinical_trials(status);
CREATE INDEX idx_trial_cancer ON mrd_clinical_trials USING GIN(cancer_types);
CREATE INDEX idx_trial_phase ON mrd_clinical_trials(phase);
CREATE INDEX idx_trial_priority ON mrd_clinical_trials(is_priority_trial) WHERE is_priority_trial = TRUE;
CREATE INDEX idx_trial_results ON mrd_clinical_trials(has_results) WHERE has_results = TRUE;
CREATE INDEX idx_trial_update ON mrd_clinical_trials(last_update_date DESC);
```

### `mrd_trial_status_history`

Track status changes over time.

```sql
CREATE TABLE mrd_trial_status_history (
  id SERIAL PRIMARY KEY,
  trial_id INTEGER NOT NULL REFERENCES mrd_clinical_trials(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_trial_history ON mrd_trial_status_history(trial_id, changed_at DESC);
```

---

## Discovery Queue

### `mrd_discovery_queue`

Staging table for items from crawlers awaiting review.

```sql
CREATE TABLE mrd_discovery_queue (
  id SERIAL PRIMARY KEY,
  
  -- Source info
  source_type VARCHAR(50) NOT NULL,
  source_id VARCHAR(100) NOT NULL,
  source_url TEXT,
  raw_data JSONB NOT NULL,           -- Full response from source API
  
  -- AI triage results
  ai_processed_at TIMESTAMP WITH TIME ZONE,
  ai_relevance_score INTEGER,
  ai_classification JSONB,
    -- Format: {
    --   cancer_types: [...],
    --   clinical_settings: [...],
    --   questions: [...],
    --   evidence_type: "...",
    --   evidence_level: "..."
    -- }
  ai_summary TEXT,
  ai_model VARCHAR(50),              -- "claude-sonnet-4-20250514", etc.
  
  -- Review status
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
    -- Values: pending, ai_triaged, approved, rejected, duplicate, deferred
  priority INTEGER DEFAULT 5,        -- 1 = highest, 10 = lowest
  
  -- Review tracking
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(100),
  rejection_reason TEXT,
  review_notes TEXT,
  
  -- Linking
  guidance_item_id INTEGER REFERENCES mrd_guidance_items(id),
  duplicate_of INTEGER REFERENCES mrd_discovery_queue(id),
  
  -- Metadata
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  crawler_run_id VARCHAR(100),       -- For tracking which crawl found this
  
  UNIQUE(source_type, source_id)
);

-- Indexes
CREATE INDEX idx_discovery_status ON mrd_discovery_queue(status);
CREATE INDEX idx_discovery_priority ON mrd_discovery_queue(priority, discovered_at);
CREATE INDEX idx_discovery_source ON mrd_discovery_queue(source_type);
CREATE INDEX idx_discovery_pending ON mrd_discovery_queue(status, priority) 
  WHERE status IN ('pending', 'ai_triaged');
```

---

## Digest Subscriptions

### `mrd_digest_subscribers`

Email subscribers for weekly digest.

```sql
CREATE TABLE mrd_digest_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  
  -- Preferences
  cancer_types JSONB,                -- null = all, or ["colorectal", "breast"]
  content_types JSONB,               -- null = all, or ["guideline", "trial"]
  frequency VARCHAR(20) DEFAULT 'weekly',
    -- Values: weekly, biweekly, monthly
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  
  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sent_at TIMESTAMP WITH TIME ZONE,
  send_count INTEGER DEFAULT 0,
  
  -- Security
  confirmation_token VARCHAR(100),
  unsubscribe_token VARCHAR(100) NOT NULL DEFAULT gen_random_uuid()
);

CREATE INDEX idx_subscriber_active ON mrd_digest_subscribers(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_subscriber_frequency ON mrd_digest_subscribers(frequency);
```

### `mrd_digest_history`

Track sent digests.

```sql
CREATE TABLE mrd_digest_history (
  id SERIAL PRIMARY KEY,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Content
  subject VARCHAR(255),
  item_count INTEGER,
  item_ids JSONB,                    -- [1, 2, 3, ...]
  
  -- Delivery
  subscriber_count INTEGER,
  delivered_count INTEGER,
  failed_count INTEGER,
  
  -- Preview
  html_preview TEXT                  -- Store rendered HTML for reference
);
```

---

## Crawler Tracking

### `mrd_crawler_runs`

Track crawler execution history.

```sql
CREATE TABLE mrd_crawler_runs (
  id SERIAL PRIMARY KEY,
  run_id VARCHAR(100) UNIQUE NOT NULL,
  
  crawler_name VARCHAR(50) NOT NULL,
    -- Values: pubmed, clinicaltrials, nccn, cms, asco, fda
  
  -- Timing
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  -- Results
  status VARCHAR(20) NOT NULL,
    -- Values: running, completed, failed, partial
  items_found INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  items_updated INTEGER DEFAULT 0,
  items_skipped INTEGER DEFAULT 0,
  
  -- Errors
  error_message TEXT,
  error_stack TEXT,
  
  -- Config snapshot
  config JSONB                       -- Search params used
);

CREATE INDEX idx_crawler_runs ON mrd_crawler_runs(crawler_name, started_at DESC);
```

---

## Views

### `v_guidance_with_tags`

Convenience view joining guidance with all tags.

```sql
CREATE VIEW v_guidance_with_tags AS
SELECT 
  g.*,
  COALESCE(
    (SELECT jsonb_agg(cancer_type) FROM mrd_guidance_cancer_types WHERE guidance_id = g.id),
    '[]'::jsonb
  ) AS cancer_types,
  COALESCE(
    (SELECT jsonb_agg(clinical_setting) FROM mrd_guidance_clinical_settings WHERE guidance_id = g.id),
    '[]'::jsonb
  ) AS clinical_settings,
  COALESCE(
    (SELECT jsonb_agg(question) FROM mrd_guidance_questions WHERE guidance_id = g.id),
    '[]'::jsonb
  ) AS questions_addressed
FROM mrd_guidance_items g
WHERE g.is_superseded = FALSE;
```

### `v_discovery_pending`

Pending items for review interface.

```sql
CREATE VIEW v_discovery_pending AS
SELECT 
  d.*,
  d.raw_data->>'title' AS title_preview
FROM mrd_discovery_queue d
WHERE d.status IN ('pending', 'ai_triaged')
ORDER BY d.priority ASC, d.discovered_at ASC;
```

---

## Sample Queries

```sql
-- Search guidance with filters
SELECT * FROM v_guidance_with_tags
WHERE 
  search_vector @@ plainto_tsquery('english', 'positive MRD adjuvant')
  AND cancer_types ? 'colorectal'
  AND questions_addressed ? 'positive_result_action'
ORDER BY relevance_score DESC, publication_date DESC
LIMIT 20;

-- Get priority trials with results
SELECT * FROM mrd_clinical_trials
WHERE is_priority_trial = TRUE
  AND has_results = TRUE
ORDER BY results_first_posted DESC;

-- Discovery queue stats
SELECT 
  source_type,
  status,
  COUNT(*) as count
FROM mrd_discovery_queue
GROUP BY source_type, status
ORDER BY source_type, status;

-- Recent guideline updates
SELECT * FROM mrd_guidance_items
WHERE evidence_type IN ('guideline', 'consensus')
  AND publication_date > NOW() - INTERVAL '30 days'
ORDER BY publication_date DESC;
```
