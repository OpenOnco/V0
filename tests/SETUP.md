# OpenOnco Testing Setup Guide

Complete guide to implementing automated regression tests from scratch.

## What You Get

- **50+ automated tests** covering all major features
- **Pre-deploy checks** to catch bugs before users see them  
- **CI/CD ready** for GitHub Actions integration
- **Visual debugging** with headed browser mode

---

## Step 1: Install Playwright

In your project root (where `package.json` is):

```bash
# Install Playwright as dev dependency
npm install -D @playwright/test

# Install browser (just Chrome for speed)
npx playwright install chromium
```

---

## Step 2: Add Files to Your Project

Copy these files to your project:

```
your-project/
├── playwright.config.js     ← Copy here (project root)
├── tests/                   ← Create this folder
│   └── openonco.spec.js     ← Copy here
├── package.json             ← Edit (add scripts below)
├── api/
│   └── chat.js
└── src/
    └── App.jsx
```

---

## Step 3: Add npm Scripts

Edit your `package.json` and add these to the `"scripts"` section:

```json
{
  "scripts": {
    "test": "playwright test",
    "test:smoke": "playwright test -g 'Homepage|Category Pages' --reporter=list",
    "test:full": "playwright test --reporter=list",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui",
    "test:report": "playwright show-report"
  }
}
```

---

## Step 4: Run Tests

```bash
# Start your dev server first
npm run dev

# In another terminal, run tests:

# Quick smoke test (30 sec) - run before every deploy
npm run test:smoke

# Full test suite (2-5 min)
npm run test:full

# Watch tests run in browser (debugging)
npm run test:headed

# Interactive UI mode
npm run test:ui
```

---

## Step 5: Test Against Production

```bash
# Test against live site
TEST_URL=https://openonco.org npm run test:smoke
```

---

## What's Being Tested

| Test Suite | What It Checks |
|------------|----------------|
| **Homepage** | Loads, shows 78 tests, chat input works |
| **Category Pages** | MRD/ECD/TRM/TDS all load, show test cards |
| **Test Detail Modal** | Opens, has share/print buttons, closes |
| **Comparison Modal** | Opens with 2+ tests, share link works |
| **Shareable Links** | `?compare=` and `?test=` URLs work |
| **Print** | CSS loads, content visible (not blank) |
| **Chat** | Input works, API responds |
| **Data Download** | JSON file has 78 tests, valid structure |
| **Navigation** | All links work, back button works |
| **Mobile** | Renders on small screens |
| **Error Handling** | Invalid URLs don't crash |

---

## Expected Test Counts

When you add tests, update `tests/openonco.spec.js`:

```javascript
const EXPECTED = {
  testCounts: {
    MRD: 26,    // Update when adding MRD tests
    ECD: 15,    // Update when adding ECD tests
    TRM: 15,    // Update when adding TRM tests
    TDS: 22,    // Update when adding TDS tests
    total: 78   // Update: sum of above
  },
  // ...
};
```

---

## Pre-Deploy Checklist

Run this before **every** deploy:

```bash
# 1. Start dev server
npm run dev

# 2. Run smoke tests (in another terminal)
npm run test:smoke

# 3. If smoke passes, optionally run full suite
npm run test:full

# 4. Deploy only if tests pass!
```

---

## GitHub Actions (Optional)

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install chromium
      
      # Run against Vercel preview URL
      - name: Run tests
        run: npx playwright test --reporter=list
        env:
          TEST_URL: ${{ github.event.deployment_status.target_url || 'http://localhost:3000' }}
      
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: test-results/
```

---

## Troubleshooting

### Tests failing locally but site works?

```bash
# Run with visible browser to see what's happening
npm run test:headed
```

### Chat tests timing out?

Chat API can be slow. The tests have 30s timeout, but you can increase:

```javascript
test('chat responds', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});
```

### Print tests failing?

```bash
# Run just print tests with visible browser
npx playwright test -g "Print" --headed
```

### Need to update selectors?

Use Playwright's codegen to find selectors:

```bash
npx playwright codegen http://localhost:3000
```

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `npm run test` | Run all tests |
| `npm run test:smoke` | Quick 30-second check |
| `npm run test:full` | Complete test suite |
| `npm run test:headed` | Watch tests in browser |
| `npm run test:ui` | Interactive UI mode |
| `npm run test:report` | View last test report |

---

## Summary: What You Need To Do

1. ✅ `npm install -D @playwright/test`
2. ✅ `npx playwright install chromium`
3. ✅ Copy `playwright.config.js` to project root
4. ✅ Create `tests/` folder, copy `openonco.spec.js` into it
5. ✅ Add npm scripts to `package.json`
6. ✅ Run `npm run test:smoke` before every deploy

That's it! You now have automated regression testing.
