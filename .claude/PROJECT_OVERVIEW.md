# OpenOnco Project Overview

**Non-profit database for cancer diagnostic tests** | Built in memory of Ingrid Dickinson

---

## What It Is

OpenOnco is a vendor-neutral comparison platform for liquid biopsy and tissue-based cancer diagnostics. It helps patients, clinicians, and researchers navigate the complex landscape of cancer testing options.

**Live:** https://openonco.org  
**Preview:** https://v0-42kj-git-develop-alex-dickinsons-projects-2bee58ff.vercel.app

---

## Database Scope

**139+ tests** across 5 categories:

| Category | Code | URL | What It Does |
|----------|------|-----|--------------|
| **Hereditary Cancer Testing** | HCT | `/risk` | Germline testing for inherited cancer risk (BRCA, Lynch, etc.) |
| **Early Cancer Detection** | ECD | `/screen` | Screening in asymptomatic people (Galleri, Shield, etc.) |
| **Molecular Residual Disease** | MRD | `/monitor` | Post-treatment surveillance for recurrence |
| **Treatment Response Monitoring** | TRM | `/monitor` | Tracking during active treatment |
| **Treatment Decision Support** | TDS | `/treat` | CGP panels for therapy selection (F1CDx, Guardant360) |

**Note:** MRD + TRM combined as "Cancer Monitoring" on homepage but separate data arrays internally.

---

## Three-Persona System

The platform serves three distinct user types with tailored experiences:

| Persona | Primary Needs | Chat Tone |
|---------|---------------|-----------|
| **Patient/Caregiver** | Plain language, what to ask doctor | Warm, supportive, no jargon |
| **Medical Professional** | Clinical validity, guidelines, ordering | Direct, collegial, clinical terms OK |
| **R&D/Industry** | Technical specs, methodology, regulatory | Precise, analytical validation focus |

---

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS
- **Backend:** Vercel serverless functions (Node.js)
- **AI:** Claude API (Haiku 4.5 by default)
- **Testing:** Playwright (smoke + full suite)
- **Analytics:** PostHog
- **Deployment:** Vercel (develop → preview, main → production)

---

## Key Workflows

```bash
# Development
npm run dev              # Local server (localhost:5173)
npm run test:smoke       # Quick smoke tests
npm test                 # Full Playwright suite

# Deployment
./preview               # Smoke tests → develop → preview URL
./preview "message"     # With commit message
./release               # Full tests → main → production
./release "v1.x.x"      # With version tag
```

---

## Data Quality Standards

### Vendor Verification
- Tests verified by company representatives get green badges
- Verified tests sort to top of lists
- Requires entry in BOTH test object AND `VENDOR_VERIFIED` object

### Baseline Complete (BC)
All tests must have minimum fields filled per category:
- **MRD:** sensitivity, specificity, lod, initialTat, followUpTat, fdaStatus, reimbursement
- **ECD:** sensitivity, specificity, ppv, npv, fdaStatus, listPrice
- **TDS:** genesAnalyzed, fdaStatus, tat, reimbursement
- **HCT:** fdaStatus, sampleCategory (minimal - allows targeted panels)

### Citation Requirements
Performance metrics (sensitivity, specificity, LOD, PPV, NPV) must have citations. PubMed preferred over vendor websites.

---

## External Integrations

| Integration | Purpose |
|-------------|---------|
| **OpenOnco MCP** | Direct database queries |
| **PubMed** | Citation validation |
| **CMS MCP** | Medicare coverage lookup |
| **Gmail** | Vendor submission processing |
| **Figma** | Design implementation |
| **PostHog** | User analytics |

---

## Key Documentation

| Document | Purpose |
|----------|---------|
| `SUBMISSION_PROCESS.md` | How to add/update/verify tests |
| `DEVELOPMENT_STATUS.md` | Current version and recent changes |
| `docs/CMS_MEDICARE_COVERAGE.md` | Medicare coverage system |
| `CLAUDE_CONTEXT.md` | General project context |

---

## Success Metrics

- User engagement (page views, chat interactions)
- Vendor participation (verifications, submissions)
- Data quality (citation coverage, verification rates)
- Patient wizard completion rates
