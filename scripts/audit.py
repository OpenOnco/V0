#!/usr/bin/env python3
"""
OpenOnco Data Quality Audit Script
Analyzes data.js for quality issues, missing citations, and data staleness.

Usage:
    python3 scripts/audit.py [path/to/data.js]
    
If no path provided, uses default: /Users/adickinson/Documents/GitHub/V0/src/data.js
"""

import re
import json
import sys
from datetime import datetime, timedelta
from collections import defaultdict
from pathlib import Path

# Default path
DEFAULT_DATA_PATH = "/Users/adickinson/Documents/GitHub/V0/src/data.js"

# Fields that should have citations when populated
CITATION_REQUIRED_FIELDS = {
    'sensitivity': 'sensitivityCitations',
    'specificity': 'specificityCitations',
    'ppv': 'ppvCitations',
    'npv': 'npvCitations',
    'lod': 'lodCitations',
    'leadTimeDays': 'leadTimeDaysCitations',
}

# Required fields by category
REQUIRED_FIELDS = {
    'mrd': ['id', 'name', 'vendor', 'sampleCategory'],
    'ecd': ['id', 'name', 'vendor', 'sampleCategory'],
    'trm': ['id', 'name', 'vendor', 'sampleCategory'],
    'tds': ['id', 'name', 'vendor', 'sampleCategory'],
}

# Important fields that should be populated
IMPORTANT_FIELDS = {
    'mrd': ['sensitivity', 'specificity', 'lod', 'fdaStatus', 'numPublications'],
    'ecd': ['sensitivity', 'specificity', 'fdaStatus', 'numPublications'],
    'trm': ['sensitivity', 'specificity', 'fdaStatus', 'numPublications'],
    'tds': ['genesAnalyzed', 'fdaStatus', 'numPublications'],
}


class AuditFinding:
    """Represents a single audit finding."""
    
    def __init__(self, severity, category, test_id, test_name, vendor, message, field=None):
        self.severity = severity  # critical, high, medium, low
        self.category = category  # mrd, ecd, trm, tds
        self.test_id = test_id
        self.test_name = test_name
        self.vendor = vendor
        self.message = message
        self.field = field
    
    def __str__(self):
        return f"[{self.category.upper()}] {self.test_name} ({self.vendor}): {self.message}"


def extract_js_arrays(content):
    """Extract JavaScript arrays from data.js content."""
    tests = {
        'mrd': [],
        'ecd': [],
        'trm': [],
        'tds': []
    }
    
    # Pattern to find array exports
    patterns = {
        'mrd': r'export\s+const\s+mrdTestData\s*=\s*(\[[\s\S]*?\]);',
        'ecd': r'export\s+const\s+ecdTestData\s*=\s*(\[[\s\S]*?\]);',
        'trm': r'export\s+const\s+trmTestData\s*=\s*(\[[\s\S]*?\]);',
        'tds': r'export\s+const\s+tdsTestData\s*=\s*(\[[\s\S]*?\]);',
    }
    
    for category, pattern in patterns.items():
        match = re.search(pattern, content)
        if match:
            array_str = match.group(1)
            # Convert JS to valid JSON
            json_str = js_to_json(array_str)
            try:
                tests[category] = json.loads(json_str)
            except json.JSONDecodeError as e:
                print(f"Warning: Could not parse {category}TestData: {e}")
                # Try to extract individual objects
                tests[category] = extract_objects_fallback(array_str, category)
    
    return tests


def js_to_json(js_str):
    """Convert JavaScript object/array syntax to valid JSON."""
    # Remove single-line comments
    js_str = re.sub(r'//.*$', '', js_str, flags=re.MULTILINE)
    # Remove multi-line comments
    js_str = re.sub(r'/\*[\s\S]*?\*/', '', js_str)
    # Add quotes around unquoted keys
    js_str = re.sub(r'(\s*)(\w+)\s*:', r'\1"\2":', js_str)
    # Replace single quotes with double quotes (but not in text)
    # This is tricky - we'll handle common cases
    js_str = re.sub(r":\s*'([^']*)'", r': "\1"', js_str)
    # Remove trailing commas
    js_str = re.sub(r',(\s*[\]}])', r'\1', js_str)
    # Handle undefined and null
    js_str = re.sub(r':\s*undefined', ': null', js_str)
    
    return js_str


