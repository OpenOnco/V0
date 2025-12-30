"""
Normalizer: Deduplicates candidates against existing OpenOnco tests and previously seen items.
"""

import json
import re
from pathlib import Path


class Normalizer:
    """Normalizes candidates and filters out already-seen items."""

    def __init__(self, data_js_path: Path, seen_path: Path):
        self.data_js_path = data_js_path
        self.seen_path = seen_path
        self.existing_tests = self._load_existing_tests()
        self.seen_candidates = self._load_seen_candidates()

    def _load_existing_tests(self) -> set[str]:
        """Extract existing test names from data.js."""
        existing = set()
        try:
            with open(self.data_js_path, "r") as f:
                content = f.read()
                
            # Extract test names using regex
            # Pattern matches: "name": "Test Name" or name: "Test Name"
            name_pattern = r'"?name"?\s*:\s*"([^"]+)"'
            matches = re.findall(name_pattern, content)
            
            for name in matches:
                existing.add(self._normalize_name(name))
                
            # Also extract vendor names
            vendor_pattern = r'"?vendor"?\s*:\s*"([^"]+)"'
            vendors = re.findall(vendor_pattern, content)
            for v in vendors:
                existing.add(self._normalize_name(v))
                
            print(f"  Loaded {len(matches)} existing tests from data.js")
            
        except FileNotFoundError:
            print(f"  Warning: data.js not found at {self.data_js_path}")
        except Exception as e:
            print(f"  Error loading data.js: {e}")
        return existing

    def _load_seen_candidates(self) -> dict:
        """Load previously seen candidates."""
        try:
            with open(self.seen_path, "r") as f:
                data = json.load(f)
                print(f"  Loaded {len(data)} previously seen candidates")
                return data
        except FileNotFoundError:
            return {}

    def _normalize_name(self, name: str) -> str:
        """Normalize a test/company name for comparison."""
        return (
            name.lower()
            .strip()
            .replace("-", " ")
            .replace("_", " ")
            .replace("®", "")
            .replace("™", "")
            .replace("  ", " ")
        )

    def process(self, candidates: list[dict]) -> list[dict]:
        """
        Process raw candidates:
        1. Remove duplicates within batch
        2. Remove already-seen candidates
        3. Remove tests already in OpenOnco
        """
        new_candidates = []
        seen_in_batch = set()

        for candidate in candidates:
            cid = candidate["id"]

            # Skip if already seen in this batch
            if cid in seen_in_batch:
                continue
            seen_in_batch.add(cid)

            # Skip if we've seen this before
            if cid in self.seen_candidates:
                continue

            # Skip if test name matches existing OpenOnco test
            title_normalized = self._normalize_name(candidate.get("title", ""))
            company_normalized = self._normalize_name(candidate.get("company", ""))
            
            # Check for exact match on test name
            if title_normalized and len(title_normalized) > 3:
                if title_normalized in self.existing_tests:
                    continue
                    
                # Check for partial match (e.g., "Guardant360" in "Guardant360 CDx")
                is_duplicate = False
                for existing in self.existing_tests:
                    if len(existing) > 5:
                        if title_normalized in existing or existing in title_normalized:
                            is_duplicate = True
                            break
                if is_duplicate:
                    continue

            new_candidates.append(candidate)

        return new_candidates

    def mark_seen(self, candidates: list[dict]):
        """Mark candidates as seen for future runs."""
        for candidate in candidates:
            self.seen_candidates[candidate["id"]] = {
                "source": candidate["source"],
                "title": candidate.get("title", ""),
                "company": candidate.get("company", ""),
                "discovered_at": candidate["discovered_at"],
            }

        # Save updated seen list
        with open(self.seen_path, "w") as f:
            json.dump(self.seen_candidates, f, indent=2)
        print(f"  Updated seen_candidates.json ({len(self.seen_candidates)} total)")
