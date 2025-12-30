"""
Email notifications for OpenOnco Discovery Agent.
Uses Resend (same as the main OpenOnco app).
"""

from datetime import datetime
from config import CONFIG


def send_email(subject: str, html_body: str) -> bool:
    """
    Send email notification via Resend.
    Returns True if sent successfully.
    """
    if not CONFIG["email"]["enabled"]:
        print("  Email notifications disabled")
        return False
    
    api_key = CONFIG["email"]["resend_api_key"]
    if not api_key:
        print("  No RESEND_API_KEY set - skipping email")
        return False
    
    try:
        import httpx
    except ImportError:
        print("  httpx not installed")
        return False
    
    try:
        with httpx.Client() as client:
            response = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": CONFIG["email"]["from"],
                    "to": CONFIG["email"]["to"],
                    "subject": f"{CONFIG['email']['subject_prefix']} {subject}",
                    "html": html_body,
                },
                timeout=30
            )
            if response.status_code == 200:
                print(f"  ✓ Email sent via Resend to {CONFIG['email']['to']}")
                return True
            else:
                print(f"  Resend error: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        print(f"  Resend error: {e}")
        return False


def format_candidates_email(candidates: list[dict]) -> tuple[str, str] | tuple[None, None]:
    """
    Format candidates as email content with two sections:
    1. New Tests (genuinely new)
    2. New Indications (existing tests in new contexts)
    """
    min_confidence = CONFIG["email"]["min_confidence_to_notify"]
    
    # Split into new tests vs new indications
    new_tests = []
    new_indications = []
    
    for c in candidates:
        if c.get("confidence", 0) < min_confidence:
            continue
        if not c.get("is_relevant", True):
            continue
            
        if c.get("is_new_test", False):
            new_tests.append(c)
        elif c.get("is_new_indication", False):
            new_indications.append(c)
    
    # Nothing to send?
    if not new_tests and not new_indications:
        return None, None
    
    date_str = datetime.now().strftime("%Y-%m-%d")
    
    # Build subject
    parts = []
    if new_tests:
        parts.append(f"{len(new_tests)} new test{'s' if len(new_tests) != 1 else ''}")
    if new_indications:
        parts.append(f"{len(new_indications)} new indication{'s' if len(new_indications) != 1 else ''}")
    subject = " + ".join(parts)
    
    # Build HTML
    html = f"""
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            h1 {{ color: #059669; font-size: 24px; margin-bottom: 8px; }}
            h2 {{ color: #374151; font-size: 18px; margin: 24px 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }}
            .subtitle {{ color: #6b7280; margin-bottom: 24px; }}
            .candidate {{ background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }}
            .new-test {{ border-left: 4px solid #059669; }}
            .new-indication {{ border-left: 4px solid #3b82f6; }}
            .test-name {{ font-size: 16px; font-weight: 600; color: #111; margin-bottom: 6px; }}
            .meta {{ color: #6b7280; font-size: 13px; margin-bottom: 10px; }}
            .field {{ margin: 4px 0; font-size: 13px; }}
            .label {{ color: #6b7280; }}
            .confidence {{ display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }}
            .high {{ background: #d1fae5; color: #065f46; }}
            .medium {{ background: #fef3c7; color: #92400e; }}
            .existing-test {{ background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 3px; font-size: 12px; }}
            a {{ color: #059669; text-decoration: none; }}
            a:hover {{ text-decoration: underline; }}
            .footer {{ margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px; }}
            .empty {{ color: #9ca3af; font-style: italic; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔬 OpenOnco Discovery</h1>
            <p class="subtitle">{date_str}</p>
    """
    
    # Section 1: New Tests
    html += '<h2>🆕 New Tests</h2>'
    if new_tests:
        for c in sorted(new_tests, key=lambda x: x.get("confidence", 0), reverse=True):
            html += _format_candidate_html(c, "new-test")
    else:
        html += '<p class="empty">No new tests found today.</p>'
    
    # Section 2: New Indications
    html += '<h2>📋 New Indications</h2>'
    if new_indications:
        for c in sorted(new_indications, key=lambda x: x.get("confidence", 0), reverse=True):
            html += _format_candidate_html(c, "new-indication")
    else:
        html += '<p class="empty">No new indications found today.</p>'
    
    html += """
            <div class="footer">
                <p>Automated report from OpenOnco Discovery Agent</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return subject, html


def _format_candidate_html(c: dict, css_class: str) -> str:
    """Format a single candidate as HTML."""
    extracted = c.get("extracted", {}) or {}
    
    test_name = extracted.get("test_name") or c.get("title", "Unknown Test")
    company = extracted.get("company") or c.get("company", "Unknown")
    category = extracted.get("category", "Unknown")
    confidence = c.get("confidence", 0)
    conf_class = "high" if confidence >= 0.85 else "medium"
    source_url = c.get("source_url", "#")
    source = c.get("source", "unknown")
    
    cancer_types = extracted.get("cancer_types", [])
    cancer_str = ", ".join(cancer_types[:5]) if cancer_types else "Not specified"
    
    fda_status = extracted.get("fda_status", "Unknown")
    methodology = extracted.get("methodology", "")
    notes = extracted.get("notes", "")
    
    # For new indications, show which existing test
    existing_test = extracted.get("existing_test_name", "")
    indication_details = extracted.get("new_indication_details", "")
    
    html = f"""
        <div class="candidate {css_class}">
            <div class="test-name">{test_name}</div>
            <div class="meta">
                {company} · {category} · 
                <span class="confidence {conf_class}">{confidence:.0%}</span>
            </div>
    """
    
    if existing_test:
        html += f'<div class="field"><span class="existing-test">Existing: {existing_test}</span></div>'
    
    if indication_details:
        html += f'<div class="field"><span class="label">What\'s new:</span> {indication_details}</div>'
    
    html += f'<div class="field"><span class="label">Cancer types:</span> {cancer_str}</div>'
    html += f'<div class="field"><span class="label">FDA status:</span> {fda_status}</div>'
    
    if methodology:
        html += f'<div class="field"><span class="label">Method:</span> {methodology}</div>'
    
    html += f'<div class="field"><span class="label">Source:</span> <a href="{source_url}">{source}</a></div>'
    
    if notes:
        html += f'<div class="field"><span class="label">Notes:</span> {notes[:150]}</div>'
    
    html += '</div>'
    
    return html


def notify_candidates(candidates: list[dict]) -> bool:
    """
    Send email notification for new candidates.
    Returns True if email was sent.
    """
    subject, html_body = format_candidates_email(candidates)
    
    if not subject:
        print("  No candidates meet notification threshold")
        return False
    
    return send_email(subject, html_body)
