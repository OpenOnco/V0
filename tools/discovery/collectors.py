"""
Source collectors for discovering new tests.
"""

import asyncio
import hashlib
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
import httpx

from config import CONFIG


class BaseCollector(ABC):
    """Base class for all source collectors."""

    name: str = "base"

    @abstractmethod
    async def collect(self) -> list[dict]:
        """Collect candidates from the source. Returns list of raw candidates."""
        pass

    def make_candidate_id(self, *args) -> str:
        """Generate a unique ID from components."""
        content = "|".join(str(a) for a in args)
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def make_raw_candidate(
        self,
        source_url: str,
        raw_data: dict,
        title: str = "",
        company: str = "",
        date: str = "",
    ) -> dict:
        """Create a standardized raw candidate dict."""
        return {
            "id": self.make_candidate_id(self.name, source_url, title),
            "source": self.name,
            "source_url": source_url,
            "discovered_at": datetime.now().isoformat(),
            "title": title,
            "company": company,
            "date": date,
            "raw_data": raw_data,
        }


class FDACollector(BaseCollector):
    """
    Collects from FDA 510(k) and PMA databases.
    Uses openFDA API: https://open.fda.gov/apis/device/
    """

    name = "fda"
    BASE_URL = "https://api.fda.gov/device"

    async def collect(self) -> list[dict]:
        candidates = []

        async with httpx.AsyncClient(timeout=30) as client:
            k_candidates = await self._collect_510k(client)
            candidates.extend(k_candidates)

            pma_candidates = await self._collect_pma(client)
            candidates.extend(pma_candidates)

        return candidates

    async def _collect_510k(self, client: httpx.AsyncClient) -> list[dict]:
        """Collect recent 510(k) clearances."""
        candidates = []
        lookback = datetime.now() - timedelta(days=CONFIG["fda"]["lookback_days"])
        date_str = lookback.strftime("%Y%m%d")

        # Search for molecular diagnostic / oncology devices
        search_query = (
            f'decision_date:[{date_str} TO *]'
            ' AND ('
            'statement_or_summary:"cancer"'
            ' OR statement_or_summary:"tumor"'
            ' OR statement_or_summary:"oncology"'
            ' OR statement_or_summary:"liquid biopsy"'
            ' OR statement_or_summary:"ctDNA"'
            ' OR statement_or_summary:"circulating tumor"'
            ' OR device_name:"tumor"'
            ' OR device_name:"cancer"'
            ' OR device_name:"oncology"'
            ')'
        )

        url = f"{self.BASE_URL}/510k.json"
        params = {"search": search_query, "limit": 100}

        try:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                for result in data.get("results", []):
                    candidate = self.make_raw_candidate(
                        source_url=f"https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?ID={result.get('k_number', '')}",
                        raw_data=result,
                        title=result.get("device_name", ""),
                        company=result.get("applicant", ""),
                        date=result.get("decision_date", ""),
                    )
                    candidates.append(candidate)
        except Exception as e:
            print(f"    FDA 510(k) error: {e}")

        return candidates

    async def _collect_pma(self, client: httpx.AsyncClient) -> list[dict]:
        """Collect recent PMA approvals."""
        candidates = []
        lookback = datetime.now() - timedelta(days=CONFIG["fda"]["lookback_days"])
        date_str = lookback.strftime("%Y%m%d")

        url = f"{self.BASE_URL}/pma.json"
        params = {
            "search": f'decision_date:[{date_str} TO *] AND (advisory_committee:"clinical chemistry" OR advisory_committee:"pathology")',
            "limit": 100,
        }

        try:
            response = await client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                for result in data.get("results", []):
                    candidate = self.make_raw_candidate(
                        source_url=f"https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpma/pma.cfm?id={result.get('pma_number', '')}",
                        raw_data=result,
                        title=result.get("trade_name", ""),
                        company=result.get("applicant", ""),
                        date=result.get("decision_date", ""),
                    )
                    candidates.append(candidate)
        except Exception as e:
            print(f"    FDA PMA error: {e}")

        return candidates


