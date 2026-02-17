/**
 * Deterministic data.js modifier.
 * Applies structured change operations via string search/replace.
 *
 * Design: string manipulation over AST parsing — data.js follows consistent
 * formatting and regex-based find/replace is simpler. If a change cannot be
 * applied (insertion point not found), it returns an error rather than
 * silently failing.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_JS_PATH = resolve(__dirname, '../../src/data.js');

/**
 * Apply a list of change operations to data.js.
 * Returns { success: boolean, applied: number, errors: string[] }
 */
export function applyChanges(changes) {
  let dataJs = readFileSync(DATA_JS_PATH, 'utf-8');
  const errors = [];
  let applied = 0;

  for (const change of changes) {
    try {
      const result = applyOperation(dataJs, change);
      if (result.error) {
        errors.push(`${change.op} (${change.testId || 'N/A'}): ${result.error}`);
      } else {
        dataJs = result.content;
        applied++;
      }
    } catch (err) {
      errors.push(`${change.op} (${change.testId || 'N/A'}): ${err.message}`);
    }
  }

  if (applied > 0) {
    writeFileSync(DATA_JS_PATH, dataJs, 'utf-8');
  }

  return { success: errors.length === 0, applied, errors };
}

/**
 * Apply a single operation, returning { content } or { error }
 */
function applyOperation(content, change) {
  switch (change.op) {
    case 'add_commercial_payer':
      return addCommercialPayer(content, change);
    case 'add_non_coverage':
      return addNonCoverage(content, change);
    case 'update_field':
      return updateField(content, change);
    case 'add_coverage_cross_ref':
      return addCoverageCrossRef(content, change);
    case 'add_changelog':
      return addChangelog(content, change);
    default:
      return { error: `Unknown operation: ${change.op}` };
  }
}

/**
 * Find the line range of a test object by its ID.
 * Returns { startLine, endLine } (0-indexed) or null.
 */
function findTestObject(lines, testId) {
  // Find the "id": "testId" line
  const idPattern = `"id": "${testId}"`;
  let idLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(idPattern)) {
      idLine = i;
      break;
    }
  }

  if (idLine === -1) return null;

  // Scan backward to find the opening { of this object
  let startLine = idLine;
  let braceDepth = 0;
  for (let i = idLine; i >= 0; i--) {
    const line = lines[i];
    for (let j = line.length - 1; j >= 0; j--) {
      if (line[j] === '}') braceDepth++;
      if (line[j] === '{') {
        braceDepth--;
        if (braceDepth < 0) {
          startLine = i;
          // Found the opening brace
          break;
        }
      }
    }
    if (braceDepth < 0) break;
  }

  // Scan forward to find the matching closing }
  let endLine = idLine;
  braceDepth = 0;
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          endLine = i;
          break;
        }
      }
    }
    if (braceDepth === 0 && i > startLine) break;
  }

  return { startLine, endLine };
}

/**
 * Add a payer to the commercialPayers array of a test
 */
function addCommercialPayer(content, { testId, payer, citation, note }) {
  const lines = content.split('\n');
  const range = findTestObject(lines, testId);
  if (!range) return { error: `Test ${testId} not found in data.js` };

  // Find commercialPayers line within the test object
  let payersLine = -1;
  for (let i = range.startLine; i <= range.endLine; i++) {
    if (lines[i].includes('"commercialPayers"')) {
      payersLine = i;
      break;
    }
  }

  if (payersLine === -1) {
    return { error: `commercialPayers field not found for ${testId}` };
  }

  // Check if payer already exists
  if (lines[payersLine].includes(payer)) {
    return { error: `${payer} already in commercialPayers for ${testId}` };
  }

  // Add payer to the array — find the closing bracket
  const oldLine = lines[payersLine];
  const closingBracket = oldLine.lastIndexOf(']');
  if (closingBracket === -1) {
    return { error: `Cannot parse commercialPayers array for ${testId}` };
  }

  // Insert before the closing bracket
  const beforeBracket = oldLine.substring(0, closingBracket).trimEnd();
  const afterBracket = oldLine.substring(closingBracket);
  const separator = beforeBracket.endsWith('[') ? '' : ', ';
  lines[payersLine] = `${beforeBracket}${separator}"${payer}"${afterBracket}`;

  // Update citations if provided
  if (citation) {
    for (let i = payersLine; i <= Math.min(payersLine + 5, range.endLine); i++) {
      if (lines[i].includes('"commercialPayersCitations"')) {
        // Append citation with pipe separator
        const citLine = lines[i];
        const lastQuote = citLine.lastIndexOf('"');
        if (lastQuote > citLine.indexOf('"commercialPayersCitations"') + 30) {
          lines[i] = citLine.substring(0, lastQuote) + ' | ' + citation + citLine.substring(lastQuote);
        }
        break;
      }
    }
  }

  // Update notes if provided
  if (note) {
    for (let i = payersLine; i <= Math.min(payersLine + 5, range.endLine); i++) {
      if (lines[i].includes('"commercialPayersNotes"')) {
        const noteLine = lines[i];
        const lastQuote = noteLine.lastIndexOf('"');
        if (lastQuote > noteLine.indexOf('"commercialPayersNotes"') + 30) {
          lines[i] = noteLine.substring(0, lastQuote) + ' ' + note + noteLine.substring(lastQuote);
        }
        break;
      }
    }
  }

  return { content: lines.join('\n') };
}

