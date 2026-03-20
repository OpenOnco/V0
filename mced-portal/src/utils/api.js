const API_BASE = 'https://openonco.org/api/v1';
const CACHE_KEY = 'mced-portal-tests';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch MCED tests from the OpenOnco API.
 * Caches in sessionStorage for the duration of the session.
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
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const json = await res.json();

  // Filter to Multi-cancer tests with detectedCancerTypes
  const tests = (json.tests || json.data || json)
    .filter(
      (t) =>
        t.testScope?.includes('Multi-cancer') &&
        Array.isArray(t.detectedCancerTypes) &&
        t.detectedCancerTypes.length > 0
    );

  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ data: tests, timestamp: Date.now() })
  );

  return tests;
}
