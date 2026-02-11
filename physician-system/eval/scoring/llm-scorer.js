/**
 * LLM Scorer
 *
 * Extracted from run-eval.js buildScorerPrompt(), enhanced to receive
 * automated CDS and accuracy results. Uses Haiku for cost-effective scoring.
 *
 * LLM scores only what automation can't:
 *   - Accuracy (0-2): factual correctness, hallucination detection
 *   - Completeness (0-2): major options covered, evidence gaps acknowledged
 *   - Evidence quality (0-2): source relevance, evidence levels, cross-indication flagging
 *   - Automation bias mitigation (0-1): defers to clinical judgment
 *
 * Automated scores passed through (deterministic):
 *   - CDS Criterion 3 non-directive (0-2): from cds-compliance.js
 *   - CDS Criterion 4 transparency (0-1): from cds-compliance.js
 *
 * Total: 10 points. Pass threshold: 8/10.
 */

const SCORER_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Build the scorer prompt for the LLM, incorporating automated results.
 *
 * @param {object} question - Eval question with expected_content, expected_structure, ground_truth
 * @param {object} chatResponse - { answer, meta, sources }
 * @param {object} cdsResult - Output from checkCDSCompliance()
 * @param {object} accuracyResult - Output from checkAccuracy()
 * @returns {string} The scorer prompt
 */
function buildScorerPrompt(question, chatResponse, cdsResult, accuracyResult) {
  const answer = chatResponse.answer || '';
  const meta = chatResponse.meta || {};
  const sources = (chatResponse.sources || []).map(s => s.title).join(', ');

  // Format ground truth for scorer context
  const groundTruthSection = question.ground_truth?.facts
    ? `\nGROUND TRUTH FACTS:\n${question.ground_truth.facts.map(f => `- ${f.claim}${f.source ? ` (${f.source})` : ''}`).join('\n')}`
    : '';

  const forbiddenFactsSection = question.ground_truth?.forbidden_facts
    ? `\nFORBIDDEN FACTS (must NOT appear):\n${question.ground_truth.forbidden_facts.map(f => `- ${f}`).join('\n')}`
    : '';

  // Format automated results summary
  const autoSummary = [
    `CDS Criterion 3 (non-directive): ${cdsResult.criterion3.score}/${cdsResult.criterion3.maxScore}${cdsResult.criterion3.violations.length > 0 ? ` — ${cdsResult.criterion3.violations.length} violations` : ' — clean'}`,
    `CDS Criterion 4 (transparency): ${cdsResult.criterion4.score}/${cdsResult.criterion4.maxScore}${cdsResult.criterion4.violations.length > 0 ? ` — ${cdsResult.criterion4.violations.length} violations` : ' — clean'}`,
    `Must-mention: ${accuracyResult.mustMention.found.length} found, ${accuracyResult.mustMention.missing.length} missing${accuracyResult.mustMention.missing.length > 0 ? ` (${accuracyResult.mustMention.missing.join(', ')})` : ''}`,
    `Forbidden facts: ${accuracyResult.summary.forbiddenFactsFound} found`,
    `Citations: ${cdsResult.citations.citedClaims}/${cdsResult.citations.clinicalClaims} clinical claims cited`,
  ].join('\n');

  return `You are an expert oncology evaluator scoring a clinical decision support system's response.

You score ONLY these 4 dimensions. Automated systems have already scored CDS compliance separately.

SCORING DIMENSIONS (7 points from LLM):
- accuracy (0-2): Does the response match known ground truth facts? Are claims correct or fabricated? 0 = factual errors/hallucinations, 1 = mostly correct with minor issues, 2 = fully accurate
- completeness (0-2): Are major clinical options covered? Are evidence gaps honestly acknowledged? 0 = major omissions, 1 = adequate but missing important options, 2 = comprehensive
- evidence_quality (0-2): Are sources relevant? Evidence levels characterized? Cross-indication data flagged as such? 0 = poor sourcing, 1 = adequate, 2 = excellent source use
- automation_bias_mitigation (0-1): Does the response defer to clinical judgment? Encourage independent review? 0 = no deference, 1 = appropriately defers

QUESTION (id=${question.id}, category=${question.category}, type=${question.expected_query_type}):
${question.query}

EXPECTED CONTENT:
- Must mention: ${(question.expected_content?.must_mention || []).join(', ')}
- Should mention: ${(question.expected_content?.should_mention || []).join(', ')}
- Bonus mention: ${(question.expected_content?.bonus_mention || []).join(', ')}
${groundTruthSection}
${forbiddenFactsSection}

AUTOMATED CHECK RESULTS:
${autoSummary}

SYSTEM RESPONSE:
${answer}

METADATA:
- Sources retrieved: ${meta.sourcesRetrieved || 0}
- Matched scenario: ${meta.matchedScenario?.id || 'none'}
- Sources used: ${sources || 'none'}

EVALUATOR NOTES: ${question.notes || 'none'}

Score each dimension. Be strict but fair. Focus on factual accuracy and clinical appropriateness.

CRITICAL: Respond with ONLY valid JSON. No text before or after. Keep string values concise. Use this exact schema:
{"accuracy":{"score":1,"note":"short reason"},"completeness":{"score":1,"note":"short reason"},"evidence_quality":{"score":1,"note":"short reason"},"automation_bias_mitigation":{"score":1,"note":"short reason"},"llm_total":4,"must_mention_found":["term1"],"must_mention_missing":["term2"],"ground_truth_assessment":"Brief factual accuracy note","summary":"Brief overall assessment"}`;
}

