// Category definitions and metadata
import { mrdTestData, ecdTestData, trmTestData, tdsTestData } from '../data';

// Domain constants
export const DOMAINS = {
  ONCO: 'onco',
  ALZ: 'alz'
};

// Lifecycle stages with domain support
export const LIFECYCLE_STAGES = [
  {
    id: 'ECD',
    name: 'Early Cancer Detection',
    acronym: 'ECD',
    phase: 'Healthy / Screening',
    color: 'emerald',
    icon: '🔬',
    gridPosition: 0,
    arrowDirection: 'right',
    domain: DOMAINS.ONCO,
  },
  {
    id: 'TDS',
    name: 'Treatment Decision Support',
    acronym: 'TDS',
    phase: 'Newly Diagnosed',
    color: 'violet',
    icon: '🧬',
    gridPosition: 1,
    arrowDirection: 'down',
    domain: DOMAINS.ONCO,
  },
  {
    id: 'TRM',
    name: 'Treatment Response Monitoring',
    acronym: 'TRM',
    phase: 'Active Treatment',
    color: 'sky',
    icon: '📊',
    gridPosition: 3,
    arrowDirection: 'left',
    domain: DOMAINS.ONCO,
  },
  {
    id: 'MRD',
    name: 'Minimal Residual Disease',
    acronym: 'MRD',
    phase: 'Surveillance',
    color: 'orange',
    icon: '🎯',
    gridPosition: 2,
    arrowDirection: 'up',
    domain: DOMAINS.ONCO,
  },
  // ALZ domain categories (to be populated in Part 3)
  {
    id: 'ALZ-BLOOD',
    name: 'Blood Biomarkers',
    acronym: 'ALZ-BLOOD',
    phase: 'Screening / Diagnosis',
    color: 'indigo',
    icon: '🧠',
    gridPosition: 0,
    arrowDirection: 'right',
    domain: DOMAINS.ALZ,
  },
];

export const LIFECYCLE_STAGES_BY_GRID = [...LIFECYCLE_STAGES].sort((a, b) => a.gridPosition - b.gridPosition);

// Get stages filtered by domain
export const getStagesByDomain = (domain) => {
  return LIFECYCLE_STAGES.filter(stage => stage.domain === domain);
};

export const lifecycleColorClasses = {
  emerald: {
    bg: 'bg-emerald-500',
    bgLight: 'bg-emerald-50',
    bgMedium: 'bg-emerald-100',
    border: 'border-emerald-200',
    borderActive: 'border-emerald-500',
    text: 'text-emerald-600',
    textLight: 'text-emerald-400',
    textDark: 'text-emerald-700',
  },
  violet: {
    bg: 'bg-violet-500',
    bgLight: 'bg-violet-50',
    bgMedium: 'bg-violet-100',
    border: 'border-violet-200',
    borderActive: 'border-violet-500',
    text: 'text-violet-600',
    textLight: 'text-violet-400',
    textDark: 'text-violet-700',
  },
  sky: {
    bg: 'bg-sky-500',
    bgLight: 'bg-sky-50',
    bgMedium: 'bg-sky-100',
    border: 'border-sky-200',
    borderActive: 'border-sky-500',
    text: 'text-sky-600',
    textLight: 'text-sky-400',
    textDark: 'text-sky-700',
  },
  orange: {
    bg: 'bg-orange-500',
    bgLight: 'bg-orange-50',
    bgMedium: 'bg-orange-100',
    border: 'border-orange-200',
    borderActive: 'border-orange-500',
    text: 'text-orange-600',
    textLight: 'text-orange-400',
    textDark: 'text-orange-700',
  },
  indigo: {
    bg: 'bg-indigo-500',
    bgLight: 'bg-indigo-50',
    bgMedium: 'bg-indigo-100',
    border: 'border-indigo-200',
    borderActive: 'border-indigo-500',
    text: 'text-indigo-600',
    textLight: 'text-indigo-400',
    textDark: 'text-indigo-700',
  },
};

// Product Type Constants (IVD Kit vs Service)
export const PRODUCT_TYPES = {
  SELF_COLLECTION: {
    id: 'Self-Collection',
    label: 'Self-Collection',
    icon: '🏠',
    description: 'Patient collects sample at home',
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
  },
  LAB_KIT: {
    id: 'Laboratory IVD Kit',
    label: 'Lab Kit',
    icon: '🔬',
    description: 'IVD kit run at CLIA-certified lab',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
  },
  CENTRAL_LAB: {
    id: 'Central Lab Service',
    label: 'Service',
    icon: '🏥',
    description: 'Sample shipped to central laboratory',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
  },
};

