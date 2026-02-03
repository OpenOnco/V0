# Claude Code in Crawler Pipeline

**Status:** Design Proposal
**Date:** February 2, 2026

---

## Concept

Claude Code running headlessly on a local machine (via cron) can act as an intelligent agent in crawler pipelines. Railway handles the mechanical work (fetching, parsing, scheduling), while CC handles tasks requiring judgment.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Railway Pipeline                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │ Crawl   │───▶│ Extract │───▶│ Triage  │───▶│ Store   │      │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│                       │              │                           │
│                       ▼              ▼                           │
│              ┌────────────────────────────┐                     │
│              │   Write to cc-inbox/       │                     │
│              │   (edge cases, reviews)    │                     │
│              └────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Local MacBook (cron)                          │
│                                                                  │
│    ┌─────────────────────────────────────────────────────┐      │
│    │                  Claude Code                         │      │
│    │                                                      │      │
│    │  1. Read tasks from cc-inbox/                       │      │
│    │  2. Apply judgment (review, fix, approve)           │      │
│    │  3. Write results to cc-outbox/                     │      │
│    │  4. Optionally: commit & push changes               │      │
│    └─────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Railway Pipeline                          │
│              ┌────────────────────────────┐                     │
│              │   Read from cc-outbox/     │                     │
│              │   Apply approved changes   │                     │
│              └────────────────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why This Makes Sense

| Task Type | Railway | Claude Code |
|-----------|---------|-------------|
| Fetch URLs, parse HTML/JSON | ✅ Great | ❌ Overkill |
| Schedule jobs, retry logic | ✅ Great | ❌ Overkill |
| Regex extraction, keyword matching | ✅ Good | ❌ Overkill |
| Complex PDF interpretation | ⚠️ Brittle | ✅ Excellent |
| Edge case triage decisions | ⚠️ Rules-based | ✅ Excellent |
| Proposal review & approval | ❌ Can't | ✅ Perfect |
| Code fixes for extraction bugs | ❌ Can't | ✅ Perfect |
| Clinical content validation | ❌ Can't | ✅ Perfect |

---

## File-Based Protocol

### Directory Structure
```
data/
├── cc-inbox/           # Railway writes tasks here
│   ├── task-20260202-001.json
│   └── task-20260202-002.json
├── cc-outbox/          # CC writes results here
│   ├── result-20260202-001.json
│   └── result-20260202-002.json
├── cc-working/         # CC moves tasks here while processing
└── cc-archive/         # Completed tasks moved here
```

### Task Schema
```json
{
  "id": "task-20260202-001",
  "type": "review-proposal|extract-pdf|triage-edge-case|fix-extraction",
  "priority": 1,
  "createdAt": "2026-02-02T10:00:00Z",
  "expiresAt": "2026-02-03T10:00:00Z",
  "source": "physician-system|test-data-tracker",
  "payload": {
    // Task-specific data
  },
  "instructions": "Human-readable instructions for CC",
  "context": {
    // Additional context (related files, history)
  }
}
```

### Result Schema
```json
{
  "taskId": "task-20260202-001",
  "status": "completed|rejected|needs-human",
  "completedAt": "2026-02-02T10:05:00Z",
  "result": {
    // Task-specific result
  },
  "actions": [
    {"type": "apply-proposal", "target": "src/data.js", "diff": "..."},
    {"type": "update-gold-set", "file": "tests/gold-sets/nccn-colorectal.json"}
  ],
  "notes": "Explanation of decisions made"
}
```

---

## Use Cases

### 1. Proposal Review (test-data-tracker)

**Trigger:** Crawler generates coverage/update proposal

**Task:**
```json
{
  "type": "review-proposal",
  "payload": {
    "proposalFile": "data/proposals/coverage/cov-20260202-001.json",
    "testName": "Signatera",
    "payer": "Aetna",
    "proposedCoverage": "covered",
    "confidence": 0.72,
    "sourceUrl": "https://..."
  },
  "instructions": "Review this coverage proposal. If valid, apply to src/data.js. If confidence is low, verify against source."
}
```

**CC Actions:**
1. Read proposal JSON
2. Fetch source URL if needed (WebFetch)
3. Verify coverage claim against source
4. If valid: Edit src/data.js, commit, write success result
5. If invalid: Write rejection result with reason

---

### 2. Complex PDF Extraction (physician-system)

**Trigger:** New NCCN PDF dropped in guidelines folder, basic extraction done

**Task:**
```json
{
  "type": "review-extraction",
  "payload": {
    "pdfPath": "data/guidelines/nccn/nccn-colorectal-v3.2026.pdf",
    "extractedItems": 12,
    "lowConfidenceItems": [
      {"id": 5, "confidence": 0.45, "text": "..."},
      {"id": 8, "confidence": 0.52, "text": "..."}
    ]
  },
  "instructions": "Review low-confidence extractions. Fix or remove invalid ones. Check for missed recommendations."
}
```

**CC Actions:**
1. Read PDF (CC can read PDFs)
2. Compare extracted items against source
3. Fix incorrect extractions
4. Add missed items
5. Update gold set if patterns changed

---

### 3. Triage Edge Cases (physician-system)

