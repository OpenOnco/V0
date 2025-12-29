# OpenOnco Submission Processing Guide

**Single source of truth for all OpenOnco data submissions.**

When Alex pastes any submission (new test, change request, vendor verification, correction), follow this process.

---

## Phase 1: Triage - What Type of Submission?

| Type | Trigger Phrases | Go To |
|------|-----------------|-------|
| **New Test** | "new test", "add this test", vendor proposal, test data dump | → Section A |
| **Change Request** | "update", "correction", "change", "fix", vendor email with edits | → Section B |
| **Vendor Verification** | "vendor verified", "confirm data", company rep validating existing entry | → Section C |
| **Deletion** | "remove", "discontinue", "no longer available" | → Section D |

---

## Phase 2: Locate Context

Before processing ANY submission:

1. **Read current data.js** to understand existing tests
2. **Search for the test** if it might already exist:
   ```bash
   grep -n "[test name or vendor]" src/data.js
   ```
3. **Check for duplicates** - same test, different name? Regional variant?

---

# Section A: New Test Submission

## A1: Eligibility Gate

**ALL criteria must pass:**

| Criterion | Required | Check |
|-----------|----------|-------|
| Real test | ✅ | Commercially available OR active clinical trials (not pure research) |
| Category fit | ✅ | Fits MRD, ECD, TRM, or TDS |
| Validation data | ✅ | Has citable performance data (publications, FDA docs, or formal vendor data) |
| Not duplicate | ✅ | Distinct from existing tests (not rebrand/regional variant) |
| Liquid biopsy | ✅ | Blood, plasma, urine, or other liquid sample (no tissue-only) |

**If any criterion fails:** Stop and explain to Alex. Suggest alternatives if applicable.

## A2: Category Classification

| Category | Use Case | Key Metrics |
|----------|----------|-------------|
| **MRD** | Post-treatment monitoring, detecting recurrence | sensitivity, specificity, LOD, lead time |
| **ECD** | Screening asymptomatic individuals | sensitivity by stage, specificity, PPV, NPV |
| **TRM** | Tracking treatment response during therapy | genes covered, actionable findings rate |
| **TDS** | Treatment decision support, therapy selection | FDA status, guideline inclusion |

## A3: Extract Required Fields

### Core Fields (ALL tests)
```javascript
id: "[category]-[number]",  // e.g., "mrd-26" - check existing IDs first
sampleCategory: "Blood/Plasma" | "Urine" | "Other",
name: "[Official Test Name]",
vendor: "[Company Name]",
approach: "[Method approach - tumor-informed, tumor-naive, etc.]",
method: "[Technical description]",
methodCitations: "[URL(s)]",
cancerTypes: ["Type1", "Type2"],
cancerTypesNotes: "[Context]",
```

### Performance Fields
```javascript
sensitivity: [number 0-100],
sensitivityCitations: "[URL or 'Vendor data (Name, Company, Date)']",
sensitivityNotes: "[Context - must add value beyond the number]",

specificity: [number 0-100],
specificityPlus: true/false,  // if reported as ">99%" etc.
specificityCitations: "[URL]",
specificityNotes: "[Context]",

ppv: [number],  // if available
ppvCitations: "[URL]",
npv: [number],  // if available
npvCitations: "[URL]",

lod: "[value with units]",
lod95: "[value]",  // if different from lod
lodCitations: "[URL]",
lodNotes: "[Context]",
```

### Regulatory & Commercial Fields
```javascript
fdaStatus: "[Status]",
fdaStatusNotes: "[Details]",
reimbursement: "[Status]",
reimbursementNote: "[Details]",
clinicalAvailability: "[Description]",
availableRegions: ["US", "EU", "China"],
listPrice: "[Price or range]",
listPriceNotes: "[Context]",
tat: [number],  // turnaround time in days
tatNotes: "[Context]",
```

### Evidence Fields
```javascript
clinicalTrials: "[NCT numbers and descriptions]",
clinicalTrialsCitations: "[URLs]",
totalParticipants: [number],
numPublications: [number],
numPublicationsCitations: "[URLs]",
numPublicationsNotes: "[Key publications]",
validationCohortSize: [number],
validationCohortStudy: "[Study name/description]",
```

### Classification & Tracking Fields
```javascript
isRUO: true/false,
isInvestigational: true/false,
isClinicalLDT: true/false,
regulatoryStatusNotes: "[Explanation]",
vendorVerified: false,  // Set true only after vendor confirmation
vendorRequestedChanges: "[Date]: [Description of submission and source]",
```

## A4: Quality Checks

- [ ] Every performance metric has a citation
- [ ] Notes add context (NOT just "X% per vendor")
- [ ] 100% sens/spec flagged if cohort <100
- [ ] PPV/NPV plausible given prevalence
- [ ] All core fields populated
- [ ] At least one citation source

---

# Section B: Change Request

## B1: Identify Existing Test

1. Search data.js for test name/vendor
2. Confirm test ID (e.g., `mrd-15`)
3. Read current values for fields being changed

## B2: Classify Change Type

| Type | Examples | Review Level |
|------|----------|--------------|
| **Correction** | Typo fix, broken link, formatting | Low |
| **Update** | New publication, FDA clearance, price change | Medium |
| **Performance Change** | Sensitivity, specificity, PPV, NPV, LOD | **High - requires citation** |
| **Claim Expansion** | New cancer types, new indications | **High - requires evidence** |

