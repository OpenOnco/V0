# Scheduled Task Health Check

**Purpose:** Spot-check that the 3 Claude Code `/schedule` tasks are running, producing accurate data, and not missing important updates.

**How to use:** Open Claude Code in the V0 directory and paste this entire prompt.

---

## Prompt

```
You are auditing the health of 3 scheduled data-monitoring tasks that replaced OpenOnco's custom crawler infrastructure. These tasks edit files in this repo and push branches prefixed with `auto/`.

The 3 tasks:
1. **Weekly Data Monitor** (Monday 9 AM PT) — checks CMS Medicare API for LCD/NCD changes + web searches vendor press releases + checks for new NCCN guideline versions → edits `src/data.js` → pushes branch `auto/weekly-monitor-YYYY-MM-DD`
2. **Monthly Data Scan** (1st of month 8 AM PT) — searches PubMed for new publications, checks FDA actions, checks payer policy pages → edits `src/data.js` → pushes branch `auto/monthly-scan-YYYY-MM-DD`
3. **Monthly FAQ Refresh** (1st of month 10 AM PT) — searches for new MRD evidence → rewrites `src/physicianFAQ.js` → pushes branch `auto/faq-refresh-YYYY-MM-DD`

Run ALL of the following checks, then give me a summary report.

---

### CHECK 1: Task execution history

```bash
# Show all auto/* branches with dates
git branch -r | grep auto | while read branch; do
  echo "$(git log -1 --format='%ci' $branch) $branch"
done | sort -r

# Recent changes to the monitored files
git log --oneline --since="30 days ago" -- src/data.js src/physicianFAQ.js
```

For each task, report:
- Last run date (from branch timestamps)
- Whether it's on schedule (weekly should have branches every Monday, monthly on the 1st)
- Any gaps or missed runs

---

### CHECK 2: CMS coverage accuracy (spot-check Task 1)

Verify the current state of CMS coverage data in data.js against live CMS sources:

```bash
# Find all tests with medicareCoverage data
node -e "
  const d = require('./src/data.js');
  const tests = d.tests || d.default?.tests || [];
  tests.filter(t => t.medicareCoverage).forEach(t => {
    console.log(t.id, t.name, JSON.stringify(t.medicareCoverage?.lcd || 'none'));
  });
"
```

Then independently verify against the CMS API:
- Search `https://api.coverage.cms.gov` for the 4 key MolDX LCDs: L38779, L38822, L38835, L38816
- Check if any have been updated, superseded, or replaced since the last task run
- Compare LCD references in data.js against what CMS currently shows
- Flag any discrepancies

---

### CHECK 3: Vendor news completeness (spot-check Task 1)

Web search for recent news from the top 5 vendors by test count:
- GRAIL (Galleri)
- Guardant Health (Shield, Reveal, 360)
- Exact Sciences / Thrive (CancerSEEK)
- Natera (Signatera, Prospera)
- Foundation Medicine (FoundationOne CDx, Liquid CDx)

For each: search "[vendor name] liquid biopsy 2026" and "[vendor name] FDA announcement 2026"

Compare findings against recent data.js changes. Flag:
- FDA status changes not reflected in data.js
- New test launches not added
- Significant trial results not noted
- PAP program changes missed

---

### CHECK 4: PubMed publication counts (spot-check Task 2)

Pick 5 tests at random from data.js that have a `numPublications` field. For each:

```bash
node -e "
  const d = require('./src/data.js');
  const tests = d.tests || d.default?.tests || [];
  const withPubs = tests.filter(t => t.numPublications);
  // Pick 5 random
  const sample = withPubs.sort(() => Math.random() - 0.5).slice(0, 5);
  sample.forEach(t => console.log(t.id, t.name, 'numPublications:', t.numPublications));
"
```

Then search PubMed (via `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=TESTNAME`) for each test name and compare the result count against what's in data.js.

Flag if data.js count is off by more than 20% from the live PubMed count.