// Helper to get product type config
export const getProductTypeConfig = (productType) => {
  if (!productType) return PRODUCT_TYPES.CENTRAL_LAB;
  return Object.values(PRODUCT_TYPES).find(pt => pt.id === productType) || PRODUCT_TYPES.CENTRAL_LAB;
};

// Category metadata - references test data
// Note: sourceUrl is set dynamically in App.jsx using BUILD_INFO
export const createCategoryMeta = (buildInfoSources = {}) => ({
  MRD: {
    title: 'Molecular Residual Disease',
    shortTitle: 'MRD Testing',
    description: 'Molecular Residual Disease (MRD) testing detects tiny amounts of cancer that remain in the body after treatment, often before any symptoms or imaging findings appear. These tests analyze circulating tumor DNA (ctDNA) from a blood sample to identify whether cancer cells persist at the molecular level. MRD results help oncologists make critical decisions about whether additional treatment is needed, assess the effectiveness of therapy, and monitor for early signs of recurrence during surveillance.',
    patientTitle: 'Tests After Treatment',
    patientDescription: 'These blood tests check if any cancer cells remain after surgery or treatment. Finding leftover cancer early can help your doctor decide if you need more treatment.',
    color: 'orange',
    tests: mrdTestData,
    sourceUrl: buildInfoSources.MRD || '',
    domain: DOMAINS.ONCO,
  },
  ECD: {
    title: 'Early Cancer Detection',
    shortTitle: 'Early Detection',
    description: 'Early Cancer Detection (ECD) tests screen for cancer in people who have no symptoms, with the goal of catching the disease at its earliest and most treatable stages. These tests look for cancer signals in blood samples using various biomarkers including ctDNA methylation patterns, tumor-derived proteins, and genetic mutations. Some tests screen for a single cancer type (like colorectal), while multi-cancer early detection (MCED) tests can screen for dozens of cancer types simultaneously.',
    patientTitle: 'Cancer Screening Tests',
    patientDescription: 'These blood tests look for signs of cancer before you have any symptoms. Finding cancer early, when it\'s easiest to treat, can save lives.',
    color: 'green',
    tests: ecdTestData,
    sourceUrl: buildInfoSources.ECD || '',
    domain: DOMAINS.ONCO,
  },
  TRM: {
    title: 'Treatment Response Monitoring',
    shortTitle: 'Response Monitoring',
    description: 'Treatment Response Monitoring (TRM) tests track how well a cancer treatment is working by measuring changes in circulating tumor DNA (ctDNA) levels over time. A decrease in ctDNA often indicates the treatment is effective, while stable or rising levels may signal resistance or progression—sometimes weeks before changes appear on imaging scans. This sensitive molecular monitoring helps oncologists optimize therapy for most favorable outcomes, potentially switching ineffective treatments earlier and sparing patients unnecessary toxicity.',
    patientTitle: 'Is My Treatment Working?',
    patientDescription: 'These blood tests track whether your cancer treatment is working. They can show results weeks before a scan, helping your doctor adjust treatment if needed.',
    color: 'red',
    tests: trmTestData,
    sourceUrl: buildInfoSources.TRM || '',
    domain: DOMAINS.ONCO,
  },
  TDS: {
    title: 'Treatment Decision Support',
    shortTitle: 'Treatment Decisions',
    description: 'Treatment Decision Support (TDS) tests help guide clinical decisions about cancer treatment. This includes Comprehensive Genomic Profiling (CGP) tests that analyze tumor DNA/RNA to identify targetable mutations and match patients to therapies, as well as risk stratification tests that help determine whether interventions like biopsies are needed. These tests support personalized treatment decisions based on molecular and protein biomarker analysis.',
    patientTitle: 'Find My Best Treatment',
    patientDescription: 'These tests help your doctor decide the best treatment approach for you. They can analyze your tumor\'s characteristics to find specific treatments that may work best, or help determine if procedures like biopsies are necessary.',
    color: 'violet',
    tests: tdsTestData,
    sourceUrl: buildInfoSources.TDS || '',
    domain: DOMAINS.ONCO,
  },
  // ALZ-BLOOD category will be added in Part 3
});

// Helper to get test list by category
export const getTestListByCategory = (categoryId) => {
  const categoryMap = {
    MRD: mrdTestData,
    ECD: ecdTestData,
    TRM: trmTestData,
    TDS: tdsTestData,
    // ALZ-BLOOD will be added in Part 3
  };
  return categoryMap[categoryId] || [];
};
