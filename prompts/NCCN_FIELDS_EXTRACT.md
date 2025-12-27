# NCCN Fields Extract from OpenOnco data.js

**Purpose:** Validate these NCCN-related fields against authoritative sources.

- **Extracted:** 2025-12-26
- **Total tests in DB:** 102
- **Tests with NCCN fields:** 30

---

## Part 1: Tests Named in NCCN Guidelines

These tests claim to be **actually named/cited** in NCCN guideline documents (not just biomarker coverage).

**Validation task:** Confirm each test IS named in the cited guideline.

### Signatera

- **ID:** mrd-7
- **Vendor:** Natera
- **Guideline Reference:** NCCN Colorectal Cancer, Breast Cancer Guidelines
- **Our Notes:** Category 2A recommendation for ctDNA testing to assess recurrence risk post-resection in colorectal cancer. Also referenced in breast cancer guidelines for MRD assessment.

**Validate:**
1. Is this test actually named in the cited NCCN guideline?
2. Is the guideline reference correct and current?
3. Does our notes text accurately reflect the guideline language?

### Foresight CLARITY Lymphoma

- **ID:** mrd-15
- **Vendor:** Natera
- **Guideline Reference:** NOT SET
- **Our Notes:** First ctDNA-MRD test named in NCCN Guidelines. Recommended to adjudicate PET-positive results at end of frontline DLBCL therapy (assay LOD <1ppm required).

**Validate:**
1. Is this test actually named in the cited NCCN guideline?
2. Is the guideline reference correct and current?
3. Does our notes text accurately reflect the guideline language?

### clonoSEQ

- **ID:** mrd-19
- **Vendor:** Adaptive Biotechnologies
- **Guideline Reference:** NCCN Multiple Myeloma, ALL, CLL Guidelines
- **Our Notes:** NCCN Category 2A recommendation. NGS-based MRD assessment specifically named for MM (at each treatment stage), ALL, and CLL.

**Validate:**
1. Is this test actually named in the cited NCCN guideline?
2. Is the guideline reference correct and current?
3. Does our notes text accurately reflect the guideline language?

### Signatera Genome

- **ID:** mrd-20
- **Vendor:** Natera
- **Guideline Reference:** NCCN Colorectal Cancer, Breast Cancer Guidelines
- **Our Notes:** Same NCCN recommendations as standard Signatera for MRD-guided care.

**Validate:**
1. Is this test actually named in the cited NCCN guideline?
2. Is the guideline reference correct and current?
3. Does our notes text accurately reflect the guideline language?

### Signatera (IO Monitoring)

- **ID:** trm-2
- **Vendor:** Natera
- **Guideline Reference:** NCCN Colorectal Cancer, Breast Cancer Guidelines
- **Our Notes:** Same NCCN recommendations as standard Signatera for MRD-guided care. ICI response monitoring variant.

**Validate:**
1. Is this test actually named in the cited NCCN guideline?
2. Is the guideline reference correct and current?
3. Does our notes text accurately reflect the guideline language?

### IsoPSA

- **ID:** tds-18
- **Vendor:** Cleveland Diagnostics
- **Guideline Reference:** NCCN Prostate Cancer Early Detection Guidelines V.1.2025
- **Our Notes:** Specifically named for use prior to biopsy and in patients with prior negative biopsy at higher risk for clinically significant prostate cancer.

**Validate:**
1. Is this test actually named in the cited NCCN guideline?
2. Is the guideline reference correct and current?
3. Does our notes text accurately reflect the guideline language?

### Oncotype DX Breast Recurrence Score

- **ID:** tds-19
- **Vendor:** Exact Sciences
- **Guideline Reference:** NCCN Breast Cancer Guidelines
- **Our Notes:** NCCN-preferred multigene assay with Category 1 evidence. Only test with Level 1 evidence for both prognosis AND prediction of chemotherapy benefit for HR+, HER2- breast cancer.

**Validate:**
1. Is this test actually named in the cited NCCN guideline?
2. Is the guideline reference correct and current?
3. Does our notes text accurately reflect the guideline language?

---

## Part 2: Tests with Vendor NCCN Alignment Claims

These tests have vendors claiming biomarker coverage aligned with NCCN recommendations.

**Important:** NCCN recommends biomarkers/genes, NOT specific commercial assays.

**Validation task:** Confirm vendor actually makes this claim and citation is valid.

### CancerDetect

