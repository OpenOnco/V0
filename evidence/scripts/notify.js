#!/usr/bin/env node
/**
 * Evidence notification emails via Resend API.
 *
 * Exported functions for programmatic use:
 *   notifyDispute(claim, dispute)
 *   notifyNCCNUpdate(guideline, version)
 *   notifyPendingPublication(description, source)
 *   notifyAuditSummary(summary)
 *
 * CLI usage:
 *   node evidence/scripts/notify.js --type dispute --file evidence/meta/disputes.json
 *   node evidence/scripts/notify.js --type nccn --guideline "Colon Cancer" --version "v2.2026"
 *   node evidence/scripts/notify.js --type pending --description "ALTAIR 3-year" --source "https://..."
 *   node evidence/scripts/notify.js --type audit --file evidence/meta/audit-summary.json
 *
 * Environment:
 *   RESEND_API_KEY           — Resend API key
 *   EVIDENCE_NOTIFY_EMAIL    — Recipient email address
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "../..");

const GITHUB_REPO = "https://github.com/OpenOnco/V0";
const FROM = "OpenOnco <notifications@openonco.org>";

// ---------------------------------------------------------------------------
// Resend API helper
// ---------------------------------------------------------------------------

async function sendEmail({ subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.EVIDENCE_NOTIFY_EMAIL || "alexgdickinson@gmail.com";

  if (!apiKey) throw new Error("Missing RESEND_API_KEY environment variable");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function wrap(title, body) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <div style="border-bottom: 2px solid #0ea5e9; padding-bottom: 12px; margin-bottom: 20px;">
    <h2 style="margin: 0; color: #0f172a;">${escHtml(title)}</h2>
  </div>
  ${body}
  <div style="margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
    Sent by the OpenOnco evidence pipeline.
  </div>
</body>
</html>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function repoLink(path, label) {
  const url = `${GITHUB_REPO}/blob/main/${path}`;
  return `<a href="${escHtml(url)}" style="color: #0ea5e9;">${escHtml(label || path)}</a>`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Notification functions
// ---------------------------------------------------------------------------

/**
 * Send weekly scan summary email (heartbeat + changes + flags).
 * @param {object} summary — {
 *   date: string,
 *   status: "changes_merged" | "no_changes" | "tests_failed",
 *   commitHash?: string,
 *   sections: { name: string, changes: string[], flagged: string[] }[],
 *   testOutput?: string
 * }
 */
