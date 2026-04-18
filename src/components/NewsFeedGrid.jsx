import React from 'react';

export default function NewsFeedGrid({ items, loading, error, heroArticleId = null }) {
  if (loading && (!items || items.length === 0)) {
    return (
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-slate-100 animate-pulse h-32 border border-slate-200" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-slate-500">Couldn't load news right now.</p>
    );
  }
  const filtered = items.filter((i) => i.id !== heroArticleId);
  if (filtered.length === 0) {
    return (
      <p className="text-slate-500">Nothing new in the feed yet.</p>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {filtered.map((item) => (
        <li key={item.id}>
          <a
            href={item.url}
            className="block h-full p-4 rounded-xl bg-white border border-slate-200 hover:shadow-sm hover:border-slate-300 transition"
          >
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-wide font-medium text-brand-600">
                {item.vertical || 'news'}
              </span>
              {item.entity && (
                <span className="text-[11px] text-slate-500">
                  {item.entity_ticker || item.entity}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-3">
              {item.headline}
            </h3>
            {item.deck && (
              <p className="mt-1.5 text-sm text-slate-600 leading-snug line-clamp-2">
                {item.deck}
              </p>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              {item.published_at?.slice(0, 10)}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
