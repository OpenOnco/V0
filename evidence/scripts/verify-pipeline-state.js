#!/usr/bin/env node
/**
 * verify-pipeline-state.js
 *
 * Post-condition gate AND standalone audit tool for the OpenOnco weekly scan.
 *
 * Why this exists:
 *   The weekly scan generates a free-text summary that historically has
 *   reported optimistic narration ("✅ Pushed to main (HEAD: 313e515)",
 *   "sources.json: 28 → 47 PMIDs") that does not match what is actually on
 *   disk or in git. We've seen hallucinated commit hashes and sources.json
 *   entries with no corresponding raw paper file.
 *
 *   This script asserts ground truth post-conditions. If any check fails it
 *   exits non-zero with a clear error so the scan FAILS LOUD instead of
 *   writing a green summary on top of a broken run.
 *
 * Checks:
 *   1. Every PMID in evidence/meta/sources.json has a raw_file at the path
 *      it claims, and the file exists on disk.
 *   2. Every file in evidence/raw/papers/<PMID>.md is registered in
 *      sources.json (no orphan papers).
 *   3. Every claim's source.pmid (across evidence/claims/*.json) appears in
 *      sources.json — claims should never reference unregistered PMIDs.
 *   4. If --expected-head <sha> is supplied, asserts it matches HEAD.
 *   5. If --require-clean-push is supplied, asserts `git rev-parse HEAD`
 *      matches `git rev-parse @{u}` (i.e. the push actually landed).
 *
 * Usage:
 *   node evidence/scripts/verify-pipeline-state.js
 *   node evidence/scripts/verify-pipeline-state.js --json
 *   node evidence/scripts/verify-pipeline-state.js --expected-head abc1234
 *   node evidence/scripts/verify-pipeline-state.js --require-clean-push
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — at least one mismatch (drift detected)
 *   2 — bad invocation / missing files
 */

import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

function realpathSafe(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");
const SOURCES_PATH = resolve(PROJECT_ROOT, "evidence/meta/sources.json");
const PAPERS_DIR = resolve(PROJECT_ROOT, "evidence/raw/papers");
const CLAIMS_DIR = resolve(PROJECT_ROOT, "evidence/claims");

function parseArgs(argv) {
  const args = { json: false, expectedHead: null, requireCleanPush: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = true;
    else if (a === "--require-clean-push") args.requireCleanPush = true;
    else if (a === "--expected-head") args.expectedHead = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(
        "Usage: verify-pipeline-state.js [--json] [--expected-head <sha>] [--require-clean-push]"
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function readSources() {
  if (!existsSync(SOURCES_PATH)) {
    return { error: `sources.json missing at ${SOURCES_PATH}` };
  }
  try {
    return { data: JSON.parse(readFileSync(SOURCES_PATH, "utf-8")) };
  } catch (e) {
    return { error: `sources.json is not valid JSON: ${e.message}` };
  }
}

function listPaperFiles() {
  if (!existsSync(PAPERS_DIR)) return [];
  return readdirSync(PAPERS_DIR).filter((f) => f.endsWith(".md"));
}

function readClaimsPmids() {
  const pmids = new Set();
  if (!existsSync(CLAIMS_DIR)) return pmids;
  for (const f of readdirSync(CLAIMS_DIR)) {
    if (!f.endsWith(".json")) continue;
    const full = join(CLAIMS_DIR, f);
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(full, "utf-8"));
    } catch {
      continue;
    }
    const claims = Array.isArray(parsed) ? parsed : parsed.claims || [];
    for (const c of claims) {
      const pmid = c?.source?.pmid;
      if (pmid != null) pmids.add(String(pmid));
    }
  }
  return pmids;
}

function gitRevParse(ref) {
  try {
    return execSync(`git -C "${PROJECT_ROOT}" rev-parse ${ref}`, {
      stdio: ["ignore", "pipe", "pipe"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function runChecks(args) {
  const errors = [];
  const stats = {};

  // ---- sources.json ↔ raw/papers parity ----
  const { data: sources, error: sErr } = readSources();
  if (sErr) {
    errors.push(sErr);
    return { ok: false, errors, stats };
  }
  const sourcePmids = Object.keys(sources);
  stats.sources_pmid_count = sourcePmids.length;

  for (const pmid of sourcePmids) {
    const entry = sources[pmid];
    const claimedRel = entry?.raw_file || `raw/papers/${pmid}.md`;
    const claimedAbs = resolve(PROJECT_ROOT, "evidence", claimedRel);
    if (!existsSync(claimedAbs)) {
      errors.push(
        `sources.json registers PMID ${pmid} with raw_file=${claimedRel} but file does not exist on disk`
      );
      continue;
    }
    if (!statSync(claimedAbs).isFile()) {
      errors.push(`sources.json raw_file for PMID ${pmid} is not a regular file: ${claimedRel}`);
    }
  }

  const paperFiles = listPaperFiles();
  stats.raw_paper_file_count = paperFiles.length;
  const sourceSet = new Set(sourcePmids);
  for (const f of paperFiles) {
    const pmid = f.replace(/\.md$/, "");
    if (!sourceSet.has(pmid)) {
      errors.push(
        `Orphan paper on disk: evidence/raw/papers/${f} has no entry in sources.json`
      );
    }
  }

  // ---- claims ↔ sources.json parity ----
  const claimsPmids = readClaimsPmids();
  stats.claims_unique_pmids = claimsPmids.size;
  for (const pmid of claimsPmids) {
    if (!sourceSet.has(pmid)) {
      errors.push(
        `Claim references PMID ${pmid} which is not registered in sources.json`
      );
    }
  }

  // ---- git checks ----
  const head = gitRevParse("HEAD");
  stats.git_head = head;
  if (args.expectedHead) {
    if (!head) {
      errors.push("Could not read git HEAD for --expected-head check");
    } else if (
      !head.startsWith(args.expectedHead) &&
      !args.expectedHead.startsWith(head.slice(0, args.expectedHead.length))
    ) {
      errors.push(
        `git HEAD (${head}) does not match expected (${args.expectedHead}). ` +
          `Summary may be reporting a hash that was never committed.`
      );
    }
  }
  if (args.requireCleanPush) {
    const upstream = gitRevParse("@{u}");
    stats.git_upstream = upstream;
    if (!upstream) {
      errors.push(
        "--require-clean-push: no upstream tracking ref found; push did not occur or branch is detached"
      );
    } else if (head && upstream && head !== upstream) {
      errors.push(
        `--require-clean-push: HEAD (${head}) != upstream (${upstream}); push did not actually land`
      );
    }
  }

  return { ok: errors.length === 0, errors, stats };
}

function main() {
  const args = parseArgs(process.argv);
  const result = runChecks(args);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Pipeline state verification`);
    console.log(`---------------------------`);
    for (const [k, v] of Object.entries(result.stats)) {
      console.log(`  ${k}: ${v}`);
    }
    if (result.ok) {
      console.log(`\nOK — sources.json, raw/papers, claims, and git state are consistent.`);
    } else {
      console.error(`\nFAILED — ${result.errors.length} issue(s):`);
      for (const e of result.errors) console.error(`  - ${e}`);
    }
  }

  process.exit(result.ok ? 0 : 1);
}

// Allow import as a library (for unit tests / orchestrators) without auto-running.
const isMain =
  process.argv[1] && realpathSafe(resolve(process.argv[1])) === realpathSafe(resolve(__filename));
if (isMain) main();

export { runChecks, gitRevParse };