export async function notifyWeeklySummary(summary) {
  const date = summary?.date || today();
  const status = summary?.status || "unknown";

  const subjectSuffix = {
    changes_merged: "changes merged",
    no_changes: "no changes",
    tests_failed: "TESTS FAILED",
  }[status] || status;
  const subject = `[OpenOnco] Weekly scan — ${date} — ${subjectSuffix}`;

  const sections = summary?.sections || [];

  // Status banner
  const statusLabels = {
    changes_merged: "Changes merged to main",
    no_changes: "No changes found",
    tests_failed: "TESTS FAILED — changes reverted",
    in_progress: "Scan in progress…",
  };
  const statusColors = {
    changes_merged: "#059669",
    no_changes: "#64748b",
    tests_failed: "#dc2626",
    in_progress: "#2563eb",
  };
  const statusLabel = statusLabels[status] || status;
  const statusColor = statusColors[status] || "#64748b";
  const statusBannerHtml = `<p style="font-weight: 600; color: ${statusColor}; margin-bottom: 16px;">${escHtml(statusLabel)}</p>`;

  // Build merged changes HTML
  const mergedItems = sections.flatMap(s => (s.changes || []).map(c => `<li><strong>${escHtml(s.name)}:</strong> ${escHtml(c)}</li>`));
  const mergedHtml = mergedItems.length > 0
    ? `<h3 style="color: #059669;">Auto-merged to main</h3><ul>${mergedItems.join("\n")}</ul>`
    : `<p style="color: #64748b;">No changes found across all checks.</p>`;

  // Build flagged items HTML
  const flaggedItems = sections.flatMap(s => (s.flagged || []).map(f => `<li><strong>${escHtml(s.name)}:</strong> ${escHtml(f)}</li>`));
  const flaggedHtml = flaggedItems.length > 0
    ? `<h3 style="color: #d97706;">Needs your input</h3>
       <div style="background: #fefce8; padding: 12px; border-radius: 6px; border-left: 3px solid #eab308;">
         <ul style="margin: 0; padding-left: 20px;">${flaggedItems.join("\n")}</ul>
       </div>
       <p style="font-size: 13px; color: #64748b;">Open Claude Code and address these items directly.</p>`
    : "";

  // Test failure block
  const testFailHtml = status === "tests_failed"
    ? `<div style="background: #fef2f2; padding: 12px; border-radius: 6px; border-left: 3px solid #ef4444; margin-bottom: 16px;">
         <strong>Smoke tests failed.</strong> All changes were reverted. No code was pushed.
         ${summary.testOutput ? `<pre style="margin-top: 8px; font-size: 12px; overflow-x: auto;">${escHtml(summary.testOutput)}</pre>` : ""}
       </div>`
    : "";

  // Commit info
  const commitHtml = summary.commitHash
    ? `<p style="font-size: 13px; color: #64748b;">Commit: <a href="${GITHUB_REPO}/commit/${escHtml(summary.commitHash)}" style="color: #0ea5e9; font-family: monospace;">${escHtml(summary.commitHash.slice(0, 7))}</a></p>`
    : "";

  const html = wrap(`Weekly Scan — ${date}`, `
    ${statusBannerHtml}
    ${testFailHtml}
    ${mergedHtml}
    ${flaggedHtml}
    ${commitHtml}
  `);

  return sendEmail({ subject, html });
}

/**
 * Send watchdog alert when the weekly scan appears to have not run.
 * @param {object} info — { date: string, lastCommitDate?: string, details?: string }
 */
export async function notifyWatchdogAlert(info) {
  const date = info?.date || today();
  const subject = `[OpenOnco] ALERT: Weekly scan may not have run (${date})`;

  const html = wrap("Watchdog Alert", `
    <div style="background: #fef2f2; padding: 12px; border-radius: 6px; border-left: 3px solid #ef4444; margin-bottom: 16px;">
      <strong>The weekly scan did not send a summary email or push a commit yesterday.</strong>
      <p>This likely means the trigger timed out, errored, or was not scheduled.</p>
    </div>
    ${info?.lastCommitDate ? `<p><strong>Last commit to main:</strong> ${escHtml(info.lastCommitDate)}</p>` : ""}
    ${info?.details ? `<p><strong>Details:</strong> ${escHtml(info.details)}</p>` : ""}
    <h3>What to do</h3>
    <ul>
      <li>Check trigger run history in Claude Code (<code>/schedule list</code>)</li>
      <li>Manually run the weekly scan if needed (<code>/schedule run</code>)</li>
      <li>If this keeps happening, the prompt may be too long and timing out — consider splitting sections</li>
    </ul>
  `);

  return sendEmail({ subject, html });
}

/**
 * Notify about an evidence dispute.
 * @param {object} claim  — { id, finding: { description }, source: { title } }
 * @param {object} dispute — { dispute_notes, verified_by, verified_date }
 */
export async function notifyDispute(claim, dispute) {
  const claimSummary = claim?.finding?.description || claim?.id || "Unknown claim";
  const shortSummary = claimSummary.length > 60
    ? claimSummary.slice(0, 60) + "..."
    : claimSummary;

  const subject = `[OpenOnco] Evidence dispute: ${shortSummary}`;

  const html = wrap("Evidence Dispute", `
    <p><strong>Claim ID:</strong> ${escHtml(claim?.id || "N/A")}</p>
    <p><strong>Claim:</strong> ${escHtml(claimSummary)}</p>
    <p><strong>Source:</strong> ${escHtml(claim?.source?.title || "N/A")}</p>
    <hr style="border: none; border-top: 1px solid #e2e8f0;">
    <p><strong>Dispute notes:</strong></p>
    <p style="background: #fef2f2; padding: 12px; border-radius: 6px; border-left: 3px solid #ef4444;">
      ${escHtml(dispute?.dispute_notes || "No notes provided.")}
    </p>
    <p><strong>Raised by:</strong> ${escHtml(dispute?.verified_by || "N/A")}</p>
    <p><strong>Date:</strong> ${escHtml(dispute?.verified_date || today())}</p>
    <p style="margin-top: 20px;">
      ${repoLink("evidence/claims/", "View claims in GitHub")} |
      ${repoLink("evidence/meta/disputes.json", "View disputes log")}
    </p>
  `);

  return sendEmail({ subject, html });
}

