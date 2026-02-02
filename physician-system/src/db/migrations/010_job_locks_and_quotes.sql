-- Migration 010: Job locks, chat logs, and quote anchor enhancements
-- Adds heartbeat tracking for stuck run detection
-- Creates chat logs table for response quality tracking
-- Enhances quote_anchors with usage tracking

-- Enable pg_trgm for similarity matching (needed for upsert function)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add heartbeat column to crawler_runs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mrd_crawler_runs' AND column_name = 'heartbeat_at'
  ) THEN
    ALTER TABLE mrd_crawler_runs ADD COLUMN heartbeat_at TIMESTAMP;
  END IF;
END $$;

-- Add usage tracking columns to existing quote_anchors table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mrd_quote_anchors' AND column_name = 'usage_count'
  ) THEN
    ALTER TABLE mrd_quote_anchors ADD COLUMN usage_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mrd_quote_anchors' AND column_name = 'last_used_at'
  ) THEN
    ALTER TABLE mrd_quote_anchors ADD COLUMN last_used_at TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mrd_quote_anchors' AND column_name = 'chunk_index'
  ) THEN
    ALTER TABLE mrd_quote_anchors ADD COLUMN chunk_index INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create chat logs table for tracking response quality
CREATE TABLE IF NOT EXISTS mrd_chat_logs (
  id SERIAL PRIMARY KEY,

  -- Query info
  query_text TEXT NOT NULL,
  query_intent JSONB,

  -- Response info
  response_text TEXT,
  sources JSONB,  -- Array of source references used

  -- Quality metrics
  citation_count INTEGER DEFAULT 0,
  was_rewritten BOOLEAN DEFAULT FALSE,
  citation_violations INTEGER DEFAULT 0,

  -- Performance
  search_time_ms INTEGER,
  response_time_ms INTEGER,
  total_time_ms INTEGER,

  -- Client info (anonymized)
  client_ip_hash VARCHAR(64),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for quality analysis
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON mrd_chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_logs_quality ON mrd_chat_logs(citation_count, was_rewritten);

-- Function to record a quote anchor (upsert)
-- Uses existing schema with extraction_confidence column
CREATE OR REPLACE FUNCTION upsert_quote_anchor(
  p_guidance_id INTEGER,
  p_quote_text TEXT,
  p_chunk_index INTEGER DEFAULT 0,
  p_char_start INTEGER DEFAULT NULL,
  p_char_end INTEGER DEFAULT NULL,
  p_page_number INTEGER DEFAULT NULL,
  p_confidence DECIMAL DEFAULT 1.0
) RETURNS INTEGER AS $$
DECLARE
  v_id INTEGER;
BEGIN
  -- Try to find existing anchor with similar text
  SELECT id INTO v_id
  FROM mrd_quote_anchors
  WHERE guidance_id = p_guidance_id
    AND (
      quote_text = p_quote_text
      OR similarity(quote_text, p_quote_text) > 0.9
    )
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- Update usage count
    UPDATE mrd_quote_anchors
    SET usage_count = COALESCE(usage_count, 0) + 1,
        last_used_at = NOW()
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  -- Insert new anchor using existing schema columns
  INSERT INTO mrd_quote_anchors (
    guidance_id, quote_text, chunk_index, char_offset, page_number, extraction_confidence, is_verbatim
  ) VALUES (
    p_guidance_id, p_quote_text, p_chunk_index, p_char_start, p_page_number, p_confidence, true
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- View for quote anchor statistics
DROP VIEW IF EXISTS v_quote_anchor_stats;
CREATE VIEW v_quote_anchor_stats AS
SELECT
  g.source_type,
  COUNT(DISTINCT g.id) as items_with_quotes,
  COUNT(q.id) as total_quotes,
  AVG(q.extraction_confidence) as avg_confidence,
  SUM(COALESCE(q.usage_count, 0)) as total_usages
FROM mrd_guidance_items g
LEFT JOIN mrd_quote_anchors q ON g.id = q.guidance_id
GROUP BY g.source_type
ORDER BY total_quotes DESC;

-- View for chat quality metrics
CREATE OR REPLACE VIEW v_chat_quality_metrics AS
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as total_chats,
  AVG(citation_count) as avg_citations,
  COUNT(*) FILTER (WHERE was_rewritten) as rewritten_count,
  AVG(citation_violations) as avg_violations,
  COUNT(*) FILTER (WHERE citation_count >= 3) as high_quality_count
FROM mrd_chat_logs
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
