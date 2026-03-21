const API_BASE = 'https://www.openonco.org/api/v1';
const CACHE_KEY = 'mced-explorer-tests';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch MCED tests from the OpenOnco API and transform into the
 * portal's data format: { name, vendor, price, source, cancers }.
 *
 * Only includes tests with perCancerEarlyStageSensitivity data
 * or tests explicitly known to have no data (like Shield MCD).
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
    .filter((t) => t.testScope?.includes('Multi-cancer') && t.indicationGroup === 'MCED')
    .filter((t) => t.perCancerEarlyStageSensitivity !== undefined)
    .map((t) => ({
      name: t.name,
      vendor: t.vendor,
      price: t.listPrice || null,
      source: t.perCancerEarlyStageSensitivitySource || '',
      cancers: t.perCancerEarlyStageSensitivity || {},
    }));

  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ data: tests, timestamp: Date.now() })
  );

  return tests;
}
