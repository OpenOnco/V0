"""
Submission Draft Generator
Creates draft submissions following SUBMISSION_PROCESS.md format.
"""

from datetime import datetime


# Templates per category from data.js
MRD_TEMPLATE = {
    "id": None,  # Will be assigned
    "sampleCategory": "Blood/Plasma",
    "name": None,
    "vendor": None,
    "approach": None,  # "Tumor-informed" or "Tumor-naïve"
    "method": None,
    "methodCitations": None,
    "cancerTypes": [],
    "cancerTypesNotes": None,
    "indicationsNotes": None,
    "sensitivity": None,
    "sensitivityCitations": None,
    "sensitivityNotes": None,
    "specificity": None,
    "specificityPlus": False,
    "specificityCitations": None,
    "specificityNotes": None,
    "lod": None,
    "lodCitations": None,
    "lodNotes": None,
    "requiresTumorTissue": None,
    "requiresMatchedNormal": None,
    "variantsTracked": None,
    "initialTat": None,
    "initialTatNotes": None,
    "followUpTat": None,
    "followUpTatNotes": None,
    "bloodVolume": None,
    "bloodVolumeNotes": None,
    "fdaStatus": "CLIA LDT",
    "fdaStatusNotes": None,
    "reimbursement": "Coverage emerging",
    "reimbursementNote": None,
    "cptCodes": None,
    "clinicalAvailability": None,
    "clinicalTrials": None,
    "clinicalTrialsCitations": None,
    "clinicalSettings": [],
    "totalParticipants": None,
    "numPublications": None,
    "numPublicationsCitations": None,
    "vendorVerified": False,
    "vendorRequestedChanges": None,
}

ECD_TEMPLATE = {
    "id": None,
    "sampleCategory": "Blood/Plasma",
    "name": None,
    "vendor": None,
    "method": None,
    "methodCitations": None,
    "cancerTypes": [],
    "cancerTypesNotes": None,
    "sensitivity": None,
    "sensitivityCitations": None,
    "sensitivityNotes": None,
    "specificity": None,
    "specificityPlus": False,
    "specificityCitations": None,
    "specificityNotes": None,
    "ppv": None,
    "ppvCitations": None,
    "ppvNotes": None,
    "npv": None,
    "npvCitations": None,
    "npvNotes": None,
    "fdaStatus": "CLIA LDT",
    "fdaStatusNotes": None,
    "reimbursement": "Coverage emerging",
    "reimbursementNote": None,
    "tat": None,
    "tatNotes": None,
    "clinicalAvailability": None,
    "clinicalTrials": None,
    "clinicalTrialsCitations": None,
    "totalParticipants": None,
    "numPublications": None,
    "numPublicationsCitations": None,
    "vendorVerified": False,
    "vendorRequestedChanges": None,
}

TRM_TEMPLATE = {
    "id": None,
    "sampleCategory": "Blood/Plasma",
    "name": None,
    "vendor": None,
    "method": None,
    "methodCitations": None,
    "cancerTypes": [],
    "cancerTypesNotes": None,
    "sensitivity": None,
    "sensitivityCitations": None,
    "sensitivityNotes": None,
    "specificity": None,
    "specificityPlus": False,
    "specificityCitations": None,
    "specificityNotes": None,
    "fdaStatus": "CLIA LDT",
    "fdaStatusNotes": None,
    "reimbursement": "Coverage emerging",
    "reimbursementNote": None,
    "tat": None,
    "tatNotes": None,
    "clinicalAvailability": None,
    "clinicalTrials": None,
    "clinicalTrialsCitations": None,
    "totalParticipants": None,
    "numPublications": None,
    "numPublicationsCitations": None,
    "vendorVerified": False,
    "vendorRequestedChanges": None,
}

TDS_TEMPLATE = {
    "id": None,
    "sampleCategory": "Blood/Plasma",
    "name": None,
    "vendor": None,
    "method": None,
    "methodCitations": None,
    "cancerTypes": [],
    "cancerTypesNotes": None,
    "genesAnalyzed": None,
    "genesAnalyzedNotes": None,
    "biomarkers": [],
    "biomarkersNotes": None,
    "fdaStatus": "CLIA LDT",
    "fdaStatusNotes": None,
    "nccnNamedInGuidelines": False,
    "nccnNamedInGuidelinesNotes": None,
    "reimbursement": "Coverage emerging",
    "reimbursementNote": None,
    "tat": None,
    "tatNotes": None,
    "clinicalAvailability": None,
    "clinicalTrials": None,
    "clinicalTrialsCitations": None,
    "totalParticipants": None,
    "numPublications": None,
    "numPublicationsCitations": None,
    "vendorVerified": False,
    "vendorRequestedChanges": None,
}

TEMPLATES = {
    "MRD": MRD_TEMPLATE,
    "ECD": ECD_TEMPLATE,
    "TRM": TRM_TEMPLATE,
    "TDS": TDS_TEMPLATE,
}

FDA_STATUS_MAP = {
    "510(k) cleared": "FDA 510(k)",
    "pma approved": "FDA PMA",
    "fda approved": "FDA approved",
    "clia ldt": "CLIA LDT",
    "ce-ivd": "CE-IVD",
    "ruo": "RUO",
}


