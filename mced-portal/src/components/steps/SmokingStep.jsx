import { SMOKING_CANCERS } from '../../data/smokingCancers';

const OPTIONS = [
  { value: 'never', label: 'Never smoked' },
  { value: 'former', label: 'Former smoker' },
  { value: 'current', label: 'Current smoker' },
];

export default function SmokingStep({ value, onChange }) {
  const isSmoker = value === 'former' || value === 'current';

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Smoking status</h2>
      <p className="text-slate-600 mb-6">
        Smoking is associated with elevated risk for several cancer types.
        This helps determine which cancer types to include in your discussion guide.
      </p>

      <div className="flex flex-col gap-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange('smokingStatus', opt.value)}
            className={`p-4 rounded-lg border-2 text-left font-medium transition-colors ${
              value === opt.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isSmoker && (
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            Based on smoking history, the following cancer types will be
            included in your discussion guide:{' '}
            <span className="font-medium">{SMOKING_CANCERS.join(', ')}</span>
          </p>
        </div>
      )}
    </div>
  );
}
