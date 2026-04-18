import React from 'react';

import NewsHero from '../components/NewsHero';
import NewsFeedGrid from '../components/NewsFeedGrid';
import CompactTestSearch from '../components/CompactTestSearch';
import { useHeroArticle, useNewsFeed } from '../dal/news';

export default function NewsFirstHome({ onNavigate }) {
  const { hero, loading: heroLoading, error: heroError } = useHeroArticle();
  const { items, loading: feedLoading, error: feedError } = useNewsFeed({ limit: 15 });

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wide font-medium text-brand-600 mb-1">
          openonco.org — DX insider
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold text-slate-900">
          Diagnostics news for the people building, buying, and covering it.
        </h1>
      </header>

      <div className="grid gap-6 md:grid-cols-3 md:items-start">
        <div className="md:col-span-2">
          <NewsHero article={hero} loading={heroLoading} error={heroError} />
        </div>
        <div className="md:col-span-1">
          <CompactTestSearch onNavigate={onNavigate} />
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">Latest</h2>
          <a href="/news" className="text-sm text-brand-600 hover:underline">
            All news &rarr;
          </a>
        </div>
        <NewsFeedGrid
          items={items}
          loading={feedLoading}
          error={feedError}
          heroArticleId={hero?.id}
        />
      </section>
    </main>
  );
}
