-- MRD Trial Publications: Link trials to their publications
-- Migration 006: Cross-linking trials and publications

CREATE TABLE mrd_trial_publications (
  trial_id INTEGER REFERENCES mrd_clinical_trials(id) ON DELETE CASCADE,
  guidance_id INTEGER REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  match_confidence FLOAT,
  match_method VARCHAR(20),           -- 'nct_mention', 'embedding', 'manual'
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (trial_id, guidance_id)
);

CREATE INDEX idx_trial_pub_trial ON mrd_trial_publications(trial_id);
CREATE INDEX idx_trial_pub_guidance ON mrd_trial_publications(guidance_id);

-- View joining guidance items with all tags for easy querying
CREATE VIEW v_guidance_with_tags AS
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

-- Digest subscribers (for future email digest feature)
CREATE TABLE mrd_digest_subscribers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,

  -- Preferences
  cancer_types JSONB,                -- null = all, or ["colorectal", "breast"]
  content_types JSONB,               -- null = all, or ["guideline", "trial"]
  frequency VARCHAR(20) DEFAULT 'weekly',
    -- Values: weekly, biweekly, monthly

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,

  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_sent_at TIMESTAMP WITH TIME ZONE,
  send_count INTEGER DEFAULT 0,

  -- Security
  confirmation_token VARCHAR(100),
  unsubscribe_token VARCHAR(100) NOT NULL DEFAULT gen_random_uuid()::text
);

CREATE INDEX idx_subscriber_active ON mrd_digest_subscribers(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_subscriber_frequency ON mrd_digest_subscribers(frequency);

-- Digest history
CREATE TABLE mrd_digest_history (
  id SERIAL PRIMARY KEY,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Content
  subject VARCHAR(255),
  item_count INTEGER,
  item_ids JSONB,                    -- [1, 2, 3, ...]

  -- Delivery
  subscriber_count INTEGER,
  delivered_count INTEGER,
  failed_count INTEGER,

  -- Preview
  html_preview TEXT                  -- Store rendered HTML for reference
);
