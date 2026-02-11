# Citation Integrity Upgrade — 3-Layer Plan
# physician-system at /Users/adickinson/Documents/GitHub/V0/physician-system
# Work on develop branch

## CONTEXT

The MRD chatbot names specific studies (TRACERx, α-CORRECT, COSMOS) without linking them to
numbered [N] citations. The citation-validator.js catches uncited clinical CLAIMS but not uncited
study NAMES. The model generates study names from training data that may not exist in the
retrieved sources — a hallucination risk that undermines our Cures Act CDS compliance posture
(we must provide verifiable references so physicians draw their own conclusions).

Three layers of fixes, implement all three:

---

## LAYER 1: System Prompt & Validator (quick win)

### 1a. src/chat/server.js — MRD_CHAT_SYSTEM_PROMPT

After the existing line "Format citations as [1], [2], etc. The system will append the full citation list."
add:

```
CITATION INTEGRITY RULES:
- Never reference a study, trial, or dataset by name (e.g., "TRACERx", "CIRCULATE", "DYNAMIC", "COSMOS") unless it maps to one of the numbered sources [N] provided below.
- If you recall a relevant study that is NOT in the provided sources, describe the finding generically: "a prospective NSCLC cohort study demonstrated..." rather than "the TRACERx study showed..."
- Every PMID, DOI, NCT number, or study acronym in your response MUST correspond to a provided source.
- If no provided sources address the question, say "The indexed evidence does not specifically address this" — do not fill gaps with uncitable study names from general knowledge.
```

### 1b. src/chat/citation-validator.js — Add study name detection

Add a new pattern category that catches study/trial names without adjacent [N] citations.
Create a STUDY_NAME_PATTERN regex matching:
- All-caps or CamelCase acronyms that look like trial names: /\b[A-Z][A-Za-z]*[A-Z]+[a-z]*\b/ (TRACERx, CIRCULATE, DYNAMIC, GALAXY, BESPOKE, COSMOS, etc.)
- Explicit patterns: /\b(the\s+)?[A-Z][A-Za-z-]+\s+(study|trial|data|cohort|analysis|results)\b/
- NCT numbers without citation: /NCT\d{8}/
- PMIDs without citation: /PMID:?\s*\d+/

In the `needsCitation()` function, add these patterns. A sentence containing a study name pattern
without a [N] within the same sentence should be flagged as a violation.

Add them to CLINICAL_CLAIM_PATTERNS as a new group, or create a separate STUDY_NAME_PATTERNS array
and check it in validateCitations alongside the existing checks.

### 1c. src/chat/response-template.js — SAFETY_BLOCK

Add rule 10:
"10. Never name a specific study, trial, or dataset unless it maps to a provided source [N]. Use generic evidence descriptors for findings not in the provided sources."

---

## LAYER 2: PubMed Real-Time Verification (tool calling)

This is the big one. When the model's response names a study that ISN'T in the retrieved DB sources,
we should be able to verify it against PubMed in real-time.

### 2a. Create src/chat/pubmed-verifier.js

A module that:
1. Takes the model's response text after generation
2. Extracts any study names, PMIDs, or DOIs mentioned
3. For each unverified reference (not already in the [N] source list), queries PubMed via the
   NCBI E-utilities API (eutils.ncbi.nlm.nih.gov) — specifically:
   - esearch.fcgi for keyword searches (e.g., "TRACERx ctDNA NSCLC")
   - efetch.fcgi to get article metadata (title, authors, PMID, DOI, journal, year)
4. Returns verified references with PMIDs that can be appended to the source list
5. For study names that can't be verified, flags them for removal or genericization

API details:
- Base URL: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
- esearch: esearch.fcgi?db=pubmed&term=QUERY&retmode=json&retmax=3
- efetch: efetch.fcgi?db=pubmed&id=PMID&rettype=abstract&retmode=xml
- Rate limit: 3 requests/sec without API key, 10/sec with (use NCBI_API_KEY env var if available)
- No auth required for basic usage

