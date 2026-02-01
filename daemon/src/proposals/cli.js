#!/usr/bin/env node

/**
 * Proposal Queue CLI
 *
 * Commands:
 *   list [--status=pending] [--type=coverage]  List proposals
 *   get <id>                                   Show proposal details
 *   approve <id>                               Approve a proposal
 *   reject <id> <reason>                       Reject a proposal
 *   apply                                      Apply all approved proposals
 *   stats                                      Show proposal statistics
 *   create-test                                Create a test proposal (for testing)
 */

import {
  listProposals,
  listPending,
  listApproved,
  getProposal,
  approveProposal,
  rejectProposal,
  markApplied,
  getStats,
  createProposal,
} from './queue.js';
import { PROPOSAL_TYPES, PROPOSAL_STATES } from './schema.js';

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

/**
 * Format a proposal for display
 */
function formatProposal(proposal, verbose = false) {
  const statusColors = {
    [PROPOSAL_STATES.PENDING]: colors.yellow,
    [PROPOSAL_STATES.APPROVED]: colors.green,
    [PROPOSAL_STATES.APPLIED]: colors.blue,
    [PROPOSAL_STATES.REJECTED]: colors.red,
  };

  const statusColor = statusColors[proposal.status] || colors.reset;
  const date = new Date(proposal.createdAt).toLocaleDateString();

  let output = `${colors.bold}${proposal.id}${colors.reset} `;
  output += `[${statusColor}${proposal.status}${colors.reset}] `;
  output += `${colors.dim}${date}${colors.reset}\n`;

  if (proposal.type === PROPOSAL_TYPES.COVERAGE) {
    output += `  ${colors.cyan}Coverage:${colors.reset} ${proposal.testName} @ ${proposal.payer}\n`;
    output += `  Status: ${proposal.coverageStatus || 'unknown'}\n`;
  } else if (proposal.type === PROPOSAL_TYPES.UPDATE) {
    output += `  ${colors.cyan}Update:${colors.reset} ${proposal.testName}\n`;
    output += `  Changes: ${Object.keys(proposal.changes || {}).join(', ')}\n`;
  } else if (proposal.type === PROPOSAL_TYPES.NEW_TEST) {
    output += `  ${colors.cyan}New Test:${colors.reset} ${proposal.testData?.name}\n`;
    output += `  Vendor: ${proposal.testData?.vendor}, Category: ${proposal.testData?.category}\n`;
  }

  if (verbose) {
    output += `  Source: ${proposal.source}\n`;
    output += `  Confidence: ${(proposal.confidence * 100).toFixed(0)}%\n`;
    if (proposal.snippet) {
      output += `  Snippet: ${proposal.snippet.slice(0, 100)}...\n`;
    }
    if (proposal.rejectionReason) {
      output += `  ${colors.red}Rejection:${colors.reset} ${proposal.rejectionReason}\n`;
    }
  }

  return output;
}

/**
 * List proposals command
 */
async function cmdList(args) {
  const options = {};

  // Parse args
  for (const arg of args) {
    if (arg.startsWith('--status=')) {
      options.status = arg.split('=')[1];
    } else if (arg.startsWith('--type=')) {
      options.type = arg.split('=')[1];
    } else if (arg === '-v' || arg === '--verbose') {
      options.verbose = true;
    }
  }

  const proposals = await listProposals(options);

  if (proposals.length === 0) {
    console.log('No proposals found.');
    return;
  }

  console.log(`\n${colors.bold}Found ${proposals.length} proposal(s):${colors.reset}\n`);

  for (const proposal of proposals) {
    console.log(formatProposal(proposal, options.verbose));
  }
}

/**
 * Get proposal details command
 */
async function cmdGet(args) {
  const id = args[0];
  if (!id) {
    console.error('Usage: proposals get <id>');
    process.exit(1);
  }

  const proposal = await getProposal(id);
  if (!proposal) {
    console.error(`Proposal not found: ${id}`);
    process.exit(1);
  }

  console.log('\n' + formatProposal(proposal, true));
  console.log(`${colors.dim}Full JSON:${colors.reset}`);
  console.log(JSON.stringify(proposal, null, 2));
}

/**
 * Approve proposal command
 */
async function cmdApprove(args) {
  const id = args[0];
  if (!id) {
    console.error('Usage: proposals approve <id>');
    process.exit(1);
  }

  const proposal = await approveProposal(id, process.env.USER || 'cli');
  if (!proposal) {
    console.error(`Proposal not found: ${id}`);
    process.exit(1);
  }

  console.log(`${colors.green}Approved:${colors.reset} ${proposal.id}`);
}

/**
 * Reject proposal command
 */
async function cmdReject(args) {
  const id = args[0];
  const reason = args.slice(1).join(' ');

  if (!id || !reason) {
    console.error('Usage: proposals reject <id> <reason>');
    process.exit(1);
  }

  const proposal = await rejectProposal(id, reason, process.env.USER || 'cli');
  if (!proposal) {
    console.error(`Proposal not found: ${id}`);
    process.exit(1);
  }

  console.log(`${colors.red}Rejected:${colors.reset} ${proposal.id}`);
  console.log(`Reason: ${reason}`);
}

