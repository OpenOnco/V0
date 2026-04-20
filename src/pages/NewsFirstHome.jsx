import React, { useState, useMemo, useCallback, useEffect } from 'react';

import { useAacrHome, useAacrFeed, useNewsFeed, pinArticle, unpinArticle, killArticle } from '../dal/news';
import { getEditSecret } from '../utils/editSecret';
import { useAllTests } from '../dal/hooks/useTests';
import LinkedArticleText from '../components/LinkedArticleText';
import VendorPopup from '../components/VendorPopup';
import TestDetailModal from '../components/test/TestDetailModal';
import ArticleEditor from '../components/ArticleEditor';
import TipBox from '../components/TipBox';
import EditorDraftBox from '../components/EditorDraftBox';
import StockGadget from '../components/StockGadget';
import { SEED_TICKERS } from '../data/stocks';

function EditorReviewButton() {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    Promise.all([
      fetch('/api/crawl-dashboard').then(r => r.json()).catch(() => ({})),
      fetch('/api/editor-review/tips').then(r => r.json()).catch(() => ({ items: [] })),
    ]).then(([dash, tips]) => {
      const clusters = dash?.desk?.editor_review || 0;
      const activeTips = (tips?.items || []).filter(t => t.status !== 'dismissed').length;
      setTotal(clusters + activeTips);
    });
  }, []);
  return (
    <a
      href={`https://courageous-essence-production.up.railway.app/editor-review?secret=${encodeURIComponent(getEditSecret())}`}
      target="_blank"
      rel="noopener"
      className={`text-sm font-bold px-4 py-1.5 rounded-full transition ${
        total > 0
          ? 'text-white bg-red-600 hover:bg-red-700 animate-pulse'
          : 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
      }`}
    >
      {total > 0 ? `${total} awaiting review` : 'Review queue'}
    </a>
  );
}

function ArticleCard({ item, accent, tests, onTestClick, onVendorClick, editMode, onPin, onKill, onEdit }) {
  const isPinned = Boolean(item.pinned_at);
  const borderClass = isPinned
    ? 'border-2 border-brand-400 shadow-md shadow-brand-100 bg-brand-50/30 animate-pulse-border'
    : accent === 'aacr'
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
        {item.published_at?.slice(0, 16).replace('T', ' ')}
      </p>

      {/* Edit controls */}
      {editMode && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
          <button
            onClick={() => onPin(item)}
            className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 cursor-pointer"
          >
            {isPinned ? 'Unpin' : 'Pin'}
          </button>
          <button
            onClick={() => onEdit(item)}
            className="px-2 py-1 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded border border-brand-200 cursor-pointer"
          >
            Edit
          </button>
          <button
            onClick={() => onKill(item)}
            className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded border border-red-200 cursor-pointer"
          >
            Kill
          </button>
        </div>
      )}
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