def extract_objects_fallback(array_str, category):
    """Fallback method to extract test objects when JSON parsing fails."""
    objects = []
    # Find all object blocks with id field
    pattern = r'\{\s*"id"\s*:\s*"' + category + r'-\d+[^}]*?\}'
    
    for match in re.finditer(pattern, array_str, re.DOTALL):
        try:
            obj_str = match.group(0)
            obj_str = js_to_json(obj_str)
            obj = json.loads(obj_str)
            objects.append(obj)
        except:
            continue
    
    return objects


def check_missing_citations(test, category):
    """Check for performance metrics without citations."""
    findings = []
    
    for metric_field, citation_field in CITATION_REQUIRED_FIELDS.items():
        value = test.get(metric_field)
        citation = test.get(citation_field, '')
        
        # If the metric has a value but no citation
        if value is not None and value != '' and value != 'N/A':
            if not citation or citation.strip() == '':
                # Check if there's a notes field with "vendor" or "per vendor"
                notes_field = f"{metric_field}Notes"
                notes = test.get(notes_field, '')
                
                severity = 'high'
                if isinstance(value, (int, float)):
                    if value == 100 or value == 0:
                        severity = 'critical'  # Perfect scores need citations
                
                findings.append(AuditFinding(
                    severity=severity,
                    category=category,
                    test_id=test.get('id', 'unknown'),
                    test_name=test.get('name', 'Unknown Test'),
                    vendor=test.get('vendor', 'Unknown'),
                    message=f"Missing citation for {metric_field} ({value})",
                    field=metric_field
                ))
    
    return findings


def check_perfect_scores(test, category):
    """Flag 100% sensitivity/specificity, especially with small cohorts."""
    findings = []
    
    for field in ['sensitivity', 'specificity']:
        value = test.get(field)
        if value == 100:
            cohort = test.get('validationCohortSize') or test.get('totalParticipants')
            has_warning = test.get('smallSampleWarning') or test.get('analyticalValidationWarning')
            
            if not has_warning:
                if cohort and cohort < 200:
                    findings.append(AuditFinding(
                        severity='critical',
                        category=category,
                        test_id=test.get('id', 'unknown'),
                        test_name=test.get('name', 'Unknown Test'),
                        vendor=test.get('vendor', 'Unknown'),
                        message=f"100% {field} with small cohort (n={cohort}) - needs smallSampleWarning flag",
                        field=field
                    ))
                else:
                    findings.append(AuditFinding(
                        severity='high',
                        category=category,
                        test_id=test.get('id', 'unknown'),
                        test_name=test.get('name', 'Unknown Test'),
                        vendor=test.get('vendor', 'Unknown'),
                        message=f"100% {field} - verify this is accurate and consider adding warning flag",
                        field=field
                    ))
    
    return findings


def check_required_fields(test, category):
    """Check for missing required fields."""
    findings = []
    required = REQUIRED_FIELDS.get(category, [])
    
    for field in required:
        value = test.get(field)
        if value is None or value == '':
            findings.append(AuditFinding(
                severity='critical',
                category=category,
                test_id=test.get('id', 'unknown'),
                test_name=test.get('name', 'Unknown Test'),
                vendor=test.get('vendor', 'Unknown'),
                message=f"Missing required field: {field}",
                field=field
            ))
    
    return findings


def check_important_fields(test, category):
    """Check for missing important (but not required) fields."""
    findings = []
    important = IMPORTANT_FIELDS.get(category, [])
    
    for field in important:
        value = test.get(field)
        if value is None or value == '':
            findings.append(AuditFinding(
                severity='medium',
                category=category,
                test_id=test.get('id', 'unknown'),
                test_name=test.get('name', 'Unknown Test'),
                vendor=test.get('vendor', 'Unknown'),
                message=f"Missing important field: {field}",
                field=field
            ))
    
    return findings


def check_vendor_verification(test, category):
    """Check vendor verification status."""
    findings = []
    
    verified = test.get('vendorVerified', False)
    
    if not verified:
        # Check if there's vendor contact info suggesting we could verify
        vendor_changes = test.get('vendorRequestedChanges', '')
        if vendor_changes and len(vendor_changes) > 20:
            findings.append(AuditFinding(
                severity='low',
                category=category,
                test_id=test.get('id', 'unknown'),
                test_name=test.get('name', 'Unknown Test'),
                vendor=test.get('vendor', 'Unknown'),
                message="Test has vendor interaction but not marked as verified",
                field='vendorVerified'
            ))
    
    return findings


