/**
 * run-eval.js — Physician MRD Chat Evaluation Runner
 *
 * Queries the production chat endpoint, runs deterministic CDS/accuracy checks,
 * and writes a recording file for Opus scoring in Claude Code via /grade-physician.
 *
 * Usage:
 *   node physician-system/eval/run-eval.js                          # all questions
 *   node physician-system/eval/run-eval.js --limit=5                # first 5 only
 *   node physician-system/eval/run-eval.js --adversarial-only       # adversarial questions only
 *   node physician-system/eval/run-eval.js --category=clinical_scenario
 *   node physician-system/eval/run-eval.js --endpoint=http://localhost:3000/api/mrd-chat
 */

import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { checkCDSCompliance } from './scoring/cds-compliance.js';
import { checkAccuracy } from './scoring/accuracy-checker.js';

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
    category: null,
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      config.limit = parseInt(arg.split('=')[1]);
    } else if (arg === '--adversarial-only') {
      config.adversarialOnly = true;
    } else if (arg.startsWith('--category=')) {
      config.category = arg.split('=')[1];
    } else if (arg.startsWith('--endpoint=')) {
      config.endpoint = arg.split('=')[1];
    }
  }

  return config;
}

// ---------------------------------------------------------------------------
// Load questions
// ---------------------------------------------------------------------------

function loadQuestions(config) {
  const evalData = JSON.parse(readFileSync(join(__dirname, 'physician-questions.json'), 'utf8'));

  let questions = [...(evalData.questions || []), ...(evalData.context_aware_questions || []), ...(evalData.boundary_questions || []), ...(evalData.adversarial_questions || [])];

  // Skip out-of-scope questions
  questions = questions.filter(q => !q.out_of_scope);

  // Filter by adversarial-only
  if (config.adversarialOnly) {
    questions = questions.filter(q => q.category?.startsWith('adversarial'));
  }

  // Filter by category (supports prefix match with trailing *)
  if (config.category) {
    if (config.category.endsWith('*')) {
      const prefix = config.category.slice(0, -1);
      questions = questions.filter(q => q.category?.startsWith(prefix));
    } else {
      questions = questions.filter(q => q.category === config.category);
    }
  }

  // Apply limit
  questions = questions.slice(0, config.limit);

  return { questions, evalData };
}

// ---------------------------------------------------------------------------
// Chat endpoint caller
// ---------------------------------------------------------------------------

async function queryChatEndpoint(endpoint, query, filters = {}) {
  const body = { query };
  if (Object.keys(filters).length > 0) body.filters = filters;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

  console.log(`\nPhysician MRD Chat Evaluation`);
  console.log(`Endpoint:   ${config.endpoint}`);
  console.log(`Questions:  ${questions.length}`);
  console.log(`Mode:       Record (Q&A + CDS, for Opus scoring in CC)`);
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
      // Build query with optional patient context prefix (simulates UI selection)
      const fullQuery = (q.context_prefix || '') + q.query;
      const chatResponse = await queryChatEndpoint(config.endpoint, fullQuery, q.filters || {});
      const answer = chatResponse.answer || '';
      const sources = chatResponse.sources || [];

      // Automated checks (deterministic)
      const cdsResult = checkCDSCompliance(answer, q, sources);
      const accuracyResult = checkAccuracy(answer, q);

      const combined = {
        total: cdsResult.automatedScore,
        maxScore: cdsResult.maxAutomatedScore,
        passThreshold: 3,
        pass: cdsResult.automatedScore >= 3,
        automated: {
          criterion3: cdsResult.criterion3.score,
          criterion4: cdsResult.criterion4.score,
          subtotal: cdsResult.automatedScore,
        },
      };

      results.push({
        id: q.id,
        category: q.category,
        difficulty: q.difficulty,
        query: q.query,
        context_prefix: q.context_prefix || null,
        filters: q.filters || null,
        answer,
        sources,
        cdsResult,
        accuracyResult,
        combined,
        matchedScenario: chatResponse.meta?.matchedScenario?.id || null,
        sourcesRetrieved: chatResponse.meta?.sourcesRetrieved || 0,
        accuracyWarnings: chatResponse.meta?.accuracyWarnings || [],
      });

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
        combined: { total: 0, maxScore: 3, pass: false, automated: null },
        error: err.message,
      });
    }

    // Rate limit: brief pause between requests
    if (i < questions.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // ---------------------------------------------------------------------------
  // Write recording file for Opus scoring in Claude Code
  // ---------------------------------------------------------------------------

  const resultsDir = join(__dirname, 'results');
  mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 15);
  const recordPath = join(resultsDir, `record-${timestamp}.json`);

  const record = {
    timestamp: new Date().toISOString(),
    endpoint: config.endpoint,
    description: 'Eval recording for Opus scoring in Claude Code via /grade-physician.',
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
      context_prefix: r.context_prefix || null,
      filters: r.filters || null,
      answer: r.answer,
      sources: (r.sources || []).map(s => ({
        index: s.index,
        title: s.title,
        citation: s.citation,
        sourceType: s.sourceType,
        evidenceType: s.evidenceType,
        pmid: s.pmid || null,
        doi: s.doi || null,
        url: s.url || null,
      })),
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
      accuracyWarnings: r.accuracyWarnings || [],
    })),
  };

  writeFileSync(recordPath, JSON.stringify(record, null, 2));
  console.log(`\n  Record file: ${recordPath}`);
  console.log(`  Score with /grade-physician in Claude Code.\n`);
}

main().catch(err => {
  console.error('Eval failed:', err.message);
  process.exit(1);
});
