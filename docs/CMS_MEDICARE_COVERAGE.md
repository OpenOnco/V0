# CMS Medicare Coverage System

**Comprehensive documentation for OpenOnco's Medicare coverage data pipeline.**

---

## Overview

OpenOnco maintains structured Medicare coverage data for 62+ cancer diagnostic tests. This system includes:

1. **Data Collection** - Web scraping vendor billing pages + CMS API queries
2. **Data Structure** - Standardized `medicareCoverage` objects in `data.js`
3. **UI Display** - `MedicareCoverageDisplay` component for detail views
4. **Maintenance** - Quarterly refresh + on-demand verification

---

## Quick Reference

### Coverage Status Values

| Status | Meaning | UI Color |
|--------|---------|----------|
| `COVERED` | Medicare reimbursement available | Green |
| `NOT_COVERED` | Not eligible for Medicare reimbursement | Red |
| `PENDING_COVERAGE` | LCD/NCD decision expected | Amber |
| `PENDING_FDA` | Awaiting FDA approval (prerequisite for coverage) | Amber |
| `EXPECTED_COVERAGE` | Strong indication coverage will be granted | Blue |
| `NOT_YET_AVAILABLE` | Test not yet commercially available | Gray |
| `UNKNOWN` | Coverage status not determined | Gray |

### Key Coverage Policies

| Policy ID | Name | Category |
|-----------|------|----------|
| **L38779** | MolDX: Molecular Residual Disease Testing | MRD |
| **NCD 90.2** | Next Generation Sequencing (NGS) | CGP/TDS |
| **NCD 210.3** | Colorectal Cancer Screening Tests | ECD |
| **L38043** | MolDX: Plasma-Based Genomic Profiling | CGP (liquid) |
| **L38121** | MolDX: NGS for Solid Tumors | CGP (tissue) |

---

## Data Schema

### medicareCoverage Object

Every test in `data.js` can have a `medicareCoverage` field:

```javascript
{
  medicareCoverage: {
    status: "COVERED",                    // Required: coverage status
    policyType: "LCD",                    // "LCD" | "NCD" | "CLFS" | null
    policyNumber: "L38779",               // Policy identifier
    policyName: "MolDX: MRD Testing...",  // Full policy name
    coveredIndications: [                 // Array of covered uses
      "Stage II-IV CRC post-curative intent therapy",
      "Breast cancer MRD surveillance",
      "NSCLC Stage I-IV"
    ],
    reimbursementRate: "$3,500",          // Medicare payment amount
    cptCode: "0361U",                     // CPT/PLA billing code
    notes: "Additional context",          // Free-text notes
    lastVerified: "2026-01-13"            // ISO date of verification
  }
}
```

### Backward Compatibility

Tests without structured `medicareCoverage` fall back to legacy fields:
- `reimbursement` - String description (e.g., "Medicare covered under LCD L38779")
- `reimbursementNote` - Additional context

The UI component handles both formats automatically.

---

## File Locations

```
/src
├── data.js                              # Test database with medicareCoverage objects
└── components/coverage/
    └── MedicareCoverageDisplay.jsx      # UI component

/scripts/cms-coverage-scraper/
├── COVERAGE_MAP_SUMMARY.md              # Research summary (41 tests)
├── COVERAGE_SCOPE.md                    # Research scope & status
├── vendor-coverage-map.json             # Master coverage database
├── cms-coverage-export.json             # Export for data.js merge
├── scrape-vendor-coverage-v2.js         # Web scraper (vendor billing pages)
├── merge-cms-to-datajs.js               # Transform to medicareCoverage format
└── patch-datajs.js                      # Apply coverage to data.js
```

---

## Data Collection Methods

### Method 1: Vendor Website Scraping

**Script:** `scripts/cms-coverage-scraper/scrape-vendor-coverage-v2.js`

Scrapes vendor billing/coverage pages to extract:
- LCD/NCD policy numbers
- CPT/PLA codes
- Reimbursement amounts
- Covered indications

```bash
# Run the scraper
cd /Users/adickinson/Documents/GitHub/V0
node scripts/cms-coverage-scraper/scrape-vendor-coverage-v2.js

# Output: scripts/cms-coverage-scraper/vendor-coverage-v2.json
```