/**
 * Notify about an NCCN guideline update.
 * @param {string} guideline — e.g. "Colon Cancer"
 * @param {string} version   — e.g. "v2.2026"
 */
export async function notifyNCCNUpdate(guideline, version) {
  const subject = `[OpenOnco] NCCN ${guideline} updated to ${version}`;

  const html = wrap("NCCN Guideline Update", `
    <p>The NCCN <strong>${escHtml(guideline)}</strong> guideline has been updated to <strong>${escHtml(version)}</strong>.</p>
    <p style="background: #eff6ff; padding: 12px; border-radius: 6px; border-left: 3px solid #3b82f6;">
      Review the updated guideline and determine if any evidence claims need to be added or revised.
    </p>
    <h3 style="margin-top: 24px;">Action required</h3>
    <ul>
      <li>Check if new ctDNA/MRD recommendations were added</li>
      <li>Update relevant claims in the evidence store</li>
      <li>Re-render physicianFAQ.js if claims changed</li>
    </ul>
    <p style="margin-top: 20px;">
      ${repoLink("evidence/claims/", "View claims")} |
      ${repoLink("src/config/physicianFAQ.js", "View FAQ")}
    </p>
  `);

  return sendEmail({ subject, html });
}

/**
 * Notify about a pending publication that may affect evidence claims.
 * @param {string} description — e.g. "ALTAIR 3-year follow-up"
 * @param {string} source      — URL or citation
 */
export async function notifyPendingPublication(description, source) {
  const subject = `[OpenOnco] Pending publication: ${description}`;

  const html = wrap("Pending Publication", `
    <p><strong>Publication:</strong> ${escHtml(description)}</p>
    <p><strong>Source:</strong> ${source?.startsWith("http")
      ? `<a href="${escHtml(source)}" style="color: #0ea5e9;">${escHtml(source)}</a>`
      : escHtml(source || "N/A")
    }</p>
    <p style="background: #fefce8; padding: 12px; border-radius: 6px; border-left: 3px solid #eab308;">
      This publication may contain new evidence relevant to the claims store. Review when available and extract claims if applicable.
    </p>
    <p style="margin-top: 20px;">
      ${repoLink("evidence/claims/", "View claims")} |
      ${repoLink("evidence/scripts/fetch-paper.js", "Fetch paper script")}
    </p>
  `);

  return sendEmail({ subject, html });
}

/**
 * Notify with monthly audit summary.
 * @param {object} summary — { date, totalClaims, newClaims, disputes, pendingReview, stale, details }
 */
