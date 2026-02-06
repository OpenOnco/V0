# Physician System Transformation: Claude Code Directions

## Project Context

**Repo:** `/Users/adickinson/Documents/GitHub/V0/`
**Physician system:** `physician-system/` subdirectory
**Deployed on:** Railway at `https://physician-system-production.up.railway.app`
**Database:** PostgreSQL with pgvector on Railway

The physician system is a RAG-based clinical decision support tool for MRD (Molecular Residual Disease) testing in solid tumors. It currently works as a literature review tool — physicians ask questions and get academic-style responses organized as EVIDENCE → LIMITATIONS.

**The goal is to transform it into clinical decision support** — when a physician says "my patient's MRD test came back positive after CRC stage III resection, now what?" the system should respond with structured clinical options (escalate adjuvant? retest when? enroll in trial?) backed by evidence, not an academic summary.

### What's Already Done
- P0-P2 infrastructure: citation validation (`src/chat/citation-validator.js`), job locks (`src/utils/job-lock.js`), quote anchoring (`src/chat/quote-extractor.js`), source registry (`src/db/seed-sources.js`), guideline watcher (`src/crawlers/guideline-watcher.js`), version monitoring (`src/crawlers/version-watcher.js`), oncology ontology (`src/config/oncology-terms.js`), gold sets (`tests/gold-sets/`), response template (`src/chat/response-template.js`)
- Intent extraction via Haiku in `src/chat/server.js` (classifies query type, maps to source filters)
- Hybrid search: vector + keyword with intent-based source routing in `src/chat/server.js`
- Conference abstract crawler in `test-data-tracker/src/crawlers/mrd/conference-abstracts.js`
- Publication bridge: `test-data-tracker/src/crawlers/publication-bridge.js` and `physician-db-writer.js`
- `decision_context` JSONB column exists on `mrd_guidance_items` (migration `src/db/migrations/009_mrd_guidance_enhancements.sql`)
- 11 scheduled jobs running on Railway (see `src/scheduler.js` and `src/config.js`)
- Current DB has ~110 guidance items, ~213 clinical trials, 110 embeddings (100% coverage)
- Embedding model: `text-embedding-ada-002` (1536 dimensions) in both `src/embeddings/mrd-embedder.js` and `src/chat/server.js`

### What's NOT Done (This Document)
All tasks below need implementation. Execute them in the order specified — later tasks depend on earlier ones.

---

## TASK 1: Content Audit Script

**Goal:** Classify all items in `mrd_guidance_items` to understand what exists before making changes.

**Create file:** `physician-system/scripts/audit-content.js`

This script connects to the physician system PostgreSQL database and:

1. Fetches all rows from `mrd_guidance_items` (expect ~110-200 items)
2. For each item, uses Claude Haiku (`claude-3-5-haiku-20241022`) to classify:
   - `content_type`: one of `decision_support` | `background` | `data_point` | `policy`
   - `decision_point`: free text like "MRD positive post-resection" or null
   - `cancer_type_stage`: e.g. "CRC stage III" or null
   - `test_specific`: boolean — does it mention a specific commercial test?
   - `has_actionable_options`: boolean — does it present clinical choices?
3. Outputs results to `physician-system/scripts/audit-results.json` with:
   - Full classification for every item (keyed by item id)
   - Summary statistics: count by content_type, count by cancer_type, count with decision_point
   - Gap analysis: which cancer x decision_point combinations have zero items

**Technical details:**
- Use `ANTHROPIC_API_KEY` from `.env` (already configured)
- Database connection: `MRD_DATABASE_URL` from `.env`
- Use `pg` package (already in package.json dependencies)
- Batch items through Haiku in groups of 5 to stay under rate limits
- Log progress to stdout

**Haiku classification prompt (send for each item):**