**Vendor URLs Scraped:**
- Billing pages (e.g., natera.com/oncology/billing/)
- Coverage pages (e.g., guardanthealth.com/providers/patient-coverage/)
- Press releases for reimbursement announcements

### Method 2: CMS MCP Tools (Claude Desktop)

Use the CMS MCP connector for real-time policy lookups:

```javascript
// Search for NCDs
CMS MCP:search_national_coverage({
  keyword: "molecular residual disease",
  document_type: "ncd"
})

// Search for LCDs
CMS MCP:search_local_coverage({
  keyword: "MolDX MRD",
  document_type: "lcd"
})

// Get specific NCD details
CMS MCP:get_coverage_document({
  document_type: "ncd",
  document_id: 90.2
})

// Check what's new in Medicare coverage
CMS MCP:get_whats_new_report({
  scope: "national",
  timeframe: 30,
  document_type: ["NCD", "NCA"]
})
```

### Method 3: Manual Research

For tests without automated coverage:
1. Check vendor billing page
2. Search CMS.gov LCD/NCD database
3. Review MolDX website (palmettogba.com/moldx)
4. Check press releases and SEC filings

---

## UI Component

### MedicareCoverageDisplay

**Location:** `/src/components/coverage/MedicareCoverageDisplay.jsx`

#### Usage in TestDetailModal

```jsx
import MedicareCoverageDisplay from '../coverage/MedicareCoverageDisplay';

<MedicareCoverageDisplay 
  medicareCoverage={test.medicareCoverage}
  fallbackReimbursement={test.reimbursement}
  fallbackNote={test.reimbursementNote}
  showDetails={true}  // Expand all covered indications
/>
```

#### Usage in TestCard (Compact Badge)

```jsx
import { MedicareCoverageBadge } from '../coverage/MedicareCoverageDisplay';

<MedicareCoverageBadge 
  medicareCoverage={test.medicareCoverage}
  reimbursement={test.reimbursement}  // Fallback
/>
```

### Display Features

**Full View (TestDetailModal):**
- Coverage status badge with icon
- LCD/NCD policy number and name
- Covered indications list (expandable)
- Reimbursement rate
- CPT/PLA code
- Notes and verification date

**Compact View (TestCard):**
- "Medicare" badge (green) for COVERED
- "Not Covered" badge (red) for NOT_COVERED
- "Pending" badge (amber) for PENDING_*
- Falls back to legacy string parsing

---

## Maintenance Workflow

### How to Run a Coverage Update

**Trigger:** Ask Claude "check CMS coverage" or "run coverage audit"

**What Claude Does:**

1. **Query CMS MCP** for recent LCD/NCD changes:
   ```
   get_whats_new_report (national + local, last 30-90 days)
   ```

2. **Search key policies** for updates:
   - L38779/L38822/L38835 (MRD)
   - NCD 90.2 (CGP/NGS)
   - NCD 210.3 (CRC Screening)

3. **Compare** against `medicareCoverage` objects in data.js

4. **Report findings:**
   - Tests with stale `lastVerified` (>90 days)
   - Policy changes affecting our tests
   - New indications, CPT codes, or coverage expansions

5. **Update data.js** (with your approval)

6. **Run tests, commit, push** via standard workflow

### On-Demand Verification (Recommended)

When processing a vendor submission or touching a test:

1. Check if `lastVerified` is >90 days old
2. If so, verify current coverage status via CMS MCP
3. Update the medicareCoverage object if changed
4. Update `lastVerified` to current date

### Adding Coverage to New Tests

When adding a new test to data.js:

1. **Identify coverage pathway:**
   - Is it FDA-approved? → Check NCD 90.2 eligibility
   - Is it MRD? → Check L38779 coverage
   - Is it CRC screening? → Check NCD 210.3

2. **Research specific coverage:**
   - Check vendor billing page
   - Search CMS LCD/NCD databases via MCP
   - Note CPT/PLA code if published

3. **Add medicareCoverage object** with all known fields

4. **Set appropriate status:**
   - `COVERED` - Only if actively reimbursed
   - `PENDING_COVERAGE` - If LCD/NCD decision pending
   - `PENDING_FDA` - If waiting on FDA before coverage possible
   - `NOT_COVERED` - If explicitly excluded or no pathway exists

