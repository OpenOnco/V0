#!/usr/bin/env python3
"""
NCCN Schema Transformation Script

OLD SCHEMA:
- nccnRecommended, nccnAlignmentType, nccnGuidelinesAligned, nccnGuidelinesNotes, nccnGuidelines

NEW SCHEMA:
For tests NAMED in NCCN guidelines:
- nccnNamedInGuidelines: true
- nccnGuidelineReference: "..."
- nccnGuidelinesNotes: "..."

For vendor claims (not actual NCCN endorsement):
- vendorClaimsNCCNAlignment: true
- vendorNCCNAlignmentCitation: "https://..."
- vendorNCCNAlignmentNotes: "..."
"""

import re

# Tests actually named in NCCN guidelines (verified)
NCCN_NAMED_TESTS = {
    "Foresight CLARITY Lymphoma": {
        "nccnGuidelineReference": "NCCN B-Cell Lymphomas V.2.2025 (Dec 2024)",
        "nccnGuidelinesNotes": "First ctDNA-MRD test named in NCCN Guidelines. Recommended to adjudicate PET-positive results at end of frontline DLBCL therapy (assay LOD <1ppm required)."
    },
    "clonoSEQ": {
        "nccnGuidelineReference": "NCCN Multiple Myeloma, ALL, CLL Guidelines", 
        "nccnGuidelinesNotes": "NCCN Category 2A recommendation. NGS-based MRD assessment specifically named for MM (at each treatment stage), ALL, and CLL."
    },
    "Oncotype DX Breast Recurrence Score": {
        "nccnGuidelineReference": "NCCN Breast Cancer Guidelines",
        "nccnGuidelinesNotes": "NCCN-preferred multigene assay with Category 1 evidence. Only test with Level 1 evidence for both prognosis AND prediction of chemotherapy benefit for HR+, HER2- breast cancer."
    },
    "Signatera": {
        "nccnGuidelineReference": "NCCN Colorectal Cancer Guidelines",
        "nccnGuidelinesNotes": "Category 2A recommendation for ctDNA testing to assess recurrence risk post-resection in colorectal cancer."
    },
    "Signatera Genome": {
        "nccnGuidelineReference": "NCCN Colorectal Cancer, Breast Cancer Guidelines",
        "nccnGuidelinesNotes": "Same NCCN recommendations as standard Signatera for MRD-guided care."
    },
    "Signatera (IO Monitoring)": {
        "nccnGuidelineReference": "NCCN Colorectal Cancer, Breast Cancer Guidelines",
        "nccnGuidelinesNotes": "Same NCCN recommendations as standard Signatera for MRD-guided care."
    },
    "IsoPSA": {
        "nccnGuidelineReference": "NCCN Prostate Cancer Early Detection Guidelines V.1.2025",
        "nccnGuidelinesNotes": "Specifically named for use prior to biopsy and in patients with prior negative biopsy at higher risk for clinically significant prostate cancer."
    }
}

# Vendor citation mapping for tests claiming biomarker coverage
VENDOR_CITATIONS = {
    "FoundationOne CDx": "https://www.foundationmedicine.com/test/foundationone-cdx",
    "FoundationOne Liquid CDx": "https://www.foundationmedicine.com/test/foundationone-liquid-cdx",
    "FoundationOne Heme": "https://www.foundationmedicine.com/test/foundationone-heme",
    "Guardant360 CDx": "https://guardanthealth.com/guardant360-cdx/",
    "Guardant360 Liquid": "https://guardanthealth.com/guardant360/",
    "Tempus xT CDx": "https://www.tempus.com/oncology/genomic-profiling/xt/",
    "Tempus xF": "https://www.tempus.com/oncology/genomic-profiling/xf/",
    "Tempus xF+": "https://www.tempus.com/oncology/genomic-profiling/xf-plus/",
    "MSK-IMPACT": "https://www.mskcc.org/msk-impact",
    "MI Cancer Seek": "https://www.molecularmd.com/",
    "OncoExTra": "https://www.oncoextra.com/",
    "OmniSeq INSIGHT": "https://www.omniseq.com/",
    "StrataNGS": "https://www.stratangs.com/",
    "MI Profile": "https://www.molecularmd.com/",
    "NEO PanTracer Tissue": "https://neotrex.com/",
    "Northstar Select": "https://www.biodesix.com/",
    "Liquid Trace Solid Tumor": "https://imagenedx.com/",
    "Liquid Trace Hematology": "https://imagenedx.com/",
    "LiquidHALLMARK": "https://www.luminexcorp.com/",
    "Resolution ctDx FIRST": "https://resolutionbio.com/",
    "CancerDetect": "https://www.cancerdetect.com/",
    "LymphoVista": "https://lymphovista.com/",
}

