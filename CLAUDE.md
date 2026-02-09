# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Quick Start

```bash
# First time or after reboot
npm run dev              # Start dev server at localhost:5173

# Before making changes
npm run test:smoke       # Quick validation

# Deploy workflow
./preview                # Smoke tests → develop branch → preview URL
./release                # Full tests → main branch → production
```

## Session Continuity

**Start of session:** Read `docs/SESSION_STATE.md` for context from previous work.

**Slash commands available:**
- `/recall` - Read SESSION_STATE.md and summarize context
- `/store` - Write current state to SESSION_STATE.md
- `/proposals` - Review pending proposals from test-data-tracker crawls

## Project Overview

OpenOnco is a non-profit database of cancer diagnostic tests (liquid biopsy, molecular diagnostics, hereditary testing). 

**Live site:** https://openonco.org  
**Preview:** https://v0-42kj-git-develop-alex-dickinsons-projects-2bee58ff.vercel.app

## Key Documentation

| File | Purpose |
|------|---------|
| `docs/CLAUDE_CONTEXT.md` | Detailed project context, tech stack, conventions |
| `docs/SESSION_STATE.md` | Current work state, handoff between sessions |
| `docs/SUBMISSION_PROCESS.md` | How to process new test submissions |
| `docs/TESTING.md` | Test suite documentation |
| `docs/DATABASE_CHANGELOG.md` | History of data changes |

## Architecture

```
/
├── src/                    # React frontend (Vite + Tailwind)
│   ├── App.jsx             # Main router (~1,700 lines)
│   ├── data.js             # TEST DATABASE (~8,500 lines)
│   ├── config/             # Field definitions, vendor config, categories
│   ├── components/         # React components
│   └── utils/              # Utility functions
│
├── api/                    # Vercel serverless functions
│   ├── chat.js             # Claude chatbot (SYSTEM PROMPTS HERE)
│   ├── v1/                 # Public REST API
│   └── _data.js            # Shared API data
│
├── physician-system/       # MRD clinical decision support (Railway)
│   ├── src/crawlers/       # Evidence + guideline crawlers
│   ├── src/chat/           # MRD chat API server
│   └── src/triage/         # AI triage + classification
│
├── test-data-tracker/      # Coverage & vendor monitoring (Railway)
│   ├── src/crawlers/       # CMS, payer, vendor, NIH crawlers
│   ├── src/digest/         # Physician digest (subscribers, curate, send)
│   ├── src/email/          # Email templates (digest, confirmation, crawl)
│   └── src/triage/         # AI-powered change detection
│
├── tests/                  # Playwright E2E tests
├── eval/                   # Chatbot evaluation (Python)
└── docs/                   # Documentation
```

## Test Categories

| Category | Code | URL | Data Array |
|----------|------|-----|------------|
| Hereditary Cancer Testing | HCT | `/risk` | `hctTestData` |
| Early Cancer Detection | ECD | `/screen` | `ecdTestData` |
| Molecular Residual Disease | MRD | `/monitor` | `mrdTestData` |
| Treatment Response Monitoring | TRM | `/monitor` | `trmTestData` |
| Treatment Decision Support | TDS | `/treat` | `tdsTestData` |

## Key Files

| File | What's There |
|------|--------------|
| `src/data.js` | All test data, `VENDOR_VERIFIED`, `DATABASE_CHANGELOG` |
| `api/chat.js` | Chatbot system prompts (`getPersonaStyle()`, `buildSystemPrompt()`) |
| `src/config/testFields.js` | Field definitions, minimum required params |
| `src/config/vendors.js` | Vendor tiers, badge config |

## Commands

