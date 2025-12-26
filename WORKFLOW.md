# OpenOnco Deployment Workflow

Two commands for Claude:

## Preview

Say: **"preview"**

Actions:
1. Run smoke tests (`npm run test:smoke`)
2. If pass, `git push` to develop branch
3. Vercel auto-deploys to preview URL

## Release

Say: **"release"**

Actions:
1. Run full test suite (`npm run test:full`)
2. If pass, `git push origin develop:main`
3. Vercel auto-deploys to openonco.org

---

## Manual Commands

```bash
# Smoke tests (Homepage + Category Pages)
npm run test:smoke

# Full test suite
npm run test:full

# Push to preview
git push

# Push to production
git push origin develop:main
```
