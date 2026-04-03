#!/usr/bin/env node
/**
 * Render physicianFAQ.js from the evidence claims store.
 *
 * Reads all evidence/claims/*.json files, groups by cancer type and concern,
 * calls Claude to synthesize forPatient/forDoctor prose, and outputs the
 * complete physicianFAQ.js in the exact format consumed by the app.
 *
 * Usage:
 *   node evidence/scripts/render-faq.js             # Write to src/config/physicianFAQ.js
 *   node evidence/scripts/render-faq.js --dry-run    # Output to stdout
 *
 * Environment:
 *   ANTHROPIC_API_KEY — Claude API key
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Anthropic from "@anthropic-ai/sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");
const CLAIMS_DIR = resolve(PROJECT_ROOT, "evidence/claims");
const OUTPUT_PATH = resolve(PROJECT_ROOT, "src/config/physicianFAQ.js");

const MODEL = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Cancer type tiers
// ---------------------------------------------------------------------------

const TIER_1 = ["colorectal", "breast", "lung"];
const TIER_2 = ["bladder", "melanoma"];
const ALL_CANCER_TYPES = [...TIER_1, ...TIER_2];

// Concern categories — hardcoded (not derived from claims)
const CONCERNS = [
  { id: "no-evidence", label: `"There's no evidence MRD results change outcomes."` },
  { id: "not-in-guidelines", label: `"It's not in the guidelines yet."` },
  { id: "what-to-do-positive", label: `"What would I even do with a positive result?"` },
  { id: "insurance", label: `"Insurance won't cover it."`, isWizardLink: true },
  { id: "not-validated", label: `"The test isn't validated for your cancer type."` },
];

// Non-insurance concern IDs (insurance is a wizard link, not generated from claims)
const GENERATED_CONCERNS = ["no-evidence", "not-in-guidelines", "what-to-do-positive", "not-validated"];

// Mapping claim types to concern categories
const CLAIM_TYPE_TO_CONCERN = {
  trial_result: ["no-evidence", "what-to-do-positive"],
  guideline_recommendation: ["not-in-guidelines"],
  diagnostic_performance: ["not-validated"],
  clinical_utility: ["no-evidence", "what-to-do-positive"],
  methodology_note: ["not-validated"],
};

// ---------------------------------------------------------------------------
// Load claims
// ---------------------------------------------------------------------------

function loadClaims() {
  if (!existsSync(CLAIMS_DIR)) {
    console.warn(`Claims directory not found: ${CLAIMS_DIR}`);
    return [];
  }

  const files = readdirSync(CLAIMS_DIR).filter((f) => f.endsWith(".json"));
  const claims = [];

  for (const file of files) {
    try {
      const raw = readFileSync(resolve(CLAIMS_DIR, file), "utf-8");
      const claim = JSON.parse(raw);
      claims.push(claim);
    } catch (err) {
      console.warn(`Skipping ${file}: ${err.message}`);
    }
  }

  return claims;
}

// ---------------------------------------------------------------------------
// Group claims by cancer type and concern
// ---------------------------------------------------------------------------

function groupClaims(claims) {
  // Structure: { colorectal: { 'no-evidence': [claim, ...], ... }, ... }
  const grouped = {};

  for (const type of ALL_CANCER_TYPES) {
    grouped[type] = {};
    for (const concern of GENERATED_CONCERNS) {
      grouped[type][concern] = [];
    }
  }
  grouped["_default"] = {};
  for (const concern of GENERATED_CONCERNS) {
    grouped["_default"][concern] = [];
  }

  for (const claim of claims) {
    const cancer = claim.scope?.cancer;
    const claimType = claim.type;
    const concerns = CLAIM_TYPE_TO_CONCERN[claimType] || [];

    // Determine which cancer type buckets this claim goes into
    const targets = [];
    if (cancer === "cross-cancer") {
      targets.push("_default");
    } else if (cancer && grouped[cancer]) {
      targets.push(cancer);
    } else {
      targets.push("_default");
    }

    for (const target of targets) {
      for (const concern of concerns) {
        if (grouped[target][concern]) {
          grouped[target][concern].push(claim);
        }
      }
    }
  }

  return grouped;
}

// ---------------------------------------------------------------------------
// Extract sources from claims
// ---------------------------------------------------------------------------

function extractSources(claims) {
  const seen = new Set();
  const sources = [];

  for (const claim of claims) {
    const src = claim.source;
    if (!src) continue;

    const key = src.pmid || src.doi || src.title;
    if (seen.has(key)) continue;
    seen.add(key);

    const entry = {};
    const label = [
      src.authors_short,
      src.journal,
      src.year,
      src.title ? `- ${src.title}` : null,
    ]
      .filter(Boolean)
      .join(", ");

    entry.label = label || src.title || "Unknown source";

    if (src.pmid) {
      entry.pmid = src.pmid;
    } else if (src.doi) {
      entry.url = `https://doi.org/${src.doi}`;
    }

    sources.push(entry);
  }

  return sources;
}

// ---------------------------------------------------------------------------
// Extract guidelines text from guideline_recommendation claims
// ---------------------------------------------------------------------------

function extractGuidelines(claims) {
  const guidelineClaims = claims.filter((c) => c.type === "guideline_recommendation");
  if (guidelineClaims.length === 0) return null;

  return guidelineClaims
    .map((c) => {
      const body = c.finding?.guideline_body || "";
      const desc = c.finding?.description || "";
      return body ? `${body}: ${desc}` : desc;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Extract stage-specific claims
// ---------------------------------------------------------------------------

function getStageSpecificClaims(claims) {
  const byStage = {};
  for (const claim of claims) {
    const stages = claim.scope?.stages;
    if (!stages || stages.length === 0) continue;
    for (const stage of stages) {
      const key = `stage-${stage.toLowerCase().replace(/^stage\s*/i, "")}`;
      if (!byStage[key]) byStage[key] = [];
      byStage[key].push(claim);
    }
  }
  return byStage;
}

// ---------------------------------------------------------------------------
// Claude API — synthesize prose
// ---------------------------------------------------------------------------

async function synthesizeProse(client, cancerType, concernId, claims, stageClaimsMap) {
  if (claims.length === 0) {
    return null;
  }

  const claimSummaries = claims.map((c) => {
    const parts = [`- ${c.finding?.description || "No description"}`];
    if (c.finding?.trial_name) parts.push(`  Trial: ${c.finding.trial_name}`);
    if (c.finding?.hr) parts.push(`  HR: ${c.finding.hr}`);
    if (c.finding?.p_value) parts.push(`  P-value: ${c.finding.p_value}`);
    if (c.finding?.n) parts.push(`  N: ${c.finding.n}`);
    if (c.finding?.sensitivity) parts.push(`  Sensitivity: ${c.finding.sensitivity}`);
    if (c.finding?.specificity) parts.push(`  Specificity: ${c.finding.specificity}`);
    if (c.finding?.effect_summary) parts.push(`  Effect: ${c.finding.effect_summary}`);
    if (c.source?.pmid) parts.push(`  PMID: ${c.source.pmid}`);
    if (c.source?.authors_short) parts.push(`  Authors: ${c.source.authors_short}`);
    if (c.source?.journal) parts.push(`  Journal: ${c.source.journal} (${c.source.year || ""})`);
    return parts.join("\n");
  }).join("\n\n");

  const stageInfo = Object.entries(stageClaimsMap)
    .map(([stage, stageClaims]) => {
      const summaries = stageClaims.map((c) =>
        `  - ${c.finding?.description || "No description"} (${c.finding?.trial_name || ""})`
      ).join("\n");
      return `${stage}:\n${summaries}`;
    })
    .join("\n\n");

  const concernLabels = {
    "no-evidence": "There's no evidence MRD results change outcomes",
    "not-in-guidelines": "It's not in the guidelines yet",
    "what-to-do-positive": "What would I even do with a positive result?",
    "not-validated": "The test isn't validated for your cancer type",
  };

  const tierLabel = TIER_1.includes(cancerType) ? "Tier 1 (full detail)"
    : TIER_2.includes(cancerType) ? "Tier 2 (moderate detail)"
    : "Tier 3 (generic fallback)";

  const prompt = `You are writing content for OpenOnco's physician FAQ system. A patient is preparing to ask their oncologist about MRD (molecular residual disease / ctDNA) testing. The physician has expressed the concern: "${concernLabels[concernId]}".

