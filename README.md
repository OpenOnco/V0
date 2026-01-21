# OpenOnco

A database of cancer diagnostic tests covering liquid biopsy, molecular diagnostics, and hereditary testing.

**Live:** https://openonco.org

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test:smoke` | Run quick tests |
| `npm run test:full` | Run full test suite |
| `./preview` | Deploy to preview (develop branch) |
| `./release` | Deploy to production (main branch) |

## Structure

```
src/           React frontend
  data.js      Test database
  components/  UI components
  config/      Category/field definitions
api/           Vercel serverless functions
  chat.js      Claude chatbot API
  v1/          Public REST API
daemon/        Background intelligence crawler
tests/         Playwright tests
eval/          Chatbot evaluation (Python)
```

## Test Categories

| Category | URL | Description |
|----------|-----|-------------|
| HCT | /risk | Hereditary cancer testing |
| ECD | /screen | Early cancer detection |
| MRD | /monitor | Molecular residual disease |
| TRM | /monitor | Treatment response monitoring |
| TDS | /treat | Treatment decision support |

## Tech Stack

- React 18 + Vite
- Tailwind CSS
- Vercel (hosting + serverless)
- Playwright (testing)
- Claude API (chatbot)
