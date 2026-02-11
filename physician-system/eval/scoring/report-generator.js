/**
 * Report Generator
 *
 * Produces JSON + Markdown evaluation reports.
 * JSON for programmatic analysis, Markdown for human review.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Generate a timestamped filename.
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '').replace('T', '-').slice(0, 15);
}

/**
 * Generate the full JSON report.
 *
 * @param {object} opts
 * @param {string} opts.endpoint - Chat endpoint URL
 * @param {object[]} opts.results - Array of per-question result objects
 * @param {object} opts.config - Run configuration (flags, limits, etc.)
 * @returns {object} The JSON report object
 */
export function buildJSONReport({ endpoint, results, config }) {
  const scored = results.filter(r => !r.error);
  const scores = scored.map(r => r.combined.total);
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const passing = results.filter(r => r.combined?.pass).length;
  const failing = results.filter(r => !r.combined?.pass).length;

  // Per-category averages
  const categories = [...new Set(results.map(r => r.category))];
  const categoryAverages = {};
  for (const cat of categories) {
    const catScores = results.filter(r => r.category === cat && !r.error).map(r => r.combined.total);
    categoryAverages[cat] = catScores.length > 0
      ? parseFloat((catScores.reduce((a, b) => a + b, 0) / catScores.length).toFixed(1))
      : null;
  }

  // Per-dimension averages (LLM dimensions)
  const llmDims = ['accuracy', 'completeness', 'evidence_quality', 'automation_bias_mitigation'];
  const dimensionAverages = {};
  for (const dim of llmDims) {
    const vals = scored.filter(r => r.llmScore?.[dim]).map(r => r.llmScore[dim].score);
    dimensionAverages[dim] = vals.length > 0
      ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
      : null;
  }

  // Automated dimension averages
  dimensionAverages.criterion3_nondirective = scored.length > 0
    ? parseFloat((scored.reduce((a, r) => a + (r.cdsResult?.criterion3?.score || 0), 0) / scored.length).toFixed(2))
    : null;
  dimensionAverages.criterion4_transparency = scored.length > 0
    ? parseFloat((scored.reduce((a, r) => a + (r.cdsResult?.criterion4?.score || 0), 0) / scored.length).toFixed(2))
    : null;

  // CDS compliance aggregate
  const criterion3PassRate = scored.filter(r => r.cdsResult?.criterion3?.pass).length;
  const criterion4PassRate = scored.filter(r => r.cdsResult?.criterion4?.pass).length;

  // Collect all CDS violations
  const allCDSViolations = [];
  for (const r of scored) {
    for (const v of (r.cdsResult?.criterion3?.violations || [])) {
      allCDSViolations.push({ questionId: r.id, criterion: 3, ...v });
    }
    for (const v of (r.cdsResult?.criterion4?.violations || [])) {
      allCDSViolations.push({ questionId: r.id, criterion: 4, ...v });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    endpoint,
    config,
    summary: {
      totalQuestions: results.length,
      averageScore: parseFloat(avg.toFixed(1)),
      passRate: `${passing}/${results.length}`,
      passPercentage: parseFloat((passing / results.length * 100).toFixed(1)),
      passThreshold: 8,
      maxScore: 10,
      passing,
      failing,
      errors: results.filter(r => r.error).length,
    },
    cdsCompliance: {
      criterion3PassRate: `${criterion3PassRate}/${scored.length}`,
      criterion4PassRate: `${criterion4PassRate}/${scored.length}`,
      totalViolations: allCDSViolations.length,
      violations: allCDSViolations,
    },
    categoryAverages,
    dimensionAverages,
    results: results.map(r => ({
      id: r.id,
      category: r.category,
      difficulty: r.difficulty,
      query: r.query,
      answer: r.answer || null,
      total: r.combined?.total || 0,
      pass: r.combined?.pass || false,
      automated: r.combined?.automated,
      llm: r.combined?.llm,
      cdsViolations: (r.cdsResult?.criterion3?.violations?.length || 0) +
        (r.cdsResult?.criterion4?.violations?.length || 0),
      mustMentionMissing: r.accuracyResult?.mustMention?.missing || [],
      llmSummary: r.llmScore?.summary || null,
      error: r.error || null,
    })),
  };
}

/**
 * Generate a Markdown report from the JSON report.
 *
 * @param {object} report - Output from buildJSONReport()
 * @returns {string} Markdown text
 */
export function buildMarkdownReport(report) {
  const lines = [];
  const s = report.summary;
  const c = report.cdsCompliance;

  lines.push(`# MRD Chat Evaluation Report`);
  lines.push('');
  lines.push(`## Summary`);
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Date | ${report.timestamp.split('T')[0]} |`);
  lines.push(`| Endpoint | \`${report.endpoint}\` |`);
  lines.push(`| Questions | ${s.totalQuestions} |`);
  lines.push(`| Average Score | **${s.averageScore}/${s.maxScore}** |`);
  lines.push(`| Pass Rate | **${s.passRate} (${s.passPercentage}%)** |`);
  lines.push(`| Pass Threshold | ${s.passThreshold}/${s.maxScore} |`);
  lines.push(`| Errors | ${s.errors} |`);
  lines.push('');

  // CDS Compliance
  lines.push(`## CDS Safe Harbor Compliance`);
  lines.push('');
  lines.push(`| Criterion | Pass Rate | Description |`);
  lines.push(`|-----------|-----------|-------------|`);
  lines.push(`| Criterion 3 (Non-directive) | **${c.criterion3PassRate}** | No forbidden language, no single-option funneling |`);
  lines.push(`| Criterion 4 (Transparency) | **${c.criterion4PassRate}** | Citations, structure, evidence levels |`);
  lines.push('');

  if (c.violations.length > 0) {
    lines.push(`### CDS Violations (${c.totalViolations} total)`);
    lines.push('');
    for (const v of c.violations) {
      const crit = v.criterion === 3 ? 'C3' : 'C4';
      // Prefer sentence excerpt over raw regex patterns for readability
      const desc = v.sentence
        ? v.sentence.substring(0, 100).replace(/\n/g, ' ')
        : (v.matched || v.detail || '');
      lines.push(`- **Q${v.questionId}** [${crit}] \`${v.check}\`: ${desc}`);
    }
    lines.push('');
  }

  // Category Breakdown
  lines.push(`## Category Breakdown`);
  lines.push('');
  lines.push(`| Category | Average | Count |`);
  lines.push(`|----------|---------|-------|`);
  const catCounts = {};
  for (const r of report.results) {
    catCounts[r.category] = (catCounts[r.category] || 0) + 1;
  }
  for (const [cat, avg] of Object.entries(report.categoryAverages)) {
    lines.push(`| ${cat} | ${avg !== null ? avg + '/10' : 'N/A'} | ${catCounts[cat] || 0} |`);
  }
  lines.push('');

  // Dimension Breakdown
  lines.push(`## Dimension Breakdown`);
  lines.push('');
  lines.push(`| Dimension | Average | Max |`);
  lines.push(`|-----------|---------|-----|`);
  const dimMax = {
    accuracy: 2, completeness: 2, evidence_quality: 2,
    automation_bias_mitigation: 1, criterion3_nondirective: 2, criterion4_transparency: 1,
  };
  for (const [dim, avg] of Object.entries(report.dimensionAverages)) {
    const max = dimMax[dim] || '?';
    lines.push(`| ${dim.replace(/_/g, ' ')} | ${avg !== null ? avg : 'N/A'} | ${max} |`);
  }
  lines.push('');

  // Failures
  const failures = report.results.filter(r => !r.pass);
  if (failures.length > 0) {
    lines.push(`## Failures (${failures.length})`);
    lines.push('');
    for (const f of failures) {
      lines.push(`### Q${f.id} (${f.category}, ${f.difficulty}) — ${f.total}/${s.maxScore}`);
      lines.push('');
      lines.push(`> ${f.query.substring(0, 200)}${f.query.length > 200 ? '...' : ''}`);
      lines.push('');
      if (f.error) {
        lines.push(`**Error:** ${f.error}`);
      }
      if (f.llmSummary) {
        lines.push(`**LLM Assessment:** ${f.llmSummary}`);
      }
      if (f.mustMentionMissing.length > 0) {
        lines.push(`**Missing terms:** ${f.mustMentionMissing.join(', ')}`);
      }
      if (f.cdsViolations > 0) {
        lines.push(`**CDS violations:** ${f.cdsViolations}`);
      }
      lines.push('');
      lines.push(`| Dimension | Score |`);
      lines.push(`|-----------|-------|`);
      if (f.automated) {
        lines.push(`| Criterion 3 (auto) | ${f.automated.criterion3}/2 |`);
        lines.push(`| Criterion 4 (auto) | ${f.automated.criterion4}/1 |`);
      }
      if (f.llm) {
        lines.push(`| Accuracy (LLM) | ${f.llm.accuracy}/2 |`);
        lines.push(`| Completeness (LLM) | ${f.llm.completeness}/2 |`);
        lines.push(`| Evidence Quality (LLM) | ${f.llm.evidence_quality}/2 |`);
        lines.push(`| Automation Bias (LLM) | ${f.llm.automation_bias_mitigation}/1 |`);
      }
      lines.push('');
    }
  }

  // Full Results (collapsible)
  lines.push(`## Full Results`);
  lines.push('');
  lines.push(`<details>`);
  lines.push(`<summary>Click to expand all ${report.results.length} results</summary>`);
  lines.push('');
  lines.push(`| Q | Category | Score | Pass | Missing Terms | CDS |`);
  lines.push(`|---|----------|-------|------|---------------|-----|`);
  for (const r of report.results) {
    const pass = r.pass ? 'PASS' : 'FAIL';
    const missing = r.mustMentionMissing.length > 0 ? r.mustMentionMissing.join(', ') : '-';
    const cds = r.cdsViolations > 0 ? `${r.cdsViolations} violations` : 'clean';
    lines.push(`| ${r.id} | ${r.category} | ${r.total}/10 | ${pass} | ${missing} | ${cds} |`);
  }
  lines.push('');
  lines.push(`</details>`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Write report files to disk.
 *
 * @param {object} jsonReport - Output from buildJSONReport()
 * @param {string} resultsDir - Directory to write reports to
 * @param {object} opts - { format: 'both' | 'json' | 'md' }
 * @returns {object} { jsonPath, mdPath }
 */
export function writeReports(jsonReport, resultsDir, opts = {}) {
  const format = opts.format || 'both';
  const timestamp = getTimestamp();
  const paths = {};

  mkdirSync(resultsDir, { recursive: true });

  if (format === 'json' || format === 'both') {
    const jsonPath = join(resultsDir, `eval-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));
    paths.jsonPath = jsonPath;
  }

  if (format === 'md' || format === 'both') {
    const mdPath = join(resultsDir, `eval-${timestamp}.md`);
    const md = buildMarkdownReport(jsonReport);
    writeFileSync(mdPath, md);
    paths.mdPath = mdPath;
  }

  return paths;
}

export default { buildJSONReport, buildMarkdownReport, writeReports };
