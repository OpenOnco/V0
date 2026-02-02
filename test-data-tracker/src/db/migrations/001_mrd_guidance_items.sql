-- MRD Guidance Items: Main table for approved, searchable guidance
-- Migration 001: Core guidance items table

CREATE TABLE mrd_guidance_items (
  id SERIAL PRIMARY KEY,

  -- Source identification
  source_type VARCHAR(50) NOT NULL,
    -- Values: pubmed, clinicaltrials, nccn, cms_ncd, cms_lcd, asco, esmo, fda
  source_id VARCHAR(100),
    -- PMID, NCT number, LCD number, etc.
  source_url TEXT,

  -- Bibliographic metadata
  title TEXT NOT NULL,
  authors JSONB,
    -- Format: [{"name": "Smith J", "affiliation": "Mayo Clinic", "is_first": true, "is_last": false}]
  publication_date DATE,
  journal VARCHAR(255),
  doi VARCHAR(100),
  pmid VARCHAR(20),

  -- Classification
  evidence_type VARCHAR(50) NOT NULL,
    -- Values: guideline, consensus, rct_results, observational,
    --         meta_analysis, review, regulatory, coverage_policy
  evidence_level VARCHAR(100),
    -- As stated in source, e.g., "NCCN Category 2A", "Level I", "Grade A"
  relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 10),

  -- Content
  summary TEXT,                      -- 2-3 sentence summary
  key_findings JSONB,                -- Structured findings
    -- Format: [{"finding": "...", "implication": "..."}]
  full_text_excerpt TEXT,            -- Relevant excerpt if available

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by VARCHAR(100),
  review_notes TEXT,

  -- Versioning / supersession
  is_superseded BOOLEAN DEFAULT FALSE,
  superseded_by INTEGER REFERENCES mrd_guidance_items(id),
  supersedes INTEGER REFERENCES mrd_guidance_items(id),

  -- Full-text search
  search_vector TSVECTOR,

  -- Constraints
  UNIQUE(source_type, source_id)
);

-- Indexes
CREATE INDEX idx_guidance_source ON mrd_guidance_items(source_type);
CREATE INDEX idx_guidance_date ON mrd_guidance_items(publication_date DESC);
CREATE INDEX idx_guidance_evidence ON mrd_guidance_items(evidence_type);
CREATE INDEX idx_guidance_relevance ON mrd_guidance_items(relevance_score DESC);
CREATE INDEX idx_guidance_search ON mrd_guidance_items USING GIN(search_vector);
CREATE INDEX idx_guidance_superseded ON mrd_guidance_items(is_superseded) WHERE is_superseded = FALSE;

-- Trigger to update search vector
CREATE OR REPLACE FUNCTION update_guidance_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.full_text_excerpt, '')), 'C');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guidance_search_vector_trigger
  BEFORE INSERT OR UPDATE ON mrd_guidance_items
  FOR EACH ROW EXECUTE FUNCTION update_guidance_search_vector();

-- Junction tables for many-to-many relationships

-- Cancer types
CREATE TABLE mrd_guidance_cancer_types (
  guidance_id INTEGER NOT NULL REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  cancer_type VARCHAR(50) NOT NULL,
    -- Values: colorectal, breast, lung_nsclc, lung_sclc, bladder,
    --         pancreatic, melanoma, ovarian, gastric, esophageal,
    --         hepatocellular, prostate, renal, multi_solid
  PRIMARY KEY (guidance_id, cancer_type)
);

CREATE INDEX idx_guidance_cancer ON mrd_guidance_cancer_types(cancer_type);

-- Clinical settings
CREATE TABLE mrd_guidance_clinical_settings (
  guidance_id INTEGER NOT NULL REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  clinical_setting VARCHAR(50) NOT NULL,
    -- Values: screening, diagnosis, pre_surgery, post_surgery,
    --         neoadjuvant, during_adjuvant, post_adjuvant,
    --         surveillance, recurrence, metastatic
  PRIMARY KEY (guidance_id, clinical_setting)
);

CREATE INDEX idx_guidance_setting ON mrd_guidance_clinical_settings(clinical_setting);

-- Clinical questions addressed
CREATE TABLE mrd_guidance_questions (
  guidance_id INTEGER NOT NULL REFERENCES mrd_guidance_items(id) ON DELETE CASCADE,
  question VARCHAR(50) NOT NULL,
    -- Values: when_to_test, which_test, positive_result_action,
    --         negative_result_action, test_frequency, de_escalation,
    --         escalation, prognosis, clinical_trial_eligibility
  PRIMARY KEY (guidance_id, question)
);

CREATE INDEX idx_guidance_question ON mrd_guidance_questions(question);
