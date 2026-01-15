# Vendor Relationships & Processes

How OpenOnco interacts with diagnostic test vendors.

---

## Vendor Verification Program

### What It Is
Vendors can verify their test listings by having a company representative review and confirm the data. Verified tests get:
- ✅ Green verification badge
- ✅ Priority sorting (appear first in lists)
- ✅ Contributor credit in the database

### Verification Process

1. **Vendor reaches out** (or we invite them)
2. **Review data** - They check their test listing for accuracy
3. **Submit corrections** - Any errors get fixed
4. **Confirm accuracy** - They attest the data is correct
5. **Update database:**
   - Set `vendorVerified: true` on test object
   - Add entry to `VENDOR_VERIFIED` object
   - Add DATABASE_CHANGELOG entry

### VENDOR_VERIFIED Entry

```javascript
// In data.js ~line 463
export const VENDOR_VERIFIED = {
  'mrd-7': {  // Signatera
    name: 'John Smith',
    company: 'Natera',
    verifiedDate: '2026-01-14',
    editsSubmitted: 3
  },
  // ... more entries
};
```

**⚠️ Missing this = no green badge, test won't sort to top!**

---

## Submission Types

### New Test Submission
- Source: Vendor proposal, publication, FDA clearance
- Required: Commercial availability, validation data
- Process: See `SUBMISSION_PROCESS.md` Section A

### Change Request
- Source: Vendor correction, new data, updated claims
- Review level: Higher for performance metrics
- Process: See `SUBMISSION_PROCESS.md` Section B

### Deletion Request
- Valid: Test discontinued, never launched, regulatory recall
- Invalid: "We don't like the data", competitor request
- Process: See `SUBMISSION_PROCESS.md` Section D

---

## Financial Assistance Programs

Tracked in `VENDOR_ASSISTANCE_PROGRAMS` in data.js.

### Key Vendors with Programs

| Vendor | Program Highlights |
|--------|-------------------|
| **Natera** | Interest-free payment plans from $25/month |
| **Guardant Health** | Financial assistance based on need |
| **Foundation Medicine** | $100 lifetime max for qualifying patients; $3,500 self-pay |
| **Quest/Haystack** | $0 for patients at Federal Poverty Level |
| **Tempus** | Assistance based on income |
| **Exact Sciences** | Payment plans available |
| **Adaptive** | Assistance programs available |

### When to Mention
- Patient asks about cost/insurance
- Patient wizard "no insurance/cash" selection
- Test comparison discussions

---

## Email Communication

### Opening Mail Client

```bash
open "mailto:contact@vendor.com?subject=OpenOnco%20Database&body=Hi%20[Name],%0A%0A..."
```

### Common Templates

**Verification Invite:**
> Subject: OpenOnco Database - [Test Name] Listing Verification
>
> Hi [Name],
>
> OpenOnco maintains a database of cancer diagnostic tests. We have [Test Name] listed and would appreciate your verification of the data accuracy.
>
> Would you be willing to review the listing? Verified tests receive priority placement and a verification badge.

**Correction Follow-up:**
> Subject: Re: OpenOnco - Changes Applied
>
> Hi [Name],
>
> I've applied the corrections you submitted. The changes will be live on openonco.org shortly.
>
> [List of changes made]
>
> Your verification badge is now active. Thank you for contributing to OpenOnco!

---

## Vendor Contact Best Practices

1. **Use vendor domain emails** - Medical affairs, regulatory affairs
2. **CC Alex** when appropriate
3. **Be professional and concise**
4. **Acknowledge their time**
5. **Follow up once** if no response in 2 weeks

---

## Red Flags

| Red Flag | Concern | Action |
|----------|---------|--------|
| Performance change >10% | Cherry-picked data? | Ask for citation |
| No peer-reviewed publications | Vendor-only claims | Note as vendor data |
| 100% performance with small n | Statistical artifact | Add warning flag |
| Request from non-vendor email | Authority verification | Verify identity |
| RUO test claiming clinical use | Regulatory issue | Clarify with vendor |

---

## Current Verified Vendors

Check `VENDOR_VERIFIED` in data.js for current list, or:

```bash
grep -A5 "export const VENDOR_VERIFIED" src/data.js
```

---

## Vendor Database Fields

Tests track vendor relationship status:

```javascript
{
  vendor: "Natera",
  vendorVerified: true,
  vendorRequestedChanges: "2026-01-10: Initial listing. 2026-01-14: Vendor verified by John Smith, Natera.",
  // ...
}
```

The `vendorRequestedChanges` field serves as an audit trail for all changes.