```bash
# Development
npm run dev              # Vite dev server (port 5173)
npm run build            # Production build

# Testing
npm run test:smoke       # Quick Playwright tests
npm run test:full        # Full test suite
npm run test:unit        # Vitest unit tests
npm run test:api         # API endpoint tests

# Deployment
./preview                # develop branch → preview
./preview "message"      # With commit message
./release                # main branch → production
./release "v1.2.0"       # With version tag

# Test Data Tracker (from /test-data-tracker directory)
npm run dev              # Run with auto-reload
npm test                 # Unit tests
node src/index.js digest:preview   # Generate digest draft
node src/index.js digest:send [id] # Send approved digest

# Physician System (from /physician-system directory)
npm start                # Start MRD chat server
node src/cli.js all      # Run all crawlers
```

## Conventions

### Styling
- **Tailwind only** - no custom CSS files
- **Slate colors** for UI base (not gray)
- **Category colors:** emerald (MRD/TRM), blue (ECD), rose (HCT), violet (TDS)
- **Persona colors:** rose (Patient), cyan (Medical), violet (R&D)

### Code
- Functional components with hooks
- System prompts in `api/chat.js`, NOT `src/chatPrompts/`
- Keep components in existing files unless asked to split
- Vendor verification requires BOTH: `vendorVerified: true` on test AND entry in `VENDOR_VERIFIED`

### Chat responses
- 3-4 sentences max
- No bullet points unless requested
- Match persona tone (patient=empathetic, medical=clinical, R&D=technical)

## Finding Things

```bash
# Find a test by name
grep -n '"name": "Signatera"' src/data.js

# Find vendor verification entries
grep -n "VENDOR_VERIFIED" src/data.js

# Find changelog entries
grep -n "DATABASE_CHANGELOG" src/data.js

# Find system prompts
grep -n "buildSystemPrompt\|getPersonaStyle" api/chat.js
```

## API

**Public API:** `https://openonco.org/api/v1`

| Endpoint | Description |
|----------|-------------|
| `GET /tests` | List tests (filter: category, vendor, cancer, fda) |
| `GET /tests/:id` | Single test |
| `GET /categories` | List categories |
| `GET /vendors` | List vendors |
| `GET /stats` | Database stats |

**Chat API:** `POST /api/chat` (rate limited 20/min per IP)

