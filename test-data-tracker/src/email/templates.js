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
 * Escape HTML special characters for safe inclusion in HTML
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Truncate string to specified length
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Get the current week's Monday date in YYYY-MM-DD format
 */
function getWeekDate() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}

/**
 * Generate the Claude triage instructions
 * @returns {string} - Instructions for Claude to process the XML
 */
function generateTriageInstructions() {
  return `
<!--
INSTRUCTIONS FOR CLAUDE:

Process the XML above and perform the following triage actions:

1. MISSING CITATIONS:
   - Search PubMed and Google Scholar to find supporting sources for each missing citation
   - Prioritize peer-reviewed publications, clinical validation studies, and manufacturer white papers
   - For each, provide: suggested citation URL, publication title, and confidence level

2. BROKEN CITATIONS:
   - For each broken URL, search for replacement URLs (updated DOIs, new publication locations)
   - If no replacement found, flag for removal with explanation
   - Check if the cited content exists elsewhere (journal moved, DOI changed, etc.)

3. VENDOR CHANGES:
   - Classify each change as: performance_update | new_test | coverage_news | regulatory_update | ignore
   - For performance_update: extract any new sensitivity/specificity/PPV/NPV values
   - For coverage_news: identify payer and coverage determination
   - Summarize actionable database updates needed

4. PAYER UPDATES:
   - Match each policy to tests in the OpenOnco database
   - Summarize the coverage change (positive/negative/neutral)
   - Extract key criteria changes, effective dates, and CPT code updates
   - Flag high-priority changes affecting major payers

5. PUBMED PAPERS & PREPRINTS:
   - Extract performance metrics (sensitivity, specificity, PPV, NPV, LOD)
   - Identify which tests were studied and what cancer types
   - Flag papers that should update test database entries
   - Highlight head-to-head comparison studies

6. CMS UPDATES:
   - Match LCD/NCD to affected tests
   - Summarize impact on coverage (expansion, restriction, clarification)
   - Note contractor-specific vs national coverage changes

7. FDA UPDATES:
   - Identify which OpenOnco test this approval affects
   - Note new indications, label expansions, or companion diagnostic updates
   - Flag breakthrough device designations

OUTPUT FORMAT:
Provide a prioritized action list with:
- HIGH PRIORITY: Items requiring immediate database updates
- MEDIUM PRIORITY: Items requiring review before update
- LOW PRIORITY: Items for monitoring/future reference
- IGNORE: Items not relevant to OpenOnco database

For each action item, specify:
- Affected test ID(s) and field(s)
- Proposed change
- Source/justification
- Confidence level (high/medium/low)
-->`;
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
              (item) => {
                const relevance = item.relevance || item.data?.relevance || 'medium';
                return `
            <div class="discovery-item">
              <div class="discovery-title">
                <span class="badge badge-${relevance}">${relevance.toUpperCase()}</span>
                <a href="${item.url}" target="_blank">${item.title}</a>
              </div>
              <div class="discovery-summary">${item.summary?.substring(0, 200)}${item.summary?.length > 200 ? '...' : ''}</div>
              <div class="discovery-meta">Found: ${formatDate(item.discoveredAt)}</div>
            </div>
          `;
              })
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

    <!-- AI Triage Section -->
    <div class="section" style="margin-top: 32px; background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 8px; padding: 20px;">
      <div class="section-title" style="color: #0369a1; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
        PASTE THE SECTION BELOW INTO CLAUDE FOR AI TRIAGE
      </div>
      <pre style="background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 6px; font-size: 11px; line-height: 1.4; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;">${escapeHtml(generateTriageXml({ discoveries }))}

${escapeHtml(generateTriageInstructions())}</pre>
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

/**
 * Generate structured XML for Claude AI triage
 * @param {Object} data - The digest data containing discoveries from all crawlers
 * @returns {string} - XML string for AI processing
 */
