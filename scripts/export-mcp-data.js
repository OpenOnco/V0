#!/usr/bin/env node

/**
 * Export OpenOnco test data to JSON files for the MCP server.
 *
 * Usage:
 *   node scripts/export-mcp-data.js [output-directory]
 *
 * Default output directory: dist/mcp/
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import {
  mrdTestData,
  ecdTestData,
  hctTestData,
  tdsTestData,
} from '../src/data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Get output directory from command line arg or use default
const outputDir = process.argv[2]
  ? resolve(process.argv[2])
  : join(projectRoot, 'dist', 'mcp');

// Ensure output directory exists
mkdirSync(outputDir, { recursive: true });

// Define the exports
const exports = [
  { name: 'mrd', data: mrdTestData },
  { name: 'ecd', data: ecdTestData },
  { name: 'hct', data: hctTestData },
  { name: 'tds', data: tdsTestData },
];

console.log(`Exporting OpenOnco data to: ${outputDir}\n`);

// Write each JSON file
for (const { name, data } of exports) {
  const filePath = join(outputDir, `${name}.json`);
  writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  ${name}.json: ${data.length} items`);
}

console.log(`\nExport complete!`);
