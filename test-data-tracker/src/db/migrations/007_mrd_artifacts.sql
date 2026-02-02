-- Migration 007: Raw Artifact Storage
-- Stores raw files (PDFs, HTML) with versioning for auditability

-- Raw artifacts table
CREATE TABLE IF NOT EXISTS mrd_artifacts (
  id SERIAL PRIMARY KEY,
  source_type VARCHAR(50) NOT NULL,        -- 'nccn', 'asco', 'esmo', 'payer-criteria', etc.
  source_identifier TEXT NOT NULL,          -- Filename or URL
  sha256 VARCHAR(64) NOT NULL,              -- Content hash for change detection
  file_size INTEGER,
  content_type VARCHAR(100),                -- 'application/pdf', 'text/html'
  original_filename TEXT,

  -- Extracted content
  extracted_text TEXT,                      -- Full text extracted from PDF/HTML
  page_count INTEGER,

  -- Metadata from document
  metadata JSONB DEFAULT '{}',              -- Flexible metadata storage

  -- Version tracking
  effective_date DATE,                      -- When guideline takes effect
  revision_date DATE,                       -- When document was revised
  version_string VARCHAR(100),              -- e.g., "2.2024", "Version 3"

  -- Supersession chain
  supersedes_id INTEGER REFERENCES mrd_artifacts(id),
  superseded_by_id INTEGER REFERENCES mrd_artifacts(id),
  is_current BOOLEAN DEFAULT TRUE,

  -- Processing status
  processed_at TIMESTAMPTZ,
  processing_errors TEXT[],
  items_extracted INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_type, sha256)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_artifacts_source_current
  ON mrd_artifacts(source_type, is_current) WHERE is_current = TRUE;
CREATE INDEX IF NOT EXISTS idx_artifacts_hash
  ON mrd_artifacts(sha256);
CREATE INDEX IF NOT EXISTS idx_artifacts_effective_date
  ON mrd_artifacts(effective_date DESC);

-- Update trigger
CREATE OR REPLACE FUNCTION update_artifact_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS artifact_updated ON mrd_artifacts;
CREATE TRIGGER artifact_updated
  BEFORE UPDATE ON mrd_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION update_artifact_timestamp();

-- Comments
COMMENT ON TABLE mrd_artifacts IS 'Raw source artifacts (PDFs, HTML) with version tracking';
COMMENT ON COLUMN mrd_artifacts.sha256 IS 'SHA256 hash for detecting file changes';
COMMENT ON COLUMN mrd_artifacts.is_current IS 'FALSE if superseded by newer version';