export async function notifyAuditSummary(summary) {
  const date = summary?.date || today();
  const subject = `[OpenOnco] Monthly evidence audit — ${date}`;

  const stats = [
    ["Total claims", summary?.totalClaims ?? "N/A"],
    ["New claims (this month)", summary?.newClaims ?? "N/A"],
    ["Open disputes", summary?.disputes ?? "N/A"],
    ["Pending human review", summary?.pendingReview ?? "N/A"],
    ["Stale claims (>6 months)", summary?.stale ?? "N/A"],
  ];

  const statsHtml = stats
    .map(([label, value]) =>
      `<tr><td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0;">${escHtml(label)}</td>` +
      `<td style="padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${escHtml(String(value))}</td></tr>`
    )
    .join("\n");

  const detailsHtml = summary?.details
    ? `<h3>Details</h3><p style="white-space: pre-wrap;">${escHtml(summary.details)}</p>`
    : "";

  const html = wrap("Monthly Evidence Audit", `
    <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
      ${statsHtml}
    </table>
    ${detailsHtml}
    <p style="margin-top: 20px;">
      ${repoLink("evidence/claims/", "View claims")} |
      ${repoLink("evidence/meta/", "View meta")}
    </p>
  `);

  return sendEmail({ subject, html });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const { values } = parseArgs({
    options: {
      type: { type: "string", short: "t" },
      file: { type: "string", short: "f" },
      guideline: { type: "string" },
      version: { type: "string" },
      description: { type: "string" },
      source: { type: "string" },
    },
    strict: false,
  });

  const { type } = values;

  if (!type) {
    console.error("Usage: node evidence/scripts/notify.js --type <type> [options]");
    console.error("");
    console.error("Types:");
    console.error("  dispute         --file <disputes.json>           Send dispute notification");
    console.error("  nccn            --guideline <name> --version <v> Send NCCN update notification");
    console.error("  pending         --description <desc> --source <url> Send pending publication notification");
    console.error("  audit           --file <audit-summary.json>      Send monthly audit summary");
    console.error("  weekly-summary  --file <summary.json>            Send weekly scan summary email");
    console.error("  watchdog        [--file <info.json>]             Send watchdog alert (missing scan)");
    process.exit(1);
  }

  switch (type) {
    case "dispute": {
      if (!values.file) {
        console.error("--file required for dispute notifications");
        process.exit(1);
      }
      const filePath = resolve(PROJECT_ROOT, values.file);
      const data = JSON.parse(readFileSync(filePath, "utf-8"));
      // Support both single dispute object and array of disputes
      const disputes = Array.isArray(data) ? data : [data];
      for (const item of disputes) {
        const claim = item.claim || { id: item.claim_id, finding: { description: item.description } };
        const dispute = item.dispute || item.verification || item;
        const result = await notifyDispute(claim, dispute);
        console.log(`Sent dispute notification: ${result.id}`);
      }
      break;
    }

    case "nccn": {
      if (!values.guideline || !values.version) {
        console.error("--guideline and --version required for NCCN notifications");
        process.exit(1);
      }
      const result = await notifyNCCNUpdate(values.guideline, values.version);
      console.log(`Sent NCCN update notification: ${result.id}`);
      break;
    }

    case "pending": {
      if (!values.description) {
        console.error("--description required for pending publication notifications");
        process.exit(1);
      }
      const result = await notifyPendingPublication(values.description, values.source || "");
      console.log(`Sent pending publication notification: ${result.id}`);
      break;
    }

    case "audit": {
      if (!values.file) {
        console.error("--file required for audit notifications");
        process.exit(1);
      }
      const filePath = resolve(PROJECT_ROOT, values.file);
      const summary = JSON.parse(readFileSync(filePath, "utf-8"));
      const result = await notifyAuditSummary(summary);
      console.log(`Sent audit summary notification: ${result.id}`);
      break;
    }

    case "weekly-summary": {
      if (!values.file) {
        console.error("--file required for weekly-summary notifications");
        process.exit(1);
      }
      const filePath = resolve(PROJECT_ROOT, values.file);
      const summary = JSON.parse(readFileSync(filePath, "utf-8"));
      const result = await notifyWeeklySummary(summary);
      console.log(`Sent weekly summary notification: ${result.id}`);
      break;
    }

    case "watchdog": {
      const info = values.file
        ? JSON.parse(readFileSync(resolve(PROJECT_ROOT, values.file), "utf-8"))
        : { date: new Date().toISOString().slice(0, 10), details: values.description || "" };
      const result = await notifyWatchdogAlert(info);
      console.log(`Sent watchdog alert: ${result.id}`);
      break;
    }

    default:
      console.error(`Unknown notification type: ${type}`);
      process.exit(1);
  }
}

// Run CLI if invoked directly
const isMain = process.argv[1] &&
  (process.argv[1] === fileURLToPath(import.meta.url) ||
   process.argv[1].endsWith("/notify.js"));

if (isMain) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
