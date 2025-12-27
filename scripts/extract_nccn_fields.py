#!/usr/bin/env python3
"""Extract NCCN-relevant fields from data.js for validation"""

import re
import json

# Read data.js
with open('src/data.js', 'r') as f:
    content = f.read()

# Extract all test objects
# Find the array contents between export const xxxTestData = [ ... ];
pattern = r'export const (\w+TestData) = (\[[\s\S]*?\]);'
matches = re.findall(pattern, content)

all_tests = []
for var_name, array_content in matches:
    # Parse the JavaScript array as JSON (close enough for our data)
    try:
        # Clean up JS-specific syntax
        cleaned = array_content
        cleaned = re.sub(r',(\s*[}\]])', r'\1', cleaned)  # Remove trailing commas
        tests = json.loads(cleaned)
        for test in tests:
            test['_source'] = var_name
        all_tests.extend(tests)
    except json.JSONDecodeError as e:
        print(f"Warning: Could not parse {var_name}: {e}")

# Extract only NCCN-relevant fields
nccn_fields = [
    'id', 'name', 'vendor',
    'nccnNamedInGuidelines', 'nccnGuidelineReference', 'nccnGuidelinesNotes',
    'vendorClaimsNCCNAlignment', 'vendorNCCNAlignmentCitation', 
    'vendorNCCNAlignmentIndications', 'vendorNCCNAlignmentNotes',
    '_source'
]

extracted = []
for test in all_tests:
    # Only include tests with any NCCN field
    has_nccn = any(k.startswith('nccn') or k.startswith('vendorNCCN') or k.startswith('vendor') and 'NCCN' in k for k in test.keys())
    if has_nccn or test.get('nccnNamedInGuidelines') or test.get('vendorClaimsNCCNAlignment'):
        record = {k: test.get(k) for k in nccn_fields if test.get(k) is not None}
        if len(record) > 3:  # Has more than just id, name, vendor
            extracted.append(record)

# Also grab tests that should probably have NCCN fields but don't
# (for completeness in validation)

# Output
output = {
    "extractedAt": "2025-12-26",
    "totalTestsInDb": len(all_tests),
    "testsWithNCCNFields": len(extracted),
    "nccnNamedCount": len([t for t in extracted if t.get('nccnNamedInGuidelines')]),
    "vendorClaimsCount": len([t for t in extracted if t.get('vendorClaimsNCCNAlignment')]),
    "tests": extracted
}

with open('prompts/NCCN_FIELDS_EXTRACT.json', 'w') as f:
    json.dump(output, f, indent=2)

print(f"Extracted {len(extracted)} tests with NCCN fields")
print(f"  - NCCN Named: {output['nccnNamedCount']}")
print(f"  - Vendor Claims: {output['vendorClaimsCount']}")
print(f"Output: prompts/NCCN_FIELDS_EXTRACT.json")
