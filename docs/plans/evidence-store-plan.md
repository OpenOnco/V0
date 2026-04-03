# Evidence Store: Phase A — Data Reorganization & Automated Agents

## Overview

Replace hand-maintained clinical evidence scattered across JS config files with a structured **claims store** — atomic, verifiable evidence records with full provenance, maintained by automated agents with cross-model verification.

### What changes
- `physicianFAQ.js`, `expertInsights.js`, chat prompts → become **generated outputs** from the claims store
- New `evidence/` directory holds raw sources and structured claims (JSON)
- Automated pipeline: discover papers → extract claims (Claude) → verify (GPT) → commit
- Existing UI unchanged — a render script regenerates the config files from claims

### What doesn't change
- `data.js` (test database) — untouched, different concern
- All existing UI components — they still read from physicianFAQ.js/expertInsights.js
- Patient-facing content — derived later

---

## Directory Structure

```
evidence/
  raw/                              # Source documents as markdown (peer-reviewed only)
    papers/
      35657320.md                   # PMID-keyed (Tie 2022, DYNAMIC)
      40055522.md                   # DYNAMIC 5-year follow-up
      37264205.md                   # Kotani 2023, GALAXY/VEGA
    guidelines/
      nccn-colon-v1-2025.md
      asco-pco-2024-ctdna.md
    conference-abstracts/
      asco-2025-3144.md             # Conference abstract by DOI/abstract number

  claims/
    colorectal.json                 # All CRC evidence claims
    breast.json
    lung.json
    bladder.json
    melanoma.json
    hematologic.json
    cross-cancer.json               # Claims that span cancer types
    guidelines.json                 # Guideline recommendations

  meta/
    sources.json                    # Source registry (PMID → metadata)
    disputes.json                   # Claims where Claude ≠ GPT
    extraction-log.json             # Audit trail: what was extracted when
    pending-publications.json       # Vendor/news mentions awaiting peer-reviewed pub

  scripts/
    seed-from-faq.js                # One-time: extract claims from existing physicianFAQ.js
    fetch-paper.js                  # Download paper from PubMed, convert to markdown
    extract-claims.js               # Claude API: paper → structured claims
    verify-claims.js                # OpenAI API: same paper → claims, then diff
    diff-claims.js                  # Compare two claim sets, output agreements/disputes
    render-faq.js                   # Generate physicianFAQ.js from claims store
    render-chat-prompt.js           # Generate chat system prompt evidence sections
    notify.js                       # Send action-required emails via Resend API
    audit-claims.js                 # Health checks: stale claims, missing sources, thin coverage
```

---

## Claim Schema

Each claim is an atomic, verifiable piece of evidence. JSON format.

```json
{
  "id": "CRC-DYNAMIC-001",
  "type": "trial_result",

  "source": {
    "pmid": "35657320",
    "title": "Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer",
    "journal": "NEJM",
    "year": 2022,
    "authors_short": "Tie et al.",
    "source_type": "journal-article",
    "raw_file": "raw/papers/35657320.md"
  },

  "scope": {
    "cancer": "colorectal",
    "stages": ["II"],
    "setting": "adjuvant",
    "test_category": "MRD",
    "tests": [
      {
        "test_id": "mrd-1",
        "test_name": "Signatera",
        "vendor": "Natera",
        "role": "assay_used"
      }
    ]
  },

  "finding": {
    "description": "ctDNA-guided management reduced adjuvant chemotherapy use from 28% to 15% with non-inferior recurrence-free survival",
    "trial_name": "DYNAMIC",
    "endpoint": "recurrence-free survival",
    "endpoint_type": "primary",
    "result_direction": "non-inferior",
    "n": 455,
    "hr": 0.92,
    "ci_lower": null,
    "ci_upper": null,
    "p_value": null,
    "follow_up_months": 24,
    "effect_summary": "Chemo reduced from 28% to 15%, 2yr RFS 93.5% vs 92.4%"
  },

  "extraction": {
    "extracted_by": "claude",
    "extracted_date": "2026-04-03",
    "model_version": "claude-sonnet-4-20250514",
    "source_quote_hash": "a1b2c3d4"
  },

  "verification": {
    "verified_by": "gpt-4o",
    "verified_date": "2026-04-03",
    "agreement": true,
    "dispute_notes": null
  },

  "review": {
    "human_reviewed": false,
    "review_priority": "low",
    "reviewer": null,
    "review_date": null
  }
}
```

### Accepted source_type values

| source_type | Description | Identifier |
|-------------|-------------|------------|
| `journal-article` | Peer-reviewed journal publication | PMID |
| `conference-abstract` | Peer-reviewed conference abstract (ASCO, ESMO, AACR) | DOI or abstract number |
| `clinical-guideline` | Published practice guideline from recognized body | Version + date |

