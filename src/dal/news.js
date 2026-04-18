// News DAL — homepage hero + feed + vendor sidebar hooks.
//
// All fetches use same-origin /api/news/* paths. Vercel rewrites them to
// https://news.openonco.org/api/news/* (BaseCall), so the browser never sees
// a cross-origin request — no CORS, no per-env API base URL.
//
// Article detail pages live at /news/:id and are served by BaseCall SSR via
// the same rewrite. The DAL deliberately exposes NO useArticle hook — detail
// rendering happens server-side.

import { useEffect, useState } from 'react';

const API_BASE = '/api/news';

const _fetchJson = async (url, { signal } = {}) => {
  const resp = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!resp.ok) {
    throw new Error(`news fetch ${resp.status}: ${url}`);
  }
  return resp.json();
};

// Generic hook scaffold — tracks items/loading/error + supports refetch.
const _useEndpoint = (url) => {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    _fetchJson(url, { signal: controller.signal })
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ data: null, loading: false, error });
      });
    return () => controller.abort();
  }, [url]);
  return state;
};

export const useNewsFeed = ({ vertical, limit = 12 } = {}) => {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (vertical) params.set('vertical', vertical);
  const { data, loading, error } = _useEndpoint(`${API_BASE}/feed?${params.toString()}`);
  return {
    items: data?.items ?? [],
    count: data?.count ?? 0,
    loading,
    error,
  };
};

export const useHeroArticle = () => {
  const { data, loading, error } = _useEndpoint(`${API_BASE}/hero`);
  return { hero: data?.hero ?? null, loading, error };
};

export const useVendorNews = (ticker, { limit = 5 } = {}) => {
  const url = ticker
    ? `${API_BASE}/vendor/${encodeURIComponent(ticker)}?limit=${limit}`
    : null;
  const state = _useEndpoint(url);
  return {
    items: state.data?.items ?? [],
    count: state.data?.count ?? 0,
    loading: state.loading,
    error: state.error,
    enabled: Boolean(ticker),
  };
};
