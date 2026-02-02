# Daemon v2 Improvement Plan

Based on analysis of `OpenOnco_Daemon_Spec_v2.md` (2026-02-01)

## Executive Summary

The v1 daemon has a fundamental data model problem: **coverage is not one thing**. A patient's "covered?" answer depends on three layers that can contradict each other:

1. **Policy stance** - Payer's evidence review ("investigational", "unproven")
2. **UM criteria** - Operational rules that may allow narrow coverage despite stance
3. **Delegation** - LBM (Carelon/eviCore) may override payer policy entirely

**Current state:** We store "Signatera covered by UHC" based on in-network status, but UHC's published policy says "unproven/not medically necessary."

**Target state:** Store all three layers with source citations; synthesize patient-facing answer at query time.

---

## Phased Implementation

### Phase 1: Foundation (Week 1-2)
**Goal:** Fix the data model without changing crawling behavior

#### 1.1 Multi-Hash Storage
Replace single content hash with four hashes:

```javascript
// daemon/src/utils/multi-hash.js
export function computeHashes(content, parsedDoc) {
  return {
    contentHash: sha256(canonicalize(content)),
    metadataHash: sha256(JSON.stringify({
      effectiveDate: parsedDoc.effectiveDate,
      revisionDate: parsedDoc.revisionDate,
      policyId: parsedDoc.policyId,
    })),
    criteriaHash: sha256(parsedDoc.criteriaSection || ''),
    codesHash: sha256(JSON.stringify(parsedDoc.codes?.sort() || [])),
  };
}
```

**Trigger rules:**
- `criteriaHash` change → **HIGH priority, always analyze**
- `codesHash` change → **HIGH priority, always analyze**
- `metadataHash` change → **MEDIUM priority, analyze**
- `contentHash` only change → **LOW priority, skip or background**

**Files to modify:**
- `daemon/src/utils/hash-store.js` - Add columns for 4 hashes
- `daemon/src/crawlers/payers.js` - Use multi-hash comparison

#### 1.2 Document Type Classification
Add `docType` to policy registry entries:

```javascript
// daemon/src/data/policy-registry.js
{
  id: 'uhc-molecular-oncology',
  docType: 'medical_policy',  // NEW
  // ...
}

// docTypes:
// - medical_policy (evidence review stance)
// - um_criteria (operational prior auth rules)
// - lbm_guideline (Carelon/eviCore)
// - provider_bulletin (delegation announcements, code changes)
```

#### 1.3 CoverageAssertion Schema
New proposal type for layered coverage:

```javascript
// daemon/src/proposals/schema.js
const COVERAGE_ASSERTION_SCHEMA = {
  type: 'coverage_assertion',
  payerId: 'string',
  testId: 'string',
  layer: 'policy_stance | um_criteria | delegation | overlay',
  status: 'supports | restricts | denies | unclear',
  criteria: {
    cancerTypes: ['array'],
    stages: ['array'],
    settings: ['array'],
    frequency: 'string | null',
    priorAuth: 'required | not_required | unknown',
    timeWindow: 'string | null',
  },
  sourceDocumentId: 'string',
  sourceUrl: 'string',
  sourceCitation: 'string',  // page/section reference
  effectiveDate: 'YYYY-MM-DD | null',
  confidence: 'number 0-1',
};
```

---

### Phase 2: Extraction Pipeline (Week 3-4)
**Goal:** Extract structured data before LLM summarization

#### 2.1 Deterministic Extractors
Build regex/table parsers that run BEFORE LLM:

```javascript
// daemon/src/extractors/index.js
export async function extractStructuredData(content, docType) {
  return {
    // Always extract these deterministically
    effectiveDate: extractEffectiveDate(content),
    revisionDate: extractRevisionDate(content),
    policyId: extractPolicyId(content),
    codes: {
      cpt: extractCPTCodes(content),
      pla: extractPLACodes(content),
      hcpcs: extractHCPCSCodes(content),
    },
    namedTests: extractTestNames(content, TEST_NAME_PATTERNS),

    // Section extraction for criteria hash
    criteriaSection: extractCriteriaSection(content, docType),
  };
}
```

