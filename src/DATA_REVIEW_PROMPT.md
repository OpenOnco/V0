# OpenOnco Data Review Prompt

Upload `data.js` along with this prompt to any LLM with web search capability.

---

## PROMPT

```
You are reviewing the data.js file for OpenOnco (openonco.org), an open database of liquid biopsy cancer diagnostic tests. The database covers 4 categories:

- **MRD** (Minimal Residual Disease) - post-treatment cancer monitoring
- **ECD** (Early Cancer Detection) - screening tests for asymptomatic individuals  
- **TRM** (Therapy Response Monitoring) - tracking treatment response
- **TDS** (Therapy/Diagnostic Selection) - CGP panels for therapy selection

Please conduct a COMPREHENSIVE review with web search. For each issue found, provide the test name, field, current value, suggested correction, and citation URL.

---

## TASK 1: DATA ACCURACY & CONSISTENCY

Review each test for:

1. **Internal consistency**
   - Does sensitivity + specificity align with reported PPV/NPV given typical prevalence?
   - Do stage-specific sensitivities (I, II, III, IV) logically relate to overall sensitivity?
   - Is LOD reported consistently (%, ppm, copies/mL)?
   - Does TAT (turnaround time) match industry norms for the test type?

2. **Regulatory status accuracy**
   - FDA status: Is it correctly listed as FDA-approved, FDA-cleared, Breakthrough Device, LDT, or RUO?
   - CE marking: CE-IVD vs CE-IVDR distinction correct?
   - Any recent FDA approvals or clearances not reflected?

3. **Reimbursement accuracy**
   - Medicare coverage status current?
   - Any recent LCD/NCD decisions?
   - CPT/PLA codes correct?

4. **Field completeness**
   - Tests with null values that should have data
   - Missing citations for claimed metrics
   - Notes that don't add value beyond restating the number

---

## TASK 2: CITATION VERIFICATION

For each test, verify:

1. **Citation URLs** - Are they valid and accessible?
2. **Citation accuracy** - Does the cited source actually support the claimed value?
3. **Citation recency** - Are there newer publications with updated data?
4. **Missing citations** - Which performance claims lack citations?

Flag any:
- Broken URLs (404, paywall-only, retracted)
- Outdated citations when newer data exists
- Claims citing only "vendor data" that now have published validation

---

## TASK 3: NEW INFORMATION SEARCH

Search the web for each test to find:

1. **New publications** (2024-2025)
   - New validation studies
   - Updated performance data
   - Real-world evidence studies
   - Head-to-head comparisons

2. **Regulatory updates**
   - New FDA clearances/approvals
   - Breakthrough Device designations
   - International approvals (CE-IVDR, NMPA, PMDA)

3. **Commercial updates**
   - Price changes
   - New cancer type indications
   - Discontinued products
   - Company acquisitions/mergers affecting test names

4. **Clinical trial updates**
   - New trial results published
   - Trials completed but not yet in database
   - Expanded indications from trial data

---

## TASK 4: MISSING TESTS

Search for liquid biopsy tests NOT in the database that should be:

1. **Recently launched tests** (2024-2025)
2. **International tests** gaining US/EU availability
3. **Tests from major vendors** that may be missing
4. **IVD kits** vs central lab services distinction

For each missing test, provide:
- Test name and vendor
- Category (MRD/ECD/TRM/TDS)
- Key differentiator
- Source URL

---

## TASK 5: COMPETITIVE LANDSCAPE

Flag any claims that may be outdated due to competitive changes:

1. "First" or "only" claims that are no longer true
2. Performance claims surpassed by newer tests
3. Pricing that's significantly different from current market
4. Coverage claims that have changed

---

## OUTPUT FORMAT

Please organize findings as:

### 🔴 CRITICAL (incorrect data, broken citations, discontinued tests)
| Test | Field | Current | Suggested | Source |
|------|-------|---------|-----------|--------|

### 🟡 UPDATES NEEDED (new data available, outdated info)
| Test | Field | Current | Suggested | Source |
|------|-------|---------|-----------|--------|

### 🟢 NEW INFORMATION (enhancements, new publications)
| Test | Field | Addition | Source |
|------|-------|----------|--------|

### 🆕 MISSING TESTS (should be added)
| Test | Vendor | Category | Key Info | Source |
|------|--------|----------|----------|--------|

### ✅ VERIFIED ACCURATE (spot-checked and confirmed)
List tests you verified are current and accurate.

---

## PRIORITY VENDORS TO CHECK

These vendors frequently update their tests - prioritize checking:
- Guardant Health (Guardant360, Reveal, Shield)
- Natera (Signatera, Altera, Prospera)
- Foundation Medicine (FoundationOne CDx/Liquid/Tracker)
- Grail (Galleri)
- Exact Sciences (Cologuard, Oncotype)
- Tempus (xT, xF, xR)
- Adaptive Biotechnologies (clonoSEQ)
- Personalis (NeXT Personal)
- NeoGenomics (NEO PanTracer)
- Burning Rock (OverC, CanCatch)

---

## NOTES

- Focus on US and EU markets primarily
- Include China/APAC tests if they have significant validation data
- Distinguish between analytical validation and clinical validation
- Flag any "100%" sensitivity/specificity claims with small sample sizes
- Note when vendor-reported data differs from peer-reviewed publications

Thank you for conducting this thorough review. Please be comprehensive - this database is used by patients, clinicians, and researchers to make important decisions.
```

---

## USAGE TIPS

**Claude:** Upload data.js, paste prompt. Works best with Claude Opus for thoroughness.

**GPT-4:** Upload data.js, paste prompt. Enable web browsing. May need to prompt "continue" for long reviews.

**Gemini:** Upload data.js, paste prompt. Good at finding recent news/publications.

**Perplexity:** Paste prompt first, then key test names (can't upload files). Best for finding new tests and recent news.

---

## QUICK VERSION (for follow-up or specific checks)

```
Review the attached data.js for OpenOnco. Search the web and find:
1. Any incorrect or outdated performance data
2. New publications (2024-2025) with updated metrics
3. Recent FDA/regulatory changes
4. Missing liquid biopsy tests that should be added
5. Broken or outdated citation URLs

Format as tables: CRITICAL | UPDATES | NEW INFO | MISSING TESTS
```
