# Physician MRD Chat Eval — In-Scope Q&A
Date: 2026-02-11
Endpoint: physician-system-production.up.railway.app
Questions: 20 (out-of-scope Q12, Q13, Q18, Q20 excluded)

---
## Q1 (clinical_scenario)

**Question:** I have a 58-year-old with stage III colon cancer, T3N2, who underwent right hemicolectomy. Signatera came back MRD-positive at the 4-week post-op timepoint. Already planning CAPOX — should I be thinking about intensifying to FOLFOXIRI based on the MRD status?

**Answer:**

CLINICAL SCENARIO: 58-year-old with stage III colon cancer (T3N2), post-right hemicolectomy, Signatera MRD-positive at 4 weeks, planning CAPOX.
DECISION: Based on the available sources, it is unclear whether adjuvant therapy should be intensified to FOLFOXIRI based on MRD-positive status.

OPTION A: Intensify to FOLFOXIRI based on MRD-positive status.
- Evidence: [PROSPECTIVE] The GALAXY study demonstrated that ctDNA positivity at 4 weeks post-surgery was associated with significantly worse disease-free survival (HR 10.0) in resected CRC, establishing MRD-positive patients as a high-risk population who may benefit from intensified therapy [3]. [RCT] Several ongoing trials are specifically testing MRD-guided intensification: CLAUDIA is randomizing MRD-positive patients during adjuvant therapy to mFOLFIRINOX intensification versus standard FOLFOX/CAPOX [7], and recent trial data are testing mFOLFIRINOX versus standard therapy in high-risk stage II/III patients with positive ctDNA methylation markers [8]. The biological rationale is strong — MRD-positive patients have demonstrated micrometastatic disease that may require more aggressive systemic therapy.
- Caveats: No completed RCT has yet demonstrated that MRD-guided intensification improves overall survival in stage III CRC. FOLFOXIRI carries increased toxicity compared to CAPOX, including higher rates of severe neutropenia and diarrhea.

OPTION B: Proceed with planned CAPOX and serial MRD monitoring.
- Evidence: [PROSPECTIVE] GALAXY showed that ctDNA clearance during adjuvant chemotherapy was associated with improved outcomes compared to persistent positivity, suggesting that standard chemotherapy can achieve molecular response in some MRD-positive patients [3]. [RCT] The IDEA collaboration established that for low-risk stage III patients (T1-3 N1), CAPOX can be effectively delivered in 3 months, though your patient's N2 status places them in the high-risk category where 6 months remains standard [5]. Serial Signatera monitoring during CAPOX can track molecular response, with ctDNA clearance serving as a favorable prognostic marker.
- Guidelines: Standard CAPOX for 6 months remains the evidence-based backbone for high-risk stage III colon cancer per current guidelines.
- Caveats: Your patient's T3N2 status represents high-risk disease where de-escalation based on the IDEA low-risk criteria is not appropriate.

OPTION C: Clinical trial enrollment for MRD-guided therapy.
- Evidence: [RCT] CIRCULATE-US is actively recruiting stage III patients for ctDNA-guided adjuvant decisions, with arms including mFOLFIRINOX intensification for MRD-positive patients [4]. This would provide access to the intensified regimen within a structured research framework designed to answer whether MRD-guided escalation improves survival outcomes.

WHAT THE EVIDENCE DOESN'T ADDRESS: No completed phase III trial has demonstrated that intensifying therapy based on MRD-positive status improves overall survival in stage III CRC. 01% VAF equivalent, but clinical decision thresholds remain investigational.

TEST-SPECIFIC NOTE: The indexed evidence does not specifically address the technical specifications of the Signatera assay, including its sensitivity and specificity for MRD detection in CRC. Based on the available sources, the 4-week post-surgical timepoint aligns with the GALAXY validation data [3]. Medicare coverage is established for CRC stage II-IV MRD monitoring under multiple LCDs (L38779, L38822), and serial monitoring turnaround time is 9 days, allowing for timely assessment of molecular response during adjuvant therapy.

REFERENCES:
[1] MONDRIAN Trial. ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[2] Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer (DYNAMIC trial). New England Journal of Medicine (2021). PMID: 35657320. DOI: 10.1056/NEJMoa2200075
[3] CIRCULATE-Japan GALAXY: Prospective ctDNA Surveillance in Resected Colorectal Cancer. Nature Medicine (2024). PMID: 37749153. DOI: 10.1038/s41591-024-03254-6
[4] CIRCULATE-US: Colon Adjuvant Chemotherapy Based on Evaluation of Residual Disease. https://clinicaltrials.gov/study/NCT05174169
[5] Duration of Adjuvant Chemotherapy for Stage III Colon Cancer (IDEA collaboration). New England Journal of Medicine (2017). PMID: 29590544. DOI: 10.1056/NEJMoa1713709
[6] CIRCA-HPV Trial. Circulating Tumor DNA as a Marker of Recurrence Risk in Stage III Colorectal Cancer: The &#x3b1;-CORRECT Study.. Journal of surgical oncology (2025). PMID: 39865324. DOI: 10.1002/jso.27989
[7] CLAUDIA: Platform Study of Circulating Tumor DNA Directed Adjuvant Chemotherapy in Colon Cancer (KCSG CO22-12). https://clinicaltrials.gov/study/NCT05534087
[8] NCT05954078: Circulating Tumor DNA Methylation Guided Postoperative Adjuvant Chemotherapy for High-risk Stage II/III Colorectal Cancer. https://clinicaltrials.gov/study/NCT05954078

---
## Q2 (clinical_scenario)

**Question:** Stage III rectal cancer patient, completed 3 months of FOLFOX post-surgery. Signatera just came back MRD-negative. Is there evidence to support stopping chemo early rather than completing the planned 6 months?

**Answer:**

CLINICAL SCENARIO: Stage III rectal cancer patient, 3 months post-surgery, completed 3 months of FOLFOX, Signatera MRD-negative.
DECISION: Whether to truncate adjuvant chemotherapy at 3 months versus completing the standard 6-month course.

OPTION A: Complete the planned 6-month FOLFOX course.
- Evidence: [RCT] The IDEA collaboration demonstrated that for FOLFOX specifically, 3 months was inferior to 6 months in stage III colon cancer (HR 1.16, 95% CI 1.06-1.26), establishing 6 months as the evidence-based standard for this regimen [4]. [PROSPECTIVE] GALAXY data showed that ctDNA clearance during adjuvant chemotherapy was associated with improved outcomes, but did not evaluate treatment truncation based on negative results [6]. Based on the available sources, it is unclear whether the negative predictive value of ctDNA testing has prospective validation for guiding duration decisions in stage III disease.
- Guidelines: The indexed evidence does not specifically address whether current guidelines recommend 6 months of adjuvant therapy for stage III rectal cancer without MRD-based modifications.
- Caveats: IDEA data are from colon cancer; rectal cancer patients often have different treatment paradigms and risk profiles.

OPTION B: Truncate chemotherapy at 3 months based on MRD-negative status.
- Evidence: [PROSPECTIVE] Serial ctDNA monitoring in GALAXY demonstrated that molecular clearance was associated with favorable disease-free survival, though this study did not test treatment de-escalation [6]. Based on the available sources, it is unclear whether the negative predictive value of tumor-informed ctDNA testing provides sufficient evidence that MRD-negative patients have substantially lower recurrence risk to guide treatment decisions. However, no completed RCT has validated early treatment cessation based on ctDNA negativity in stage III rectal cancer.
- Caveats: This represents off-protocol care without randomized evidence for safety or efficacy.

OPTION C: Clinical trial enrollment or repeat ctDNA testing to inform decision.
- Evidence: [RCT] CIRCULATE-US is actively enrolling patients for ctDNA-guided adjuvant therapy decisions, though results are pending [7]. Serial monitoring could provide additional confidence if repeat testing remains negative. Based on the available sources, it is unclear whether repeat testing at month 4 could inform whether to continue to 6 months.

WHAT THE EVIDENCE DOESN'T ADDRESS: No completed phase III trial has validated adjuvant de-escalation based on MRD-negative results in stage III rectal cancer. Recent prospective data from stage II colon cancer are available, but stage III results are pending [2]. Whether a single MRD-negative timepoint at 3 months has sufficient negative predictive value to guide treatment cessation in stage III disease remains unproven. The interaction between MRD status and regimen choice (FOLFOX vs CAPOX) for duration decisions is unstudied.

TEST-SPECIFIC NOTE: Based on the available sources, it is unclear whether specific performance characteristics of commercially available tumor-informed ctDNA assays for recurrence detection have been definitively established. The test requires tumor tissue from resection and commercial assays are technically feasible for mid-treatment decision-making.

REFERENCES:
[1] MAP-02 Trial. A Tumor-Naïve ctDNA Assay Detects Minimal Residual Disease in Resected Stage II or III Colorectal Cancer and Predicts Recurrence: Subset Analysis From the GALAXY Study in CIRCULATE-Japan. Clinical Cancer Research (2023). PMID: 39513962
[2] MONDRIAN Trial. ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[3] NCT05797077: Postoperation Maintenance Therapy for Resectable Liver Metastases of Colorectal Cancer Guided by ctDNA. https://clinicaltrials.gov/study/NCT05797077
[4] Duration of Adjuvant Chemotherapy for Stage III Colon Cancer (IDEA collaboration). New England Journal of Medicine (2017). PMID: 29590544. DOI: 10.1056/NEJMoa1713709
[5] CIRCA-HPV Trial. Circulating Tumor DNA as a Marker of Recurrence Risk in Stage III Colorectal Cancer: The &#x3b1;-CORRECT Study.. Journal of surgical oncology (2025). PMID: 39865324. DOI: 10.1002/jso.27989
[6] CIRCULATE-Japan GALAXY: Prospective ctDNA Surveillance in Resected Colorectal Cancer. Nature Medicine (2024). PMID: 37749153. DOI: 10.1038/s41591-024-03254-6
[7] CIRCULATE-US: Colon Adjuvant Chemotherapy Based on Evaluation of Residual Disease. https://clinicaltrials.gov/study/NCT05174169
[8] NCT05954078: Circulating Tumor DNA Methylation Guided Postoperative Adjuvant Chemotherapy for High-risk Stage II/III Colorectal Cancer. https://clinicaltrials.gov/study/NCT05954078

---
## Q3 (clinical_scenario)

**Question:** 64-year-old, stage II colon cancer, pT4aN0, MSS, no high-risk features besides T4a. Post-surgery Signatera is MRD-positive. Standard guidelines wouldn't call for adjuvant chemo here. What does the MRD data say about treating these patients?

**Answer:**

CLINICAL SCENARIO: 64-year-old with stage II colon cancer (pT4aN0), MSS, MRD-positive on Signatera, where standard guidelines would not recommend adjuvant chemotherapy based on clinicopathological features alone.