- **ID:** mrd-22
- **Vendor:** IMBdx
- **Citation URL:** https://www.cancerdetect.com/
- **Indications Claimed:** None specified
- **Our Notes:** 

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### LymphoVista

- **ID:** mrd-23
- **Vendor:** LIQOMICS
- **Citation URL:** https://lymphovista.com/
- **Indications Claimed:** None specified
- **Our Notes:** ctDNA testing for MRD in DLBCL recently added to NCCN Guidelines (December 2024) following Foresight CLARITY inclusion. LymphoVista not specifically named but methodology aligns with emerging guideline recommendations for ctDNA-based MRD in lymphoma.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### FoundationOne CDx

- **ID:** tds-1
- **Vendor:** Foundation Medicine
- **Citation URL:** https://www.foundationmedicine.com/test/foundationone-cdx
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer, Ovarian Cancer, Melanoma, Gastric Cancer, Cholangiocarcinoma
- **Our Notes:** Covers biomarkers recommended by NCCN guidelines. NCCN guidelines recommend testing specific genes/biomarkers and 'broad molecular profiling' but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### FoundationOne Liquid CDx

- **ID:** tds-2
- **Vendor:** Foundation Medicine
- **Citation URL:** https://www.foundationmedicine.com/test/foundationone-liquid-cdx
- **Indications Claimed:** NSCLC, Breast Cancer, Prostate Cancer, Cholangiocarcinoma
- **Our Notes:** Covers biomarkers recommended by NCCN guidelines. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### FoundationOne Heme

- **ID:** tds-3
- **Vendor:** Foundation Medicine
- **Citation URL:** https://www.foundationmedicine.com/test/foundationone-heme
- **Indications Claimed:** Acute Myeloid Leukemia, Chronic Myeloid Leukemia, B-Cell Lymphomas, Myelodysplastic Syndromes, Soft Tissue Sarcoma
- **Our Notes:** Covers biomarkers recommended by NCCN guidelines for hematologic malignancies and sarcomas. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### Guardant360 CDx

- **ID:** tds-4
- **Vendor:** Guardant Health
- **Citation URL:** https://guardanthealth.com/guardant360-cdx/
- **Indications Claimed:** NSCLC, Breast Cancer
- **Our Notes:** Covers all genes recommended by NCCN for NSCLC and relevant biomarkers for breast cancer treatment. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### Guardant360 Liquid

- **ID:** tds-17
- **Vendor:** Guardant Health
- **Citation URL:** https://guardanthealth.com/guardant360/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer, Ovarian Cancer, Melanoma
- **Our Notes:** Covers all guideline-recommended genomic biomarkers across advanced solid tumors plus emerging biomarkers. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### Tempus xT CDx

- **ID:** tds-5
- **Vendor:** Tempus AI
- **Citation URL:** https://www.tempus.com/oncology/genomic-profiling/xt/
- **Indications Claimed:** NSCLC, Colorectal Cancer, Breast Cancer, Melanoma, Prostate Cancer, Ovarian Cancer
- **Our Notes:** Covers biomarkers recommended by NCCN guidelines for major solid tumors. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### Tempus xF

- **ID:** tds-6
- **Vendor:** Tempus AI
- **Citation URL:** https://www.tempus.com/oncology/genomic-profiling/xf/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer
- **Our Notes:** Covers key biomarkers recommended by NCCN guidelines for major solid tumors. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### Tempus xF+

- **ID:** tds-7
- **Vendor:** Tempus AI
- **Citation URL:** https://www.tempus.com/oncology/genomic-profiling/xf-plus/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer, Ovarian Cancer
- **Our Notes:** Expanded 523-gene panel covers all biomarkers recommended by NCCN guidelines for major solid tumors. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### MSK-IMPACT

- **ID:** tds-8
- **Vendor:** Memorial Sloan Kettering
- **Citation URL:** https://www.mskcc.org/msk-impact
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer, Melanoma, Ovarian Cancer, Gastric Cancer
- **Our Notes:** Covers biomarkers recommended by NCCN guidelines for major solid tumors. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### MI Cancer Seek

- **ID:** tds-9
- **Vendor:** Caris Life Sciences
- **Citation URL:** https://www.molecularmd.com/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Melanoma, Endometrial Cancer
- **Our Notes:** Covers biomarkers recommended by NCCN guidelines including PIK3CA, KRAS, NRAS, BRAF, MSI-H/TMB-H. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### OncoExTra

