# Independent Data-Quality Cross-Check - OpenOnco Test Database

Audit run date: 2026-06-10 HST / 2026-06-11 UTC

Scope actually checked:

- Automated citation extraction across all 157 records in `src/data/tests/hct.json`, `ecd.json`, `mrd.json`, and `cgp.json`: PMID metadata lookup through NCBI ESummary, DOI resolution spot checks, placeholder DOI detection, and exact-name duplicate detection.
- Manual primary-source drill-down: `hct-1` through `hct-15`, `hct-33`; `ecd-1`, `ecd-2`, `ecd-3`, `ecd-4`, `ecd-6`, `ecd-7`, `ecd-8`, `ecd-9`, `ecd-10`, `ecd-11`, `ecd-12`, `ecd-13`, `ecd-14`, `ecd-15`, `ecd-21`; `mrd-1` through `mrd-16`, `mrd-18`, `trm-1`, `trm-5`, `trm-8`, `trm-11`; `tds-1` through `tds-13`, `tds-18`, `tds-22`, `tds-23`, `tds-kit-10`, `tds-kit-13`.
- I did not fully verify every non-PMID URL, every coverage policy, or every numeric performance claim in all records.

## Findings

```json
[
  {
    "testId": "hct-33",
    "name": "AbsoluteDx",
    "category": "HCT",
    "field": "prsCitations",
    "severity": "major",
    "issue": "Citation is free text, not a resolvable primary source: \"Nature Communications (multi-ancestry PRS validation); Broad Institute collaboration\".",
    "evidence": "No PMID, DOI, URL, FDA document, or vendor source is attached to the PRS claim. I could not verify the specific cited paper or Broad collaboration from the record text alone.",
    "sourceUrl": "src/data/tests/hct.json",
    "recommendedFix": "Replace with a verified PMID/DOI/URL only after confirming it supports AbsoluteDx's exact PRS claim; otherwise remove the citation and mark for human review.",
    "confidence": 0.9
  },
  {
    "testId": "ecd-3",
    "name": "Cologuard Plus",
    "category": "ECD",
    "field": "sensitivityCitations, specificityCitations, stage*Citations, ppvCitations, npvCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is attached to Cologuard Plus BLUE-C performance claims.",
    "evidence": "PMID 38477992 resolves to the NEJM editorial \"Improving Noninvasive Colorectal Cancer Screening,\" not the BLUE-C primary clinical study. FDA SSED P230043 is the primary source for BLUE-C and reports CRC sensitivity 95.3%, APL sensitivity 43.3%, and specificity 90.7%.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/38477992/ ; https://www.accessdata.fda.gov/cdrh_docs/pdf23/P230043B.pdf",
    "recommendedFix": "Remove PMID 38477992 from performance fields. Use only the FDA SSED or a personally verified primary BLUE-C publication PMID/DOI.",
    "confidence": 0.98
  },
  {
    "testId": "ecd-8",
    "name": "HelioLiver",
    "category": "ECD",
    "field": "specificityCitations, ppvCitations, npvCitations, listPriceCitations",
    "severity": "major",
    "issue": "Several numeric claims are supported only by unresolvable shorthand such as conference text, investor deck, or estimated price.",
    "evidence": "The record cites \"CLiMB study EASL 2024; Helio Genomics investor deck\" and \"estimated range $450-$600\" without a URL, PMID, DOI, FDA document, or vendor price page.",
    "sourceUrl": "src/data/tests/ecd.json",
    "recommendedFix": "Remove the unsupported numbers or attach verified primary source URLs/PMIDs. Do not retain estimated price as a factual value unless a primary source is found.",
    "confidence": 0.86
  },
  {
    "testId": "ecd-9",
    "name": "Oncoguard Liver",
    "category": "ECD",
    "field": "sensitivityCitations, specificityCitations, listPriceCitations",
    "severity": "major",
    "issue": "Performance and price claims use non-resolvable conference shorthand and an estimated price.",
    "evidence": "The record cites \"ALTUS study AASLD November 2025\" and \"Estimated based on market positioning\" rather than a primary source URL, PMID, DOI, FDA document, or official price source.",
    "sourceUrl": "src/data/tests/ecd.json",
    "recommendedFix": "Replace with verified primary source citations or set the affected fields to null/human-review.",
    "confidence": 0.84
  },
  {
    "testId": "ecd-12",
    "name": "ProVue Lung",
    "category": "ECD",
    "field": "performanceCitations, listPriceCitations",
    "severity": "major",
    "issue": "The record presents unpublished data and estimated pricing as citation support.",
    "evidence": "The performance citation says \"Unpublished data on file; manuscript under preparation\" and the list-price citation says \"Estimated based on market positioning.\" These are not independently verifiable primary citations.",
    "sourceUrl": "src/data/tests/ecd.json",
    "recommendedFix": "Keep only values supported by the official PrognomiQ page/press release or other primary source; otherwise null the unsupported fields.",
    "confidence": 0.88
  },
  {
    "testId": "ecd-15",
    "name": "GALEAS Bladder",
    "category": "ECD",
    "field": "sensitivityCitations, specificityCitations, performanceCitations, clinicalTrialsCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMIDs are attached to bladder-cancer test performance claims.",
    "evidence": "PMID 36335043 resolves to a dermatology case report on Frey syndrome. PMID 31125144 resolves to a tuberculosis ATP synthase paper. Neither supports GALEAS Bladder performance or clinical-trial claims.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/36335043/ ; https://pubmed.ncbi.nlm.nih.gov/31125144/",
    "recommendedFix": "Remove both PMIDs from this record. Do not substitute new citations unless the replacement source is personally verified against the GALEAS Bladder claims.",
    "confidence": 0.99
  },
  {
    "testId": "ecd-21",
    "name": "OverC Multi-Cancer Detection Blood Test",
    "category": "ECD",
    "field": "performanceCitations, numPublicationsCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is reused for OverC publication/performance support.",
    "evidence": "PMID 33931567 resolves to a Science paper on SARS-CoV-2 vaccine immune responses after prior infection, not a Burning Rock/OverC cancer detection study.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/33931567/",
    "recommendedFix": "Remove PMID 33931567 from OverC fields and verify any remaining OverC citations against primary publications or official clinical-trial records.",
    "confidence": 0.99
  },
  {
    "testId": "mrd-2",
    "name": "NeXT Personal Dx",
    "category": "MRD",
    "field": "clinicalTrialsCitations",
    "severity": "critical",
    "issue": "Placeholder DOI is present in a citation field.",
    "evidence": "https://doi.org/10.1016/j.cell.2025.12.XXX returns HTTP 404 and contains a literal placeholder suffix.",
    "sourceUrl": "https://doi.org/10.1016/j.cell.2025.12.XXX",
    "recommendedFix": "Remove the placeholder DOI immediately. Add a replacement only after verifying the final DOI and that it supports the TRACERx/Cell claim.",
    "confidence": 1.0
  },
  {
    "testId": "mrd-2",
    "name": "NeXT Personal Dx",
    "category": "MRD",
    "field": "leadTimeVsImagingCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is attached to a breast-cancer ctDNA lead-time claim.",
    "evidence": "The record cites PMID 39848827 while describing Garcia-Murillas et al. Ann Oncol 2025 breast-cancer ctDNA lead time. PubMed says PMID 39848827 is \"Phase I Clinical Trial of Autologous Hematopoietic Stem Cell Transplantation-Supported Dose-Intensified Chemotherapy With Adebrelimab as First-Line Treatment for Extensive-Stage Small Cell Lung Cancer.\"",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/39848827/",
    "recommendedFix": "Remove PMID 39848827. Do not keep the 450-day lead-time value unless a verified primary source supports that exact value for NeXT Personal Dx.",
    "confidence": 0.99
  },
  {
    "testId": "mrd-14",
    "name": "NavDx",
    "category": "MRD",
    "field": "clinicalTrialsCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is included in the NavDx clinical citation list.",
    "evidence": "PMID 35914212 resolves to a Health Affairs paper on Medicare Advantage dialysis markups, not HPV ctDNA, Naveris, NavDx, or head-and-neck cancer surveillance.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/35914212/",
    "recommendedFix": "Remove PMID 35914212 from NavDx. Re-check the adjacent NavDx citations one by one before retaining the clinical-trial summary.",
    "confidence": 0.99
  },
  {
    "testId": "mrd-15",
    "name": "Foresight CLARITY Lymphoma",
    "category": "MRD",
    "field": "medicareCoverage.status vs coverageCrossReference.medicare.status",
    "severity": "major",
    "issue": "Internal coverage contradiction.",
    "evidence": "The same record says `medicareCoverage.status` is `COVERED`, but `coverageCrossReference.medicare.status` is `NOT_COVERED` and the analysis text says coverage is not established.",
    "sourceUrl": "src/data/tests/mrd.json",
    "recommendedFix": "Resolve to a single coverage status after checking the applicable MolDX LCD/billing article. Until then, mark Medicare coverage as human-review rather than covered.",
    "confidence": 0.93
  },
  {
    "testId": "trm-8",
    "name": "Northstar Response",
    "category": "MRD",
    "field": "lodCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is attached to the LOD citation.",
    "evidence": "PMID 39438179 resolves to a Sleep Health paper on insomnia and sleep apnea in U.S. Army soldiers, not BillionToOne/Northstar oncology assay LOD.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/39438179/",
    "recommendedFix": "Remove PMID 39438179. Verify the Northstar LOD against BillionToOne primary materials or a peer-reviewed assay validation source before retaining it.",
    "confidence": 0.99
  },
  {
    "testId": "mrd-18 / trm-11",
    "name": "Caris Assure",
    "category": "MRD",
    "field": "duplicate record",
    "severity": "major",
    "issue": "Same physical product appears as two separate records.",
    "evidence": "Both records are named Caris Assure, vendor Caris Life Sciences, use WES/WTS from plasma/buffy coat with CHIP subtraction, have CPT 0485U, and list the same Medicare coverage/rate. The records differ mainly by use-case framing (MRD vs TRM).",
    "sourceUrl": "src/data/tests/mrd.json",
    "recommendedFix": "Consolidate into one Caris Assure product record with separate use-case/indication fields, or explicitly mark one as a category alias to avoid double counting.",
    "confidence": 0.9
  },
  {
    "testId": "tds-1",
    "name": "FoundationOne CDx",
    "category": "CGP",
    "field": "fdaCompanionDxCount, fdaCompanionDxCountCitations",
    "severity": "major",
    "issue": "FDA CDx count is supported by a vendor press release and does not match the FDA CDx list count using the visible device entries.",
    "evidence": "The record claims 59 U.S. FDA-approved CDx indications and cites BusinessWire. The FDA CDx list fetched during audit contained 30 visible `FoundationOne CDx (Foundation Medicine, Inc.)` entries.",
    "sourceUrl": "https://www.fda.gov/medical-devices/in-vitro-diagnostics/list-cleared-or-approved-companion-diagnostic-devices-in-vitro-and-imaging-tools",
    "recommendedFix": "Replace the vendor-press-release count with a count derived from the FDA CDx list, with documented counting rules. Until then, remove the numeric count or mark it human-review.",
    "confidence": 0.82
  },
  {
    "testId": "tds-2",
    "name": "FoundationOne Liquid CDx",
    "category": "CGP",
    "field": "fdaCompanionDxCount, fdaStatusCitations",
    "severity": "major",
    "issue": "FDA CDx count/status support relies on non-primary sources and appears stale relative to the FDA CDx list.",
    "evidence": "The record claims 11 CDx indications and cites Foundation Medicine/CancerNetwork sources. The FDA CDx list fetched during audit contained 16 visible `FoundationOne Liquid CDx (Foundation Medicine, Inc.)` entries.",
    "sourceUrl": "https://www.fda.gov/medical-devices/in-vitro-diagnostics/list-cleared-or-approved-companion-diagnostic-devices-in-vitro-and-imaging-tools",
    "recommendedFix": "Use FDA CDx list and FDA PMA supplement pages as the source of truth; update or remove the count until it is reproducible.",
    "confidence": 0.8
  },
  {
    "testId": "tds-3",
    "name": "FoundationOne Heme",
    "category": "CGP",
    "field": "numPublicationsCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is cited for FoundationOne Heme publication support.",
    "evidence": "PMID 27002118 resolves to a Blood paper titled \"Cardiolipin-mediated procoagulant activity of mitochondria contributes to traumatic brain injury-associated coagulopathy in mice,\" not FoundationOne Heme validation.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/27002118/",
    "recommendedFix": "Remove PMID 27002118 and verify any replacement FoundationOne Heme validation citation before adding it.",
    "confidence": 0.99
  },
  {
    "testId": "tds-4",
    "name": "Guardant360 CDx",
    "category": "CGP",
    "field": "publicationsExampleCitations",
    "severity": "critical",
    "issue": "Example publication PMIDs are unrelated to Guardant360 CDx.",
    "evidence": "PMID 33619370 is a Nat Med paper on a human skin commensal microbe for atopic dermatitis. PMID 37256839 is a pediatric GI case report. Neither supports Guardant360 CDx publication claims.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/33619370/ ; https://pubmed.ncbi.nlm.nih.gov/37256839/",
    "recommendedFix": "Remove both example citations. Replace only with verified Guardant360 CDx validation/clinical utility publications.",
    "confidence": 0.99
  },
  {
    "testId": "tds-4",
    "name": "Guardant360 CDx",
    "category": "CGP",
    "field": "fdaCompanionDxCount, fdaStatus",
    "severity": "major",
    "issue": "Internal and primary-source count mismatch.",
    "evidence": "The record has `fdaCompanionDxCount: 7`, while `fdaStatus` text says 26 CDx indications. The FDA CDx list fetched during audit contained 5 visible `Guardant360 CDx (Guardant Health, Inc.)` entries.",
    "sourceUrl": "https://www.fda.gov/medical-devices/in-vitro-diagnostics/list-cleared-or-approved-companion-diagnostic-devices-in-vitro-and-imaging-tools",
    "recommendedFix": "Define whether the field counts FDA table entries, drug-tumor approvals, biomarkers, or vendor-framed indications; then recompute from FDA primary sources.",
    "confidence": 0.78
  },
  {
    "testId": "tds-7",
    "name": "Tempus xF+",
    "category": "CGP",
    "field": "analyticalValidationCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is attached to analytical validation.",
    "evidence": "PMID 39820598 resolves to a European Journal of Nuclear Medicine and Molecular Imaging paper on FAPI PET/CT for pancreatic neoadjuvant response, not Tempus xF+ analytical validation.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/39820598/",
    "recommendedFix": "Remove PMID 39820598 and verify analytical-validation support from Tempus primary materials or a peer-reviewed xF+ validation paper.",
    "confidence": 0.99
  },
  {
    "testId": "tds-11",
    "name": "OncoExTra",
    "category": "CGP",
    "field": "clinicalUtilityCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is attached to clinical utility support.",
    "evidence": "PMID 37256839 resolves to a Journal of Pediatric Gastroenterology and Nutrition case report, not OncoExTra clinical utility.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/37256839/",
    "recommendedFix": "Remove PMID 37256839 from OncoExTra clinicalUtilityCitations and retain only verified OncoExTra sources.",
    "confidence": 0.99
  },
  {
    "testId": "tds-18",
    "name": "IsoPSA",
    "category": "CGP",
    "field": "sensitivityCitations, specificityCitations, clinicalTrialsCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is attached to IsoPSA performance/clinical support.",
    "evidence": "PMID 27477528 resolves to a Eur Urol systematic review of kidney-sparing surgery versus nephroureterectomy for upper tract urothelial carcinoma, not IsoPSA prostate cancer testing.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/27477528/",
    "recommendedFix": "Remove PMID 27477528 from IsoPSA fields. Verify IsoPSA claims directly against FDA P220023 and primary IsoPSA publications before adding replacements.",
    "confidence": 0.99
  },
  {
    "testId": "tds-22",
    "name": "LiquidHALLMARK",
    "category": "CGP",
    "field": "methodCitations, sensitivityCitations, specificityCitations, lodCitations, numPublicationsCitations",
    "severity": "critical",
    "issue": "Wrong-paper PMID is reused across multiple LiquidHALLMARK technical/performance fields.",
    "evidence": "PMID 35482824 resolves to an ACS Applied Materials & Interfaces paper on oxygen-activated self-cleaning membranes, not Lucence LiquidHALLMARK.",
    "sourceUrl": "https://pubmed.ncbi.nlm.nih.gov/35482824/",
    "recommendedFix": "Remove PMID 35482824 from all LiquidHALLMARK fields. Re-verify Mayo/Lucence and any ASCO/PO citations before retaining the numerical claims.",
    "confidence": 0.99
  },
  {
    "testId": "tds-kit-10 / tds-kit-13",
    "name": "PGDx elio plasma focus Dx",
    "category": "CGP",
    "field": "duplicate record",
    "severity": "critical",
    "issue": "Same FDA-authorized physical product is entered twice.",
    "evidence": "Both records have the same name, same FDA source family, same kitted liquid-biopsy product, same 33 SNV/indel genes, same Streck blood collection type, and same no-tumor/no-normal requirements. FDA lists one device: PGDx elio plasma focus Dx, De Novo DEN230046.",
    "sourceUrl": "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/denovo.cfm?id=DEN230046",
    "recommendedFix": "Merge `tds-kit-10` and `tds-kit-13` into a single record. Preserve verified details from DEN230046 and discard conflicting duplicate values.",
    "confidence": 0.98
  },
  {
    "testId": "tds-kit-13",
    "name": "PGDx elio plasma focus Dx",
    "category": "CGP",
    "field": "fdaStatusNotes, fdaApprovalDate",
    "severity": "critical",
    "issue": "Wrong FDA De Novo number is assigned to PGDx elio plasma focus Dx.",
    "evidence": "The record says De Novo `DEN240016`. FDA's DEN240016 page is for `Xpert HCV; GeneXpert Xpress System`, a hepatitis C RNA test. FDA's PGDx elio plasma focus Dx page lists `DEN230046`, product code SBY, decision date 08/01/2024.",
    "sourceUrl": "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/denovo.cfm?id=DEN240016 ; https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/denovo.cfm?id=DEN230046",
    "recommendedFix": "Change De Novo number to DEN230046 and decision date to 2024-08-01, or merge this record into `tds-kit-10` and delete the duplicate.",
    "confidence": 1.0
  }
]
```

