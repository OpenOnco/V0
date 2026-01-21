# Test Category Reference

Detailed information about test categories beyond field requirements. For field definitions and submission process, see `SUBMISSION_PROCESS.md`.

---

## Category Overview

| Category | Code | Tests | Sample | Purpose |
|----------|------|-------|--------|---------|
| Hereditary Cancer Testing | HCT | 33+ | Blood/Saliva | Inherited risk assessment |
| Early Cancer Detection | ECD | 23+ | Blood/Stool/Urine | Screening asymptomatic people |
| Molecular Residual Disease | MRD | 27+ | Blood/Plasma | Post-treatment surveillance |
| Treatment Response Monitoring | TRM | 15+ | Blood/Plasma | Tracking during treatment |
| Treatment Decision Support | TDS | 28+ | Tissue/Blood | Therapy selection |

---

## ECD - Early Cancer Detection

**URL:** `/screen`

### Test Types

| Type | Examples | Cancers | Medicare |
|------|----------|---------|----------|
| Single-cancer (CRC) | Shield, Cologuard | Colorectal | NCD 210.3 |
| Multi-cancer (MCED) | Galleri | 50+ cancers | Not covered |
| Single-cancer (Other) | FirstLook Lung | Lung | Not covered |

### Medicare Criteria (NCD 210.3 - CRC Screening)

For FDA-approved blood-based CRC screening:
- Sensitivity >=74%
- Specificity >=90%
- Age 45-85, average risk
- Once every 3 years

---

## MRD - Molecular Residual Disease

**URL:** `/monitor`

### Approaches Comparison

| Approach | How It Works | Pros | Cons |
|----------|--------------|------|------|
| **Tumor-informed** | Designs custom assay from patient's tumor mutations | Higher sensitivity, lower LOD | Requires tissue biopsy, longer initial TAT |
| **Tumor-naive** | Fixed panel, no tissue needed | No tissue required, faster start | Lower sensitivity, higher LOD |

### Key Metrics

- **LOD (Limit of Detection):** Lower is better. Tumor-informed ~0.001%, tumor-naive ~0.1-0.5%
- **Lead Time:** How many months MRD detection precedes imaging. Typically 6-12 months.
- **Initial vs Follow-up TAT:** Tumor-informed has longer initial TAT (2-3 weeks) but similar follow-up TAT.

---

## TRM - Treatment Response Monitoring

**URL:** `/monitor` (combined with MRD)

### Distinct from MRD

| Aspect | MRD | TRM |
|--------|-----|-----|
| **When** | Post-treatment (surveillance) | During treatment |
| **Purpose** | Detect recurrence | Track response to therapy |
| **Frequency** | Every 3-6 months | More frequent, during treatment cycles |
| **Key metric** | ctDNA detectability | Change in tumor burden over time |

### Examples
- Signatera IO Monitoring (immunotherapy response)
- Guardant360 Response
- FoundationOne Liquid CDx (tumor fraction tracking)

---

## TDS - Treatment Decision Support

**URL:** `/treat`

### Product Types

| Type | Examples | Sample | Typical Use |
|------|----------|--------|-------------|
| Tissue CGP | FoundationOne CDx, Tempus xT | FFPE tissue | Initial diagnosis, tissue available |
| Liquid CGP | Guardant360, Foundation Liquid | Blood/plasma | No tissue, rapid results needed |
| Hybrid | Some tests offer both | Either | Flexibility |
| IVD Kits | Therascreen, cobas | Tissue (in-house) | Hospital labs running own tests |

### FDA Companion Diagnostic (CDx) Status

Tests with FDA CDx approvals can be used to select patients for specific therapies. Key indicator: `fdaCompanionDxCount` field.

---

## Category Comparison

| Metric | HCT | ECD | MRD | TRM | TDS |
|--------|-----|-----|-----|-----|-----|
| **Sample** | Blood/saliva | Blood/stool | Plasma | Plasma | Tissue/plasma |
| **When** | Pre-cancer | Screening | Post-treatment | On treatment | Treatment selection |
| **Mutations** | Germline | Somatic | Somatic | Somatic | Somatic |
| **Key metric** | Genes analyzed | Stage I sensitivity | LOD | Response definition | CDx count |
| **Medicare** | Variable | NCD 210.3 | L38779 | Variable | NCD 90.2 |

---

## URL Mapping

| Lifecycle Stage | URL | Categories |
|-----------------|-----|------------|
| Risk Assessment | `/risk` | HCT |
| Screening | `/screen` | ECD |
| Monitoring | `/monitor` | MRD + TRM |
| Treatment | `/treat` | TDS |

---

## Related Documentation

- **Field definitions:** `SUBMISSION_PROCESS.md` Section A3
- **HCT syndromes & quality indicators:** `SUBMISSION_PROCESS.md` HCT-Specific Guidance
- **Medicare coverage details:** `CMS_MEDICARE_COVERAGE.md`
