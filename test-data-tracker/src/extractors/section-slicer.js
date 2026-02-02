/**
 * Section Slicer for Policy Documents
 *
 * Extracts coverage-related sections by heading patterns.
 * This provides a robust fallback when structured extraction fails.
 *
 * Unlike the criteria extractor which parses specific data points,
 * the section slicer extracts raw text blocks that are likely to
 * contain coverage information - ensuring criteriaHash changes
 * even when extraction fails.
 */

/**
 * Heading patterns that indicate coverage-related sections
 * Ordered by specificity (more specific first)
 */
export const CRITERIA_HEADINGS = [
  // Most specific - coverage criteria
  /^#+\s*(?:coverage\s+)?criteria/im,
  /^(?:coverage\s+)?criteria\s*[:：]?\s*$/im,
  /^\*{2,}(?:coverage\s+)?criteria\*{2,}/im,

  // v2.1: Wiki/text format with == HEADING ==
  /^={2,}\s*(?:coverage\s+)?(?:policy|criteria)\s*={2,}/im,

  // Medical necessity
  /^#+\s*medical(?:ly)?\s+necess(?:ary|ity)/im,
  /^medical(?:ly)?\s+necess(?:ary|ity)\s*[:：]?\s*$/im,

  // Coverage policy/position
  /^#+\s*coverage\s+(?:policy|position|determination)/im,
  /^coverage\s+(?:policy|position|determination)\s*[:：]?\s*$/im,

  // Policy statement
  /^#+\s*policy\s+(?:statement|position)/im,
  /^policy\s+(?:statement|position)\s*[:：]?\s*$/im,

  // Indications
  /^#+\s*(?:covered\s+)?indications?/im,
  /^(?:covered\s+)?indications?\s*[:：]?\s*$/im,

  // When covered
  /^#+\s*when\s+(?:is\s+)?(?:it\s+)?covered/im,
  /^when\s+(?:is\s+)?(?:it\s+)?covered\s*[:：]?\s*$/im,

  // Limitations and exclusions
  /^#+\s*limitations?\s*(?:and\s+exclusions?)?/im,
  /^limitations?\s*(?:and\s+exclusions?)?\s*[:：]?\s*$/im,

  // Exclusions
  /^#+\s*exclusions?/im,
  /^exclusions?\s*[:：]?\s*$/im,

  // Not covered / Non-covered
  /^#+\s*(?:not|non)[\s-]?covered/im,
  /^(?:not|non)[\s-]?covered\s*[:：]?\s*$/im,

  // Requirements
  /^#+\s*(?:coverage\s+)?requirements?/im,
  /^(?:coverage\s+)?requirements?\s*[:：]?\s*$/im,

  // Background/Description (less specific but often contains stance)
  /^#+\s*(?:policy\s+)?description/im,
  /^#+\s*background/im,
];

/**
 * Heading patterns that indicate end of coverage section
 */
export const SECTION_END_HEADINGS = [
  /^#+\s*references?/im,
  /^references?\s*[:：]?\s*$/im,
  /^#+\s*bibliography/im,
  /^#+\s*appendix/im,
  /^#+\s*coding\s+(?:information|guidelines)/im,
  /^#+\s*(?:cpt|hcpcs|icd)/im,
  /^#+\s*(?:revision|document)\s+history/im,
  /^#+\s*disclaimer/im,
  /^#+\s*contact/im,
  /^#+\s*definitions?/im,
];

/**
 * Slice coverage-related sections from document text
 * @param {string} text - Full document text
 * @returns {Object} { sections: [], combinedText: string, headingsFound: [] }
 */