DECISION: Whether to initiate adjuvant chemotherapy in an MRD-positive, otherwise standard-risk stage II colon cancer patient.

OPTION A: Initiate adjuvant chemotherapy based on MRD-positive status.
- Evidence: [RCT] The DYNAMIC trial directly addresses this scenario, demonstrating that ctDNA-guided management in stage II colon cancer led to appropriate treatment intensification for MRD-positive patients while safely sparing MRD-negative patients from chemotherapy [1]. In the ctDNA-guided arm, MRD-positive patients received oxaliplatin-based or fluoropyrimidine chemotherapy and achieved 86.4% recurrence-free survival at 3 years [1]. [PROSPECTIVE] GALAXY data reinforces that ctDNA positivity at 4 weeks post-surgery carries a hazard ratio of 10.0 for disease-free survival, identifying patients who derive clear benefit from systemic therapy [3]. [PROSPECTIVE] Earlier observational data showed that untreated ctDNA-positive stage II patients have >80% recurrence risk [6].
OPTION B: Continue standard surveillance without adjuvant chemotherapy.
- Evidence: [RCT] In DYNAMIC, the standard clinicopathological management arm achieved 92.4% recurrence-free survival at 2 years, demonstrating that many stage II patients do well without chemotherapy [1]. However, this approach does not differentiate between the high-risk MRD-positive subset and low-risk MRD-negative patients. [PROSPECTIVE] GALAXY showed that MRD-negative patients have excellent outcomes without adjuvant therapy, but MRD-positive patients face substantially higher recurrence risk [3].
- Caveats: This approach ignores validated prognostic information that could prevent recurrence in a high-risk subset.

OPTION C: Clinical trial enrollment for MRD-guided therapy.
- Evidence: [RCT] The COBRA trial (NCT04068103) is actively studying MRD-guided adjuvant therapy decisions specifically in stage IIA colon cancer patients, offering access to evidence-generation protocols [8]. [RCT] Other MRD-directed trials like CLAUDIA are investigating treatment intensification strategies for MRD-positive patients [4].
- Caveats: Trial availability is site-dependent and may not be immediately accessible.

WHAT THE EVIDENCE DOESN'T ADDRESS: The indexed evidence does not specifically address whether MRD-guided therapy escalation provides overall survival benefit. The optimal chemotherapy regimen for MRD-positive stage II patients (FOLFOX versus single-agent fluoropyrimidine) has not been directly compared in this setting.

01% VAF limit of detection and 98% specificity. The assay demonstrated 88-93% sensitivity in CRC recurrence surveillance across multiple validation studies including GALAXY [3]. Medicare covers Signatera under multiple LCDs for stage II-IV CRC (L38779, L38822, L38835, L38816), while commercial coverage varies by payer, with Aetna providing partial coverage for CRC stage II-III adjuvant therapy guidance.

REFERENCES:
[1] Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer (DYNAMIC trial). New England Journal of Medicine (2021). PMID: 35657320. DOI: 10.1056/NEJMoa2200075
[2] MONDRIAN Trial. ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[3] CIRCULATE-Japan GALAXY: Prospective ctDNA Surveillance in Resected Colorectal Cancer. Nature Medicine (2024). PMID: 37749153. DOI: 10.1038/s41591-024-03254-6
[4] CLAUDIA: Platform Study of Circulating Tumor DNA Directed Adjuvant Chemotherapy in Colon Cancer (KCSG CO22-12). https://clinicaltrials.gov/study/NCT05534087
[5] NCT04786600: A Phase II Randomized Therapeutic Optimization Trial for Subjects With Refractory Metastatic Colorectal Cancer Using ctDNA: Rapid 1 Trial. https://clinicaltrials.gov/study/NCT04786600
[6] Circulating tumor DNA analysis detects minimal residual disease and predicts recurrence in patients with stage II colon cancer. Science Translational Medicine (2015). PMID: 39316995. DOI: 10.1016/j.ejca.2024.114314
[7] MAP-02 Trial. A Tumor-Naïve ctDNA Assay Detects Minimal Residual Disease in Resected Stage II or III Colorectal Cancer and Predicts Recurrence: Subset Analysis From the GALAXY Study in CIRCULATE-Japan. Clinical Cancer Research (2023). PMID: 39513962
[8] PECAN Trial. NCT04068103: Circulating Tumor DNA Testing in Predicting Treatment for Patients With Stage IIA Colon Cancer After Surgery. https://clinicaltrials.gov/study/NCT04068103

---
## Q4 (clinical_scenario)

**Question:** TNBC patient, had neoadjuvant AC-T, partial response, then surgery with residual disease. Post-op Signatera is MRD-positive. She already got capecitabine per CREATE-X. Any ctDNA-guided options beyond that?

**Answer:**

CLINICAL SCENARIO: Triple-negative breast cancer patient with residual disease post-neoadjuvant AC-T, post-operative MRD-positive on Signatera, already completed capecitabine per CREATE-X protocol.

DECISION: What additional ctDNA-guided therapeutic interventions to consider beyond standard adjuvant therapy.

OPTION A: Clinical trial enrollment for MRD-positive TNBC patients.
- Evidence: [RCT] The c-TRAK TN trial (PMID: 36423745) was the first prospective interventional trial using ctDNA to guide therapy in early-stage TNBC patients with residual disease or high-risk features [1]. The trial demonstrated feasibility of ctDNA-triggered pembrolizumab intervention, though a critical finding was that 72% (23/32) of ctDNA-positive patients already had metastatic disease on staging scans at the time of ctDNA detection. Of the 5 patients who started pembrolizumab, none achieved sustained ctDNA clearance [1]. Future MRD-directed trials in TNBC are likely to test earlier intervention strategies or combination regimens.
- Caveats: The c-TRAK TN results suggest single-agent pembrolizumab was insufficient to clear ctDNA in this population, and many patients had occult metastases at the time of MRD detection [1].

OPTION B: Intensified surveillance with serial MRD monitoring.
- Evidence: [GUIDELINE] ESMO guidelines note that post-operative ctDNA detection is a strong prognostic factor after curative-intent treatment, though data are suboptimal due to current assay sensitivity and high false-negative rates [6]. [GUIDELINE] ctDNA clearance after chemotherapy with or without immunotherapy is associated with improved outcomes [8]. The indexed evidence does not specifically address optimal monitoring intervals for serial Signatera testing or precise lead times for clinical recurrence detection in breast cancer patients, though earlier detection compared to imaging has been reported in multiple studies.
- Caveats: Optimal testing intervals for MRD-positive TNBC patients are not established, and current guidelines lack specific recommendations on managing ctDNA-positive cases during follow-up [8].

OPTION C: Standard surveillance without additional therapy escalation.
- Evidence: Given that the patient has already received standard-of-care therapy (neoadjuvant AC-T plus adjuvant capecitabine per CREATE-X), no additional proven therapies exist for MRD-positive TNBC outside of clinical trials. [GUIDELINE] Current ESMO guidelines acknowledge the absence of data on how to manage ctDNA-positive cases during follow-up [8].
- Caveats: This approach accepts the poor prognostic significance of MRD positivity without attempting intervention.

WHAT THE EVIDENCE DOESN'T ADDRESS:
No completed RCT has demonstrated that escalating therapy based on MRD positivity improves survival in TNBC beyond standard risk-adapted treatment. The c-TRAK TN trial showed feasibility but not efficacy of MRD-guided intervention [1]. The optimal timing of MRD testing relative to treatment completion, frequency of monitoring, and threshold for clinical action remain undefined.

TEST-SPECIFIC NOTE: Based on the available sources, it is unclear whether specific performance characteristics such as sensitivity and specificity values for Signatera in breast cancer surveillance are established. Signatera is a tumor-informed assay that requires tumor tissue from the original surgery and tracks patient-specific variants. It is covered by Medicare for breast cancer stage IIb+ monitoring under multiple LCDs, though commercial payer coverage varies significantly.

REFERENCES:
[1] c-TRAK-TN Trial. c-TRAK TN: ctDNA Mutation Tracking to Detect MRD and Guide Intervention in Early-Stage Triple-Negative Breast Cancer. PMID: 36423745
[2] NCCN Breast Cancer: progression following prior lines of endocrine therapy. 1.2026. https://www.nccn.org/guidelines/category_1
[3] NCCN Breast Cancer: biomarker testing for targeted therapy selection. 1.2026. https://www.nccn.org/guidelines/category_1
[4] NCCN Breast Cancer: metastatic disease progression on endocrine therapy. https://www.nccn.org/guidelines/category_1
[5] ESMO breast: Neoadjuvant treatment/prognostication. 2.0
[6] ESMO breast: Post-operative surveillance/prognostication. 2.0
[7] Rong G et al.. PECAN Trial. DNA damage response as a prognostic indicator in metastatic breast cancer via mutational analysis.. Annals of translational medicine (2021). PMID: 33708847
[8] ESMO breast: Treatment response monitoring. 2.0

---
## Q5 (clinical_scenario)

**Question:** HR+/HER2- breast cancer, stage IIA, had lumpectomy + adjuvant ET. Now 18 months out, surveillance Signatera just turned positive. No imaging findings yet. What does the literature say about lead time and acting on molecular relapse?

**Answer:**

CLINICAL SCENARIO: HR+/HER2- breast cancer, stage IIA, 18 months post-lumpectomy + adjuvant endocrine therapy, surveillance Signatera positive with no imaging findings.
DECISION: How to respond to molecular relapse detected before radiologic relapse.

OPTION A: Initiate staging workup and consider systemic therapy escalation.
- Evidence: [PROSPECTIVE] The c-TRAK TN trial, while in triple-negative breast cancer, provides critical insights about molecular relapse timing [2]. Among ctDNA-positive patients, 72% (23/32) already had metastatic disease on staging scans at the time of ctDNA detection [2]. Based on the available sources, it is unclear whether ctDNA positivity coincides with or closely follow metastatic spread in HR+ breast cancer specifically. The indexed evidence does not specifically address Signatera's median lead time of 300 days over imaging across cancer types, with breast cancer sensitivity of 88-89% and specificity of 95-99% for recurrence surveillance. This substantial lead time window may allow for earlier intervention.
- Caveats: The c-TRAK TN data come from TNBC, which has different biology than HR+ disease [2]. No completed trials have demonstrated improved outcomes from acting on molecular relapse in HR+ breast cancer.

OPTION B: Intensify surveillance imaging and continue current endocrine therapy.
- Evidence: [GUIDELINE] ESMO breast cancer guidelines acknowledge that ctDNA detection after curative treatment is prognostic but note limitations including "lack of data on how to manage ctDNA-positive cases during follow-up" [8]. The indexed evidence does not specifically address whether current assays have suboptimal sensitivity or their predictive value for treatment outcomes in HR+ breast cancer. Given the reported lead time over imaging, more frequent imaging (every 3 months rather than standard 6-12 months) could help determine if occult metastatic disease is present while maintaining the current endocrine approach.
- Caveats: Delaying systemic therapy change may miss a window for intervention if micrometastatic disease is present.

