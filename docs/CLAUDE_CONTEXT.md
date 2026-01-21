# OpenOnco Project Context

## Overview
OpenOnco is a non-profit database platform for cancer diagnostic tests, focusing on liquid biopsy, molecular diagnostics, and hereditary cancer testing. Built in memory of Alex's sister Ingrid.

**Live Site**: https://openonco.org  
**Preview**: https://v0-42kj-git-develop-alex-dickinsons-projects-2bee58ff.vercel.app

## Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Vercel serverless functions (Node.js)
- **AI**: Claude API (Anthropic) for chatbot
- **Testing**: Playwright (smoke tests + full suite)
- **Deployment**: Vercel (develop branch → preview, main → production)

## Key Directories

```
/src
├── App.jsx              # Main router & layout (~1,700 lines)
├── data.js              # Test database + SEO config (~8,500+ lines)
├── main.jsx             # React entry point
├── index.css            # Global styles
│
├── config/              # Configuration constants
│   ├── vendors.js       # VENDOR_BADGES
│   ├── categories.js    # CATEGORY_COLORS
│   ├── testFields.js    # PARAMETER_DEFINITIONS, MINIMUM_PARAMS, FIELD_DEFINITIONS
│   ├── expertInsights.js # EXPERT_INSIGHTS
│   └── patientContent.js # PATIENT_INFO_CONTENT
│
├── utils/               # Utility functions
│   ├── persona.js       # localStorage helpers
│   ├── testMetrics.js   # calculateTier1Metrics, calculateCategoryMetrics
│   ├── formatting.js    # formatLOD, detectLodUnit
│   └── suggestions.js   # getSuggestedTests
│
├── components/
│   ├── test/            # Test display components
│   │   ├── TestShowcase.jsx     # Quick search + test grid (~975 lines)
│   │   ├── TestDetailModal.jsx  # Test detail + comparison modals (~1,240 lines)
│   │   └── TestCard.jsx         # Individual test card (~230 lines)
│   │
│   ├── ui/              # Reusable UI primitives
│   ├── badges/          # Badge components
│   ├── tooltips/        # Tooltip components
│   ├── markdown/        # Markdown rendering
│   ├── navigation/      # Navigation components
│   │
│   ├── CategoryPage.jsx # Category page (~850 lines)
│   ├── Chat.jsx         # Unified chat component
│   ├── Header.jsx       # Site header with nav + persona selector
│   └── ...
│
├── pages/               # Route pages
├── chatPrompts/         # UI config only (NOT system prompts)
├── personaConfig.js     # Persona definitions
└── personaContent.js    # Persona-specific UI content

/api
├── _data.js             # Shared data exports for API
├── chat.js              # 🚨 SYSTEM PROMPTS LIVE HERE 🚨
├── og.js                # OG meta tags for link previews
├── v1/                  # Public API v1
│   └── index.js         # Unified API handler
└── ...

/eval                    # Chatbot evaluation framework
/tests                   # Playwright tests
```

## Test Categories

| Category | Code | URL Path | Description |
|----------|------|----------|-------------|
| Hereditary Cancer Testing | HCT | `/risk` | Germline genetic testing for inherited cancer predisposition |
| Early Cancer Detection | ECD | `/screen` | Screening tests (Galleri, Shield, etc.) |
| Molecular Residual Disease | MRD | `/monitor` | Post-treatment surveillance (Signatera, etc.) |
| Treatment Response Monitoring | TRM | `/monitor` | Therapy tracking during treatment |
| Treatment Decision Support | TDS | `/treat` | Therapy selection (FoundationOne, Guardant360) |

**Note:** MRD and TRM are combined into "Cancer Monitoring" on the homepage but remain separate data arrays internally.

## Database Structure (data.js)

```javascript
export const mrdTestData = [...]  // ~27 tests
export const ecdTestData = [...]  // ~23 tests
export const trmTestData = [...]  // ~15 tests
export const tdsTestData = [...]  // ~28 tests + kits
export const hctTestData = [...]  // ~11 tests (NEW)
```

## Public API (v1)

**Base URL**: `https://openonco.org/api/v1`

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/tests` | List all tests with filtering |
| `GET /api/v1/tests/:id` | Get single test by ID |
| `GET /api/v1/categories` | List all categories |
| `GET /api/v1/vendors` | List all vendors |
| `GET /api/v1/stats` | Database statistics |
| `GET /api/v1/embed/test` | Embeddable test card |

**Query Parameters for /tests:**
- `category` - Filter by category (mrd, ecd, trm, tds, hct)
- `vendor` - Filter by vendor name
- `cancer` - Filter by cancer type
- `fda` - Filter by FDA status (approved, ldt, breakthrough)
- `fields` - Select specific fields
- `limit`, `offset` - Pagination

## Persona System
Three user personas with distinct UIs and chatbot behaviors:
- **patient** - Simplified, empathetic, first-person language
- **medical** - Clinical focus, professional terminology
- **rnd** (R&D) - Technical depth, research-oriented

## Development Commands
```bash
./preview              # Smoke tests → develop → preview URL
./preview "message"    # With commit message
./release              # Full tests → main → production
./release "v1.2.0"     # With commit message
npm run dev            # Local dev server
npm test               # Full Playwright suite
npm run test:smoke     # Quick smoke tests only
```

## Key Conventions
1. **Slate colors** for UI (not gray) - matches design system
2. **Emerald accent** for R&D/Medical actions
3. **Rose accent** for HCT category
4. **Blue gradient** for patient chat header
5. **No bullet points** in chat unless user requests them
6. **3-4 sentence max** for chat responses
