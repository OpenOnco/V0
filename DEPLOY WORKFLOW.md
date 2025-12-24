# OpenOnco Deployment Workflow

Recommended workflow for deploying changes to OpenOnco.

## Quick Start

```bash
# Full workflow (recommended)
./workflow.sh

# Skip smoke tests (if you're confident)
./workflow.sh --skip-smoke

# Deploy directly to production (after manual testing)
./workflow.sh --prod
```

## Step-by-Step Workflow

### 1. **Local Smoke Tests** (30 seconds)
Fast feedback loop - catches obvious breakages before deploying.

```bash
npm run test:smoke
```

Tests:
- Homepage loads
- Category pages (MRD/ECD/TRM/TDS) load
- Basic navigation works

**If smoke tests fail:** Fix locally, don't deploy.

### 2. **Deploy to Vercel Preview** (2-3 minutes)
Get a live preview URL to test against.

```bash
vercel --yes
```

This gives you a preview URL like: `https://openonco-xyz.vercel.app`

### 3. **Full Test Suite Against Preview** (2-5 minutes)
Run all tests against the actual deployed preview.

```bash
TEST_URL=https://openonco-xyz.vercel.app npm run test:full
```

Tests everything:
- All pages load correctly
- Test detail modals work
- Comparison modals work
- Chat API works
- Share links work
- Print functionality
- Data download
- Mobile responsiveness

**If tests fail:** Fix the issue, redeploy preview, re-test.

### 4. **Manual Verification** (2-5 minutes)
Open the preview URL and manually check:
- [ ] Homepage looks correct
- [ ] Navigate to each category (MRD, ECD, TRM, TDS)
- [ ] Open a test detail modal
- [ ] Try the chat feature
- [ ] Check mobile view (resize browser)
- [ ] Test share links

### 5. **Deploy to Production** (1 minute)
Only after all tests pass and manual verification looks good.

```bash
vercel --prod --yes
```

## Automated Workflow Script

The `workflow.sh` script automates steps 1-4:

```bash
./workflow.sh
```

What it does:
1. ✅ Runs smoke tests locally
2. ✅ Deploys to Vercel preview
3. ✅ Runs full test suite against preview
4. ✅ Opens preview in browser for manual check
5. ⏸️  Waits for you to press Enter
6. ⏸️  Optionally deploys to production (with `--prod` flag)

## Common Workflows

### Quick Iteration (Local Only)
```bash
# Make changes, test locally
npm run dev
npm run test:smoke
```

### Standard Deploy (Preview + Test)
```bash
./workflow.sh
# Manually verify preview
# Then deploy to prod manually:
vercel --prod --yes
```

### Fast Deploy (Skip Smoke Tests)
```bash
./workflow.sh --skip-smoke
```

### Production Deploy (After Manual Testing)
```bash
./workflow.sh --prod
```

## Test Commands Reference

| Command | What It Does | When to Use |
|---------|-------------|-------------|
| `npm run test:smoke` | Quick 30s test | Before every deploy |
| `npm run test:full` | Full 2-5min test | Against preview URL |
| `npm run test:headed` | Watch tests run | Debugging failures |
| `npm run test:ui` | Interactive UI | Writing new tests |
| `npm run test:report` | View last report | After test failures |

## Testing Against Different URLs

```bash
# Local dev server (default)
npm run test:smoke

# Vercel preview
TEST_URL=https://openonco-xyz.vercel.app npm run test:full

# Production (be careful!)
TEST_URL=https://www.openonco.org npm run test:smoke
```

## Troubleshooting

### Tests fail locally but site works?
```bash
# Run with visible browser to see what's happening
npm run test:headed
```

### Tests fail on preview but work locally?
- Check if preview URL is correct
- Wait a bit longer for deployment to fully propagate
- Check browser console on preview for errors

### Need to update test expectations?
Edit `tests/openonco.spec.js` - test counts are auto-calculated from data.

## Pre-Deploy Checklist

- [ ] Smoke tests pass locally
- [ ] Preview deployed successfully
- [ ] Full tests pass against preview
- [ ] Manual verification looks good
- [ ] No console errors in browser
- [ ] Mobile view looks correct

## CI/CD Integration

For GitHub Actions, see `tests/SETUP.md` for example workflow.