**Pattern files to create:**
- `daemon/src/extractors/dates.js` - Effective/revision date patterns
- `daemon/src/extractors/codes.js` - CPT/PLA/HCPCS table extraction
- `daemon/src/extractors/tests.js` - Test name matching
- `daemon/src/extractors/criteria.js` - Criteria section identification

#### 2.2 LLM Extraction Improvements
Update Claude prompts to output structured CoverageAssertion format:

```javascript
// daemon/src/crawlers/payers.js - extractCoverageInfo()
const EXTRACTION_PROMPT = `
You are analyzing a payer policy document for coverage of liquid biopsy/ctDNA/MRD tests.

Document type: ${docType}
Pre-extracted data:
- Named tests found: ${namedTests.join(', ')}
- Codes found: ${JSON.stringify(codes)}
- Effective date: ${effectiveDate}

For each test mentioned, extract:
1. coverage_status: "supports" | "restricts" | "denies" | "unclear"
2. criteria (if any): cancer types, stages, settings, frequency limits
3. key quotes with page/section citations

Output as JSON array of CoverageAssertion objects.
`;
```

#### 2.3 Confidence Scoring
Simple rules-based scoring:

```javascript
function calculateConfidence(extraction) {
  let score = 0.5;

  // Boost factors
  if (extraction.testExplicitlyNamed) score += 0.2;
  if (extraction.criteriaExplicit) score += 0.15;
  if (extraction.effectiveDateCurrent) score += 0.1;
  if (extraction.docType === 'um_criteria') score += 0.05;

  // Penalty factors
  if (extraction.ambiguousLanguage) score -= 0.2;
  if (extraction.codeOnlyInference) score -= 0.1;

  return Math.min(0.95, Math.max(0.1, score));
}
```

---

### Phase 3: Policy Registry Expansion (Week 5)
**Goal:** Add missing high-value sources

#### 3.1 Immediate Additions to POLICY_REGISTRY

| Payer | Document | URL | docType |
|-------|----------|-----|---------|
| Anthem | GENE.00059 (MRD investigational) | `https://files.providernews.anthem.com/1781/GENE.00059.pdf` | medical_policy |
| Carelon | Genetic Liquid Biopsy (2025) | `https://guidelines.carelonmedicalbenefitsmanagement.com/wp-content/uploads/2025/11/PDF-Genetic-Liquid-Biopsy-in-the-Management-of-Cancer-and-Cancer-Surveillance-2025-11-15-UC0126.pdf` | lbm_guideline |
| Blue Shield CA | UM Criteria (tumor-informed) | `https://www.blueshieldca.com/content/dam/bsca/en/provider/documents/2023/authorizations/PRV_Tumor_Informed_Circulating_Tumor_DNA_Test_Cancer_Mng.pdf` | um_criteria |
| Blue Shield CA | Medical Policy (liquid biopsy) | `https://www.blueshieldca.com/content/dam/bsca/en/provider/docs/medical-policies/Circulating-Tumor-DNA-Circulating-Tumor-Cells-Cancer-Liquid-Biopsy.pdf` | medical_policy |
| Highmark | L-267 (NavDx) | `https://securecms.highmark.com/content/medpolicy/en/highmark/pa/commercial/policies/Laboratory/L-267/L-267-001.html` | um_criteria |
| Geisinger | MP360 (MRD NGS) | `https://www.geisinger.org/-/media/OneGeisinger/Files/Policy-PDFs/MP/351-400/MP360-Minimal-Residual-Disease-NGS-Testing.pdf` | um_criteria |
| UHC | Hematologic policy | `https://www.uhcprovider.com/content/dam/provider/docs/public/policies/index/commercial/molecular-oncology-hematologic-cancer-diagnosis-01012026.pdf` | medical_policy |

#### 3.2 LBM Delegation Mapping
Track which payers delegate to which LBMs:

```javascript
// daemon/src/data/delegation-map.js
export const PAYER_DELEGATIONS = {
  'bcbs-louisiana': {
    delegatedTo: 'carelon',
    effectiveDate: '2024-07-01',
    scope: 'genetic_testing',
    sourceUrl: 'https://www.lablue.com/-/media/Medical%20Policies/...',
  },
  // Add more as discovered
};
```