/**
 * Add a payer to the commercialPayersNonCoverage array of a test
 */
function addNonCoverage(content, { testId, payer, note }) {
  const lines = content.split('\n');
  const range = findTestObject(lines, testId);
  if (!range) return { error: `Test ${testId} not found in data.js` };

  // Find existing commercialPayersNonCoverage
  let nonCovLine = -1;
  for (let i = range.startLine; i <= range.endLine; i++) {
    if (lines[i].includes('"commercialPayersNonCoverage"')) {
      nonCovLine = i;
      break;
    }
  }

  if (nonCovLine !== -1) {
    // Check for duplicate
    if (lines[nonCovLine].includes(payer)) {
      return { error: `${payer} already in commercialPayersNonCoverage for ${testId}` };
    }

    // Add to existing array
    const oldLine = lines[nonCovLine];
    const closingBracket = oldLine.lastIndexOf(']');
    if (closingBracket === -1) {
      return { error: `Cannot parse commercialPayersNonCoverage array for ${testId}` };
    }
    const beforeBracket = oldLine.substring(0, closingBracket).trimEnd();
    const afterBracket = oldLine.substring(closingBracket);
    const separator = beforeBracket.endsWith('[') ? '' : ', ';
    lines[nonCovLine] = `${beforeBracket}${separator}"${payer}"${afterBracket}`;

    // Update notes
    if (note) {
      for (let i = nonCovLine; i <= Math.min(nonCovLine + 3, range.endLine); i++) {
        if (lines[i].includes('"commercialPayersNonCoverageNotes"')) {
          const noteLine = lines[i];
          const lastQuote = noteLine.lastIndexOf('"');
          lines[i] = noteLine.substring(0, lastQuote) + ' ' + note + noteLine.substring(lastQuote);
          break;
        }
      }
    }
  } else {
    // Need to insert commercialPayersNonCoverage — find insertion point after commercialPayersNotes
    let insertAfter = -1;
    for (let i = range.startLine; i <= range.endLine; i++) {
      if (lines[i].includes('"commercialPayersNotes"') || lines[i].includes('"commercialPayersCitations"')) {
        insertAfter = i;
      }
    }
    if (insertAfter === -1) {
      return { error: `Cannot find insertion point for commercialPayersNonCoverage in ${testId}` };
    }

    const indent = lines[insertAfter].match(/^(\s*)/)[1];
    const newLines = [
      `${indent}"commercialPayersNonCoverage": ["${payer}"],`,
      `${indent}"commercialPayersNonCoverageNotes": "${note || ''}"`,
    ];
    lines.splice(insertAfter + 1, 0, ...newLines);
  }

  return { content: lines.join('\n') };
}

/**
 * Update a simple field value on a test
 */
function updateField(content, { testId, field, oldValue, newValue, citation }) {
  const lines = content.split('\n');
  const range = findTestObject(lines, testId);
  if (!range) return { error: `Test ${testId} not found in data.js` };

  // Find the field within the test object
  const fieldPattern = `"${field}"`;
  let fieldLine = -1;
  for (let i = range.startLine; i <= range.endLine; i++) {
    if (lines[i].includes(fieldPattern)) {
      fieldLine = i;
      break;
    }
  }

  if (fieldLine === -1) {
    return { error: `Field "${field}" not found for ${testId}` };
  }

  // Verify old value matches if provided
  if (oldValue !== undefined && oldValue !== null) {
    const oldStr = typeof oldValue === 'string' ? `"${oldValue}"` : String(oldValue);
    if (!lines[fieldLine].includes(oldStr) && !lines[fieldLine].includes(String(oldValue))) {
      return { error: `Old value mismatch for ${testId}.${field}: expected "${oldValue}" not found on line` };
    }
  }

  // Replace the value
  const line = lines[fieldLine];
  const colonIndex = line.indexOf(':', line.indexOf(fieldPattern));
  if (colonIndex === -1) {
    return { error: `Cannot parse field line for ${testId}.${field}` };
  }

  // Find the value portion after the colon
  const afterColon = line.substring(colonIndex + 1);
  const trailingComma = afterColon.trimEnd().endsWith(',');
  const indent = line.match(/^(\s*)/)[1];

  // Format the new value
  let formattedValue;
  if (typeof newValue === 'string') {
    formattedValue = `"${newValue}"`;
  } else if (newValue === null) {
    formattedValue = 'null';
  } else if (typeof newValue === 'boolean') {
    formattedValue = String(newValue);
  } else {
    formattedValue = String(newValue);
  }

  lines[fieldLine] = `${indent}"${field}": ${formattedValue}${trailingComma ? ',' : ''}`;

  return { content: lines.join('\n') };
}

/**
 * Add a privatePayers entry to coverageCrossReference
 */
