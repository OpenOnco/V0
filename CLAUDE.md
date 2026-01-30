# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Quick Start

```bash
# First time or after reboot
npm run dev              # Start dev server at localhost:5173

# Before making changes
npm run test:smoke       # Quick validation

# Deploy workflow
./preview                # Smoke tests → develop branch → preview URL
./release                # Full tests → main branch → production
```

## Session Continuity

**Start of session:** Read `docs/SESSION_STATE.md` for context from previous work.

**End of session:** Run `/handoff` to update session state.

**Slash commands available:**
- `/recall` - Read SESSION_STATE.md and summarize context
- `/store` - Write current state to SESSION_STATE.md

## Project Overview

OpenOnco is a non-profit database of cancer diagnostic tests (liquid biopsy, molecular diagnostics, hereditary testing). 

**Live site:** https://openonco.org  
**Preview:** https://v0-42kj-git-develop-alex-dickinsons-projects-2bee58ff.vercel.app

## Key Documentation

| File | Purpose |
|------|---------|
| `docs/CLAUDE_CONTEXT.md` | Detailed project context, tech stack, conventions |
| `docs/SESSION_STATE.md` | Current work state, handoff between sessions |
| `docs/SUBMISSION_PROCESS.md` | How to process new test submissions |
| `docs/TESTING.md` | Test suite documentation |
| `docs/DATABASE_CHANGELOG.md` | History of data changes |

## Architecture

```
/
├── src/                    # React frontend (Vite + Tailwind)
│   ├── App.jsx             # Main router (~1,700 lines)
│   ├── data.js             # TEST DATABASE (~8,500 lines)
│   ├── config/             # Field definitions, vendor config, categories
│   ├── components/         # React components
│   └── utils/              # Utility functions
│
├── api/                    # Vercel serverless functions
│   ├── chat.js             # Claude chatbot (SYSTEM PROMPTS HERE)
│   ├── v1/                 # Public REST API
│   └── _data.js            # Shared API data
│
├── daemon/                 # Background intelligence (Railway)
│   ├── src/crawlers/       # Vendor, payer, news crawlers
│   ├── src/email/          # Digest email templates
│   └── src/triage/         # AI-powered change detection
│
├── tests/                  # Playwright E2E tests
├── eval/                   # Chatbot evaluation (Python)
└── docs/                   # Documentation
```

## Test Categories

| Category | Code | URL | Data Array |
|----------|------|-----|------------|
| Hereditary Cancer Testing | HCT | `/risk` | `hctTestData` |
| Early Cancer Detection | ECD | `/screen` | `ecdTestData` |
| Molecular Residual Disease | MRD | `/monitor` | `mrdTestData` |
| Treatment Response Monitoring | TRM | `/monitor` | `trmTestData` |
| Treatment Decision Support | TDS | `/treat` | `tdsTestData` |

## Key Files

| File | What's There |
|------|--------------|
| `src/data.js` | All test data, `VENDOR_VERIFIED`, `DATABASE_CHANGELOG` |
| `api/chat.js` | Chatbot system prompts (`getPersonaStyle()`, `buildSystemPrompt()`) |
| `src/config/testFields.js` | Field definitions, minimum required params |
| `src/config/vendors.js` | Vendor tiers, badge config |

## Commands

```bash
# Development
npm run dev              # Vite dev server (port 5173)
npm run build            # Production build

# Testing
npm run test:smoke       # Quick Playwright tests
npm run test:full        # Full test suite
npm run test:unit        # Vitest unit tests
npm run test:api         # API endpoint tests

# Deployment
./preview                # develop branch → preview
./preview "message"      # With commit message
./release                # main branch → production
./release "v1.2.0"       # With version tag

# Daemon (from /daemon directory)
npm run dev              # Run with auto-reload
npm run test:email       # Test digest email
```

## Conventions

### Styling
- **Tailwind only** - no custom CSS files
- **Slate colors** for UI base (not gray)
- **Category colors:** emerald (MRD/TRM), blue (ECD), rose (HCT), violet (TDS)
- **Persona colors:** rose (Patient), cyan (Medical), violet (R&D)

### Code
- Functional components with hooks
- System prompts in `api/chat.js`, NOT `src/chatPrompts/`
- Keep components in existing files unless asked to split
- Vendor verification requires BOTH: `vendorVerified: true` on test AND entry in `VENDOR_VERIFIED`

### Chat responses
- 3-4 sentences max
- No bullet points unless requested
- Match persona tone (patient=empathetic, medical=clinical, R&D=technical)

## Finding Things

```bash
# Find a test by name
grep -n '"name": "Signatera"' src/data.js

# Find vendor verification entries
grep -n "VENDOR_VERIFIED" src/data.js

# Find changelog entries
grep -n "DATABASE_CHANGELOG" src/data.js

# Find system prompts
grep -n "buildSystemPrompt\|getPersonaStyle" api/chat.js
```

## API

**Public API:** `https://openonco.org/api/v1`

| Endpoint | Description |
|----------|-------------|
| `GET /tests` | List tests (filter: category, vendor, cancer, fda) |
| `GET /tests/:id` | Single test |
| `GET /categories` | List categories |
| `GET /vendors` | List vendors |
| `GET /stats` | Database stats |

**Chat API:** `POST /api/chat` (rate limited 20/min per IP)

## Common Tasks

### Add a new test
1. Read `docs/SUBMISSION_PROCESS.md`
2. Add to appropriate array in `src/data.js`
3. Run `npm run test:smoke`
4. `./preview` to deploy

### Update system prompts
1. Edit `api/chat.js` - find `buildSystemPrompt()` or `getPersonaStyle()`
2. Test with all three personas
3. Run eval suite: `cd eval && python run_eval.py`

### Vendor verification
1. Set `vendorVerified: true` on test object in `src/data.js`
2. Add entry to `VENDOR_VERIFIED` object with date and contact
3. Add entry to `DATABASE_CHANGELOG`
