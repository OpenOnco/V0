# HCT Category Audit — Final Report

## 1. Category verdict

The 36-test HCT category is **structurally sound on identity but unreliable on detail**: nearly every record names a real, currently-offered test from a correct vendor, but quantitative and billing fields are systematically unverified or wrong, and the category is inflated by ~10 fabricated/duplicate records. The single largest defect class is a batch of 8 "VistaSeq" organ-specific panels (hct-16–23) with invented names plus 4 FoundationOne duplicate stubs — roughly a quarter of the category needs renaming, merging, or retirement. Median data quality is fair-to-good (most scores 55–82); the curated 2026 entries (hct-1, hct-13, hct-35) are strong, while the auto-generated Jan-2026 batch imports are weakest.

## 2. Critical issues

| id | test | issue |
|----|------|-------|
| hct-9 | Comprehensive Common Cancer Panel (GeneDx) | **No longer offered** — GeneDx exited hereditary cancer testing 2025-09-30; record still presents it as active with current Medicare pricing, and the "powers Tempus xG" differentiator is false. |
| hct-8 | xG / xG+ (Tempus) | Materially stale/false: still names **GeneDx** as germline lab (now Ambry, acquired Feb 2025) and lists retired 52/88 gene counts (now ~40/77). |
| hct-16 | VistaSeq Hereditary Breast Cancer Panel | **Fabricated name** — no such Labcorp SKU; conflates 481319/481452. |
| hct-18 | VistaSeq Hereditary Ovarian Cancer Panel | **Fabricated name** — no standalone ovarian SKU; ovarian is under GYN panel 481330. |
| hct-20 | VistaSeq Hereditary Gastric Cancer Panel | **Fabricated/non-orderable** — no gastric SKU; duplicate of hct-7. |
| hct-23 | VistaSeq Hereditary Melanoma Cancer Panel | **Fabricated/non-orderable** — no melanoma SKU; effectively duplicates hct-7. |
| hct-14 | Invitae Hereditary Thyroid Cancer Panel | **Wrong keyGenes** — lists SDHB/SDHD (not on panel), omits CHEK2/WRN. |
| hct-7 | VistaSeq Hereditary Cancer Panel | Critically wrong **CPT codes** (81432/81433 instead of the stacked individual-gene set), invalidating Medicare rate. |
| hct-31 | BRACAnalysis CDx (Myriad) | Critically wrong **CPT** (0137U = Ambry RNAinsight PALB2, not this test); cascades to wrong Medicare rate, ADLT flag, and sample type. |

Note: hct-19/21/22 (VistaSeq Endometrial/Pancreatic/Prostate) carry non-canonical names but DO map to real Labcorp SKUs (481385, 483555) — major name fixes, not fabrications.

## 3. Duplicates (confirmed, to merge/remove)

| keep | remove | product |
|------|--------|---------|
| hct-10 | hct-26 | Fulgent Full Comprehensive Cancer Panel (hct-26 is a thin "(Pan-Cancer)" stub) |
| hct-35 | hct-29 | FoundationOne Germline (hct-29 is empty batch stub) |
| hct-36 | hct-30 | FoundationOne Germline More (hct-30 is empty batch stub) |

hct-20 and hct-23 are also flagged as effectively duplicating hct-7, but the verifier classified them as distinct-named records — handle via retirement/rename (Section 2), not a clean merge.

## 4. Systemic gaps vs per-test gaps

**Systemic (structural — affects most/all HCT records):**
- **Unverified, often-fabricated analytical sensitivity/specificity.** Round figures (99 / 99.9) appear across hct-1, -2, -3, -4, -6, -7, -8, -10 with no field-level citation; several are copy-paste placeholders reused verbatim across unrelated vendors (99/99.9 shared by hct-8 and hct-9). Where checkable, vendor figures differ (Fulgent: >98%/96%, not 99.9/99.9).
- **Uncited Medicare rate $1303.95 reused across records** (hct-2, -3, -7, -10), pegged to CPT 81432; correct in isolation but applied to panels that don't bill that way.
- **vendorVerified: false across nearly the entire category** — most records are unconfirmed Jan-2026 batch imports.
- **Stale vendor identity** — Invitae→Labcorp (Aug 2024) not reflected on hct-2/11/12/14/15; the data labels these inconsistently ("Invitae" vs "Invitae (Labcorp)").
- **Gene-count ambiguity** — base-vs-max-with-add-ons reported as a single number (hct-2, -3, -4, -10, -11).

**Per-test (isolated):** hct-9 discontinued; hct-14 wrong gene membership; hct-31 wrong CPT/billing block; hct-1 mislabeled price field; hct-32 stale (3-variant vs current 44-variant 23andMe); hct-33 wrong lab partner (Baylor vs Broad) and misattributed publication.

## 5. Remediation backlog (prioritized by impact)