**Recognized guideline bodies:**
- **NCCN** — National Comprehensive Cancer Network (cancer-specific clinical practice guidelines)
- **ASCO** — American Society of Clinical Oncology (Provisional Clinical Opinions, practice guidelines)
- **ESMO** — European Society for Medical Oncology (Clinical Practice Guidelines)
- **CAP/AMP** — College of American Pathologists / Association for Molecular Pathology (joint molecular testing guidelines)
- **IASLC** — International Association for the Study of Lung Cancer (lung-specific molecular testing)
- **ASCO/CAP** — Joint guidelines (e.g., biomarker testing in breast, lung)
- **ASH** — American Society of Hematology (heme malignancy guidelines relevant to clonoSEQ/MRD)
- **NCCN Biomarkers Compendium** — Companion diagnostic / biomarker-specific recommendations

Guidelines from these bodies are peer-reviewed publications and qualify as primary sources. Other professional society guidelines may qualify if they follow a comparable peer-review and evidence-grading process — the agent should flag unfamiliar bodies for review rather than auto-rejecting.

No other source types are accepted. Vendor press releases, preprints, and "data on file" sources are logged to `meta/pending-publications.json` as pointers for future PubMed lookup, never as claim sources.

### Claim Types

| Type | Description | Key fields |
|------|-------------|------------|
| `trial_result` | Clinical trial outcome | trial_name, endpoint, hr, n, p_value |
| `guideline_recommendation` | NCCN/ASCO/ESMO recommendation | body, guideline_version, recommendation, category |
| `diagnostic_performance` | Sensitivity/specificity data | metric, value, confidence_interval, cohort_description |
| `clinical_utility` | Lead time, treatment change data | utility_type, magnitude, comparison |
| `methodology_note` | Expert context on interpretation | concept, explanation, attribution |

---

## Pipeline Steps

### Step 1: Seed from existing data (one-time)

`scripts/seed-from-faq.js` reads `physicianFAQ.js` and `expertInsights.js`, uses Claude API to decompose each answer into atomic claims with the schema above. This gives us the initial claims store without losing anything we already have.

