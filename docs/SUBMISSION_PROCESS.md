# OpenOnco Submission Process

**Last updated:** 2026-01-08

---

## 🚨 MANDATORY COMPLETION CHECKLIST

**STOP! Before committing ANY submission, verify ALL items for your submission type:**

### For ALL Submissions:
- [ ] `vendorRequestedChanges` field updated on test object
- [ ] `DATABASE_CHANGELOG` entry added (top of array, ~line 6090)
- [ ] `Last updated` comment at top of data.js updated
- [ ] **Medicare coverage verified** (if `lastVerified` >90 days old) - see Section A4
- [ ] Build passes: `npm run build`
- [ ] Smoke tests pass: `npm run test:smoke`

### Additional for NEW TESTS:
- [ ] Next ID used (check Quick Reference table in data.js header)
- [ ] Quick Reference table updated with new LAST ID / NEXT ID
- [ ] `RECENTLY_ADDED_TESTS` updated (if applicable)

### Additional for VENDOR VERIFICATION:
- [ ] `vendorVerified: true` on test object
- [ ] `VENDOR_VERIFIED` object entry added (~line 463 in data.js)
  ```javascript
  '[test-id]': {
    name: '[Submitter Name]',
    company: '[Company]',
    verifiedDate: '[YYYY-MM-DD]',
    editsSubmitted: [number]
  },
  ```
  ⚠️ **Missing this = no green badge, test won't sort to top!**

---

## Category Overview

OpenOnco organizes tests into **4 lifecycle stages** (displayed on homepage):

| Stage | Category Code | URL | Purpose | Sample Type |
|-------|--------------|-----|---------|-------------|
| **Hereditary Risk** | HCT | `/risk` | Germline testing for inherited cancer predisposition | Blood, Saliva |
| **Cancer Screening** | ECD | `/screen` | Early detection in asymptomatic individuals | Blood, Stool, Saliva |
| **Cancer Monitoring** | MRD + TRM | `/monitor` | Post-treatment surveillance & treatment response | Blood/Plasma |
| **Treatment Selection** | TDS | `/treat` | CGP/biomarker testing to guide therapy | Tissue, Blood/Plasma |

**Note:** MRD (Molecular Residual Disease) and TRM (Treatment Response Monitoring) are combined into the "Cancer Monitoring" lifecycle stage but remain separate data arrays internally.

---

## Quick Reference

| Submission Type | Trigger Phrases | Go To |
|-----------------|-----------------|-------|
| **New Test** | "new test", "add this test", vendor proposal | Section A |
| **Change Request** | "update", "correction", "fix", vendor edits | Section B |
| **Vendor Verification** | "vendor verified", company rep validating | Section C |
| **Deletion** | "remove", "discontinue" | Section D |

---

## Before ANY Submission

```bash
# 1. Find existing test (if applicable)
grep -n "[test name or vendor]" /Users/adickinson/Documents/GitHub/V0/src/data.js

# 2. Check for duplicates
grep -n "[test name]" /Users/adickinson/Documents/GitHub/V0/src/data.js
```

---

# Section A: New Test

## A1: Eligibility (ALL must pass)

| Criterion | Required |
|-----------|----------|
| Real test | Commercially available OR active clinical trials |
| Category fit | HCT, ECD, MRD, TRM, or TDS (see Category Overview above) |
| Validation data | Citable performance (publications, FDA, vendor) |
| Not duplicate | Distinct from existing tests |

**Category-specific sample requirements:**
- **HCT**: Blood or saliva (germline DNA) ✓
- **ECD**: Blood, plasma, stool, saliva, urine ✓
- **MRD/TRM**: Blood/plasma (ctDNA) ✓
- **TDS**: Tissue or blood/plasma ✓

**Any fail → Stop and explain to Alex**

## A2: Get Next ID

