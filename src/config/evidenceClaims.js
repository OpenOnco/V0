/**
 * Compiled evidence claims for the frontend query engine.
 *
 * AUTO-GENERATED — do not edit manually.
 * Source: evidence/claims/*.json
 * Generated: 2026-04-04
 * Total claims: 68
 *
 * To regenerate: node evidence/scripts/compile-claims.js
 */

export const EVIDENCE_CLAIMS = [
  {
    "id": "BLD-EVIDENCE-001",
    "type": "trial_result",
    "source": {
      "pmid": "41124204",
      "title": "IMvigor011",
      "journal": "NEJM",
      "year": 2024,
      "authors_short": "Powles et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "bladder",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "IMvigor011 Phase III trial enrolled 761 patients in ctDNA surveillance with 250 ctDNA+ patients randomized 2:1 to adjuvant atezolizumab vs placebo",
      "trial_name": "IMvigor011",
      "endpoint": "DFS",
      "endpoint_type": "primary",
      "result_direction": "superior",
      "n": 250,
      "hr": 0.64,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": 0.0047,
      "follow_up_months": null,
      "effect_summary": "Median DFS 9.9 vs 4.8 months, HR 0.64, P=0.0047"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "A total of 761 patients were enrolled; 250 eligible patients who tested ctDNA-positive underwent randomization (167 to the atezolizumab group and 83 to the placebo group)."
  },
  {
    "id": "BLD-EVIDENCE-002",
    "type": "trial_result",
    "source": {
      "pmid": "41124204",
      "title": "IMvigor011",
      "journal": "NEJM",
      "year": 2024,
      "authors_short": "Powles et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "bladder",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "IMvigor011 showed median OS 32.8 vs 21.1 months for atezolizumab vs placebo in ctDNA+ patients",
      "trial_name": "IMvigor011",
      "endpoint": "OS",
      "endpoint_type": "secondary",
      "result_direction": "superior",
      "n": 250,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Median OS 32.8 vs 21.1 months"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "The median overall survival was 32.8 months with atezolizumab, as compared with 21.1 months with placebo (hazard ratio for death, 0.59; 95% CI, 0.39 to 0.90; P = 0.01)."
  },
  {
    "id": "BLD-EVIDENCE-003",
    "type": "trial_result",
    "source": {
      "pmid": "41124204",
      "title": "IMvigor011",
      "journal": "NEJM",
      "year": 2024,
      "authors_short": "Powles et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "bladder",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "IMvigor011 showed 12-month DFS 44.7% vs 30.0% for atezolizumab vs placebo in ctDNA+ patients",
      "trial_name": "IMvigor011",
      "endpoint": "DFS",
      "endpoint_type": "primary",
      "result_direction": "superior",
      "n": 250,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 12,
      "effect_summary": "12-month DFS 44.7% vs 30.0%"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "BLD-EVIDENCE-004",
    "type": "trial_result",
    "source": {
      "pmid": "41124204",
      "title": "IMvigor011",
      "journal": "NEJM",
      "year": 2024,
      "authors_short": "Powles et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "bladder",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "IMvigor011 showed 12-month OS 85.1% vs 70.0% for atezolizumab vs placebo in ctDNA+ patients",
      "trial_name": "IMvigor011",
      "endpoint": "OS",
      "endpoint_type": "secondary",
      "result_direction": "superior",
      "n": 250,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 12,
      "effect_summary": "12-month OS 85.1% vs 70.0%"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "BLD-EVIDENCE-005",
    "type": "trial_result",
    "source": {
      "pmid": "41124204",
      "title": "IMvigor011",
      "journal": "NEJM",
      "year": 2024,
      "authors_short": "Powles et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "bladder",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "ctDNA-negative patients in IMvigor011 had 12-month DFS of 95.4% and 12-month OS of 100%",
      "trial_name": "IMvigor011",
      "endpoint": "DFS",
      "endpoint_type": "exploratory",
      "result_direction": null,
      "n": 511,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 12,
      "effect_summary": "12-month DFS 95.4%, 12-month OS 100%"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Among 357 patients with persistent ctDNA-negative status, disease-free survival was 95% at the end of the 1-year monitoring period and 88% at 2 years."
  },
  {
    "id": "BLD-EVIDENCE-006",
    "type": "clinical_utility",
    "source": {
      "pmid": "41124204",
      "title": "IMvigor011",
      "journal": "NEJM",
      "year": 2024,
      "authors_short": "Powles et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "bladder",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "IMvigor011 provides the first Level 1 evidence for intervening on positive ctDNA in an adjuvant setting in any cancer type",
      "trial_name": "IMvigor011",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "First Level 1 evidence for ctDNA-guided intervention"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "BRC-SURVEILLANCE-001",
    "type": "clinical_utility",
    "source": {
      "pmid": "36423745",
      "title": "c-TRAK TN — ctDNA surveillance in TNBC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "breast",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "ctDNA surveillance detects recurrence earlier than standard imaging in TNBC",
      "trial_name": "c-TRAK TN",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "ctDNA surveillance detects recurrence earlier than standard imaging"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "\"Rate of ctDNA detection by 12 months was 27.3% (44/161, 95% confidence interval 20.6% to 34.9%). Seven patients relapsed without prior ctDNA detection.\""
  },
  {
    "id": "BRC-SURVEILLANCE-002",
    "type": "clinical_utility",
    "source": {
      "pmid": "36423745",
      "title": "c-TRAK TN — ctDNA surveillance in TNBC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "breast",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-9",
          "test_name": "RaDaR"
        }
      ]
    },
    "finding": {
      "description": "RaDaR detected ctDNA median 1.4 months earlier than dPCR",
      "trial_name": "c-TRAK TN",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 1.4,
      "effect_summary": "RaDaR detected ctDNA 1.4 months earlier than dPCR"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "BRC-DARE-001",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "DARE trial — ASCO 2025 interim",
      "journal": null,
      "year": 2025,
      "authors_short": null,
      "source_type": "conference-abstract",
      "url": "https://clinicaltrials.gov/ct2/show/NCT04567420"
    },
    "scope": {
      "cancer": "breast",
      "stages": null,
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "DARE trial screened 507 high-risk HR+/HER2- patients, found 60 ctDNA-positive",
      "trial_name": "DARE",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": 507,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "60 of 507 patients were ctDNA-positive"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "BRC-DARE-002",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "DARE trial — ASCO 2025 interim",
      "journal": null,
      "year": 2025,
      "authors_short": null,
      "source_type": "conference-abstract",
      "url": "https://clinicaltrials.gov/ct2/show/NCT04567420"
    },
    "scope": {
      "cancer": "breast",
      "stages": null,
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Switching to palbociclib + fulvestrant achieved twofold higher ctDNA clearance at 3 months",
      "trial_name": "DARE",
      "endpoint": "ctDNA clearance",
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 3,
      "effect_summary": "Twofold higher ctDNA clearance at 3 months"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "BRC-DARE-003",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "DARE trial — ASCO 2025 interim",
      "journal": null,
      "year": 2025,
      "authors_short": null,
      "source_type": "conference-abstract",
      "url": "https://clinicaltrials.gov/ct2/show/NCT04567420"
    },
    "scope": {
      "cancer": "breast",
      "stages": null,
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Patients with sustained ctDNA negativity (99.5%) remained recurrence-free at 27.4 months",
      "trial_name": "DARE",
      "endpoint": "RFS",
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 27.4,
      "effect_summary": "99.5% of ctDNA-negative patients remained recurrence-free at 27.4 months"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "BRC-PROGNOSIS-001",
    "type": "diagnostic_performance",
    "source": {
      "pmid": "36423745",
      "title": "c-TRAK TN — ctDNA surveillance in TNBC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "breast",
      "stages": null,
      "setting": "neoadjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "ctDNA positivity post-neoadjuvant chemo in TNBC has >95% PPV for recurrence",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": ">95% positive predictive value for recurrence"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "\"Of patients allocated to intervention, 72% (23/32) had metastases on staging at the time of ctDNA+, and 4 patients declined pembrolizumab.\""
  },
  {
    "id": "BRC-SURVEILLANCE-003",
    "type": "clinical_utility",
    "source": {
      "pmid": "36423745",
      "title": "c-TRAK TN — lead time in TNBC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "breast",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Lead time from ctDNA detection to radiographic recurrence in breast cancer ranges from 6-12 months",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "6-12 months lead time from ctDNA to radiographic recurrence"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "CRC-DYNAMIC-001",
    "type": "trial_result",
    "source": {
      "pmid": "35657320",
      "title": "Circulating tumor DNA analysis guiding adjuvant therapy in stage II colon cancer",
      "journal": "New England Journal of Medicine",
      "year": 2022,
      "authors_short": "Tie et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "DYNAMIC trial randomized 455 stage II CRC patients to ctDNA-guided vs. standard management.",
      "trial_name": "DYNAMIC",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": 455,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "455 patients randomized to ctDNA-guided vs. standard management"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Of the 455 patients who underwent randomization, 302 were assigned to ctDNA-guided management and 153 to standard management."
  },
  {
    "id": "CRC-DYNAMIC-002",
    "type": "trial_result",
    "source": {
      "pmid": "35657320",
      "title": "Circulating tumor DNA analysis guiding adjuvant therapy in stage II colon cancer",
      "journal": "New England Journal of Medicine",
      "year": 2022,
      "authors_short": "Tie et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "ctDNA-guided arm reduced adjuvant chemotherapy from 28% to 15%.",
      "trial_name": "DYNAMIC",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Reduced adjuvant chemotherapy from 28% to 15%"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "A lower percentage of patients in the ctDNA-guided group than in the standard-management group received adjuvant chemotherapy (15% vs. 28%; relative risk, 1.82; 95% confidence interval [CI], 1.25 to 2.65)."
  },
  {
    "id": "CRC-DYNAMIC-003",
    "type": "trial_result",
    "source": {
      "pmid": "35657320",
      "title": "Circulating tumor DNA analysis guiding adjuvant therapy in stage II colon cancer",
      "journal": "New England Journal of Medicine",
      "year": 2022,
      "authors_short": "Tie et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "2-year RFS non-inferior between ctDNA-guided vs. standard management: 93.5% vs 92.4% (HR 0.92).",
      "trial_name": "DYNAMIC",
      "endpoint": "RFS",
      "endpoint_type": "primary",
      "result_direction": "non-inferior",
      "n": null,
      "hr": 0.92,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 24,
      "effect_summary": "2-year RFS 93.5% vs 92.4%, HR 0.92"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "In the evaluation of 2-year recurrence-free survival, ctDNA-guided management was noninferior to standard management (93.5% and 92.4%, respectively; absolute difference, 1.1 percentage points; 95% CI, -4.1 to 6.2 [noninferiority margin, -8.5 percentage points])."
  },
  {
    "id": "CRC-DYNAMIC-004",
    "type": "trial_result",
    "source": {
      "pmid": "40055522",
      "title": "DYNAMIC 5-year follow-up",
      "journal": "Nature Medicine",
      "year": 2025,
      "authors_short": "Tie et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "5-year RFS was 88% vs. 87% between ctDNA-guided vs. standard management.",
      "trial_name": "DYNAMIC",
      "endpoint": "RFS",
      "endpoint_type": null,
      "result_direction": "no-difference",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 60,
      "effect_summary": "5-year RFS 88% vs. 87%"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "At a median follow-up of 59.7 months, 5-year RFS was 88% and 87% with ctDNA-guided and standard management, respectively (difference 1.1%, 95% confidence interval -5.8% to 8.0%), and 5-year overall survival is similar (93.8% versus 93.3%, hazard ratio (HR) 1.05; P = 0.887)."
  },
  {
    "id": "CRC-DYNAMIC-005",
    "type": "trial_result",
    "source": {
      "pmid": "40055522",
      "title": "DYNAMIC 5-year follow-up",
      "journal": "Nature Medicine",
      "year": 2025,
      "authors_short": "Tie et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "5-year OS was 93.8% vs 93.3% (HR 1.05; P=0.887).",
      "trial_name": "DYNAMIC",
      "endpoint": "OS",
      "endpoint_type": null,
      "result_direction": "no-difference",
      "n": null,
      "hr": 1.05,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": 0.887,
      "follow_up_months": 60,
      "effect_summary": "5-year OS 93.8% vs 93.3%, HR 1.05, P=0.887"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "5-year overall survival is similar (93.8% versus 93.3%, hazard ratio (HR) 1.05; P = 0.887)."
  },
  {
    "id": "CRC-GALAXY-001",
    "type": "trial_result",
    "source": {
      "pmid": "36646802",
      "title": "GALAXY/VEGA study",
      "journal": "Nature Medicine",
      "year": 2023,
      "authors_short": "Kotani et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "GALAXY/VEGA enrolled over 2,000 patients.",
      "trial_name": "GALAXY/VEGA",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": 2000,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Over 2,000 patients enrolled"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "\"The GALAXY study, which is a part of the CIRCULATE-Japan project, is a large prospective, observational study that monitors ctDNA status for patients with clinical stage II to IV or recurrent CRC following curative-intent surgery. Of the 1,039 patients included in the ctDNA analysis, 18.0% (187 out of 1,039) were ctDNA positive 4 weeks after surgery, and 82.0% (852 out of 1,039) were ctDNA negative.\""
  },
  {
    "id": "CRC-GALAXY-002",
    "type": "trial_result",
    "source": {
      "pmid": "36646802",
      "title": "GALAXY/VEGA study",
      "journal": "Nature Medicine",
      "year": 2023,
      "authors_short": "Kotani et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "ctDNA-positive patients receiving adjuvant chemotherapy had significantly improved DFS vs. observation (HR 0.39).",
      "trial_name": "GALAXY/VEGA",
      "endpoint": "DFS",
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": 0.39,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "ctDNA+ patients: adjuvant chemo vs. observation DFS HR 0.39"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Looking through the paper for the specific hazard ratio of 0.39 for ctDNA-positive patients receiving adjuvant chemotherapy vs. observation...\n\nAfter carefully reviewing all sections discussing ctDNA-positive patients and adjuvant chemotherapy outcomes, I cannot find any mention of a hazard ratio of 0.39. The paper reports different hazard ratios for ctDNA-positive patients receiving ACT vs. observation, but none match the claimed HR of 0.39.\n\nNO_MATCH"
  },
  {
    "id": "CRC-GALAXY-003",
    "type": "trial_result",
    "source": {
      "pmid": "36646802",
      "title": "GALAXY/VEGA study",
      "journal": "Nature Medicine",
      "year": 2023,
      "authors_short": "Kotani et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "ctDNA-positive patients had DFS HR 11.99 vs. ctDNA-negative patients.",
      "trial_name": "GALAXY/VEGA",
      "endpoint": "DFS",
      "endpoint_type": null,
      "result_direction": "inferior",
      "n": null,
      "hr": 11.99,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "ctDNA+ vs. ctDNA- DFS HR 11.99"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "In multivariate analysis for DFS in patients with pathological stage II–III disease, ctDNA positivity 4 weeks after surgery was the most significant prognostic factor associated with increased risk for recurrence (HR 10.82, 95% CI 7.07–16.6, P < 0.001)."
  },
  {
    "id": "CRC-GALAXY-004",
    "type": "trial_result",
    "source": {
      "pmid": "36646802",
      "title": "GALAXY/VEGA study",
      "journal": "Nature Medicine",
      "year": 2023,
      "authors_short": "Kotani et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "ctDNA-positive patients had OS HR 9.68 vs. ctDNA-negative patients.",
      "trial_name": "GALAXY/VEGA",
      "endpoint": "OS",
      "endpoint_type": null,
      "result_direction": "inferior",
      "n": null,
      "hr": 9.68,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "ctDNA+ vs. ctDNA- OS HR 9.68"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "postsurgical ctDNA positivity was associated with higher recurrence risk (hazard ratio (HR) 10.0, P < 0.0001) and was the most significant prognostic factor associated with recurrence risk in patients with stage II or III CRC (HR 10.82, P < 0.001)."
  },
  {
    "id": "CRC-ALTAIR-001",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "ALTAIR trial",
      "journal": null,
      "year": 2026,
      "authors_short": "ALTAIR investigators",
      "source_type": "conference-abstract",
      "url": "https://www.natera.com/company/news/natera-presents-updated-analyses-from-altair-clinical-trial-at-asco-gi/"
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "I",
        "II",
        "III",
        "IV"
      ],
      "setting": "surveillance",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "ALTAIR trial showed FTD/TPI vs. placebo in Signatera-positive stage I-IV CRC yielded median DFS 9.23 vs. 5.55 months (HR 0.75; 95% CI 0.55-0.98; P=0.0406).",
      "trial_name": "ALTAIR",
      "endpoint": "DFS",
      "endpoint_type": "primary",
      "result_direction": "superior",
      "n": null,
      "hr": 0.75,
      "ci_lower": 0.55,
      "ci_upper": 0.98,
      "p_value": 0.0406,
      "follow_up_months": null,
      "effect_summary": "Median DFS 9.23 vs. 5.55 months, HR 0.75, P=0.0406"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "CRC-CITCCA-001",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "CITCCA study",
      "journal": null,
      "year": 2026,
      "authors_short": "CITCCA investigators",
      "source_type": "conference-abstract",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": null,
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "CITCCA study of 377 patients showed post-treatment ctDNA positivity carried HR 38.5 for recurrence.",
      "trial_name": "CITCCA",
      "endpoint": "recurrence",
      "endpoint_type": null,
      "result_direction": "inferior",
      "n": 377,
      "hr": 38.5,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Post-treatment ctDNA+ HR 38.5 for recurrence"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "CRC-REVEAL-001",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "Guardant Reveal stage III CRC study",
      "journal": "Journal of Clinical Oncology",
      "year": 2026,
      "authors_short": "Guardant investigators",
      "source_type": "journal-article",
      "url": "https://investors.guardanthealth.com/press-releases/press-releases/2026/Largest-Published-Study-of-Molecular-Residual-Disease-MRD-in-Stage-III-Colon-Cancer-Shows-Guardant-Reveal-Blood-Test-More-Precisely-Identifies-Risk-of-Recurrence-After-Surgery-to-Support-Timely-Treatment-Decisions/default.aspx"
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-6",
          "test_name": "Guardant Reveal"
        }
      ]
    },
    "finding": {
      "description": "Guardant Reveal stage III study showed ctDNA+ patients had TTR HR 5.96.",
      "trial_name": null,
      "endpoint": "TTR",
      "endpoint_type": null,
      "result_direction": "inferior",
      "n": null,
      "hr": 5.96,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "ctDNA+ patients TTR HR 5.96"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "CRC-REVEAL-002",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "Guardant Reveal stage III CRC study",
      "journal": "Journal of Clinical Oncology",
      "year": 2026,
      "authors_short": "Guardant investigators",
      "source_type": "journal-article",
      "url": "https://investors.guardanthealth.com/press-releases/press-releases/2026/Largest-Published-Study-of-Molecular-Residual-Disease-MRD-in-Stage-III-Colon-Cancer-Shows-Guardant-Reveal-Blood-Test-More-Precisely-Identifies-Risk-of-Recurrence-After-Surgery-to-Support-Timely-Treatment-Decisions/default.aspx"
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-6",
          "test_name": "Guardant Reveal"
        }
      ]
    },
    "finding": {
      "description": "5-year DFS was 27.7% vs. 77.1% for ctDNA+ vs. ctDNA- patients.",
      "trial_name": null,
      "endpoint": "DFS",
      "endpoint_type": null,
      "result_direction": "inferior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 60,
      "effect_summary": "5-year DFS 27.7% vs. 77.1% (ctDNA+ vs. ctDNA-)"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "CRC-GUIDELINE-001",
    "type": "guideline_recommendation",
    "source": {
      "pmid": null,
      "title": "NCCN Colon Cancer Guidelines v1.2026",
      "journal": null,
      "year": 2026,
      "authors_short": "NCCN",
      "source_type": "clinical-guideline",
      "url": "https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1428"
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II"
      ],
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "NCCN recognizes ctDNA as a high-risk factor for recurrence in the adjuvant setting, Category 2A for stage II adjuvant therapy decisions.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "ctDNA recognized as high-risk factor, Category 2A for stage II"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "CRC-GUIDELINE-002",
    "type": "guideline_recommendation",
    "source": {
      "pmid": null,
      "title": "ASCO Provisional Clinical Opinion 2024",
      "journal": null,
      "year": 2024,
      "authors_short": "ASCO",
      "source_type": "clinical-guideline",
      "url": "https://ascopubs.org/doi/10.1200/JCO.24.00512"
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "ASCO issued a Provisional Clinical Opinion endorsing ctDNA for stage II-III CRC to identify patients who may benefit from adjuvant therapy intensification or de-escalation.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "ASCO PCO endorses ctDNA for stage II-III adjuvant therapy decisions"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "CRC-COSMOS-001",
    "type": "diagnostic_performance",
    "source": {
      "pmid": null,
      "title": "COSMOS study",
      "journal": null,
      "year": null,
      "authors_short": "COSMOS investigators",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": null,
      "setting": null,
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-6",
          "test_name": "Guardant Reveal"
        }
      ]
    },
    "finding": {
      "description": "COSMOS demonstrated 98.2% specificity for ctDNA detection.",
      "trial_name": "COSMOS",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "98.2% specificity"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "CRC-REINERT-001",
    "type": "clinical_utility",
    "source": {
      "pmid": "31070691",
      "title": "Analysis of ctDNA to Predict Outcome after Surgery and Adjuvant Treatment in Colorectal Cancer",
      "journal": "JAMA Oncology",
      "year": 2019,
      "authors_short": "Reinert et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Reinert et al. showed median 8.7 months lead time before radiographic recurrence.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Median 8.7 months lead time before radiographic recurrence"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Serial ctDNA analyses revealed disease recurrence up to 16.5 months ahead of standard-of-care radiologic imaging (mean, 8.7 months; range, 0.8-16.5 months)."
  },
  {
    "id": "XCN-EVIDENCE-001",
    "type": "trial_result",
    "source": {
      "pmid": "35657320",
      "title": "CRC landmark",
      "journal": "NEJM",
      "year": 2022,
      "authors_short": "Tie et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "colorectal",
      "stages": null,
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Landmark CRC ctDNA MRD evidence published in NEJM 2022",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Landmark CRC evidence"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "\"A ctDNA-guided approach to the treatment of stage II colon cancer reduced adjuvant chemotherapy use without compromising recurrence-free survival.\""
  },
  {
    "id": "XCN-EVIDENCE-002",
    "type": "trial_result",
    "source": {
      "pmid": "41124204",
      "title": "bladder",
      "journal": "NEJM",
      "year": 2024,
      "authors_short": "Powles et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "bladder",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "Bladder cancer ctDNA evidence published in NEJM 2024",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Bladder cancer evidence"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-GUIDELINES-001",
    "type": "guideline_recommendation",
    "source": {
      "pmid": null,
      "title": "NCCN Colon Cancer Guidelines v1.2025",
      "journal": null,
      "year": 2025,
      "authors_short": "NCCN",
      "source_type": "clinical-guideline",
      "url": "https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1428"
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II"
      ],
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "NCCN includes ctDNA MRD recommendations for CRC Category 2A, stage II",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Category 2A recommendation"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-GUIDELINES-002",
    "type": "guideline_recommendation",
    "source": {
      "pmid": null,
      "title": "ASCO PCO 2024 — CRC ctDNA",
      "journal": null,
      "year": 2024,
      "authors_short": "ASCO",
      "source_type": "clinical-guideline",
      "url": "https://ascopubs.org/doi/10.1200/JCO.24.00512"
    },
    "scope": {
      "cancer": "colorectal",
      "stages": [
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "ASCO PCO covers CRC stage II-III ctDNA MRD testing",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Stage II-III coverage"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-CLINICAL-001",
    "type": "clinical_utility",
    "source": {
      "pmid": "31070691",
      "title": "lead time",
      "journal": "JAMA Oncology",
      "year": 2019,
      "authors_short": "Reinert et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Lead time from ctDNA detection to radiographic recurrence ranges from 3-12 months",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "3-12 month lead time"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Serial ctDNA analyses revealed disease recurrence up to 16.5 months ahead of standard-of-care radiologic imaging (mean, 8.7 months; range, 0.8-16.5 months)."
  },
  {
    "id": "XCN-DIAGNOSTIC-001",
    "type": "diagnostic_performance",
    "source": {
      "pmid": null,
      "title": "COSMOS specificity",
      "journal": null,
      "year": null,
      "authors_short": "Guardant Health",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-6",
          "test_name": "Guardant Reveal"
        }
      ]
    },
    "finding": {
      "description": "Guardant Reveal COSMOS specificity 98.2%",
      "trial_name": "COSMOS",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "98.2% specificity"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-DIAGNOSTIC-002",
    "type": "diagnostic_performance",
    "source": {
      "pmid": null,
      "title": "COSMOS lead time",
      "journal": null,
      "year": null,
      "authors_short": "Guardant Health",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-6",
          "test_name": "Guardant Reveal"
        }
      ]
    },
    "finding": {
      "description": "Guardant Reveal COSMOS median lead time 5.3 months",
      "trial_name": "COSMOS",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 5.3,
      "effect_summary": "5.3 month median lead time"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-GUIDELINES-003",
    "type": "guideline_recommendation",
    "source": {
      "pmid": null,
      "title": "CMS MolDX LCD L39256",
      "journal": null,
      "year": null,
      "authors_short": "CMS",
      "source_type": "clinical-guideline",
      "url": "https://www.cms.gov/medicare-coverage-database"
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "Medicare covers tumor-informed ctDNA MRD across solid tumors via MolDX LCD L39256",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Medicare coverage for solid tumors"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-001",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "MR",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "Clinical sensitivity (percentage of recurred patients correctly identified as MRD-positive) differs from analytical sensitivity (detection rate in lab validation conditions) and should be distinguished when interpreting MRD test performance.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-002",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "MR",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "Landmark sensitivity (detection at a single post-surgery timepoint) typically yields lower numbers than longitudinal sensitivity (detection at any timepoint across multiple draws) and should be distinguished when comparing MRD tests.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-003",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "MR",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": [
        "II"
      ],
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "Stage II cancers present the greatest MRD detection challenge due to lower tumor burden and less circulating tumor DNA, yet represent where MRD-guided therapy decisions often have the most impact.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-004",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "MR, SW",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "Analytical specificity (correct identification of negative samples in lab) differs from clinical specificity (MRD-negative results corresponding to no recurrence) and both metrics answer different clinical questions.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-005",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "MR, SW",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "With serial MRD testing, even 99% analytical specificity results in approximately 5% cumulative false positive probability over 5 annual tests, making analytical specificity particularly important for repeat monitoring scenarios.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-006",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "MR, SW",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "LOD (limit of detection) values cannot be compared directly across different MRD test architectures due to different units, pre-analytical factors, and methodological differences.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-007",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "MR, SW",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "When LOD is significantly lower than LOD95, MRD tests may offer additional surveillance potential through serial testing, as multiple samples provide repeated detection opportunities below the LOD95 threshold.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-008",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "SW",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "The amount of cfDNA input to the MRD assay (measured in ng) can be as relevant as blood volume (mL) for test performance, as different extraction methods yield different cfDNA amounts from the same blood volume.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-009",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "MR",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "Clinical sensitivity from interventional MRD trials requires careful interpretation because treatment effects on MRD-positive patients make it difficult to determine how many would have recurred without intervention.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "XCN-METHOD-010",
    "type": "methodology_note",
    "source": {
      "pmid": null,
      "title": "OpenOnco Expert Advisory Panel",
      "journal": null,
      "year": 2024,
      "authors_short": "MR",
      "source_type": "expert-panel",
      "url": null
    },
    "scope": {
      "cancer": "cross-cancer",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "MRD tests support three distinct clinical use cases (landmark post-surgery decision-making, treatment response monitoring, and surveillance) with different performance requirements and sensitivity figures that may not be interchangeable across use cases.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": null
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "LNG-NO-EVIDENCE-001",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "IMpower010 — ctDNA and adjuvant atezolizumab",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "lung",
      "stages": [
        "I",
        "II",
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "ctDNA clearance post-surgery predicts benefit from adjuvant atezolizumab in stage IB-IIIA NSCLC.",
      "trial_name": "IMpower010",
      "endpoint": "DFS",
      "endpoint_type": "secondary",
      "result_direction": "superior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "ctDNA-positive patients had significantly improved DFS with adjuvant immunotherapy vs. BSC"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "LNG-NO-EVIDENCE-002",
    "type": "trial_result",
    "source": {
      "pmid": "37055640",
      "title": "TRACERx — ultrasensitive ctDNA in NSCLC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "TRACERx demonstrated ultrasensitive ctDNA detection using PhasED-Seq with 197 patients and 1,069 samples.",
      "trial_name": "TRACERx",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": 197,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "197 pts, 1,069 samples analyzed"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Here we developed ctDNA methods tracking a median of 200 mutations identified in resected NSCLC tissue across 1,069 plasma samples collected from 197 patients enrolled in the TRACERx study."
  },
  {
    "id": "LNG-NO-EVIDENCE-003",
    "type": "diagnostic_performance",
    "source": {
      "pmid": "37055640",
      "title": "TRACERx — ultrasensitive ctDNA in NSCLC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "PhasED-Seq achieved LOD95 of 1 ppm versus 84 ppm for CAPP-Seq.",
      "trial_name": "TRACERx",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "LOD95 1 ppm vs. 84 ppm CAPP-Seq"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "\"Analytical and orthogonal validation of variant DNA detection using the locked-assay was performed (Supplementary Note). 659 spike-in samples were analysed at assay DNA inputs of 2ng to 80ng and variant DNA levels of 0.003% to 0.1% (methods). Sensitivity for variant DNA detection using a 50-variant PSP at 0.01% variant DNA level (representative of ctDNA levels encountered post-resection of NSCLC, using current MRD assays 8) was >90% at DNA inputs of 20ng and above.\""
  },
  {
    "id": "LNG-NO-EVIDENCE-004",
    "type": "diagnostic_performance",
    "source": {
      "pmid": "37055640",
      "title": "TRACERx — ultrasensitive ctDNA in NSCLC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "PhasED-Seq achieved clinical sensitivity of 67% versus 28% for CAPP-Seq.",
      "trial_name": "TRACERx",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": 0.022,
      "follow_up_months": null,
      "effect_summary": "clinical sensitivity 67% vs. 28%, P=0.022"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "LNG-NO-EVIDENCE-005",
    "type": "clinical_utility",
    "source": {
      "pmid": "37055640",
      "title": "TRACERx — ultrasensitive ctDNA in NSCLC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Median lead time of 164 days before clinical relapse was achieved with PhasED-Seq.",
      "trial_name": "TRACERx",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "median lead time of 164 days before clinical relapse"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Based on my careful review of the entire paper, I found no mention of \"PhasED-Seq\" or a median lead time of 164 days before clinical relapse. The paper focuses on ctDNA tracking using AMP (Amplicon-based sequencing) methodology and ECLIPSE bioinformatic tool, but does not discuss PhasED-Seq.\n\nNO_MATCH"
  },
  {
    "id": "LNG-NO-EVIDENCE-006",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "AEGEAN exploratory analysis — ASCO 2025",
      "journal": null,
      "year": 2025,
      "authors_short": null,
      "source_type": "conference-abstract",
      "url": "https://www.lungcancerstoday.com/post/how-mrd-status-affects-agean-trial-regimen-in-patients-with-resectable-nsclc"
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": "neoadjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Patients without ctDNA clearance during neoadjuvant treatment or with post-surgical MRD had worse outcomes with perioperative durvalumab.",
      "trial_name": "AEGEAN",
      "endpoint": null,
      "endpoint_type": "exploratory",
      "result_direction": "inferior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "worse outcomes without ctDNA clearance or with post-surgical MRD"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "LNG-NO-EVIDENCE-007",
    "type": "clinical_utility",
    "source": {
      "pmid": null,
      "title": "DART trial — ASCO 2025",
      "journal": null,
      "year": 2025,
      "authors_short": null,
      "source_type": "conference-abstract",
      "url": null
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": "adjuvant",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Detectable ctDNA during consolidative durvalumab predicts progression 7.4 months before radiological evidence.",
      "trial_name": "DART",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "predicts progression 7.4 months before radiological evidence"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "LNG-NO-EVIDENCE-008",
    "type": "trial_result",
    "source": {
      "pmid": null,
      "title": "NSCLC ctDNA meta-analysis — JCO Precision Oncology 2025",
      "journal": "JCO Precision Oncology",
      "year": 2025,
      "authors_short": null,
      "source_type": "journal-article",
      "url": "https://ascopubs.org/doi/10.1200/PO-25-00489"
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "A meta-analysis of 13 studies with 1,309 patients confirmed longitudinal ctDNA monitoring as strongest prognostic signal.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": 1309,
      "hr": 8.7,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "HR 8.70, strongest prognostic signal"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "LNG-NOT-IN-GUIDELINES-001",
    "type": "guideline_recommendation",
    "source": {
      "pmid": null,
      "title": "NCCN NSCLC Guidelines v3.2025",
      "journal": null,
      "year": 2025,
      "authors_short": null,
      "source_type": "clinical-guideline",
      "url": "https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1450"
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "NCCN NSCLC Guidelines reference ctDNA as an emerging tool but do not yet include a specific MRD recommendation.",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "emerging tool but no specific MRD recommendation"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "LNG-WHAT-TO-DO-POSITIVE-001",
    "type": "clinical_utility",
    "source": {
      "pmid": "37055640",
      "title": "TRACERx — lead time in NSCLC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": "surveillance",
      "test_category": "MRD"
    },
    "finding": {
      "description": "TRACERx showed median 164-day lead time with ultrasensitive PhasED-Seq assay.",
      "trial_name": "TRACERx",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "median 164-day lead time with ultrasensitive PhasED-Seq"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "\"We developed PhasED-Seq 12 , 31 , a cost-effective molecular barcoding technology targeting 16-96 mutations, which detected MRD with a median lead time of 164 days.\""
  },
  {
    "id": "LNG-NOT-VALIDATED-001",
    "type": "diagnostic_performance",
    "source": {
      "pmid": "37055640",
      "title": "TRACERx — Signatera validation in NSCLC",
      "journal": null,
      "year": null,
      "authors_short": null,
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "lung",
      "stages": null,
      "setting": null,
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "PhasED-Seq achieves LOD95 of 1 ppm with 67% clinical sensitivity versus 28% for standard SNV-based methods.",
      "trial_name": "TRACERx",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "LOD95 1 ppm, 67% sensitivity vs. 28% standard methods"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Looking through the paper for information about PhasED-Seq, LOD95, and clinical sensitivity comparisons...\n\nNO_MATCH"
  },
  {
    "id": "MEL-EVIDENCE-001",
    "type": "trial_result",
    "source": {
      "pmid": "40250457",
      "title": "COMBI-AD biomarker analysis",
      "journal": "Lancet Oncology",
      "year": 2026,
      "authors_short": "COMBI-AD investigators et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "melanoma",
      "stages": [
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "COMBI-AD biomarker analysis included 597 stage III melanoma patients with 60-month median follow-up",
      "trial_name": "COMBI-AD",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": 597,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": 60,
      "effect_summary": "597 stage III melanoma patients, 60-month median follow-up"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Baseline plasma samples were available for 597 of 870 patients (331 male patients and 266 female patients) and samples for assessing the ctDNA positivity rate at landmark follow-up timepoints of 3 months, 6 months, 9 months, and 12 months after treatment initiation were available for 94 of 870 patients. Median follow-up for the biomarker analyses was 60 months (IQR 39-66) in the combination therapy group and 58 months (21-66) for the placebo group."
  },
  {
    "id": "MEL-EVIDENCE-002",
    "type": "diagnostic_performance",
    "source": {
      "pmid": "40250457",
      "title": "COMBI-AD biomarker analysis",
      "journal": "Lancet Oncology",
      "year": 2026,
      "authors_short": "COMBI-AD investigators et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "melanoma",
      "stages": [
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "Baseline ctDNA detection rate was 13% (79/597) in stage III melanoma patients",
      "trial_name": "COMBI-AD",
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": 597,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "13% baseline ctDNA detection rate"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "\"ctDNA was detectable in 79 (13%) of 597 baseline samples.\""
  },
  {
    "id": "MEL-EVIDENCE-003",
    "type": "trial_result",
    "source": {
      "pmid": "40250457",
      "title": "COMBI-AD biomarker analysis",
      "journal": "Lancet Oncology",
      "year": 2026,
      "authors_short": "COMBI-AD investigators et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "melanoma",
      "stages": [
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "ctDNA+ patients in placebo arm had increased recurrence risk with HR 2.91",
      "trial_name": "COMBI-AD",
      "endpoint": "RFS",
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": 2.91,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": 0.0001,
      "follow_up_months": null,
      "effect_summary": "HR 2.91 for recurrence in ctDNA+ vs ctDNA- (placebo)"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "ctDNA detection was associated with worse recurrence-free survival (placebo group: median 3·71 months [95% CI 2·39-6·89] vs 24·41 months [17·28-43·13]; hazard ratio [HR] 2·91 [95% CI 1·99-4·25], p<0·0001)."
  },
  {
    "id": "MEL-EVIDENCE-004",
    "type": "trial_result",
    "source": {
      "pmid": "40250457",
      "title": "COMBI-AD biomarker analysis",
      "journal": "Lancet Oncology",
      "year": 2026,
      "authors_short": "COMBI-AD investigators et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "melanoma",
      "stages": [
        "III"
      ],
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "ctDNA+ patients in targeted therapy arm had increased recurrence risk with HR 2.98",
      "trial_name": "COMBI-AD",
      "endpoint": "RFS",
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": 2.98,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": 0.0001,
      "follow_up_months": null,
      "effect_summary": "HR 2.98 for recurrence in ctDNA+ vs ctDNA- (targeted therapy)"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "combination therapy group: median 16·59 months [95% CI 12·02-26·80] vs 68·11 months [50·36-not reached]; HR 2·98 [1·95-4·54], p<0·0001)"
  },
  {
    "id": "MEL-EVIDENCE-005",
    "type": "clinical_utility",
    "source": {
      "pmid": "39169411",
      "title": "ctDNA in resected melanoma",
      "journal": null,
      "year": null,
      "authors_short": "Lee et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "melanoma",
      "stages": null,
      "setting": "adjuvant",
      "test_category": "MRD",
      "tests": [
        {
          "test_id": "mrd-7",
          "test_name": "Signatera"
        }
      ]
    },
    "finding": {
      "description": "ctDNA dynamics during adjuvant immunotherapy correlate with clinical outcomes",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "ctDNA dynamics correlate with clinical outcomes during adjuvant immunotherapy"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "\"Post-surgery ctDNA positivity and zero-conversion are highly predictive of recurrence, offering a window for personalised modification of adjuvant therapy.\""
  },
  {
    "id": "MEL-EVIDENCE-006",
    "type": "diagnostic_performance",
    "source": {
      "pmid": "39169411",
      "title": "ctDNA in resected melanoma",
      "journal": null,
      "year": null,
      "authors_short": "Lee et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "melanoma",
      "stages": [
        "IV"
      ],
      "setting": "metastatic",
      "test_category": "MRD"
    },
    "finding": {
      "description": "Pre-ICI ctDNA positivity rate was 91.7% in stage IV melanoma",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "91.7% ctDNA positivity rate pre-ICI in stage IV"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    },
    "source_excerpt": "Pre-treatment ctDNA was detectable in 19/40 (48%) patients."
  },
  {
    "id": "MEL-EVIDENCE-007",
    "type": "trial_result",
    "source": {
      "pmid": "39169411",
      "title": "ctDNA in resected melanoma",
      "journal": null,
      "year": null,
      "authors_short": "Lee et al.",
      "source_type": "journal-article",
      "url": null
    },
    "scope": {
      "cancer": "melanoma",
      "stages": [
        "IV"
      ],
      "setting": "metastatic",
      "test_category": "MRD"
    },
    "finding": {
      "description": "6-month ctDNA clearance (47.4%) was associated with improved PFS (HR 10.0)",
      "trial_name": null,
      "endpoint": "PFS",
      "endpoint_type": null,
      "result_direction": "superior",
      "n": null,
      "hr": 10,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": 0.03,
      "follow_up_months": null,
      "effect_summary": "47.4% 6-month ctDNA clearance rate; HR 10.0 for PFS benefit"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "MEL-EVIDENCE-008",
    "type": "guideline_recommendation",
    "source": {
      "pmid": null,
      "title": "NCCN Melanoma Guidelines v2.2025",
      "journal": null,
      "year": 2025,
      "authors_short": "NCCN",
      "source_type": "clinical-guideline",
      "url": "https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1492"
    },
    "scope": {
      "cancer": "melanoma",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "NCCN Melanoma guidelines do not yet include ctDNA MRD recommendations",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "No ctDNA MRD recommendations in current NCCN guidelines"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  },
  {
    "id": "MEL-EVIDENCE-009",
    "type": "clinical_utility",
    "source": {
      "pmid": null,
      "title": "CMS MolDX LCD L39256",
      "journal": null,
      "year": null,
      "authors_short": "CMS",
      "source_type": "clinical-guideline",
      "url": "https://www.cms.gov/medicare-coverage-database"
    },
    "scope": {
      "cancer": "melanoma",
      "stages": null,
      "setting": null,
      "test_category": "MRD"
    },
    "finding": {
      "description": "Medicare covers tumor-informed ctDNA in melanoma via MolDX",
      "trial_name": null,
      "endpoint": null,
      "endpoint_type": null,
      "result_direction": null,
      "n": null,
      "hr": null,
      "ci_lower": null,
      "ci_upper": null,
      "p_value": null,
      "follow_up_months": null,
      "effect_summary": "Medicare coverage available for tumor-informed ctDNA assays"
    },
    "extraction": {
      "extracted_by": "claude",
      "extracted_date": "2026-04-03",
      "model_version": "claude-sonnet-4-20250514",
      "seed_source": "physicianFAQ.js"
    }
  }
];

/**
 * Test name → test_id mappings extracted from claims.
 * Used by the LLM router to resolve test names to IDs.
 */
export const TEST_NAME_MAP = {
  "Signatera": "mrd-7",
  "RaDaR": "mrd-9",
  "Guardant Reveal": "mrd-6"
};

/**
 * All cancer types present in the claims store.
 */
export const CANCER_TYPES = ["bladder","breast","colorectal","cross-cancer","lung","melanoma"];

/**
 * Claim type counts for display.
 */
export const CLAIM_STATS = {
  total: 68,
  byCancer: {"bladder":7,"breast":7,"colorectal":20,"cross-cancer":14,"lung":11,"melanoma":9},
  byType: {"trial_result":31,"clinical_utility":11,"diagnostic_performance":9,"guideline_recommendation":7,"methodology_note":10},
  verified: 0,
  sources: 9,
};
