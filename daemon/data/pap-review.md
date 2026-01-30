# PAP Data Review - Ready to Apply

## Summary
Extracted PAP data from 11 vendor billing pages. **3 vendors** have rich data ready to apply.

---

## ✅ FOUNDATION MEDICINE (High Quality)

**Extracted:**
- **Program:** Financial Assistance Program
- **Max OOP:** $100 for qualifying patients, $0 for Medicaid
- **Phone:** 888.988.3639
- **Email:** client.services@foundationmedicine.com
- **Prior Auth:** Yes, they help obtain prior authorizations
- **Appeals:** Yes, they bill plans and appeal denials with consent
- **Medicare:** Original Medicare beneficiaries have no OOP costs

**Affected Tests:**
| Test ID | Test Name | Current FA |
|---------|-----------|------------|
| tds-1 | FoundationOne CDx | (empty) |
| tds-2 | FoundationOne Liquid CDx | (empty) |
| tds-3 | FoundationOne Heme | (empty) |
| hct-29 | FoundationOne Germline | (empty) |
| mrd-10 | FoundationOne Tracker (MRD) | (empty) |
| trm-6 | FoundationOne Tracker (TRM) | (empty) |

**Proposed Value:**
```
Financial Assistance Program - qualifying patients pay max $100, Medicaid $0. Prior auth & appeals support included. Contact: 888.988.3639 or client.services@foundationmedicine.com
```

**Action:** ☐ APPROVE / ☐ SKIP

---

## ✅ NATERA (High Quality)

**Extracted:**
- **Program:** Financial Assistance Program
- **Phone:** 650-489-9050
- **Email:** oncologybilling@natera.com
- **Medicare:** Signatera covered for Stage II-IV CRC, MIBC, breast, Stage I-III NSCLC, Stage II-IV ovarian, and IO therapy monitoring
- **Appeals:** Will work with patients so cost is not a barrier

**Affected Tests:**
| Test ID | Test Name | Current FA |
|---------|-----------|------------|
| mrd-7 | Signatera | (empty) |
| mrd-20 | Signatera Genome | (empty) |
| hct-4 | Empower | Compassionate Care Program |
| trm-2 | Signatera (IO Monitoring) | (empty) |

**Proposed Value:**
```
Financial Assistance Program available. Contact: 650-489-9050 or oncologybilling@natera.com
```

**Action:** ☐ APPROVE / ☐ SKIP

---

## ✅ NEOGENOMICS (Good Quality)

**Extracted:**
- **Phone:** 866.776.5907, Option 9
- **Email:** patients@neogenomics.com
- **Appeals:** Help with denial letters and EOBs

**Affected Tests:**
| Test ID | Test Name | Current FA |
|---------|-----------|------------|
| tds-15 | NEO PanTracer Tissue | (empty) |
| mrd-5 | RaDaR ST | (empty) |
| trm-5 | RaDaR | (empty) |

**Proposed Value:**
```
Patient billing support and appeals assistance. Contact: 866.776.5907 (Option 9) or patients@neogenomics.com
```

**Action:** ☐ APPROVE / ☐ SKIP

---

## ⚠️ PARTIAL DATA (Phone Only)

### GRAIL (Galleri)
- **Phone:** (833) 694-2553
- **Tests:** ecd-2 (Galleri)
- *Page had limited content*

### TEMPUS
- **Phone:** 800.739.4137
- **Tests:** tds-5, tds-6, tds-7, mrd-8
- *Note: hct-8 already has "Tempus Financial Assistance"*

### CARIS
- **Program:** Financial Assistance Program mentioned
- **Tests:** tds-9, tds-14, mrd-18

**Action for partial data:** ☐ APPROVE PHONE-ONLY / ☐ SKIP

---

## ❌ NO DATA (404 or Thin Pages)

- **Guardant Health** - Page didn't load properly
- **Exact Sciences** - 404 error
- **Myriad** - Page not found
- **Adaptive Biotechnologies** - No PAP details
- **Invitae** - No structured PAP info

*These vendors need manual research or better URLs*

---

## Next Steps

1. Reply with approvals (e.g., "approve foundation, natera, neogenomics")
2. I'll update the database with approved values
3. For partial data vendors, we can add phone numbers only or skip
4. For failed vendors, we can manually research and add later
