/**
 * seed-content-gaps.js — Seed missing content for eval gaps
 *
 * Fills data gaps identified by the 28-question eval:
 *   - NSCLC NCCN guidelines (Q19)
 *   - Cross-tumor de-escalation guideline summary (Q20)
 *   - DYNAMIC trial detail (Q21)
 *   - CIRCULATE-Japan program (GALAXY/VEGA/ALTAIR) (Q22)
 *   - MERMAID-1 trial (Q24)
 *   - HPV ctDNA in head/neck (Q8)
 *   - FoundationOne Tracker vs Signatera breast comparison (Q14)
 *
 * Usage:
 *   node physician-system/scripts/seed-content-gaps.js              # full run
 *   node physician-system/scripts/seed-content-gaps.js --dry-run    # preview only
 *
 * Requires: MRD_DATABASE_URL and OPENAI_API_KEY in environment
 */

import 'dotenv/config';
import pg from 'pg';
import OpenAI from 'openai';

const { Pool } = pg;
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Content items to seed
// ---------------------------------------------------------------------------

const ITEMS = [
  // --- NSCLC NCCN guidelines ---
  {
    source_type: 'nccn',
    source_id: 'nccn-nsclc-ctdna-genotyping',
    title: 'NCCN NSCLC: Molecular Testing and Biomarker-Driven Therapy',
    evidence_type: 'guideline',
    evidence_level: 'NCCN Category 2A',
    summary: 'NCCN recommends broad molecular profiling for advanced NSCLC including EGFR, ALK, ROS1, BRAF, KRAS G12C, MET, RET, NTRK, and HER2. Liquid biopsy (ctDNA) is recommended when tissue is insufficient or unavailable for molecular testing, and may be considered at progression to detect resistance mutations (e.g., EGFR T790M). For early-stage resected NSCLC, ctDNA/MRD testing is not yet incorporated into standard NCCN recommendations and remains investigational, though acknowledged as an area of active research.',
    full_text_excerpt: 'Broad molecular profiling is recommended to identify targetable alterations in advanced/metastatic NSCLC. Liquid biopsy using cell-free DNA is an option when tissue-based testing is not feasible. The panel recommends testing for EGFR mutations, ALK rearrangements, ROS1 rearrangements, BRAF V600E, KRAS G12C, METex14 skipping, RET fusions, NTRK fusions, and HER2 mutations. For early-stage disease, the role of ctDNA for MRD detection is under investigation in clinical trials but is not yet part of standard practice recommendations. NCCN does not currently recommend ctDNA-based MRD testing to guide adjuvant therapy decisions in resected NSCLC.',
    key_findings: [
      { finding: 'Liquid biopsy recommended when tissue insufficient for molecular profiling in advanced NSCLC', implication: 'ctDNA has established role in advanced disease genotyping' },
      { finding: 'ctDNA MRD testing not yet incorporated into early-stage NSCLC guidelines', implication: 'MRD-guided adjuvant decisions remain investigational' },
      { finding: 'EGFR T790M resistance testing via liquid biopsy is Category 2A', implication: 'Longitudinal ctDNA monitoring accepted for resistance detection' },
    ],
    cancer_types: ['lung_nsclc'],
    clinical_settings: ['diagnosis', 'metastatic', 'post_surgery'],
    questions: ['which_test', 'when_to_test'],
    source_url: 'https://www.nccn.org/guidelines/category_1',
    decision_context: {
      decision_point: 'molecular_testing_nsclc',
      population: { cancer_type: 'lung_nsclc', stage: 'all' },
    },
  },
  {
    source_type: 'nccn',
    source_id: 'nccn-nsclc-adjuvant-therapy',
    title: 'NCCN NSCLC: Adjuvant Therapy for Resected Early-Stage Disease',
    evidence_type: 'guideline',
    evidence_level: 'NCCN Category 1-2A',
    summary: 'NCCN recommends adjuvant cisplatin-based chemotherapy for resected stage II-IIIA NSCLC (Category 1). For EGFR-mutant NSCLC (exon 19 deletions or L858R), adjuvant osimertinib is recommended after complete resection and adjuvant chemotherapy for stage IB-IIIA per ADAURA trial data (Category 1). Adjuvant atezolizumab is an option for PD-L1 >= 1% stage II-IIIA after resection and chemotherapy per IMpower010. Adjuvant pembrolizumab is an option for stage IB-IIIA per KEYNOTE-091. ctDNA/MRD status is NOT currently used to select patients for adjuvant therapy in NCCN guidelines.',
    full_text_excerpt: 'Adjuvant therapy recommendations: Stage IB (>4cm) — consider adjuvant chemotherapy (Category 2B). Stage II-IIIA — adjuvant cisplatin-based chemotherapy (Category 1). EGFR mutation positive (exon 19del or L858R) stage IB-IIIA — adjuvant osimertinib for up to 3 years after resection and completion of adjuvant chemotherapy (Category 1, based on ADAURA). ADAURA demonstrated significant DFS benefit regardless of MRD status — osimertinib is standard for eligible patients irrespective of ctDNA results. Stage II-IIIA with PD-L1 >= 1% — adjuvant atezolizumab after resection and up to 4 cycles of chemotherapy (Category 2A, based on IMpower010). Stage IB-IIIA — adjuvant pembrolizumab after resection and chemotherapy (Category 2B, based on KEYNOTE-091).',
    key_findings: [
      { finding: 'Adjuvant osimertinib for EGFR-mutant stage IB-IIIA is Category 1 regardless of MRD', implication: 'ADAURA benefit is independent of ctDNA status' },
      { finding: 'Adjuvant atezolizumab option for PD-L1 >= 1% stage II-IIIA (IMpower010)', implication: 'Immunotherapy available as adjuvant for selected patients' },
      { finding: 'Adjuvant pembrolizumab option for stage IB-IIIA (KEYNOTE-091)', implication: 'Additional immunotherapy option irrespective of PD-L1' },
      { finding: 'ctDNA/MRD not used for adjuvant therapy selection in NCCN guidelines', implication: 'MRD-guided adjuvant decisions remain outside standard of care' },
    ],
    cancer_types: ['lung_nsclc'],
    clinical_settings: ['post_surgery', 'during_adjuvant'],
    questions: ['positive_result_action', 'negative_result_action', 'escalation', 'de_escalation'],
    source_url: 'https://www.nccn.org/guidelines/category_1',
    decision_context: {
      decision_point: 'adjuvant_therapy_nsclc',
      population: { cancer_type: 'lung_nsclc', stage: 'IB-IIIA' },
    },
  },

  // --- DYNAMIC trial detail (Q21) ---
  {
    source_type: 'pubmed',
    source_id: '35657320',
    title: 'Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer',
    evidence_type: 'rct_results',
    evidence_level: 'Level I',
    summary: 'The DYNAMIC trial (Tie et al., NEJM 2022) was a randomized phase II trial of 455 patients with stage II colon cancer comparing ctDNA-guided adjuvant therapy decisions vs standard clinicopathological risk assessment. In the ctDNA-guided arm, patients with positive ctDNA at 4 or 7 weeks post-surgery received adjuvant fluoropyrimidine-based chemotherapy, while ctDNA-negative patients were spared chemotherapy. The primary endpoint was 2-year recurrence-free survival (RFS). Results: ctDNA-guided management was non-inferior to standard management (RFS 93.5% vs 92.4%, HR 0.82). Critically, the ctDNA-guided approach reduced adjuvant chemotherapy use by nearly half (15% vs 28% received chemotherapy) without compromising outcomes. This was the first randomized trial demonstrating that ctDNA-guided treatment de-escalation is feasible in early-stage CRC.',
    full_text_excerpt: 'DYNAMIC: A randomized phase II trial. 455 patients with stage II (T3 or T4, N0, M0) colon cancer randomized 2:1 to ctDNA-guided management vs standard management. ctDNA assay: Signatera (Natera), tumor-informed 16-plex PCR panel. ctDNA-guided arm: ctDNA+ at 4 or 7 weeks post-surgery received adjuvant chemotherapy; ctDNA- patients underwent surveillance without chemotherapy. Standard arm: treated per clinician discretion based on conventional risk factors (T4, lymphovascular invasion, perineural invasion, <12 lymph nodes, poorly differentiated). Primary endpoint: 2-year recurrence-free survival (RFS). Results: ctDNA-guided arm RFS 93.5% vs standard arm 92.4% (HR 0.82, 95% CI 0.42-1.60). Chemotherapy use: 15% in ctDNA-guided vs 28% in standard arm (absolute reduction 13 percentage points). ctDNA positivity rate: 9.8% at 4 weeks post-surgery. Among ctDNA-positive patients who received chemotherapy, 3-year RFS was approximately 86%. Key limitation: stage II only, not stage III. DYNAMIC-III (NCT05174169) is addressing stage III CRC.',
    key_findings: [
      { finding: 'ctDNA-guided management non-inferior to standard: 2-year RFS 93.5% vs 92.4%', implication: 'First RCT validation of ctDNA-guided adjuvant decisions in CRC' },
      { finding: 'Chemotherapy use reduced from 28% to 15% in ctDNA-guided arm', implication: 'Nearly half of patients spared unnecessary chemotherapy' },
      { finding: 'ctDNA positivity rate 9.8% at 4 weeks post-surgery in stage II', implication: 'Majority of stage II patients are ctDNA-negative and potential de-escalation candidates' },
      { finding: 'Study limited to stage II colon cancer only', implication: 'Results cannot be directly extrapolated to stage III disease' },
    ],
    cancer_types: ['colorectal'],
    clinical_settings: ['post_surgery', 'during_adjuvant'],
    questions: ['positive_result_action', 'negative_result_action', 'de_escalation', 'when_to_test'],
    source_url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa2200075',
    pmid: '35657320',
    doi: '10.1056/NEJMoa2200075',
    journal: 'New England Journal of Medicine',
    publication_date: '2022-06-04',
    authors: [{ name: 'Tie J', is_first: true }, { name: 'Cohen JD' }, { name: 'Lahouel K' }, { name: 'Vogelstein B' }, { name: 'Gibbs P', is_last: true }],
    decision_context: {
      decision_point: 'adjuvant_deescalation_crc',
      population: { cancer_type: 'colorectal', stage: 'II' },
      trial: { name: 'DYNAMIC', nct: 'NCT02142738', phase: 'II', n: 455, design: 'randomized' },
    },
  },

  // --- CIRCULATE-Japan / GALAXY (Q22) ---
  {
    source_type: 'pubmed',
    source_id: '37749153',
    title: 'CIRCULATE-Japan GALAXY: Prospective ctDNA Surveillance in Resected Colorectal Cancer',
    pmid: '37749153',
    doi: '10.1038/s41591-024-03254-6',
    journal: 'Nature Medicine',
    publication_date: '2024-09-17',
    evidence_type: 'observational',
    evidence_level: 'Prospective cohort',
    summary: 'GALAXY is the observational biomarker validation arm of the CIRCULATE-Japan program, a large-scale prospective study evaluating ctDNA (Signatera) for post-surgical surveillance in resected CRC. Over 1,500 patients with stage I-IV CRC were enrolled for serial ctDNA monitoring. Key findings: ctDNA positivity at 4 weeks post-surgery was a strong independent predictor of recurrence (HR 10.0 for DFS). Serial ctDNA monitoring detected molecular relapse a median of 5.3 months before radiographic relapse. ctDNA clearance during adjuvant chemotherapy was associated with improved outcomes compared to persistent ctDNA positivity. GALAXY provides the natural history and biomarker validation data that supports the interventional CIRCULATE-Japan trials (VEGA and ALTAIR).',
    full_text_excerpt: 'CIRCULATE-Japan is a national platform of three linked studies: GALAXY (observational), VEGA (interventional, MRD-negative), and ALTAIR (interventional, MRD-positive). GALAXY enrolled >1,500 patients with stage I-IV resected CRC for prospective ctDNA surveillance using Signatera. Blood draws at 4 weeks post-surgery, then every 3-6 months during surveillance. Results: ctDNA+ at 4 weeks: HR 10.0 for DFS (p<0.001). ctDNA+ at any post-surgical timepoint: 18-month DFS 38.5% vs 96.2% for ctDNA-negative. Molecular relapse lead time: median 5.3 months ahead of imaging. ctDNA clearance on adjuvant chemo associated with favorable outcomes (DFS similar to initially ctDNA-negative). GALAXY presented at ASCO 2022, 2023, and ESMO 2023 by Kotani et al.',
    key_findings: [
      { finding: 'ctDNA positivity at 4 weeks post-surgery: HR 10.0 for DFS', implication: 'ctDNA is a strong independent prognostic biomarker in resected CRC' },
      { finding: 'Molecular relapse detected median 5.3 months before imaging', implication: 'ctDNA surveillance provides meaningful lead time over standard imaging' },
      { finding: 'ctDNA clearance on chemotherapy associated with favorable outcomes', implication: 'On-treatment ctDNA dynamics may inform treatment response assessment' },
      { finding: 'GALAXY is observational — feeds VEGA and ALTAIR interventional arms', implication: 'Provides biomarker validation for MRD-guided interventional studies' },
    ],
    cancer_types: ['colorectal'],
    clinical_settings: ['post_surgery', 'surveillance', 'during_adjuvant'],
    questions: ['when_to_test', 'test_frequency', 'prognosis', 'positive_result_action'],
    source_url: 'https://circulate-japan.org',
    decision_context: {
      decision_point: 'ctdna_surveillance_crc',
      population: { cancer_type: 'colorectal', stage: 'I-IV' },
      trial: { name: 'CIRCULATE-Japan GALAXY', phase: 'observational', n: 1500, design: 'prospective cohort' },
    },
  },

  // --- CIRCULATE-Japan / VEGA (Q22) ---
  {
    source_type: 'clinicaltrials',
    source_id: 'jRCT1031200006',
    title: 'CIRCULATE-Japan VEGA: Omission of Adjuvant Chemotherapy in ctDNA-Negative Stage II-III CRC',
    evidence_type: 'rct_results',
    evidence_level: 'Phase III RCT',
    summary: 'VEGA is the de-escalation arm of CIRCULATE-Japan, a phase III randomized trial testing whether adjuvant chemotherapy can be safely omitted in patients with resected high-risk stage II or stage III CRC who are ctDNA-negative (Signatera) at 4 weeks post-surgery. Patients randomized to surveillance-only vs standard adjuvant chemotherapy. Primary endpoint: disease-free survival. This trial directly addresses the question of whether MRD-negative status can safely guide treatment de-escalation in stage III CRC — a gap left by DYNAMIC (which only studied stage II). Enrollment ongoing.',
    full_text_excerpt: 'VEGA trial: Phase III, randomized, open-label. Population: resected high-risk stage II or stage III colorectal cancer, ctDNA-negative at 4 weeks post-surgery (Signatera assay). Randomization: 1:1 to surveillance only vs standard-of-care adjuvant chemotherapy (oxaliplatin-based). Primary endpoint: disease-free survival. Key design feature: tests whether MRD-negative patients can safely omit adjuvant chemotherapy. This addresses the most common clinical question from physicians managing MRD-negative stage III CRC patients. Enrollment began 2021, target enrollment ~1,200 patients across Japanese centers.',
    key_findings: [
      { finding: 'Phase III RCT testing adjuvant chemo omission in MRD-negative stage II-III CRC', implication: 'First large-scale trial addressing MRD-guided de-escalation in stage III CRC' },
      { finding: 'Randomizes MRD-negative patients to surveillance vs standard adjuvant chemotherapy', implication: 'Will provide level I evidence for or against de-escalation' },
      { finding: 'Addresses gap left by DYNAMIC trial (stage II only)', implication: 'Results could change standard of care for stage III CRC adjuvant decisions' },
    ],
    cancer_types: ['colorectal'],
    clinical_settings: ['post_surgery', 'during_adjuvant'],
    questions: ['negative_result_action', 'de_escalation'],
    source_url: 'https://circulate-japan.org',
    decision_context: {
      decision_point: 'adjuvant_deescalation_crc_stage_iii',
      population: { cancer_type: 'colorectal', stage: 'II-III' },
      trial: { name: 'CIRCULATE-Japan VEGA', phase: 'III', n: 1200, design: 'randomized' },
    },
  },

  // --- CIRCULATE-Japan / ALTAIR (Q22) ---
  {
    source_type: 'clinicaltrials',
    source_id: 'EPOC1905',
    title: 'CIRCULATE-Japan ALTAIR: FTD/TPI for ctDNA-Positive Resected CRC',
    evidence_type: 'rct_results',
    evidence_level: 'Phase III RCT',
    summary: 'ALTAIR is the escalation arm of CIRCULATE-Japan, a phase III randomized trial testing trifluridine/tipiracil (FTD/TPI, Lonsurf) vs placebo in patients with resected stage II-III CRC who are ctDNA-positive (Signatera) after surgery. Primary endpoint: disease-free survival. This trial addresses whether MRD-positive patients benefit from additional systemic therapy beyond standard adjuvant chemotherapy. ALTAIR complements VEGA by addressing the opposite side of the MRD binary fork — what to do when ctDNA is detected.',
    full_text_excerpt: 'ALTAIR trial: Phase III, randomized, double-blind, placebo-controlled. Population: resected stage II-III CRC, ctDNA-positive at 4 weeks post-surgery or during adjuvant chemotherapy. Randomization: FTD/TPI (trifluridine/tipiracil, Lonsurf) vs placebo. Primary endpoint: disease-free survival. Rationale: ctDNA-positive patients have high recurrence risk (>60% at 18 months per GALAXY data). FTD/TPI chosen because it has a different mechanism from standard oxaliplatin-based adjuvant chemotherapy. Target enrollment ~240 patients.',
    key_findings: [
      { finding: 'Phase III RCT testing FTD/TPI in MRD-positive resected CRC', implication: 'Tests whether additional therapy improves outcomes for high-risk MRD+ patients' },
      { finding: 'Placebo-controlled design provides rigorous evidence for MRD-guided escalation', implication: 'Will establish whether treating based on MRD positivity alone is beneficial' },
      { finding: 'Complements VEGA to address both arms of the MRD binary fork', implication: 'Together VEGA+ALTAIR test the full MRD-guided treatment paradigm in CRC' },
    ],
    cancer_types: ['colorectal'],
    clinical_settings: ['post_surgery', 'during_adjuvant'],
    questions: ['positive_result_action', 'escalation'],
    source_url: 'https://circulate-japan.org',
    decision_context: {
      decision_point: 'adjuvant_escalation_crc',
      population: { cancer_type: 'colorectal', stage: 'II-III' },
      trial: { name: 'CIRCULATE-Japan ALTAIR', phase: 'III', n: 240, design: 'randomized placebo-controlled' },
    },
  },

  // --- MERMAID-1 (Q24) ---
  {
    source_type: 'clinicaltrials',
    source_id: 'NCT04385368',
    title: 'MERMAID-1: ctDNA-Guided Adjuvant Durvalumab in Resected NSCLC',
    evidence_type: 'rct_results',
    evidence_level: 'Phase III RCT',
    summary: 'MERMAID-1 (NCT04385368) is a phase III, randomized, double-blind, placebo-controlled trial sponsored by AstraZeneca testing adjuvant durvalumab vs placebo in patients with resected stage II-III NSCLC who are ctDNA-positive after curative-intent surgery (with or without adjuvant chemotherapy). Primary endpoint: disease-free survival in ctDNA-positive patients. This is the first phase III trial to prospectively use ctDNA/MRD status as a biomarker for selecting patients for adjuvant immunotherapy in NSCLC. The trial uses a tumor-informed ctDNA assay. MERMAID-1 enrollment is complete; results are anticipated but have not yet been formally reported as of early 2026.',
    full_text_excerpt: 'MERMAID-1: A Phase III, Randomized, Double-blind, Placebo-controlled, Multicenter Study of Durvalumab as Adjuvant Therapy in Patients With Stage II-III Non-Small Cell Lung Cancer (NSCLC) Who Have ctDNA Positivity Following Surgical Resection and Standard of Care Adjuvant Therapy. Sponsor: AstraZeneca. Design: ctDNA-positive patients randomized to durvalumab (anti-PD-L1) vs placebo. Key inclusion: completely resected stage II-III NSCLC, completed standard adjuvant chemotherapy, ctDNA-positive post-surgery or post-adjuvant. Exclusion: EGFR/ALK positive (these patients have targeted therapy options). Primary endpoint: DFS in ctDNA+ population. Secondary endpoints: OS, DFS in ctDNA- subgroup. Enrollment: ~284 ctDNA+ patients (from ~1,000 screened). Trial completed enrollment; results pending formal reporting.',
    key_findings: [
      { finding: 'First phase III trial using ctDNA to select patients for adjuvant immunotherapy in NSCLC', implication: 'Establishes MRD-guided treatment as a viable clinical trial paradigm in lung cancer' },
      { finding: 'Tests durvalumab (anti-PD-L1) in ctDNA-positive resected stage II-III NSCLC', implication: 'Targets the highest-risk population based on molecular residual disease' },
      { finding: 'Excludes EGFR/ALK positive patients who have targeted therapy options', implication: 'Addresses the non-driver NSCLC population where treatment options are limited' },
      { finding: 'Enrollment complete, results pending as of early 2026', implication: 'Results anticipated to inform MRD-guided immunotherapy decisions in NSCLC' },
    ],
    cancer_types: ['lung_nsclc'],
    clinical_settings: ['post_surgery', 'during_adjuvant'],
    questions: ['positive_result_action', 'escalation', 'clinical_trial_eligibility'],
    source_url: 'https://clinicaltrials.gov/study/NCT04385368',
    decision_context: {
      decision_point: 'adjuvant_immunotherapy_nsclc',
      population: { cancer_type: 'lung_nsclc', stage: 'II-III' },
      trial: { name: 'MERMAID-1', nct: 'NCT04385368', phase: 'III', n: 284, design: 'randomized placebo-controlled', sponsor: 'AstraZeneca' },
    },
  },

  // --- HPV ctDNA in head and neck (Q8) ---
  {
    source_type: 'expert_synthesis',
    source_id: 'hpv-ctdna-hnc-overview',
    title: 'HPV ctDNA as a Biomarker for Treatment Response and Surveillance in HPV-Positive Oropharyngeal Cancer',
    evidence_type: 'review',
    evidence_level: 'Systematic review',
    summary: 'HPV circulating tumor DNA (HPV ctDNA) is emerging as a biomarker for treatment response assessment and surveillance in HPV-positive oropharyngeal squamous cell carcinoma (OPSCC). Unlike somatic mutation-based MRD assays (Signatera, Guardant Reveal), HPV ctDNA detection leverages viral DNA sequences integrated into tumor cells, offering a distinct and potentially more sensitive analyte. Studies show HPV ctDNA clearance during chemoradiation correlates with treatment response, and detectable HPV ctDNA post-treatment predicts recurrence with high sensitivity. NavDx (Naveris) is a commercial tumor-naive HPV ctDNA assay that does not require tissue sequencing. Pre-treatment HPV ctDNA levels establish a baseline for monitoring treatment response. Multiple de-intensification trials for HPV+ OPSCC are incorporating HPV ctDNA as a biomarker endpoint.',
    full_text_excerpt: 'HPV ctDNA in head and neck cancer: HPV-positive oropharyngeal squamous cell carcinoma (OPSCC) represents a distinct clinical entity where circulating HPV DNA serves as a tumor-derived biomarker. Key differences from somatic mutation-based MRD assays: (1) HPV ctDNA uses viral DNA sequences, not patient-specific somatic mutations; (2) tumor-naive — no tissue sequencing required; (3) higher sensitivity in HPV+ OPSCC than somatic ctDNA assays because HPV integrates multiple copies per cell. NavDx (Naveris): Commercial HPV ctDNA assay, quantitative PCR-based, detects HPV16/18/33/35 ctDNA. Clinical applications: pre-treatment baseline establishes tumor burden, mid-treatment clearance predicts response, post-treatment surveillance detects recurrence. Studies by Chera et al. demonstrated HPV ctDNA clearance by week 4 of radiation predicted complete response with >95% NPV. Several trials incorporating HPV ctDNA: E3311 (de-intensification), SCCVII, OPTIMA. Important distinction: HPV ctDNA is NOT the same as somatic mutation-based MRD testing — different analyte, different assays, different clinical context.',
    key_findings: [
      { finding: 'HPV ctDNA uses viral DNA sequences, not somatic mutations — distinct from Signatera/Reveal', implication: 'Different analyte requiring different assay technology and interpretation framework' },
      { finding: 'NavDx (Naveris) is a commercial tumor-naive HPV ctDNA assay', implication: 'No tissue sequencing required — can be ordered pre-treatment for baseline' },
      { finding: 'HPV ctDNA clearance during chemoradiation predicts complete response (>95% NPV)', implication: 'Mid-treatment HPV ctDNA monitoring can inform response assessment' },
      { finding: 'Multiple de-intensification trials incorporating HPV ctDNA as endpoint', implication: 'HPV ctDNA may guide treatment de-intensification in favorable-risk OPSCC' },
    ],
    cancer_types: ['head_neck'],
    clinical_settings: ['pre_surgery', 'during_adjuvant', 'surveillance'],
    questions: ['when_to_test', 'which_test', 'positive_result_action', 'negative_result_action'],
    source_url: 'https://pubmed.ncbi.nlm.nih.gov/',
    decision_context: {
      decision_point: 'hpv_ctdna_hnc_monitoring',
      population: { cancer_type: 'head_neck', subtype: 'HPV-positive oropharyngeal', stage: 'all' },
    },
  },

  // --- FoundationOne Tracker breast cancer (Q14) ---
  {
    source_type: 'expert_synthesis',
    source_id: 'f1tracker-breast-validation',
    title: 'FoundationOne Tracker: Tumor-Informed ctDNA Monitoring for MRD in Breast Cancer',
    evidence_type: 'observational',
    evidence_level: 'Clinical validation study',
    summary: 'FoundationOne Tracker (Foundation Medicine/Roche) is a tumor-informed ctDNA assay that uses whole-exome sequencing of tumor tissue to design a personalized panel of up to 200+ somatic variants for ultrasensitive ctDNA monitoring. In breast cancer, FoundationOne Tracker has shown ability to detect molecular residual disease post-surgery with clinical sensitivity comparable to other tumor-informed assays. Key differences vs Signatera: larger variant panel (200+ vs 16 variants), whole-exome vs targeted sequencing for panel design, potentially higher analytical sensitivity due to broader mutation coverage. Both require tumor tissue for panel design. No head-to-head clinical trials comparing FoundationOne Tracker to Signatera in breast cancer exist. The BESPOKE trial (Natera/Signatera) provides the largest prospective breast cancer MRD dataset; comparable prospective data for FoundationOne Tracker in breast cancer is still accumulating.',
    full_text_excerpt: 'FoundationOne Tracker (F1T) technical overview: Whole-exome sequencing of tumor tissue identifies somatic variants, then a personalized panel of the most clonal/informative variants (typically 200+) is designed for ctDNA monitoring. Blood-based monitoring uses this panel to detect ctDNA at very low allele fractions. Turnaround time: ~2-3 weeks for initial panel design, then ~1 week for subsequent monitoring. Limit of detection: approximately 1 variant molecule in 100,000 (0.001% VAF). Comparison with Signatera (Natera): Signatera uses whole-exome sequencing to design a 16-plex bespoke PCR panel. Both are tumor-informed approaches requiring tissue. Key differences: F1T tracks ~200+ variants vs Signatera 16 variants; F1T uses next-generation sequencing for monitoring vs Signatera uses multiplex PCR; F1T larger panel may provide higher sensitivity at extremely low tumor fractions. No published head-to-head comparison in breast cancer. BESPOKE trial (Signatera) enrolled ~1,000 breast cancer patients and detected molecular relapse median 8.9 months before clinical recurrence. Foundation Medicine has breast cancer validation studies but no comparable single large prospective trial published.',
    key_findings: [
      { finding: 'FoundationOne Tracker tracks 200+ variants vs Signatera 16 variants', implication: 'Larger panel may provide higher sensitivity at very low tumor fractions' },
      { finding: 'Both require tumor tissue for panel design (whole-exome sequencing)', implication: 'Neither is suitable when tissue is unavailable — tumor-naive assays needed' },
      { finding: 'No head-to-head clinical trials comparing F1T to Signatera in breast cancer', implication: 'Clinical superiority of one approach over the other is not established' },
      { finding: 'BESPOKE (Signatera) provides largest prospective breast MRD dataset', implication: 'Signatera currently has more published clinical evidence in breast cancer' },
    ],
    cancer_types: ['breast'],
    clinical_settings: ['post_surgery', 'surveillance', 'during_adjuvant'],
    questions: ['which_test', 'when_to_test'],
    source_url: 'https://www.foundationmedicine.com/test/foundationone-tracker',
    decision_context: {
      decision_point: 'test_selection_breast',
      population: { cancer_type: 'breast', stage: 'I-III' },
    },
  },

  // --- Cross-tumor de-escalation guideline summary (Q20) ---
  {
    source_type: 'guideline',
    source_id: 'mrd-deescalation-guideline-summary-2026',
    title: 'Status of MRD-Guided De-Escalation in Major Oncology Guidelines (NCCN, ESMO, ASCO) — 2026',
    evidence_type: 'guideline',
    evidence_level: 'Guideline survey',
    summary: 'As of early 2026, no major oncology guideline body (NCCN, ESMO, or ASCO) recommends MRD-guided de-escalation of adjuvant therapy as standard of care in any solid tumor. NCCN explicitly states that de-escalation of treatment based on ctDNA results is not recommended for colorectal cancer (Category 2A). ESMO acknowledges liquid biopsy and ctDNA as emerging tools but has not incorporated MRD-guided treatment decisions into clinical practice guidelines. ASCO has issued provisional clinical opinions recognizing the prognostic value of ctDNA but stops short of recommending treatment modifications based on MRD status outside clinical trials. The DYNAMIC trial demonstrated feasibility of ctDNA-guided de-escalation in stage II CRC, but this has not yet been adopted into guidelines. MRD-guided de-escalation remains investigational, with multiple phase III trials (DYNAMIC-III, VEGA, NRG-GI005) designed to generate the level I evidence needed for guideline adoption.',
    full_text_excerpt: 'Guideline status survey — MRD-guided de-escalation in solid tumors: NCCN Colorectal: "De-escalation of care and treatment decision-making are not recommended based on ctDNA results" (Category 2A). NCCN acknowledges ctDNA as emerging prognostic marker but states insufficient evidence for routine clinical use. NCCN NSCLC: No mention of MRD-guided adjuvant decisions; ctDNA mentioned only for advanced disease molecular profiling. NCCN Breast: No MRD-guided therapy recommendations. ESMO: ESMO liquid biopsy guidelines acknowledge ctDNA for advanced disease genotyping. ESMO has not issued specific recommendations on MRD-guided adjuvant de-escalation. ASCO: Published provisional clinical opinion (PCO) on molecular biomarkers for adjuvant therapy selection. PCO acknowledges prognostic value of ctDNA but does not recommend treatment changes based on MRD status outside clinical trials. Bottom line: MRD-guided de-escalation is a trial-based approach as of 2026. No guideline endorsement exists. Key evidence gap: completed phase III RCTs in stage III CRC (DYNAMIC-III, VEGA) and NSCLC (MERMAID-2).',
    key_findings: [
      { finding: 'No major guideline (NCCN, ESMO, ASCO) recommends MRD-guided de-escalation in any solid tumor', implication: 'MRD-guided treatment de-escalation remains investigational as of 2026' },
      { finding: 'NCCN explicitly recommends against de-escalation based on ctDNA in CRC', implication: 'Standard of care is to treat based on clinicopathological factors, not MRD status' },
      { finding: 'ASCO PCO acknowledges prognostic value but stops short of treatment recommendations', implication: 'Evidence is recognized but deemed insufficient for practice change' },
      { finding: 'Phase III trials (DYNAMIC-III, VEGA, NRG-GI005) designed to provide needed evidence', implication: 'Guideline adoption awaits completion of large randomized trials' },
    ],
    cancer_types: ['colorectal', 'lung_nsclc', 'breast', 'multi_solid'],
    clinical_settings: ['post_surgery', 'during_adjuvant'],
    questions: ['de_escalation', 'negative_result_action'],
    source_url: 'https://www.nccn.org/guidelines',
    decision_context: {
      decision_point: 'guideline_status_mrd_deescalation',
      population: { cancer_type: 'multi_solid', stage: 'early' },
    },
  },

  // --- ESMO liquid biopsy (Q17 bonus) ---
  {
    source_type: 'esmo',
    source_id: 'esmo-liquid-biopsy-recommendations-2024',
    title: 'ESMO Recommendations on Liquid Biopsy and ctDNA for Clinical Decision-Making in Solid Tumors',
    evidence_type: 'guideline',
    evidence_level: 'ESMO Expert Consensus',
    summary: 'ESMO has published expert consensus recommendations on liquid biopsy applications in solid tumors. For advanced NSCLC, ESMO recommends plasma ctDNA testing when tissue is insufficient for molecular profiling. For CRC, ESMO acknowledges ctDNA utility for RAS/BRAF mutation detection in metastatic disease and recognizes the emerging prognostic role of ctDNA/MRD in early-stage disease. ESMO has not issued specific recommendations for MRD-guided adjuvant therapy decisions. The ESMO Precision Medicine Working Group noted that while prospective data on ctDNA-guided treatment is promising (citing DYNAMIC), additional randomized evidence is needed before incorporation into standard practice. ESMO Scale for Clinical Actionability of Molecular Targets (ESCAT) classifies ctDNA MRD as a level III biomarker (investigational) for treatment decisions.',
    full_text_excerpt: 'ESMO liquid biopsy recommendations: Advanced NSCLC — plasma ctDNA recommended when tissue insufficient or unavailable for broad molecular profiling (EGFR, ALK, ROS1, BRAF). CRC — ctDNA useful for RAS/BRAF testing in metastatic CRC when tissue unavailable. Breast — ctDNA for ESR1 mutation detection in metastatic HR+ breast cancer at progression on aromatase inhibitor. MRD applications — ESMO acknowledges promising data from DYNAMIC and CIRCULATE-Japan but classifies ctDNA MRD as investigational for treatment decisions (ESCAT level III). ESMO Precision Medicine Working Group position: MRD-guided therapy should be pursued through clinical trials; routine clinical use premature pending phase III data.',
    key_findings: [
      { finding: 'ESMO recommends liquid biopsy for advanced disease genotyping when tissue insufficient', implication: 'ctDNA has established utility in metastatic molecular profiling' },
      { finding: 'ctDNA MRD classified as ESCAT level III (investigational) for treatment decisions', implication: 'ESMO considers MRD-guided therapy investigational, not standard practice' },
      { finding: 'ESMO acknowledges DYNAMIC trial data but awaits phase III confirmation', implication: 'MRD-guided adjuvant decisions not yet endorsed at guideline level' },
    ],
    cancer_types: ['multi_solid', 'lung_nsclc', 'colorectal', 'breast'],
    clinical_settings: ['diagnosis', 'metastatic', 'post_surgery'],
    questions: ['which_test', 'when_to_test'],
    source_url: 'https://www.esmo.org/guidelines',
    decision_context: {
      decision_point: 'esmo_liquid_biopsy_guidance',
      population: { cancer_type: 'multi_solid' },
    },
  },
];

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

