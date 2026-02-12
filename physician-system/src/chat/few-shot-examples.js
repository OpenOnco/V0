/**
 * Few-shot examples for the MRD physician chat system.
 * These teach the model the decision-oriented response format.
 *
 * Each example demonstrates:
 * - Non-directive language (no "you should" or "I recommend")
 * - Citation format with [1], [2], etc.
 * - Decision-oriented structure (OPTION A/B for clinical, COMPARISON for tests)
 * - Evidence tier labels: [RCT], [PROSPECTIVE], [RETROSPECTIVE], [GUIDELINE]
 * - Study-assay attribution (correct assay type for each study)
 * - Unit-correct language (VAF vs MTM/mL)
 * - 200-250 word target
 */

/**
 * Query type tags for filtering examples by relevance.
 * @type {string[]}
 */
const QUERY_TYPES = [
  'clinical_guidance',
  'clinical_guidance',
  'test_comparison',
  'general',
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
    content: `DECISION: Adjuvant therapy approach in ctDNA-positive stage III colon cancer post-resection.

OPTION A: Intensify or initiate adjuvant chemotherapy with serial ctDNA monitoring.
[PROSPECTIVE] The GALAXY study (Signatera, tumor-informed) showed that ctDNA-positive patients had significantly worse DFS, and ctDNA clearance during adjuvant therapy correlated with improved outcomes [1]. Standard FOLFOX or CAPOX for 3-6 months remains guideline-endorsed for stage III disease [2]. Serial Signatera monitoring (MTM/mL) at ~3-month intervals can track molecular response to therapy. No completed RCT has yet demonstrated a survival benefit from escalating beyond standard adjuvant therapy based on ctDNA positivity alone.

OPTION B: Clinical trial enrollment for ctDNA-guided therapy.
[RCT] DYNAMIC-III is evaluating ctDNA-guided adjuvant decisions specifically in stage III CRC but results are pending [3]. CIRCULATE North America (Signatera, tumor-informed) is also enrolling ctDNA-positive patients [4]. Note: the DYNAMIC trial (PMID: 35657320) enrolled only stage II colon cancer — its de-escalation results do not apply to stage III.

EVIDENCE GAPS: No phase III data yet support ctDNA-guided escalation in stage III CRC. The optimal threshold for action on Signatera MTM/mL levels has not been standardized.`,
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
    content: `DECISION: Whether to complete planned 6-month adjuvant course or stop at 3 months based on ctDNA negativity.

OPTION A: Complete the planned 6-month course.
[RCT] The IDEA collaboration showed 3 months of CAPOX was non-inferior to 6 months for low-risk stage III (T1-3, N1), but for high-risk stage III (T4 or N2) 6 months of FOLFOX was superior [1]. N2 disease is classified as HIGH RISK regardless of T-stage. [GUIDELINE] NCCN Colon Cancer v1.2026 does not yet incorporate ctDNA results into duration-of-therapy decisions for stage III disease [2].

OPTION B: Consider stopping at 3 months given ctDNA negativity.
[RCT] The DYNAMIC trial (PMID: 35657320, SafeSeqS assay, tumor-informed) demonstrated that ctDNA-guided management safely reduced chemotherapy use in stage II colon cancer without compromising RFS [3]. However, DYNAMIC enrolled only stage II patients. [RCT] DYNAMIC-III is evaluating this question in stage III but results are pending [4].

EVIDENCE GAPS: No mature data support ctDNA-guided de-escalation in stage III CRC. A negative ctDNA result does not guarantee cure — NPV varies by assay, timing, and tumor biology. The patient's IDEA risk classification (T and N status) should inform the duration decision alongside ctDNA results.`,
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

KEY DIFFERENCES:
Signatera is tumor-informed — it requires whole-exome sequencing of resected tumor to design a personalized 16-variant panel. Results are reported as mean tumor molecules per mL (MTM/mL) [1]. Guardant Reveal is tumor-naive — it analyzes cfDNA from a blood draw alone using genomic alterations plus epigenomic signals (methylation, fragmentomics). No tumor tissue required. Results reported as detected/not detected [2].

CLINICAL EVIDENCE:
[PROSPECTIVE] Signatera has the larger CRC evidence base, including GALAXY (>1,500 patients, PMID: 37749153) with longitudinal ctDNA kinetics data [1]. GALAXY, VEGA, BESPOKE, COBRA, and CIRCULATE-US all use Signatera (tumor-informed) [3]. Guardant Reveal has published CRC validation data and the COSMOS study, but fewer large prospective datasets to date [2].

PRACTICAL NOTES:
Signatera requires ~2 weeks for initial panel design (tissue-dependent). Subsequent draws are faster. Guardant Reveal can be ordered immediately post-surgery. MTM/mL (Signatera) and tumor signal scores (Guardant Reveal) are different measurements and should not be compared directly. No head-to-head trial has compared the two assays in the same CRC cohort.`,
  },

  // ──────────────────────────────────────────────
  // Example 4: NCCN guidelines query
  // queryType: general
  // ──────────────────────────────────────────────
  {
    role: 'user',
    content:
      'What do the NCCN guidelines say about ctDNA testing in colorectal cancer?',
  },
  {
    role: 'assistant',
    content: `[GUIDELINE] NCCN Colon Cancer v1.2026 includes ctDNA as an option in post-surgical surveillance for stage II and stage III CRC [1]. Specifically, ctDNA testing is listed as an assessment clinicians may consider when evaluating adjuvant chemotherapy need in stage II patients with indeterminate risk features. For stage III, ctDNA is acknowledged as emerging but not yet a standard treatment decision component [1].

The recommendation carries Category 2A designation — uniform consensus based on lower-level evidence including clinical experience [2]. NCCN references the growing body of evidence from [RCT] DYNAMIC (stage II, PMID: 35657320) and [PROSPECTIVE] GALAXY/CIRCULATE-Japan but notes that interventional data demonstrating survival benefit from MRD-guided therapy changes are not yet mature [2].

Importantly, NCCN does not currently endorse escalating or de-escalating adjuvant therapy based solely on ctDNA results outside of a clinical trial. Clinical practice at many academic centers has outpaced the guideline language, with ctDNA testing increasingly ordered in routine post-surgical CRC management. The ctDNA sections have been revised in recent guideline versions to reflect accumulating evidence [1].`,
  },

  // ──────────────────────────────────────────────
  // Example 5: TNBC breast de-escalation (MRD-negative)
  // queryType: clinical_guidance
  // ──────────────────────────────────────────────
  {
    role: 'user',
    content:
      'My TNBC patient is MRD-negative after neoadjuvant chemo and surgery with pCR. Do I still need capecitabine per CREATE-X?',
  },
  {
    role: 'assistant',
    content: `DECISION: Whether to proceed with adjuvant capecitabine in a TNBC patient with pCR and negative MRD.

OPTION A: Proceed with capecitabine per CREATE-X.
[RCT] CREATE-X demonstrated significant OS benefit from adjuvant capecitabine in HER2-negative breast cancer with residual invasive disease after neoadjuvant therapy, with the largest benefit in the TNBC subgroup [1]. Critically, CREATE-X enrolled patients based on non-pCR — this patient achieved pCR, which already places her in a favorable category. Whether capecitabine adds benefit for pCR patients regardless of MRD status is not established. [GUIDELINE] NCCN Breast Cancer v1.2026 recommends capecitabine for non-pCR TNBC after neoadjuvant therapy [2].

OPTION B: Omit capecitabine based on pCR + MRD negativity.
[PROSPECTIVE] The c-TRAK TN trial (RaDaR assay, Inivata, tumor-informed) demonstrated feasibility of ctDNA-triggered intervention in TNBC [3]. Patients achieving pCR with undetectable ctDNA represent an extremely low-risk subgroup, but no prospective trial has evaluated omitting capecitabine specifically in this population. A negative ctDNA result does not prove absence of micrometastatic disease.

EVIDENCE GAPS: No trial has tested MRD-guided de-escalation in TNBC. The combination of pCR + MRD negativity identifies a very favorable subgroup, but the clinical actionability of that information for omitting standard therapy remains unproven.`,
  },
];

/**
 * Get few-shot examples formatted for the Claude messages API.
 * Returns alternating user/assistant message pairs.
 *
 * @param {number} [count=5] - Number of example pairs to include (max 5)
 * @returns {Array<{role: string, content: string}>} Messages array for Claude API
 */
export function getFewShotMessages(count = 5) {
  const clamped = Math.min(Math.max(count, 1), Math.floor(FEW_SHOT_EXAMPLES.length / 2));
  return FEW_SHOT_EXAMPLES.slice(0, clamped * 2);
}

/**
 * Get examples filtered by query type.
 *
 * @param {string} queryType - One of: clinical_guidance, test_comparison, trial_evidence, general
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
