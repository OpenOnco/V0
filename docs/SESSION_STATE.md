# OpenOnco Session State

> Last updated: 2026-02-08 PST
> Updated by: Claude Opus 4.6

## Current State

### What Was Done This Session

**1. Coverage Check — Moved to Standalone Collapsible**
- Removed Coverage Check button from chat input box (was cramped alongside Case Details)
- Deleted `CoveragePopover` component, `showCoverage` state, `pendingCoverageRef`, `covRef`, and related useEffects
- Added new standalone collapsible section ("Check Patient Coverage") between chat card and CategoryRow
- Two side-by-side autocomplete fields: test name (from `mrdTests`) + insurance provider
- Single-test coverage result card with status badge, indications, notes, policy link
- New state: `covExpanded`, `covTestQuery`, `selectedTest`; replaced `coverageResults` (all tests) with `coverageResult` (single test lookup)
- Case Details button still works in chat input
- Committed: `7f0f384 feat: move coverage check to standalone collapsible section below chat`
- Pushed to develop, deployed to preview

**2. Publication Index Crawl Email Clarification**
- Changed "Check status:" label to "No action needed — to inspect details locally, run:" in both HTML and plain text email templates
- File: `publication-index/src/email.js`
- Committed: `60ebc1a fix: clarify crawl email snippet is informational, no action needed`
- Pushed to develop

**3. Renamed `/status` Custom Command**
- `/status` conflicted with built-in Claude Code command
- Tried `/todo` (autocompletes to `/todos`), `/state` (autocompletes to `/status`)
- Final name: `/whatswhat` — file at `.claude/commands/whatswhat.md`
- Updated reference in `docs/FEATURE_TRACKER.md`
- **Not committed yet** — also uncommitted: CLAUDE.md, docs/ updates, public/sitemap.xml from prior sessions

### Uncommitted Changes

Files modified but not committed:
- `.claude/commands/whatswhat.md` (renamed from status.md)
- `docs/FEATURE_TRACKER.md` (updated `/status` → `/whatswhat` reference)
- `CLAUDE.md` (doc updates from prior sessions)
- `docs/CLAUDE_CONTEXT.md` (doc updates from prior sessions)
- `docs/SERVICE_ARCHITECTURE.md` (doc updates from prior sessions)
- `public/sitemap.xml` (regenerated)

Untracked files:
- `docs/FEATURE_TRACKER.md`
- `docs/plans/CITATION_SYSTEM_PLAN.md`
- `physician-system/CITATION_UPGRADE_PLAN.md`
- `plan.md`
- `src/components/physician/MRDCompendium.jsx`
- `src/components/physician/MRDNavigator-wireframe.jsx`

### Design Decision: Coverage Check Doesn't Filter by Case Details

The coverage section shows raw policy data (indications, notes, status) without auto-matching against the patient's cancer/stage/phase. This is intentional — coverage policies have nuanced language that doesn't map cleanly to dropdown values, and a false signal could be worse than no signal. Physicians interpret the indications themselves.

## Prior State (from previous sessions)

### Physician Digest System — Live on Production
Weekly MRD/ctDNA email digest for physicians. Hybrid review: AI draft Monday 5 AM, admin reviews, auto-sends Monday 10 AM.

### NIH RePORTER Crawler — Live on Production
Weekly crawler for MRD/ctDNA research grants, surfaces in physician digest.

### Railway Services

| Service | Health Endpoint | Status | Deploy Method |
|---------|----------------|--------|---------------|
| physician-system | https://physician-system-production.up.railway.app/health | OK | `cd physician-system && railway up -d` |
| test-data-tracker | https://daemon-production-5ed1.up.railway.app/health | OK | auto-deploy from main |

### Cron Schedules

| Job | Schedule | Service |
|-----|----------|---------|
| Publication Index | Sunday 9 PM | test-data-tracker |
| NIH RePORTER | Sunday 11 PM | test-data-tracker |
| CMS/Vendor | Sunday 11 PM | test-data-tracker |
| Payers | Sunday 11:30 PM | test-data-tracker |
| Discovery | Sunday 10 PM | test-data-tracker |
| Physician Digest Draft | Monday 5 AM | test-data-tracker |
| Physician Digest Auto-Send | Monday 10 AM | test-data-tracker |
| Internal Digest | Monday 1 AM | test-data-tracker |
| Queue Cleanup | Daily midnight | test-data-tracker |

## Known Issues

- **Anthem** blocks all headless browsers (HTTP2 protocol error)
- **Highmark securecms** has incomplete SSL certificate chain
- **BCBS Idaho** provider portal broken — DNS/CDN misconfiguration
- **trm-1** (Invitae Personalis MRD) discontinued — crawler still generates proposals
- **Coverage data gap** — physician-system DB has 0 payer coverage items; coverage-bridge.js exists but hasn't been run
- **NSCLC/H&N content gap** — 0 items in embeddings for NSCLC guidelines or head/neck ctDNA
- **Digest DB migration** — migration 010 needs to be run on Railway Postgres
- **Custom commands not loading** — Claude Code launched from parent dir (`/Users/adickinson/Documents/GitHub`) doesn't pick up `.claude/commands/` in `V0/`. Must launch from `V0/` directly.

## Next Steps (Priority Order)

1. **Run migration 010** on Railway Postgres for digest subscriber/history columns
2. **Fill data gaps to improve eval score** (coverage-bridge.js, NSCLC guidelines, trial details)
3. **Test digest end-to-end** — subscribe, confirm, trigger draft, verify email
4. **Commit remaining doc updates** — CLAUDE.md, FEATURE_TRACKER.md, whatswhat rename

## Project Location

`/Users/adickinson/Documents/GitHub/V0`

---
*Start new chats with: "Continue from docs/SESSION_STATE.md"*
