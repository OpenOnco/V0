// ============================================
// Consolidated Site Configuration
// Domain detection, categories, filters, and comparison params
// ============================================

import { mrdTestData, ecdTestData, trmTestData, tdsTestData, alzBloodTestData } from '../data/testData';

// ============================================
// Domain Detection
// ============================================
export const DOMAINS = {
  ONCO: 'onco',
  ALZ: 'alz'
};

export const getDomain = () => {
  if (typeof window === 'undefined') return DOMAINS.ONCO;

  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes('openalz') || hostname.includes('alz.')) {
    return DOMAINS.ALZ;
  }

  // Default to oncology (openonco)
  return DOMAINS.ONCO;
};

export const getSiteConfig = () => {
  const domain = getDomain();

  if (domain === DOMAINS.ALZ) {
    return {
      domain: DOMAINS.ALZ,
      name: 'OpenAlz',
      tagline: "Alzheimer's Diagnostics Database",
      description: "Compare blood-based Alzheimer's biomarker tests",
      logoText: 'OpenAlz',
      themeColor: '#6366f1', // Indigo for ALZ
      categories: ['ALZ-BLOOD']
    };
  }

  // Default: OpenOnco (oncology)
  return {
    domain: DOMAINS.ONCO,
    name: 'OpenOnco',
    tagline: 'Oncology Diagnostics Database',
    description: 'Compare cancer diagnostic tests across categories',
    logoText: 'OpenOnco',
    themeColor: '#2563eb', // Blue for Onco
    categories: ['MRD', 'ECD', 'TRM', 'TDS']
  };
};

// ============================================
// Lifecycle Stages
// ============================================
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

export const getStagesByDomain = (domain) => {
  return LIFECYCLE_STAGES.filter(stage => stage.domain === domain);
};

// ============================================
// Color Classes
// ============================================
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

// ============================================
// Product Types
// ============================================
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

export const getProductTypeConfig = (productType) => {
  if (!productType) return PRODUCT_TYPES.CENTRAL_LAB;
  return Object.values(PRODUCT_TYPES).find(pt => pt.id === productType) || PRODUCT_TYPES.CENTRAL_LAB;
};

// ============================================
// Category Metadata
// ============================================
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
  'ALZ-BLOOD': {
    title: 'Blood Biomarkers',
    shortTitle: 'Blood Tests',
    description: "Blood-based biomarker tests for Alzheimer's disease detection and risk assessment. These tests measure proteins like phosphorylated tau (pTau217, pTau181) and amyloid-beta ratios (Abeta42/40) that indicate Alzheimer's pathology in the brain. Blood biomarkers offer a less invasive alternative to PET scans and lumbar punctures for detecting amyloid plaques and tau tangles.",
    patientTitle: "Alzheimer's Blood Tests",
    patientDescription: "These blood tests can help detect signs of Alzheimer's disease by measuring specific proteins. They're less invasive than brain scans or spinal taps and can help your doctor understand if Alzheimer's might be causing memory problems.",
    color: 'indigo',
    tests: alzBloodTestData,
    sourceUrl: buildInfoSources['ALZ-BLOOD'] || '',
    domain: DOMAINS.ALZ,
  },
});

export const getTestListByCategory = (categoryId) => {
  const categoryMap = {
    MRD: mrdTestData,
    ECD: ecdTestData,
    TRM: trmTestData,
    TDS: tdsTestData,
    'ALZ-BLOOD': alzBloodTestData,
  };
  return categoryMap[categoryId] || [];
};

