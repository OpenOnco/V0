import React, { useState, useMemo } from 'react';

import { useAacrHome, useNewsFeed } from '../dal/news';
import { useAllTests } from '../dal/hooks/useTests';
import LinkedArticleText from '../components/LinkedArticleText';
import VendorPopup from '../components/VendorPopup';
import TestDetailModal from '../components/test/TestDetailModal';

function ArticleCard({ item, accent, tests, onTestClick, onVendorClick }) {
  const borderClass = accent === 'aacr'
    ? 'border-rose-200 hover:border-rose-300'
    : 'border-slate-200 hover:border-slate-300';
  return (
    <div className={`p-4 rounded-xl bg-white border ${borderClass} hover:shadow-sm transition`}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className={`text-[11px] uppercase tracking-wide font-medium ${accent === 'aacr' ? 'text-rose-600' : 'text-brand-600'}`}>
          {item.vertical || 'news'}
        </span>
        {item.entity && (
          <span className="text-[11px] text-slate-500">
            {item.entity_ticker || item.entity}
          </span>
        )}
      </div>
      <a href={item.url} className="block group">
        <h3 className="text-[15px] font-semibold text-slate-900 leading-snug line-clamp-3 group-hover:text-brand-700 transition-colors">
          <LinkedArticleText
            text={item.headline}
            tests={tests}
            onTestClick={onTestClick}
            onVendorClick={onVendorClick}
          />
        </h3>
      </a>
      {item.deck && (
        <p className="mt-1.5 text-sm text-slate-600 leading-snug line-clamp-2">
          <LinkedArticleText
            text={item.deck}
            tests={tests}
            onTestClick={onTestClick}
            onVendorClick={onVendorClick}
          />
        </p>
      )}
      <p className="mt-2 text-[11px] text-slate-500">
        {item.published_at?.slice(0, 10)}
      </p>
    </div>
  );
}

function ColumnSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-slate-100 animate-pulse h-28 border border-slate-200" />
      ))}
    </div>
  );
}

export default function NewsFirstHome({ onNavigate }) {
  const aacr = useAacrHome();
  const { items: newsItems, loading: newsLoading, error: newsError } = useNewsFeed({ limit: 20 });
  const { tests: allTests } = useAllTests();
  const takeoverActive = aacr.takeoverActive;

  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);

  // All tests as a flat array (already flat from DAL)
  const flatTests = useMemo(() => allTests || [], [allTests]);

  const handleTestClick = (test) => setSelectedTest(test);
  const handleVendorClick = (vendorName) => setSelectedVendor(vendorName);

  // General news = everything NOT tagged AACR
  const generalItems = (newsItems || []).filter(i => i.conference_slug !== 'aacr-2026');
  const aacrItems = [...(aacr.latest || [])];
  if (aacr.hero && !aacrItems.find(i => i.id === aacr.hero.id)) {
    aacrItems.unshift(aacr.hero);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
          OpenOnco News: All the diagnostics news that's fit to print
        </h1>
      </header>

      {/* Mobile: AACR first, then link to general news below */}
      {/* Desktop: two columns side by side */}
      <div className="grid gap-8 md:grid-cols-5 md:items-start">
        {/* General news — left on desktop, second on mobile */}
        <div className="md:col-span-3 order-2 md:order-1" id="general-news">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Latest</h2>
          </div>
          {newsLoading && generalItems.length === 0 ? (
            <ColumnSkeleton count={6} />
          ) : newsError ? (
            <p className="text-sm text-slate-500">Couldn't load news.</p>
          ) : generalItems.length === 0 ? (
            <p className="text-sm text-slate-500">No articles yet.</p>
          ) : (
            <div className="space-y-3">
              {generalItems.map(item => (
                <ArticleCard
                  key={item.id}
                  item={item}
                  tests={flatTests}
                  onTestClick={handleTestClick}
                  onVendorClick={handleVendorClick}
                />
              ))}
            </div>
          )}
        </div>

        {/* AACR — right on desktop, first on mobile */}
        {takeoverActive && (
          <div className="md:col-span-2 order-1 md:order-2">
            {/* Mobile-only link to skip past AACR */}
            <a
              href="#general-news"
              className="md:hidden block mb-3 text-center text-sm text-brand-600 hover:underline"
            >
              Skip to all other news &darr;
            </a>
            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/30 p-4">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-rose-700">AACR 2026</h2>
              </div>
              <p className="text-xs text-rose-600/70 mb-4">
                Live from San Diego &middot; April 17–22
              </p>
              {aacr.loading && aacrItems.length === 0 ? (
                <ColumnSkeleton count={3} />
              ) : aacrItems.length === 0 ? (
                <p className="text-sm text-slate-500">No AACR coverage yet.</p>
              ) : (
                <div className="space-y-3">
                  {aacrItems.map(item => (
                    <ArticleCard
                      key={item.id}
                      item={item}
                      accent="aacr"
                      tests={flatTests}
                      onTestClick={handleTestClick}
                      onVendorClick={handleVendorClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!takeoverActive && (
          <div className="md:col-span-2 order-1 md:order-2" />
        )}
      </div>

      {/* Test detail popup */}
      {selectedTest && (
        <TestDetailModal
          test={selectedTest}
          category={selectedTest.category}
          onClose={() => setSelectedTest(null)}
        />
      )}

      {/* Vendor summary popup */}
      {selectedVendor && (
        <VendorPopup
          vendorName={selectedVendor}
          tests={flatTests}
          onClose={() => setSelectedVendor(null)}
        />
      )}
    </main>
  );
}
