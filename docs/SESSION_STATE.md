# OpenOnco Session State

> Last updated: 2026-02-06 12:00 PST
> Updated by: Claude Opus 4.6

## Current State

### Physician System — Deployed, Benchmarked, Decision Trees Live

The physician-system MRD chat is deployed on Railway with the full decision support pipeline wired end-to-end. Baseline eval: **7.0/10 average, 64% pass rate**.

**Architecture:**
```
User query → Haiku intent extraction → findMatchingScenario() (decision tree match)
           → ada-002 embedding → hybrid search (pgvector + keyword)
           → Few-shot examples injected → Sonnet response generation
           → OPTION A/B/C structured output
```

### What Was Done This Session

**1. Railway Deploy + No-Sources Fix**
- Deployed physician-system to Railway (not auto-deploying — requires `railway up` from physician-system/ dir)
- Fixed bug: when query matches decision tree but DB returns 0 sources (e.g. NSCLC), system now generates response from decision tree context instead of returning "no guidance found"
- Verified health endpoint: 269 guidance items, 263 embeddings

**2. Backfill Complete**
- Ran `backfill-decision-context.js` — **89/89 items updated**, 0 failures
- All guidance items now have `decision_context` populated

**3. Live Test — Binary Fork Validated**

| Query | Scenario Matched | Format | Sources |
|-------|-----------------|--------|---------|
| CRC stage III, Signatera negative, safe to stop? | `CRC_III_post_resection_MRD_negative` | OPTION A/B/C | 10 |
| TNBC MRD positive after mastectomy | `breast_I_III_post_resection_MRD_positive` | OPTION A/B/C | 10 |
| Stage IIB NSCLC, MRD positive post-lobectomy | `NSCLC_I_III_post_resection_MRD_positive` | OPTION A/B/C | 0 (decision tree) |
| MRD positive, no cancer type (edge case) | None (correct — can't route) | OPTION A/B/C | 10 |

**4. Eval Suite — Baseline Benchmark**

| Category | Avg Score | Pass Rate | Notes |
|----------|-----------|-----------|-------|
| Adversarial | **9.7/10** | 3/3 | Safety guardrails excellent |
| Test interpretation | **8.6/10** | 4/5 | Handles assay comparison well |
| Clinical scenarios | **8.0/10** | 9/10 | Decision format works for CRC/breast |
| Trial evidence | **7.2/10** | 2/5 | DYNAMIC/CIRCULATE detail gaps |
| Guidelines | **6.6/10** | 3/5 | NSCLC guidelines missing from DB |
| Coverage | **1.8/10** | 0/5 | Zero payer data in DB |

**12 failing questions — root causes are all data gaps, not prompt/format issues:**
- Coverage (Q26-30): DB has 0 payer/coverage content → need to run coverage-bridge.js
- NSCLC (Q8, Q19): 0 NSCLC items in embeddings → need NSCLC guideline ingestion
- Trial depth (Q21, Q22, Q24): DB has trial entries but insufficient design/endpoint detail
- Head/neck (Q8): HPV oropharyngeal ctDNA not in DB at all

### Commits Pushed to Main

1. `e2e7078` — data: apply crawler proposals (3 test updates, 2 new tests, 36 coverage entries)
2. `cb5a8ba` — fix(policy-registry): update 6 broken payer policy URLs
3. `1eda1db` — feat(physician-system): Phase 0 + Phase 2 (audit, decision trees, trial watcher, coverage bridge)
4. `b557f48` — feat(physician-system): Phase 1 (prompt rewrite, few-shot examples, eval set, backfill script)
5. `7cb6bf4` — feat(physician-system): wire decision trees, few-shot examples, MRD-negative scenarios
6. `1fd55ff` — fix(physician-system): fall through to decision tree when no DB sources match
7. `9eed801` — feat(physician-system): add eval runner for 33-question physician benchmark
8. `8158287` — data(physician-system): baseline eval results — 7.0/10 avg, 64% pass

### Railway Services

| Service | Health Endpoint | Status | Deploy Method |
|---------|----------------|--------|---------------|
| physician-system | https://physician-system-production.up.railway.app/health | OK | `cd physician-system && railway up -d` |
| test-data-tracker | https://daemon-production-5ed1.up.railway.app/health | OK | auto-deploy from main |

**Note:** physician-system does NOT auto-deploy from GitHub. Must manually deploy with `railway up -d` from the `physician-system/` directory.

### Cron Schedules
- CMS/Vendor: Sunday 11PM PT
- Payers: Sunday 11:30PM PT
- Digest email: Monday 1AM PT

## Known Issues

- **Anthem** blocks all headless browsers (HTTP2 protocol error)
- **Highmark securecms** has incomplete SSL certificate chain
- **BCBS Idaho** provider portal broken — DNS/CDN misconfiguration
- **trm-1** (Invitae Personalis MRD) discontinued — crawler still generates proposals
- **Coverage data gap** — physician-system DB has 0 payer coverage items; coverage-bridge.js exists but hasn't been run
- **NSCLC/H&N content gap** — 0 items in embeddings for NSCLC guidelines or head/neck ctDNA

## Next Steps (Priority Order)

1. **Fill data gaps to improve eval score:**
   - Run `coverage-bridge.js` to sync payer data (would fix Q26-30, +5 passes)
   - Ingest NSCLC NCCN guidelines (would fix Q19, Q20)
   - Add DYNAMIC/CIRCULATE trial detail entries (would fix Q21, Q22, Q24)
   - After data fills, re-run eval to measure improvement
2. **Phase 3: Frontend physician UX** — Hold for oncologist review of chat quality
3. Consider adding crawler logic to skip proposals for discontinued tests (trm-1)
4. Address Highmark TLS cert chain issue in payer crawler

## Files Modified This Session

- `physician-system/src/chat/server.js` — no-sources decision tree fallback fix
- `physician-system/eval/run-eval.js` — NEW: eval runner (sends 33 questions, Haiku scoring)
- `physician-system/eval/eval-results.json` — baseline eval results
- All files from previous session (decision trees, few-shot, prompt rewrite, etc.)

## Project Location

`/Users/adickinson/Documents/GitHub/V0`

---
*Start new chats with: "Continue from docs/SESSION_STATE.md"*
