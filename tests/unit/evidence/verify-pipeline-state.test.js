import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { checkDataTestsIntegrity } from "../../../evidence/scripts/verify-pipeline-state.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCRIPT = resolve(__dirname, "../../../evidence/scripts/verify-pipeline-state.js");

/**
 * These tests exercise the script as a subprocess against a synthetic
 * "evidence/" tree inside the real project. We use a unique PMID range
 * so we don't collide with real content, then clean up.
 */

function runScript(cwd, args = []) {
  const r = spawnSync("node", [SCRIPT, "--json", ...args], {
    cwd,
    encoding: "utf-8",
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe("verify-pipeline-state", () => {
  // We work against a separate temp project root so we don't mutate the real
  // evidence/ tree. The script resolves PROJECT_ROOT relative to its own
  // location, so we copy the script into a temp tree.
  let tmp;
  let evidence;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "verify-pipeline-"));
    evidence = join(tmp, "evidence");
    mkdirSync(join(evidence, "scripts"), { recursive: true });
    mkdirSync(join(evidence, "raw", "papers"), { recursive: true });
    mkdirSync(join(evidence, "meta"), { recursive: true });
    mkdirSync(join(evidence, "claims"), { recursive: true });
    // Copy script into temp tree so __dirname resolves there.
    execSync(`cp "${SCRIPT}" "${join(evidence, "scripts", "verify-pipeline-state.js")}"`);
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function localScript() {
    return join(evidence, "scripts", "verify-pipeline-state.js");
  }

  function run(args = []) {
    const r = spawnSync("node", [localScript(), "--json", ...args], {
      encoding: "utf-8",
    });
    let parsed = {};
    try {
      parsed = JSON.parse(r.stdout || "{}");
    } catch {
      parsed = { _parseFailed: true, _stdout: r.stdout, _stderr: r.stderr };
    }
    return { code: r.status, parsed, stdout: r.stdout, stderr: r.stderr };
  }

  it("passes with empty state", () => {
    writeFileSync(join(evidence, "meta", "sources.json"), "{}");
    const r = run();
    if (r.parsed._parseFailed) {
      throw new Error(`Subprocess failed. code=${r.code}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
    }
    expect(r.code).toBe(0);
    expect(r.parsed.ok).toBe(true);
  });

  it("fails when sources.json references a missing raw paper", () => {
    writeFileSync(
      join(evidence, "meta", "sources.json"),
      JSON.stringify({
        "99999001": {
          title: "Fake",
          raw_file: "raw/papers/99999001.md",
        },
      })
    );
    const { code, parsed } = run();
    expect(code).toBe(1);
    expect(parsed.ok).toBe(false);
    expect(parsed.errors.join("\n")).toMatch(/raw_file=raw\/papers\/99999001\.md but file does not exist/);
  });

  it("fails when a raw paper is on disk but not registered", () => {
    writeFileSync(join(evidence, "meta", "sources.json"), "{}");
    writeFileSync(join(evidence, "raw", "papers", "88888001.md"), "# orphan");
    const { code, parsed } = run();
    expect(code).toBe(1);
    expect(parsed.errors.join("\n")).toMatch(/Orphan paper on disk.*88888001\.md/);
  });

  it("fails when a claim references an unregistered PMID", () => {
    writeFileSync(join(evidence, "meta", "sources.json"), "{}");
    writeFileSync(
      join(evidence, "claims", "test.json"),
      JSON.stringify([{ id: "X", source: { pmid: "77777001" } }])
    );
    const { code, parsed } = run();
    expect(code).toBe(1);
    expect(parsed.errors.join("\n")).toMatch(/Claim references PMID 77777001/);
  });

  it("passes when sources, papers, and claims are aligned", () => {
    writeFileSync(
      join(evidence, "meta", "sources.json"),
      JSON.stringify({
        "12345001": { title: "Real", raw_file: "raw/papers/12345001.md" },
      })
    );
    writeFileSync(join(evidence, "raw", "papers", "12345001.md"), "# real");
    writeFileSync(
      join(evidence, "claims", "test.json"),
      JSON.stringify([{ id: "X", source: { pmid: "12345001" } }])
    );
    const { code, parsed } = run();
    expect(code).toBe(0);
    expect(parsed.ok).toBe(true);
    expect(parsed.stats.sources_pmid_count).toBe(1);
    expect(parsed.stats.raw_paper_file_count).toBe(1);
    expect(parsed.stats.claims_unique_pmids).toBe(1);
  });

  it("fails when --expected-head does not match actual HEAD", () => {
    writeFileSync(join(evidence, "meta", "sources.json"), "{}");
    const { code, parsed } = run(["--expected-head", "deadbeefdeadbeef"]);
    // git may or may not be reachable from the temp tree — but if --expected-head
    // is set and HEAD doesn't match (or is null), we must fail.
    expect(code).toBe(1);
    expect(parsed.ok).toBe(false);
  });
});

describe("checkDataTestsIntegrity (truncation guard)", () => {
  let tmp;
  let dataDir;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "data-integrity-"));
    dataDir = join(tmp, "src", "data", "tests");
    mkdirSync(dataDir, { recursive: true });
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function makeArr(n) {
    return Array.from({ length: n }, (_, i) => ({ id: `t-${i}`, name: `Test ${i}` }));
  }

  it("passes when entries and bytes are unchanged", () => {
    const arr = makeArr(34);
    const text = JSON.stringify(arr, null, 2);
    writeFileSync(join(dataDir, "ecd.json"), text);
    const { errors, summary } = checkDataTestsIntegrity({
      dataTestsDir: dataDir,
      filenames: ["ecd.json"],
      showPrev: () => text,
    });
    expect(errors).toEqual([]);
    expect(summary["ecd.json"].entries).toBe(34);
    expect(summary["ecd.json"].entry_shrink).toBe(0);
  });

  it("fails when array shrinks by >25% (ecd.json regression)", () => {
    // Reproduce the 2026-05-09 incident: 34 entries → 1 entry
    const prev = JSON.stringify(makeArr(34), null, 2);
    const truncated = JSON.stringify(makeArr(1), null, 2);
    writeFileSync(join(dataDir, "ecd.json"), truncated);
    const { errors, summary } = checkDataTestsIntegrity({
      dataTestsDir: dataDir,
      filenames: ["ecd.json"],
      showPrev: () => prev,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toMatch(/array entries shrank/);
    expect(summary["ecd.json"].prev_entries).toBe(34);
    expect(summary["ecd.json"].entries).toBe(1);
  });

  it("fails when bytes shrink by >25% even if entry count is similar", () => {
    // One entry stuffed with detail vs same shape with stub fields
    const prev = JSON.stringify(
      makeArr(34).map((t) => ({ ...t, long: "x".repeat(500) })),
      null,
      2
    );
    const tiny = JSON.stringify(makeArr(34), null, 2);
    writeFileSync(join(dataDir, "ecd.json"), tiny);
    const { errors } = checkDataTestsIntegrity({
      dataTestsDir: dataDir,
      filenames: ["ecd.json"],
      showPrev: () => prev,
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join("\n")).toMatch(/byte size shrank/);
  });

  it("allows growth — adding entries is fine", () => {
    const prev = JSON.stringify(makeArr(34), null, 2);
    const grown = JSON.stringify(makeArr(38), null, 2);
    writeFileSync(join(dataDir, "ecd.json"), grown);
    const { errors } = checkDataTestsIntegrity({
      dataTestsDir: dataDir,
      filenames: ["ecd.json"],
      showPrev: () => prev,
    });
    expect(errors).toEqual([]);
  });

  it("flags invalid JSON immediately (covers the trailing-comma truncation case)", () => {
    // The actual ecd.json fa0be75 truncation produced invalid JSON ("...}, ")
    writeFileSync(join(dataDir, "ecd.json"), '[{"id":"t-0","name":"Test 0"},');
    const { errors } = checkDataTestsIntegrity({
      dataTestsDir: dataDir,
      filenames: ["ecd.json"],
      showPrev: () => JSON.stringify(makeArr(34)),
    });
    expect(errors.join("\n")).toMatch(/invalid JSON/);
  });

  it("treats missing baseline (new file) as pass", () => {
    const arr = makeArr(3);
    writeFileSync(join(dataDir, "ecd.json"), JSON.stringify(arr, null, 2));
    const { errors, summary } = checkDataTestsIntegrity({
      dataTestsDir: dataDir,
      filenames: ["ecd.json"],
      showPrev: () => null,
    });
    expect(errors).toEqual([]);
    expect(summary["ecd.json"].baseline).toBe("none");
  });

  it("fails fast when file is missing entirely", () => {
    const { errors } = checkDataTestsIntegrity({
      dataTestsDir: dataDir,
      filenames: ["ecd.json"],
      showPrev: () => null,
    });
    expect(errors.join("\n")).toMatch(/file missing/);
  });
});
