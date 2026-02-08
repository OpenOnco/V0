-- Add digest_type column to distinguish physician vs R&D digest subscribers
ALTER TABLE mrd_digest_subscribers ADD COLUMN IF NOT EXISTS digest_type VARCHAR(20) DEFAULT 'physician';
