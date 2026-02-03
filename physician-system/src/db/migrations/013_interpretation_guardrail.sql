-- Migration 013: Interpretation Guardrail
-- Adds guardrail text to guidance items for source-appropriate caveats

ALTER TABLE mrd_guidance_items
ADD COLUMN IF NOT EXISTS interpretation_guardrail TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN mrd_guidance_items.interpretation_guardrail IS
  'Source-specific caveat for interpreting this item. E.g., "Society editorial; reflects expert opinion" or "Secondary source; refer to primary publication"';

-- Index for filtering items with/without guardrails
CREATE INDEX IF NOT EXISTS idx_guidance_has_guardrail
  ON mrd_guidance_items((interpretation_guardrail IS NOT NULL));
