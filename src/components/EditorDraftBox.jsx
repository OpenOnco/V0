import React, { useState } from 'react';
import { getEditSecret } from '../utils/editSecret';

export default function EditorDraftBox({ onClose }) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || content.trim().length < 20) {
      alert('Please describe the article you want.');
      return;
    }
    setSending(true);
    try {
      const resp = await fetch('/api/editor-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Edit-Secret': getEditSecret(),
        },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (resp.ok) {
        setSent(true);
      } else {
        alert('Failed: ' + resp.status);
      }
    } catch (e) {
      alert('Failed: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center" onClick={e => e.stopPropagation()}>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Drafting!</h2>
          <p className="text-slate-600 mb-6">Opus is writing the article now. It'll auto-publish in ~30 seconds.</p>
          <button onClick={onClose} className="px-6 py-2 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 cursor-pointer border-none">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Quick Draft</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">&times;</button>
          </div>
          <p className="text-sm text-slate-500 mt-1">Describe the article you want. Opus will draft it immediately with corpus enrichment.</p>
        </div>

        <div className="p-6">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={6}
            autoFocus
            placeholder="e.g., Write about Illumina's new NGS performance data compared to MGI — what does this mean for competition from China?"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-y"
          />
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer border-none">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={sending || content.trim().length < 20}
            className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg cursor-pointer border-none disabled:opacity-50"
          >
            {sending ? 'Sending to Opus...' : 'Draft Article'}
          </button>
        </div>
      </div>
    </div>
  );
}
