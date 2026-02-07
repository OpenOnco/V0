/**
 * Physician Digest Email Template
 * Weekly MRD/ctDNA clinical intelligence digest
 *
 * Sections:
 * 1. Clinical Evidence Highlights
 * 2. Coverage Updates
 * 3. New Tests & Developments
 * 4. Guideline Updates
 * 5. Quick Links
 * 6. Footer (unsubscribe, preferences, branding)
 */

const SITE_URL = process.env.SITE_URL || 'https://www.openonco.org';

/**
 * Generate the email subject line
 */
export function generatePhysicianDigestSubject(content, weekDate) {
  const weekStr = weekDate ? formatDate(weekDate) : formatDate(new Date());
  const highlights = [];

  if (content.clinicalEvidence.length > 0) {
    highlights.push(`${content.clinicalEvidence.length} evidence`);
  }
  if (content.coverageUpdates.length > 0) {
    highlights.push(`${content.coverageUpdates.length} coverage`);
  }
  if (content.guidelineUpdates.length > 0) {
    highlights.push(`${content.guidelineUpdates.length} guideline`);
  }
  if (content.fundingHighlights && content.fundingHighlights.length > 0) {
    highlights.push(`${content.fundingHighlights.length} NIH grants`);
  }

  const summary = highlights.length > 0 ? ` — ${highlights.join(', ')}` : '';
  return `MRD Weekly Digest${summary} (${weekStr})`;
}

/**
 * Generate HTML email body
 */
