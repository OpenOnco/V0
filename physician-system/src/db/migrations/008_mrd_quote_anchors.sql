-- Migration 008: Quote Anchors
-- Direct quotes from source documents with page/section anchors for attribution

CREATE TABLE IF NOT EXISTS mrd_quote_anchors (
  id SERIAL PRIMARY KEY,
  guidance_id INTEGER REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  artifact_id INTEGER REFERENCES mrd_artifacts(id) ON DELETE SET NULL,

  -- The quote itself
  quote_text TEXT NOT NULL,
  quote_type VARCHAR(50),                   -- 'recommendation', 'limitation', 'evidence', 'definition'

  -- Location in source
  page_number INTEGER,
  section_heading VARCHAR(500),
  subsection VARCHAR(500),

  -- Context for verification
  context_before TEXT,                      -- ~100 chars before quote
  context_after TEXT,                       -- ~100 chars after quote
  char_offset INTEGER,                      -- Position in extracted text

  -- Metadata
  is_verbatim BOOLEAN DEFAULT TRUE,         -- Exact quote vs paraphrased
  extraction_confidence FLOAT,              -- AI confidence in extraction

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_guidance ON mrd_quote_anchors(guidance_id);
CREATE INDEX IF NOT EXISTS idx_quotes_artifact ON mrd_quote_anchors(artifact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_type ON mrd_quote_anchors(quote_type);

-- Full text search on quotes
ALTER TABLE mrd_quote_anchors
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', quote_text)) STORED;

CREATE INDEX IF NOT EXISTS idx_quotes_search ON mrd_quote_anchors USING GIN(search_vector);

-- Comments
COMMENT ON TABLE mrd_quote_anchors IS 'Direct quotes from source documents for attribution';
COMMENT ON COLUMN mrd_quote_anchors.is_verbatim IS 'TRUE if exact quote, FALSE if paraphrased';
COMMENT ON COLUMN mrd_quote_anchors.context_before IS 'Surrounding text for quote verification';