class PubMedCollector(BaseCollector):
    """
    Collects from PubMed for clinical validation studies.
    Uses NCBI E-utilities API.
    """

    name = "pubmed"
    SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
    FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"

    def __init__(self, search_terms: list[str]):
        self.search_terms = search_terms

    async def collect(self) -> list[dict]:
        candidates = []
        lookback = datetime.now() - timedelta(days=CONFIG["pubmed"]["lookback_days"])

        async with httpx.AsyncClient(timeout=30) as client:
            for term in self.search_terms:
                try:
                    articles = await self._search_pubmed(client, term, lookback)
                    candidates.extend(articles)
                    await asyncio.sleep(0.4)  # NCBI rate limit
                except Exception as e:
                    print(f"    PubMed error for '{term}': {e}")

        return candidates

    async def _search_pubmed(
        self, client: httpx.AsyncClient, term: str, since: datetime
    ) -> list[dict]:
        """Search PubMed for recent articles."""
        candidates = []

        mindate = since.strftime("%Y/%m/%d")
        maxdate = datetime.now().strftime("%Y/%m/%d")

        # Focus on commercial/clinical validation studies
        full_term = f'{term} AND (clinical validation OR commercial OR FDA OR diagnostic accuracy)'

        search_params = {
            "db": "pubmed",
            "term": f'{full_term} AND ("{mindate}"[Date - Publication] : "{maxdate}"[Date - Publication])',
            "retmax": CONFIG["pubmed"]["max_results"],
            "retmode": "json",
            "sort": "date",
        }

        response = await client.get(self.SEARCH_URL, params=search_params)
        if response.status_code != 200:
            return candidates

        search_data = response.json()
        pmids = search_data.get("esearchresult", {}).get("idlist", [])

        if not pmids:
            return candidates

        # Fetch article summaries
        fetch_params = {
            "db": "pubmed",
            "id": ",".join(pmids),
            "retmode": "json",
        }

        response = await client.get(self.FETCH_URL, params=fetch_params)
        if response.status_code != 200:
            return candidates

        fetch_data = response.json()
        results = fetch_data.get("result", {})

        for pmid in pmids:
            if pmid in results and pmid != "uids":
                article = results[pmid]
                candidate = self.make_raw_candidate(
                    source_url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    raw_data=article,
                    title=article.get("title", ""),
                    company="",
                    date=article.get("pubdate", ""),
                )
                candidates.append(candidate)

        return candidates


class NewsCollector(BaseCollector):
    """
    Collects from company newsrooms.
    Basic scraping - looks for product launch keywords.
    """

    name = "news"

    def __init__(self, companies: list[dict]):
        self.companies = [c for c in companies if c.get("newsroom")]

    async def collect(self) -> list[dict]:
        candidates = []

        async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
            for company in self.companies:
                try:
                    news = await self._check_newsroom(client, company)
                    if news:
                        candidates.append(news)
                except Exception as e:
                    print(f"    News error for {company['name']}: {e}")

        return candidates

    async def _check_newsroom(
        self, client: httpx.AsyncClient, company: dict
    ) -> dict | None:
        """Check company newsroom for potential product announcements."""
        try:
            response = await client.get(
                company["newsroom"],
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
            )

            if response.status_code != 200:
                return None

            text = response.text.lower()

            # Look for product launch indicators
            launch_keywords = [
                "launch", "introduce", "announce", "now available",
                "fda clear", "fda approv", "510(k)", "pma approv",
                "new test", "new assay", "commercial availability",
            ]

            # Look for relevant test types
            test_keywords = [
                "liquid biopsy", "ctdna", "circulating tumor",
                "mrd", "minimal residual", "early detection",
                "cancer screening", "tumor profiling",
            ]

            has_launch = any(kw in text for kw in launch_keywords)
            has_test = any(kw in text for kw in test_keywords)

            if has_launch and has_test:
                return self.make_raw_candidate(
                    source_url=company["newsroom"],
                    raw_data={"html_preview": response.text[:3000]},
                    title=f"Potential announcement - {company['name']}",
                    company=company["name"],
                    date=datetime.now().strftime("%Y-%m-%d"),
                )

            return None

        except Exception:
            return None


class ClinicalTrialsCollector(BaseCollector):
    """
    Collects from ClinicalTrials.gov for late-stage validation studies.
    """

    name = "clinicaltrials"
    BASE_URL = "https://clinicaltrials.gov/api/v2/studies"

    def __init__(self, search_terms: list[str]):
        self.search_terms = search_terms

    async def collect(self) -> list[dict]:
        candidates = []

        async with httpx.AsyncClient(timeout=30) as client:
            for term in self.search_terms[:3]:  # Limit to avoid too many results
                try:
                    studies = await self._search_studies(client, term)
                    candidates.extend(studies)
                    await asyncio.sleep(0.5)
                except Exception as e:
                    print(f"    ClinicalTrials error for '{term}': {e}")

        return candidates

    async def _search_studies(
        self, client: httpx.AsyncClient, term: str
    ) -> list[dict]:
        """Search for relevant clinical trials."""
        candidates = []

        params = {
            "query.term": term,
            "filter.overallStatus": "RECRUITING,ACTIVE_NOT_RECRUITING",
            "pageSize": 10,
            "sort": "LastUpdatePostDate:desc",
        }

        try:
            response = await client.get(self.BASE_URL, params=params)
            if response.status_code != 200:
                return candidates

            data = response.json()
            for study in data.get("studies", []):
                protocol = study.get("protocolSection", {})
                ident = protocol.get("identificationModule", {})
                sponsor = protocol.get("sponsorCollaboratorsModule", {})

                candidate = self.make_raw_candidate(
                    source_url=f"https://clinicaltrials.gov/study/{ident.get('nctId', '')}",
                    raw_data=study,
                    title=ident.get("briefTitle", ""),
                    company=sponsor.get("leadSponsor", {}).get("name", ""),
                    date=protocol.get("statusModule", {}).get("lastUpdatePostDateStruct", {}).get("date", ""),
                )
                candidates.append(candidate)
        except Exception as e:
            print(f"    ClinicalTrials API error: {e}")

        return candidates
