export default function Methodology() {
  return (
    <div className="mt-8 pt-5 border-t border-gray-300">
      <h2 className="text-sm font-medium text-gray-900 mb-2.5">Methodology</h2>
      <div className="text-xs text-gray-500 leading-relaxed space-y-2">
        <p>
          Sensitivity values represent the percentage of cancers correctly
          identified at <strong className="text-gray-600">Stage I-II</strong>{' '}
          (early-stage disease), the stages where treatment is most effective.
          Values are derived from published clinical validation studies for each
          test.
        </p>
        <p>Detection strength is classified using two thresholds:</p>
        <p>
          <span className="text-green-700 font-medium">Strong detection (&gt;50%)</span>{' '}
          — the test identifies more than half of early-stage cases for this
          cancer type.
        </p>
        <p>
          <span className="text-amber-700 font-medium">Moderate detection (25-50%)</span>{' '}
          — the test identifies between one-quarter and one-half of early-stage
          cases.
        </p>
        <p>
          <span className="text-red-500 font-medium">Limited or not tested (25% or less, or no data)</span>{' '}
          — the test either detects fewer than one in four early-stage cases, or
          has not published per-cancer sensitivity data for this cancer type.
        </p>
        <p>
          Only cancer types with a sample size of at least 5 patients in the
          validation study are included.
        </p>
        <p className="pt-2.5 border-t border-gray-200">
          <strong className="text-gray-600">Data sources:</strong> Galleri —
          CCGA3 clinical validation (Klein et al., Annals of Oncology, 2021).
          Cancerguard — ASCEND-2 study (AACR 2024). Caris Detect — Achieve 1
          interim readout (Caris Life Sciences, Feb 2026). EPISEEK — published
          performance data. All values are Stage I-II where available; some
          values are estimated from published stage-specific breakdowns.
        </p>
        <p>
          This tool is for informational purposes only and does not provide
          medical advice. MCED tests require a physician&apos;s order. Discuss
          testing decisions with your healthcare provider.
        </p>
      </div>
    </div>
  );
}
