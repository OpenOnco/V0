/**
 * GitHub export module for daemon discoveries
 * Writes triaged discoveries as a markdown file and commits to the repo via GitHub API
 *
 * Requires GITHUB_TOKEN env var with repo write access
 */

import { createLogger } from '../utils/logger.js';

const logger = createLogger('github-export');

const GITHUB_OWNER = process.env.GITHUB_OWNER || 'alexdick';
const GITHUB_REPO = process.env.GITHUB_REPO || 'V0';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/**
 * Get today's date in YYYY-MM-DD format
 */
function getDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Format a single discovery as markdown
 */
function formatDiscovery(discovery, index) {
  const lines = [];
  const title = discovery.title || discovery.action || 'Untitled';
  const source = discovery.source || discovery.sourceUrl || 'Unknown';

  lines.push(`### ${index + 1}. ${title}`);
  lines.push('');

  // Metadata table
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');

  if (discovery.classification) {
    lines.push(`| Classification | ${discovery.classification} |`);
  }
  if (discovery.confidence) {
    lines.push(`| Confidence | ${discovery.confidence} |`);
  }
  if (discovery.source) {
    lines.push(`| Source | ${discovery.source} |`);
  }
  if (discovery.sourceUrl) {
    lines.push(`| URL | ${discovery.sourceUrl} |`);
  }
  if (discovery.testId) {
    lines.push(`| Test ID | ${discovery.testId} |`);
  }
  if (discovery.testCategory) {
    lines.push(`| Category | ${discovery.testCategory} |`);
  }
  if (discovery.affectedTests?.length > 0) {
    lines.push(`| Affected Tests | ${discovery.affectedTests.join(', ')} |`);
  }

  lines.push('');

  // Summary / reasoning
  if (discovery.summary) {
    lines.push(`**Summary:** ${discovery.summary}`);
    lines.push('');
  }
  if (discovery.reasoning) {
    lines.push(`**Reasoning:** ${discovery.reasoning}`);
    lines.push('');
  }
  if (discovery.evidence) {
    lines.push(`> ${discovery.evidence}`);
    lines.push('');
  }

  // Action command block (for Claude Code to process)
  if (discovery.actionCommand || discovery.action) {
    lines.push('<details>');
    lines.push('<summary>Action Command</summary>');
    lines.push('');
    lines.push('```');
    lines.push(discovery.actionCommand || discovery.action);
    lines.push('```');
    lines.push('</details>');
    lines.push('');
  }

  // Field updates
  if (discovery.fieldUpdates && Object.keys(discovery.fieldUpdates).length > 0) {
    lines.push('<details>');
    lines.push('<summary>Field Updates</summary>');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(discovery.fieldUpdates, null, 2));
    lines.push('```');
    lines.push('</details>');
    lines.push('');
  }

  // Raw data for machine processing
  lines.push('<details>');
  lines.push('<summary>Raw Data (JSON)</summary>');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(discovery, null, 2));
  lines.push('```');
  lines.push('</details>');
  lines.push('');

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate the full markdown file content from triage results
 * @param {Object} triageResults - Results from triageDiscoveries()
 * @returns {string} Markdown content
 */
export function generateDiscoveriesMarkdown(triageResults) {
  const date = getDateString();
  const lines = [];

  const high = triageResults.highPriority || [];
  const medium = triageResults.mediumPriority || [];
  const low = triageResults.lowPriority || [];
  const actions = triageResults.actions || [];
  const metadata = triageResults.metadata || {};

  lines.push(`# OpenOnco Daemon Discoveries - ${date}`);
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Input count: ${metadata.inputCount || 0}`);
  lines.push(`> Triage cost: $${metadata.costs?.totalCost || '0.0000'} (${metadata.costs?.apiCalls || 0} API calls)`);
  lines.push('');

  // Summary counts
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Priority | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| HIGH | ${high.length} |`);
  lines.push(`| MEDIUM | ${medium.length} |`);
  lines.push(`| LOW | ${low.length} |`);
  lines.push(`| Actions generated | ${actions.length} |`);
  lines.push('');

  // High priority
  lines.push('## HIGH Priority');
  lines.push('');
  if (high.length > 0) {
    high.forEach((item, idx) => {
      lines.push(formatDiscovery(item, idx));
    });
  } else {
    lines.push('_No high priority discoveries._');
    lines.push('');
  }

  // Medium priority
  lines.push('## MEDIUM Priority');
  lines.push('');
  if (medium.length > 0) {
    medium.forEach((item, idx) => {
      lines.push(formatDiscovery(item, idx));
    });
  } else {
    lines.push('_No medium priority discoveries._');
    lines.push('');
  }

  // Low priority
  lines.push('## LOW Priority');
  lines.push('');
  if (low.length > 0) {
    low.forEach((item, idx) => {
      lines.push(formatDiscovery(item, idx));
    });
  } else {
    lines.push('_No low priority discoveries._');
    lines.push('');
  }

  // Generated actions
  if (actions.length > 0) {
    lines.push('## Generated Actions');
    lines.push('');
    lines.push('These are copy-paste commands for updating `src/data.js`:');
    lines.push('');
    actions.forEach((action, idx) => {
      lines.push(`### Action ${idx + 1}`);
      lines.push('');
      if (action.testId) {
        lines.push(`- **Test:** ${action.testName || action.testId}`);
      }
      if (action.confidence) {
        lines.push(`- **Confidence:** ${action.confidence}`);
      }
      if (action.actionCommand) {
        lines.push('');
        lines.push('```');
        lines.push(action.actionCommand);
        lines.push('```');
      }
      if (action.fieldUpdates && Object.keys(action.fieldUpdates).length > 0) {
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(action.fieldUpdates, null, 2));
        lines.push('```');
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

/**
 * Export discoveries to GitHub as a markdown file
 * Uses the GitHub Contents API to create/update a file
 *
 * @param {Object} triageResults - Results from triageDiscoveries()
 * @returns {Object} { success, url, sha, path }
 */
export async function exportToGitHub(triageResults) {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }

  const date = getDateString();
  const filePath = `docs/daemon-discoveries/${date}.md`;
  const content = generateDiscoveriesMarkdown(triageResults);
  const contentBase64 = Buffer.from(content, 'utf-8').toString('base64');

  const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`;

  logger.info('Exporting discoveries to GitHub', { filePath, date });

  // Check if file already exists (to get its SHA for update)
  let existingSha = null;
  try {
    const checkResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (checkResponse.ok) {
      const existing = await checkResponse.json();
      existingSha = existing.sha;
      logger.info('File already exists, will update', { sha: existingSha });
    }
  } catch {
    // File doesn't exist yet, that's fine
  }

  // Create or update the file
  const body = {
    message: `chore(daemon): Export discoveries for ${date}`,
    content: contentBase64,
    branch: GITHUB_BRANCH,
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('GitHub API error', { status: response.status, body: errorText });
    throw new Error(`GitHub API returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const fileUrl = result.content?.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${filePath}`;

  logger.info('Discoveries exported to GitHub', { url: fileUrl, sha: result.content?.sha });

  return {
    success: true,
    url: fileUrl,
    sha: result.content?.sha,
    path: filePath,
    date,
  };
}

/**
 * Get the GitHub URL for a given date's discoveries file
 * @param {string} date - Date in YYYY-MM-DD format (defaults to today)
 * @returns {string} GitHub URL
 */
export function getDiscoveriesUrl(date) {
  const d = date || getDateString();
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/docs/daemon-discoveries/${d}.md`;
}

export default {
  generateDiscoveriesMarkdown,
  exportToGitHub,
  getDiscoveriesUrl,
};
