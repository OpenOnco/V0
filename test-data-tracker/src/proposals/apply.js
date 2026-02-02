/**
 * Proposal Application Logic
 *
 * Generates patch files from approved proposals that can be reviewed
 * and applied to data.js using `git apply`.
 *
 * Strategy: Generate unified diff patches for human review instead of
 * direct AST manipulation. This is safer and allows manual verification.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLogger } from '../utils/logger.js';
import { listApproved, markApplied, getProposal } from './queue.js';
import { PROPOSAL_TYPES } from './schema.js';
import { lookupTestByName, initializeTestDictionary } from '../data/test-dictionary.js';

const logger = createLogger('proposal-apply');

// Paths
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const DATA_JS_PATH = resolve(PROJECT_ROOT, 'src', 'data.js');
const PATCHES_DIR = resolve(__dirname, '..', '..', 'data', 'patches');

/**
 * Generate a patch file for approved proposals
 * Returns the path to the generated patch file
 *
 * @param {Object} options - Generation options
 * @param {string} options.outputPath - Optional custom output path
 * @returns {Promise<{patchPath: string, proposals: Object[], instructions: string[]}>}
 */
export async function generatePatch(options = {}) {
  // Ensure test dictionary is loaded
  await initializeTestDictionary();

  // Get approved proposals
  const proposals = await listApproved();

  if (proposals.length === 0) {
    return {
      patchPath: null,
      proposals: [],
      instructions: ['No approved proposals to apply.'],
    };
  }

  // Ensure patches directory exists
  if (!existsSync(PATCHES_DIR)) {
    await mkdir(PATCHES_DIR, { recursive: true });
  }

  // Read current data.js
  const dataJs = await readFile(DATA_JS_PATH, 'utf-8');

  // Generate instructions for each proposal
  const instructions = [];
  const changelogEntries = [];
  const coverageUpdates = [];
  const testUpdates = [];
  const newTests = [];
  const coverageAssertions = [];
  const documentCandidates = [];
  const delegationChanges = [];

  for (const proposal of proposals) {
    const instruction = generateProposalInstruction(proposal, dataJs);
    if (instruction) {
      instructions.push(instruction);

      // Categorize the proposal
      if (proposal.type === PROPOSAL_TYPES.COVERAGE) {
        coverageUpdates.push(proposal);
      } else if (proposal.type === PROPOSAL_TYPES.UPDATE) {
        testUpdates.push(proposal);
      } else if (proposal.type === PROPOSAL_TYPES.NEW_TEST) {
        newTests.push(proposal);
      } else if (proposal.type === PROPOSAL_TYPES.COVERAGE_ASSERTION) {
        coverageAssertions.push(proposal);
      } else if (proposal.type === PROPOSAL_TYPES.DOCUMENT_CANDIDATE) {
        documentCandidates.push(proposal);
      } else if (proposal.type === PROPOSAL_TYPES.DELEGATION_CHANGE) {
        delegationChanges.push(proposal);
      }

      // Generate changelog entry (only for data.js changes)
      const changelogEntry = generateChangelogEntry(proposal);
      if (changelogEntry) {
        changelogEntries.push(changelogEntry);
      }
    }
  }

  // Generate the patch content (manual instructions + changelog)
  const timestamp = new Date().toISOString().split('T')[0];
  const patchContent = generatePatchDocument(
    proposals,
    instructions,
    changelogEntries,
    coverageUpdates,
    testUpdates,
    newTests,
    coverageAssertions,
    documentCandidates,
    delegationChanges
  );

  // Write patch file
  const patchFilename = options.outputPath || `proposals-${timestamp}.md`;
  const patchPath = join(PATCHES_DIR, patchFilename);
  await writeFile(patchPath, patchContent);

  logger.info(`Generated patch document: ${patchPath}`);

  return {
    patchPath,
    proposals,
    instructions,
  };
}

/**
 * Generate instruction text for a single proposal
 * @param {Object} proposal - Proposal object
 * @param {string} dataJs - Current data.js content
 * @returns {string} Instruction text
 */
function generateProposalInstruction(proposal, dataJs) {
  switch (proposal.type) {
    case PROPOSAL_TYPES.COVERAGE:
      return generateCoverageInstruction(proposal, dataJs);
    case PROPOSAL_TYPES.UPDATE:
      return generateUpdateInstruction(proposal, dataJs);
    case PROPOSAL_TYPES.NEW_TEST:
      return generateNewTestInstruction(proposal, dataJs);
    case PROPOSAL_TYPES.DOCUMENT_CANDIDATE:
      return generateDocumentCandidateInstruction(proposal);
    case PROPOSAL_TYPES.DELEGATION_CHANGE:
      return generateDelegationChangeInstruction(proposal);
    case PROPOSAL_TYPES.COVERAGE_ASSERTION:
      return generateCoverageAssertionInstruction(proposal);
    default:
      return `Unknown proposal type: ${proposal.type}`;
  }
}

