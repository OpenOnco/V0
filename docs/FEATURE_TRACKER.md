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
| Live evidence & coverage stats | needs-preview | Daemon `/api/evidence-stats` deployed to Railway. Vercel proxy + coverage-stats endpoint created. Frontend updated to use APIs. | 2026-02-09 |
| Cross-indication evidence broadening | needs-preview | When sparse results for a cancer type, broadens search to other indications. Deployed to Railway. Needs preview verification with breast cancer queries. | 2026-02-09 |
| Patient wizard UI polish | needs-preview | New headline, reverted to 3-card layout, AI helper bubble changed to "Help!" text. | 2026-02-09 |
| Persona switch navigation fix | needs-preview | Switching persona from patient sub-pages now navigates to home. `/physician` URL route added. | 2026-02-09 |
| Physician digest system | needs-testing | Migration 010 applied. Still needs E2E test: subscribe, confirm, trigger draft, receive email. | 2026-02-06 |
| NIH RePORTER crawler | needs-testing | Code shipped to prod. First real run will be Sunday 11 PM cron. Verify grant store creation and digest integration. | 2026-02-06 |
| MRD Navigator | shipped | Wired to physician clinical decision support system. | 2026-02-06 |
| Physician page redesign | shipped | Traditional Tailwind layout, coverage check, preview banner. | 2026-02-06 |
| Citation system | coding | Plan doc exists at `docs/plans/CITATION_SYSTEM_PLAN.md`. No code yet. | 2026-02-06 |
| Coverage check standalone | needs-release | On develop, not yet on main. Standalone collapsible section with test + insurer lookup. | 2026-02-08 |
| MRD Compendium | coding | Component drafted but not integrated. | 2026-02-06 |

## Completed (Archive)

<!-- Move features here once shipped and stable for >2 weeks -->

| Feature | Shipped | Notes |
|---------|---------|-------|
| Physician system eval | 2026-02-04 | Baseline 7.0 -> 8.3/10 after data seeding |
| Payer ID registry | 2026-02-05 | Canonical IDs with alias normalization |
| Hash store fixes | 2026-02-05 | Deterministic assertion IDs, dedupe |
