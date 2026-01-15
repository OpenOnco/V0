# OpenOnco Codebase Architecture

---

## Directory Structure

```
/Users/adickinson/Documents/GitHub/V0/
├── src/                    # Frontend React application
│   ├── App.jsx             # Main router & layout (~1,700 lines)
│   ├── data.js             # 🗄️ TEST DATABASE (~8,500 lines)
│   ├── main.jsx            # React entry point
│   ├── index.css           # Global styles
│   │
│   ├── config/             # Configuration constants
│   │   ├── vendors.js      # Vendor badges, availability tiers
│   │   ├── categories.js   # Category colors/styling
│   │   ├── testFields.js   # Field definitions, minimum params
│   │   ├── expertInsights.js
│   │   └── patientContent.js
│   │
│   ├── utils/              # Utility functions
│   │   ├── persona.js      # localStorage helpers
│   │   ├── testMetrics.js  # Tier1 citation calculations
│   │   ├── formatting.js   # LOD formatting, units
│   │   └── suggestions.js  # Test recommendations
│   │
│   ├── components/
│   │   ├── test/           # Test display components
│   │   │   ├── TestShowcase.jsx     # Quick search + grid
│   │   │   ├── TestDetailModal.jsx  # Detail + comparison
│   │   │   └── TestCard.jsx         # Individual cards
│   │   │
│   │   ├── patient/        # Patient wizard
│   │   │   └── WatchingWizard.jsx   # MRD wizard (8 steps)
│   │   │
│   │   ├── coverage/       # Medicare coverage
│   │   │   └── MedicareCoverageDisplay.jsx
│   │   │
│   │   ├── ui/             # Reusable primitives
│   │   ├── badges/         # Badge components
│   │   ├── tooltips/       # Tooltips
│   │   └── navigation/     # Nav components
│   │
│   ├── pages/              # Route pages
│   ├── chatPrompts/        # UI config (NOT system prompts)
│   ├── personaConfig.js    # Persona definitions
│   └── personaContent.js   # Persona-specific UI content
│
├── api/                    # Vercel serverless functions
│   ├── chat.js             # 🤖 SYSTEM PROMPTS HERE
│   ├── _data.js            # Shared data for API
│   ├── v1/                 # Public API v1
│   │   └── index.js        # Unified handler
│   ├── og.js               # OG meta tags
│   ├── feedback.js         # User feedback
│   └── submit-form.js      # Form submissions
│
├── tests/                  # Playwright tests
│   ├── openonco.spec.js    # Main UI tests
│   ├── wizard.spec.js      # Patient wizard tests
│   └── api.spec.js         # API tests
│
├── docs/                   # Documentation
│   └── CMS_MEDICARE_COVERAGE.md
│
├── scripts/                # Utility scripts
└── .claude/                # Claude context files (YOU ARE HERE)
```

---

## Key Files to Know

### Data Layer

| File | What It Contains |
|------|------------------|
| `src/data.js` | **THE DATABASE** - All test data, VENDOR_VERIFIED, DATABASE_CHANGELOG |
| `src/config/testFields.js` | Field definitions, minimum params per category |
| `src/config/vendors.js` | Vendor availability tiers, badges |

### Chatbot System

| File | What It Contains |
|------|------------------|
| `api/chat.js` | **ALL SYSTEM PROMPTS** - getPersonaStyle(), buildSystemPrompt() |
| `src/chatPrompts/` | UI-only config (suggested questions, welcome messages) |
| `src/personaConfig.js` | Persona definitions (patient/medical/rnd) |

### Components

| Component | Purpose |
|-----------|---------|
| `TestShowcase.jsx` | Homepage test grid with search |
| `TestDetailModal.jsx` | Test detail view + comparison |
| `CategoryPage.jsx` | Category landing pages |
| `WatchingWizard.jsx` | Patient MRD wizard (8 steps) |
| `Chat.jsx` | Unified chat component |
| `MedicareCoverageDisplay.jsx` | Medicare coverage UI |

---

## data.js Structure

```javascript
// Line ~1-50: Header, instructions, Quick Reference table
// Line ~463: VENDOR_VERIFIED object (for green badges)
// Line ~515: VENDOR_ASSISTANCE_PROGRAMS
// Line ~750: mrdTestData array
// Line ~1900: MRD IVD Kits
// Line ~2020: ecdTestData array  
// Line ~3140: trmTestData array
// Line ~3490: tdsTestData array
// Line ~4370: TDS IVD Kits
// Line ~6670: hctTestData array
// Line ~7070: DATABASE_CHANGELOG
```

**Finding things:**
```bash
# Find a test
grep -n '"id": "mrd-7"' src/data.js

# Find vendor verified
grep -n "VENDOR_VERIFIED" src/data.js

# Find changelog
grep -n "DATABASE_CHANGELOG" src/data.js
```

---

## API Endpoints

### Public API v1 (https://openonco.org/api/v1)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tests` | GET | List/filter tests |
| `/tests/:id` | GET | Single test by ID |
| `/categories` | GET | List categories |
| `/vendors` | GET | List vendors |
| `/stats` | GET | Database statistics |
| `/embed/test` | GET | Embeddable test card |

**Query params for /tests:**
- `category` - mrd, ecd, trm, tds, hct
- `vendor` - Filter by vendor name
- `cancer` - Filter by cancer type
- `fda` - approved, ldt, breakthrough
- `fields` - Select specific fields
- `limit`, `offset` - Pagination

### Chat API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chat` | POST | Claude chat (rate limited) |

---

## Routing

| Path | Component | Category |
|------|-----------|----------|
| `/` | Homepage | - |
| `/risk` | CategoryPage | HCT |
| `/screen` | CategoryPage | ECD |
| `/monitor` | CategoryPage | MRD + TRM |
| `/treat` | CategoryPage | TDS |
| `/patient` | WatchingWizard | Patient MRD wizard |
| `/test/:slug` | TestDetailModal | Individual test |
| `/compare/:ids` | Comparison | Side-by-side comparison |

---

## Test IDs & Slugs

Tests have two identifiers:
- **ID:** `mrd-7`, `ecd-1`, `tds-4` (internal, for database)
- **Slug:** `signatera`, `galleri`, `guardant360-cdx` (URL-friendly)

Slugs auto-generate from name, but can be explicit when collisions occur:
```javascript
{
  id: "tds-27",
  name: "Tempus xF+",
  slug: "tempus-xf-plus"  // Explicit to avoid collision with "Tempus xF"
}
```

---

## Color System

| Category | Color | Tailwind |
|----------|-------|----------|
| HCT | Rose | `rose-600`, `rose-50` |
| ECD | Blue | `blue-600`, `blue-50` |
| MRD/TRM | Emerald | `emerald-600`, `emerald-50` |
| TDS | Violet | `violet-600`, `violet-50` |
| UI Base | Slate | `slate-*` (not gray) |

---

## Persona System Colors

| Persona | Primary | Background |
|---------|---------|------------|
| Patient | `rose-600` (#e11d48) | `rose-50` |
| Medical | `cyan-600` (#0891b2) | `cyan-50` |
| R&D | `violet-600` (#7c3aed) | `violet-50` |
