# OpenOnco Submission Process

**Last updated:** 2026-01-06

---

## 🚨 MANDATORY COMPLETION CHECKLIST

**STOP! Before committing ANY submission, verify ALL items for your submission type:**

### For ALL Submissions:
- [ ] `vendorRequestedChanges` field updated on test object
- [ ] `DATABASE_CHANGELOG` entry added (top of array, ~line 6090)
- [ ] `Last updated` comment at top of data.js updated
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
| Category fit | MRD, ECD, TRM, or TDS |
| Validation data | Citable performance (publications, FDA, vendor) |
| Not duplicate | Distinct from existing tests |
| Liquid biopsy | Blood, plasma, urine (no tissue-only) |

**Any fail → Stop and explain to Alex**

## A2: Get Next ID

Check Quick Reference table at top of data.js:
```
// │ MRD Tests            │ ~480        │ mrd-25     │ mrd-26        │
```

## A3: Required Fields

```javascript
// Core
id: "[category]-[number]",
sampleCategory: "Blood/Plasma" | "Tissue" | "Stool" | "Urine",
name: "[Official Test Name]",
vendor: "[Company Name]",
approach: "[tumor-informed, tumor-naive, etc.]",
method: "[Technical description]",
cancerTypes: ["Type1", "Type2"],

// Sample Collection
sampleVolumeMl: [number],
sampleTubeType: "[Streck cfDNA BCT, etc.]",
sampleTubeCount: [number],
sampleCollectionNotes: "[Details]",
sampleCitations: "[URL - REQUIRED]",

// Performance (with citations and notes for each)
sensitivity: [0-100],
sensitivityCitations: "[URL]",
sensitivityNotes: "[Context]",
specificity: [0-100],
// ... same pattern for ppv, npv, lod

// Regulatory
fdaStatus: "[Status]",
reimbursement: "[Status]",
tat: [number],

// Evidence
numPublications: [number],
numPublicationsCitations: "[URLs]",

// Tracking
vendorVerified: false,
vendorRequestedChanges: "[YYYY-MM-DD]: Added via [source]"
```

## A4: After Adding

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
| Performance | Sensitivity, specificity, LOD | **High - citation required** |
| Expansion | New cancer types | **High - evidence required** |

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
| DATABASE_CHANGELOG | ~6090 | `export const DATABASE_CHANGELOG` |

---

# DATABASE_CHANGELOG Entry Format

```javascript
{
  date: 'Jan 6, 2026',
  type: 'added' | 'updated' | 'verified' | 'removed',
  testId: '[test-id]',
  testName: '[Test Name]',
  vendor: '[Company]',
  category: 'MRD' | 'ECD' | 'TRM' | 'TDS',
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
