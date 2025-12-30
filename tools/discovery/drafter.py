"""
Submission Drafter: Generates draft submissions following SUBMISSION_PROCESS.md
"""

import json
import re
from datetime import datetime
from anthropic import Anthropic
from config import CONFIG


DRAFT_PROMPT = """You are helping prepare a new test submission for OpenOnco, a database of liquid biopsy cancer diagnostic tests.

Based on the extracted information, generate a draft data.js entry following OpenOnco's format.

## Test Information:
{extracted_json}

## Source URL:
{source_url}

## Raw Data (for additional context):
{raw_data}

---

Generate a COMPLETE test object in valid JSON format.
Category: {category}

Use this exact template and fill in all fields you can determine from the data. Use null for unknown numbers, "" for unknown strings.

{template}

IMPORTANT:
- Output ONLY the JSON object, nothing else - no explanation, no markdown
- Fill in every field you have data for
- Use null for unknown numeric fields
- Use "" for unknown string fields
- cancerTypes should be an array like ["Lung", "Breast"] or ["Pan-cancer"]
- Include the source URL in methodCitations
- Set vendorVerified: false
- The vendorRequestedChanges should say: "{today}: Discovered via OpenOnco Discovery Agent from {source}. Source: {source_url}"
"""

TEMPLATES = {
    "MRD": """{
  "id": "mrd-XX",
  "sampleCategory": "Blood/Plasma",
  "name": "",
  "vendor": "",
  "approach": "",
  "method": "",
  "methodCitations": "",
  "cancerTypes": [],
  "cancerTypesNotes": "",
  "sensitivity": null,
  "sensitivityCitations": "",
  "sensitivityNotes": "",
  "specificity": null,
  "specificityCitations": "",
  "specificityNotes": "",
  "lod": "",
  "lodCitations": "",
  "lodNotes": "",
  "requiresTumorTissue": "",
  "requiresMatchedNormal": "",
  "variantsTracked": "",
  "initialTat": null,
  "initialTatNotes": "",
  "followUpTat": null,
  "followUpTatNotes": "",
  "bloodVolume": null,
  "bloodVolumeNotes": "",
  "fdaStatus": "",
  "fdaStatusNotes": "",
  "reimbursement": "",
  "reimbursementNote": "",
  "clinicalAvailability": "",
  "clinicalTrials": "",
  "clinicalSettings": [],
  "numPublications": null,
  "numPublicationsCitations": "",
  "vendorVerified": false,
  "vendorRequestedChanges": ""
}""",
    "ECD": """{
  "id": "ecd-XX",
  "sampleCategory": "Blood/Plasma",
  "name": "",
  "vendor": "",
  "method": "",
  "methodCitations": "",
  "cancerTypes": [],
  "cancerTypesNotes": "",
  "sensitivity": null,
  "sensitivityCitations": "",
  "sensitivityNotes": "",
  "specificity": null,
  "specificityCitations": "",
  "specificityNotes": "",
  "ppv": null,
  "ppvCitations": "",
  "npv": null,
  "npvCitations": "",
  "fdaStatus": "",
  "fdaStatusNotes": "",
  "reimbursement": "",
  "reimbursementNote": "",
  "tat": null,
  "tatNotes": "",
  "clinicalAvailability": "",
  "clinicalTrials": "",
  "numPublications": null,
  "numPublicationsCitations": "",
  "vendorVerified": false,
  "vendorRequestedChanges": ""
}""",
    "TDS": """{
  "id": "tds-XX",
  "sampleCategory": "Blood/Plasma",
  "name": "",
  "vendor": "",
  "method": "",
  "methodCitations": "",
  "cancerTypes": [],
  "cancerTypesNotes": "",
  "genesAnalyzed": null,
  "genesAnalyzedNotes": "",
  "biomarkers": [],
  "fdaStatus": "",
  "fdaStatusNotes": "",
  "companionDiagnostic": false,
  "companionDiagnosticNotes": "",
  "reimbursement": "",
  "reimbursementNote": "",
  "tat": null,
  "tatNotes": "",
  "clinicalAvailability": "",
  "clinicalTrials": "",
  "numPublications": null,
  "numPublicationsCitations": "",
  "vendorVerified": false,
  "vendorRequestedChanges": ""
}""",
    "TRM": """{
  "id": "trm-XX",
  "sampleCategory": "Blood/Plasma",
  "name": "",
  "vendor": "",
  "method": "",
  "methodCitations": "",
  "cancerTypes": [],
  "cancerTypesNotes": "",
  "sensitivity": null,
  "sensitivityCitations": "",
  "sensitivityNotes": "",
  "specificity": null,
  "specificityCitations": "",
  "specificityNotes": "",
  "fdaStatus": "",
  "fdaStatusNotes": "",
  "reimbursement": "",
  "reimbursementNote": "",
  "tat": null,
  "tatNotes": "",
  "clinicalAvailability": "",
  "clinicalTrials": "",
  "numPublications": null,
  "numPublicationsCitations": "",
  "vendorVerified": false,
  "vendorRequestedChanges": ""
}"""
}

