/**
 * Local markdown export for daemon discoveries
 * Reads discoveries from queue, writes a markdown file organized by priority then source.
 * Each discovery is formatted with clear delimiters for chunked processing by Claude Code.
 *
 * Usage: import { exportDiscoveriesToMarkdown } from './markdown-export.js'
 *        const filepath = await exportDiscoveriesToMarkdown()
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getUnreviewed, getAllDiscoveriesGroupedBySource, getQueueStatus } from '../queue/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EXPORT_DIR = join(__dirname, '../../data/exports');

/**
 * Get today's date in YYYY-MM-DD format
 */
function getDateString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Classify a discovery's priority based on source and data signals.
 * This is a lightweight local classification (no API calls) that mirrors
 * the triage module's grouping logic.
 */
function inferPriority(discovery) {
  const type = (discovery.type || '').toLowerCase();
  const source = (discovery.source || '').toLowerCase();
  const relevance = (discovery.data?.relevance || discovery.relevance || '').toLowerCase();

  // High: vendor updates, FDA approvals, high-relevance items
  if (source === 'fda' || type === 'fda_approval') return 'high';
  if (relevance === 'high') return 'high';
  if (type === 'vendor_update' && relevance !== 'low') return 'high';

  // Medium: payer/CMS policy changes, publications, vendor news
  if (source === 'cms' || source === 'payers') return 'medium';
  if (source === 'pubmed' || source === 'preprints') return 'medium';
  if (type === 'vendor_update' || source === 'vendor') return 'medium';

  // Low: citations audit, everything else
  return 'low';
}

/**
 * Format a single discovery as a markdown block with clear delimiters.
 * Uses <!-- DISCOVERY --> markers so Claude Code can split the file into chunks.
 */
