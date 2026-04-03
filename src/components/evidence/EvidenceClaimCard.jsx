import React from 'react';

const TYPE_STYLES = {
  trial_result: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Trial Result' },
  guideline_recommendation: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Guideline' },
  diagnostic_performance: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', label: 'Diagnostic Performance' },
  clinical_utility: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: 'Clinical Utility' },
  methodology_note: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label: 'Methodology' },
};

const MetricPill = ({ label, value }) => (
  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
    <span className="font-medium text-slate-500">{label}</span>
    <span>{value}</span>
  </span>
);

const EvidenceClaimCard = ({ claim, onTestClick }) => {
  const type = claim.type || 'methodology_note';
  const style = TYPE_STYLES[type] || TYPE_STYLES.methodology_note;
  const finding = claim.finding || {};
  const metrics = finding.metrics || {};
  const citation = claim.citation || {};
  const tests = claim.scope?.tests || [];
  const verified = claim.verification?.agreement === true;

  const hasMetrics = metrics.n || metrics.hr || metrics.ci || metrics.p_value || metrics.follow_up;

  const pubmedUrl = citation.pmid
    ? `https://pubmed.ncbi.nlm.nih.gov/${citation.pmid}`
    : null;

  const citationText = [
    citation.authors,
    citation.journal,
    citation.year,
  ].filter(Boolean).join(', ');

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Top row: type badge, test badges, verification */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text} border ${style.border}`}>
          {style.label}
        </span>

        {tests.map((test) => (
          <button
            key={test.id || test.name}
            onClick={() => onTestClick?.(test.id)}
            className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            {test.name}
          </button>
        ))}

        {verified && (
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Verified
          </span>
        )}
      </div>

      {/* Headline */}
      <p className="text-sm font-semibold text-slate-900 leading-snug">
        {finding.description}
      </p>

      {/* Effect summary */}
      {finding.effect_summary && (
        <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
          {finding.effect_summary}
        </p>
      )}

      {/* Metrics row */}
      {hasMetrics && (
        <div className="mt-3 flex flex-wrap gap-2">
          {metrics.n && <MetricPill label="n" value={metrics.n.toLocaleString()} />}
          {metrics.hr && <MetricPill label="HR" value={metrics.hr} />}
          {metrics.ci && <MetricPill label="95% CI" value={metrics.ci} />}
          {metrics.p_value && <MetricPill label="p" value={metrics.p_value} />}
          {metrics.follow_up && <MetricPill label="Follow-up" value={metrics.follow_up} />}
        </div>
      )}

      {/* Citation footer */}
      {citationText && (
        <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
          {citationText}
          {pubmedUrl && (
            <>
              {' \u2022 '}
              <a
                href={pubmedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                PMID: {citation.pmid}
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default EvidenceClaimCard;
