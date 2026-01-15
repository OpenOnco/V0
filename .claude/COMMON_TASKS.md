# Common OpenOnco Tasks

Quick reference for frequent operations.

---

## 1. Adding a New Test

**Full process:** See `SUBMISSION_PROCESS.md`

**Quick steps:**
1. Get next ID from Quick Reference table in data.js header
2. Copy template from data.js header comments
3. Fill in all required fields for category
4. Add to appropriate array (mrdTestData, etc.)
5. Update Quick Reference table (LAST ID → NEXT ID)
6. Add DATABASE_CHANGELOG entry
7. Update "Last updated" comment
8. Run `npm run build && npm run test:smoke`

**Finding insertion point:**
```bash
# For MRD
grep -n "// INSERT NEW MRD TEST HERE" src/data.js

# For ECD
grep -n "// INSERT NEW ECD TEST HERE" src/data.js
```

---

## 2. Processing Vendor Verification

**BOTH locations required for green badge!**

### Location 1: Test object
```javascript
vendorVerified: true,
vendorRequestedChanges: "... [YYYY-MM-DD]: Vendor verified by [Name], [Company]."
```

### Location 2: VENDOR_VERIFIED object (~line 463)
```javascript
'mrd-7': {  // Signatera
  name: 'John Smith',
  company: 'Natera',
  verifiedDate: '2026-01-14',
  editsSubmitted: 3
},
```

---

## 3. Checking Medicare Coverage

**When to verify:** If `lastVerified` >90 days old when editing a test

**Using CMS MCP:**
```javascript
// Search for LCD
CMS MCP:search_local_coverage({
  keyword: "molecular residual disease",
  document_type: "lcd"
})

// Search for NCD
CMS MCP:search_national_coverage({
  keyword: "next generation sequencing",
  document_type: "ncd"
})

// Check recent changes
CMS MCP:get_whats_new_report({
  scope: "national",
  timeframe: 30
})
```

**Key policies:**
- L38779 - MRD tests
- NCD 90.2 - CGP/NGS (FDA companion dx)
- NCD 210.3 - CRC screening
- L38043 - Liquid CGP

---

## 4. Updating Chat System Prompts

**Location:** `/api/chat.js`

**Key functions:**
- `getPersonaStyle()` - Persona-specific instructions
- `buildSystemPrompt()` - Full prompt construction

**NOT in:** `/src/chatPrompts/` (UI-only config)

---

## 5. Sending Vendor Emails

**Use mail client via terminal:**
```bash
open "mailto:contact@vendor.com?subject=OpenOnco%20Database%20Listing&body=Hi%20[Name],%0A%0A..."
```

**Email templates:** See `vendor-invite-drafts.md`

---

## 6. Running Tests

```bash
# Quick smoke tests (before preview)
npm run test:smoke

# Full suite (before release)
npm test

# Specific test file
npx playwright test tests/wizard.spec.js

# With browser visible
npx playwright test --headed
```

---

## 7. Deployment

```bash
# Preview (develop branch)
./preview                    # Default commit message
./preview "feat: add new test"

# Production (main branch)
./release                    # Default
./release "v1.5.1"           # With version
```

**What they do:**
- `./preview`: smoke tests → commit → push develop → outputs preview URL
- `./release`: full tests → commit → push main → deploys to openonco.org

---

## 8. Database Queries (OpenOnco MCP)

```javascript
// Search MRD tests
OpenOnco MCP:openonco_search_mrd({
  vendor: "Natera",
  min_sensitivity: 90
})

// Get specific test
OpenOnco MCP:openonco_get_mrd({ id: "mrd-7" })

// Compare tests
OpenOnco MCP:openonco_compare_mrd({
  names: "Signatera,Guardant Reveal,RaDaR"
})

// Count by category
OpenOnco MCP:openonco_count_mrd({ group_by: "vendor" })

// List all vendors
OpenOnco MCP:openonco_list_vendors({ category: "mrd" })
```

---

## 9. Validating Citations (PubMed)

```javascript
// Search for papers
PubMed:search_articles({
  query: "Signatera colorectal cancer MRD"
})

// Get article details
PubMed:get_article_metadata({
  pmids: ["35486828", "34577062"]
})

// Find related articles
PubMed:find_related_articles({
  pmids: ["35486828"],
  link_type: "pubmed_pubmed"
})
```

---

## 10. Finding Things in data.js

```bash
# Find a specific test
grep -n '"name": "Signatera"' src/data.js

# Find by ID
grep -n '"id": "mrd-7"' src/data.js

# Find all Natera tests
grep -n '"vendor": "Natera"' src/data.js

# Find VENDOR_VERIFIED section
grep -n "export const VENDOR_VERIFIED" src/data.js

# Find changelog
grep -n "export const DATABASE_CHANGELOG" src/data.js

# Count tests in category
grep -c '"id": "mrd-' src/data.js
```

---

## 11. Quick Fixes

### Build fails
```bash
npm run build
# Check error output, usually TypeScript or import issues
```

### Tests fail
```bash
npm run test:smoke
# Check which test, often snapshot or selector changes
```

### Preview URL not updating
```bash
# Force push
git push origin develop --force-with-lease
```

### Local dev not reflecting changes
```bash
# Clear vite cache
rm -rf node_modules/.vite
npm run dev
```