// ============================================
// Filter Configurations
// ============================================
export const filterConfigs = {
  MRD: {
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(mrdTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: [...new Set(mrdTestData.map(t => t.sampleCategory || 'Blood/Plasma'))].sort(),
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT'],
    reimbursements: ['Medicare', 'Commercial'],
    approaches: ['Tumor-informed', 'Tumor-naïve'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
    clinicalSettings: ['Neoadjuvant', 'Post-Surgery', 'Post-Adjuvant', 'Surveillance'],
  },
  ECD: {
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit', 'Self-Collection'],
    testScopes: ['Single-cancer (CRC)', 'Multi-cancer (MCED)'],
    sampleCategories: ['Blood/Plasma', 'Stool'],
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT', 'Investigational'],
    reimbursements: ['Medicare', 'Commercial'],
    approaches: ['Blood-based cfDNA screening (plasma)', 'Blood-based cfDNA methylation MCED (plasma)', 'Stool DNA + FIT'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
  },
  TRM: {
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(trmTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: ['Blood/Plasma'],
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT'],
    approaches: ['Tumor-informed', 'Tumor-naïve', 'Tumor-agnostic'],
    reimbursements: ['Medicare', 'Commercial'],
    regions: ['US', 'EU', 'UK', 'International', 'RUO'],
  },
  TDS: {
    productTypes: ['Central Lab Service', 'Laboratory IVD Kit'],
    cancerTypes: [...new Set(tdsTestData.flatMap(t => t.cancerTypes || []))].sort(),
    sampleCategories: [...new Set(tdsTestData.map(t => t.sampleCategory || 'Unknown'))].sort(),
    approaches: [...new Set(tdsTestData.map(t => t.approach || 'Unknown'))].sort(),
    fdaStatuses: ['FDA Approved', 'FDA Breakthrough', 'LDT'],
    reimbursements: ['Medicare', 'Commercial'],
  },
  'ALZ-BLOOD': {
    biomarkers: [...new Set(alzBloodTestData.flatMap(t => t.biomarkers || []))].sort(),
    approaches: [...new Set(alzBloodTestData.map(t => t.approach || 'Unknown'))].sort(),
    fdaStatuses: ['FDA Approved', 'CE-IVD', 'CLIA LDT', 'RUO', 'In development'],
    reimbursements: ['Medicare LCD', 'Coverage varies', 'Not covered'],
    regions: [...new Set(alzBloodTestData.flatMap(t => t.availableRegions || []))].sort(),
  },
};

// ============================================
// Comparison Parameters
// ============================================
export const comparisonParams = {
  MRD: [
    { key: 'productType', label: 'Product Type' },
    { key: 'platformRequired', label: 'Platform Required' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Cancer Types' },
    { key: 'clinicalSettingsStr', label: 'Clinical Settings' },
    { key: 'sensitivity', label: 'Reported Sensitivity (%)' },
    { key: 'sensitivityStagesReported', label: 'Stages in Headline' },
    { key: 'stageIISensitivity', label: 'Stage II Sensitivity (%)' },
    { key: 'stageIIISensitivity', label: 'Stage III Sensitivity (%)' },
    { key: 'landmarkSensitivity', label: 'Post-Surgery Sensitivity (%)' },
    { key: 'longitudinalSensitivity', label: 'Surveillance Sensitivity (%)' },
    { key: 'specificity', label: 'Reported Specificity (%)' },
    { key: 'analyticalSpecificity', label: 'Analytical Specificity (%)' },
    { key: 'clinicalSpecificity', label: 'Clinical Specificity (%)' },
    { key: 'lod', label: 'LOD (detection)' },
    { key: 'lod95', label: 'LOD95 (95% conf)' },
    { key: 'variantsTracked', label: 'Variants Tracked' },
    { key: 'bloodVolume', label: 'Blood Volume (mL)' },
    { key: 'cfdnaInput', label: 'cfDNA Input (ng)' },
    { key: 'initialTat', label: 'Initial TAT (days)' },
    { key: 'followUpTat', label: 'Follow-up TAT (days)' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
    { key: 'availableRegionsStr', label: 'Availability' },
  ],
  ECD: [
    { key: 'productType', label: 'Product Type' },
    { key: 'platformRequired', label: 'Platform Required' },
    { key: 'testScope', label: 'Scope' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'sensitivity', label: 'Reported Sensitivity (%)' },
    { key: 'stageISensitivity', label: 'Stage I Sens (%)' },
    { key: 'stageIISensitivity', label: 'Stage II Sens (%)' },
    { key: 'stageIIISensitivity', label: 'Stage III Sens (%)' },
    { key: 'stageIVSensitivity', label: 'Stage IV Sens (%)' },
    { key: 'specificity', label: 'Reported Specificity (%)' },
    { key: 'ppv', label: 'PPV (%)' },
    { key: 'npv', label: 'NPV (%)' },
    { key: 'tumorOriginAccuracy', label: 'Origin Prediction (%)' },
    { key: 'leadTimeNotes', label: 'Lead Time vs Screening' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
    { key: 'availableRegionsStr', label: 'Availability' },
    { key: 'clinicalAvailability', label: 'Clinical Availability' },
    { key: 'tat', label: 'Turnaround Time' },
    { key: 'sampleType', label: 'Sample Details' },
    { key: 'listPrice', label: 'List Price (USD)' },
    { key: 'screeningInterval', label: 'Screening Interval' },
    { key: 'cptCode', label: 'CPT Code' },
    { key: 'performanceCitations', label: 'Citations' },
    { key: 'performanceNotes', label: 'Performance Notes' },
  ],
  TRM: [
    { key: 'productType', label: 'Product Type' },
    { key: 'platformRequired', label: 'Platform Required' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'responseDefinition', label: 'Response Definition' },
    { key: 'leadTimeVsImaging', label: 'Lead Time (days)' },
    { key: 'lod', label: 'LOD (detection)' },
    { key: 'lod95', label: 'LOD95 (95% conf)' },
    { key: 'sensitivity', label: 'Reported Sensitivity (%)' },
    { key: 'specificity', label: 'Reported Specificity (%)' },
    { key: 'totalParticipants', label: 'Trial Participants' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'commercialPayersStr', label: 'Private Insurance' },
    { key: 'availableRegionsStr', label: 'Availability' },
  ],
  TDS: [
    { key: 'productType', label: 'Product Type' },
    { key: 'platformRequired', label: 'Platform Required' },
    { key: 'approach', label: 'Approach' },
    { key: 'method', label: 'Method' },
    { key: 'sampleCategory', label: 'Sample Type' },
    { key: 'genesAnalyzed', label: 'Genes Analyzed' },
    { key: 'biomarkersReportedStr', label: 'Biomarkers Reported' },
    { key: 'cancerTypesStr', label: 'Target Cancers' },
    { key: 'targetPopulation', label: 'Population' },
    { key: 'fdaCompanionDxCount', label: 'FDA CDx Indications' },
    { key: 'nccnRecommended', label: 'NCCN Recommended' },
    { key: 'tat', label: 'Turnaround Time' },
    { key: 'sampleRequirements', label: 'Sample Requirements' },
    { key: 'numPublications', label: 'Publications' },
    { key: 'fdaStatus', label: 'Regulatory' },
    { key: 'reimbursement', label: 'Medicare' },
    { key: 'listPrice', label: 'List Price (USD)' },
  ],
  'ALZ-BLOOD': [
    { key: 'approach', label: 'Technology' },
    { key: 'primaryBiomarker', label: 'Primary Biomarker' },
    { key: 'biomarkersStr', label: 'Biomarkers Measured' },
    { key: 'method', label: 'Method' },
    { key: 'targetPopulation', label: 'Target Population' },
    { key: 'sensitivity', label: 'Sensitivity (%)' },
    { key: 'specificity', label: 'Specificity (%)' },
    { key: 'concordanceWithPET', label: 'PET Concordance (%)' },
    { key: 'concordanceWithCSF', label: 'CSF Concordance (%)' },
    { key: 'tat', label: 'Turnaround Time' },
    { key: 'sampleRequirements', label: 'Sample Requirements' },
    { key: 'fdaStatus', label: 'Regulatory Status' },
    { key: 'reimbursement', label: 'Coverage' },
    { key: 'listPrice', label: 'List Price (USD)' },
    { key: 'availableRegionsStr', label: 'Availability' },
    { key: 'totalParticipants', label: 'Validation Participants' },
    { key: 'numPublications', label: 'Publications' },
  ],
};