def generate_draft_submission(candidate: dict) -> dict | None:
    """
    Generate a draft submission from an enriched candidate.
    Returns None if candidate is not suitable for submission.
    """
    extracted = candidate.get("extracted", {})
    if not extracted:
        return None
    
    # Skip if not relevant or existing test
    if not extracted.get("is_relevant", True):
        return None
    if extracted.get("is_existing_test_update", False):
        return None
    if not extracted.get("is_new_test", False):
        return None
    
    category = extracted.get("category", "").upper()
    if category not in TEMPLATES:
        return None
    
    # Start with template
    draft = TEMPLATES[category].copy()
    
    # Fill in extracted data
    draft["name"] = extracted.get("test_name")
    draft["vendor"] = extracted.get("company")
    draft["method"] = extracted.get("methodology")
    draft["methodCitations"] = candidate.get("source_url")
    draft["cancerTypes"] = extracted.get("cancer_types", [])
    
    # Map FDA status
    fda_raw = (extracted.get("fda_status") or "").lower()
    for key, value in FDA_STATUS_MAP.items():
        if key in fda_raw:
            draft["fdaStatus"] = value
            break
    
    if extracted.get("clearance_date"):
        draft["fdaStatusNotes"] = f"Cleared/approved {extracted['clearance_date']}"
    
    # MRD-specific fields
    if category == "MRD":
        approach = extracted.get("approach", "")
        if "informed" in approach.lower():
            draft["approach"] = "Tumor-informed"
            draft["requiresTumorTissue"] = "Yes"
        elif "naive" in approach.lower() or "naïve" in approach.lower():
            draft["approach"] = "Tumor-naïve"
            draft["requiresTumorTissue"] = "No"
    
    # TDS-specific fields
    if category == "TDS":
        if biomarkers := extracted.get("biomarkers"):
            draft["biomarkers"] = biomarkers
    
    # Add discovery metadata
    today = datetime.now().strftime("%Y-%m-%d")
    draft["vendorRequestedChanges"] = f"{today}: Auto-discovered from {candidate['source']}. Source: {candidate['source_url']}. Needs verification."
    
    # Add notes about what's missing
    missing = []
    if category == "MRD":
        for field in ["sensitivity", "specificity", "lod", "initialTat", "followUpTat"]:
            if not draft.get(field):
                missing.append(field)
    elif category == "ECD":
        for field in ["sensitivity", "specificity"]:
            if not draft.get(field):
                missing.append(field)
    elif category in ["TRM", "TDS"]:
        for field in ["tat"]:
            if not draft.get(field):
                missing.append(field)
    
    draft["_missing_fields"] = missing
    draft["_source_url"] = candidate.get("source_url")
    draft["_discovery_notes"] = extracted.get("notes")
    draft["_confidence"] = candidate.get("confidence")
    draft["_category"] = category
    
    return draft


def format_draft_for_review(draft: dict) -> str:
    """Format a draft submission as readable text for email/review."""
    if not draft:
        return ""
    
    category = draft.get("_category", "Unknown")
    lines = [
        f"## Draft Submission: {draft.get('name', 'Unknown')}",
        f"**Category:** {category}",
        f"**Vendor:** {draft.get('vendor', 'Unknown')}",
        f"**Confidence:** {draft.get('_confidence', 0):.0%}",
        "",
        "### Extracted Fields",
        f"- Cancer types: {', '.join(draft.get('cancerTypes', [])) or 'Unknown'}",
        f"- Method: {draft.get('method', 'Unknown')}",
        f"- FDA status: {draft.get('fdaStatus', 'Unknown')}",
    ]
    
    if draft.get("approach"):
        lines.append(f"- Approach: {draft.get('approach')}")
    
    if draft.get("biomarkers"):
        lines.append(f"- Biomarkers: {', '.join(draft.get('biomarkers', []))}")
    
    lines.extend([
        "",
        f"**Source:** {draft.get('_source_url', 'Unknown')}",
    ])
    
    if draft.get("_discovery_notes"):
        lines.append(f"**Notes:** {draft.get('_discovery_notes')}")
    
    if draft.get("_missing_fields"):
        lines.extend([
            "",
            "### ⚠️ Missing Required Fields",
            "These fields need to be filled before submission:",
            ", ".join(draft.get("_missing_fields", [])),
        ])
    
    lines.extend([
        "",
        "### Raw Template (copy to data.js after verification)",
        "```javascript",
    ])
    
    # Output clean template without internal fields
    clean_draft = {k: v for k, v in draft.items() if not k.startswith("_")}
    
    import json
    lines.append(json.dumps(clean_draft, indent=2))
    lines.append("```")
    
    return "\n".join(lines)


def generate_all_drafts(candidates: list[dict]) -> list[dict]:
    """Generate draft submissions for all suitable candidates."""
    drafts = []
    for candidate in candidates:
        if candidate.get("confidence", 0) >= 0.75 and candidate.get("is_relevant", True):
            draft = generate_draft_submission(candidate)
            if draft:
                drafts.append(draft)
    return drafts
