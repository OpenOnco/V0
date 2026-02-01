#!/usr/bin/env node
/**
 * Proposal Review Tool
 *
 * Workflow:
 * 1. Review all pending proposals (approve/reject)
 * 2. Once all reviewed, Execute button appears
 * 3. Execute applies changes to data.js, runs tests, commits, deploys
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = 3456;
const PROPOSALS_DIR = join(ROOT, 'daemon', 'data', 'proposals');
const DATA_JS = join(ROOT, 'src', 'data.js');

const TYPE_DIRS = { coverage: 'coverage', update: 'updates', 'new-test': 'new-tests' };

// Load proposals
function loadProposals() {
  const proposals = [];
  for (const [type, subdir] of Object.entries(TYPE_DIRS)) {
    const dir = join(PROPOSALS_DIR, subdir);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      try {
        proposals.push(JSON.parse(readFileSync(join(dir, file), 'utf-8')));
      } catch (e) {}
    }
  }
  return proposals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function saveProposal(p) {
  const subdir = TYPE_DIRS[p.type];
  if (!subdir) return;
  writeFileSync(join(PROPOSALS_DIR, subdir, `${p.id}.json`), JSON.stringify(p, null, 2));
}

// Apply a coverage proposal to data.js
function applyCoverageProposal(p, dataJs) {
  // Find the test by name or ID
  const testName = p.testName || '';
  const testId = p.testId || '';

  // Look for the test object - find by name first (handles both "name": and name:)
  const namePattern = new RegExp(`("name"|name):\\s*["'\`]${escapeRegex(testName)}["'\`]`, 'i');
  const idPattern = new RegExp(`("id"|id):\\s*["'\`]${escapeRegex(testId)}["'\`]`, 'i');

  let testMatch = dataJs.match(namePattern) || dataJs.match(idPattern);
  if (!testMatch) {
    return { success: false, error: `Test "${testName}" not found in data.js` };
  }

  // Find the test object boundaries
  const matchIndex = testMatch.index;

  // Find the opening brace before this match
  let braceCount = 0;
  let objectStart = matchIndex;
  for (let i = matchIndex; i >= 0; i--) {
    if (dataJs[i] === '}') braceCount++;
    if (dataJs[i] === '{') {
      if (braceCount === 0) {
        objectStart = i;
        break;
      }
      braceCount--;
    }
  }

  // Find the closing brace
  braceCount = 1;
  let objectEnd = objectStart + 1;
  for (let i = objectStart + 1; i < dataJs.length; i++) {
    if (dataJs[i] === '{') braceCount++;
    if (dataJs[i] === '}') braceCount--;
    if (braceCount === 0) {
      objectEnd = i;
      break;
    }
  }

  const testObject = dataJs.slice(objectStart, objectEnd + 1);

  // Check if payerCoverage exists
  const payerEntry = `{ payer: "${p.payer}", status: "${p.coverageStatus || 'covered'}"${p.conditions ? `, conditions: "${p.conditions}"` : ''}, source: "${p.source}", updatedAt: "${new Date().toISOString().split('T')[0]}" }`;

  let newTestObject;
  if (testObject.includes('payerCoverage:')) {
    // Add to existing array
    newTestObject = testObject.replace(
      /(payerCoverage:\s*\[)/,
      `$1\n      ${payerEntry},`
    );
  } else {
    // Add new payerCoverage array before the closing brace
    newTestObject = testObject.slice(0, -1) + `,\n    payerCoverage: [\n      ${payerEntry}\n    ]\n  }`;
  }

  const newDataJs = dataJs.slice(0, objectStart) + newTestObject + dataJs.slice(objectEnd + 1);
  return { success: true, dataJs: newDataJs };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Execute: apply all approved proposals
function executeProposals(proposals) {
  const approved = proposals.filter(p => p.status === 'approved');
  if (approved.length === 0) return { success: false, error: 'No approved proposals' };

  let dataJs = readFileSync(DATA_JS, 'utf-8');
  const results = [];

  for (const p of approved) {
    if (p.type === 'coverage') {
      const result = applyCoverageProposal(p, dataJs);
      if (result.success) {
        dataJs = result.dataJs;
        results.push({ id: p.id, success: true });
      } else {
        results.push({ id: p.id, success: false, error: result.error });
      }
    } else {
      // For update and new-test, just note that manual intervention needed
      results.push({ id: p.id, success: false, error: `${p.type} proposals require manual application` });
    }
  }

  // Write updated data.js
  const successCount = results.filter(r => r.success).length;
  if (successCount > 0) {
    writeFileSync(DATA_JS, dataJs);
  }

  return { success: true, results, applied: successCount };
}

// Run shell command and return promise
function runCommand(cmd, cwd = ROOT) {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      resolve({ success: !error, stdout, stderr, error });
    });
  });
}

// HTML
const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Proposal Review</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #111; color: #eee; padding: 24px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 20px; margin-bottom: 24px; color: #fff; }
    .status-bar { display: flex; gap: 16px; margin-bottom: 24px; padding: 16px; background: #1a1a1a; border-radius: 8px; }
    .status-item { text-align: center; }
    .status-num { font-size: 28px; font-weight: bold; }
    .status-num.pending { color: #f59e0b; }
    .status-num.approved { color: #22c55e; }
    .status-num.rejected { color: #ef4444; }
    .status-label { font-size: 12px; color: #888; }
    .card { background: #1a1a1a; border-radius: 8px; margin-bottom: 12px; padding: 16px; }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .card-info { flex: 1; }
    .card-type { font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 4px; }
    .card-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    .card-meta { font-size: 13px; color: #888; }
    .card-actions { display: flex; gap: 8px; }
    .btn { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
    .btn-approve { background: #166534; color: #fff; }
    .btn-approve:hover { background: #15803d; }
    .btn-reject { background: #7f1d1d; color: #fff; }
    .btn-reject:hover { background: #991b1b; }
    .btn-execute { background: #2563eb; color: #fff; padding: 12px 24px; font-size: 15px; width: 100%; margin-top: 24px; }
    .btn-execute:hover { background: #1d4ed8; }
    .btn-execute:disabled { background: #333; color: #666; cursor: not-allowed; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
    .badge-approved { background: #166534; color: #fff; }
    .badge-rejected { background: #7f1d1d; color: #fff; }
    .details { margin-top: 12px; padding-top: 12px; border-top: 1px solid #333; font-size: 13px; color: #aaa; }
    .details a { color: #60a5fa; }
    .log { background: #0a0a0a; border-radius: 8px; padding: 16px; margin-top: 16px; font-family: monospace; font-size: 12px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; display: none; }
    .log.visible { display: block; }
    .empty { text-align: center; padding: 48px; color: #666; }
    .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; }
    .modal-box { background: #1a1a1a; padding: 24px; border-radius: 12px; width: 400px; }
    .modal-box h3 { margin-bottom: 16px; }
    .modal-box textarea { width: 100%; background: #111; border: 1px solid #333; color: #fff; padding: 12px; border-radius: 6px; resize: none; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .btn-cancel { background: #333; color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Proposal Review</h1>

    <div class="status-bar">
      <div class="status-item"><div class="status-num pending" id="pendingCount">0</div><div class="status-label">Pending</div></div>
      <div class="status-item"><div class="status-num approved" id="approvedCount">0</div><div class="status-label">Approved</div></div>
      <div class="status-item"><div class="status-num rejected" id="rejectedCount">0</div><div class="status-label">Rejected</div></div>
    </div>

    <div id="proposals"></div>

    <button class="btn btn-execute" id="executeBtn" disabled onclick="execute()">
      Execute: Apply Changes & Deploy
    </button>

    <div class="log" id="log"></div>
  </div>

  <div id="modal" class="modal" style="display:none">
    <div class="modal-box">
      <h3>Reject Proposal</h3>
      <textarea id="rejectReason" rows="3" placeholder="Reason..."></textarea>
      <div class="modal-actions">
        <button class="btn btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="btn btn-reject" onclick="confirmReject()">Reject</button>
      </div>
    </div>
  </div>

  <script>
    let proposals = [];
    let rejectingId = null;

    async function load() {
      const res = await fetch('/api/proposals');
      proposals = (await res.json()).proposals;
      render();
    }

    function render() {
      const pending = proposals.filter(p => p.status === 'pending');
      const approved = proposals.filter(p => p.status === 'approved');
      const rejected = proposals.filter(p => p.status === 'rejected');

      document.getElementById('pendingCount').textContent = pending.length;
      document.getElementById('approvedCount').textContent = approved.length;
      document.getElementById('rejectedCount').textContent = rejected.length;

      // Show execute button only when no pending and some approved
      const canExecute = pending.length === 0 && approved.length > 0;
      document.getElementById('executeBtn').disabled = !canExecute;

      // Only show pending proposals - reviewed ones are done
      if (pending.length === 0) {
        if (approved.length > 0) {
          document.getElementById('proposals').innerHTML = '<div class="empty">All proposals reviewed. Click Execute to apply ' + approved.length + ' approved change(s).</div>';
        } else {
          document.getElementById('proposals').innerHTML = '<div class="empty">No pending proposals</div>';
        }
        return;
      }

      document.getElementById('proposals').innerHTML = pending.map(p => {
        const name = p.testName || p.testData?.name || 'Unknown';
        const payer = p.payer ? \` → \${p.payer}\` : '';
        const confidence = Math.round((p.confidence || 0.7) * 100);

        let details = '';
        if (p.snippet) details += \`<div style="margin-bottom:8px">"\${p.snippet}"</div>\`;
        if (p.source) details += \`<div><a href="\${p.source}" target="_blank">\${p.source}</a></div>\`;

        return \`
          <div class="card">
            <div class="card-header">
              <div class="card-info">
                <div class="card-type">\${p.type} · \${confidence}% confidence</div>
                <div class="card-title">\${name}\${payer}</div>
                <div class="card-meta">\${p.coverageStatus || ''}</div>
              </div>
              <div class="card-actions">
                <button class="btn btn-approve" onclick="approve('\${p.id}')">Approve</button>
                <button class="btn btn-reject" onclick="reject('\${p.id}')">Reject</button>
              </div>
            </div>
            \${details ? \`<div class="details">\${details}</div>\` : ''}
          </div>
        \`;
      }).join('');
    }

    async function approve(id) {
      await fetch('/api/approve', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id}) });
      load();
    }

    function reject(id) {
      rejectingId = id;
      document.getElementById('modal').style.display = 'flex';
      document.getElementById('rejectReason').value = '';
    }

    function closeModal() {
      document.getElementById('modal').style.display = 'none';
    }

    async function confirmReject() {
      const reason = document.getElementById('rejectReason').value.trim();
      if (!reason) return;
      await fetch('/api/reject', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: rejectingId, reason}) });
      closeModal();
      load();
    }

    async function execute() {
      if (!confirm('Apply all approved changes and deploy to production?')) return;

      const log = document.getElementById('log');
      log.classList.add('visible');
      log.textContent = 'Starting execution...\\n';

      const addLog = (msg) => { log.textContent += msg + '\\n'; log.scrollTop = log.scrollHeight; };

      // Apply proposals
      addLog('Applying proposals to data.js...');
      const applyRes = await fetch('/api/execute', { method: 'POST' });
      const applyData = await applyRes.json();

      if (!applyData.success) {
        addLog('ERROR: ' + applyData.error);
        return;
      }

      addLog(\`Applied \${applyData.applied} proposal(s)\`);
      for (const r of applyData.results) {
        addLog(\`  \${r.id}: \${r.success ? 'OK' : r.error}\`);
      }

      // Run tests
      addLog('\\nRunning smoke tests...');
      const testRes = await fetch('/api/test');
      const testData = await testRes.json();

      if (!testData.success) {
        addLog('TESTS FAILED:\\n' + testData.output);
        addLog('\\nAborting. Fix tests and try again.');
        return;
      }
      addLog('Tests passed!');

      // Deploy
      addLog('\\nDeploying via ./release...');
      const deployRes = await fetch('/api/deploy');
      const deployData = await deployRes.json();

      if (!deployData.success) {
        addLog('Deploy failed:\\n' + deployData.output);
        return;
      }
      addLog(deployData.output);

      // Mark as applied
      addLog('\\nMarking proposals as applied...');
      await fetch('/api/mark-applied', { method: 'POST' });

      addLog('\\n✓ Done!');
      load();
    }

    load();
  </script>
</body>
</html>`;

// Server
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(HTML);
  }

  if (url.pathname === '/api/proposals') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ proposals: loadProposals() }));
  }

  if (url.pathname === '/api/approve' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { id } = JSON.parse(body);
      const p = loadProposals().find(x => x.id === id);
      if (p) { p.status = 'approved'; p.reviewedAt = new Date().toISOString(); saveProposal(p); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  if (url.pathname === '/api/reject' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const { id, reason } = JSON.parse(body);
      const p = loadProposals().find(x => x.id === id);
      if (p) { p.status = 'rejected'; p.reviewedAt = new Date().toISOString(); p.rejectionReason = reason; saveProposal(p); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  if (url.pathname === '/api/execute' && req.method === 'POST') {
    const result = executeProposals(loadProposals());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  }

  if (url.pathname === '/api/test') {
    runCommand('npm run test:smoke').then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: result.success, output: result.stdout + result.stderr }));
    });
    return;
  }

  if (url.pathname === '/api/deploy') {
    runCommand('./release').then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: result.success, output: result.stdout + result.stderr }));
    });
    return;
  }

  if (url.pathname === '/api/mark-applied' && req.method === 'POST') {
    for (const p of loadProposals().filter(x => x.status === 'approved')) {
      p.status = 'applied';
      p.appliedAt = new Date().toISOString();
      saveProposal(p);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  Proposal Review: http://localhost:${PORT}\n`);
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${cmd} http://localhost:${PORT}`);
});