function addCoverageCrossRef(content, { testId, payerId, entry }) {
  const lines = content.split('\n');
  const range = findTestObject(lines, testId);
  if (!range) return { error: `Test ${testId} not found in data.js` };

  // Find privatePayers within coverageCrossReference
  let privatePayersLine = -1;
  for (let i = range.startLine; i <= range.endLine; i++) {
    if (lines[i].includes('"privatePayers"')) {
      privatePayersLine = i;
      break;
    }
  }

  if (privatePayersLine === -1) {
    return { error: `privatePayers not found in coverageCrossReference for ${testId}` };
  }

  // Check if this payer already exists
  for (let i = privatePayersLine; i <= range.endLine; i++) {
    if (lines[i].includes(`"${payerId}"`)) {
      return { error: `${payerId} already exists in privatePayers for ${testId}` };
    }
  }

  // Find the closing brace of privatePayers object — find its opening brace first
  let depth = 0;
  let insertBefore = -1;
  for (let i = privatePayersLine; i <= range.endLine; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          insertBefore = i;
          break;
        }
      }
    }
    if (insertBefore !== -1) break;
  }

  if (insertBefore === -1) {
    return { error: `Cannot find end of privatePayers for ${testId}` };
  }

  // Build the new payer entry
  const baseIndent = lines[privatePayersLine].match(/^(\s*)/)[1];
  const entryIndent = baseIndent + '  ';
  const fieldIndent = entryIndent + '  ';

  const entryLines = [
    `${entryIndent}"${payerId}": {`,
    `${fieldIndent}"status": "${entry.status || 'PARTIAL'}",`,
    `${fieldIndent}"policy": "${entry.policy || ''}",`,
    `${fieldIndent}"policyUrl": "${entry.policyUrl || ''}",`,
    `${fieldIndent}"coveredIndications": ${JSON.stringify(entry.coveredIndications || [])},`,
    `${fieldIndent}"notes": "${entry.notes || ''}",`,
    `${fieldIndent}"lastReviewed": "${entry.lastReviewed || new Date().toISOString().split('T')[0]}"`,
    `${entryIndent}},`,
  ];

  // Check if we need a comma after the previous entry
  const lineBeforeInsert = lines[insertBefore - 1].trimEnd();
  if (lineBeforeInsert.endsWith('}') && !lineBeforeInsert.endsWith('},')) {
    lines[insertBefore - 1] = lines[insertBefore - 1].replace(/}\s*$/, '},');
  }

  lines.splice(insertBefore, 0, ...entryLines);

  return { content: lines.join('\n') };
}

/**
 * Add an entry to DATABASE_CHANGELOG
 */
function addChangelog(content, { entry }) {
  const marker = 'export const DATABASE_CHANGELOG = [';
  const markerIndex = content.indexOf(marker);
  if (markerIndex === -1) {
    return { error: 'DATABASE_CHANGELOG not found in data.js' };
  }

  const insertPos = markerIndex + marker.length;

  const changelogEntry = `
  {
    date: '${entry.date}',
    type: '${entry.type || 'updated'}',
    testId: '${entry.testId}',
    testName: '${entry.testName}',
    vendor: '${entry.vendor}',
    category: '${entry.category}',
    description: '${(entry.description || '').replace(/'/g, "\\'")}',
    contributor: ${entry.contributor ? `'${entry.contributor}'` : 'null'},
    affiliation: '${entry.affiliation || 'OpenOnco'}',
    citation: ${entry.citation ? `'${entry.citation}'` : 'null'}
  },`;

  return {
    content: content.substring(0, insertPos) + changelogEntry + content.substring(insertPos),
  };
}

/**
 * Validate data.js after changes — basic syntax checks.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateDataJs() {
  const content = readFileSync(DATA_JS_PATH, 'utf-8');
  const errors = [];

  // Check required exports exist
  const requiredExports = [
    'export const mrdTestData',
    'export const ecdTestData',
    'export const tdsTestData',
    'export const hctTestData',
    'export const trmTestData',
    'export const DATABASE_CHANGELOG',
  ];

  for (const exp of requiredExports) {
    if (!content.includes(exp)) {
      errors.push(`Missing export: ${exp}`);
    }
  }

  // Check balanced braces (rough)
  let braces = 0;
  let brackets = 0;
  for (const ch of content) {
    if (ch === '{') braces++;
    if (ch === '}') braces--;
    if (ch === '[') brackets++;
    if (ch === ']') brackets--;
  }
  if (braces !== 0) errors.push(`Unbalanced braces: ${braces > 0 ? 'missing }' : 'extra }'}`);
  if (brackets !== 0) errors.push(`Unbalanced brackets: ${brackets > 0 ? 'missing ]' : 'extra ]'}`);

  // Check for duplicate IDs
  const idMatches = content.matchAll(/"id":\s*"([^"]+)"/g);
  const ids = new Set();
  for (const match of idMatches) {
    if (ids.has(match[1])) {
      errors.push(`Duplicate ID: ${match[1]}`);
    }
    ids.add(match[1]);
  }

  return { valid: errors.length === 0, errors };
}

export { DATA_JS_PATH };
