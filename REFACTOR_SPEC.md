# OpenOnco Refactor Spec: Data Split + OpenAlz Domain Support

## Overview

Refactor the monolithic App.jsx (~12,700 lines) into a modular structure, and add multi-domain support to serve both OpenOnco (oncology) and OpenAlz (Alzheimer's/dementia diagnostics) from a single codebase.

## Current State

- Single `App.jsx` file containing everything: test data, config, components
- 4 oncology test categories: MRD, ECD, TRM, TDS
- Domain: openonco.org only

## Target State

- Modular file structure with data separated from components
- 5 test categories: MRD, ECD, TRM, TDS (oncology) + ALZ-BLOOD (Alzheimer's)
- Multi-domain: openonco.org shows oncology, openalz.org shows Alzheimer's

---

## Part 1: File Structure Refactor

### Proposed Structure

```
/src
  /data
    mrdTests.js           # export const mrdTestData = [...]
    ecdTests.js           # export const ecdTestData = [...]
    trmTests.js           # export const trmTestData = [...]
    tdsTests.js           # export const tdsTestData = [...]
    alzBloodTests.js      # export const alzBloodTestData = [...] ← NEW
    changelog.js          # export const DATABASE_CHANGELOG = [...]
    recentlyAdded.js      # export const RECENTLY_ADDED_TESTS = [...]
    index.js              # Re-export all data
  /config
    siteConfig.js         # Domain detection, SITE_CONFIG, CURRENT_SITE
    categories.js         # LIFECYCLE_STAGES, categoryMeta, DOMAIN_CATEGORIES
    filters.js            # filterConfigs
    comparison.js         # comparisonParams
    index.js              # Re-export all config
  /components
    (keep components in App.jsx for now, or split if time permits)
  App.jsx                 # Main app, imports from /data and /config
```

### Key Extraction Points in Current App.jsx

| Content | Current Line | Extract To |
|---------|--------------|------------|
| RECENTLY_ADDED_TESTS | ~24 | data/recentlyAdded.js |
| DATABASE_CHANGELOG | ~50 | data/changelog.js |
| mrdTestData | ~1257 | data/mrdTests.js |
| ecdTestData | ~2723 | data/ecdTests.js |
| trmTestData | ~3462 | data/trmTests.js |
| tdsTestData | ~3815 | data/tdsTests.js |
| filterConfigs | ~5360 | config/filters.js |
| comparisonParams | ~5406 | config/comparison.js |
| categoryMeta | ~5517 | config/categories.js |
| LIFECYCLE_STAGES | ~640 | config/categories.js |

---

## Part 2: Multi-Domain Support

### Domain Detection (add to config/siteConfig.js)

```javascript
// Domain detection
const getSiteDomain = () => {
  const hostname = window.location.hostname;
  if (hostname.includes('openalz') || hostname.includes('alz.')) return 'alz';
  return 'onco';
};

export const SITE_DOMAIN = getSiteDomain();

export const SITE_CONFIG = {
  onco: {
    name: 'OpenOnco',
    tagline: 'Open Cancer Diagnostic Test Database',
    primaryColor: 'emerald',
  },
  alz: {
    name: 'OpenAlz',
    tagline: 'Alzheimer\'s & Dementia Diagnostic Test Database',
    primaryColor: 'violet',
  }
};

export const CURRENT_SITE = SITE_CONFIG[SITE_DOMAIN];
```

### Category Domain Assignment

Add `domain` field to each entry in LIFECYCLE_STAGES:

```javascript
// Oncology categories
{ id: 'ECD', ..., domain: 'onco' },
{ id: 'TDS', ..., domain: 'onco' },
{ id: 'TRM', ..., domain: 'onco' },
{ id: 'MRD', ..., domain: 'onco' },

// Alzheimer's categories
{ 
  id: 'ALZ-BLOOD', 
  name: 'Blood Biomarkers',
  acronym: 'Blood',
  phase: 'Cognitive Screening',
  color: 'violet',
  icon: '🧠',
  gridPosition: 0,
  arrowDirection: 'none',
  domain: 'alz',
},
```

### Filter Categories by Domain

```javascript
export const LIFECYCLE_STAGES_BY_GRID = [...LIFECYCLE_STAGES]
  .filter(stage => stage.domain === SITE_DOMAIN)
  .sort((a, b) => a.gridPosition - b.gridPosition);

export const DOMAIN_CATEGORIES = LIFECYCLE_STAGES
  .filter(stage => stage.domain === SITE_DOMAIN)
  .map(stage => stage.id);
```

### Route Updates (in App.jsx)

Add to pathToPage:
```javascript
'/blood': 'ALZ-BLOOD',
'/alz-blood': 'ALZ-BLOOD',
```

Add to pageToPath:
```javascript
'ALZ-BLOOD': '/blood',
```

Update ALL_CATEGORIES:
```javascript
const ALL_CATEGORIES = ['MRD', 'ECD', 'TRM', 'TDS', 'ALZ-BLOOD'];
```

Update renderPage switch to include ALZ-BLOOD case (same as other categories).

### Test Data Selection Helper

Replace the repeated ternary chains with a helper function:

```javascript
const getTestListByCategory = (cat) => {
  switch(cat) {
    case 'MRD': return mrdTestData;
    case 'ECD': return ecdTestData;
    case 'TRM': return trmTestData;
    case 'TDS': return tdsTestData;
    case 'ALZ-BLOOD': return alzBloodTestData;
    default: return [];
  }
};
```

---

## Part 3: ALZ-BLOOD Test Data

### New File: data/alzBloodTests.js

```javascript
export const alzBloodTestData = [
  {
    id: "alz-blood-1",
    name: "PrecivityAD2",
    vendor: "C2N Diagnostics",
    sampleCategory: "Blood/Plasma",
    approach: "Mass Spectrometry",
    method: "LC-MS/MS measuring Aβ42/40 ratio and p-tau217 ratio",
    biomarkers: ["Aβ42/40 ratio", "p-tau217/np-tau217 ratio"],
    targetPopulation: "Adults 55+ with cognitive symptoms",
    sensitivity: 96,
    specificity: 97,
    ppv: 91,
    npv: 98,
    auc: 0.97,
    fdaStatus: "CLIA LDT - Breakthrough Device Designation",
    reimbursement: "Limited - patient pay / coverage emerging",
    listPrice: 1200,
    tat: "10-14 days",
    clinicalAvailability: "Commercially available in US",
    availableRegions: ["US"],
    numPublications: 50,
    numPublicationsPlus: true,
    technologyDifferentiator: "Industry-leading accuracy with dual biomarker approach",
    limitations: "Does not diagnose Alzheimer's - aids in evaluation",
    vendorUrl: "https://precivityad.com"
  },
  {
    id: "alz-blood-2",
    name: "PrecivityAD",
    vendor: "C2N Diagnostics",
    sampleCategory: "Blood/Plasma",
    approach: "Mass Spectrometry",
    method: "LC-MS/MS measuring Aβ42/40 ratio and ApoE proteotype",
    biomarkers: ["Aβ42/40 ratio", "ApoE proteotype"],
    sensitivity: 86,
    specificity: 89,
    auc: 0.88,
    fdaStatus: "CLIA LDT",
    listPrice: 1200,
    tat: "10-14 days",
    numPublications: 30,
    vendorUrl: "https://precivityad.com"
  },
  {
    id: "alz-blood-3",
    name: "Lumipulse G pTau217/β-Amyloid 1-42",
    vendor: "Fujirebio",
    sampleCategory: "Blood/Plasma",
    approach: "Immunoassay",
    method: "Automated CLEIA on Lumipulse G platform",
    biomarkers: ["p-tau217", "Aβ1-42"],
    sensitivity: 91,
    specificity: 89,
    fdaStatus: "FDA De Novo Cleared (May 2024)",
    reimbursement: "Medicare - coverage expected to expand",
    listPrice: 650,
    tat: "Same day (if in-house)",
    availableRegions: ["US", "EU", "Japan"],
    numPublications: 40,
    technologyDifferentiator: "First FDA-cleared AD blood test",
    vendorUrl: "https://www.fujirebio.com"
  },
  {
    id: "alz-blood-4",
    name: "Elecsys pTau181/Aβ42",
    vendor: "Roche Diagnostics",
    sampleCategory: "Blood/Plasma",
    approach: "Immunoassay",
    method: "ECLIA on cobas platform",
    biomarkers: ["p-tau181", "Aβ42"],
    sensitivity: 85,
    specificity: 80,
    auc: 0.85,
    fdaStatus: "CE-IVD; US availability pending",
    listPrice: 500,
    availableRegions: ["EU"],
    numPublications: 100,
    technologyDifferentiator: "Runs on widely-deployed cobas platform",
    vendorUrl: "https://diagnostics.roche.com"
  },
  {
    id: "alz-blood-5",
    name: "AD-Detect",
    vendor: "Quest Diagnostics",
    sampleCategory: "Blood/Plasma",
    approach: "Mass Spectrometry",
    method: "LC-MS/MS measuring Aβ42/40 ratio",
    biomarkers: ["Aβ42/40 ratio"],
    sensitivity: 81,
    specificity: 83,
    fdaStatus: "CLIA LDT",
    listPrice: 500,
    tat: "7-10 days",
    numPublications: 10,
    vendorUrl: "https://www.questdiagnostics.com"
  },
  {
    id: "alz-blood-6",
    name: "ALZpath pTau217",
    vendor: "ALZpath / Quanterix",
    sampleCategory: "Blood/Plasma",
    approach: "Simoa Immunoassay",
    method: "Single molecule array (Simoa) measuring p-tau217",
    biomarkers: ["p-tau217"],
    sensitivity: 93,
    specificity: 94,
    auc: 0.96,
    fdaStatus: "Research Use Only - FDA submission planned",
    listPrice: 500,
    numPublications: 25,
    vendorUrl: "https://alzpath.bio"
  },
  {
    id: "alz-blood-7",
    name: "Simoa pTau-181",
    vendor: "Quanterix",
    sampleCategory: "Blood/Plasma",
    approach: "Simoa Immunoassay",
    method: "Simoa ultrasensitive immunoassay for p-tau181",
    biomarkers: ["p-tau181"],
    sensitivity: 85,
    specificity: 82,
    fdaStatus: "Research Use Only",
    listPrice: 400,
    numPublications: 200,
    vendorUrl: "https://www.quanterix.com"
  },
  {
    id: "alz-blood-8",
    name: "pTau-217 Blood Test",
    vendor: "Labcorp",
    sampleCategory: "Blood/Plasma",
    approach: "Immunoassay",
    method: "Immunoassay measuring p-tau217",
    biomarkers: ["p-tau217"],
    sensitivity: 90,
    specificity: 88,
    fdaStatus: "CLIA LDT",
    listPrice: 600,
    tat: "7-10 days",
    numPublications: 5,
    vendorUrl: "https://www.labcorp.com"
  },
  {
    id: "alz-blood-9",
    name: "LucentAD",
    vendor: "Quanterix",
    sampleCategory: "Blood/Plasma",
    approach: "Simoa Immunoassay",
    method: "Simoa-based p-tau181 with proprietary algorithm",
    biomarkers: ["p-tau181"],
    sensitivity: 86,
    specificity: 84,
    fdaStatus: "CLIA LDT",
    listPrice: 650,
    tat: "10-14 days",
    numPublications: 15,
    vendorUrl: "https://www.quanterix.com"
  }
];
```

### Add to categoryMeta

```javascript
'ALZ-BLOOD': {
  title: 'Alzheimer\'s Blood Biomarkers',
  shortTitle: 'Blood Biomarkers',
  description: 'Blood-based biomarker tests for Alzheimer\'s disease...',
  patientTitle: 'Alzheimer\'s Blood Tests',
  patientDescription: 'These blood tests check for signs of Alzheimer\'s disease...',
  color: 'violet',
  tests: alzBloodTestData,
  sourceUrl: '',
  domain: 'alz',
},
```

### Add to filterConfigs

```javascript
'ALZ-BLOOD': {
  productTypes: ['Central Lab Service'],
  sampleCategories: ['Blood/Plasma'],
  approaches: ['Mass Spectrometry', 'Immunoassay', 'Simoa Immunoassay'],
  fdaStatuses: ['FDA Cleared', 'CLIA LDT', 'Research Use Only'],
  reimbursements: ['Medicare', 'Commercial', 'Patient Pay'],
  regions: ['US', 'EU', 'Global'],
},
```

### Add to comparisonParams

```javascript
'ALZ-BLOOD': [
  { key: 'approach', label: 'Technology' },
  { key: 'method', label: 'Method' },
  { key: 'biomarkersStr', label: 'Biomarkers Measured' },
  { key: 'targetPopulation', label: 'Target Population' },
  { key: 'sensitivity', label: 'Sensitivity (%)' },
  { key: 'specificity', label: 'Specificity (%)' },
  { key: 'ppv', label: 'PPV (%)' },
  { key: 'npv', label: 'NPV (%)' },
  { key: 'auc', label: 'AUC' },
  { key: 'fdaStatus', label: 'Regulatory Status' },
  { key: 'reimbursement', label: 'Coverage' },
  { key: 'listPrice', label: 'List Price (USD)' },
  { key: 'tat', label: 'Turnaround Time' },
  { key: 'numPublications', label: 'Publications' },
  { key: 'limitations', label: 'Limitations' },
],
```

---

## Part 4: UI Updates for Domain

### Header Component

- Show OpenOnco logo/branding on `onco` domain
- Show OpenAlz logo/branding (text-based for now: 🧠 OpenAlz) on `alz` domain
- Use `CURRENT_SITE.primaryColor` for accent colors

### Footer Component

- Update disclaimer text to be domain-appropriate
- OpenAlz disclaimer should mention dementia/cognitive evaluation context

### HomePage

- Filter LIFECYCLE_STAGES_BY_GRID to only show current domain's categories
- Update hero text based on CURRENT_SITE

---

## Verification Steps

After each major change, verify:

1. `npm run dev` - app starts without errors
2. Homepage loads and shows correct categories for domain
3. Each category page loads and displays tests
4. Filters work correctly
5. Test comparison modal works
6. Chat functionality works

Test domain switching by temporarily changing `getSiteDomain()` to return 'alz'.

---

## Order of Operations

1. **Commit current state**: `git add -A && git commit -m "checkpoint before refactor"`

2. **Extract data files** (one at a time, verify after each):
   - recentlyAdded.js
   - changelog.js  
   - mrdTests.js
   - ecdTests.js
   - trmTests.js
   - tdsTests.js

3. **Extract config files**:
   - siteConfig.js (with domain detection)
   - categories.js
   - filters.js
   - comparison.js

4. **Add ALZ support**:
   - alzBloodTests.js
   - Update categories.js with ALZ-BLOOD
   - Update filters.js
   - Update comparison.js
   - Update routes in App.jsx

5. **UI domain awareness**:
   - Header updates
   - HomePage filtering
   - Footer updates

6. **Final verification** and commit

---

## Notes

- Keep `domain` field on categories but don't complicate UI logic - just filter what's shown
- ALZ starts with single category (ALZ-BLOOD); can add ALZ-CSF, ALZ-IMAGING later
- DNS: point openalz.org to same Vercel deployment as openonco.org
- Both domains serve same build, domain detection happens client-side
