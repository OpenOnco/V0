# Test Category Reference

Detailed information about each test category.

---

## Overview

| Category | Code | Tests | Sample | Purpose |
|----------|------|-------|--------|---------|
| Hereditary Cancer Testing | HCT | 33 | Blood/Saliva | Inherited risk assessment |
| Early Cancer Detection | ECD | 23 | Blood/Stool/Urine | Screening asymptomatic people |
| Molecular Residual Disease | MRD | 27 | Blood/Plasma | Post-treatment surveillance |
| Treatment Response Monitoring | TRM | 15 | Blood/Plasma | Tracking during treatment |
| Treatment Decision Support | TDS | 28+ | Tissue/Blood | Therapy selection |

---

## HCT - Hereditary Cancer Testing

**URL:** `/risk`  
**Sample:** Blood or saliva (germline DNA)  
**Who:** Healthy individuals with family history or meeting NCCN criteria

### Key Syndromes

| Syndrome | Key Genes | Associated Cancers |
|----------|-----------|-------------------|
| HBOC | BRCA1, BRCA2, PALB2 | Breast, ovarian, pancreatic, prostate |
| Lynch | MLH1, MSH2, MSH6, PMS2 | Colorectal, endometrial, ovarian |
| Li-Fraumeni | TP53 | Breast, sarcoma, brain |
| Cowden | PTEN | Breast, thyroid, endometrial |
| FAP | APC | Colorectal |

### Key Fields
- `genesAnalyzed` - Number of genes on panel
- `keyGenes` - Notable genes covered
- `syndromesDetected` - Hereditary syndromes identified
- `deletionDuplicationAnalysis` - Del/dup detection (important for BRCA)
- `vusRate` - Variant of Uncertain Significance rate
- `geneticCounselingIncluded` - Counseling availability

### Quality Indicators
✅ Good: Del/dup analysis, low VUS rate, genetic counseling, cascade testing  
⚠️ Concern: No del/dup (misses ~10% BRCA), VUS not disclosed, no counseling

---

## ECD - Early Cancer Detection

**URL:** `/screen`  
**Sample:** Blood (liquid biopsy), stool, urine  
**Who:** Asymptomatic adults, typically 45+ for average risk

### Test Types

| Type | Examples | Cancers | Medicare |
|------|----------|---------|----------|
| Single-cancer (CRC) | Shield, Cologuard | Colorectal | NCD 210.3 |
| Multi-cancer (MCED) | Galleri | 50+ cancers | Not covered |
| Single-cancer (Other) | FirstLook Lung | Lung | Not covered |

### Key Fields
- `testScope` - "Single-cancer (CRC)" or "Multi-cancer (MCED)"
- `indicationGroup` - CRC, Lung, Liver, MCED
- `stageISensitivity` - Critical for screening value
- `specificity` - High threshold needed for screening (≥99%)
- `ppv` / `npv` - Predictive values
- `tumorOriginAccuracy` - For MCED tests

### Medicare Criteria (NCD 210.3)
- FDA market authorization required
- Sensitivity ≥74%
- Specificity ≥90%
- Age 45-85, average risk

---

## MRD - Molecular Residual Disease

**URL:** `/monitor`  
**Sample:** Blood/plasma (ctDNA)  
**Who:** Post-treatment cancer patients in surveillance

### Approaches

| Approach | How It Works | Pros | Cons |
|----------|--------------|------|------|
| **Tumor-informed** | Uses patient's tumor mutations | Higher sensitivity | Requires tissue |
| **Tumor-naïve** | Fixed panel, no tissue needed | No tissue required | Lower sensitivity |

### Key Fields
- `approach` - "Tumor-informed" or "Tumor-naïve"
- `requiresTumorTissue` - Whether tissue biopsy needed
- `sensitivity` / `specificity` - Performance metrics
- `lod` / `lod95` - Detection threshold (ppm, VAF%)
- `leadTimeVsImaging` - Days ahead of CT/PET detection
- `initialTat` / `followUpTat` - Turnaround times
- `clinicalSettings` - "Post-Surgery", "Surveillance", "Post-Adjuvant"

### Medicare Coverage (L38779)
Most major MRD tests covered for Stage II-IV solid tumors post-curative therapy:
- Signatera, Guardant Reveal, RaDaR, clonoSEQ, Haystack MRD, etc.

---

## TRM - Treatment Response Monitoring

**URL:** `/monitor` (combined with MRD)  
**Sample:** Blood/plasma  
**Who:** Patients on active treatment

### Distinct from MRD
- **MRD:** Looking for recurrence after treatment ends
- **TRM:** Tracking tumor burden during treatment

### Key Fields
- `approach` - Tumor-informed/naïve/agnostic
- `responseDefinition` - How molecular response defined
- `cancerTypes` - Treatment settings covered
- Shares many fields with MRD (sensitivity, specificity, LOD)

### Examples
- Signatera IO Monitoring (immunotherapy response)
- Guardant360 Response
- FoundationOne Liquid CDx (tumor fraction tracking)

---

## TDS - Treatment Decision Support

**URL:** `/treat`  
**Sample:** Tissue (biopsy) or blood/plasma  
**Who:** Cancer patients selecting therapy

### Product Types

| Type | Examples | Sample |
|------|----------|--------|
| Tissue CGP | FoundationOne CDx, Tempus xT | FFPE tissue |
| Liquid CGP | Guardant360, Foundation Liquid | Blood/plasma |
| Hybrid | Some tests offer both | Either |
| IVD Kits | Therascreen, cobas | Tissue (in-house) |

### Key Fields
- `approach` - "Tissue CGP", "Liquid CGP", "Gene Expression"
- `genesAnalyzed` - Number of genes on panel
- `biomarkersReported` - SNVs, indels, CNAs, TMB, MSI, fusions
- `fdaCompanionDxCount` - Number of FDA CDx approvals
- `productType` - "Central Lab Service" vs "Laboratory IVD Kit"

### Medicare Coverage
- **FDA CDx tests:** Covered under NCD 90.2 Section B
- **LDTs:** MAC discretion (L38043, L38121)
- Most major tissue CGP tests covered for advanced cancer

---

## Category Comparison

| Metric | HCT | ECD | MRD | TRM | TDS |
|--------|-----|-----|-----|-----|-----|
| **Sample** | Blood/saliva | Blood/stool | Plasma | Plasma | Tissue/plasma |
| **When** | Pre-cancer | Screening | Post-treatment | On treatment | Treatment selection |
| **Mutations** | Germline | Somatic | Somatic | Somatic | Somatic |
| **Key metric** | Genes analyzed | Stage I sens | LOD | Response def | CDx count |
| **Medicare** | Variable | NCD 210.3 | L38779 | Variable | NCD 90.2 |

---

## URL Mapping

| Lifecycle Stage | URL | Categories |
|-----------------|-----|------------|
| Risk Assessment | `/risk` | HCT |
| Screening | `/screen` | ECD |
| Monitoring | `/monitor` | MRD + TRM |
| Treatment | `/treat` | TDS |
