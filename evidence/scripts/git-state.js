#!/usr/bin/env node
/**
 * git-state.js
 *
 * Tiny helper the weekly-scan summary generator MUST call to populate the
 * commit hash and push state — instead of letting an LLM free-text a hash
 * into the summary (we have observed hallucinated hashes like "313e515"
 * that never existed in git).
 *
 * Usage as CLI:
 *   node evidence/scripts/git-state.js              # prints JSON
 *   node evidence/scripts/git-state.js --short      # prints short hash only
 *
 * Usage as library:
 *   import { getGitState, getCommitHash } from "./git-state.js";
 *   const state = getGitState();
 *
 * Returned shape:
 *   {
 *     head: "abcdef0123…",          // full HEAD sha, or null
 *     headShort: "abcdef0",         // 7-char abbreviation, or null
 *     branch: "main",               // current branch name, or null
 *     upstream: "origin/main",      // tracking ref, or null
 *     pushed: true,                 // HEAD === upstream
 *     dirty: false,                 // working tree has uncommitted changes
 *     ahead: 0,                     // commits ahead of upstream
 *     behind: 0                     // commits behind upstream
 *   }
 *
 * If git is not available or the directory is not a repo, all fields are
 * null/false and the helper does NOT throw — but pushed=false should make
 * any caller treat the run as un-pushed.
 */

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

function safeGit(cmd) {
  try {
    return execSync(`git -C "${PROJECT_ROOT}" ${cmd}`, {
      stdio: ["ignore", "pipe", "pipe"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

export function getCommitHash({ short = false } = {}) {
  const ref = short ? "--short=7" : "";
  return safeGit(`rev-parse ${ref} HEAD`);
}

export function getGitState() {
  const head = safeGit("rev-parse HEAD");
  const headShort = safeGit("rev-parse --short=7 HEAD");
  const branch = safeGit("rev-parse --abbrev-ref HEAD");
  const upstream = safeGit("rev-parse --abbrev-ref --symbolic-full-name @{u}");
  const upstreamSha = safeGit("rev-parse @{u}");
  const status = safeGit("status --porcelain");
  let ahead = 0;
  let behind = 0;
  if (upstream) {
    const counts = safeGit("rev-list --left-right --count HEAD...@{u}");
    if (counts) {
      const [a, b] = counts.split(/\s+/).map((n) => parseInt(n, 10) || 0);
      ahead = a;
      behind = b;
    }
  }
  return {
    head,
    headShort,
    branch: branch === "HEAD" ? null : branch,
    upstream,
    pushed: !!(head && upstreamSha && head === upstreamSha),
    dirty: !!(status && status.length > 0),
    ahead,
    behind,
  };
}

function main() {
  const short = process.argv.includes("--short");
  if (short) {
    const h = getCommitHash({ short: true });
    if (!h) process.exit(1);
    process.stdout.write(h + "\n");
    return;
  }
  process.stdout.write(JSON.stringify(getGitState(), null, 2) + "\n");
}

import { realpathSync } from "node:fs";
function realpathSafe(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
const isMain =
  process.argv[1] && realpathSafe(resolve(process.argv[1])) === realpathSafe(resolve(__filename));
if (isMain) main();
