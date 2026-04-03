import React from 'react';
import EvidenceClaimCard from './EvidenceClaimCard';

const SkeletonCard = () => (
  <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-5">
    <div className="flex gap-2 mb-3">
      <div className="h-5 w-20 rounded-full bg-slate-200" />
      <div className="h-5 w-16 rounded-full bg-slate-200" />
    </div>
    <div className="h-4 w-full rounded bg-slate-200 mb-2" />
    <div className="h-4 w-3/4 rounded bg-slate-200 mb-4" />
    <div className="flex gap-2">
      <div className="h-5 w-14 rounded bg-slate-100" />
      <div className="h-5 w-14 rounded bg-slate-100" />
      <div className="h-5 w-14 rounded bg-slate-100" />
    </div>
    <div className="mt-4 pt-3 border-t border-slate-100">
      <div className="h-3 w-48 rounded bg-slate-100" />
    </div>
  </div>
);

const SectionHeader = ({ children }) => (
  <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-3">{children}</h3>
);

const EvidenceResults = ({ results, onTestClick, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-4 mt-8">
        <div className="h-5 w-64 rounded bg-slate-200 animate-pulse" />
        <div className="h-4 w-48 rounded bg-slate-100 animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (!results) return null;

  const { framing, claims = [], source_count, fallback, test_specific_claims, general_claims } = results;
  const hasTestSplit = test_specific_claims?.length > 0 || general_claims?.length > 0;

  return (
    <div className="mt-8 space-y-4">
      {/* Fallback notice */}
      {fallback && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Note:</span> This response uses general knowledge. Specific indexed evidence was not found for this query.
        </div>
      )}

      {/* Framing sentence */}
      {framing && (
        <p className="text-base text-slate-700 leading-relaxed">{framing}</p>
      )}

      {/* Stats line */}
      <p className="text-sm text-slate-500">
        {claims.length} claim{claims.length !== 1 ? 's' : ''} from {source_count ?? '?'} peer-reviewed source{source_count !== 1 ? 's' : ''}
      </p>

      {/* Claims list */}
      {hasTestSplit ? (
        <>
          {test_specific_claims?.length > 0 && (
            <>
              <SectionHeader>Test-specific evidence</SectionHeader>
              <div className="space-y-4">
                {test_specific_claims.map((claim, i) => (
                  <EvidenceClaimCard key={claim.id || i} claim={claim} onTestClick={onTestClick} />
                ))}
              </div>
            </>
          )}
          {general_claims?.length > 0 && (
            <>
              <SectionHeader>General ctDNA evidence</SectionHeader>
              <div className="space-y-4">
                {general_claims.map((claim, i) => (
                  <EvidenceClaimCard key={claim.id || i} claim={claim} onTestClick={onTestClick} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {claims.map((claim, i) => (
            <EvidenceClaimCard key={claim.id || i} claim={claim} onTestClick={onTestClick} />
          ))}
        </div>
      )}
    </div>
  );
};

export default EvidenceResults;