Check Quick Reference table at top of data.js:
```
// │ MRD Tests            │ ~480        │ mrd-25     │ mrd-26        │
// │ HCT Tests            │ TBD         │ hct-0      │ hct-1         │
```

## A3: Required Fields by Category

### Common Fields (ALL categories)
```javascript
id: "[category]-[number]",           // e.g., "hct-1", "mrd-26", "ecd-28"
name: "[Official Test Name]",
vendor: "[Company Name]",
productType: "Central Lab Service" | "Laboratory IVD Kit" | "Direct-to-Consumer",
sampleCategory: "[See category-specific]",
method: "[Technical description]",
methodCitations: "[URL]",

// Regulatory
fdaStatus: "[Status]",
fdaStatusCitations: "[URL]",
reimbursement: "[Status]",
reimbursementCitations: "[URL]",

// Turnaround & Availability
tat: "[X days or X-Y days]",
tatCitations: "[URL]",
availableRegions: ["US", "EU", ...],

// Evidence
numPublications: [number],
numPublicationsCitations: "[URLs]",

// Tracking
vendorVerified: false,
vendorRequestedChanges: "[YYYY-MM-DD]: Added via [source]"
```

### HCT-Specific Fields (Hereditary Cancer Testing)
```javascript
// Sample
sampleCategory: "Blood" | "Saliva" | "Blood or Saliva",
sampleType: "[Whole blood EDTA, Saliva kit, etc.]",

// Genes & Syndromes
genesAnalyzed: [number],                    // Number of genes on panel
genesAnalyzedCitations: "[URL]",
geneListUrl: "[URL to full gene list]",
keyGenes: ["BRCA1", "BRCA2", "MLH1", ...], // Notable genes covered
syndromesDetected: ["HBOC", "Lynch Syndrome", "Li-Fraumeni", ...],
cancerTypesAssessed: ["Breast", "Ovarian", "Colorectal", ...],

// Performance
analyticalSensitivity: [0-100],             // For variant detection
analyticalSensitivityCitations: "[URL]",
analyticalSpecificity: [0-100],
analyticalSpecificityCitations: "[URL]",
vusRate: [percentage],                      // Variant of Uncertain Significance rate
vusRateCitations: "[URL]",
deletionDuplicationAnalysis: "Yes" | "No" | "Select genes",

// Population & Ordering
targetPopulation: "[Who should get tested]",
nccnCriteria: "[NCCN criteria alignment]",
requiresPhysicianOrder: "Yes" | "No" | "Varies by state",

// Support Services
geneticCounselingIncluded: "Yes" | "No" | "Optional",
cascadeTestingOffered: "Yes" | "No",        // Family member testing
variantReclassificationPolicy: "Yes" | "No", // VUS update notifications
```

### MRD-Specific Fields
```javascript
sampleCategory: "Blood/Plasma",
approach: "Tumor-informed" | "Tumor-naïve",
cancerTypes: ["Colorectal", "Breast", ...],

// Performance
sensitivity: [0-100],
sensitivityCitations: "[URL]",
sensitivityNotes: "[Context - stages, timepoints]",
specificity: [0-100],
lod: "[X ppm or X%]",                       // Limit of detection
lod95: "[value]",
leadTime: "[X months vs imaging]",

// Sample details
sampleVolumeMl: [number],
sampleTubeType: "[Streck cfDNA BCT, etc.]",
initialTat: [days],                         // First test TAT
followUpTat: [days],                        // Subsequent test TAT
```

### ECD-Specific Fields
```javascript
sampleCategory: "Blood/Plasma" | "Stool" | "Saliva" | "Urine",
testScope: "Single-cancer (CRC)" | "Multi-cancer (MCED)",
indicationGroup: "CRC" | "Lung" | "Liver" | "MCED" | ...,
approach: "[Blood-based cfDNA screening, Stool DNA, etc.]",
cancerTypes: ["Colorectal", ...],
targetPopulation: "[Age range, risk level]",

// Performance
sensitivity: [0-100],
stageISensitivity: [0-100],
stageIISensitivity: [0-100],
specificity: [0-100],
ppv: [0-100],
npv: [0-100],
```