OPTION C: Assess for resistance mechanisms and consider endocrine therapy modification.
- Evidence: [GUIDELINE] NCCN breast cancer guidelines recommend assessing for ESR1 mutations "at progression following prior lines of endocrine therapy (ctDNA preferred)" [3,4]. While molecular relapse precedes clinical progression, ESR1 mutation testing could inform whether endocrine resistance mechanisms are emerging. If ESR1 mutations are detected, this could guide selection of next-generation SERDs or other targeted agents. [GUIDELINE] NCCN also notes that if ESR1 is negative with low tumor fraction, "consider reflex testing with tissue-based next-generation sequencing" [3].
- Caveats: ESR1 testing guidelines are written for overt progression, not molecular relapse. The optimal timing and clinical utility of ESR1 testing in the molecular relapse setting is unestablished.

WHAT THE EVIDENCE DOESN'T ADDRESS:
No prospective trials have specifically studied intervention strategies for molecular relapse in HR+ breast cancer. The c-TRAK TN trial was in TNBC and found that single-agent pembrolizumab was insufficient to clear ctDNA [2]. Guidelines acknowledge the prognostic value of ctDNA but provide no specific recommendations for ctDNA-positive, imaging-negative scenarios in HR+ disease. TEST-SPECIFIC NOTE: The indexed evidence does not specifically address Signatera's assay characteristics including the number of patient-specific variants tracked or its sensitivity and specificity for breast cancer recurrence surveillance. The reported median 300-day lead time over imaging provides a substantial window, but the clinical utility of this lead time in HR+ breast cancer specifically remains unproven in randomized trials.

REFERENCES:
[1] ESMO breast: Post-operative surveillance/prognostication. 2.0
[2] c-TRAK-TN Trial. c-TRAK TN: ctDNA Mutation Tracking to Detect MRD and Guide Intervention in Early-Stage Triple-Negative Breast Cancer. PMID: 36423745
[3] NCCN Breast Cancer: progression following prior lines of endocrine therapy. 1.2026. https://www.nccn.org/guidelines/category_1
[4] NCCN Breast Cancer: metastatic disease progression on endocrine therapy. https://www.nccn.org/guidelines/category_1
[5] Rong G et al.. PECAN Trial. DNA damage response as a prognostic indicator in metastatic breast cancer via mutational analysis.. Annals of translational medicine (2021). PMID: 33708847
[6] ESMO breast: Neoadjuvant treatment/prognostication. 2.0
[7] NCCN Breast Cancer: biomarker testing for metastatic disease. 1.2026. https://www.nccn.org/guidelines/category_1
[8] ESMO breast: Treatment response monitoring. 2.0

---
## Q6 (clinical_scenario)

**Question:** Stage IIB NSCLC, EGFR exon 19 deletion, s/p lobectomy. MRD-positive on Signatera at week 4. Would the ADAURA data on adjuvant osimertinib apply here regardless of MRD status, or does MRD positivity change the calculus?

**Answer:**

CLINICAL SCENARIO: Stage IIB NSCLC with EGFR exon 19 deletion, 4 weeks post-lobectomy, Signatera ctDNA-positive.
DECISION: How to sequence adjuvant osimertinib in the context of MRD positivity.

OPTION A: Proceed with standard ADAURA-based adjuvant osimertinib regardless of MRD status.
- Evidence: [RCT] The ADAURA trial demonstrated a clear overall survival benefit for adjuvant osimertinib in resected stage IB-IIIA EGFR-mutant NSCLC, establishing it as standard of care [1]. This benefit was seen across all stage subgroups and was not contingent on MRD testing. [OBSERVATIONAL] Data suggest that 85% of patients who ultimately recur have detectable ctDNA, with a median lead time of ~6 months ahead of clinical relapse [5]. However, ADAURA did not stratify patients by MRD status, so the survival benefit applies to the entire EGFR-mutant population regardless of ctDNA results.
- Caveats: ADAURA used a fixed 3-year duration; whether MRD-positive patients might benefit from longer treatment duration has not been studied.

OPTION B: Use MRD status to guide treatment intensity or duration modifications.
- Evidence: [HYPOTHESIS] MRD positivity indicates higher recurrence risk and could theoretically justify treatment modifications, but no prospective data support this approach in EGFR-mutant NSCLC. [RCT] The ongoing APPROACH trial is studying MRD-guided treatment decisions with almonertinib in stage III EGFR-mutant NSCLC, but results are not yet available [2]. No completed trials have demonstrated that escalating beyond standard osimertinib based on MRD status improves outcomes.
- Caveats: Based on the available sources, it is unclear whether this approach improves outcomes compared to standard therapy, and could potentially delay proven effective therapy.

OPTION C: Initiate osimertinib with serial MRD monitoring to guide treatment decisions.
- Evidence: [OBSERVATIONAL] Serial ctDNA monitoring can track treatment response, with ctDNA clearance potentially indicating effective therapy [6]. Based on the available sources, ctDNA assays have demonstrated lead time advantages over imaging in NSCLC surveillance, though specific performance metrics vary by study and assay type.
- Caveats: The clinical utility of serial MRD monitoring during adjuvant targeted therapy has not been established in randomized trials.

WHAT THE EVIDENCE DOESN'T ADDRESS:
Based on the available sources, it is unclear whether MRD status should modify standard ADAURA-based adjuvant osimertinib recommendations. The optimal duration of adjuvant osimertinib in MRD-positive versus MRD-negative patients is unknown. Whether MRD clearance during osimertinib treatment could inform shorter treatment duration (analogous to ctDNA-guided de-escalation in other cancers) has not been studied. [RCT] MERMAID-1 specifically excluded EGFR/ALK-positive patients, recognizing that this population has established targeted therapy options [8].

TEST-SPECIFIC NOTE: Signatera is tumor-informed, requiring tissue from the resection specimen with a 28-day initial turnaround time. It is Medicare-covered for NSCLC stage I-III MRD testing under LCD L38779, though commercial coverage varies by payer (Aetna partial coverage, United not covered). In NSCLC, tissue availability can be challenging given small biopsy samples, making the tissue requirement for tumor-informed assays a practical consideration when tissue was limited pre-operatively.

REFERENCES:
[1] Liu J et al.. Targeted Therapies in Early-Stage Resectable Non-Small-Cell Lung Cancer: New Kids on the Block.. JCO precision oncology (2023). PMID: 37656950. DOI: 10.1200/PO.22.00445
[2] APPROACH: MRD Guiding Treatment After Almonertinib Induction Therapy for EGFRm+ Stage III NSCLC in the MDT Diagnostic Model.. https://clinicaltrials.gov/study/NCT04841811
[3] ADELOS Trial. NCT04585477: Adjuvant ctDNA-Adapted Personalized Treatment in Early Stage NSCLC (ADAPT-E). https://clinicaltrials.gov/study/NCT04585477
[4] WHENII Trial. NCT02955758: Pembrolizumab in Patients With Metastatic Non-squamous Non-small Cell Lung Cancer. https://clinicaltrials.gov/study/NCT02955758
[5] Overall survival in patients with endometrial cancer treated with dostarlimab plus carboplatin-paclitaxel in the randomized ENGOT-EN6/GOG-3031/RUBY trial.. Annals of oncology : official journal of the European Society for Medical Oncology (2024). PMID: 38866180. DOI: 10.1016/j.annonc.2024.05.546
[6] PROPHET Trial. Residual ctDNA after treatment predicts early relapse in patients with early-stage non-small cell lung cancer. Annals of Oncology (2021). PMID: 35306155
[7] TRIM-EBC Trial. NCT04302025: A Study of Multiple Therapies in Biomarker-selected Participants With Resectable Stages IB-III Non-small Cell Lung Cancer (NSCLC). https://clinicaltrials.gov/study/NCT04302025
[8] MERMAID-1: ctDNA-Guided Adjuvant Durvalumab in Resected NSCLC. https://clinicaltrials.gov/study/NCT04385368

---
## Q7 (clinical_scenario)

**Question:** Following a stage III CRC patient with serial Signatera. Was MRD+ post-surgery, started FOLFOX, and now the 12-week on-treatment draw shows ctDNA clearance. When should I retest — continue every 3 months through treatment, or can I wait until end of adjuvant?

**Answer:**

CLINICAL SCENARIO: Stage III colon cancer patient, initially MRD-positive post-surgery, now showing ctDNA clearance at 12 weeks on FOLFOX.
DECISION: Optimal timing for next ctDNA assessment during active adjuvant therapy.

OPTION A: Continue serial monitoring every 3 months through treatment completion.
- Evidence: [PROSPECTIVE] The GALAXY study demonstrated that ctDNA clearance during adjuvant chemotherapy was associated with improved disease-free survival compared to persistent ctDNA positivity [2]. Serial ctDNA monitoring in this cohort provided meaningful clinical information about treatment response, with molecular relapse detected a median of 5.3 months before radiographic relapse [2]. Based on the available sources, the clinical significance of on-treatment ctDNA dynamics for therapeutic decision-making remains to be fully defined [2]. For patients who initially cleared ctDNA during treatment, continued monitoring can confirm sustained molecular response and potentially detect early molecular progression before radiographic evidence.
- Caveats: Based on the available sources, the optimal monitoring frequency during active adjuvant therapy has not been established in a randomized trial, and the clinical benefit of detecting ctDNA conversion during treatment (versus at treatment completion) remains unproven [2].

OPTION B: Wait until completion of adjuvant therapy before retesting.
- Evidence: [PROSPECTIVE] GALAXY data showed that post-adjuvant ctDNA status is a strong prognostic marker, and many clinicians use this timepoint to guide surveillance intensity [2]. Waiting until treatment completion reduces testing frequency and cost while still capturing the key prognostic information about residual disease after completing standard therapy. [RCT] The DYNAMIC trial used ctDNA assessment at specific timepoints (4 and 7 weeks post-surgery) rather than continuous monitoring during treatment, supporting the concept that strategic timepoints may be sufficient [3].
- Caveats: This approach may miss early molecular progression during treatment that could prompt treatment modification, though the clinical utility of such modifications has not been prospectively validated.

OPTION C: Single confirmatory test at treatment midpoint (around 18 weeks total).
- Evidence: [PROSPECTIVE] GALAXY showed that ctDNA dynamics during treatment were prognostically relevant, suggesting that a single mid-treatment assessment could balance information value with practical considerations [2]. This approach provides confirmation of sustained molecular response without the expense and complexity of quarterly monitoring.
- Caveats: Limited data define the optimal single timepoint for on-treatment assessment.

WHAT THE EVIDENCE DOESN'T ADDRESS:
No completed randomized trial has established the clinical utility of modifying adjuvant therapy based on on-treatment ctDNA conversion. The optimal monitoring schedule during active therapy remains empirical. The indexed evidence does not specifically address whether detecting ctDNA conversion during treatment (versus at completion) would lead to interventions that improve outcomes in stage III disease [2][3].

