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
├── App.jsx              # Main app (~7,500 lines) - routes, pages, state
├── data.js              # Test database + SEO config (~7,500 lines)
├── personaConfig.js     # Persona definitions (patient, medical, rnd)
├── personaContent.js    # Persona-specific UI content
├── components/
│   ├── Header.jsx       # Site header with nav + persona selector
│   ├── Chat.jsx         # Unified chat component (all personas)
│   ├── PersonaSelector.jsx
│   ├── LifecycleNavigator.jsx  # 2x2 category grid
│   └── TestShowcase.jsx # Quick search + test card grid
├── chatPrompts/         # AI system prompts by persona
│   ├── index.js         # Prompt builder
│   ├── patientPrompts.js
│   ├── medicalPrompts.js
│   └── rndPrompts.js

/api
├── chat.js              # Chat API endpoint (Claude)
└── compare.js           # Test comparison endpoint

/eval                    # Chatbot evaluation framework
├── run-eval.js          # Multi-LLM evaluation runner
├── questions.json       # Test questions with expected answers
└── README.md

/tests
├── openonco.spec.js     # Playwright tests (~1,100 lines)
└── SETUP.md

/WORFLOWS                # Review processes
├── SUBMISSION_REVIEW.md # New test submission process
└── CHANGE_REQUEST.md    # Vendor change request process

/public                  # Static assets
├── OO_logo_2.png        # Main logo
└── patient-icon.png
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

## Chat Component Architecture
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

## Key Conventions
1. **Slate colors** for UI (not gray) - matches design system
2. **Emerald accent** for R&D/Medical actions
3. **Blue gradient** for patient chat header
4. **No "Me:" labels** - removed from UI
5. **First-person language removed** from patient UI ("for me", "my")

## Recent Major Work (Dec 2024)
1. Persona system implementation
2. Chat component unification (3 implementations → 1)
3. System prompt modularization (chatPrompts/)
4. Chatbot evaluation framework (eval/)
5. Layout refactoring (50/50 split for R&D/Medical)
6. New logo integration

## Database Structure (data.js)
Tests stored in `TESTS` object keyed by category:
```javascript
TESTS = {
  MRD: [...],
  ECD: [...],
  TRM: [...],
  TDS: [...]
}
```

Each test has fields like: testName, vendor, fdaStatus, nccnGuidelines, sensitivity, specificity, tat, coverage, etc.

## API Endpoints
- `POST /api/chat` - Chat with Claude
  - Body: { category, persona, testData, messages, model, patientChatMode }
  - Returns: { content: [{ text: "..." }] }

- `POST /api/compare` - Compare tests
  - Body: { tests, persona }

## Evaluation System
Located in `/eval`. Runs questions through chatbot and scores with multiple LLMs:
```bash
cd eval && node run-eval.js
```
Produces JSON results with accuracy metrics per question type.

## Pending Items
1. halluc-3 fix: Add system prompt rule for 100%/100% performance claims
2. Consider TestCardGrid.jsx extraction
3. Consider Gemini evaluator fix for 4-way consensus
