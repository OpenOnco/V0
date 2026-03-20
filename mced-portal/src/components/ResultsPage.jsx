import ProfileSummary from './ProfileSummary';
import ComparisonMatrix from './ComparisonMatrix';
import DoctorQuestions from './DoctorQuestions';

export default function ResultsPage({ form, sortedTests, concerns, gaps, allEqual, onStartOver }) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-900">Your Discussion Guide</h2>
        <button
          onClick={onStartOver}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Start over
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Bring this to your next appointment. Talk to your doctor about whether
        MCED testing is appropriate for you.
      </p>

      <ProfileSummary
        form={form}
        concerns={concerns}
        gaps={gaps}
        allEqual={allEqual}
      />

      {!allEqual && sortedTests.length > 0 && (
        <ComparisonMatrix
          sortedTests={sortedTests}
          concerns={concerns}
          gaps={gaps}
        />
      )}

      {allEqual && sortedTests.length > 0 && (
        <div className="space-y-3">
          {sortedTests.map((entry) => (
            <div
              key={entry.test.id}
              className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-slate-900">{entry.test.name}</span>
                <span className="text-sm text-slate-400 ml-2">{entry.test.vendor}</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-slate-600">
                  {entry.test.detectedCancerTypes?.length || '?'} cancer types
                </span>
                {entry.test.listPrice && (
                  <span className="text-sm font-medium text-slate-700 ml-3">
                    ${entry.test.listPrice.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {sortedTests.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No MCED tests with published sensitivity data found.</p>
          <p className="text-sm mt-1">
            Check{' '}
            <a
              href="https://openonco.org/screen"
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              openonco.org/screen
            </a>{' '}
            for all early detection tests.
          </p>
        </div>
      )}

      <DoctorQuestions />
    </div>
  );
}