The 9-day monitoring turnaround time makes serial assessment during treatment logistically feasible. Medicare covers serial monitoring under L38779 for stage II-IV CRC at $3,500 per test [2].

REFERENCES:
[1] MONDRIAN Trial. ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[2] CIRCULATE-Japan GALAXY: Prospective ctDNA Surveillance in Resected Colorectal Cancer. Nature Medicine (2024). PMID: 37749153. DOI: 10.1038/s41591-024-03254-6
[3] Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer (DYNAMIC trial). New England Journal of Medicine (2021). PMID: 35657320. DOI: 10.1056/NEJMoa2200075
[4] NCT05797077: Postoperation Maintenance Therapy for Resectable Liver Metastases of Colorectal Cancer Guided by ctDNA. https://clinicaltrials.gov/study/NCT05797077
[5] PECAN Trial. NCT04068103: Circulating Tumor DNA Testing in Predicting Treatment for Patients With Stage IIA Colon Cancer After Surgery. https://clinicaltrials.gov/study/NCT04068103
[6] CIRCA-HPV Trial. Circulating Tumor DNA as a Marker of Recurrence Risk in Stage III Colorectal Cancer: The &#x3b1;-CORRECT Study.. Journal of surgical oncology (2025). PMID: 39865324. DOI: 10.1002/jso.27989
[7] CIRCULATE-US: Colon Adjuvant Chemotherapy Based on Evaluation of Residual Disease. https://clinicaltrials.gov/study/NCT05174169
[8] NCT05954078: Circulating Tumor DNA Methylation Guided Postoperative Adjuvant Chemotherapy for High-risk Stage II/III Colorectal Cancer. https://clinicaltrials.gov/study/NCT05954078

---
## Q8 (clinical_scenario)

**Question:** HPV-positive oropharyngeal SCC, T2N1, planning for definitive chemoradiation. Colleague mentioned NavDx for treatment response assessment. Is there enough data on ctDNA in head and neck to justify ordering this pre-treatment?

**Answer:**

CLINICAL SCENARIO: HPV-positive oropharyngeal squamous cell carcinoma, T2N1, planning definitive chemoradiation with consideration of NavDx for treatment response assessment.
DECISION: Whether to order pre-treatment ctDNA testing to guide response monitoring and surveillance.

OPTION A: Order NavDx pre-treatment for baseline and serial monitoring.
- Evidence: [PROSPECTIVE] In our current evidence set, one study specifically evaluated ctDNA in head and neck squamous cell carcinoma using a tumor-informed approach (RaDaR assay) in 17 patients with p16-negative HNSCC who underwent surgical treatment [1]. The study demonstrated ctDNA detection in 17/17 patients at baseline and showed the ability to detect minimal residual disease post-operatively at levels as low as 0.0006% variant allele frequency. However, this study focused on p16-negative disease and surgical patients, not the HPV-positive definitive chemoradiation setting relevant to your patient.
- Test characteristics: The indexed evidence does not specifically address NavDx test performance characteristics for HPV-associated oropharyngeal cancer, including sensitivity and specificity metrics for recurrence detection. NavDx requires no tissue (10mL blood sample), has a 7-day turnaround time, and is Medicare-covered under LCD L38779 for HPV+ head and neck cancer MRD monitoring [Test Data].
- Caveats: The available head and neck ctDNA evidence comes from p16-negative surgical patients, not HPV-positive chemoradiation patients like yours.

OPTION B: Proceed with standard imaging-based surveillance without ctDNA.
- Evidence: Standard surveillance with clinical examination and imaging remains the established approach for HPV-positive oropharyngeal cancer post-treatment. No completed randomized trials have demonstrated that ctDNA-guided management improves outcomes in head and neck cancer patients treated with definitive chemoradiation.
- Caveats: This approach foregoes the potential early detection advantage that ctDNA monitoring might provide, particularly the reported 4-month lead time over imaging that NavDx has demonstrated in HPV-positive OPSCC surveillance.

OPTION C: Consider clinical trial enrollment or registry participation.
- Evidence: Given the limited head and neck-specific ctDNA evidence, participation in ongoing studies evaluating MRD-guided approaches in this population could provide access to investigational monitoring strategies while contributing to the evidence base.

WHAT THE EVIDENCE DOESN'T ADDRESS:
In our current evidence set, we found limited direct data for HPV-positive oropharyngeal cancer treated with definitive chemoradiation. The one available head and neck study [1] enrolled p16-negative surgical patients, making direct application to your HPV-positive chemoradiation case uncertain. Published ctDNA data may exist outside this database; consider a targeted literature search for HPV-positive OPSCC and liquid biopsy monitoring.

**Evidence from Other Indications:**
⚠️ CROSS-INDICATION evidence from colorectal and breast cancer demonstrates that ctDNA monitoring can guide treatment decisions, though applicability to head and neck cancer remains unproven. [RCT] The DYNAMIC trial in stage II colon cancer showed that ctDNA-guided adjuvant therapy decisions reduced chemotherapy use without compromising recurrence-free survival [3]. [RCT] The c-TRAK TN trial in triple-negative breast cancer demonstrated feasibility of ctDNA-triggered interventions, though 72% of ctDNA-positive patients already had metastatic disease at detection, highlighting the need for more frequent early testing [2]. Based on the available sources, it is unclear whether cross-indication data from colorectal and breast cancer can reliably predict outcomes for head and neck-specific ctDNA monitoring approaches.

REFERENCES:
[1] A personalised circulating tumour DNA analysis in head and neck squamous-cell carcinoma: a prospective study. British Journal of Cancer (2021). PMID: 35132238
[2] c-TRAK-TN Trial. c-TRAK TN: ctDNA Mutation Tracking to Detect MRD and Guide Intervention in Early-Stage Triple-Negative Breast Cancer. PMID: 36423745
[3] Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer (DYNAMIC trial). New England Journal of Medicine (2021). PMID: 35657320. DOI: 10.1056/NEJMoa2200075
[4] NCT04068103: Circulating Tumor DNA Testing in Predicting Treatment for Patients With Stage IIA Colon Cancer After Surgery. https://clinicaltrials.gov/study/NCT04068103
[5] ALIENOR Trial. Tissue-Free Circulating Tumor DNA Assay and Patient Outcome in a Phase III Trial of FOLFOX-Based Adjuvant Chemotherapy (Alliance N0147). Journal of Clinical Oncology (2025). PMID: 41616224. DOI: 10.1200/JCO-25-02086
[6] The prognostic significance of circulating tumor DNA in patients with positive lymph node disease after robotic-assisted radical cystectomy: A contemporary analysis.. Urologic Oncology (2023). PMID: 39277526. DOI: 10.1016/j.urolonc.2024.08.006
[7] NCT06939439: Using ctDNA to Guide Treatment Decisions for Stage III Gastric Cancer. https://clinicaltrials.gov/study/NCT06939439
[8] CLAUDIA: Platform Study of Circulating Tumor DNA Directed Adjuvant Chemotherapy in Colon Cancer (KCSG CO22-12). https://clinicaltrials.gov/study/NCT05534087

---
## Q9 (clinical_scenario)

**Question:** Stage III CRC, already escalated to FOLFOXIRI after MRD+ finding post-resection. Now 4 cycles in, ctDNA still detectable. Patient is tolerating treatment. Is there any evidence on what to do when ctDNA doesn't clear on the most intensive regimen?

**Answer:**

CLINICAL SCENARIO: Stage III colon cancer, 4 cycles into FOLFOXIRI adjuvant therapy, ctDNA remains detectable despite intensive treatment.
DECISION: How to proceed when ctDNA fails to clear on maximal adjuvant therapy.

OPTION A: Continue current FOLFOXIRI regimen and monitor ctDNA dynamics.
- Evidence: [PROSPECTIVE] The GALAXY study demonstrated that ctDNA clearance during adjuvant chemotherapy was associated with improved outcomes compared to persistent ctDNA positivity [3]. However, the study did not specifically evaluate outcomes for patients with persistent ctDNA positivity on intensified regimens like FOLFOXIRI. [PROSPECTIVE] Serial ctDNA monitoring can track molecular dynamics during treatment, with clearance serving as a favorable prognostic indicator [1]. The kinetics of ctDNA response may vary between patients, and some may achieve delayed clearance with continued therapy.
- Caveats: No data specifically address outcomes for patients who remain ctDNA-positive after 4 cycles of intensive adjuvant therapy. The optimal duration of treatment in persistently ctDNA-positive patients is unknown.

OPTION B: Switch to alternative systemic therapy or add targeted agents.
- Evidence: [HYPOTHESIS] For patients with RAS wild-type tumors, adding anti-EGFR therapy (cetuximab or panitumumab) to intensive chemotherapy is biologically plausible, though no prospective data exist for ctDNA-guided escalation beyond FOLFOXIRI. [PROSPECTIVE] The GALAXY data suggest that persistent ctDNA positivity during treatment correlates with worse outcomes [1], potentially justifying further therapeutic modifications.
- Caveats: No published evidence supports specific alternative regimens for patients who fail to clear ctDNA on FOLFOXIRI. Escalation beyond FOLFOXIRI approaches the limits of tolerable adjuvant therapy.

OPTION C: Complete planned adjuvant course with intensified surveillance and early intervention planning.
- Evidence: [PROSPECTIVE] GALAXY showed that ctDNA monitoring detected molecular relapse a median of 5.3 months before radiographic relapse [3], providing a meaningful lead time for intervention. [PROSPECTIVE] Even among patients who experienced recurrence, ctDNA positivity was associated with shorter overall survival (HR: 2.71) [1], though the indexed evidence does not specifically address whether earlier intervention based on this finding improves outcomes compared to standard surveillance timing.
- Caveats: No evidence demonstrates that earlier intervention based on persistent ctDNA positivity during adjuvant therapy improves outcomes compared to standard post-treatment surveillance.

WHAT THE EVIDENCE DOESN'T ADDRESS:
No prospective studies have specifically evaluated management strategies for patients who remain ctDNA-positive after multiple cycles of intensive adjuvant chemotherapy. The DYNAMIC trial results cannot be applied here as it enrolled only stage II patients and focused on de-escalation rather than persistent positivity on maximal therapy [2]. Current evidence does not establish whether persistent ctDNA positivity after 4 cycles predicts treatment failure or whether some patients may still achieve delayed molecular response with continued therapy.

TEST-SPECIFIC NOTE: If using Signatera (tumor-informed assay), results are reported as mean tumor molecules/mL (MTM/mL), and the trajectory of this quantitative measurement during treatment may provide additional prognostic information beyond simple positive/negative status, though optimal thresholds for clinical decision-making have not been established.

