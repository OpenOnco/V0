# OpenOnco Claude Context Files

These files provide context for AI assistants working on the OpenOnco project.

---

## Quick Start

**What is OpenOnco?**  
A non-profit database of 139+ cancer diagnostic tests, helping patients, clinicians, and researchers compare testing options.

**Live site:** https://openonco.org  
**Codebase:** `/Users/adickinson/Documents/GitHub/V0`

---

## Files in This Folder

| File | Purpose |
|------|---------|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | What OpenOnco is, tech stack, key workflows |
| [CODEBASE_ARCHITECTURE.md](./CODEBASE_ARCHITECTURE.md) | Directory structure, key files, routing |
| [TEST_CATEGORIES.md](./TEST_CATEGORIES.md) | HCT, ECD, MRD, TRM, TDS explained |
| [COMMON_TASKS.md](./COMMON_TASKS.md) | How-to for frequent operations |
| [MCP_TOOLS.md](./MCP_TOOLS.md) | Available MCP integrations |
| [VENDOR_RELATIONSHIPS.md](./VENDOR_RELATIONSHIPS.md) | Verification program, communications |

---

## Other Key Documentation

| File | Location | Purpose |
|------|----------|---------|
| SUBMISSION_PROCESS.md | `/V0/` | **Full process for adding/updating tests** |
| DEVELOPMENT_STATUS.md | `/V0/` | Current version, recent changes |
| CMS_MEDICARE_COVERAGE.md | `/V0/docs/` | Medicare coverage system |
| CLAUDE_CONTEXT.md | `/V0/` | General project context |

---

## Quick Commands

```bash
# Development
npm run dev              # Start local server
npm run test:smoke       # Quick tests
./preview                # Deploy to preview

# Find things in data.js
grep -n '"name": "Signatera"' src/data.js
grep -n "VENDOR_VERIFIED" src/data.js
```

---

## Category Quick Reference

| Stage | Code | URL | Example Tests |
|-------|------|-----|---------------|
| Risk | HCT | `/risk` | myRisk, BRACAnalysis |
| Screen | ECD | `/screen` | Galleri, Shield |
| Monitor | MRD/TRM | `/monitor` | Signatera, Guardant Reveal |
| Treat | TDS | `/treat` | FoundationOne CDx, Tempus xT |

---

## MCP Quick Reference

| Tool | Use For |
|------|---------|
| `OpenOnco MCP` | Query test database |
| `PubMed` | Validate citations |
| `CMS MCP` | Medicare coverage lookup |
| `Gmail` | Process vendor emails |
| `claude_code` | Complex coding tasks |
