# Feature Tracker

> Tracks features through their lifecycle. Updated by Claude Code during development.
> Read by `/state` to generate accurate reports.

## Lifecycle Stages

| Stage | Meaning |
|-------|---------|
| `coding` | Active development, not yet complete |
| `needs-testing` | Code complete, needs manual/E2E verification |
| `needs-preview` | Tested locally, needs preview deploy for stakeholder review |
| `needs-release` | Previewed and approved, waiting for production release |
| `shipped` | On production, verified working |

## Active Features

<!-- Format: | Feature | Stage | Notes | Since | -->

| Feature | Stage | Notes | Since |
|---------|-------|-------|-------|
| Physician scope gate | shipped | Out-of-scope queries (non-medical, non-oncology, patient-facing, coverage, test selection) get explicit redirects instead of generic fallback. 10 boundary red-team tests added. | 2026-02-12 |
| Physician eval C9 | shipped | Template prose, citation validator tuning, context-aware questions. 90% pass, 8.6 avg. | 2026-02-11 |
| Physician portal 1-2-3 redesign | shipped | Step-based landing page (Explore → Coverage → Evidence). | 2026-02-11 |
| Unified weekly triage — Railway deploy | shipped | Deployed 2026-02-12. Aggregation cron active (Mon 12:30 AM PT). 9 scheduled jobs confirmed. | 2026-02-12 |
| Physician digest system | needs-testing | Migration 010 applied. Still needs E2E test: subscribe, confirm, trigger draft, receive email. | 2026-02-06 |
| NIH RePORTER crawler | needs-testing | Code shipped to prod. First real run will be Sunday 11 PM cron. Verify grant store creation and digest integration. | 2026-02-06 |

## Completed (Archive)

<!-- Move features here once shipped and stable for >2 weeks -->

| Feature | Shipped | Notes |
|---------|---------|-------|
| Unified weekly triage system | 2026-02-10 | /triage skill, submissions pipeline, weekly summary email, homepage layout rebalance |
| Citation system — PubMed tool calling | 2026-02-09 | search_pubmed tool, study-name detection, PMID in tooltips/sources |
| Live evidence & coverage stats | 2026-02-09 | Daemon + Vercel proxy + frontend stats |
| Cross-indication evidence broadening | 2026-02-09 | Broadens to other indications when sparse results |
| Patient wizard UI polish | 2026-02-09 | New headline, 3-card layout, "Help!" text |
| Persona switch navigation fix | 2026-02-09 | /physician URL route works |
| Coverage check standalone | 2026-02-09 | Standalone collapsible section with test + insurer lookup |
| MRD Navigator | 2026-02-06 | Clinical decision support for MRD testing |
| Physician page redesign | 2026-02-06 | Traditional Tailwind layout, coverage check, preview banner |
| Physician system eval | 2026-02-04 | Baseline 7.0 -> 8.3/10 after data seeding |
| Payer ID registry | 2026-02-05 | Canonical IDs with alias normalization |
| Hash store fixes | 2026-02-05 | Deterministic assertion IDs, dedupe |
