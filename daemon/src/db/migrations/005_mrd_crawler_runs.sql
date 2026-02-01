-- MRD Crawler Runs: Track crawler execution history and high water marks
-- Migration 005: Crawler tracking for incremental crawls

CREATE TABLE mrd_crawler_runs (
  id SERIAL PRIMARY KEY,
  crawler_name VARCHAR(50) NOT NULL,  -- pubmed, clinicaltrials, fda, cms
  mode VARCHAR(20) NOT NULL,          -- seed, backfill, incremental, catchup

  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) NOT NULL,        -- running, completed, failed

  -- High water marks for incremental crawls
  high_water_mark JSONB,              -- {"last_date": "2026-01-30", "last_id": "12345678"}

  -- Stats
  items_found INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  items_duplicate INTEGER DEFAULT 0,
  items_rejected INTEGER DEFAULT 0,

  -- Timing
  duration_seconds INTEGER,

  error_message TEXT,

  -- Config snapshot
  config JSONB                        -- Search params used
);

CREATE INDEX idx_crawler_runs_name ON mrd_crawler_runs(crawler_name, started_at DESC);
CREATE INDEX idx_crawler_runs_status ON mrd_crawler_runs(status);
CREATE INDEX idx_crawler_runs_completed ON mrd_crawler_runs(crawler_name, completed_at DESC)
  WHERE status = 'completed';

-- Function to get last high water mark for a crawler
CREATE OR REPLACE FUNCTION get_crawler_high_water_mark(p_crawler_name VARCHAR(50))
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT high_water_mark INTO result
  FROM mrd_crawler_runs
  WHERE crawler_name = p_crawler_name
    AND status = 'completed'
    AND high_water_mark IS NOT NULL
  ORDER BY completed_at DESC
  LIMIT 1;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to detect gaps in crawler runs (for catch-up mode)
CREATE OR REPLACE FUNCTION detect_crawler_gaps(
  p_crawler_name VARCHAR(50),
  p_max_gap_days INTEGER DEFAULT 2
)
RETURNS TABLE (
  gap_start TIMESTAMP WITH TIME ZONE,
  gap_end TIMESTAMP WITH TIME ZONE,
  gap_days FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH runs AS (
    SELECT started_at
    FROM mrd_crawler_runs
    WHERE crawler_name = p_crawler_name
      AND status = 'completed'
    ORDER BY started_at DESC
    LIMIT 30
  ),
  gaps AS (
    SELECT
      r1.started_at AS run1,
      LAG(r1.started_at) OVER (ORDER BY r1.started_at DESC) AS run2
    FROM runs r1
  )
  SELECT
    run1 AS gap_start,
    run2 AS gap_end,
    EXTRACT(EPOCH FROM (run2 - run1)) / 86400.0 AS gap_days
  FROM gaps
  WHERE run2 IS NOT NULL
    AND EXTRACT(EPOCH FROM (run2 - run1)) / 86400.0 > p_max_gap_days;
END;
$$ LANGUAGE plpgsql;