### TRM-Specific Fields
```javascript
sampleCategory: "Blood/Plasma",
approach: "Tumor-informed" | "Tumor-naïve" | "Tumor-agnostic",
cancerTypes: [...],
targetPopulation: "[Treatment setting]",
responseDefinition: "[How molecular response is defined]",

// Performance
sensitivity: [0-100],
specificity: [0-100],
lod: "[value]",
```

### TDS-Specific Fields
```javascript
sampleCategory: "Tissue" | "Blood/Plasma" | "Tissue or Blood/Plasma",
approach: "Tissue CGP" | "Liquid CGP" | "Gene Expression Profiling",
genesAnalyzed: [number],
biomarkersReported: ["SNVs", "Indels", "CNAs", "TMB", "MSI", ...],
cancerTypes: ["All solid tumors", ...],

// Companion Diagnostics
fdaCompanionDxCount: [number],
fdaCompanionDxCountCitations: "[URL]",
```

## A4: Medicare Coverage Lookup

**For US tests only.** Use CMS MCP tools to determine coverage status.

### On-Demand Verification (When Editing Existing Tests)

When processing ANY submission for an existing test:
1. Check `medicareCoverage.lastVerified` date
2. If >90 days old OR missing → verify coverage before committing
3. Update `lastVerified` to today's date

**Claude will automatically check this during submission processing.**

### Quick Decision Tree (For New Tests)

```
Is test FDA-approved?
├── YES → Check NCD 90.2 (NGS) or applicable NCD
│   └── Is it a companion diagnostic? → Likely COVERED under Section B
└── NO → Check applicable LCD
    └── MRD test? → Check LCD L38779
    └── CRC screening? → Check NCD 210.3
    └── Liquid CGP? → Check LCD L38043
```

### Lookup Process

1. **Search for existing LCD/NCD:**
   ```javascript
   CMS MCP:search_local_coverage({ keyword: "[test name or vendor]", document_type: "lcd" })
   CMS MCP:search_national_coverage({ keyword: "[indication]", document_type: "ncd" })
   ```

2. **Check vendor billing page** for coverage claims

3. **Set medicareCoverage object:**
   ```javascript
   medicareCoverage: {
     status: "COVERED" | "NOT_COVERED" | "PENDING_COVERAGE" | "PENDING_FDA" | "UNKNOWN",
     policyType: "LCD" | "NCD" | "CLFS" | null,
     policyNumber: "L38779" | "90.2" | null,
     policyName: "[Full policy name]",
     coveredIndications: ["Stage II-IV CRC", ...],
     reimbursementRate: "$3,500" | null,
     cptCode: "0361U" | null,
     notes: "[Additional context]",
     lastVerified: "[YYYY-MM-DD]"
   }
   ```

### Common Coverage Policies

| Category | Policy | Tests |
|----------|--------|-------|
| MRD | L38779 | Signatera, clonoSEQ, Reveal, Haystack, NavDx |
| CGP (FDA CDx) | NCD 90.2 | FoundationOne CDx, Guardant360 CDx, Tempus xT CDx |
| CGP (Liquid) | L38043 | Northstar Select, MSK-ACCESS, LiquidHALLMARK |
| CRC Screening | NCD 210.3 | Shield |

**Full documentation:** See `docs/CMS_MEDICARE_COVERAGE.md`

## A5: After Adding

1. Update Quick Reference table (LAST ID / NEXT ID)
2. Add to `DATABASE_CHANGELOG`
3. Add to `RECENTLY_ADDED_TESTS` if featured
4. Update `Last updated` comment
5. **Run completion checklist above**

---

# Section B: Change Request

## B1: Identify Test
```bash
grep -n '"id": "[test-id]"' /Users/adickinson/Documents/GitHub/V0/src/data.js
```

