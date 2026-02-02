-- Migration 011: Source Registry and Release Ledger
-- Tracks all data sources and their releases separately from crawler runs

-- Source registry: master list of all data sources
CREATE TABLE IF NOT EXISTS mrd_sources (
  id SERIAL PRIMARY KEY,
  source_key VARCHAR(50) UNIQUE NOT NULL,  -- e.g., 'pubmed', 'nccn-colorectal'
  source_type VARCHAR(50) NOT NULL,        -- literature, guideline, regulatory, trial, payer
  display_name VARCHAR(255) NOT NULL,

  -- Access configuration
  base_url TEXT,
  access_method VARCHAR(20) NOT NULL,      -- api, rss, scrape, manual
  auth_required BOOLEAN DEFAULT FALSE,
  tos_constraints TEXT,

  -- Change detection
  change_detector VARCHAR(50),             -- etag, last-modified, hash, version-string, guid
  expected_cadence VARCHAR(50),            -- daily, weekly, monthly, quarterly

  -- Ownership and alerting
  owner_email VARCHAR(255),
  alert_on_stale BOOLEAN DEFAULT TRUE,
  stale_threshold_days INTEGER DEFAULT 7,

  -- Status tracking
  is_active BOOLEAN DEFAULT TRUE,
  version_string VARCHAR(100),             -- Current version for guidelines
  last_checked_at TIMESTAMP,
  last_release_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Release ledger: tracks what changed, not just what ran
CREATE TABLE IF NOT EXISTS mrd_source_releases (
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
  artifact_id INTEGER,
  error_message TEXT,

  -- Diff tracking
  diff_summary JSONB,                      -- {added: N, updated: N, removed: N}

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_id, release_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sources_key ON mrd_sources(source_key);
CREATE INDEX IF NOT EXISTS idx_sources_type ON mrd_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_sources_active ON mrd_sources(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_releases_source_status ON mrd_source_releases(source_id, status);
CREATE INDEX IF NOT EXISTS idx_releases_observed ON mrd_source_releases(observed_at DESC);

-- View for stale sources
CREATE OR REPLACE VIEW v_stale_sources AS
SELECT
  s.*,
  EXTRACT(DAYS FROM NOW() - COALESCE(s.last_release_at, s.created_at))::INTEGER as days_since_release,
  CASE
    WHEN s.last_release_at IS NULL THEN 'never_released'
    WHEN EXTRACT(DAYS FROM NOW() - s.last_release_at) > s.stale_threshold_days THEN 'stale'
    ELSE 'ok'
  END as freshness_status
FROM mrd_sources s
WHERE s.is_active = TRUE;

-- View for release summary by source
CREATE OR REPLACE VIEW v_source_release_summary AS
SELECT
  s.source_key,
  s.display_name,
  s.source_type,
  s.expected_cadence,
  s.last_release_at,
  COUNT(r.id) as total_releases,
  COUNT(r.id) FILTER (WHERE r.status = 'processed') as processed_releases,
  COUNT(r.id) FILTER (WHERE r.status = 'failed') as failed_releases,
  MAX(r.items_extracted) as max_items_extracted,
  SUM(COALESCE(r.items_extracted, 0)) as total_items_extracted
FROM mrd_sources s
LEFT JOIN mrd_source_releases r ON s.id = r.source_id
GROUP BY s.id, s.source_key, s.display_name, s.source_type, s.expected_cadence, s.last_release_at
ORDER BY s.source_type, s.source_key;

-- Function to record a new release
CREATE OR REPLACE FUNCTION record_source_release(
  p_source_key VARCHAR(50),
  p_release_key VARCHAR(255),
  p_detector VARCHAR(50) DEFAULT 'api',
  p_content_hash VARCHAR(64) DEFAULT NULL,
  p_version_string VARCHAR(100) DEFAULT NULL,
  p_release_date DATE DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  v_source_id INTEGER;
  v_release_id INTEGER;
BEGIN
  -- Get source ID
  SELECT id INTO v_source_id FROM mrd_sources WHERE source_key = p_source_key;
  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'Unknown source: %', p_source_key;
  END IF;

  -- Insert or get existing release
  INSERT INTO mrd_source_releases (
    source_id, release_key, detector, content_hash, version_string, release_date
  ) VALUES (
    v_source_id, p_release_key, p_detector, p_content_hash, p_version_string, p_release_date
  )
  ON CONFLICT (source_id, release_key) DO UPDATE
    SET observed_at = NOW()
  RETURNING id INTO v_release_id;

  -- Update source last checked
  UPDATE mrd_sources
  SET last_checked_at = NOW(),
      version_string = COALESCE(p_version_string, version_string)
  WHERE id = v_source_id;

  RETURN v_release_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark release as processed
CREATE OR REPLACE FUNCTION mark_release_processed(
  p_release_id INTEGER,
  p_items_extracted INTEGER DEFAULT 0,
  p_diff_summary JSONB DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_source_id INTEGER;
BEGIN
  UPDATE mrd_source_releases
  SET status = 'processed',
      processed_at = NOW(),
      items_extracted = p_items_extracted,
      diff_summary = p_diff_summary
  WHERE id = p_release_id
  RETURNING source_id INTO v_source_id;

  -- Update source last release timestamp
  UPDATE mrd_sources
  SET last_release_at = NOW(),
      updated_at = NOW()
  WHERE id = v_source_id;
END;
$$ LANGUAGE plpgsql;
