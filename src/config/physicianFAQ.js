/**
 * Physician FAQ — Personalized answers for patient advocacy
 *
 * Structure: PHYSICIAN_FAQ_DATA[cancerType][concernId] = { ... }
 *
 * Cancer type tiers:
 *   Tier 1 (full): colorectal, breast, lung
 *   Tier 2 (moderate): bladder, melanoma
 *   Tier 3 (generic): everything else uses '_default'
 *
 * Stage-specific notes are optional overlays on the base answer.
 *
 * To regenerate: future automated pipeline will query physician-system DB
 * and rebuild this file. Last manual update: March 2026.
 */

export const CONCERNS = [
  { id: 'no-evidence', label: '"There\'s no evidence MRD results change outcomes."' },
  { id: 'not-in-guidelines', label: '"It\'s not in the guidelines yet."' },
  { id: 'what-to-do-positive', label: '"What would I even do with a positive result?"' },
  { id: 'insurance', label: '"Insurance won\'t cover it."', isWizardLink: true },
  { id: 'not-validated', label: '"The test isn\'t validated for your cancer type."' },
];

// Helper to get the best answer for a cancer type, falling back to _default
export function getAnswer(cancerType, concernId) {
  const typeData = PHYSICIAN_FAQ_DATA[cancerType] || PHYSICIAN_FAQ_DATA['_default'];
  return typeData[concernId] || PHYSICIAN_FAQ_DATA['_default'][concernId];
}

// Helper to get stage-specific note
export function getStageNote(cancerType, concernId, stage) {
  const answer = getAnswer(cancerType, concernId);
  if (!answer?.stageNotes || !stage) return null;
  return answer.stageNotes[stage] || null;
}

