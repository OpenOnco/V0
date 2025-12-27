#!/bin/bash
# Extract NCCN fields from data.js

echo '{'
echo '  "extractedAt": "2025-12-26",'
echo '  "description": "NCCN-related fields extracted from OpenOnco data.js for validation",'
echo '  "tests": ['

# Get all tests with nccnNamedInGuidelines
echo '    {"_section": "NCCN_NAMED_TESTS"},'
grep -B 70 '"nccnNamedInGuidelines": true' src/data.js | \
  grep -E '"(id|name|vendor|nccnNamedInGuidelines|nccnGuidelineReference|nccnGuidelinesNotes)"' | \
  while read line; do
    echo "    $line"
  done

echo '    {"_section": "VENDOR_CLAIMS_TESTS"},'
# Get all tests with vendorClaimsNCCNAlignment
grep -B 70 '"vendorClaimsNCCNAlignment": true' src/data.js | \
  grep -E '"(id|name|vendor|vendorClaimsNCCNAlignment|vendorNCCNAlignmentCitation|vendorNCCNAlignmentIndications|vendorNCCNAlignmentNotes)"' | \
  while read line; do
    echo "    $line"
  done

echo '  ]'
echo '}'