Cancer type: ${cancerType === "_default" ? "generic (any solid tumor)" : cancerType}
Tier: ${tierLabel}

Based on the following evidence claims, write TWO responses:

1. **forPatient** — Plain language, 2-4 sentences. Empathetic, factual, no jargon. Reference specific trials by name when helpful but don't include PMIDs or HRs.

2. **forDoctor** — Clinical language for oncologists. Cite specific trials, HRs, p-values, confidence intervals, and PMIDs where available. Be thorough but concise. Use standard medical abbreviations.

CLAIMS:
${claimSummaries}

${stageInfo ? `STAGE-SPECIFIC EVIDENCE:\n${stageInfo}` : "No stage-specific claims available."}

${stageInfo ? `Also write **stageNotes** — one sentence per stage that has specific evidence. Use the stage keys exactly as: stage-1, stage-2, stage-3, stage-4. Only include stages with evidence.` : ""}

${concernId === "not-in-guidelines" ? "Also write a **guidelines** field — a brief sentence summarizing the current guideline status." : ""}
${concernId === "no-evidence" ? "Also write a **guidelines** field — a brief sentence on guideline status related to evidence." : ""}
${concernId === "not-validated" ? "Also write a **guidelines** field — a brief sentence on validation/coverage status." : ""}
${concernId === "what-to-do-positive" ? "Also write a **guidelines** field — a brief sentence on relevant clinical trials or standard-of-care actions." : ""}

