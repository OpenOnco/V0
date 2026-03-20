# MCED Portal — Scoring Algorithm (Technical Specification)

**Purpose:** Formal specification of the expected detection scoring model for LLM review.
**Status:** Draft for review
**Date:** March 2026

---

## 1. Overview

The portal ranks MCED (multi-cancer early detection) tests for a specific user by computing an **expected detection score** for each test. The score estimates the relative number of cancers a given test would be expected to detect per 100,000 people sharing that user's risk profile, computed only over cancer types where the test reports sensitivity data. Tests are then normalized to a 0–100 integer scale for display.

Alongside the match score, the portal displays **evidence completeness** (what fraction of the user's relevant cancer types are covered by the test's published sensitivity data) and **harm indicators** (specificity and false positive burden) so that users see both what the test detects and what it may flag incorrectly.

The model is intentionally transparent: every multiplier is cited, every formula component is shown to the user on request.

---

## 2. Inputs

| Variable | Type | Source |
|----------|------|--------|
| `age_range` | string (e.g. "50-54") | User intake |
| `sex` | string ("male" / "female") | User intake |
| `family_history` | array of `{ cancer_type, relationship, age_at_diagnosis? }` | User intake |
| `smoking_status` | string ("never" / "former" / "current") | User intake |
| `screening_priors` | array of `{ screen_type, result }` | User intake |
| `tests` | array of test objects from OpenOnco ECD API | API |

---

## 3. Core formula

For each test T and each cancer type C where T reports sensitivity data:

```
component(T, C) = adjusted_incidence(C, user) × sensitivity(T, C)
```

The score for test T is the sum across cancer types where T has reported sensitivity:

```
raw_score(T) = Σ_{C ∈ reported(T)} [ adjusted_incidence(C, user) × sensitivity(T, C) ]
```

Cancer types where test T does not report sensitivity are **excluded from the sum** — they do not contribute zero; they are simply not scored. This prevents penalizing a test for not yet publishing data on a given cancer type.

Units: expected detections per 100,000 person-years.

### 3.1 Evidence completeness

Evidence completeness tracks the breadth of a test's published sensitivity data relative to the user's relevant cancer types:

```
evidence_completeness(T) = |reported(T) ∩ relevant(user)| / |relevant(user)|
```

