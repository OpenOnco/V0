# MCP Sync Testing Guide

This document covers testing and troubleshooting the MCP (Model Context Protocol) data sync between the OpenOnco website and the openonco-mcp server.

## Overview

The MCP sync workflow:
1. Changes to `src/data.js` trigger the GitHub Action
2. JSON files are exported: `mrd.json`, `ecd.json`, `hct.json`, `tds.json`
3. Files are synced to `openonco-mcp/src/main/resources/`

## Testing Locally

### Quick Validation

Run the test suite to validate export and data integrity:

```bash
npm run test:mcp
```

This script:
- Exports data to a temp directory
- Validates all JSON files are valid
- Checks required fields exist (id, name, vendor, category-specific fields)
- Validates ID uniqueness within each category
- Compares against MCP repo if available at `../openonco-mcp/src/main/resources/`

### Manual Export

To manually export and inspect the JSON files:

```bash
# Export to default location (dist/mcp/)
npm run export:mcp

# Export to custom location
node scripts/export-mcp-data.js /path/to/output/

# Inspect the output
ls -la dist/mcp/
cat dist/mcp/mrd.json | head -50
```

### Comparing with MCP Repo

If you have the openonco-mcp repo cloned alongside this repo:

```bash
# Default comparison (expects ../openonco-mcp/)
npm run test:mcp

# Custom path
node scripts/test-mcp-export.js --compare-path /path/to/openonco-mcp/src/main/resources/
```

## GitHub Action

### Automatic Triggers

The sync runs automatically when:
- `src/data.js` is pushed to the `main` branch

### Manual Trigger

To manually trigger the sync:

1. Go to the repository on GitHub
2. Navigate to **Actions** > **Sync MCP Data**
3. Click **Run workflow**
4. Optionally check **Force sync even if no changes detected**
5. Click **Run workflow**

### Workflow URL

Direct link to trigger:
`https://github.com/<owner>/V0/actions/workflows/sync-mcp-data.yml`

## Verifying the Sync

### Check GitHub Actions

1. Go to **Actions** tab in the repository
2. Find the **Sync MCP Data** workflow run
3. Check the job logs for:
   - "MCP data export completed"
   - "Files copied to..."
   - "Changes synced successfully" or "No changes to sync"

### Verify in MCP Repo

After a successful sync:

```bash
cd ../openonco-mcp
git pull
ls -la src/main/resources/*.json
git log -1 --oneline  # Should show the sync commit
```

### Verify Data Integrity

```bash
# In the MCP repo, validate the JSON
cat src/main/resources/mrd.json | jq '.[0]'  # Check first item
cat src/main/resources/mrd.json | jq 'length'  # Check count
```

## Troubleshooting

### Export Fails Locally

**Problem**: `npm run export:mcp` fails

**Solutions**:
1. Ensure dependencies are installed: `npm ci`
2. Check Node.js version (requires 18+): `node --version`
3. Verify `src/data.js` has no syntax errors:
   ```bash
   node -c src/data.js
   ```

### GitHub Action Fails

**Problem**: Sync workflow fails

**Common causes**:

1. **Permission errors**: Ensure `GITHUB_TOKEN` has write access to openonco-mcp repo
   - For cross-repo push, you may need a Personal Access Token (PAT) stored as a secret

2. **MCP repo not found**: Verify the repo exists and the owner is correct
   - Check: `${{ github.repository_owner }}/openonco-mcp`

3. **No changes detected**: If data.js changed but JSON output is identical, this is expected behavior

### JSON Validation Errors

**Problem**: `test:mcp` reports missing required fields

**Solutions**:
1. Check the specific item ID in the error message
2. Open `src/data.js` and search for that ID
3. Add the missing required fields
4. Re-run `npm run test:mcp`

Required fields per category:
- **All**: `id`, `name`, `vendor`
- **MRD**: `sampleCategory`, `approach`, `cancerTypes`, `fdaStatus`
- **ECD**: `sampleCategory`, `testScope`, `cancerTypes`, `fdaStatus`
- **HCT**: `sampleCategory`, `fdaStatus`
- **TDS**: `sampleCategory`, `fdaStatus`

### Duplicate ID Errors

**Problem**: `test:mcp` reports duplicate IDs

**Solution**:
1. Search for the duplicate ID in `src/data.js`
2. Assign a unique ID to each item (e.g., `mrd-27`, `mrd-28`)

### Sync Completed but MCP Repo Unchanged

**Possible causes**:
1. The JSON output is identical to what's already in the MCP repo
2. Check the workflow summary: "No changes to sync (data.js changed but JSON output unchanged)"

This is normal if you edited comments or non-exported fields in data.js.

## Development Workflow

### Before Releasing Data Changes

1. Make changes to `src/data.js`
2. Run validation: `npm run test:mcp`
3. Fix any errors
4. Commit and push to a feature branch
5. Create PR to `main`
6. Merge PR - sync will run automatically

### Emergency Manual Sync

If automatic sync isn't working:

```bash
# Export locally
npm run export:mcp

# Copy to MCP repo manually
cp dist/mcp/*.json ../openonco-mcp/src/main/resources/

# Commit in MCP repo
cd ../openonco-mcp
git add src/main/resources/*.json
git commit -m "chore: manual sync from OpenOnco"
git push
```
