# Physician Page Redesign Plan

## Goal
Redesign the physician page to return to the traditional OpenOnco design language (pastel Tailwind, rounded rectangles, shadows) while keeping the MRD Evidence Navigator chat and adding a streamlined category row + test explorer below it.

## Layout (top to bottom)

1. **Standard Header** — restore the normal `<Header>` component (remove `isFullPageMode` override)
2. **MRD Evidence Navigator** — the chat box, restyled to match the traditional design (white card, rounded-2xl, shadow-sm, slate borders). Keep all existing functionality (patient context, Faster/Wiser, suggestion pills, conversation mode)
3. **Category Row** — 4 test categories in a single horizontal row with simple labels:
   - **HCT** (Rose) — Hereditary Cancer Testing
   - **ECD** (Emerald) — Early Cancer Detection
   - **MRD** (Orange) — Molecular Residual Disease
   - **CGP** (Violet) — Treatment Decision Support
   - Each is a clickable rounded card that navigates to the category page
   - Simple: icon/color dot + short code + test count
4. **Quick Search** — full-width search bar (existing, restyled to match)
5. **Test Map** — `<TestShowcase>` full width (existing)

## Files to Change

### 1. `src/App.jsx` (~3 lines)
- **Remove** `isFullPageMode` logic (line 1644) — set it to `false` or remove the variable
- This restores: Header, Footer, gray-50 background for physician page
- Keep `MRDNavigator` as the rendered component for `persona === 'medical'`

### 2. `src/components/physician/MRDNavigator.jsx` (major rewrite)
- **Remove**: Cancer Test Navigator (second chat box), all its state (`testInput`, `testMsgs`, `testLoading`, `testModel`, `sendTest`, `testAbortRef`, `testTextareaRef`, `TEST_SUGGESTIONS`)
- **Remove**: Custom top nav bar (the Apple-style bar we added)
- **Remove**: The warm beige inline style design (`#F5F3EE`, Georgia serif, etc.)
- **Restyle**: MRD Evidence Navigator chat using Tailwind classes matching the site's design language:
  - Container: `bg-white rounded-2xl border border-slate-200 shadow-sm`
  - Input box: Tailwind-styled textarea with slate borders
  - Suggestion pills: `border border-slate-200 rounded-full hover:border-orange-300`
  - Patient context popover: `bg-white rounded-xl border border-slate-200 shadow-lg`
  - Keep: All MRD chat logic, patient context, Faster/Wiser dropdown, conversation rendering
- **Add**: Category row component — 4 cards in `flex gap-4` layout
  - Each card: `bg-{color}-50 border border-{color}-200 rounded-xl shadow-sm hover:shadow-md cursor-pointer`
  - Click navigates to category page via `onNavigate('MRD')` etc.
- **Add**: Full-width quick search (Tailwind styled, `rounded-xl border border-slate-200`)
- **Add**: `<TestShowcase>` below search
- **Remove**: The "Explore All Our Tests in Detail" chevron/unfurl — the test map is always visible now
- Component no longer manages `height: 100vh` — it's a normal scrollable page within the app layout

## Design Token Reference
- Cards: `bg-white rounded-2xl border border-slate-200 shadow-sm`
- Category colors: orange (MRD), emerald (ECD), rose (HCT), violet (CGP)
- Text: `text-slate-800` headings, `text-slate-600` body, `text-slate-400` muted
- Spacing: `p-4` to `p-6`, `gap-4` between sections, `mb-4` vertical rhythm
- Max width: `max-w-7xl mx-auto px-4 sm:px-6` (matches site container)

## What Stays the Same
- MRD Evidence Navigator chat functionality (API calls, patient context, model selection, conversation mode, follow-ups)
- TestShowcase component (unchanged, just receives props)
- All routing and persona logic in App.jsx (just removing fullPageMode)

## What Gets Removed
- Cancer Test Navigator (second chat box)
- Custom Apple-style nav bar
- Warm beige color scheme (#F5F3EE, Georgia serif, etc.)
- The unfurl/chevron for showing tests
- `isFullPageMode` flag
