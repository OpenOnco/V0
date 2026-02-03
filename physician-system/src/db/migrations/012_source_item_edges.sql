-- Migration 012: Source-Item Edges
-- Tracks which guidance items were discovered from which sources (provenance)

CREATE TABLE IF NOT EXISTS mrd_source_item_edges (
  id SERIAL PRIMARY KEY,
  source_id INTEGER REFERENCES mrd_sources(id) ON DELETE CASCADE,
  guidance_id INTEGER REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,

  -- Discovery metadata
  discovered_at TIMESTAMP DEFAULT NOW(),
  extraction_method VARCHAR(50),  -- claude, regex, manual
  confidence DECIMAL(3,2),        -- 0.00 to 1.00

  -- Ensure no duplicate edges
  UNIQUE(source_id, guidance_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_source_item_edges_source ON mrd_source_item_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_source_item_edges_guidance ON mrd_source_item_edges(guidance_id);
CREATE INDEX IF NOT EXISTS idx_source_item_edges_discovered ON mrd_source_item_edges(discovered_at DESC);

-- View to see items by source
CREATE OR REPLACE VIEW v_source_items AS
SELECT
  s.source_key,
  s.display_name as source_name,
  s.source_type,
  g.id as guidance_id,
  g.title,
  g.source_type as item_source_type,
  g.evidence_type,
  g.publication_date,
  e.discovered_at,
  e.extraction_method,
  e.confidence
FROM mrd_source_item_edges e
JOIN mrd_sources s ON e.source_id = s.id
JOIN mrd_guidance_items g ON e.guidance_id = g.id
ORDER BY e.discovered_at DESC;

-- View to see source coverage stats
CREATE OR REPLACE VIEW v_source_item_stats AS
SELECT
  s.source_key,
  s.display_name,
  s.source_type,
  COUNT(DISTINCT e.guidance_id) as item_count,
  MIN(e.discovered_at) as first_discovery,
  MAX(e.discovered_at) as last_discovery,
  AVG(e.confidence) as avg_confidence
FROM mrd_sources s
LEFT JOIN mrd_source_item_edges e ON s.id = e.source_id
WHERE s.is_active = TRUE
GROUP BY s.id, s.source_key, s.display_name, s.source_type
ORDER BY item_count DESC;
