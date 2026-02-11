/**
 * Ground Truth Accuracy Checker
 *
 * Verifies factual accuracy of chat responses against structured ground_truth
 * fields in the question bank. Deterministic checks — no LLM needed.
 *
 * Checks:
 *   1. forbidden_facts    — claims the response must NOT make
 *   2. must_mention        — terms from expected_content that must appear
 *   3. should_not_contain  — phrases from expected_structure that must not appear
 */

/**
 * Check if answer contains any forbidden facts.
 * These are factual errors that would indicate hallucination or confusion.
 *
 * @param {string} answer - Chat response text
 * @param {string[]} forbiddenFacts - Array of forbidden fact strings
 * @returns {object[]} Array of violations
 */
function checkForbiddenFacts(answer, forbiddenFacts) {
  if (!forbiddenFacts || forbiddenFacts.length === 0) return [];

  const violations = [];
  const answerLower = answer.toLowerCase();

  for (const fact of forbiddenFacts) {
    const factLower = fact.toLowerCase();

    // Direct substring match
    if (answerLower.includes(factLower)) {
      violations.push({
        check: 'forbidden_fact',
        fact,
        detail: `Response contains forbidden fact: "${fact}"`,
      });
      continue;
    }

    // Fuzzy match: split into key terms and check co-occurrence
    const keyTerms = factLower
      .split(/\s+/)
      .filter(t => t.length > 3)
      .filter(t => !['that', 'with', 'from', 'this', 'were', 'have', 'been', 'also', 'into', 'only'].includes(t));

    if (keyTerms.length >= 3) {
      const matchCount = keyTerms.filter(t => answerLower.includes(t)).length;
      // If 80%+ of key terms appear, flag as potential violation
      if (matchCount / keyTerms.length >= 0.8) {
        violations.push({
          check: 'forbidden_fact_fuzzy',
          fact,
          detail: `Response may contain forbidden fact (fuzzy match: ${matchCount}/${keyTerms.length} key terms): "${fact}"`,
          matchedTerms: keyTerms.filter(t => answerLower.includes(t)),
          severity: 'warning',
        });
      }
    }
  }

  return violations;
}

/**
 * Check must_mention terms from expected_content.
 *
 * @param {string} answer - Chat response text
 * @param {object} expectedContent - { must_mention, should_mention, bonus_mention }
 * @returns {object} { found, missing, shouldMentionFound, shouldMentionMissing, bonusFound }
 */
function checkMustMention(answer, expectedContent) {
  if (!expectedContent) {
    return { found: [], missing: [], shouldMentionFound: [], shouldMentionMissing: [], bonusFound: [] };
  }

  const answerLower = answer.toLowerCase();

  function findTerms(terms) {
    const found = [];
    const missing = [];
    for (const term of (terms || [])) {
      if (answerLower.includes(term.toLowerCase())) {
        found.push(term);
      } else {
        missing.push(term);
      }
    }
    return { found, missing };
  }

  const must = findTerms(expectedContent.must_mention);
  const should = findTerms(expectedContent.should_mention);
  const bonus = findTerms(expectedContent.bonus_mention);

  return {
    found: must.found,
    missing: must.missing,
    shouldMentionFound: should.found,
    shouldMentionMissing: should.missing,
    bonusFound: bonus.found,
  };
}

/**
 * Check should_not_contain phrases from expected_structure.
 *
 * @param {string} answer - Chat response text
 * @param {object} expectedStructure - { should_contain, should_not_contain }
 * @returns {object[]} Array of violations
 */
function checkForbiddenPhrases(answer, expectedStructure) {
  if (!expectedStructure?.should_not_contain) return [];

  const violations = [];
  const answerLower = answer.toLowerCase();

  for (const phrase of expectedStructure.should_not_contain) {
    if (answerLower.includes(phrase.toLowerCase())) {
      violations.push({
        check: 'forbidden_phrase',
        phrase,
        detail: `Response contains forbidden phrase: "${phrase}"`,
      });
    }
  }

  return violations;
}

/**
 * Check should_contain structural markers from expected_structure.
 *
 * @param {string} answer - Chat response text
 * @param {object} expectedStructure - { should_contain, should_not_contain }
 * @returns {object} { found, missing }
 */
function checkStructuralMarkers(answer, expectedStructure) {
  if (!expectedStructure?.should_contain) {
    return { found: [], missing: [] };
  }

  const found = [];
  const missing = [];

  for (const marker of expectedStructure.should_contain) {
    if (answer.includes(marker)) {
      found.push(marker);
    } else {
      missing.push(marker);
    }
  }

  return { found, missing };
}

/**
 * Verify ground truth facts against the answer.
 * Checks that claimed facts (from ground_truth.facts) are correctly represented.
 *
 * @param {string} answer - Chat response text
 * @param {object[]} facts - Array of { claim, source } objects
 * @returns {object} { mentioned, notMentioned }
 */
function checkGroundTruthFacts(answer, facts) {
  if (!facts || facts.length === 0) {
    return { mentioned: [], notMentioned: [] };
  }

  const answerLower = answer.toLowerCase();
  const mentioned = [];
  const notMentioned = [];

  for (const fact of facts) {
    // Extract key terms from the claim
    const keyTerms = fact.claim
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 3)
      .filter(t => !['that', 'with', 'from', 'this', 'were', 'have', 'been', 'also', 'into'].includes(t));

    const matchCount = keyTerms.filter(t => answerLower.includes(t)).length;

    if (matchCount / keyTerms.length >= 0.6) {
      mentioned.push({ ...fact, matchRatio: matchCount / keyTerms.length });
    } else {
      notMentioned.push({ ...fact, matchRatio: matchCount / keyTerms.length });
    }
  }

  return { mentioned, notMentioned };
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Run all ground truth accuracy checks on a chat response.
 *
 * @param {string} answer - The chat response text
 * @param {object} question - The eval question with ground_truth, expected_content, expected_structure
 * @returns {object} Accuracy check results
 */
export function checkAccuracy(answer, question) {
  const groundTruth = question.ground_truth || {};
  const expectedContent = question.expected_content || {};
  const expectedStructure = question.expected_structure || {};

  // 1. Forbidden facts
  const forbiddenFactViolations = checkForbiddenFacts(answer, groundTruth.forbidden_facts);
  const hardForbiddenViolations = forbiddenFactViolations.filter(v => v.severity !== 'warning');

  // 2. Must mention
  const mentions = checkMustMention(answer, expectedContent);

  // 3. Forbidden phrases
  const phraseViolations = checkForbiddenPhrases(answer, expectedStructure);

  // 4. Structural markers
  const structure = checkStructuralMarkers(answer, expectedStructure);

  // 5. Ground truth facts (informational — helps LLM scorer)
  const groundTruthFacts = checkGroundTruthFacts(answer, groundTruth.facts);

  // Combine all violations
  const allViolations = [
    ...hardForbiddenViolations,
    ...phraseViolations,
  ];

  const warnings = forbiddenFactViolations.filter(v => v.severity === 'warning');

  return {
    pass: allViolations.length === 0 && mentions.missing.length === 0,
    violations: allViolations,
    warnings,
    mustMention: mentions,
    structure,
    groundTruthFacts,
    summary: {
      forbiddenFactsFound: hardForbiddenViolations.length,
      forbiddenPhrasesFound: phraseViolations.length,
      mustMentionHit: mentions.found.length,
      mustMentionMiss: mentions.missing.length,
      shouldMentionHit: mentions.shouldMentionFound.length,
      structuralMarkersHit: structure.found.length,
      structuralMarkersMiss: structure.missing.length,
    },
  };
}

export default { checkAccuracy };
