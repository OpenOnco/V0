# MCED Portal — Product Plan

**Status:** Pre-development planning  
**Date:** March 2026  
**Author:** OpenOnco

---

## 1. What this is

A consumer-facing web portal that helps people understand which multi-cancer early detection (MCED) blood tests are most relevant to their personal risk profile. The user answers a short intake questionnaire about their age, sex, family cancer history, smoking status, and current screening status. The portal ranks available MCED tests using a transparent, cited scoring model and explains why each test ranked the way it did.

The doctor still prescribes. This is consumer education, not medical advice.

---

## 2. Scope

**Included:** Tests that report sensitivity across 3 or more cancer types from a single blood draw (e.g. Galleri, CancerSEEK, Cancerguard, DETECT-A).

**Excluded:** Single-cancer screening tests (Cologuard, etc.), treatment decision support tests (OncotypeDx, etc.), MRD monitoring tests. These are fundamentally different products serving different clinical moments.

**Rule for inclusion:** A test must have per-cancer-type sensitivity data in the OpenOnco ECD database to appear in the portal.

---

## 3. Architecture decision

**Recommendation: Standalone webapp, API-driven.**

- Hosted at `mced.openonco.org` or potentially its own brand
- Reads test data via the OpenOnco public API (same source as the main site)
- Separate codebase, separate deployment
- No shared auth, no physician system entanglement
- Different audience (consumers), different regulatory posture, cleaner separation

The main OpenOnco site remains clinician/researcher-oriented. This portal is consumer-first. Keeping them separate avoids UX and regulatory conflation.

**OpenOnco API surface needed:**
- ECD test list with per-cancer-type sensitivity data
- Test price (list/cash-pay)
- Coverage reality check data (payer coverage status)
- Specificity per test

---

## 4. Intake flow

### Gate question (shown first, hard exit if yes)

**"Have you personally ever been diagnosed with cancer?"**

- **Yes** → exit immediately with a warm message: "This tool is designed for people who haven't had a cancer diagnosis. If you've had a diagnosis, your oncologist can guide you to the right tests." Link to main OpenOnco site for MRD and TDS resources.
- **No** → proceed to intake

Note on wording: must be clearly "you personally" so people with family history of cancer don't accidentally exit. Add a brief clarifying note for people with pre-cancerous findings or active surveillance — suggest they discuss MCED testing with their doctor before using this tool.

### Intake questions (after gate)

| # | Question | Format | Notes |
|---|----------|--------|-------|
| 1 | What is your age? | Dropdown, 5-year ranges 40–80+ | Maps to SEER incidence by age band |
| 2 | Sex assigned at birth | Toggle male / female | Determines relevant cancer types and incidence rates |
| 3 | Has anyone in your immediate family been diagnosed with cancer? | Multi-select cancer type list; per-cancer follow-up for relationship (parent/sibling/child) and optional age at diagnosis | Primary risk driver; maps to family_RR multipliers |
| 4 | Have you ever smoked? | Dropdown: never / former / current | Significant multiplier for lung and several other cancers |
| 5 | Are you up to date on any of these standard cancer screenings? (check all that apply, normal result) | Checkbox list (sex-conditional, see below) | Applies screening_discount multiplier to covered cancer types |

### Screening priors checklist (Q5)

Shown to everyone:
- Colonoscopy in the last 10 years, normal result

Shown to women only:
- Mammogram in the last 2 years, normal result
- Pap smear or HPV test in the last 3–5 years, normal result

Rationale: these are the USPSTF A/B-rated cancer screens with the most direct impact on MCED cancer weighting. Lung LDCT is omitted — smokers already have elevated lung weighting in the model and will naturally surface the best lung-sensitive tests without a separate prior.

**Cancer type list for Q3** is pulled from OpenOnco — only cancers where at least one MCED test reports sensitivity data.


---

## 5. Ranking model — expected detection score

### Formula

```
Score(test) = Σ [ adjusted_incidence(cancer, user) × sensitivity(test, cancer) ]
```

For each cancer type covered by the test, multiply the user's risk-adjusted incidence rate by the test's reported sensitivity for that cancer. Sum across all cancer types. Higher score = better match for this user's profile.

### Adjusted incidence

```
adjusted_incidence = base_incidence × family_RR × smoking_RR × screening_discount
```

- `base_incidence`: Annual rate per person from SEER, indexed by cancer type, age range, sex
- `family_RR`: Relative risk multiplier from published meta-analyses
- `smoking_RR`: Multiplier for lung, bladder, pancreatic, head & neck — current/former/never
- `screening_discount`: Value between 0–1 applied when a normal recent screen already covers that cancer type. Clean colonoscopy → colorectal discount ~0.3. Clean mammogram → breast discount ~0.4. No recent screen → 1.0. Abnormal result → not collected; user is directed to their doctor.