Input: physicianFAQ.js (349 lines), expertInsights.js (182 lines)
Output: populated claims/*.json files, sources.json registry
Estimated claims: ~60-80 (5 concerns × 5 cancer types × ~3 claims each, plus expert insights)

### Step 2: Paper fetcher

`scripts/fetch-paper.js` takes a PMID, fetches the abstract and available full text from PubMed/PMC, converts to markdown, saves to `evidence/raw/papers/{pmid}.md`. Also extracts metadata (title, authors, journal, year) into `sources.json`.

Uses: PubMed E-utilities API (free, no auth needed for abstracts)
Note: Full text only available for PMC open-access papers. For paywalled papers, abstract + figures may be sufficient for claim extraction. Could also accept manual markdown paste for important paywalled papers.

### Step 3: Claim extraction (Claude)

`scripts/extract-claims.js` takes a raw paper markdown file, sends it to Claude API with a structured extraction prompt, gets back an array of claims in the schema above. Appends to the appropriate cancer-type claims file.

Key prompt design:
- System prompt defines the claim schema with examples
- Asks for ALL verifiable quantitative claims (endpoints, HRs, sample sizes, sensitivity/specificity)
- Asks for qualitative claims only when they represent guideline positions or clinical consensus
- Requires source_quote_hash linking each claim to specific text in the paper
- Self-assessment of extraction confidence per claim

### Step 4: Cross-model verification (GPT)

`scripts/verify-claims.js` sends the SAME raw paper to OpenAI API with the SAME extraction prompt. Gets back a parallel set of claims. Then `diff-claims.js` compares:

- **Numeric match**: HR, n, CI, p-value compared with tolerance (e.g., rounding differences OK)
- **Categorical match**: endpoint_type, result_direction, cancer, stages must match exactly
- **Description match**: finding descriptions compared semantically (fuzzy, via either model)

Output:
- Agreement → claim gets `verification.agreement: true`, auto-committed
- Disagreement → claim goes to `meta/disputes.json` with both extractions, flagged for review

### Step 5: Render to existing UI format

`scripts/render-faq.js` reads all claims files and generates `physicianFAQ.js` in the exact current format — same export structure, same cancer type tiers, same concern IDs. The existing UI components don't change at all.

This is the critical bridge: the claims store is the source of truth, but the app still consumes the same config files it always has.

Similarly, `scripts/render-chat-prompt.js` generates the MRD evidence sections that go into the chat system prompt.

### Step 6: Schedule integration

Add to existing `/schedule` infrastructure (or as CC `/schedule` tasks):

**Weekly Evidence Monitor** (e.g., Wednesday 9 AM PT)
1. Query PubMed for new papers matching saved searches (ctDNA MRD, liquid biopsy surveillance, etc.)
2. Check discovery channels (vendor RSS, JCO/AoO feeds) for mentions of new data
3. For any discovery channel hit: search PubMed for the peer-reviewed publication
   - If found → fetch paper → extract claims (Claude) → verify (GPT) → commit if agreed
   - If not found → log to `meta/pending-publications.json`, re-check next cycle
4. Re-render physicianFAQ.js and chat prompts if claims changed
5. Log results to extraction-log.json

**Monthly Evidence Audit** (e.g., 15th of month)
1. Run audit-claims.js: find thin coverage areas, stale claims, unresolved disputes
2. Check for guideline updates (NCCN version changes, new ASCO PCOs)
3. Generate summary report of what changed

---

## Implementation Order for CC

1. **Create directory structure** — `evidence/raw/`, `evidence/claims/`, `evidence/meta/`, `evidence/scripts/`
2. **Define claim schema** — JSON schema file at `evidence/schema/claim.schema.json` for validation
3. **Build seed script** — `seed-from-faq.js`: decompose physicianFAQ.js → claims JSON files
4. **Build paper fetcher** — `fetch-paper.js`: PMID → markdown in raw/papers/
5. **Build extraction script** — `extract-claims.js`: raw paper → claims via Claude API
6. **Build verification script** — `verify-claims.js`: raw paper → claims via OpenAI API
7. **Build diff script** — `diff-claims.js`: compare two claim sets → agreements/disputes
8. **Build notification script** — `notify.js`: send action-required emails via Resend API (NCCN updates, disputes, audit summaries)
9. **Build render script** — `render-faq.js`: claims → physicianFAQ.js (must match current format exactly)
10. **Verify round-trip** — seed from FAQ → render back → diff should be minimal/semantic-only
11. **Integrate with /schedule** — add weekly evidence monitor task with notification hooks

---

## API Requirements

- **Anthropic API**: For claim extraction. Use claude-sonnet-4-20250514 (cost-effective for structured extraction)
- **OpenAI API**: For cross-model verification. Use gpt-4o (best extraction accuracy for the cost)
- **PubMed E-utilities**: Free, no API key needed (rate limit: 3 requests/sec without key, 10/sec with free NCBI API key)

Estimated cost per paper: ~$0.05-0.15 (Claude extraction) + ~$0.05-0.10 (GPT verification) = ~$0.10-0.25 per paper. At 10 papers/month, roughly $1-3/month.

## Key Design Decisions

1. **JSON not YAML** — Alex works in JSON daily, no new format to learn
2. **Files in repo, not database** — version controlled, diffable, no new infrastructure
3. **Claims not wiki articles** — atomic and verifiable, no prose synthesis step
4. **Render to existing format** — UI unchanged, zero migration risk
5. **Cross-model verification on raw source, not on each other's output** — prevents confirmation bias
6. **Auto-commit agreed claims, flag disputes** — humans only review disagreements and periodic audits

## Success Criteria

- [ ] Seed script produces claims that, when rendered, match existing physicianFAQ.js semantically
- [ ] fetch-paper.js successfully retrieves and converts at least the PMIDs already cited in physicianFAQ.js
- [ ] Cross-model agreement rate >90% on numeric claims from well-structured papers
- [ ] render-faq.js output passes existing Playwright tests (UI unchanged)
- [ ] Weekly monitor successfully discovers and ingests at least one new paper in first month

## Phase B (future): Physician Query Interface

Deferred. Will build on top of the claims store. Options include search-over-claims, LLM-as-router, or structured navigation. See separate plan when ready.


---

## Evidence Sources

### Tier 1: Fully automated (structured APIs)

| Source | Method | What it catches | Frequency |
|--------|--------|-----------------|-----------|
| **PubMed** | E-utilities API saved searches | New peer-reviewed papers on ctDNA/MRD | Weekly |
| **ClinicalTrials.gov** | API status checks | Trial results posted, status changes | Weekly |
| **CMS LCD/NCD** | Existing crawler (already working) | Medicare coverage policy changes | Weekly |

PubMed saved searches (initial set):
- `"ctDNA" AND "minimal residual disease" AND ("colorectal" OR "breast" OR "lung")`
- `"circulating tumor DNA" AND "adjuvant" AND ("randomized" OR "trial")`
- `"liquid biopsy" AND ("surveillance" OR "monitoring") AND "cancer"`
- `"molecular residual disease" AND ("sensitivity" OR "specificity")`
- `"ctDNA-guided" AND ("therapy" OR "treatment")`
- `("guideline" OR "consensus" OR "recommendation") AND "ctDNA" AND ("NCCN" OR "ASCO" OR "ESMO" OR "CAP")`
- `("practice guideline"[pt]) AND ("circulating tumor DNA" OR "minimal residual disease")`

ClinicalTrials.gov tracked trials:
- NCT04786600 (CIRCULATE-US)
- NCT04068103 (COBRA)
- NCT04259944 (PEGASUS)
- NCT03901378 (DYNAMIC-III)
- NCT04761783 (BESPOKE CRC)
- Add new trials as discovered via PubMed

### Tier 2: Discovery channels (find pointers to publications)

| Source | Method | What it catches | Frequency |
|--------|--------|-----------------|-----------|
| **NCCN updates** | Scrape version update pages | Guideline version changes mentioning ctDNA/MRD | Monthly |
| **ASCO guidelines** | Scrape ASCO publications page | New PCOs, guideline updates, ASCO/CAP joint guidelines | Monthly |
| **ESMO guidelines** | PubMed search (published in Annals of Oncology) | ESMO Clinical Practice Guidelines updates | Monthly |
| **CAP/AMP guidelines** | PubMed search (published in Archives of Pathology, J Mol Diagnostics) | Molecular testing guidelines | Monthly |
| **ASH guidelines** | PubMed search (published in Blood Advances) | Heme MRD guideline updates | Monthly |
| **JCO / Annals of Oncology** | RSS feeds, keyword filter | High-impact journal publications | Weekly |
| **Vendor press releases** | RSS from Natera, Guardant, etc. | **Pointers to new publications only** — trigger PubMed lookup | Weekly |

### Tier 3: Seasonal discovery (agent flags, may need manual assist)

| Source | Method | What it catches | Frequency |
|--------|--------|-----------------|-----------|
| **Conference abstracts** | Agent monitors known conference dates, flags when abstract DBs go live | ASCO, ASCO GI, ESMO, AACR abstracts (these ARE peer-reviewed) | Seasonal |
| **NCCN guideline PDFs** | Agent detects new version via public update page; sends email to Alex to clip excerpt | Actual recommendation language and category levels | ~2-4x/year per cancer type |

Note on guidelines:
- **ASCO guidelines/PCOs**: Published as peer-reviewed articles in JCO with PMIDs. No special handling — they flow through PubMed automatically.
- **ESMO guidelines**: Published as peer-reviewed articles in Annals of Oncology with PMIDs. Same — automatic via PubMed.
- **NCCN guidelines**: The only guideline body requiring manual assist. Full PDFs are behind a free login wall. The agent detects version changes automatically, sends an action-required email via Resend API (already configured on openonco.org), and Alex clips the relevant excerpt (~5 min per update). JNCCN "Guidelines Insights" summary papers (which have PMIDs) are also captured automatically but lag behind actual guideline updates.

### Agent notifications

The weekly evidence monitor sends emails via Resend API (openonco.org domain, already configured) for any action that requires human input:

| Trigger | Email subject | Action needed |
|---------|--------------|---------------|
| NCCN version change detected | `[OpenOnco] NCCN {guideline} updated to {version}` | Clip MRD/ctDNA section to raw/guidelines/ |
| Cross-model dispute on claim | `[OpenOnco] Evidence dispute: {claim summary}` | Review dispute in meta/disputes.json |
| Discovery channel hit, no pub found | `[OpenOnco] Pending publication: {description}` | Optional — check if pub available yet |
| Monthly audit summary | `[OpenOnco] Monthly evidence audit — {date}` | Review thin coverage areas, stale claims |

Emails are sent to Alex's email only. The agent includes specific instructions in the email body (e.g., "Log into nccn.org, open Colon Cancer v2.2026, find the ctDNA/MRD section, save excerpt to evidence/raw/guidelines/nccn-colon-v2-2026.md").

### Quality Gate: Peer-Reviewed Only

**Hard rule: The ONLY valid source for a claim is a peer-reviewed publication or conference abstract.** No exceptions.

Acceptable claim sources:
- Peer-reviewed journal articles (identified by PMID or DOI)
- Peer-reviewed conference abstracts (ASCO, ESMO, AACR — identified by abstract number + DOI)
- Published clinical practice guidelines (NCCN, ASCO, ESMO — identified by version + date)

NOT acceptable as claim sources (discovery channels only):
- Vendor websites and press releases
- Preprints (medRxiv/bioRxiv)
- "Data on File" vendor submissions
- Investor presentations
- News articles about studies

### How discovery channels work

Vendor press releases, conference announcements, and news articles are monitored ONLY to discover that a peer-reviewed publication exists. The pipeline:

1. Discovery channel mentions a study result (e.g., Natera press release about ALTAIR)
2. Agent searches PubMed for the corresponding peer-reviewed publication
3. If found → fetch the paper, extract claims from the PUBLICATION (not the press release)
4. If not found → log to `meta/pending-publications.json` with the discovery source, check again next cycle
5. Claims are NEVER extracted from the discovery source itself

This means there may be a lag between a vendor announcing results and claims appearing in the store — that lag is the time it takes for peer review, and that's a feature, not a bug.
