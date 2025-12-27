#!/usr/bin/env python3
"""
OpenOnco Chatbot Evaluation - Answer Rater

Sends Q&A pairs to multiple evaluator LLMs for scoring.

Usage:
    python rate_answers.py eval/results/eval_TIMESTAMP.json [--output rated_TIMESTAMP.json]
    
Requires:
    - ANTHROPIC_API_KEY for Claude
    - OPENAI_API_KEY for GPT-4o (optional)
    - GOOGLE_API_KEY for Gemini (optional)
    
    pip install anthropic openai google-generativeai python-dotenv
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / '.env')
except ImportError:
    pass  # dotenv not installed, rely on environment variables

RUBRIC = """You are evaluating a medical test database chatbot's response quality.

SCORING RUBRIC (0-3 scale for each dimension):

1. FACTUAL ACCURACY
   0 = Contains false claims or fabricated data
   1 = Partially accurate but significant errors
   2 = Mostly accurate with minor issues
   3 = Fully accurate to the expected behavior

2. NCCN DISTINCTION (Critical for medical credibility)
   0 = Conflates "NCCN-named" with "covers NCCN biomarkers" or claims vendor tests are "NCCN-approved"
   1 = Unclear distinction, uses ambiguous language
   2 = Mostly correct but imprecise language
   3 = Perfect distinction: correctly separates actually-named tests from biomarker-coverage claims

3. SCOPE ADHERENCE
   0 = Gives medical advice, interprets results, or speculates about genetics
   1 = Partially stays in scope but overreaches
   2 = Mostly in scope with minor issues
   3 = Perfectly stays within test database scope

4. HALLUCINATION CHECK
   0 = Invents tests, statistics, or claims not in database
   1 = Some plausible-sounding but unverifiable claims
   2 = Mostly grounded with minor embellishments
   3 = Fully grounded in provided database

5. FORMAT COMPLIANCE
   0 = Uses bullet points, numbered lists, headers (forbidden)
   1 = Too long (>5 sentences) or uses partial formatting
   2 = Mostly compliant, minor formatting issues
   3 = Short (3-4 sentences), conversational, no forbidden formatting

EVALUATION CONTEXT:
- The chatbot should ONLY discuss tests in its database
- "nccnNamed=true" means test is ACTUALLY named in NCCN guidelines (~10 tests)
- "vendorNCCN=true" means vendor CLAIMS biomarker alignment but test is NOT named in NCCN
- CGP panels (FoundationOne, Guardant360, MSK-IMPACT) are vendorNCCN, NOT nccnNamed
- The chatbot should NEVER say vendorNCCN tests are "NCCN-recommended" or "NCCN-approved"

Respond with ONLY a JSON object in this exact format:
{
  "factual_accuracy": <0-3>,
  "nccn_distinction": <0-3>,
  "scope_adherence": <0-3>,
  "hallucination": <0-3>,
  "format_compliance": <0-3>,
  "total": <sum of above>,
  "max_possible": 15,
  "critical_issues": ["list", "of", "issues"],
  "brief_rationale": "1-2 sentence explanation"
}"""


def rate_with_claude(question: str, answer: str, expected: str, api_key: str) -> Optional[dict]:
    """Rate answer using Claude."""
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        
        response = client.messages.create(
            model='claude-sonnet-4-20250514',
            max_tokens=500,
            system=RUBRIC,
            messages=[{
                'role': 'user',
                'content': f"""QUESTION: {question}

EXPECTED BEHAVIOR: {expected}

CHATBOT ANSWER:
{answer}

Rate this response using the rubric. Return ONLY the JSON object."""
            }]
        )
        
        # Parse JSON from response
        text = response.content[0].text.strip()
        # Handle markdown code blocks
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        return json.loads(text)
        
    except Exception as e:
        print(f"  Claude error: {e}")
        return None


def rate_with_gpt4(question: str, answer: str, expected: str, api_key: str) -> Optional[dict]:
    """Rate answer using GPT-4o."""
    try:
        import openai
        client = openai.OpenAI(api_key=api_key)
        
        response = client.chat.completions.create(
            model='gpt-4o',
            max_tokens=500,
            messages=[
                {'role': 'system', 'content': RUBRIC},
                {'role': 'user', 'content': f"""QUESTION: {question}

EXPECTED BEHAVIOR: {expected}

CHATBOT ANSWER:
{answer}

