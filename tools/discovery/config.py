"""
Configuration for OpenOnco Discovery Agent
"""

import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
PROJECT_ROOT = BASE_DIR.parent.parent  # /V0

CONFIG = {
    # File paths
    "paths": {
        "data_js": PROJECT_ROOT / "src" / "data.js",
        "seen_candidates": DATA_DIR / "seen_candidates.json",
        "output_dir": DATA_DIR / "candidates",
    },

    # Companies to monitor
    "watchlist": {
        "companies": [
            {"name": "Guardant Health", "ticker": "GH", "newsroom": "https://guardanthealth.com/news/"},
            {"name": "Natera", "ticker": "NTRA", "newsroom": "https://www.natera.com/company/news/"},
            {"name": "Exact Sciences", "ticker": "EXAS", "newsroom": "https://www.exactsciences.com/newsroom"},
            {"name": "Grail", "ticker": "GRAL", "newsroom": "https://grail.com/press-releases/"},
            {"name": "Foundation Medicine", "ticker": None, "newsroom": "https://www.foundationmedicine.com/press-releases"},
            {"name": "Tempus", "ticker": "TEM", "newsroom": "https://www.tempus.com/news/"},
            {"name": "Caris Life Sciences", "ticker": None, "newsroom": "https://www.carislifesciences.com/news/"},
            {"name": "Myriad Genetics", "ticker": "MYGN", "newsroom": "https://myriad.com/news-events/"},
            {"name": "NeoGenomics", "ticker": "NEO", "newsroom": "https://neogenomics.com/news"},
            {"name": "Biodesix", "ticker": "BDSX", "newsroom": "https://www.biodesix.com/news/"},
            {"name": "Freenome", "ticker": None, "newsroom": "https://www.freenome.com/news/"},
            {"name": "Illumina", "ticker": "ILMN", "newsroom": "https://www.illumina.com/company/news-center.html"},
            {"name": "Roche", "ticker": "RHHBY", "newsroom": "https://www.roche.com/media/"},
            {"name": "Resolution Bioscience", "ticker": None, "newsroom": "https://resolution.bio/news/"},
            {"name": "Personalis", "ticker": "PSNL", "newsroom": "https://www.personalis.com/news/"},
            {"name": "Biocept", "ticker": "BIOC", "newsroom": "https://biocept.com/news/"},
            {"name": "Adaptive Biotechnologies", "ticker": "ADPT", "newsroom": "https://www.adaptivebiotech.com/news-events/"},
            {"name": "Invitae", "ticker": "NVTA", "newsroom": "https://www.invitae.com/en/press"},
            {"name": "Helio Health", "ticker": None, "newsroom": "https://www.helio.health/news/"},
            {"name": "Burning Rock", "ticker": "BNR", "newsroom": "https://www.brbiotech.com/news/"},
        ],
        "search_terms": [
            "liquid biopsy cancer detection",
            "ctDNA cancer test",
            "circulating tumor DNA assay",
            "minimal residual disease test",
            "early cancer detection blood test",
            "multi-cancer early detection",
            "tumor profiling NGS",
            "MRD monitoring",
        ],
    },

    # FDA settings
    "fda": {
        "product_codes": [
            "QJZ",  # Gene expression profiling test system
            "PQP",  # Tumor markers
            "NXN",  # Molecular diagnostic
            "OYC",  # Next generation sequencing
            "LXN",  # Circulating tumor cell test
        ],
        "lookback_days": 30,
    },

    # PubMed settings
    "pubmed": {
        "lookback_days": 30,
        "max_results": 50,
    },

    # Claude settings
    "claude": {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 4000,
    },

    # Email notification settings (uses Resend, same as main app)
    "email": {
        "enabled": True,
        "to": os.environ.get("OO_NOTIFY_EMAIL", "alexgdickinson@gmail.com"),
        "from": "OpenOnco Discovery <noreply@openonco.org>",
        "subject_prefix": "[OpenOnco]",
        "resend_api_key": os.environ.get("RESEND_API_KEY"),
        
        # Only email if we have high-confidence candidates
        "min_confidence_to_notify": 0.7,
    },

    # OpenOnco categories for classification
    "oo_categories": {
        "MRD": "Minimal Residual Disease - monitors for cancer recurrence after treatment",
        "ECD": "Early Cancer Detection - screens for cancer in asymptomatic individuals",
        "TRM": "Treatment Response Monitoring - tracks how cancer responds to therapy",
        "TDS": "Treatment Decision Support - guides therapy selection based on tumor profiling",
    },
}


def ensure_dirs():
    """Create necessary directories."""
    DATA_DIR.mkdir(exist_ok=True)
    CONFIG["paths"]["output_dir"].mkdir(exist_ok=True)


ensure_dirs()
