/**
 * Lightweight news analytics tracker for openonco.org.
 * No cookies, no localStorage — anonymous, privacy-respecting.
 */

const ENDPOINT = '/api/analytics/event';
let _lastSend = 0;
let _maxScroll = 0;
let _pageStart = Date.now();
let _currentPath = null;
let _idleTimer = null;

function uaType() {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function send(payload) {
  const now = Date.now();
  if (now - _lastSend < 1000) return; // debounce 1s
  _lastSend = now;
  const body = JSON.stringify({
    ...payload,
    screen: `${window.screen.width}x${window.screen.height}`,
    ua_type: uaType(),
    referrer: document.referrer || undefined,
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
  } else {
    fetch(ENDPOINT, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  }
}

function onScroll() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight > 0) {
    _maxScroll = Math.max(_maxScroll, Math.round((scrollTop / docHeight) * 100));
  }
}

function sendReadEvent() {
  const duration = Math.round((Date.now() - _pageStart) / 1000);
  if (duration < 1) return;
  send({ type: 'read', path: _currentPath, duration, scroll_pct: _maxScroll });
}

function resetIdle() {
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(sendReadEvent, 5 * 60 * 1000); // 5 min idle
}

/** Call on every route change */
export function trackPageview(path) {
  // Send read event for previous page
  if (_currentPath) sendReadEvent();
  _currentPath = path;
  _pageStart = Date.now();
  _maxScroll = 0;
  send({ type: 'pageview', path });
  resetIdle();
}

/** Explicit article-read tracking */
export function trackArticleRead(articleId, duration, scrollPct) {
  send({ type: 'read', path: _currentPath, article_id: articleId, duration, scroll_pct: scrollPct });
}

/** Initialize listeners — call once */
export function initNewsTracker() {
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('beforeunload', sendReadEvent);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sendReadEvent();
  });
  // Track initial page
  trackPageview(window.location.pathname);
}