Rate this response using the rubric. Return ONLY the JSON object."""}
            ]
        )
        
        text = response.choices[0].message.content.strip()
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        return json.loads(text)
        
    except Exception as e:
        print(f"  GPT-4o error: {e}")
        return None


def rate_with_gemini(question: str, answer: str, expected: str, api_key: str) -> Optional[dict]:
    """Rate answer using Gemini."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-pro')
        
        response = model.generate_content(
            f"""{RUBRIC}

QUESTION: {question}

EXPECTED BEHAVIOR: {expected}

CHATBOT ANSWER:
{answer}

Rate this response using the rubric. Return ONLY the JSON object."""
        )
        
        text = response.text.strip()
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        return json.loads(text)
        
    except Exception as e:
        print(f"  Gemini error: {e}")
        return None


def rate_with_perplexity(question: str, answer: str, expected: str, api_key: str) -> Optional[dict]:
    """Rate answer using Perplexity sonar-pro."""
    try:
        import httpx
        
        response = httpx.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "sonar-pro",
                "messages": [
                    {"role": "system", "content": RUBRIC},
                    {"role": "user", "content": f"""QUESTION: {question}

EXPECTED BEHAVIOR: {expected}

CHATBOT ANSWER:
{answer}

Rate this response using the rubric. Return ONLY the JSON object."""}
                ]
            },
            timeout=60
        )
        response.raise_for_status()
        result = response.json()
        
        text = result["choices"][0]["message"]["content"].strip()
        if text.startswith('```'):
            text = text.split('```')[1]
            if text.startswith('json'):
                text = text[4:]
        return json.loads(text)
        
    except Exception as e:
        print(f"  Perplexity error: {e}")
        return None


def generate_readable_report(output: dict, md_path: str):
    """Generate a readable markdown report of all Q&A pairs with ratings."""
    
    summary = output.get('summary', {})
    results = output.get('results', [])
    
    lines = []
    lines.append("# OpenOnco Chatbot Evaluation Report")
    lines.append("")
    lines.append(f"**Date:** {output.get('rated_at', 'Unknown')}")
    lines.append(f"**Overall Score:** {summary.get('overall_avg_score', 0):.1f}/15 ({summary.get('percentage', 0):.1f}%)")
    lines.append(f"**Evaluators:** {', '.join(summary.get('evaluators_used', []))}")
    lines.append("")
    
    # Category summary
    lines.append("## Summary by Category")
    lines.append("")
    lines.append("| Category | Score |")
    lines.append("|----------|-------|")
    for cat, score in sorted(summary.get('by_category', {}).items()):
        pct = (score / 15) * 100
        lines.append(f"| {cat} | {score:.1f}/15 ({pct:.0f}%) |")
    lines.append("")
    
    # Each question
    lines.append("---")
    lines.append("")
    lines.append("## Detailed Results")
    lines.append("")
    
    for r in results:
        qid = r.get('id', 'unknown')
        category = r.get('category', 'unknown')
        question = r.get('question', '')
        answer = r.get('answer', '')
        expected = r.get('expected_behavior', '')
        ratings = r.get('ratings', {})
        consensus = r.get('consensus_total', 0)
        
        lines.append(f"### {qid} ({category})")
        lines.append("")
        lines.append(f"**Question:** {question}")
        lines.append("")
        lines.append(f"**Expected behavior:** {expected}")
        lines.append("")
        lines.append("**Chatbot Answer:**")
        lines.append("")
        lines.append("> " + answer.replace("\n", "\n> "))
        lines.append("")
        
        # Ratings from each model
        lines.append(f"**Scores:** (consensus: {consensus:.1f}/15)")
        lines.append("")
        
        for model, rating in ratings.items():
            total = rating.get('total', '?')
            reasoning = rating.get('reasoning', 'No reasoning provided')
            scores = rating.get('scores', {})
            
            lines.append(f"<details>")
            lines.append(f"<summary><b>{model.upper()}: {total}/15</b></summary>")
            lines.append("")
            if scores:
                lines.append("| Dimension | Score |")
                lines.append("|-----------|-------|")
                for dim, score in scores.items():
                    lines.append(f"| {dim} | {score}/3 |")
                lines.append("")
            lines.append(f"**Reasoning:** {reasoning}")
            lines.append("")
            lines.append("</details>")
            lines.append("")
        
        # Red/green flags
        red_flags = r.get('red_flags_found', [])
        green_flags = r.get('green_flags_found', [])
        if red_flags:
            lines.append(f"⚠️ **Red flags detected:** {', '.join(red_flags)}")
        if green_flags:
            lines.append(f"✅ **Green flags found:** {', '.join(green_flags)}")
        
        lines.append("")
        lines.append("---")
        lines.append("")
    
    with open(md_path, 'w') as f:
        f.write('\n'.join(lines))