export default function NewsFirstHome({ onNavigate, editMode = false }) {
  const aacr = useAacrHome();
  const { items: aacrFeedItems, loading: aacrFeedLoading } = useAacrFeed({ limit: 50 });
  const { items: newsItems, loading: newsLoading, error: newsError } = useNewsFeed({ limit: 50 });
  const { tests: allTests } = useAllTests();
  const takeoverActive = aacr.takeoverActive;

  const [selectedTest, setSelectedTest] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [editingArticle, setEditingArticle] = useState(null);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [showTipBox, setShowTipBox] = useState(false);
  const [showDraftBox, setShowDraftBox] = useState(false);
  const [dashStats, setDashStats] = useState(null);
  const [stocks, setStocks] = useState(() =>
    SEED_TICKERS.map(s => ({ ...s, flash: false }))
  );

  useEffect(() => {
    fetch('/api/crawl-dashboard')
      .then(r => r.json())
      .then(d => setDashStats(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setStocks(prev => prev.map(s => {
        const d = (Math.random() - 0.5) * 0.25;
        return {
          ...s,
          px:    +(s.px + s.px * d / 100).toFixed(2),
          chg:   +(s.chg + d).toFixed(2),
          flash: Math.random() > 0.85,
        };
      }));
    }, 1800);
    return () => clearInterval(id);
  }, []);

  const flatTests = useMemo(() => allTests || [], [allTests]);

  const handleTestClick = (test) => setSelectedTest(test);
  const handleVendorClick = (vendorName) => setSelectedVendor(vendorName);

  const handlePin = useCallback(async (item) => {
    try {
      if (item.pinned_at) {
        await unpinArticle(item.id);
      } else {
        await pinArticle(item.id);
      }
      setRefreshKey(k => k + 1);
      // Force re-fetch by toggling a key — crude but works
      window.location.reload();
    } catch (e) {
      alert('Pin failed: ' + e.message);
    }
  }, []);

  const handleKill = useCallback(async (item) => {
    if (!confirm(`Kill "${item.headline.slice(0, 60)}..."?`)) return;
    try {
      await killArticle(item.id);
      setHiddenIds(prev => new Set([...prev, item.id]));
    } catch (e) {
      alert('Kill failed: ' + e.message);
    }
  }, []);

  const handleEdit = useCallback((item) => {
    setEditingArticle(item);
  }, []);

  const handleEditorSave = useCallback((updated) => {
    setEditingArticle(null);
    window.location.reload();
  }, []);

  // Filter hidden (killed) items
  const generalItems = (newsItems || [])
    .filter(i => i.conference_slug !== 'aacr-2026')
    .filter(i => !hiddenIds.has(i.id));
  const aacrItems = (aacrFeedItems.length > 0 ? aacrFeedItems : [...(aacr.latest || [])]).filter(i => !hiddenIds.has(i.id));

  return (
    <main className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            OO News
          </h1>
          <button
            onClick={() => setShowTipBox(true)}
            className="flex-shrink-0 px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition cursor-pointer border-none shadow-sm"
          >
            Click for Tips, Ideas, Corrections
          </button>
        </div>
        {dashStats && (() => {
          const arts = dashStats.articles?.published || 0;
          const run = dashStats.active_run;
          const stages = run?.stages || [];
          const collectStages = stages.filter(s => s.stage_name?.startsWith('collect'));
          const lastCollectTime = collectStages.length > 0
            ? new Date(collectStages[collectStages.length - 1]?.finished_at || run?.started_at || '').toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
            : null;
          const newSignals = collectStages.reduce((sum, s) => sum + (s.metrics?.items_new || 0), 0);
          return (
            <p className="text-xs text-slate-400 mt-1">
              {arts} articles published
              {lastCollectTime && ` · last crawl ${lastCollectTime}`}
              {newSignals > 0 && ` · ${newSignals.toLocaleString()} new signals`}
            </p>
          );
        })()}
        {editMode && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
              Editor mode
            </span>
            <button
              onClick={() => setShowDraftBox(true)}
              className="text-sm font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded-full transition cursor-pointer border-none"
            >
              Quick Draft
            </button>
            <EditorReviewButton />
            <a
              href="https://courageous-essence-production.up.railway.app/dashboard"
              target="_blank"
              rel="noopener"
              className="text-sm font-medium text-brand-600 bg-brand-50 px-3 py-1 rounded-full hover:bg-brand-100 transition"
            >
              Pipeline Dashboard &rarr;
            </a>
          </div>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-7 md:items-start">
        {/* Stock gadget — left rail on desktop, hidden on mobile */}
        <div className="hidden md:block md:col-span-1 order-1 sticky top-20" style={{ maxWidth: 150 }}>
          <StockGadget live={stocks} />
        </div>

        {/* General news — center on desktop, second on mobile */}
        <div className="md:col-span-4 order-2" id="general-news">
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
                  editMode={editMode}
                  onPin={handlePin}
                  onKill={handleKill}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )}
        </div>

        {/* AACR — right on desktop, first on mobile */}
        {takeoverActive && (
          <div className="md:col-span-2 order-1 md:order-3">
            <a href="#general-news" className="md:hidden block mb-3 text-center text-sm text-brand-600 hover:underline">
              Skip to all other news &darr;
            </a>
            <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/30 p-4">
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-rose-700">AACR 2026</h2>
              </div>
              <p className="text-xs text-rose-600/70 mb-4">
                Live from San Diego &middot; April 17–22
              </p>
              {(aacr.loading || aacrFeedLoading) && aacrItems.length === 0 ? (
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
                      editMode={editMode}
                      onPin={handlePin}
                      onKill={handleKill}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!takeoverActive && (
          <div className="md:col-span-2 order-1 md:order-3" />
        )}
      </div>

      {/* Popups */}
      {selectedTest && (
        <TestDetailModal test={selectedTest} category={selectedTest.category} onClose={() => setSelectedTest(null)} />
      )}
      {selectedVendor && (
        <VendorPopup vendorName={selectedVendor} tests={flatTests} onClose={() => setSelectedVendor(null)} />
      )}
      {editingArticle && (
        <ArticleEditor article={editingArticle} onSave={handleEditorSave} onClose={() => setEditingArticle(null)} />
      )}
      {showTipBox && <TipBox onClose={() => setShowTipBox(false)} />}
      {showDraftBox && <EditorDraftBox onClose={() => setShowDraftBox(false)} />}
    </main>
  );
}