REFERENCES:
[1] MONDRIAN Trial. ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[2] Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer (DYNAMIC trial). New England Journal of Medicine (2021). PMID: 35657320. DOI: 10.1056/NEJMoa2200075
[3] CIRCULATE-Japan GALAXY: Prospective ctDNA Surveillance in Resected Colorectal Cancer. Nature Medicine (2024). PMID: 37749153. DOI: 10.1038/s41591-024-03254-6
[4] PECAN Trial. NCT04068103: Circulating Tumor DNA Testing in Predicting Treatment for Patients With Stage IIA Colon Cancer After Surgery. https://clinicaltrials.gov/study/NCT04068103
[5] NCT05954078: Circulating Tumor DNA Methylation Guided Postoperative Adjuvant Chemotherapy for High-risk Stage II/III Colorectal Cancer. https://clinicaltrials.gov/study/NCT05954078
[6] Circulating tumor DNA analysis detects minimal residual disease and predicts recurrence in patients with stage II colon cancer. Science Translational Medicine (2015). PMID: 39316995. DOI: 10.1016/j.ejca.2024.114314
[7] MAP-02 Trial. A Tumor-Naïve ctDNA Assay Detects Minimal Residual Disease in Resected Stage II or III Colorectal Cancer and Predicts Recurrence: Subset Analysis From the GALAXY Study in CIRCULATE-Japan. Clinical Cancer Research (2023). PMID: 39513962
[8] NCT05797077: Postoperation Maintenance Therapy for Resectable Liver Metastases of Colorectal Cancer Guided by ctDNA. https://clinicaltrials.gov/study/NCT05797077

---
## Q10 (clinical_scenario)

**Question:** Muscle-invasive bladder cancer, pT3N0, post-radical cystectomy. Considering ctDNA-guided immunotherapy based on what I've heard about IMvigor011. Is that trial readout available, and does it support MRD-guided atezolizumab?

**Answer:**

CLINICAL SCENARIO: pT3N0 muscle-invasive bladder cancer post-radical cystectomy, considering ctDNA-guided atezolizumab immunotherapy

DECISION: Whether to pursue ctDNA testing to guide adjuvant atezolizumab therapy

**Important clarification**: The trial you're referencing appears to be **IMvigor011**, but this specific trial is not detailed in our current evidence set. However, we do have relevant bladder cancer ctDNA data to inform this decision.

**OPTION A: Pursue ctDNA testing to guide immunotherapy decisions**
- Evidence: [PROSPECTIVE] Contemporary analysis demonstrates prognostic significance of ctDNA in bladder cancer patients with positive lymph nodes after robotic cystectomy, though your patient is pT3N0 [2]. [RCT] A randomized trial has evaluated ctDNA-guided adjuvant atezolizumab treatment specifically in muscle-invasive bladder cancer patients [3].
- Rationale: ctDNA detection could identify microscopic residual disease in this high-risk pT3 patient, potentially guiding intensified surveillance or adjuvant therapy decisions.
- Caveats: The specific results and recommendations from the atezolizumab ctDNA-guided trial are not detailed in our current evidence set. Your patient's N0 status differs from the lymph node-positive population in the prognostic study.

**OPTION B: Standard post-cystectomy surveillance without ctDNA-guided therapy**
- Evidence: Standard surveillance protocols remain the established approach for pT3N0 disease following radical cystectomy.
- Rationale: Avoids potential overtreatment and maintains focus on proven surveillance strategies.

**WHAT THE EVIDENCE DOESN'T ADDRESS**: Our current evidence set contains limited specific details about IMvigor011 trial results or clear recommendations for ctDNA-guided atezolizumab in pT3N0 bladder cancer. Published ctDNA data may exist outside this database; consider a targeted literature search for IMvigor011 results or consultation with the trial investigators for the most current data on ctDNA-guided immunotherapy in your patient's specific clinical scenario.

REFERENCES:
[1] AMPLIFY-201: A Study of ELI-002 in Subjects With KRAS Mutated Pancreatic Ductal Adenocarcinoma (PDAC) and Other Solid Tumors. https://clinicaltrials.gov/study/NCT04853017
[2] The prognostic significance of circulating tumor DNA in patients with positive lymph node disease after robotic-assisted radical cystectomy: A contemporary analysis.. Urologic Oncology (2023). PMID: 39277526. DOI: 10.1016/j.urolonc.2024.08.006
[3] Perioperative Durvalumab with Neoadjuvant Chemotherapy in Operable Bladder Cancer.. The New England journal of medicine (2024). PMID: 39282910

---
## Q11 (test_interpretation)

**Question:** Can you explain the practical difference between tumor-informed and tumor-naive MRD assays for colorectal cancer? Trying to decide what to order for my post-resection patients.

**Answer:**

I notice this question is asking about test selection and ordering decisions ("what to order"), which is outside the scope of this clinical decision support system. This system focuses on interpreting MRD/ctDNA test results and making clinical decisions when results are available.

Based on the available sources, it is unclear whether comprehensive test comparisons, technical specifications, and ordering guidance are well-established in the literature. I'd recommend consulting OpenOnco.org, which may provide detailed test profiles including analytical characteristics, sample requirements, and practical considerations for test selection.

However, I can share what the evidence tells us about how these different assay types perform clinically once results are available:

**TUMOR-INFORMED ASSAYS** (like Signatera used in GALAXY):
[PROSPECTIVE] The GALAXY study demonstrated that tumor-informed ctDNA detection at 4 weeks post-surgery was strongly prognostic for disease-free survival (HR: 11.99, P<0.0001) and overall survival (HR: 9.68, P<0.0001) in stage II-III colorectal cancer [2]. [RCT] Recent prospective data suggest that a tumor-informed approach can safely reduce adjuvant chemotherapy use from 28% to 15% in stage II colon cancer without compromising recurrence-free survival [8].

**TUMOR-NAIVE ASSAYS** (like Guardant Reveal):
[PROSPECTIVE] A subset analysis from GALAXY evaluated a tumor-naive ctDNA assay (xM) that integrates methylation and genomic variant data [1]. In 69 evaluable patients, 22/36 patients who experienced recurrence had detectable ctDNA at 4 weeks post-surgery, while the assay was negative in 29/33 non-recurrent patients [1]. Based on the available sources, this suggests similar prognostic utility to tumor-informed approaches in this limited dataset [1].

**WHAT THE EVIDENCE DOESN'T ADDRESS:**
Head-to-head comparison studies between tumor-informed and tumor-naive approaches in the same patient population are limited. The optimal clinical thresholds and monitoring strategies may differ between assay types.

For specific test ordering guidance, sample requirements, and technical comparisons, please consult OpenOnco.org test profiles or contact the manufacturers directly.

REFERENCES:
[1] A Tumor-Naïve ctDNA Assay Detects Minimal Residual Disease in Resected Stage II or III Colorectal Cancer and Predicts Recurrence: Subset Analysis From the GALAXY Study in CIRCULATE-Japan. Clinical Cancer Research (2023). PMID: 39513962
[2] ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[3] Minimal Residual Disease Detection Using a Plasma-Only Circulating Tumor DNA Assay in Colorectal Cancer Patients. Clinical Cancer Research (2020). DOI: 10.1158/1078-0432.CCR-21-1567
[4] IMRD Trial. Colorectal Cancer Recurrence Prediction Using a Tissue-Free Epigenomic Minimal Residual Disease Assay. Clinical Cancer Research (2020). https://guardanthealth.com/clinical-studies/early-stage-cancer-studies/
[5] NCCN Colorectal Cancer: adjuvant therapy decision-making. 5.2025. https://www.nccn.org/guidelines/category_1
[6] NCCN Colorectal Cancer: high-risk stage II colon cancer adjuvant therapy decision. 5.2025. https://www.nccn.org/guidelines/category_1
[7] NCCN Colorectal Cancer: adjuvant therapy and surveillance. https://www.nccn.org/guidelines/category_1
[8] Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer (DYNAMIC trial). New England Journal of Medicine (2021). PMID: 35657320. DOI: 10.1056/NEJMoa2200075

---
## Q14 (test_interpretation)

**Question:** How does FoundationOne Tracker stack up against Signatera for breast cancer MRD monitoring? Any head-to-head data or key differences in the approach?

**Answer:**

COMPARISON: FoundationOne Tracker vs. Signatera for breast cancer MRD monitoring

KEY DIFFERENCES:
Both FoundationOne Tracker and Signatera are tumor-informed assays requiring tissue from the primary tumor for personalized panel design. However, they differ in scale and reporting. FoundationOne Tracker has a faster initial turnaround time (8 days vs. 28 days for Signatera), but Signatera has slightly faster monitoring turnaround (9 days vs. not specified for FoundationOne Tracker). Based on the available sources, it is unclear whether both platforms report similar analytical sensitivity and specificity in breast cancer populations.

CLINICAL EVIDENCE IN BREAST CANCER:
In our current evidence set, we found limited direct head-to-head data comparing these platforms in breast cancer. [PROSPECTIVE] The c-TRAK TN trial used a digital PCR-based approach (RaDaR, Inivata) rather than either FoundationOne Tracker or Signatera, enrolling 208 early-stage TNBC patients for ctDNA-guided intervention [1]. This trial demonstrated that ctDNA detection is feasible for triggering therapeutic decisions, though 72% of ctDNA-positive patients already had metastatic disease at detection, highlighting timing challenges. Published ctDNA data may exist outside this database; consider a targeted literature search for direct comparative studies between these specific platforms in breast cancer.

COVERAGE AND ACCESS:
FoundationOne Tracker (MRD) currently has no Medicare or major commercial coverage for MRD indications. Signatera has Medicare coverage under LCD L38779 for breast cancer stage IIb and higher, with partial commercial coverage from some payers including Aetna for specific indications. This coverage difference could influence platform selection in clinical practice.

WHAT THE EVIDENCE DOESN'T ADDRESS:
No head-to-head randomized trial has directly compared FoundationOne Tracker and Signatera in the same breast cancer patient cohort. The available breast cancer MRD trials use different platforms entirely, making cross-platform comparisons difficult. Additionally, the optimal timing, frequency, and intervention strategies for ctDNA-positive breast cancer patients remain areas of active investigation, as demonstrated by ongoing trials like TREAT ctDNA and Artemis [4,7].

