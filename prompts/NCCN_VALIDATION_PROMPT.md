# NCCN Field Validation Prompt

**Purpose:** Validate NCCN-related fields in OpenOnco's diagnostic test database against authoritative sources.

---

## Context

You are validating a cancer diagnostics database. We have two types of NCCN-related claims:

1. **`nccnNamedInGuidelines: true`** - Test is actually NAMED/CITED in NCCN guidelines (rare, ~7 tests)
2. **`vendorClaimsNCCNAlignment: true`** - Vendor claims biomarker coverage aligned with NCCN recommendations (common, ~23 tests)

**Critical distinction:** NCCN guidelines recommend **biomarkers and genes**, NOT specific commercial assays. A test "covering NCCN-recommended biomarkers" is NOT the same as being "NCCN recommended."

---

## Your Task

For each test in the attached `data.js` that has NCCN-related fields, search the web and validate:

### For tests with `nccnNamedInGuidelines: true`:

1. **Verify the test IS actually named** in an NCCN guideline document
2. **Confirm the guideline reference** (e.g., "NCCN B-Cell Lymphomas V.2.2025")
3. **Verify the specific recommendation language** matches what we have in `nccnGuidelinesNotes`
4. **Flag any tests that should NOT have this field** (vendor marketing ≠ NCCN naming)

Search queries to try:
- `"[test name]" NCCN guidelines site:nccn.org`
- `"[test name]" NCCN recommendation`
- `[test name] NCCN [cancer type] guidelines 2024 2025`

### For tests with `vendorClaimsNCCNAlignment: true`:

1. **Verify the vendor actually makes this claim** on their website
2. **Confirm the citation URL is valid** and contains the claim
3. **Check if vendor claim is accurate** (do they cover the biomarkers NCCN recommends for those indications?)
4. **Flag any tests that should be UPGRADED to `nccnNamedInGuidelines`** if actually named

---

## Tests to Validate

### Currently marked as NCCN-Named (`nccnNamedInGuidelines: true`):

| Test | Guideline Reference | Notes |
|------|---------------------|-------|
| Signatera | NCCN Colorectal Cancer, Breast Cancer Guidelines | Category 2A for ctDNA post-resection |
| Signatera Genome | Same as Signatera | |
| Signatera (IO Monitoring) | Same as Signatera | ICI response variant |
| Foresight CLARITY Lymphoma | NCCN B-Cell Lymphomas V.2.2025 (Dec 2024) | First ctDNA-MRD test named |
| clonoSEQ | NCCN Multiple Myeloma, ALL, CLL Guidelines | Category 2A, NGS-based MRD |
| Oncotype DX Breast Recurrence Score | NCCN Breast Cancer Guidelines | NCCN-preferred, Category 1 |
| IsoPSA | NCCN Prostate Cancer Early Detection V.1.2025 | Named for pre-biopsy use |

### Currently marked as Vendor Claims Only (`vendorClaimsNCCNAlignment: true`):

- FoundationOne CDx, FoundationOne Liquid CDx, FoundationOne Heme
- Guardant360 CDx, Guardant360 Liquid
- Tempus xT CDx, Tempus xF, Tempus xF+
- MSK-IMPACT
- MI Cancer Seek, MI Profile
- OncoExTra, OmniSeq INSIGHT, StrataNGS
- NEO PanTracer Tissue, Northstar Select
- Liquid Trace Solid Tumor, Liquid Trace Hematology
- LiquidHALLMARK, Resolution ctDx FIRST
- CancerDetect, LymphoVista

---

## Output Format

Please provide your findings in this format:

```markdown
## Validation Results

### NCCN-Named Tests

#### [Test Name]
- **Status:** ✅ CONFIRMED / ⚠️ NEEDS REVIEW / ❌ INCORRECT
- **Evidence found:** [URL or source]
- **Guideline document:** [Exact NCCN guideline name and version]
- **Exact language:** "[Quote from guideline if found]"
- **Recommendation:** [Keep as-is / Update reference / Downgrade to vendor claim]
- **Notes:** [Any discrepancies or additional context]

### Vendor Claims Tests

#### [Test Name]  
- **Vendor claim verified:** ✅ YES / ❌ NO
- **Citation URL valid:** ✅ YES / ❌ NO (provide working URL if different)
- **Should upgrade to NCCN-Named:** ✅ YES / ❌ NO
- **Evidence:** [URL showing vendor claim or NCCN mention]
- **Notes:** [Any issues found]

### Tests That May Be Missing

List any tests you found that ARE named in NCCN guidelines but are NOT in our database with `nccnNamedInGuidelines: true`.

### Summary Statistics

- NCCN-Named tests confirmed: X/7
- NCCN-Named tests needing correction: X
- Vendor claims verified: X/23
- Tests to upgrade to NCCN-Named: X
- Tests to add: X
```

---

## Key Sources to Check

1. **NCCN Guidelines** (nccn.org) - Primary source, requires registration
2. **PubMed** - For guideline citations and test mentions
3. **FDA** - For companion diagnostic approvals referenced in NCCN
4. **Vendor websites** - For their NCCN alignment claims
5. **ASCO/ESMO guidelines** - Sometimes cross-referenced with NCCN

---

## Important Notes

- NCCN updates guidelines frequently - check for 2024/2025 versions
- Some tests may be named in NCCN "Biomarkers Compendium" vs main guidelines
- FDA CDx approval ≠ NCCN naming (though often correlated)
- Be skeptical of vendor marketing language that implies NCCN endorsement
- Category 1/2A/2B/3 evidence levels matter for named tests

---

## Attached File

`data.js` contains all test records. Search for:
- `nccnNamedInGuidelines`
- `nccnGuidelineReference`
- `nccnGuidelinesNotes`
- `vendorClaimsNCCNAlignment`
- `vendorNCCNAlignmentCitation`
- `vendorNCCNAlignmentIndications`
- `vendorNCCNAlignmentNotes`
