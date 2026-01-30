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
 * Discovery type sections configuration
 * Organized by priority for patient-centric display
 */
const DISCOVERY_SECTIONS = [
  {
    id: 'financial',
    emoji: '💰',
    title: 'Patient Financial Assistance Updates',
    types: ['VENDOR_PAP_UPDATE', 'VENDOR_PRICE_CHANGE'],
    description: 'Cash prices, patient assistance programs, and financial help'
  },
  {
    id: 'pla_codes',
    emoji: '📋',
    title: 'PLA Code Updates',
    types: ['VENDOR_PLA_CODE', 'CMS_PLA_REFERENCE'],
    description: 'Proprietary Laboratory Analyses codes and Medicare rates'
  },
  {
    id: 'medicare',
    emoji: '🏥',
    title: 'Medicare Coverage',
    types: ['MEDICARE_LCD_UPDATE', 'MEDICARE_NCD_UPDATE', 'COVERAGE_CHANGE'],
    description: 'CMS coverage determinations and policy changes'
  },
  {
    id: 'payers',
    emoji: '🏢',
    title: 'Private Payer Updates',
    types: ['PAYER_POLICY_UPDATE', 'PAYER_POLICY_NEW'],
    description: 'Commercial insurance policy changes'
  },
  {
    id: 'vendor_coverage',
    emoji: '📰',
    title: 'Vendor Coverage Announcements',
    types: ['VENDOR_COVERAGE_ANNOUNCEMENT'],
    description: 'Coverage claims from test manufacturers'
  },
  {
    id: 'clinical',
    emoji: '📊',
    title: 'Clinical Evidence & Performance',
    types: ['VENDOR_CLINICAL_EVIDENCE', 'VENDOR_PERFORMANCE_DATA'],
    description: 'New studies and performance data'
  },
  {
    id: 'regulatory',
    emoji: '🔬',
    title: 'Regulatory Updates',
    types: ['VENDOR_REGULATORY'],
    description: 'FDA actions and regulatory changes'
  },
  {
    id: 'new_products',
    emoji: '🆕',
    title: 'New Tests & Indications',
    types: ['VENDOR_NEW_TEST', 'VENDOR_NEW_INDICATION'],
    description: 'New product launches and indication expansions'
  }
];

/**
 * Group discoveries into sections by type
 */
function groupDiscoveriesBySections(discoveries) {
  const grouped = {};
  const uncategorized = [];

  // Initialize sections
  DISCOVERY_SECTIONS.forEach(section => {
    grouped[section.id] = [];
  });

  // Sort discoveries into sections
  discoveries.forEach(discovery => {
    let placed = false;
    for (const section of DISCOVERY_SECTIONS) {
      if (section.types.includes(discovery.type)) {
        grouped[section.id].push(discovery);
        placed = true;
        break;
      }
    }
    if (!placed) {
      uncategorized.push(discovery);
    }
  });

  return { grouped, uncategorized };
}

/**
 * Format currency value
 */
