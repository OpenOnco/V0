# OpenOnco Session State

> Last updated: 2026-02-17 PST
> Updated by: Claude Opus 4.6

## Current State

### What Was Done This Session

**Auto-Triage Workflow — Fully Rolled Out**

Implemented automated weekly triage via GitHub Actions + Claude Opus API. The daemon pushes weekly submissions to GitHub, a GitHub Action auto-triages with Claude, creates a PR with applied changes, and emails escalations.

**Architecture:**
```
Sunday 11 PM:  Crawlers run on Railway
Monday 12:30 AM:  Aggregation → weekly-*.json → push to GitHub via API
Monday ~12:35 AM:  GitHub Action triggers → Claude triages → PR created
Monday morning:  Alex reviews PR, handles escalations, merges
```

**Files created (8):**
- `scripts/auto-triage/index.js` — Orchestrator (reads weekly file, pre-filters, batches Claude calls, applies changes, writes PR body)
- `scripts/auto-triage/claude-client.js` — Claude API wrapper (agentic loop with web_search built-in + custom tools, retry on 429s)
- `scripts/auto-triage/system-prompt.js` — Decision rules (APPROVE/IGNORE/ESCALATE), change operation schemas
- `scripts/auto-triage/tools.js` — Tool definitions: `web_search` (built-in), `read_data_js`, `record_decision`
- `scripts/auto-triage/applier.js` — Deterministic data.js modifier (add_commercial_payer, add_non_coverage, update_field, add_coverage_cross_ref, add_changelog)
- `scripts/auto-triage/notify.js` — Escalation email via Resend API
- `.github/workflows/auto-triage.yml` — GitHub Action (push trigger + workflow_dispatch)
- `test-data-tracker/src/submissions/github-push.js` — Pushes weekly file to GitHub via Contents API

**Files modified (1):**
- `test-data-tracker/src/scheduler.js` — Added `pushFileToGitHub()` call after weekly aggregation (v6)

**Secrets configured:**
- GitHub Actions: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`
- Railway (daemon service): `GITHUB_TOKEN` (gh OAuth token with repo scope)

**Dry run validated:** Ran against 5 test items — all 5 correctly categorized as IGNORE (matching manual `/triage` decisions). ~30s for 5 items, estimates ~$5-6/week for full 60-item runs.

**Commits:**
- `a3ab50b` feat: add auto-triage workflow for weekly submissions
- `bba275a` chore: remove test weekly file
- `71624fd` merged to main, released to production
- Railway daemon redeployed with new scheduler code

### What's Live Now

The full pipeline is live end-to-end:
1. Daemon crawls Sunday night → aggregates Monday 12:30 AM
2. `pushFileToGitHub()` pushes `weekly-*.json` to develop
3. GitHub Action triggers, Claude Opus triages all items
4. PR created with changes + escalation email sent
5. Human reviews PR Monday morning

### Manual Trigger

Can also trigger via GitHub Actions UI:
- Go to Actions → "Auto-Triage Weekly Submissions" → Run workflow
- Select develop branch, choose dry_run true/false
- Optionally specify a weekly file path

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
| **Weekly Aggregation + GitHub Push** | **Monday 12:30 AM** | **test-data-tracker** |
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
- **gh OAuth token on Railway** — `GITHUB_TOKEN` on the daemon is a `gho_` OAuth token from `gh auth`. If you re-auth gh CLI, the token may change. Replace on Railway if pushes start failing.

## Next Steps (Priority Order)

1. **Monitor first automated triage** — Next Sunday night the full pipeline runs. Check GitHub Actions Monday morning for the PR.
2. **Phase 4 consideration** — After a few weeks of clean runs, consider auto-merge for PRs with 0 escalations + passing smoke tests.
3. **Run migration 010** on Railway Postgres for digest subscriber/history columns
4. **Fill data gaps to improve eval score** (coverage-bridge.js, NSCLC guidelines, trial details)

## Project Location

`/Users/adickinson/Documents/GitHub/V0`

---
*Start new chats with: "Continue from docs/SESSION_STATE.md"*
