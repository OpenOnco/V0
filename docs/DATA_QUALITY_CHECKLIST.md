# OpenOnco Data-Quality Checklist

Hard-won practices from the 2026-06 database audit (HCT + ECD/CGP/MRD), an
independent external cross-check, and the weekly triage process. Apply these
whenever editing `src/data/tests/*.json` or running `/weekly` / `/triage`.

The whole point of OpenOnco is being **trustworthy and independently sourced**.
A wrong citation or fabricated number does more damage than a missing field.

## The cardinal rule: never fabricate a source or a number

- **Never insert a PMID, DOI, URL, or performance number you have not personally
  verified** resolves AND supports the specific claim it's attached to.
- Removing a proven-wrong or nonexistent citation is correct. Inventing a
  "correct" replacement you haven't verified is a violation.
- If you can't source a value: leave it blank / null and flag for human review.
  Blank beats fabricated.

## Verify citations against primary sources

- **PMIDs:** fetch the actual title (NCBI eutils). A "cancer screening" test
  citing a sleep-apnea / dialysis / membrane-chemistry paper is the signature
  failure — it happens a lot. Confirm topical match, not just that it resolves.
- **DOIs:** check existence via `https://doi.org/<doi>` — **404 = does not
  exist**, **403 = exists but access-blocked (valid)**. NEJM/ASCO DOIs often 403;
  don't mistake that for invalid. Crossref 404s are unreliable for NEJM/ASCO —
  use doi.org as the tiebreaker. Watch for placeholder DOIs (`...XXX`).
- **Run the full-corpus sweep, not just flagged records.** `python3
  scripts/citation-sweep.py` extracts and checks every PMID/DOI in the database.
  An audit that only re-checks already-flagged records misses the wrong-paper
  citations hiding in records nobody looked at.
- When inserting a verified replacement, re-check it yourself (PubMed/Crossref/
  doi.org) before committing — agents propose plausible-but-wrong ones.

## Verify findings before applying — in both directions

- An audit finding (internal or external) can be **wrong**. Verify it against the
  primary source before applying. Examples that were *refuted* on check: ecd-19
  IUrisure (the cited paper *did* contain the numbers), mrd-21 Latitude (the
  flagged field was actually correct).
- Likewise, a recommended *fix* can be wrong even when the *problem* is real
  (e.g. an external auditor flagged Caris Assure as a duplicate — see below — but
  the merge would have been wrong).

## Distinguish "missing" from "not applicable"

Don't fabricate data to fill a gap that shouldn't be filled:
- **IVD kits / RUO panels** (ids `*-kit-*`) sold to labs usually have no single
  turnaround time, clinical availability, or Medicare coverage — those belong to
  the performing lab. (Exception: kits with their own PLA code, e.g. PGDx elio,
  do carry Medicare pricing.)
- **Single-gene / hotspot PCR tests** (cobas KRAS, therascreen EGFR) do not
  report MSI/TMB.
- The completeness metric counts these N/A fields as "gaps" — it is misleading
  for kit/single-gene products. A low completeness % is not automatically a
  problem.

## Respect the intentional MRD/TRM dual-listing

The same platform is deliberately listed under both **MRD** and **TRM** when the
clinical use cases differ — these are NOT duplicates to merge:
FoundationOne Tracker (`mrd-10`/`trm-6`), Signatera (`mrd-7`/`trm-2`),
Reveal (`mrd-6`/`trm-12`), Tempus xM (`mrd-8`/`trm-4`/`trm-14`),
Caris Assure (`mrd-18`/`trm-11`). They have distinct `approach`/use-case fields.
A true duplicate is the *same* product/use-case entered twice (e.g. the old
`mrd-30` collision, `trm-3` ≈ `mrd-2`, `tds-kit-10` ≈ `tds-kit-13`).

## Check internal consistency

Within one record, fields must agree. Common contradictions found:
- `medicareCoverage.status` vs `coverageCrossReference.medicare.status`
  (e.g. mrd-15 said COVERED top-level, NOT_COVERED in the cross-ref).
- `isDiscontinued: true` while `reimbursement` says COVERED.
- `fdaCompanionDxCount` (number) vs `fdaStatus` prose stating a different count.
- `approach` vs `requiresTumorTissue` (tumor-informed assays require genotyping).

## Currency: vendors get acquired, tests get retired

Re-check ownership and availability; this space churns. Seen this cycle:
Invitae→Labcorp, SAGA→Foundation Medicine/Roche, Exact Sciences↔Abbott,
Epigenomics→New Day Diagnostics, PreventionGenetics→Exact Sciences,
Resolution Bioscience wound down by Agilent, RaDaR v1 withdrawn. Flag tests
presented as available that are actually retired.

## Prefer FDA primary sources for IVD facts

For FDA kits/CDx, verify against the FDA database, not vendor PR alone: sample
type (tissue/FFPE vs plasma), gene counts (FDA De Novo/PMA content), De Novo/PMA
numbers, and companion-diagnostic counts. (A wrong PLA/CPT code drags in a wrong
Medicare rate.)

## Vendor-provenance labeling ("go with vendors")

Keep vendor-sourced values (price estimates, conference/investor data, vendor CDx
counts) — but **label the provenance transparently** so they're not mistaken for
peer-reviewed primary data. Examples: list prices → "Vendor/market estimate; no
published list price"; conference data → "(vendor-presented; not peer-reviewed)";
CDx counts → "Vendor-reported (vendor); FDA device list shows fewer rows due to
counting convention."

## Operational notes

- Always run `node evidence/scripts/verify-pipeline-state.js` before committing.
- Don't rewrite a whole `*.json` with raw Write; edit by id (load → modify the
  record → dump with `indent=2, ensure_ascii=False`) or use field-level Edits.
  Verify entry counts and `git diff --stat` stay small.
- Large multi-agent sweeps can hit the **account session usage limit**, which
  triggers a retry cascade that exhausts the agent cap and kills the run. Run big
  sweeps in batches, or pass a token budget. If a run dies, results are
  recoverable from the agent transcripts (grep the structured-output marker, e.g.
  `qualityScore`) — no work is lost.
