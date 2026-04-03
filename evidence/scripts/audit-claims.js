#!/usr/bin/env node
/**
 * audit-claims.js — Health checks on the evidence store
 *
 * Checks for: stale claims, missing sources, thin coverage areas,
 * unresolved disputes, claims without verification.
 *
 * Usage: node evidence/scripts/audit-claims.js
 *   --json    Output as JSON instead of human-readable
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = resolve(__dirname, '..');
const CLAIMS_DIR = resolve(EVIDENCE_DIR, 'claims');
const META_DIR = resolve(EVIDENCE_DIR, 'meta');

const JSON_OUTPUT = process.argv.includes('--json');

function readJsonSafe(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const then = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function audit() {
  const report = {
    date: new Date().toISOString().split('T')[0],
    summary: {},
    issues: [],
    coverage: {},
  };

  // Load all claims
  const claimFiles = readdirSync(CLAIMS_DIR).filter((f) => f.endsWith('.json'));
  const allClaims = [];

  for (const file of claimFiles) {
    const claims = readJsonSafe(resolve(CLAIMS_DIR, file)) || [];
    const cancer = file.replace('.json', '');
    report.coverage[cancer] = {
      total: claims.length,
      by_type: {},
      by_concern_area: {},
      unverified: 0,
      stale: 0,
    };

    for (const claim of claims) {
      claim._file = file;
      allClaims.push(claim);

      // Count by type
      const t = claim.type || 'unknown';
      report.coverage[cancer].by_type[t] = (report.coverage[cancer].by_type[t] || 0) + 1;

      // Check verification
      if (!claim.verification?.agreement) {
        report.coverage[cancer].unverified++;
      }

      // Check staleness (claims >1 year old without update)
      const extractDate = claim.extraction?.extracted_date;
      if (daysSince(extractDate) > 365) {
        report.coverage[cancer].stale++;
      }
    }

    // Flag thin coverage
    if (claims.length < 5) {
      report.issues.push({
        severity: 'warning',
        type: 'thin_coverage',
        message: `${cancer}: only ${claims.length} claims (minimum recommended: 5)`,
      });
    }
  }

  report.summary.total_claims = allClaims.length;
  report.summary.cancer_types = claimFiles.length;

  // Check for unverified claims
  const unverified = allClaims.filter((c) => !c.verification?.agreement);
  report.summary.unverified = unverified.length;
  if (unverified.length > 0) {
    report.issues.push({
      severity: 'info',
      type: 'unverified_claims',
      message: `${unverified.length} claims lack cross-model verification`,
    });
  }

  // Check for stale claims (>1 year since extraction)
  const stale = allClaims.filter((c) => daysSince(c.extraction?.extracted_date) > 365);
  report.summary.stale = stale.length;
  if (stale.length > 0) {
    report.issues.push({
      severity: 'warning',
      type: 'stale_claims',
      message: `${stale.length} claims extracted >1 year ago — may need refresh`,
    });
  }

  // Check for claims without sources
  const sourceless = allClaims.filter((c) => !c.source?.pmid && !c.source?.url && c.source?.source_type !== 'expert-panel');
  if (sourceless.length > 0) {
    report.issues.push({
      severity: 'error',
      type: 'missing_sources',
      message: `${sourceless.length} claims have no PMID or URL`,
      claim_ids: sourceless.map((c) => c.id),
    });
  }

  // Check disputes
  const disputes = readJsonSafe(resolve(META_DIR, 'disputes.json')) || [];
  const unresolvedDisputes = disputes.filter((d) => !d.resolved);
  report.summary.unresolved_disputes = unresolvedDisputes.length;
  if (unresolvedDisputes.length > 0) {
    report.issues.push({
      severity: 'warning',
      type: 'unresolved_disputes',
      message: `${unresolvedDisputes.length} unresolved cross-model disputes`,
    });
  }

  // Check pending publications
  const pending = readJsonSafe(resolve(META_DIR, 'pending-publications.json')) || [];
  report.summary.pending_publications = pending.length;
  if (pending.length > 0) {
    report.issues.push({
      severity: 'info',
      type: 'pending_publications',
      message: `${pending.length} vendor/news mentions awaiting peer-reviewed publication`,
    });
  }

  // Check expected cancer types
  const expectedTypes = ['colorectal', 'breast', 'lung', 'bladder', 'melanoma', 'cross-cancer'];
  for (const expected of expectedTypes) {
    if (!report.coverage[expected]) {
      report.issues.push({
        severity: 'error',
        type: 'missing_cancer_type',
        message: `No claims file for ${expected}`,
      });
    }
  }

  return report;
}

function printReport(report) {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n📋 Evidence Store Audit — ${report.date}\n`);
  console.log(`Total claims: ${report.summary.total_claims}`);
  console.log(`Cancer types: ${report.summary.cancer_types}`);
  console.log(`Unverified: ${report.summary.unverified}`);
  console.log(`Stale (>1yr): ${report.summary.stale}`);
  console.log(`Unresolved disputes: ${report.summary.unresolved_disputes}`);
  console.log(`Pending publications: ${report.summary.pending_publications}`);

  console.log('\n--- Coverage ---');
  for (const [cancer, data] of Object.entries(report.coverage)) {
    const types = Object.entries(data.by_type)
      .map(([t, n]) => `${t}: ${n}`)
      .join(', ');
    console.log(`  ${cancer}: ${data.total} claims (${types})`);
  }

  if (report.issues.length > 0) {
    console.log('\n--- Issues ---');
    for (const issue of report.issues) {
      const icon = { error: '❌', warning: '⚠️', info: 'ℹ️' }[issue.severity] || '•';
      console.log(`  ${icon} [${issue.type}] ${issue.message}`);
    }
  } else {
    console.log('\n✅ No issues found.');
  }
}

const report = audit();
printReport(report);

// Exit with error code if there are errors
const hasErrors = report.issues.some((i) => i.severity === 'error');
if (hasErrors) process.exit(1);
