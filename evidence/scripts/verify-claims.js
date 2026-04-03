#!/usr/bin/env node

/**
 * verify-claims.js
 *
 * Cross-model verification: sends a paper to GPT-4o with the same extraction
 * prompt used by Claude, then diffs the two sets of claims.
 *
 * Usage: node evidence/scripts/verify-claims.js <PMID>
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { diffClaims } from "./diff-claims.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

// ---------------------------------------------------------------------------
// Extraction prompt — mirrors the one used by Claude in extract-claims.js
// ---------------------------------------------------------------------------
const TODAY = new Date().toISOString().slice(0, 10);

function buildExtractionPrompt(paperText, sourceMetadata) {
  return `You are an expert oncology evidence extractor. Your task is to extract ALL verifiable structured claims from the following paper.

## Source Metadata
${JSON.stringify(sourceMetadata, null, 2)}

## Instructions

1. Extract ALL quantitative claims: endpoints, hazard ratios, odds ratios, relative risks, sample sizes, sensitivity, specificity, PPV, NPV, confidence intervals, p-values, follow-up durations.
2. Extract qualitative claims ONLY for guideline positions or clinical consensus statements.
3. Each claim must be self-contained and verifiable against the source text.
4. For each claim, include a \`source_quote\` field with the exact sentence(s) from the paper supporting it.

## Claim Schema

Each claim must follow this structure:
\`\`\`json
{
  "id": "PLACEHOLDER",
  "type": "trial_result|guideline_recommendation|diagnostic_performance|clinical_utility|methodology_note",
  "source": {
    "pmid": "${sourceMetadata.pmid || ''}",
    "title": "${sourceMetadata.title || ''}",
    "journal": "${sourceMetadata.journal || ''}",
    "year": ${sourceMetadata.year || 'null'},
    "authors_short": "${sourceMetadata.authors_short || ''}",
    "source_type": "${sourceMetadata.source_type || 'journal-article'}",
    "raw_file": "raw/papers/${sourceMetadata.pmid}.md"
  },
  "scope": {
    "cancer": "colorectal|breast|lung|bladder|melanoma|hematologic|cross-cancer",
    "stages": ["II"] or null,
    "setting": "adjuvant|neoadjuvant|surveillance|metastatic|screening" or null,
    "test_category": "MRD|ECD|TDS|HCT" or null
  },
  "finding": {
    "description": "Clear, concise statement of the finding",
    "trial_name": "DYNAMIC" or null,
    "endpoint": "recurrence-free survival" or null,
    "endpoint_type": "primary|secondary|exploratory" or null,
    "result_direction": "non-inferior|superior|inferior|no-difference|positive|negative" or null,
    "n": 455 or null,
    "hr": 0.92 or null,
    "or": null,
    "rr": null,
    "ci_lower": null,
    "ci_upper": null,
    "p_value": null,
    "sensitivity": null,
    "specificity": null,
    "ppv": null,
    "npv": null,
    "follow_up_months": 24 or null,
    "effect_summary": "One-line summary for display" or null,
    "guideline_body": null,
    "recommendation_strength": null,
    "evidence_level": null
  },
  "extraction": {
    "extracted_by": "gpt-4o",
    "extracted_date": "${TODAY}",
    "model_version": "gpt-4o",
    "source_quote_hash": null
  },
  "source_quote": "Exact quote from the paper"
}
\`\`\`

## Cancer Abbreviations
CRC=colorectal, BRC=breast, LNG=lung, BLD=bladder, MEL=melanoma, HEM=hematologic, XCN=cross-cancer

## Trial/Topic Name
Derive a short uppercase identifier from the trial name or paper topic (e.g., DYNAMIC, CIRCULATE, BESPOKE). If no trial name, use a descriptive topic like "CTDNA-META" or "MRD-REVIEW".

## Rules
- Extract ALL quantitative findings — do not skip subgroup analyses or secondary endpoints.
- Use null for any numeric field that is not reported.
- cancer field must be lowercase (e.g. "colorectal", "breast", "lung").
- stages should be an array even if only one stage (e.g. ["II"]).
- If a trial is not named, use null for trial_name.
- Return ONLY the JSON array. No markdown fences, no commentary.

## Paper Text

${paperText}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const pmid = process.argv[2];
  if (!pmid) {
    console.error("Usage: node evidence/scripts/verify-claims.js <PMID>");
    process.exit(1);
  }

  // 1. Read the paper
  const paperPath = path.join(ROOT, "evidence", "raw", "papers", `${pmid}.md`);
  if (!fs.existsSync(paperPath)) {
    console.error(`Paper not found: ${paperPath}`);
    process.exit(1);
  }
  const paperText = fs.readFileSync(paperPath, "utf-8");
  console.log(`Read paper ${pmid} (${paperText.length} chars)`);

  // 2. Read source metadata (same as extract-claims.js)
  const sourcesPath = path.join(ROOT, "evidence", "meta", "sources.json");
  let sourceMeta = { pmid, source_type: "journal-article" };
  if (fs.existsSync(sourcesPath)) {
    try {
      const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf-8"));
      const found = Array.isArray(sources)
        ? sources.find((s) => String(s.pmid) === String(pmid))
        : sources[pmid];
      if (found) sourceMeta = found;
    } catch {
      // use default metadata
    }
  }

  // 3. Call GPT-4o
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not set");
    process.exit(1);
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log("Sending to GPT-4o for extraction...");
  const startTime = Date.now();
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 8192,
    messages: [
      {
        role: "system",
        content:
          "You are an expert oncology evidence extraction engine. Return only valid JSON arrays.",
      },
      { role: "user", content: buildExtractionPrompt(paperText, sourceMeta) },
    ],
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`GPT-4o response received in ${elapsed}s`);

  const rawContent = response.choices[0].message.content.trim();

  // Parse — strip markdown fences if GPT wraps them despite instructions
  let jsonStr = rawContent;
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let gptClaims;
  try {
    gptClaims = JSON.parse(jsonStr);
  } catch (err) {
    console.error("Failed to parse GPT response as JSON:");
    console.error(rawContent.slice(0, 500));
    process.exit(1);
  }

  if (!Array.isArray(gptClaims)) {
    console.error("GPT response is not an array");
    process.exit(1);
  }

  console.log(`GPT-4o extracted ${gptClaims.length} claims`);

  // 3. Save GPT claims to a temporary verification file
  const verifyDir = path.join(ROOT, "evidence", "meta", "verification");
  fs.mkdirSync(verifyDir, { recursive: true });
  const gptClaimsPath = path.join(verifyDir, `${pmid}-gpt4o.json`);
  fs.writeFileSync(gptClaimsPath, JSON.stringify(gptClaims, null, 2));
  console.log(`Saved GPT claims to ${gptClaimsPath}`);

  // 4. Run the diff
  console.log("\n--- Running claim diff ---\n");
  await diffClaims(pmid, gptClaims);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
