# Tests Missing CPT/PLA Codes

Generated: 2026-01-29

**Status:** 99 tests need CPT/PLA codes for Medicare rate lookup

## Priority Research Order

### HIGH PRIORITY - Major Tests
These are well-established tests that likely have PLA codes:

| Test ID | Name | Vendor | Notes |
|---------|------|--------|-------|
| tds-3 | FoundationOne Heme | Foundation Medicine | Likely has PLA code |
| tds-17 | Guardant360 Liquid | Guardant Health | Check vs CDx code |
| mrd-10 | FoundationOne Tracker | Foundation Medicine | New MRD product |
| hct-31 | BRACAnalysis CDx | Myriad | FDA CDx - likely has code |
| ecd-kit-1 | Cologuard | Exact Sciences | Original version |

### MRD (18 tests)
| Test ID | Name | Research Notes |
|---------|------|----------------|
| mrd-9 | Labcorp Plasma Detect | Check Labcorp billing |
| mrd-10 | FoundationOne Tracker (MRD) | FMI billing |
| mrd-11 | Foundation TI-WGS MRD (RUO) | RUO - may not have code |
| mrd-12 | Veracyte MRD | Check Veracyte billing |
| mrd-13 | Guardant LUNAR (RUO) | RUO - may not have code |
| mrd-15 | Foresight CLARITY Lymphoma | Natera billing |
| mrd-16 | Invitae PCM | Invitae billing |
| mrd-18 | Caris Assure | Caris billing |
| mrd-21 | Latitude | Natera - new test |
| mrd-22 | CancerDetect | Check vendor |
| mrd-23 | LymphoVista | Check vendor |
| mrd-24 | CancerVista | Check vendor |
| mrd-25 | CanCatch Custom | Check vendor |
| mrd-kit-2 | LymphoTrack Dx IGH Assay | Invivoscribe |
| mrd-kit-3 | BD OneFlow B-ALL MRD Kit | BD Biosciences |
| mrd-26 | MRDVision | Check vendor |
| mrd-27 | Bladder EpiCheck | Nucleix |
| mrd-28 | K-4CARE | Check vendor |

### TDS/CGP (36 tests)
| Test ID | Name | Research Notes |
|---------|------|----------------|
| tds-3 | FoundationOne Heme | FMI - likely has code |
| tds-17 | Guardant360 Liquid | Guardant |
| tds-6 | Tempus xF | Tempus |
| tds-7 | Tempus xF+ | Tempus |
| tds-8 | MSK-IMPACT | Academic - may bill differently |
| tds-11 | OncoExTra | Check vendor |
| tds-12 | OmniSeq INSIGHT | OmniSeq |
| tds-13 | StrataNGS | Strata Oncology |
| tds-15 | NEO PanTracer Tissue | NEO |
| tds-16 | Northstar Select | Check vendor |
| tds-20 | Liquid Trace Solid Tumor | Check vendor |
| tds-21 | Liquid Trace Hematology | Check vendor |
| tds-22 | LiquidHALLMARK | Lucence - 0571U (MAC-priced) |
| tds-23 | Resolution ctDx FIRST | Resolution Bio |
| tds-24 | OncoCompass Target | Exact Sciences |
| tds-25 | OncoScreen Focus CDx | Check vendor |
| (+ IVD kits - typically use manufacturer codes) |

### ECD (8 tests)
| Test ID | Name | Research Notes |
|---------|------|----------------|
| ecd-21 | OverC MCED | Burning Rock - new |
| ecd-22 | Cancerguard | Check vendor |
| ecd-kit-1 | Cologuard | Exact Sciences - original |
| ecd-kit-2 | Epi proColon | Epigenomics |
| ecd-25 | CancerDetect Oral & Throat | Check vendor |
| ecd-26 | Trucheck Intelli | Check vendor |
| ecd-27 | OncoXPLORE+ | Check vendor |
| ecd-28 | SPOT-MAS | Check vendor |

### HCT (25 tests)
Many HCT panels use stacked 81432 codes or other hereditary panel codes.

### TRM (12 tests)  
TRM tests often share codes with their parent MRD tests.

## Research Sources

1. **CMS PLA Code Database**: https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system-hcpcs/proprietary-lab-analyses-codes
2. **AMA CPT PLA Codes**: Updated quarterly
3. **Vendor billing pages**: Most vendors list billing codes
4. **MolDX LCDs**: Sometimes list applicable codes

## Notes

- Many newer tests (2024-2025) may not have PLA codes yet
- RUO tests typically don't have billing codes
- IVD kits often use manufacturer-specific or stacked codes
- Some tests bill using generic CPT codes (81455, 81432, etc.)
