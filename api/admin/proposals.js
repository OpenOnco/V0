/**
 * Admin API for Proposals
 *
 * Routes:
 *   GET  /api/admin/proposals              - List all proposals
 *   POST /api/admin/proposals/sync         - Daemon pushes proposals to KV
 *   POST /api/admin/proposals/approve      - Approve a proposal
 *   POST /api/admin/proposals/reject       - Reject a proposal with reason
 *   GET  /api/admin/proposals/patch        - Download patch markdown
 *   POST /api/admin/proposals/applied      - Mark proposals as applied
 *
 * All endpoints require x-admin-key header or ?key= query param.
 */

import { kv } from '@vercel/kv';

// Simple admin key check
const ADMIN_KEY = process.env.ADMIN_KEY || 'openonco-admin-2024';

// KV key for proposals storage
const PROPOSALS_KEY = 'proposals:all';

/**
 * Initialize empty proposals structure
 */
function getEmptyStore() {
  return {
    proposals: [],
    lastSync: null,
    stats: { pending: 0, approved: 0, rejected: 0, applied: 0 },
  };
}

/**
 * Load proposals from KV
 */
async function loadProposals() {
  try {
    const data = await kv.get(PROPOSALS_KEY);
    return data || getEmptyStore();
  } catch (err) {
    console.error('Error loading proposals from KV:', err.message);
    return getEmptyStore();
  }
}

/**
 * Save proposals to KV
 */