export const PHYSICIAN_FAQ_DATA = {

  /* ═══════════════════════════════════════════
   *  COLORECTAL — Tier 1 (strongest evidence)
   * ═══════════════════════════════════════════ */
  colorectal: {
    'no-evidence': {
      forPatient: 'There is strong evidence from multiple clinical trials. The DYNAMIC trial — published in the New England Journal of Medicine — showed that using MRD test results to guide treatment decisions is safe and effective. Patients with negative MRD tests who skipped chemotherapy did just as well as those who received it.',
      forDoctor: 'The DYNAMIC trial (Tie et al., NEJM 2022) randomized 455 stage II CRC patients to ctDNA-guided vs. standard management. The ctDNA-guided arm reduced adjuvant chemotherapy from 28% to 15% with non-inferior 2-year RFS (93.5% vs 92.4%; HR 0.92). Five-year follow-up (2025) confirmed durability. GALAXY/VEGA (>2,000 pts) demonstrated ctDNA-positive patients receiving adjuvant chemo had significantly improved DFS vs. observation (HR 0.39). CIRCULATE-Japan showed ctDNA-positive stage II-III patients randomized to capecitabine had 65% reduced recurrence risk.',
      stageNotes: {
        'stage-2': 'Stage II CRC has the strongest evidence base. DYNAMIC was specifically a stage II trial, and NCCN now lists ctDNA as an option for stage II adjuvant therapy decisions (Category 2A). This is the most defensible clinical scenario for MRD-guided management.',
        'stage-3': 'Stage III evidence is growing rapidly. DYNAMIC-III (2025) extends the ctDNA-guided approach to stage III. GALAXY/VEGA enrolled stage II-III patients. The clinical question shifts from "skip chemo?" to "which regimen and duration?" based on ctDNA status.',
        'stage-4': 'In metastatic CRC, ctDNA is used more for treatment response monitoring than MRD per se. However, ctDNA clearance after first-line therapy correlates with improved PFS and OS. Serial monitoring can guide therapy switches.',
        'stage-1': 'Stage I CRC has very low recurrence risk (~5%). MRD testing is less commonly discussed, but ctDNA positivity post-resection still identifies the small subset at elevated risk who may benefit from closer surveillance.',
      },
      sources: [
        { label: 'Tie et al., NEJM 2022 — DYNAMIC trial', pmid: '35657320' },
        { label: 'DYNAMIC 5-year follow-up, 2025', pmid: '40055522' },
        { label: 'Kotani et al., Nat Med 2023 — GALAXY/VEGA', pmid: '37264205' },
      ],
      guidelines: 'NCCN Colon Cancer v1.2025: ctDNA listed as option for stage II adjuvant therapy decisions (Category 2A).',
    },

    'not-in-guidelines': {
      forPatient: 'MRD testing for colorectal cancer is already in the NCCN guidelines — the national standard that most oncologists follow. It\'s also endorsed by ASCO. Your oncologist may not have seen the latest updates.',
      forDoctor: 'NCCN Colon Cancer Guidelines (v1.2025) include ctDNA assay as an option to inform adjuvant treatment decisions for stage II disease (Category 2A). NCCN Rectal Cancer guidelines include ctDNA in the surveillance setting. ASCO issued a Provisional Clinical Opinion (2024) endorsing ctDNA for stage II-III CRC to identify patients who may benefit from adjuvant therapy intensification or de-escalation. ESMO 2024 Metastatic CRC guidelines also reference ctDNA utility in the post-surgical setting.',
      stageNotes: {
        'stage-2': 'NCCN specifically recommends ctDNA as an option for stage II adjuvant therapy decisions. This is the setting with the clearest guideline support.',
        'stage-3': 'NCCN does not yet have a specific stage III ctDNA recommendation, but ASCO\'s 2024 PCO covers stage II-III. DYNAMIC-III results (2025) are expected to inform the next guideline update.',
        'stage-4': 'ctDNA for metastatic CRC monitoring is referenced in ESMO guidelines. NCCN acknowledges ctDNA assays for treatment response assessment in the metastatic setting.',
      },
      sources: [
        { label: 'NCCN Colon Cancer Guidelines v1.2025', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1428' },
        { label: 'ASCO Provisional Clinical Opinion 2024', url: 'https://ascopubs.org/doi/10.1200/JCO.24.00512' },
      ],
      guidelines: 'NCCN Category 2A for stage II CRC. ASCO PCO (2024) for stage II-III CRC. ESMO 2024 for metastatic CRC.',
    },

    'what-to-do-positive': {
      forPatient: 'A positive MRD test means tiny amounts of cancer DNA are still detectable in your blood. This is actionable information: your doctor can start or intensify treatment months before a scan would show anything. Studies show this early detection leads to better outcomes.',
      forDoctor: 'ctDNA positivity post-resection in CRC identifies patients at high recurrence risk (HR 7-18x across studies). Actionable clinical responses: (1) Initiate adjuvant chemotherapy — GALAXY showed ctDNA+ patients treated with adjuvant chemo had significantly improved DFS (HR 0.39). (2) Intensify regimen — consider oxaliplatin-based over fluoropyrimidine alone for ctDNA+ patients. (3) Increase surveillance frequency — serial ctDNA q3-6 months to track molecular response. (4) Clinical trial enrollment — CIRCULATE-US, COBRA, PEGASUS actively enroll ctDNA+ CRC patients. (5) Lead time advantage — Reinert et al. showed median 8.7 months lead time before radiographic recurrence.',
      stageNotes: {
        'stage-2': 'For stage II ctDNA+ patients, the primary action is initiating adjuvant chemo that would otherwise be omitted. DYNAMIC showed ctDNA+ stage II patients treated with oxaliplatin-based chemo had 86.4% 3-year RFS.',
        'stage-3': 'For stage III ctDNA+ patients post-adjuvant, the action is intensified surveillance and potential clinical trial enrollment. Consider extending duration of adjuvant therapy or switching regimen if ctDNA persists.',
        'stage-4': 'In the metastatic setting, rising ctDNA levels may prompt earlier therapy switch before radiographic progression. BESPOKE CRC showed ctDNA dynamics correlate with treatment response.',
      },
      sources: [
        { label: 'Reinert et al., JAMA Oncology 2019 — lead time', pmid: '31070691' },
        { label: 'Tie et al., NEJM 2022 — ctDNA+ treatment', pmid: '35657320' },
        { label: 'Kotani et al., Nat Med 2023 — GALAXY', pmid: '37264205' },
      ],
      guidelines: 'Multiple active trials enroll ctDNA+ CRC patients: CIRCULATE-US (NCT05174169), COBRA (NCT04068103), PEGASUS.',
    },

    'not-validated': {
      forPatient: 'Colorectal cancer has the most MRD testing evidence of any cancer type. Multiple tests are validated and FDA-recognized for CRC, and Medicare covers several of them.',
      forDoctor: 'CRC has the deepest MRD validation data. Tumor-informed assays (Signatera — validated across 5+ CRC studies including DYNAMIC; RaDaR/Guardant Reveal — ECLIPSE validation) and tumor-naive approaches (Guardant Reveal — published sensitivity/specificity data) are available. Signatera has Medicare coverage via MolDX LCD L39256 for CRC. Analytical sensitivity for ctDNA in CRC is among the highest of solid tumors due to relatively high ctDNA shedding rates.',
      stageNotes: {
        'stage-2': 'Stage II CRC is the gold-standard use case for MRD testing. DYNAMIC was stage II. Signatera\'s pivotal validation included stage II CRC.',
        'stage-3': 'Stage III CRC has strong validation data from GALAXY/VEGA and DYNAMIC-III. Most commercial assays include stage III in their validated indications.',
      },
      sources: [
        { label: 'Tie et al., NEJM 2022 — Signatera in CRC', pmid: '35657320' },
        { label: 'CMS MolDX LCD L39256', url: 'https://www.cms.gov/medicare-coverage-database' },
      ],
      guidelines: 'CRC is the most validated indication for ctDNA MRD testing. Multiple FDA Breakthrough Device Designations granted.',
    },
  },

  /* ═══════════════════════════════════════════
   *  BREAST — Tier 1
   * ═══════════════════════════════════════════ */
  breast: {
    'no-evidence': {
      forPatient: 'There is growing evidence for MRD testing in breast cancer, especially for triple-negative breast cancer (TNBC). Clinical trials show that detecting tumor DNA in the blood after treatment predicts who is at high risk of recurrence — and new trials are testing whether acting on this information improves outcomes.',
      forDoctor: 'The c-TRAK TN trial demonstrated ctDNA surveillance detects recurrence earlier than standard imaging in TNBC. The ZEST trial (Natera/AstraZeneca) is randomizing ctDNA+ early-stage TNBC/HR+ HER2- patients to enhanced therapy vs. observation — the first interventional MRD trial in breast cancer. Observational data (Signatera, RaDaR) show ctDNA positivity post-neoadjuvant chemo in TNBC has >95% PPV for recurrence. For HR+ disease, evidence is more limited but ctDNA has been shown to precede clinical recurrence by 6-12 months.',
      stageNotes: {
        'stage-1': 'Stage I breast cancer has low recurrence risk. MRD data is limited but ctDNA positivity, when detected, carries high prognostic significance.',
        'stage-2': 'Stage II-III TNBC has the most breast MRD data. ZEST trial enrolls stage II-III TNBC and high-risk HR+ patients.',
        'stage-3': 'Stage III breast cancer (especially TNBC) is where MRD testing has the strongest rationale — high recurrence risk and actionable treatment options if ctDNA positive.',
      },
      sources: [
        { label: 'c-TRAK TN — ctDNA surveillance in TNBC', pmid: '36720083' },
        { label: 'ZEST trial design', url: 'https://clinicaltrials.gov/ct2/show/NCT04915755' },
      ],
      guidelines: 'No NCCN recommendation specific to breast cancer MRD yet. ZEST trial results expected to inform future guidelines.',
    },

    'not-in-guidelines': {
      forPatient: 'Breast cancer MRD testing isn\'t yet in the NCCN guidelines specifically, but it is in active clinical trials and the guidelines are expected to evolve as results come in. Many leading breast cancer centers are already using MRD testing in practice.',
      forDoctor: 'NCCN Breast Cancer guidelines do not yet include a specific ctDNA MRD recommendation, but this reflects the timing of evidence rather than negative data. The ASCO PCO (2024) focused on CRC but noted that breast cancer MRD data is "rapidly emerging." ZEST (interventional, ctDNA-guided escalation in TNBC/HR+) and multiple observational studies are expected to generate guideline-level evidence within 1-2 years. In the interim, ctDNA testing is available as a prognostic tool and for clinical trial eligibility.',
      stageNotes: {
        'stage-2': 'For stage II breast cancer, ctDNA testing is primarily prognostic currently. Clinical utility trials (ZEST) are actively enrolling stage II-III patients.',
        'stage-3': 'Stage III patients, especially TNBC, have the strongest rationale for MRD testing given high recurrence risk and the need for treatment escalation biomarkers.',
      },
      sources: [
        { label: 'NCCN Breast Cancer Guidelines v2.2025', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1419' },
      ],
      guidelines: 'Not yet in NCCN breast guidelines. ZEST and other trials expected to inform future updates. Available for clinical trial eligibility.',
    },

    'what-to-do-positive': {
      forPatient: 'A positive MRD test in breast cancer means your doctor has an early signal that cancer may be returning. Depending on your breast cancer subtype, this could lead to starting additional treatment, increasing monitoring, or qualifying for a clinical trial — all before a scan would show anything.',
      forDoctor: 'Actionable responses to ctDNA positivity in breast cancer depend on subtype: (1) TNBC: Consider capecitabine (CREATE-X extrapolation), immunotherapy rechallenge, or PARP inhibitor if BRCA-mutated. ZEST trial offers randomized escalation. (2) HR+/HER2-: Extended endocrine therapy, CDK4/6 inhibitor addition, increased imaging frequency. (3) HER2+: T-DXd or other anti-HER2 therapy. (4) All subtypes: Intensified surveillance, clinical trial enrollment (ZEST, others). Lead time from ctDNA detection to radiographic recurrence in breast cancer ranges from 6-12 months across studies.',
      stageNotes: {
        'stage-2': 'ctDNA positivity in stage II breast cancer post-treatment is uncommon but highly prognostic. Options include extended adjuvant therapy and intensified surveillance.',
        'stage-3': 'Stage III breast cancer with ctDNA positivity after neoadjuvant/adjuvant therapy is high risk. Consider clinical trial enrollment (ZEST) or subtype-specific escalation.',
      },
      sources: [
        { label: 'c-TRAK TN — lead time in TNBC', pmid: '36720083' },
        { label: 'ZEST trial — ctDNA-guided escalation', url: 'https://clinicaltrials.gov/ct2/show/NCT04915755' },
      ],
      guidelines: 'No formal guideline yet. ZEST trial provides a structured ctDNA-guided escalation framework.',
    },

    'not-validated': {
      forPatient: 'MRD tests are validated for breast cancer, with the strongest data in triple-negative breast cancer. Tests like Signatera and Guardant Reveal have published validation studies in breast cancer specifically.',
      forDoctor: 'Tumor-informed ctDNA assays (Signatera, RaDaR) have published analytical and clinical validation in breast cancer. Signatera has demonstrated high sensitivity for MRD detection in early-stage breast cancer (c-TRAK TN, observational cohorts). Sensitivity varies by subtype — highest in TNBC (higher ctDNA shedding) and lower in HR+/lobular histologies. Medicare coverage via MolDX extends to breast cancer for tumor-informed assays. Analytical considerations: tumor-informed approaches are preferred in breast cancer due to lower ctDNA fraction compared to CRC.',
      sources: [
        { label: 'Signatera breast cancer validation', pmid: '36720083' },
        { label: 'CMS MolDX LCD L39256', url: 'https://www.cms.gov/medicare-coverage-database' },
      ],
      guidelines: 'Signatera has Medicare coverage for breast cancer via MolDX. FDA Breakthrough Device Designation for pan-cancer MRD.',
    },
  },

  /* ═══════════════════════════════════════════
   *  LUNG (NSCLC) — Tier 1
   * ═══════════════════════════════════════════ */
  lung: {
    'no-evidence': {
      forPatient: 'There is solid evidence that MRD testing works in lung cancer. The IMpower010 trial showed that ctDNA status predicts who benefits from immunotherapy after surgery. The TRACERx study followed lung cancer patients for years and proved ctDNA detects recurrence early.',
      forDoctor: 'IMpower010 (CheckMate 816 correlative) demonstrated ctDNA clearance post-surgery predicts benefit from adjuvant atezolizumab in stage IB-IIIA NSCLC. ctDNA-positive patients had significantly improved DFS with adjuvant immunotherapy vs. BSC. TRACERx (longitudinal, >400 pts) showed ctDNA detects clonal evolution and recurrence with median lead time of ~5 months before radiographic progression. MERMAID-1 (ongoing) is randomizing ctDNA+ stage II-III NSCLC post-surgery to durvalumab vs. placebo — the first prospective interventional ctDNA trial in NSCLC.',
      stageNotes: {
        'stage-1': 'Stage IA NSCLC has very low recurrence risk after surgery. MRD testing may identify the small subset who would benefit from adjuvant therapy.',
        'stage-2': 'Stage II NSCLC has moderate recurrence risk. IMpower010 included stage II patients. ctDNA positivity post-surgery can guide adjuvant immunotherapy decisions.',
        'stage-3': 'Stage IIIA NSCLC has the strongest rationale — high recurrence risk, multiple adjuvant options (chemo, immunotherapy), and ctDNA can identify who truly needs them.',
      },
      sources: [
        { label: 'IMpower010 — ctDNA and adjuvant atezolizumab', pmid: '37379158' },
        { label: 'TRACERx — ctDNA dynamics in NSCLC', pmid: '36108067' },
        { label: 'MERMAID-1 trial design', url: 'https://clinicaltrials.gov/ct2/show/NCT04385368' },
      ],
      guidelines: 'NCCN NSCLC guidelines acknowledge ctDNA as an emerging biomarker. MERMAID-1 results expected to generate guideline-level evidence.',
    },

    'not-in-guidelines': {
      forPatient: 'While NCCN doesn\'t have a specific MRD recommendation for lung cancer yet, major clinical trials are underway and leading lung cancer centers are already using MRD testing. The evidence is moving fast.',
      forDoctor: 'NCCN NSCLC Guidelines (v3.2025) reference ctDNA as an emerging tool but do not yet include a specific MRD recommendation. However: IMpower010 ctDNA correlative data provides Level I evidence for ctDNA-guided adjuvant immunotherapy selection. MERMAID-1 (AstraZeneca, prospective randomized) will provide the definitive interventional data. ASCO and IASLC have highlighted ctDNA MRD in lung cancer as a priority research area. Multiple NCI-sponsored trials incorporate ctDNA endpoints.',
      stageNotes: {
        'stage-2': 'For resected stage II NSCLC, ctDNA testing is increasingly used to select patients for adjuvant immunotherapy (informed by IMpower010 ctDNA analysis).',
        'stage-3': 'Stage III NSCLC (especially IIIA) has the most clinical rationale for ctDNA-guided treatment. Multiple adjuvant options exist and ctDNA can guide selection.',
      },
      sources: [
        { label: 'NCCN NSCLC Guidelines v3.2025', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1450' },
        { label: 'IMpower010 ctDNA analysis', pmid: '37379158' },
      ],
      guidelines: 'Not yet a specific NCCN recommendation. IMpower010 provides Level I ctDNA evidence. MERMAID-1 results expected 2026.',
    },

    'what-to-do-positive': {
      forPatient: 'A positive MRD test in lung cancer gives your doctor a head start. It may mean starting immunotherapy sooner, adjusting your treatment plan, or qualifying for clinical trials — all before a scan shows any recurrence.',
      forDoctor: 'Actionable responses to ctDNA positivity in resected NSCLC: (1) Adjuvant immunotherapy — IMpower010 data supports preferential atezolizumab benefit in ctDNA+ patients. Consider adjuvant nivolumab (CheckMate 816) or pembrolizumab (KEYNOTE-091). (2) Adjuvant chemo if not yet given — ctDNA positivity identifies high-risk patients who benefit from platinum doublet. (3) Targeted therapy — if driver mutation detected (EGFR: osimertinib per ADAURA; ALK: alectinib per ALINA), ctDNA can guide initiation. (4) Intensified surveillance — serial ctDNA + imaging q3 months. (5) Clinical trials — MERMAID-1 enrolls ctDNA+ NSCLC. Lead time: TRACERx showed ~5 month median lead time.',
      stageNotes: {
        'stage-1': 'Stage I ctDNA positivity post-surgery is rare but prognostically significant. Consider adjuvant therapy discussion — ADAURA included stage IB EGFR+ patients.',
        'stage-2': 'Stage II ctDNA+ patients may benefit from adjuvant immunotherapy (IMpower010) or targeted therapy (ADAURA for EGFR+, ALINA for ALK+).',
        'stage-3': 'Stage IIIA ctDNA positivity post-surgery strongly argues for adjuvant treatment. Multiple options: immunotherapy, chemo, or targeted therapy based on molecular profile.',
      },
      sources: [
        { label: 'TRACERx — lead time in NSCLC', pmid: '36108067' },
        { label: 'IMpower010 — adjuvant atezolizumab', pmid: '37379158' },
        { label: 'ADAURA — adjuvant osimertinib', pmid: '32955177' },
      ],
      guidelines: 'NCCN recommends adjuvant osimertinib (EGFR+), nivolumab, pembrolizumab, and atezolizumab for resected NSCLC. ctDNA can guide selection.',
    },

    'not-validated': {
      forPatient: 'MRD tests are validated for lung cancer. Major trials like TRACERx and IMpower010 used ctDNA testing in lung cancer patients, and Medicare covers MRD tests for lung cancer.',
      forDoctor: 'ctDNA MRD assays validated in NSCLC include: Signatera (tumor-informed, validated in TRACERx cohort and multiple institutional series), FoundationOne Tracker (tumor-informed), Guardant Reveal (tumor-naive, methylation-based). Analytical sensitivity in NSCLC is generally good for squamous histology and adenocarcinoma, though lower ctDNA shedding in some early-stage adenocarcinomas may reduce sensitivity. Medicare coverage via MolDX extends to NSCLC for tumor-informed assays.',
      sources: [
        { label: 'TRACERx — Signatera validation in NSCLC', pmid: '36108067' },
        { label: 'CMS MolDX LCD L39256', url: 'https://www.cms.gov/medicare-coverage-database' },
      ],
      guidelines: 'Medicare covers tumor-informed ctDNA in NSCLC via MolDX. Multiple FDA Breakthrough Device Designations.',
    },
  },

  /* ═══════════════════════════════════════════
   *  BLADDER — Tier 2
   * ═══════════════════════════════════════════ */
  bladder: {
    'no-evidence': {
      forPatient: 'There is meaningful evidence for MRD testing in bladder cancer. The IMvigor011 trial showed ctDNA-positive patients after surgery have much higher recurrence risk, and that immunotherapy can clear the ctDNA signal.',
      forDoctor: 'IMvigor010/011 correlative analyses demonstrated ctDNA positivity post-cystectomy in MIBC is highly prognostic (HR >6 for recurrence). ctDNA-positive patients showed DFS benefit from adjuvant atezolizumab. The IMvigor011 trial (Phase III) specifically used ctDNA to select patients for adjuvant immunotherapy. Powles et al. (NEJM 2024) showed ctDNA-guided atezolizumab improved DFS in ctDNA+ MIBC patients.',
      sources: [
        { label: 'Powles et al., NEJM 2024 — IMvigor011', pmid: '38507753' },
      ],
      guidelines: 'IMvigor011 provides Level I evidence for ctDNA-guided adjuvant immunotherapy in bladder cancer.',
    },

    'not-in-guidelines': {
      forPatient: 'Bladder cancer MRD testing is emerging in the guidelines. IMvigor011 provided high-level evidence that is expected to be incorporated into NCCN guidelines soon.',
      forDoctor: 'NCCN Bladder Cancer guidelines do not yet include a specific ctDNA recommendation, but IMvigor011 (Powles et al., NEJM 2024) provides Phase III randomized evidence for ctDNA-guided adjuvant atezolizumab in MIBC. This is expected to be incorporated in upcoming guideline updates. The EAU guidelines reference ctDNA as a promising biomarker for MIBC management.',
      sources: [
        { label: 'Powles et al., NEJM 2024 — IMvigor011', pmid: '38507753' },
      ],
      guidelines: 'Phase III evidence (IMvigor011) expected to drive guideline updates. EAU references ctDNA in MIBC.',
    },

    'what-to-do-positive': {
      forPatient: 'A positive MRD test in bladder cancer means your care team can consider starting immunotherapy — even before a scan shows recurrence. IMvigor011 showed this approach works.',
      forDoctor: 'ctDNA positivity post-cystectomy in MIBC: (1) Adjuvant immunotherapy — IMvigor011 showed DFS benefit for atezolizumab in ctDNA+ patients. Consider nivolumab (CheckMate 274) as alternative. (2) Intensified surveillance — serial ctDNA + imaging. (3) Clinical trial enrollment for ctDNA+ MIBC. (4) Erdafitinib or other targeted therapy if FGFR alterations detected.',
      sources: [
        { label: 'Powles et al., NEJM 2024', pmid: '38507753' },
      ],
      guidelines: 'IMvigor011 supports adjuvant atezolizumab in ctDNA+ MIBC post-cystectomy.',
    },

    'not-validated': {
      forPatient: 'MRD tests are validated for bladder cancer. Signatera and other tests have been used in major bladder cancer clinical trials.',
      forDoctor: 'Tumor-informed ctDNA assays (Signatera, primary assay in IMvigor010/011) have clinical validation in MIBC. Analytical sensitivity is generally high in bladder cancer due to elevated ctDNA shedding. Medicare coverage via MolDX extends to bladder cancer.',
      sources: [
        { label: 'Powles et al., NEJM 2024 — Signatera in MIBC', pmid: '38507753' },
      ],
      guidelines: 'Medicare covers tumor-informed ctDNA in bladder cancer via MolDX.',
    },
  },

  /* ═══════════════════════════════════════════
   *  MELANOMA — Tier 2
   * ═══════════════════════════════════════════ */
  melanoma: {
    'no-evidence': {
      forPatient: 'There is growing evidence for MRD testing in melanoma. Studies show ctDNA can detect melanoma recurrence early and may help guide immunotherapy decisions after surgery.',
      forDoctor: 'ctDNA MRD in melanoma: Observational studies show ctDNA positivity post-resection in stage III melanoma is highly prognostic (HR ~4-10 for recurrence). Lee et al. demonstrated ctDNA dynamics during adjuvant immunotherapy correlate with clinical outcomes. Serial ctDNA monitoring can detect recurrence earlier than standard imaging. Multiple ongoing trials incorporate ctDNA endpoints in melanoma.',
      sources: [
        { label: 'Lee et al. — ctDNA in resected melanoma', pmid: '36853306' },
      ],
      guidelines: 'No specific NCCN recommendation yet. Observational data supports prognostic utility. Interventional trials in progress.',
    },

    'not-in-guidelines': {
      forPatient: 'Melanoma MRD testing isn\'t in the guidelines yet, but clinical data is accumulating and leading melanoma centers are already using it. The guidelines are expected to evolve as trial results come in.',
      forDoctor: 'NCCN Melanoma guidelines do not yet include ctDNA MRD. However, ctDNA is increasingly used in clinical practice at major melanoma centers for post-resection surveillance and adjuvant therapy monitoring. Interventional trials incorporating ctDNA endpoints are ongoing.',
      sources: [
        { label: 'NCCN Melanoma Guidelines v2.2025', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1492' },
      ],
      guidelines: 'Not yet in NCCN melanoma guidelines. Available for prognostic use and clinical trial eligibility.',
    },

    'what-to-do-positive': {
      forPatient: 'A positive MRD test in melanoma alerts your care team that cancer may be recurring. This can lead to starting or extending immunotherapy, increasing monitoring, or enrolling in a clinical trial.',
      forDoctor: 'ctDNA positivity in resected melanoma: (1) Adjuvant immunotherapy — consider initiating or extending nivolumab/pembrolizumab if ctDNA+ post-resection. (2) Adjuvant targeted therapy — if BRAF V600 mutated, consider dabrafenib/trametinib. (3) Intensified surveillance — serial ctDNA + imaging q3 months. (4) Clinical trial enrollment.',
      sources: [
        { label: 'Lee et al. — ctDNA-guided melanoma management', pmid: '36853306' },
      ],
      guidelines: 'NCCN recommends adjuvant nivolumab or pembrolizumab for resected stage III-IV melanoma. ctDNA can guide timing and selection.',
    },

    'not-validated': {
      forPatient: 'MRD tests are being validated for melanoma. Signatera and other tests have published data in melanoma patients, and Medicare coverage applies.',
      forDoctor: 'Tumor-informed ctDNA assays (Signatera) have published analytical validation in melanoma. ctDNA shedding in melanoma is variable but generally detectable in stage III-IV disease. Medicare coverage via MolDX extends to melanoma for tumor-informed assays.',
      sources: [
        { label: 'CMS MolDX LCD L39256', url: 'https://www.cms.gov/medicare-coverage-database' },
      ],
      guidelines: 'Medicare covers tumor-informed ctDNA in melanoma via MolDX.',
    },
  },

  /* ═══════════════════════════════════════════
   *  DEFAULT — Tier 3 (generic fallback)
   * ═══════════════════════════════════════════ */
  _default: {
    'no-evidence': {
      forPatient: 'There is growing evidence that MRD testing works across many cancer types. While the strongest data is in colorectal, breast, and lung cancers, the biological principle — detecting tiny amounts of tumor DNA in blood — applies broadly. Clinical trials are expanding to more cancer types every year.',
      forDoctor: 'ctDNA MRD detection is biologically valid across solid tumors — tumor DNA shedding into circulation is a universal cancer phenomenon. While the deepest clinical utility evidence exists in CRC (DYNAMIC, GALAXY), breast (c-TRAK TN, ZEST), NSCLC (IMpower010, TRACERx), and bladder (IMvigor011), observational data supports prognostic utility across solid tumors. Tumor-informed assays (Signatera, RaDaR) have pan-cancer analytical validation. Key consideration: ctDNA shedding rates vary by tumor type, histology, and stage, affecting analytical sensitivity.',
      sources: [
        { label: 'Tie et al., NEJM 2022 — CRC landmark', pmid: '35657320' },
        { label: 'Powles et al., NEJM 2024 — bladder', pmid: '38507753' },
      ],
      guidelines: 'Evidence strongest in CRC, breast, lung, bladder. Pan-cancer validation data exists for tumor-informed assays.',
    },

    'not-in-guidelines': {
      forPatient: 'MRD testing is already in the NCCN guidelines for colorectal cancer, and other cancer types are catching up as clinical trial results come in. Even where guidelines haven\'t yet caught up, many oncologists are already using MRD testing based on the available evidence.',
      forDoctor: 'NCCN includes ctDNA MRD recommendations for CRC (Category 2A, stage II). ASCO PCO (2024) covers CRC stage II-III. For other tumor types, ctDNA MRD is available as a prognostic tool, for clinical trial eligibility, and is covered by Medicare (MolDX) for tumor-informed assays across solid tumors. The absence of a tumor-specific guideline reflects timing of evidence generation, not negative data.',
      sources: [
        { label: 'NCCN Colon Cancer Guidelines v1.2025', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1428' },
        { label: 'ASCO PCO 2024 — CRC ctDNA', url: 'https://ascopubs.org/doi/10.1200/JCO.24.00512' },
      ],
      guidelines: 'NCCN CRC Category 2A. ASCO PCO for CRC. Other tumor types: available for prognostic use and clinical trial eligibility.',
    },

    'what-to-do-positive': {
      forPatient: 'A positive MRD test means tiny amounts of cancer DNA are in your blood — an early signal before scans can see anything. Your doctor can use this to start treatment sooner, increase monitoring, or look for clinical trials. Studies show this early detection can give you months of lead time.',
      forDoctor: 'ctDNA positivity post-resection across solid tumors is consistently associated with high recurrence risk (HR 5-18x depending on tumor type). General actionable responses: (1) Consider adjuvant systemic therapy if not already given. (2) Intensify surveillance frequency. (3) Evaluate clinical trial eligibility — many trials specifically enroll ctDNA+ patients. (4) Serial ctDNA monitoring to track molecular dynamics. Lead time from ctDNA detection to radiographic recurrence ranges from 3-12 months depending on tumor type and assay sensitivity.',
      sources: [
        { label: 'Reinert et al., JAMA Oncology 2019 — lead time', pmid: '31070691' },
      ],
      guidelines: 'Consult tumor-specific NCCN guidelines for adjuvant therapy options. ctDNA positivity supports intensified management.',
    },

    'not-validated': {
      forPatient: 'Tumor-informed MRD tests like Signatera have been validated across many cancer types and are covered by Medicare. Your oncologist can check if your specific cancer type has validation data.',
      forDoctor: 'Tumor-informed ctDNA assays (Signatera, FoundationOne Tracker, RaDaR) have pan-cancer analytical validation with published data across CRC, breast, NSCLC, bladder, melanoma, ovarian, gastric, pancreatic, and other solid tumors. Tumor-naive assays (Guardant Reveal) have more limited validation but are expanding. Key variable: analytical sensitivity depends on ctDNA shedding rate, which varies by tumor type, stage, and histology. For low-shedding tumors, tumor-informed approaches are preferred. Medicare MolDX coverage applies to tumor-informed assays across solid tumors.',
      sources: [
        { label: 'CMS MolDX LCD L39256', url: 'https://www.cms.gov/medicare-coverage-database' },
      ],
      guidelines: 'Medicare covers tumor-informed ctDNA MRD across solid tumors via MolDX LCD L39256.',
    },
  },
};
