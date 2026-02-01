#!/usr/bin/env node
/**
 * Review Discovered Policies
 *
 * Interactive CLI for reviewing and approving discovered policy URLs.
 * Approved policies are added to policy-registry.js.
 *
 * Usage:
 *   node scripts/review-discoveries.js              # Interactive review
 *   node scripts/review-discoveries.js --list       # List pending discoveries
 *   node scripts/review-discoveries.js --approve <id>
 *   node scripts/review-discoveries.js --reject <id> [--reason "..."]
 *   node scripts/review-discoveries.js --stats      # Show discovery stats
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import {
  initHashStore,
  getPendingDiscoveries,
  updateDiscoveryStatus,
  getDiscovery,
  getDiscoveryStats,
  closeHashStore,
} from '../src/utils/hash-store.js';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  list: false,
  approve: null,
  reject: null,
  reason: null,
  stats: false,
  payer: null,
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--list':
      options.list = true;
      break;
    case '--approve':
      options.approve = args[++i];
      break;
    case '--reject':
      options.reject = args[++i];
      break;
    case '--reason':
      options.reason = args[++i];
      break;
    case '--stats':
      options.stats = true;
      break;
    case '--payer':
      options.payer = args[++i];
      break;
    case '--help':
      console.log(`
Review Discovered Policies

Usage:
  node scripts/review-discoveries.js [options]

Options:
  --list            List all pending discoveries
  --approve <id>    Approve a discovery (adds to policy-registry.js)
  --reject <id>     Reject a discovery
  --reason "..."    Reason for rejection (use with --reject)
  --stats           Show discovery statistics
  --payer <id>      Filter by payer ID
  --help            Show this help message

Examples:
  node scripts/review-discoveries.js --list
  node scripts/review-discoveries.js --approve disc_aetna_0352_abc123
  node scripts/review-discoveries.js --reject disc_uhc_xyz --reason "Not oncology related"
  node scripts/review-discoveries.js --stats
`);
      process.exit(0);
  }
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Add a policy to policy-registry.js
 */
async function addToPolicyRegistry(discovery) {
  const registryPath = resolve(process.cwd(), 'src/data/policy-registry.js');

  // Read the current registry
  const content = await readFile(registryPath, 'utf-8');

  // Find the payer in the registry
  const payerId = discovery.payer_id;

  // Generate policy ID
  const urlSlug = discovery.url
    .split('/')
    .pop()
    ?.replace(/\.[^.]+$/, '')
    ?.replace(/[^a-zA-Z0-9]/g, '-')
    ?.toLowerCase()
    ?.slice(0, 30) || 'policy';
  const policyId = `${payerId}-${urlSlug}`;

  // Create the policy entry
  const policyEntry = {
    id: policyId,
    name: discovery.link_text?.slice(0, 100) || 'Discovered Policy',
    url: discovery.url,
    contentType: discovery.content_type || 'pdf',
    policyType: discovery.policy_type || 'molecular_oncology',
    discoveryMethod: 'automated',
    notes: `Discovered ${new Date().toISOString().split('T')[0]} from ${discovery.source_page_url || 'index page'}`,
    lastVerified: new Date().toISOString().split('T')[0],
  };

  // Check if payer exists in registry
  const payerRegex = new RegExp(`${payerId}:\\s*\\{[^}]*policies:\\s*\\[`, 's');
  const payerMatch = content.match(payerRegex);

  if (!payerMatch) {
    log(`\nWarning: Payer '${payerId}' not found in registry.`, colors.yellow);
    log(`You'll need to add this policy manually:`, colors.dim);
    log(JSON.stringify(policyEntry, null, 2));
    return false;
  }

  // Find the insertion point (end of policies array for this payer)
  const payerStart = content.indexOf(payerMatch[0]);
  const policiesStart = payerStart + payerMatch[0].length;

  // Find the closing bracket of the policies array
  let bracketCount = 1;
  let insertPos = policiesStart;
  for (let i = policiesStart; i < content.length && bracketCount > 0; i++) {
    if (content[i] === '[') bracketCount++;
    if (content[i] === ']') bracketCount--;
    if (bracketCount === 0) {
      insertPos = i;
    }
  }

  // Check if there are existing policies
  const existingContent = content.slice(policiesStart, insertPos).trim();
  const hasExistingPolicies = existingContent.length > 0;

  // Format the new policy entry
  const indent = '      ';
  const policyStr = `${hasExistingPolicies ? ',\n' : '\n'}${indent}{
${indent}  id: '${policyEntry.id}',
${indent}  name: '${policyEntry.name.replace(/'/g, "\\'")}',
${indent}  url: '${policyEntry.url}',
${indent}  contentType: '${policyEntry.contentType}',
${indent}  policyType: '${policyEntry.policyType}',
${indent}  discoveryMethod: '${policyEntry.discoveryMethod}',
${indent}  notes: '${policyEntry.notes.replace(/'/g, "\\'")}',
${indent}  lastVerified: '${policyEntry.lastVerified}',
${indent}}`;

  // Insert the new policy
  const newContent = content.slice(0, insertPos) + policyStr + '\n    ' + content.slice(insertPos);

  // Write back
  await writeFile(registryPath, newContent, 'utf-8');

  log(`\n${colors.green}✓ Added to policy-registry.js${colors.reset}`);
  log(`  Policy ID: ${policyId}`);
  log(`  URL: ${discovery.url}`);

  return true;
}

