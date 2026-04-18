import React from 'react';

// Big above-the-fold article card linking to /news/:id (BaseCall SSR via rewrite).
export default function NewsHero({ article, loading, error }) {
  if (loading && !article) {
    return (
      <div className="rounded-2xl bg-slate-100 animate-pulse h-64 border border-slate-200" aria-busy="true" />
    );
  }
  if (error) {
    return null;
  }
  if (!article) {
    return null;
  }

  const vendorLabel = article.entity
    ? `${article.entity}${article.entity_ticker ? ` · ${article.entity_ticker}` : ''}`
    : null;

  return (
    <a
      href={article.url}
      className="group block rounded-2xl bg-gradient-to-br from-brand-50 via-white to-warm-50 border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="p-6 md:p-8">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <span className="text-xs uppercase tracking-wide font-medium text-brand-600">
            {article.vertical || 'top story'}
          </span>
          {vendorLabel && <span className="text-xs text-slate-500">{vendorLabel}</span>}
        </div>
        <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 leading-tight group-hover:text-brand-700 transition-colors">
          {article.headline}
        </h2>
        {article.deck && (
          <p className="mt-3 text-slate-700 text-base md:text-lg leading-relaxed">
            {article.deck}
          </p>
        )}
        <p className="mt-4 text-xs text-slate-500">
          {article.published_at?.slice(0, 10)}
          <span className="ml-3 text-brand-600 group-hover:underline">Read &rarr;</span>
        </p>
      </div>
    </a>
  );
}
