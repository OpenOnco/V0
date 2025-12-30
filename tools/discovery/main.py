#!/usr/bin/env python3
"""
OpenOnco Test Discovery Agent
Discovers new cancer diagnostic tests from multiple sources.
"""

import asyncio
from datetime import datetime

from config import CONFIG
from collectors import FDACollector, PubMedCollector, NewsCollector, ClinicalTrialsCollector
from normalizer import Normalizer
from enricher import ClaudeEnricher
from drafter import SubmissionDrafter
from output import OutputHandler
from notifications import notify_candidates


async def run_discovery(skip_enrichment: bool = False, skip_email: bool = False, skip_drafts: bool = False):
    """Main discovery pipeline."""
    print(f"\n{'='*60}")
    print(f"OpenOnco Discovery Agent - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*60}\n")

    # Initialize components
    normalizer = Normalizer(
        data_js_path=CONFIG["paths"]["data_js"],
        seen_path=CONFIG["paths"]["seen_candidates"]
    )
    output = OutputHandler(CONFIG["paths"]["output_dir"])

    # Initialize collectors
    collectors = [
        FDACollector(),
        PubMedCollector(CONFIG["watchlist"]["search_terms"]),
        NewsCollector(CONFIG["watchlist"]["companies"]),
        ClinicalTrialsCollector(CONFIG["watchlist"]["search_terms"]),
    ]

    # Collect from all sources
    print("PHASE 1: Collecting from sources...")
    all_candidates = []
    for collector in collectors:
        print(f"  → {collector.name}...")
        try:
            candidates = await collector.collect()
            print(f"    Found {len(candidates)} raw candidates")
            all_candidates.extend(candidates)
        except Exception as e:
            print(f"    Error: {e}")

    print(f"\nTotal raw candidates: {len(all_candidates)}")

    if not all_candidates:
        print("\nNo candidates found from any source.")
        return []

    # Normalize and deduplicate
    print("\nPHASE 2: Deduplicating...")
    new_candidates = normalizer.process(all_candidates)
    print(f"New candidates after dedup: {len(new_candidates)}")

    if not new_candidates:
        print("\nNo new candidates - all have been seen before or exist in OpenOnco.")
        return []

    # Enrich with Claude
    if not skip_enrichment:
        print(f"\nPHASE 3: Enriching {len(new_candidates)} candidates with Claude...")
        enricher = ClaudeEnricher()
        enriched = await enricher.enrich_batch(new_candidates)
    else:
        print("\nPHASE 3: Skipping enrichment (--skip-enrichment flag)")
        enriched = new_candidates

    # Filter to relevant NEW candidates only
    relevant = [
        c for c in enriched 
        if c.get("is_relevant", True) 
        and not c.get("extracted", {}).get("is_existing_test_update", False)
    ]
    print(f"\nRelevant NEW candidates: {len(relevant)} of {len(enriched)}")

    # Generate draft submissions for high-confidence candidates
    drafts = []
    if not skip_drafts and not skip_enrichment:
        print("\nPHASE 4: Generating draft submissions...")
        drafter = SubmissionDrafter()
        drafts = drafter.generate_drafts(enriched, min_confidence=0.75)
        print(f"  Generated {len(drafts)} drafts")
    else:
        print("\nPHASE 4: Skipping draft generation")

    # Generate output
    print("\nPHASE 5: Generating output...")
    output_path = output.save_candidates(enriched)
    print(f"  Saved to: {output_path}")

    # Save drafts separately
    if drafts:
        drafts_path = output.output_dir / f"drafts_{datetime.now().strftime('%Y-%m-%d')}.txt"
        with open(drafts_path, "w") as f:
            for draft in drafts:
                f.write(f"\n{'='*60}\n")
                f.write(f"TEST: {draft.get('test_name')} ({draft.get('category')})\n")
                f.write(f"{'='*60}\n\n")
                f.write(draft.get('draft', ''))
                f.write("\n\n")
        print(f"  Saved drafts to: {drafts_path}")

    # Update seen candidates
    normalizer.mark_seen(enriched)

    # Generate digest
    digest = output.generate_digest(enriched)
    print(f"\n{'='*60}")
    print("DAILY DIGEST")
    print(f"{'='*60}")
    print(digest)

    # Send email notification
    if not skip_email:
        print("\nPHASE 6: Sending notifications...")
        notify_candidates(enriched, drafts=drafts)
    else:
        print("\nPHASE 6: Skipping email (--skip-email flag)")

    return enriched


def main():
    """Entry point with CLI args."""
    import sys
    
    skip_enrichment = "--skip-enrichment" in sys.argv
    skip_email = "--skip-email" in sys.argv
    skip_drafts = "--skip-drafts" in sys.argv
    
    if "--help" in sys.argv:
        print("""
OpenOnco Discovery Agent

Usage: python main.py [options]

Options:
  --skip-enrichment  Skip Claude enrichment (faster, for testing collectors)
  --skip-drafts      Skip draft submission generation
  --skip-email       Don't send email notification
  --help             Show this help
        """)
        return
    
    asyncio.run(run_discovery(
        skip_enrichment=skip_enrichment,
        skip_email=skip_email,
        skip_drafts=skip_drafts,
    ))


if __name__ == "__main__":
    main()
