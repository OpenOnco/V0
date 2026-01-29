/**
 * Simplified Monday Digest for Insurance Coverage Monitoring
 * Sends a brief summary email and writes a digest file for Claude to read
 */

import { Resend } from 'resend';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';
import { createLogger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../../data');

const logger = createLogger('monday-digest');

/**
 * Load discoveries from the queue
 */
function loadDiscoveries() {
  const path = join(DATA_DIR, 'discoveries.json');
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * Load crawler health data
 */
function loadHealth() {
  const path = join(DATA_DIR, 'health.json');
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/**
 * Generate the weekly digest file for Claude to read
 */
export function generateDigestFile() {
  const discoveries = loadDiscoveries();
  const health = loadHealth();
  const pending = discoveries.filter(d => d.status === 'pending');
  
  const digest = {
    generatedAt: new Date().toISOString(),
    weekOf: getWeekDate(),
    summary: {
      totalPending: pending.length,
      bySource: {
        cms: pending.filter(d => d.source === 'cms').length,
        payers: pending.filter(d => d.source === 'payers').length,
        vendor: pending.filter(d => d.source === 'vendor').length,
      }
    },
    crawlerHealth: {
      cms: health.crawlers?.cms || null,
      payers: health.crawlers?.payers || null,
      vendor: health.crawlers?.vendor || null,
    },
    discoveries: pending.map(d => ({
      id: d.id,
      source: d.source,
      type: d.type,
      title: d.title,
      summary: d.summary,
      url: d.url,
      discoveredAt: d.discoveredAt,
      data: d.data
    }))
  };

  const digestPath = join(DATA_DIR, 'weekly-digest.json');
  writeFileSync(digestPath, JSON.stringify(digest, null, 2), 'utf-8');
  logger.info('Generated weekly digest file', { path: digestPath, count: pending.length });
  
  return digest;
}

/**
 * Get Monday of current week as YYYY-MM-DD
 */
function getWeekDate() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Generate brief HTML email
 */
function generateEmailHtml(digest) {
  const { summary, discoveries, crawlerHealth } = digest;
  
  const statusEmoji = (status) => {
    if (status === 'success') return '✅';
    if (status === 'error') return '❌';
    return '⏸️';
  };

  const formatDuration = (ms) => {
    if (!ms) return '-';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const crawlerRows = ['cms', 'payers', 'vendor'].map(source => {
    const health = crawlerHealth[source] || {};
    const name = source === 'cms' ? 'CMS/Medicare' : source === 'payers' ? 'Private Payers' : 'Vendors';
    return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">
          ${statusEmoji(health.status)} <strong>${name}</strong>
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; color: #666;">
          ${formatTime(health.lastRun)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-align: center;">
          ${formatDuration(health.duration)}
        </td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 13px; text-align: center;">
          ${health.discoveriesFound || 0} found / ${health.discoveriesAdded || 0} new
        </td>
      </tr>
    `;
  }).join('');

  const discoveryRows = discoveries.slice(0, 10).map(d => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee; vertical-align: top;">
        <span style="display: inline-block; background: ${d.source === 'cms' ? '#dbeafe' : d.source === 'payers' ? '#fef3c7' : '#d1fae5'}; color: ${d.source === 'cms' ? '#1e40af' : d.source === 'payers' ? '#92400e' : '#065f46'}; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
          ${d.source}
        </span>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">
        <a href="${d.url}" style="color: #2563eb; text-decoration: none; font-size: 14px; font-weight: 500;">
          ${d.title}
        </a>
        ${d.summary ? `
        <div style="font-size: 13px; color: #374151; margin-top: 8px; line-height: 1.5; background: #f9fafb; padding: 10px; border-radius: 4px; border-left: 3px solid #d1d5db;">
          ${d.summary}
        </div>
        ` : ''}
        ${d.data?.affectedTests ? `
        <div style="font-size: 12px; color: #6b7280; margin-top: 6px;">
          <strong>Affected tests:</strong> ${Array.isArray(d.data.affectedTests) ? d.data.affectedTests.join(', ') : d.data.affectedTests}
        </div>
        ` : ''}
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    
    <h1 style="font-size: 20px; margin: 0 0 4px 0;">🔬 OpenOnco Coverage Digest</h1>
    <p style="color: #666; font-size: 13px; margin: 0 0 20px 0;">Week of ${digest.weekOf}</p>

    <!-- Summary Stats -->
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center;">
        <div style="font-size: 28px; font-weight: 700; color: #166534;">${summary.totalPending}</div>
        <div style="font-size: 12px; color: #666; text-transform: uppercase;">Pending Review</div>
      </div>
      <div style="flex: 1; background: #f8f9fa; padding: 16px; border-radius: 8px;">
        <div style="font-size: 12px; color: #666; margin-bottom: 8px;">By Source:</div>
        <div style="font-size: 13px;">
          CMS: <strong>${summary.bySource.cms}</strong> · 
          Payers: <strong>${summary.bySource.payers}</strong> · 
          Vendors: <strong>${summary.bySource.vendor}</strong>
        </div>
      </div>
    </div>

    <!-- Crawler Run Stats -->
    <div style="margin-bottom: 24px;">
      <div style="font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 8px;">Crawler Run Stats</div>
      <table style="width: 100%; border-collapse: collapse; background: #f8f9fa; border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background: #e5e7eb;">
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666;">Source</th>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666;">Last Run</th>
            <th style="padding: 8px 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: #666;">Duration</th>
            <th style="padding: 8px 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: #666;">Discoveries</th>
          </tr>
        </thead>
        <tbody>
          ${crawlerRows}
        </tbody>
      </table>
    </div>

    ${discoveries.length > 0 ? `
    <!-- Discoveries Table -->
    <h2 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; margin: 0 0 12px 0;">
      Pending Discoveries
    </h2>
    <table style="width: 100%; border-collapse: collapse;">
      ${discoveryRows}
    </table>
    ${discoveries.length > 10 ? `<p style="font-size: 12px; color: #888; margin-top: 8px;">+ ${discoveries.length - 10} more...</p>` : ''}
    ` : `
    <p style="color: #888; font-style: italic; text-align: center; padding: 20px;">
      No new discoveries this week
    </p>
    `}

    <!-- Action Box -->
    <div style="margin-top: 24px; padding: 16px; background: #eff6ff; border: 1px dashed #3b82f6; border-radius: 8px;">
      <div style="font-size: 12px; font-weight: 600; color: #1d4ed8; text-transform: uppercase; margin-bottom: 8px;">
        To Review
      </div>
      <p style="font-size: 13px; color: #374151; margin: 0 0 12px 0;">
        Open Claude and paste this prompt:
      </p>
      <code style="display: block; background: #1e293b; color: #e2e8f0; padding: 12px; border-radius: 4px; font-size: 13px; line-height: 1.5;">Review coverage discoveries. Read daemon/data/weekly-digest.json, walk me through each pending item for approve/skip, then apply approved changes to the database.</code>
    </div>

    <p style="font-size: 11px; color: #999; margin-top: 24px; text-align: center;">
      OpenOnco Coverage Intelligence · Digest generated ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version
 */
function generateEmailText(digest) {
  const { summary, discoveries, weekOf, crawlerHealth } = digest;
  
  const formatDuration = (ms) => {
    if (!ms) return '-';
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };
  
  let text = `
OPENONCO COVERAGE DIGEST
Week of ${weekOf}
═══════════════════════════════════════

SUMMARY
• ${summary.totalPending} discoveries pending review
• CMS: ${summary.bySource.cms} | Payers: ${summary.bySource.payers} | Vendors: ${summary.bySource.vendor}

CRAWLER RUN STATS
───────────────────────────────────────
`;

  ['cms', 'payers', 'vendor'].forEach(source => {
    const health = crawlerHealth[source] || {};
    const name = source === 'cms' ? 'CMS/Medicare' : source === 'payers' ? 'Private Payers' : 'Vendors';
    const status = health.status === 'success' ? '✓' : health.status === 'error' ? '✗' : '?';
    text += `${status} ${name}\n`;
    text += `  Last run: ${formatTime(health.lastRun)}\n`;
    text += `  Duration: ${formatDuration(health.duration)} | Found: ${health.discoveriesFound || 0} | New: ${health.discoveriesAdded || 0}\n\n`;
  });

  if (discoveries.length > 0) {
    text += `DISCOVERIES\n───────────────────────────────────────\n`;
    discoveries.slice(0, 10).forEach((d, i) => {
      text += `${i + 1}. [${d.source.toUpperCase()}] ${d.title}\n`;
      text += `   ${d.url}\n`;
      if (d.summary) {
        text += `   ${d.summary}\n`;
      }
      text += `\n`;
    });
    if (discoveries.length > 10) {
      text += `... and ${discoveries.length - 10} more\n`;
    }
  } else {
    text += `No new discoveries this week.\n`;
  }

  text += `
───────────────────────────────────────
To review, open Claude and paste:
"Review coverage discoveries. Read daemon/data/weekly-digest.json, walk me through each pending item for approve/skip, then apply approved changes to the database."
`;

  return text.trim();
}

/**
 * Send the Monday digest email
 */
export async function sendMondayDigest() {
  logger.info('Preparing Monday digest email');

  // Generate digest file first
  const digest = generateDigestFile();

  // Send email
  if (!config.email.apiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping email');
    return { success: false, reason: 'no_api_key', digest };
  }

  const resend = new Resend(config.email.apiKey);
  
  const subject = digest.summary.totalPending > 0
    ? `[OpenOnco] ${digest.summary.totalPending} coverage updates to review`
    : `[OpenOnco] Weekly digest - no new updates`;

  try {
    const result = await resend.emails.send({
      from: config.email.from,
      to: config.email.to,
      subject,
      html: generateEmailHtml(digest),
      text: generateEmailText(digest),
    });

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    logger.info('Monday digest sent', { 
      to: config.email.to, 
      messageId: result.data?.id,
      pendingCount: digest.summary.totalPending
    });

    return {
      success: true,
      messageId: result.data?.id,
      digest
    };
  } catch (error) {
    logger.error('Failed to send Monday digest', { error });
    throw error;
  }
}

export default { sendMondayDigest, generateDigestFile };
