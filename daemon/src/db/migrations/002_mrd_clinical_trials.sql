-- MRD Clinical Trials: Detailed tracking of interventional MRD trials
-- Migration 002: Clinical trials and status history

CREATE TABLE mrd_clinical_trials (
  id SERIAL PRIMARY KEY,
  nct_number VARCHAR(20) UNIQUE NOT NULL,

  -- Basic info
  brief_title TEXT NOT NULL,
  official_title TEXT,
  acronym VARCHAR(100),              -- e.g., "CIRCULATE", "DYNAMIC"

  -- Classification
  cancer_types JSONB NOT NULL,       -- ["colorectal", "breast"]
  phase VARCHAR(20),                 -- "Phase 2", "Phase 3", etc.
  status VARCHAR(50) NOT NULL,
    -- Values: not_yet_recruiting, recruiting, enrolling_by_invitation,
    --         active_not_recruiting, suspended, terminated,
    --         completed, withdrawn, unknown
  study_type VARCHAR(50),            -- "Interventional"

  -- Design
  intervention_summary TEXT,
  primary_endpoints JSONB,           -- [{"measure": "...", "timeframe": "..."}]
  secondary_endpoints JSONB,
  arms JSONB,                        -- [{"name": "...", "description": "..."}]
  masking VARCHAR(50),               -- "Open Label", "Double Blind", etc.
  allocation VARCHAR(50),            -- "Randomized", "Non-Randomized"

  -- Enrollment
  enrollment_target INTEGER,
  enrollment_actual INTEGER,

  -- Key dates
  start_date DATE,
  primary_completion_date DATE,
  primary_completion_type VARCHAR(20), -- "Actual" or "Anticipated"
  study_completion_date DATE,
  last_update_date DATE NOT NULL,

  -- Results
  has_results BOOLEAN DEFAULT FALSE,
  results_first_posted DATE,
  results_summary TEXT,              -- Our summary if results posted

  -- Publications
  linked_pmids JSONB,                -- ["12345678", "87654321"]

  -- Sponsor
  lead_sponsor VARCHAR(255),
  lead_sponsor_type VARCHAR(50),     -- "Industry", "Academic", "NIH", etc.
  collaborators JSONB,               -- ["NCI", "SWOG", ...]

  -- Contact
  overall_contact JSONB,             -- {name, email, phone}
  locations_count INTEGER,

  -- OpenOnco enrichment
  is_priority_trial BOOLEAN DEFAULT FALSE,
  clinical_significance TEXT,        -- Why this trial matters

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trial_status ON mrd_clinical_trials(status);
CREATE INDEX idx_trial_cancer ON mrd_clinical_trials USING GIN(cancer_types);
CREATE INDEX idx_trial_phase ON mrd_clinical_trials(phase);
CREATE INDEX idx_trial_priority ON mrd_clinical_trials(is_priority_trial) WHERE is_priority_trial = TRUE;
CREATE INDEX idx_trial_results ON mrd_clinical_trials(has_results) WHERE has_results = TRUE;
CREATE INDEX idx_trial_update ON mrd_clinical_trials(last_update_date DESC);
CREATE INDEX idx_trial_acronym ON mrd_clinical_trials(acronym) WHERE acronym IS NOT NULL;

-- Status history for tracking changes over time
CREATE TABLE mrd_trial_status_history (
  id SERIAL PRIMARY KEY,
  trial_id INTEGER NOT NULL REFERENCES mrd_clinical_trials(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX idx_trial_history ON mrd_trial_status_history(trial_id, changed_at DESC);

-- Trigger to track status changes
CREATE OR REPLACE FUNCTION track_trial_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO mrd_trial_status_history (trial_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trial_status_change_trigger
  BEFORE UPDATE ON mrd_clinical_trials
  FOR EACH ROW EXECUTE FUNCTION track_trial_status_change();