function formatCurrency(value) {
  if (!value && value !== 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Load discoveries from the queue
 */
function loadDiscoveries() {
  const path = join(DATA_DIR, 'discoveries.json');
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    logger.error('Failed to load discoveries', { error: err.message });
    return [];
  }
}

/**
 * Load crawler health data
 */
function loadHealth() {
  const path = join(DATA_DIR, 'health.json');
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    logger.error('Failed to load health data', { error: err.message });
    return {};
  }
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
 * Get errors from the past week
 */
function getRecentErrors(health) {
  if (!health.errors || !Array.isArray(health.errors)) return [];
  
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return health.errors.filter(e => {
    const errorTime = new Date(e.timestamp).getTime();
    return errorTime > weekAgo;
  });
}

/**
 * Build the digest data object
 */
function buildDigestData() {
  const discoveries = loadDiscoveries();
  const health = loadHealth();
  const pending = discoveries.filter(d => d.status === 'pending');
  const recentErrors = getRecentErrors(health);
  
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
    errors: recentErrors,
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
 * Format financial discovery details for markdown
 */
function formatFinancialDiscoveryMd(discovery) {
  const d = discovery.data || {};
  let details = [];

  if (d.vendor) details.push(`- **Vendor:** ${d.vendor}`);
  if (d.programName) details.push(`- **Program:** ${d.programName}`);
  if (d.cashPrice) details.push(`- **Cash Price:** ${formatCurrency(d.cashPrice)}`);
  if (d.papEligible !== undefined) details.push(`- **PAP Eligible:** ${d.papEligible ? 'Yes' : 'No'}`);
  if (d.papPrice || d.reducedPrice) details.push(`- **Reduced/PAP Price:** ${formatCurrency(d.papPrice || d.reducedPrice)}`);
  if (d.eligibilityCriteria) details.push(`- **Eligibility:** ${d.eligibilityCriteria}`);

  return details.length > 0 ? details.join('\n') : null;
}

/**
 * Format PLA code discovery details for markdown
 */
function formatPlaCodeDiscoveryMd(discovery) {
  const d = discovery.data || {};
  let details = [];

  if (d.plaCode || d.code) details.push(`- **PLA Code:** \`${d.plaCode || d.code}\``);
  if (d.testName) details.push(`- **Test:** ${d.testName}`);
  if (d.vendor) details.push(`- **Vendor:** ${d.vendor}`);
  if (d.medicareRate) details.push(`- **Medicare Rate:** ${formatCurrency(d.medicareRate)}`);
  if (d.effectiveDate) details.push(`- **Effective Date:** ${d.effectiveDate}`);
  if (d.isNew) details.push(`- **Status:** 🆕 NEW CODE`);

  return details.length > 0 ? details.join('\n') : null;
}

/**
 * Format clinical evidence discovery details for markdown
 */
function formatClinicalDiscoveryMd(discovery) {
  const d = discovery.data || {};
  let details = [];

  if (d.studyName) details.push(`- **Study:** ${d.studyName}`);
  if (d.testName) details.push(`- **Test:** ${d.testName}`);
  if (d.publication) details.push(`- **Publication:** ${d.publication}`);
  if (d.keyFindings) details.push(`- **Key Findings:** ${d.keyFindings}`);
  if (d.impactsPerformanceClaims) details.push(`- ⚠️ **Impacts Performance Claims**`);

  return details.length > 0 ? details.join('\n') : null;
}

/**
 * Format regulatory discovery details for markdown
 */
function formatRegulatoryDiscoveryMd(discovery) {
  const d = discovery.data || {};
  let details = [];

  if (d.action || d.fdaAction) details.push(`- **FDA Action:** ${d.action || d.fdaAction}`);
  if (d.date || d.effectiveDate) details.push(`- **Date:** ${d.date || d.effectiveDate}`);
  if (d.indication || d.indications) details.push(`- **Indication:** ${d.indication || d.indications}`);
  if (d.testName) details.push(`- **Test:** ${d.testName}`);

  return details.length > 0 ? details.join('\n') : null;
}

/**
 * Get discovery details formatter for markdown based on section type
 */
function getDiscoveryDetailsMd(discovery, sectionId) {
  switch (sectionId) {
    case 'financial':
      return formatFinancialDiscoveryMd(discovery);
    case 'pla_codes':
      return formatPlaCodeDiscoveryMd(discovery);
    case 'clinical':
      return formatClinicalDiscoveryMd(discovery);
    case 'regulatory':
      return formatRegulatoryDiscoveryMd(discovery);
    default:
      return null;
  }
}

/**
 * Generate markdown section for a discovery type
 */
function generateDiscoverySectionMd(section, discoveries, startIndex) {
  if (discoveries.length === 0) return { content: '', nextIndex: startIndex };

  let content = `\n## ${section.emoji} ${section.title} (${discoveries.length})\n\n`;
  content += `> ${section.description}\n\n`;

  let index = startIndex;
  discoveries.forEach(d => {
    content += `### ${index}. ${d.title}\n\n`;
    content += `**Source:** ${d.source.toUpperCase()} | **Type:** ${d.type} | **Discovered:** ${new Date(d.discoveredAt).toLocaleDateString()}\n\n`;

    if (d.url) {
      content += `**URL:** ${d.url}\n\n`;
    }

    // Add type-specific formatted details
    const formattedDetails = getDiscoveryDetailsMd(d, section.id);
    if (formattedDetails) {
      content += `**Key Details:**\n${formattedDetails}\n\n`;
    }

    // Add Claude analysis
    if (d.summary) {
      content += `**Claude Analysis:**\n${d.summary}\n\n`;
    }

    // Add raw data if present and useful
    if (d.data && Object.keys(d.data).length > 0) {
      content += `<details>\n<summary>Raw Data</summary>\n\n\`\`\`json\n${JSON.stringify(d.data, null, 2)}\n\`\`\`\n</details>\n\n`;
    }

    content += `---\n\n`;
    index++;
  });

  return { content, nextIndex: index };
}

/**
 * Generate self-executing review file for Claude
 * This file contains instructions + data - just upload and send
 */
function generateReviewAttachment(digest) {
  const { discoveries, summary, weekOf } = digest;

  // Group discoveries by section
  const { grouped, uncategorized } = groupDiscoveriesBySections(discoveries);

  // Build summary by type
  const typeSummary = DISCOVERY_SECTIONS
    .filter(s => grouped[s.id].length > 0)
    .map(s => `${s.emoji} ${s.title}: ${grouped[s.id].length}`)
    .join('\n');

  let content = `# OpenOnco Coverage Review - Week of ${weekOf}

## Instructions
Review the coverage discoveries below. For each item:
1. I'll present the discovery with Claude's analysis
2. You respond: **approve**, **skip**, or ask questions
3. For approved items, I'll prepare the database update using the openonco-submission skill

## Summary
**${summary.totalPending} discoveries** pending review

**By Source:**
- CMS: ${summary.bySource.cms}
- Private Payers: ${summary.bySource.payers}
- Vendors: ${summary.bySource.vendor}

**By Type:**
${typeSummary || '- No discoveries this week'}

---
`;

  // Generate sections in priority order
  let itemIndex = 1;
  for (const section of DISCOVERY_SECTIONS) {
    const sectionDiscoveries = grouped[section.id];
    if (sectionDiscoveries.length > 0) {
      const result = generateDiscoverySectionMd(section, sectionDiscoveries, itemIndex);
      content += result.content;
      itemIndex = result.nextIndex;
    }
  }

  // Handle uncategorized discoveries
  if (uncategorized.length > 0) {
    content += `\n## 📌 Other Updates (${uncategorized.length})\n\n`;
    content += `> Discoveries that don't fit into standard categories\n\n`;

    uncategorized.forEach(d => {
      content += `### ${itemIndex}. ${d.title}\n\n`;
      content += `**Source:** ${d.source.toUpperCase()} | **Type:** ${d.type} | **Discovered:** ${new Date(d.discoveredAt).toLocaleDateString()}\n\n`;

      if (d.url) {
        content += `**URL:** ${d.url}\n\n`;
      }

      if (d.summary) {
        content += `**Claude Analysis:**\n${d.summary}\n\n`;
      }

      if (d.data && Object.keys(d.data).length > 0) {
        content += `<details>\n<summary>Raw Data</summary>\n\n\`\`\`json\n${JSON.stringify(d.data, null, 2)}\n\`\`\`\n</details>\n\n`;
      }

      content += `---\n\n`;
      itemIndex++;
    });
  }

  content += `## Ready to Start

Let's begin reviewing! I'll present the discoveries in priority order:
1. 💰 **Financial assistance first** - most impactful for patients
2. 📋 **PLA codes** - billing and reimbursement
3. 🏥 **Coverage updates** - Medicare and private payers
4. 📊 **Clinical & regulatory** - evidence and approvals

Reply with **approve**, **skip**, or ask questions for each item.
`;

  return content;
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
 * Format a financial discovery item for HTML email
 */
function formatFinancialDiscoveryHtml(discovery) {
  const d = discovery.data || {};
  let details = '';

  if (d.cashPrice) {
    details += `<div style="margin-bottom: 4px;"><strong>Cash Price:</strong> ${formatCurrency(d.cashPrice)}</div>`;
  }
  if (d.papEligible !== undefined) {
    details += `<div style="margin-bottom: 4px;"><strong>PAP Eligible:</strong> ${d.papEligible ? 'Yes' : 'No'}</div>`;
  }
  if (d.papPrice || d.reducedPrice) {
    details += `<div style="margin-bottom: 4px;"><strong>Reduced Price:</strong> ${formatCurrency(d.papPrice || d.reducedPrice)}</div>`;
  }
  if (d.programName) {
    details += `<div style="margin-bottom: 4px;"><strong>Program:</strong> ${d.programName}</div>`;
  }

  return details || '<div style="color: #888;">See details in attachment</div>';
}

/**
 * Format a PLA code discovery item for HTML email
 */
function formatPlaCodeDiscoveryHtml(discovery) {
  const d = discovery.data || {};
  let details = '';

  if (d.plaCode || d.code) {
    details += `<div style="margin-bottom: 4px;"><strong>PLA Code:</strong> <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 3px;">${d.plaCode || d.code}</code></div>`;
  }
  if (d.testName) {
    details += `<div style="margin-bottom: 4px;"><strong>Test:</strong> ${d.testName}</div>`;
  }
  if (d.medicareRate) {
    details += `<div style="margin-bottom: 4px;"><strong>Medicare Rate:</strong> ${formatCurrency(d.medicareRate)}</div>`;
  }
  if (d.isNew) {
    details += `<div style="margin-bottom: 4px;"><span style="background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 10px; font-size: 11px;">NEW CODE</span></div>`;
  }

  return details || '<div style="color: #888;">See details in attachment</div>';
}

/**
 * Format a clinical evidence discovery item for HTML email
 */
function formatClinicalDiscoveryHtml(discovery) {
  const d = discovery.data || {};
  let details = '';

  if (d.studyName) {
    details += `<div style="margin-bottom: 4px;"><strong>Study:</strong> ${d.studyName}</div>`;
  }
  if (d.testName) {
    details += `<div style="margin-bottom: 4px;"><strong>Test:</strong> ${d.testName}</div>`;
  }
  if (d.keyFindings) {
    details += `<div style="margin-bottom: 4px;"><strong>Findings:</strong> ${d.keyFindings}</div>`;
  }
  if (d.impactsPerformanceClaims) {
    details += `<div style="margin-bottom: 4px;"><span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 10px; font-size: 11px;">IMPACTS PERFORMANCE CLAIMS</span></div>`;
  }

  return details || '<div style="color: #888;">See details in attachment</div>';
}

/**
 * Format a regulatory discovery item for HTML email
 */
function formatRegulatoryDiscoveryHtml(discovery) {
  const d = discovery.data || {};
  let details = '';

  if (d.action || d.fdaAction) {
    details += `<div style="margin-bottom: 4px;"><strong>FDA Action:</strong> ${d.action || d.fdaAction}</div>`;
  }
  if (d.date || d.effectiveDate) {
    details += `<div style="margin-bottom: 4px;"><strong>Date:</strong> ${d.date || d.effectiveDate}</div>`;
  }
  if (d.indication || d.indications) {
    details += `<div style="margin-bottom: 4px;"><strong>Indication:</strong> ${d.indication || d.indications}</div>`;
  }

  return details || '<div style="color: #888;">See details in attachment</div>';
}

/**
 * Get discovery detail formatter based on section type
 */
function getDiscoveryDetailsHtml(discovery, sectionId) {
  switch (sectionId) {
    case 'financial':
      return formatFinancialDiscoveryHtml(discovery);
    case 'pla_codes':
      return formatPlaCodeDiscoveryHtml(discovery);
    case 'clinical':
      return formatClinicalDiscoveryHtml(discovery);
    case 'regulatory':
      return formatRegulatoryDiscoveryHtml(discovery);
    default:
      return `<div style="color: #666; font-size: 12px;">${discovery.summary || 'See details in attachment'}</div>`;
  }
}

/**
 * Generate HTML for a discovery section
 */
function generateDiscoverySectionHtml(section, discoveries) {
  if (discoveries.length === 0) return '';

  // Section-specific colors
  const sectionColors = {
    financial: { bg: '#fef3c7', border: '#f59e0b', header: '#92400e' },
    pla_codes: { bg: '#e0e7ff', border: '#6366f1', header: '#4338ca' },
    medicare: { bg: '#dbeafe', border: '#3b82f6', header: '#1d4ed8' },
    payers: { bg: '#f3e8ff', border: '#a855f7', header: '#7e22ce' },
    vendor_coverage: { bg: '#f1f5f9', border: '#64748b', header: '#475569' },
    clinical: { bg: '#dcfce7', border: '#22c55e', header: '#166534' },
    regulatory: { bg: '#fee2e2', border: '#ef4444', header: '#b91c1c' },
    new_products: { bg: '#cffafe', border: '#06b6d4', header: '#0e7490' }
  };

  const colors = sectionColors[section.id] || { bg: '#f1f5f9', border: '#94a3b8', header: '#475569' };

  return `
    <div style="margin-bottom: 20px;">
      <div style="background: ${colors.bg}; border-left: 4px solid ${colors.border}; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 12px;">
        <div style="font-size: 14px; font-weight: 600; color: ${colors.header};">
          ${section.emoji} ${section.title} <span style="font-weight: normal; color: #666;">(${discoveries.length})</span>
        </div>
      </div>
      ${discoveries.slice(0, 3).map(d => `
        <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
          <div style="font-size: 13px; font-weight: 500; color: #1f2937; margin-bottom: 6px;">
            ${d.title}
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
            ${d.source.toUpperCase()} · ${new Date(d.discoveredAt).toLocaleDateString()}
          </div>
          ${getDiscoveryDetailsHtml(d, section.id)}
        </div>
      `).join('')}
      ${discoveries.length > 3 ? `
        <div style="font-size: 12px; color: #666; padding-left: 12px;">
          +${discoveries.length - 3} more ${section.title.toLowerCase()}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate HTML email (summary + stats + errors + discovery sections)
 */
function generateEmailHtml(digest) {
  const { summary, crawlerHealth, errors, weekOf, discoveries } = digest;

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

  // Error section (only if errors exist)
  const errorSection = errors.length > 0 ? `
    <!-- Errors -->
    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <div style="font-size: 12px; font-weight: 600; color: #dc2626; text-transform: uppercase; margin-bottom: 12px;">
        ⚠️ ${errors.length} Error${errors.length > 1 ? 's' : ''} This Week
      </div>
      ${errors.slice(0, 5).map(e => `
        <div style="background: white; border-radius: 4px; padding: 10px; margin-bottom: 8px; font-size: 13px;">
          <div style="color: #666; font-size: 11px; margin-bottom: 4px;">
            ${e.source.toUpperCase()} · ${formatTime(e.timestamp)}
          </div>
          <div style="color: #991b1b; font-family: monospace; font-size: 12px; word-break: break-word;">
            ${e.message}
          </div>
        </div>
      `).join('')}
      ${errors.length > 5 ? `<div style="font-size: 12px; color: #666; margin-top: 8px;">...and ${errors.length - 5} more</div>` : ''}
    </div>
  ` : '';

  // Group discoveries by section
  const { grouped, uncategorized } = groupDiscoveriesBySections(discoveries);

  // Generate discovery sections HTML
  let discoverySectionsHtml = '';
  if (summary.totalPending > 0) {
    discoverySectionsHtml = `
      <div style="margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 12px;">
          Discoveries by Type
        </div>
        ${DISCOVERY_SECTIONS.map(section =>
          generateDiscoverySectionHtml(section, grouped[section.id])
        ).join('')}
        ${uncategorized.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <div style="background: #f1f5f9; border-left: 4px solid #94a3b8; padding: 12px 16px; border-radius: 0 8px 8px 0;">
              <div style="font-size: 14px; font-weight: 600; color: #475569;">
                📌 Other Updates <span style="font-weight: normal; color: #666;">(${uncategorized.length})</span>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

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

    ${errorSection}

    ${discoverySectionsHtml}

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
  const { summary, crawlerHealth, errors, weekOf } = digest;
  
  let text = `
OPENONCO COVERAGE DIGEST
Week of ${weekOf}
═══════════════════════════════════════

${summary.totalPending} DISCOVERIES PENDING REVIEW
CMS: ${summary.bySource.cms} | Payers: ${summary.bySource.payers} | Vendors: ${summary.bySource.vendor}
`;

  // Add errors section if any
  if (errors.length > 0) {
    text += `
⚠️ ${errors.length} ERROR${errors.length > 1 ? 'S' : ''} THIS WEEK
───────────────────────────────────────
`;
    errors.slice(0, 5).forEach(e => {
      text += `[${e.source.toUpperCase()}] ${formatTime(e.timestamp)}\n  ${e.message}\n\n`;
    });
    if (errors.length > 5) {
      text += `...and ${errors.length - 5} more\n`;
    }
  }

  text += `
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
  
  // Subject includes error count if any
  let subject;
  if (digest.errors.length > 0) {
    subject = `[OpenOnco] ⚠️ ${digest.errors.length} errors + ${digest.summary.totalPending} discoveries`;
  } else if (digest.summary.totalPending > 0) {
    subject = `[OpenOnco] ${digest.summary.totalPending} coverage updates to review`;
  } else {
    subject = `[OpenOnco] Weekly digest - no new updates`;
  }

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
      pendingCount: digest.summary.totalPending,
      errorCount: digest.errors.length
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
