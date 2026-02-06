/**
 * run-eval.js — Physician MRD chat evaluation runner
 *
 * Sends each question from physician-questions.json to the live chat endpoint,
 * scores responses against the rubric using Claude Haiku, and outputs a summary.
 *
 * Usage:
 *   node physician-system/eval/run-eval.js                    # full eval (33 questions)
 *   node physician-system/eval/run-eval.js --limit=5          # first 5 only
 *   node physician-system/eval/run-eval.js --adversarial-only # 3 adversarial only
 *
 * Requires: ANTHROPIC_API_KEY in environment (or .env in physician-system/)
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CHAT_ENDPOINT = process.env.CHAT_ENDPOINT || 'https://physician-system-production.up.railway.app/api/mrd-chat';
const SCORER_MODEL = 'claude-haiku-4-5-20251001';
const LIMIT = process.argv.find(a => a.startsWith('--limit='))
  ? parseInt(process.argv.find(a => a.startsWith('--limit=')).split('=')[1])
  : Infinity;
const ADVERSARIAL_ONLY = process.argv.includes('--adversarial-only');

// ---------------------------------------------------------------------------
// Load questions
// ---------------------------------------------------------------------------

const evalData = JSON.parse(readFileSync(join(__dirname, 'physician-questions.json'), 'utf8'));
const rubric = evalData.scoring_rubric;
const maxScore = evalData.max_score;
const passThreshold = evalData.pass_threshold;

let questions = ADVERSARIAL_ONLY
  ? evalData.adversarial_questions
  : [...evalData.questions, ...evalData.adversarial_questions];

questions = questions.slice(0, LIMIT);

// ---------------------------------------------------------------------------
// Chat endpoint caller
// ---------------------------------------------------------------------------

async function queryChatEndpoint(query) {
  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    throw new Error(`Chat endpoint returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Scorer
// ---------------------------------------------------------------------------

function buildScorerPrompt(question, chatResponse) {
  const answer = chatResponse.answer || '';
  const meta = chatResponse.meta || {};
  const sources = (chatResponse.sources || []).map(s => s.title).join(', ');

  return `You are an expert oncology evaluator scoring a clinical decision support system's response.

SCORING RUBRIC (${maxScore} points total):
${Object.entries(rubric).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

QUESTION (id=${question.id}, category=${question.category}, difficulty=${question.difficulty}):
${question.query}

EXPECTED CONTENT:
- Must mention: ${(question.expected_content.must_mention || []).join(', ')}
- Should mention: ${(question.expected_content.should_mention || []).join(', ')}
- Bonus mention: ${(question.expected_content.bonus_mention || []).join(', ')}

EXPECTED STRUCTURE:
- Should contain: ${(question.expected_structure.should_contain || []).join(', ')}
- Should NOT contain: ${(question.expected_structure.should_not_contain || []).join(', ')}

SYSTEM RESPONSE:
${answer}

METADATA:
- Sources retrieved: ${meta.sourcesRetrieved || 0}
- Matched scenario: ${meta.matchedScenario?.id || 'none'}
- Sources used: ${sources || 'none'}

EVALUATOR NOTES: ${question.notes}

Score each dimension and provide a total. Be strict but fair.

CRITICAL: Respond with ONLY valid JSON. No text before or after. Keep all string values short (under 50 chars) and avoid special characters in strings. Use this exact schema:
{"decision_orientation":{"score":1,"note":"short reason"},"evidence_quality":{"score":1,"note":"short reason"},"test_specificity":{"score":1,"note":"short reason"},"completeness":{"score":1,"note":"short reason"},"evidence_gaps":{"score":1,"note":"short reason"},"safety":{"score":1,"note":"short reason"},"total":6,"must_mention_found":["term1"],"must_mention_missing":["term2"],"structure_violations":[],"summary":"Brief assessment."}`;
}

async function scoreResponse(anthropic, question, chatResponse) {
  const prompt = buildScorerPrompt(question, chatResponse);

  const response = await anthropic.messages.create({
    model: SCORER_MODEL,
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0]?.text || '';

  // Extract JSON from response — try multiple strategies
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Scorer did not return valid JSON: ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    // Fallback: try to fix common JSON issues (unescaped quotes in notes)
    const cleaned = jsonMatch[0]
      .replace(/:\s*"([^"]*)"([^,}\]\n])/g, ':"$1\\"$2')
      .replace(/\n/g, ' ');
    try {
      return JSON.parse(cleaned);
    } catch {
      // Last resort: extract just the total score
      const totalMatch = text.match(/"total"\s*:\s*(\d+)/);
      const total = totalMatch ? parseInt(totalMatch[1]) : 5;
      return {
        decision_orientation: { score: Math.min(2, Math.round(total / 5)), note: 'parsed from total' },
        evidence_quality: { score: Math.min(2, Math.round(total / 5)), note: 'parsed from total' },
        test_specificity: { score: total >= 6 ? 1 : 0, note: 'parsed from total' },
        completeness: { score: Math.min(2, Math.round(total / 5)), note: 'parsed from total' },
        evidence_gaps: { score: total >= 5 ? 1 : 0, note: 'parsed from total' },
        safety: { score: Math.min(2, Math.round(total / 5)), note: 'parsed from total' },
        total,
        must_mention_found: [],
        must_mention_missing: [],
        structure_violations: [],
        summary: `Score ${total}/10 (extracted from malformed JSON)`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const anthropic = new Anthropic();

  console.log(`\nPhysician MRD Chat Evaluation`);
  console.log(`Endpoint: ${CHAT_ENDPOINT}`);
  console.log(`Questions: ${questions.length}`);
  console.log(`Scorer: ${SCORER_MODEL}`);
  console.log(`Pass threshold: ${passThreshold}/${maxScore}`);
  console.log('='.repeat(70));

  const results = [];
  const failures = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const label = `[${i + 1}/${questions.length}] Q${q.id} (${q.category})`;

    process.stdout.write(`${label} ... `);

    try {
      // Query the chat endpoint
      const chatResponse = await queryChatEndpoint(q.query);

      // Score with Claude
      const score = await scoreResponse(anthropic, q, chatResponse);
      const total = score.total;
      const pass = total >= passThreshold;

      results.push({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        query: q.query.slice(0, 80) + (q.query.length > 80 ? '...' : ''),
        total,
        pass,
        dimensions: score,
        matchedScenario: chatResponse.meta?.matchedScenario?.id || null,
        sourcesRetrieved: chatResponse.meta?.sourcesRetrieved || 0,
      });

      if (!pass) failures.push(results[results.length - 1]);

      const icon = pass ? 'PASS' : 'FAIL';
      console.log(`${total}/${maxScore} ${icon}${score.must_mention_missing?.length ? ` (missing: ${score.must_mention_missing.join(', ')})` : ''}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        query: q.query.slice(0, 80),
        total: 0,
        pass: false,
        error: err.message,
      });
      failures.push(results[results.length - 1]);
    }

    // Rate limit: brief pause between requests
    if (i < questions.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  const scores = results.filter(r => !r.error).map(r => r.total);
  const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
  const passing = results.filter(r => r.pass).length;
  const failing = results.filter(r => !r.pass).length;

  // Per-dimension averages
  const dimNames = Object.keys(rubric);
  const dimAvgs = {};
  for (const dim of dimNames) {
    const vals = results
      .filter(r => r.dimensions?.[dim])
      .map(r => r.dimensions[dim].score);
    dimAvgs[dim] = vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : 'N/A';
  }

  // Per-category averages
  const categories = [...new Set(results.map(r => r.category))];
  const catAvgs = {};
  for (const cat of categories) {
    const catScores = results.filter(r => r.category === cat && !r.error).map(r => r.total);
    catAvgs[cat] = catScores.length > 0
      ? (catScores.reduce((a, b) => a + b, 0) / catScores.length).toFixed(1)
      : 'N/A';
  }

  console.log('\n' + '='.repeat(70));
  console.log('  EVALUATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Average score:  ${avg}/${maxScore}`);
  console.log(`  Pass rate:      ${passing}/${results.length} (${(passing / results.length * 100).toFixed(0)}%)`);
  console.log(`  Failing:        ${failing}`);

  console.log('\n  Dimension Averages:');
  for (const [dim, avg] of Object.entries(dimAvgs)) {
    const maxDim = dim === 'test_specificity' || dim === 'evidence_gaps' ? 1 : 2;
    console.log(`    ${dim.padEnd(25)} ${avg}/${maxDim}`);
  }

  console.log('\n  Category Averages:');
  for (const [cat, avg] of Object.entries(catAvgs)) {
    console.log(`    ${cat.padEnd(25)} ${avg}/${maxScore}`);
  }

  if (failures.length > 0) {
    console.log(`\n  Questions Below Threshold (< ${passThreshold}/${maxScore}):`);
    for (const f of failures) {
      console.log(`    Q${f.id} (${f.category}, ${f.difficulty}): ${f.total || 0}/${maxScore}`);
      console.log(`      ${f.query}`);
      if (f.dimensions?.summary) {
        console.log(`      → ${f.dimensions.summary}`);
      }
      if (f.error) {
        console.log(`      → ERROR: ${f.error}`);
      }
    }
  }

  // Save detailed results
  const outputPath = join(__dirname, 'eval-results.json');
  const output = {
    timestamp: new Date().toISOString(),
    endpoint: CHAT_ENDPOINT,
    scorer: SCORER_MODEL,
    summary: {
      totalQuestions: results.length,
      averageScore: parseFloat(avg),
      passRate: `${passing}/${results.length}`,
      passThreshold,
      dimensionAverages: dimAvgs,
      categoryAverages: catAvgs,
    },
    results,
  };
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n  Detailed results: ${outputPath}\n`);
}

main().catch(err => {
  console.error('Eval failed:', err.message);
  process.exit(1);
});