function formatDiscoveryBlock(discovery, index) {
  const lines = [];

  lines.push(`<!-- DISCOVERY ${discovery.id} -->`);
  lines.push(`### ${index + 1}. ${discovery.title || 'Untitled'}`);
  lines.push('');

  // Metadata
  lines.push(`- **Source:** ${discovery.source || 'unknown'}`);
  lines.push(`- **Type:** ${discovery.type || 'unknown'}`);
  lines.push(`- **Priority:** ${inferPriority(discovery)}`);
  if (discovery.url) {
    lines.push(`- **URL:** ${discovery.url}`);
  }
  lines.push(`- **Discovered:** ${discovery.discoveredAt || 'unknown'}`);
  lines.push(`- **Status:** ${discovery.status || 'pending'}`);
  lines.push('');

  // Summary
  if (discovery.summary) {
    lines.push(`**Summary:** ${discovery.summary}`);
    lines.push('');
  }

  // Nested data (selective — only include useful fields)
  const data = discovery.data || {};
  if (data.relevance) {
    lines.push(`**Relevance:** ${data.relevance}`);
  }
  if (data.abstract) {
    lines.push('');
    lines.push('<details>');
    lines.push('<summary>Abstract</summary>');
    lines.push('');
    lines.push(data.abstract);
    lines.push('');
    lines.push('</details>');
  }
  if (data.matchedTests?.length > 0) {
    lines.push(`**Matched Tests:** ${data.matchedTests.join(', ')}`);
  }
  if (data.metadata) {
    const meta = data.metadata;
    if (meta.journal) lines.push(`**Journal:** ${meta.journal}`);
    if (meta.payer) lines.push(`**Payer:** ${meta.payer}`);
    if (meta.vendorName) lines.push(`**Vendor:** ${meta.vendorName}`);
    if (meta.pmid) lines.push(`**PMID:** ${meta.pmid}`);
    if (meta.doi) lines.push(`**DOI:** ${meta.doi}`);
    if (meta.documentId) lines.push(`**Document ID:** ${meta.documentId}`);
    if (meta.effectiveDate) lines.push(`**Effective Date:** ${meta.effectiveDate}`);
  }
  lines.push('');

  // Raw JSON for machine processing
  lines.push('<details>');
  lines.push('<summary>Raw JSON</summary>');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(discovery, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('</details>');
  lines.push('');
  lines.push(`<!-- /DISCOVERY ${discovery.id} -->`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Export all unreviewed discoveries to a local markdown file.
 * File is organized by priority (high → medium → low), then by source within each priority.
 *
 * @returns {{ filepath: string, counts: { total: number, high: number, medium: number, low: number } }}
 */
export function exportDiscoveriesToMarkdown() {
  // Ensure export directory exists
  if (!existsSync(EXPORT_DIR)) {
    mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const date = getDateString();
  const filepath = join(EXPORT_DIR, `${date}.md`);

  // Load unreviewed discoveries
  const discoveries = getUnreviewed();
  const status = getQueueStatus();

  // Bucket by priority
  const buckets = { high: [], medium: [], low: [] };
  for (const d of discoveries) {
    const priority = inferPriority(d);
    buckets[priority].push(d);
  }

  // Sort each bucket by source for grouping
  for (const priority of Object.keys(buckets)) {
    buckets[priority].sort((a, b) => (a.source || '').localeCompare(b.source || ''));
  }

  // Build markdown
  const lines = [];

  lines.push(`# OpenOnco Discoveries Export - ${date}`);
  lines.push('');
  lines.push(`> Exported: ${new Date().toISOString()}`);
  lines.push(`> Total unreviewed: ${discoveries.length}`);
  lines.push(`> Queue: ${status.total} total, ${status.pending} pending, ${status.reviewed} reviewed`);
  lines.push('');

  // Summary table
  lines.push('## Summary');
  lines.push('');
  lines.push('| Priority | Count |');
  lines.push('|----------|-------|');
  lines.push(`| HIGH | ${buckets.high.length} |`);
  lines.push(`| MEDIUM | ${buckets.medium.length} |`);
  lines.push(`| LOW | ${buckets.low.length} |`);
  lines.push('');

  // Source breakdown
  const bySrc = {};
  for (const d of discoveries) {
    bySrc[d.source] = (bySrc[d.source] || 0) + 1;
  }
  if (Object.keys(bySrc).length > 0) {
    lines.push('| Source | Count |');
    lines.push('|--------|-------|');
    for (const [src, count] of Object.entries(bySrc).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${src} | ${count} |`);
    }
    lines.push('');
  }

  // High priority section
  lines.push('---');
  lines.push('');
  lines.push(`## HIGH Priority (${buckets.high.length})`);
  lines.push('');
  if (buckets.high.length > 0) {
    let currentSource = null;
    buckets.high.forEach((d, idx) => {
      if (d.source !== currentSource) {
        currentSource = d.source;
        lines.push(`#### Source: ${currentSource}`);
        lines.push('');
      }
      lines.push(formatDiscoveryBlock(d, idx));
    });
  } else {
    lines.push('_No high priority discoveries._');
    lines.push('');
  }

  // Medium priority section
  lines.push('---');
  lines.push('');
  lines.push(`## MEDIUM Priority (${buckets.medium.length})`);
  lines.push('');
  if (buckets.medium.length > 0) {
    let currentSource = null;
    buckets.medium.forEach((d, idx) => {
      if (d.source !== currentSource) {
        currentSource = d.source;
        lines.push(`#### Source: ${currentSource}`);
        lines.push('');
      }
      lines.push(formatDiscoveryBlock(d, idx));
    });
  } else {
    lines.push('_No medium priority discoveries._');
    lines.push('');
  }

  // Low priority section
  lines.push('---');
  lines.push('');
  lines.push(`## LOW Priority (${buckets.low.length})`);
  lines.push('');
  if (buckets.low.length > 0) {
    let currentSource = null;
    buckets.low.forEach((d, idx) => {
      if (d.source !== currentSource) {
        currentSource = d.source;
        lines.push(`#### Source: ${currentSource}`);
        lines.push('');
      }
      lines.push(formatDiscoveryBlock(d, idx));
    });
  } else {
    lines.push('_No low priority discoveries._');
    lines.push('');
  }

  const content = lines.join('\n');
  writeFileSync(filepath, content, 'utf-8');

  return {
    filepath,
    counts: {
      total: discoveries.length,
      high: buckets.high.length,
      medium: buckets.medium.length,
      low: buckets.low.length,
    },
  };
}

export default { exportDiscoveriesToMarkdown };
