# Incident: ecd.json truncation — 2026-05-09

## Summary

The 2026-05-09 weekly scan committed `fa0be75c` ("Shield tube count 4→2, MCED Act notes") which **truncated `src/data/tests/ecd.json` from 3,803 lines to 3 lines** (34 ECD entries → partial 1 entry with no closing `]`, invalid JSON). The truncation was caught post-push and reverted in `75c0cc0` via the `fix/restore-ecd-json` branch.

## Root cause

The scan's auto-triage applier (`scripts/auto-triage/applier.js`) operates on `src/data.js` only — it performs line-level string mutations against the JS file. The actual test data, however, lives in `src/data/tests/{mrd,ecd,trm,cgp,hct}.json`, which `src/data.js` imports.

When the scan needed to edit a Shield (ECD) entry, the applier's `update_field` operation couldn't find the field because the field is in `ecd.json`, not `data.js`. The scan agent appears to have fallen back to writing `ecd.json` directly via the Edit/Write tool, and the output it generated was truncated mid-array: the file ended with `},` and no closing `]`.

Contributing factors:
- No size-shrink guard before commit
- No JSON parse validation of `src/data/tests/*.json` before commit
- The applier and the scan prompt disagree about where test data lives
- Smoke tests passed because the scan's `git checkout .` on failure path was never triggered — the commit succeeded as far as git was concerned, just with garbage content

## Fix

`evidence/scripts/verify-pipeline-state.js` now includes a `checkDataTestsIntegrity` check that:

1. Parses each `src/data/tests/*.json` as a JSON array — fails on invalid JSON
2. Compares byte size against the same file at `HEAD` — fails if shrunk >25%
3. Compares array length against `HEAD` — fails if shrunk >25%

The check is wired into `.github/workflows/auto-triage.yml` as a post-condition gate (existing wiring). Run manually with `node evidence/scripts/verify-pipeline-state.js`.

Regression tests in `tests/unit/evidence/verify-pipeline-state.test.js`:
- Reproduce the 34→1 entry truncation and assert the guard fires
- Reproduce the trailing-comma invalid JSON and assert the parse check fires
- Confirm growth (34→38 entries) is allowed
- Confirm new files with no baseline pass

## Outstanding

The applier vs. JSON file mismatch is still real. Two long-term fixes (not done):

1. Extend the applier to operate on `src/data/tests/*.json` files directly, so the scan never uses raw file Write on them
2. Update the scan prompt to require the applier path (and refuse direct Write to those JSONs)

For now, the truncation guard is the safety net.
