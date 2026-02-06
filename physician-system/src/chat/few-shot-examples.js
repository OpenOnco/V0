/**
 * Few-shot examples for the MRD physician chat system.
 * These teach the model the decision-oriented response format.
 *
 * Each example pair demonstrates:
 * - Non-directive language (no "you should" or "I recommend")
 * - Citation format with [1], [2], etc.
 * - Decision-oriented structure (OPTION A/B/C for clinical, COMPARISON for tests, etc.)
 * - Honest acknowledgment of evidence gaps
 * - Appropriate length (3-5 paragraphs)
 */

/**
 * Query type tags for filtering examples by relevance.
 * @type {string[]}
 */
const QUERY_TYPES = [
  'clinical_guidance',
  'clinical_guidance',
  'test_comparison',
  'coverage_policy',
  'general',
  'clinical_guidance',
  'clinical_guidance',
];

export const FEW_SHOT_EXAMPLES = [
  // ──────────────────────────────────────────────
  // Example 1: MRD+ CRC post-resection (escalation)
  // queryType: clinical_guidance
  // ──────────────────────────────────────────────
  {
    role: 'user',
    content:
      'My patient has stage III colon cancer, had surgery 6 weeks ago, and Signatera came back positive. What does the evidence say about next steps?',
  },
  {
    role: 'assistant',
    content: `CLINICAL SCENARIO: Stage III colon cancer, 6 weeks post-resection, Signatera ctDNA-positive.
DECISION: How to approach adjuvant therapy in a ctDNA-positive patient.

OPTION A: Intensify adjuvant chemotherapy.
- Evidence: The CIRCULATE-Japan (GALAXY) study demonstrated that patients with detectable ctDNA at 4 weeks post-surgery had significantly worse disease-free survival (DFS), and that ctDNA clearance during adjuvant therapy was associated with improved outcomes [1]. Emerging data from DYNAMIC-III suggest that MRD-guided escalation strategies in stage III CRC are feasible, though mature survival results are pending [2]. For RAS wild-type tumors, clinicians have explored adding a targeted agent (e.g., cetuximab) or escalating to FOLFOXIRI, though prospective evidence for ctDNA-guided escalation specifically remains limited.
- Caveats: No completed prospective RCT has yet demonstrated a survival benefit from escalating therapy based on a positive ctDNA result in stage III CRC.

OPTION B: Proceed with standard adjuvant chemotherapy and serial ctDNA monitoring.
- Evidence: GALAXY data showed that serial ctDNA assessment at 3-month intervals can track response to adjuvant therapy, with ctDNA clearance during treatment associated with favorable DFS [1]. Standard FOLFOX or CAPOX for 3-6 months remains the guideline-endorsed backbone for stage III disease [3]. Repeating ctDNA at the midpoint of adjuvant therapy (approximately 3 months) can inform whether the current regimen is achieving molecular response.
- Caveats: Optimal monitoring interval for serial ctDNA during active treatment has not been established in a randomized setting.

OPTION C: Clinical trial enrollment.
- Evidence: Several active trials are specifically designed for ctDNA-positive CRC patients. NRG-GI005 (COBRA) is evaluating ctDNA-guided adjuvant therapy in stage IIA colon cancer [4]. The CIRCULATE North America trial and other MRD-directed studies are enrolling stage III patients and may offer access to escalation strategies not available outside a trial setting [2].
- Caveats: Trial availability is site-dependent and eligibility criteria vary.

WHAT THE EVIDENCE DOESN'T ADDRESS:
There is no completed phase III trial demonstrating that changing treatment based on a positive ctDNA result improves overall survival in stage III CRC. The optimal threshold for clinical action on ctDNA positivity (e.g., allele fraction cutoffs, number of variants detected) has not been standardized across platforms.

TEST-SPECIFIC NOTE: Signatera is a tumor-informed assay that tracks up to 16 patient-specific somatic variants. It has the largest body of CRC-specific validation data among commercially available MRD assays, including the prospective GALAXY cohort [1]. Tumor tissue from the resection specimen is required for assay design, which typically adds approximately 2 weeks to initial turnaround time.`,
  },

  // ──────────────────────────────────────────────
  // Example 2: MRD- CRC post-adjuvant (de-escalation)
  // queryType: clinical_guidance
  // ──────────────────────────────────────────────
  {
    role: 'user',
    content:
      'Stage III CRC patient finished 3 months of FOLFOX, ctDNA is negative. Can we safely stop chemo?',
  },
  {
    role: 'assistant',
    content: `CLINICAL SCENARIO: Stage III CRC, completed 3 months of FOLFOX, ctDNA now undetectable.
DECISION: Whether to complete the planned 6-month adjuvant course or stop early based on MRD negativity.

OPTION A: Complete the planned 6-month adjuvant course.
- Evidence: Standard of care for stage III CRC remains 3-6 months of adjuvant FOLFOX or CAPOX, with the IDEA collaboration establishing non-inferiority of 3 months for low-risk stage III (T1-3, N1) [1]. However, for high-risk stage III (T4 or N2), 6 months of FOLFOX was associated with superior DFS in IDEA [1]. Current NCCN guidelines do not yet incorporate ctDNA results into duration-of-therapy decisions for stage III disease [2].
- Caveats: The standard-of-care recommendation does not account for molecular response data.

OPTION B: Consider stopping at 3 months based on ctDNA negativity.
- Evidence: The DYNAMIC trial (stage II CRC) demonstrated that ctDNA-guided management could safely reduce adjuvant chemotherapy use without compromising recurrence-free survival, with ctDNA-negative patients assigned to observation alone [3]. However, DYNAMIC enrolled only stage II patients, and stage III extrapolation remains unproven. The DYNAMIC-III trial is specifically evaluating ctDNA-guided de-escalation in stage III disease, but results have not yet been reported [4].
- Caveats: Stage III carries inherently higher recurrence risk than stage II, and the negative predictive value (NPV) of ctDNA assays may differ by stage, timing, and assay platform.

OPTION C: Continue with serial ctDNA monitoring every 3-6 months.
- Evidence: Regardless of the treatment duration decision, serial ctDNA monitoring during surveillance can provide early recurrence detection. GALAXY data suggest that ctDNA-based surveillance detects recurrence a median of several months before radiographic imaging [1]. Monitoring at 3-6 month intervals during the first 2 years post-treatment is consistent with emerging consensus.
- Caveats: No randomized trial has demonstrated that earlier recurrence detection via ctDNA improves overall survival.

WHAT THE EVIDENCE DOESN'T ADDRESS:
The critical gap is the absence of mature data from DYNAMIC-III, which will directly address whether ctDNA can guide treatment duration in stage III CRC. Until those results are available, de-escalation in stage III based on ctDNA negativity is not supported by prospective randomized evidence. It is also important to note that a negative ctDNA result does not guarantee cure. The NPV varies by assay, timing of the blood draw, and tumor biology, and some patients with undetectable ctDNA will still experience recurrence.`,
  },

  // ──────────────────────────────────────────────
  // Example 3: Test comparison (Signatera vs Guardant Reveal)
  // queryType: test_comparison
  // ──────────────────────────────────────────────
  {
    role: 'user',
    content:
      'For CRC MRD monitoring, what are the key differences between Signatera and Guardant Reveal?',
  },
  {
    role: 'assistant',
    content: `COMPARISON: Signatera (Natera) vs. Guardant Reveal (Guardant Health) for CRC MRD monitoring.

TECHNICAL APPROACH:
- Signatera is a tumor-informed assay. It requires whole-exome sequencing of the resected tumor specimen to design a personalized panel tracking up to 16 patient-specific somatic variants in cell-free DNA [1]. This bespoke approach provides high analytical specificity for that individual patient's tumor.
- Guardant Reveal is a tumor-naive (also called tumor-agnostic) assay. It analyzes cell-free DNA from a blood draw alone, combining genomic alteration detection with epigenomic signals (methylation patterns and fragmentomics) [2]. No tumor tissue is required.

CLINICAL EVIDENCE IN CRC:
- Signatera has the larger body of CRC-specific clinical validation, including the prospective GALAXY study (>1,000 stage I-IV CRC patients), with data on ctDNA kinetics during and after adjuvant therapy [1]. It is also the MRD assay used in several interventional trials, including CIRCULATE-Japan and DYNAMIC-III [3].
- Guardant Reveal has published CRC validation data, including sensitivity and specificity analyses in post-surgical CRC cohorts [2]. Its CRC evidence base is growing but currently includes fewer large prospective datasets and fewer trial-level integrations compared to Signatera.

PRACTICAL CONSIDERATIONS:
- Signatera requires tumor tissue from surgery or biopsy, which adds approximately 2 weeks to the initial turnaround time for bespoke panel design. Subsequent blood draws are faster because the custom panel is already built. This tissue requirement can be a barrier if archival tissue is unavailable or insufficient.
- Guardant Reveal can be ordered immediately post-surgery using a blood draw alone, which simplifies logistics and avoids tissue dependency. This can be advantageous in clinical scenarios where rapid baseline assessment is desired or tissue is limited.

COVERAGE:
Both assays have limited commercial payer coverage for MRD indications. Medicare coverage is available through the MolDX LCD (L38779) for specific clinical scenarios, including CRC surveillance in defined settings [4]. Commercial payer policies vary widely, and many still classify MRD testing as investigational.

WHAT THE EVIDENCE DOESN'T ADDRESS:
No head-to-head randomized trial has directly compared Signatera and Guardant Reveal in the same CRC patient cohort. Published sensitivity and specificity figures are not directly comparable across studies due to differences in patient populations, cancer stages, sample timing, and analytical methodologies. The choice between platforms often depends on tissue availability, clinical workflow, and institutional experience rather than definitive evidence of clinical superiority.`,
  },

  // ──────────────────────────────────────────────
  // Example 4: Coverage/access question
  // queryType: coverage_policy
  // ──────────────────────────────────────────────
  {
    role: 'user',
    content:
      'Is MRD testing covered by insurance? My patient has Aetna.',
  },
  {
    role: 'assistant',
    content: `COVERAGE SUMMARY: MRD/ctDNA testing insurance coverage as of early 2026, with Aetna-specific detail.

MEDICARE:
MRD testing for select solid tumor indications is covered through the MolDX program via Local Coverage Determination L38779 [1]. Covered indications include CRC stage II-III post-surgical surveillance and certain other solid tumor settings where ctDNA-based MRD assessment has demonstrated clinical utility. Coverage is limited to FDA-approved or analytically validated assays that meet MolDX technical requirements.

AETNA (PATIENT'S PAYER):
Aetna's Clinical Policy Bulletin 0715 generally classifies tumor-informed MRD testing (including Signatera) as experimental and investigational for most solid tumor indications [2]. The policy acknowledges emerging evidence but has not established broad coverage criteria for ctDNA-based MRD monitoring as of the most recent policy review. Prior authorization is typically required, and claims for MRD testing are frequently denied under this policy.

OTHER MAJOR PAYERS:
Coverage varies significantly across commercial payers. Blue Shield of California has established conditional coverage for MRD testing in specific stage III/IV solid tumor settings [3]. UnitedHealthcare currently lists ctDNA-based MRD monitoring as unproven for most indications in its medical policy [4]. Several regional BCBS plans have followed the MolDX determination and provide coverage aligned with Medicare criteria.

ACCESS OPTIONS:
When insurance coverage is denied, several options may be available. Some test manufacturers offer patient financial assistance programs that cap out-of-pocket costs. Self-pay pricing varies by vendor and test but is typically in the range of several hundred to several thousand dollars per test. Appeals based on individual clinical circumstances, particularly for patients enrolled in clinical trials or with high-risk disease features, are sometimes successful.

WHAT THE EVIDENCE DOESN'T ADDRESS:
The payer coverage landscape for MRD testing is evolving rapidly, and policies are updated periodically. Coverage status described here reflects the most recent indexed policy documents and may not capture the latest revisions. Verification of current coverage through the patient's specific plan and benefits is always advisable before ordering.`,
  },

  // ──────────────────────────────────────────────
  // Example 5: NCCN guidelines query
  // queryType: general
  // ──────────────────────────────────────────────
  {
    role: 'user',
    content:
      'What do the NCCN guidelines say about ctDNA testing in colorectal cancer?',
  },
  {
    role: 'assistant',
    content: `CLINICAL SCENARIO: NCCN guideline recommendations for ctDNA/MRD testing in colorectal cancer.

GUIDELINE RECOMMENDATIONS:
The NCCN Clinical Practice Guidelines in Oncology for Colon Cancer include ctDNA as an option in the post-surgical surveillance setting for stage II and stage III disease [1]. Specifically, ctDNA testing is listed as an assessment that clinicians may consider when evaluating the need for adjuvant chemotherapy in stage II patients, particularly those with indeterminate risk features. For stage III disease, ctDNA is acknowledged as an emerging tool but is not yet designated as a standard component of treatment decision-making [1].

The NCCN recommendation carries a Category 2A designation, indicating uniform consensus that the intervention is appropriate based on lower-level evidence including clinical experience [2]. This places ctDNA testing in CRC below the threshold of Category 1 (high-level evidence with uniform consensus) but within the range of accepted clinical practice options.

WHAT THE GUIDELINES STATE AND DO NOT STATE:
The guidelines state that ctDNA may be informative for risk stratification in the post-surgical setting but do not currently endorse ctDNA-guided treatment modification as a standard practice [1]. Specifically, the NCCN does not recommend escalating or de-escalating adjuvant therapy based solely on ctDNA results outside of a clinical trial. The guidelines reference the growing body of evidence from studies such as DYNAMIC and CIRCULATE but note that interventional data demonstrating survival benefit from MRD-guided therapy changes are not yet mature [2].

CLINICAL CONSIDERATIONS:
Clinical practice in many academic centers has outpaced the current guideline language, with ctDNA testing increasingly ordered in routine post-surgical CRC management. The NCCN guidelines are updated multiple times per year, and the ctDNA sections have been revised in recent versions to reflect accumulating evidence [3]. Clinicians using ctDNA testing in CRC may find that the guidelines provide a framework for discussing the test with patients while noting that the clinical actionability of results remains an area of active investigation.

LIMITATIONS:
NCCN guidelines are updated on a rolling basis and the specific language around ctDNA may change between guideline versions. The recommendations referenced here are based on the most recent indexed version available in the evidence database. Guidelines in rapidly evolving fields like MRD testing may lag behind the latest published trial data and real-world clinical adoption patterns.`,
  },

  // ──────────────────────────────────────────────
  // Example 6: TNBC breast de-escalation (MRD-negative)
  // queryType: clinical_guidance
  // ──────────────────────────────────────────────
  {
    role: 'user',
    content:
      'My TNBC patient is MRD-negative after neoadjuvant chemo and surgery. She had a pathologic complete response. The plan was capecitabine per CREATE-X. Do I still need it if ctDNA is undetectable?',
  },
  {
    role: 'assistant',
    content: `CLINICAL SCENARIO: Triple-negative breast cancer (TNBC), post-neoadjuvant chemotherapy, pathologic complete response (pCR), ctDNA undetectable.
DECISION: Whether to proceed with adjuvant capecitabine per CREATE-X in a patient with pCR and negative MRD.

OPTION A: Proceed with capecitabine per CREATE-X indication regardless of MRD status.
- Evidence: The CREATE-X trial demonstrated significant overall survival benefit from adjuvant capecitabine in HER2-negative breast cancer patients with residual invasive disease after neoadjuvant therapy [1]. Critically, CREATE-X enrolled patients based on pathologic response (non-pCR), not MRD status. The benefit was most pronounced in the TNBC subgroup. Current NCCN guidelines recommend capecitabine for TNBC patients with residual disease after neoadjuvant therapy [2].
- Caveats: This patient achieved pCR, which already places her in a favorable prognostic category. CREATE-X was designed for non-pCR patients. Whether capecitabine adds benefit for pCR patients (regardless of MRD status) is not established.

OPTION B: Consider omitting capecitabine based on both pCR and MRD negativity.
- Evidence: Patients achieving pCR after neoadjuvant therapy for TNBC have significantly better outcomes than non-pCR patients [3]. Adding MRD negativity to pCR further identifies an extremely low-risk subgroup. The BESPOKE study showed that ctDNA-negative early breast cancer patients had favorable outcomes [4]. However, no prospective trial has evaluated omitting capecitabine specifically in pCR + MRD-negative TNBC patients.
- Caveats: This approach is entirely investigational. The absence of detectable ctDNA does not prove absence of micrometastatic disease. TNBC recurrence risk peaks at 1-3 years post-treatment, and even low-risk patients experience recurrences.

OPTION C: Serial MRD monitoring with capecitabine initiation only if ctDNA converts positive.
- Evidence: c-TRAK TN evaluated ctDNA-triggered pembrolizumab in TNBC, demonstrating feasibility of a "watch and treat on conversion" approach [4]. A similar strategy could theoretically apply to capecitabine, initiating treatment only upon molecular recurrence detection. This has not been studied in a randomized trial.
- Caveats: This deferred approach risks missing the optimal adjuvant treatment window. Capecitabine benefit may be greatest early after surgery, and delaying initiation until molecular relapse may reduce efficacy. This strategy is hypothesis-generating only.

WHAT THE EVIDENCE DOESN'T ADDRESS:
No trial has tested MRD-guided de-escalation in TNBC. CREATE-X was not MRD-selected and enrolled non-pCR patients. The combination of pCR + MRD negativity identifies a very favorable subgroup, but "very favorable" is not "zero risk." Additionally, TNBC has limited late-recurrence risk compared to HR+ disease, which makes MRD monitoring somewhat more informative in the early post-treatment window — but the clinical actionability of that information for de-escalation remains unproven.

TEST-SPECIFIC NOTE: Tumor-informed assays (Signatera) have higher sensitivity for detecting low-level ctDNA than tumor-naive approaches. For de-escalation decisions where a false-negative result could lead to undertreating a curable cancer, maximizing assay sensitivity is critical. Consider repeat testing at 3-6 months to confirm sustained negativity.`,
  },

  // ──────────────────────────────────────────────
  // Example 7: NSCLC escalation (MRD-positive, no driver mutations)
  // queryType: clinical_guidance
  // ──────────────────────────────────────────────
  {
    role: 'user',
    content:
      'Stage IIB NSCLC, no driver mutations, PD-L1 30%, MRD positive after lobectomy. I was planning standard adjuvant cisplatin-pemetrexed. Should I push for adjuvant immunotherapy based on the MRD result?',
  },
  {
    role: 'assistant',
    content: `CLINICAL SCENARIO: Stage IIB NSCLC, no actionable driver mutations, PD-L1 30%, ctDNA-positive post-lobectomy.
DECISION: Whether MRD positivity should influence the choice of adjuvant therapy, specifically the addition of immunotherapy.

OPTION A: Adjuvant atezolizumab per IMpower010 (after cisplatin-based chemotherapy).
- Evidence: IMpower010 demonstrated significant DFS improvement with adjuvant atezolizumab following cisplatin-based chemotherapy in resected stage II-IIIA NSCLC with PD-L1 ≥1% [1]. This patient (stage IIB, PD-L1 30%) falls within the approved indication. Correlative ctDNA analyses from IMpower010 suggested that patients with detectable ctDNA post-surgery derived benefit from atezolizumab, though these data are hypothesis-generating [1].
- Caveats: Atezolizumab adjuvant approval is based on PD-L1 and stage, not MRD status. The IMpower010 ctDNA correlative data have not been validated prospectively for treatment selection.

OPTION B: Adjuvant pembrolizumab per KEYNOTE-091.
- Evidence: KEYNOTE-091 (PEARLS) demonstrated DFS improvement with adjuvant pembrolizumab in stage IB-IIIA resected NSCLC [2]. Unlike IMpower010, the KEYNOTE-091 benefit was observed regardless of PD-L1 expression level. This provides an alternative immunotherapy option for this patient.
- Caveats: MRD status was not a stratification factor in KEYNOTE-091 and ctDNA correlative analyses are limited. The choice between atezolizumab and pembrolizumab is typically based on PD-L1 status, toxicity profile, and practical considerations rather than MRD.

OPTION C: Clinical trial enrollment — MERMAID-1 for ctDNA-guided adjuvant durvalumab.
- Evidence: MERMAID-1 (NCT04385368) is specifically evaluating adjuvant durvalumab plus chemotherapy versus chemotherapy alone in resected NSCLC patients with detectable ctDNA post-surgery [3]. This is the only phase III trial explicitly using MRD as a selection biomarker for adjuvant immunotherapy in NSCLC. Enrollment may provide access to MRD-guided therapy within a rigorous trial framework.
- Caveats: Trial availability is site-dependent. Results have not yet been reported. If enrolled, randomization may assign the patient to the control arm.

WHAT THE EVIDENCE DOESN'T ADDRESS:
MRD positivity in this clinical scenario adds prognostic urgency — these patients have a high likelihood of recurrence. However, MRD is not a validated predictive biomarker for immunotherapy benefit in NSCLC. The patient already qualifies for adjuvant immunotherapy based on stage and PD-L1 status via IMpower010. MRD positivity may reinforce the decision to add immunotherapy but does not represent a new indication beyond what PD-L1/stage already supports. The unanswered question is whether MRD-positive patients who are PD-L1-negative would benefit from immunotherapy — this is being addressed by MERMAID-1 but is not yet established.

TEST-SPECIFIC NOTE: For patients without actionable driver mutations, the choice of MRD assay is less constrained than for EGFR/ALK-positive patients. Tissue availability from lobectomy specimens is typically adequate for tumor-informed assays. FoundationOne Tracker may be convenient if FoundationOne CDx comprehensive genomic profiling was already performed for driver mutation screening.`,
  },
];

