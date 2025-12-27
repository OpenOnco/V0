# OpenOnco Vendor Change Request Process

**When to use:** Activate this process whenever Alex pastes a vendor request to modify existing test data.

---

## Phase 1: Identify the Test

First, locate the existing test in data.js:

1. **Search by test name** or vendor name
2. **Confirm test ID** (e.g., `mrd-15`, `ecd-21`)
3. **Read current data** to understand what exists

```bash
# Search in data.js
grep -n "[test name or vendor]" src/data.js
```

---

## Phase 2: Classify the Change Type

| Type | Description | Review Level |
|------|-------------|--------------|
| **Correction** | Fix error in existing data | Low - verify source |
| **Update** | New data available (publication, FDA clearance) | Medium - verify citation |
| **Addition** | Add missing fields | Medium - check quality |
| **Performance Change** | Modify sensitivity/specificity/etc | High - requires citation |
| **Claim Expansion** | New cancer types, indications | High - requires evidence |
| **Removal** | Delete field or claim | Medium - confirm reason |

---

## Phase 3: Validation Requirements by Change Type

### Corrections (typos, formatting, broken links)
- [ ] Vendor identifies specific error
- [ ] Correct value is clear
- [ ] No citation needed for obvious fixes

### Updates (new publications, regulatory changes)
- [ ] New citation provided or found
- [ ] Update is factual (FDA approval, new study)
- [ ] Update `vendorRequestedChanges` field

### Performance Changes (sens/spec/PPV/NPV/LOD)
- [ ] **Must have citation** (publication or formal vendor data)
- [ ] Compare to existing values - significant change?
- [ ] If better performance, verify methodology is comparable
- [ ] If worse performance, confirm vendor wants this published
- [ ] Add/update notes explaining the change

### Claim Expansions (new cancer types, indications)
- [ ] Evidence for new claims (studies, FDA label)
- [ ] Update `cancerTypes` array
- [ ] Update `cancerTypesNotes` with context
- [ ] Consider if this changes test category

---

## Phase 4: Red Flags

Flag these to Alex before making changes:

| Red Flag | Concern |
|----------|---------|
| Performance dramatically improved | May be cherry-picked data or different methodology |
| Performance decreased | Unusual - confirm vendor intent |
| Removing citations | Why? May indicate retraction |
| Adding unsupported claims | Need evidence |
| Changing regulatory status without docs | Need FDA/CE documentation |
| Request from non-vendor | Verify authority to request changes |

---

## Phase 5: Change Documentation

**Always update `vendorRequestedChanges` field:**

```javascript
"vendorRequestedChanges": "2025-12-22: [Previous entry]. 2025-12-23: Updated sensitivity from 95% to 97.2% per vendor request (Name, Company) citing new validation study (PMID xxxxx)."
```

**Format:** `[Date]: [Description of change] per [Source] ([Citation if applicable])`

---

## Phase 6: Execute the Change

### For Simple Changes (1-2 fields):
Use targeted edit in data.js

### For Complex Changes (multiple fields):
1. Extract current test object
2. Show proposed changes as diff
3. Get approval from Alex
4. Apply changes
5. Run tests

---

## Phase 7: Verification Checklist

- [ ] Change applied correctly in data.js
- [ ] JSON syntax valid (no trailing commas)
- [ ] `vendorRequestedChanges` updated with date and description
- [ ] Related fields updated (e.g., if sensitivity changes, check sensitivityNotes)
- [ ] Notes still accurate after change
- [ ] Citations valid and accessible
- [ ] Run smoke tests
- [ ] Deploy to preview and verify

---

## Example Change Request Review

```
## Change Request Review: [Test Name]

### Test ID: ecd-15
### Vendor: [Company Name]
### Requestor: [Name, Title]

### Requested Changes:
1. Update sensitivity from 65% to 69.1%
2. Add new publication citation
3. Update validation cohort size

### Change Type: Performance Change + Update

### Validation:
- [ ] Citation provided: ✅ Annals of Oncology 2023
- [ ] Methodology comparable: ✅ Same THUNDER study, updated analysis
- [ ] Change is reasonable: ✅ 4% improvement within expected range

### Proposed Edits:
\`\`\`javascript
// Line 3045 - sensitivity
"sensitivity": 65,  →  "sensitivity": 69.1,

// Line 3046 - add citation
"sensitivityCitations": "...",  →  "sensitivityCitations": "... | https://new-url",

// Line 3047 - update notes
"sensitivityNotes": "65% overall...",  →  "sensitivityNotes": "69.1% overall (MCDBT-1 model)...",

// vendorRequestedChanges - append
+ "2025-12-23: Updated sensitivity to 69.1% per vendor (Name, Company) citing Annals Oncol 2023."
\`\`\`

### Ready to Apply: ✅ YES / ⏸️ PENDING [reason]
```

---

## Quick Reference: Common Changes

| Request | Fields to Update |
|---------|-----------------|
| New publication | `numPublications`, `numPublicationsCitations`, `numPublicationsNotes` |
| FDA clearance | `fdaStatus`, `fdaStatusNotes`, possibly `reimbursement` |
| New cancer type | `cancerTypes` array, `cancerTypesNotes` |
| Price change | `listPrice`, `listPriceNotes` |
| TAT change | `tat`, `tatNotes` |
| New clinical trial | `clinicalTrials`, `clinicalTrialsCitations`, `totalParticipants` |
| Performance update | `[metric]`, `[metric]Notes`, `[metric]Citations` |

---

## Audit Trail

All changes should be traceable via:
1. `vendorRequestedChanges` field in test object
2. Git commit message with test name and change summary
3. This conversation history (searchable via Claude memory)
