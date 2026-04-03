import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = resolve(__dirname, "../../evidence/scripts");

// ---------------------------------------------------------------------------
// We test notify.js by dynamically importing the module after mocking fetch.
// The module uses native fetch, so we mock globalThis.fetch.
// ---------------------------------------------------------------------------

describe("notify.js", () => {
  let originalEnv;
  let originalFetch;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalFetch = globalThis.fetch;
    process.env.RESEND_API_KEY = "re_test_key_123";
    process.env.EVIDENCE_NOTIFY_EMAIL = "test@openonco.org";
  });

  afterEach(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  function mockFetch(responseBody = { id: "email_abc123" }, status = 200) {
    const fn = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => responseBody,
      text: async () => JSON.stringify(responseBody),
    });
    globalThis.fetch = fn;
    return fn;
  }

  async function loadModule() {
    // Use a cache-busting query param to get a fresh import each time
    const mod = await import(`${SCRIPT_DIR}/notify.js?t=${Date.now()}-${Math.random()}`);
    return mod;
  }

  describe("notifyDispute", () => {
    it("sends a dispute email with correct subject and body", async () => {
      const fetchMock = mockFetch();
      const { notifyDispute } = await loadModule();

      const claim = {
        id: "CRC-DYNAMIC-001",
        finding: { description: "DYNAMIC trial showed ctDNA-guided management" },
        source: { title: "Tie et al., NEJM 2022" },
      };
      const dispute = {
        dispute_notes: "HR confidence interval includes 1.0",
        verified_by: "claude-verify",
        verified_date: "2026-04-01",
      };

      const result = await notifyDispute(claim, dispute);

      expect(result.id).toBe("email_abc123");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.resend.com/emails");
      expect(opts.method).toBe("POST");
      expect(opts.headers.Authorization).toBe("Bearer re_test_key_123");

      const body = JSON.parse(opts.body);
      expect(body.from).toBe("OpenOnco <notifications@openonco.org>");
      expect(body.to).toEqual(["test@openonco.org"]);
      expect(body.subject).toMatch(/\[OpenOnco\] Evidence dispute:/);
      expect(body.subject).toContain("DYNAMIC trial");
      expect(body.html).toContain("CRC-DYNAMIC-001");
      expect(body.html).toContain("HR confidence interval includes 1.0");
    });

    it("truncates long claim descriptions in subject", async () => {
      mockFetch();
      const { notifyDispute } = await loadModule();

      const claim = {
        id: "CRC-001",
        finding: { description: "A".repeat(100) },
        source: { title: "Test" },
      };

      await notifyDispute(claim, { dispute_notes: "test" });

      const body = JSON.parse(globalThis.fetch.mock.calls[0][1].body);
      expect(body.subject.length).toBeLessThan(120);
      expect(body.subject).toContain("...");
    });
  });

  describe("notifyNCCNUpdate", () => {
    it("sends NCCN update email with guideline and version in subject", async () => {
      const fetchMock = mockFetch();
      const { notifyNCCNUpdate } = await loadModule();

      const result = await notifyNCCNUpdate("Colon Cancer", "v2.2026");

      expect(result.id).toBe("email_abc123");
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.subject).toBe("[OpenOnco] NCCN Colon Cancer updated to v2.2026");
      expect(body.html).toContain("Colon Cancer");
      expect(body.html).toContain("v2.2026");
    });
  });

  describe("notifyPendingPublication", () => {
    it("sends pending publication email with URL as link", async () => {
      const fetchMock = mockFetch();
      const { notifyPendingPublication } = await loadModule();

      const result = await notifyPendingPublication(
        "ALTAIR 3-year follow-up",
        "https://example.com/altair"
      );

      expect(result.id).toBe("email_abc123");
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.subject).toBe("[OpenOnco] Pending publication: ALTAIR 3-year follow-up");
      expect(body.html).toContain("https://example.com/altair");
      expect(body.html).toContain("<a href=");
    });
  });

  describe("notifyAuditSummary", () => {
    it("sends audit summary with stats table", async () => {
      const fetchMock = mockFetch();
      const { notifyAuditSummary } = await loadModule();

      const summary = {
        date: "2026-04-01",
        totalClaims: 42,
        newClaims: 5,
        disputes: 2,
        pendingReview: 8,
        stale: 3,
        details: "All CRC claims up to date.",
      };

      const result = await notifyAuditSummary(summary);

      expect(result.id).toBe("email_abc123");
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.subject).toBe("[OpenOnco] Monthly evidence audit — 2026-04-01");
      expect(body.html).toContain("42");
      expect(body.html).toContain("All CRC claims up to date.");
    });
  });

  describe("error handling", () => {
    it("throws on missing RESEND_API_KEY", async () => {
      delete process.env.RESEND_API_KEY;
      mockFetch();
      const { notifyDispute } = await loadModule();

      await expect(
        notifyDispute({ id: "X" }, { dispute_notes: "test" })
      ).rejects.toThrow("RESEND_API_KEY");
    });

    it("throws on missing EVIDENCE_NOTIFY_EMAIL", async () => {
      delete process.env.EVIDENCE_NOTIFY_EMAIL;
      mockFetch();
      const { notifyDispute } = await loadModule();

      await expect(
        notifyDispute({ id: "X" }, { dispute_notes: "test" })
      ).rejects.toThrow("EVIDENCE_NOTIFY_EMAIL");
    });

    it("throws on Resend API error", async () => {
      mockFetch({ message: "Invalid API key" }, 401);
      const { notifyDispute } = await loadModule();

      await expect(
        notifyDispute({ id: "X" }, { dispute_notes: "test" })
      ).rejects.toThrow("Resend API error (401)");
    });
  });
});
