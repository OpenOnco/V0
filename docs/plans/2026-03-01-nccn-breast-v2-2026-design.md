# NCCN Breast Cancer v2.2026 Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate NCCN Breast Cancer Guidelines v2.2026 (Feb 27, 2026) across the RAG pipeline, test database, and decision trees.

**Architecture:** Replace the existing breast.pdf in the physician system guidelines directory and re-run the NCCN processor to extract ctDNA/MRD-relevant content into the RAG database. Update data.js NCCN reference fields. Update decision trees with new guideline version.

**Tech Stack:** Node.js CLI (physician-system), PostgreSQL + pgvector (Railway), OpenAI ada-002 embeddings, pdf-parse

---

## Context

The NCCN Breast Cancer v2.2026 guideline contains these ctDNA/MRD-relevant sections:

| Section | Content |
|---------|---------|
| BINV-18 fn iii | ctDNA assays for diagnosis/progression in recurrent/Stage IV; tissue and ctDNA complementary |
| BINV-Q fn u | Plasma ctDNA tumor fraction (TF) measurement |
| BINV-Q fn v | ESR1 mutations at progression: ctDNA preferred; reflex to tissue NGS if negative + low TF |
| BINV-17 | Surveillance: NO ctDNA/MRD mentioned (notable absence) |
| BINV-N | Gene expression assays: Oncotype DX Category 1 preferred |

**Key:** No specific MRD tests (Signatera, etc.) are named. Same as prior version.

---

### Task 1: Replace PDF in Guidelines Directory

**Files:**
- Replace: `physician-system/data/guidelines/nccn/breast.pdf`

**Step 1: Copy the new PDF**

```bash
cp /Users/adickinson/Downloads/breast.pdf physician-system/data/guidelines/nccn/breast.pdf
```

**Step 2: Verify the file**

```bash
ls -la physician-system/data/guidelines/nccn/breast.pdf
```

Expected: ~3.5MB file with today's date.

**Step 3: Commit**

```bash
git add physician-system/data/guidelines/nccn/breast.pdf
git commit -m "data: update NCCN Breast Cancer guideline to v2.2026"
```

---

### Task 2: Run NCCN Processor to Ingest into RAG

**Files:**
- Read: `physician-system/src/crawlers/processors/nccn.js`
- Read: `physician-system/src/cli.js`

**Prerequisites:** Railway PostgreSQL access via `MRD_DATABASE_URL` and OpenAI API key for embeddings. Run from `physician-system/` directory.

**Step 1: Verify database connectivity**

```bash
cd physician-system && node -e "require('dotenv').config(); console.log(process.env.MRD_DATABASE_URL ? 'DB URL set' : 'MISSING DB URL')"
```

Expected: `DB URL set`

**Step 2: Run the NCCN processor on breast.pdf**

```bash
cd physician-system && node src/cli.js nccn data/guidelines/nccn/breast.pdf
```

Expected output:
```
Processing PDF: data/guidelines/nccn/breast.pdf
=== NCCN Processing Results ===
{
  "success": true,
  "filename": "breast.pdf",
  "cancerType": "breast",
  "version": "2.2026",
  ...
  "sectionsFound": <number>,
  "recommendationsExtracted": <number>,
  "saved": <number>
}
```

The processor will:
1. Extract text from the PDF
2. Detect cancer type (`breast`) and version (`2.2026`)
3. Store artifact with SHA256 hash (supersedes old version automatically)
4. Find sections matching MRD keywords (ctDNA, circulating tumor DNA, liquid biopsy, etc.)
5. Use Claude Sonnet to extract structured recommendations with evidence categories
6. Store in `mrd_guidance_items` with cancer type tagging
7. Generate OpenAI ada-002 embeddings for RAG retrieval
8. Store verbatim quotes in `mrd_quote_anchors`

**Step 3: Verify extraction**

Check that BINV-18 (ctDNA for recurrent/Stage IV) and BINV-Q (ESR1 via ctDNA) content was extracted. The `sectionsFound` should be > 0 and `recommendationsExtracted` should be > 0.

If `sectionsFound: 0`, the MRD keyword windows didn't match. Check the processor output for details — the PDF text extraction may need debugging.

**No commit needed** — database changes only, no file modifications.

---

### Task 3: Update Oncotype DX NCCN Reference in data.js

**Files:**
- Modify: `src/data.js` (TDS-19 entry, around line 9202)

**Step 1: Update the NCCN guideline reference**

Find the Oncotype DX entry (TDS-19) and update these fields:

Before:
```javascript
"nccnGuidelineReference": "NCCN Breast Cancer Guidelines",
"nccnGuidelinesNotes": "NCCN-preferred multigene assay with Category 1 evidence. Only test with Level 1 evidence for both prognosis AND prediction of chemotherapy benefit for HR+, HER2- breast cancer.",
"nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1",
```

