# OpenOnco Test Submission Review Process

**When to use:** Activate this process whenever Alex pastes a test submission, vendor proposal, or test data for review.

---

## Phase 1: Eligibility Check (Gate)

Before extracting data, confirm the test meets ALL criteria:

| Criterion | Required | Notes |
|-----------|----------|-------|
| Real test | ✅ | Must be commercially available OR in active clinical trials (not pure research) |
| Category fit | ✅ | Must fit MRD, ECD, TRM, or TDS |
| Validation data | ✅ | Must have citable performance data (publications, FDA docs, or formal vendor data) |
| Not duplicate | ✅ | Must be distinct from existing tests (not rebrand/regional variant) |
| Liquid biopsy | ✅ | Blood, plasma, urine, or other liquid sample (no tissue-only tests) |

**If any criterion fails:** Explain why to Alex and suggest alternatives (e.g., "This is tissue-based only, not eligible for OpenOnco").

---

## Phase 2: Category Classification

### MRD (Minimal Residual Disease)
- Post-treatment cancer monitoring
- Detecting recurrence before imaging
- Tumor-informed OR tumor-naïve approaches
- Key metrics: sensitivity, specificity, LOD, lead time vs imaging

### ECD (Early Cancer Detection)
- Screening asymptomatic individuals
- Single-cancer OR multi-cancer (MCED)
- Key metrics: sensitivity by stage, specificity, PPV, NPV, cancer signal origin accuracy

### TRM (Therapy Response Monitoring)
- Tracking treatment response during active therapy
- CGP panels, resistance mutations, therapy selection
- Key metrics: genes covered, actionable findings rate, FDA status

### TDS (Tissue of Origin / Diagnostic)
- Identifying primary tumor site
- Cancer subtyping
- Key metrics: accuracy, cancer types covered

---

## Phase 3: Required Fields Extraction

### Core Fields (ALL tests)
```
id: "[category]-[number]"  // e.g., "mrd-26", "ecd-22"
sampleCategory: "Blood/Plasma" | "Urine" | "Other"
name: "[Official Test Name]"
vendor: "[Company Name]"
approach: "[Method approach]"
method: "[Technical description]"
methodCitations: "[URL(s)]"
cancerTypes: ["Type1", "Type2", ...]
cancerTypesNotes: "[Context]"
```

### Performance Fields
```
sensitivity: [number 0-100]
sensitivityCitations: "[URL or 'Vendor data (Name, Company, Date)']"
sensitivityNotes: "[Context - must add value beyond the number]"

specificity: [number 0-100]
specificityPlus: true/false  // if reported as ">99%" etc.
specificityCitations: "[URL]"
specificityNotes: "[Context]"

ppv: [number] // if available
ppvCitations: "[URL]"
npv: [number] // if available  
npvCitations: "[URL]"

lod: "[value with units]"
lod95: "[value]" // if different
lodCitations: "[URL]"
lodNotes: "[Context]"
```

### Regulatory & Commercial Fields
```
fdaStatus: "[Status]"
fdaStatusNotes: "[Details]"
reimbursement: "[Status]"
reimbursementNote: "[Details]"
clinicalAvailability: "[Description]"
availableRegions: ["US", "EU", "China", ...]
listPrice: "[Price or range]"
listPriceNotes: "[Context]"
tat: [number] // turnaround time in days
tatNotes: "[Context]"
```

### Evidence Fields
```
clinicalTrials: "[NCT numbers and descriptions]"
clinicalTrialsCitations: "[URLs]"
totalParticipants: [number]
numPublications: [number]
numPublicationsCitations: "[URLs]"
numPublicationsNotes: "[Key publications]"
validationCohortSize: [number]
validationCohortStudy: "[Study name/description]"
```

### Classification Fields
```
isRUO: true/false  // Research Use Only
isInvestigational: true/false
isClinicalLDT: true/false
regulatoryStatusNotes: "[Explanation]"
```

### Tracking Fields
```
vendorRequestedChanges: "[Date]: [Description of submission and source]"
```

