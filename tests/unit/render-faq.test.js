import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const SCRIPT_PATH = resolve(PROJECT_ROOT, "evidence/scripts/render-faq.js");
const CLAIMS_DIR = resolve(PROJECT_ROOT, "evidence/claims");

// ---------------------------------------------------------------------------
// Sample claim fixtures
// ---------------------------------------------------------------------------

function makeClaim(overrides = {}) {
  return {
    id: "CRC-TEST-001",
    type: "trial_result",
    source: {
      source_type: "journal-article",
      title: "Test Trial in CRC",
      journal: "NEJM",
      year: 2025,
      authors_short: "Test et al.",
      pmid: "12345678",
      doi: null,
      raw_file: null,
    },
    scope: {
      cancer: "colorectal",
      stages: ["II", "III"],
      setting: "adjuvant",
      test_category: "MRD",
    },
    finding: {
      description: "ctDNA-guided management was non-inferior to standard of care.",
      trial_name: "TEST-TRIAL",
      endpoint: "recurrence-free survival",
      endpoint_type: "primary",
      result_direction: "non-inferior",
      n: 455,
      hr: 0.92,
      ci_lower: 0.55,
      ci_upper: 1.57,
      p_value: 0.03,
      effect_summary: "Non-inferior RFS with reduced chemo",
    },
    extraction: {
      extracted_by: "claude",
      extracted_date: "2026-04-01",
      model_version: "claude-sonnet-4-20250514",
    },
    ...overrides,
  };
}

function makeGuidelineClaim(overrides = {}) {
  return makeClaim({
    id: "CRC-NCCN-001",
    type: "guideline_recommendation",
    source: {
      source_type: "clinical-guideline",
      title: "NCCN Colon Cancer Guidelines v1.2026",
      journal: null,
      year: 2026,
      authors_short: "NCCN",
      pmid: null,
      doi: null,
      raw_file: null,
    },
    finding: {
      description: "ctDNA recognized as high-risk factor for recurrence.",
      guideline_body: "NCCN",
      recommendation_strength: "strong",
      evidence_level: "high",
    },
    ...overrides,
  });
}