After:
```javascript
"nccnGuidelineReference": "NCCN Breast Cancer Guidelines v2.2026",
"nccnGuidelinesNotes": "NCCN-preferred multigene assay with Category 1 evidence (BINV-N). Only test with Level 1 evidence for both prognosis AND prediction of chemotherapy benefit for HR+, HER2- breast cancer. v2.2026 reaffirms Oncotype DX as preferred for node-negative and select node-positive (1-3 nodes) HR+/HER2- invasive breast cancer.",
"nccnGuidelinesCitations": "https://www.nccn.org/guidelines/category_1",
```

**Step 2: Run smoke tests**

```bash
npm run test:smoke
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/data.js
git commit -m "data: update Oncotype DX NCCN reference to v2.2026"
```

---

### Task 4: Update Signatera NCCN Notes for Breast Context

**Files:**
- Modify: `src/data.js` (mrd-7 entry)

Signatera (mrd-7) currently has `nccnNamedInGuidelines: true` but only references CRC/MCC guidelines. The breast guideline doesn't name Signatera, but does acknowledge ctDNA generically. We should NOT change `nccnNamedInGuidelines` or `nccnGuidelineReference` (those remain CRC/MCC-specific). Instead, add breast context to the existing notes.

**Step 1: Update nccnGuidelinesNotes to include breast context**

Find Signatera (mrd-7) `nccnGuidelinesNotes` field.

Before:
```javascript
"nccnGuidelinesNotes": "NCCN V.2.2025 update specifically references Signatera publications. CRC: ctDNA included as high risk factor for recurrence. MCC: positive recommendation for ctDNA monitoring in surveillance, citing Signatera data.",
```

After:
```javascript
"nccnGuidelinesNotes": "NCCN V.2.2025 update specifically references Signatera publications. CRC: ctDNA included as high risk factor for recurrence. MCC: positive recommendation for ctDNA monitoring in surveillance, citing Signatera data. Note: NCCN Breast Cancer v2.2026 acknowledges ctDNA for biomarker testing in recurrent/Stage IV (BINV-18) and ESR1 mutation detection (BINV-Q), but does not name specific MRD assays for breast surveillance.",
```

**Step 2: Run smoke tests**

```bash
npm run test:smoke
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/data.js
git commit -m "data: add NCCN breast v2.2026 context to Signatera notes"
```

---

### Task 5: Update Decision Trees with v2.2026 Reference

**Files:**
- Modify: `physician-system/data/decision-trees.json` (breast scenario)

**Step 1: Update nccn_reference in breast scenario**

Find the `breast_I_III_post_surgery_MRD_positive` scenario and update the `nccn_reference` field in the first decision.

Before:
```json
"nccn_reference": "NCCN Breast Cancer v2.2026 — Adjuvant and Post-Neoadjuvant Therapy",
```

After:
```json
"nccn_reference": "NCCN Breast Cancer v2.2026 (Feb 2026) — Adjuvant and Post-Neoadjuvant Therapy. Note: v2.2026 acknowledges ctDNA for biomarker testing in recurrent/Stage IV disease (BINV-18 fn iii) and recommends ctDNA-preferred ESR1 mutation detection at progression (BINV-Q fn v), but does not endorse MRD-guided surveillance for early-stage breast cancer (BINV-17).",
```

**Step 2: Add evidence gap if not already present**

Check the `evidence_gaps` array. Add this gap if it doesn't exist:

```json
"NCCN Breast v2.2026 does not include ctDNA/MRD in surveillance recommendations (BINV-17), despite acknowledging ctDNA utility in metastatic settings"
```

**Step 3: Run physician-system tests if available**

```bash
cd physician-system && npm test
```

**Step 4: Commit**

```bash
git add physician-system/data/decision-trees.json
git commit -m "data: update breast decision tree with NCCN v2.2026 references"
```

---

### Task 6: Verify End-to-End Integration

**Step 1: Run full smoke tests**

```bash
npm run test:smoke
```

Expected: All pass.

**Step 2: Verify RAG content (if database accessible)**

Query the database to confirm breast v2.2026 content was ingested:

```bash
cd physician-system && node -e "
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.MRD_DATABASE_URL });
pool.query(\"SELECT id, title, source_type, evidence_level FROM mrd_guidance_items WHERE source_type = 'nccn_guideline' AND id IN (SELECT guidance_id FROM mrd_guidance_cancer_types WHERE cancer_type = 'breast') ORDER BY created_at DESC LIMIT 5\")
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
"
```

Expected: Recent entries with breast cancer NCCN guideline content.

**Step 3: Preview deploy**

```bash
./preview "NCCN Breast Cancer v2.2026 integration"
```

---

## Out of Scope

- No MRD tests get `nccnNamedInGuidelines: true` for breast (guideline doesn't name them)
- No new tests to add
- No chat system prompt changes
- No NCCN processor code changes
- TDS CGP tests (FoundationOne CDx, Guardant360 CDx, etc.) already have correct vendor alignment notes stating NCCN recommends biomarker testing but doesn't endorse specific assays
