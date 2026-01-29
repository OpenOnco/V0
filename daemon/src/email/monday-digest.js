/**
 * Monday Digest for Insurance Coverage Monitoring
 * Sends summary email with attached self-executing review file for Claude
 */

import { Resend } from 'resend';
import { readFileSync, existsSync } from 'fs';
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
 * Build the digest data object
 */
function buildDigestData() {
  const discoveries = loadDiscoveries();
  const health = loadHealth();
  const pending = discoveries.filter(d => d.status === 'pending');
  
  return {
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
}


/**
 * Generate self-executing review file for Claude
 * This file contains instructions + data - just upload and send
 */
function generateReviewAttachment(digest) {
  const { discoveries, summary, crawlerHealth, weekOf } = digest;
  
  return `# OpenOnco Coverage Review - Week of ${weekOf}

## Instructions
Review the coverage discoveries below. For each item:
1. I'll present the discovery with Claude's analysis
2. You respond: **approve**, **skip**, or ask questions
3. For approved items, I'll prepare the database update using the openonco-submission skill

## Summary
- **${summary.totalPending} discoveries** pending review
- CMS: ${summary.bySource.cms} | Payers: ${summary.bySource.payers} | Vendors: ${summary.bySource.vendor}

---

## Discoveries to Review

${discoveries.map((d, i) => `
### ${i + 1}. [${d.source.toUpperCase()}] ${d.title}

**URL:** ${d.url}
**Discovered:** ${new Date(d.discoveredAt).toLocaleDateString()}
**Type:** ${d.type}

**Claude Analysis:**
${d.summary || 'No analysis available'}

${d.data ? `**Details:**
\`\`\`json
${JSON.stringify(d.data, null, 2)}
\`\`\`` : ''}

---
`).join('\n')}

## Ready to Start
Let's begin! I'll present discovery #1. Reply with **approve**, **skip**, or ask questions.
`;
}

/**
 * Format duration in human readable form
 */
function formatDuration(ms) {
  if (!ms) return '-';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Format ISO time to readable string
 */
function formatTime(isoString) {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}


/**
 * Generate HTML email (summary + stats only)
 */
function generateEmailHtml(digest) {
  const { summary, crawlerHealth, weekOf } = digest;
  
  const statusEmoji = (status) => {
    if (status === 'success') return '✅';
    if (status === 'error') return '❌';
    return '⏸️';
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
    <p style="color: #666; font-size: 13px; margin: 0 0 20px 0;">Week of ${weekOf}</p>

    <!-- Summary -->
    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 24px;">
      <div style="font-size: 36px; font-weight: 700; color: #166534;">${summary.totalPending}</div>
      <div style="font-size: 14px; color: #666;">discoveries pending review</div>
      <div style="font-size: 13px; color: #888; margin-top: 8px;">
        CMS: ${summary.bySource.cms} · Payers: ${summary.bySource.payers} · Vendors: ${summary.bySource.vendor}
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

    <!-- Instructions -->
    <div style="background: #eff6ff; border: 1px dashed #3b82f6; border-radius: 8px; padding: 16px;">
      <div style="font-size: 12px; font-weight: 600; color: #1d4ed8; text-transform: uppercase; margin-bottom: 8px;">📎 Review Attachment</div>
      <p style="font-size: 13px; color: #374151; margin: 0;">
        Upload the attached <strong>coverage-review.md</strong> file to Claude and hit send to start the review.
      </p>
    </div>

    <p style="font-size: 11px; color: #999; margin-top: 24px; text-align: center;">
      OpenOnco Coverage Intelligence · ${new Date().toLocaleString()}
    </p>
  </div>
</body>
</html>
  `.trim();
}


/**
 * Generate plain text email
 */
function generateEmailText(digest) {
  const { summary, crawlerHealth, weekOf } = digest;
  
  let text = `
OPENONCO COVERAGE DIGEST
Week of ${weekOf}
═══════════════════════════════════════

${summary.totalPending} DISCOVERIES PENDING REVIEW
CMS: ${summary.bySource.cms} | Payers: ${summary.bySource.payers} | Vendors: ${summary.bySource.vendor}

CRAWLER RUN STATS
───────────────────────────────────────
`;

  ['cms', 'payers', 'vendor'].forEach(source => {
    const health = crawlerHealth[source] || {};
    const name = source === 'cms' ? 'CMS/Medicare' : source === 'payers' ? 'Private Payers' : 'Vendors';
    const status = health.status === 'success' ? '✓' : health.status === 'error' ? '✗' : '?';
    text += `${status} ${name}: ${formatTime(health.lastRun)} (${formatDuration(health.duration)}) - ${health.discoveriesFound || 0} found, ${health.discoveriesAdded || 0} new\n`;
  });

  text += `
───────────────────────────────────────
Upload the attached coverage-review.md file to Claude and hit send to start the review.
`;

  return text.trim();
}

/**
 * Send the Monday digest email with attachment
 */
export async function sendMondayDigest() {
  logger.info('Preparing Monday digest email');

  const digest = buildDigestData();

  if (!config.email.apiKey) {
    logger.warn('RESEND_API_KEY not configured, skipping email');
    return { success: false, reason: 'no_api_key', digest };
  }

  const resend = new Resend(config.email.apiKey);
  
  const subject = digest.summary.totalPending > 0
    ? `[OpenOnco] ${digest.summary.totalPending} coverage updates to review`
    : `[OpenOnco] Weekly digest - no new updates`;

  // Generate the self-executing review file
  const reviewContent = generateReviewAttachment(digest);
  const attachmentContent = Buffer.from(reviewContent).toString('base64');

  try {
    const result = await resend.emails.send({
      from: config.email.from,
      to: config.email.to,
      subject,
      html: generateEmailHtml(digest),
      text: generateEmailText(digest),
      attachments: [
        {
          filename: 'coverage-review.md',
          content: attachmentContent,
        }
      ]
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

export default { sendMondayDigest };
