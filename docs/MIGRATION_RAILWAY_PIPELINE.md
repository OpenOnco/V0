# Pipeline Architecture — current state (2026-05-10)

## Scope

The weekly scan operates in **data.js maintenance mode only**:

- **In scope**: CMS Medicare coverage (LCDs/NCDs), vendor news, FDA status, PubMed citation counts, new-test discovery (flagged, not auto-added)
- **Out of scope**: private payer policies (Aetna/UHC/Cigna/BCBS/Carelon/Humana/Kaiser/Anthem), NCCN guidelines, evidence pipeline (extract-claims/verify-claims/render-faq), physicianFAQ regeneration

The evidence pipeline scripts and artifacts (`evidence/scripts/`, `evidence/raw/`, `evidence/claims/`, `evidence/meta/`, `src/config/physicianFAQ.js`) remain on disk as a frozen snapshot. They are not updated by automation and the `/evidence` UI continues to serve the existing FAQ.

## Where things run

| System | Trigger | Repo | Output |
|---|---|---|---|
| **Weekly OpenOnco Scan** | Claude remote trigger, Saturdays 09:00 UTC | scans V0 | Pushes data field updates directly to `main`; new-test candidates to `data/new-test-candidates.json` |
| **Weekly Scan Watchdog** | Claude remote trigger, Saturdays 11:00 UTC | scans V0 | Emails if no scan commit/issue in 8 days |
| **test-data-tracker daemon** | Railway, on its own cadence | separate repo | Writes `weekly-*.json` submissions for `/triage` |
| **auto-triage workflow** | GitHub Action, on push to `develop` with submission JSON changes | V0 | Applies Claude-guided edits, opens PR |

## Truncation guard

`evidence/scripts/verify-pipeline-state.js` runs as a post-condition gate before every scan commit. It refuses commits where any `src/data/tests/*.json`:
- Fails to parse as a JSON array
- Shrank by >25% in bytes or array length vs HEAD

Driven by the 2026-05-09 incident — see `docs/INCIDENT_ECD_JSON_TRUNCATION.md`.

## Deferred (was previously planned, no longer current focus)

- Moving the scan or evidence pipeline to Railway
- Replacing the filesystem handoff between test-data-tracker and V0 with a manifest
- Removing the hardcoded sibling path in `scripts/auto-triage/index.js`
- Consolidating scan + auto-triage into one orchestrator
- Restarting weekly evidence extraction / FAQ regeneration

These are real architectural debts but not load-bearing for the current data.js maintenance focus. Revisit when scope expands again.
