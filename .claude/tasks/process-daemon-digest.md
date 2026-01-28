# Process Daemon Digest

**Trigger:** "Process this week's digest" or "Process daemon discoveries"

## Steps

### 1. Export discoveries

```bash
cd daemon && npm run run:export
```

Output: `daemon/data/exports/YYYY-MM-DD.md` with discoveries bucketed by priority (HIGH > MEDIUM > LOW), grouped by source within each bucket.

### 2. Read the export

Read the exported markdown file. Start with the Summary table to understand volume and priority distribution before diving into individual items.

### 3. Process HIGH priority first

HIGH items include: FDA approvals, vendor updates with high relevance, high-relevance flagged items.

For each HIGH discovery, take the appropriate action based on type:

| Discovery Type | Action |
|---|---|
| **Vendor update** (new test, name change, FDA status) | Update the test entry in `src/data.js`. Set `vendorVerified: true` + add `VENDOR_VERIFIED` entry if confirmed on vendor site. Add `DATABASE_CHANGELOG` entry. |
| **FDA approval/clearance** | Update `fdaApproved` / `fdaStatus` fields on the test. Verify via WebFetch on FDA site. Add changelog entry. |
| **New test launch** | Follow `docs/SUBMISSION_PROCESS.md` to add a new test to the correct array in `src/data.js`. |
| **Publication with new performance data** | Use PubMed MCP to fetch full abstract/metadata. Update sensitivity/specificity/PPV/NPV fields and their corresponding `*Citations` fields (e.g. `ppvCitations`, `sensitivityCitations`). |

### 4. Process MEDIUM priority

MEDIUM items include: payer/CMS policy changes, PubMed publications, vendor news.

| Discovery Type | Action |
|---|---|
| **Payer coverage update** | Update the `coverage` block on affected tests. Verify policy details via WebFetch. |
| **Publication (validation study)** | Use PubMed MCP to pull PMID, DOI, authors. Add citation and update performance metrics if applicable. |
| **Vendor news (not high relevance)** | Review summary. If actionable, update relevant fields. Often informational only. |

### 5. Process LOW priority

LOW items are typically citations audit results. Usually informational — skim for anything misclassified. No database changes expected unless a discovery was incorrectly bucketed.

### 6. Ask user approval before database changes

Before editing `src/data.js`, present a summary of all proposed changes:
- Which tests are affected
- What fields change and to what values
- Source/citation for each change

Wait for explicit approval before writing any changes.

### 7. Validate

```bash
npm run test:smoke
```

Run smoke tests after all changes are applied. Fix any failures before finishing.

## Tools Used

- **Claude Code** — file reads, edits to `src/data.js`, running tests
- **PubMed MCP** — fetch abstracts, PMIDs, DOIs, citation metadata for publications
- **OpenOnco MCP** — look up existing test data to check current field values before updating
- **WebFetch** — verify vendor pages, FDA announcements, payer policy documents

## Expected Outputs

- Updated test entries in `src/data.js` (performance data, FDA status, coverage, citations)
- New `VENDOR_VERIFIED` entries where applicable
- New `DATABASE_CHANGELOG` entries for every change
- Passing smoke tests
- Summary of all changes made (test name, field, old value, new value, source)
