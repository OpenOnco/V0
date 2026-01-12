# Vendor Coverage Map Summary

## Overview

This document summarizes the **vendor-coverage-map.json** database, a structured reference of Medicare coverage information for oncology tests available in OpenOnco. The database captures vendor-published coverage policies, LCD/NCD references, covered indications, and reimbursement data sourced from vendor websites, billing pages, and press releases.

**Last Updated:** 2026-01-12

---

## Database Statistics

| Metric | Count |
|--------|-------|
| Total Vendors | 17 |
| Total Tests | 41 |
| Vendors Pending Research | 0 |

---

## Coverage Policy Reference

| Policy ID | Name | Type | Category |
|-----------|------|------|----------|
| **L38779** | MolDX: Molecular Residual Disease Testing for Cancer | LCD | MRD |
| **NCD 90.2** | Next Generation Sequencing (NGS) | NCD | CGP/TDS |
| **NCD 210.3** | Colorectal Cancer Screening Tests | NCD | ECD |
| **L38043** | MolDX: Plasma-Based Genomic Profiling | LCD | CGP liquid biopsy |
| **L38121** | MolDX: Next-Generation Sequencing for Solid Tumors | LCD | CGP/TDS |

### Policy Details

#### L38779 - MRD Testing
- **General Criteria:** Stage II-IV solid tumors, post-curative intent therapy, serial monitoring for recurrence
- **MAC:** Multiple (Palmetto GBA administered)

#### NCD 90.2 - NGS
- **Section B:** FDA-approved companion diagnostics - nationally covered
- **Section D:** Laboratory developed tests - MAC discretion

#### NCD 210.3 - CRC Screening
- **Section B.3:** Blood-based Biomarker Tests
- **Criteria:** FDA market authorization required, sensitivity ≥74%, specificity ≥90%, age 45-85, average risk

---

## Tests by Coverage Status

### Covered (27 tests)

| Vendor | Test | Coverage Policy | Key Indications |
|--------|------|-----------------|-----------------|
| **Natera** | Signatera | L38779 | Stage II-IV CRC, breast, bladder, ovarian; Stage I-IV NSCLC; Pan-cancer IO monitoring |
| **Natera** | Signatera Genome | L38779 | Same as Signatera |
| **Guardant Health** | Guardant360 CDx | NCD 90.2 | Recurrent/metastatic solid tumors (non-CNS) |
| **Guardant Health** | Guardant360 Liquid | NCD 90.2 | Same as Guardant360 CDx |
| **Guardant Health** | Guardant360 Response | LCD (TRM) | Metastatic solid tumors on ICIs |
| **Guardant Health** | Reveal MRD | L38779 | Stage II-III CRC |
| **Guardant Health** | Shield | NCD 210.3 | CRC screening, age 45-85, q3 years |
| **Foundation Medicine** | FoundationOne CDx | NCD 90.2 | All solid tumors |
| **Foundation Medicine** | FoundationOne Liquid CDx | NCD 90.2 | Advanced solid tumors (tissue insufficient) |
| **Foundation Medicine** | FoundationOne Heme | NCD 90.2 | Hematologic malignancies, sarcomas |
| **Foundation Medicine** | FoundationOne Tracker | L38779 | MRD (Natera partnership) |
| **Exact Sciences** | Oncotype DX Breast | Covered | HR+, HER2-, node-negative early breast cancer |
| **Tempus AI** | Tempus xT CDx | NCD 90.2 | Solid tumor profiling, CRC (KRAS CDx) |
| **Tempus AI** | Tempus xT | MolDX | All solid tumors, myeloid malignancies |
| **Tempus AI** | Tempus xF | L38043 | Liquid biopsy CGP |
| **Caris Life Sciences** | MI Cancer Seek | NCD 90.2 | All solid tumors (WES/WTS) |
| **Caris Life Sciences** | MI Profile | L38121 | All solid tumors |
| **Caris Life Sciences** | MI Tumor Seek Hybrid | L38121 | All solid tumors |
| **Caris Life Sciences** | Caris Assure | MolDX | Liquid biopsy therapy selection |
| **Adaptive Biotechnologies** | clonoSEQ | L38779 | B-ALL, MM, CLL, DLBCL, MCL |
| **NeoGenomics** | RaDaR | L38779 | HR+/HER2- breast cancer MRD |
| **NeoGenomics** | InVisionFirst-Lung | L37870 | Advanced NSCLC |
| **Personalis** | NeXT Dx | L38119 | All solid tumors (WES/WTS) |
| **Personalis** | NeXT Personal Dx | L38779 | Stage II-III breast cancer MRD |
| **BillionToOne** | Northstar Select | L38043 | Advanced solid tumors |
| **MSK** | MSK-IMPACT | NCD 90.2 (D) | Solid malignant neoplasms |
| **MSK** | MSK-ACCESS | L38043 | Liquid biopsy CGP |
| **Labcorp** | Invitae PCM | L38779 | MRD monitoring |
| **Quest Diagnostics** | Haystack MRD | L38779 | Multi-solid tumor MRD |
| **Strata Oncology** | StrataNGS | L38043 | Advanced solid tumors |