/**
 * List pending discoveries
 */
async function listPending() {
  const discoveries = getPendingDiscoveries({ payerId: options.payer, limit: 50 });

  if (discoveries.length === 0) {
    log('\nNo pending discoveries.', colors.dim);
    return;
  }

  log(`\n${colors.bright}Pending Discoveries (${discoveries.length})${colors.reset}\n`);

  for (const d of discoveries) {
    const confidence = d.classification_confidence
      ? `${Math.round(d.classification_confidence * 100)}%`
      : '?';
    const confidenceColor = d.classification_confidence >= 0.8 ? colors.green : colors.yellow;

    log(`${colors.bright}${d.discovery_id}${colors.reset}`);
    log(`  Payer:      ${d.payer_name || d.payer_id}`);
    log(`  URL:        ${colors.blue}${d.url}${colors.reset}`);
    log(`  Link text:  ${d.link_text?.slice(0, 80) || '(none)'}...`);
    log(`  Type:       ${d.policy_type || 'unknown'} (${d.content_type || 'unknown'})`);
    log(`  Confidence: ${confidenceColor}${confidence}${colors.reset} - ${d.classification_reason || ''}`);
    log(`  Discovered: ${d.discovered_at}`);
    log('');
  }

  log(`${colors.dim}To approve: node scripts/review-discoveries.js --approve <discovery_id>${colors.reset}`);
  log(`${colors.dim}To reject:  node scripts/review-discoveries.js --reject <discovery_id>${colors.reset}`);
}

/**
 * Show discovery statistics
 */
async function showStats() {
  const stats = getDiscoveryStats();

  log(`\n${colors.bright}Discovery Statistics${colors.reset}\n`);
  log(`  Total:     ${stats.total}`);
  log(`  Pending:   ${colors.yellow}${stats.pending}${colors.reset}`);
  log(`  Approved:  ${colors.green}${stats.approved}${colors.reset}`);
  log(`  Rejected:  ${colors.red}${stats.rejected}${colors.reset}`);
  log(`  Ignored:   ${colors.dim}${stats.ignored}${colors.reset}`);
}

/**
 * Approve a discovery
 */
async function approveDiscovery(discoveryId) {
  const discovery = getDiscovery(discoveryId);

  if (!discovery) {
    log(`\nError: Discovery '${discoveryId}' not found.`, colors.red);
    return false;
  }

  if (discovery.status !== 'pending') {
    log(`\nError: Discovery is already ${discovery.status}.`, colors.yellow);
    return false;
  }

  log(`\n${colors.bright}Approving discovery:${colors.reset}`);
  log(`  ID:    ${discovery.discovery_id}`);
  log(`  Payer: ${discovery.payer_name || discovery.payer_id}`);
  log(`  URL:   ${discovery.url}`);

  // Add to policy registry
  const added = await addToPolicyRegistry(discovery);

  if (added) {
    // Update status
    updateDiscoveryStatus(discoveryId, 'approved', {
      reviewedBy: 'cli',
    });

    log(`\n${colors.green}${colors.bright}Discovery approved!${colors.reset}`);
    log(`\nNext: Run the policy crawler to fetch this policy:`);
    log(`  ${colors.blue}node scripts/crawl-policies.js --payer ${discovery.payer_id}${colors.reset}`);

    return true;
  }

  return false;
}

/**
 * Reject a discovery
 */
async function rejectDiscovery(discoveryId, reason) {
  const discovery = getDiscovery(discoveryId);

  if (!discovery) {
    log(`\nError: Discovery '${discoveryId}' not found.`, colors.red);
    return false;
  }

  if (discovery.status !== 'pending') {
    log(`\nError: Discovery is already ${discovery.status}.`, colors.yellow);
    return false;
  }

  updateDiscoveryStatus(discoveryId, 'rejected', {
    reviewedBy: 'cli',
    notes: reason,
  });

  log(`\n${colors.red}Discovery rejected.${colors.reset}`);
  log(`  ID:     ${discovery.discovery_id}`);
  log(`  Reason: ${reason || '(none provided)'}`);

  return true;
}

/**
 * Main
 */
async function main() {
  await initHashStore();

  try {
    if (options.stats) {
      await showStats();
    } else if (options.list) {
      await listPending();
    } else if (options.approve) {
      await approveDiscovery(options.approve);
    } else if (options.reject) {
      await rejectDiscovery(options.reject, options.reason);
    } else {
      // Default: show stats and list
      await showStats();
      await listPending();
    }
  } finally {
    closeHashStore();
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
