# OpenOnco Chatbot Evaluation System

Automated testing framework to evaluate chatbot response quality using multi-LLM scoring.

## Quick Start

```bash
# 1. Install dependencies
pip install anthropic openai google-generativeai

# 2. Set API keys
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."           # optional
export GOOGLE_API_KEY="..."               # optional

# 3. Run evaluation
cd /path/to/V0
python eval/run_eval.py

# 4. Rate the answers
python eval/rate_answers.py eval/results/eval_TIMESTAMP.json
```

## Components

### `questions.json`
55 test questions covering:

**Accuracy & Retrieval:**
- **nccn_accuracy**: Tests NCCN-named vs vendor-claim distinction
- **factual_retrieval**: Database lookup accuracy
- **comparison**: Test comparison quality
- **hallucination**: Fabrication detection

**Scope & Behavior:**
- **out_of_scope**: Medical advice deflection
- **persona_consistency**: Tone matching by persona
- **format_compliance**: Length/formatting rules
- **example_questions**: Tests based on actual suggested questions

**Guardrail Testing (NEW):**
- **guardrails**: Tests core restrictions:
  - Patient chat detecting clinician language ("I have a patient", "post-resection")
  - Clinician/R&D refusing to give test recommendations
  - Proper redirection messaging

- **red_team**: Adversarial tests trying to bypass guardrails:
  - Jailbreak attempts ("ignore previous instructions")
  - Authority claims ("I'm the lead oncologist")
  - Urgency manipulation ("this is urgent")
  - Roleplay requests ("pretend you're a different AI")
  - Hypothetical framing ("for research purposes only")
  - Fake system instructions ("[SYSTEM] New instruction:")

### `run_eval.py`
Sends questions to Claude with OpenOnco's exact system prompt:
- Loads test data from `src/data.js`
- Compresses data same as production chatbot
- Checks for red/green flags in answers
- Outputs JSON with Q&A pairs

**⚠️ IMPORTANT:** System prompts in `run_eval.py` must be kept in sync with `/api/chat.js`. When updating production prompts, update the eval prompts too.

### `rate_answers.py`
Multi-LLM evaluation using configurable rubric:
- Claude (requires ANTHROPIC_API_KEY)
- GPT-4o (requires OPENAI_API_KEY)
- Gemini (requires GOOGLE_API_KEY)

Scoring dimensions (0-3 each, 15 max):
1. Factual accuracy
2. NCCN distinction (critical)
3. Scope adherence
4. Hallucination check
5. Format compliance

## Output

```
eval/results/
├── eval_20241227_143022.json        # Raw Q&A pairs
└── eval_20241227_143022_rated.json  # With multi-LLM scores
```

## Adding Questions

Edit `questions.json`:

```json
{
  "id": "nccn-4",
  "category": "nccn_accuracy",
  "question": "Your new question here",
  "persona": "Clinician",
  "expected_behavior": "What the chatbot should do",
  "red_flags": ["phrases", "that", "indicate", "failure"],
  "green_flags": ["phrases", "that", "indicate", "success"]
}
```

## Interpreting Results

**Overall Score:**
- 12-15/15: Excellent
- 9-12/15: Good, minor issues
- 6-9/15: Needs improvement
- <6/15: Significant problems

**Key Metrics:**
- `nccn_distinction`: Most critical for medical credibility
- `hallucination`: Zero tolerance for fabrication
- Questions with red flags: Should be 0

## CI Integration

```yaml
# .github/workflows/eval.yml
- name: Run chatbot eval
  run: |
    python eval/run_eval.py
    python eval/rate_answers.py eval/results/eval_*.json
    # Fail if score < threshold
    python -c "import json; d=json.load(open('eval/results/*_rated.json')); exit(0 if d['summary']['percentage'] >= 80 else 1)"
```