**Digest API:** (Vercel proxies to Railway daemon)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mrd-digest/subscribe` | POST | Subscribe to physician digest |
| `/api/mrd-digest/confirm` | GET | Confirm subscription (from email) |
| `/api/mrd-digest/unsubscribe` | GET | One-click unsubscribe |
| `/api/mrd-digest/preferences` | GET/POST | Read/update subscriber preferences |

## Common Tasks

### Add a new test
1. Read `docs/SUBMISSION_PROCESS.md`
2. Add to appropriate array in `src/data.js`
3. Run `npm run test:smoke`
4. `./preview` to deploy

### Update system prompts
1. Edit `api/chat.js` - find `buildSystemPrompt()` or `getPersonaStyle()`
2. Test with all three personas
3. Run eval suite: `cd eval && python run_eval.py`

### Vendor verification
1. Set `vendorVerified: true` on test object in `src/data.js`
2. Add entry to `VENDOR_VERIFIED` object with date and contact
3. Add entry to `DATABASE_CHANGELOG`

### Review proposals (`/proposals`)

The test-data-tracker crawls vendor/payer sites and creates proposal JSON files in `test-data-tracker/data/proposals/`.

**Proposal types:**
- `coverage/` - Payer coverage updates for existing tests
- `updates/` - Field updates for existing tests (clinical data, regulatory status)
- `new-tests/` - Entirely new tests to add

**Workflow:**
1. Read all pending proposals from `test-data-tracker/data/proposals/*/`
2. Present each proposal to user with relevant context
3. **STOP and wait for the user to approve or reject EACH proposal. Do NOT auto-approve. Do NOT batch-process. The human decides.**
4. Apply ONLY user-approved changes directly to `src/data.js`
5. Run `npm run test:smoke` to validate
6. If tests pass, commit and push to main
7. Mark applied proposals with `status: "applied"` and `appliedAt` timestamp

**NEVER auto-review proposals.** Claude must not set `reviewedBy: "claude"`. Every proposal requires explicit human approval or rejection. If there are too many to review in one session, stop and tell the user how many remain.

**IMPORTANT:** Proposals marked "applied" must have ACTUAL changes in `src/data.js` before marking. The `markApplied` function only updates the proposal JSON - it does NOT modify data.js.

**Coverage proposal format:**
```json
{
  "id": "cov-2026-...",
  "type": "coverage",
  "status": "pending",
  "testName": "Signatera",
  "testId": "mrd-7",
  "payer": "Blue Shield of California",
  "payerId": "blueshieldca",
  "coverageStatus": "conditional",
  "conditions": "Stage III/IV solid tumors seeking treatment",
  "source": "https://...",
  "confidence": 0.85
}
```

**Applying coverage - data.js uses TWO structures:**

1. **Simple coverage** - Add payer to `commercialPayers` array with notes:
```js
commercialPayers: ["BCBS Louisiana", "Blue Shield of California"],
commercialPayersCitations: "https://source1 | https://source2",
commercialPayersNotes: "BCBS LA: first payer (2023). BSCA: conditional for stage III/IV (2026).",
// For explicit non-coverage:
commercialPayersNonCoverage: ["UnitedHealthcare"],
commercialPayersNonCoverageNotes: "UHC policy lists as unproven."
```

2. **Detailed coverage** - Add to `coverageCrossReference.privatePayers`:
```js
coverageCrossReference: {
  privatePayers: {
    aetna: {
      status: "PARTIAL",  // COVERED | PARTIAL | EXPERIMENTAL | NOT_COVERED
      policy: "CPB 0715",
      policyUrl: "https://...",
      coveredIndications: ["CRC Stage II-III"],
      notes: "Covered for CRC only; other tumors experimental",
      lastReviewed: "2026-02-01"
    }
  }
}
```

**Matching proposals to tests:** Proposals use `testName` which may not match exactly. Search data.js by vendor + test name. Common mappings:
- "Guardant Reveal" → `mrd-6`
- "Signatera" → `mrd-7`
- "FoundationOne Liquid CDx" → `tds-2`
- "Guardant360 CDx" → `tds-1`
- "Resolution ctDx FIRST" → `tds-23`

### Policy URL Research

When asked to research payer policy URLs, use parallel agents to search for and verify URLs in `test-data-tracker/src/data/policy-registry.js`.

**Registry location:** `test-data-tracker/src/data/policy-registry.js`

**What to do:**
1. Spawn parallel agents to search for policy URLs at target payers
2. Verify existing URLs still work
3. Find new/updated policies for existing payers
4. Add new payers with their ctDNA/liquid biopsy policies

**Search queries to use:**
- `"[Payer Name]" liquid biopsy ctDNA medical policy 2025 2026`
- `"[Payer Name]" circulating tumor DNA coverage policy PDF`

**URL Verification with Browser:**
WebFetch often fails on policy URLs due to:
- Bot protection (Aetna, some BCBS sites)
- PDF binary content
- JavaScript-required pages

**Use Playwright browser for verification:**
```
1. mcp__playwright__browser_navigate to the URL
2. mcp__playwright__browser_evaluate to check:
   () => ({ url: window.location.href, type: document.contentType })
3. If contentType is "application/pdf" or "text/html" → URL is working
4. For HTML pages, use browser_snapshot to verify content loaded
```

**Policy entry format:**
```javascript
payerId: {
  name: 'Full Payer Name',
  tier: 1|2,  // 1=national, 2=regional
  policies: [{
    id: 'unique-policy-id',
    name: 'Policy Title',
    url: 'https://direct-link.pdf',
    contentType: 'pdf'|'html',
    policyType: 'liquid_biopsy'|'ctdna'|'molecular_oncology',
    discoveryMethod: 'google_search',
    notes: 'Brief description',
    lastVerified: 'YYYY-MM-DD',
  }],
},
```

**Target payers without URLs:**
- BCBS Colorado, Ohio, Indiana (use Anthem policies)
- CareFirst BCBS (portal auth required)
- Independence Blue Cross (uses eviCore)
- VA (no traditional policies - clinical guidelines only)
