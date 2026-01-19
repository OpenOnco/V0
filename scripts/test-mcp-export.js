#!/usr/bin/env node

/**
 * Test script for MCP data export validation.
 *
 * This script:
 * 1. Runs the export to a temp directory
 * 2. Validates each JSON file is valid JSON
 * 3. Validates required fields exist for each category
 * 4. Compares against current MCP repo JSON files if available
 * 5. Reports any differences (added/removed tests, field changes)
 * 6. Exits with error code if validation fails
 *
 * Usage:
 *   node scripts/test-mcp-export.js [--compare-path <path>]
 *
 * Options:
 *   --compare-path  Path to MCP repo resources (default: ../openonco-mcp/src/main/resources/)
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Parse command line arguments
const args = process.argv.slice(2);
let comparePath = resolve(projectRoot, '..', 'openonco-mcp', 'src', 'main', 'resources');

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--compare-path' && args[i + 1]) {
    comparePath = resolve(args[i + 1]);
    i++;
  }
}

// Required fields per category
const REQUIRED_FIELDS = {
  // Common fields for all tests
  common: ['id', 'name', 'vendor'],

  // Category-specific required fields
  // MRD: Minimal Residual Disease tests
  mrd: [
    'sampleCategory',
    'approach',
    'cancerTypes',
    'fdaStatus',
  ],
  // ECD: Early Cancer Detection / MCED tests
  ecd: [
    'sampleCategory',
    'testScope',
    'cancerTypes',
    'fdaStatus',
  ],
  // HCT: Hereditary Cancer Testing - uses different field names
  // Note: genesAnalyzed is optional (some are single-gene tests or PGx)
  hct: [
    'sampleCategory',
    'fdaStatus',
  ],
  // TDS: Tumor DNA Sequencing / CGP panels
  tds: [
    'sampleCategory',
    'fdaStatus',
  ],
};

// Color helpers for console output
const colors = {
  red: (str) => `\x1b[31m${str}\x1b[0m`,
  green: (str) => `\x1b[32m${str}\x1b[0m`,
  yellow: (str) => `\x1b[33m${str}\x1b[0m`,
  blue: (str) => `\x1b[34m${str}\x1b[0m`,
  dim: (str) => `\x1b[2m${str}\x1b[0m`,
};

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

let errors = [];
let warnings = [];

function logError(message) {
  errors.push(message);
  console.error(colors.red(`  ✗ ${message}`));
}

function logWarning(message) {
  warnings.push(message);
  console.warn(colors.yellow(`  ⚠ ${message}`));
}

function logSuccess(message) {
  console.log(colors.green(`  ✓ ${message}`));
}

function logInfo(message) {
  console.log(colors.blue(`  ℹ ${message}`));
}

/**
 * Step 1: Run the export to a temp directory
 */
