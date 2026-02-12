/**
 * Population Boundary Guardrails
 *
 * Codifies critical evidence-population constraints that the LLM
 * frequently violates (applying stage II data to stage III, etc.).
 *
 * Used in two ways:
 * 1. Injected into system prompt as POPULATION MATCHING RULES
 * 2. Post-generation check for boundary violations
 */

export const POPULATION_RULES = [
  {
    id: 'dynamic_stage_ii',
    study: 'DYNAMIC',
    rule: 'DYNAMIC trial enrolled ONLY stage II colon cancer patients. Do NOT apply DYNAMIC results to stage III disease without an explicit caveat that DYNAMIC-III (stage III) results are pending.',
    check: {
      triggerPattern: /\bDYNAMIC\b(?![-\s]*(III|3|Rectal))/i,
      violationPattern: /stage\s*(III|3|IV|4)/i,
      exemptPattern: /DYNAMIC[-\s]*(III|3)|pending|not yet|stage II only|only stage II|different from|unlike|caution|caveat|important.*note|not.*include|not.*enroll|did not|does not apply/i,
    },
  },
  {
    id: 'idea_n2_high_risk',
    study: 'IDEA',
    rule: 'Per IDEA trial, N2 nodal status = HIGH RISK. Never classify T3N2 or any N2 disease as low-risk or intermediate-risk.',
    check: {
      triggerPattern: /\bN2\b/i,
      violationPattern: /\b(low[- ]?risk|intermediate[- ]?risk|favorable[- ]?risk)\b/i,
      exemptPattern: /high[- ]?risk|N2.*high|not.*low.?risk/i,
    },
  },
  {
    id: 'colon_vs_rectal',
    study: null,
    rule: 'Colon and rectal cancers have different treatment paradigms and MRD evidence bases. When citing evidence, always specify whether it applies to colon, rectal, or both. DYNAMIC = colon only. DYNAMIC-Rectal = rectal only.',
    check: {
      triggerPattern: /\b(colorectal|CRC)\b.*\b(neoadjuvant|radiation|total neoadjuvant|TNT)\b/i,
      violationPattern: null, // Soft rule - hard to automate
      exemptPattern: null,
    },
  },
  {
    id: 'stage_ii_to_stage_iii',
    study: null,
    rule: 'Stage II and stage III colorectal cancer have different recurrence risks, treatment paradigms, and MRD evidence. Do not extrapolate stage II results to stage III without explicit caveat.',
    check: {
      triggerPattern: /stage\s*II\b.*\bstage\s*(III|3)\b/i,
      violationPattern: /(?:similarly|also applies|same approach|equally|identical|likewise)/i,
      exemptPattern: /different|distinct|unlike|caution|caveat|not.*same|cannot.*extrapolate/i,
    },
  },
];

/**
 * Build the system prompt injection for population matching rules.
 */
export function buildPopulationGuardrailsPrompt() {
  const lines = POPULATION_RULES.map(r =>
    `- ${r.rule}`
  );

  return `POPULATION MATCHING RULES (strict):
${lines.join('\n')}

When citing evidence from a specific population, ALWAYS state the exact population studied. When applying evidence outside its studied population, add an explicit caveat.`;
}

/**
 * Post-generation check for population boundary violations.
 * Returns array of violations found in the answer text.
 */
export function checkPopulationGuardrails(answer) {
  const violations = [];
  const sentences = answer.split(/(?<=[.!?])\s+/);

  for (const rule of POPULATION_RULES) {
    if (!rule.check.triggerPattern || !rule.check.violationPattern) continue;

    for (const sentence of sentences) {
      // Check if this sentence triggers the rule
      if (!rule.check.triggerPattern.test(sentence)) continue;

      // Check for the violation pattern
      if (!rule.check.violationPattern.test(sentence)) continue;

      // Check if exempt (has appropriate caveat)
      if (rule.check.exemptPattern && rule.check.exemptPattern.test(sentence)) continue;

      // Also check surrounding context (next sentence) for exemption
      const sentenceIndex = sentences.indexOf(sentence);
      if (sentenceIndex < sentences.length - 1) {
        const nextSentence = sentences[sentenceIndex + 1];
        if (rule.check.exemptPattern && rule.check.exemptPattern.test(nextSentence)) continue;
      }

      violations.push({
        ruleId: rule.id,
        study: rule.study,
        rule: rule.rule,
        sentence: sentence.substring(0, 150),
      });
    }
  }

  // Overconfident negation detection (Step 4c)
  // Detects absolute statements like "no data exist" which are overconfident
  const OVERCONFIDENT_NEGATION = /(no|zero)\s+(published\s+)?(data|evidence|studies|trials?|research)\s+(exist|available|have been|has been|are available|is available)/i;
  // Exempt: if preceded by calibrating language
  const NEGATION_EXEMPT = /in our (current |indexed )?(evidence set|database|knowledge base)|outside this database|limited direct|our database may not/i;

  for (const sentence of sentences) {
    if (!OVERCONFIDENT_NEGATION.test(sentence)) continue;
    if (NEGATION_EXEMPT.test(sentence)) continue;

    // Check surrounding context for calibration
    const sentenceIndex = sentences.indexOf(sentence);
    let hasCalibration = false;
    if (sentenceIndex > 0 && NEGATION_EXEMPT.test(sentences[sentenceIndex - 1])) hasCalibration = true;
    if (sentenceIndex < sentences.length - 1 && NEGATION_EXEMPT.test(sentences[sentenceIndex + 1])) hasCalibration = true;
    if (hasCalibration) continue;

    violations.push({
      ruleId: 'overconfident_negation',
      study: null,
      rule: 'NEVER say "no data exist" — our database may not contain all published evidence. Use calibrated language instead.',
      sentence: sentence.substring(0, 150),
    });
  }

  // Do-not-escalate gate (Step 5a)
  // Detect therapy escalation/initiation recommendations in DECISION sections
  // when evidence tier is below RCT
  const ESCALATION_PATTERN = /\b(start|switch|escalate|initiate|begin|add|augment)\s+(treatment|therapy|chemotherapy|immunotherapy|targeted therapy|systemic therapy)\b/i;
  const DECISION_SECTION = /(?:^|\n)\*{0,2}DECISION/;

  // Only check if we're in a DECISION section context
  const hasDecisionSection = DECISION_SECTION.test(answer);
  if (hasDecisionSection) {
    // Extract DECISION section content
    const decisionMatch = answer.match(/DECISION[^:]*:([\s\S]*?)(?=\n\*{0,2}(?:OPTION|LIMITATION|REFERENCE|$))/i);
    if (decisionMatch) {
      const decisionText = decisionMatch[1];
      const decisionSentences = decisionText.split(/(?<=[.!?])\s+/);
      for (const sentence of decisionSentences) {
        if (!ESCALATION_PATTERN.test(sentence)) continue;

        // Exempt if sentence mentions trial enrollment or surveillance as the escalation
        const SAFE_CONTEXT = /\b(trial|clinical trial|enroll|surveillance|monitoring|confirmatory|imaging|consider.*trial)\b/i;
        if (SAFE_CONTEXT.test(sentence)) continue;

        violations.push({
          ruleId: 'therapy_escalation_without_rct',
          study: null,
          rule: 'Do not recommend starting/switching/escalating therapy based solely on MRD+ result without RCT-level evidence for the specific cancer type and setting.',
          sentence: sentence.substring(0, 150),
        });
      }
    }
  }

  return violations;
}

export default {
  POPULATION_RULES,
  buildPopulationGuardrailsPrompt,
  checkPopulationGuardrails,
};
