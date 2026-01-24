# Contributing to OpenOnco

## Development Workflow

### Local Development

```bash
npm install          # Install dependencies
npm run dev          # Start dev server at http://localhost:5173
```

### Testing

```bash
npm run test:unit    # Unit tests (fast)
npm run test:smoke   # Quick E2E tests (Homepage, Category Pages)
npm run test:api     # API endpoint tests
npm run test:full    # Full E2E test suite
```

### Deploying

#### Preview (feature branches)

```bash
./preview            # Run tests → commit → push → Vercel preview
./preview "message"  # With custom commit message
```

Vercel automatically deploys previews for all branches. Check the GitHub PR or Vercel dashboard for the preview URL.

#### Production (main branch)

```bash
./release            # Run full tests → push develop to main → production
./release "v1.2.0"   # With custom commit message
```

Production deploys to https://www.openonco.org

## CI/CD

GitHub Actions runs automatically on all pushes and PRs:
- Unit tests
- Smoke tests
- API tests
- Build verification

### Branch Protection (Recommended)

To require CI to pass before merging PRs:

1. Go to GitHub → Settings → Branches
2. Add rule for `main` branch
3. Enable:
   - "Require a pull request before merging"
   - "Require status checks to pass before merging"
   - Select "Test" and "Build" checks
4. Save changes

This ensures broken code can't be merged via PR. The `./release` script still works for direct pushes (it runs tests locally first).

## Project Structure

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation.
