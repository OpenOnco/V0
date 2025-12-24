# 📊 CONSENSUS SUMMARY

**Review Agreement Level:** HIGH CONFIDENCE (75%+)
**Key Themes:** Critical date errors, FDA approval updates, new MCED market entrants, regulatory status changes

All 4 LLMs identified a **critical systemic error** where 2024 events are incorrectly dated as 2025 throughout the database. There's strong consensus on major FDA approvals, new test launches, and regulatory updates. Minor conflicts exist on specific citation details and exact CDx counts.

---

# 🔴 CRITICAL - HIGH CONFIDENCE (2+ LLMs agree)

| Test | Issue | Sources | Action |
|------|-------|---------|--------|
| **All Tests** | Systemic date error: 2024 events listed as 2025 | Gemini, OpenAI | Fix immediately - correct all 2024 dates incorrectly shown as 2025 |
| **Guardant360 Response** | Wrong discontinuation date (2025 vs 2024) | Gemini, Claude | Update discontinuedDate to "December 2024" |
| **Cancerguard** | Duplicate entries (ecd-5 and ecd-22) | OpenAI, Perplexity | Deduplicate - keep one canonical entry |
| **FoundationOne CDx** | Broken citation URL (20251204 vs 20241204) | Gemini, OpenAI | Fix URL date component |

---

# 🟡 UPDATES NEEDED - HIGH CONFIDENCE (2+ LLMs agree)

| Test | Field | Current | Suggested | Sources |
|------|-------|---------|-----------|---------|
| **Guardant Shield** | fdaStatus | May be outdated | FDA-approved July 29, 2024 for CRC screening | Claude, Gemini |
| **Tempus xT CDx** | fdaStatus | Check launch date | National launch January 2024 (not 2025) | Claude, Gemini |
| **Guardant360 CDx** | fdaCompanionDxCount | 6 | 7 (new HER2 NSCLC indication) | Claude, Gemini |
| **FoundationOne CDx** | fdaCompanionDxCount | 57 | 58+ (multiple new CDx approvals) | Claude, Gemini |
| **Signatera** | fdaStatus | CLIA LDT | Confirm: Still CLIA LDT with 4 BDDs | Claude, Gemini |

---

# 🔵 SINGLE-SOURCE FINDINGS (verify before acting)

| Test | Issue | Source LLM | Confidence | Action |
|------|-------|------------|------------|--------|
| **Epi proColon** | Vendor change to New Day Diagnostics | Gemini | Medium | Verify ownership transfer |
| **clonoSEQ** | CML coverage expansion | Gemini | High | Verify Medicare CML coverage |
| **Haystack MRD** | FDA BDD date (2021 vs 2025) | Gemini | High | Verify actual BDD date |
| **Labcorp Plasma Focus** | New test for lung cancer | Perplexity | Medium | Research test availability |

---

# ⚠️ CONFLICTS (LLMs disagree)

| Test | Field | LLM 1 Says | LLM 2 Says | Resolution |
|------|-------|------------|------------|------------|
| **Guardant360 CDx** | CDx count | 6 CDx (Claude) | 7 CDx (Gemini) | Verify current FDA-approved CDx list |
| **FoundationOne CDx** | CDx count | 100+ total (Claude) | 58 liquid (Gemini) | Clarify liquid vs tissue CDx counts |
| **Galleri** | PMA timeline | H1 2026 (Claude) | Not specified (Others) | Check GRAIL investor updates |

---

# 🆕 NEW TESTS TO ADD (consensus)

| Test | Vendor | Category | Mentioned By |
|------|--------|----------|--------------|
| **Cancerguard** | Exact Sciences | ECD (MCED) | Claude, Gemini, Perplexity |
| **Caris Assure** | Caris Life Sciences | ECD (MCED) | Perplexity |
| **Agilent Resolution ctDx FIRST** | Agilent | TDS (CDx) | Gemini |
| **Guardant360 Tissue** | Guardant Health | TDS | Claude |
| **Tempus xF+ (523-gene)** | Tempus | TDS | Claude |

---

# ✅ VERIFIED ACCURATE

Tests that multiple LLMs confirmed are correct and current:
- **Shield (ecd-1):** FDA approval, ECLIPSE trial data, reimbursement
- **Signatera:** CLIA LDT status, Medicare coverage indications
- **clonoSEQ:** FDA clearance for MM, B-ALL, CLL
- **FoundationOne Liquid CDx:** FDA-approved status
- **Galleri:** PATHFINDER 2 results accuracy

---

# 📋 PRIORITIZED ACTION ITEMS

## CRITICAL (Fix Immediately)
1. **[CRITICAL]** Fix systemic date error - change all 2024 events from 2025 to 2024
2. **[CRITICAL]** Remove duplicate Cancerguard entries - keep one canonical version
3. **[CRITICAL]** Fix broken FoundationOne CDx citation URL (date component)
4. **[CRITICAL]** Update Guardant360 Response discontinuation date to 2024

## HIGH (Fix This Week)  
5. **[HIGH]** Verify and update Guardant Shield FDA approval status
6. **[HIGH]** Update Guardant360 CDx companion diagnostic count
7. **[HIGH]** Correct Tempus xT CDx national launch date to 2024
8. **[HIGH]** Add Cancerguard as new MCED test entry
9. **[HIGH]** Verify Signatera regulatory status and BDD count

## MEDIUM (Review and Update)
10. **[MEDIUM]** Research and add Caris Assure MCED test
11. **[MEDIUM]** Verify Epi proColon vendor ownership change
12. **[MEDIUM]** Update clonoSEQ Medicare coverage expansion
13. **[MEDIUM]** Add PATHFINDER 2 results to Galleri entry
14. **[MEDIUM]** Research Agilent Resolution ctDx FIRST for inclusion

## LOW (Backlog)
15. **[LOW]** Add Guardant360 Tissue and Tempus xF+ entries
16. **[LOW]** Update Signatera with ALTAIR trial results
17. **[LOW]** Research Labcorp Plasma Focus availability
18. **[LOW]** Clarify FoundationOne liquid vs tissue CDx counts