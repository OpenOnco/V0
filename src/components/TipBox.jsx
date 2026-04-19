import React, { useState } from 'react';

export default function TipBox({ onClose }) {
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('tip');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim() || message.trim().length < 20) {
      alert('Please enter at least a few sentences.');
      return;
    }
    setSending(true);
    try {
      const resp = await fetch('/api/public-tip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          category,
          name: name.trim() || null,
          email: email.trim() || null,
        }),
      });
      if (resp.ok) {
        setSent(true);
      } else {
        alert('Failed to send — please try again.');
      }
    } catch {
      alert('Failed to send — please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center" onClick={e => e.stopPropagation()}>
          <h2 className="text-2xl font-bold text-green-600 mb-2">Thank you!</h2>
          <p className="text-slate-600 mb-6">Your message has been received. Our editorial team will review it.</p>
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
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Tips, Ideas, Corrections</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none bg-transparent border-none cursor-pointer">&times;</button>
          </div>
          <p className="text-sm text-slate-500 mt-1">Help us cover the diagnostics industry better.</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            {['tip', 'idea', 'correction'].map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full cursor-pointer border transition ${
                  category === c
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {c === 'tip' ? 'News Tip' : c === 'idea' ? 'Article Idea' : 'Correction'}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              {category === 'tip' ? 'What should we know?' : category === 'idea' ? 'What should we write about?' : 'What did we get wrong?'}
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder={
                category === 'tip' ? "e.g., I think that Company X is about to announce..."
                : category === 'idea' ? "e.g., You should write about the trend in..."
                : "e.g., In your article about X, the figure should be..."
              }
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-y"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Name (optional)</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Email (optional)</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-brand-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer border-none">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={sending || message.trim().length < 20}
            className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg cursor-pointer border-none disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