def transform_nccn_fields(content):
    """Transform old NCCN schema to new schema"""
    
    # Process each test block
    # Strategy: Find test blocks and transform their NCCN fields
    
    lines = content.split('\n')
    result = []
    current_test_name = None
    skip_next_nccn_fields = False
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Track current test name
        name_match = re.match(r'\s*"name":\s*"([^"]+)"', line)
        if name_match:
            current_test_name = name_match.group(1)
        
        # Handle nccnGuidelines: true (old Foresight format)
        if '"nccnGuidelines": true' in line:
            # Replace with new schema
            result.append(line.replace('"nccnGuidelines": true', '"nccnNamedInGuidelines": true'))
            i += 1
            continue
        
        # Handle nccnRecommended field
        if '"nccnRecommended":' in line:
            is_named = current_test_name in NCCN_NAMED_TESTS
            
            if is_named:
                # Test is actually named in NCCN - use new schema
                info = NCCN_NAMED_TESTS[current_test_name]
                indent = len(line) - len(line.lstrip())
                spaces = ' ' * indent
                
                result.append(f'{spaces}"nccnNamedInGuidelines": true,')
                result.append(f'{spaces}"nccnGuidelineReference": "{info["nccnGuidelineReference"]}",')
                # Don't add nccnGuidelinesNotes here - let the existing one through
                
                # Skip the old nccnRecommended line
                i += 1
                continue
            else:
                # Vendor claims alignment - transform
                vendor_url = VENDOR_CITATIONS.get(current_test_name, "")
                indent = len(line) - len(line.lstrip())
                spaces = ' ' * indent
                
                result.append(f'{spaces}"vendorClaimsNCCNAlignment": true,')
                if vendor_url:
                    result.append(f'{spaces}"vendorNCCNAlignmentCitation": "{vendor_url}",')
                
                i += 1
                continue
        
        # Skip nccnAlignmentType (no longer needed)
        if '"nccnAlignmentType":' in line:
            i += 1
            continue
        
        # Transform nccnGuidelinesAligned to vendorNCCNAlignmentIndications
        if '"nccnGuidelinesAligned":' in line:
            is_named = current_test_name in NCCN_NAMED_TESTS
            if not is_named:
                # For vendor claims, rename field
                result.append(line.replace('"nccnGuidelinesAligned":', '"vendorNCCNAlignmentIndications":'))
            else:
                # For actually named tests, skip this field
                pass
            i += 1
            continue
        
        # Transform nccnGuidelinesNotes
        if '"nccnGuidelinesNotes":' in line:
            is_named = current_test_name in NCCN_NAMED_TESTS
            if not is_named:
                # For vendor claims, rename to vendorNCCNAlignmentNotes
                result.append(line.replace('"nccnGuidelinesNotes":', '"vendorNCCNAlignmentNotes":'))
            else:
                # For named tests, keep as is (or use our better version)
                info = NCCN_NAMED_TESTS.get(current_test_name, {})
                if info.get("nccnGuidelinesNotes"):
                    indent = len(line) - len(line.lstrip())
                    spaces = ' ' * indent
                    notes = info["nccnGuidelinesNotes"]
                    result.append(f'{spaces}"nccnGuidelinesNotes": "{notes}",')
                else:
                    result.append(line)
            i += 1
            continue
        
        # Skip nccnGuidelinesCitations for vendor claims (keep for named tests)
        if '"nccnGuidelinesCitations":' in line:
            is_named = current_test_name in NCCN_NAMED_TESTS
            if not is_named:
                i += 1
                continue
        
        # Keep all other lines
        result.append(line)
        i += 1
    
    return '\n'.join(result)

# Read file
with open('/Users/adickinson/Documents/GitHub/V0/src/data.js', 'r') as f:
    content = f.read()

# Transform
new_content = transform_nccn_fields(content)

# Write back
with open('/Users/adickinson/Documents/GitHub/V0/src/data.js', 'w') as f:
    f.write(new_content)

print("NCCN schema transformation complete!")
print("\nNew schema:")
print("- nccnNamedInGuidelines: true (for tests actually named in NCCN)")
print("- nccnGuidelineReference: specific guideline citation")
print("- vendorClaimsNCCNAlignment: true (for biomarker coverage claims)")
print("- vendorNCCNAlignmentCitation: vendor webpage URL")
print("- vendorNCCNAlignmentIndications: cancer types vendor claims coverage for")
print("- vendorNCCNAlignmentNotes: vendor's claim text")