/**
 * Apply approved proposals command
 */
async function cmdApply() {
  const approved = await listApproved();

  if (approved.length === 0) {
    console.log('No approved proposals to apply.');
    return;
  }

  console.log(`\n${colors.bold}Found ${approved.length} approved proposal(s) to apply:${colors.reset}\n`);

  for (const proposal of approved) {
    console.log(formatProposal(proposal));
  }

  console.log(`\n${colors.yellow}Note:${colors.reset} Proposal application to data.js is not yet implemented.`);
  console.log('This will be added in a future update to handle AST-based code modification.');
  console.log('\nFor now, please apply changes manually and then run:');
  console.log(`  proposals mark-applied <id>`);
}

/**
 * Show statistics command
 */
async function cmdStats() {
  const stats = await getStats();

  console.log(`\n${colors.bold}Proposal Statistics${colors.reset}\n`);
  console.log(`Total: ${stats.total}`);
  console.log(`\nBy Status:`);
  console.log(`  ${colors.yellow}Pending:${colors.reset}  ${stats.byStatus[PROPOSAL_STATES.PENDING]}`);
  console.log(`  ${colors.green}Approved:${colors.reset} ${stats.byStatus[PROPOSAL_STATES.APPROVED]}`);
  console.log(`  ${colors.blue}Applied:${colors.reset}  ${stats.byStatus[PROPOSAL_STATES.APPLIED]}`);
  console.log(`  ${colors.red}Rejected:${colors.reset} ${stats.byStatus[PROPOSAL_STATES.REJECTED]}`);
  console.log(`\nBy Type:`);
  console.log(`  Coverage:  ${stats.byType[PROPOSAL_TYPES.COVERAGE]}`);
  console.log(`  Updates:   ${stats.byType[PROPOSAL_TYPES.UPDATE]}`);
  console.log(`  New Tests: ${stats.byType[PROPOSAL_TYPES.NEW_TEST]}`);
}

/**
 * Create test proposal command (for testing the system)
 */
async function cmdCreateTest() {
  const proposal = await createProposal(PROPOSAL_TYPES.COVERAGE, {
    testName: 'Signatera',
    testId: 'signatera',
    payer: 'UnitedHealthcare',
    payerId: 'uhc',
    coverageStatus: 'covered',
    conditions: 'Stage II-III CRC, post-surgery surveillance',
    effectiveDate: '2025-01-01',
    source: 'https://example.com/uhc-signatera-coverage',
    sourceTitle: 'UHC Coverage Update for Signatera MRD Testing',
    confidence: 0.92,
    snippet: 'UnitedHealthcare now covers Signatera for MRD monitoring in colorectal cancer patients...',
  });

  console.log(`${colors.green}Created test proposal:${colors.reset} ${proposal.id}`);
  console.log(formatProposal(proposal, true));
}

/**
 * Mark proposal as applied command
 */
async function cmdMarkApplied(args) {
  const id = args[0];
  const commitHash = args[1] || null;

  if (!id) {
    console.error('Usage: proposals mark-applied <id> [commit-hash]');
    process.exit(1);
  }

  const proposal = await markApplied(id, commitHash);
  if (!proposal) {
    console.error(`Proposal not found: ${id}`);
    process.exit(1);
  }

  console.log(`${colors.blue}Marked as applied:${colors.reset} ${proposal.id}`);
  if (commitHash) {
    console.log(`Commit: ${commitHash}`);
  }
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
${colors.bold}Proposal Queue CLI${colors.reset}

Usage: node src/proposals/cli.js <command> [options]

Commands:
  list [options]              List proposals
    --status=<status>         Filter by status (pending, approved, applied, rejected)
    --type=<type>             Filter by type (coverage, update, new-test)
    -v, --verbose             Show more details

  get <id>                    Show proposal details

  approve <id>                Approve a proposal for application

  reject <id> <reason>        Reject a proposal with reason

  apply                       Apply all approved proposals to data.js

  mark-applied <id> [hash]    Mark a proposal as applied (with optional commit hash)

  stats                       Show proposal statistics

  create-test                 Create a test proposal (for testing)

  help                        Show this help message

Examples:
  node src/proposals/cli.js list --status=pending
  node src/proposals/cli.js approve cov-2024-abc123
  node src/proposals/cli.js reject cov-2024-abc123 "Duplicate of existing coverage"
`);
}

// Main entry point
const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  try {
    switch (command) {
      case 'list':
        await cmdList(args);
        break;
      case 'get':
        await cmdGet(args);
        break;
      case 'approve':
        await cmdApprove(args);
        break;
      case 'reject':
        await cmdReject(args);
        break;
      case 'apply':
        await cmdApply();
        break;
      case 'mark-applied':
        await cmdMarkApplied(args);
        break;
      case 'stats':
        await cmdStats();
        break;
      case 'create-test':
        await cmdCreateTest();
        break;
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
      default:
        if (command) {
          console.error(`Unknown command: ${command}`);
        }
        showHelp();
        process.exit(command ? 1 : 0);
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset} ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
