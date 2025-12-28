// ============================================
// Tier 1 Citation Metrics - Dynamic calculation
// ============================================
// Tier 1 = Performance metrics that MUST have citations
// These are the clinically critical numbers patients/clinicians rely on
export const TIER1_FIELDS = [
  'sensitivity', 'specificity', 'ppv', 'npv',
  'lod', 'lod95',
  'stageISensitivity', 'stageIISensitivity', 'stageIIISensitivity', 'stageIVSensitivity',
  'landmarkSensitivity', 'landmarkSpecificity',
  'longitudinalSensitivity', 'longitudinalSpecificity',
  'advancedAdenomaSensitivity',
  'leadTimeVsImaging'
];

// ============================================
// Parameter Definitions & Changelog
// ============================================
export const PARAMETER_DEFINITIONS = {
  // Performance Metrics
  "Reported Sensitivity": "The proportion of true positive cases correctly identified by the test. May be analytical (lab conditions) or clinical (real-world), and may be landmark (single timepoint) or longitudinal (across multiple draws).",
  "Overall Sensitivity": "The proportion of true positive cases correctly identified by the test across all stages combined.",
  "Reported Specificity": "The proportion of true negative cases correctly identified by the test. High specificity means fewer false positives.",
  "Analytical Specificity": "Specificity measured under controlled laboratory conditions, typically higher than clinical specificity.",
  "Clinical Specificity": "Specificity measured in real-world clinical settings with actual patient samples.",
  "PPV": "Positive Predictive Value. The probability that a positive test result indicates true disease presence. Depends heavily on disease prevalence.",
  "NPV": "Negative Predictive Value. The probability that a negative test result indicates true absence of disease.",
  "LOD": "Limit of Detection. The lowest concentration of target analyte that can be reliably detected. Reported in various units (ppm, VAF%, MTM/mL).",
  "LOD (Detection Threshold)": "Limit of Detection. The lowest concentration of target analyte that can be reliably detected. Reported in various units (ppm, VAF%, MTM/mL).",
  "LOD95": "The concentration at which the test achieves 95% detection probability. More conservative than LOD and often more clinically relevant.",
  "LOD95 (95% Confidence)": "The concentration at which the test achieves 95% detection probability. More conservative than LOD and often more clinically relevant.",

  // Stage-specific
  "Stage I Sensitivity": "Detection rate for Stage I cancers, typically the most challenging due to lower tumor burden.",
  "Stage II Sensitivity": "Detection rate for Stage II cancers. Critical for adjuvant therapy decisions in MRD testing.",
  "Stage III Sensitivity": "Detection rate for Stage III cancers. Generally higher than earlier stages due to greater tumor burden.",
  "Stage IV Sensitivity": "Detection rate for Stage IV/metastatic cancers. Usually highest due to significant tumor burden.",
  "Stage-specific Sensitivity": "Sensitivity broken down by cancer stage. Earlier stages typically have lower detection rates.",

  // Landmark & Longitudinal
  "Landmark Sensitivity": "Detection rate at a single post-treatment timepoint (e.g., 4 weeks post-surgery).",
  "Landmark Specificity": "Specificity measured at a single post-treatment timepoint.",
  "Longitudinal Sensitivity": "Detection rate across multiple serial blood draws over time. Typically higher than landmark.",
  "Longitudinal Specificity": "Specificity measured across multiple serial timepoints.",

  // Turnaround & Sample
  "Sample Type": "The biological sample category required for testing (e.g., Blood, Tissue).",
  "Sample Category": "The biological sample category required for testing (e.g., Blood, Tissue).",
  "Initial TAT": "Turnaround time for the first test, which may include assay design for tumor-informed tests.",
  "Follow-up TAT": "Turnaround time for subsequent monitoring tests, typically faster than initial.",
  "TAT": "Turnaround Time. Days from sample receipt to result delivery.",
  "Lead Time vs Imaging": "How many days/months earlier the test can detect recurrence compared to standard imaging (CT/PET).",
  "Blood Volume": "Amount of blood required for the test, typically in milliliters (mL).",
  "cfDNA Input": "Amount of cell-free DNA required for analysis, in nanograms (ng).",
  "Variants Tracked": "Number of genetic variants monitored by the test. More variants may improve sensitivity but isn't always better.",
  "Sample Volume": "Volume of sample required for the test.",
  "Sample Stability": "How long the sample remains viable after collection.",
  "Sample Details": "Additional specifications about sample requirements.",

  // Requirements & Method
  "Approach": "Whether the test is tumor-informed (requires prior tissue) or tumor-naïve (blood only).",
  "Requires Tumor Tissue": "Whether a tumor sample is needed to design a personalized assay.",
  "Requires Matched Normal": "Whether a normal tissue sample is needed to filter germline variants.",
  "Method": "The laboratory technique used (e.g., PCR, NGS, methylation analysis).",
  "Target Population": "The intended patient population for the test.",
  "Indication Group": "The clinical indication category (e.g., screening, monitoring).",
  "Response Definition": "How the test defines treatment response.",
  "Screening Interval": "Recommended time between screening tests.",

  // Regulatory & Coverage
  "FDA Status": "Current FDA regulatory status (Approved, Breakthrough Designation, LDT, etc.).",
  "Medicare": "Medicare coverage and reimbursement status.",
  "Private Insurance": "Commercial insurance payers known to cover the test.",
  "CPT Codes": "Current Procedural Terminology codes used for billing.",
  "CPT Code": "Current Procedural Terminology code used for billing.",
  "Clinical Availability": "Current commercial availability status.",
  "Available Regions": "Geographic regions where the test is available.",
  "Independent Validation": "Whether the test has been validated by independent third parties.",
  "List Price": "Published list price before insurance, if available.",

  // Clinical Evidence
  "Total Trial Participants": "Total number of patients enrolled across key clinical trials.",
  "Peer-Reviewed Publications": "Number of peer-reviewed scientific publications about the test.",
  "Key Trials": "Major clinical trials evaluating the test.",

  // ECD-specific
  "Tumor Origin Prediction": "Accuracy of predicting the tissue of origin for detected cancers (multi-cancer tests).",
  "Lead Time Notes": "Additional context about detection lead time compared to standard methods."
};