/**
 * Get few-shot examples formatted for the Claude messages API.
 * Returns alternating user/assistant message pairs.
 *
 * @param {number} [count=5] - Number of example pairs to include (max 7)
 * @returns {Array<{role: string, content: string}>} Messages array for Claude API
 */
export function getFewShotMessages(count = 5) {
  const clamped = Math.min(Math.max(count, 1), Math.floor(FEW_SHOT_EXAMPLES.length / 2));
  return FEW_SHOT_EXAMPLES.slice(0, clamped * 2);
}

/**
 * Get examples filtered by query type.
 *
 * @param {string} queryType - One of: clinical_guidance, coverage_policy, test_comparison, trial_evidence, general
 * @returns {Array<{role: string, content: string}>} Matching example pairs (user + assistant messages)
 */
export function getExamplesByType(queryType) {
  const pairs = [];

  for (let i = 0; i < QUERY_TYPES.length; i++) {
    if (QUERY_TYPES[i] === queryType) {
      const msgIndex = i * 2;
      if (msgIndex + 1 < FEW_SHOT_EXAMPLES.length) {
        pairs.push(FEW_SHOT_EXAMPLES[msgIndex]);
        pairs.push(FEW_SHOT_EXAMPLES[msgIndex + 1]);
      }
    }
  }

  return pairs;
}

/**
 * Get all available query types that have examples.
 * @returns {string[]} Unique query type strings
 */
export function getAvailableQueryTypes() {
  return [...new Set(QUERY_TYPES)];
}
