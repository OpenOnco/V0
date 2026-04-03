import React from 'react';

const EXAMPLE_QUESTIONS = [
  'Signatera for stage II colon cancer',
  'Is MRD testing in NCCN guidelines?',
  'What to do with a positive ctDNA result',
  'IMvigor011 bladder cancer',
  'ctDNA sensitivity by stage',
];

const EvidenceEmptyState = ({ query, onSearch }) => {
  return (
    <div className="mt-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <svg className="h-6 w-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-slate-800">No evidence found</h3>
      <p className="mt-1 text-sm text-slate-500">
        No indexed evidence matched <span className="font-medium text-slate-700">"{query}"</span>. Try broadening your search or using different terms.
      </p>

      <div className="mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-3">Try one of these</p>
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_QUESTIONS.map((question) => (
            <button
              key={question}
              onClick={() => onSearch(question)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EvidenceEmptyState;