function runExport(outputDir) {
  console.log('\n📦 Running MCP export...');

  try {
    execSync(`node scripts/export-mcp-data.js "${outputDir}"`, {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    logSuccess('Export completed successfully');
    return true;
  } catch (error) {
    logError(`Export failed: ${error.message}`);
    return false;
  }
}

/**
 * Step 2: Validate JSON files
 */
function validateJsonFiles(outputDir) {
  console.log('\n🔍 Validating JSON files...');

  const expectedFiles = ['mrd.json', 'ecd.json', 'hct.json', 'tds.json'];
  const parsedData = {};

  for (const filename of expectedFiles) {
    const filePath = join(outputDir, filename);

    if (!existsSync(filePath)) {
      logError(`Missing expected file: ${filename}`);
      continue;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (!Array.isArray(data)) {
        logError(`${filename}: Expected an array, got ${typeof data}`);
        continue;
      }

      parsedData[filename.replace('.json', '')] = data;
      logSuccess(`${filename}: Valid JSON with ${data.length} items`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        logError(`${filename}: Invalid JSON - ${error.message}`);
      } else {
        logError(`${filename}: Error reading file - ${error.message}`);
      }
    }
  }

  return parsedData;
}

/**
 * Step 3: Validate required fields
 */
function validateRequiredFields(parsedData) {
  console.log('\n📋 Validating required fields...');

  for (const [category, data] of Object.entries(parsedData)) {
    const requiredFields = [
      ...REQUIRED_FIELDS.common,
      ...(REQUIRED_FIELDS[category] || []),
    ];

    let categoryErrors = 0;

    for (const item of data) {
      const missingFields = [];

      for (const field of requiredFields) {
        if (item[field] === undefined || item[field] === null) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        logError(
          `${category}/${item.id || 'unknown'}: Missing required fields: ${missingFields.join(', ')}`
        );
        categoryErrors++;
      }
    }

    if (categoryErrors === 0) {
      logSuccess(`${category}: All ${data.length} items have required fields`);
    }
  }
}

/**
 * Step 4: Validate ID uniqueness
 */
function validateIdUniqueness(parsedData) {
  console.log('\n🔑 Validating ID uniqueness...');

  for (const [category, data] of Object.entries(parsedData)) {
    const ids = data.map((item) => item.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

    if (duplicates.length > 0) {
      logError(`${category}: Duplicate IDs found: ${[...new Set(duplicates)].join(', ')}`);
    } else {
      logSuccess(`${category}: All ${data.length} IDs are unique`);
    }
  }
}

/**
 * Step 5: Compare with MCP repo (if available)
 */
function compareWithMcpRepo(parsedData, mcpPath) {
  console.log('\n🔄 Comparing with MCP repo...');

  if (!existsSync(mcpPath)) {
    logInfo(`MCP repo not found at: ${mcpPath}`);
    logInfo('Skipping comparison (this is normal for CI or first-time setup)');
    return;
  }

  const categories = ['mrd', 'ecd', 'hct', 'tds'];

  for (const category of categories) {
    const mcpFilePath = join(mcpPath, `${category}.json`);

    if (!existsSync(mcpFilePath)) {
      logWarning(`${category}.json not found in MCP repo`);
      continue;
    }

    try {
      const mcpContent = readFileSync(mcpFilePath, 'utf-8');
      const mcpData = JSON.parse(mcpContent);
      const newData = parsedData[category] || [];

      // Compare IDs
      const mcpIds = new Set(mcpData.map((item) => item.id));
      const newIds = new Set(newData.map((item) => item.id));

      const addedIds = [...newIds].filter((id) => !mcpIds.has(id));
      const removedIds = [...mcpIds].filter((id) => !newIds.has(id));

      if (addedIds.length > 0) {
        logInfo(`${category}: ${addedIds.length} new items: ${addedIds.join(', ')}`);
      }

      if (removedIds.length > 0) {
        logWarning(`${category}: ${removedIds.length} items would be removed: ${removedIds.join(', ')}`);
      }

      // Check for field changes in existing items
      let changedCount = 0;
      for (const newItem of newData) {
        const mcpItem = mcpData.find((item) => item.id === newItem.id);
        if (mcpItem) {
          const changes = compareObjects(mcpItem, newItem);
          if (changes.length > 0) {
            changedCount++;
            // Only log details for first few changes to avoid spam
            if (changedCount <= 3) {
              console.log(colors.dim(`    ${newItem.id}: ${changes.length} field(s) changed`));
            }
          }
        }
      }

      if (changedCount > 3) {
        console.log(colors.dim(`    ... and ${changedCount - 3} more items with changes`));
      }

      if (addedIds.length === 0 && removedIds.length === 0 && changedCount === 0) {
        logSuccess(`${category}: No changes detected`);
      } else {
        logSuccess(`${category}: ${addedIds.length} added, ${removedIds.length} removed, ${changedCount} modified`);
      }
    } catch (error) {
      logWarning(`${category}: Error comparing - ${error.message}`);
    }
  }
}

/**
 * Compare two objects and return list of changed fields
 */
function compareObjects(obj1, obj2) {
  const changes = [];
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

  for (const key of allKeys) {
    const val1 = JSON.stringify(obj1[key]);
    const val2 = JSON.stringify(obj2[key]);

    if (val1 !== val2) {
      changes.push(key);
    }
  }

  return changes;
}

/**
 * Main test runner
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('           MCP Data Export Test Suite');
  console.log('═══════════════════════════════════════════════════════════════');

  // Create temp directory for export
  const tempDir = mkdtempSync(join(tmpdir(), 'mcp-test-'));
  console.log(colors.dim(`\nTemp directory: ${tempDir}`));

  try {
    // Step 1: Run export
    const exportSuccess = runExport(tempDir);
    if (!exportSuccess) {
      throw new ValidationError('Export failed');
    }

    // Step 2: Validate JSON
    const parsedData = validateJsonFiles(tempDir);
    if (Object.keys(parsedData).length === 0) {
      throw new ValidationError('No valid JSON files produced');
    }

    // Step 3: Validate required fields
    validateRequiredFields(parsedData);

    // Step 4: Validate ID uniqueness
    validateIdUniqueness(parsedData);

    // Step 5: Compare with MCP repo
    compareWithMcpRepo(parsedData, comparePath);

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                         Summary');
    console.log('═══════════════════════════════════════════════════════════════');

    if (errors.length > 0) {
      console.log(colors.red(`\n❌ ${errors.length} error(s) found:`));
      errors.forEach((e) => console.log(colors.red(`   - ${e}`)));
    }

    if (warnings.length > 0) {
      console.log(colors.yellow(`\n⚠️  ${warnings.length} warning(s):`));
      warnings.forEach((w) => console.log(colors.yellow(`   - ${w}`)));
    }

    if (errors.length === 0) {
      console.log(colors.green('\n✅ All validations passed!'));
    }

    // Exit with appropriate code
    process.exit(errors.length > 0 ? 1 : 0);
  } catch (error) {
    console.error(colors.red(`\n💥 Fatal error: ${error.message}`));
    process.exit(1);
  } finally {
    // Cleanup temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

main();