```
Classify this MRD guidance database item.

Title: {title}
Source type: {source_type}
Evidence type: {evidence_type}
Summary (first 500 chars): {summary}

Return JSON only:
{
  "content_type": "decision_support|background|data_point|policy",
  "decision_point": "string or null",
  "cancer_type_stage": "string or null",
  "test_specific": true/false,
  "has_actionable_options": true/false
}

Definitions:
- decision_support: Directly helps a physician make a clinical decision (e.g., trial data showing MRD+ patients benefit from escalated therapy)
- background: General context or overview (e.g., "ctDNA is cell-free DNA shed by tumors")
- data_point: Specific finding without clinical decision context (e.g., "sensitivity was 88%")
- policy: Coverage, regulatory, or guideline status information
```

**Runnable via:** `node physician-system/scripts/audit-content.js`

---

## TASK 2: Decision Tree Mapping

**Goal:** Create the routing map that defines the top clinical scenarios and their decision options. This is the load-bearing structure for the entire transformation — every downstream task references it.

**Create file:** `physician-system/data/decision-trees.json`

Cover the top 5 clinical scenarios. Each scenario needs: `display_name`, `cancer_type`, `stage`, `clinical_setting`, `mrd_result`, array of `decisions` (each with `id`, `question`, `evidence_tags`, `key_trials` as NCT IDs, `evidence_strength`, `summary`), and `test_considerations` (per-test notes on approach and caveats).

**The 5 scenarios:**

1. **CRC_III_post_resection_MRD_positive** — Decisions: escalate adjuvant (DYNAMIC NCT04089631, CIRCULATE NCT04120701, GALAXY/VEGA NCT04776655 — emerging evidence), serial monitoring (ctDNA kinetics, 3-6mo intervals), trial enrollment (CIRCULATE-US, COBRA NCT04068103, ACT3 NCT05054400), imaging acceleration (limited evidence). Tests: Signatera (tumor-informed, most CRC data, requires tissue, 16-plex), Guardant Reveal (tumor-naive, no tissue needed, epigenomic+genomic, less CRC validation).

2. **CRC_III_post_resection_MRD_negative** — Decisions: de-escalate adjuvant (DYNAMIC showed non-inferior in stage II, DYNAMIC-III NCT04513885 extends to III but immature), retest interval (no consensus, 3-6mo for 2-3yr), false negative risk (sensitivity varies, standard imaging continues regardless). Tests: Signatera (>95% sensitivity at relapse), Guardant Reveal (may miss low-shedding tumors).

3. **CRC_III_during_adjuvant_MRD_positive** — Decisions: switch regimen (very limited — no RCT supports this), extend duration (IDEA didn't use MRD, biologically plausible but unproven), retest after completion (4-8 weeks post-adjuvant). Test note: on-treatment ctDNA suppressed by chemo, interpret cautiously.

4. **breast_I_III_post_resection_MRD_positive** — Decisions: subtype implications (TNBC highest shedding, HR+ lower sensitivity, HER2+ limited data), intervention options (c-TRAK TN NCT03145961 — feasible but limited efficacy), monitoring strategy (serial ctDNA detects relapse months before imaging). Tests: Signatera (growing breast data, mostly TNBC), Guardant Reveal (limited breast validation), RareDx (breast-focused, smaller evidence base).

5. **NSCLC_I_III_post_resection_MRD_positive** — Decisions: adjuvant immunotherapy (IMpower010 NCT04660344 — ctDNA may identify benefiters), targeted therapy (EGFR+: osimertinib/ADAURA standard regardless of MRD; MRD most useful for patients without actionable mutations), surveillance intensification (limited evidence for specific schedule). Tests: Signatera (TRACERx data), Guardant Reveal (no tissue needed).

Each decision `evidence_strength`: `established` | `emerging` | `limited` | `very_limited` | `active_research`.

**Validate:** `node -e "JSON.parse(require('fs').readFileSync('physician-system/data/decision-trees.json','utf8'));console.log('Valid')"` 