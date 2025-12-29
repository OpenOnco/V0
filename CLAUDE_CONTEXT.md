# OpenOnco Project Context

## Overview
OpenOnco is a non-profit database platform for cancer diagnostic tests, focusing on liquid biopsy and molecular diagnostics. Built in memory of Alex's sister Ingrid.

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
├── data.js              # Test database + SEO config (~7,500 lines)
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
│   │   ├── CircularProgress.jsx
│   │   ├── QualityGrade.jsx
│   │   ├── Badge.jsx
│   │   ├── Checkbox.jsx
│   │   ├── FilterSection.jsx
│   │   └── PerformanceMetricWithWarning.jsx
│   │
│   ├── badges/          # Badge components
│   │   ├── VendorBadge.jsx
│   │   ├── ProductTypeBadge.jsx
│   │   └── CompanyCommunicationBadge.jsx
│   │
│   ├── tooltips/        # Tooltip components
│   │   └── index.jsx    # ParameterLabel, InfoIcon, CitationTooltip, etc.
│   │
│   ├── markdown/        # Markdown rendering
│   │   ├── SimpleMarkdown.jsx
│   │   ├── Markdown.jsx
│   │   └── ExternalResourcesSection.jsx
│   │
│   ├── navigation/      # Navigation components
│   │   └── index.jsx    # LifecycleNavigator, RecentlyAddedBanner, etc.
│   │
│   ├── CategoryPage.jsx # Category page (~850 lines)
│   ├── Chat.jsx         # Unified chat component
│   ├── Header.jsx       # Site header with nav + persona selector
│   ├── Footer.jsx
│   ├── PersonaSelector.jsx
│   ├── PersonaGate.jsx
│   ├── DatabaseSummary.jsx
│   └── TestCardGrid.jsx
│
├── pages/               # Route pages
│   ├── HomePage.jsx
│   ├── AboutPage.jsx
│   ├── FAQPage.jsx
│   ├── HowItWorksPage.jsx
│   ├── LearnPage.jsx
│   └── SubmissionsPage.jsx
│
├── chatPrompts/         # UI config only (NOT system prompts)
│   ├── index.js         # getSuggestedQuestions, getWelcomeMessage
│   ├── patientPrompt.js # Patient UI config
│   ├── clinicianPrompt.js # Clinician UI config  
│   └── academicPrompt.js  # R&D UI config
│
├── personaConfig.js     # Persona definitions (patient, medical, rnd)
└── personaContent.js    # Persona-specific UI content

/api
├── chat.js              # 🚨 SYSTEM PROMPTS LIVE HERE 🚨
├── og.js                # OG meta tags for link previews
├── submit-form.js       # Test submission handler
├── send-verification.js # Email verification
└── verify-code.js       # Code verification

/eval                    # Chatbot evaluation framework
├── run_eval.py          # Send questions to chatbot
├── rate_answers.py      # Multi-LLM scoring
├── questions.json       # 53 test questions (includes guardrails + red team)
└── README.md

/tests
└── openonco.spec.js     # Playwright tests (51 tests)

/WORFLOWS                # Review processes
├── SUBMISSION_REVIEW.md # New test submission process
└── CHANGE_REQUEST.md    # Vendor change request process
```

## Test Categories
- **ECD** (Early Cancer Detection) - Screening tests (Galleri, Shield, etc.)
- **TDS** (Treatment Decision Support) - Therapy selection (FoundationOne, Guardant360)
- **TRM** (Treatment Response Monitoring) - Therapy tracking
- **MRD** (Minimal Residual Disease) - Post-treatment surveillance (Signatera)

## Persona System
Three user personas with distinct UIs and chatbot behaviors:
- **patient** - Simplified, empathetic, first-person language
- **medical** - Clinical focus, professional terminology
- **rnd** (R&D) - Technical depth, research-oriented

Homepage layout differs by persona:
- Patient: 3 lifecycle buttons (TDS, TRM, MRD) + chat
- Medical/R&D: 2x2 LifecycleNavigator + chat sidebar (50/50 split)

## Chat System Architecture

### System Prompts (CRITICAL)
**Location**: `/api/chat.js` - Single source of truth for all prompts sent to Claude.

**DO NOT** edit `/src/chatPrompts/` for prompt changes - those are UI config only.

### Guardrails
Patient chat has strict guardrails:
- Detects clinician language ("I have a patient", "post-resection") → redirects to Clinician view
- Never gives ranked recommendations ("top choices", "#1 option")
- Never suggests tests can replace imaging/standard of care
- Always defers to oncologist for final decisions

Clinician/R&D chat:
- Data lookup only, not clinical advisor
- Declines to recommend specific tests for patient scenarios
- Provides factual comparisons (sensitivity, coverage, methodology)

### Chat Component
Unified `Chat.jsx` handles all personas via props:
```jsx
<Chat 
  persona="patient|medical|rnd"
  variant="full|sidebar"
  showModeToggle={true|false}  // Learn/Find toggle (patient only)
  resizable={true|false}
  testData={chatTestData}
/>
```

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

## Evaluation Framework
Located in `/eval`. Tests chatbot behavior including guardrails:

**Categories:**
- `nccn_accuracy` - NCCN-named vs vendor-claim distinction
- `factual_retrieval` - Database lookup accuracy
- `comparison` - Test comparison quality
- `out_of_scope` - Medical advice deflection
- `hallucination` - Fabrication detection
- `guardrails` - Patient/clinician boundary enforcement
- `red_team` - Adversarial attacks (jailbreak attempts, authority claims)

```bash
cd /Users/adickinson/Documents/GitHub/V0
python3 eval/run_eval.py
python3 eval/rate_answers.py eval/results/eval_*.json
```

## Key Conventions
1. **Slate colors** for UI (not gray) - matches design system
2. **Emerald accent** for R&D/Medical actions
3. **Blue gradient** for patient chat header
4. **No bullet points** in chat unless user requests them
5. **3-4 sentence max** for chat responses

## Recent Major Work (Dec 2024)

### App.jsx Refactor (Dec 28)
Reduced App.jsx from 7,588 → 1,729 lines (-77%):
- Extracted constants to `/src/config/`
- Extracted utilities to `/src/utils/`
- Extracted components to modular directories
- All 49 tests passing

### Chat Guardrails (Dec 28)
- Added patient chat detection for clinician language
- Blocked ranked recommendations
- Added "tests complement, not replace imaging" rule
- Created 53-question eval suite including red team tests

### OG Meta Tags (Dec 28)
- Dynamic link previews for test/category URLs
- Expanded crawler user-agent patterns for iMessage

### Earlier Work
- Persona system implementation
- Chat component unification (3 implementations → 1)
- System prompt consolidation to /api/chat.js
- Evaluation framework setup

## Database Structure (data.js)
Tests stored by category with fields like:
- testName, vendor, fdaStatus, nccnNamedInGuidelines
- sensitivity, specificity, tat, coverage
- cancerTypes, methodology, etc.

```javascript
export const mrdTestData = [...]
export const ecdTestData = [...]
export const trmTestData = [...]
export const tdsTestData = [...]
```

## API Endpoints
- `POST /api/chat` - Chat with Claude
  - Body: { category, persona, testData, messages, model, patientChatMode }
  - Returns: { content: [{ text: "..." }] }

- `GET /api/og?path=/mrd/signatera` - OG meta tags for crawlers
  - Returns: HTML with dynamic OG tags