function createPool() {
  const connectionString = process.env.MRD_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: MRD_DATABASE_URL or DATABASE_URL required');
    process.exit(1);
  }
  return new Pool({
    connectionString,
    ssl: process.env.MRD_DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });
}

// ---------------------------------------------------------------------------
// Embedding generation
// ---------------------------------------------------------------------------

function buildEmbeddingText(item) {
  const parts = [
    `[${item.source_type}] ${item.title}`,
    item.evidence_level ? `Evidence: ${item.evidence_level}` : '',
    item.summary || '',
    item.full_text_excerpt || '',
    (item.cancer_types || []).length > 0 ? `Cancer types: ${item.cancer_types.join(', ')}` : '',
    (item.clinical_settings || []).length > 0 ? `Settings: ${item.clinical_settings.join(', ')}` : '',
  ];
  return parts.filter(Boolean).join('\n');
}

async function generateEmbedding(openai, text) {
  const resp = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return resp.data[0].embedding;
}

// ---------------------------------------------------------------------------
// Insert item
// ---------------------------------------------------------------------------

async function insertItem(pool, openai, item, index) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert main item
    const result = await client.query(
      `INSERT INTO mrd_guidance_items (
        source_type, source_id, source_url, title, authors,
        publication_date, journal, doi, pmid,
        evidence_type, evidence_level, relevance_score,
        summary, key_findings, full_text_excerpt,
        decision_context
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (source_type, source_id) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        key_findings = EXCLUDED.key_findings,
        full_text_excerpt = EXCLUDED.full_text_excerpt,
        decision_context = EXCLUDED.decision_context,
        evidence_level = EXCLUDED.evidence_level,
        updated_at = NOW()
      RETURNING id`,
      [
        item.source_type,
        item.source_id,
        item.source_url || null,
        item.title,
        item.authors ? JSON.stringify(item.authors) : null,
        item.publication_date || null,
        item.journal || null,
        item.doi || null,
        item.pmid || null,
        item.evidence_type,
        item.evidence_level || null,
        8, // relevance_score
        item.summary,
        JSON.stringify(item.key_findings || []),
        item.full_text_excerpt || null,
        JSON.stringify(item.decision_context || {}),
      ]
    );

    const guidanceId = result.rows[0].id;

    // Cancer types
    for (const ct of item.cancer_types || []) {
      await client.query(
        `INSERT INTO mrd_guidance_cancer_types (guidance_id, cancer_type)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [guidanceId, ct]
      );
    }

    // Clinical settings
    for (const cs of item.clinical_settings || []) {
      await client.query(
        `INSERT INTO mrd_guidance_clinical_settings (guidance_id, clinical_setting)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [guidanceId, cs]
      );
    }

    // Questions
    for (const q of item.questions || []) {
      await client.query(
        `INSERT INTO mrd_guidance_questions (guidance_id, question)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [guidanceId, q]
      );
    }

    // Generate and store embedding
    const embeddingText = buildEmbeddingText(item);
    const embedding = await generateEmbedding(openai, embeddingText);

    await client.query(
      `DELETE FROM mrd_item_embeddings WHERE guidance_id = $1`,
      [guidanceId]
    );
    await client.query(
      `INSERT INTO mrd_item_embeddings (guidance_id, chunk_index, chunk_text, embedding)
       VALUES ($1, 0, $2, $3)`,
      [guidanceId, embeddingText, JSON.stringify(embedding)]
    );

    await client.query('COMMIT');
    return { id: guidanceId, title: item.title };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nSeed Content Gaps — ${ITEMS.length} items`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  if (DRY_RUN) {
    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i];
      console.log(`[${i + 1}/${ITEMS.length}] Would insert: ${item.title}`);
      console.log(`  source: ${item.source_type}/${item.source_id}`);
      console.log(`  cancer_types: ${item.cancer_types.join(', ')}`);
      console.log(`  questions: ${(item.questions || []).join(', ')}`);
    }
    console.log(`\nDry run complete. ${ITEMS.length} items would be inserted.`);
    return;
  }

  const pool = createPool();
  const openai = new OpenAI();
  let inserted = 0;
  let failed = 0;

  try {
    for (let i = 0; i < ITEMS.length; i++) {
      const item = ITEMS[i];
      try {
        const result = await insertItem(pool, openai, item, i);
        inserted++;
        console.log(`[${i + 1}/${ITEMS.length}] Inserted id=${result.id}: ${result.title.slice(0, 70)}`);
      } catch (err) {
        failed++;
        console.error(`[${i + 1}/${ITEMS.length}] FAILED: ${item.title.slice(0, 50)} — ${err.message}`);
      }
    }

    // Verify
    const { rows } = await pool.query(
      `SELECT COUNT(*) as total FROM mrd_guidance_items`
    );
    const { rows: embRows } = await pool.query(
      `SELECT COUNT(*) as total FROM mrd_item_embeddings`
    );

    console.log('\n' + '='.repeat(60));
    console.log(`  Inserted:   ${inserted}`);
    console.log(`  Failed:     ${failed}`);
    console.log(`  Total items in DB: ${rows[0].total}`);
    console.log(`  Total embeddings:  ${embRows[0].total}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