/**
 * Generate instruction for coverage proposal
 */
function generateCoverageInstruction(proposal, dataJs) {
  const testMatch = lookupTestByName(proposal.testName);
  const testId = proposal.testId || testMatch?.id || '[UNKNOWN]';

  // Find the test in data.js
  const testPattern = new RegExp(`"id":\\s*"${testId}"`, 'i');
  const found = testPattern.test(dataJs);

  let instruction = `
## Coverage Update: ${proposal.testName}

**Proposal ID:** ${proposal.id}
**Test:** ${proposal.testName} (${testId})
**Payer:** ${proposal.payer}
**Coverage Status:** ${proposal.coverageStatus || 'covered'}
**Effective Date:** ${proposal.effectiveDate || 'Not specified'}
**Confidence:** ${(proposal.confidence * 100).toFixed(0)}%

**Source:** ${proposal.source}
${proposal.snippet ? `**Snippet:** "${proposal.snippet.slice(0, 200)}..."` : ''}

### Action Required:
`;

  if (found) {
    instruction += `
1. Find test "${testId}" in data.js
2. Locate the \`payerCoverage\` array (or add if missing)
3. Add/update entry for "${proposal.payer}":
   \`\`\`javascript
   {
     payer: "${proposal.payer}",
     status: "${proposal.coverageStatus || 'covered'}",
     ${proposal.conditions ? `conditions: "${proposal.conditions}",` : ''}
     ${proposal.effectiveDate ? `effectiveDate: "${proposal.effectiveDate}",` : ''}
     source: "${proposal.source}",
     updatedAt: "${new Date().toISOString().split('T')[0]}"
   }
   \`\`\`
`;
  } else {
    instruction += `
**WARNING:** Test "${testId}" not found in data.js.
- Verify the test name: "${proposal.testName}"
- Search manually for similar tests
- May need to resolve test ID first
`;
  }

  return instruction;
}

/**
 * Generate instruction for update proposal
 */
function generateUpdateInstruction(proposal, dataJs) {
  const testMatch = lookupTestByName(proposal.testName);
  const testId = proposal.testId || testMatch?.id || '[UNKNOWN]';

  let instruction = `
## Test Update: ${proposal.testName}

**Proposal ID:** ${proposal.id}
**Test:** ${proposal.testName} (${testId})
**Confidence:** ${(proposal.confidence * 100).toFixed(0)}%

**Source:** ${proposal.source}

### Changes to Apply:
`;

  for (const [field, change] of Object.entries(proposal.changes || {})) {
    if (typeof change === 'object') {
      instruction += `
- **${field}:**
  \`\`\`json
  ${JSON.stringify(change, null, 2)}
  \`\`\`
`;
    } else {
      instruction += `- **${field}:** ${change}\n`;
    }
  }

  instruction += `
### Action Required:
1. Find test "${testId}" in data.js
2. Update the fields listed above
3. Add citation if provided
`;

  return instruction;
}

/**
 * Generate instruction for new test proposal
 */
