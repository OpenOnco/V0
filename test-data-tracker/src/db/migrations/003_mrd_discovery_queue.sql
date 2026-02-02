-- MRD Discovery Queue: Staging table for items from crawlers awaiting review
-- Migration 003: Discovery queue for AI triage

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
CREATE INDEX idx_discovery_ai_score ON mrd_discovery_queue(ai_relevance_score DESC)
  WHERE ai_relevance_score IS NOT NULL;

-- View for pending items in review interface
CREATE VIEW v_discovery_pending AS
SELECT
  d.*,
  d.raw_data->>'title' AS title_preview,
  d.raw_data->>'abstract' AS abstract_preview
FROM mrd_discovery_queue d
WHERE d.status IN ('pending', 'ai_triaged')
ORDER BY d.priority ASC, d.discovered_at ASC;
