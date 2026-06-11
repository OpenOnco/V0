#!/usr/bin/env python3
"""
Full-corpus citation sweep for the OpenOnco test database.

Why this exists: an internal audit (2026-06) only re-verified records it had
already flagged, and missed wrong-paper PMIDs in records it never looked at. An
independent external audit caught them with a *full-corpus* PMID sweep. This
script is that sweep, made re-runnable. Run it as part of the weekly process.

What it does:
  - Extracts every PMID and DOI from every citation/field in src/data/tests/*.json
  - PMIDs:  fetches the title from NCBI eutils; flags any that don't resolve
  - DOIs:   checks existence via doi.org (404 = nonexistent, 403/200 = exists);
            flags placeholder DOIs (e.g. "...XXX") and non-resolving DOIs
  - Prints, per citation, the resolved title + which records cite it, so a human
    or model can eyeball topical mismatches (a "cancer screening" test citing a
    sleep-apnea paper is the signature failure).

It does NOT auto-edit data. It surfaces candidates; a human/model verifies the
topical match and removes wrong citations (NEVER invent a replacement — see
docs/DATA_QUALITY_CHECKLIST.md).

Usage:  python3 scripts/citation-sweep.py [--json out.json]
"""
import json, re, sys, time, urllib.request, urllib.parse
from collections import defaultdict
from pathlib import Path

FILES = ["hct.json", "ecd.json", "mrd.json", "cgp.json"]
ROOT = Path(__file__).resolve().parent.parent / "src" / "data" / "tests"
UA = {"User-Agent": "openonco-citation-sweep"}


def walk_strings(obj, field=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield from walk_strings(v, k)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_strings(v, field)
    elif isinstance(obj, str):
        yield field, obj


def extract():
    pmids, dois = defaultdict(set), defaultdict(set)
    for fn in FILES:
        for t in json.loads((ROOT / fn).read_text()):
            tid = t.get("id", "?")
            for field, s in walk_strings(t):
                for p in re.findall(r"pubmed\.ncbi\.nlm\.nih\.gov/(\d+)", s):
                    pmids[p].add(f"{tid}|{field}")
                for d in re.findall(r"10\.\d{4,9}/[A-Za-z0-9._;()/\-]+", s):
                    dois[d.rstrip(".").rstrip(")")].add(f"{tid}|{field}")
    return pmids, dois


def pmid_titles(ids):
    titles = {}
    for i in range(0, len(ids), 40):
        batch = ids[i:i + 40]
        u = ("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
             "?db=pubmed&id=" + ",".join(batch) + "&retmode=json")
        try:
            r = json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30))["result"]
            for p in batch:
                titles[p] = r.get(p, {}).get("title", "*** NOT IN PUBMED ***")
        except Exception as e:
            for p in batch:
                titles[p] = f"*** LOOKUP ERROR: {e} ***"
        time.sleep(0.4)
    return titles


def doi_status(d):
    if re.search(r"X{2,}|\.\.\.|placeholder|TBD", d, re.I):
        return "PLACEHOLDER", ""
    try:
        req = urllib.request.Request("https://doi.org/" + urllib.parse.quote(d), headers=UA, method="HEAD")
        code = urllib.request.urlopen(req, timeout=20).status
        return f"OK({code})", ""
    except urllib.error.HTTPError as e:
        # 403 = exists but access-blocked (valid); 404 = does not exist
        return ("OK(403)", "") if e.code == 403 else (f"HTTP{e.code}", "")
    except Exception as e:
        return "ERR", str(e)[:40]


def main():
    pmids, dois = extract()
    print(f"# Citation sweep — {len(pmids)} unique PMIDs, {len(dois)} unique DOIs\n")
    titles = pmid_titles(list(pmids))
    flagged = []

    print("## PMIDs")
    for p in sorted(pmids, key=lambda x: sorted(pmids[x])[0]):
        recs = ", ".join(sorted({r.split('|')[0] for r in pmids[p]}))
        t = titles[p]
        bad = "NOT IN PUBMED" in t or "ERROR" in t
        if bad:
            flagged.append({"type": "pmid", "id": p, "records": recs, "title": t})
        mark = "  ⚠️ " if bad else "  "
        print(f"{mark}{p} [{recs}]\n      {t[:95]}")

    print("\n## DOIs")
    for d in sorted(dois, key=lambda x: sorted(dois[x])[0]):
        recs = ", ".join(sorted({r.split('|')[0] for r in dois[d]}))
        status, note = doi_status(d)
        bad = not status.startswith("OK") and status != "PLACEHOLDER" or status == "PLACEHOLDER"
        # NEJM/ASCO DOIs sometimes 404 on doi.org transiently; HTTP404 means re-verify, not auto-remove
        if status == "PLACEHOLDER" or status.startswith("HTTP4"):
            flagged.append({"type": "doi", "id": d, "records": recs, "status": status})
        mark = "  ⚠️ " if (status == "PLACEHOLDER" or status.startswith("HTTP4")) else "  "
        print(f"{mark}{status:9} {d} [{recs}] {note}")
        time.sleep(0.25)

    print(f"\n## FLAGGED ({len(flagged)}) — verify topical match / existence before removing:")
    for f in flagged:
        print(f"  - {f['type']} {f['id']} [{f['records']}] {f.get('title', f.get('status',''))[:80]}")
    print("\nReminder: removing a proven-wrong/nonexistent citation is fine; never invent a replacement.")

    if "--json" in sys.argv:
        out = sys.argv[sys.argv.index("--json") + 1]
        Path(out).write_text(json.dumps({"flagged": flagged}, indent=2))
        print(f"\nWrote {out}")


if __name__ == "__main__":
    main()
