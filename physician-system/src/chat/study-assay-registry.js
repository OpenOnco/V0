/**
 * Canonical Study-Assay Registry
 *
 * Maps landmark MRD/ctDNA studies to their correct assay platform and type.
 * Prevents LLM hallucination of study-assay relationships (e.g., claiming
 * GALAXY used a tumor-naive assay when it used Signatera/tumor-informed).
 *
 * Used in two ways:
 * 1. Injected into LLM system prompt as canonical reference
 * 2. Post-generation check for misattribution
 */

export const STUDY_ASSAY_REGISTRY = [
  // CRC studies
  {
    study: 'GALAXY',
    fullName: 'GALAXY/CIRCULATE-Japan',
    assay: 'Signatera',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'prospective observational',
    pmid: '37749153',
    notes: 'N>1500 CRC patients, longitudinal ctDNA kinetics',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: ['ctDNA clearance rate', 'lead time over imaging'],
    evidenceStrength: 'Large prospective cohort',
    keyResult: 'ctDNA-positive patients had significantly worse DFS; serial monitoring detected recurrence ahead of imaging',
    permittedClaims: ['DFS correlation', 'recurrence prediction', 'lead time over imaging', 'ctDNA kinetics'],
    prohibitedClaims: ['OS benefit'],
  },
  {
    study: 'VEGA',
    fullName: 'VEGA (CIRCULATE-Japan)',
    assay: 'Signatera',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'RCT',
    pmid: null,
    notes: 'ctDNA-negative stage II/III CRC randomized to adjuvant chemo vs observation',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: ['OS'],
    evidenceStrength: 'Phase III RCT',
    keyResult: 'ctDNA-negative patients could safely omit adjuvant chemotherapy',
    permittedClaims: ['DFS non-inferiority', 'omission of adjuvant chemotherapy in ctDNA-negative', 'de-escalation'],
    prohibitedClaims: ['OS benefit'],
  },
  {
    study: 'DYNAMIC',
    fullName: 'DYNAMIC Trial',
    assay: 'SafeSeqS (custom)',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'RCT',
    pmid: '35657320',
    notes: 'Stage II colon cancer ONLY. ctDNA-guided adjuvant therapy decisions.',
    primaryEndpoint: 'RFS',
    secondaryEndpoints: ['adjuvant chemotherapy use', 'OS (immature)'],
    evidenceStrength: 'Phase II RCT',
    keyResult: 'ctDNA-guided therapy reduced adjuvant chemo use without compromising RFS in stage II CRC',
    permittedClaims: ['RFS', 'recurrence-free survival', 'reduced chemotherapy use', 'de-escalation', 'ctDNA-guided adjuvant decisions'],
    prohibitedClaims: ['OS benefit', 'overall survival benefit', 'stage III'],
  },
  {
    study: 'DYNAMIC-III',
    fullName: 'DYNAMIC-III',
    assay: 'SafeSeqS (custom)',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'RCT',
    pmid: null,
    notes: 'Stage III colon cancer. Results pending.',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: ['OS'],
    evidenceStrength: 'Phase III RCT (enrolling)',
    keyResult: null,
    permittedClaims: ['enrolling', 'ongoing', 'stage III CRC'],
    prohibitedClaims: ['showed', 'demonstrated', 'proved', 'confirmed'],
  },
  {
    study: 'DYNAMIC-Rectal',
    fullName: 'DYNAMIC-Rectal',
    assay: 'SafeSeqS (custom)',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'RCT',
    pmid: null,
    notes: 'Rectal cancer. Results pending.',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: [],
    evidenceStrength: 'Phase III RCT (enrolling)',
    keyResult: null,
    permittedClaims: ['enrolling', 'ongoing', 'rectal cancer'],
    prohibitedClaims: ['showed', 'demonstrated', 'proved'],
  },
  {
    study: 'BESPOKE',
    fullName: 'BESPOKE CRC',
    assay: 'Signatera',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'prospective observational',
    pmid: null,
    notes: 'Stage II-III CRC, Signatera-guided surveillance',
    primaryEndpoint: 'ctDNA detection rate',
    secondaryEndpoints: ['lead time over imaging'],
    evidenceStrength: 'Prospective observational',
    keyResult: 'ctDNA detected recurrence with median lead time of several months before imaging',
    permittedClaims: ['ctDNA detection', 'lead time', 'surveillance'],
    prohibitedClaims: ['OS benefit', 'treatment benefit'],
  },
  {
    study: 'COBRA',
    fullName: 'NRG-GI005 (COBRA)',
    assay: 'Signatera',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'RCT',
    pmid: null,
    notes: 'Stage IIA CRC, ctDNA-guided adjuvant therapy',
    primaryEndpoint: 'ctDNA clearance rate',
    secondaryEndpoints: ['DFS'],
    evidenceStrength: 'Phase II/III RCT (enrolling)',
    keyResult: null,
    permittedClaims: ['enrolling', 'ongoing', 'ctDNA-guided therapy'],
    prohibitedClaims: ['showed', 'demonstrated', 'proved'],
  },
  {
    study: 'CIRCULATE-US',
    fullName: 'CIRCULATE North America',
    assay: 'Signatera',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'RCT',
    pmid: null,
    notes: 'Stage II-III CRC, ctDNA-guided therapy',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: ['OS'],
    evidenceStrength: 'Phase III RCT (enrolling)',
    keyResult: null,
    permittedClaims: ['enrolling', 'ongoing'],
    prohibitedClaims: ['showed', 'demonstrated', 'proved'],
  },
  {
    study: 'COSMOS',
    fullName: 'COSMOS',
    assay: 'Guardant Reveal',
    assayType: 'tumor-naive',
    cancerTypes: ['colorectal'],
    design: 'prospective observational',
    pmid: null,
    notes: 'CRC post-surgical surveillance with tumor-naive assay',
    primaryEndpoint: 'ctDNA detection sensitivity',
    secondaryEndpoints: ['concordance with imaging'],
    evidenceStrength: 'Prospective observational',
    keyResult: null,
    permittedClaims: ['tumor-naive surveillance', 'detection sensitivity'],
    prohibitedClaims: ['OS benefit', 'treatment benefit'],
  },
  {
    study: 'MEDOCC-CrEATE',
    fullName: 'MEDOCC-CrEATE',
    assay: 'multiple (varies)',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'RCT',
    pmid: null,
    notes: 'Stage II CRC, ctDNA-guided adjuvant therapy',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: [],
    evidenceStrength: 'Phase III RCT (enrolling)',
    keyResult: null,
    permittedClaims: ['enrolling', 'ongoing'],
    prohibitedClaims: ['showed', 'demonstrated', 'proved'],
  },

  // Breast studies
  {
    study: 'c-TRAK TN',
    fullName: 'c-TRAK TN',
    assay: 'RaDaR (Inivata)',
    assayType: 'tumor-informed',
    cancerTypes: ['breast'],
    design: 'prospective interventional',
    pmid: null,
    notes: 'TNBC, ctDNA-triggered pembrolizumab',
    primaryEndpoint: 'ctDNA detection rate',
    secondaryEndpoints: ['response to pembrolizumab in ctDNA-positive patients'],
    evidenceStrength: 'Phase II interventional',
    keyResult: 'Feasibility of ctDNA-triggered immunotherapy in TNBC demonstrated',
    permittedClaims: ['ctDNA-triggered intervention', 'feasibility', 'TNBC surveillance'],
    prohibitedClaims: ['OS benefit', 'DFS benefit', 'pembrolizumab efficacy'],
  },
  {
    study: 'monarchE ctDNA',
    fullName: 'monarchE ctDNA substudy',
    assay: 'Signatera',
    assayType: 'tumor-informed',
    cancerTypes: ['breast'],
    design: 'prospective correlative',
    pmid: null,
    notes: 'HR+/HER2- early breast cancer, abemaciclib adjuvant',
    primaryEndpoint: 'ctDNA prognostic value',
    secondaryEndpoints: ['ctDNA clearance with abemaciclib'],
    evidenceStrength: 'Prospective correlative substudy',
    keyResult: 'ctDNA positivity associated with worse outcomes in HR+/HER2- breast cancer',
    permittedClaims: ['prognostic value', 'ctDNA clearance', 'HR+/HER2- breast cancer'],
    prohibitedClaims: ['ctDNA-guided treatment decision', 'abemaciclib benefit based on ctDNA'],
  },

  // Lung studies
  {
    study: 'MERMAID-1',
    fullName: 'MERMAID-1',
    assay: 'Guardant Reveal',
    assayType: 'tumor-naive',
    cancerTypes: ['lung_nsclc'],
    design: 'RCT',
    pmid: null,
    notes: 'Resected NSCLC, ctDNA-positive, durvalumab + chemo',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: ['OS'],
    evidenceStrength: 'Phase II RCT',
    keyResult: null,
    permittedClaims: ['ctDNA-positive NSCLC', 'durvalumab adjuvant'],
    prohibitedClaims: ['OS benefit'],
  },
  {
    study: 'IMpower010',
    fullName: 'IMpower010',
    assay: 'bespoke mPCR (custom)',
    assayType: 'tumor-informed',
    cancerTypes: ['lung_nsclc'],
    design: 'RCT',
    pmid: '34932526',
    notes: 'Adjuvant atezolizumab in resected NSCLC. ctDNA correlative analysis.',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: ['OS (immature)'],
    evidenceStrength: 'Phase III RCT',
    keyResult: 'DFS benefit with atezolizumab in PD-L1 TC>=1% stage II-IIIA NSCLC',
    permittedClaims: ['DFS benefit', 'disease-free survival', 'adjuvant atezolizumab', 'PD-L1 positive NSCLC'],
    prohibitedClaims: ['OS benefit', 'overall survival benefit'],
  },
  {
    study: 'TRACERx',
    fullName: 'TRACERx',
    assay: 'custom WES-based',
    assayType: 'tumor-informed',
    cancerTypes: ['lung_nsclc'],
    design: 'prospective observational',
    pmid: null,
    notes: 'NSCLC evolution and ctDNA dynamics longitudinal study',
    primaryEndpoint: 'ctDNA dynamics',
    secondaryEndpoints: ['tumor evolution', 'subclonal heterogeneity'],
    evidenceStrength: 'Large prospective cohort',
    keyResult: 'ctDNA phylogenetic tracking reveals tumor evolution and predicts relapse',
    permittedClaims: ['ctDNA dynamics', 'tumor evolution', 'relapse prediction'],
    prohibitedClaims: ['treatment benefit', 'OS benefit'],
  },

  // Melanoma studies
  {
    study: 'KEYNOTE-054',
    fullName: 'KEYNOTE-054',
    assay: 'N/A (clinical trial, no ctDNA primary)',
    assayType: 'N/A',
    cancerTypes: ['melanoma'],
    design: 'RCT',
    pmid: '29658430',
    notes: 'Adjuvant pembrolizumab in resected stage III melanoma. ctDNA substudy established.',
    primaryEndpoint: 'RFS',
    secondaryEndpoints: ['DMFS', 'OS'],
    evidenceStrength: 'Phase III RCT',
    keyResult: 'RFS benefit with adjuvant pembrolizumab in stage III melanoma',
    permittedClaims: ['RFS benefit', 'relapse-free survival', 'adjuvant pembrolizumab', 'stage III melanoma', 'established evidence'],
    prohibitedClaims: ['unclear evidence', 'limited data', 'no evidence'],
  },
  {
    study: 'KEYNOTE-716',
    fullName: 'KEYNOTE-716',
    assay: 'N/A (clinical trial, no ctDNA primary)',
    assayType: 'N/A',
    cancerTypes: ['melanoma'],
    design: 'RCT',
    pmid: '35143888',
    notes: 'Adjuvant pembrolizumab in resected stage IIB/IIC melanoma.',
    primaryEndpoint: 'RFS',
    secondaryEndpoints: ['DMFS', 'OS'],
    evidenceStrength: 'Phase III RCT',
    keyResult: 'RFS benefit with adjuvant pembrolizumab in stage IIB/IIC melanoma',
    permittedClaims: ['RFS benefit', 'relapse-free survival', 'adjuvant pembrolizumab', 'stage IIB/IIC melanoma'],
    prohibitedClaims: ['OS benefit'],
  },

  // Bladder studies
  {
    study: 'CheckMate 274',
    fullName: 'CheckMate 274',
    assay: 'N/A (clinical trial)',
    assayType: 'N/A',
    cancerTypes: ['bladder'],
    design: 'RCT',
    pmid: '33369208',
    notes: 'Adjuvant nivolumab in high-risk muscle-invasive urothelial carcinoma.',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: ['OS', 'non-urothelial tract recurrence-free survival'],
    evidenceStrength: 'Phase III RCT',
    keyResult: 'DFS benefit with adjuvant nivolumab in muscle-invasive urothelial carcinoma',
    permittedClaims: ['DFS benefit', 'disease-free survival', 'adjuvant nivolumab', 'urothelial carcinoma'],
    prohibitedClaims: ['OS benefit', 'overall survival benefit'],
  },

  // Pan-cancer / multi-tumor
  {
    study: 'ALTAIR',
    fullName: 'ALTAIR',
    assay: 'Signatera',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal'],
    design: 'RCT',
    pmid: null,
    notes: 'ctDNA-guided trifluridine/tipiracil in CRC',
    primaryEndpoint: 'DFS',
    secondaryEndpoints: ['OS', 'ctDNA clearance rate'],
    evidenceStrength: 'Phase III RCT',
    keyResult: null,
    permittedClaims: ['ctDNA-guided therapy', 'trifluridine/tipiracil'],
    prohibitedClaims: [],
  },
  {
    study: 'NivoMRD',
    fullName: 'NivoMRD',
    assay: 'Signatera',
    assayType: 'tumor-informed',
    cancerTypes: ['colorectal', 'lung_nsclc', 'bladder'],
    design: 'RCT',
    pmid: null,
    notes: 'ctDNA-guided nivolumab in multiple solid tumors',
    primaryEndpoint: 'ctDNA clearance rate',
    secondaryEndpoints: ['DFS'],
    evidenceStrength: 'Phase II RCT (enrolling)',
    keyResult: null,
    permittedClaims: ['enrolling', 'ongoing', 'ctDNA-guided immunotherapy'],
    prohibitedClaims: ['showed', 'demonstrated', 'proved'],
  },
  {
    study: 'PEGASUS',
    fullName: 'PEGASUS',
    assay: 'Guardant360 CDx',
    assayType: 'tumor-naive',
    cancerTypes: ['lung_nsclc'],
    design: 'prospective',
    pmid: null,
    notes: 'EGFR-mutated NSCLC, ctDNA monitoring',
    primaryEndpoint: 'ctDNA detection for resistance monitoring',
    secondaryEndpoints: [],
    evidenceStrength: 'Prospective observational',
    keyResult: null,
    permittedClaims: ['resistance monitoring', 'EGFR mutation tracking'],
    prohibitedClaims: ['OS benefit', 'treatment selection'],
  },
];

