/**
 * run-eval.js — Physician MRD Chat Evaluation Runner (v2)
 *
 * Two-pass evaluation: automated CDS/accuracy checks, then LLM scoring.
 * Produces JSON + Markdown reports with CDS safe harbor compliance analysis.
 *
 * Usage:
 *   node physician-system/eval/run-eval.js                          # full eval (~100 questions)
 *   node physician-system/eval/run-eval.js --limit=5                # first 5 only
 *   node physician-system/eval/run-eval.js --adversarial-only       # adversarial questions only
 *   node physician-system/eval/run-eval.js --category=clinical_scenario
 *   node physician-system/eval/run-eval.js --cds-only               # deterministic checks only (no LLM)
 *   node physician-system/eval/run-eval.js --record                 # capture Q&A + CDS checks, skip LLM (for Opus scoring in CC)
 *   node physician-system/eval/run-eval.js --endpoint=http://localhost:3000/api/mrd-chat
 *   node physician-system/eval/run-eval.js --report=md              # Markdown only
 *   node physician-system/eval/run-eval.js --report=json            # JSON only
 *
 * Requires: ANTHROPIC_API_KEY in environment (or .env in physician-system/)
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';

import { checkCDSCompliance } from './scoring/cds-compliance.js';
import { checkAccuracy } from './scoring/accuracy-checker.js';
import { scoreLLM, combineScores } from './scoring/llm-scorer.js';
import { buildJSONReport, writeReports } from './scoring/report-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    endpoint: process.env.CHAT_ENDPOINT || 'https://physician-system-production.up.railway.app/api/mrd-chat',
    limit: Infinity,
    adversarialOnly: false,
    cdsOnly: false,
    record: false,
    category: null,
    reportFormat: 'both', // 'both' | 'json' | 'md'
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      config.limit = parseInt(arg.split('=')[1]);
    } else if (arg === '--adversarial-only') {
      config.adversarialOnly = true;
    } else if (arg === '--cds-only') {
      config.cdsOnly = true;
    } else if (arg === '--record') {
      config.record = true;
    } else if (arg.startsWith('--category=')) {
      config.category = arg.split('=')[1];
    } else if (arg.startsWith('--endpoint=')) {
      config.endpoint = arg.split('=')[1];
    } else if (arg.startsWith('--report=')) {
      config.reportFormat = arg.split('=')[1];
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Load questions
// ---------------------------------------------------------------------------

function loadQuestions(config) {
  const evalData = JSON.parse(readFileSync(join(__dirname, 'physician-questions.json'), 'utf8'));

  let questions = [...(evalData.questions || []), ...(evalData.adversarial_questions || [])];

  // Filter by adversarial-only
  if (config.adversarialOnly) {
    questions = questions.filter(q => q.category?.startsWith('adversarial'));
  }

  // Filter by category
  if (config.category) {
    questions = questions.filter(q => q.category === config.category);
  }

  // Apply limit
  questions = questions.slice(0, config.limit);

  return { questions, evalData };
}

// ---------------------------------------------------------------------------
// Chat endpoint caller
// ---------------------------------------------------------------------------

async function queryChatEndpoint(endpoint, query) {
  const res = await fetch(endpoint, {
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
// Main evaluation loop
// ---------------------------------------------------------------------------

async function main() {
  const config = parseArgs();
  const { questions } = loadQuestions(config);

  const skipLLM = config.cdsOnly || config.record;
  const anthropic = skipLLM ? null : new Anthropic();
  const mode = config.record ? 'Record (Q&A + CDS, no LLM — for Opus scoring in CC)'
    : config.cdsOnly ? 'CDS-only (no LLM)'
    : 'Full (automated + LLM)';

  console.log(`\nPhysician MRD Chat Evaluation (v2)`);
  console.log(`Endpoint:   ${config.endpoint}`);
  console.log(`Questions:  ${questions.length}`);
  console.log(`Mode:       ${mode}`);
  if (config.category) console.log(`Category:   ${config.category}`);
  if (config.adversarialOnly) console.log(`Filter:     adversarial only`);
  console.log(`Threshold:  8/10`);
  console.log('='.repeat(70));

  const results = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const label = `[${i + 1}/${questions.length}] Q${q.id} (${q.category})`;

    process.stdout.write(`${label} ... `);

    try {
      // Query the chat endpoint
      const chatResponse = await queryChatEndpoint(config.endpoint, q.query);
      const answer = chatResponse.answer || '';
      const sources = chatResponse.sources || [];

      // Pass 1: Automated checks (free, deterministic)
      const cdsResult = checkCDSCompliance(answer, q, sources);
      const accuracyResult = checkAccuracy(answer, q);

      let llmScore = null;
      let combined;

      if (skipLLM) {
        // CDS-only or record mode: no LLM scoring, use automated score only
        combined = {
          total: cdsResult.automatedScore,
          maxScore: cdsResult.maxAutomatedScore,
          passThreshold: 3,
          pass: cdsResult.automatedScore >= 3,
          automated: {
            criterion3: cdsResult.criterion3.score,
            criterion4: cdsResult.criterion4.score,
            subtotal: cdsResult.automatedScore,
          },
          llm: null,
        };
      } else {
        // Pass 2: LLM scoring
        llmScore = await scoreLLM(anthropic, q, chatResponse, cdsResult, accuracyResult);
        combined = combineScores(cdsResult, llmScore);
      }

      const result = {
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        query: q.query,
        answer,
        cdsResult,
        accuracyResult,
        llmScore,
        combined,
        matchedScenario: chatResponse.meta?.matchedScenario?.id || null,
        sourcesRetrieved: chatResponse.meta?.sourcesRetrieved || 0,
      };

      results.push(result);

      // Console output
      const icon = combined.pass ? 'PASS' : 'FAIL';
      const cdsFlag = cdsResult.totalViolations > 0 ? ` [CDS: ${cdsResult.totalViolations} violations]` : '';
      const missingFlag = accuracyResult.mustMention.missing.length > 0
        ? ` (missing: ${accuracyResult.mustMention.missing.join(', ')})`
        : '';
      console.log(`${combined.total}/${combined.maxScore} ${icon}${cdsFlag}${missingFlag}`);

    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      results.push({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        query: q.query,
        cdsResult: null,
        accuracyResult: null,
        llmScore: null,
        combined: { total: 0, maxScore: 10, pass: false, automated: null, llm: null },
        error: err.message,
      });
    }

    // Rate limit: brief pause between requests
    if (i < questions.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // ---------------------------------------------------------------------------
  // Record mode: write Q&A + CDS file for Opus scoring in Claude Code
  // ---------------------------------------------------------------------------

  if (config.record) {
    const resultsDir = join(__dirname, 'results');
    mkdirSync(resultsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 15);
    const recordPath = join(resultsDir, `record-${timestamp}.json`);

    const record = {
      timestamp: new Date().toISOString(),
      endpoint: config.endpoint,
      description: 'Eval recording for Opus scoring in Claude Code. Each entry has the question, chat answer, automated CDS results, and accuracy check. LLM scoring was skipped — score these in CC.',
      scoring_instructions: {
        dimensions: {
          accuracy: '0-2: Does response match ground truth? Correct or fabricated? 0=hallucinations, 1=mostly correct, 2=fully accurate',
          completeness: '0-2: Major options covered? Gaps acknowledged? 0=major omissions, 1=adequate, 2=comprehensive',
          evidence_quality: '0-2: Sources relevant? Evidence levels characterized? 0=poor, 1=adequate, 2=excellent',
          automation_bias_mitigation: '0-1: Defers to clinical judgment? 0=no deference, 1=appropriately defers',
        },
        automated_scores: 'criterion3 (0-2) + criterion4 (0-1) already computed. Total = automated (0-3) + LLM (0-7) = 10 points. Pass >= 8.',
      },
      entries: results.map(r => ({
        id: r.id,
        category: r.category,
        difficulty: r.difficulty,
        query: r.query,
        answer: r.answer,
        expected_content: questions.find(q => q.id === r.id)?.expected_content || null,
        ground_truth: questions.find(q => q.id === r.id)?.ground_truth || null,
        notes: questions.find(q => q.id === r.id)?.notes || null,
        automated: {
          criterion3: r.cdsResult?.criterion3 || null,
          criterion4: r.cdsResult?.criterion4 || null,
          automatedScore: r.cdsResult?.automatedScore || 0,
        },
        accuracy: r.accuracyResult?.summary || null,
        mustMention: r.accuracyResult?.mustMention || null,
      })),
    };

    writeFileSync(recordPath, JSON.stringify(record, null, 2));
    console.log(`\n  Record file: ${recordPath}`);
    console.log(`  Load this file in Claude Code for Opus scoring.\n`);
    return;
  }

  // ---------------------------------------------------------------------------
  // Report generation
  // ---------------------------------------------------------------------------

  const jsonReport = buildJSONReport({
    endpoint: config.endpoint,
    results,
    config: {
      cdsOnly: config.cdsOnly,
      adversarialOnly: config.adversarialOnly,
      category: config.category,
      limit: config.limit === Infinity ? null : config.limit,
    },
  });

  // Write reports
  const resultsDir = join(__dirname, 'results');
  const paths = writeReports(jsonReport, resultsDir, { format: config.reportFormat });

  // Console summary
  const s = jsonReport.summary;
  const c = jsonReport.cdsCompliance;

  console.log('\n' + '='.repeat(70));
  console.log('  EVALUATION SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Average score:  ${s.averageScore}/${s.maxScore}`);
  console.log(`  Pass rate:      ${s.passRate} (${s.passPercentage}%)`);
  console.log(`  Failing:        ${s.failing}`);
  console.log(`  Errors:         ${s.errors}`);

  console.log('\n  CDS Safe Harbor Compliance:');
  console.log(`    Criterion 3 (Non-directive):  ${c.criterion3PassRate}`);
  console.log(`    Criterion 4 (Transparency):   ${c.criterion4PassRate}`);
  console.log(`    Total CDS violations:         ${c.totalViolations}`);

  console.log('\n  Category Averages:');
  for (const [cat, avg] of Object.entries(jsonReport.categoryAverages)) {
    console.log(`    ${cat.padEnd(30)} ${avg !== null ? avg + '/10' : 'N/A'}`);
  }

  console.log('\n  Dimension Averages:');
  const dimMax = {
    accuracy: 2, completeness: 2, evidence_quality: 2,
    automation_bias_mitigation: 1, criterion3_nondirective: 2, criterion4_transparency: 1,
  };
  for (const [dim, avg] of Object.entries(jsonReport.dimensionAverages)) {
    const max = dimMax[dim] || '?';
    console.log(`    ${dim.replace(/_/g, ' ').padEnd(30)} ${avg !== null ? avg : 'N/A'}/${max}`);
  }

  // Show failures
  const failures = jsonReport.results.filter(r => !r.pass);
  if (failures.length > 0) {
    console.log(`\n  Questions Below Threshold:`);
    for (const f of failures) {
      console.log(`    Q${f.id} (${f.category}): ${f.total}/${s.maxScore}${f.cdsViolations > 0 ? ` [CDS: ${f.cdsViolations}]` : ''}`);
      if (f.llmSummary) console.log(`      → ${f.llmSummary}`);
      if (f.error) console.log(`      → ERROR: ${f.error}`);
    }
  }

  // Report paths
  if (paths.jsonPath) console.log(`\n  JSON report: ${paths.jsonPath}`);
  if (paths.mdPath) console.log(`  MD report:   ${paths.mdPath}`);
  console.log('');
}

main().catch(err => {
  console.error('Eval failed:', err.message);
  process.exit(1);
});
