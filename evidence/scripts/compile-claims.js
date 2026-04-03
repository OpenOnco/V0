#!/usr/bin/env node
/**
 * compile-claims.js — Bundle all claims into a single importable JS module.
 *
 * Reads evidence/claims/*.json and writes src/config/evidenceClaims.js
 * which exports a flat array of all claims for the frontend query engine.
 *
 * Usage: node evidence/scripts/compile-claims.js
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLAIMS_DIR = resolve(__dirname, '..', 'claims');
const OUTPUT_PATH = resolve(__dirname, '..', '..', 'src', 'config', 'evidenceClaims.js');

function loadAllClaims() {
  const files = readdirSync(CLAIMS_DIR).filter(f => f.endsWith('.json'));
  const claims = [];

  for (const file of files) {
    const raw = readFileSync(resolve(CLAIMS_DIR, file), 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      claims.push(...parsed);
    } else {
      claims.push(parsed);
    }
  }

  return claims;
}

function compile() {
  const claims = loadAllClaims();

  // Collect test name → test_id mappings for the router prompt
  const testMap = {};
  for (const claim of claims) {
    if (claim.scope?.tests) {
      for (const t of claim.scope.tests) {
        testMap[t.test_name] = t.test_id;
      }
    }
  }

  const output = `/**
 * Compiled evidence claims for the frontend query engine.
 *
 * AUTO-GENERATED — do not edit manually.
 * Source: evidence/claims/*.json
 * Generated: ${new Date().toISOString().split('T')[0]}
 * Total claims: ${claims.length}
 *
 * To regenerate: node evidence/scripts/compile-claims.js
 */

export const EVIDENCE_CLAIMS = ${JSON.stringify(claims, null, 2)};

/**
 * Test name → test_id mappings extracted from claims.
 * Used by the LLM router to resolve test names to IDs.
 */
export const TEST_NAME_MAP = ${JSON.stringify(testMap, null, 2)};

/**
 * All cancer types present in the claims store.
 */
export const CANCER_TYPES = ${JSON.stringify([...new Set(claims.map(c => c.scope?.cancer).filter(Boolean))].sort())};

/**
 * Claim type counts for display.
 */
export const CLAIM_STATS = {
  total: ${claims.length},
  byCancer: ${JSON.stringify(
    claims.reduce((acc, c) => {
      const cancer = c.scope?.cancer || 'unknown';
      acc[cancer] = (acc[cancer] || 0) + 1;
      return acc;
    }, {})
  )},
  byType: ${JSON.stringify(
    claims.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {})
  )},
  verified: ${claims.filter(c => c.verification?.agreement).length},
  sources: ${new Set(claims.map(c => c.source?.pmid).filter(Boolean)).size},
};
`;

  writeFileSync(OUTPUT_PATH, output);
  console.log(`Compiled ${claims.length} claims → ${OUTPUT_PATH}`);
  console.log(`Test mappings: ${Object.keys(testMap).length}`);
  console.log(`Cancer types: ${[...new Set(claims.map(c => c.scope?.cancer).filter(Boolean))].join(', ')}`);
}

compile();