---

## Coverage Categories

### MRD Tests (L38779)

**Policy:** MolDX: Molecular Residual Disease Testing for Cancer

**General Criteria:**
- Stage II-IV solid tumors (cancer-type specific)
- Post-curative intent therapy
- Minimum tumor fraction detected at baseline
- Serial monitoring for recurrence

**Covered Tests:** Signatera, clonoSEQ, RaDaR, NeXT Personal Dx, Reveal, Haystack MRD, Invitae PCM, Oncodetect, NavDx, Pathlight MRD

### CGP/TDS Tests (NCD 90.2)

**Policy:** Next Generation Sequencing (NGS)

**Section B:** FDA-approved companion diagnostics - nationally covered
**Section D:** Laboratory developed tests - MAC discretion

**Covered Tests:** FoundationOne CDx, Guardant360 CDx, Tempus xT CDx, MSK-IMPACT, MI Cancer Seek, Resolution ctDx FIRST

### Early Detection Tests (NCD 210.3)

**Policy:** Colorectal Cancer Screening Tests

**Section B.3 Criteria:**
- FDA market authorization required
- Sensitivity ≥74%
- Specificity ≥90%
- Age 45-85, average risk

**Covered Tests:** Shield (CRC)

**Not Yet Covered:** Galleri (MCED), FirstLook Lung, EPISEEK - no current Medicare pathway for MCED tests

### Liquid CGP Tests (L38043)

**Policy:** MolDX: Plasma-Based Genomic Profiling

**Covered Tests:** Northstar Select, MSK-ACCESS, StrataNGS, Caris Assure, Tempus xF, LiquidHALLMARK, GTC Liquid Trace

---

## Troubleshooting

### Missing Coverage Data

If a test doesn't have medicareCoverage:
1. Check vendor-coverage-map.json - is it documented?
2. Search CMS MCP for the test name
3. Check vendor billing page directly
4. Add as UNKNOWN if no information found

### Conflicting Information

If vendor claims differ from CMS database:
1. CMS database is authoritative
2. Vendor claims may be aspirational or outdated
3. Note discrepancy in `notes` field
4. Verify with LCD/NCD document text

### RUO / Investigational Tests

Tests marked as RUO or investigational cannot bill Medicare:
- Set status to `NOT_COVERED`
- Note "RUO - not billable" in notes
- May change when test receives FDA clearance

---

## API Access

### CMS MCP Tool Reference

Available tools for coverage research:

| Tool | Purpose |
|------|---------|
| `search_national_coverage` | Search NCDs by keyword |
| `search_local_coverage` | Search LCDs by keyword |
| `get_coverage_document` | Get full NCD/LCD text |
| `batch_get_ncds` | Get multiple NCDs at once |
| `get_whats_new_report` | Recent coverage changes |
| `get_contractors` | List MACs (for LCD jurisdiction) |
| `sad_exclusion_list` | Self-administered drug exclusions |

### Example Queries

```javascript
// Find MRD coverage policies
CMS MCP:search_local_coverage({
  keyword: "residual disease",
  document_type: "lcd",
  limit: 10
})

// Get L38779 (MRD LCD) details
CMS MCP:search_local_coverage({
  keyword: "L38779",
  document_type: "lcd"
})

// Check for new NCDs in last 60 days
CMS MCP:get_whats_new_report({
  scope: "national",
  timeframe: 60,
  document_type: ["NCD"]
})
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-13 | Added MedicareCoverageDisplay component |
| 2026-01-13 | Integrated structured data into TestDetailModal and TestCard |
| 2026-01-12 | Completed coverage research for 62 tests |
| 2026-01-12 | Created vendor-coverage-map.json database |
| 2026-01-11 | Initial scraper development |

---

## References

- [CMS Coverage Center](https://www.cms.gov/medicare-coverage-database)
- [MolDX Program (Palmetto GBA)](https://www.palmettogba.com/moldx)
- [Medicare Clinical Lab Fee Schedule](https://www.cms.gov/Medicare/Medicare-Fee-for-Service-Payment/ClinicalLabFeeSched)
- [LCD L38779 - MRD Testing](https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=38779)
- [NCD 90.2 - NGS](https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?ncdid=372)
