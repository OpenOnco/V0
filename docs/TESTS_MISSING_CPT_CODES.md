# Tests CPT/PLA Code Status

**Last Updated:** 2026-01-29
**Data Source:** BCBSM Medical Policy PLA Codes (Jan 2025), CMS CLFS Q4 2025

## Summary

| Metric | Count | % |
|--------|-------|---|
| Tests WITH CPT/PLA codes | 37 | 25% |
| Tests WITHOUT codes | 111 | 75% |
| **Total Tests** | **148** | 100% |

## Tests WITH CPT/PLA Codes (37)

### MRD Tests (14)
| Test ID | Name | CPT/PLA | Medicare Rate |
|---------|------|---------|---------------|
| mrd-1 | Haystack MRD | 0561U | MAC-Priced |
| mrd-2 | | | |
| mrd-3 | | | |
| mrd-4 | | | |
| mrd-5 | | | |
| mrd-6 | Reveal MRD | 0569U | MAC-Priced |
| mrd-7 | Signatera | 0340U | $3,920 |
| mrd-8 | | | |
| mrd-14 | NavDx | 0356U | $1,800 |
| mrd-16 | Invitae PCM | 0306U, 0307U | $3,878.45 |
| mrd-18 | Caris Assure | 0485U | MAC-Priced |
| mrd-19 | clonoSEQ | 0364U | $2,007.25 |
| mrd-20 | Signatera Genome | 0239U | $3,500 |

### TRM Tests (2)
| Test ID | Name | CPT/PLA | Medicare Rate |
|---------|------|---------|---------------|
| trm-8 | Northstar Response | 0486U | MAC-Priced |
| trm-11 | Caris Assure | 0485U | MAC-Priced |

### ECD Tests (6)
| Test ID | Name | CPT/PLA | Medicare Rate |
|---------|------|---------|---------------|
| ecd-1 | Shield | 0537U | $1,495 |
| ecd-3 | Cologuard Plus | 0464U | $591.92 |
| ecd-4 | ColoSense | 0421U | $508.87 |
| ecd-8 | HelioLiver | 0333U | $662.32 |
| ecd-20 | Avantect Pancreatic | 0410U | $1,160 |
| ecd-kit-2 | Epi proColon | 81327 | $192 |

### TDS/CGP Tests (10)
| Test ID | Name | CPT/PLA | Medicare Rate |
|---------|------|---------|---------------|
| tds-1 | FoundationOne CDx | 0037U | $3,500 |
| tds-2 | FoundationOne Liquid CDx | 0239U | $3,500 |
| tds-3 | FoundationOne Heme | 0111U | $682.29 |
| tds-4 | Guardant360 CDx | 0242U | $5,000 |
| tds-5 | Tempus xT CDx | 0473U | $4,500 |
| tds-8 | MSK-IMPACT | 0048U | $2,919.60 |
| tds-13 | StrataNGS | 0391U | $3,600 |
| tds-16 | Northstar Select | 0487U | $2,919.60 |
| tds-19 | Oncotype DX Breast | 81519 | $3,873 |
| tds-22 | LiquidHALLMARK | 0571U | MAC-Priced |
| tds-kit-3 | PGDx elio tissue complete | 0250U | $2,919.60 |

### HCT Tests (8)
| Test ID | Name | CPT/PLA | Medicare Rate |
|---------|------|---------|---------------|
| hct-1 | MyRisk | 81162 | $1,824.88 |
| hct-2 | Invitae Multi-Cancer | 81432 | $1,303.95 |
| hct-3 | CancerNext-Expanded | 81432 | $1,303.95 |
| hct-6 | Comprehensive Hereditary Cancer | 81432 | $1,303.95 |
| hct-7 | VistaSeq Hereditary Cancer | 81432 | $1,303.95 |
| hct-9 | Comprehensive Common Cancer | 81432 | $1,303.95 |
| hct-10 | Full Comprehensive Cancer | 81432 | $1,303.95 |
| hct-31 | BRACAnalysis CDx | 0137U | $282.88 |

### Kit Tests (2)
| Test ID | Name | CPT/PLA | Medicare Rate |
|---------|------|---------|---------------|
| mrd-kit-1 | clonoSEQ Assay | 0364U | $2,007.25 |

---

## Tests NOT in CLFS (1)
| Test ID | Name | CPT Code | Notes |
|---------|------|----------|-------|
| ecd-9 | Oncoguard Liver | 81599 | Code exists but not in CLFS |

---

## Tests WITHOUT CPT/PLA Codes (111)

### Why Some Tests Lack Codes

1. **RUO (Research Use Only)** - Not for clinical billing
2. **New Tests** - PLA code application pending
3. **Academic/Single-site** - May use institutional billing
4. **International** - Non-US tests
5. **Stacked Codes** - Use multiple existing CPT codes vs single PLA

### Data Sources for Future Updates

1. **CMS CLFS** - Quarterly updates with national rates
   - URL: https://www.cms.gov/medicare/payment/fee-schedules/clinical-laboratory-fee-schedule-clfs/files
   
2. **BCBSM PLA Policy** - Comprehensive PLA code mapping
   - URL: https://www.bcbsm.com/amslibs/content/dam/public/mpr/mprsearch/pdf/2158372.pdf
   
3. **AMA PLA Long Descriptors** - Quarterly updates (proprietary names)
   - URL: https://www.ama-assn.org/system/files/cpt-pla-codes-long.pdf
   - Note: Only contains quarterly deltas, not full database

### Automation

Run `scripts/update-medicare-rates.js` to:
1. Download latest CMS CLFS data
2. Match tests by cptCodes field
3. Update medicareRate, medicareStatus, medicareEffective, adltStatus