All multipliers default to 1.0 if not applicable.

### Normalization

Raw scores normalized to a 0–100 integer scale. Highest-scoring test for that user gets 100.

### Value score

```
value_score = match_score / (price / 1000)
```

Normalized to a high / moderate / low value indicator shown alongside price on each card.

### Missing data handling

If a test does not report sensitivity for a cancer type, that cancer contributes zero to the score. The UI flags it as "not reported" — not implied zero. Transparency is non-negotiable.

---

## 6. Data tables required

### Table 1: Base incidence rates
- Source: SEER Cancer Statistics Review
- Indexed by: cancer type × age range (5-year bands) × sex
- Format: annual rate per person (SEER per-100k ÷ 100,000)

### Table 2: Family history relative risk multipliers
- Source: published meta-analyses, one citation per cancer type
- Fields: cancer type, first-degree RR, first-degree-under-50 RR, second-degree RR
- Cancers without published RR data default to 1.0 with a "not adjusted" note

### Table 3: Smoking relative risk multipliers
- Source: published meta-analyses / IARC monographs
- Applicable cancers: lung, bladder, pancreatic, head and neck, kidney, esophageal

### Table 4: Screening discount factors
- Source: published post-screening residual risk literature
- Fields: screening type, cancer type, discount multiplier, recommended interval
- Colonoscopy → colorectal; mammogram → breast; pap/HPV → cervical

### Table 5: Test sensitivity by cancer type
- Source: OpenOnco ECD database via API — updates automatically

### Table 6: Test metadata
- Source: OpenOnco ECD database via API
- Fields: test ID, name, manufacturer, price (list/cash-pay), specificity, coverage status

---

## 7. UI — simple card layout

No animations. Clean, readable, static layout.

**Above the cards:** Plain-language summary of the user's risk profile so they can verify the model understood their inputs. E.g. "Based on your family history of pancreatic and colorectal cancer, age 54, and former smoking history…"

**Each test card shows:**
- Test name and manufacturer
- Match score (0–100 integer)
- Price (list/cash-pay)
- Value indicator (high / moderate / low)
- Per-cancer sensitivity bars for the user's top concern cancers
- Coverage reality check status (likely covered / varies / cash pay)
- "See full breakdown" link showing complete per-cancer data and scoring formula

**Sort options:** Match score (default), value, price, cancers covered.

**Persistent disclaimer:** Plain-language note that results are informational, all MCED tests require a prescription, and the user should discuss options with their doctor.


---

## 8. Regulatory and content posture

- **Framing:** Consumer education, not medical advice. "Here is how these tests compare for someone with your profile" not "you should get this test."
- **Physician guardrail:** Explicit language that all MCED tests require a physician order. Link to "how to talk to your doctor" resources.
- **Citation requirement:** Every RR multiplier, incidence figure, and discount factor must link to a published, verifiable source. Same standard as the OpenOnco physician system.
- **CDS exemption posture:** Non-device clinical decision support under 21st Century Cures Act — multi-option format, mandatory citations, no single algorithmic recommendation. Formal legal review recommended before launch.
- **No raw diagnostic conclusions.** The portal never says "you are at high risk for cancer." It says "tests with strong colorectal sensitivity rank higher for your profile."
- **Abnormal prior screens:** Not collected. If a user indicates an abnormal screening result they are directed to their doctor rather than continuing through the portal.

---

## 9. Phase 1 vs. later

### Phase 1 (launch)
- Cancer diagnosis gate
- 5-question intake (age, sex, family history, smoking, screening priors)
- Expected detection scoring model with screening discount
- Normalized 0–100 match score and value indicator
- Simple card layout with per-cancer sensitivity breakdown
- Coverage reality check integration
- Full citations on all multipliers and discount factors

### Phase 2
- Race/ethnicity adjustment (additional incidence table segmentation)
- BMI as a risk factor
- Genetic testing results (BRCA, Lynch syndrome) as optional inputs
- "Share with my doctor" — summary PDF or shareable link
- Single-cancer comparison tool (parallel, separate UX)

---

## 10. Open questions

1. **Brand:** `mced.openonco.org` or separate brand? Separate brand has consumer appeal advantages but fragments OpenOnco equity.
2. **Price data maintenance:** Who maintains list prices and how often do they update? Need a lightweight workflow.
3. **RR and discount multiplier build:** Needs oncologist review — Matt, Ogan, Hakan, Sam to validate family history RR values and screening discount factors.
4. **Legal review timing:** Recommend before any public promotion.
5. **Analytics:** PostHog same as main site — useful for understanding which cancers users are most concerned about.