export const PARAMETER_CHANGELOG = {
  // Track value changes here as they occur
  // Format: "Parameter Name": [{ date: "YYYY-MM-DD", change: "Description of value change" }]
};

// ============================================
// Minimum Parameters by Category
// ============================================
export const MINIMUM_PARAMS = {
  MRD: {
    core: [
      { key: 'sensitivity', label: 'Sensitivity' },
      { key: 'specificity', label: 'Specificity' },
      { key: 'lod', label: 'Limit of Detection' },
      { key: 'numPublications', label: 'Publications' },
      { key: 'totalParticipants', label: 'Study Participants' },
      { key: 'initialTat', label: 'Initial TAT' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'reimbursement', label: 'Medicare Coverage' },
    ]
  },
  ECD: {
    core: [
      { key: 'sensitivity', label: 'Sensitivity' },
      { key: 'specificity', label: 'Specificity' },
      { key: 'ppv', label: 'PPV' },
      { key: 'npv', label: 'NPV' },
      { key: 'numPublications', label: 'Publications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'fdaStatus', label: 'FDA Status' },
      { key: 'listPrice', label: 'List Price' },
    ]
  },
  TRM: {
    // NOTE: TRM tests monitor ctDNA trends over time rather than binary MRD detection
    // They don't report traditional sensitivity/specificity metrics
    core: [
      { key: 'numPublications', label: 'Publications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'fdaStatus', label: 'FDA Status' },
    ]
  },
  TDS: {
    // NOTE: CGP tests don't report single sensitivity/specificity values -
    // performance varies by alteration type (SNVs, indels, CNAs, fusions)
    core: [
      { key: 'numPublications', label: 'Publications' },
      { key: 'tat', label: 'Turnaround Time' },
      { key: 'fdaStatus', label: 'FDA Status' },
    ]
  },
};

export const FIELD_DEFINITIONS = {
  name: { label: 'Test Name', tooltip: 'The official commercial name of the test' },
  vendor: { label: 'Vendor', tooltip: 'The company that manufactures the test' },
  sensitivity: { label: 'Sensitivity', tooltip: 'Proportion of true positives correctly identified' },
  specificity: { label: 'Specificity', tooltip: 'Proportion of true negatives correctly identified' },
  lod: { label: 'Limit of Detection', tooltip: 'Lowest concentration reliably detected' },
  ppv: { label: 'PPV', tooltip: 'Positive Predictive Value' },
  npv: { label: 'NPV', tooltip: 'Negative Predictive Value' },
  numPublications: { label: 'Publications', tooltip: 'Number of peer-reviewed publications' },
  totalParticipants: { label: 'Study Participants', tooltip: 'Total patients across validation studies' },
  tat: { label: 'Turnaround Time', tooltip: 'Time from sample to result' },
  initialTat: { label: 'Initial TAT', tooltip: 'Days for first result' },
  followUpTat: { label: 'Follow-up TAT', tooltip: 'Days for subsequent results' },
  fdaStatus: { label: 'FDA Status', tooltip: 'Regulatory approval status' },
  reimbursement: { label: 'Medicare Coverage', tooltip: 'Medicare reimbursement status' },
  listPrice: { label: 'List Price', tooltip: 'Published price without insurance' },
  clinicalAvailability: { label: 'Clinical Availability', tooltip: 'Current availability status' },
};
