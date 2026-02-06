/**
 * MRD Guidance Chat Component
 * RAG-based natural language search for MRD clinical guidance
 */

import React, { useState, useRef, useEffect } from 'react';

const CANCER_TYPES = [
  { value: '', label: 'All cancer types' },
  { value: 'colorectal', label: 'Colorectal' },
  { value: 'breast', label: 'Breast' },
  { value: 'lung_nsclc', label: 'Lung (NSCLC)' },
  { value: 'bladder', label: 'Bladder' },
  { value: 'pancreatic', label: 'Pancreatic' },
  { value: 'melanoma', label: 'Melanoma' },
  { value: 'ovarian', label: 'Ovarian' },
];

const CLINICAL_SETTINGS = [
  { value: '', label: 'All clinical settings' },
  { value: 'post_surgery', label: 'Post-surgery' },
  { value: 'surveillance', label: 'Surveillance' },
  { value: 'during_adjuvant', label: 'During adjuvant therapy' },
  { value: 'post_adjuvant', label: 'Post-adjuvant' },
  { value: 'recurrence', label: 'Recurrence' },
  { value: 'metastatic', label: 'Metastatic' },
];

const EXAMPLE_QUERIES = [
  'What does evidence say about positive MRD in stage III colorectal post-surgery?',
  'When should ctDNA testing be performed for breast cancer surveillance?',
  'How should negative MRD results influence adjuvant therapy decisions?',
  'What is the prognostic significance of ctDNA clearance during treatment?',
];

export default function MRDChat({ compact = false, className = '' }) {
  const [query, setQuery] = useState('');
  const [cancerType, setCancerType] = useState('');
  const [clinicalSetting, setClinicalSetting] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const resultRef = useRef(null);

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [result]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/mrd-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          filters: {
            ...(cancerType && { cancerType }),
            ...(clinicalSetting && { clinicalSetting }),
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example) => {
    setQuery(example);
  };

  return (
    <div className={compact ? `bg-white rounded-2xl border border-slate-200 shadow-sm p-4 ${className}` : 'max-w-4xl mx-auto'}>
      {/* Header */}
      <div className={compact ? 'mb-3' : 'mb-6'}>
        <h2 className={compact ? 'text-base font-semibold text-slate-900' : 'text-xl font-semibold text-slate-900'}>MRD Guidance Search</h2>
        <p className="text-sm text-slate-600 mt-1">
          Ask clinical questions about MRD testing, evidence, and guidelines
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a clinical question about MRD testing..."
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
            rows={compact ? 2 : 3}
            maxLength={1000}
          />
          <div className="text-xs text-slate-500 mt-1 text-right">
            {query.length}/1000
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={cancerType}
            onChange={(e) => setCancerType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
          >
            {CANCER_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>

          <select
            value={clinicalSetting}
            onChange={(e) => setClinicalSetting(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
          >
            {CLINICAL_SETTINGS.map((cs) => (
              <option key={cs.value} value={cs.value}>{cs.label}</option>
            ))}
          </select>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Searching...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </form>

      {/* Example Queries */}
      {!result && !loading && (
        <div className={compact ? 'mt-3' : 'mt-6'}>
          <p className="text-sm font-medium text-slate-700 mb-2">Example questions:</p>
          <div className="flex flex-wrap gap-2">
            {(compact ? EXAMPLE_QUERIES.slice(0, 2) : EXAMPLE_QUERIES).map((example, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleExampleClick(example)}
                className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full hover:bg-slate-200 transition-colors text-left"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`${compact ? 'mt-3' : 'mt-6'} p-4 bg-red-50 border border-red-200 rounded-lg`}>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div ref={resultRef} className={`${compact ? 'mt-4 space-y-4 max-h-[400px] overflow-y-auto' : 'mt-8 space-y-6'}`}>
          {/* Answer */}
          <div className={`${compact ? 'border border-slate-200 rounded-lg p-4' : 'bg-white border border-slate-200 rounded-lg p-6'}`}>
            <div className="prose prose-slate max-w-none">
              {result.answer.split('\n\n').map((para, i) => (
                <p key={i} className="mb-4 last:mb-0">{para}</p>
              ))}
            </div>
          </div>

          {/* Sources */}
          {result.sources && result.sources.length > 0 && (
            <div className={`bg-slate-50 border border-slate-200 rounded-lg ${compact ? 'p-4' : 'p-6'}`}>
              <h3 className="font-semibold text-slate-900 mb-4">Sources</h3>
              <div className="space-y-3">
                {result.sources.map((source) => (
                  <div key={source.id} className="text-sm">
                    <span className="font-medium text-emerald-700">[{source.index}]</span>{' '}
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-700 hover:text-emerald-600 hover:underline"
                      >
                        {source.title}
                      </a>
                    ) : (
                      <span className="text-slate-700">{source.title}</span>
                    )}
                    {source.evidenceLevel && (
                      <span className="ml-2 text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                        {source.evidenceLevel}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Reading */}
          {result.relatedItems && result.relatedItems.length > 0 && (
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">Related reading:</h4>
              <div className="flex flex-wrap gap-2">
                {result.relatedItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                  >
                    {item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-800">{result.disclaimer}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