Respond in JSON only. No markdown fences. Structure:
{
  "forPatient": "...",
  "forDoctor": "...",
  "stageNotes": { "stage-2": "...", "stage-3": "..." },
  "guidelines": "..."
}

If no stage notes apply, omit the stageNotes field. If no guidelines text applies, omit it.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0]?.text || "";

  // Parse JSON — handle potential markdown fences
  const cleaned = text.replace(/^```json\s*/m, "").replace(/^```\s*$/m, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error(`Failed to parse Claude response for ${cancerType}/${concernId}:`, text.slice(0, 200));
    return null;
  }
}

// ---------------------------------------------------------------------------
// Build the full FAQ data structure
// ---------------------------------------------------------------------------

async function buildFAQData(claims) {
  const client = new Anthropic();
  const grouped = groupClaims(claims);

  const faqData = {};
  const cancerTypes = [...ALL_CANCER_TYPES, "_default"];

  for (const cancerType of cancerTypes) {
    console.error(`Processing ${cancerType}...`);
    faqData[cancerType] = {};

    for (const concernId of GENERATED_CONCERNS) {
      const concernClaims = grouped[cancerType]?.[concernId] || [];

      // Also include cross-cancer claims for non-default types
      const allClaims = cancerType !== "_default"
        ? [...concernClaims, ...(grouped["_default"]?.[concernId] || [])]
        : concernClaims;

      if (allClaims.length === 0) {
        console.error(`  ${concernId}: no claims, skipping`);
        continue;
      }

      console.error(`  ${concernId}: ${allClaims.length} claims`);

      const stageClaimsMap = getStageSpecificClaims(
        concernClaims.length > 0 ? concernClaims : allClaims
      );

      const prose = await synthesizeProse(client, cancerType, concernId, allClaims, stageClaimsMap);
      if (!prose) continue;

      const entry = {
        forPatient: prose.forPatient,
        forDoctor: prose.forDoctor,
      };

      // Stage notes
      if (prose.stageNotes && Object.keys(prose.stageNotes).length > 0) {
        entry.stageNotes = prose.stageNotes;
      }

      // Sources from the claims
      const sources = extractSources(concernClaims.length > 0 ? concernClaims : allClaims);
      if (sources.length > 0) {
        entry.sources = sources;
      }

      // Guidelines
      const guidelinesFromClaims = extractGuidelines(
        concernClaims.length > 0 ? concernClaims : allClaims
      );
      if (prose.guidelines) {
        entry.guidelines = prose.guidelines;
      } else if (guidelinesFromClaims) {
        entry.guidelines = guidelinesFromClaims;
      }

      faqData[cancerType][concernId] = entry;
    }
  }

  return faqData;
}

// ---------------------------------------------------------------------------
// Render to JS source
// ---------------------------------------------------------------------------

