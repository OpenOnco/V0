/**
 * Document Type Classifier
 *
 * Classifies crawled documents as actual policy documents vs index/listing pages
 * to prevent false positive crawls and wasted analysis.
 *
 * v2.1.1: Rule-based heuristics (can upgrade to ML later if needed)
 */

/**
 * Document types
 */
export const DOC_TYPES = {
  POLICY: 'policy',           // Actual policy document with coverage criteria
  INDEX: 'index',             // Index/listing page with links to policies
  PROVIDER_INFO: 'provider',  // Provider information (not policy)
  FORM: 'form',               // Forms, applications
  UNKNOWN: 'unknown',
};

/**
 * Signals that indicate an index/listing page (negative signals)
 */
const INDEX_SIGNALS = [
  // Navigation/listing language
  /click\s+(?:here\s+)?to\s+view/i,
  /view\s+(?:full\s+)?policy/i,
  /policy\s+library/i,
  /policy\s+index/i,
  /browse\s+(?:all\s+)?policies/i,
  /search\s+(?:for\s+)?policies/i,
  /select\s+a\s+policy/i,
  /list\s+of\s+(?:medical\s+)?policies/i,

  // Multiple policy links pattern
  /(?:policy\s+\d+[:\s].*){3,}/i,

  // Table of contents without content
  /table\s+of\s+contents/i,

  // Search/filter UI language
  /filter\s+by/i,
  /sort\s+by/i,
  /search\s+results/i,
];

/**
 * Signals that indicate an actual policy document (positive signals)
 */
const POLICY_SIGNALS = [
  // Effective date patterns
  /effective\s+date[:\s]+\d/i,
  /effective\s+date[:\s]+(?:january|february|march|april|may|june|july|august|september|october|november|december)/i,
  /effective[:\s]+(?:january|february|march|april|may|june|july|august|september|october|november|december)/i,

  // Policy metadata
  /policy\s+number[:\s]+\w/i,
  /last\s+(?:reviewed|revised)[:\s]+\d/i,
  /revision\s+date/i,

  // Coverage criteria sections
  /coverage\s+criteria/i,
  /medical(?:ly)?\s+necess(?:ary|ity)/i,
  /(?:is|are)\s+(?:considered\s+)?covered/i,
  /(?:is|are)\s+(?:considered\s+)?(?:not\s+)?medically\s+necessary/i,
  /indications?\s+for\s+coverage/i,

  // Specific policy content
  /prior\s+auth(?:orization)?\s+(?:is\s+)?required/i,
  /coverage\s+(?:is\s+)?limited\s+to/i,
  /(?:is|are)\s+(?:considered\s+)?investigational/i,
  /(?:is|are)\s+(?:considered\s+)?experimental/i,

  // CPT/Billing codes
  /(?:cpt|hcpcs|pla)\s*(?:code)?[:\s]+\d{4,5}/i,
  /0239u|81479|0306u|0311u/i,  // Known MRD test codes

  // Test-specific mentions with coverage language
  /signatera\s+(?:is|are)\s+(?:covered|not\s+covered)/i,
  /guardant\s+(?:is|are)\s+(?:covered|not\s+covered)/i,
];

/**
 * Classify a document based on its content
 *
 * @param {string} content - Document text content
 * @param {Object} options - { url?: string }
 * @returns {Object} { docType, confidence, signals }
 */
export function classifyDocument(content, options = {}) {
  if (!content || typeof content !== 'string') {
    return {
      docType: DOC_TYPES.UNKNOWN,
      confidence: 0,
      signals: { positive: [], negative: [] },
    };
  }

  const positiveSignals = [];
  const negativeSignals = [];

  // Check for index page signals
  for (const pattern of INDEX_SIGNALS) {
    if (pattern.test(content)) {
      negativeSignals.push(pattern.source);
    }
  }

  // Check for policy document signals
  for (const pattern of POLICY_SIGNALS) {
    if (pattern.test(content)) {
      positiveSignals.push(pattern.source);
    }
  }

  // Additional heuristics

  // Short content is likely index/navigation
  const wordCount = content.split(/\s+/).length;
  if (wordCount < 200) {
    negativeSignals.push('short_content');
  }

  // Many links relative to content suggests index
  const linkCount = (content.match(/https?:\/\//g) || []).length;
  if (linkCount > 10 && wordCount < 1000) {
    negativeSignals.push('high_link_density');
  }

  // URL hints (if provided)
  if (options.url) {
    const urlLower = options.url.toLowerCase();
    if (urlLower.includes('/index') || urlLower.includes('/list') ||
        urlLower.includes('/search') || urlLower.includes('/browse')) {
      negativeSignals.push('url_suggests_index');
    }
    if (urlLower.includes('.pdf') || urlLower.includes('/policy/') ||
        urlLower.includes('/medical-policy/')) {
      positiveSignals.push('url_suggests_policy');
    }
  }

  // Calculate scores
  const positiveScore = positiveSignals.length;
  const negativeScore = negativeSignals.length;

  // Determine classification
  let docType;
  let confidence;

  if (positiveScore >= 3 && positiveScore > negativeScore * 2) {
    // Strong policy signals
    docType = DOC_TYPES.POLICY;
    confidence = Math.min(0.95, 0.5 + positiveScore * 0.1);
  } else if (negativeScore >= 2 && negativeScore > positiveScore) {
    // Strong index signals
    docType = DOC_TYPES.INDEX;
    confidence = Math.min(0.9, 0.4 + negativeScore * 0.15);
  } else if (positiveScore > negativeScore) {
    // Weak policy signals
    docType = DOC_TYPES.POLICY;
    confidence = 0.4 + (positiveScore - negativeScore) * 0.1;
  } else if (negativeScore > positiveScore) {
    // Weak index signals
    docType = DOC_TYPES.INDEX;
    confidence = 0.4 + (negativeScore - positiveScore) * 0.1;
  } else {
    // Unclear
    docType = DOC_TYPES.UNKNOWN;
    confidence = 0.3;
  }

  return {
    docType,
    confidence: Math.min(0.95, Math.max(0.1, confidence)),
    signals: {
      positive: positiveSignals,
      negative: negativeSignals,
    },
    wordCount,
  };
}

/**
 * Quick check if content is likely an index page
 * @param {string} content - Document content
 * @returns {boolean}
 */
export function isLikelyIndexPage(content) {
  const result = classifyDocument(content);
  return result.docType === DOC_TYPES.INDEX && result.confidence > 0.5;
}

/**
 * Quick check if content is likely an actual policy
 * @param {string} content - Document content
 * @returns {boolean}
 */
export function isLikelyPolicy(content) {
  const result = classifyDocument(content);
  return result.docType === DOC_TYPES.POLICY && result.confidence > 0.5;
}

export default {
  DOC_TYPES,
  classifyDocument,
  isLikelyIndexPage,
  isLikelyPolicy,
};
