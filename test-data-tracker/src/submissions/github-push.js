/**
 * Push weekly submissions file to GitHub via Contents API.
 * Used by the scheduler to trigger the auto-triage GitHub Action.
 *
 * Requires GITHUB_TOKEN env var (PAT with contents:write on V0 repo).
 */

import { readFileSync } from 'fs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('github-push');

const OWNER = 'adickinson';
const REPO = 'V0';
const BRANCH = 'develop';

/**
 * Push a file to GitHub via the Contents API.
 * Creates or updates the file at the given repo path.
 *
 * @param {string} localPath - Absolute path to the local file
 * @param {string} repoPath - Path within the repo (e.g., 'test-data-tracker/data/submissions/weekly-2026-02-09.json')
 * @param {string} message - Commit message
 */
export async function pushFileToGitHub(localPath, repoPath, message) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    logger.warn('GITHUB_TOKEN not set, skipping GitHub push');
    return { pushed: false, reason: 'no token' };
  }

  const content = readFileSync(localPath, 'utf-8');
  const contentBase64 = Buffer.from(content).toString('base64');

  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${repoPath}`;

  // Check if file already exists (need SHA for update)
  let existingSha = null;
  try {
    const getResponse = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (getResponse.ok) {
      const data = await getResponse.json();
      existingSha = data.sha;
      logger.info('File exists, will update', { repoPath, sha: existingSha });
    }
  } catch (err) {
    logger.debug('File does not exist yet, will create', { repoPath });
  }

  // Create or update the file
  const body = {
    message,
    content: contentBase64,
    branch: BRANCH,
  };
  if (existingSha) {
    body.sha = existingSha;
  }

  const response = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('GitHub push failed', { status: response.status, body: errorText });
    throw new Error(`GitHub push failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  logger.info('File pushed to GitHub', {
    repoPath,
    sha: result.content?.sha,
    commit: result.commit?.sha?.substring(0, 7),
  });

  return { pushed: true, sha: result.content?.sha, commit: result.commit?.sha };
}
