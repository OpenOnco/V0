#!/usr/bin/env node

/**
 * extract-claims.js
 *
 * Extracts structured claims from a paper using the Claude API.
 *
 * Usage:
 *   node evidence/scripts/extract-claims.js 35657320
 *
 * Reads:    evidence/raw/papers/{pmid}.md
 *           evidence/meta/sources.json
 * Writes:   evidence/claims/{cancer}.json
 *           evidence/meta/extraction-log.json
 */

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE_DIR = path.resolve(__dirname, '..');

const MODEL = 'claude-sonnet-4-20250514';
const TODAY = new Date().toISOString().slice(0, 10);

const CANCER_ABBREVS = {
  colorectal: 'CRC',
  breast: 'BRC',
  lung: 'LNG',
  bladder: 'BLD',
  melanoma: 'MEL',
  hematologic: 'HEM',
  'cross-cancer': 'XCN',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256First8(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
}

async function readJSON(filePath) {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJSON(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function isDuplicate(existing, incoming) {
  if (existing.source?.pmid !== incoming.source?.pmid) return false;
  // Simple similarity: exact description match or very close
  const a = existing.finding?.description?.toLowerCase().trim();
  const b = incoming.finding?.description?.toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b) return true;
  // Check if >80% of words overlap
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union > 0 && intersection / union > 0.8;
}

function buildNextId(existingClaims, cancerAbbrev, trialOrTopic) {
  const prefix = `${cancerAbbrev}-${trialOrTopic}`;
  const existing = existingClaims
    .filter((c) => c.id.startsWith(prefix))
    .map((c) => {
      const num = parseInt(c.id.split('-').pop(), 10);
      return isNaN(num) ? 0 : num;
    });
  const maxNum = existing.length > 0 ? Math.max(...existing) : 0;
  return (seq) => `${prefix}-${String(maxNum + seq).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Extraction prompt
// ---------------------------------------------------------------------------

function buildExtractionPrompt(paperText, sourceMetadata) {
  return `You are an expert oncology evidence extractor. Your task is to extract ALL verifiable structured claims from the following paper.

## Source Metadata
${JSON.stringify(sourceMetadata, null, 2)}

## Instructions

1. Extract ALL quantitative claims: endpoints, hazard ratios, odds ratios, relative risks, sample sizes, sensitivity, specificity, PPV, NPV, confidence intervals, p-values, follow-up durations.
2. Extract qualitative claims ONLY for guideline positions or clinical consensus statements.
3. Each claim must be self-contained and verifiable against the source text.
4. For each claim, include a \`source_quote\` field with the exact sentence(s) from the paper supporting it. This will be hashed for traceability.
5. Assess your confidence in each extraction (0.0-1.0) and include as \`extraction_confidence\`.

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
    "extracted_by": "claude",
    "extracted_date": "${TODAY}",
    "model_version": "${MODEL}",
    "source_quote_hash": "first 8 chars of SHA-256 of source_quote"
  },
  "source_quote": "Exact quote from the paper",
  "extraction_confidence": 0.95
}
\`\`\`

## Example

For a paper about the DYNAMIC trial in stage II colorectal cancer:
\`\`\`json
[
  {
    "id": "PLACEHOLDER",
    "type": "trial_result",
    "source": { "pmid": "35657320", "title": "Circulating Tumor DNA Analysis Guiding Adjuvant Therapy in Stage II Colon Cancer", "journal": "NEJM", "year": 2022, "authors_short": "Tie et al.", "source_type": "journal-article", "raw_file": "raw/papers/35657320.md" },
    "scope": { "cancer": "colorectal", "stages": ["II"], "setting": "adjuvant", "test_category": "MRD" },
    "finding": { "description": "ctDNA-guided treatment reduced adjuvant chemotherapy use without compromising recurrence-free survival compared to standard management", "trial_name": "DYNAMIC", "endpoint": "recurrence-free survival", "endpoint_type": "primary", "result_direction": "non-inferior", "n": 455, "hr": 0.96, "ci_lower": 0.51, "ci_upper": 1.82, "p_value": null, "follow_up_months": 37, "effect_summary": "ctDNA-guided approach non-inferior for 3-year RFS (93.5% vs 92.4%)" },
    "extraction": { "extracted_by": "claude", "extracted_date": "${TODAY}", "model_version": "${MODEL}", "source_quote_hash": "a1b2c3d4" },
    "source_quote": "The 3-year recurrence-free survival was 93.5% in the ctDNA-guided group and 92.4% in the standard-management group.",
    "extraction_confidence": 0.97
  }
]
\`\`\`

## Claim ID

Use "PLACEHOLDER" for the id field. IDs will be assigned after extraction.

## Cancer Abbreviations
CRC=colorectal, BRC=breast, LNG=lung, BLD=bladder, MEL=melanoma, HEM=hematologic, XCN=cross-cancer

## Trial/Topic Name
Derive a short uppercase identifier from the trial name or paper topic (e.g., DYNAMIC, CIRCULATE, BESPOKE). If no trial name, use a descriptive topic like "CTDNA-META" or "MRD-REVIEW". Include this as a separate \`trial_or_topic\` field at the top level for ID generation.

## Output

Return a JSON array ONLY. No markdown fences, no commentary. Each element is a claim object as described above. Include the extra fields \`source_quote\`, \`extraction_confidence\`, and \`trial_or_topic\` which will be processed and removed before storage.

## Paper Text

${paperText}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const pmid = process.argv[2];
  if (!pmid) {
    console.error('Usage: node evidence/scripts/extract-claims.js <PMID>');
    process.exit(1);
  }

  // Read paper
  const paperPath = path.join(EVIDENCE_DIR, 'raw', 'papers', `${pmid}.md`);
  if (!existsSync(paperPath)) {
    console.error(`Paper not found: ${paperPath}`);
    process.exit(1);
  }
  const paperText = await readFile(paperPath, 'utf-8');
  console.log(`Read paper: ${paperPath} (${paperText.length} chars)`);

  // Read sources metadata
  const sourcesPath = path.join(EVIDENCE_DIR, 'meta', 'sources.json');
  const sources = (await readJSON(sourcesPath)) || [];
  const sourceMeta = Array.isArray(sources)
    ? sources.find((s) => String(s.pmid) === String(pmid))
    : sources[pmid];

  if (!sourceMeta) {
    console.warn(
      `No metadata found for PMID ${pmid} in sources.json. Using minimal metadata.`
    );
  }

  const metadata = sourceMeta || { pmid, source_type: 'journal-article' };

  // Call Claude API
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY not set. Export it or add to .env file.'
    );
    process.exit(1);
  }

  const client = new Anthropic();
  const prompt = buildExtractionPrompt(paperText, metadata);

  console.log(`Calling ${MODEL} for claim extraction...`);
  const startTime = Date.now();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`API response received in ${elapsed}s`);

  // Parse response
  const responseText = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Strip markdown fences if present
  const jsonText = responseText
    .replace(/^```(?:json)?\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim();

  let rawClaims;
  try {
    rawClaims = JSON.parse(jsonText);
  } catch (e) {
    console.error('Failed to parse Claude response as JSON:');
    console.error(jsonText.slice(0, 500));
    console.error(e.message);
    process.exit(1);
  }

  if (!Array.isArray(rawClaims) || rawClaims.length === 0) {
    console.error('No claims extracted.');
    process.exit(1);
  }

  console.log(`Extracted ${rawClaims.length} raw claims`);

  // Determine cancer type (use first claim's scope)
  const cancerType = rawClaims[0].scope?.cancer || 'cross-cancer';
  const cancerAbbrev = CANCER_ABBREVS[cancerType] || 'XCN';

  // Read existing claims file
  const claimsPath = path.join(EVIDENCE_DIR, 'claims', `${cancerType}.json`);
  const existingClaims = (await readJSON(claimsPath)) || [];

  // Process claims: assign IDs, compute quote hashes, remove temp fields
  const newClaims = [];
  // Group by trial_or_topic
  const topicGroups = {};
  for (const claim of rawClaims) {
    const topic = (claim.trial_or_topic || 'UNKNOWN').toUpperCase().replace(/\s+/g, '-');
    if (!topicGroups[topic]) topicGroups[topic] = [];
    topicGroups[topic].push(claim);
  }

  for (const [topic, claims] of Object.entries(topicGroups)) {
    const nextId = buildNextId(existingClaims, cancerAbbrev, topic);
    let seq = 1;

    for (const claim of claims) {
      // Check for duplicates
      if (existingClaims.some((existing) => isDuplicate(existing, claim))) {
        console.log(`  Skipping duplicate: ${claim.finding?.description?.slice(0, 60)}...`);
        continue;
      }

      // Compute source_quote_hash
      const quoteHash = claim.source_quote
        ? sha256First8(claim.source_quote)
        : null;

      // Build clean claim
      const cleanClaim = {
        id: nextId(seq++),
        type: claim.type,
        source: claim.source,
        scope: claim.scope,
        finding: claim.finding,
        extraction: {
          extracted_by: 'claude',
          extracted_date: TODAY,
          model_version: MODEL,
          source_quote_hash: quoteHash,
        },
      };

      newClaims.push(cleanClaim);
    }
  }

  if (newClaims.length === 0) {
    console.log('No new claims to add (all duplicates).');
    process.exit(0);
  }

  // Merge and write claims
  const mergedClaims = [...existingClaims, ...newClaims];
  await writeJSON(claimsPath, mergedClaims);
  console.log(
    `Wrote ${newClaims.length} new claims to ${claimsPath} (${mergedClaims.length} total)`
  );

  // Append to extraction log
  const logPath = path.join(EVIDENCE_DIR, 'meta', 'extraction-log.json');
  const log = (await readJSON(logPath)) || [];
  log.push({
    pmid,
    cancer_type: cancerType,
    claims_extracted: rawClaims.length,
    claims_added: newClaims.length,
    claims_skipped_duplicate: rawClaims.length - newClaims.length,
    model: MODEL,
    extracted_date: TODAY,
    elapsed_seconds: parseFloat(elapsed),
    claim_ids: newClaims.map((c) => c.id),
  });
  await writeJSON(logPath, log);
  console.log(`Updated extraction log: ${logPath}`);

  // Summary
  console.log('\n--- Extraction Summary ---');
  console.log(`PMID:       ${pmid}`);
  console.log(`Cancer:     ${cancerType} (${cancerAbbrev})`);
  console.log(`Extracted:  ${rawClaims.length} claims`);
  console.log(`Added:      ${newClaims.length} new claims`);
  console.log(`Duplicates: ${rawClaims.length - newClaims.length} skipped`);
  console.log(`Output:     ${claimsPath}`);
  for (const claim of newClaims) {
    console.log(`  ${claim.id}: ${claim.finding.description.slice(0, 80)}`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
