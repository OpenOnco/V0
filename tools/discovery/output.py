"""
Output handler: Saves candidates and generates daily digests.
"""

import json
from datetime import datetime
from pathlib import Path


class OutputHandler:
    """Handles output generation and saving."""

    def __init__(self, output_dir: Path):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def save_candidates(self, candidates: list[dict]) -> Path:
        """Save candidates to a dated JSON file."""
        date_str = datetime.now().strftime("%Y-%m-%d")
        output_path = self.output_dir / f"candidates_{date_str}.json"

        # Sort by: new_test first, then new_indication, then by confidence
        sorted_candidates = sorted(
            candidates,
            key=lambda x: (
                x.get("is_new_test", False),
                x.get("is_new_indication", False),
                x.get("confidence", 0)
            ),
            reverse=True
        )

        with open(output_path, "w") as f:
            json.dump(sorted_candidates, f, indent=2, default=str)

        return output_path

    def generate_digest(self, candidates: list[dict]) -> str:
        """Generate a human-readable digest of candidates."""
        if not candidates:
            return "No new candidates found today."

        # Split into categories
        new_tests = [c for c in candidates if c.get("is_new_test") and c.get("is_relevant", True)]
        new_indications = [c for c in candidates if c.get("is_new_indication") and c.get("is_relevant", True)]
        not_relevant = [c for c in candidates if not c.get("is_relevant", True)]

        lines = []
        lines.append(f"Found {len(candidates)} candidates total")
        lines.append(f"  • New tests: {len(new_tests)}")
        lines.append(f"  • New indications: {len(new_indications)}")
        lines.append(f"  • Not relevant: {len(not_relevant)}")
        lines.append("")

        # New Tests
        if new_tests:
            lines.append("🆕 NEW TESTS")
            lines.append("=" * 50)
            for c in sorted(new_tests, key=lambda x: x.get("confidence", 0), reverse=True):
                lines.append(self._format_candidate(c))
            lines.append("")

        # New Indications
        if new_indications:
            lines.append("📋 NEW INDICATIONS (existing tests, new contexts)")
            lines.append("=" * 50)
            for c in sorted(new_indications, key=lambda x: x.get("confidence", 0), reverse=True):
                lines.append(self._format_indication(c))
            lines.append("")

        # Not Relevant (brief)
        if not_relevant:
            lines.append(f"⚪ NOT RELEVANT ({len(not_relevant)})")
            lines.append("-" * 50)
            for c in not_relevant:
                lines.append(self._format_brief(c))
            lines.append("")

        return "\n".join(lines)

    def _format_candidate(self, candidate: dict) -> str:
        """Format a new test candidate."""
        extracted = candidate.get("extracted", {}) or {}
        lines = []

        test_name = extracted.get("test_name") or candidate.get("title", "Unknown")
        company = extracted.get("company") or candidate.get("company", "Unknown")
        confidence = candidate.get("confidence", 0)

        lines.append(f"\n  📋 {test_name}")
        lines.append(f"     Company: {company}")
        lines.append(f"     Confidence: {confidence:.0%} | Source: {candidate['source']}")

        if category := extracted.get("category"):
            lines.append(f"     Category: {category}")

        if cancer_types := extracted.get("cancer_types"):
            lines.append(f"     Cancers: {', '.join(cancer_types[:5])}")

        if fda_status := extracted.get("fda_status"):
            lines.append(f"     FDA: {fda_status}")

        if methodology := extracted.get("methodology"):
            lines.append(f"     Method: {methodology}")

        if notes := extracted.get("notes"):
            lines.append(f"     Notes: {notes[:80]}...")

        lines.append(f"     URL: {candidate['source_url']}")

        return "\n".join(lines)

    def _format_indication(self, candidate: dict) -> str:
        """Format a new indication candidate."""
        extracted = candidate.get("extracted", {}) or {}
        lines = []

        test_name = extracted.get("test_name") or candidate.get("title", "Unknown")
        existing_test = extracted.get("existing_test_name", "Unknown")
        indication = extracted.get("new_indication_details", "")
        confidence = candidate.get("confidence", 0)

        lines.append(f"\n  📋 {test_name}")
        lines.append(f"     Existing test: {existing_test}")
        lines.append(f"     What's new: {indication[:80]}")
        lines.append(f"     Confidence: {confidence:.0%} | Source: {candidate['source']}")

        if cancer_types := extracted.get("cancer_types"):
            lines.append(f"     Cancers: {', '.join(cancer_types[:5])}")

        lines.append(f"     URL: {candidate['source_url']}")

        return "\n".join(lines)

    def _format_brief(self, candidate: dict) -> str:
        """Brief format for not-relevant candidates."""
        extracted = candidate.get("extracted", {}) or {}
        test_name = extracted.get("test_name") or candidate.get("title", "Unknown")[:40]
        reason = extracted.get("relevance_reason", "")[:50] if extracted else ""
        return f"  • {test_name} - {reason}"
