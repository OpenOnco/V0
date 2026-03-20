import { CANONICAL_CANCER_TYPES } from '../../data/canonicalCancerTypes';

export default function FamilyHistoryStep({ value, onChange }) {
  const toggle = (cancerType) => {
    const next = value.includes(cancerType)
      ? value.filter((c) => c !== cancerType)
      : [...value, cancerType];
    onChange('familyHistory', next);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Family history</h2>
      <p className="text-slate-600 mb-6">
        Select any cancer types that close family members (parents, siblings,
        children) have been diagnosed with. These will be included as columns
        in your discussion guide.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CANONICAL_CANCER_TYPES.map((c) => (
          <button
            key={c}
            onClick={() => toggle(c)}
            className={`px-3 py-2 rounded-lg border text-sm text-left transition-colors ${
              value.includes(c)
                ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {value.length > 0 && (
        <p className="mt-4 text-sm text-slate-500">
          {value.length} selected
        </p>
      )}
    </div>
  );
}
