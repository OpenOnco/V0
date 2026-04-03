#!/usr/bin/env node
/**
 * seed-from-faq.js — One-time script to extract claims from existing physicianFAQ.js
 *
 * Reads physicianFAQ.js and expertInsights.js, uses Claude API to decompose
 * each answer into atomic, structured claims in the evidence store format.
 *
 * Usage: node evidence/scripts/seed-from-faq.js
 *   --dry-run    Print claims to stdout instead of writing files
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const EVIDENCE_DIR = resolve(__dirname, '..');
const CLAIMS_DIR = resolve(EVIDENCE_DIR, 'claims');
const META_DIR = resolve(EVIDENCE_DIR, 'meta');

const DRY_RUN = process.argv.includes('--dry-run');

// Cancer type → abbreviation for claim IDs
const CANCER_ABBREV = {
  colorectal: 'CRC',
  breast: 'BRC',
  lung: 'LNG',
  bladder: 'BLD',
  melanoma: 'MEL',
  _default: 'XCN',
};

// Cancer type → claims filename
const CANCER_FILE = {
  colorectal: 'colorectal.json',
  breast: 'breast.json',
  lung: 'lung.json',
  bladder: 'bladder.json',
  melanoma: 'melanoma.json',
  _default: 'cross-cancer.json',
};

const CLAIM_SCHEMA = `
Each claim must be a JSON object with this structure:
{
  "id": "{ABBREV}-{TOPIC}-{NNN}",
  "type": "trial_result | guideline_recommendation | diagnostic_performance | clinical_utility | methodology_note",
  "source": {
    "pmid": "string or null",
    "title": "paper/guideline title",
    "journal": "journal name or null",
    "year": number,
    "authors_short": "First Author et al.",
    "source_type": "journal-article | conference-abstract | clinical-guideline",
    "url": "URL if no PMID"
  },
  "scope": {
    "cancer": "colorectal | breast | lung | bladder | melanoma | cross-cancer",
    "stages": ["I", "II", "III", "IV"] or null,
    "setting": "adjuvant | neoadjuvant | surveillance | metastatic | screening | null",
    "test_category": "MRD | ECD | TDS | HCT"
  },
  "finding": {
    "description": "One-sentence summary of the verifiable finding",
    "trial_name": "DYNAMIC, GALAXY, etc. or null",
    "endpoint": "RFS, DFS, OS, etc. or null",
    "endpoint_type": "primary | secondary | exploratory | null",
    "result_direction": "superior | non-inferior | inferior | no-difference | null",
    "n": number or null,
    "hr": number or null,
    "ci_lower": number or null,
    "ci_upper": number or null,
    "p_value": number or null,
    "follow_up_months": number or null,
    "effect_summary": "Brief quantitative summary"
  },
  "extraction": {
    "extracted_by": "claude",
    "extracted_date": "${new Date().toISOString().split('T')[0]}",
    "model_version": "claude-sonnet-4-20250514",
    "seed_source": "physicianFAQ.js"
  }
}

Cancer abbreviations: CRC (colorectal), BRC (breast), LNG (lung), BLD (bladder), MEL (melanoma), XCN (cross-cancer/default)
`;

const EXTRACTION_PROMPT = `You are extracting structured, atomic evidence claims from existing physician FAQ content.

For each piece of clinical evidence mentioned in the text below, create a separate claim object. Each claim should represent ONE verifiable finding — a single trial result, a single guideline recommendation, or a single diagnostic performance metric.

Rules:
1. Extract ALL quantitative claims: hazard ratios, sample sizes, p-values, sensitivity/specificity, median follow-up, etc.
2. Extract guideline positions as separate claims (type: guideline_recommendation)
3. Each claim must be traceable to a specific source (PMID, URL, or guideline version)
4. If a source is mentioned but you can't determine the PMID, use url or set pmid to null
5. Do NOT combine multiple findings into one claim — split them
6. Do NOT fabricate any data. Only extract what is explicitly stated in the text
7. For the sources array provided with each FAQ answer, use those to populate the source field
8. Generate sequential IDs using the cancer abbreviation: e.g., CRC-DYNAMIC-001, CRC-GALAXY-001

${CLAIM_SCHEMA}

Return a JSON array of claims. No markdown, no explanation — just the JSON array.`;

async function extractClaimsForCancer(client, cancerType, faqData) {
  const abbrev = CANCER_ABBREV[cancerType] || 'XCN';
  const concerns = Object.entries(faqData);

  // Build the full text for this cancer type
  let fullText = `Cancer type: ${cancerType}\nAbbreviation for IDs: ${abbrev}\n\n`;

  for (const [concernId, answer] of concerns) {
    fullText += `--- Concern: ${concernId} ---\n`;
    fullText += `forDoctor: ${answer.forDoctor}\n`;
    if (answer.stageNotes) {
      for (const [stage, note] of Object.entries(answer.stageNotes)) {
        fullText += `stageNote (${stage}): ${note}\n`;
      }
    }
    if (answer.guidelines) {
      fullText += `guidelines: ${answer.guidelines}\n`;
    }
    if (answer.sources) {
      fullText += `sources: ${JSON.stringify(answer.sources)}\n`;
    }
    fullText += '\n';
  }

  console.log(`Extracting claims for ${cancerType}...`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `${EXTRACTION_PROMPT}\n\n---\n\n${fullText}`,
      },
    ],
  });

  const text = response.content[0].text.trim();

  // Parse JSON — handle potential markdown wrapping
  let jsonStr = text;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const claims = JSON.parse(jsonStr);
    console.log(`  → ${claims.length} claims extracted for ${cancerType}`);
    return claims;
  } catch (err) {
    console.error(`  ✗ Failed to parse claims for ${cancerType}: ${err.message}`);
    console.error(`  Raw response (first 500 chars): ${text.slice(0, 500)}`);
    return [];
  }
}

async function extractExpertInsightClaims(client) {
  // Expert insights are methodology notes — not cancer-specific
  const expertInsightsPath = resolve(ROOT, 'src/config/expertInsights.js');
  const content = readFileSync(expertInsightsPath, 'utf-8');

  // Extract the object content between the export and closing brace
  const insightText = content;

  console.log('Extracting claims from expertInsights.js...');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Extract methodology_note type claims from these expert insights about MRD testing interpretation.

Each insight should become one claim with:
- type: "methodology_note"
- scope.cancer: "cross-cancer" (these are general principles)
- scope.test_category: "MRD"
- finding.description: The key insight
- source: { source_type: "expert-panel", title: "OpenOnco Expert Advisory Panel", authors_short: the experts field }
- ID format: XCN-METHOD-{NNN}

Note: source_type "expert-panel" is a special case for seeded content only. Future claims must use peer-reviewed sources.

${CLAIM_SCHEMA}

Return a JSON array of claims. No markdown — just JSON.

---

${insightText}`,
      },
    ],
  });

  const text = response.content[0].text.trim();
  let jsonStr = text;
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const claims = JSON.parse(jsonStr);
    console.log(`  → ${claims.length} methodology claims extracted`);
    return claims;
  } catch (err) {
    console.error(`  ✗ Failed to parse expert insight claims: ${err.message}`);
    return [];
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable required');
    process.exit(1);
  }

  const client = new Anthropic();

  // Import FAQ data dynamically
  const faqModule = await import(resolve(ROOT, 'src/config/physicianFAQ.js'));
  const faqData = faqModule.PHYSICIAN_FAQ_DATA;

  // Ensure output directories exist
  if (!DRY_RUN) {
    mkdirSync(CLAIMS_DIR, { recursive: true });
    mkdirSync(META_DIR, { recursive: true });
  }

  const allClaims = {};
  const extractionLog = [];

  // Extract claims for each cancer type
  for (const [cancerType, concerns] of Object.entries(faqData)) {
    const claims = await extractClaimsForCancer(client, cancerType, concerns);
    const filename = CANCER_FILE[cancerType] || 'cross-cancer.json';

    if (!allClaims[filename]) {
      allClaims[filename] = [];
    }
    allClaims[filename].push(...claims);

    extractionLog.push({
      source: 'physicianFAQ.js',
      cancer_type: cancerType,
      claims_extracted: claims.length,
      date: new Date().toISOString(),
      model: 'claude-sonnet-4-20250514',
    });

    // Rate limit between API calls
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Extract expert insight claims
  const expertClaims = await extractExpertInsightClaims(client);
  if (!allClaims['cross-cancer.json']) {
    allClaims['cross-cancer.json'] = [];
  }
  allClaims['cross-cancer.json'].push(...expertClaims);

  extractionLog.push({
    source: 'expertInsights.js',
    cancer_type: 'cross-cancer',
    claims_extracted: expertClaims.length,
    date: new Date().toISOString(),
    model: 'claude-sonnet-4-20250514',
  });

  // Output
  let totalClaims = 0;

  for (const [filename, claims] of Object.entries(allClaims)) {
    totalClaims += claims.length;

    if (DRY_RUN) {
      console.log(`\n=== ${filename} (${claims.length} claims) ===`);
      console.log(JSON.stringify(claims, null, 2));
    } else {
      const filepath = resolve(CLAIMS_DIR, filename);
      writeFileSync(filepath, JSON.stringify(claims, null, 2) + '\n');
      console.log(`Wrote ${claims.length} claims to ${filename}`);
    }
  }

  if (!DRY_RUN) {
    // Write extraction log
    const logPath = resolve(META_DIR, 'extraction-log.json');
    let existingLog = [];
    if (existsSync(logPath)) {
      existingLog = JSON.parse(readFileSync(logPath, 'utf-8'));
    }
    existingLog.push(...extractionLog);
    writeFileSync(logPath, JSON.stringify(existingLog, null, 2) + '\n');

    // Initialize empty files that should exist
    for (const file of ['disputes.json', 'pending-publications.json']) {
      const path = resolve(META_DIR, file);
      if (!existsSync(path)) {
        writeFileSync(path, '[]\n');
      }
    }

    const sourcesPath = resolve(META_DIR, 'sources.json');
    if (!existsSync(sourcesPath)) {
      writeFileSync(sourcesPath, '{}\n');
    }
  }

  console.log(`\nDone! ${totalClaims} total claims extracted.`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