## B3: Validation by Type

### Corrections
- [ ] Error is clearly identified
- [ ] Correct value is obvious
- [ ] No citation needed for typos

### Updates
- [ ] New citation provided or found
- [ ] Update is factual and verifiable

### Performance Changes ⚠️
- [ ] **Citation required** (publication or formal vendor data)
- [ ] Compare to existing - is change reasonable?
- [ ] If performance improved significantly, verify methodology is comparable
- [ ] Update related notes field

### Claim Expansions ⚠️
- [ ] Evidence provided (studies, FDA label expansion)
- [ ] Update `cancerTypes` array AND `cancerTypesNotes`

## B4: Document the Change

**Always append to `vendorRequestedChanges`:**
```javascript
"vendorRequestedChanges": "[existing]. 2025-01-15: Updated sensitivity from 95% to 97.2% per vendor (Name, Company) citing PMID xxxxx."
```

---

# Section C: Vendor Verification

When a vendor representative confirms their test data is accurate.

## C1: Verify Authority

- [ ] Submitter is from the vendor company
- [ ] Has authority to confirm data (name, title, email in submission)

## C2: Process Verification

1. **Review all fields** with vendor
2. **Flag any discrepancies** they identify
3. **Process any corrections** as Change Requests (Section B)
4. **Update verification status:**

```javascript
vendorVerified: true,
vendorRequestedChanges: "[existing]. 2025-01-15: Vendor verified by [Name], [Title], [Company]."
```

## C3: Update VERIFIED_CONTRIBUTORS

If this is first verification for this test:

```javascript
// In data.js VERIFIED_CONTRIBUTORS section
'[test-id]': {
  name: '[Submitter Name]',
  company: '[Company]',
  date: '[YYYY-MM-DD]'
},
```

---

# Section D: Deletion Request

When a test should be removed (discontinued, never launched, etc.)

## D1: Confirm Removal Reason

| Valid Reasons | Action |
|---------------|--------|
| Test discontinued by vendor | Remove |
| Never commercially launched | Remove |
| Duplicate entry | Merge data into primary, remove duplicate |
| Regulatory issues (recalled) | Remove with note |

| Invalid Reasons | Action |
|-----------------|--------|
| Vendor doesn't like their data | Decline - offer corrections instead |
| Competitor request | Decline |

## D2: Process Deletion

1. **Document reason** in commit message
2. **Remove test object** from data.js
3. **Remove from VERIFIED_CONTRIBUTORS** if present
4. **Run tests** to ensure no broken references

---

# Red Flags - Escalate to Alex

| Red Flag | Concern |
|----------|---------|
| Performance dramatically improved (>10%) | Cherry-picked data? Different methodology? |
| No peer-reviewed publications | Note as vendor-data-only |
| 100% performance with n<50 | Add warning flag |
| Contradictory claims | Ask for clarification |
| Request from non-vendor | Verify authority |
| Removing citations | Why? May indicate retraction |
| RUO test claiming clinical use | Regulatory concern |

---

# Final Checklist (All Submission Types)

## Before Applying Changes
- [ ] Submission type identified
- [ ] Existing data reviewed
- [ ] Quality checks passed
- [ ] Red flags addressed
- [ ] Alex approved (if flagged)

## Apply Changes
- [ ] Edit data.js with correct syntax
- [ ] Update `vendorRequestedChanges` with date and description
- [ ] Update VERIFIED_CONTRIBUTORS if applicable

## Verify & Deploy
- [ ] JSON syntax valid (no trailing commas)
- [ ] Run: `npm run dev` - test renders correctly
- [ ] Run: `npx playwright test -g "Homepage|Category Pages" --reporter=list`
- [ ] Commit: `git commit -m "[Type]: [Test Name] - [Brief description]"`
- [ ] Push: `git push`

---

# Output Templates

## New Test Review
```
## New Test Review: [Test Name]

### Eligibility: ✅ PASS / ❌ FAIL
- Commercial: ✅
- Category: [MRD/ECD/TRM/TDS]
- Validation data: ✅ [sources]
- Not duplicate: ✅
- Liquid biopsy: ✅

### Extracted Data:
[Complete test object ready for data.js]

### Quality Notes:
- Citations: [count] sources ✅
- Notes quality: [assessment]
- Red flags: [none / list]

### Missing/Unclear:
- [List items needing clarification]

### Ready to Add: ✅ YES / ⏸️ PENDING [reason]
```

## Change Request Review
```
## Change Request: [Test Name]

### Test ID: [id]
### Requestor: [Name, Company]
### Change Type: [Correction/Update/Performance/Expansion]

### Requested Changes:
1. [Field]: [old value] → [new value]
2. ...

### Validation:
- [ ] Citation: [status]
- [ ] Reasonable change: [assessment]

### Proposed Edits:
[Show specific line changes]

### Ready to Apply: ✅ YES / ⏸️ PENDING [reason]
```

## Vendor Verification
```
## Vendor Verification: [Test Name]

### Test ID: [id]
### Verified by: [Name], [Title], [Company]
### Date: [YYYY-MM-DD]

### Data Reviewed: ✅ All fields confirmed accurate
### Corrections Needed: [none / list]
### Verification Status: ✅ COMPLETE

### Updates Applied:
- vendorVerified: true
- vendorRequestedChanges: [appended]
- VERIFIED_CONTRIBUTORS: [added/updated]
```

---

# Field Reference

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
