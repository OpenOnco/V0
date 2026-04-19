import React, { useState, useRef } from 'react';
import { updateArticle } from '../dal/news';

export default function ArticleEditor({ article, onSave, onClose }) {
  const [headline, setHeadline] = useState(article.headline || '');
  const [deck, setDeck] = useState(article.deck || '');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body_html = bodyRef.current?.innerHTML || '';
      await updateArticle(article.id, { headline, deck, body_html });
      onSave?.({ ...article, headline, deck, body_html });
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const execCmd = (cmd) => {
    document.execCommand(cmd, false, null);
    bodyRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-lg font-semibold text-slate-900">Edit Article</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Headline */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={e => setHeadline(e.target.value)}
              className="w-full px-3 py-2 text-base font-semibold border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          {/* Deck */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Deck</label>
            <input
              type="text"
              value={deck}
              onChange={e => setDeck(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          {/* Body with formatting toolbar */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Body</label>
            <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-400">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-50 border-b border-slate-200">
                <button
                  onClick={() => execCmd('bold')}
                  className="px-2 py-1 text-sm font-bold text-slate-700 hover:bg-slate-200 rounded cursor-pointer bg-transparent border-none"
                  title="Bold"
                >B</button>
                <button
                  onClick={() => execCmd('italic')}
                  className="px-2 py-1 text-sm italic text-slate-700 hover:bg-slate-200 rounded cursor-pointer bg-transparent border-none"
                  title="Italic"
                >I</button>
              </div>
              <div
                ref={bodyRef}
                contentEditable
                className="px-3 py-3 min-h-[200px] text-sm leading-relaxed focus:outline-none prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: article.body_html || article.deck || '' }}
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-transparent border border-slate-200 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg cursor-pointer border-none disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