The module should export:
```js
export async function verifyAndEnrichCitations(responseText, existingSources) {
  // Returns { enrichedResponse, additionalSources, unverifiedStudyNames }
}
```

### 2b. Integrate into server.js handleMRDChat flow

After the Claude response is generated (Step 4) and before citation validation (Step 5):
1. Call verifyAndEnrichCitations(answer, formattedSources)
2. If additional PubMed-verified sources are found, append them to formattedSources
3. If unverified study names remain, either:
   a. Pass them to the citation rewriter to genericize, OR
   b. Flag them in the response metadata for quality tracking

### 2c. Add to chat log tracking

In the mrd_chat_logs INSERT, add a field (or include in existing JSON) tracking:
- pubmed_lookups_attempted: number
- pubmed_lookups_verified: number  
- unverified_study_names: string[]

---

## LAYER 3: Pre-Indexed Evidence Library (curated landmark studies)

The DB already has mrd_guidance_items with pmid, doi, source_id fields. But many landmark MRD
studies that the model frequently references aren't in there yet. We need to seed them.

### 3a. Create scripts/seed-landmark-studies.js

A script that inserts the most commonly referenced MRD landmark studies into mrd_guidance_items.
These are the studies the model KEEPS trying to cite — let's make them citable.

Seed at minimum these studies (look up exact PMIDs):

COLORECTAL:
- GALAXY/CIRCULATE-Japan (Kotani et al, Nature Medicine 2023) — ctDNA-guided adjuvant in CRC
- DYNAMIC (Tie et al, NEJM 2022) — ctDNA-guided adjuvant in stage II CRC
- DYNAMIC-III — stage III CRC, ongoing
- α-CORRECT (Oncodetect) — MRD in CRC
- BESPOKE CRC (Signatera) — ctDNA monitoring in CRC
- MEDOCC-CrEATE — ctDNA-guided surveillance CRC

LUNG:
- TRACERx (Abbosh/Swanton et al, Nature 2017; updated Nature 2023) — ctDNA phylogenetics in NSCLC
- MERMAID-1 — ctDNA-guided adjuvant immunotherapy NSCLC
- IMvigor011 — ctDNA-guided atezolizumab in bladder (often referenced in MRD discussions)

BREAST:
- c-TRAK TN (Turner et al) — ctDNA-guided intervention in TNBC

MULTI-CANCER:
- COSMOS (Guardant Reveal) — multi-cancer MRD validation

For each study, the script should:
1. Search PubMed via esearch to get the PMID
2. Fetch metadata via efetch (title, authors, journal, year, DOI)
3. Insert into mrd_guidance_items with source_type='pubmed', proper pmid/doi
4. Add cancer type and clinical setting junction records
5. Skip if already exists (check source_type + source_id uniqueness)

Make it idempotent — safe to run multiple times.

### 3b. Create data/landmark-studies.json

A curated JSON file listing the landmark studies with their search queries and expected metadata.
This serves as both the seed source and documentation of what the "evidence library" contains.
Format:
```json
[
  {
    "nickname": "GALAXY",
    "searchQuery": "GALAXY CIRCULATE-Japan ctDNA colorectal Kotani",
    "expectedPmid": "37749153",
    "cancerTypes": ["colorectal"],
    "clinicalSettings": ["post_surgery", "during_adjuvant"],
    "questions": ["positive_result_action", "escalation"]
  }
]
```

### 3c. After seeding, run embedding

The existing embedAllMissing() function should pick up the new items automatically.
Add a note in the script to remind the operator to run:
`curl -X POST http://localhost:3000/api/trigger-crawl -H 'X-Crawl-Secret: ...' -d '{"action":"embed"}'`

---

## IMPORTANT NOTES
- Work on develop branch
- Don't modify tests or unrelated files  
- The PubMed verifier (Layer 2) should fail gracefully — if PubMed is unreachable, proceed without verification
- The landmark seeder (Layer 3) should be idempotent and log what it inserted/skipped
- For Layer 2, respect NCBI rate limits (sleep 340ms between requests without API key)
