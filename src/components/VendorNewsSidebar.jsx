import React from 'react';

import { useVendorNews } from '../dal/news';

// Small sidebar widget for test-detail pages. Accepts a ticker OR vendor name.
// If ticker is not set, renders nothing (vendor-name-only lookups can be added
// later once BaseCall's vendor lookup supports aliases).
export default function VendorNewsSidebar({ ticker, vendorName = null, limit = 4 }) {
  const { items, loading, error, enabled } = useVendorNews(ticker, { limit });

  if (!enabled) return null;
  if (error) return null;

  const label = vendorName || ticker;

  if (loading && items.length === 0) {
    return (
      <aside className="rounded-xl bg-white border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent {label} news</h3>
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />
          ))}
        </div>
      </aside>
    );
  }

  if (items.length === 0) {
    return null;  // quiet empty state — don't clutter the page
  }

  return (
    <aside className="rounded-xl bg-white border border-slate-200 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-700">Recent {label} news</h3>
        <a
          href={`/news?vendor=${encodeURIComponent(ticker)}`}
          className="text-xs text-brand-600 hover:underline"
        >
          more &rarr;
        </a>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.url}
              className="block text-sm text-slate-700 hover:text-brand-700 leading-snug"
            >
              <span className="text-[11px] uppercase tracking-wide text-slate-500 mr-1">
                {item.published_at?.slice(0, 10)}
              </span>
              {item.headline}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
