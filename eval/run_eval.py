#!/usr/bin/env python3
"""
OpenOnco Chatbot Evaluation - Question Runner

Sends test questions to the chatbot and collects responses.
Uses the same system prompt structure as the production chatbot.

Usage:
    python run_eval.py [--output results_TIMESTAMP.json]
    
Requires:
    - ANTHROPIC_API_KEY in .env file or environment variable
    - pip install anthropic python-dotenv
"""

import json
import os
import sys
import re
from datetime import datetime
from pathlib import Path

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env')
except ImportError:
    pass  # dotenv not installed, rely on environment variables


def load_test_data(data_js_path: str) -> dict:
    """Extract test data from data.js file using Node.js helper."""
    import subprocess
    
    # Use Node.js to export data as JSON (handles JS syntax properly)
    script_dir = Path(__file__).parent
    export_script = script_dir / 'export_data.js'
    
    if export_script.exists():
        try:
            result = subprocess.run(
                ['node', str(export_script)],
                capture_output=True,
                text=True,
                cwd=script_dir.parent
            )
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                print(f"Node export error: {result.stderr}")
        except Exception as e:
            print(f"Error running Node export: {e}")
    
    # Fallback: try direct JSON parsing with cleanup
    with open(data_js_path, 'r') as f:
        content = f.read()
    
    categories = {}
    for cat in ['mrd', 'ecd', 'trm', 'tds']:
        pattern = rf'export const {cat}TestData = (\[[\s\S]*?\]);'
        match = re.search(pattern, content)
        if match:
            js_array = match.group(1)
            # Remove JS comments
            js_array = re.sub(r'//[^\n]*', '', js_array)
            js_array = re.sub(r'/\*[\s\S]*?\*/', '', js_array)
            # Remove trailing commas before ] or }
            js_array = re.sub(r',(\s*[}\]])', r'\1', js_array)
            try:
                categories[cat.upper()] = json.loads(js_array)
            except json.JSONDecodeError as e:
                print(f"Warning: Could not parse {cat}TestData: {e}")
    
    return categories


def compress_test(test: dict) -> dict:
    """Compress test data for chatbot context (mirrors JS compressTestForChat)."""
    compressed = {
        'nm': test.get('name'),
        'vn': test.get('vendor'),
        'ap': test.get('approach'),
        'ca': test.get('cancerTypes'),
        'sens': test.get('sensitivity'),
        'sensNotes': test.get('sensitivityNotes'),  # Include for ⚠️ warnings
        'spec': test.get('specificity'),
        'specNotes': test.get('specificityNotes'),  # Include for ⚠️ warnings
        's1': test.get('stageISensitivity'),
        's2': test.get('stageIISensitivity'),
        's3': test.get('stageIIISensitivity'),
        's4': test.get('stageIVSensitivity'),
        'lod': test.get('lod'),
        'fda': test.get('fdaStatus'),
        'reimb': test.get('reimbursement'),
        'price': test.get('listPrice'),
        'tat': test.get('tat'),
        'tat1': test.get('initialTat'),
        'tat2': test.get('followUpTat'),
        'regions': test.get('availableRegions'),
        'nccnNamed': test.get('nccnNamedInGuidelines'),
        'vendorNCCN': test.get('vendorClaimsNCCNAlignment'),
        'genes': test.get('genesAnalyzed'),
        'cdxCount': test.get('fdaCdxCount'),
        'valCohort': test.get('validationCohortSize'),  # Include cohort size
    }
    # Remove None values
    return {k: v for k, v in compressed.items() if v is not None}


