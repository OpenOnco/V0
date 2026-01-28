#!/usr/bin/env node

/**
 * Export unreviewed discoveries to a local markdown file
 *
 * Usage:
 *   node scripts/export-discoveries.js
 *
 * Output: prints the filepath of the exported markdown file
 *
 * Workflow:
 *   1. Email arrives with summary
 *   2. Run: cd daemon && npm run run:export
 *   3. Claude Code reads the exported file in chunks
 */

import 'dotenv/config';
import { exportDiscoveriesToMarkdown } from '../src/export/markdown-export.js';

const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

try {
  const { filepath, counts } = exportDiscoveriesToMarkdown();

  console.log(`\n${CYAN}${BOLD}OpenOnco Discovery Export${RESET}`);
  console.log(`${DIM}─────────────────────────────${RESET}`);
  console.log(`  ${GREEN}✓${RESET} Total:  ${BOLD}${counts.total}${RESET} discoveries`);
  console.log(`  ${GREEN}✓${RESET} High:   ${BOLD}${counts.high}${RESET}`);
  console.log(`  ${GREEN}✓${RESET} Medium: ${BOLD}${counts.medium}${RESET}`);
  console.log(`  ${GREEN}✓${RESET} Low:    ${BOLD}${counts.low}${RESET}`);
  console.log(`${DIM}─────────────────────────────${RESET}`);
  console.log(`  ${GREEN}✓${RESET} Exported to: ${BOLD}${filepath}${RESET}`);

  if (counts.total === 0) {
    console.log(`\n  ${YELLOW}⚠${RESET} No unreviewed discoveries in queue.`);
  }

  console.log('');
} catch (error) {
  console.error(`\n\x1b[31m✗ Export failed:\x1b[0m ${error.message}`);
  if (error.stack) {
    console.error(`${DIM}${error.stack}${RESET}`);
  }
  process.exit(1);
}
