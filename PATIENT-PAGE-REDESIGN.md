# Patient Landing Page Redesign — Implementation Plan

## Overview
Replace the current patient home experience (WatchingWizard) with a warm, educational landing page that introduces patients to molecular diagnostics before directing them into existing flows (wizard, test directory, etc.).

**Route:** `/patient` → new `PatientLandingPage.jsx`
**Current behavior:** `/patient` shows `WatchingWizard` immediately
**New behavior:** `/patient` shows beautiful landing page; wizards accessible via CTAs

---

## Design Source
The design file is at: `/mnt/user-data/uploads/App__1_.tsx` (also pasted below in the Reference Design Code section).

---

## Key Decisions

### 1. Header/Footer
- **Use the design's custom Navigation and Footer** — NOT the existing site Header/Footer
- The patient landing page should feel like its own branded experience
- The custom nav has: logo + "OpenOnco Patient Guide", section links, "Find a Test" CTA button
- The custom footer has: OpenOnco branding, "For Patients" links, "OpenOnco" links, disclaimer

### 2. CTA Button Routing
Keep the same navigation targets the current patient buttons use:
- **"Start Learning"** → scrolls to `#understanding` section on same page
- **"Find a Test" (nav button)** → `onNavigate('patient-watching')` (WatchingWizard)
- **"Explore Test Directory"** → `onNavigate('home')` with persona switch back to rnd, OR a category picker
- **"Read Patient Stories"** → placeholder/coming soon for now
- **"Print Questions"** → `window.print()` or generate printable view
- Footer links like "Financial Assistance" → `onNavigate('patient-financial-assistance')`
- Footer links like "Questions for your Doctor" → scroll to `#questions` section
- Footer "Test Directory" → `onNavigate('home')`

### 3. Animation Approach — CSS only (no framer-motion)
**Do NOT install framer-motion/motion.** The project has zero animation deps and the bundle should stay lean.
Instead, implement equivalent animations with:
- CSS `@keyframes` for fade-in-up on hero load
- `IntersectionObserver` hook for scroll-triggered animations (whileInView equivalent)
- Tailwind `transition-*` classes for hover states
- Create a small `useInView` hook or `AnimateOnScroll` wrapper component

### 4. Icon Library
**Install `lucide-react`** — it's lightweight (~tree-shakeable) and the design uses it throughout.
```bash
npm install lucide-react
```

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `src/pages/PatientLandingPage.jsx` | Main page component with all sections |
| `src/components/patient/AnimateOnScroll.jsx` | Lightweight IntersectionObserver wrapper (replaces framer-motion `whileInView`) |

### Modified Files

| File | Change |
|------|--------|
| `package.json` | Add `lucide-react` dependency |
| `tailwind.config.js` | Add `brand-*`, `warm-*` color tokens + `font-serif` config + new keyframes |
| `src/App.jsx` | Update routing: `patient-landing` case renders `PatientLandingPage` instead of `WatchingWizard`; import new page |

---

## Tailwind Config Changes

Add these to `tailwind.config.js` under `theme.extend`:

```js
colors: {
  brand: {
    50: '#f0f5ff',
    100: '#e0eaff',
    200: '#c2d5ff',
    300: '#93b4ff',
    400: '#6490ff',
    500: '#3b6cf5',
    600: '#2a5bd4',
    700: '#1e4bb8',  // Primary brand color (used heavily in design)
    800: '#153a8a',
    900: '#0f2d6b',
  },
  warm: {
    50: '#faf8f5',   // Page background
    100: '#f5f0ea',
    200: '#e8ddd0',
    300: '#d4c4ad',
  },
},
fontFamily: {
  serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
},
keyframes: {
  fadeIn: { ... }, // keep existing
  fadeInUp: {
    '0%': { opacity: '0', transform: 'translateY(20px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  fadeInScale: {
    '0%': { opacity: '0', transform: 'scale(0.95)' },
    '100%': { opacity: '1', transform: 'scale(1)' },
  },
  slideInRight: {
    '0%': { opacity: '0', transform: 'translateX(20px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' },
  },
},
animation: {
  'fade-in': 'fadeIn 0.3s ease-out',  // keep existing
  'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
  'fade-in-scale': 'fadeInScale 1s ease-out 0.2s forwards',
  'slide-in-right': 'slideInRight 0.6s ease-out forwards',
},
```

---

## Component Architecture

### PatientLandingPage.jsx