---

## Phase 4: Quality Checks

### Citation Quality
- [ ] Every performance metric has a citation
- [ ] URLs are valid and accessible
- [ ] Mix of sources: publications, FDA docs, vendor data
- [ ] Vendor-only data is clearly labeled: `"Vendor data (Name, Company, Date)"`

### Note Quality
- [ ] Notes add context beyond the number (NOT "12.3% PPV per vendor")
- [ ] Notes explain methodology, limitations, or comparisons
- [ ] Notes are concise (<200 chars unless complex)

### Data Plausibility
- [ ] 100% sensitivity/specificity flagged if small cohort (<100)
- [ ] PPV/NPV plausible given prevalence and sens/spec
- [ ] Claims consistent across fields
- [ ] Stage-specific sensitivities sum logically

### Completeness
- [ ] All core fields populated
- [ ] Regulatory status clear
- [ ] At least one citation source
- [ ] Cancer types properly categorized

---

## Phase 5: Red Flags to Escalate

Flag these issues to Alex before proceeding:

| Red Flag | Action |
|----------|--------|
| No peer-reviewed publications | Note as vendor-data-only; confirm inclusion |
| 100% performance with n<50 | Add `smallSampleWarning: true` |
| Analytical validation only | Add `analyticalValidationWarning: true` |
| Contradictory claims | Ask for clarification |
| Missing critical fields | Request from vendor |
| Duplicate of existing test | Confirm if update vs new entry |
| RUO claiming clinical use | Flag regulatory concern |

---

## Phase 6: Update Checklist

After approval, complete ALL steps:

### 1. Add Test to data.js
- [ ] Find correct section: `// INSERT NEW [CATEGORY] TEST HERE`
- [ ] Add complete test object
- [ ] Verify JSON syntax (no trailing commas, proper quotes)

### 2. Update VERIFIED_CONTRIBUTORS (if new vendor submission)
```javascript
'[test-id]': {
  name: '[Submitter Name]',
  company: '[Company]',
  date: '[YYYY-MM-DD]'
},
```

### 3. Verify Test Renders
- [ ] Run `npm run dev`
- [ ] Navigate to category page
- [ ] Confirm test card appears
- [ ] Open test detail modal
- [ ] Check all fields display correctly

### 4. Run Tests
```bash
npx playwright test -g "Homepage|Category Pages" --reporter=list
```

### 5. Deploy
```bash
git add src/data.js
git commit -m "Add [Test Name] ([vendor]) to [CATEGORY]"
git push
```

---

## Example Review Output

When reviewing a submission, provide structured output:

```
## Submission Review: [Test Name]

### Eligibility: ✅ PASS / ❌ FAIL
- Commercial test: ✅
- Category: MRD
- Validation data: ✅ (Cancer Cell 2023 + vendor data)
- Not duplicate: ✅

### Category: MRD (tumor-informed)

### Extracted Data:
[Show complete test object ready for data.js]

### Quality Notes:
- Citations: 3 publications + vendor data ✅
- Notes quality: Good, adds context ✅
- Red flags: None

### Missing/Unclear:
- Need confirmation on list price
- LOD units unclear (% vs ppm)

### Ready to Add: ✅ YES / ⏸️ PENDING [reason]
```

---

## Quick Reference: Field Naming Conventions

| Data Type | Field | Notes Field | Citation Field |
|-----------|-------|-------------|----------------|
| Sensitivity | `sensitivity` | `sensitivityNotes` | `sensitivityCitations` |
| Specificity | `specificity` | `specificityNotes` | `specificityCitations` |
| PPV | `ppv` | `ppvNotes` | `ppvCitations` |
| NPV | `npv` | `npvNotes` | `npvCitations` |
| LOD | `lod` | `lodNotes` | `lodCitations` |
| TAT | `tat` | `tatNotes` | `tatCitations` |
| Price | `listPrice` | `listPriceNotes` | `listPriceCitations` |

**Pattern:** `[field]`, `[field]Notes`, `[field]Citations`
