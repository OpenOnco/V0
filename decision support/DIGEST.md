# MRD Guidance Monitor: Weekly Digest

## Overview

Email digest sent Friday mornings with the week's most important MRD guidance updates.

---

## Design Principles

1. **Scannable** - Busy physicians, 2-minute read max
2. **Reference-focused** - Links to sources, not opinions
3. **Personalized** - Filter by cancer type preference
4. **No marketing** - Just curated references

---

## Email Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [OpenOnco Logo]                                            │
│                                                             │
│  MRD Guidance Monitor                                       │
│  Week of January 27, 2026                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  THIS WEEK: 3 guideline updates, 2 trial results,           │
│  1 new LCD                                                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 GUIDELINE UPDATES                                       │
│  ─────────────────────                                      │
│                                                             │
│  NCCN Colon Cancer v2.2026                                  │
│  Updated January 24, 2026                                   │
│  MRD mention: Section MS-14, Category 2A                    │
│  → View changes                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔬 TRIAL UPDATES                                           │
│  ─────────────────────                                      │
│                                                             │
│  CIRCULATE-Japan: Primary endpoint results published        │
│  Published: JCO, January 22, 2026                           │
│  Cancer: Colorectal                                         │
│  → PubMed | NCT04120701                                     │
│                                                             │
│  PEGASUS: Status changed to "Active, not recruiting"        │
│  Updated: January 20, 2026                                  │
│  → ClinicalTrials.gov                                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📄 KEY PUBLICATIONS                                        │
│  ─────────────────────                                      │
│                                                             │
│  "Consensus recommendations for ctDNA-guided adjuvant..."   │
│  Annals of Oncology, January 2026                           │
│  Cancer: Multi-solid tumor                                  │
│  → PubMed                                                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  💰 COVERAGE & REGULATORY                                   │
│  ─────────────────────                                      │
│                                                             │
│  Novitas LCD L39291: Expanded ctDNA coverage                │
│  Effective: February 1, 2026                                │
│  → View LCD                                                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Search Full Database]    [Manage Preferences]             │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  OpenOnco is a non-profit. No marketing, just references.   │
│  [Unsubscribe]                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Section Priority

If limited space or few updates, prioritize in this order:

1. **Guideline updates** (NCCN, ASCO, ESMO) - always include
2. **Trial results** - practice-changing data
3. **Coverage changes** - affects what physicians can order
4. **Key publications** - consensus statements, major trials
5. **Trial status changes** - recruiting → completed, etc.

---

## Personalization

Subscribers can filter by:
- **Cancer type**: Colorectal, Breast, Lung, Bladder, All
- **Content type**: Guidelines only, Trials only, Everything
- **Frequency**: Weekly (default), Biweekly, Monthly

If filtered, header shows: "Your digest: Colorectal cancer"

---

## Generation Logic

```javascript
// Pseudocode for digest generation

async function generateDigest(subscriber) {
  const weekStart = getLastFriday();
  const weekEnd = getThisFriday();
  
  // Get items from this week
  let items = await getGuidanceItems({
    dateRange: [weekStart, weekEnd],
    cancerTypes: subscriber.cancer_types || null,
    contentTypes: subscriber.content_types || null
  });
  
  // Get trial status changes
  let trialChanges = await getTrialStatusChanges({
    dateRange: [weekStart, weekEnd],
    cancerTypes: subscriber.cancer_types || null
  });
  
  // Group by section
  const sections = {
    guidelines: items.filter(i => i.evidence_type === 'guideline'),
    trials: items.filter(i => i.evidence_type === 'rct_results'),
    publications: items.filter(i => ['consensus', 'meta_analysis'].includes(i.evidence_type)),
    coverage: items.filter(i => i.source_type.startsWith('cms')),
    trialStatusChanges: trialChanges
  };
  
  // Render email
  return renderDigestEmail(sections, subscriber);
}
```

---

## Subject Lines

Format: `MRD Guidance: [highlight] + [count] more`

Examples:
- "MRD Guidance: NCCN Colon update + 4 more items"
- "MRD Guidance: CIRCULATE-Japan results published"
- "MRD Guidance: 6 new items this week"

If filtered:
- "MRD Guidance (Colorectal): NCCN update + 2 more"

---

## Technical Requirements

- **Sending**: Resend (existing integration)
- **Template**: React Email or MJML for responsive design
- **Scheduling**: Cron job Friday 7am ET
- **Tracking**: Open rate, click rate per section

---

## Future Enhancements

1. **Digest preview**: Web view before subscribing
2. **Custom alerts**: "Alert me when CIRCULATE results publish"
3. **RSS feed**: Alternative to email
4. **Slack integration**: For tumor boards