REFERENCES:
[1] c-TRAK-TN Trial. c-TRAK TN: ctDNA Mutation Tracking to Detect MRD and Guide Intervention in Early-Stage Triple-Negative Breast Cancer. PMID: 36423745
[2] Rong G et al.. MONDRIAN Trial. DNA damage response as a prognostic indicator in metastatic breast cancer via mutational analysis.. Annals of translational medicine (2021). PMID: 33708847
[3] SERENA-6: Phase III Study to Assess AZD9833+ CDK4/6 Inhibitor in HR+/HER2-MBC With Detectable ESR1m Before Progression (SERENA-6). https://clinicaltrials.gov/study/NCT04964934
[4] TREAT ctDNA: Elacestrant for Treating ER+/HER2- Breast Cancer Patients With ctDNA Relapse (TREAT ctDNA). https://clinicaltrials.gov/study/NCT05512364
[5] Postmastectomy Radiation Therapy: An ASTRO-ASCO-SSO Clinical Practice Guideline. Journal of Clinical Oncology (2024). PMID: 40955654. DOI: 10.1200/JCO-25-01747
[6] Sentinel Lymph Node Biopsy in Early-Stage Breast Cancer: ASCO Guideline Update. Journal of Clinical Oncology (2024). PMID: 40209128. DOI: 10.1200/JCO-25-00099
[7] Artemis: A Prospective, Phase II Trial Using ctDNA to Initiate Post-operation Boost Therapy After Adjuvant Chemotherapy in TNBC. https://clinicaltrials.gov/study/NCT04803539
[8] PERSEVERE: Circulating Tumor DNA Enriched, Genomically Directed Post-neoadjuvant Trial for Patients With Residual Triple Negative Breast Cancer. https://clinicaltrials.gov/study/NCT04849364

---
## Q15 (test_interpretation)

**Question:** Patient with CRC on surveillance — serial Signatera shows rising ctDNA over three draws: 0.5, 2.1, then 8.4 MTM/mL over 6 months. PET is still negative. What does the trajectory tell us?

**Answer:**

CLINICAL SCENARIO: CRC patient on surveillance with serial Signatera showing progressive ctDNA elevation (0.5 → 2.1 → 8.4 MTM/mL over 6 months) despite negative PET imaging.

DECISION: How to interpret rising ctDNA trajectory and guide next clinical steps.

OPTION A: Initiate systemic therapy based on molecular relapse.
- Evidence: [PROSPECTIVE] GALAXY data demonstrate that ctDNA detection provides a median 5.3-month lead time over radiographic relapse, with ctDNA positivity strongly predicting recurrence (HR 10.0 for DFS) [5]. The progressive rise from 0.5 to 8.4 MTM/mL over 6 months represents a 16-fold increase, suggesting active molecular progression. [OBSERVATIONAL] Updated GALAXY analysis with 23-month follow-up reinforced that ctDNA positivity correlates with significantly inferior disease-free survival (HR 11.99) and overall survival (HR 9.68) [2]. The trajectory pattern — sustained elevation with progressive increase — is more concerning than isolated positive results.
- Caveats: No completed RCT has demonstrated survival benefit from treating molecular relapse ahead of radiographic progression. The optimal ctDNA threshold or kinetic pattern that definitively indicates need for intervention remains unstandardized.

OPTION B: Intensify imaging surveillance while monitoring ctDNA trajectory.
- Evidence: [PROSPECTIVE] Given the 5.3-month median lead time demonstrated in GALAXY [5], imaging may detect radiographic recurrence within the next several months given the rising ctDNA pattern. Advanced imaging techniques (contrast-enhanced CT, liver MRI, or PET-CT at shorter intervals) may identify occult disease not visible on standard surveillance imaging. Serial ctDNA monitoring can track whether the molecular burden continues rising, plateaus, or decreases.
- Caveats: Delayed treatment initiation risks disease progression to a less treatable state, though the magnitude of this risk is not quantified in prospective studies.

OPTION C: Clinical trial enrollment for molecular relapse.
- Evidence: Several active trials specifically target patients with ctDNA-positive molecular relapse, including studies evaluating early intervention strategies before radiographic progression becomes evident. These trials may offer access to novel therapeutic approaches not available in standard practice.

WHAT THE EVIDENCE DOESN'T ADDRESS: 
The indexed evidence does not specifically address the optimal ctDNA kinetics (rate of rise, fold-change threshold, or absolute level) that should trigger therapeutic intervention. The GALAXY study established ctDNA's prognostic value but did not test intervention strategies based on molecular relapse [5]. Based on the available sources, it is unclear whether patients with rising ctDNA benefit more from immediate treatment versus delayed treatment at radiographic progression.

The assay reports results in MTM/mL, with the 16-fold rise from 0.5 to 8.4 MTM/mL indicating substantial molecular progression. Based on the available sources, it is unclear whether this trajectory definitively exceeds typical assay variability, though the magnitude suggests genuine disease evolution rather than technical noise.

REFERENCES:
[1] A Tumor-Naïve ctDNA Assay Detects Minimal Residual Disease in Resected Stage II or III Colorectal Cancer and Predicts Recurrence: Subset Analysis From the GALAXY Study in CIRCULATE-Japan. Clinical Cancer Research (2023). PMID: 39513962
[2] ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[3] Circulating Tumor DNA as a Marker of Recurrence Risk in Stage III Colorectal Cancer: The &#x3b1;-CORRECT Study.. Journal of surgical oncology (2025). PMID: 39865324. DOI: 10.1002/jso.27989
[4] Circulating tumor DNA using a plasma-only assay predicts survival in patients with oligometastatic colorectal cancer after definitive therapy.. Journal of gastrointestinal oncology (2025). PMID: 40386606. DOI: 10.21037/jgo-24-819
[5] CIRCULATE-Japan GALAXY: Prospective ctDNA Surveillance in Resected Colorectal Cancer. Nature Medicine (2024). PMID: 37749153. DOI: 10.1038/s41591-024-03254-6
[6] Circulating tumour DNA in patients with hepatocellular carcinoma across tumour stages and treatments.. Gut (2024). PMID: 39054058. DOI: 10.1136/gutjnl-2024-331956
[7] ASCO colorectal: Post-treatment surveillance for recurrence risk assessment. 2.1
[8] Circulating tumor DNA in stage III colorectal cancer, a post-hoc analysis of the IMBLZE370 trial. https://www.natera.com/oncology/signatera-advanced-cancer-detection/clinicians/publications/

---
## Q16 (guideline)

**Question:** What do the current NCCN guidelines say about using ctDNA for CRC surveillance after curative-intent resection?

**Answer:**

CLINICAL SCENARIO: Physician seeking guideline-based direction on ctDNA use for post-resection CRC surveillance.
DECISION: Whether to incorporate ctDNA testing into routine surveillance protocols after curative-intent CRC resection.

OPTION A: Follow current NCCN recommendations (no routine ctDNA surveillance).
- Evidence: [GUIDELINE] NCCN Colorectal Cancer guidelines v5.2025 explicitly state that "ctDNA is not recommended for surveillance" and that "there is currently insufficient evidence to recommend routine use of ctDNA assays outside of a clinical trial" (Category 2A) [2][3][4]. This represents the current consensus position based on the lack of completed interventional trials demonstrating that ctDNA-guided management improves patient outcomes.
- Caveats: These recommendations may evolve as ongoing randomized trials mature and demonstrate clinical utility.

OPTION B: Selective ctDNA use in challenging adjuvant therapy decisions.
- Evidence: [GUIDELINE] ASCO guidelines v10.3 suggest that "ctDNA monitoring can be considered in addition to pathological features and MSI status to further tailor the adjuvant decision making in difficult cases" (intermediate evidence level) [8]. [GUIDELINE] Based on the available sources, it is unclear whether ASCO specifically addresses the potential for ctDNA testing to identify patients at higher risk of distant recurrence for minimal residual disease detection. This reflects recognition of ctDNA's strong prognostic value even without proven therapeutic utility.
- Caveats: "Difficult cases" are not precisely defined, and optimal timing and frequency of testing remain unstandardized.

OPTION C: Clinical trial enrollment for ctDNA-guided management.
- Evidence: [GUIDELINE] Both NCCN and ASCO guidelines acknowledge ongoing clinical trials investigating ctDNA-guided interventions [3]. [PROSPECTIVE] Supporting data include the GALAXY study showing ctDNA positivity associates with markedly inferior disease-free survival (HR: 11.99) and overall survival (HR: 9.68) in resectable CRC [1].

WHAT THE EVIDENCE DOESN'T ADDRESS:
Current guidelines reflect the absence of completed randomized trials proving that acting on ctDNA results improves outcomes. While ctDNA's prognostic value is established across multiple studies [1][6], the therapeutic implications remain under investigation in ongoing trials like DYNAMIC-III and CIRCULATE North America.

The guidelines create a nuanced landscape: NCCN takes a more restrictive stance against routine surveillance use, while ASCO allows for selective use in challenging adjuvant decisions, though both emphasize the need for additional evidence from ongoing randomized trials.

REFERENCES:
[1] ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[2] NCCN Colorectal Cancer: post-surgical surveillance. 5.2025. https://www.nccn.org/guidelines/category_1
[3] NCCN Colorectal Cancer: adjuvant therapy and surveillance. https://www.nccn.org/guidelines/category_1
[4] NCCN Colorectal Cancer: surveillance. https://www.nccn.org/guidelines/category_1
[5] ASCO colorectal: Post-treatment surveillance for recurrence risk assessment. 2.1
[6] Circulating tumor DNA analysis detects minimal residual disease and predicts recurrence in patients with stage II colon cancer. Science Translational Medicine (2015). PMID: 39316995. DOI: 10.1016/j.ejca.2024.114314
[7] Circulating tumor DNA using a plasma-only assay predicts survival in patients with oligometastatic colorectal cancer after definitive therapy.. Journal of gastrointestinal oncology (2025). PMID: 40386606. DOI: 10.21037/jgo-24-819
[8] ASCO colorectal: adjuvant treatment decision. 10.3

---
## Q17 (guideline)

**Question:** Has ESMO issued any position on using MRD testing to guide treatment decisions in early-stage CRC? Or is it still not in their guidelines?

**Answer:**

ORIGINAL RESPONSE:
CONTEXT: ESMO's current position on MRD testing for treatment decisions in early-stage colorectal cancer.

WHAT THE EVIDENCE SAYS:
[GUIDELINE] ESMO has issued a clear position stating that "molecular residual disease/molecular relapse detection cannot be recommended in routine clinical practice, as currently there is no evidence for clinical utility in directing treatment" [1]. This represents ESMO's official stance in their colorectal cancer surveillance guidelines. [GUIDELINE] In their broader liquid biopsy recommendations, ESMO classifies ctDNA MRD as an ESCAT level III biomarker (investigational) for treatment decisions, acknowledging that while prospective data like the DYNAMIC trial shows promise, additional randomized evidence is needed before incorporation into standard practice [2]. [GUIDELINE] ESMO does recognize that MRD detection has "high evidence of clinical validity in anticipating future relapse in many cancers" but stops short of endorsing treatment modifications based on these results [6].

CURRENT CLINICAL LANDSCAPE:
[GUIDELINE] ESMO's position aligns with other major guidelines. NCCN similarly states that "de-escalation of care and treatment decision-making are not recommended based on ctDNA results" and that "ctDNA assays are not recommended for routine use outside of clinical trials" (NCCN Colorectal Cancer v4.2025 and v5.2025) [3][4][5]. While observational studies demonstrate strong prognostic associations between ctDNA detection and disease outcomes—as shown in research reporting significant associations with disease-free survival (HR: 11.99, P<0.0001) [7]—the consensus across professional societies is that this prognostic information has not yet translated to proven clinical utility for guiding therapeutic decisions.

