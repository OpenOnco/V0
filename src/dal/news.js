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
const AACR_API_BASE = '/api/aacr';

const _fetchJson = async (url, { signal } = {}) => {
  const resp = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!resp.ok) {
    throw new Error(`news fetch ${resp.status}: ${url}`);
  }
  return resp.json();
};

// Generic hook scaffold — tracks items/loading/error + supports refetch.
const _useEndpoint = (url) => {
  const [state, setState] = useState({ data: null, loading: Boolean(url), error: null });
  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
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

export const useAacrHome = () => {
  const { data, loading, error } = _useEndpoint(`${AACR_API_BASE}/home`);
  return {
    takeoverActive: Boolean(data?.takeover_active),
    conference: data?.conference ?? null,
    officialLinks: data?.official_links ?? {},
    hero: data?.hero ?? null,
    latest: data?.latest ?? [],
    lateBreakers: data?.late_breakers ?? [],
    plenaries: data?.plenaries ?? [],
    vendorAnnouncements: data?.vendor_announcements ?? [],
    loading,
    error,
  };
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

// --- Mutations (editor mode) ---

const EDIT_API = '/api/edit';
const EDIT_SECRET = import.meta.env.VITE_EDIT_SECRET || 'openonco-edit-2026';
const _editHeaders = { 'X-Edit-Secret': EDIT_SECRET };

export const pinArticle = async (id) => {
  const resp = await fetch(`${EDIT_API}/${id}/pin`, { method: 'POST', headers: _editHeaders });
  if (!resp.ok) throw new Error(`pin failed: ${resp.status}`);
  return resp.json();
};

export const unpinArticle = async (id) => {
  const resp = await fetch(`${EDIT_API}/${id}/unpin`, { method: 'POST', headers: _editHeaders });
  if (!resp.ok) throw new Error(`unpin failed: ${resp.status}`);
  return resp.json();
};

export const killArticle = async (id) => {
  const resp = await fetch(`${EDIT_API}/${id}/kill`, { method: 'POST', headers: _editHeaders });
  if (!resp.ok) throw new Error(`kill failed: ${resp.status}`);
  return resp.json();
};

export const updateArticle = async (id, { headline, deck, body_html }) => {
  const resp = await fetch(`${EDIT_API}/${id}`, {
    method: 'POST',
    headers: { ...{ 'Content-Type': 'application/json' }, ..._editHeaders },
    body: JSON.stringify({ headline, deck, body_html }),
  });
  if (!resp.ok) throw new Error(`update failed: ${resp.status}`);
  return resp.json();
};

export const useAacrVendorNews = (vendorKey, { limit = 5 } = {}) => {
  const url = vendorKey
    ? `${AACR_API_BASE}/vendor/${encodeURIComponent(vendorKey)}?limit=${limit}`
    : null;
  const state = _useEndpoint(url);
  return {
    items: state.data?.items ?? [],
    count: state.data?.count ?? 0,
    loading: state.loading,
    error: state.error,
    enabled: Boolean(vendorKey),
  };
};