Where `relevant(user)` is the set of cancer types with non-trivial adjusted incidence for this user profile (e.g., excluding sex-specific cancers that don't apply). Evidence completeness is displayed in the UI as a percentage or badge (e.g., "Sensitivity data for 12 of 15 relevant cancer types") alongside the match score.

A test with a high match score but low evidence completeness may rank well on what it reports but is missing data on many cancers. Users should see both dimensions.

---

## 4. Adjusted incidence

```
adjusted_incidence(C, user) = base_incidence(C, age_range, sex)
                              × family_RR(C, family_history)
                              × smoking_RR(C, smoking_status)
                              × screening_discount(C, screening_priors)
```

All multipliers default to 1.0 when not applicable. Multipliers are applied independently (interaction effects are not modeled in v1 — acknowledged limitation).

### 4.1 Base incidence

- **Source:** SEER Cancer Statistics Review, Table 1-12 (age-specific incidence rates by sex)
- **Format:** Annual rate per 100,000 persons, indexed by `(cancer_type, age_range, sex)`
- **Age bands:** 40–44, 45–49, 50–54, 55–59, 60–64, 65–69, 70–74, 75–79, 80+
- **Example values (per 100,000 per year):**

| Cancer | Male 50–54 | Female 50–54 |
|--------|-----------|--------------|
| Colorectal | 37.2 | 28.1 |
| Lung | 54.8 | 47.3 |
| Pancreatic | 11.9 | 9.4 |
| Breast | — | 183.7 |
| Ovarian | — | 12.1 |
| Prostate | 143.6 | — |

### 4.2 Family history relative risk multipliers

- **Source:** Published meta-analyses, one citation per cancer type
- **Applied when:** User reports a first- or second-degree relative diagnosed with that cancer type
- **Logic:**
  - First-degree relative (parent, sibling, child): apply `first_degree_RR`
  - First-degree relative diagnosed under age 50: apply `first_degree_early_RR` instead
  - Second-degree relative only: apply `second_degree_RR`
  - Multiple first-degree relatives: apply `multiple_first_degree_RR` where published
  - If no family history for that cancer: multiplier = 1.0

**Reference values (to be validated by oncologist reviewers):**

| Cancer | first_degree_RR | first_degree_early_RR | second_degree_RR | Source |
|--------|----------------|----------------------|-----------------|--------|
| Colorectal | 2.24 | 3.87 | 1.50 | Butterworth et al. 2006 |
| Breast | 1.75 | 2.18 | 1.33 | Collaborative Group 2001 |
| Pancreatic | 1.80 | — | 1.20 | Permuth & Malafa 2009 |
| Lung | 1.51 | — | 1.20 | Matakidou et al. 2005 |
| Ovarian | 3.10 | — | 1.50 | Jervis et al. 2014 |
| Prostate | 2.35 | 2.89 | 1.50 | Bruner et al. 2003 |
| Gastric | 2.90 | — | 1.50 | Yaghoobi et al. 2010 |

Cancers without published family RR data: multiplier = 1.0, flagged as "family history not adjusted" in UI.

### 4.3 Smoking relative risk multipliers

- **Source:** IARC Monographs; US Surgeon General Reports
- **Applied to:** lung, bladder, pancreatic, head and neck, kidney, esophageal
- **Not applied to:** cancers without established smoking association
- **Logic:** Select multiplier by `(cancer_type, smoking_status)`

**Reference values (to be validated):**

| Cancer | current_RR | former_RR | Source |
|--------|-----------|----------|--------|
| Lung | 23.0 | 8.0 | IARC Monograph 100E |
| Bladder | 4.1 | 2.3 | IARC Monograph 100F |
| Pancreatic | 2.2 | 1.2 | Iodice et al. 2008 |
| Head & neck | 5.0 | 1.8 | IARC Monograph 100E |
| Kidney | 1.5 | 1.2 | IARC Monograph 100F |
| Esophageal | 3.6 | 1.8 | IARC Monograph 100E |

### 4.4 Screening discount factors

- **Rationale:** A recent normal screening result reduces the effective incidence weight for the covered cancer type, because that cancer is already being actively monitored. This reflects residual post-screening risk, not zero risk.
- **Applied when:** User reports a specific screening as current and normal result
- **Not collected:** Abnormal results — users with abnormal results are directed to their doctor

**Discount factors (to be validated against post-screening residual risk literature):**

| Screen | Cancer type | discount_factor | Interval assumption | Source |
|--------|-------------|----------------|-------------------|--------|
| Colonoscopy | Colorectal | 0.30 | Within last 10 years | Nishihara et al. 2013 |
| Mammogram | Breast | 0.40 | Within last 2 years | Nelson et al. 2016 |
| Pap / HPV test | Cervical | 0.25 | Within last 3–5 years | Katki et al. 2011 |

Applied as: `adjusted_incidence × discount_factor`
If no relevant screen reported: discount_factor = 1.0 (no discount applied)

---

## 5. Sensitivity data

- **Source:** OpenOnco ECD database, fetched via API at query time
- **Format:** `sensitivity(test_id, cancer_type)` as a decimal (0.0–1.0)
- **Stage weighting:** Some tests report sensitivity by stage (I, II, III, IV). Where stage-specific data is available, a weighted average is computed using SEER stage distribution at diagnosis as weights. Where only overall sensitivity is reported, that value is used directly.
- **Missing data rule:** If a test does not report sensitivity for a cancer type, that cancer type is **excluded from the test's score calculation entirely**. It is not treated as zero. The UI displays "not reported" for that cancer type and the evidence completeness metric (§3.1) reflects the gap. This distinction matters: a test that reports 0.05 sensitivity for a cancer has measured and published poor performance; a test that has not reported data simply has no evidence yet.

---

## 6. Score normalization

### 6.1 Match score (0–100)

```
normalized_score(T) = round( raw_score(T) / max_raw_score_universe × 100 )
```

Where `max_raw_score_universe` is the highest raw score among **all MCED tests in the OpenOnco database** for this user's profile — not just the tests currently displayed or filtered in the UI.

**Normalization stability:** By normalizing against the full OpenOnco MCED test universe, scores remain stable regardless of which subset of tests is shown in the UI. Filtering, sorting, or paginating does not change any test's score. If a new test is added to the database with a higher raw score, all scores will shift proportionally — this is expected and correct, as it reflects a genuinely better option entering the market.

### 6.2 Value score

The value score measures expected detections per dollar spent, using the raw (unnormalized) score:

```
value_ratio(T) = raw_score(T) / (price(T) / 1000)
```

Units: expected detections per 100,000 person-years per $1,000 spent.

This is then bucketed by normalizing `value_ratio` across all tests in the universe:

```
normalized_value(T) = value_ratio(T) / max_value_ratio_universe
```

- Top third of normalized value → **"high value"**
- Middle third → **"moderate value"**
- Bottom third → **"low value"**

Note: Using `raw_score` rather than `normalized_score` for the value calculation eliminates a source of instability. The normalized match score is relative (the top test is always 100), so dividing it by price would make value scores shift whenever the top-scoring test changes. Raw scores are absolute, producing stable value comparisons.

---

## 7. Score contribution breakdown (UI requirement)

Each test card in the UI must display a **score contribution breakdown** showing which cancer types are driving the test's match score. This makes the composition of the score transparent — particularly when a single high-incidence cancer dominates via a large risk multiplier.

### Display format

For each test, show the top contributing components (up to 5, or all components above a threshold such as 5% of the test's total raw score):

| Cancer Type | Adjusted Incidence | Sensitivity | Component Score | % of Total |
|-------------|-------------------|-------------|----------------|------------|
| Lung | 438.4 | 0.70 | 306.9 | 72.9% |
| Prostate | 143.6 | 0.40 | 57.4 | 13.6% |
| Colorectal | 43.2 | 0.82 | 35.4 | 8.4% |
| Pancreatic | 25.7 | 0.83 | 21.3 | 5.1% |

### Rationale

Without this breakdown, a test could score highly because of a single dominant cancer type (e.g., lung in a former smoker with 8× risk multiplier) while performing poorly on the cancers the user might care about most. The breakdown makes multiplier dominance visible rather than hidden, allowing users and clinicians to assess whether a test's high score is broadly based or concentrated.

This should be expandable/collapsible in the UI — shown by default in a summary row (e.g., "Score driven by: Lung 73%, Prostate 14%") with full detail on click.

---

## 8. Harm indicators (parallel display)

Alongside the match score, each test displays **specificity and false positive burden** indicators. In v1, these are shown as separate columns or badges — they are **not folded into the ranking formula**.

### 8.1 Specificity

- **Source:** Published specificity from the test's validation studies, sourced from OpenOnco ECD database
- **Format:** Overall specificity as a percentage (e.g., "99.5% specificity")
- **Display:** Shown on the test card alongside match score

### 8.2 Estimated false positive burden

For a screening population, the false positive rate depends on specificity and the number of people screened who do not have cancer:

```
estimated_FP_per_1000 = (1 - specificity) × 1000
```

This is a population-level estimate (per 1,000 people screened). Example: a test with 99.5% specificity produces ~5 false positives per 1,000 screened.

### 8.3 Display format

| Test | Match Score | Evidence | Specificity | Est. FP per 1,000 | Value |
|------|------------|----------|-------------|-------------------|-------|
| Galleri | 100 | 12/15 | 99.5% | ~5 | High |
| Test B | 80 | 10/15 | 99.1% | ~9 | Low |

### 8.4 Why not in the ranking formula (v1)

Folding specificity into the ranking score would require choosing a relative weight between detection benefit and false positive harm — a clinical judgment that varies by patient context and physician preference. In v1, we present both dimensions and let the user and their clinician weigh the tradeoff. A composite score incorporating harm is a candidate for v2 after user research on how the tradeoff information is used.

---

## 9. Worked example

**User profile:**
- Age: 54, male
- Family history: brother with colorectal cancer at age 48 (first-degree, early onset); father with pancreatic cancer at age 61 (first-degree)
- Smoking: former smoker
- Screening priors: colonoscopy 2 years ago, normal

**Step 1: Adjusted incidence per cancer type (per 100,000)**

| Cancer | Base | × family_RR | × smoking_RR | × screening_discount | = Adjusted |
|--------|------|------------|-------------|---------------------|-----------|
| Lung | 54.8 | 1.0 | 8.0 (former) | 1.0 | **438.4** |
| Colorectal | 37.2 | 3.87 (early onset) | 1.0 | 0.30 (colonoscopy) | **43.2** |
| Pancreatic | 11.9 | 1.80 | 1.2 (former) | 1.0 | **25.7** |
| Prostate | 143.6 | 1.0 | 1.0 | 1.0 | **143.6** |
| Bladder | — | 1.0 | 2.3 (former) | 1.0 | varies |

**Step 2: Raw score for two example tests**

Galleri sensitivity (illustrative — only cancer types with reported sensitivity are included):

| Cancer | Adjusted incidence | × Sensitivity | = Component |
|--------|-------------------|--------------|------------|
| Lung | 438.4 | 0.70 | 306.9 |
| Colorectal | 43.2 | 0.82 | 35.4 |
| Pancreatic | 25.7 | 0.83 | 21.3 |
| Prostate | 143.6 | 0.40 | 57.4 |
| **Total** | | | **421.0** |

Hypothetical Test B (does not report prostate sensitivity — excluded, not zeroed):

| Cancer | Adjusted incidence | × Sensitivity | = Component |
|--------|-------------------|--------------|------------|
| Lung | 438.4 | 0.45 | 197.3 |
| Colorectal | 43.2 | 0.90 | 38.9 |
| Pancreatic | 25.7 | 0.55 | 14.1 |
| **Total** | | | **250.3** |

Evidence completeness: Galleri 4/4 relevant cancers. Test B 3/4 (prostate not reported).

**Step 3: Normalize (against full test universe)**

Assume the highest raw score across all tests in the OpenOnco database for this user is 421.0 (Galleri).

- Galleri: round(421.0 / 421.0 × 100) = **100**
- Test B: round(250.3 / 421.0 × 100) = **59**

**Step 4: Value score (uses raw score, not normalized)**

- Galleri: 421.0 / (949 / 1000) = **443.6** expected detections per $1,000
- Test B: 250.3 / (3500 / 1000) = **71.5** expected detections per $1,000

Max value ratio in universe = 443.6 (Galleri). Galleri → high value. Test B → low value.

**Step 5: Harm indicators**

- Galleri: specificity 99.5% → ~5 FP per 1,000 screened
- Test B: specificity 99.1% → ~9 FP per 1,000 screened

---

## 10. Known limitations and v1 scope decisions

1. **Independence assumption:** Risk multipliers are multiplied independently. True risk models account for interaction effects (e.g. smoking + family history of lung cancer is not simply additive). This is a known simplification, standard for consumer-facing tools, and should be disclosed.

2. **Stage distribution weighting:** Where stage-specific sensitivity is available, SEER stage-at-diagnosis weights are used. These reflect the general population's stage distribution at diagnosis, which may favor tests with good late-stage performance. High-risk individuals and those in screening programs may have different (earlier) stage distributions at detection. **Early-stage weighting is deferred to v2** due to sparse stage-specific sensitivity data across tests — most tests publish only overall sensitivity or sensitivity for a subset of stages, making consistent early-stage weighting impractical today.

3. **Prevalence vs. incidence:** The model uses annual incidence rates (new cases per year) rather than prevalence. This is appropriate for a screening context where we are asking "will this person develop cancer this year."

4. **Price volatility:** List/cash-pay prices are used. Insurance coverage and out-of-pocket cost vary substantially and are not modeled in the match score — they are displayed separately via OpenOnco coverage reality check data.

5. **Race/ethnicity:** Not included in v1. SEER publishes race-stratified incidence rates; this is a Phase 2 addition.

6. **Polygenic risk scores:** Not included. Adds significant accuracy for breast, colorectal, and prostate but requires genetic testing data most consumers don't have.

7. **Single cancer tests excluded:** Only tests reporting sensitivity across 3+ cancer types are included. Single-cancer screening tests serve a different clinical purpose and are excluded by design.

8. **Missing sensitivity ≠ zero sensitivity:** The scoring model excludes cancer types where a test has not reported sensitivity, rather than treating missing data as zero. This is the correct default — absence of published data is not evidence of zero detection — but it means tests with narrow published panels are scored only on what they report. The evidence completeness metric (§3.1) mitigates this by making data gaps visible.

9. **Harm not in ranking (v1):** Specificity and false positive burden are displayed alongside scores but do not affect ranking. This avoids imposing a detection-vs-harm tradeoff weighting but means the ranking is purely detection-optimized. Users must consult harm indicators independently.

---

## 11. Review questions for oncologist reviewers

1. Are the family history RR values in Table 4.2 consistent with current literature? Any cancer types where better meta-analyses exist?
2. Are the smoking RR values in Table 4.3 reasonable for a consumer tool? Should esophageal be split by histology (adenocarcinoma vs squamous)?
3. Are the screening discount factors in Table 4.4 defensible? Particularly the colonoscopy discount of 0.30 — is this too aggressive or not aggressive enough?
4. Is the evidence completeness metric (§3.1) a sufficient signal for users to judge data gaps, or should there be a minimum completeness threshold below which a test is flagged or demoted?
5. Are there any cancer types where the independence assumption for multipliers is particularly problematic and should be flagged more prominently?
6. For the harm indicators (§8): is overall specificity sufficient, or should cancer-signal-origin false positive rates be broken out separately where available?
7. Is the decision to defer early-stage weighting to v2 reasonable given current data availability, or are there tests with enough stage-specific data to justify including it now?
8. Any regulatory or ethical concerns with the framing as written?