## B2: Change Types

| Type | Examples | Review Level |
|------|----------|--------------|
| Correction | Typo, broken link | Low |
| Update | New publication, FDA status | Medium |
| Performance | Sensitivity, specificity, LOD, VUS rate | **High - citation required** |
| Expansion | New genes, cancer types, syndromes | **High - evidence required** |

## B3: Apply Change

1. Edit the field(s)
2. Update related notes/citations
3. Append to `vendorRequestedChanges`:
   ```javascript
   "vendorRequestedChanges": "[existing]. [YYYY-MM-DD]: [Description] per [source]."
   ```

## B4: After Changing

1. Add to `DATABASE_CHANGELOG`
2. Update `Last updated` comment
3. **Run completion checklist above**

---

# Section C: Vendor Verification

## C1: Verify Authority

- [ ] Submitter email matches vendor domain
- [ ] Name and title provided
- [ ] Attestation confirmed

## C2: Process Any Corrections

If vendor identifies errors → Process as Change Request (Section B) first

## C3: Update TWO Locations (Both Required!)

### Location 1: Test Object
```javascript
vendorVerified: true,
vendorRequestedChanges: "[existing]. [YYYY-MM-DD]: Vendor verified by [Name], [Company]."
```

### Location 2: VENDOR_VERIFIED Object (~line 463)
```javascript
export const VENDOR_VERIFIED = {
  // ... existing entries ...
  '[test-id]': {  // [Test Name]
    name: '[Submitter Name]',
    company: '[Company]',
    verifiedDate: '[YYYY-MM-DD]',
    editsSubmitted: [number of changes]
  },
};
```

**⚠️ CRITICAL: Missing Location 2 = no green badge, test won't sort to top!**

## C4: After Verifying

1. Add to `DATABASE_CHANGELOG` with `type: 'verified'`
2. Update `Last updated` comment
3. **Run completion checklist above**

## C5: Email Templates

### Verification Invite
```
Subject: OpenOnco Database - [Test Name] Listing Verification

Hi [Name],

OpenOnco maintains a vendor-neutral database of cancer diagnostic tests.
We have [Test Name] listed and would appreciate your verification of the data accuracy.

Would you be willing to review the listing? Verified tests receive:
- Priority placement in search results
- Green verification badge
- Contributor credit

You can view the current listing at: https://openonco.org/test/[slug]

Best regards,
[Your name]
OpenOnco
```

### Correction Confirmation
```
Subject: Re: OpenOnco - Changes Applied

Hi [Name],

I've applied the corrections you submitted for [Test Name].
The changes will be live on openonco.org shortly.

Changes made:
- [List of changes]

Your verification badge is now active. Thank you for contributing to OpenOnco!

Best regards,
[Your name]
```

---

# Section D: Deletion

## D1: Valid Reasons Only

| Valid | Action |
|-------|--------|
| Discontinued by vendor | Remove |
| Never launched | Remove |
| Duplicate | Merge data, remove duplicate |
| Regulatory recall | Remove with note |

| Invalid | Action |
|---------|--------|
| Vendor doesn't like data | Decline - offer corrections |
| Competitor request | Decline |

## D2: Process

1. Remove test object from data.js
2. Remove from `VENDOR_VERIFIED` if present
3. Add to `DATABASE_CHANGELOG` with `type: 'removed'`
4. **Run completion checklist above**

---

# Red Flags → Ask Alex

| Red Flag | Concern |
|----------|---------|
| Performance change >10% | Cherry-picked data? |
| No peer-reviewed publications | Note as vendor-only |
| 100% performance with n<50 | Add warning flag |
| Contradictory claims | Get clarification |
| Request from non-vendor | Verify authority |
| RUO test claiming clinical use | Regulatory issue |
| HCT test without del/dup analysis | May miss large rearrangements |
| HCT VUS rate not disclosed | Data quality concern |

---