function renderJS(faqData) {
  const lines = [];

  lines.push(`/**`);
  lines.push(` * Physician FAQ — Personalized answers for patient advocacy`);
  lines.push(` *`);
  lines.push(` * Structure: PHYSICIAN_FAQ_DATA[cancerType][concernId] = { ... }`);
  lines.push(` *`);
  lines.push(` * Cancer type tiers:`);
  lines.push(` *   Tier 1 (full): colorectal, breast, lung`);
  lines.push(` *   Tier 2 (moderate): bladder, melanoma`);
  lines.push(` *   Tier 3 (generic): everything else uses '_default'`);
  lines.push(` *`);
  lines.push(` * Stage-specific notes are optional overlays on the base answer.`);
  lines.push(` *`);
  lines.push(` * Generated by: node evidence/scripts/render-faq.js`);
  lines.push(` * Last rendered: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(` */`);
  lines.push(``);

  // CONCERNS array
  lines.push(`export const CONCERNS = [`);
  for (const c of CONCERNS) {
    const labelEsc = c.label.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const extra = c.isWizardLink ? ", isWizardLink: true" : "";
    lines.push(`  { id: '${c.id}', label: '${labelEsc}'${extra} },`);
  }
  lines.push(`];`);
  lines.push(``);

  // getAnswer helper
  lines.push(`// Helper to get the best answer for a cancer type, falling back to _default`);
  lines.push(`export function getAnswer(cancerType, concernId) {`);
  lines.push(`  const typeData = PHYSICIAN_FAQ_DATA[cancerType] || PHYSICIAN_FAQ_DATA['_default'];`);
  lines.push(`  return typeData[concernId] || PHYSICIAN_FAQ_DATA['_default'][concernId];`);
  lines.push(`}`);
  lines.push(``);

  // getStageNote helper
  lines.push(`// Helper to get stage-specific note`);
  lines.push(`export function getStageNote(cancerType, concernId, stage) {`);
  lines.push(`  const answer = getAnswer(cancerType, concernId);`);
  lines.push(`  if (!answer?.stageNotes || !stage) return null;`);
  lines.push(`  return answer.stageNotes[stage] || null;`);
  lines.push(`}`);
  lines.push(``);

  // PHYSICIAN_FAQ_DATA
  lines.push(`export const PHYSICIAN_FAQ_DATA = {`);

  const tierLabels = {
    colorectal: "COLORECTAL — Tier 1 (strongest evidence)",
    breast: "BREAST — Tier 1",
    lung: "LUNG (NSCLC) — Tier 1",
    bladder: "BLADDER — Tier 2",
    melanoma: "MELANOMA — Tier 2",
    _default: "DEFAULT — Tier 3 (generic fallback)",
  };

  const cancerTypes = [...TIER_1, ...TIER_2, "_default"];

  for (const cancerType of cancerTypes) {
    const data = faqData[cancerType];
    if (!data || Object.keys(data).length === 0) continue;

    const label = tierLabels[cancerType] || cancerType.toUpperCase();
    lines.push(``);
    lines.push(`  /* ${"═".repeat(43)}`);
    lines.push(`   *  ${label}`);
    lines.push(`   * ${"═".repeat(43)} */`);
    lines.push(`  ${cancerType === "_default" ? "_default" : cancerType}: {`);

    const concernIds = Object.keys(data);
    for (const concernId of concernIds) {
      const entry = data[concernId];
      lines.push(`    '${concernId}': {`);

      // forPatient
      lines.push(`      forPatient: ${jsString(entry.forPatient)},`);

      // forDoctor
      lines.push(`      forDoctor: ${jsString(entry.forDoctor)},`);

      // stageNotes
      if (entry.stageNotes && Object.keys(entry.stageNotes).length > 0) {
        lines.push(`      stageNotes: {`);
        for (const [stage, note] of Object.entries(entry.stageNotes)) {
          lines.push(`        '${stage}': ${jsString(note)},`);
        }
        lines.push(`      },`);
      }

      // sources
      if (entry.sources && entry.sources.length > 0) {
        lines.push(`      sources: [`);
        for (const src of entry.sources) {
          const parts = [`label: ${jsString(src.label)}`];
          if (src.pmid) parts.push(`pmid: '${src.pmid}'`);
          if (src.url) parts.push(`url: ${jsString(src.url)}`);
          lines.push(`        { ${parts.join(", ")} },`);
        }
        lines.push(`      ],`);
      }

      // guidelines
      if (entry.guidelines) {
        lines.push(`      guidelines: ${jsString(entry.guidelines)},`);
      }

      lines.push(`    },`);
      lines.push(``);
    }

    lines.push(`  },`);
  }

  lines.push(`};`);
  lines.push(``);

  return lines.join("\n");
}

/**
 * Escape a string for JS single-quoted string output.
 * Uses single quotes to match the existing file style.
 */
function jsString(s) {
  if (!s) return "''";
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n");
  return `'${escaped}'`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
    },
    strict: false,
  });

  const dryRun = values["dry-run"];

  // Load claims
  const claims = loadClaims();
  console.error(`Loaded ${claims.length} claims from ${CLAIMS_DIR}`);

  if (claims.length === 0) {
    console.error("No claims found. Cannot generate FAQ data.");
    console.error("Populate evidence/claims/ with claim JSON files first.");
    process.exit(1);
  }

  // Build FAQ data with Claude
  const faqData = await buildFAQData(claims);

  // Render to JS
  const output = renderJS(faqData);

  if (dryRun) {
    process.stdout.write(output);
    console.error("\n[dry-run] Output written to stdout. No file modified.");
  } else {
    writeFileSync(OUTPUT_PATH, output);
    console.error(`\nWritten to ${OUTPUT_PATH}`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