- **ID:** tds-11
- **Vendor:** Exact Sciences
- **Citation URL:** https://www.oncoextra.com/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer, Ovarian Cancer, Melanoma
- **Our Notes:** WES/WTS approach covers all biomarkers recommended by NCCN guidelines. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### OmniSeq INSIGHT

- **ID:** tds-12
- **Vendor:** Labcorp Oncology (OmniSeq)
- **Citation URL:** https://www.omniseq.com/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Melanoma, Prostate Cancer
- **Our Notes:** Covers biomarkers recommended by NCCN guidelines plus immune profiling. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### StrataNGS

- **ID:** tds-13
- **Vendor:** Strata Oncology
- **Citation URL:** https://www.stratangs.com/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer, Ovarian Cancer
- **Our Notes:** Covers biomarkers recommended by NCCN guidelines. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### MI Profile

- **ID:** tds-14
- **Vendor:** Caris Life Sciences
- **Citation URL:** https://www.molecularmd.com/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Melanoma, Prostate Cancer, Ovarian Cancer, Gastric Cancer
- **Our Notes:** Multi-omic approach covers biomarkers recommended by NCCN guidelines at DNA, RNA, and protein levels. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### NEO PanTracer Tissue

- **ID:** tds-15
- **Vendor:** NeoGenomics
- **Citation URL:** https://neotrex.com/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Melanoma, Prostate Cancer, Ovarian Cancer
- **Our Notes:** Pan-cancer CGP aligns with NCCN guidelines for solid tumor biomarker testing. NCCN recommends testing specific genes/biomarkers but does not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### Northstar Select

- **ID:** tds-16
- **Vendor:** BillionToOne
- **Citation URL:** https://www.biodesix.com/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer
- **Our Notes:** 84-gene panel covers guideline-recommended biomarkers. NCCN recommends testing specific genes/biomarkers but does not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### Liquid Trace Solid Tumor

- **ID:** tds-20
- **Vendor:** Genomic Testing Cooperative (GTC)
- **Citation URL:** https://imagenedx.com/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer, Ovarian Cancer
- **Our Notes:** Covers guideline-recommended biomarkers. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### Liquid Trace Hematology

- **ID:** tds-21
- **Vendor:** Genomic Testing Cooperative (GTC)
- **Citation URL:** https://imagenedx.com/
- **Indications Claimed:** Acute Myeloid Leukemia, Multiple Myeloma, B-Cell Lymphomas
- **Our Notes:** Covers guideline-recommended biomarkers for hematologic malignancies. NCCN guidelines recommend testing specific genes/biomarkers but do not endorse specific commercial assays by name.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### LiquidHALLMARK

- **ID:** tds-22
- **Vendor:** Lucence
- **Citation URL:** https://www.luminexcorp.com/
- **Indications Claimed:** NSCLC, Breast Cancer, Colorectal Cancer, Prostate Cancer
- **Our Notes:** Covers 9 NCCN guideline-recommended biomarkers for NSCLC: EGFR, ALK, RET, ROS1, BRAF, KRAS, MET, ERBB2, NTRK1/2/3. LIQUIK study showed LiquidHALLMARK detected 15.6% more tissue-confirmed, NCCN guideline-recommended biomarkers than FDA-approved ctDNA-only test.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

### Resolution ctDx FIRST

- **ID:** tds-23
- **Vendor:** Agilent / Resolution Bioscience
- **Citation URL:** https://resolutionbio.com/
- **Indications Claimed:** NSCLC
- **Our Notes:** Covers NCCN-recommended biomarkers for NSCLC including KRAS G12C and EGFR. 109-gene panel includes ALK, ROS1, RET, BRAF, MET, ERBB2, NTRK1/2/3.

**Validate:**
1. Does the citation URL work and contain NCCN alignment claim?
2. Should this be UPGRADED to nccnNamedInGuidelines?

---

## Part 3: Tests to Check for Missing NCCN Status

Search for any other cancer diagnostic tests that ARE named in NCCN guidelines but NOT in our list above.

Potential candidates to search:
- Other MRD tests (Guardant Reveal, RaDaR, NeXT Personal, etc.)
- Other breast cancer prognostic tests (MammaPrint, Prosigna, EndoPredict)
- Other prostate biomarker tests (SelectMDx, ExosomeDx, 4Kscore)
- Colorectal screening tests (Cologuard, Shield)
