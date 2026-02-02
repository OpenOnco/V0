-- Migration 009: Enhanced Guidance Items
-- Add decision context, artifact link, and direct quotes

-- Link guidance items to source artifacts
ALTER TABLE mrd_guidance_items
  ADD COLUMN IF NOT EXISTS artifact_id INTEGER REFERENCES mrd_artifacts(id);

-- Decision context for clinical decision support
-- Structure: {
--   "decision_point": "MRD positive post-resection",
--   "population": {"stage": "III", "cancer_type": "colorectal", "setting": "adjuvant"},
--   "test_context": {"assay_type": "tumor-informed", "timepoint": "post-surgery"},
--   "options_discussed": ["trial enrollment", "intensified surveillance", "adjuvant escalation"],
--   "limitations_noted": ["assay sensitivity varies", "lead time benefit unproven"],
--   "strength_of_evidence": "Category 2A"
-- }
ALTER TABLE mrd_guidance_items
  ADD COLUMN IF NOT EXISTS decision_context JSONB;

-- Direct quotes array for quick access (denormalized from quote_anchors)
-- Structure: [{"text": "...", "page": 5, "section": "Surveillance", "type": "recommendation"}]
ALTER TABLE mrd_guidance_items
  ADD COLUMN IF NOT EXISTS direct_quotes JSONB DEFAULT '[]';

-- Track extraction version for reprocessing
ALTER TABLE mrd_guidance_items
  ADD COLUMN IF NOT EXISTS extraction_version INTEGER DEFAULT 1;

-- Source document version (from artifact)
ALTER TABLE mrd_guidance_items
  ADD COLUMN IF NOT EXISTS source_version VARCHAR(100);

-- Indexes for decision context queries
CREATE INDEX IF NOT EXISTS idx_guidance_decision_point
  ON mrd_guidance_items USING GIN ((decision_context->'decision_point'));

CREATE INDEX IF NOT EXISTS idx_guidance_population_cancer
  ON mrd_guidance_items USING GIN ((decision_context->'population'->'cancer_type'));

CREATE INDEX IF NOT EXISTS idx_guidance_artifact
  ON mrd_guidance_items(artifact_id);

-- Comments
COMMENT ON COLUMN mrd_guidance_items.decision_context IS 'Structured clinical decision support context';
COMMENT ON COLUMN mrd_guidance_items.direct_quotes IS 'Denormalized quotes for quick access';
COMMENT ON COLUMN mrd_guidance_items.extraction_version IS 'Processor version that extracted this item';
