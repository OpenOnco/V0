/**
 * Diff Utilities
 * Simple line-based diffing for content change detection
 */

/**
 * Compute a simple line-based diff between old and new content
 * Returns the key changes suitable for Claude analysis
 * @param {string} oldText - Previous content
 * @param {string} newText - Current content
 * @param {number} maxLines - Maximum lines to return per category (default 50)
 * @returns {Object} Diff result with added, removed lines and metadata
 */
export function computeDiff(oldText, newText, maxLines = 50) {
  if (!oldText) return { isFirstCrawl: true, diff: null };

  const oldLines = oldText.split('\n').map(l => l.trim()).filter(Boolean);
  const newLines = newText.split('\n').map(l => l.trim()).filter(Boolean);

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const added = newLines.filter(l => !oldSet.has(l));
  const removed = oldLines.filter(l => !newSet.has(l));

  // Truncate if too many changes
  const truncatedAdded = added.slice(0, maxLines);
  const truncatedRemoved = removed.slice(0, maxLines);

  // Find lines that might be "changed" (similar but not identical)
  // Simple heuristic: lines that start the same but differ
  const changed = [];
  for (const newLine of truncatedAdded) {
    const newStart = newLine.slice(0, 30).toLowerCase();
    for (const oldLine of truncatedRemoved) {
      const oldStart = oldLine.slice(0, 30).toLowerCase();
      if (newStart === oldStart && newLine !== oldLine) {
        changed.push({
          old: oldLine,
          new: newLine,
        });
        break;
      }
    }
  }

  // Generate summary
  const summaryParts = [];
  if (added.length > 0) {
    summaryParts.push(`${added.length} lines added`);
  }
  if (removed.length > 0) {
    summaryParts.push(`${removed.length} lines removed`);
  }
  if (changed.length > 0) {
    summaryParts.push(`${changed.length} lines modified`);
  }
  const summary = summaryParts.length > 0
    ? summaryParts.join(', ')
    : 'No significant changes detected';

  return {
    isFirstCrawl: false,
    added: truncatedAdded,
    removed: truncatedRemoved,
    changed,
    addedCount: added.length,
    removedCount: removed.length,
    truncated: added.length > maxLines || removed.length > maxLines,
    summary,
  };
}

/**
 * Format diff for Claude prompt (max ~4000 chars by default)
 * @param {Object} diff - Diff result from computeDiff
 * @param {number} maxChars - Maximum total characters (default 4000)
 * @returns {string|null} Formatted diff string, truncated if needed, or null if first crawl
 */
export function formatDiffForPrompt(diff, maxChars = 4000) {
  if (diff.isFirstCrawl) return null;

  let result = '';

  if (diff.removed.length > 0) {
    result += 'REMOVED CONTENT:\n';
    result += diff.removed.map(l => `- ${l}`).join('\n');
    result += '\n\n';
  }

  if (diff.added.length > 0) {
    result += 'ADDED CONTENT:\n';
    result += diff.added.map(l => `+ ${l}`).join('\n');
  }

  if (diff.truncated) {
    result += `\n\n[Diff truncated. Total: ${diff.addedCount} added, ${diff.removedCount} removed lines]`;
  }

  // Truncate to max chars
  if (result.length > maxChars) {
    result = result.slice(0, maxChars) + '\n[...truncated]';
  }

  return result;
}

/**
 * Truncate diff output for Claude context (alias for formatDiffForPrompt with different default)
 * @param {Object} diff - Diff result from computeDiff
 * @param {number} maxChars - Maximum total characters (default 5000)
 * @returns {string} Formatted diff string, truncated if needed
 */
export function truncateDiff(diff, maxChars = 5000) {
  // Handle first crawl case
  if (diff.isFirstCrawl) return 'First crawl - no previous content to compare';

  const lines = [];

  // Add summary
  lines.push(`CHANGES SUMMARY: ${diff.summary}`);
  lines.push('');

  // Add removed lines (prefixed with -)
  if (diff.removed.length > 0) {
    lines.push('REMOVED:');
    for (const line of diff.removed.slice(0, 50)) { // Limit to 50 lines each
      lines.push(`- ${line}`);
    }
    if (diff.removedCount > 50) {
      lines.push(`... and ${diff.removedCount - 50} more removed lines`);
    }
    lines.push('');
  }

  // Add added lines (prefixed with +)
  if (diff.added.length > 0) {
    lines.push('ADDED:');
    for (const line of diff.added.slice(0, 50)) {
      lines.push(`+ ${line}`);
    }
    if (diff.addedCount > 50) {
      lines.push(`... and ${diff.addedCount - 50} more added lines`);
    }
    lines.push('');
  }

  // Add changed lines
  if (diff.changed && diff.changed.length > 0) {
    lines.push('MODIFIED:');
    for (const change of diff.changed.slice(0, 20)) {
      lines.push(`- ${change.old}`);
      lines.push(`+ ${change.new}`);
    }
    if (diff.changed.length > 20) {
      lines.push(`... and ${diff.changed.length - 20} more modified lines`);
    }
    lines.push('');
  }

  let result = lines.join('\n');

  // Truncate if too long
  if (result.length > maxChars) {
    result = result.slice(0, maxChars - 50) + '\n\n... [diff truncated]';
  }

  return result;
}
