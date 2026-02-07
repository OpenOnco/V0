-- Migration 010: Add extra fields to digest subscribers + status to digest history
-- Adds name/institution to subscribers, status column to digest history for hybrid review

ALTER TABLE mrd_digest_subscribers ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE mrd_digest_subscribers ADD COLUMN IF NOT EXISTS institution VARCHAR(255);

-- Add status to digest history for hybrid review workflow (draft → approved → sent / skipped)
ALTER TABLE mrd_digest_history ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';
ALTER TABLE mrd_digest_history ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE mrd_digest_history ADD COLUMN IF NOT EXISTS text_preview TEXT;
