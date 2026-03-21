export default function Methodology({ tests, dataMode, onDataModeChange }) {
  const sourceLine = (tests || [])
    .filter((t) => t.source)
    .map((t) => `${t.name} — ${t.source}`)
    .join('. ');

  const stageLabel = dataMode === 'all' ? 'all stages' : 'Stage I-II';

  return (
    <div className="mt-8 pt-5 border-t border-gray-300">
      <h2 className="text-sm font-medium text-gray-900 mb-2.5">Methodology</h2>
      <div className="text-xs text-gray-500 leading-relaxed space-y-2">
        <p>
          Sensitivity values represent the percentage of cancers correctly
          identified at{' '}
          <strong
            className="text-blue-600 underline underline-offset-2 cursor-pointer hover:text-blue-800"
            onClick={() => onDataModeChange(dataMode === 'early' ? 'all' : 'early')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDataModeChange(dataMode === 'early' ? 'all' : 'early'); } }}
          >
            {stageLabel}
          </strong>{' '}
          <span className="text-[11px] text-gray-400">
            ({dataMode === 'early' ? 'click for all-stage' : 'click for early-stage'})
          </span>{' '}
          {dataMode === 'early'
            ? ', the stages where treatment is most effective.'
            : '(across all cancer stages I-IV).'}
          {' '}Values are derived from published clinical validation studies for each
          test.
        </p>
        <p>Detection strength is classified using two thresholds:</p>
        <p>
          <span className="text-green-700 font-medium">Strong detection (&gt;50%)</span>{' '}
          — the test identifies more than half of cases for this cancer type.
        </p>
        <p>
          <span className="text-amber-700 font-medium">Moderate detection (25-50%)</span>{' '}
          — the test identifies between one-quarter and one-half of cases.
        </p>
        <p>
          <span className="text-red-500 font-medium">Limited or not tested (25% or less, or no data)</span>{' '}
          — the test either detects fewer than one in four cases, or
          has not published per-cancer sensitivity data for this cancer type.
        </p>
        <p>
          These thresholds (&gt;50% and 25%) are defaults. Use the sensitivity
          threshold slider above the test cards to adjust them.
        </p>
        <p>
          Only cancer types with a sample size of at least 5 patients in the
          validation study are included.
        </p>
        {sourceLine && (
          <p className="pt-2.5 border-t border-gray-200">
            <strong className="text-gray-600">Data sources:</strong> {sourceLine}.
            {dataMode === 'early'
              ? ' All values are Stage I-II where available; some values are estimated from published stage-specific breakdowns.'
              : ' All values are overall (all-stage) sensitivity computed from published validation data.'}
          </p>
        )}
        <p>
          This tool presents published clinical data for research and educational
          purposes. It is not a clinical decision support tool. MCED tests
          require a physician&apos;s order — discuss testing decisions with your
          healthcare provider. Data sourced from{' '}
          <a
            href="https://openonco.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-gray-500 hover:text-gray-700"
          >
            OpenOnco.org
          </a>
          , an independent nonprofit cancer diagnostics database. Verify all
          values against original publications.
        </p>
      </div>
    </div>
  );
}
