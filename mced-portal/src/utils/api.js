const API_BASE = 'https://www.openonco.org/api/v1';
const CACHE_KEY = 'mced-explorer-tests-v2';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch MCED tests from the OpenOnco API.
 * Auto-detects which tests to show:
 *   - Tests with populated perCancerEarlyStageSensitivity → traffic lights
 *   - Tests with empty {} → stamp ("no per-cancer data published")
 * No hardcoded test list — the API is the single source of truth.
 */
export async function fetchMcedTests() {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_TTL_MS) {
      return data;
    }
  }

  const res = await fetch(`${API_BASE}/tests?category=ecd`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();

  const allTests = json.data || json.tests || json;

  const tests = allTests
    .filter((t) => t.testScope?.includes('Multi-cancer'))
    .filter((t) => t.perCancerEarlyStageSensitivity != null) // includes {} and populated objects
    .map((t) => ({
      name: t.name,
      vendor: t.vendor,
      source: t.perCancerEarlyStageSensitivitySource || '',
      cancers: t.perCancerEarlyStageSensitivity || {},
      // Study metadata for research framing
      sensitivity: t.sensitivity || null,
      specificity: t.specificity || null,
      stageISensitivity: t.stageISensitivity || null,
      stageIISensitivity: t.stageIISensitivity || null,
      totalParticipants: t.totalParticipants || null,
      fdaStatus: t.fdaStatus || null,
      performanceNotes: t.performanceNotes || null,
    }));

  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ data: tests, timestamp: Date.now() })
  );

  return tests;
}
