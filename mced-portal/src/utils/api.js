const API_BASE = 'https://www.openonco.org/api/v1';
const CACHE_KEY = 'mced-explorer-tests-v3';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Canonicalize cancer type names from the raw cancerTypeSensitivity arrays
const ALIASES = {
  'Liver/Bile-duct': 'Liver',
  'Liver/Bile Duct': 'Liver',
  'Stomach': 'Gastric',
  'Lymphoid Leukemia': 'Leukemia',
  'Myeloid Neoplasm': 'Leukemia',
  'Plasma Cell Neoplasm': 'Multiple Myeloma',
  'Non-Hodgkin Lymphoma': 'Lymphoma',
};

function canonicalize(name) {
  return ALIASES[name] || name;
}

/**
 * Compute all-stage per-cancer sensitivity from the raw
 * cancerTypeSensitivity array (overall.detected / overall.total).
 */
function computeAllStageCancers(rawArray) {
  if (!Array.isArray(rawArray)) return {};
  const map = {};
  for (const entry of rawArray) {
    const name = canonicalize(entry.cancerType);
    if (!name || !entry.overall || entry.overall.total === 0) continue;
    if (entry.overall.total < 5) continue; // min sample size
    // Keep larger sample if aliases collide
    if (map[name] && map[name]._n >= entry.overall.total) continue;
    map[name] = {
      value: Math.round((entry.overall.detected / entry.overall.total) * 1000) / 10,
      _n: entry.overall.total,
    };
  }
  const result = {};
  for (const [k, v] of Object.entries(map)) result[k] = v.value;
  return result;
}

export async function fetchMcedTests() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL_MS && Array.isArray(data)) {
        return data;
      }
    }
  } catch {
    sessionStorage.removeItem(CACHE_KEY);
  }

  const res = await fetch(`${API_BASE}/tests?category=ecd`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json();

  const allTests = json.data || json.tests || json;

  const tests = allTests
    .filter((t) => t.testScope?.includes('Multi-cancer'))
    .filter((t) => t.perCancerEarlyStageSensitivity != null)
    .map((t) => ({
      name: t.name,
      vendor: t.vendor,
      source: t.perCancerEarlyStageSensitivitySource || '',
      cancers: t.perCancerEarlyStageSensitivity || {},
      allStageCancers: computeAllStageCancers(t.cancerTypeSensitivity),
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