### Pending Coverage (2 tests)

| Vendor | Test | Status | Notes |
|--------|------|--------|-------|
| **BillionToOne** | Northstar Response | Pending | Methylation-based TRM; targeting coverage by end of 2026 |
| **Guardant Health** | Shield MCD | Pending | Multi-cancer detection; awaiting FDA approval |

### Not Covered (3 tests)

| Vendor | Test | Reason | Patient Cost |
|--------|------|--------|--------------|
| **GRAIL** | Galleri | No Medicare coverage; pending FDA approval and congressional action (H.R. 2407, S. 2085) | $949 self-pay |
| **Exact Sciences** | Cancerguard | MCED - no current coverage pathway | N/A |
| **Exact Sciences** | Cologuard Plus | Different from original Cologuard; needs verification | N/A |

### Needs Verification (9 tests)

| Vendor | Test | Notes |
|--------|------|-------|
| **Natera** | Foresight CLARITY Lymphoma | Coverage status unclear |
| **Exact Sciences** | Oncoguard Liver | Coverage status unclear |
| **Exact Sciences** | Oncodetect | MRD - likely L38779 but needs confirmation |
| **Exact Sciences** | OncoExTra | CGP - likely NCD 90.2 but needs confirmation |

---

## Reimbursement Data (Where Available)

| Test | Reimbursement |
|------|--------------|
| Guardant360 Response | $3,500 |
| Shield | $1,495 |
| MI Cancer Seek | $8,455 |
| Caris Assure | $3,649 |
| NeXT Personal Dx (MRD Setup) | $4,266 |
| NeXT Personal Dx (Plasma Test) | $1,164 |
| Galleri | $949 (self-pay only) |

---

## Next Steps for Full 109-Test Mapping

### Immediate Actions

1. **Identify Missing Tests** - Cross-reference the 41 tests in this database against the full 109 tests in OpenOnco to identify the 68 missing tests

2. **Priority Vendors to Research:**
   - **Myriad Genetics** - BRACAnalysis CDx, myChoice CDx, Prolaris, EndoPredict
   - **Biodesix** - Nodify XL2, GeneStrat, VeriStrat
   - **Veracyte** - Afirma, Prosigna, Decipher
   - **PathAI / Paige** - Paige Prostate
   - **Agilent / Resolution** - Resolution ctDx Lung

3. **Coverage Categories Still Needed:**
   - Thyroid nodule tests (Afirma, ThyroSeq)
   - Prostate prognostic tests (Prolaris, Decipher, Oncotype GPS)
   - Hereditary cancer panels (BRACAnalysis, myRisk)
   - Lung nodule classifiers (Nodify, LungLB)

### Research Sources

- **Primary:** Vendor billing/patient financial assistance pages
- **Secondary:** CMS.gov LCD/NCD databases, MolDX website
- **Tertiary:** Press releases, SEC filings, earnings call transcripts

### Data Fields to Capture Per Test

```json
{
  "lcd": "LCD ID or null",
  "ncd": "NCD section or null",
  "coveredIndications": ["Array of covered uses"],
  "reimbursement": "Dollar amount or null",
  "fdaStatus": "Approval type if relevant",
  "notes": "Verification notes"
}
```

### Verification Workflow

1. Check vendor billing page for coverage claims
2. Cross-reference LCD/NCD ID in CMS database
3. Note specific covered indications (cancer type, stage, timing)
4. Record reimbursement if published
5. Add source date for audit trail

---

## File Structure

```
scripts/cms-coverage-scraper/
├── vendor-coverage-map.json    # Main database
├── COVERAGE_MAP_SUMMARY.md     # This file
└── [future: coverage-scraper.js]
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-12 | Initial database with 17 vendors, 41 tests |