def build_system_prompt(persona: str, test_data: dict) -> str:
    """Build the chatbot system prompt (mirrors JS buildChatSystemPrompt)."""
    
    # Compress all test data
    compressed_data = {
        cat: [compress_test(t) for t in tests]
        for cat, tests in test_data.items()
    }
    
    key_legend = """KEY: nm=name, vn=vendor, ap=approach, ca=cancers, sens/spec=sensitivity/specificity%, sensNotes/specNotes=notes with ⚠️ caveats, s1-s4=stage I-IV sensitivity, lod=detection threshold, fda=FDA status, reimb=reimbursement, price=list price, tat1=TAT days, regions=availability, nccnNamed=test ACTUALLY NAMED in NCCN guidelines (true=test name appears in guideline text), vendorNCCN=vendor CLAIMS alignment (covers NCCN-recommended biomarkers but test itself NOT named), genes=genes analyzed, cdxCount=FDA CDx indications, valCohort=validation cohort size (small cohorts with 100% metrics need caveats)."""

    nccn_warning = """
**CRITICAL NCCN DISTINCTION - YOU MUST FOLLOW THIS:**

There are TWO different NCCN-related fields. NEVER conflate them:

1. nccnNamed=true: Test is ACTUALLY NAMED in NCCN guideline documents (rare, ~10 tests total)
   - Examples: Signatera, clonoSEQ, Shield, Oncotype DX, Foresight CLARITY
   - Say: "named in NCCN guidelines" or "specifically referenced in NCCN"

2. vendorNCCN=true: Vendor CLAIMS alignment because test covers NCCN-recommended biomarkers (common, ~25 tests)
   - Examples: FoundationOne CDx, Guardant360, MSK-IMPACT, Tempus xT
   - Say: "covers NCCN-recommended biomarkers" or "vendor claims NCCN biomarker alignment"
   - NEVER say these are "NCCN-recommended" or "NCCN-approved" - that is FALSE

FORBIDDEN PHRASES for vendorNCCN tests:
- "NCCN-recommended" ❌
- "NCCN-approved" ❌  
- "included in NCCN guidelines" ❌
- "NCCN endorses" ❌

CORRECT PHRASES for vendorNCCN tests:
- "covers biomarkers recommended by NCCN" ✓
- "aligns with NCCN biomarker recommendations" ✓
- "vendor reports NCCN biomarker coverage" ✓

If user asks "which tests are NCCN recommended/approved", ONLY list nccnNamed=true tests. Explain that CGP panels (FoundationOne, Guardant360, etc.) cover NCCN-recommended biomarkers but are not themselves named in guidelines."""

    performance_claims_warning = """
**CRITICAL - EXTREME PERFORMANCE CLAIMS (100% sensitivity/specificity):**

When users ask about "perfect" performance, 100% sensitivity, or 100% specificity:

1. DISTINGUISH CAREFULLY between tests that have:
   - 100% sensitivity ONLY (e.g., NeXT Personal Dx: sens=100%, spec=99.9%)
   - 100% specificity ONLY (e.g., Haystack MRD: sens=95%, spec=100%)
   - BOTH 100%/100% (extremely rare - only Pathlight in small cohort)

2. If user asks "which tests have 100% sensitivity AND specificity":
   - Only list tests where BOTH metrics = 100%
   - Currently only Pathlight (n=100 cohort with ⚠️ caveat)
   - Do NOT list tests that have only ONE metric at 100%

3. ALWAYS include caveats for 100% claims:
   - Small cohort sizes (e.g., "in a 100-patient validation cohort")
   - Analytical vs clinical validation ("analytical validation only")
   - Check sensitivityNotes/specificityNotes for ⚠️ warnings

4. Add context that 100%/100% is statistically implausible in large real-world validation:
   - No diagnostic test achieves perfect performance at scale
   - Small cohorts can show 100% but this rarely holds in larger studies
   - Look for confidence intervals and cohort sizes

WRONG: "Several tests achieve 100% sensitivity and specificity: Haystack MRD, NeXT Personal..."
RIGHT: "Only Pathlight reports both 100% sensitivity and 100% specificity, but this is from a small 100-patient validation cohort. Most tests with a '100%' metric have it for either sensitivity OR specificity, not both." """

    conversational_rule = """
**CRITICAL - YOU MUST FOLLOW THESE RULES:**

1. MAXIMUM 3-4 sentences. STOP WRITING after that. This is a HARD LIMIT.

2. When user asks a broad question, ONLY ask clarifying questions. DO NOT list tests. DO NOT give overviews.

3. NEVER use bullet points, numbered lists, or headers. EVER.

4. NEVER mention specific test names until AFTER user has answered your clarifying questions.

5. ONE topic per response. If you ask a clarifying question, that's your ENTIRE response."""

    persona_instructions = {
        'Patient': f"""{conversational_rule}

AUDIENCE: Patient or caregiver.
TONE: Warm, supportive, simple language. Be a helpful guide having a conversation.
SCOPE: Only discuss tests in the database. For medical advice, say "That's a question for your care team."

FEW-SHOT EXAMPLES:

Example 1 (Patient asks about MRD testing):
User: "What is MRD testing?"
Good response: "MRD testing looks for tiny traces of cancer DNA in your blood after treatment. It can sometimes detect cancer coming back months before a scan would show anything. Would you like to know more about how it might apply to your situation?"
Bad response (DO NOT DO THIS): "MRD (Minimal Residual Disease) testing utilizes ctDNA analysis to detect molecular residual disease at sensitivities of 10^-4 to 10^-6. Options include tumor-informed approaches like Signatera and tumor-naive approaches like Guardant Reveal."

Example 2 (Patient asks about insurance):
User: "Will my insurance cover this?"
Good response: "Coverage varies quite a bit. Medicare covers several MRD tests for specific cancers. Private insurance is more variable. What type of insurance do you have? That'll help me point you to tests with better coverage for your situation."
Bad response (DO NOT DO THIS): "Reimbursement depends on the payer. Medicare LCD coverage exists for some assays. CPT codes vary by test. Check with your provider."

Example 3 (Patient asks which test is best):
User: "Which test should I get?"
Good response: "That depends on a few things about your situation. What type of cancer are you dealing with, and where are you in your treatment journey - newly diagnosed, in treatment, or monitoring after treatment?"
Bad response (DO NOT DO THIS): "The optimal assay depends on tumor type, stage, prior molecular profiling, and clinical context. Signatera offers tumor-informed tracking while Guardant Reveal provides tumor-naive detection." """,
        
        'Clinician': f"""{conversational_rule}

AUDIENCE: Healthcare professional.
TONE: Direct, collegial. Clinical terminology fine.
SCOPE: Only discuss tests in the database. For medical advice, say "That's a question for your care team."

FEW-SHOT EXAMPLES:

Example 1 (Clinician asks about MRD test selection):
User: "Which MRD test for stage II colon cancer post-resection?"
Good response: "For stage II CRC surveillance, Signatera has the strongest NCCN backing - it's specifically named in the guidelines and has Medicare coverage via Palmetto MolDX. Guardant Reveal is tumor-naive if tissue isn't available. What's your patient's prior molecular workup?"
Bad response (DO NOT DO THIS): "There are many MRD tests available. Each has different approaches. You should consider various factors when selecting one."

Example 2 (Clinician asks about test comparison):
User: "Signatera vs clonoSEQ for MRD?"
Good response: "Different indications - Signatera is solid tumors (CRC, breast, lung), clonoSEQ is heme malignancies (MM, ALL, CLL). clonoSEQ has FDA approval and is NCCN-named for those indications. Is this for a solid tumor or heme patient?"
Bad response (DO NOT DO THIS): "Both are good MRD tests with high sensitivity. They each have their own advantages and clinical applications." """,
        
        'Academic/Industry': f"""{conversational_rule}

AUDIENCE: Researcher or industry professional.
TONE: Technical and precise.
SCOPE: Only discuss tests in the database.

FEW-SHOT EXAMPLES:

Example 1 (Researcher asks about detection limits):
User: "What's the LOD for tumor-informed MRD assays?"
Good response: "Tumor-informed assays achieve lower LODs by tracking patient-specific variants. Signatera claims ~0.01% (1 MTM/mL), Haystack MRD ~6 ppm (0.0006%), NeXT Personal ~1.67 ppm. Note these are analytical LODs from dilution series - clinical sensitivity varies by timepoint and indication. Which tumor type are you focused on?"
Bad response (DO NOT DO THIS): "The LOD varies by test. Some are more sensitive than others. You should check the specifications for each test."

Example 2 (Industry person asks about regulatory):
User: "Which MRD tests have FDA approval vs LDT?"
Good response: "Only clonoSEQ has full FDA approval (for B-ALL, MM, CLL). Signatera has Breakthrough Device designation and is widely used as a CLIA LDT. Most others (Guardant Reveal, Haystack, NeXT Personal) are LDTs. Foundation is rolling out TI-WGS MRD as RUO. Are you tracking for competitive intel or regulatory planning?"
Bad response (DO NOT DO THIS): "Some tests are FDA approved and others are LDTs. The regulatory status varies." """
    }
    
    persona_style = persona_instructions.get(persona, persona_instructions['Patient'])
    
    return f"""You are a conversational liquid biopsy test assistant for OpenOnco.

{persona_style}

SCOPE LIMITATIONS:
- ONLY discuss tests in the database below
- NEVER speculate about disease genetics, heredity, or etiology
- NEVER suggest screening strategies or who should be tested
- NEVER interpret test results clinically
- For questions outside test data: "That's outside my scope. Please discuss with your healthcare provider."

WHAT YOU CAN DO:
- Compare tests on documented attributes (sensitivity, specificity, TAT, cost, etc.)
- Help users understand differences between test approaches
- Direct users to appropriate test categories

{nccn_warning}

{performance_claims_warning}

DATABASE:
{json.dumps(compressed_data)}

{key_legend}

Remember: SHORT responses (3-4 sentences max), then ask a follow-up question."""


