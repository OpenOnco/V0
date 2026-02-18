-- Migration 014: Enable RLS on all tables and fix SECURITY DEFINER views
--
-- Supabase exposes all public tables via PostgREST. Without RLS, anyone
-- with the anon key can read/write the entire database. This migration:
--   1. Enables RLS on all 18 mrd_* tables (blocks anon access by default)
--   2. Recreates all 8 views without SECURITY DEFINER
--
-- The application uses a direct Postgres connection (postgres role), which
-- bypasses RLS. No access policies are needed for the app to keep working.

-- ============================================================
-- 1. Enable RLS on all tables
-- ============================================================

ALTER TABLE mrd_guidance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_guidance_cancer_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_guidance_clinical_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_guidance_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_clinical_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_trial_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_trial_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_discovery_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_item_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_crawler_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_quote_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_digest_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_digest_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_source_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_source_item_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrd_migrations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Recreate views with SECURITY INVOKER (drop SECURITY DEFINER)
-- ============================================================

-- v_discovery_pending (from 003)
CREATE OR REPLACE VIEW v_discovery_pending
  WITH (security_invoker = true) AS
SELECT
  d.*,
  d.raw_data->>'title' AS title_preview,
  d.raw_data->>'abstract' AS abstract_preview
FROM mrd_discovery_queue d
WHERE d.status IN ('pending', 'ai_triaged')
ORDER BY d.priority ASC, d.discovered_at ASC;

-- v_guidance_with_tags (from 006)
DROP VIEW IF EXISTS v_guidance_with_tags;
CREATE VIEW v_guidance_with_tags
  WITH (security_invoker = true) AS
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
  ) AS questions_addressed,
  COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
      'nct_number', t.nct_number,
      'acronym', t.acronym,
      'status', t.status
    ))
    FROM mrd_trial_publications tp
    JOIN mrd_clinical_trials t ON tp.trial_id = t.id
    WHERE tp.guidance_id = g.id),
    '[]'::jsonb
  ) AS linked_trials
FROM mrd_guidance_items g
WHERE g.is_superseded = FALSE;

-- v_quote_anchor_stats (from 010)
CREATE OR REPLACE VIEW v_quote_anchor_stats
  WITH (security_invoker = true) AS
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

-- v_chat_quality_metrics (from 010)
CREATE OR REPLACE VIEW v_chat_quality_metrics
  WITH (security_invoker = true) AS
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

-- v_stale_sources (from 011)
CREATE OR REPLACE VIEW v_stale_sources
  WITH (security_invoker = true) AS
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

-- v_source_release_summary (from 011)
CREATE OR REPLACE VIEW v_source_release_summary
  WITH (security_invoker = true) AS
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

-- v_source_items (from 012)
CREATE OR REPLACE VIEW v_source_items
  WITH (security_invoker = true) AS
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

-- v_source_item_stats (from 012)
CREATE OR REPLACE VIEW v_source_item_stats
  WITH (security_invoker = true) AS
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
