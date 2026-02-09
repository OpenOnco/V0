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
| Live evidence & coverage stats | needs-release | Verified on preview. Daemon + Vercel proxy + frontend all working. | 2026-02-09 |
| Cross-indication evidence broadening | needs-release | Verified on preview. Broadens to other indications when sparse results. | 2026-02-09 |
| Patient wizard UI polish | needs-release | Verified on preview. New headline, 3-card layout, "Help!" text. E2E tests updated. | 2026-02-09 |
| Persona switch navigation fix | needs-release | On main via develop merge. `/physician` URL route works. | 2026-02-09 |
| Citation system — PubMed tool calling | needs-release | `search_pubmed` tool, study-name detection, PMID display in tooltips/sources. Deployed to Railway + Vercel preview, verified working. | 2026-02-09 |
| Coverage check standalone | needs-release | On main via develop merge. Standalone collapsible section with test + insurer lookup. | 2026-02-08 |
| Physician digest system | needs-testing | Migration 010 applied. Still needs E2E test: subscribe, confirm, trigger draft, receive email. | 2026-02-06 |
| NIH RePORTER crawler | needs-testing | Code shipped to prod. First real run will be Sunday 11 PM cron. Verify grant store creation and digest integration. | 2026-02-06 |
| MRD Navigator | shipped | Wired to physician clinical decision support system. | 2026-02-06 |
| Physician page redesign | shipped | Traditional Tailwind layout, coverage check, preview banner. | 2026-02-06 |
| MRD Compendium | coding | Component drafted but not integrated. | 2026-02-06 |

## Completed (Archive)

<!-- Move features here once shipped and stable for >2 weeks -->

| Feature | Shipped | Notes |
|---------|---------|-------|
| Physician system eval | 2026-02-04 | Baseline 7.0 -> 8.3/10 after data seeding |
| Payer ID registry | 2026-02-05 | Canonical IDs with alias normalization |
| Hash store fixes | 2026-02-05 | Deterministic assertion IDs, dedupe |
