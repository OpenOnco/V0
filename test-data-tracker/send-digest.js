/**
 * Weekly Digest Email - Simplified for insurance coverage monitoring
 */

import 'dotenv/config';
import { Resend } from 'resend';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

const resend = new Resend(process.env.RESEND_API_KEY);

function loadDiscoveries() {
  try {
    const data = readFileSync(join(DATA_DIR, 'discoveries.json'), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function generateEmailHtml(discoveries) {
  const pending = discoveries.filter(d => d.status === 'pending');
  const bySource = {
    cms: pending.filter(d => d.source === 'cms'),
    payers: pending.filter(d => d.source === 'payers'),
    vendor: pending.filter(d => d.source === 'vendor'),
  };

  const sourceNames = { cms: 'Medicare/CMS', payers: 'Private Payers', vendor: 'Vendor Coverage' };
  const sourceColors = { cms: '#3b82f6', payers: '#10b981', vendor: '#f59e0b' };

  let itemsHtml = '';

  for (const [source, items] of Object.entries(bySource)) {
    if (items.length === 0) continue;

    const itemCards = items.map(item => {
      const aiNote = item.data?.metadata?.aiAnalysis?.keyChanges || item.data?.metadata?.aiAnalysis?.changeSummary || '';
      return `<div style="background:#f9fafb;border-left:3px solid ${sourceColors[source]};padding:12px 16px;margin-bottom:8px;border-radius:0 4px 4px 0;">
          <div style="font-weight:600;color:#111827;margin-bottom:4px;">${item.title}</div>
          <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">${item.summary || ''}</div>
          ${item.url ? `<a href="${item.url}" style="font-size:12px;color:#3b82f6;">View source</a>` : ''}
          ${aiNote ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:12px;color:#4b5563;"><strong>AI:</strong> ${aiNote}</div>` : ''}
        </div>`;
    }).join('');

    itemsHtml += `<div style="margin-bottom:24px;">
        <h3 style="margin:0 0 12px 0;color:#374151;font-size:14px;text-transform:uppercase;letter-spacing:0.5px;">${sourceNames[source]} (${items.length})</h3>
        ${itemCards}
      </div>`;
  }

  const weekDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.5;color:#1f2937;max-width:640px;margin:0 auto;padding:20px;background:#f3f4f6;">
  <div style="background:white;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="margin:0 0 4px 0;font-size:20px;color:#111827;">OpenOnco Coverage Digest</h1>
    <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;">Week of ${weekDate}</p>
    <div style="background:#eff6ff;border-radius:6px;padding:16px;margin-bottom:24px;">
      <div style="font-size:32px;font-weight:700;color:#1e40af;">${pending.length}</div>
      <div style="font-size:13px;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px;">Discoveries Pending Review</div>
    </div>
    ${itemsHtml || '<p style="color:#6b7280;font-style:italic;">No new discoveries this week.</p>'}
    <div style="margin-top:32px;padding-top:24px;border-top:2px solid #e5e7eb;">
      <h2 style="margin:0 0 12px 0;font-size:16px;color:#111827;">Review Instructions</h2>
      <p style="margin:0 0 16px 0;color:#4b5563;font-size:14px;">Open Claude and say:</p>
      <div style="background:#1e293b;color:#e2e8f0;padding:16px;border-radius:6px;font-family:monospace;font-size:13px;">Review this week's coverage discoveries and prepare database updates</div>
    </div>
  </div>
</body>
</html>`;
}

function generateEmailText(discoveries) {
  const pending = discoveries.filter(d => d.status === 'pending');
  let text = `OPENONCO COVERAGE DIGEST\nWeek of ${new Date().toLocaleDateString()}\n${'='.repeat(50)}\n\n${pending.length} discoveries pending review\n\n`;
  for (const item of pending) {
    text += `[${item.source.toUpperCase()}] ${item.title}\n`;
    if (item.summary) text += `  ${item.summary}\n`;
    if (item.url) text += `  ${item.url}\n`;
    text += '\n';
  }
  text += `${'='.repeat(50)}\nTo review: Open Claude and say:\n"Review this week's coverage discoveries"\n`;
  return text;
}

async function sendWeeklyDigest() {
  const discoveries = loadDiscoveries();
  const pending = discoveries.filter(d => d.status === 'pending');
  console.log(`Found ${pending.length} pending discoveries`);

  if (pending.length === 0) {
    console.log('No pending discoveries, skipping email');
    return { skipped: true };
  }

  const subject = `[OpenOnco] ${pending.length} coverage ${pending.length === 1 ? 'update' : 'updates'} to review`;

  const result = await resend.emails.send({
    from: process.env.DIGEST_FROM_EMAIL || 'OpenOnco Daemon <daemon@openonco.org>',
    to: process.env.ALERT_EMAIL || 'alexgdickinson@gmail.com',
    subject,
    html: generateEmailHtml(discoveries),
    text: generateEmailText(discoveries),
  });

  console.log('Email sent:', result);
  return result;
}

sendWeeklyDigest()
  .then(result => { console.log('Done:', result); process.exit(0); })
  .catch(err => { console.error('Error:', err); process.exit(1); });
