# OpenGeno Build Plan

**A germline genetic testing database, forked from OpenOnco.**

## What We're Building

A standalone platform for comparing germline tests — exome/genome sequencing, NIPT, hereditary panels, carrier screening, pharmacogenomics. Same UX patterns as OpenOnco (test cards, comparison tables, detail modals, chat, vendor verification) but with a schema designed for germline from the ground up.

## Architecture

Fork of OpenOnco (React + Vite + Tailwind). Not a plugin or category addition — a separate repo, separate domain, separate deployment. The fork gives us the full UI framework (comparison engine, persona system, filters, chat, submission forms) without inheriting OpenOnco's oncology-specific data model.

## Data Model

Ryan's 108-field schema across 8 sheets, adapted to a flat JS structure (like OpenOnco's `data.js`). No PostgreSQL or Django — keep it simple. Key structural difference from OpenOnco: every field carries an evidence tier (direct / inferred / proprietary) so users can see at a glance what's verified vs. what's expert judgment vs. what's behind closed doors.

Categories: Rare Disease (WES/WGS), NIPT, Hereditary Cancer Panels, Cardiology Panels, Pharmacogenomics. More can be added later.

Minimum params per category drive the completeness badge, same as OpenOnco.

## Data Seeding (Hybrid Approach)

**Phase 1 — Crawler generates skeletons.** Build a GTR crawler that pulls structured data for target tests: lab name, CLIA number, methodology, genes covered, specimen type, TAT. ClinGen API populates gene-disease validity. HPO download maps genes to phenotypes. This gets us 50+ skeleton entries with ~40% of fields populated automatically.

**Phase 2 — Ryan curates and enriches.** For each skeleton, Ryan adds the expert-judgment fields: evidence tier annotations, clinical context, limitations, diagnostic yield sourcing (lab-specific vs. literature), guideline references, coverage information. This is the hard part and where domain expertise matters most. Target: 50 fully curated tests across 5 categories.

**Phase 3 — Ongoing monitoring.** Crawler system (like OpenOnco's test-data-tracker) watches for guideline updates, new validation studies, FDA actions, and lab announcements. Weekly submissions file, same triage workflow.

## Roles

**Alex** — Platform architecture, fork setup, crawler infrastructure, deployment, code review.

**Ryan** — Domain expertise, data curation, evidence tier classification, clinical validation of entries, community outreach to labs.

**Claude** — Crawler development, data enrichment, schema implementation, UI adaptation, ongoing triage.

## What Changes From OpenOnco

| Keep As-Is | Adapt | Build New |
|------------|-------|-----------|
| Test card grid + comparison modal | Data schema (108 fields, evidence tiers) | GTR crawler |
| Persona system (patient / clinician / researcher) | Category definitions + minimum params | ClinGen/HPO/OMIM integrations |
| Chat + system prompts framework | Field definitions + tooltips | Evidence tier UI (green/amber/red per field) |
| Vendor verification + submission flow | Cancer type filters → Gene/phenotype/indication filters | Transparency dashboard per test |
| Search + filter infrastructure | Chat persona prompts (genetic counselor tone) | Gene search (enter gene → see all covering tests) |
| Playwright test framework | Sitemap, SEO URLs | Phenotype search (HPO term → matching tests) |

## What We're NOT Building

- No Django, no PostgreSQL, no Airtable. Flat data file, same as OpenOnco.
- No peer review workflow in v1. Ryan curates, we trust his expertise. Add reviewer system later if the contributor base grows.
- No OMIM API integration in v1 (requires commercial license). Use free sources first (ClinGen, HPO, Orphanet, GTR).
- No mobile app. Web-only, responsive.

## MVP Definition

The platform is ready to share when:
- 50 tests curated across 5 categories with evidence tier annotations
- Test comparison works (side-by-side with evidence transparency)
- Gene search returns all tests covering a given gene
- Chat answers germline testing questions with appropriate persona tone
- Vendor submission form works for labs to contribute their own data

## Timeline

| Phase | What | Who |
|-------|------|-----|
| **1 — Fork & Schema** | Fork repo, strip oncology content, implement germline schema, build GTR crawler | Alex + Claude |
| **2 — Seed** | Seed 50 skeletons from GTR/ClinGen, adapt UI (categories, filters, field defs) | Alex + Claude |
| **3 — Curate** | Ryan enriches all 50 tests with evidence tiers and clinical context | Ryan |
| **4 — Features** | Evidence tier UI, gene/phenotype search, chat prompts | Alex + Claude |
| **5 — Launch** | Testing, polish, soft launch to beta users from Ryan's network | All |

## Open Questions for Ryan

1. Which 50 tests should we seed first? Ryan picks the highest-impact tests per category.
2. What does the genetic counselor chat persona sound like? Ryan drafts the tone guide.
3. Which labs are most likely to engage as vendor-verified contributors? Ryan's network is the pipeline.
