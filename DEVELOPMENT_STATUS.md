# OpenOnco Development Status

**Last Updated:** January 11, 2026  
**Current Version:** v1.5.0  
**Live Site:** https://openonco.org

---

## Recent Release: v1.5.0 - Patient MRD Wizard

### What Changed
- **Simplified patient experience** to focus exclusively on MRD (post-treatment surveillance)
- Removed PatientLanding page and ScreeningWizard (ECD wizard)
- Patient homepage now goes directly to WatchingWizard at `/patient`
- New landing page (step 0) explains MRD testing to patients unfamiliar with it

### Landing Page Content
- Hero headline: emotional hook about scan anxiety after treatment
- 4 info boxes explaining: new technology, good news scenario, the problem (unknown tests), the solution (OpenOnco guide)
- CTA: "Find tests to discuss with my doctor"
- Emphasizes doctor's role throughout - only oncologist can order tests

### Wizard Flow (8 steps)
1. Landing (educational intro)
2. Cancer type selection
3. Tumor tissue availability (determines tumor-informed vs tumor-naive)
4. Treatment stage
5. Insurance
6. Location (US vs international)
7. US state (if US)
8. Results with test cards

### Test Card Features
- Two-button layout: "Get personalized summary" (primary) + "View technical details" (secondary)
- Vendor availability badges (US widespread tier only)
- Comparative badges (Highest Sensitivity, Fastest Results, etc.)
- 2-column grid with "More tests" collapsible section for tests without badges
- Results page uses max-w-6xl container for wider cards

### Filtering Logic
- Blood cancer types (multiple myeloma, lymphoma, leukemia) → show clonoSEQ
- Solid tumors → exclude blood cancer tests
- Has tumor tissue → tumor-informed tests only
- No tumor tissue → tumor-naive tests only
- Not sure about tissue → show all tests

---

## Test Coverage
- 62 passing tests (58 + 4 skipped filter tests)
- Deleted outdated `patient-experience.spec.js` (tested old PatientLanding/ScreeningWizard)
- `wizard.spec.js` has 7 tests covering filtering logic
- `openonco.spec.js` updated for new patient homepage

---

## Pending Tasks

### Vendor Outreach Emails (drafted but not sent)
1. **MethylScan HCC** (Epigenomics) - Missing citations for sensitivity/specificity claims
2. **AbsoluteDx** - Missing TAT, LOD, reimbursement data

### Future Considerations
- API development for external healthcare developers
- Enhanced SEO strategies
- Potential community features (or links to existing patient communities)

---

## Key Files

### Patient Wizard
- `/src/components/patient/WatchingWizard.jsx` - Main wizard component with landing page

### Tests
- `/tests/openonco.spec.js` - Main test suite
- `/tests/wizard.spec.js` - Wizard filtering tests

### Configuration
- `/src/data.js` - Test database
- `/src/config/vendors.js` - Vendor badges and assistance programs

---

## Deployment Commands
```bash
./preview              # Smoke tests → develop → preview URL
./preview "message"    # With commit message
./release              # Full tests → main → production
./release "v1.x.x"     # With version tag
```
