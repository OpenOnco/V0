/**
 * PubMed MRD Search Query Definitions
 * Defines MeSH terms, keywords, and publication types for MRD guidance search
 */

// MeSH terms for MRD-related content
export const MESH_TERMS = [
  'Neoplasm, Residual',           // MRD concept
  'Circulating Tumor DNA',         // ctDNA
  'Liquid Biopsy',                 // Sample type
  'Biomarkers, Tumor',             // Tumor markers
  'Neoplasms/diagnosis',           // Cancer diagnosis
  'Minimal Residual Disease',      // Direct MRD term
];

// Keywords to search in title/abstract
export const KEYWORDS = {
  // Core MRD terms
  primary: [
    'minimal residual disease',
    'molecular residual disease',
    'measurable residual disease',
    'MRD',
    'ctDNA',
    'circulating tumor DNA',
    'cell-free DNA',
    'cfDNA',
    'liquid biopsy',
  ],

  // Clinical context terms
  clinical: [
    'adjuvant',
    'neoadjuvant',
    'surveillance',
    'recurrence',
    'treatment response',
    'therapy escalation',
    'therapy de-escalation',
    'post-surgery',
    'postoperative',
  ],

  // Specific tests (for high-relevance matching)
  tests: [
    'Signatera',
    'Guardant Reveal',
    'FoundationOne Tracker',
    'RaDaR',
    'Haystack',
    'clonoSEQ',
    'tumor-informed',
    'tumor-naive',
    'personalized assay',
  ],

  // Cancer types of interest
  cancerTypes: [
    'colorectal',
    'colon cancer',
    'rectal cancer',
    'breast cancer',
    'lung cancer',
    'NSCLC',
    'bladder cancer',
    'urothelial',
    'pancreatic',
    'melanoma',
    'ovarian',
    'gastric',
    'esophageal',
    'hepatocellular',
  ],
};

// Publication types to prioritize
export const PUBLICATION_TYPES = {
  highPriority: [
    'Guideline',
    'Practice Guideline',
    'Consensus Development Conference',
    'Meta-Analysis',
    'Systematic Review',
    'Clinical Trial, Phase III',
    'Randomized Controlled Trial',
  ],

  mediumPriority: [
    'Clinical Trial, Phase II',
    'Clinical Trial',
    'Observational Study',
    'Multicenter Study',
    'Comparative Study',
  ],

  lowPriority: [
    'Review',
    'Editorial',
    'Comment',
    'Letter',
  ],
};

// Build PubMed search query for MRD content
export function buildMRDSearchQuery(options = {}) {
  const {
    fromDate,
    toDate,
    publicationTypes = 'all',
    includeReviews = false,
    requireHumansMesh = false, // Disabled by default - newly indexed articles often lack MeSH terms
  } = options;

  const parts = [];

  // Core MRD concept search
  const mrdTerms = [
    '"minimal residual disease"[tiab]',
    '"molecular residual disease"[tiab]',
    '"measurable residual disease"[tiab]',
    '"MRD"[tiab]',
    '"circulating tumor DNA"[tiab]',
    '"ctDNA"[tiab]',
    '"liquid biopsy"[tiab]',
    '"Neoplasm, Residual"[Mesh]',
    '"Circulating Tumor DNA"[Mesh]',
  ];

  parts.push(`(${mrdTerms.join(' OR ')})`);

  // Add cancer context (exclude hematologic malignancies for solid tumor focus)
  const cancerContext = [
    '"neoplasms"[Mesh:NoExp]',
    '"carcinoma"[tiab]',
    '"adenocarcinoma"[tiab]',
    '"solid tumor"[tiab]',
    '"colorectal"[tiab]',
    '"breast cancer"[tiab]',
    '"lung cancer"[tiab]',
    '"NSCLC"[tiab]',
  ];

  parts.push(`(${cancerContext.join(' OR ')})`);

  // Exclude hematologic malignancies (focus on solid tumors)
  parts.push('NOT ("leukemia"[tiab] OR "lymphoma"[tiab] OR "myeloma"[tiab])');

  // Date filter
  if (fromDate) {
    const from = fromDate.replace(/-/g, '/');
    const to = toDate ? toDate.replace(/-/g, '/') : '3000/01/01';
    parts.push(`("${from}"[PDAT] : "${to}"[PDAT])`);
  }

  // Publication type filter
  if (publicationTypes === 'high') {
    const ptFilter = PUBLICATION_TYPES.highPriority
      .map((pt) => `"${pt}"[pt]`)
      .join(' OR ');
    parts.push(`(${ptFilter})`);
  } else if (publicationTypes === 'clinical') {
    const ptFilter = [
      ...PUBLICATION_TYPES.highPriority,
      ...PUBLICATION_TYPES.mediumPriority,
    ]
      .map((pt) => `"${pt}"[pt]`)
      .join(' OR ');
    parts.push(`(${ptFilter})`);
  }

  // Exclude reviews unless specifically requested
  if (!includeReviews) {
    parts.push('NOT "Review"[pt]');
  }

  // English language only
  parts.push('English[la]');

  // Humans only - optional as newly indexed articles often lack MeSH terms
  if (requireHumansMesh) {
    parts.push('Humans[Mesh]');
  }

  return parts.join(' AND ');
}

// Build a simpler query for high-priority content only
export function buildHighPriorityQuery(options = {}) {
  return buildMRDSearchQuery({
    ...options,
    publicationTypes: 'high',
  });
}

// Keywords regex for pre-filtering
export function getMRDKeywordRegex() {
  const allKeywords = [
    ...KEYWORDS.primary,
    ...KEYWORDS.tests,
  ].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // Escape regex chars

  return new RegExp(allKeywords.join('|'), 'i');
}

// Get relevance score based on content
export function scoreRelevance(title, abstract) {
  const text = `${title} ${abstract}`.toLowerCase();
  let score = 0;

  // Primary MRD terms: +3 each
  for (const term of KEYWORDS.primary) {
    if (text.includes(term.toLowerCase())) {
      score += 3;
    }
  }

  // Specific test names: +5 each
  for (const test of KEYWORDS.tests) {
    if (text.includes(test.toLowerCase())) {
      score += 5;
    }
  }

  // Clinical context: +2 each
  for (const term of KEYWORDS.clinical) {
    if (text.includes(term.toLowerCase())) {
      score += 2;
    }
  }

  // Cancer types: +1 each
  for (const cancer of KEYWORDS.cancerTypes) {
    if (text.includes(cancer.toLowerCase())) {
      score += 1;
    }
  }

  // Normalize to 1-10 scale
  return Math.min(10, Math.max(1, Math.round(score / 3)));
}

export default {
  MESH_TERMS,
  KEYWORDS,
  PUBLICATION_TYPES,
  buildMRDSearchQuery,
  buildHighPriorityQuery,
  getMRDKeywordRegex,
  scoreRelevance,
};