---
```

### CHECK 5: FDA status accuracy (spot-check Task 2)

Pick 3 tests that have an `fdaStatus` field. For each, web search "[test name] FDA status" and verify:
- The status in data.js matches reality (e.g., "FDA cleared", "Breakthrough Device", "LDT", "510(k) cleared")
- No recent FDA actions (approval, clearance, de novo) have been missed

```bash
node -e "
  const d = require('./src/data.js');
  const tests = d.tests || d.default?.tests || [];
  const withFDA = tests.filter(t => t.fdaStatus && t.fdaStatus !== 'LDT');
  withFDA.forEach(t => console.log(t.id, t.name, 'fdaStatus:', t.fdaStatus));
"
```

---

### CHECK 6: FAQ freshness (spot-check Task 3)

```bash
# When was physicianFAQ.js last modified?
git log -1 --format='%ci %s' -- src/physicianFAQ.js

# How many FAQ entries exist?
node -e "
  const f = require('./src/physicianFAQ.js');
  const faqs = f.physicianFAQ || f.default?.physicianFAQ || [];
  console.log('Total FAQs:', faqs.length);
  faqs.slice(0, 3).forEach(q => console.log(' -', q.question?.substring(0, 80)));
"
```

Then web search "MRD ctDNA liquid biopsy 2026 clinical trial results" and check whether any major new evidence (landmark trial results, guideline updates, FDA actions) from the past month is reflected in the FAQ answers.

---

### CHECK 7: NCCN guideline currency (spot-check Task 1)

The old crawler system had a dedicated version watcher that alerted Alex when new NCCN guideline versions were published. The weekly monitor task now handles this via web search.

Check whether any NCCN guidelines relevant to liquid biopsy / MRD / ctDNA have been updated:

```bash
# What guideline versions does data.js currently reference?
node -e "
  const d = require('./src/data.js');
  const tests = d.tests || d.default?.tests || [];
  const guidelines = new Set();
  tests.forEach(t => {
    if (t.nccnGuideline) guidelines.add(t.nccnGuideline);
    if (t.guidelines) t.guidelines.forEach(g => guidelines.add(typeof g === 'string' ? g : g.name || g.title || JSON.stringify(g)));
  });
  [...guidelines].sort().forEach(g => console.log(' -', g));
"
```

Then web search for each of these cancer types to check for newer versions:
- "NCCN colon rectal guidelines 2026 version"
- "NCCN non-small cell lung cancer guidelines 2026 version"
- "NCCN breast cancer guidelines 2026 version"
- "NCCN bladder cancer guidelines 2026 version"
- "NCCN prostate cancer guidelines 2026 version"

Flag if:
- Any guideline version referenced in data.js is outdated (newer version published)
- A new guideline now mentions ctDNA/MRD/liquid biopsy for the first time
- The weekly monitor task hasn't flagged a known guideline update

If new versions are found, note them as action items — Alex needs to download the PDF and review for MRD/ctDNA-relevant changes.

---

### SUMMARY REPORT FORMAT

Present findings as:

```
## Scheduled Task Health Report — [DATE]

### Execution Status
| Task | Last Run | Expected | Status |
|------|----------|----------|--------|
| Weekly Data Monitor | YYYY-MM-DD | Every Monday | ✅ On schedule / ⚠️ X days late / ❌ Not running |
| Monthly Data Scan | YYYY-MM-DD | 1st of month | ✅ On schedule / ⚠️ Late / ❌ Not running |
| Monthly FAQ Refresh | YYYY-MM-DD | 1st of month | ✅ On schedule / ⚠️ Late / ❌ Not running |

### Data Accuracy Spot-Checks
- **CMS coverage:** [X/4 LCDs verified correct] [any discrepancies]
- **Vendor news:** [X/5 vendors checked] [missed items if any]
- **PubMed counts:** [X/5 tests checked] [any >20% discrepancies]
- **FDA status:** [X/3 tests verified] [any mismatches]
- **FAQ freshness:** [last update date] [any missing evidence]
- **NCCN guidelines:** [X guidelines checked] [any outdated versions or new MRD mentions]

### Action Items
1. [anything that needs manual attention]
2. [any /schedule task that appears broken]
3. [data corrections needed]

### Overall Health: ✅ Healthy / ⚠️ Needs Attention / ❌ Tasks Failing
```
```