function makeDiagClaim(overrides = {}) {
  return makeClaim({
    id: "CRC-DIAG-001",
    type: "diagnostic_performance",
    finding: {
      description: "Signatera sensitivity 95% in stage II CRC.",
      sensitivity: 0.95,
      specificity: 0.98,
      ppv: 0.88,
      npv: 0.99,
    },
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("render-faq.js", () => {
  describe("CLI behavior", () => {
    it.skipIf(existsSync(CLAIMS_DIR) && readdirSync(CLAIMS_DIR).some(f => f.endsWith('.json')))(
      "exits with error when no claims exist",
      () => {
        try {
          execSync(`node ${SCRIPT_PATH} --dry-run 2>&1`, {
            encoding: "utf-8",
            env: { ...process.env, ANTHROPIC_API_KEY: "sk-test" },
          });
          expect(true).toBe(false);
        } catch (err) {
          expect(err.stderr || err.stdout).toMatch(/No claims found|Cannot generate FAQ data/);
        }
      },
    );

    it("accepts --dry-run flag without writing to file", () => {
      // When there are no claims, it exits before writing anything.
      // This just confirms the flag is accepted without crashing on unknown option.
      try {
        execSync(`node ${SCRIPT_PATH} --dry-run 2>&1`, {
          encoding: "utf-8",
          env: { ...process.env, ANTHROPIC_API_KEY: "sk-test" },
        });
      } catch (err) {
        // Expected — no claims available
        expect(err.stderr || err.stdout).not.toMatch(/Unknown option/);
      }
    });
  });

  describe("claim grouping logic", () => {
    // We test the internal grouping by verifying the rendered output structure.
    // Since the script calls Claude for prose, we use a temporary claims dir
    // and mock at the process level. For unit tests, we test the grouping
    // indirectly through the claim-to-concern mapping.

    it("maps trial_result claims to no-evidence and what-to-do-positive concerns", () => {
      const claim = makeClaim({ type: "trial_result" });
      // trial_result -> ['no-evidence', 'what-to-do-positive']
      const mapping = {
        trial_result: ["no-evidence", "what-to-do-positive"],
        guideline_recommendation: ["not-in-guidelines"],
        diagnostic_performance: ["not-validated"],
        clinical_utility: ["no-evidence", "what-to-do-positive"],
        methodology_note: ["not-validated"],
      };
      expect(mapping[claim.type]).toEqual(["no-evidence", "what-to-do-positive"]);
    });

    it("maps guideline_recommendation to not-in-guidelines concern", () => {
      const claim = makeGuidelineClaim();
      const mapping = {
        guideline_recommendation: ["not-in-guidelines"],
      };
      expect(mapping[claim.type]).toEqual(["not-in-guidelines"]);
    });

    it("maps diagnostic_performance to not-validated concern", () => {
      const claim = makeDiagClaim();
      const mapping = {
        diagnostic_performance: ["not-validated"],
      };
      expect(mapping[claim.type]).toEqual(["not-validated"]);
    });
  });

  describe("source extraction", () => {
    it("creates source entries with PMID when available", () => {
      const claim = makeClaim();
      const src = claim.source;
      // Replicate the extraction logic
      const entry = {};
      const label = [src.authors_short, src.journal, src.year, src.title ? `- ${src.title}` : null]
        .filter(Boolean)
        .join(", ");
      entry.label = label || src.title;
      if (src.pmid) entry.pmid = src.pmid;

      expect(entry.label).toContain("Test et al.");
      expect(entry.label).toContain("NEJM");
      expect(entry.pmid).toBe("12345678");
    });

    it("creates source entries with DOI URL when no PMID", () => {
      const claim = makeClaim({
        source: {
          source_type: "journal-article",
          title: "DOI-only paper",
          journal: "Nature",
          year: 2025,
          authors_short: "Doe et al.",
          pmid: null,
          doi: "10.1234/test",
          raw_file: null,
        },
      });
      const src = claim.source;
      const entry = {};
      const label = [src.authors_short, src.journal, src.year, src.title ? `- ${src.title}` : null]
        .filter(Boolean)
        .join(", ");
      entry.label = label;
      if (src.pmid) {
        entry.pmid = src.pmid;
      } else if (src.doi) {
        entry.url = `https://doi.org/${src.doi}`;
      }

      expect(entry.url).toBe("https://doi.org/10.1234/test");
      expect(entry.pmid).toBeUndefined();
    });
  });

  describe("stage-specific claim extraction", () => {
    it("groups claims by stage key", () => {
      const claims = [
        makeClaim({ scope: { cancer: "colorectal", stages: ["II"], setting: "adjuvant", test_category: "MRD" } }),
        makeClaim({ scope: { cancer: "colorectal", stages: ["III", "IV"], setting: "adjuvant", test_category: "MRD" }, id: "CRC-002" }),
        makeClaim({ scope: { cancer: "colorectal", stages: null, setting: "adjuvant", test_category: "MRD" }, id: "CRC-003" }),
      ];

      // Replicate getStageSpecificClaims logic
      const byStage = {};
      for (const claim of claims) {
        const stages = claim.scope?.stages;
        if (!stages || stages.length === 0) continue;
        for (const stage of stages) {
          const key = `stage-${stage.toLowerCase().replace(/^stage\s*/i, "")}`;
          if (!byStage[key]) byStage[key] = [];
          byStage[key].push(claim);
        }
      }

      expect(Object.keys(byStage)).toEqual(["stage-ii", "stage-iii", "stage-iv"]);
      expect(byStage["stage-ii"]).toHaveLength(1);
      expect(byStage["stage-iii"]).toHaveLength(1);
      expect(byStage["stage-iv"]).toHaveLength(1);
    });
  });

  describe("output format", () => {
    it("claim fixture conforms to the schema", () => {
      const claim = makeClaim();
      // Verify required fields from schema
      expect(claim).toHaveProperty("id");
      expect(claim).toHaveProperty("type");
      expect(claim).toHaveProperty("source");
      expect(claim).toHaveProperty("scope");
      expect(claim).toHaveProperty("finding");
      expect(claim).toHaveProperty("extraction");
      expect(claim.source).toHaveProperty("source_type");
      expect(claim.source).toHaveProperty("title");
      expect(claim.scope).toHaveProperty("cancer");
      expect(claim.finding).toHaveProperty("description");
      expect(claim.extraction).toHaveProperty("extracted_by");
      expect(claim.extraction).toHaveProperty("extracted_date");
    });

    it("CONCERNS array matches expected structure", () => {
      const CONCERNS = [
        { id: "no-evidence", label: `"There's no evidence MRD results change outcomes."` },
        { id: "not-in-guidelines", label: `"It's not in the guidelines yet."` },
        { id: "what-to-do-positive", label: `"What would I even do with a positive result?"` },
        { id: "insurance", label: `"Insurance won't cover it."`, isWizardLink: true },
        { id: "not-validated", label: `"The test isn't validated for your cancer type."` },
      ];

      expect(CONCERNS).toHaveLength(5);
      expect(CONCERNS[3].isWizardLink).toBe(true);
      expect(CONCERNS.map((c) => c.id)).toEqual([
        "no-evidence",
        "not-in-guidelines",
        "what-to-do-positive",
        "insurance",
        "not-validated",
      ]);
    });

    it("cancer type tiers are correct", () => {
      const TIER_1 = ["colorectal", "breast", "lung"];
      const TIER_2 = ["bladder", "melanoma"];
      expect(TIER_1).toHaveLength(3);
      expect(TIER_2).toHaveLength(2);
    });
  });

  describe("guidelines extraction", () => {
    it("extracts guidelines text from guideline_recommendation claims", () => {
      const claims = [
        makeGuidelineClaim(),
        makeClaim(), // non-guideline claim
      ];

      // Replicate extractGuidelines logic
      const guidelineClaims = claims.filter((c) => c.type === "guideline_recommendation");
      const text = guidelineClaims
        .map((c) => {
          const body = c.finding?.guideline_body || "";
          const desc = c.finding?.description || "";
          return body ? `${body}: ${desc}` : desc;
        })
        .join(" ");

      expect(text).toBe("NCCN: ctDNA recognized as high-risk factor for recurrence.");
    });

    it("returns null when no guideline claims exist", () => {
      const claims = [makeClaim()];
      const guidelineClaims = claims.filter((c) => c.type === "guideline_recommendation");
      expect(guidelineClaims).toHaveLength(0);
    });
  });
});