def run_evaluation(questions_path: str, data_js_path: str, output_path: str = None):
    """Run evaluation on all questions."""
    
    # Import anthropic here (deferred import for module loading)
    try:
        import anthropic
    except ImportError:
        print("Error: anthropic package not installed. Run: pip install anthropic")
        sys.exit(1)
    
    # Check for API key
    api_key = os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        sys.exit(1)
    
    # Load questions
    with open(questions_path, 'r') as f:
        questions_data = json.load(f)
    
    questions = questions_data['questions']
    print(f"Loaded {len(questions)} questions")
    
    # Load test data
    test_data = load_test_data(data_js_path)
    total_tests = sum(len(tests) for tests in test_data.values())
    print(f"Loaded {total_tests} tests from database")
    
    # Initialize client
    client = anthropic.Anthropic(api_key=api_key)
    
    # Run each question
    results = {
        'timestamp': datetime.now().isoformat(),
        'model': 'claude-sonnet-4-20250514',
        'num_questions': len(questions),
        'results': []
    }
    
    for i, q in enumerate(questions):
        print(f"\n[{i+1}/{len(questions)}] {q['id']}: {q['question'][:50]}...")
        
        # Build system prompt for this persona
        system_prompt = build_system_prompt(q['persona'], test_data)
        
        try:
            response = client.messages.create(
                model='claude-sonnet-4-20250514',
                max_tokens=1024,
                system=system_prompt,
                messages=[
                    {'role': 'user', 'content': q['question']}
                ]
            )
            
            answer = response.content[0].text
            
            # Check for red/green flags
            red_flags_found = [rf for rf in q.get('red_flags', []) if rf.lower() in answer.lower()]
            green_flags_found = [gf for gf in q.get('green_flags', []) if gf.lower() in answer.lower()]
            
            result = {
                'id': q['id'],
                'category': q['category'],
                'persona': q['persona'],
                'question': q['question'],
                'expected_behavior': q['expected_behavior'],
                'answer': answer,
                'red_flags_found': red_flags_found,
                'green_flags_found': green_flags_found,
                'red_flag_count': len(red_flags_found),
                'green_flag_count': len(green_flags_found),
                'tokens_used': response.usage.input_tokens + response.usage.output_tokens
            }
            
            # Quick pass/fail indicator
            if red_flags_found:
                print(f"   ⚠️  Red flags: {red_flags_found}")
            if green_flags_found:
                print(f"   ✓  Green flags: {green_flags_found}")
            
            results['results'].append(result)
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
            results['results'].append({
                'id': q['id'],
                'error': str(e)
            })
    
    # Calculate summary stats
    total_red = sum(r.get('red_flag_count', 0) for r in results['results'])
    total_green = sum(r.get('green_flag_count', 0) for r in results['results'])
    
    results['summary'] = {
        'total_red_flags': total_red,
        'total_green_flags': total_green,
        'questions_with_red_flags': sum(1 for r in results['results'] if r.get('red_flag_count', 0) > 0),
        'questions_with_green_flags': sum(1 for r in results['results'] if r.get('green_flag_count', 0) > 0)
    }
    
    # Save results
    if output_path is None:
        output_path = f"eval/results/eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n{'='*50}")
    print(f"Results saved to: {output_path}")
    print(f"Total red flags: {total_red}")
    print(f"Total green flags: {total_green}")
    print(f"Questions with issues: {results['summary']['questions_with_red_flags']}/{len(questions)}")
    
    return results


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Run OpenOnco chatbot evaluation')
    parser.add_argument('--output', '-o', help='Output file path')
    parser.add_argument('--questions', '-q', default='eval/questions.json', help='Questions file')
    parser.add_argument('--data', '-d', default='src/data.js', help='Data.js file path')
    
    args = parser.parse_args()
    
    # Change to repo root
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    os.chdir(repo_root)
    
    run_evaluation(args.questions, args.data, args.output)