def check_invalid_values(test, category):
    """Check for invalid field values."""
    findings = []
    
    # Sensitivity and specificity should be 0-100
    for field in ['sensitivity', 'specificity', 'ppv', 'npv']:
        value = test.get(field)
        if value is not None:
            if isinstance(value, (int, float)):
                if value < 0 or value > 100:
                    findings.append(AuditFinding(
                        severity='critical',
                        category=category,
                        test_id=test.get('id', 'unknown'),
                        test_name=test.get('name', 'Unknown Test'),
                        vendor=test.get('vendor', 'Unknown'),
                        message=f"Invalid {field} value: {value} (should be 0-100)",
                        field=field
                    ))
    
    # Check for empty arrays that should have content
    if category in ['mrd', 'ecd', 'trm']:
        cancer_types = test.get('cancerTypes', [])
        if not cancer_types or len(cancer_types) == 0:
            findings.append(AuditFinding(
                severity='medium',
                category=category,
                test_id=test.get('id', 'unknown'),
                test_name=test.get('name', 'Unknown Test'),
                vendor=test.get('vendor', 'Unknown'),
                message="Empty cancerTypes array",
                field='cancerTypes'
            ))
    
    return findings


def check_notes_quality(test, category):
    """Check if notes add value beyond just restating the number."""
    findings = []
    
    low_value_patterns = [
        r'^[\d.]+%?\s*(per|from|via)?\s*vendor\s*$',
        r'^Per vendor\s*$',
        r'^Vendor (data|reported|claims?)\.?\s*$',
        r'^N/A\.?\s*$',
        r'^-+\s*$',
    ]
    
    for field in ['sensitivityNotes', 'specificityNotes', 'lodNotes']:
        notes = test.get(field, '')
        if notes:
            for pattern in low_value_patterns:
                if re.match(pattern, notes, re.IGNORECASE):
                    findings.append(AuditFinding(
                        severity='low',
                        category=category,
                        test_id=test.get('id', 'unknown'),
                        test_name=test.get('name', 'Unknown Test'),
                        vendor=test.get('vendor', 'Unknown'),
                        message=f"{field} doesn't add value: '{notes}'",
                        field=field
                    ))
                    break
    
    return findings


def check_url_patterns(test, category):
    """Check for suspicious or obviously broken URLs."""
    findings = []
    
    url_fields = [
        'sensitivityCitations', 'specificityCitations', 'lodCitations',
        'ppvCitations', 'npvCitations', 'numPublicationsCitations',
        'methodCitations', 'clinicalTrialsCitations'
    ]
    
    suspicious_patterns = [
        r'example\.com',
        r'localhost',
        r'file://',
        r'^\s*http[s]?://\s*$',  # Just "http://" with no domain
    ]
    
    for field in url_fields:
        url = test.get(field, '')
        if url:
            for pattern in suspicious_patterns:
                if re.search(pattern, url, re.IGNORECASE):
                    findings.append(AuditFinding(
                        severity='high',
                        category=category,
                        test_id=test.get('id', 'unknown'),
                        test_name=test.get('name', 'Unknown Test'),
                        vendor=test.get('vendor', 'Unknown'),
                        message=f"Suspicious URL in {field}: '{url[:50]}...'",
                        field=field
                    ))
                    break
    
    return findings


def check_duplicate_ids(tests_by_category):
    """Check for duplicate test IDs across the database."""
    findings = []
    all_ids = {}
    
    for category, tests in tests_by_category.items():
        for test in tests:
            test_id = test.get('id', '')
            if test_id:
                if test_id in all_ids:
                    findings.append(AuditFinding(
                        severity='critical',
                        category=category,
                        test_id=test_id,
                        test_name=test.get('name', 'Unknown Test'),
                        vendor=test.get('vendor', 'Unknown'),
                        message=f"Duplicate ID: {test_id} (also in {all_ids[test_id]})",
                        field='id'
                    ))
                else:
                    all_ids[test_id] = category
    
    return findings