/**
 * Parse the LLM scorer response, with fallback strategies.
 *
 * @param {string} text - Raw LLM response text
 * @returns {object} Parsed score object
 */
function parseScorerResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Scorer did not return valid JSON: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Fallback: try progressively more aggressive JSON cleaning
    let cleaned = jsonMatch[0]
      .replace(/\n/g, ' ')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']');
    try { return JSON.parse(cleaned); } catch {}

    // Strip note values entirely (they cause most parse failures)
    cleaned = cleaned.replace(/"note"\s*:\s*"[^"]*(?:"[^"]*)*"/g, '"note":"see raw"');
    try { return JSON.parse(cleaned); } catch {}

    // Nuclear option: strip everything except score fields
    cleaned = cleaned
      .replace(/"(?:summary|ground_truth_assessment|note)"\s*:\s*"[^}]*?(?=",?\s*"|\s*})/g, (m) => m.replace(/"/g, "'").replace(/^'/, '"').replace(/'$/, '"'));
    try { return JSON.parse(cleaned); } catch {
      // Last resort: extract scores with regex
      const extract = (key) => {
        const m = text.match(new RegExp(`"${key}"\\s*:\\s*\\{[^}]*"score"\\s*:\\s*(\\d)`));
        return m ? parseInt(m[1]) : 1;
      };

      const llmTotal = extract('accuracy') + extract('completeness') +
        extract('evidence_quality') + extract('automation_bias_mitigation');

      return {
        accuracy: { score: extract('accuracy'), note: 'parsed from malformed JSON' },
        completeness: { score: extract('completeness'), note: 'parsed from malformed JSON' },
        evidence_quality: { score: extract('evidence_quality'), note: 'parsed from malformed JSON' },
        automation_bias_mitigation: { score: extract('automation_bias_mitigation'), note: 'parsed from malformed JSON' },
        llm_total: llmTotal,
        must_mention_found: [],
        must_mention_missing: [],
        ground_truth_assessment: 'Unable to parse — scoring extracted from malformed response',
        summary: `LLM score ${llmTotal}/7 (extracted from malformed JSON)`,
      };
    }
  }
}

/**
 * Score a response using LLM (Haiku).
 *
 * @param {object} anthropic - Anthropic SDK instance
 * @param {object} question - Eval question
 * @param {object} chatResponse - { answer, meta, sources }
 * @param {object} cdsResult - Output from checkCDSCompliance()
 * @param {object} accuracyResult - Output from checkAccuracy()
 * @returns {object} LLM score result
 */
export async function scoreLLM(anthropic, question, chatResponse, cdsResult, accuracyResult) {
  const prompt = buildScorerPrompt(question, chatResponse, cdsResult, accuracyResult);

  const response = await anthropic.messages.create({
    model: SCORER_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text || '';
  return parseScorerResponse(text);
}

/**
 * Combine automated + LLM scores into a final 10-point result.
 *
 * @param {object} cdsResult - From checkCDSCompliance() (automated 0-3)
 * @param {object} llmResult - From scoreLLM() (LLM 0-7)
 * @returns {object} Combined score
 */
export function combineScores(cdsResult, llmResult) {
  const automatedScore = cdsResult.automatedScore; // 0-3
  const llmScore = llmResult.llm_total || 0; // 0-7

  return {
    total: automatedScore + llmScore,
    maxScore: 10,
    passThreshold: 8,
    pass: (automatedScore + llmScore) >= 8,
    automated: {
      criterion3: cdsResult.criterion3.score,
      criterion4: cdsResult.criterion4.score,
      subtotal: automatedScore,
    },
    llm: {
      accuracy: llmResult.accuracy?.score || 0,
      completeness: llmResult.completeness?.score || 0,
      evidence_quality: llmResult.evidence_quality?.score || 0,
      automation_bias_mitigation: llmResult.automation_bias_mitigation?.score || 0,
      subtotal: llmScore,
    },
  };
}

export default { scoreLLM, combineScores };