# Key Locations in data.js

| What | Approximate Line | Search For |
|------|------------------|------------|
| Header/Instructions | 1-50 | Top of file |
| Quick Reference Table | ~25-40 | `QUICK REFERENCE` |
| VENDOR_VERIFIED object | ~463 | `export const VENDOR_VERIFIED` |
| MRD tests | ~480 | `export const mrdTestData` |
| ECD tests | ~2100 | `export const ecdTestData` |
| TRM tests | ~3200 | `export const trmTestData` |
| TDS tests | ~3550 | `export const tdsTestData` |
| HCT tests | TBD | `export const hctTestData` |
| DATABASE_CHANGELOG | ~6090 | `export const DATABASE_CHANGELOG` |

---

# DATABASE_CHANGELOG Entry Format

```javascript
{
  date: 'Jan 8, 2026',
  type: 'added' | 'updated' | 'verified' | 'removed',
  testId: '[test-id]',
  testName: '[Test Name]',
  vendor: '[Company]',
  category: 'HCT' | 'ECD' | 'MRD' | 'TRM' | 'TDS',
  description: '[What changed]',
  contributor: '[Name]',
  affiliation: '[Company] (vendor)' | 'OpenOnco',
  citation: '[URL]'
},
```

---

# Verification Commands

```bash
# Build check
cd /Users/adickinson/Documents/GitHub/V0 && npm run build

# Smoke tests
npm run test:smoke

# Full tests (before release)
npm test

# Deploy to preview
git add src/data.js && git commit -m "[type]: [Test] - [description]" && git push origin develop

# Deploy to production
./release
```

---

# HCT-Specific Guidance

## What is HCT?

**Hereditary Cancer Testing (HCT)** identifies inherited (germline) mutations that increase lifetime cancer risk. This is fundamentally different from other OpenOnco categories:

| Aspect | HCT (Germline) | Other Categories (Somatic) |
|--------|----------------|---------------------------|
| **What's tested** | Inherited DNA mutations | Tumor/cancer cell mutations |
| **Sample source** | Blood or saliva (any cells) | Tumor tissue or ctDNA |
| **Who gets tested** | Healthy individuals at risk | Cancer patients |
| **Purpose** | Risk assessment, prevention | Diagnosis, treatment selection |
| **Result persistence** | Permanent (inherited) | Changes with disease |

## Key HCT Syndromes

| Syndrome | Key Genes | Associated Cancers |
|----------|-----------|-------------------|
| HBOC | BRCA1, BRCA2, PALB2 | Breast, ovarian, pancreatic, prostate |
| Lynch Syndrome | MLH1, MSH2, MSH6, PMS2 | Colorectal, endometrial, ovarian |
| Li-Fraumeni | TP53 | Breast, sarcoma, brain, adrenocortical |
| Cowden | PTEN | Breast, thyroid, endometrial |
| FAP | APC | Colorectal |

## HCT Quality Indicators

**Good signs:**
- ✅ Del/dup analysis included for all genes
- ✅ Low VUS rate disclosed (<5% ideal)
- ✅ Genetic counseling available
- ✅ Cascade testing for family members
- ✅ VUS reclassification notifications
- ✅ NY state approved (if serving NY patients)

**Concerns:**
- ⚠️ No del/dup analysis (misses ~10% of BRCA mutations)
- ⚠️ VUS rate not disclosed
- ⚠️ No genetic counseling support
- ⚠️ DTC without physician involvement
- ⚠️ Limited gene panel marketed as comprehensive

## HCT vs Related Tests

| If test does this... | Category |
|---------------------|----------|
| Detects inherited mutations in healthy people | **HCT** ✓ |
| Detects somatic mutations in tumor tissue | TDS |
| Detects ctDNA for treatment selection | TDS |
| Screens for early cancer (not mutations) | ECD |
| Monitors for cancer recurrence | MRD |
| Tracks treatment response | TRM |