function generateNewTestInstruction(proposal) {
  const testData = proposal.testData || {};

  // Determine category and insertion point
  const categoryMap = {
    'Molecular Residual Disease': { array: 'mrdTestData', search: '// INSERT NEW MRD TEST HERE' },
    'MRD': { array: 'mrdTestData', search: '// INSERT NEW MRD TEST HERE' },
    'Early Cancer Detection': { array: 'ecdTestData', search: '// INSERT NEW ECD TEST HERE' },
    'ECD': { array: 'ecdTestData', search: '// INSERT NEW ECD TEST HERE' },
    'Treatment Decision Support': { array: 'tdsTestData', search: '// INSERT NEW TDS TEST HERE' },
    'TDS': { array: 'tdsTestData', search: '// INSERT NEW TDS TEST HERE' },
    'Treatment Response Monitoring': { array: 'trmTestData', search: '// INSERT NEW TRM TEST HERE' },
    'TRM': { array: 'trmTestData', search: '// INSERT NEW TRM TEST HERE' },
    'Hereditary Cancer Testing': { array: 'hctTestData', search: '// INSERT NEW HCT TEST HERE' },
    'HCT': { array: 'hctTestData', search: '// INSERT NEW HCT TEST HERE' },
  };

  const category = categoryMap[testData.category] || { array: 'UNKNOWN', search: 'UNKNOWN' };

  let instruction = `
## New Test: ${testData.name}

**Proposal ID:** ${proposal.id}
**Vendor:** ${testData.vendor}
**Category:** ${testData.category}
**Confidence:** ${(proposal.confidence * 100).toFixed(0)}%

**Source:** ${proposal.source}

### Test Data:
\`\`\`javascript
{
  "id": "[ASSIGN NEXT ID for ${category.array}]",
  "name": "${testData.name}",
  "vendor": "${testData.vendor}",
  ${testData.description ? `"description": "${testData.description}",` : ''}
  ${testData.cancerTypes?.length ? `"cancerTypes": ${JSON.stringify(testData.cancerTypes)},` : ''}
  ${testData.sampleType ? `"sampleType": "${testData.sampleType}",` : ''}
  ${testData.sensitivity ? `"sensitivity": "${testData.sensitivity}",` : ''}
  ${testData.specificity ? `"specificity": "${testData.specificity}",` : ''}
  ${testData.fdaApproved ? `"fdaStatus": "FDA Approved",` : '"fdaStatus": "CLIA LDT",'}
  ${testData.plaCode ? `"cptCodes": "${testData.plaCode}",` : ''}
  "vendorUrl": "${testData.vendorUrl || proposal.source}",
  "reimbursement": "Coverage emerging"
}
\`\`\`

### Action Required:
1. Open data.js and find: \`${category.search}\`
2. Insert the test object above (assign next available ID)
3. Fill in any missing required fields from SUBMISSION_PROCESS.md
4. Run \`npm run test:smoke\` to verify
`;

  return instruction;
}

/**
 * Generate instruction for document candidate proposal
 */
function generateDocumentCandidateInstruction(proposal) {
  const confidence = Math.round((proposal.relevanceScore ?? 0) * 100);
  return `
## Document Candidate: ${proposal.title || proposal.payerName || proposal.payerId}

**Proposal ID:** ${proposal.id}
**Payer:** ${proposal.payerName || proposal.payerId}
**URL:** ${proposal.url}
**Doc Type (guess):** ${proposal.docTypeGuess || 'unknown'}
**Policy Type (guess):** ${proposal.policyTypeGuess || 'liquid_biopsy'}
**Confidence:** ${confidence}%

### Action Required:
1. Open \`test-data-tracker/src/data/policy-registry.js\`
2. Add this URL under payer \`${proposal.payerId}\` if valid:
   \`\`\`javascript
   {
     id: "[assign unique id]",
     name: "${proposal.title || 'Policy Document'}",
     url: "${proposal.url}",
     contentType: "${proposal.contentType || 'html'}",
     policyType: "${proposal.policyTypeGuess || 'liquid_biopsy'}",
     docType: "${proposal.docTypeGuess || 'medical_policy'}",
     discoveryMethod: "link_crawl",
     notes: "${proposal.linkContext ? proposal.linkContext.replace(/"/g, '\\"').slice(0, 160) : 'Discovered via policy discovery crawler.'}",
     lastVerified: "${new Date().toISOString().split('T')[0]}"
   }
   \`\`\`
3. If invalid, mark proposal rejected with reason.
`;
}

/**
 * Generate instruction for delegation change proposal
 */
function generateDelegationChangeInstruction(proposal) {
  const confidence = Math.round((proposal.confidence ?? 0) * 100);
  return `
## Delegation Change: ${proposal.payerName || proposal.payerId}

**Proposal ID:** ${proposal.id}
**Delegated To:** ${proposal.delegatedToName || proposal.delegatedTo}
**Effective Date:** ${proposal.effectiveDate || 'Unknown'}
**Scope:** ${proposal.scope || 'unknown'}
**Confidence:** ${confidence}%

**Source:** ${proposal.sourceUrl || proposal.source}
${proposal.sourceQuote ? `**Quote:** "${proposal.sourceQuote}"` : ''}

### Action Required:
1. Open \`test-data-tracker/src/data/delegation-map.js\`
2. Add/update the delegation entry for payer \`${proposal.payerId}\`
3. Update evidence block with source URL and quote
4. If invalid, mark proposal rejected with reason.
`;
}

/**
 * Generate instruction for coverage assertion proposal
 */