def rate_answers(eval_results_path: str, output_path: str = None):
    """Rate all answers from an evaluation run."""
    
    # Load evaluation results
    with open(eval_results_path, 'r') as f:
        eval_data = json.load(f)
    
    results = eval_data['results']
    print(f"Rating {len(results)} answers...")
    
    # Get API keys
    anthropic_key = os.environ.get('ANTHROPIC_API_KEY')
    openai_key = os.environ.get('OPENAI_API_KEY')
    google_key = os.environ.get('GOOGLE_API_KEY')
    perplexity_key = os.environ.get('PERPLEXITY_API_KEY')
    
    evaluators = []
    if anthropic_key:
        evaluators.append(('claude', lambda q, a, e: rate_with_claude(q, a, e, anthropic_key)))
    if openai_key:
        evaluators.append(('gpt4o', lambda q, a, e: rate_with_gpt4(q, a, e, openai_key)))
    if perplexity_key:
        evaluators.append(('perplexity', lambda q, a, e: rate_with_perplexity(q, a, e, perplexity_key)))
    # Skip Gemini - deprecated API
    # if google_key:
    #     evaluators.append(('gemini', lambda q, a, e: rate_with_gemini(q, a, e, google_key)))
    
    if not evaluators:
        print("Error: No API keys found. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or PERPLEXITY_API_KEY")
        sys.exit(1)
    
    print(f"Using evaluators: {[e[0] for e in evaluators]}")
    
    rated_results = []
    
    for i, result in enumerate(results):
        if 'error' in result:
            rated_results.append(result)
            continue
            
        print(f"\n[{i+1}/{len(results)}] {result['id']}")
        
        ratings = {}
        for evaluator_name, evaluator_fn in evaluators:
            print(f"  Rating with {evaluator_name}...", end=' ')
            rating = evaluator_fn(
                result['question'],
                result['answer'],
                result['expected_behavior']
            )
            if rating:
                ratings[evaluator_name] = rating
                print(f"Score: {rating.get('total', '?')}/15")
            else:
                print("Failed")
        
        # Calculate aggregate scores
        if ratings:
            avg_scores = {}
            for dim in ['factual_accuracy', 'nccn_distinction', 'scope_adherence', 'hallucination', 'format_compliance', 'total']:
                scores = [r[dim] for r in ratings.values() if dim in r]
                if scores:
                    avg_scores[dim] = sum(scores) / len(scores)
            
            result['ratings'] = ratings
            result['avg_scores'] = avg_scores
            result['consensus_total'] = avg_scores.get('total', 0)
        
        rated_results.append(result)
    
    # Calculate summary
    questions_with_ratings = [r for r in rated_results if 'ratings' in r]
    
    if questions_with_ratings:
        avg_total = sum(r['consensus_total'] for r in questions_with_ratings) / len(questions_with_ratings)
        
        # Category breakdowns
        by_category = {}
        for r in questions_with_ratings:
            cat = r['category']
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(r['consensus_total'])
        
        category_avgs = {cat: sum(scores)/len(scores) for cat, scores in by_category.items()}
        
        summary = {
            'overall_avg_score': avg_total,
            'max_possible': 15,
            'percentage': (avg_total / 15) * 100,
            'by_category': category_avgs,
            'num_evaluated': len(questions_with_ratings),
            'evaluators_used': [e[0] for e in evaluators]
        }
    else:
        summary = {'error': 'No ratings generated'}
    
    output = {
        'source_eval': eval_results_path,
        'rated_at': datetime.now().isoformat(),
        'summary': summary,
        'results': rated_results
    }
    
    # Save JSON
    if output_path is None:
        output_path = eval_results_path.replace('.json', '_rated.json')
    
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    # Generate readable markdown report
    md_path = output_path.replace('.json', '.md')
    generate_readable_report(output, md_path)
    
    print(f"\n{'='*50}")
    print(f"Rated results saved to: {output_path}")
    print(f"Readable report saved to: {md_path}")
    print(f"\nOVERALL SCORE: {summary.get('overall_avg_score', 0):.1f}/15 ({summary.get('percentage', 0):.1f}%)")
    print("\nBy category:")
    for cat, avg in summary.get('by_category', {}).items():
        print(f"  {cat}: {avg:.1f}/15")
    
    return output


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Rate OpenOnco chatbot evaluation results')
    parser.add_argument('eval_file', help='Evaluation results JSON file')
    parser.add_argument('--output', '-o', help='Output file path')
    
    args = parser.parse_args()
    
    rate_answers(args.eval_file, args.output)
