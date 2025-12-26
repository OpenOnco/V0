# OpenOnco Deployment Workflow

## Commands

| Command | What it does |
|---------|--------------|
| `./preview` | Smoke tests → push to develop → Vercel preview URL |
| `./release` | Full test suite → push to main → openonco.org |

Optional commit message: `./preview "fix: button color"` or `./release "v1.2.0"`