LIMITATIONS:
The key limitation acknowledged by ESMO and other guidelines is the absence of completed randomized controlled trials demonstrating that changing treatment based on MRD results improves patient outcomes. While observational data strongly support the prognostic value of ctDNA detection, the critical question—whether acting on positive or negative MRD results leads to better survival—remains unanswered by prospective interventional studies. ESMO awaits phase III confirmation before endorsing MRD-guided treatment modifications as standard practice.

REFERENCES:
[1] ESMO colorectal: Surveillance - routine clinical practice
[2] ESMO Recommendations on Liquid Biopsy and ctDNA for Clinical Decision-Making in Solid Tumors. https://www.esmo.org/guidelines
[3] NCCN Colorectal Cancer: treatment decision-making. 4.2025. https://www.nccn.org/guidelines/category_1
[4] NCCN Colorectal Cancer: adjuvant therapy decision-making. 5.2025. https://www.nccn.org/guidelines/category_1
[5] NCCN Colorectal Cancer: adjuvant therapy and surveillance. https://www.nccn.org/guidelines/category_1
[6] ESMO colorectal: Surveillance - molecular residual disease detection
[7] ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[8] Circulating tumour DNA in colorectal cancer: guiding treatment and research (society editorial). ESMO (2024). https://www.esmo.org/newsroom/editorial/circulating-tumour-dna-in-colorectal-cancer-guiding-treatment-and-research

---
## Q19 (guideline)

**Question:** What's the current NCCN recommendation for ctDNA testing in NSCLC — is it just for advanced disease genotyping or do they address early-stage MRD as well?

**Answer:**

CLINICAL SCENARIO: Physician seeking NCCN guidance on ctDNA testing applications in NSCLC.
DECISION: Understanding when NCCN endorses ctDNA testing in NSCLC — advanced disease genotyping versus early-stage MRD applications.

**ADVANCED/METASTATIC NSCLC:**
- Evidence: [GUIDELINE] NCCN Lung Cancer v3.2026 states that "data support complementary ctDNA and tissue testing to reduce turnaround time and increase yield of targetable alteration detection" for advanced/metastatic disease [5][8]. This represents a Category 2A recommendation supporting ctDNA use alongside tissue-based molecular profiling to identify actionable mutations for targeted therapy selection.

**EARLY-STAGE NSCLC (Stages I-III):**
- Evidence: [GUIDELINE] NCCN Lung Cancer v3.2026 explicitly states that "ctDNA is not routinely recommended in settings other than advanced/metastatic disease" and "for stages I–III, tissue-based testing is preferred" [3][4]. This represents NCCN's current position that MRD/ctDNA testing is not part of routine early-stage management.
- Caveats: While observational data suggest prognostic value of ctDNA detection in early-stage NSCLC — with one study showing ctDNA detected in 24%, 77%, and 87% of stage I, II, and III patients respectively [2] — NCCN has not incorporated MRD-guided treatment decisions into standard practice guidelines.

**WHAT THE EVIDENCE DOESN'T ADDRESS:**
NCCN has not issued specific guidance on when early-stage ctDNA/MRD testing might be considered investigational or appropriate for clinical trial enrollment. [GUIDELINE] ESMO classifies ctDNA MRD as ESCAT level III (investigational) for treatment decisions, acknowledging that while prospective data are promising, additional randomized evidence is needed before incorporation into standard practice [1]. No completed phase III trial has demonstrated survival benefit from MRD-guided adjuvant therapy decisions in early-stage NSCLC.

**CURRENT NCCN POSITION:**
NCCN currently restricts ctDNA endorsement to advanced/metastatic NSCLC for molecular profiling purposes [5][8]. Early-stage MRD applications remain outside routine recommendations, with tissue-based approaches preferred for stages I-III molecular testing needs [3][4].

REFERENCES:
[1] ESMO Recommendations on Liquid Biopsy and ctDNA for Clinical Decision-Making in Solid Tumors. https://www.esmo.org/guidelines
[2] PETMRIinHCC Trial. Residual ctDNA after treatment predicts early relapse in patients with early-stage non-small cell lung cancer. Annals of Oncology (2021). PMID: 35306155
[3] NCCN Lung nsclc Cancer: early-stage disease (stages I-III). 3.2026. https://www.nccn.org/guidelines/category_1
[4] NCCN Lung_nsclc Cancer: early stage disease. https://www.nccn.org/guidelines/category_1
[5] NCCN Lung_nsclc Cancer: advanced/metastatic disease. https://www.nccn.org/guidelines/category_1
[6] Mack PC et al.. ADELOS Trial. Spectrum of driver mutations and clinical impact of circulating tumor DNA analysis in non-small cell lung cancer: Analysis of over 8000 cases.. Cancer (2020). PMID: 32365229
[7] Rosell R et al.. Liquid biopsy in detecting early non-small cell lung cancer.. The journal of liquid biopsy (2023). PMID: 40027282. DOI: 10.1016/j.jlb.2023.100001
[8] NCCN Lung nsclc Cancer: advanced/metastatic disease biomarker testing. 3.2026. https://www.nccn.org/guidelines/category_1

---
## Q21 (trial_evidence)

**Question:** Walk me through the key results from the DYNAMIC trial — the CRC MRD-guided treatment study. What were the primary endpoints and what did they actually show?

**Answer:**

## TRIAL EVIDENCE: DYNAMIC Trial Results

**TRIAL OVERVIEW:**
[RCT] The DYNAMIC trial was a randomized controlled trial in stage II colon cancer that compared ctDNA-guided adjuvant therapy decisions to standard clinicopathological risk assessment [3]. The trial enrolled 455 patients with stage II colon cancer in a 2:1 randomization. In the ctDNA-guided arm, patients with detectable ctDNA at 4 or 7 weeks post-surgery received oxaliplatin-based or fluoropyrimidine chemotherapy, while ctDNA-negative patients received no adjuvant treatment. The primary endpoint was 2-year recurrence-free survival.

**KEY FINDINGS:**
[RCT] DYNAMIC demonstrated that ctDNA-guided management was non-inferior to standard care for 2-year recurrence-free survival: 93.5% in the ctDNA-guided group versus 92.4% in the standard management group [3]. The ctDNA-guided approach reduced adjuvant chemotherapy use from 28% to 15% without compromising recurrence-free survival [3]. At 3-year follow-up, recurrence-free survival was 86.4% among ctDNA-positive patients who received adjuvant chemotherapy and 92.5% among ctDNA-negative patients who did not receive treatment [3].

**WHAT THE EVIDENCE SHOWS:**
[RCT] DYNAMIC validates that ctDNA status can safely guide adjuvant therapy decisions in stage II colon cancer, identifying patients who can forgo chemotherapy (ctDNA-negative) and those who benefit from treatment (ctDNA-positive) [3]. This trial [3] represents the first completed randomized trial demonstrating that MRD-guided treatment decisions can reduce chemotherapy exposure without compromising outcomes.

**WHAT THE EVIDENCE DOESN'T ADDRESS:**
The indexed evidence does not specifically address whether results can be extrapolated to stage III disease. Based on the available sources, it is unclear whether the trial demonstrated overall survival benefit, and longer-term follow-up data beyond 3 years are still maturing. Additionally, the study was conducted exclusively in colon cancer patients, not rectal cancer, where treatment paradigms differ significantly.

REFERENCES:
[1] MONDRIAN Trial. ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[2] MAP-02 Trial. A Tumor-Naïve ctDNA Assay Detects Minimal Residual Disease in Resected Stage II or III Colorectal Cancer and Predicts Recurrence: Subset Analysis From the GALAXY Study in CIRCULATE-Japan. Clinical Cancer Research (2023). PMID: 39513962
[3] Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer (DYNAMIC trial). New England Journal of Medicine (2021). PMID: 35657320. DOI: 10.1056/NEJMoa2200075
[4] NCT04264702: BESPOKE Study of ctDNA Guided Therapy in Colorectal Cancer. https://clinicaltrials.gov/study/NCT04264702
[5] Systematic literature review of health economic models developed for multiple myeloma to support future analyses.. Journal of medical economics (2022). PMID: 36346000. DOI: 10.1080/13696998.2022.2144056
[6] CIRCA-HPV Trial. Circulating Tumor DNA as a Marker of Recurrence Risk in Stage III Colorectal Cancer: The &#x3b1;-CORRECT Study.. Journal of surgical oncology (2025). PMID: 39865324. DOI: 10.1002/jso.27989
[7] NCT04786600: A Phase II Randomized Therapeutic Optimization Trial for Subjects With Refractory Metastatic Colorectal Cancer Using ctDNA: Rapid 1 Trial. https://clinicaltrials.gov/study/NCT04786600
[8] CLAUDIA: Platform Study of Circulating Tumor DNA Directed Adjuvant Chemotherapy in Colon Cancer (KCSG CO22-12). https://clinicaltrials.gov/study/NCT05534087

---
## Q22 (trial_evidence)

**Question:** Is CIRCULATE-Japan still enrolling? I've heard about it but don't know the study design details. Is it similar to DYNAMIC or different?

**Answer:**

TRIAL OVERVIEW:

[PROSPECTIVE] CIRCULATE-Japan includes multiple interconnected studies: GALAXY (observational biomarker validation) and VEGA (interventional de-escalation trial), both using Signatera tumor-informed ctDNA testing [1,5,7]. This differs significantly from DYNAMIC, which used a custom SafeSeqS assay and enrolled only stage II colon cancer patients [8].

**GALAXY (Observational Component):** [PROSPECTIVE] This prospective biomarker validation study enrolled over 1,500 patients with stage I-IV colorectal cancer for serial ctDNA monitoring [5]. The study demonstrated that ctDNA positivity at 4 weeks post-surgery was a strong independent predictor of recurrence (HR 10.0 for disease-free survival), and serial monitoring detected molecular relapse a median of 5.3 months before radiographic relapse [5]. An interim analysis with 2,240 patients and 23-month median follow-up reinforced the prognostic value, showing significantly inferior DFS (HR 11.99) and OS (HR 9.68) for ctDNA-positive patients [1].

**VEGA (Interventional Component):** [RCT] This is a phase III randomized trial testing whether adjuvant chemotherapy can be safely omitted in patients with resected high-risk stage II or stage III CRC who are ctDNA-negative at 4 weeks post-surgery [7]. Based on the available sources, patients are randomized to surveillance-only versus standard adjuvant chemotherapy, with disease-free survival as the primary endpoint [7]. DYNAMIC demonstrated non-inferiority of ctDNA-guided management versus standard clinicopathological risk assessment in stage II colon cancer, reducing adjuvant chemotherapy use from 28% to 15% without compromising 2-year recurrence-free survival [8].

