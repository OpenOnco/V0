# OpenOnco Discovery Agent

Automated discovery of new cancer diagnostic tests for OpenOnco.

## What It Does

Runs daily to:
1. **Collect** candidates from FDA, PubMed, company newsrooms, ClinicalTrials.gov
2. **Deduplicate** against existing OpenOnco tests and previously seen candidates  
3. **Enrich** using Claude to extract structured test information
4. **Email** you a digest of high-confidence candidates (via Resend)

## Setup

```bash
cd /Users/adickinson/Documents/GitHub/V0/tools/discovery

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Environment Variables

Uses the same `RESEND_API_KEY` as the main OpenOnco app (already in your .env).

```bash
# Required
export ANTHROPIC_API_KEY="your-key"
export RESEND_API_KEY="re_xxxxx"  # Already set for OpenOnco

# Optional: Override recipient email
export OO_NOTIFY_EMAIL="alex@yourmail.com"
```

## Usage

### Manual Run

```bash
source venv/bin/activate
python main.py
```

### Test Without Email

```bash
python main.py --skip-email
```

### Test Collectors Only (no Claude, no email)

```bash
python main.py --skip-enrichment --skip-email
```

### Scheduled (cron)

```bash
# Add to crontab: crontab -e
# Run daily at 6 AM
0 6 * * * cd /Users/adickinson/Documents/GitHub/V0/tools/discovery && ./venv/bin/python main.py >> discovery.log 2>&1
```

## Output

- **Console**: Summary digest with high/medium/low confidence candidates
- **Email**: HTML email with high-confidence candidates (if any)
- **JSON**: `data/candidates/candidates_YYYY-MM-DD.json` with full details

## Review Workflow

1. Check your email or run manually
2. For promising candidates, verify at the source URL
3. Submit to OpenOnco via your normal process (paste to Claude)

## Files

```
tools/discovery/
├── main.py           # Entry point
├── config.py         # Companies, search terms, settings
├── collectors.py     # FDA, PubMed, News, ClinicalTrials
├── normalizer.py     # Deduplication vs data.js
├── enricher.py       # Claude extraction
├── output.py         # JSON + digest formatting
├── notifications.py  # Resend email
├── requirements.txt
└── data/
    ├── seen_candidates.json   # Persistence
    └── candidates/            # Daily outputs
```

## Tuning

Edit `config.py` to:
- Add/remove companies to monitor
- Adjust search terms
- Change lookback periods (default: 30 days)
- Set confidence threshold for notifications (default: 0.7)