function generateCoverageAssertionInstruction(proposal) {
  const confidence = Math.round((proposal.confidence ?? 0) * 100);
  return `
## Coverage Assertion: ${proposal.testName || proposal.testId} @ ${proposal.payerName || proposal.payerId}

**Proposal ID:** ${proposal.id}
**Layer:** ${proposal.layer}
**Status:** ${proposal.assertionStatus}
**Effective Date:** ${proposal.effectiveDate || 'Unknown'}
**Confidence:** ${confidence}%

**Source:** ${proposal.sourceUrl || proposal.source}
${proposal.sourceQuote ? `**Quote:** "${proposal.sourceQuote}"` : ''}

### Action Required:
1. Review the assertion details and criteria
2. If accepted, add to coverage assertions store (SQLite) using a manual admin step
3. If the assertion implies a data.js change, create a coverage proposal for \`payerCoverage\`
4. If invalid, mark proposal rejected with reason.
`;
}

/**
 * Generate changelog entry for a proposal
 */
function generateChangelogEntry(proposal) {
  const today = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  let type = 'updated';
  let description = '';

  if (proposal.type === PROPOSAL_TYPES.COVERAGE) {
    description = `Updated ${proposal.payer} coverage status for ${proposal.testName}: ${proposal.coverageStatus || 'covered'}`;
  } else if (proposal.type === PROPOSAL_TYPES.UPDATE) {
    const fields = Object.keys(proposal.changes || {}).join(', ');
    description = `Updated ${proposal.testName}: ${fields}`;
  } else if (proposal.type === PROPOSAL_TYPES.NEW_TEST) {
    type = 'added';
    description = `Added ${proposal.testData?.name} (${proposal.testData?.vendor})`;
  } else {
    return null; // Non-data.js proposal types should not create changelog entries
  }

  return {
    date: today,
    type,
    testId: proposal.testId || '[TBD]',
    testName: proposal.testName || proposal.testData?.name,
    vendor: proposal.testData?.vendor || 'Various',
    category: proposal.testData?.category || 'TDS',
    description,
    contributor: 'OpenOnco Daemon',
    affiliation: 'OpenOnco',
    citation: proposal.source,
  };
}

/**
 * Generate the full patch document
 */
function generatePatchDocument(
  proposals,
  instructions,
  changelogEntries,
  coverageUpdates,
  testUpdates,
  newTests,
  coverageAssertions,
  documentCandidates,
  delegationChanges
) {
  const timestamp = new Date().toISOString();

  let doc = `# Proposal Application Document
Generated: ${timestamp}
Total Proposals: ${proposals.length}

## Summary
- Coverage Updates: ${coverageUpdates.length}
- Test Updates: ${testUpdates.length}
- New Tests: ${newTests.length}
- Coverage Assertions: ${coverageAssertions.length}
- Document Candidates: ${documentCandidates.length}
- Delegation Changes: ${delegationChanges.length}

---

# Instructions

${instructions.join('\n---\n')}

---

# DATABASE_CHANGELOG Entries

Add these entries to the TOP of \`DATABASE_CHANGELOG\` array in data.js:

\`\`\`javascript
// Generated by daemon proposal system - ${timestamp.split('T')[0]}
${changelogEntries.length > 0 ? changelogEntries.map(e => JSON.stringify(e, null, 2)).join(',\n') : '// (No data.js changelog entries generated for these proposals)'}
\`\`\`

---

# After Applying

1. Run \`npm run test:smoke\` to verify changes
2. Mark proposals as applied:
${proposals.map(p => `   - \`npm run proposals mark-applied ${p.id}\``).join('\n')}
3. Commit with message: "feat(data): Apply daemon proposals ${timestamp.split('T')[0]}"

---

# Proposal Details

${proposals.map(p => `
## ${p.id}
- Type: ${p.type}
- Created: ${p.createdAt}
- Approved: ${p.reviewedAt} by ${p.reviewedBy}
- Source: ${p.source}
`).join('\n')}
`;

  return doc;
}

/**
 * Mark all proposals in a patch as applied
 * @param {string[]} proposalIds - Array of proposal IDs
 * @param {string} commitHash - Git commit hash (optional)
 */
export async function markProposalsApplied(proposalIds, commitHash = null) {
  const results = [];

  for (const id of proposalIds) {
    try {
      const result = await markApplied(id, commitHash);
      results.push({ id, success: true, proposal: result });
    } catch (error) {
      results.push({ id, success: false, error: error.message });
    }
  }

  return results;
}

export default {
  generatePatch,
  markProposalsApplied,
};
