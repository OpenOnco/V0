/**
 * Email templates for the daemon digest
 */

import { config } from '../config.js';

/**
 * Format a date for display
 */
function formatDate(dateString) {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Get status emoji
 */
function getStatusEmoji(status) {
  switch (status) {
    case 'success':
      return '✅';
    case 'error':
      return '❌';
    case 'running':
      return '🔄';
    default:
      return '⏸️';
  }
}

/**
 * Get relevance badge
 */
function getRelevanceBadge(relevance) {
  switch (relevance) {
    case 'high':
      return '🔴 HIGH';
    case 'medium':
      return '🟡 MEDIUM';
    default:
      return '🟢 LOW';
  }
}

/**
 * Generate the daily digest HTML email
 */
export function generateDigestHtml({ healthSummary, discoveries, queueStatus }) {
  const discoveryCount = Object.values(discoveries).flat().length;
  const hasErrors = healthSummary.recentErrorCount > 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenOnco Intelligence Digest</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.5;
      color: #1a1a1a;
      max-width: 680px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 8px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 24px;
      margin: 0 0 8px 0;
      color: #111;
    }
    .subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .section {
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #eee;
    }
    .section:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: #333;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .stat-box {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #111;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .crawler-row {
      display: flex;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .crawler-row:last-child {
      border-bottom: none;
    }
    .crawler-name {
      flex: 1;
      font-weight: 500;
    }
    .crawler-status {
      font-size: 13px;
      color: #666;
    }
    .discovery-group {
      margin-bottom: 16px;
    }
    .discovery-source {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #666;
      margin-bottom: 8px;
    }
    .discovery-item {
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 8px;
    }
    .discovery-title {
      font-weight: 500;
      margin-bottom: 4px;
    }
    .discovery-title a {
      color: #0066cc;
      text-decoration: none;
    }
    .discovery-title a:hover {
      text-decoration: underline;
    }
    .discovery-summary {
      font-size: 13px;
      color: #555;
      margin-bottom: 4px;
    }
    .discovery-meta {
      font-size: 11px;
      color: #888;
    }
    .badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 3px;
      margin-right: 4px;
    }
    .badge-high { background: #fee2e2; color: #dc2626; }
    .badge-medium { background: #fef3c7; color: #d97706; }
    .badge-low { background: #d1fae5; color: #059669; }
    .error-list {
      background: #fef2f2;
      border-radius: 6px;
      padding: 12px;
    }
    .error-item {
      font-size: 13px;
      color: #b91c1c;
      margin-bottom: 4px;
    }
    .error-item:last-child {
      margin-bottom: 0;
    }
    .no-items {
      color: #888;
      font-style: italic;
      font-size: 14px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #888;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 OpenOnco Intelligence Digest</h1>
    <div class="subtitle">${formatDate(new Date().toISOString())}</div>

    <!-- Summary Stats -->
    <div class="section">
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-value">${discoveryCount}</div>
          <div class="stat-label">New Discoveries</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${queueStatus.pendingCount}</div>
          <div class="stat-label">Pending Review</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">${hasErrors ? '⚠️' : '✅'}</div>
          <div class="stat-label">${hasErrors ? `${healthSummary.recentErrorCount} Errors` : 'Healthy'}</div>
        </div>
      </div>
    </div>

    <!-- Crawler Health -->
    <div class="section">
      <div class="section-title">📊 Crawler Status</div>
      ${
        healthSummary.crawlers.length > 0
          ? healthSummary.crawlers
              .map(
                (crawler) => `
        <div class="crawler-row">
          <span class="crawler-name">${getStatusEmoji(crawler.status)} ${config.crawlers[crawler.source]?.name || crawler.source}</span>
          <span class="crawler-status">Last: ${formatDate(crawler.lastSuccess)}</span>
        </div>
      `
              )
              .join('')
          : '<div class="no-items">No crawler data yet</div>'
      }
    </div>

    <!-- New Discoveries -->
    <div class="section">
      <div class="section-title">🔍 New Discoveries</div>
      ${
        discoveryCount > 0
          ? Object.entries(discoveries)
              .filter(([_, items]) => items.length > 0)
              .map(
                ([source, items]) => `
        <div class="discovery-group">
          <div class="discovery-source">${config.crawlers[source]?.name || source} (${items.length})</div>
          ${items
            .slice(0, 5)
            .map(
              (item) => `
            <div class="discovery-item">
              <div class="discovery-title">
                <span class="badge badge-${item.relevance}">${item.relevance.toUpperCase()}</span>
                <a href="${item.url}" target="_blank">${item.title}</a>
              </div>
              <div class="discovery-summary">${item.summary?.substring(0, 200)}${item.summary?.length > 200 ? '...' : ''}</div>
              <div class="discovery-meta">Found: ${formatDate(item.discoveredAt)}</div>
            </div>
          `
            )
            .join('')}
          ${items.length > 5 ? `<div class="no-items">+ ${items.length - 5} more...</div>` : ''}
        </div>
      `
              )
              .join('')
          : '<div class="no-items">No new discoveries today</div>'
      }
    </div>

    <!-- Recent Errors -->
    ${
      healthSummary.recentErrorCount > 0
        ? `
    <div class="section">
      <div class="section-title">⚠️ Recent Errors (${healthSummary.recentErrorCount})</div>
      <div class="error-list">
        ${healthSummary.recentErrors
          .map(
            (error) => `
          <div class="error-item">
            <strong>${error.source}:</strong> ${error.message}
            <br><small>${formatDate(error.timestamp)}</small>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
    `
        : ''
    }

    <div class="footer">
      Daemon uptime: ${healthSummary.uptime} · Digests sent: ${healthSummary.digestsSent + 1}
      <br>
      OpenOnco Intelligence Daemon v1.0
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of the digest
 */
export function generateDigestText({ healthSummary, discoveries, queueStatus }) {
  const lines = [];
  const discoveryCount = Object.values(discoveries).flat().length;

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  OPENONCO INTELLIGENCE DIGEST');
  lines.push(`  ${formatDate(new Date().toISOString())}`);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');

  // Summary
  lines.push('SUMMARY');
  lines.push('───────────────────────────────────────────────────────────');
  lines.push(`• New discoveries: ${discoveryCount}`);
  lines.push(`• Pending review: ${queueStatus.pendingCount}`);
  lines.push(`• Recent errors: ${healthSummary.recentErrorCount}`);
  lines.push('');

  // Crawler Status
  lines.push('CRAWLER STATUS');
  lines.push('───────────────────────────────────────────────────────────');
  if (healthSummary.crawlers.length > 0) {
    for (const crawler of healthSummary.crawlers) {
      const name = config.crawlers[crawler.source]?.name || crawler.source;
      const status = getStatusEmoji(crawler.status);
      lines.push(`${status} ${name}: Last success ${formatDate(crawler.lastSuccess)}`);
    }
  } else {
    lines.push('No crawler data yet');
  }
  lines.push('');

  // Discoveries
  lines.push('NEW DISCOVERIES');
  lines.push('───────────────────────────────────────────────────────────');
  if (discoveryCount > 0) {
    for (const [source, items] of Object.entries(discoveries)) {
      if (items.length === 0) continue;

      const name = config.crawlers[source]?.name || source;
      lines.push(`\n[${name}] (${items.length} items)`);

      for (const item of items.slice(0, 5)) {
        lines.push(`  ${getRelevanceBadge(item.relevance)}`);
        lines.push(`  ${item.title}`);
        lines.push(`  ${item.url}`);
        lines.push('');
      }
      if (items.length > 5) {
        lines.push(`  ... and ${items.length - 5} more`);
      }
    }
  } else {
    lines.push('No new discoveries today');
  }
  lines.push('');

  // Errors
  if (healthSummary.recentErrorCount > 0) {
    lines.push('RECENT ERRORS');
    lines.push('───────────────────────────────────────────────────────────');
    for (const error of healthSummary.recentErrors) {
      lines.push(`• ${error.source}: ${error.message}`);
      lines.push(`  ${formatDate(error.timestamp)}`);
    }
    lines.push('');
  }

  // Footer
  lines.push('───────────────────────────────────────────────────────────');
  lines.push(`Daemon uptime: ${healthSummary.uptime}`);
  lines.push(`Digests sent: ${healthSummary.digestsSent + 1}`);

  return lines.join('\n');
}

/**
 * Generate subject line for digest
 */
export function generateDigestSubject({ discoveries, healthSummary }) {
  const discoveryCount = Object.values(discoveries).flat().length;
  const hasErrors = healthSummary.recentErrorCount > 0;

  const parts = [];

  if (discoveryCount > 0) {
    parts.push(`${discoveryCount} new discoveries`);
  } else {
    parts.push('No new discoveries');
  }

  if (hasErrors) {
    parts.push(`⚠️ ${healthSummary.recentErrorCount} errors`);
  }

  return `[OpenOnco Daemon] ${parts.join(' · ')}`;
}

export default {
  generateDigestHtml,
  generateDigestText,
  generateDigestSubject,
};