| id | test | top action | effort |
|----|------|-----------|--------|
| hct-9 | Comprehensive Common Cancer Panel | Flag discontinued (GeneDx exited 2025-09-30); remove false Tempus claim | S |
| hct-29, hct-30, hct-26 | FoundationOne / Fulgent stubs | Merge into hct-35/hct-36/hct-10; delete stubs | S |
| hct-16, hct-18 | VistaSeq Breast/Ovarian | Rename to real SKUs (481319 / GYN 481330) or retire | M |
| hct-20, hct-23 | VistaSeq Gastric/Melanoma | Retire or merge into hct-7 (no standalone SKU exists) | M |
| hct-31 | BRACAnalysis CDx | Fix CPT→81162, correct Medicare rate, drop ADLT, sample→blood EDTA | M |
| hct-7 | VistaSeq Hereditary Cancer Panel | Replace CPT block with stacked codes; re-derive Medicare | M |
| hct-8 | xG / xG+ | Update lab (GeneDx→Ambry), gene counts (40/77) | M |
| hct-14 | Invitae Thyroid | Fix keyGenes → APC, CHEK2, DICER1, PRKAR1A, PTEN, RET, TP53, WRN | S |
| hct-19, hct-21, hct-22 | VistaSeq Endometrial/Pancreatic/Prostate | Rename to canonical Labcorp names; add gene lists/codes | M |
| hct-32 | 23andMe BRCA | Update 3→44 variants (FDA K223597); add genotyping methodology | S |
| hct-33 | AbsoluteDx | Fix lab (Baylor→Broad), method (blended WGS+WES), publication (PMID 39202314) | M |
| hct-1..6, -10 | Various | Strip/cite fabricated sens/spec; reconcile gene counts | L (cross-cutting) |
| hct-2,11,12,14,15 | Invitae family | Normalize vendor to "Labcorp (formerly Invitae)" | S |

## 6. Quick wins (high-confidence, well-sourced fills — verified `confirmed`)

Apply immediately; each fill below returned a **confirmed** adversarial verdict:

- **hct-1** selfPayPrice → `$39 order fee ($249 = out-of-pocket threshold, not list price)` (Myriad testing-options page); cancerTypesAssessed → "More than 11 hereditary cancer types"; genesAnalyzedCitations → Myriad Gene Table PDF.
- **hct-2** tat → `10-21 days (14 avg)`; sampleVolume → `3 mL whole blood (EDTA) or saliva`; vendor → `Labcorp Genetics (formerly Invitae)` (GTR 528909); selfPay $250 confirmed (re-cite to invitae.com/new-programs-2025).
- **hct-3** genesAnalyzedNotes → `78 base, up to 90 with add-ons`; nyApprovalNumber → `NYS CLEP 73884`; testCode → `8875`; analyticalSensitivityNotes → ">99% of described mutations" (GTR 560508). *(Do NOT apply the proposed tat "5-14 days" — REFUTED: GTR has no TAT.)*
- **hct-6** tat → `21-30 days (+7-10 days CNV)` (Quest FAQ217). *(keyGenes and cancerTypesAssessed fills REFUTED — do not apply.)*
- **hct-7** keyGenes (27 genes) and cptCodes (stacked 81162…81479) → both confirmed verbatim on Labcorp 481220 page. *(cancerTypesAssessed fill REFUTED.)*
- **hct-10** analyticalSpecificity → `96`; analyticalSensitivityNotes → ">98%"; orderCode → `FT-TP00048`; genesAnalyzed → `127` (GTR 531711, vs marketing 154).
- **hct-11/12** keyGenes (13-gene primary list), tat `10-21 days`, methodology (NGS + del/dup, >99%) — all confirmed on Invitae test-01202/01206.
- **hct-14** keyGenes → `APC, CHEK2, DICER1, PRKAR1A, PTEN, RET, TP53, WRN` (Invitae test-01301).
- **hct-21/22** genesAssessed (14-gene / 10-gene lists), testCodes 481385/483555 — confirmed on Labcorp pages.
- **hct-24/25** BRCAssure testCodes (485066/485081), single-site intended-use, methodology — confirmed on Labcorp pages.
- **hct-27** turnaroundTime → `2-3 weeks (7-16 days STAT)`; sampleCategory → `Blood, Buccal, Saliva, Tissue` (PreventionGenetics page).
- **hct-31** cptCodes → `81162`; sampleCategory → `Blood (whole blood, EDTA)` (FDA P140020); methodology + fdaStatusNotes confirmed on Myriad page.
- **hct-33** numPublicationsNotes → Tsoulos et al. Diagnostics 2024 (PMID 39202314); labPartner → `Broad Institute`; sampleType → saliva (Allelica PR).

**Do NOT trust (refuted/uncertain proposed fills):** hct-3 tat "5-14 days" (refuted); hct-4 tat & hct-29 cancerTypes (refuted); hct-5 keyGenes 30-gene list (refuted — fabricated CDKN2A split, drops NBN) and method "Illumina/hybridization capture" (uncertain); hct-6 keyGenes/cancerTypes (refuted); hct-8 most fills (wrong-citation refuted); hct-17/23 method via GTR (refuted); hct-32 methodology via nonexistent K223597 URL (refuted); hct-26 method "(Illumina)" (refuted); hct-34 "Risk MAPS" verifications collided with a stale data.js path and are unreliable.