/**
 * Build the system prompt injection for study-assay canonical reference.
 */
export function buildStudyAssayPrompt() {
  const lines = STUDY_ASSAY_REGISTRY.map(s => {
    const cancers = s.cancerTypes.join(', ');
    return `- ${s.study}: ${s.assay} (${s.assayType}), ${cancers}, ${s.design}${s.pmid ? `, PMID: ${s.pmid}` : ''}`;
  });

  return `STUDY-ASSAY REFERENCE (canonical — do NOT deviate):
${lines.join('\n')}

RULE: When citing a study from this list, you MUST use the correct assay and assay type. Never claim a tumor-informed study used a tumor-naive assay or vice versa. If uncertain about a study's assay, do not specify one.`;
}

/**
 * Post-generation check for study-assay misattribution.
 * Returns array of violations found in the answer text.
 */
export function checkStudyAssayMisattribution(answer) {
  const violations = [];
  const lowerAnswer = answer.toLowerCase();

  for (const entry of STUDY_ASSAY_REGISTRY) {
    const studyRegex = new RegExp(`\\b${entry.study.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (!studyRegex.test(answer)) continue;

    // Check if answer incorrectly attributes assay type
    const isTumorInformed = entry.assayType === 'tumor-informed';
    const isTumorNaive = entry.assayType === 'tumor-naive';

    // Find the paragraph/context where the study is mentioned
    const sentences = answer.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (!studyRegex.test(sentence)) continue;
      const lowerSentence = sentence.toLowerCase();

      // Check for wrong assay type attribution
      if (isTumorInformed && /tumor[- ]?na[iïí]ve|tumor[- ]?agnostic/.test(lowerSentence)) {
        violations.push({
          study: entry.study,
          claimed: 'tumor-naive',
          actual: 'tumor-informed',
          actualAssay: entry.assay,
          sentence: sentence.substring(0, 150),
        });
      }

      if (isTumorNaive && /tumor[- ]?informed|bespoke|personalized panel/.test(lowerSentence)) {
        violations.push({
          study: entry.study,
          claimed: 'tumor-informed',
          actual: 'tumor-naive',
          actualAssay: entry.assay,
          sentence: sentence.substring(0, 150),
        });
      }

      // Check for wrong assay name
      if (entry.assay !== 'multiple (varies)' && entry.assay !== 'custom WES-based' && entry.assay !== 'bespoke mPCR (custom)') {
        // Check if a DIFFERENT known assay is attributed to this study
        const otherAssays = ['Signatera', 'Guardant Reveal', 'FoundationOne Tracker', 'RaDaR', 'NavDx', 'Guardant360'];
        for (const other of otherAssays) {
          if (other.toLowerCase() === entry.assay.toLowerCase()) continue;
          if (lowerSentence.includes(other.toLowerCase())) {
            violations.push({
              study: entry.study,
              claimed: other,
              actual: entry.assay,
              sentence: sentence.substring(0, 150),
            });
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Build context-aware trial constraints for only the trials relevant to this query.
 * Instead of dumping the full 20+ entry table into the prompt (token-heavy),
 * detect which trials are mentioned in the question and/or retrieved sources
 * and inject only those canonical entries.
 *
 * @param {string} queryText - The user's question
 * @param {Array} sources - Retrieved sources from hybrid search
 * @returns {string} Prompt block with trial constraints, or empty string if none relevant
 */
export function buildContextAwareTrialConstraints(queryText, sources) {
  const relevant = new Set();
  const combined = (queryText + ' ' + (sources || []).map(s => s.title || '').join(' ')).toLowerCase();

  for (const entry of STUDY_ASSAY_REGISTRY) {
    const studyLower = entry.study.toLowerCase();
    if (combined.includes(studyLower)) {
      relevant.add(entry.study);
    }
    // Also check trial_acronym from sources
    for (const s of (sources || [])) {
      if ((s.trial_acronym || '').toLowerCase() === studyLower) {
        relevant.add(entry.study);
      }
    }
  }

  if (relevant.size === 0) return '';

  const lines = [];
  for (const studyName of relevant) {
    const entry = STUDY_ASSAY_REGISTRY.find(e => e.study === studyName);
    if (!entry) continue;

    let constraint = `- ${entry.study}: primaryEndpoint=${entry.primaryEndpoint || 'N/A'}`;
    if (entry.prohibitedClaims && entry.prohibitedClaims.length > 0) {
      constraint += `. Do NOT claim: ${entry.prohibitedClaims.join(', ')}`;
    }
    if (entry.keyResult) {
      constraint += `. Key result: ${entry.keyResult}`;
    }
    if (entry.notes && entry.notes.includes('ONLY')) {
      constraint += `. Population note: ${entry.notes}`;
    }
    lines.push(constraint);
  }

  if (lines.length === 0) return '';

  return `\nTRIAL CONSTRAINTS (for trials referenced in this query — strict):
${lines.join('\n')}`;
}

/**
 * Post-generation check for endpoint misattribution.
 * For each trial mentioned in the answer, verify claimed endpoints
 * match permittedClaims and don't match prohibitedClaims.
 *
 * Returns array of violations.
 */
export function checkEndpointMisattribution(answer) {
  const violations = [];
  const sentences = answer.split(/(?<=[.!?])\s+/);

  for (const entry of STUDY_ASSAY_REGISTRY) {
    // Skip entries without prohibited claims
    if (!entry.prohibitedClaims || entry.prohibitedClaims.length === 0) continue;

    const studyRegex = new RegExp(`\\b${entry.study.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (!studyRegex.test(answer)) continue;

    for (const sentence of sentences) {
      if (!studyRegex.test(sentence)) continue;
      const lowerSentence = sentence.toLowerCase();

      // Check prohibited claims
      for (const prohibited of entry.prohibitedClaims) {
        const prohibitedLower = prohibited.toLowerCase();
        if (lowerSentence.includes(prohibitedLower)) {
          // Make sure it's not a negation context
          const negationPattern = new RegExp(`(not|no|without|lacks?|pending|immature)\\s+.{0,20}${prohibitedLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          if (negationPattern.test(sentence)) continue;

          violations.push({
            study: entry.study,
            claimed: prohibited,
            permitted: entry.permittedClaims || [],
            primaryEndpoint: entry.primaryEndpoint,
            sentence: sentence.substring(0, 150),
          });
        }
      }
    }
  }

  return violations;
}

export default {
  STUDY_ASSAY_REGISTRY,
  buildStudyAssayPrompt,
  buildContextAwareTrialConstraints,
  checkStudyAssayMisattribution,
  checkEndpointMisattribution,
};
