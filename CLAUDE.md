# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenOnco is a non-profit platform for tracking and comparing cancer diagnostic tests (liquid biopsy, molecular diagnostics, hereditary testing). The codebase includes a React frontend, Vercel serverless API, and a background intelligence daemon.

**Live site:** https://openonco.org

## Commands

```bash
# Development
npm run dev              # Start Vite dev server (port 5173)
npm run build            # Build for production (runs sitemap generation first)

# Testing
npm run test:smoke       # Quick Playwright tests (Homepage, Category Pages)
npm run test:full        # Full Playwright test suite
npm run test:unit        # Vitest unit tests
npm run test:api         # API endpoint tests
npx playwright test tests/wizard.spec.js  # Run single test file
npx playwright test --headed              # Run tests with visible browser

# Deployment (shell scripts)
./preview                # Smoke tests → commit → push develop → preview URL
./preview "message"      # With custom commit message
./release                # Full tests → commit → push main → production
./release "v1.2.0"       # With custom commit message

# Daemon (in /daemon directory)
cd daemon && npm run dev      # Run daemon with auto-reload
cd daemon && npm run test:email  # Send test digest email
```

## Architecture

### Directory Structure

```
/
├── src/                    # React frontend (Vite)
│   ├── App.jsx             # Main router & layout
│   ├── data.js             # TEST DATABASE (~8,500 lines, all test data)
│   ├── config/             # Category colors, field definitions, vendor config
│   ├── components/         # React components (test/, patient/, coverage/, ui/)
│   ├── pages/              # Route pages
│   ├── chatPrompts/        # UI-only chat config (NOT system prompts)
│   └── utils/              # Utility functions
├── api/                    # Vercel serverless functions
│   ├── chat.js             # Claude chatbot (SYSTEM PROMPTS HERE)
│   ├── v1/                 # Public REST API
│   └── _data.js            # Shared API data
├── daemon/                 # Background intelligence crawler (Railway)
├── tests/                  # Playwright tests
└── eval/                   # Chatbot evaluation framework (Python)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/data.js` | All test data, VENDOR_VERIFIED object, DATABASE_CHANGELOG |
| `api/chat.js` | Chatbot system prompts (`getPersonaStyle()`, `buildSystemPrompt()`) |
| `src/config/testFields.js` | Field definitions, minimum required params per category |
| `src/config/vendors.js` | Vendor availability tiers, badge configuration |

### Test Categories

| Category | Code | URL | Description |
|----------|------|-----|-------------|
| Hereditary Cancer Testing | HCT | `/risk` | Inherited risk assessment |
| Early Cancer Detection | ECD | `/screen` | Screening asymptomatic people |
| Molecular Residual Disease | MRD | `/monitor` | Post-treatment surveillance |
| Treatment Response Monitoring | TRM | `/monitor` | Tracking during treatment |
| Treatment Decision Support | TDS | `/treat` | Therapy selection |

### Data Structure

Tests in `data.js` are stored in arrays: `mrdTestData`, `ecdTestData`, `trmTestData`, `tdsTestData`, `hctTestData`.

Each test has:
- `id`: Internal identifier (e.g., `mrd-7`)
- `slug`: URL-friendly name (e.g., `signatera`)
- `vendorVerified`: Boolean for green badge
- Category-specific fields (see `src/config/testFields.js`)

Finding things in data.js:
```bash
grep -n '"name": "Signatera"' src/data.js
grep -n "VENDOR_VERIFIED" src/data.js
grep -n "DATABASE_CHANGELOG" src/data.js
```

### API Endpoints

Public API at `/api/v1`:
- `GET /tests` - List/filter tests (params: category, vendor, cancer, fda, fields, limit, offset)
- `GET /tests/:id` - Single test by ID
- `GET /categories` - List categories
- `GET /vendors` - List vendors
- `GET /stats` - Database statistics

Chat API:
- `POST /api/chat` - Claude chatbot (rate limited 20 req/min per IP)

## Tech Stack

- **Frontend:** React 18 + Vite
- **Styling:** Tailwind CSS (utility-first, no separate CSS files)
- **API:** Vercel serverless functions
- **Chatbot:** Anthropic Claude API (proxied through `/api/chat.js`)
- **Testing:** Playwright (E2E), Vitest (unit)
- **Hosting:** Vercel (main site), Railway (daemon)

## Styling Conventions

- Tailwind exclusively - no custom CSS files
- Category colors: emerald (MRD/TRM), blue (ECD), rose (HCT), violet (TDS)
- Persona colors: rose (Patient), cyan (Medical), violet (R&D)
- Use `slate-*` for UI base colors (not gray)
- Mobile-first responsive classes (sm:, md:, lg:)

## Code Patterns

- Functional components with hooks
- Keep components in existing files unless explicitly asked to split
- System prompts live in `api/chat.js`, NOT in `src/chatPrompts/`
- Vendor verification requires BOTH: test object `vendorVerified: true` AND entry in `VENDOR_VERIFIED` object