```
PatientLandingPage ({ onNavigate })
├── PatientNavigation        — sticky top nav with logo, section links, "Find a Test" CTA
├── <main>
│   ├── Hero                 — big headline, subtitle, "Start Learning" CTA, hero image + floating badge
│   ├── Introduction         — "What are molecular diagnostics?" + "What is a Liquid Biopsy?" callout
│   ├── TestTypes            — dark bg section, 4 cards (CGP, MRD, TRM, ECD) in 2x2 grid
│   ├── DoctorQuestions      — sticky left title + scrollable question cards on right
│   └── SupportSection       — "You are not alone" CTA block
├── PatientFooter            — dark footer with links organized in columns
```

### AnimateOnScroll.jsx

```jsx
// Lightweight replacement for framer-motion's whileInView
// Uses IntersectionObserver to add animation classes when element scrolls into view
function AnimateOnScroll({ children, animation = 'fade-in-up', delay = 0, className = '' }) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} ${isVisible ? `animate-${animation}` : 'opacity-0'}`}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
```

---

## App.jsx Routing Changes

In the `renderPage()` switch statement, change `patient-landing` case:

```jsx
// BEFORE (current):
case 'patient-landing':
case 'patient-watching': return (
  <WatchingWizard key={wizardResetKey} onNavigate={handleNavigate} ... />
);

// AFTER:
case 'patient-landing': return (
  <PatientLandingPage onNavigate={handleNavigate} />
);
case 'patient-watching': return (
  <WatchingWizard key={wizardResetKey} onNavigate={handleNavigate} ... />
);
```

Also update the patient home routing:
```jsx
// In renderPage(), the 'home' case when persona === 'patient':
case 'home':
  if (persona === 'patient') {
    return <PatientLandingPage onNavigate={handleNavigate} />;
    // WatchingWizard is now accessed via "Find a Test" CTA on landing page
  }
```

**IMPORTANT**: The `PatientLandingPage` renders its OWN header/footer, so we need to hide the site-wide Header/Footer when on the patient landing page. Update the main render:

```jsx
// In the main App return, conditionally hide Header/Footer:
const isPatientLanding = (currentPage === 'patient-landing') || 
  (currentPage === 'home' && persona === 'patient');

return (
  <div className="min-h-screen bg-gray-50 flex flex-col" ...>
    {!isFullPageMode && !isPatientLanding && <Header ... />}
    <main className="flex-1">{renderPage()}</main>
    {!isFullPageMode && !isPatientLanding && <Footer />}
  </div>
);
```

---

## Image Strategy

The design uses Unsplash images. For production:
- **Option A (quick):** Keep the Unsplash URLs with `?w=1000&auto=format` for optimized delivery
- **Option B (better):** Download and serve from `/public/images/patient/` for reliability
- For now, use Unsplash URLs to ship fast, replace later

---

## Responsive Behavior
- Hero: 2-column on lg, stacked on mobile (image below text)
- Introduction: 2-column on md, stacked on mobile
- Test Types: 2x2 grid on md, single column on mobile
- Doctor Questions: 2-column on lg (sticky left, scrollable right), stacked on mobile
- Nav: hide section links on mobile, keep logo + CTA

---

## Testing Notes
- The page should pass existing Playwright smoke tests (it's a new route, doesn't break existing)
- Hero image loads lazily (add `loading="lazy"` to imgs)
- Smooth scroll for anchor links (`#understanding`, `#types`, `#questions`)
- All CTAs should use `onNavigate()` for SPA navigation, not `<a href>`

---

## Reference Design Code

The full design source is in `/mnt/user-data/uploads/App__1_.tsx`. Key adaptations needed:
1. Replace `motion.div` / `motion.img` with `AnimateOnScroll` wrapper or plain divs with CSS animation classes
2. Replace `framer-motion` imports with `lucide-react` icon imports (already used in design)
3. Wire all buttons/links through `onNavigate` prop instead of `<a href>`
4. Add `referrerPolicy="no-referrer"` on all Unsplash images (already in design)
5. The `brand-*` and `warm-*` color classes need to be defined in tailwind config first

---

## Implementation Order

1. `npm install lucide-react`
2. Update `tailwind.config.js` with new colors/animations
3. Create `src/components/patient/AnimateOnScroll.jsx`
4. Create `src/pages/PatientLandingPage.jsx` (the big one — port the design)
5. Update `src/App.jsx` routing + header/footer visibility
6. Test locally with `npm run dev`, navigate to `/patient`
7. Run `./preview` to verify