---

### Phase 4: Discovery Jobs (Week 6-8)
**Goal:** Automatically find new policy documents

#### 4.1 Discovery Crawler Architecture

```javascript
// daemon/src/crawlers/discovery.js
export class DiscoveryCrawler extends BaseCrawler {
  async run() {
    const candidates = [];

    for (const payer of PAYERS_WITH_DISCOVERY) {
      // 1. Crawl known index pages
      const indexResults = await this.crawlIndexPage(payer);

      // 2. Use site search if available
      const searchResults = await this.searchPayerSite(payer, KEYWORDS);

      // 3. Filter to relevant documents
      const relevant = this.filterByKeywords([...indexResults, ...searchResults]);

      // 4. Check if already in registry
      const newDocs = relevant.filter(doc => !this.isInRegistry(doc.url));

      candidates.push(...newDocs.map(doc => ({
        type: 'NEW_DOCUMENT_CANDIDATE',
        payerId: payer.id,
        url: doc.url,
        title: doc.title,
        docTypeGuess: this.guessDocType(doc),
        matchedKeywords: doc.keywords,
        confidence: doc.relevanceScore,
      })));
    }

    return candidates;
  }
}
```

#### 4.2 Discovery Keywords

```javascript
// daemon/src/data/discovery-keywords.js
export const DISCOVERY_KEYWORDS = {
  primary: [
    'ctDNA', 'circulating tumor DNA', 'liquid biopsy',
    'minimal residual disease', 'molecular residual disease', 'MRD',
    'tumor-informed', 'tumor informed',
  ],
  tests: [
    'Signatera', 'RaDaR', 'Guardant Reveal', 'NavDx', 'clonoSEQ',
    'Haystack', 'NeXT Personal', 'Oncodetect', 'Pathlight',
  ],
  operational: [
    'prior authorization', 'medical necessity',
    'investigational', 'unproven', 'not medically necessary',
  ],
  codes: ['0340U', '0356U', '0364U', '0569U', '81479'],
};
```

#### 4.3 Discovery Review Queue
New proposal type for discovered documents:

```javascript
// daemon/src/proposals/schema.js
const DOCUMENT_CANDIDATE_SCHEMA = {
  type: 'document_candidate',
  payerId: 'string',
  url: 'string',
  title: 'string',
  docTypeGuess: 'medical_policy | um_criteria | lbm_guideline | unknown',
  matchedKeywords: ['array'],
  relevanceScore: 'number 0-1',

  // Human review fields
  action: 'add_to_registry | ignore | needs_investigation',
  confirmedDocType: 'string | null',
  notes: 'string | null',
};
```

---

### Phase 5: Delegation Detection (Week 9-10)
**Goal:** Detect and track payer→LBM delegations

#### 5.1 Delegation Detection Patterns

```javascript
// daemon/src/extractors/delegation.js
const DELEGATION_PATTERNS = [
  /(?:retired|replaced|superseded).*(?:carelon|evicore)/i,
  /delegated?\s+to\s+(?:carelon|evicore|aim)/i,
  /(?:carelon|evicore)\s+(?:will|now)\s+(?:manage|provide|handle)/i,
  /genetic\s+testing\s+management\s+(?:services|program)/i,
  /effective\s+(\d{1,2}\/\d{1,2}\/\d{4}).*(?:carelon|evicore)/i,
];

export function detectDelegation(content) {
  for (const pattern of DELEGATION_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      return {
        detected: true,
        delegatedTo: extractLBMName(match[0]),
        effectiveDate: extractDate(match),
        rawMatch: match[0],
      };
    }
  }
  return { detected: false };
}
```

#### 5.2 PAYER_DELEGATION_CHANGE Event

