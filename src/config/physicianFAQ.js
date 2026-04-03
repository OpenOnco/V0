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
 * and rebuild this file. Last manual update: April 2026.
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
      forPatient: 'There is strong evidence from multiple clinical trials. The DYNAMIC trial — published in the New England Journal of Medicine — showed that using MRD test results to guide treatment decisions is safe and effective. Five-year follow-up confirmed patients with negative MRD tests who skipped chemotherapy did just as well long-term. In early 2026, the ALTAIR trial became the first to show that treating patients based on a positive ctDNA test alone improved outcomes.',
      forDoctor: 'The DYNAMIC trial (Tie et al., NEJM 2022) randomized 455 stage II CRC patients to ctDNA-guided vs. standard management. The ctDNA-guided arm reduced adjuvant chemotherapy from 28% to 15% with non-inferior 2-year RFS (93.5% vs 92.4%; HR 0.92). Five-year follow-up (Nat Med 2025, PMID 40055522) confirmed durability: 5-year RFS 88% vs. 87%, 5-year OS 93.8% vs. 93.3% (HR 1.05; P=0.887). GALAXY/VEGA (>2,000 pts) demonstrated ctDNA-positive patients receiving adjuvant chemo had significantly improved DFS vs. observation (HR 0.39); ctDNA+ had DFS HR 11.99 and OS HR 9.68 vs. ctDNA-. The ALTAIR trial (ASCO GI 2026) is the first RCT showing treatment benefit triggered by ctDNA molecular recurrence: FTD/TPI vs. placebo in Signatera-positive stage I-IV CRC yielded median DFS 9.23 vs. 5.55 months (HR 0.75; 95% CI 0.55-0.98; P=0.0406). CITCCA (ASCO GI 2026, 377 pts) showed post-treatment ctDNA positivity carried HR 38.5 for recurrence.',
      stageNotes: {
        'stage-2': 'Stage II CRC has the strongest evidence base. DYNAMIC was specifically a stage II trial, and NCCN now lists ctDNA as an option for stage II adjuvant therapy decisions (Category 2A). This is the most defensible clinical scenario for MRD-guided management.',
        'stage-3': 'Stage III evidence is growing but nuanced. DYNAMIC-III (ASCO 2025) was the first prospective randomized study in stage III but treatment escalation for ctDNA+ patients did NOT improve RFS — raising questions about available treatments vs. assay limitations. GALAXY/VEGA enrolled stage II-III patients. The Guardant Reveal stage III study (JCO Feb 2026) — the largest MRD study in stage III CRC — showed ctDNA+ patients had 4-6x higher recurrence rate (TTR HR 5.96; 5-year DFS 27.7% vs. 77.1%).',
        'stage-4': 'In metastatic CRC, ctDNA is used more for treatment response monitoring than MRD per se. However, ctDNA clearance after first-line therapy correlates with improved PFS and OS. Serial monitoring can guide therapy switches.',
        'stage-1': 'Stage I CRC has very low recurrence risk (~5%). MRD testing is less commonly discussed, but ctDNA positivity post-resection still identifies the small subset at elevated risk who may benefit from closer surveillance.',
      },
      sources: [
        { label: 'Tie et al., NEJM 2022 — DYNAMIC trial', pmid: '35657320' },
        { label: 'DYNAMIC 5-year follow-up, Nat Med 2025', pmid: '40055522' },
        { label: 'Kotani et al., Nat Med 2023 — GALAXY/VEGA', pmid: '36646802' },
        { label: 'ALTAIR trial — ASCO GI 2026', url: 'https://www.natera.com/company/news/natera-presents-updated-analyses-from-altair-clinical-trial-at-asco-gi/' },
        { label: 'Guardant Reveal stage III CRC — JCO Feb 2026', url: 'https://investors.guardanthealth.com/press-releases/press-releases/2026/Largest-Published-Study-of-Molecular-Residual-Disease-MRD-in-Stage-III-Colon-Cancer-Shows-Guardant-Reveal-Blood-Test-More-Precisely-Identifies-Risk-of-Recurrence-After-Surgery-to-Support-Timely-Treatment-Decisions/default.aspx' },
      ],
      guidelines: 'NCCN Colon Cancer v1.2026: ctDNA formally recognized as a high-risk factor for recurrence in the adjuvant setting. Category 2A for stage II adjuvant therapy decisions.',
    },

    'not-in-guidelines': {
      forPatient: 'MRD testing for colorectal cancer is already in the NCCN guidelines — the national standard that most oncologists follow. In 2026, NCCN formally recognized ctDNA as a high-risk factor for recurrence. It\'s also endorsed by ASCO. Your oncologist may not have seen the latest updates.',
      forDoctor: 'NCCN Colon Cancer Guidelines (v1.2026) now formally recognize ctDNA as a high-risk factor for recurrence in the adjuvant setting — the first explicit acknowledgment of ctDNA prognostic value. ctDNA remains an option to inform adjuvant treatment decisions for stage II disease (Category 2A). NCCN Rectal Cancer guidelines include ctDNA as prognostic following transanal local excision. ASCO issued a Provisional Clinical Opinion (2024) endorsing ctDNA for stage II-III CRC to identify patients who may benefit from adjuvant therapy intensification or de-escalation. ESMO 2024 Metastatic CRC guidelines also reference ctDNA utility in the post-surgical setting.',
      stageNotes: {
        'stage-2': 'NCCN specifically recommends ctDNA as an option for stage II adjuvant therapy decisions. ctDNA positivity is now formally recognized as a high-risk factor for recurrence (NCCN v1.2026). This is the setting with the clearest guideline support.',
        'stage-3': 'NCCN does not yet have a specific stage III ctDNA treatment recommendation. ASCO\'s 2024 PCO covers stage II-III. DYNAMIC-III (ASCO 2025) showed escalation for ctDNA+ did not improve RFS, tempering expectations for near-term stage III guideline changes.',
        'stage-4': 'ctDNA for metastatic CRC monitoring is referenced in ESMO guidelines. NCCN acknowledges ctDNA assays for treatment response assessment in the metastatic setting.',
      },
      sources: [
        { label: 'NCCN Colon Cancer Guidelines v1.2026', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1428' },
        { label: 'ASCO Provisional Clinical Opinion 2024', url: 'https://ascopubs.org/doi/10.1200/JCO.24.00512' },
        { label: 'NCCN ctDNA stance update (OncLive)', url: 'https://www.onclive.com/view/nccn-updates-ctdna-stance-in-colon-rectal-and-mcc-guidelines' },
      ],
      guidelines: 'NCCN v1.2026: ctDNA recognized as high-risk factor; Category 2A for stage II. ASCO PCO (2024) for stage II-III CRC. ESMO 2024 for metastatic CRC.',
    },

    'what-to-do-positive': {
      forPatient: 'A positive MRD test means tiny amounts of cancer DNA are still detectable in your blood. This is actionable information: your doctor can start or intensify treatment months before a scan would show anything. Studies show this early detection leads to better outcomes.',
      forDoctor: 'ctDNA positivity post-resection in CRC identifies patients at high recurrence risk (HR 7-38x across studies; CITCCA 2026 reported HR 38.5). Actionable clinical responses: (1) Initiate adjuvant chemotherapy — GALAXY showed ctDNA+ patients treated with adjuvant chemo had significantly improved DFS (HR 0.39). (2) Treat molecular recurrence — ALTAIR (ASCO GI 2026) is the first RCT to show DFS benefit from treating ctDNA-detected molecular recurrence (FTD/TPI vs. placebo; HR 0.75, P=0.04). (3) Intensify regimen — consider oxaliplatin-based over fluoropyrimidine alone for ctDNA+ patients. (4) Increase surveillance frequency — serial ctDNA q3-6 months to track molecular response. (5) Clinical trial enrollment — CIRCULATE-US, COBRA, PEGASUS actively enroll ctDNA+ CRC patients. (6) Lead time advantage — Reinert et al. showed median 8.7 months lead time before radiographic recurrence.',
      stageNotes: {
        'stage-2': 'For stage II ctDNA+ patients, the primary action is initiating adjuvant chemo that would otherwise be omitted. DYNAMIC showed ctDNA+ stage II patients treated with oxaliplatin-based chemo had 86.4% 3-year RFS.',
        'stage-3': 'For stage III ctDNA+ patients post-adjuvant, the action is intensified surveillance and potential clinical trial enrollment. Consider extending duration of adjuvant therapy or switching regimen if ctDNA persists.',
        'stage-4': 'In the metastatic setting, rising ctDNA levels may prompt earlier therapy switch before radiographic progression. BESPOKE CRC showed ctDNA dynamics correlate with treatment response.',
      },
      sources: [
        { label: 'Reinert et al., JAMA Oncology 2019 — lead time', pmid: '31070691' },
        { label: 'Tie et al., NEJM 2022 — ctDNA+ treatment', pmid: '35657320' },
        { label: 'Kotani et al., Nat Med 2023 — GALAXY', pmid: '36646802' },
      ],
      guidelines: 'Multiple active trials enroll ctDNA+ CRC patients: CIRCULATE-US (NCT05174169), COBRA (NCT04068103), PEGASUS.',
    },

    'not-validated': {
      forPatient: 'Colorectal cancer has the most MRD testing evidence of any cancer type. Multiple tests are validated and FDA-recognized for CRC, and Medicare covers several of them.',
      forDoctor: 'CRC has the deepest MRD validation data. Tumor-informed assays (Signatera — validated across 5+ CRC studies including DYNAMIC, ALTAIR; RaDaR) and tumor-naive/epigenomic approaches (Guardant Reveal — the largest published stage III CRC MRD study, JCO Feb 2026, showed TTR HR 5.96, 5-year DFS 27.7% vs. 77.1%; COSMOS specificity 98.2%) are available. Signatera has Medicare coverage via MolDX LCDs. Guardant Reveal provides a tissue-free approach validated with Mayo Clinic/Alliance data. Analytical sensitivity for ctDNA in CRC is among the highest of solid tumors due to relatively high ctDNA shedding rates.',
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
      forPatient: 'There is growing evidence for MRD testing in breast cancer. The DARE trial showed that switching treatment based on a positive ctDNA test helped clear the cancer signal in HR+ breast cancer patients. For triple-negative breast cancer, the c-TRAK trial showed ctDNA surveillance finds recurrence earlier than scans. New trials are testing whether acting on this information improves long-term outcomes.',
      forDoctor: 'The c-TRAK TN trial demonstrated ctDNA surveillance detects recurrence earlier than standard imaging in TNBC; RaDaR detected ctDNA median 1.4 months earlier than dPCR. The DARE trial (ASCO 2025 interim) screened 507 high-risk HR+/HER2- patients, found 60 ctDNA-positive; switching to palbociclib + fulvestrant achieved twofold higher ctDNA clearance at 3 months. Patients with sustained ctDNA negativity (99.5%) remained recurrence-free at 27.4 months. The ZEST trial (Natera/AstraZeneca) is randomizing ctDNA+ early-stage TNBC/HR+ HER2- patients to enhanced therapy vs. observation. SERENA-6 (ASCO 2025 plenary) provided the first registrational evidence of clinical utility from ctDNA-guided therapy switching (CDK4/6i) in breast cancer. Observational data (Signatera, RaDaR) show ctDNA positivity post-neoadjuvant chemo in TNBC has >95% PPV for recurrence.',
      stageNotes: {
        'stage-1': 'Stage I breast cancer has low recurrence risk. MRD data is limited but ctDNA positivity, when detected, carries high prognostic significance.',
        'stage-2': 'Stage II-III TNBC has the most breast MRD data. ZEST trial enrolls stage II-III TNBC and high-risk HR+ patients.',
        'stage-3': 'Stage III breast cancer (especially TNBC) is where MRD testing has the strongest rationale — high recurrence risk and actionable treatment options if ctDNA positive.',
      },
      sources: [
        { label: 'c-TRAK TN — ctDNA surveillance in TNBC', pmid: '36423745' },
        { label: 'ZEST trial design', url: 'https://clinicaltrials.gov/ct2/show/NCT04915755' },
        { label: 'DARE trial — ASCO 2025 interim', url: 'https://clinicaltrials.gov/ct2/show/NCT04567420' },
      ],
      guidelines: 'No NCCN recommendation specific to breast cancer MRD yet. DARE and ZEST trial results expected to inform future guidelines. SERENA-6 provides first registrational clinical utility evidence.',
    },

    'not-in-guidelines': {
      forPatient: 'Breast cancer MRD testing isn\'t yet in the NCCN guidelines specifically, but it is in active clinical trials and the guidelines are expected to evolve as results come in. Many leading breast cancer centers are already using MRD testing in practice.',
      forDoctor: 'NCCN Breast Cancer guidelines do not yet include a specific ctDNA MRD recommendation, but this reflects the timing of evidence rather than negative data. However, the evidence landscape is shifting rapidly: DARE (ASCO 2025) showed ctDNA-guided treatment switching is feasible in HR+/HER2-, and SERENA-6 (ASCO 2025 plenary) provided the first registrational clinical utility data for ctDNA-guided therapy change in breast cancer. ZEST (interventional, ctDNA-guided escalation in TNBC/HR+) is expected to generate guideline-level evidence. In the interim, ctDNA testing is available as a prognostic tool and for clinical trial eligibility.',
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
      forDoctor: 'Actionable responses to ctDNA positivity in breast cancer depend on subtype: (1) TNBC: Consider capecitabine (CREATE-X extrapolation), immunotherapy rechallenge, or PARP inhibitor if BRCA-mutated. ZEST trial offers randomized escalation. (2) HR+/HER2-: DARE trial showed switching to palbociclib + fulvestrant achieved twofold higher ctDNA clearance vs. standard; consider CDK4/6 inhibitor addition, extended endocrine therapy, increased imaging frequency. SERENA-6 supports ctDNA-guided therapy switching. (3) HER2+: T-DXd or other anti-HER2 therapy. (4) All subtypes: Intensified surveillance, clinical trial enrollment (ZEST, DARE, others). Lead time from ctDNA detection to radiographic recurrence in breast cancer ranges from 6-12 months across studies.',
      stageNotes: {
        'stage-2': 'ctDNA positivity in stage II breast cancer post-treatment is uncommon but highly prognostic. Options include extended adjuvant therapy and intensified surveillance.',
        'stage-3': 'Stage III breast cancer with ctDNA positivity after neoadjuvant/adjuvant therapy is high risk. Consider clinical trial enrollment (ZEST) or subtype-specific escalation.',
      },
      sources: [
        { label: 'c-TRAK TN — lead time in TNBC', pmid: '36423745' },
        { label: 'ZEST trial — ctDNA-guided escalation', url: 'https://clinicaltrials.gov/ct2/show/NCT04915755' },
      ],
      guidelines: 'No formal guideline yet. ZEST trial provides a structured ctDNA-guided escalation framework.',
    },

    'not-validated': {
      forPatient: 'MRD tests are validated for breast cancer, with the strongest data in triple-negative breast cancer. Tests like Signatera and Guardant Reveal have published validation studies in breast cancer specifically.',
      forDoctor: 'Tumor-informed ctDNA assays (Signatera, RaDaR) have published analytical and clinical validation in breast cancer. Signatera has demonstrated high sensitivity for MRD detection in early-stage breast cancer (c-TRAK TN, observational cohorts). Sensitivity varies by subtype — highest in TNBC (higher ctDNA shedding) and lower in HR+/lobular histologies. Medicare coverage via MolDX extends to breast cancer for tumor-informed assays. Analytical considerations: tumor-informed approaches are preferred in breast cancer due to lower ctDNA fraction compared to CRC.',
      sources: [
        { label: 'Signatera breast cancer validation', pmid: '36423745' },
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
      forDoctor: 'IMpower010 (CheckMate 816 correlative) demonstrated ctDNA clearance post-surgery predicts benefit from adjuvant atezolizumab in stage IB-IIIA NSCLC. ctDNA-positive patients had significantly improved DFS with adjuvant immunotherapy vs. BSC. TRACERx (197 pts, 1,069 samples) demonstrated ultrasensitive ctDNA detection using PhasED-Seq (LOD95 1 ppm vs. 84 ppm CAPP-Seq; clinical sensitivity 67% vs. 28%, P=0.022) with median lead time of 164 days before clinical relapse. AEGEAN exploratory analysis (ASCO 2025) showed patients without ctDNA clearance during neoadjuvant treatment or with post-surgical MRD had worse outcomes with perioperative durvalumab. DART trial (ASCO 2025) showed detectable ctDNA during consolidative durvalumab predicts progression 7.4 months before radiological evidence. A meta-analysis of 13 studies (1,309 pts) confirmed longitudinal ctDNA monitoring as strongest prognostic signal (HR 8.70). Note: MERMAID-1/2 were discontinued in 2023 due to portfolio prioritization.',
      stageNotes: {
        'stage-1': 'Stage IA NSCLC has very low recurrence risk after surgery. MRD testing may identify the small subset who would benefit from adjuvant therapy.',
        'stage-2': 'Stage II NSCLC has moderate recurrence risk. IMpower010 included stage II patients. ctDNA positivity post-surgery can guide adjuvant immunotherapy decisions.',
        'stage-3': 'Stage IIIA NSCLC has the strongest rationale — high recurrence risk, multiple adjuvant options (chemo, immunotherapy), and ctDNA can identify who truly needs them.',
      },
      sources: [
        { label: 'IMpower010 — ctDNA and adjuvant atezolizumab', pmid: '37467930' },
        { label: 'TRACERx — ultrasensitive ctDNA in NSCLC', pmid: '37055640' },
        { label: 'TRACERx PhasED-Seq — Nature Medicine', url: 'https://www.nature.com/articles/s41591-024-03216-y' },
        { label: 'NSCLC ctDNA meta-analysis — JCO Precision Oncology 2025', url: 'https://ascopubs.org/doi/10.1200/PO-25-00489' },
        { label: 'AEGEAN MRD analysis — ASCO 2025', url: 'https://www.lungcancerstoday.com/post/how-mrd-status-affects-agean-trial-regimen-in-patients-with-resectable-nsclc' },
      ],
      guidelines: 'NCCN NSCLC guidelines acknowledge ctDNA as an emerging biomarker. MERMAID-1/2 discontinued; AEGEAN and other perioperative trials incorporate ctDNA endpoints.',
    },

    'not-in-guidelines': {
      forPatient: 'While NCCN doesn\'t have a specific MRD recommendation for lung cancer yet, major clinical trials are underway and leading lung cancer centers are already using MRD testing. The evidence is moving fast.',
      forDoctor: 'NCCN NSCLC Guidelines (v3.2025) reference ctDNA as an emerging tool but do not yet include a specific MRD recommendation. However: IMpower010 ctDNA correlative data provides Level I evidence for ctDNA-guided adjuvant immunotherapy selection. AEGEAN exploratory analysis (ASCO 2025) showed MRD status affects perioperative durvalumab outcomes. Note: MERMAID-1/2 (AstraZeneca) were discontinued in 2023 — the field awaits other prospective interventional data. ASCO and IASLC have highlighted ctDNA MRD in lung cancer as a priority research area. Multiple NCI-sponsored trials incorporate ctDNA endpoints.',
      stageNotes: {
        'stage-2': 'For resected stage II NSCLC, ctDNA testing is increasingly used to select patients for adjuvant immunotherapy (informed by IMpower010 ctDNA analysis).',
        'stage-3': 'Stage III NSCLC (especially IIIA) has the most clinical rationale for ctDNA-guided treatment. Multiple adjuvant options exist and ctDNA can guide selection.',
      },
      sources: [
        { label: 'NCCN NSCLC Guidelines v3.2025', url: 'https://www.nccn.org/guidelines/guidelines-detail?category=1&id=1450' },
        { label: 'IMpower010 ctDNA analysis', pmid: '37467930' },
        { label: 'AEGEAN MRD analysis — ASCO 2025', url: 'https://www.lungcancerstoday.com/post/how-mrd-status-affects-agean-trial-regimen-in-patients-with-resectable-nsclc' },
      ],
      guidelines: 'Not yet a specific NCCN recommendation. IMpower010 provides Level I ctDNA evidence. MERMAID-1/2 discontinued; AEGEAN and perioperative trials advancing.',
    },

    'what-to-do-positive': {
      forPatient: 'A positive MRD test in lung cancer gives your doctor a head start. It may mean starting immunotherapy sooner, adjusting your treatment plan, or qualifying for clinical trials — all before a scan shows any recurrence.',
      forDoctor: 'Actionable responses to ctDNA positivity in resected NSCLC: (1) Adjuvant immunotherapy — IMpower010 data supports preferential atezolizumab benefit in ctDNA+ patients. Consider adjuvant nivolumab (CheckMate 816) or pembrolizumab (KEYNOTE-091). AEGEAN data supports perioperative durvalumab benefit correlating with MRD clearance. (2) Adjuvant chemo if not yet given — ctDNA positivity identifies high-risk patients who benefit from platinum doublet. (3) Targeted therapy — if driver mutation detected (EGFR: osimertinib per ADAURA; ALK: alectinib per ALINA), ctDNA can guide initiation. (4) Intensified surveillance — serial ctDNA + imaging q3 months. DART trial showed ctDNA predicts progression 7.4 months before imaging. (5) Clinical trials enrolling ctDNA+ NSCLC patients. Lead time: TRACERx showed median 164-day lead time with ultrasensitive PhasED-Seq assay.',
      stageNotes: {
        'stage-1': 'Stage I ctDNA positivity post-surgery is rare but prognostically significant. Consider adjuvant therapy discussion — ADAURA included stage IB EGFR+ patients.',
        'stage-2': 'Stage II ctDNA+ patients may benefit from adjuvant immunotherapy (IMpower010) or targeted therapy (ADAURA for EGFR+, ALINA for ALK+).',
        'stage-3': 'Stage IIIA ctDNA positivity post-surgery strongly argues for adjuvant treatment. Multiple options: immunotherapy, chemo, or targeted therapy based on molecular profile.',
      },
      sources: [
        { label: 'TRACERx — lead time in NSCLC', pmid: '37055640' },
        { label: 'IMpower010 — adjuvant atezolizumab', pmid: '37467930' },
        { label: 'ADAURA — adjuvant osimertinib', pmid: '32955177' },
      ],
      guidelines: 'NCCN recommends adjuvant osimertinib (EGFR+), nivolumab, pembrolizumab, and atezolizumab for resected NSCLC. ctDNA can guide selection.',
    },

    'not-validated': {
      forPatient: 'MRD tests are validated for lung cancer. Major trials like TRACERx and IMpower010 used ctDNA testing in lung cancer patients, and Medicare covers MRD tests for lung cancer.',
      forDoctor: 'ctDNA MRD assays validated in NSCLC include: Signatera (tumor-informed, validated in TRACERx cohort; Signatera Genome WGS-based assay shows strong prognostic value in NSCLC per ASCO 2025), FoundationOne Tracker (tumor-informed), Guardant Reveal (tumor-naive, methylation-based). Ultrasensitive approaches like PhasED-Seq (TRACERx) achieve LOD95 of 1 ppm with 67% clinical sensitivity vs. 28% for standard SNV-based methods. Analytical sensitivity in NSCLC is generally good for squamous histology and adenocarcinoma, though lower ctDNA shedding in some early-stage adenocarcinomas may reduce sensitivity. Medicare coverage via MolDX extends to NSCLC for tumor-informed assays.',
      sources: [
        { label: 'TRACERx — Signatera validation in NSCLC', pmid: '37055640' },
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
      forPatient: 'There is strong evidence for MRD testing in bladder cancer. The IMvigor011 trial — presented at a major international conference and published in the New England Journal of Medicine — showed that giving immunotherapy to patients with a positive ctDNA test after surgery significantly improved survival. This is a landmark result: the first proof that acting on a positive MRD test helps patients live longer.',
      forDoctor: 'IMvigor011 (Powles et al., NEJM; ESMO 2025 Presidential Symposium) is the landmark Phase III trial: 761 patients in ctDNA surveillance, 250 ctDNA+ randomized (2:1) to adjuvant atezolizumab vs. placebo. Median DFS 9.9 vs. 4.8 months (HR 0.64; P=0.0047). Median OS 32.8 vs. 21.1 months. 12-month DFS 44.7% vs. 30.0%; 12-month OS 85.1% vs. 70.0%. ctDNA-negative patients had 12-month DFS of 95.4% and 12-month OS of 100%. This is the first Level 1 evidence for intervening on positive ctDNA in an adjuvant setting in any cancer type. Natera submitted FDA PMA for Signatera CDx in MIBC (Feb 2026). ASCO GU 2026: INDIBLADE and RETAIN trials showed ctDNA clearance after neoadjuvant therapy associated with better survival even with bladder-sparing strategies.',
      sources: [
        { label: 'Powles et al., NEJM 2024 — IMvigor011', pmid: '41124204' },
      ],
      guidelines: 'IMvigor011 provides Level I evidence for ctDNA-guided adjuvant immunotherapy in bladder cancer.',
    },

    'not-in-guidelines': {
      forPatient: 'Bladder cancer MRD testing is expected to enter the NCCN guidelines soon. IMvigor011 provided the highest level of evidence — a randomized Phase III trial — and the FDA is now reviewing the companion diagnostic test (Signatera) for bladder cancer.',
      forDoctor: 'NCCN Bladder Cancer guidelines do not yet include a specific ctDNA recommendation, but IMvigor011 (Powles et al., NEJM; ESMO 2025 Presidential) provides Phase III randomized evidence for ctDNA-guided adjuvant atezolizumab in MIBC with significant DFS (HR 0.64, P=0.0047) and OS benefit. This is expected to be incorporated in upcoming guideline updates. Natera submitted Signatera CDx PMA to FDA (Feb 2026) based on IMvigor011 data. The EAU guidelines reference ctDNA as a promising biomarker for MIBC management.',
      sources: [
        { label: 'Powles et al., NEJM 2024 — IMvigor011', pmid: '41124204' },
      ],
      guidelines: 'Phase III evidence (IMvigor011) expected to drive guideline updates. EAU references ctDNA in MIBC.',
    },

    'what-to-do-positive': {
      forPatient: 'A positive MRD test in bladder cancer means your care team can consider starting immunotherapy — even before a scan shows recurrence. IMvigor011 showed this approach works.',
      forDoctor: 'ctDNA positivity post-cystectomy in MIBC: (1) Adjuvant immunotherapy — IMvigor011 showed DFS (HR 0.64) and OS benefit for atezolizumab in ctDNA+ patients (median OS 32.8 vs. 21.1 months). Consider nivolumab (CheckMate 274) as alternative. (2) Bladder-sparing approaches — ASCO GU 2026 data (INDIBLADE, RETAIN) showed ctDNA clearance after neoadjuvant therapy supports bladder-sparing strategies. (3) Intensified surveillance — serial ctDNA + imaging. (4) MODERN trial (Phase 2/3, ctDNA-guided treatment in urothelial carcinoma, completion expected 2026). (5) Erdafitinib or other targeted therapy if FGFR alterations detected.',
      sources: [
        { label: 'Powles et al., NEJM 2024', pmid: '41124204' },
      ],
      guidelines: 'IMvigor011 supports adjuvant atezolizumab in ctDNA+ MIBC post-cystectomy.',
    },

    'not-validated': {
      forPatient: 'MRD tests are validated for bladder cancer. Signatera and other tests have been used in major bladder cancer clinical trials.',
      forDoctor: 'Tumor-informed ctDNA assays (Signatera, primary assay in IMvigor010/011) have clinical validation in MIBC. Natera submitted FDA PMA for Signatera CDx in MIBC (Feb 2026) — the first ctDNA companion diagnostic PMA for any cancer type based on interventional data. Analytical sensitivity is generally high in bladder cancer due to elevated ctDNA shedding. Myriad Precise MRD also showed high sensitivity across bladder and urothelial cancer (ASCO GU 2026). Medicare coverage via MolDX extends to bladder cancer.',
      sources: [
        { label: 'Powles et al., NEJM 2024 — Signatera in MIBC', pmid: '41124204' },
      ],
      guidelines: 'Medicare covers tumor-informed ctDNA in bladder cancer via MolDX.',
    },
  },

  /* ═══════════════════════════════════════════
   *  MELANOMA — Tier 2
   * ═══════════════════════════════════════════ */
  melanoma: {
    'no-evidence': {
      forPatient: 'There is growing evidence for MRD testing in melanoma. A 5-year study of nearly 600 stage III melanoma patients (COMBI-AD, published in Lancet Oncology 2026) showed that ctDNA-positive patients had nearly 3 times the risk of recurrence, and about 80% of them eventually had their cancer return. This is the strongest melanoma-specific MRD data to date.',
      forDoctor: 'ctDNA MRD in melanoma: The COMBI-AD biomarker analysis (Lancet Oncology 2026, PMID 40250457) is the most comprehensive dataset — 597 stage III melanoma patients with 60-month median follow-up. Baseline ctDNA detection rate: 13% (79/597). ctDNA+ recurrence risk: HR 2.91 (placebo, P<0.0001); HR 2.98 (targeted therapy, P<0.0001). ~80% of ctDNA+ patients recurred; disease returned >4x faster than ctDNA-. ctDNA concentration was more reliable than substage or tissue measures at 5 years. Lee et al. demonstrated ctDNA dynamics during adjuvant immunotherapy correlate with clinical outcomes. In stage IV, pre-ICI ctDNA positivity is 91.7%; 6-month clearance (47.4%) associated with improved PFS (HR 10.0, P=0.03). DETECTION trial (NCT04901988) is an ongoing phase II/III in stage IIB/C.',
      sources: [
        { label: 'COMBI-AD biomarker analysis — Lancet Oncol 2026', pmid: '40250457' },
        { label: 'Lee et al. — ctDNA in resected melanoma', pmid: '39169411' },
      ],
      guidelines: 'No specific NCCN recommendation yet. COMBI-AD provides the strongest prognostic validation (5-year, N=597). DETECTION trial in progress.',
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
      forDoctor: 'ctDNA positivity in resected melanoma: (1) Adjuvant immunotherapy — COMBI-AD showed ctDNA+ patients have HR ~2.9 for recurrence regardless of treatment arm; consider initiating or extending nivolumab/pembrolizumab. (2) Adjuvant targeted therapy — if BRAF V600 mutated, consider dabrafenib/trametinib; COMBI-AD validated ctDNA prognostic value in this setting. (3) Intensified surveillance — serial ctDNA + imaging q3 months; ctDNA concentration is more predictive than substage at 5 years. (4) In stage IV, 6-month ctDNA clearance on immunotherapy is strongly associated with improved PFS (HR 10.0, 2-year PFS 89% vs. 30%). (5) Clinical trial enrollment — DETECTION trial (NCT04901988) in stage IIB/C.',
      sources: [
        { label: 'COMBI-AD — Lancet Oncol 2026', pmid: '40250457' },
        { label: 'Lee et al. — ctDNA-guided melanoma management', pmid: '39169411' },
      ],
      guidelines: 'NCCN recommends adjuvant nivolumab or pembrolizumab for resected stage III-IV melanoma. ctDNA can guide timing and selection.',
    },

    'not-validated': {
      forPatient: 'MRD tests are validated for melanoma. The COMBI-AD trial (nearly 600 patients, 5-year follow-up) used ctDNA testing successfully in stage III melanoma. Signatera and other tests have published data in melanoma patients, and Medicare coverage applies.',
      forDoctor: 'Tumor-informed ctDNA assays (Signatera) have published analytical validation in melanoma. COMBI-AD (Lancet Oncol 2026, N=597) provides the most comprehensive clinical validation — 5-year data showing ctDNA concentration is a reliable predictor of survival at baseline. ctDNA shedding in melanoma is variable but detectable at baseline in ~13% of stage III and >90% of stage IV patients. Medicare coverage via MolDX extends to melanoma for tumor-informed assays.',
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
      forDoctor: 'ctDNA MRD detection is biologically valid across solid tumors — tumor DNA shedding into circulation is a universal cancer phenomenon. The deepest clinical utility evidence exists in CRC (DYNAMIC 5-year, ALTAIR interventional, GALAXY), breast (DARE, SERENA-6, c-TRAK TN), NSCLC (IMpower010, TRACERx, AEGEAN), bladder (IMvigor011 — first Level 1 interventional evidence), and melanoma (COMBI-AD 5-year). Signatera SINERGY trial (Feb 2026) showed successful Phase 2 readout in head and neck cancer, expanding the evidence base. Tumor-informed assays (Signatera, RaDaR) have pan-cancer analytical validation. Key consideration: ctDNA shedding rates vary by tumor type, histology, and stage, affecting analytical sensitivity.',
      sources: [
        { label: 'Tie et al., NEJM 2022 — CRC landmark', pmid: '35657320' },
        { label: 'Powles et al., NEJM 2024 — bladder', pmid: '41124204' },
      ],
      guidelines: 'Evidence strongest in CRC, breast, lung, bladder. Pan-cancer validation data exists for tumor-informed assays.',
    },

    'not-in-guidelines': {
      forPatient: 'MRD testing is already in the NCCN guidelines for colorectal cancer, and other cancer types are catching up as clinical trial results come in. Even where guidelines haven\'t yet caught up, many oncologists are already using MRD testing based on the available evidence.',
      forDoctor: 'NCCN includes ctDNA MRD recommendations for CRC (Category 2A, stage II; v1.2026 formally recognizes ctDNA as a high-risk factor). NCCN Merkel Cell Carcinoma (v1.2026) includes ctDNA for disease burden assessment with q3-month surveillance. ASCO PCO (2024) covers CRC stage II-III. For other tumor types, ctDNA MRD is available as a prognostic tool, for clinical trial eligibility, and is covered by Medicare (MolDX) for tumor-informed assays across solid tumors. The absence of a tumor-specific guideline reflects timing of evidence generation, not negative data.',
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
      forDoctor: 'Tumor-informed ctDNA assays (Signatera — FDA PMA submitted for MIBC Feb 2026, Signatera Genome WGS-based launched 2025; FoundationOne Tracker; RaDaR) have pan-cancer analytical validation with published data across CRC, breast, NSCLC, bladder, melanoma, head and neck (SINERGY), ovarian, gastric, pancreatic, and other solid tumors. Tumor-naive assays (Guardant Reveal — COSMOS specificity 98.2%, median lead time 5.3 months; validated in largest stage III CRC MRD study, JCO Feb 2026) continue expanding. Key variable: analytical sensitivity depends on ctDNA shedding rate, which varies by tumor type, stage, and histology. Ultrasensitive approaches (PhasED-Seq: LOD95 1 ppm) can increase clinical sensitivity 2.1-fold. For low-shedding tumors, tumor-informed approaches are preferred. Medicare MolDX coverage applies to tumor-informed assays across solid tumors.',
      sources: [
        { label: 'CMS MolDX LCD L39256', url: 'https://www.cms.gov/medicare-coverage-database' },
      ],
      guidelines: 'Medicare covers tumor-informed ctDNA MRD across solid tumors via MolDX LCD L39256.',
    },
  },
};