**ENROLLMENT STATUS:** Based on the provided sources, VEGA appears to be ongoing with "enrollment ongoing" noted [7]. The indexed evidence does not specifically address real-time enrollment data for CIRCULATE-Japan. The indexed evidence does not specifically address current enrollment status; consider checking ClinicalTrials.gov for current CIRCULATE-Japan VEGA enrollment status.

REFERENCES:
[1] MONDRIAN Trial. ctDNA-based molecular residual disease and survival in resectable colorectal cancer.. Nat. Med. (2023). PMID: 39284954. DOI: 10.1038/s41591-024-03254-6
[2] MAP-02 Trial. A Tumor-Naïve ctDNA Assay Detects Minimal Residual Disease in Resected Stage II or III Colorectal Cancer and Predicts Recurrence: Subset Analysis From the GALAXY Study in CIRCULATE-Japan. Clinical Cancer Research (2023). PMID: 39513962
[3] CIRCULATE: Circulating Tumour DNA Based Decision for Adjuvant Treatment in Colon Cancer Stage II Evaluation. https://clinicaltrials.gov/study/NCT04089631
[4] CIRCULATE-US Trial. CIRCULATE: CIRCULATING TUMOR DNA BASED DECISION FOR ADJUVANT TREATMENT IN COLON CANCER STAGE II. https://clinicaltrials.gov/study/NCT04120701
[5] CIRCULATE-Japan GALAXY: Prospective ctDNA Surveillance in Resected Colorectal Cancer. Nature Medicine (2024). PMID: 37749153. DOI: 10.1038/s41591-024-03254-6
[6] RESPONSE Trial. Population health outcomes of blood-based screening for colorectal cancer in comparison to current screening modalities: insights from a discrete-event simulation model incorporating longitudinal adherence. Journal of Medical Economics. PMID: 39037853. DOI: 10.1080/13696998.2024.2382036
[7] CIRCULATE-Japan VEGA: Omission of Adjuvant Chemotherapy in ctDNA-Negative Stage II-III CRC. https://circulate-japan.org
[8] Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer (DYNAMIC trial). New England Journal of Medicine (2021). PMID: 35657320. DOI: 10.1056/NEJMoa2200075

---
## Q23 (trial_evidence)

**Question:** What trials are testing MRD-guided therapy decisions in breast cancer specifically? I know most ctDNA work has been in CRC but wondering what's active for breast.

**Answer:**

TRIAL OVERVIEW:

**Completed Trials:**
- [RCT] c-TRAK TN: Based on the available sources, this appears to be the first prospective interventional trial using ctDNA to guide therapy in early-stage triple-negative breast cancer (TNBC) [1]. This Phase II trial enrolled 208 patients with moderate- to high-risk early TNBC and used digital PCR for ctDNA surveillance. ctDNA-positive patients were randomized 2:1 to pembrolizumab vs observation [1].

- [RCT] PERSEVERE: A Phase II ctDNA-enriched, genomically directed post-neoadjuvant trial for patients with residual TNBC. The trial tested capecitabine, talazoparib, pembrolizumab, and inavolisib but was terminated after enrolling 52 patients [3].

**Currently Recruiting Trials:**
- [RCT] Artemis: A Phase II/III trial using ctDNA to initiate post-operation boost therapy after adjuvant chemotherapy in TNBC. This study is recruiting 260 patients and testing capecitabine ± camrelizumab + apatinib based on ctDNA status [4].

- [RCT] TREAT ctDNA: A Phase III trial testing elacestrant for ER+/HER2- breast cancer patients with ctDNA relapse. Currently recruiting 220 patients to compare elacestrant vs standard endocrine therapy (tamoxifen, letrozole, anastrozole, or exemestane) [7].

- [RCT] SERENA-6: A Phase III ctDNA-guided early switch study in HR+/HER2- metastatic breast cancer. This trial enrolled 315 patients with detectable ESR1 mutations and compared switching to AZD9833 + CDK4/6 inhibitor vs continuing aromatase inhibitor + CDK4/6 inhibitor [8].

**KEY FINDINGS:**
The c-TRAK TN trial revealed critical limitations of current MRD-guided approaches in TNBC: 72% of ctDNA-positive patients already had metastatic disease at the time of ctDNA detection, and none of the 5 patients who received pembrolizumab achieved sustained ctDNA clearance [1]. Based on these findings, there appears to be a narrow therapeutic window, though the indexed evidence does not specifically address optimal timing and frequency of testing or define the most effective interventions.

**ONGOING TRIALS:**
Multiple Phase II-III trials are actively recruiting across breast cancer subtypes, with NCT numbers available through ClinicalTrials.gov. These studies are testing various intervention strategies including targeted therapy switches (SERENA-6), immunotherapy combinations (Artemis), and endocrine therapy optimization (TREAT ctDNA).

**WHAT THE EVIDENCE DOESN'T ADDRESS:**
Current trials have limited follow-up for survival endpoints; optimal timing and frequency of ctDNA monitoring in different breast cancer subtypes remains undefined; most effective therapeutic interventions for ctDNA-positive patients are still being investigated; cross-talk between different breast cancer subtypes (TNBC vs ER+ vs HER2+) and optimal MRD strategies is understudied.

REFERENCES:
[1] c-TRAK-TN Trial. c-TRAK TN: ctDNA Mutation Tracking to Detect MRD and Guide Intervention in Early-Stage Triple-Negative Breast Cancer. PMID: 36423745
[2] Rong G et al.. MONDRIAN Trial. DNA damage response as a prognostic indicator in metastatic breast cancer via mutational analysis.. Annals of translational medicine (2021). PMID: 33708847
[3] PERSEVERE: Circulating Tumor DNA Enriched, Genomically Directed Post-neoadjuvant Trial for Patients With Residual Triple Negative Breast Cancer. https://clinicaltrials.gov/study/NCT04849364
[4] Artemis: A Prospective, Phase II Trial Using ctDNA to Initiate Post-operation Boost Therapy After Adjuvant Chemotherapy in TNBC. https://clinicaltrials.gov/study/NCT04803539
[5] Postmastectomy Radiation Therapy: An ASTRO-ASCO-SSO Clinical Practice Guideline. Journal of Clinical Oncology (2024). PMID: 40955654. DOI: 10.1200/JCO-25-01747
[6] Sentinel Lymph Node Biopsy in Early-Stage Breast Cancer: ASCO Guideline Update. Journal of Clinical Oncology (2024). PMID: 40209128. DOI: 10.1200/JCO-25-00099
[7] TREAT ctDNA: Elacestrant for Treating ER+/HER2- Breast Cancer Patients With ctDNA Relapse (TREAT ctDNA). https://clinicaltrials.gov/study/NCT05512364
[8] SERENA-6: Phase III Study to Assess AZD9833+ CDK4/6 Inhibitor in HR+/HER2-MBC With Detectable ESR1m Before Progression (SERENA-6). https://clinicaltrials.gov/study/NCT04964934

---
## Q24 (trial_evidence)

**Question:** Has the MERMAID-1 trial in NSCLC reported any results? It was testing ctDNA-guided adjuvant durvalumab if I remember correctly.

**Answer:**

**TRIAL OVERVIEW:**

[RCT] MERMAID-1 (NCT04385368) is a phase III, randomized, double-blind, placebo-controlled trial testing adjuvant durvalumab versus placebo in patients with resected stage II-III NSCLC who are ctDNA-positive after curative-intent surgery [1]. Based on the available sources, it is unclear whether this represents the first phase III trial to prospectively use ctDNA/MRD status as a biomarker for selecting patients for adjuvant immunotherapy in NSCLC, though disease-free survival serves as the primary endpoint [1]. The trial uses Guardant Reveal (tumor-naive approach) and excludes EGFR/ALK-positive patients who have established targeted therapy options [1].

**CURRENT STATUS:**

MERMAID-1 enrollment is complete, but results have not yet been formally reported as of early 2026 [1]. The trial enrolled patients with molecularly-defined residual disease to test whether ctDNA-guided immunotherapy improves outcomes in this high-risk population [1]. This study design establishes MRD-guided treatment as a viable clinical trial paradigm in lung cancer, specifically targeting patients with detectable circulating tumor DNA who face the highest recurrence risk [1].

**CLINICAL SIGNIFICANCE:**

The MERMAID-1 results, once available, will inform a critical decision point in resected NSCLC management: whether ctDNA-positive patients benefit from adjuvant immunotherapy escalation beyond standard chemotherapy [1]. This addresses a significant evidence gap, as current adjuvant immunotherapy data from IMpower010 showed mixed results and was not MRD-selected [1]. The trial's design specifically targets the non-driver mutation NSCLC population where treatment options remain limited compared to patients with actionable mutations [1].

**WHAT THE EVIDENCE DOESN'T ADDRESS:**

While MERMAID-1 represents a paradigm shift toward precision adjuvant therapy, several questions remain unanswered pending results publication: optimal ctDNA testing timing, durability of benefit, and whether MRD-guided approaches will ultimately change standard-of-care recommendations in resected NSCLC [1].

REFERENCES:
[1] MERMAID-1: ctDNA-Guided Adjuvant Durvalumab in Resected NSCLC. https://clinicaltrials.gov/study/NCT04385368
[2] ERIS Trial. MERMAID-1: Phase III Study to Determine the Efficacy of Durvalumab in Combination With Chemotherapy in Completely Resected Stage II-III Non-small Cell Lung Cancer (NSCLC). https://clinicaltrials.gov/study/NCT04385368
[3] ADELOS Trial. NCT04585477: Adjuvant ctDNA-Adapted Personalized Treatment in Early Stage NSCLC (ADAPT-E). https://clinicaltrials.gov/study/NCT04585477
[4] Liu J et al.. Targeted Therapies in Early-Stage Resectable Non-Small-Cell Lung Cancer: New Kids on the Block.. JCO precision oncology (2023). PMID: 37656950. DOI: 10.1200/PO.22.00445
[5] Kwon M et al.. Longitudinal monitoring by next-generation sequencing of plasma cell-free DNA in ALK rearranged NSCLC patients treated with ALK tyrosine kinase inhibitors.. Cancer medicine (2022). PMID: 35437925. DOI: 10.1002/cam4.4663
[6] Mack PC et al.. Spectrum of driver mutations and clinical impact of circulating tumor DNA analysis in non-small cell lung cancer: Analysis of over 8000 cases.. Cancer (2020). PMID: 32365229
[7] NCT04093167: Study of CTDNA Response Adaptive Immuno-Chemotherapy in NSCLC. https://clinicaltrials.gov/study/NCT04093167
[8] WHENII Trial. NCT02955758: Pembrolizumab in Patients With Metastatic Non-squamous Non-small Cell Lung Cancer. https://clinicaltrials.gov/study/NCT02955758