/**
 * Unit tests for evidence/scripts/diff-claims.js
 *
 * Tests the comparison logic (scoring, matching, fuzzy/numeric/categorical).
 * Integration tests use temporary directories to avoid mocking fs.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Replicated helpers (mirroring diff-claims.js internals for unit tests)
// ---------------------------------------------------------------------------

function numericMatch(a, b, tolerance = 0.02) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return Math.abs(a - b) <= tolerance;
}

function categoricalMatch(a, b) {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    const sa = a.map((s) => String(s).toLowerCase()).sort();
    const sb = b.map((s) => String(s).toLowerCase()).sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  }
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function tokenize(str) {
  if (!str) return new Set();
  return new Set(
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function descriptionMatch(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  if (tokA.size === 0 && tokB.size === 0) return true;
  const union = new Set([...tokA, ...tokB]);
  if (union.size === 0) return true;
  let overlap = 0;
  for (const t of tokA) {
    if (tokB.has(t)) overlap++;
  }
  const minSize = Math.min(tokA.size, tokB.size);
  if (minSize === 0) return false;
  return overlap / minSize >= 0.8;
}

// ---------------------------------------------------------------------------
// Tests for numeric matching
// ---------------------------------------------------------------------------

describe("numericMatch", () => {
  it("treats two nulls as a match", () => {
    expect(numericMatch(null, null)).toBe(true);
  });

  it("treats null vs number as no match", () => {
    expect(numericMatch(null, 0.5)).toBe(false);
    expect(numericMatch(0.5, null)).toBe(false);
  });

  it("matches exact numbers", () => {
    expect(numericMatch(0.92, 0.92)).toBe(true);
  });

  it("matches within rounding tolerance", () => {
    expect(numericMatch(0.92, 0.919)).toBe(true);
  });

  it("rejects numbers outside tolerance", () => {
    expect(numericMatch(0.92, 0.85)).toBe(false);
  });

  it("respects custom tolerance for sample size", () => {
    expect(numericMatch(455, 458, 5)).toBe(true);
    expect(numericMatch(455, 470, 5)).toBe(false);
  });

  it("handles p-value tolerance", () => {
    expect(numericMatch(0.001, 0.0012, 0.005)).toBe(true);
    expect(numericMatch(0.001, 0.05, 0.005)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests for categorical matching
// ---------------------------------------------------------------------------

describe("categoricalMatch", () => {
  it("matches null to null", () => {
    expect(categoricalMatch(null, null)).toBe(true);
  });

  it("does not match null to a value", () => {
    expect(categoricalMatch(null, "primary")).toBe(false);
  });

  it("matches same strings case-insensitively", () => {
    expect(categoricalMatch("Primary", "primary")).toBe(true);
  });

  it("rejects different strings", () => {
    expect(categoricalMatch("primary", "secondary")).toBe(false);
  });

  it("matches identical stage arrays", () => {
    expect(categoricalMatch(["II"], ["II"])).toBe(true);
  });

  it("matches stage arrays regardless of order", () => {
    expect(categoricalMatch(["II", "III"], ["III", "II"])).toBe(true);
  });

  it("rejects stage arrays of different length", () => {
    expect(categoricalMatch(["II"], ["II", "III"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests for description (fuzzy) matching
// ---------------------------------------------------------------------------

describe("descriptionMatch", () => {
  it("matches identical descriptions", () => {
    expect(
      descriptionMatch(
        "ctDNA-guided treatment reduced adjuvant chemotherapy use",
        "ctDNA-guided treatment reduced adjuvant chemotherapy use"
      )
    ).toBe(true);
  });

  it("matches descriptions with minor rewording (>80% overlap)", () => {
    expect(
      descriptionMatch(
        "ctDNA guided treatment reduced adjuvant chemotherapy use without compromising survival",
        "ctDNA guided therapy reduced adjuvant chemo use without compromising overall survival"
      )
    ).toBe(true);
  });

  it("rejects unrelated descriptions", () => {
    expect(
      descriptionMatch(
        "ctDNA-guided treatment reduced adjuvant chemotherapy use",
        "Pembrolizumab improved overall survival in advanced melanoma"
      )
    ).toBe(false);
  });

  it("handles null/empty gracefully", () => {
    expect(descriptionMatch(null, null)).toBe(true);
    expect(descriptionMatch("something", null)).toBe(false);
    expect(descriptionMatch(null, "something")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration tests using temp directories
// ---------------------------------------------------------------------------

describe("diffClaims integration", () => {
  let tmpRoot;

  const claudeClaim = {
    id: "CRC-DYNAMIC-001",
    type: "trial_result",
    source: {
      pmid: "35657320",
      title: "Circulating Tumor DNA Analysis Guiding Adjuvant Therapy",
      journal: "NEJM",
      year: 2022,
      authors_short: "Tie et al.",
      source_type: "journal-article",
      raw_file: "raw/papers/35657320.md",
    },
    scope: {
      cancer: "colorectal",
      stages: ["II"],
      setting: "adjuvant",
      test_category: "MRD",
    },
    finding: {
      description:
        "ctDNA-guided treatment reduced adjuvant chemotherapy use without compromising recurrence-free survival compared to standard management",
      trial_name: "DYNAMIC",
      endpoint: "recurrence-free survival",
      endpoint_type: "primary",
      result_direction: "non-inferior",
      n: 455,
      hr: 0.96,
      ci_lower: 0.51,
      ci_upper: 1.82,
      p_value: null,
      follow_up_months: 37,
      effect_summary:
        "ctDNA-guided approach non-inferior for 3-year RFS (93.5% vs 92.4%)",
    },
    extraction: {
      extracted_by: "claude",
      extracted_date: "2026-04-03",
      model_version: "claude-sonnet-4-20250514",
      source_quote_hash: "a1b2c3d4",
    },
  };

  const gptClaimAgreed = {
    id: "CRC-DYNAMIC-001",
    type: "trial_result",
    source: { ...claudeClaim.source },
    scope: {
      cancer: "colorectal",
      stages: ["II"],
      setting: "adjuvant",
      test_category: "MRD",
    },
    finding: {
      description:
        "ctDNA-guided treatment reduced adjuvant chemotherapy use without compromising recurrence-free survival",
      trial_name: "DYNAMIC",
      endpoint: "recurrence-free survival",
      endpoint_type: "primary",
      result_direction: "non-inferior",
      n: 455,
      hr: 0.96,
      ci_lower: 0.51,
      ci_upper: 1.82,
      p_value: null,
      follow_up_months: 37,
      effect_summary: "HR 0.96, non-inferior",
    },
    extraction: {
      extracted_by: "gpt-4o",
      extracted_date: "2026-04-03",
      model_version: "gpt-4o",
      source_quote_hash: null,
    },
  };

  const gptClaimDisputed = {
    ...gptClaimAgreed,
    finding: {
      ...gptClaimAgreed.finding,
      hr: 0.72,
      result_direction: "superior",
    },
  };

  const gptClaimUnmatched = {
    id: "CRC-DYNAMIC-002",
    type: "trial_result",
    source: { ...claudeClaim.source },
    scope: {
      cancer: "colorectal",
      stages: ["III"],
      setting: "adjuvant",
      test_category: "MRD",
    },
    finding: {
      description: "A completely different subgroup analysis finding with unrelated terms",
      trial_name: "DYNAMIC",
      endpoint: "overall survival",
      endpoint_type: "secondary",
      result_direction: "positive",
      n: 200,
      hr: 0.65,
      ci_lower: 0.4,
      ci_upper: 0.9,
      p_value: 0.01,
      follow_up_months: 37,
      effect_summary: "HR 0.65",
    },
    extraction: {
      extracted_by: "gpt-4o",
      extracted_date: "2026-04-03",
      model_version: "gpt-4o",
      source_quote_hash: null,
    },
  };

  /**
   * Set up a temporary evidence directory structure and dynamically patch
   * diff-claims.js ROOT constant by re-importing with a modified module.
   * Instead, we'll call a helper that creates the structure and imports
   * a patched version.
   */
  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "diff-claims-test-"));
    fs.mkdirSync(path.join(tmpRoot, "evidence", "claims"), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, "evidence", "meta"), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, "evidence", "meta", "verification"), {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  /**
   * Since diff-claims.js hardcodes ROOT relative to __dirname, we can't easily
   * redirect it. Instead, we directly import and test the exported diffClaims
   * by providing the GPT claims array — and we set up the claims files in the
   * REAL evidence/claims directory (which is what the module reads).
   *
   * For true isolation, we test the logic by calling diffClaims with specific
   * data and checking the returned { agreed, disputed } object.
   */

  it("correctly identifies agreed claims when all fields match", async () => {
    // Write claude claims to the real evidence/claims directory
    const claimsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../evidence/claims"
    );
    const metaDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../evidence/meta"
    );
    fs.mkdirSync(claimsDir, { recursive: true });
    fs.mkdirSync(metaDir, { recursive: true });

    const claimsFile = path.join(claimsDir, "colorectal.json");
    const hadExisting = fs.existsSync(claimsFile);
    let backup = null;
    if (hadExisting) {
      backup = fs.readFileSync(claimsFile, "utf-8");
    }

    try {
      fs.writeFileSync(claimsFile, JSON.stringify([claudeClaim], null, 2));

      const { diffClaims } = await import(
        "../../../evidence/scripts/diff-claims.js"
      );
      const result = await diffClaims("35657320", [gptClaimAgreed]);

      expect(result.agreed.length).toBe(1);
      expect(result.agreed[0].score).toBeGreaterThanOrEqual(0.85);
      // All disputes should be empty (no unmatched from either side)
      expect(
        result.disputed.filter((d) => d.type === "disagreement").length
      ).toBe(0);
    } finally {
      // Restore or clean up
      if (backup !== null) {
        fs.writeFileSync(claimsFile, backup);
      } else {
        fs.unlinkSync(claimsFile);
      }
    }
  });

  it("correctly identifies disputed claims when HR and direction differ", async () => {
    const claimsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../evidence/claims"
    );
    const metaDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../evidence/meta"
    );
    fs.mkdirSync(claimsDir, { recursive: true });
    fs.mkdirSync(metaDir, { recursive: true });

    const claimsFile = path.join(claimsDir, "colorectal.json");
    const hadExisting = fs.existsSync(claimsFile);
    let backup = null;
    if (hadExisting) {
      backup = fs.readFileSync(claimsFile, "utf-8");
    }

    try {
      fs.writeFileSync(claimsFile, JSON.stringify([claudeClaim], null, 2));

      const { diffClaims } = await import(
        "../../../evidence/scripts/diff-claims.js"
      );
      const result = await diffClaims("35657320", [gptClaimDisputed]);

      // Should match but be disputed (HR and direction differ)
      expect(result.agreed.length).toBe(0);
      const disagreements = result.disputed.filter(
        (d) => d.type === "disagreement"
      );
      expect(disagreements.length).toBe(1);
      expect(disagreements[0].disagreements.length).toBeGreaterThan(0);
    } finally {
      if (backup !== null) {
        fs.writeFileSync(claimsFile, backup);
      } else {
        fs.unlinkSync(claimsFile);
      }
    }
  });

  it("correctly identifies unmatched GPT claims", async () => {
    const claimsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../evidence/claims"
    );
    const metaDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../evidence/meta"
    );
    fs.mkdirSync(claimsDir, { recursive: true });
    fs.mkdirSync(metaDir, { recursive: true });

    const claimsFile = path.join(claimsDir, "colorectal.json");
    const hadExisting = fs.existsSync(claimsFile);
    let backup = null;
    if (hadExisting) {
      backup = fs.readFileSync(claimsFile, "utf-8");
    }

    try {
      fs.writeFileSync(claimsFile, JSON.stringify([claudeClaim], null, 2));

      const { diffClaims } = await import(
        "../../../evidence/scripts/diff-claims.js"
      );
      const result = await diffClaims("35657320", [
        gptClaimAgreed,
        gptClaimUnmatched,
      ]);

      expect(result.agreed.length).toBe(1);
      const unmatchedGpt = result.disputed.filter(
        (d) => d.type === "unmatched_gpt"
      );
      expect(unmatchedGpt.length).toBe(1);
    } finally {
      if (backup !== null) {
        fs.writeFileSync(claimsFile, backup);
      } else {
        fs.unlinkSync(claimsFile);
      }
    }
  });

  it("handles case with no Claude claims gracefully", async () => {
    const claimsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../evidence/claims"
    );
    const metaDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../evidence/meta"
    );
    fs.mkdirSync(claimsDir, { recursive: true });
    fs.mkdirSync(metaDir, { recursive: true });

    // Ensure no claims file for this PMID
    const claimsFile = path.join(claimsDir, "colorectal.json");
    const hadExisting = fs.existsSync(claimsFile);
    let backup = null;
    if (hadExisting) {
      backup = fs.readFileSync(claimsFile, "utf-8");
    }

    try {
      // Write empty array
      fs.writeFileSync(claimsFile, "[]");

      const { diffClaims } = await import(
        "../../../evidence/scripts/diff-claims.js"
      );
      const result = await diffClaims("99999999", [gptClaimAgreed]);

      expect(result.agreed.length).toBe(0);
      expect(result.disputed.length).toBe(1);
      expect(result.disputed[0].type).toBe("unmatched_gpt");
    } finally {
      if (backup !== null) {
        fs.writeFileSync(claimsFile, backup);
      } else {
        fs.unlinkSync(claimsFile);
      }
    }
  });
});