```javascript
// daemon/src/crawlers/payers.js
if (delegationInfo.detected) {
  discoveries.push({
    type: 'PAYER_DELEGATION_CHANGE',
    payerId: policy.payerId,
    delegatedTo: delegationInfo.delegatedTo,
    effectiveDate: delegationInfo.effectiveDate,
    sourceUrl: policy.url,
    sourceQuote: delegationInfo.rawMatch,
    recommendation: `Monitor ${delegationInfo.delegatedTo} guidelines instead`,
  });
}
```

---

### Phase 6: Contradiction Detection (Week 11-12)
**Goal:** Flag conflicting coverage signals

#### 6.1 Layer Weighting

```javascript
// daemon/src/analysis/reconcile.js
const LAYER_WEIGHTS = {
  um_criteria: 1.0,      // Operational rules are authoritative
  lbm_guideline: 0.95,   // Delegated LBM overrides payer policy
  medical_policy: 0.7,   // Evidence stance may not reflect operational reality
  provider_bulletin: 0.5,
  vendor_claim: 0.3,     // Vendor "in-network" claims least reliable
};

export function reconcileCoverage(assertions) {
  // Group by test
  const byTest = groupBy(assertions, 'testId');

  const results = {};
  for (const [testId, testAssertions] of Object.entries(byTest)) {
    // Sort by layer weight
    const sorted = testAssertions.sort((a, b) =>
      LAYER_WEIGHTS[a.layer] - LAYER_WEIGHTS[b.layer]
    );

    // Check for conflicts
    const statuses = new Set(sorted.map(a => a.status));
    if (statuses.has('supports') && statuses.has('denies')) {
      results[testId] = {
        status: 'CONFLICT_REVIEW_REQUIRED',
        highestWeight: sorted[0],
        conflicting: sorted.filter(a => a.status !== sorted[0].status),
      };
    } else {
      results[testId] = {
        status: sorted[0].status,
        authoritative: sorted[0],
        supporting: sorted.slice(1),
      };
    }
  }

  return results;
}
```

---

## File Changes Summary

### New Files
```
daemon/src/
├── utils/multi-hash.js           # Phase 1
├── extractors/
│   ├── index.js                  # Phase 2
│   ├── dates.js
│   ├── codes.js
│   ├── tests.js
│   ├── criteria.js
│   └── delegation.js             # Phase 5
├── data/
│   ├── delegation-map.js         # Phase 3
│   └── discovery-keywords.js     # Phase 4
├── crawlers/discovery.js         # Phase 4
└── analysis/reconcile.js         # Phase 6
```

### Modified Files
```
daemon/src/
├── utils/hash-store.js           # Add 4-hash columns (Phase 1)
├── data/policy-registry.js       # Add docType + new URLs (Phase 1, 3)
├── proposals/schema.js           # Add CoverageAssertion + DocumentCandidate (Phase 1, 4)
├── crawlers/payers.js            # Multi-hash + extraction pipeline (Phase 1, 2)
├── scheduler.js                  # Add discovery job schedule (Phase 4)
└── config.js                     # Add discovery config (Phase 4)
```

---

## Timeline Summary

| Phase | Focus | Duration | Priority | Status |
|-------|-------|----------|----------|--------|
| 1 | Foundation (multi-hash, docType, schema) | 2 weeks | **Critical** | ✅ **COMPLETE** |
| 2 | Extraction pipeline | 2 weeks | **High** | ✅ **COMPLETE** |
| 3 | Policy registry expansion | 1 week | **High** | ✅ **COMPLETE** |
| 4 | Discovery jobs | 3 weeks | Medium | ✅ **COMPLETE** |
| 5 | Delegation detection | 2 weeks | Medium | ✅ **COMPLETE** |
| 6 | Contradiction detection | 2 weeks | Medium | ✅ **COMPLETE** |

**All phases implemented!** Next steps: Integration with existing crawlers and scheduler.

---

## Success Metrics

1. **Accuracy:** Coverage assertions cite source documents with page/section references
2. **Completeness:** All Tier 1 payers have both medical_policy AND um_criteria tracked
3. **Freshness:** Criteria hash changes detected within 1 week of publication
4. **Recall:** Discovery jobs find >80% of new policies before manual discovery
5. **Conflict resolution:** <5% of assertions require manual conflict review