def run_audit(data_path):
    """Run the full audit and return findings."""
    print(f"📊 OpenOnco Data Audit")
    print(f"📁 Source: {data_path}")
    print(f"📅 Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)
    
    # Read the data file
    try:
        with open(data_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: File not found: {data_path}")
        sys.exit(1)
    
    # Extract test arrays
    tests_by_category = extract_js_arrays(content)
    
    # Count tests
    total_tests = sum(len(tests) for tests in tests_by_category.values())
    print(f"\n📈 Found {total_tests} tests across {len(tests_by_category)} categories")
    for cat, tests in tests_by_category.items():
        print(f"   {cat.upper()}: {len(tests)} tests")
    
    # Run all checks
    all_findings = []
    
    # Check for duplicate IDs first
    all_findings.extend(check_duplicate_ids(tests_by_category))
    
    for category, tests in tests_by_category.items():
        for test in tests:
            all_findings.extend(check_required_fields(test, category))
            all_findings.extend(check_missing_citations(test, category))
            all_findings.extend(check_perfect_scores(test, category))
            all_findings.extend(check_important_fields(test, category))
            all_findings.extend(check_invalid_values(test, category))
            all_findings.extend(check_vendor_verification(test, category))
            all_findings.extend(check_notes_quality(test, category))
            all_findings.extend(check_url_patterns(test, category))
    
    # Group findings by severity
    by_severity = defaultdict(list)
    for finding in all_findings:
        by_severity[finding.severity].append(finding)
    
    # Print results
    severity_order = ['critical', 'high', 'medium', 'low']
    severity_emoji = {
        'critical': '🔴',
        'high': '🟠',
        'medium': '🟡',
        'low': '🔵'
    }
    
    print("\n" + "=" * 60)
    print("AUDIT FINDINGS")
    print("=" * 60)
    
    for severity in severity_order:
        findings = by_severity.get(severity, [])
        if findings:
            print(f"\n{severity_emoji[severity]} {severity.upper()} ({len(findings)})")
            print("-" * 40)
            
            # Group by test for readability
            by_test = defaultdict(list)
            for f in findings:
                by_test[f"{f.test_id} - {f.test_name}"].append(f)
            
            for test_key, test_findings in by_test.items():
                print(f"\n  [{test_findings[0].category.upper()}] {test_key}")
                print(f"      Vendor: {test_findings[0].vendor}")
                for tf in test_findings:
                    print(f"      • {tf.message}")
    
    # Summary statistics
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    
    # Count vendor verified
    verified_count = 0
    total_citations = 0
    tests_with_citations = 0
    
    for category, tests in tests_by_category.items():
        for test in tests:
            if test.get('vendorVerified'):
                verified_count += 1
            # Count citation fields
            citation_count = 0
            for cf in CITATION_REQUIRED_FIELDS.values():
                if test.get(cf):
                    citation_count += 1
            if citation_count > 0:
                tests_with_citations += 1
                total_citations += citation_count
    
    print(f"\n  Total tests: {total_tests}")
    print(f"  Vendor verified: {verified_count} ({100*verified_count/total_tests:.1f}%)" if total_tests > 0 else "  Vendor verified: 0")
    print(f"  Tests with citations: {tests_with_citations} ({100*tests_with_citations/total_tests:.1f}%)" if total_tests > 0 else "  Tests with citations: 0")
    print(f"  Average citations per test: {total_citations/total_tests:.1f}" if total_tests > 0 else "  Average citations per test: 0")
    
    print(f"\n  Issues found:")
    for severity in severity_order:
        count = len(by_severity.get(severity, []))
        print(f"    {severity_emoji[severity]} {severity.capitalize()}: {count}")
    
    print(f"\n  Tests needing attention: {len(set(f.test_id for f in all_findings))}")
    
    return all_findings, tests_by_category


if __name__ == '__main__':
    # Get path from command line or use default
    if len(sys.argv) > 1:
        data_path = sys.argv[1]
    else:
        data_path = DEFAULT_DATA_PATH
    
    findings, tests = run_audit(data_path)
    
    # Exit with error code if critical issues found
    critical_count = len([f for f in findings if f.severity == 'critical'])
    if critical_count > 0:
        print(f"\n⚠️  {critical_count} critical issues require immediate attention!")
        sys.exit(1)
