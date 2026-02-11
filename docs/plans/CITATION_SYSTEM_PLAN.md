# MRD Chat Citation System — Implementation Plan

## Problem
The MRD chatbot names studies (TRACERx, α-CORRECT, COSMOS) without providing PMIDs, DOIs, or links. This:
1. Looks like hallucination even when accurate
2. Violates Cures Act CDS requirements (must provide references)
3. Undermines trust with physician users

## Solution: Three-Layer Citation System

### Layer 1: Pre-Indexed Evidence Library
**What:** A curated table of landmark MRD studies mapped to clinical scenarios, with verified PMIDs.
**Why:** Fast path — covers ~80% of common queries with zero hallucination risk.

#### New table: `mrd_evidence_library`
```sql
CREATE TABLE mrd_evidence_library (
  id SERIAL PRIMARY KEY,
  study_name VARCHAR(255) NOT NULL,        -- "TRACERx", "CIRCULATE-Japan", "DYNAMIC"
  study_aliases JSONB DEFAULT '[]',        -- ["TRACERx 421", "TRACERx NSCLC"]
  pmid VARCHAR(20),
  doi VARCHAR(100),
  nct_number VARCHAR(20),
  
  -- Bibliographic
  title TEXT NOT NULL,
  authors_short VARCHAR(255),              -- "Abbosh C et al."
  journal VARCHAR(255),
  publication_year INTEGER,
  
  -- Clinical mapping
  cancer_types JSONB NOT NULL,             -- ["non_small_cell_lung"]
  mrd_result_context VARCHAR(20),          -- "positive", "negative", "both", "monitoring"
  clinical_settings JSONB,                 -- ["post_surgery", "surveillance"]
  test_names JSONB,                        -- ["Signatera", "custom_panel"]
  
  -- Key findings (structured for the LLM to use)
  key_finding TEXT NOT NULL,               -- One-sentence finding
  sample_size INTEGER,
  evidence_strength VARCHAR(20),           -- "high", "moderate", "low"
  study_design VARCHAR(50),                -- "prospective_cohort", "rct", "retrospective"
  
  -- Linkage
  guidance_item_id INTEGER REFERENCES mrd_guidance_items(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_evidence_cancer ON mrd_evidence_library USING GIN(cancer_types);
CREATE INDEX idx_evidence_context ON mrd_evidence_library(mrd_result_context);
CREATE INDEX idx_evidence_study ON mrd_evidence_library(study_name);
```

#### Initial seed data (high-priority studies to curate):
- **Colorectal:** CIRCULATE-Japan (PMID: 36623937), DYNAMIC (PMID: 36757538), α-CORRECT, GALAXY/VEGA
- **NSCLC:** TRACERx (PMID: 37059876), MERMAID-1, IMpower010 ctDNA
- **Breast:** c-TRAK TN (PMID: 36088592), monarchE ctDNA
- **Pan-cancer:** BESPOKE (Signatera), COSMOS (Guardant Reveal)

#### How it integrates:
In `handleMRDChat()`, after intent extraction, query this table:
```js
const libraryHits = await query(`
  SELECT * FROM mrd_evidence_library
  WHERE cancer_types ?| $1
    AND (mrd_result_context = $2 OR mrd_result_context = 'both')
  ORDER BY evidence_strength DESC, publication_year DESC
  LIMIT 8
`, [intent.cancer_types, mrdResult]);
```
Inject as a `VERIFIED REFERENCES` block in the LLM prompt, separate from the vector search sources.

### Layer 2: PubMed Tool Calling
**What:** When the evidence library doesn't cover a query, search PubMed live for real PMIDs.
**Why:** Catches niche/emerging questions the curated library doesn't cover.

#### Implementation: Anthropic tool use
Add a `search_pubmed` tool definition to the Claude API call:
```js
const tools = [{
  name: "search_pubmed",
  description: "Search PubMed for MRD/ctDNA studies. Use when you need to cite a specific study and it is not in the VERIFIED REFERENCES. Returns real PMIDs.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "PubMed search query" },
      max_results: { type: "integer", default: 5 }
    },
    required: ["query"]
  }
}];
```

