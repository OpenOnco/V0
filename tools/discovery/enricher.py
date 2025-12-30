"""
Claude Enricher: Extracts structured test information from raw candidates.
"""

import json
from anthropic import Anthropic

from config import CONFIG


EXTRACTION_PROMPT = """You are analyzing a potential new cancer diagnostic test for the OpenOnco database.

OpenOnco tracks liquid biopsy and molecular diagnostic tests across these categories:
- **MRD** (Minimal Residual Disease): Monitors for cancer recurrence after treatment
- **ECD** (Early Cancer Detection): Screens for cancer in asymptomatic individuals
- **TRM** (Treatment Response Monitoring): Tracks how cancer responds to therapy
- **TDS** (Treatment Decision Support): Guides therapy selection based on tumor profiling

**KNOWN EXISTING TESTS (already in OpenOnco - do NOT flag as new):**
Signatera, Guardant360, Guardant360 CDx, Guardant360 TissueNext, GuardantReveal, GuardantINFINITY, GuardantOMNI,
FoundationOne Liquid CDx, F1LCDx, FoundationOne CDx, FoundationOne Heme,
Tempus xT, Tempus xF, Tempus xF+, Tempus xR, Tempus xG, Tempus xE,
Galleri, Shield, CancerSEEK, Caris Assure, Caris Molecular Intelligence,
clonoSEQ, RaDaR, Invitae Personalized Cancer Monitoring, Resolution ctDx, Resolution ctDx FIRST,
Oncomine, TruSight Oncology 500, NeoLAB, Biodesix GeneStrat, Biodesix Nodify,
Myriad myChoice, Myriad BRACAnalysis, PGDx elio, AVENIO, DELFI,
PredicineCARE, InVisionFirst, Plasma-SafeSeqS, CancerIntercept, PanSeer, OncoLBx, 
LUNAR-1, LUNAR-2, NeXT Personal, Natera Prospera, Natera Renasight, Natera Panorama,
Helio Liver Test, HelioLiver, Exact Sciences Cologuard, Oncotype DX

Analyze this candidate and classify it.

SOURCE: {source}
SOURCE URL: {source_url}
TITLE: {title}
COMPANY: {company}
DATE: {date}

RAW DATA:
{raw_data}

---

Respond with ONLY a valid JSON object (no markdown, no ```, no explanation):

{{
    "is_new_test": true/false,
    "is_new_indication": true/false,
    "is_relevant": true/false,
    "relevance_reason": "Brief explanation",
    "test_name": "Official test name or null",
    "company": "Company name",
    "cancer_types": ["Cancer types if specified"],
    "sample_type": "Blood/Plasma, Urine, or Other",
    "methodology": "e.g. NGS, PCR, Methylation",
    "category": "MRD, ECD, TRM, or TDS",
    "secondary_categories": [],
    "approach": "Tumor-informed or Tumor-naïve (for MRD)",
    "fda_status": "510(k) cleared, PMA approved, CLIA LDT, CE-IVD, RUO, or Unknown",
    "clearance_date": "YYYY-MM-DD or null",
    "key_claims": ["Key clinical claims"],
    "biomarkers": ["Specific biomarkers if mentioned"],
    "existing_test_name": "If is_new_indication=true, which existing test",
    "new_indication_details": "If is_new_indication=true, what's new",
    "notes": "Other relevant context",
    "confidence": 0.0-1.0
}}

CLASSIFICATION RULES:
1. **is_new_test=true**: Genuinely NEW test NOT in the known list above. Set is_relevant=true.
2. **is_new_indication=true**: EXISTING test (from known list) being studied in a new cancer type, patient population, or clinical context. Set is_relevant=true but is_new_test=false.
3. **is_relevant=false**: Pure academic research, tissue-only tests, not cancer diagnostics, or duplicates.

Examples:
- "Signatera in uveal melanoma trial" → is_new_test=false, is_new_indication=true, existing_test_name="Signatera"
- "Novel cfDNA methylation test from startup X" → is_new_test=true, is_new_indication=false
- "University study on ctDNA kinetics" → is_relevant=false (pure research)
"""


class ClaudeEnricher:
    """Uses Claude to extract structured test information from raw candidates."""

    def __init__(self):
        self.client = Anthropic()
        self.model = CONFIG["claude"]["model"]
        self.max_tokens = CONFIG["claude"]["max_tokens"]

    async def enrich(self, candidate: dict) -> dict:
        """Enrich a single candidate with Claude extraction."""
        raw_data = json.dumps(candidate.get("raw_data", {}), indent=2)
        if len(raw_data) > 6000:
            raw_data = raw_data[:6000] + "\n... [truncated]"

        prompt = EXTRACTION_PROMPT.format(
            source=candidate["source"],
            source_url=candidate["source_url"],
            title=candidate.get("title", ""),
            company=candidate.get("company", ""),
            date=candidate.get("date", ""),
            raw_data=raw_data,
        )

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )

            content = response.content[0].text.strip()
            
            # Handle markdown code blocks
            if content.startswith("```"):
                lines = content.split("\n")
                content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                content = content.strip()

            extracted = json.loads(content)

            candidate["extracted"] = extracted
            candidate["confidence"] = extracted.get("confidence", 0.5)
            candidate["is_relevant"] = extracted.get("is_relevant", True)
            candidate["is_new_test"] = extracted.get("is_new_test", False)
            candidate["is_new_indication"] = extracted.get("is_new_indication", False)

        except json.JSONDecodeError as e:
            print(f"      JSON parse error: {e}")
            candidate["extracted"] = None
            candidate["confidence"] = 0
            candidate["enrichment_error"] = f"JSON parse: {str(e)}"
        except Exception as e:
            print(f"      Enrichment error: {e}")
            candidate["extracted"] = None
            candidate["confidence"] = 0
            candidate["enrichment_error"] = str(e)

        return candidate

    async def enrich_batch(self, candidates: list[dict]) -> list[dict]:
        """Enrich multiple candidates."""
        enriched = []
        for i, candidate in enumerate(candidates):
            print(f"  [{i+1}/{len(candidates)}] Enriching: {candidate.get('title', 'Unknown')[:50]}...")
            enriched_candidate = await self.enrich(candidate)
            enriched.append(enriched_candidate)
        return enriched
