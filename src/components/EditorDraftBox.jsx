import React, { useState } from 'react';
import { getEditSecret } from '../utils/editSecret';

const STEPS = { INPUT: 0, DRAFTING: 1, REVIEW: 2, PUBLISHED: 3 };

export default function EditorDraftBox({ onClose }) {
  const [step, setStep] = useState(STEPS.INPUT);
  const [content, setContent] = useState('');
  const [draft, setDraft] = useState(null);
  const [tipId, setTipId] = useState('');
  const [draftMode, setDraftMode] = useState('ai'); // 'ai' or 'format'
  const [publishing, setPublishing] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState('');

  const handleDraft = async () => {
    if (!content.trim() || content.trim().length < 20) {
      alert('Please describe the article you want (20+ chars).');
      return;
    }
    setDraftMode('ai');
    setStep(STEPS.DRAFTING);
    try {
      const resp = await fetch('https://courageous-essence-production.up.railway.app/api/editor-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Edit-Secret': getEditSecret(),
        },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        alert('Draft failed: ' + (data.error || data.detail || resp.status));
        setStep(STEPS.INPUT);
        return;
      }
      setDraft(data.draft);
      setTipId(data.tip_id || '');
      setStep(STEPS.REVIEW);
    } catch (e) {
      alert('Draft failed: ' + e.message);
      setStep(STEPS.INPUT);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const resp = await fetch('/api/editor-draft/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Edit-Secret': getEditSecret(),
        },
        body: JSON.stringify({
          headline: draft.headline,
          deck: draft.deck,
          body_html: draft.body_html,
          entity: draft.entity,
          tip_id: tipId,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        alert('Publish failed: ' + (data.error || data.detail || resp.status));
        setPublishing(false);
        return;
      }
      setPublishedSlug(data.article_id);
      setStep(STEPS.PUBLISHED);
    } catch (e) {
      alert('Publish failed: ' + e.message);
    } finally {
      setPublishing(false);
    }
  };

  const updateDraftField = (field, value) => {
    setDraft(prev => ({ ...prev, [field]: value }));
  };

  // --- Step: Input ---
  if (step === STEPS.INPUT) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Quick Draft</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">&times;</button>
            </div>
            <p className="text-sm text-slate-500 mt-1">Paste content to publish directly, or describe what you want and let Opus draft it.</p>
          </div>
          <div className="p-6">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={6}
              autoFocus
              placeholder="Paste an article or LinkedIn post to publish as-is, or describe what you want Opus to write..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-y"
            />
          </div>
          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer border-none">Cancel</button>
            <button
              onClick={async () => {
                if (!content.trim() || content.trim().length < 20) {
                  alert('Content too short (20+ chars).');
                  return;
                }
                setDraftMode('format');
                setStep(STEPS.DRAFTING);
                try {
                  const resp = await fetch('/api/editor-draft/format', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-Edit-Secret': getEditSecret(),
                    },
                    body: JSON.stringify({ content: content.trim() }),
                  });
                  const data = await resp.json();
                  if (!resp.ok || !data.ok) {
                    alert('Format failed: ' + (data.error || data.detail || resp.status));
                    setStep(STEPS.INPUT);
                    return;
                  }
                  setDraft({
                    headline: data.headline || '',
                    deck: data.deck || '',
                    body_html: data.body_html || '',
                    entity: data.entity || null,
                  });
                  setTipId('direct-publish-' + Date.now());
                  setStep(STEPS.REVIEW);
                } catch (e) {
                  alert('Format failed: ' + e.message);
                  setStep(STEPS.INPUT);
                }
              }}
              disabled={content.trim().length < 20}
              className="px-5 py-2 text-sm font-semibold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg cursor-pointer border border-brand-200 disabled:opacity-50"
            >
              Publish As-Is
            </button>
            <button
              onClick={handleDraft}
              disabled={content.trim().length < 20}
              className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg cursor-pointer border-none disabled:opacity-50"
            >
              AI Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step: Drafting (waiting for Opus) ---
  if (step === STEPS.DRAFTING) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center" onClick={e => e.stopPropagation()}>
          <div className="mb-4">
            <div className="inline-block w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {draftMode === 'ai' ? 'Opus is writing...' : 'Formatting...'}
          </h2>
          <p className="text-sm text-slate-500">
            {draftMode === 'ai'
              ? 'Enriching with entity profile, prior articles, and knowledge base. Usually 15-30 seconds.'
              : 'Cleaning up formatting for publication. Just a moment.'}
          </p>
        </div>
      </div>
    );
  }

  // --- Step: Review & Edit ---
  if (step === STEPS.REVIEW) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full my-8" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Review Draft</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">&times;</button>
            </div>
            <p className="text-sm text-slate-500 mt-1">Edit any field before publishing. {draft?.entity && `Entity: ${draft.entity}`}</p>
          </div>

          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Headline</label>
              <input
                type="text"
                value={draft?.headline || ''}
                onChange={e => updateDraftField('headline', e.target.value)}
                className="w-full px-3 py-2 text-base font-semibold border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Deck</label>
              <input
                type="text"
                value={draft?.deck || ''}
                onChange={e => updateDraftField('deck', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Body</label>
              <textarea
                value={draft?.body_html || ''}
                onChange={e => updateDraftField('body_html', e.target.value)}
                rows={14}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-y"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => setStep(STEPS.INPUT)}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer border-none"
            >
              &larr; Re-draft
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-6 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg cursor-pointer border-none disabled:opacity-50"
            >
              {publishing ? 'Publishing...' : 'Publish Article'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Step: Published ---
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center" onClick={e => e.stopPropagation()}>
        <div className="text-4xl mb-3">&#10003;</div>
        <h2 className="text-2xl font-bold text-green-600 mb-2">Published!</h2>
        <p className="text-slate-600 mb-1">{draft?.headline}</p>
        <p className="text-xs text-slate-400 mb-6">ID: {publishedSlug}</p>
        <button
          onClick={() => { onClose(); window.location.reload(); }}
          className="px-6 py-2 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 cursor-pointer border-none"
        >
          Close &amp; Refresh
        </button>
      </div>
    </div>
  );
}