# Required fields per category (for "missing" flagging)
REQUIRED_FIELDS = {
    "MRD": ["name", "vendor", "sensitivity", "specificity", "lod", "fdaStatus"],
    "ECD": ["name", "vendor", "sensitivity", "specificity", "fdaStatus"],
    "TDS": ["name", "vendor", "genesAnalyzed", "fdaStatus"],
    "TRM": ["name", "vendor", "sensitivity", "specificity", "fdaStatus"],
}


class SubmissionDrafter:
    """Generates draft submissions for high-confidence candidates."""

    def __init__(self):
        self.client = Anthropic()
        self.model = CONFIG["claude"]["model"]

    def generate_draft(self, candidate: dict) -> dict | None:
        """Generate a draft submission for a candidate."""
        extracted = candidate.get("extracted", {})
        if not extracted:
            return None

        category = extracted.get("category", "MRD")
        template = TEMPLATES.get(category, TEMPLATES["MRD"])

        raw_data = json.dumps(candidate.get("raw_data", {}), indent=2)
        if len(raw_data) > 4000:
            raw_data = raw_data[:4000] + "\n... [truncated]"

        source_url = candidate.get("source_url", "")
        today = datetime.now().strftime("%Y-%m-%d")
        source = candidate.get("source", "unknown")

        prompt = DRAFT_PROMPT.format(
            extracted_json=json.dumps(extracted, indent=2),
            source_url=source_url,
            raw_data=raw_data,
            category=category,
            template=template,
            today=today,
            source=source,
        )

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=3000,
                messages=[{"role": "user", "content": prompt}],
            )

            content = response.content[0].text.strip()
            
            # Clean markdown if present
            if content.startswith("```"):
                lines = content.split("\n")
                content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
                content = content.strip()
            
            draft = json.loads(content)
            
            # Add metadata for email formatting
            draft["_category"] = category
            draft["_confidence"] = candidate.get("confidence", 0)
            draft["_source_url"] = source_url
            draft["_source"] = source
            
            # Check for missing required fields
            required = REQUIRED_FIELDS.get(category, [])
            missing = []
            for field in required:
                val = draft.get(field)
                if val is None or val == "" or val == []:
                    missing.append(field)
            draft["_missing_fields"] = missing
            
            return draft

        except json.JSONDecodeError as e:
            print(f"      Draft JSON parse error: {e}")
            return None
        except Exception as e:
            print(f"      Draft generation error: {e}")
            return None

    def generate_drafts(self, candidates: list[dict], min_confidence: float = 0.75) -> list[dict]:
        """Generate drafts for high-confidence, relevant candidates."""
        drafts = []
        
        eligible = [
            c for c in candidates
            if c.get("is_relevant", False) 
            and c.get("confidence", 0) >= min_confidence
            and c.get("extracted", {}).get("is_new_test", False)
            and not c.get("extracted", {}).get("is_existing_test_update", False)
        ]
        
        if not eligible:
            print("  No candidates eligible for draft generation")
            return drafts

        print(f"  Generating drafts for {len(eligible)} candidates...")
        
        for i, candidate in enumerate(eligible):
            name = candidate.get("extracted", {}).get("test_name", "Unknown")
            print(f"    [{i+1}/{len(eligible)}] Drafting: {name}...")
            
            draft = self.generate_draft(candidate)
            if draft:
                drafts.append(draft)
                candidate["draft_submission"] = draft

        return drafts