## Per-Category Summary

| Category | Critical | Major | Minor |
| --- | ---: | ---: | ---: |
| HCT | 0 | 1 | 0 |
| ECD | 3 | 3 | 0 |
| MRD/TRM | 4 | 2 | 0 |
| CGP/TDS | 8 | 3 | 0 |
| Total | 15 | 9 | 0 |

## Records Not Fully Verified

All records not listed in the manual drill-down scope above were not fully source-verified. Even within the manually checked set, I did not fully verify every payer policy and every vendor URL. The automated PMID sweep did cover every record in the four named files and found the wrong-PMID issues above.

High-risk records needing the next pass:

- `hct-1` through `hct-15`: several analytical sensitivity/specificity and reimbursement values are round numbers without direct primary citations in the fields.
- `ecd-8`, `ecd-9`, `ecd-10`, `ecd-11`, `ecd-12`, `ecd-21`, `ecd-27`, `ecd-33`: many performance/price fields rely on conference shorthand, vendor data, investor materials, or estimated values.
- `mrd-2`, `mrd-7`, `mrd-15`, `mrd-20`, `mrd-24`, `mrd-25`: vendor-data and conference citations need primary-source replacement or nulling.
- `tds-1`, `tds-2`, `tds-4`, `tds-9`: FDA CDx count fields need a reproducible FDA-list based counting method.
- `tds-23`: discontinued/ownership/current coverage status needs separate primary-source verification because the record mixes historical FDA approval with current coverage language.