**Trigger:** PubMed article scores near threshold (score 4-6)

**Task:**
```json
{
  "type": "triage-edge-case",
  "payload": {
    "pmid": "39876543",
    "title": "Circulating biomarkers in pancreatic adenocarcinoma...",
    "abstract": "...",
    "prefilterScore": 5,
    "matchedTerms": ["circulating", "biomarker", "pancreatic"],
    "missingTerms": ["ctDNA", "MRD", "liquid biopsy"]
  },
  "instructions": "Determine if this article is relevant to solid tumor MRD. If yes, add to guidance. If borderline, note why."
}
```

**CC Actions:**
1. Read abstract carefully
2. Determine clinical relevance to MRD
3. If relevant: Queue for full processing
4. If not: Mark as rejected with reason
5. If pattern is common: Suggest prefilter rule update

---

### 4. Payer Policy Analysis (test-data-tracker)

**Trigger:** New payer policy PDF detected

**Task:**
```json
{
  "type": "extract-policy",
  "payload": {
    "pdfPath": "data/policies/aetna-liquid-biopsy-2026.pdf",
    "payer": "Aetna",
    "policyType": "liquid_biopsy"
  },
  "instructions": "Extract coverage criteria for ctDNA/MRD tests. Note specific tests mentioned, indications covered, and limitations."
}
```

**CC Actions:**
1. Read policy PDF
2. Extract structured coverage data
3. Map to specific tests in database
4. Generate coverage proposals for each test
5. Note any ambiguities for human review

---

### 5. Guideline Change Interpretation (physician-system)

**Trigger:** NCCN version change detected, diff computed

**Task:**
```json
{
  "type": "interpret-changes",
  "payload": {
    "guideline": "nccn-colorectal",
    "oldVersion": "2.2026",
    "newVersion": "3.2026",
    "diffSummary": {
      "sectionsAdded": ["ctDNA Surveillance Protocol"],
      "sectionsModified": ["Adjuvant Therapy Recommendations"],
      "sectionsRemoved": []
    },
    "rawDiff": "..."
  },
  "instructions": "Interpret what changed clinically. Draft a changelog entry explaining the significance for MRD testing."
}
```

**CC Actions:**
1. Read both versions (or diff)
2. Identify clinically significant changes
3. Write plain-language summary
4. Update DATABASE_CHANGELOG
5. Flag if changes affect existing guidance items

---

## Implementation Plan

### Phase 1: Infrastructure
```
data/cc-inbox/
data/cc-outbox/
data/cc-working/
data/cc-archive/

src/cc/
  task-writer.js      # Railway: write tasks to inbox
  result-reader.js    # Railway: read results from outbox
  schemas.js          # Task/result JSON schemas
```

### Phase 2: CC Entry Point
```
.claude/
  commands/
    process-tasks.md  # Slash command for processing inbox
```

**Cron entry (macOS):**
```bash
# Run every 4 hours
0 */4 * * * cd /path/to/V0 && claude -p "Process all tasks in data/cc-inbox/" --headless
```

### Phase 3: Task Types
1. `review-proposal` - Start here, highest value
2. `triage-edge-case` - Easy win
3. `extract-policy` - High value for coverage data
4. `review-extraction` - Quality improvement
5. `interpret-changes` - Nice to have

---

## Considerations

### Sync Strategy
- Git as sync mechanism (Railway pulls, CC commits & pushes)
- Or: Shared volume/S3 bucket
- Or: Simple HTTP API endpoint

### Rate Limiting
- CC should process max N tasks per run
- Expensive tasks (PDF analysis) should be batched
- Priority queue for urgent tasks

### Error Handling
- Tasks that error go to `cc-failed/` with error details
- Retry logic for transient failures
- Escalate to human after N failures

### Security
- CC runs locally with your credentials
- No sensitive data in task payloads (use references)
- Audit log of all actions taken

### Cost
- CC uses Claude API under the hood
- Complex tasks (PDF reading) are expensive
- Batch similar tasks to reduce overhead

---

## Example Cron Setup

```bash
# ~/.claude/cron-tasks.sh
#!/bin/bash
cd /Users/adickinson/Documents/GitHub/V0

# Pull latest
git pull origin main

# Process tasks (max 10 per run, 30 min timeout)
claude -p "Process up to 10 tasks from data/cc-inbox/. For each task, read instructions, perform the work, write result to cc-outbox/, and move task to cc-archive/. Commit any code changes." --headless --timeout 1800

# Push results
git add -A
git commit -m "CC: Processed $(ls data/cc-archive/*.json 2>/dev/null | wc -l) tasks" || true
git push origin main
```

```crontab
# Run at 6 AM, 12 PM, 6 PM, 12 AM
0 6,12,18,0 * * * /Users/adickinson/.claude/cron-tasks.sh >> ~/.claude/cron.log 2>&1
```

---

## Next Steps

1. [ ] Create directory structure
2. [ ] Implement task-writer.js in Railway services
3. [ ] Create CC slash command for processing
4. [ ] Start with `review-proposal` task type
5. [ ] Test locally before enabling cron
6. [ ] Monitor and iterate

---

*Design by: Claude Code session, February 2, 2026*