async function saveProposals(store) {
  try {
    await kv.set(PROPOSALS_KEY, store);
    return { success: true };
  } catch (err) {
    console.error('Error saving proposals to KV:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Recalculate stats from proposals array
 */
function recalcStats(proposals) {
  return {
    pending: proposals.filter(p => p.status === 'pending').length,
    approved: proposals.filter(p => p.status === 'approved').length,
    rejected: proposals.filter(p => p.status === 'rejected').length,
    applied: proposals.filter(p => p.status === 'applied').length,
  };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, admin-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Auth check
  const key = req.query.key || req.headers['x-admin-key'] || req.headers['admin-key'];
  if (key !== ADMIN_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - invalid or missing admin key',
    });
  }

  // Parse the action from the path
  const pathParts = req.url.split('?')[0].split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  try {
    // Route based on method and action
    if (req.method === 'GET') {
      if (action === 'patch') {
        return handleGetPatch(req, res);
      }
      return handleGet(req, res);
    }

    if (req.method === 'POST') {
      switch (action) {
        case 'sync':
          return handleSync(req, res);
        case 'approve':
          return handleApprove(req, res);
        case 'reject':
          return handleReject(req, res);
        case 'applied':
          return handleApplied(req, res);
        default:
          return res.status(400).json({
            success: false,
            error: `Unknown action: ${action}`,
          });
      }
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
  } catch (err) {
    console.error('Proposals API error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}

/**
 * GET /api/admin/proposals - List proposals with filtering
 */
async function handleGet(req, res) {
  const { status, type, limit = '100', offset = '0' } = req.query;

  const store = await loadProposals();
  let proposals = [...store.proposals];

  // Apply filters
  if (status && status !== 'all') {
    proposals = proposals.filter(p => p.status === status);
  }
  if (type && type !== 'all') {
    proposals = proposals.filter(p => p.type === type);
  }

  // Sort by creation date (newest first)
  proposals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Pagination
  const limitNum = parseInt(limit, 10);
  const offsetNum = parseInt(offset, 10);
  const paginated = proposals.slice(offsetNum, offsetNum + limitNum);

  return res.status(200).json({
    success: true,
    meta: {
      total: proposals.length,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < proposals.length,
      lastSync: store.lastSync,
    },
    stats: store.stats,
    data: paginated,
  });
}

/**
 * POST /api/admin/proposals/sync - Daemon pushes proposals
 */
async function handleSync(req, res) {
  const { proposals: incoming } = req.body;

  if (!Array.isArray(incoming)) {
    return res.status(400).json({
      success: false,
      error: 'Expected proposals array in request body',
    });
  }

  const store = await loadProposals();
  const existingIds = new Set(store.proposals.map(p => p.id));

  let added = 0;
  let updated = 0;

  for (const proposal of incoming) {
    if (!proposal.id) continue;

    if (existingIds.has(proposal.id)) {
      // Update existing (preserve status if already reviewed)
      const idx = store.proposals.findIndex(p => p.id === proposal.id);
      if (idx !== -1) {
        const existing = store.proposals[idx];
        // Only update if still pending - don't overwrite reviewed proposals
        if (existing.status === 'pending') {
          store.proposals[idx] = { ...existing, ...proposal };
          updated++;
        }
      }
    } else {
      // Add new
      store.proposals.push({
        ...proposal,
        status: proposal.status || 'pending',
        syncedAt: new Date().toISOString(),
      });
      added++;
    }
  }

  // Recalculate stats
  store.stats = recalcStats(store.proposals);
  store.lastSync = new Date().toISOString();

  const saveResult = await saveProposals(store);
  if (!saveResult.success) {
    return res.status(500).json({
      success: false,
      error: 'Failed to save proposals',
    });
  }

  return res.status(200).json({
    success: true,
    added,
    updated,
    total: store.proposals.length,
    stats: store.stats,
  });
}

/**
 * POST /api/admin/proposals/approve - Approve a proposal
 */
async function handleApprove(req, res) {
  const { id, reviewedBy = 'admin' } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Missing proposal id',
    });
  }

  const store = await loadProposals();
  const idx = store.proposals.findIndex(p => p.id === id);

  if (idx === -1) {
    return res.status(404).json({
      success: false,
      error: `Proposal ${id} not found`,
    });
  }

  store.proposals[idx] = {
    ...store.proposals[idx],
    status: 'approved',
    reviewedAt: new Date().toISOString(),
    reviewedBy,
  };

  store.stats = recalcStats(store.proposals);

  const saveResult = await saveProposals(store);
  if (!saveResult.success) {
    return res.status(500).json({
      success: false,
      error: 'Failed to save proposal',
    });
  }

  return res.status(200).json({
    success: true,
    proposal: store.proposals[idx],
  });
}

/**
 * POST /api/admin/proposals/reject - Reject a proposal with reason
 */
async function handleReject(req, res) {
  const { id, reason, reviewedBy = 'admin' } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Missing proposal id',
    });
  }

  if (!reason) {
    return res.status(400).json({
      success: false,
      error: 'Missing rejection reason',
    });
  }

  const store = await loadProposals();
  const idx = store.proposals.findIndex(p => p.id === id);

  if (idx === -1) {
    return res.status(404).json({
      success: false,
      error: `Proposal ${id} not found`,
    });
  }

  store.proposals[idx] = {
    ...store.proposals[idx],
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    reviewedBy,
    rejectionReason: reason,
  };

  store.stats = recalcStats(store.proposals);

  const saveResult = await saveProposals(store);
  if (!saveResult.success) {
    return res.status(500).json({
      success: false,
      error: 'Failed to save proposal',
    });
  }

  return res.status(200).json({
    success: true,
    proposal: store.proposals[idx],
  });
}

/**
 * POST /api/admin/proposals/applied - Mark proposals as applied
 */
async function handleApplied(req, res) {
  const { ids, commitHash } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Expected ids array in request body',
    });
  }

  const store = await loadProposals();
  let marked = 0;

  for (const id of ids) {
    const idx = store.proposals.findIndex(p => p.id === id);
    if (idx !== -1 && store.proposals[idx].status === 'approved') {
      store.proposals[idx] = {
        ...store.proposals[idx],
        status: 'applied',
        appliedAt: new Date().toISOString(),
        commitHash: commitHash || null,
      };
      marked++;
    }
  }

  store.stats = recalcStats(store.proposals);

  const saveResult = await saveProposals(store);
  if (!saveResult.success) {
    return res.status(500).json({
      success: false,
      error: 'Failed to save proposals',
    });
  }

  return res.status(200).json({
    success: true,
    marked,
  });
}

