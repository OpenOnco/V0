#!/usr/bin/env node

/**
 * diff-claims.js
 *
 * Compares Claude-extracted claims vs GPT-extracted claims for the same paper.
 *
 * Programmatic: import { diffClaims } from './diff-claims.js'
 * CLI:          node evidence/scripts/diff-claims.js <PMID>
 *
 * When called from CLI, reads GPT claims from evidence/meta/verification/{pmid}-gpt4o.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Numeric match with tolerance for rounding (e.g. 0.92 vs 0.919). */
function numericMatch(a, b, tolerance = 0.02) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= tolerance;
}

/** Exact categorical match (case-insensitive). */
function categoricalMatch(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    const sa = a.map((s) => String(s).toLowerCase()).sort();
    const sb = b.map((s) => String(s).toLowerCase()).sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  }
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/** Tokenize a string into lowercase alpha-numeric words. */
function tokenize(str) {
  if (!str) return new Set();
  return new Set(
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/** Fuzzy description match: >80% key-term overlap. */
function descriptionMatch(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.size === 0 && tokB.size === 0) return true;
  const union = new Set([...tokA, ...tokB]);
  if (union.size === 0) return true;
  let overlap = 0;
  for (const t of tokA) {
    if (tokB.has(t)) overlap++;
  }
  // Overlap relative to the smaller set
  const minSize = Math.min(tokA.size, tokB.size);
  if (minSize === 0) return false;
  return overlap / minSize >= 0.8;
}

/**
 * Score how well a GPT claim matches a Claude claim.
 * Returns { score: 0-1, disagreements: string[] }
 */
function scorePair(claude, gpt) {
  const disagreements = [];
  let points = 0;
  let total = 0;

  // --- Categorical fields (exact) ---
  const catFields = [
    { path: ["finding", "endpoint_type"], label: "endpoint_type" },
    { path: ["finding", "result_direction"], label: "result_direction" },
    { path: ["scope", "cancer"], label: "cancer" },
    { path: ["scope", "stages"], label: "stages" },
  ];
  for (const { path: p, label } of catFields) {
    total++;
    const cVal = p.reduce((o, k) => o?.[k], claude);
    const gVal = p.reduce((o, k) => o?.[k], gpt);
    if (categoricalMatch(cVal, gVal)) {
      points++;
    } else {
      disagreements.push(
        `${label}: claude=${JSON.stringify(cVal)} vs gpt=${JSON.stringify(gVal)}`
      );
    }
  }

  // --- Numeric fields (with tolerance) ---
  const numFields = [
    { path: ["finding", "hr"], label: "hr", tol: 0.02 },
    { path: ["finding", "or"], label: "or", tol: 0.02 },
    { path: ["finding", "rr"], label: "rr", tol: 0.02 },
    { path: ["finding", "n"], label: "n", tol: 5 },
    { path: ["finding", "ci_lower"], label: "ci_lower", tol: 0.02 },
    { path: ["finding", "ci_upper"], label: "ci_upper", tol: 0.02 },
    { path: ["finding", "p_value"], label: "p_value", tol: 0.005 },
    { path: ["finding", "sensitivity"], label: "sensitivity", tol: 0.02 },
    { path: ["finding", "specificity"], label: "specificity", tol: 0.02 },
    { path: ["finding", "ppv"], label: "ppv", tol: 0.02 },
    { path: ["finding", "npv"], label: "npv", tol: 0.02 },
  ];
  for (const { path: p, label, tol } of numFields) {
    const cVal = p.reduce((o, k) => o?.[k], claude);
    const gVal = p.reduce((o, k) => o?.[k], gpt);
    // Only count if at least one side has a non-null, non-undefined value
    if (cVal != null || gVal != null) {
      total++;
      if (numericMatch(cVal, gVal, tol)) {
        points++;
      } else {
        disagreements.push(
          `${label}: claude=${cVal} vs gpt=${gVal}`
        );
      }
    }
  }

  // --- Description match (fuzzy) ---
  total++;
  const cDesc = claude?.finding?.description;
  const gDesc = gpt?.finding?.description;
  if (descriptionMatch(cDesc, gDesc)) {
    points++;
  } else {
    disagreements.push("description: low term overlap");
  }

  // --- Endpoint match ---
  total++;
  if (categoricalMatch(claude?.finding?.endpoint, gpt?.finding?.endpoint)) {
    points++;
  } else {
    disagreements.push(
      `endpoint: claude=${claude?.finding?.endpoint} vs gpt=${gpt?.finding?.endpoint}`
    );
  }

  return { score: total > 0 ? points / total : 0, disagreements };
}

/**
 * Find Claude claims for a given PMID by scanning all claims JSON files.
 */
function findClaudeClaims(pmid) {
  const claimsDir = path.join(ROOT, "evidence", "claims");
  if (!fs.existsSync(claimsDir)) return [];

  const files = fs
    .readdirSync(claimsDir)
    .filter((f) => f.endsWith(".json"));

  const matched = [];
  for (const file of files) {
    const data = JSON.parse(
      fs.readFileSync(path.join(claimsDir, file), "utf-8")
    );
    const claims = Array.isArray(data) ? data : data.claims ?? [];
    for (const claim of claims) {
      if (String(claim?.source?.pmid) === String(pmid)) {
        matched.push(claim);
      }
    }
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Main diff logic (exported for programmatic use)
// ---------------------------------------------------------------------------

/**
 * @param {string} pmid
 * @param {object[]} [gptClaims] — if omitted, reads from verification file
 */
export async function diffClaims(pmid, gptClaims) {
  // Load Claude claims
  const claudeClaims = findClaudeClaims(pmid);
  if (claudeClaims.length === 0) {
    console.warn(
      `No Claude claims found for PMID ${pmid} in evidence/claims/*.json`
    );
  }

  // Load GPT claims if not passed directly
  if (!gptClaims) {
    const gptPath = path.join(
      ROOT,
      "evidence",
      "meta",
      "verification",
      `${pmid}-gpt4o.json`
    );
    if (!fs.existsSync(gptPath)) {
      console.error(
        `GPT claims not found: ${gptPath}\nRun verify-claims.js first, or pass claims programmatically.`
      );
      process.exit(1);
    }
    gptClaims = JSON.parse(fs.readFileSync(gptPath, "utf-8"));
  }

  console.log(
    `Comparing ${claudeClaims.length} Claude claims vs ${gptClaims.length} GPT claims for PMID ${pmid}`
  );

  const MATCH_THRESHOLD = 0.6; // minimum score to consider a pair matched
  const AGREE_THRESHOLD = 0.85; // score above which we call it "agreed"

  const usedGptIndices = new Set();
  const agreed = [];
  const disputed = [];

  // For each Claude claim, find the best-matching GPT claim
  for (const cClaim of claudeClaims) {
    let bestScore = -1;
    let bestIdx = -1;
    let bestResult = null;

    for (let gi = 0; gi < gptClaims.length; gi++) {
      if (usedGptIndices.has(gi)) continue;
      const result = scorePair(cClaim, gptClaims[gi]);
      if (result.score > bestScore) {
        bestScore = result.score;
        bestIdx = gi;
        bestResult = result;
      }
    }

    if (bestIdx >= 0 && bestScore >= MATCH_THRESHOLD) {
      usedGptIndices.add(bestIdx);
      if (bestScore >= AGREE_THRESHOLD) {
        agreed.push({ claude: cClaim, gpt: gptClaims[bestIdx], score: bestScore });
      } else {
        disputed.push({
          type: "disagreement",
          pmid,
          score: bestScore,
          disagreements: bestResult.disagreements,
          claude_claim: cClaim,
          gpt_claim: gptClaims[bestIdx],
        });
      }
    } else {
      // Unmatched Claude claim
      disputed.push({
        type: "unmatched_claude",
        pmid,
        score: bestScore > 0 ? bestScore : null,
        disagreements: ["No matching GPT claim found"],
        claude_claim: cClaim,
        gpt_claim: null,
      });
    }
  }

  // Unmatched GPT claims
  const unmatchedGpt = [];
  for (let gi = 0; gi < gptClaims.length; gi++) {
    if (!usedGptIndices.has(gi)) {
      unmatchedGpt.push({
        type: "unmatched_gpt",
        pmid,
        score: null,
        disagreements: ["No matching Claude claim found"],
        claude_claim: null,
        gpt_claim: gptClaims[gi],
      });
    }
  }

  const allDisputed = [...disputed, ...unmatchedGpt];

  // --- Update Claude claims with verification status ---
  const today = new Date().toISOString().slice(0, 10);
  const agreedIds = new Set(agreed.map((a) => a.claude.id));

  // Update claims files in place
  const claimsDir = path.join(ROOT, "evidence", "claims");
  if (fs.existsSync(claimsDir)) {
    const files = fs.readdirSync(claimsDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const filePath = path.join(claimsDir, file);
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const claims = Array.isArray(data) ? data : data.claims ?? [];
      let modified = false;

      for (const claim of claims) {
        if (
          String(claim?.source?.pmid) === String(pmid) &&
          agreedIds.has(claim.id)
        ) {
          claim.verification = {
            agreement: true,
            verified_by: "gpt-4o",
            verified_date: today,
          };
          modified = true;
        }
      }

      if (modified) {
        const output = Array.isArray(data) ? claims : { ...data, claims };
        fs.writeFileSync(filePath, JSON.stringify(output, null, 2) + "\n");
        console.log(`Updated verification in ${file}`);
      }
    }
  }

  // --- Write disputes ---
  const metaDir = path.join(ROOT, "evidence", "meta");
  fs.mkdirSync(metaDir, { recursive: true });
  const disputesPath = path.join(metaDir, "disputes.json");

  let existingDisputes = [];
  if (fs.existsSync(disputesPath)) {
    try {
      existingDisputes = JSON.parse(fs.readFileSync(disputesPath, "utf-8"));
      if (!Array.isArray(existingDisputes)) existingDisputes = [];
    } catch {
      existingDisputes = [];
    }
  }

  // Remove old disputes for this PMID, then add new ones
  existingDisputes = existingDisputes.filter(
    (d) => String(d.pmid) !== String(pmid)
  );
  existingDisputes.push(...allDisputed);
  fs.writeFileSync(
    disputesPath,
    JSON.stringify(existingDisputes, null, 2) + "\n"
  );

  // --- Summary ---
  const unmatchedClaudeCount = disputed.filter(
    (d) => d.type === "unmatched_claude"
  ).length;
  const disagreementCount = disputed.filter(
    (d) => d.type === "disagreement"
  ).length;

  console.log("\n=== Verification Summary ===");
  console.log(`Agreed:            ${agreed.length}`);
  console.log(`Disputed:          ${disagreementCount}`);
  console.log(`Unmatched (Claude): ${unmatchedClaudeCount}`);
  console.log(`Unmatched (GPT):   ${unmatchedGpt.length}`);
  console.log(`Total disputes written to: ${disputesPath}`);

  return { agreed, disputed: allDisputed };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
const isCLI =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isCLI) {
  const pmid = process.argv[2];
  if (!pmid) {
    console.error("Usage: node evidence/scripts/diff-claims.js <PMID>");
    process.exit(1);
  }
  diffClaims(pmid).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
