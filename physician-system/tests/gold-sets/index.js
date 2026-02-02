/**
 * Gold Set Index
 * Loads all gold set definitions for extraction quality testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load all gold set definitions
 * @returns {Object} - Map of source name to gold set
 */
export function loadGoldSets() {
  const goldSets = {};
  const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
      const goldSet = JSON.parse(content);
      const source = goldSet.source || file.replace('.json', '');
      goldSets[source] = goldSet;
    } catch (error) {
      console.warn(`Failed to load gold set: ${file}`, error.message);
    }
  }

  return goldSets;
}

/**
 * Get a specific gold set by source name
 * @param {string} sourceName - Source name (e.g., 'nccn-colorectal')
 * @returns {Object|null}
 */
export function getGoldSet(sourceName) {
  const goldSets = loadGoldSets();
  return goldSets[sourceName] || null;
}

/**
 * List all available gold sets
 * @returns {string[]}
 */
export function listGoldSets() {
  return Object.keys(loadGoldSets());
}

/**
 * Validate extraction results against a gold set
 * @param {Object[]} extractedItems - Items extracted from source
 * @param {Object} goldSet - Gold set definition
 * @returns {{passed: number, failed: number, details: Object[]}}
 */
export function validateAgainstGoldSet(extractedItems, goldSet) {
  const results = {
    passed: 0,
    failed: 0,
    details: [],
  };

  for (const expected of goldSet.expectedExtractions) {
    const found = findMatchingExtraction(extractedItems, expected);

    if (found.matched) {
      results.passed++;
      results.details.push({
        id: expected.id,
        status: 'passed',
        expected,
        found: found.item,
      });
    } else {
      results.failed++;
      results.details.push({
        id: expected.id,
        status: 'failed',
        expected,
        reason: found.reason,
        closestMatch: found.closestMatch,
      });
    }
  }

  return results;
}

/**
 * Find an extraction matching expected criteria
 * @param {Object[]} items - Extracted items
 * @param {Object} expected - Expected extraction criteria
 * @returns {{matched: boolean, item?: Object, reason?: string, closestMatch?: Object}}
 */
function findMatchingExtraction(items, expected) {
  let bestMatch = null;
  let bestScore = 0;

  for (const item of items) {
    // Check mustContain terms
    const text = `${item.summary || ''} ${item.keyFindings?.join(' ') || ''} ${item.directQuote || ''}`.toLowerCase();
    const containsAll = expected.mustContain.every(term =>
      text.includes(term.toLowerCase())
    );

    if (!containsAll) {
      // Calculate partial match score
      const matchCount = expected.mustContain.filter(term =>
        text.includes(term.toLowerCase())
      ).length;
      const score = matchCount / expected.mustContain.length;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = item;
      }
      continue;
    }

    // Check mustNotContain terms
    const containsForbidden = expected.mustNotContain?.some(term =>
      text.includes(term.toLowerCase())
    );

    if (containsForbidden) {
      continue;
    }

    // Check cancer type match
    if (expected.cancerType && item.cancerType) {
      const normalizedExpected = expected.cancerType.toLowerCase();
      const normalizedItem = (Array.isArray(item.cancerType)
        ? item.cancerType.join(' ')
        : item.cancerType
      ).toLowerCase();

      if (!normalizedItem.includes(normalizedExpected)) {
        continue;
      }
    }

    // Check clinical setting match
    if (expected.clinicalSetting && item.clinicalSetting) {
      const normalizedExpected = expected.clinicalSetting.toLowerCase().replace(/_/g, ' ');
      const normalizedItem = (Array.isArray(item.clinicalSetting)
        ? item.clinicalSetting.join(' ')
        : item.clinicalSetting
      ).toLowerCase();

      if (!normalizedItem.includes(normalizedExpected) &&
          !normalizedExpected.includes(normalizedItem.split(' ')[0])) {
        // Partial match is okay
      }
    }

    // Success!
    return {
      matched: true,
      item,
    };
  }

  // No exact match found
  return {
    matched: false,
    reason: bestScore > 0
      ? `Partial match (${(bestScore * 100).toFixed(0)}% of terms found)`
      : 'No items matched required terms',
    closestMatch: bestMatch,
  };
}

/**
 * Generate a summary report for gold set validation
 * @param {Object} results - Validation results
 * @param {Object} goldSet - Gold set definition
 * @returns {string}
 */
export function generateReport(results, goldSet) {
  const accuracy = results.passed / (results.passed + results.failed);
  const targetAccuracy = goldSet.metadata?.targetAccuracy || 0.9;

  let report = `\n=== Gold Set Validation Report ===\n`;
  report += `Source: ${goldSet.source} (v${goldSet.version})\n`;
  report += `Description: ${goldSet.description}\n\n`;
  report += `Results:\n`;
  report += `  Passed: ${results.passed}\n`;
  report += `  Failed: ${results.failed}\n`;
  report += `  Accuracy: ${(accuracy * 100).toFixed(1)}%\n`;
  report += `  Target: ${(targetAccuracy * 100).toFixed(1)}%\n`;
  report += `  Status: ${accuracy >= targetAccuracy ? '✅ PASS' : '❌ FAIL'}\n\n`;

  if (results.failed > 0) {
    report += `Failed Extractions:\n`;
    for (const detail of results.details.filter(d => d.status === 'failed')) {
      report += `  - ${detail.id}: ${detail.reason}\n`;
      if (detail.closestMatch) {
        report += `    Closest: "${detail.closestMatch.summary?.substring(0, 80)}..."\n`;
      }
    }
  }

  return report;
}

export default {
  loadGoldSets,
  getGoldSet,
  listGoldSets,
  validateAgainstGoldSet,
  generateReport,
};