---

## Completed Actions (2026-02-01)

### Phase 1 - Foundation ✅
1. ✅ **Created `daemon/src/utils/multi-hash.js`** - 4-hash computation (content, metadata, criteria, codes)
2. ✅ **Updated `daemon/src/utils/hash-store.js`** - Added `policy_hashes` and `coverage_assertions` SQLite tables
3. ✅ **Updated `daemon/src/proposals/schema.js`** - Added `COVERAGE_ASSERTION`, `DOCUMENT_CANDIDATE`, `DELEGATION_CHANGE` types
4. ✅ **Added enums** - `COVERAGE_LAYERS`, `ASSERTION_STATUS`, `DOC_TYPES`
5. ✅ **Integration tests pass** - All 8 tests pass (multi-hash, hash-store, assertions, delegation map)

### Phase 2 - Extraction Pipeline ✅
1. ✅ **Created `daemon/src/extractors/dates.js`** - Date extraction with normalization
2. ✅ **Created `daemon/src/extractors/codes.js`** - CPT, PLA, HCPCS, ICD-10 extraction with MRD code mapping
3. ✅ **Created `daemon/src/extractors/tests.js`** - Named test extraction (13 tests mapped)
4. ✅ **Created `daemon/src/extractors/criteria.js`** - Criteria section and stance detection
5. ✅ **Created `daemon/src/extractors/index.js`** - Unified extraction interface with relevance scoring

### Phase 3 - Policy Registry Expansion ✅
1. ✅ **Added 11 new policy URLs** to `policy-registry.js` (Anthem GENE.00059, Geisinger MP360, Blue Shield CA UM, etc.)
2. ✅ **Created `daemon/src/data/delegation-map.js`** with 5 delegation entries (BCBSLA→Carelon, etc.)
3. ✅ **Added docType field** to 32 existing registry entries
4. ✅ **Total registry:** 59 policies with proper docType classification

### Phase 4 - Discovery Jobs ✅
1. ✅ **Created `daemon/src/data/discovery-keywords.js`** - Keywords for MRD/liquid biopsy relevance
2. ✅ **Created `daemon/src/crawlers/discovery.js`** - Discovery crawler with index page and search support
3. ✅ **Discovery sources configured** - 7 payers (UHC, Aetna, Cigna, Anthem, Humana, Carelon, eviCore)

### Phase 5 - Delegation Detection ✅
1. ✅ **Created `daemon/src/extractors/delegation.js`** - Delegation detection with 8 pattern types
2. ✅ **LBM identifiers mapped** - Carelon, eviCore, LabCorp, Quest
3. ✅ **Proposal builder** - Creates `delegation-change` proposals from detections

### Phase 6 - Contradiction Detection ✅
1. ✅ **Created `daemon/src/analysis/reconcile.js`** - Layer-weighted reconciliation
2. ✅ **Conflict detection** - High/medium/low severity classification
3. ✅ **Delegation awareness** - Adjusts layer weights when payer is delegated
4. ✅ **Frontend export** - Converts assertions to frontend-friendly format

### Integration Tests ✅
- All 14 integration tests pass covering all phases

## New Files Created

```
daemon/src/
├── extractors/
│   ├── index.js           # Unified extraction interface
│   ├── dates.js           # Date extraction
│   ├── codes.js           # Billing code extraction
│   ├── tests.js           # Test name extraction
│   ├── criteria.js        # Criteria/stance extraction
│   └── delegation.js      # Delegation detection
├── data/
│   ├── delegation-map.js  # Payer→LBM delegations
│   └── discovery-keywords.js  # Discovery search terms
├── crawlers/
│   └── discovery.js       # Document discovery crawler
└── analysis/
    └── reconcile.js       # Coverage reconciliation
```

## Next Steps (Integration)

1. **Wire extractors into payer crawler** - Call `extractStructuredData()` before LLM analysis
2. **Wire discovery into scheduler** - Add weekly discovery job
3. **Wire reconciliation into API** - Expose reconciled coverage for frontend
4. **Add delegation detection to crawl pipeline** - Detect and alert on new delegations
