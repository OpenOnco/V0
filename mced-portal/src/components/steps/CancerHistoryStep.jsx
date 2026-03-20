import { CANONICAL_CANCER_TYPES } from '../../data/canonicalCancerTypes';

export default function CancerHistoryStep({ form, onChange, onNext }) {
  const { personalCancerDiagnosis, continueAfterDiagnosis, personalCancerType } = form;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        Cancer diagnosis
      </h2>
      <p className="text-slate-600 mb-6">
        Have you personally been diagnosed with cancer?
      </p>

      <div className="flex gap-3 mb-6">
        {[false, true].map((val) => (
          <button
            key={String(val)}
            onClick={() => {
              onChange('personalCancerDiagnosis', val);
              if (!val) {
                onChange('continueAfterDiagnosis', false);
                onChange('personalCancerType', '');
              }
            }}
            className={`flex-1 p-4 rounded-lg border-2 text-center font-medium transition-colors ${
              personalCancerDiagnosis === val
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            {val ? 'Yes' : 'No'}
          </button>
        ))}
      </div>

      {personalCancerDiagnosis && !continueAfterDiagnosis && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 font-medium mb-2">Important note</p>
          <p className="text-amber-700 text-sm mb-3">
            MCED tests are designed for early cancer detection in people without a
            known cancer. If you are managing an existing diagnosis, other tests
            may be more appropriate:
          </p>
          <ul className="text-sm text-amber-700 mb-4 space-y-1">
            <li>
              <a href="https://openonco.org/monitor" className="underline hover:text-amber-900" target="_blank" rel="noopener noreferrer">
                MRD tests
              </a>{' '}
              — for monitoring treatment response
            </li>
            <li>
              <a href="https://openonco.org/treat" className="underline hover:text-amber-900" target="_blank" rel="noopener noreferrer">
                Treatment decision tests
              </a>{' '}
              — for guiding therapy selection
            </li>
          </ul>
          <button
            onClick={() => onChange('continueAfterDiagnosis', true)}
            className="text-sm text-amber-800 underline hover:text-amber-900"
          >
            Continue anyway
          </button>
        </div>
      )}

      {personalCancerDiagnosis && continueAfterDiagnosis && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            What type of cancer were you diagnosed with?
          </label>
          <select
            value={personalCancerType}
            onChange={(e) => onChange('personalCancerType', e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Cancer type"
          >
            <option value="">Select cancer type</option>
            {CANONICAL_CANCER_TYPES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
