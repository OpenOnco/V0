import React, { useState, useCallback } from 'react';
import EvidenceSearchBar from '../components/evidence/EvidenceSearchBar';
import EvidenceResults from '../components/evidence/EvidenceResults';
import EvidenceEmptyState from '../components/evidence/EvidenceEmptyState';

const EvidencePage = ({ onNavigate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async (question) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setLastQuery(question);

    try {
      const res = await fetch('/api/evidence-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`);
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTestClick = useCallback((testId) => {
    if (onNavigate) {
      onNavigate(testId);
    }
  }, [onNavigate]);

  const isEmpty = hasSearched && !isLoading && !error && results && (results.claims?.length === 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Evidence Explorer</h1>
        <p className="mt-2 text-base text-slate-500">
          Peer-reviewed evidence on cancer diagnostic testing. Updated weekly from published literature.
        </p>
      </div>

      {/* Search */}
      <EvidenceSearchBar onSearch={handleSearch} isLoading={isLoading} />

      {/* Error state */}
      {error && (
        <div className="mt-8 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="font-medium">Error:</span> {error}
        </div>
      )}

      {/* Results */}
      {isLoading && <EvidenceResults results={null} onTestClick={handleTestClick} isLoading />}
      {!isLoading && isEmpty && <EvidenceEmptyState query={lastQuery} onSearch={handleSearch} />}
      {!isLoading && results && !isEmpty && (
        <EvidenceResults results={results} onTestClick={handleTestClick} isLoading={false} />
      )}

      {/* Provenance footer */}
      {hasSearched && !isLoading && (
        <div className="mt-12 border-t border-slate-200 pt-6">
          <p className="text-xs text-slate-400 leading-relaxed">
            All evidence from peer-reviewed sources. Not medical advice. Every claim traces to a PubMed citation.
          </p>
          {results?.meta && (
            <p className="mt-2 text-xs text-slate-400">
              {results.meta.total_claims?.toLocaleString() ?? '?'} claims
              {' \u2022 '}{results.meta.total_sources?.toLocaleString() ?? '?'} sources
              {results.meta.last_updated && (
                <> {' \u2022 '}Last updated {results.meta.last_updated}</>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EvidencePage;
