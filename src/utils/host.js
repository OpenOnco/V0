// Returns true when the SPA is running on the basecall.news brand.
// Used by Header / page titles to swap OpenOnco branding for BaseCall.
export function isBasecallHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname.toLowerCase();
  return h === 'basecall.news' || h === 'www.basecall.news';
}