export function generateTriageXml({ discoveries }) {
  const weekDate = getWeekDate();
  const lines = [];

  lines.push(`<openonco_triage_request week="${weekDate}">`);
  lines.push('');

  // Process citations (missing and broken)
  const citationsDiscoveries = discoveries.citations || [];
  const missingCitations = citationsDiscoveries.filter(d => d.type === 'missing_citation');
  const brokenCitations = citationsDiscoveries.filter(d => d.type === 'broken_citation');

  lines.push('<citation_audit>');

  // Missing citations
  lines.push(`  <missing count="${missingCitations.length}">`);
  for (const item of missingCitations) {
    const data = item.data || {};
    lines.push(`    <item test_id="${escapeXml(data.testId)}" test_name="${escapeXml(data.testName)}" field="${escapeXml(data.field)}" value="${escapeXml(data.value)}" vendor="${escapeXml(data.vendor)}"/>`);
  }
  lines.push('  </missing>');

  // Broken citations
  lines.push(`  <broken count="${brokenCitations.length}">`);
  for (const item of brokenCitations) {
    const data = item.data || {};
    lines.push(`    <item test_id="${escapeXml(data.testId)}" field="${escapeXml(data.citationField)}" url="${escapeXml(item.url)}" status="${escapeXml(data.status)}" error="${escapeXml(data.error)}"/>`);
  }
  lines.push('  </broken>');

  lines.push('</citation_audit>');
  lines.push('');

  // Vendor changes
  const vendorDiscoveries = discoveries.vendor || [];
  lines.push(`<vendor_changes count="${vendorDiscoveries.length}">`);
  for (const item of vendorDiscoveries) {
    const meta = item.metadata || {};
    const detected = item.discoveredAt ? item.discoveredAt.split('T')[0] : new Date().toISOString().split('T')[0];
    lines.push(`  <change vendor="${escapeXml(meta.vendorName)}" page="${escapeXml(meta.pagePath)}" detected="${detected}" url="${escapeXml(item.url)}">`);
    lines.push(`    <snippet>${escapeXml(truncate(item.summary, 500))}</snippet>`);
    lines.push('  </change>');
  }
  lines.push('</vendor_changes>');
  lines.push('');

  // Payer updates
  const payerDiscoveries = discoveries.payers || [];
  lines.push(`<payer_updates count="${payerDiscoveries.length}">`);
  for (const item of payerDiscoveries) {
    const meta = item.metadata || {};
    const policyType = item.type === 'payer_policy_new' ? 'new' : 'update';
    lines.push(`  <policy payer="${escapeXml(meta.payer)}" policy_id="${escapeXml(meta.policyId)}" type="${policyType}" effective="${escapeXml(meta.effectiveDate)}" url="${escapeXml(item.url)}">`);
    lines.push(`    <title>${escapeXml(meta.policyName || item.title)}</title>`);
    lines.push(`    <tests_mentioned>${escapeXml((meta.testsMentioned || []).join(', '))}</tests_mentioned>`);
    lines.push(`    <keywords>${escapeXml((meta.keywordsMatched || []).join(', '))}</keywords>`);
    lines.push('  </policy>');
  }
  lines.push('</payer_updates>');
  lines.push('');

  // PubMed papers
  const pubmedDiscoveries = discoveries.pubmed || [];
  lines.push(`<pubmed_papers count="${pubmedDiscoveries.length}">`);
  for (const item of pubmedDiscoveries) {
    const meta = item.metadata || {};
    const relevanceScore = item.relevance === 'high' ? '90' : item.relevance === 'medium' ? '70' : '50';
    const pubDate = meta.publicationDate || '';
    lines.push(`  <paper pmid="${escapeXml(meta.pmid)}" relevance="${relevanceScore}" date="${escapeXml(pubDate)}">`);
    lines.push(`    <title>${escapeXml(item.title)}</title>`);
    lines.push(`    <journal>${escapeXml(meta.journal)}</journal>`);
    lines.push(`    <matched_tests>${escapeXml((meta.matchedTests || []).join(', '))}</matched_tests>`);
    lines.push(`    <abstract>${escapeXml(truncate(meta.abstract || '', 800))}</abstract>`);
    lines.push('  </paper>');
  }
  lines.push('</pubmed_papers>');
  lines.push('');

  // CMS updates
  const cmsDiscoveries = discoveries.cms || [];
  lines.push(`<cms_updates count="${cmsDiscoveries.length}">`);
  for (const item of cmsDiscoveries) {
    const meta = item.metadata || {};
    const docType = (meta.documentType || 'LCD').toLowerCase();
    lines.push(`  <${docType} id="${escapeXml(meta.documentId)}" contractor="${escapeXml(meta.contractor)}" type="${escapeXml(meta.version > 1 ? 'revision' : 'new')}" effective="${escapeXml(meta.effectiveDate)}" url="${escapeXml(item.url)}">`);
    lines.push(`    <title>${escapeXml(item.title)}</title>`);
    lines.push(`  </${docType}>`);
  }
  lines.push('</cms_updates>');
  lines.push('');

  // FDA updates
  const fdaDiscoveries = discoveries.fda || [];
  lines.push(`<fda_updates count="${fdaDiscoveries.length}">`);
  for (const item of fdaDiscoveries) {
    const meta = item.metadata || {};
    const kNumber = meta.kNumber || meta.pmaNumber || '';
    const decisionDate = meta.decisionDate || '';
    lines.push(`  <approval k_number="${escapeXml(kNumber)}" date="${escapeXml(decisionDate)}" url="${escapeXml(item.url)}">`);
    lines.push(`    <device>${escapeXml(meta.deviceName || meta.tradeName || item.title)}</device>`);
    lines.push(`    <applicant>${escapeXml(meta.applicant)}</applicant>`);
    lines.push('  </approval>');
  }
  lines.push('</fda_updates>');
  lines.push('');

  // Preprints
  const preprintDiscoveries = discoveries.preprints || [];
  lines.push(`<preprints count="${preprintDiscoveries.length}">`);
  for (const item of preprintDiscoveries) {
    const meta = item.metadata || {};
    const relevanceScore = item.relevance === 'high' ? '85' : item.relevance === 'medium' ? '65' : '45';
    const pubDate = meta.publishedDate || '';
    lines.push(`  <paper doi="${escapeXml(meta.doi)}" relevance="${relevanceScore}" date="${escapeXml(pubDate)}" server="${escapeXml(meta.server)}">`);
    lines.push(`    <title>${escapeXml(item.title)}</title>`);
    lines.push(`    <matched_tests>${escapeXml((meta.matchedTests || []).join(', '))}</matched_tests>`);
    lines.push(`    <abstract>${escapeXml(truncate(meta.abstract || '', 800))}</abstract>`);
    lines.push('  </paper>');
  }
  lines.push('</preprints>');
  lines.push('');

  lines.push('</openonco_triage_request>');

  return lines.join('\n');
}