export function sliceCriteriaSections(text) {
  if (!text || typeof text !== 'string') {
    return { sections: [], combinedText: '', headingsFound: [] };
  }

  const lines = text.split('\n');
  const sections = [];
  const headingsFound = [];

  let currentSection = null;
  let currentHeading = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if this line is a coverage-related heading
    const matchedHeading = CRITERIA_HEADINGS.find(pattern => pattern.test(trimmedLine));

    if (matchedHeading) {
      // Save previous section if exists
      if (currentSection && currentSection.lines.length > 0) {
        sections.push({
          heading: currentHeading,
          text: currentSection.lines.join('\n').trim(),
          startLine: currentSection.startLine,
          endLine: i - 1,
        });
      }

      // Start new section
      currentHeading = trimmedLine;
      headingsFound.push(trimmedLine);
      currentSection = {
        lines: [],
        startLine: i + 1,
      };
      continue;
    }

    // Check if this line ends the current section
    if (currentSection) {
      const isEndHeading = SECTION_END_HEADINGS.some(pattern => pattern.test(trimmedLine));

      // Also check for next major heading (any heading pattern)
      const isAnyHeading = /^#{1,6}\s+/.test(trimmedLine) ||
        /^[A-Z][A-Z\s]{5,}[:：]?\s*$/.test(trimmedLine);

      if (isEndHeading || (isAnyHeading && !matchedHeading)) {
        // End current section
        if (currentSection.lines.length > 0) {
          sections.push({
            heading: currentHeading,
            text: currentSection.lines.join('\n').trim(),
            startLine: currentSection.startLine,
            endLine: i - 1,
          });
        }
        currentSection = null;
        currentHeading = null;
        continue;
      }

      // Add line to current section
      currentSection.lines.push(line);
    }
  }

  // Save final section if exists
  if (currentSection && currentSection.lines.length > 0) {
    sections.push({
      heading: currentHeading,
      text: currentSection.lines.join('\n').trim(),
      startLine: currentSection.startLine,
      endLine: lines.length - 1,
    });
  }

  // Combine all section text for hashing
  const combinedText = sections.map(s => s.text).join('\n---\n');

  return {
    sections,
    combinedText,
    headingsFound,
  };
}

/**
 * Extract text that appears to contain coverage stance keywords
 * even without proper headings (fallback for poorly formatted docs)
 * @param {string} text - Full document text
 * @returns {string} Extracted stance-relevant text
 */
export function extractStanceText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const stancePatterns = [
    // Positive coverage
    /(?:is|are)\s+(?:considered\s+)?(?:medically\s+necessary|covered|approved)[^.]*\./gi,
    /(?:meets?\s+)?(?:medical\s+necessity|coverage)\s+(?:criteria|requirements)[^.]*\./gi,
    /(?:will\s+be\s+)?covered\s+(?:when|if|for)[^.]*\./gi,

    // Negative coverage
    /(?:is|are)\s+(?:considered\s+)?(?:investigational|experimental|not\s+covered|unproven)[^.]*\./gi,
    /(?:does\s+not|do\s+not)\s+meet\s+(?:medical\s+necessity|coverage)[^.]*\./gi,
    /(?:is|are)\s+(?:not\s+)?(?:medically\s+necessary|indicated)[^.]*\./gi,

    // Conditional coverage
    /(?:covered\s+)?(?:only\s+)?(?:when|if)\s+(?:the\s+)?(?:following|all|these)\s+(?:criteria|conditions|requirements)[^.]*\./gi,
    /(?:requires?|must\s+(?:have|meet))[^.]*(?:prior\s+authorization|documentation)[^.]*\./gi,
  ];

  const matches = [];

  for (const pattern of stancePatterns) {
    const found = text.match(pattern) || [];
    matches.push(...found);
  }

  // Deduplicate and join
  const unique = [...new Set(matches)];
  return unique.join(' ').trim();
}

/**
 * Get a normalized hash-ready string from document
 * Combines section-sliced text with stance extraction
 * @param {string} text - Full document text
 * @returns {string} Normalized text for hashing
 */
export function getHashableContent(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Layer 1: Section-sliced content
  const { combinedText: sectionText } = sliceCriteriaSections(text);

  // Layer 2: Stance-relevant sentences (fallback)
  const stanceText = extractStanceText(text);

  // Combine both layers
  const combined = [sectionText, stanceText].filter(Boolean).join('\n||||\n');

  // Normalize for consistent hashing
  return normalizeForHash(combined);
}

/**
 * Normalize text for consistent hashing
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
export function normalizeForHash(text) {
  if (!text) return '';

  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove punctuation variations
    .replace(/[""'']/g, '"')
    .replace(/[–—]/g, '-')
    // Lowercase
    .toLowerCase()
    // Trim
    .trim();
}

/**
 * Check if a document has extractable coverage sections
 * @param {string} text - Document text
 * @returns {boolean}
 */
export function hasCoverageSections(text) {
  const { sections, headingsFound } = sliceCriteriaSections(text);
  return sections.length > 0 || headingsFound.length > 0;
}

export default {
  CRITERIA_HEADINGS,
  SECTION_END_HEADINGS,
  sliceCriteriaSections,
  extractStanceText,
  getHashableContent,
  normalizeForHash,
  hasCoverageSections,
};