#### Tool handler (server-side):
```js
async function handlePubMedSearch(query, maxResults = 5) {
  // Use NCBI E-utilities API (free, no key needed for <3 req/sec)
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const pmids = searchData.esearchresult?.idlist || [];
  
  if (pmids.length === 0) return [];
  
  // Fetch summaries
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=json`;
  const summaryRes = await fetch(summaryUrl);
  const summaryData = await summaryRes.json();
  
  return pmids.map(pmid => {
    const article = summaryData.result?.[pmid];
    return {
      pmid,
      title: article?.title,
      authors: article?.authors?.map(a => a.name)?.slice(0, 3)?.join(', '),
      journal: article?.fulljournalname,
      year: article?.pubdate?.substring(0, 4),
      doi: article?.elocationid,
    };
  });
}
```

#### Integration in chat flow:
Switch from `messages.create()` to a tool-use loop:
```js
let response = await claude.messages.create({
  model: SONNET_MODEL,
  max_tokens: 1500,  // slightly more for tool use overhead
  system: MRD_CHAT_SYSTEM_PROMPT,
  tools,
  messages: [{ role: 'user', content: userContent }],
});

// Handle tool calls
while (response.stop_reason === 'tool_use') {
  const toolUse = response.content.find(b => b.type === 'tool_use');
  let toolResult;
  
  if (toolUse.name === 'search_pubmed') {
    toolResult = await handlePubMedSearch(toolUse.input.query, toolUse.input.max_results);
  }
  
  response = await claude.messages.create({
    model: SONNET_MODEL,
    max_tokens: 1500,
    system: MRD_CHAT_SYSTEM_PROMPT,
    tools,
    messages: [
      { role: 'user', content: userContent },
      { role: 'assistant', content: response.content },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }] },
    ],
  });
}
```

### Layer 3: System Prompt Citation Enforcement
**What:** Hard rules in the system prompt that prevent naming studies without PMIDs.
**Why:** The guardrail that catches everything else.

#### Add to `MRD_CHAT_SYSTEM_PROMPT`:
```
CITATION RULES (MANDATORY):
1. Every named study MUST include a PMID or NCT number. Format: "TRACERx (PMID: 37059876)"
2. If a study is in VERIFIED REFERENCES, use the provided PMID exactly.
3. If you need to cite a study NOT in VERIFIED REFERENCES or AVAILABLE SOURCES, use the search_pubmed tool to find the real PMID first.
4. If you cannot verify a PMID for a study, do NOT name it. Instead say: "Emerging data from prospective cohort studies suggest..." without naming the specific study.
5. NEVER output a study name without an accompanying PMID, DOI, or NCT number.
6. For clinical trials, always include the NCT number: "DYNAMIC trial (NCT04015297)"
```

#### Update citation-validator.js:
Add a new validation pattern that catches study names without identifiers:
```js
// Pattern: study name followed by no PMID/DOI/NCT within 100 chars
const STUDY_WITHOUT_ID = /\b(TRACERx|CIRCULATE|DYNAMIC|BESPOKE|COSMOS|α-CORRECT|GALAXY|VEGA|MERMAID|c-TRAK|monarchE)\b(?![\s\S]{0,100}(PMID|DOI|NCT|pmid|doi|nct))/i;
```

## Execution Order

### Phase 1: System prompt + citation validator update (30 min)
- Update `MRD_CHAT_SYSTEM_PROMPT` with citation rules
- Add study-name-without-ID pattern to `citation-validator.js`
- Immediate improvement, no DB changes needed

### Phase 2: Evidence library table + seed data (2-3 hrs)
- Create `mrd_evidence_library` table
- Write seed script to populate ~30 landmark studies with verified PMIDs
- Modify `handleMRDChat()` to query library and inject as VERIFIED REFERENCES
- Add library hits to the formatted sources in the response

### Phase 3: PubMed tool calling (2-3 hrs)
- Add tool definition and handler
- Convert `handleMRDChat()` to tool-use loop
- Add rate limiting for NCBI API (3 req/sec max)
- Cache PubMed results in a simple table to avoid redundant lookups

### Phase 4: Testing + eval (1-2 hrs)
- Run eval suite with the late-conversion question and other golden queries
- Verify PMIDs appear in responses
- Check that hallucinated study names are caught
- Update `physician-questions.json` with citation-focused test cases

## Files Modified
- `physician-system/src/chat/server.js` — all three layers
- `physician-system/src/chat/citation-validator.js` — study name detection
- `physician-system/docs/DATABASE.md` — new table schema
- `physician-system/eval/physician-questions.json` — new test cases

## Files Created
- `physician-system/scripts/seed-evidence-library.js` — populate landmark studies
- `physician-system/src/chat/pubmed-client.js` — E-utilities wrapper
