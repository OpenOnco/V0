# OpenOnco Quick Reference

Combined reference for common operations.

---

## Test Categories

| Code | URL | Array in data.js | Next ID |
|------|-----|------------------|---------|
| HCT | /risk | hctTestData | hct-34 |
| ECD | /screen | ecdTestData | ecd-24 |
| MRD | /monitor | mrdTestData | mrd-27 |
| TRM | /monitor | trmTestData | trm-15 |
| TDS | /treat | tdsTestData | tds-28 |

---

## data.js Key Locations

| Section | Line | Search For |
|---------|------|------------|
| Quick Reference | ~25 | Top of file |
| VENDOR_VERIFIED | ~463 | `export const VENDOR_VERIFIED` |
| MRD Tests | ~750 | `export const mrdTestData` |
| ECD Tests | ~2020 | `export const ecdTestData` |
| TRM Tests | ~3140 | `export const trmTestData` |
| TDS Tests | ~3490 | `export const tdsTestData` |
| HCT Tests | ~6670 | `export const hctTestData` |
| DATABASE_CHANGELOG | ~7070 | `export const DATABASE_CHANGELOG` |

---

## Mandatory Checklist (ALL submissions)

- [ ] `vendorRequestedChanges` field updated on test object
- [ ] `DATABASE_CHANGELOG` entry added (top of array)
- [ ] `Last updated` comment at top of data.js updated
- [ ] Build passes: `npm run build`
- [ ] Smoke tests pass: `npm run test:smoke`

**Additional for NEW tests:**
- [ ] Next ID used (check Quick Reference in data.js)
- [ ] Quick Reference table updated with new NEXT ID

**Additional for VENDOR VERIFICATION:**
- [ ] `vendorVerified: true` on test object
- [ ] Entry added to `VENDOR_VERIFIED` object (~line 463)

---

## Vendor Verification (TWO locations required!)

### Location 1: Test Object
```javascript
vendorVerified: true,
vendorRequestedChanges: "[existing]. [YYYY-MM-DD]: Vendor verified by [Name], [Company]."
```

### Location 2: VENDOR_VERIFIED Object (~line 463)
```javascript
'[test-id]': {
  name: '[Submitter Name]',
  company: '[Company]',
  verifiedDate: '[YYYY-MM-DD]',
  editsSubmitted: [number]
},
```

⚠️ **Missing Location 2 = no green badge!**

---

## DATABASE_CHANGELOG Entry Format

```javascript
{
  date: 'Jan 14, 2026',
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

## Common Commands

```bash
# Find a test
grep -n '"name": "Signatera"' src/data.js
grep -n '"id": "mrd-7"' src/data.js

# Build & test
npm run build
npm run test:smoke
npm test

# Deploy
./preview               # develop branch → preview URL
./preview "message"     # with commit message
./release              # main branch → production
./release "v1.x.x"     # with version tag
```

---

## MCP Tool Quick Reference

### OpenOnco MCP
```javascript
openonco_search_mrd({ vendor: "Natera", min_sensitivity: 90 })
openonco_get_mrd({ id: "mrd-7" })
openonco_compare_mrd({ names: "Signatera,Guardant Reveal" })
openonco_list_vendors({ category: "mrd" })
```

### PubMed
```javascript
PubMed:search_articles({ query: "Signatera MRD colorectal" })
PubMed:get_article_metadata({ pmids: ["35486828"] })
```

### CMS MCP
```javascript
CMS MCP:search_local_coverage({ keyword: "MRD", document_type: "lcd" })
CMS MCP:search_national_coverage({ keyword: "NGS", document_type: "ncd" })
```

Key policies: L38779 (MRD), NCD 90.2 (CGP), NCD 210.3 (CRC screening)

---

## Troubleshooting

### Build Fails
```bash
npm run build
# Check error output - usually syntax or import issues in data.js
```

### Tests Fail
```bash
npm run test:smoke
# Check which test - often snapshot or selector changes
npx playwright test --headed  # Run with visible browser to debug
```

### Preview URL Not Updating
```bash
# Force push to develop
git push origin develop --force-with-lease
```

### Local Dev Not Reflecting Changes
```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Vercel Build Cache Issues
```bash
# Trigger fresh build via Vercel dashboard or:
git commit --allow-empty -m "chore: trigger rebuild"
git push
```

---

## Medicare Coverage Status Values

| Status | Meaning |
|--------|---------|
| COVERED | Medicare reimbursement available |
| NOT_COVERED | Not eligible |
| PENDING_COVERAGE | LCD/NCD decision expected |
| PENDING_FDA | Awaiting FDA approval first |
| UNKNOWN | Not determined |

---

## Red Flags → Ask Alex

- Performance change >10% without citation
- 100% performance with small sample (<200)
- No peer-reviewed publications
- Request from non-vendor email
- RUO test claiming clinical use