/**
 * GET /api/admin/proposals/patch - Download patch markdown
 */
async function handleGetPatch(req, res) {
  const store = await loadProposals();
  const approved = store.proposals.filter(p => p.status === 'approved');

  if (approved.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No approved proposals to generate patch',
      content: null,
    });
  }

  const timestamp = new Date().toISOString().split('T')[0];

  // Generate patch markdown
  let content = `# Proposal Application Document
Generated: ${new Date().toISOString()}
Total Approved Proposals: ${approved.length}

---

`;

  // Group by type
  const coverage = approved.filter(p => p.type === 'coverage');
  const updates = approved.filter(p => p.type === 'update');
  const newTests = approved.filter(p => p.type === 'new-test');

  content += `## Summary
- Coverage Updates: ${coverage.length}
- Test Updates: ${updates.length}
- New Tests: ${newTests.length}

---

`;

  // Coverage proposals
  if (coverage.length > 0) {
    content += `# Coverage Updates\n\n`;
    for (const p of coverage) {
      content += `## ${p.testName || 'Unknown Test'}

**Proposal ID:** \`${p.id}\`
**Payer:** ${p.payer}
**Status:** ${p.coverageStatus || 'covered'}
${p.conditions ? `**Conditions:** ${p.conditions}` : ''}
${p.effectiveDate ? `**Effective Date:** ${p.effectiveDate}` : ''}
**Confidence:** ${Math.round((p.confidence || 0.7) * 100)}%
**Source:** ${p.source}

${p.snippet ? `> ${p.snippet.slice(0, 300)}...` : ''}

### Action:
Find the test in data.js and add/update payer coverage:
\`\`\`javascript
{
  payer: "${p.payer}",
  status: "${p.coverageStatus || 'covered'}",
  ${p.conditions ? `conditions: "${p.conditions}",` : ''}
  ${p.effectiveDate ? `effectiveDate: "${p.effectiveDate}",` : ''}
  source: "${p.source}",
  updatedAt: "${timestamp}"
}
\`\`\`

---

`;
    }
  }

  // Update proposals
  if (updates.length > 0) {
    content += `# Test Updates\n\n`;
    for (const p of updates) {
      content += `## ${p.testName || 'Unknown Test'}

**Proposal ID:** \`${p.id}\`
**Confidence:** ${Math.round((p.confidence || 0.7) * 100)}%
**Source:** ${p.source}

### Changes:
\`\`\`json
${JSON.stringify(p.changes || {}, null, 2)}
\`\`\`

---

`;
    }
  }

  // New test proposals
  if (newTests.length > 0) {
    content += `# New Tests\n\n`;
    for (const p of newTests) {
      const td = p.testData || {};
      content += `## ${td.name || 'Unknown Test'}

**Proposal ID:** \`${p.id}\`
**Vendor:** ${td.vendor}
**Category:** ${td.category}
**Confidence:** ${Math.round((p.confidence || 0.6) * 100)}%
**Source:** ${p.source}

### Test Data:
\`\`\`json
${JSON.stringify(td, null, 2)}
\`\`\`

---

`;
    }
  }

  // After applying instructions
  content += `
# After Applying

1. Run \`npm run test:smoke\` to verify changes
2. Mark proposals as applied via UI or API
3. Commit with message: "feat(data): Apply daemon proposals ${timestamp}"

---

# Proposal IDs to Mark as Applied

${approved.map(p => `- ${p.id}`).join('\n')}
`;

  // Return as download or JSON
  if (req.query.download === 'true') {
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="proposals-${timestamp}.md"`);
    return res.status(200).send(content);
  }

  return res.status(200).json({
    success: true,
    filename: `proposals-${timestamp}.md`,
    content,
    proposalIds: approved.map(p => p.id),
  });
}