/**
 * Generate a Claude-executable command block for a triage action
 * @param {Object} action - The action object containing update details
 * @returns {string} - Formatted command block ready to paste into Claude
 */
export function generateCopyPasteBlock(action) {
  const lines = [];

  lines.push('═══════════════════════════════════════');
  lines.push('PASTE INTO CLAUDE:');
  lines.push('═══════════════════════════════════════');

  // Build the action description
  if (action.testId) {
    lines.push(`Update ${action.testName || action.testId} in data.js:`);
    lines.push(`- Test ID: ${action.testId}`);
    if (action.field) {
      lines.push(`- Field: ${action.field}`);
    }
    if (action.newValue !== undefined) {
      lines.push(`- New value: ${action.newValue}`);
    }
    if (action.oldValue !== undefined) {
      lines.push(`- Current value: ${action.oldValue}`);
    }
  } else if (action.action) {
    lines.push(action.action);
  } else if (action.title) {
    lines.push(action.title);
  }

  // Add citation info
  if (action.citation || action.sourceUrl) {
    lines.push(`- Citation: ${action.citation || action.sourceUrl}`);
  }
  if (action.pmid) {
    lines.push(`- Source: PMID ${action.pmid}${action.year ? ` (${action.year})` : ''}`);
  } else if (action.source) {
    lines.push(`- Source: ${action.source}`);
  }

  // Add confidence level if available
  if (action.confidence) {
    lines.push(`- Confidence: ${action.confidence}`);
  }

  // Add any additional notes
  if (action.notes) {
    lines.push(`- Notes: ${action.notes}`);
  }

  lines.push('');
  lines.push('Use the openonco-submission skill to apply this update.');
  lines.push('═══════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Format priority badge for HTML
 */
function getPriorityBadgeHtml(priority) {
  const badges = {
    high: '<span style="display: inline-block; background: #dc2626; color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">HIGH PRIORITY</span>',
    medium: '<span style="display: inline-block; background: #d97706; color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">MEDIUM</span>',
    low: '<span style="display: inline-block; background: #059669; color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">LOW</span>',
  };
  return badges[priority] || badges.low;
}

/**
 * Generate the Monday digest HTML email
 * @param {Object} triageResults - AI triage results with high/medium/low priority actions
 * @param {Object} dbStats - Database health statistics
 * @param {Object} crawlerHealth - Crawler health information (optional, for backwards compatibility)
 */
export function generateMondayDigestHtml(triageResults, dbStats, crawlerHealth = null) {
  const highPriority = triageResults.highPriority || [];
  const mediumPriority = triageResults.mediumPriority || [];
  const lowPriority = triageResults.lowPriority || [];
  const ignoredItems = triageResults.ignored || {};
  const findings = triageResults.findings || {};

  // Calculate total ignored count
  const totalIgnored = Object.values(ignoredItems).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);

  // Build category breakdown for tests
  const categoryBreakdown = dbStats.byCategory || {};

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenOnco Monday Digest</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 720px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  <div style="background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <h1 style="font-size: 28px; margin: 0 0 8px 0; color: #111;">OpenOnco Monday Digest</h1>
    <div style="color: #666; font-size: 14px; margin-bottom: 32px;">Week of ${getWeekDate()} · Generated ${formatDate(new Date().toISOString())}</div>

    <!-- SECTION 1: DATABASE HEALTH SUMMARY -->
    <div style="margin-bottom: 32px;">
      <div style="display: flex; align-items: center; font-size: 16px; font-weight: 700; margin: 0 0 16px 0; color: #111; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #111; color: white; border-radius: 50%; font-size: 12px; margin-right: 10px;">1</span>
        Database Health Summary
      </div>

      <!-- Main Stats Grid -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
        <tr>
          <td width="50%" style="padding-right: 8px; vertical-align: top;">
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
              <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Total Tests</div>
              <div style="font-size: 24px; font-weight: 700; color: #111;">${dbStats.totalTests || 0}</div>
              <div style="font-size: 13px; color: #666; margin-top: 4px;">Across ${dbStats.categoryCount || 5} categories</div>
            </div>
          </td>
          <td width="50%" style="padding-left: 8px; vertical-align: top;">
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid ${(dbStats.citationCompleteness || 0) < 80 ? '#f59e0b' : '#10b981'};">
              <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Citation Coverage</div>
              <div style="font-size: 24px; font-weight: 700; color: #111;">${dbStats.citationCompleteness || 0}%</div>
              <div style="font-size: 13px; color: #666; margin-top: 4px;">${dbStats.citedFields || 0} of ${dbStats.totalFields || 0} fields cited</div>
            </div>
          </td>
        </tr>
        <tr><td colspan="2" height="16"></td></tr>
        <tr>
          <td width="50%" style="padding-right: 8px; vertical-align: top;">
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid ${(dbStats.brokenUrls || 0) > 0 ? '#ef4444' : '#10b981'};">
              <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Broken URLs</div>
              <div style="font-size: 24px; font-weight: 700; color: #111;">${dbStats.brokenUrls || 0}</div>
              <div style="font-size: 13px; color: #666; margin-top: 4px;">${dbStats.brokenUrls > 0 ? 'Requires attention' : 'All links healthy'}</div>
            </div>
          </td>
          <td width="50%" style="padding-left: 8px; vertical-align: top;">
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
              <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Last Updated</div>
              <div style="font-size: 16px; font-weight: 700; color: #111;">${dbStats.lastUpdated ? formatDate(dbStats.lastUpdated) : 'Unknown'}</div>
              <div style="font-size: 13px; color: #666; margin-top: 4px;">${dbStats.updatesThisWeek || 0} updates this week</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Category Breakdown -->
      ${Object.keys(categoryBreakdown).length > 0 ? `
      <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Tests by Category</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${Object.entries(categoryBreakdown).map(([category, count]) => `
          <tr>
            <td style="padding: 4px 0; color: #333;">${escapeHtml(category)}</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #111;">${count}</td>
          </tr>
          `).join('')}
        </table>
      </div>
      ` : ''}
    </div>

    <!-- SECTION 2: HIGH PRIORITY ACTIONS -->
    <div style="margin-bottom: 32px;">
      <div style="display: flex; align-items: center; font-size: 16px; font-weight: 700; margin: 0 0 16px 0; color: #111; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #dc2626; color: white; border-radius: 50%; font-size: 12px; margin-right: 10px;">2</span>
        High Priority Actions${highPriority.length > 0 ? ` (${highPriority.length})` : ''}
      </div>

      ${highPriority.length > 0 ? highPriority.map((action, idx) => `
      <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px;">
          <div style="font-weight: 600; font-size: 15px; color: #111; flex: 1;">${idx + 1}. ${escapeHtml(action.title || action.action)}</div>
          <span style="display: inline-block; background: #dc2626; color: white; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; margin-left: 12px;">HIGH</span>
        </div>

        <div style="font-size: 13px; color: #666; margin-bottom: 12px;">
          Source: ${action.sourceUrl ? `<a href="${escapeHtml(action.sourceUrl)}" target="_blank" style="color: #2563eb; text-decoration: none;">${escapeHtml(action.source || action.sourceUrl)}</a>` : escapeHtml(action.source || 'Unknown')}
        </div>

        ${action.evidence ? `
        <div style="font-size: 13px; color: #374151; background: white; border-radius: 4px; padding: 12px; margin-bottom: 12px; border-left: 3px solid #d1d5db; font-style: italic;">
          "${escapeHtml(action.evidence)}"
        </div>
        ` : ''}

        <div style="background: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 6px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(generateCopyPasteBlock(action))}</div>
      </div>
      `).join('') : `
      <div style="color: #888; font-style: italic; padding: 20px; text-align: center; background: #f8f9fa; border-radius: 6px;">
        No high priority actions this week
      </div>
      `}
    </div>

    <!-- SECTION 3: MEDIUM PRIORITY -->
    <div style="margin-bottom: 32px;">
      <div style="display: flex; align-items: center; font-size: 16px; font-weight: 700; margin: 0 0 16px 0; color: #111; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #d97706; color: white; border-radius: 50%; font-size: 12px; margin-right: 10px;">3</span>
        Medium Priority${mediumPriority.length > 0 ? ` (${mediumPriority.length})` : ''}
      </div>

      ${mediumPriority.length > 0 ? `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; overflow: hidden;">
        ${mediumPriority.map((item, idx) => `
        <div style="padding: 12px 16px; ${idx < mediumPriority.length - 1 ? 'border-bottom: 1px solid #fde68a;' : ''}">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 500; color: #333;">${escapeHtml(item.title || item.action)}</span>
            ${item.sourceUrl ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" style="font-size: 13px; color: #2563eb; text-decoration: none; margin-left: 12px;">View →</a>` : ''}
          </div>
          ${item.testId ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">Test: ${escapeHtml(item.testId)}</div>` : ''}
        </div>
        `).join('')}
      </div>
      ` : `
      <div style="color: #888; font-style: italic; padding: 20px; text-align: center; background: #f8f9fa; border-radius: 6px;">
        No medium priority items this week
      </div>
      `}
    </div>

    <!-- SECTION 4: LOW PRIORITY / FOR REVIEW -->
    <div style="margin-bottom: 32px;">
      <div style="display: flex; align-items: center; font-size: 16px; font-weight: 700; margin: 0 0 16px 0; color: #111; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #059669; color: white; border-radius: 50%; font-size: 12px; margin-right: 10px;">4</span>
        Low Priority / For Review
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px;">
        ${lowPriority.length > 0 ? `
        <div style="font-size: 14px; color: #166534;">
          <strong>${lowPriority.length}</strong> low priority items for future review
        </div>
        <div style="font-size: 13px; color: #4ade80; margin-top: 8px;">
          ${lowPriority.slice(0, 3).map(item => `• ${escapeHtml(truncate(item.title || item.action, 60))}`).join('<br>')}
          ${lowPriority.length > 3 ? `<br>... and ${lowPriority.length - 3} more` : ''}
        </div>
        ` : `
        <div style="font-size: 14px; color: #166534;">
          No low priority items this week
        </div>
        `}
      </div>
    </div>

    <!-- SECTION 5: IGNORED ITEMS -->
    <div style="margin-bottom: 32px;">
      <div style="display: flex; align-items: center; font-size: 16px; font-weight: 700; margin: 0 0 16px 0; color: #111; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #64748b; color: white; border-radius: 50%; font-size: 12px; margin-right: 10px;">5</span>
        Ignored Items
      </div>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 16px; color: #64748b; font-size: 14px;">
        ${totalIgnored > 0 ? `
        <div style="margin-bottom: 8px;"><strong>${totalIgnored}</strong> items filtered out this week:</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${Object.entries(ignoredItems).filter(([_, count]) => count > 0).map(([category, count]) => `
          <tr>
            <td style="padding: 4px 0; color: #475569;">${escapeHtml(category.replace(/_/g, ' '))}</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #64748b;">${count}</td>
          </tr>
          `).join('')}
        </table>
        ` : `
        <div>No items were filtered out this week</div>
        `}
      </div>
    </div>

    <!-- SECTION 6: CRAWLER HEALTH -->
    <div style="margin-bottom: 24px;">
      <div style="display: flex; align-items: center; font-size: 16px; font-weight: 700; margin: 0 0 16px 0; color: #111; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #111; color: white; border-radius: 50%; font-size: 12px; margin-right: 10px;">6</span>
        Crawler Health
      </div>

      ${crawlerHealth && crawlerHealth.crawlers && crawlerHealth.crawlers.length > 0 ? `
      <div style="background: #f8f9fa; border-radius: 8px; overflow: hidden;">
        ${crawlerHealth.crawlers.map((crawler, idx) => {
          const hasError = crawler.status === 'error';
          const errorCount = crawler.errorsThisWeek || 0;
          return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; ${idx < crawlerHealth.crawlers.length - 1 ? 'border-bottom: 1px solid #e5e5e5;' : ''} ${hasError ? 'background: #fef2f2;' : ''}">
            <div>
              <span>${getStatusEmoji(crawler.status)} ${escapeHtml(config.crawlers[crawler.source]?.name || crawler.source)}</span>
              ${errorCount > 0 ? `<span style="font-size: 12px; color: #dc2626; margin-left: 8px;">(${errorCount} errors this week)</span>` : ''}
            </div>
            <span style="color: #666; font-size: 13px;">Last: ${formatDate(crawler.lastSuccess)}</span>
          </div>
          `;
        }).join('')}
      </div>
      ${crawlerHealth.recentErrors && crawlerHealth.recentErrors.length > 0 ? `
      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin-top: 12px;">
        <div style="font-size: 12px; font-weight: 600; color: #b91c1c; text-transform: uppercase; margin-bottom: 8px;">Recent Errors</div>
        ${crawlerHealth.recentErrors.slice(0, 5).map(error => `
        <div style="font-size: 13px; color: #b91c1c; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #fecaca;">
          <strong>${escapeHtml(error.source)}:</strong> ${escapeHtml(error.message)}
          <div style="font-size: 11px; color: #f87171; margin-top: 2px;">${formatDate(error.timestamp)}</div>
        </div>
        `).join('')}
      </div>
      ` : ''}
      ` : `
      <div style="color: #888; font-style: italic; padding: 20px; text-align: center; background: #f8f9fa; border-radius: 6px;">
        No crawler status available
      </div>
      `}
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888; text-align: center;">
      OpenOnco Intelligence Daemon · <a href="https://openonco.org" style="color: #666;">openonco.org</a>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of the Monday digest
 * @param {Object} triageResults - AI triage results with high/medium/low priority actions
 * @param {Object} dbStats - Database health statistics
 * @param {Object} crawlerHealth - Crawler health information (optional, for backwards compatibility)
 */
export function generateMondayDigestText(triageResults, dbStats, crawlerHealth = null) {
  const lines = [];
  const highPriority = triageResults.highPriority || [];
  const mediumPriority = triageResults.mediumPriority || [];
  const lowPriority = triageResults.lowPriority || [];
  const ignoredItems = triageResults.ignored || {};

  // Calculate total ignored count
  const totalIgnored = Object.values(ignoredItems).reduce((sum, count) => sum + (typeof count === 'number' ? count : 0), 0);
  const categoryBreakdown = dbStats.byCategory || {};

  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('  OPENONCO MONDAY DIGEST');
  lines.push(`  Week of ${getWeekDate()}`);
  lines.push(`  Generated ${formatDate(new Date().toISOString())}`);
  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('');

  // SECTION 1: DATABASE HEALTH SUMMARY
  lines.push('┌────────────────────────────────────────────────────────────────┐');
  lines.push('│  1. DATABASE HEALTH SUMMARY                                    │');
  lines.push('└────────────────────────────────────────────────────────────────┘');
  lines.push('');
  lines.push(`  Total Tests:           ${dbStats.totalTests || 0} (across ${dbStats.categoryCount || 5} categories)`);
  lines.push(`  Citation Coverage:     ${dbStats.citationCompleteness || 0}% (${dbStats.citedFields || 0}/${dbStats.totalFields || 0} fields)`);
  lines.push(`  Broken URLs:           ${dbStats.brokenUrls || 0}${dbStats.brokenUrls > 0 ? ' ⚠️' : ' ✓'}`);
  lines.push(`  Last Updated:          ${dbStats.lastUpdated ? formatDate(dbStats.lastUpdated) : 'Unknown'}`);
  lines.push(`  Updates This Week:     ${dbStats.updatesThisWeek || 0}`);

  if (Object.keys(categoryBreakdown).length > 0) {
    lines.push('');
    lines.push('  Tests by Category:');
    for (const [category, count] of Object.entries(categoryBreakdown)) {
      lines.push(`    ${category.padEnd(30)} ${count}`);
    }
  }
  lines.push('');

  // SECTION 2: HIGH PRIORITY ACTIONS
  lines.push('┌────────────────────────────────────────────────────────────────┐');
  lines.push(`│  2. HIGH PRIORITY ACTIONS${highPriority.length > 0 ? ` (${highPriority.length})`.padEnd(37) : ''.padEnd(37)}│`);
  lines.push('└────────────────────────────────────────────────────────────────┘');
  lines.push('');

  if (highPriority.length > 0) {
    for (let i = 0; i < highPriority.length; i++) {
      const action = highPriority[i];
      lines.push(`  ▶ ${i + 1}. ${action.title || action.action}`);
      lines.push(`     Source: ${action.source || action.sourceUrl || 'Unknown'}`);
      if (action.evidence) {
        lines.push(`     Evidence: "${truncate(action.evidence, 60)}"`);
      }
      lines.push('');
      lines.push('     ' + generateCopyPasteBlock(action).split('\n').join('\n     '));
      lines.push('');
    }
  } else {
    lines.push('  No high priority actions this week.');
    lines.push('');
  }

  // SECTION 3: MEDIUM PRIORITY
  lines.push('┌────────────────────────────────────────────────────────────────┐');
  lines.push(`│  3. MEDIUM PRIORITY${mediumPriority.length > 0 ? ` (${mediumPriority.length})`.padEnd(43) : ''.padEnd(43)}│`);
  lines.push('└────────────────────────────────────────────────────────────────┘');
  lines.push('');

  if (mediumPriority.length > 0) {
    for (const item of mediumPriority) {
      lines.push(`  • ${item.title || item.action}`);
      if (item.testId) {
        lines.push(`    Test: ${item.testId}`);
      }
      if (item.sourceUrl) {
        lines.push(`    ${item.sourceUrl}`);
      }
    }
  } else {
    lines.push('  No medium priority items this week.');
  }
  lines.push('');

  // SECTION 4: LOW PRIORITY / FOR REVIEW
  lines.push('┌────────────────────────────────────────────────────────────────┐');
  lines.push('│  4. LOW PRIORITY / FOR REVIEW                                  │');
  lines.push('└────────────────────────────────────────────────────────────────┘');
  lines.push('');

  if (lowPriority.length > 0) {
    lines.push(`  ${lowPriority.length} low priority items for future review:`);
    for (const item of lowPriority.slice(0, 5)) {
      lines.push(`  • ${truncate(item.title || item.action, 55)}`);
    }
    if (lowPriority.length > 5) {
      lines.push(`  ... and ${lowPriority.length - 5} more`);
    }
  } else {
    lines.push('  No low priority items this week.');
  }
  lines.push('');

  // SECTION 5: IGNORED ITEMS
  lines.push('┌────────────────────────────────────────────────────────────────┐');
  lines.push('│  5. IGNORED ITEMS                                              │');
  lines.push('└────────────────────────────────────────────────────────────────┘');
  lines.push('');

  if (totalIgnored > 0) {
    lines.push(`  ${totalIgnored} items filtered out this week:`);
    for (const [category, count] of Object.entries(ignoredItems)) {
      if (count > 0) {
        lines.push(`  • ${count} ${category.replace(/_/g, ' ')}`);
      }
    }
  } else {
    lines.push('  No items were filtered out this week.');
  }
  lines.push('');

  // SECTION 6: CRAWLER HEALTH
  lines.push('┌────────────────────────────────────────────────────────────────┐');
  lines.push('│  6. CRAWLER HEALTH                                             │');
  lines.push('└────────────────────────────────────────────────────────────────┘');
  lines.push('');

  if (crawlerHealth && crawlerHealth.crawlers && crawlerHealth.crawlers.length > 0) {
    for (const crawler of crawlerHealth.crawlers) {
      const name = config.crawlers[crawler.source]?.name || crawler.source;
      const status = getStatusEmoji(crawler.status);
      const errorCount = crawler.errorsThisWeek || 0;
      let line = `  ${status} ${name.padEnd(20)} Last: ${formatDate(crawler.lastSuccess)}`;
      if (errorCount > 0) {
        line += ` (${errorCount} errors)`;
      }
      lines.push(line);
    }

    if (crawlerHealth.recentErrors && crawlerHealth.recentErrors.length > 0) {
      lines.push('');
      lines.push('  Recent Errors:');
      for (const error of crawlerHealth.recentErrors.slice(0, 5)) {
        lines.push(`  ⚠️ ${error.source}: ${error.message}`);
        lines.push(`     ${formatDate(error.timestamp)}`);
      }
    }
  } else {
    lines.push('  No crawler status available.');
  }
  lines.push('');

  lines.push('════════════════════════════════════════════════════════════════');
  lines.push('  OpenOnco Intelligence Daemon · openonco.org');
  lines.push('════════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Generate subject line for Monday digest
 */
export function generateMondayDigestSubject(triageResults, dbStats) {
  const highCount = (triageResults.highPriority || []).length;
  const mediumCount = (triageResults.mediumPriority || []).length;

  const parts = [`Week of ${getWeekDate()}`];

  if (highCount > 0) {
    parts.push(`${highCount} high priority`);
  }
  if (mediumCount > 0) {
    parts.push(`${mediumCount} to review`);
  }

  if (dbStats.brokenUrls > 0) {
    parts.push(`⚠️ ${dbStats.brokenUrls} broken URLs`);
  }

  return `[OpenOnco Monday] ${parts.join(' · ')}`;
}

/**
 * Generate a slim summary digest HTML email with processing instructions.
 * Shows counts, a brief preview of high-priority items, and exact commands
 * to export and process discoveries with Claude Code.
 *
 * @param {Object} opts
 * @param {Object} opts.triageResults - AI triage results with priority arrays
 * @param {Object} opts.healthSummary - Crawler health info
 * @param {Object} opts.queueStatus - Queue counts
 */
export function generateSummaryDigestHtml({ triageResults, healthSummary, queueStatus }) {
  const high = triageResults?.highPriority || [];
  const medium = triageResults?.mediumPriority || [];
  const low = triageResults?.lowPriority || [];
  const total = high.length + medium.length + low.length;
  const hasErrors = healthSummary?.recentErrorCount > 0;
  const weekDate = getWeekDate();

  // Count by source
  const sourceCounts = {};
  for (const item of [...high, ...medium, ...low]) {
    const src = item.source || 'other';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }

  const sourceList = Object.entries(sourceCounts)
    .map(([src, count]) => `<tr><td style="padding:2px 12px 2px 0;color:#333;">${escapeHtml(src)}</td><td style="padding:2px 0;font-weight:600;color:#111;">${count}</td></tr>`)
    .join('');

  const highPreview = high.slice(0, 5)
    .map((h, i) => `<div style="font-size:13px;color:#333;padding:3px 0;">${i + 1}. ${escapeHtml(truncate(h.title || h.action || 'Untitled', 70))} <span style="color:#888;font-size:11px;">${escapeHtml(h.source || '')}</span></div>`)
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:20px;background:#f5f5f5;">
<div style="background:white;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.1);">

  <h1 style="font-size:20px;margin:0 0 4px;color:#111;">OpenOnco Digest</h1>
  <div style="color:#666;font-size:12px;margin-bottom:16px;">Week of ${weekDate}${hasErrors ? ' · <span style="color:#dc2626;">' + healthSummary.recentErrorCount + ' crawler errors</span>' : ' · <span style="color:#059669;">All healthy</span>'}</div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
    <tr>
      <td width="33%" style="padding:8px;text-align:center;background:${high.length > 0 ? '#fef2f2' : '#f8f9fa'};border-radius:6px 0 0 6px;">
        <div style="font-size:22px;font-weight:700;color:${high.length > 0 ? '#dc2626' : '#666'};">${high.length}</div>
        <div style="font-size:10px;color:#666;text-transform:uppercase;">High</div>
      </td>
      <td width="33%" style="padding:8px;text-align:center;background:${medium.length > 0 ? '#fffbeb' : '#f8f9fa'};">
        <div style="font-size:22px;font-weight:700;color:${medium.length > 0 ? '#d97706' : '#666'};">${medium.length}</div>
        <div style="font-size:10px;color:#666;text-transform:uppercase;">Medium</div>
      </td>
      <td width="33%" style="padding:8px;text-align:center;background:#f8f9fa;border-radius:0 6px 6px 0;">
        <div style="font-size:22px;font-weight:700;color:#666;">${low.length}</div>
        <div style="font-size:10px;color:#666;text-transform:uppercase;">Low</div>
      </td>
    </tr>
  </table>

  ${sourceList ? `<table style="font-size:13px;margin-bottom:16px;">${sourceList}</table>` : ''}

  ${high.length > 0 ? `
  <div style="margin-bottom:16px;">
    <div style="font-size:12px;font-weight:600;color:#dc2626;text-transform:uppercase;margin-bottom:6px;">Top High-Priority</div>
    ${highPreview}
    ${high.length > 5 ? `<div style="font-size:11px;color:#888;padding-top:2px;">+ ${high.length - 5} more</div>` : ''}
  </div>` : ''}

  <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-bottom:12px;">
    <div style="font-size:13px;font-weight:600;color:#0369a1;margin-bottom:8px;">How to Process</div>
    <div style="font-size:12px;color:#334155;margin-bottom:6px;">1. Export discoveries to a local file:</div>
    <pre style="background:#1e293b;color:#e2e8f0;padding:10px;border-radius:4px;font-size:11px;margin:0 0 10px;overflow-x:auto;">cd /Users/adickinson/Documents/GitHub/V0/daemon\nnpm run run:export</pre>
    <div style="font-size:12px;color:#334155;margin-bottom:6px;">2. Open Claude Code in the V0 repo and ask:</div>
    <pre style="background:#1e293b;color:#e2e8f0;padding:10px;border-radius:4px;font-size:11px;margin:0;overflow-x:auto;">Read the latest file in daemon/data/exports/ and\nprocess the discoveries using the triage instructions.</pre>
  </div>

  <div style="font-size:11px;color:#888;border-top:1px solid #eee;padding-top:10px;text-align:center;">
    ${total} total discoveries · ${queueStatus?.pendingCount || 0} pending review · OpenOnco Daemon
  </div>

</div>
</body></html>`.trim();
}

/**
 * Generate plain text version of summary digest
 */
export function generateSummaryDigestText({ triageResults, healthSummary, queueStatus }) {
  const high = triageResults?.highPriority || [];
  const medium = triageResults?.mediumPriority || [];
  const low = triageResults?.lowPriority || [];
  const total = high.length + medium.length + low.length;
  const hasErrors = healthSummary?.recentErrorCount > 0;

  const lines = [];
  lines.push('OPENONCO DIGEST');
  lines.push(`Week of ${getWeekDate()}`);
  lines.push(hasErrors ? `Health: ${healthSummary.recentErrorCount} crawler errors` : 'Health: All healthy');
  lines.push('');
  lines.push(`Priorities: ${high.length} HIGH / ${medium.length} MEDIUM / ${low.length} LOW`);
  lines.push('');

  // Count by source
  const sourceCounts = {};
  for (const item of [...high, ...medium, ...low]) {
    const src = item.source || 'other';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  if (Object.keys(sourceCounts).length > 0) {
    lines.push('By source:');
    for (const [src, count] of Object.entries(sourceCounts)) {
      lines.push(`  ${src}: ${count}`);
    }
    lines.push('');
  }

  if (high.length > 0) {
    lines.push('TOP HIGH-PRIORITY:');
    high.slice(0, 5).forEach((h, i) => {
      const src = h.source ? ` [${h.source}]` : '';
      lines.push(`  ${i + 1}. ${truncate(h.title || h.action || 'Untitled', 65)}${src}`);
    });
    if (high.length > 5) lines.push(`  + ${high.length - 5} more`);
    lines.push('');
  }

  lines.push('HOW TO PROCESS:');
  lines.push('  1. Export discoveries:');
  lines.push('     cd /Users/adickinson/Documents/GitHub/V0/daemon');
  lines.push('     npm run run:export');
  lines.push('');
  lines.push('  2. Open Claude Code in the V0 repo and ask:');
  lines.push('     Read the latest file in daemon/data/exports/ and');
  lines.push('     process the discoveries using the triage instructions.');
  lines.push('');
  lines.push(`${total} total · ${queueStatus?.pendingCount || 0} pending · OpenOnco Daemon`);

  return lines.join('\n');
}

/**
 * Generate subject line for summary digest
 */
export function generateSummaryDigestSubject(triageResults) {
  const high = (triageResults?.highPriority || []).length;
  const medium = (triageResults?.mediumPriority || []).length;
  const low = (triageResults?.lowPriority || []).length;
  const total = high + medium + low;

  const parts = [];
  if (high > 0) parts.push(`${high} high priority`);
  if (medium > 0) parts.push(`${medium} medium`);
  if (low > 0) parts.push(`${low} low`);
  if (parts.length === 0) parts.push('No new discoveries');

  return `[OpenOnco] ${total} discoveries — ${parts.join(', ')}`;
}

export default {
  generateDigestHtml,
  generateDigestText,
  generateDigestSubject,
  generateTriageXml,
  generateMondayDigestHtml,
  generateMondayDigestText,
  generateMondayDigestSubject,
  generateCopyPasteBlock,
  generateSummaryDigestHtml,
  generateSummaryDigestText,
  generateSummaryDigestSubject,
};