export function generatePhysicianDigestHtml(content, { unsubscribeToken, weekDate } = {}) {
  const weekStr = weekDate ? formatDate(weekDate) : formatDate(new Date());
  const unsubscribeUrl = `${SITE_URL}/api/mrd-digest/unsubscribe?token=${unsubscribeToken || ''}`;
  const preferencesUrl = `${SITE_URL}/digest?manage=${unsubscribeToken || ''}`;

  const sections = [];

  // Clinical Evidence
  if (content.clinicalEvidence.length > 0) {
    const items = content.clinicalEvidence.map(item => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <a href="${escapeHtml(item.source_url || '#')}" style="color:#059669;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(item.title)}</a>
          ${item.journal ? `<br><span style="color:#94a3b8;font-size:12px;">${escapeHtml(item.journal)}${item.publication_date ? ` — ${formatDate(item.publication_date)}` : ''}</span>` : ''}
          ${item.summary ? `<br><span style="color:#64748b;font-size:13px;line-height:1.5;">${escapeHtml(item.summary)}</span>` : ''}
        </td>
      </tr>`).join('');

    sections.push(sectionBlock('Clinical Evidence Highlights', items, '#059669'));
  }

  // Coverage Updates
  if (content.coverageUpdates.length > 0) {
    const items = content.coverageUpdates.map(item => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#334155;font-weight:600;font-size:14px;">${escapeHtml(item.title)}</span>
          ${item.summary ? `<br><span style="color:#64748b;font-size:13px;">${escapeHtml(item.summary)}</span>` : ''}
          ${item.source_url ? `<br><a href="${escapeHtml(item.source_url)}" style="color:#3b82f6;font-size:12px;text-decoration:none;">View policy</a>` : ''}
        </td>
      </tr>`).join('');

    sections.push(sectionBlock('Coverage Updates', items, '#3b82f6'));
  }

  // New Tests & Developments
  if (content.newTests.length > 0) {
    const items = content.newTests.map(item => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#334155;font-weight:600;font-size:14px;">${escapeHtml(item.title)}</span>
          ${item.summary ? `<br><span style="color:#64748b;font-size:13px;">${escapeHtml(item.summary)}</span>` : ''}
        </td>
      </tr>`).join('');

    sections.push(sectionBlock('New Tests & Developments', items, '#8b5cf6'));
  }

  // Guideline Updates
  if (content.guidelineUpdates.length > 0) {
    const items = content.guidelineUpdates.map(item => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <span style="color:#334155;font-weight:600;font-size:14px;">${escapeHtml(item.title)}</span>
          ${item.summary ? `<br><span style="color:#64748b;font-size:13px;">${escapeHtml(item.summary)}</span>` : ''}
          ${item.source_url ? `<br><a href="${escapeHtml(item.source_url)}" style="color:#059669;font-size:12px;text-decoration:none;">View guideline</a>` : ''}
        </td>
      </tr>`).join('');

    sections.push(sectionBlock('Guideline Updates', items, '#f59e0b'));
  }

  // Funding Highlights (NIH grants)
  if (content.fundingHighlights && content.fundingHighlights.length > 0) {
    const items = content.fundingHighlights.map(item => `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <a href="${escapeHtml(item.source_url || '#')}" style="color:#059669;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(item.title)}</a>
          ${item.summary ? `<br><span style="color:#64748b;font-size:13px;">${escapeHtml(item.summary)}</span>` : ''}
        </td>
      </tr>`).join('');

    sections.push(sectionBlock('NIH Funding Highlights', items, '#0891b2'));
  }

  // Empty state
  if (sections.length === 0) {
    sections.push(`
      <tr>
        <td style="padding:32px 40px;text-align:center;">
          <p style="color:#64748b;font-size:14px;">No new MRD/ctDNA developments this week. Check back next Monday!</p>
        </td>
      </tr>`);
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#047857);padding:28px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">OpenOnco MRD Weekly Digest</h1>
              <p style="margin:6px 0 0;color:#a7f3d0;font-size:13px;">Week of ${weekStr} &mdash; ${content.totalItems} item${content.totalItems !== 1 ? 's' : ''}</p>
            </td>
          </tr>

          ${sections.join('')}

          <!-- Quick Links -->
          <tr>
            <td style="padding:24px 40px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;color:#334155;font-size:13px;font-weight:600;">Quick Links</p>
              <p style="margin:0;font-size:13px;">
                <a href="${SITE_URL}/monitor" style="color:#059669;text-decoration:none;">View all MRD tests</a>
                &nbsp;&bull;&nbsp;
                <a href="${SITE_URL}/clinician" style="color:#059669;text-decoration:none;">Ask MRD Assistant</a>
                &nbsp;&bull;&nbsp;
                <a href="${preferencesUrl}" style="color:#059669;text-decoration:none;">Manage preferences</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;">
                You're receiving this because you subscribed to the OpenOnco MRD Weekly Digest.
              </p>
              <p style="margin:0;color:#94a3b8;font-size:11px;">
                <a href="${unsubscribeUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>
                &nbsp;&bull;&nbsp;
                <a href="${preferencesUrl}" style="color:#94a3b8;text-decoration:underline;">Preferences</a>
                &nbsp;&bull;&nbsp;
                <a href="${SITE_URL}" style="color:#94a3b8;text-decoration:underline;">OpenOnco</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate plain text email body
 */
export function generatePhysicianDigestText(content, { unsubscribeToken, weekDate } = {}) {
  const weekStr = weekDate ? formatDate(weekDate) : formatDate(new Date());
  const unsubscribeUrl = `${SITE_URL}/api/mrd-digest/unsubscribe?token=${unsubscribeToken || ''}`;
  const preferencesUrl = `${SITE_URL}/digest?manage=${unsubscribeToken || ''}`;

  const lines = [
    `OPENONCO MRD WEEKLY DIGEST`,
    `Week of ${weekStr} — ${content.totalItems} items`,
    '',
  ];

  if (content.clinicalEvidence.length > 0) {
    lines.push('=== CLINICAL EVIDENCE ===', '');
    for (const item of content.clinicalEvidence) {
      lines.push(`* ${item.title}`);
      if (item.journal) lines.push(`  ${item.journal}${item.publication_date ? ` — ${formatDate(item.publication_date)}` : ''}`);
      if (item.summary) lines.push(`  ${item.summary}`);
      if (item.source_url) lines.push(`  ${item.source_url}`);
      lines.push('');
    }
  }

  if (content.coverageUpdates.length > 0) {
    lines.push('=== COVERAGE UPDATES ===', '');
    for (const item of content.coverageUpdates) {
      lines.push(`* ${item.title}`);
      if (item.summary) lines.push(`  ${item.summary}`);
      if (item.source_url) lines.push(`  ${item.source_url}`);
      lines.push('');
    }
  }

  if (content.newTests.length > 0) {
    lines.push('=== NEW TESTS & DEVELOPMENTS ===', '');
    for (const item of content.newTests) {
      lines.push(`* ${item.title}`);
      if (item.summary) lines.push(`  ${item.summary}`);
      lines.push('');
    }
  }

  if (content.guidelineUpdates.length > 0) {
    lines.push('=== GUIDELINE UPDATES ===', '');
    for (const item of content.guidelineUpdates) {
      lines.push(`* ${item.title}`);
      if (item.summary) lines.push(`  ${item.summary}`);
      lines.push('');
    }
  }

  if (content.fundingHighlights && content.fundingHighlights.length > 0) {
    lines.push('=== NIH FUNDING HIGHLIGHTS ===', '');
    for (const item of content.fundingHighlights) {
      lines.push(`* ${item.title}`);
      if (item.summary) lines.push(`  ${item.summary}`);
      if (item.source_url) lines.push(`  ${item.source_url}`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push(`View all MRD tests: ${SITE_URL}/monitor`);
  lines.push(`Ask MRD Assistant: ${SITE_URL}/clinician`);
  lines.push(`Manage preferences: ${preferencesUrl}`);
  lines.push(`Unsubscribe: ${unsubscribeUrl}`);

  return lines.join('\n');
}

// --- Helpers ---

function sectionBlock(title, itemsHtml, accentColor) {
  return `
    <tr>
      <td style="padding:24px 40px 8px;">
        <h2 style="margin:0;color:${accentColor};font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(title)}</h2>
      </td>
    </tr>
    <tr>
      <td style="padding:0 40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${itemsHtml}
        </table>
      </td>
    </tr>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default {
  generatePhysicianDigestSubject,
  generatePhysicianDigestHtml,
  generatePhysicianDigestText,
};
