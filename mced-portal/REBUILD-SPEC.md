# MCED Portal — Complete Rebuild Spec

**This replaces ALL previous specs. The prototype HTML file at `mced-portal/prototype.html` is the reference implementation.**

---

## Summary

Single-page interactive MCED test comparison tool. All tests visible on page load. User selects cancer types of interest via dropdowns/toggles. Traffic light dots and card reordering happen in real time. No wizard, no separate results page, no scoring algorithm.

---

## Architecture

- Lives in `mced-portal/` directory (existing)
- React + Vite + Tailwind (existing stack)
- Reads from OpenOnco API (`/api/v1/tests?category=ecd`)
- Deploy at `mced.openonco.org` via Vercel

---

## Page layout (single page, top to bottom)

### Header
```
MCED test explorer
Compare multi-cancer early detection tests. Prepare for your doctor visit.
All sensitivity values are Stage I-II (early detection) from published clinical studies.
```

### Gender toggle (full width, two buttons)
```
[ Male ]  [ Female ]
```
- No third "Reset" button in this row
- Selecting a gender reveals the filter controls below
- Selecting a gender also filters the family history dropdowns (see below)

### Filter controls (hidden until gender selected)

**Family cancer history (mom's side)**
- Full-width dropdown, label above it
- Dropdown contains only cancers where at least one test has ANY sensitivity data
- Mom is female: exclude Prostate, Testis from her dropdown
- On select → tag appears below dropdown, cards update immediately
- Dropdown resets to placeholder after selection
- IMPORTANT: guard against onchange loop when resetting select value

**Family cancer history (dad's side)**
- Same pattern as mom
- Dad is male: exclude Breast, Cervix, Ovary, Endometrial, Uterus from his dropdown

**Lifestyle**
- Single pill toggle: "Smoker / former smoker"
- When activated: auto-adds Lung, Bladder, Pancreas, Head and Neck, Kidney, Esophagus to selected cancers
- Tags for smoking cancers appear below the pill

**Screening gaps**
- Sex-conditional pills:
  - Male: "No colonoscopy" → Colon/Rectum, "No PSA test" → Prostate
  - Female: "No colonoscopy" → Colon/Rectum, "No mammogram" → Breast, "No pap/HPV test" → Cervix
- Tags appear below the pills

**Tags**
- Each control section has its own tag area directly below it
- Family tags: purple, show cancer name + × to remove
- Smoking tags: amber, show cancer names (not individually removable — toggle the pill off)
- Gap tags: red, show cancer names

**Reset all**
- Small underlined text link, bottom-right of the controls area
- Clears everything, hides controls, returns to initial state

### Test cards

Cards are always visible from page load. Three-column layout per card:

**Column 1 (left, fixed width ~150px): Test info**
```
Test Name
Vendor name
$Price (or "Price TBD" in italic if null)
```

**Column 2 (middle, flex): Traffic lights — only when user has selections**
- Header: "YOUR SELECTED CANCERS" (small caps, muted)
- One row per selected cancer: colored dot + cancer name + sensitivity percentage
- Dot colors: green (#4aba4a) >50%, amber (#EF9F27) 25-50%, red (#E24B4A) ≤25% or no data
- Percentage shows one decimal: "53.0%" or "--" for no data
- This column doesn't render at all when no cancers are selected

**Column 3 (right, fixed width, full-height border-left): Cancer count**
- Large bold black number (32px)
- Below it, stacked words in small muted text, one per line:
  - Default (no selections): "cancers / may be / detected / early"
  - With selections: "additional / cancers / may be / detected / early"
- Number = count of cancers in the test's data that are NOT in the user's current selections
- Full-height left border divider

**No-data card treatment (e.g., Shield MCD):**
- Card has faded content (opacity 0.4)
- Diagonal red stamp overlay: "NO EARLY STAGE PER CANCER DATA PUBLISHED"
- Stamp: red text, red border, rotated -18deg, centered, uppercase, pointer-events none

### Card sorting

**Default (no selections):** Sort by total number of cancers in the test's data (descending). Tiebreak by number of >50% cancers. Final tiebreak alphabetical.

**With selections:** Sort by:
1. Tests with any data first (no-data tests → bottom)
2. Most green dots (descending)
3. Most amber dots (descending)
4. Fewest red dots (ascending)
5. Fewest no-data (ascending)

### Legend
```
● Strong detection  ● Moderate  ● Limited or not tested
```

### Methodology section
Full methodology text explaining:
- Stage I-II rationale
- Three sensitivity tiers with colored labels and thresholds (>50%, 25-50%, ≤25%)
- n≥5 sample size floor
- Data sources per test with study names
- Disclaimer: informational only, not medical advice, physician ordering required

---

## Data

### Sensitivity values are STAGE I-II only

This is critical. All-stage numbers inflate the apparent detection capability. Stage I-II is what "early detection" actually means.

### Test data — fetched from OpenOnco API

The portal fetches all ECD tests from `https://www.openonco.org/api/v1/tests?category=ecd` and auto-filters:
- `testScope` includes "Multi-cancer"
- `perCancerEarlyStageSensitivity` is not null

Tests with populated `perCancerEarlyStageSensitivity` objects get traffic lights.
Tests with empty `{}` objects get the stamp ("no per-cancer data published").

No hardcoded test data. The API is the single source of truth.
New tests added to OpenOnco with `perCancerEarlyStageSensitivity` automatically appear in the portal.

As of March 2026, 11 MCED tests are in the catalog:
- 6 with traffic light data: Galleri (19 cancers), Cancerguard (14), Caris Detect (10), EPISEEK (7), OverC (6), SPOT-MAS (4)
- 5 with stamps: Shield MCD, Trucheck Intelli, OncoXPLORE+, OnkoSkan, Harbinger

### Constants
```js
SENSITIVITY_TIERS = { GOOD: 50, OK: 25 }  // >50 green, 25-50 amber, ≤25 red
MIN_SAMPLE_SIZE = 5
SMOKING_CANCERS = ["Lung", "Bladder", "Pancreas", "Head and Neck", "Kidney", "Esophagus"]
```

### Dropdown filtering
Only show cancers in the dropdowns where at least one test has ANY sensitivity data for that cancer. Don't show Brain, Gallbladder, Leukemia, Small Intestine, etc. — they produce all-red results because no test has data for them.

---

## Regulatory guardrails (built into the design)

### What this tool is
A filtered product comparison tool. Like GoodRx for drug prices or Consumer Reports for product ratings. It displays published clinical data reorganized by the user's filter choices.

### What this tool is NOT
- Not a medical device — it doesn't analyze patient data or generate clinical recommendations
- Not a risk calculator — it doesn't compute cancer risk
- Not advertising — it doesn't promote any specific test

### Language rules
- "Your selected cancers" — NOT "your risk factors" or "your cancer concerns"
- "Prepare for your doctor visit" — NOT "your results"
- Never use "recommended," "best," "optimal," "you should"
- The user is choosing which cancers to VIEW, not receiving a personalized medical recommendation

### No purchase links
Do not link to vendor ordering pages or checkout flows.

### Physician gating reinforced
- Header: "Prepare for your doctor visit"
- Methodology footer: "MCED tests require a physician's order"
- Every test requires a physician order — the tool helps prepare for that conversation

---

## File structure (modify existing)

Keep the existing `mced-portal/` scaffold. Key files to rewrite:

```
src/
  App.jsx                    — Single-page layout, no routing

  data/
    thresholds.js            — GOOD: 50, OK: 25, MIN_SAMPLE_SIZE: 5
    smokingCancers.js        — The 6 smoking-associated cancers
    genderExclusions.js      — MALE_EXCLUDE, FEMALE_EXCLUDE arrays
    screeningGaps.js         — Male gaps, female gaps with labels

  hooks/
    useTestData.js           — Fetch from API, filter to multi-cancer with data
    useFilters.js            — Gender, family entries, smoking, gaps state

  logic/
    tierInfo.js              — Returns {color} based on sensitivity value
    sortTests.js             — Default sort + selection-based sort
    getDetectableCancers.js  — Filter ALL_CANCERS to only those any test covers

  components/
    GenderToggle.jsx
    FamilyDropdown.jsx       — Single dropdown with tag area below
    SmokingToggle.jsx
    ScreeningGaps.jsx
    TestCard.jsx             — Three-column card with all rendering
    NoDataStamp.jsx          — The diagonal red stamp overlay
    Legend.jsx
    Methodology.jsx
    ResetButton.jsx
```

Remove: `IntakeForm.jsx`, all `steps/` directory, `ComparisonMatrix.jsx`, `MatrixDot.jsx`, `MatrixTooltip.jsx`, `TestDetailPanel.jsx`, `ProfileSummary.jsx`, `DoctorQuestions.jsx`

---

## Reference implementation

The file `mced-portal/prototype.html` is the complete working prototype. It is a single self-contained HTML file with all the behavior, data, and styling. Use it as the source of truth for behavior, layout, and interaction patterns. Convert to React components.

---

## Verification checklist

1. Page loads with all 5 test cards visible, sorted by total cancer count
2. No controls visible until Male/Female selected
3. Select Female → dropdowns appear, mom excludes Prostate/Testis, dad excludes female cancers
4. Pick "Breast" from mom dropdown → tag appears below mom, traffic lights appear on all cards, cards reorder
5. Toggle smoking → 6 cancer tags appear, cards update with those cancers added
6. Toggle "No mammogram" → Breast tag appears in gaps, cards update
7. Shield MCD always at bottom with red diagonal stamp, faded content
8. Right column shows correct count, ticking down as cancers are selected
9. Right column says "cancers may be detected early" default, "additional cancers may be detected early" with selections
10. Reset clears everything back to initial state
11. All sensitivity values are Stage I-II
12. Dropdowns only show cancers where ≥1 test has data
13. No "recommended" or "best" language anywhere
14. Methodology section with sources present in footer

---

# Spec Update v2 — Consumer-Friendly Surface + Research Settings

**This section supersedes the data/test-list sections above. Layout and filter behavior from above still apply unless overridden here.**

## Design philosophy

**Consumer-friendly surface, research depth on demand.**

- Default view: clean cards with gender/family/smoking filters — exactly like the prototype
- Settings panel (gear icon): adjustable thresholds, stage toggle, data quality notes
- Info button per card: opens the full OpenOnco test detail page in a new tab
- No pricing anywhere
- No hardcoded test data — API is the single source of truth

## Data source

All test data fetched from `https://www.openonco.org/api/v1/tests?category=ecd`

Auto-detection logic:
- `testScope.includes('Multi-cancer')` + `perCancerEarlyStageSensitivity != null` → include
- Populated `perCancerEarlyStageSensitivity` object → traffic light card
- Empty `{}` object → stamp card ("no per-cancer early-stage data published")

New tests added to OpenOnco with `perCancerEarlyStageSensitivity` automatically appear.

### API fields used by the portal

From the list endpoint (`/api/v1/tests?category=ecd`):
```
name, vendor, id, testScope,
perCancerEarlyStageSensitivity,
perCancerEarlyStageSensitivitySource,
sensitivity, specificity,
stageISensitivity, stageIISensitivity,
totalParticipants, fdaStatus,
performanceNotes
```

For the info button link: `https://openonco.org/screen/{slugify(name)}`

## Card layout changes

### Column 1 (left): Test info — NO PRICE
```
Test Name
Vendor name
ⓘ  ← info icon, opens openonco.org/screen/{slug} in new tab
```

No price anywhere. The info icon (small circle-i) sits below vendor name. On click → `window.open('https://openonco.org/screen/' + slugify(test.name), '_blank')`.

Slugify function:
```js
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
```

### Columns 2 and 3: Unchanged from prototype

Traffic lights and cancer count columns work exactly as before.

## Settings panel

### Trigger
Small gear icon (⚙) top-right of page near header. Not prominent.

### Panel
Click gear → compact settings panel slides open below header, above gender toggle. Click again → closes.

### Contents

**Sensitivity thresholds:**
```
Strong detection:   [  50  ] %
Moderate detection: [  25  ] %
```
Number inputs or small sliders. Defaults: 50 and 25.
When changed → all traffic light dots recolor in real time.
Validation: strong must be > moderate > 0.

**Data quality note (small muted text):**
```
Sensitivity values are from published clinical validation studies.
Sample sizes and study designs vary between tests.
See individual test pages for full methodology.
```

## Header

```
MCED Early-Stage Sensitivity Data
Published per-cancer detection rates across multi-cancer screening tests
openonco.org
```

"openonco.org" links to https://openonco.org (small, muted, underlined).

Drop "Prepare for your doctor visit." Keep: "All sensitivity values are Stage I-II (early detection) from published clinical studies."

## Filters — KEEP consumer-friendly

Keep gender toggle, family history dropdowns, smoking toggle, screening gaps exactly as prototype. No changes to behavior.

**Dropdown source change:** Derive available cancers from API response instead of hardcoded array:
```js
const allCancers = new Set();
tests.forEach(t => {
  Object.keys(t.cancers).forEach(c => allCancers.add(c));
});
```

## Methodology disclaimer update

Replace the existing disclaimer with:

"This tool presents published clinical data for research and educational purposes. It is not a clinical decision support tool. MCED tests require a physician's order — discuss testing decisions with your healthcare provider. Data sourced from OpenOnco.org, an independent nonprofit cancer diagnostics database. Verify all values against original publications."

Add: "Sensitivity thresholds (default: >50% strong, 25-50% moderate) can be adjusted in Settings (⚙). All thresholds are for visualization only and do not represent clinical guidelines."

## Additional verification checklist items

15. No price displayed anywhere on any card
16. Info icon on each card opens correct OpenOnco test page in new tab
17. Settings gear opens/closes threshold panel
18. Changing threshold values updates traffic light colors in real time
19. Tests auto-detected from API — no hardcoded test list
20. Cancer type dropdowns derived from API data, not hardcoded list
21. All MCED tests from API appear (traffic lights for those with data, stamps for empty)
22. New test added to OpenOnco with perCancerEarlyStageSensitivity appears automatically on next page load
